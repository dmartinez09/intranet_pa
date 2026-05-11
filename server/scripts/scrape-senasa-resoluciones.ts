// ============================================================
// Scraper SENASA Resoluciones Directorales (gob.pe) — v2
// Estrategia:
//   1. Listar páginas /institucion/senasa/normas-legales?sheet=N
//      → extrae detail URLs (formato /normas-legales/<id>-<numero>-<año>-<entity>)
//   2. Para cada detail: fetch HTML, extraer título + body + PDF link
//   3. Filtrar a las que mencionen "plaguicida" / "PQUA" en título o body
//   4. (Opcional) parsear PDF para clasificar tipo_accion + extraer PQUAs
//   5. Persistir en icb_dim_senasa_resolucion
// ============================================================

import * as sql from 'mssql';
import { getDbPool, closeDb } from '../src/config/database';
import { fetchAndParsePdf } from '../src/services/etl/parsers/pdf';

const BASE = 'https://www.gob.pe';
const LISTING_URL = '/institucion/senasa/normas-legales';

interface RDDetail {
  numero_rd: string;
  titulo: string;
  anio: number | null;
  fecha: Date | null;
  detail_url: string;
  pdf_url: string | null;
  body_text: string;
}

async function fetchText(url: string): Promise<string> {
  const r = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PointAndinaIntranet/1.0)' },
    signal: AbortSignal.timeout(20000),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status} ${url}`);
  return await r.text();
}

function parseListingDetailLinks(html: string): string[] {
  // Detail URLs: /institucion/senasa/normas-legales/<digits>-<rest>
  const out = new Set<string>();
  const re = /href="(\/institucion\/senasa\/normas-legales\/(\d+)-([^"]+))"/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    out.add(m[1]);
  }
  return Array.from(out);
}

async function fetchRDDetail(detailPath: string): Promise<RDDetail | null> {
  const url = BASE + detailPath;
  const html = await fetchText(url);

  // Extraer titulo (h1 o title)
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const tit = html.match(/<title>([^<]+)<\/title>/i);
  const titulo = ((h1?.[1] || tit?.[1] || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim() || detailPath).substring(0, 500);

  // PDF link
  const pdfMatch = html.match(/href="(https:\/\/cdn\.www\.gob\.pe[^"]+\.PDF?)"/i);
  const pdf_url = pdfMatch ? pdfMatch[1] : null;

  // Numero RD desde detailPath o filename
  let numero_rd = '';
  let anio: number | null = null;
  const slugMatch = detailPath.match(/\/normas-legales\/\d+-([\w-]+)/);
  if (slugMatch) {
    const slug = slugMatch[1].toUpperCase();
    numero_rd = slug;
    const yMatch = slug.match(/(\d{4})/);
    if (yMatch) anio = parseInt(yMatch[1], 10);
  }
  if (!numero_rd && pdf_url) {
    const fileMatch = pdf_url.match(/resolucion-directoral-(?:n-?)?([\w-]+?)(?:\.pdf)?$/i);
    if (fileMatch) numero_rd = fileMatch[1].toUpperCase();
  }
  if (!numero_rd) numero_rd = detailPath.split('/').pop()!.toUpperCase();

  // Fecha (busca formato "14 de marzo de 2026" o "14/03/2026")
  let fecha: Date | null = null;
  const fechaTextual = html.match(/(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|setiembre|septiembre|octubre|noviembre|diciembre)\s+de\s+(\d{4})/i);
  if (fechaTextual) {
    const meses: Record<string, number> = { enero:1, febrero:2, marzo:3, abril:4, mayo:5, junio:6, julio:7, agosto:8, setiembre:9, septiembre:9, octubre:10, noviembre:11, diciembre:12 };
    const mes = meses[fechaTextual[2].toLowerCase()];
    if (mes) fecha = new Date(`${fechaTextual[3]}-${String(mes).padStart(2,'0')}-${String(parseInt(fechaTextual[1])).padStart(2,'0')}`);
  }

  // Body text (strip HTML)
  const main = html.match(/<main[\s\S]*?<\/main>/i)?.[0] || html;
  const body_text = main.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

  return { numero_rd, titulo, anio, fecha, detail_url: url, pdf_url, body_text };
}

function isPlaguicidaRD(detail: RDDetail): boolean {
  const t = (detail.titulo + ' ' + detail.body_text.substring(0, 5000)).toLowerCase();
  return /plaguicida|pqua|pbua|insecticida|herbicida|fungicida|registro de uso agr/.test(t);
}

function classifyAccion(text: string): string {
  const t = text.toLowerCase();
  if (/extensi[oó]n.*registro|amplia[ct]ion.*registro|extensi[oó]n.*uso/.test(t)) return 'EXTENSION';
  if (/otorgar?se.*registro|inscrib(?:ir|ase).*registro|conceder.*registro|registro.*plaguicida/.test(t)) return 'NUEVO_REGISTRO';
  if (/cancel[ae].*registro|cancelaci[oó]n.*registro|denegar.*registro/.test(t)) return 'CANCELACION';
  if (/modific[ar].*registro|modificaci[oó]n.*registro/.test(t)) return 'MODIFICACION';
  return 'OTRO';
}

function extractPQUAs(text: string): string[] {
  const re = /(?:PQUA|PBUA)\s*N[°ºo.\s]*\s*(\d{1,5})/gi;
  const found = new Set<string>();
  let m;
  while ((m = re.exec(text)) !== null) found.add(m[1]);
  return Array.from(found);
}

function getSnippet(text: string): string | null {
  const re = /(extensi[oó]n|amplia[ct]ion|otorgar|inscrib|cancelar|denegar|plaguicida|pqua)/i;
  const m = re.exec(text);
  if (!m) return null;
  const start = Math.max(0, m.index - 80);
  const end = Math.min(text.length, m.index + 220);
  return text.substring(start, end).replace(/\s+/g, ' ').trim();
}

async function main() {
  const MAX_PAGES = Number(process.env.RD_MAX_PAGES || 20);
  const PARSE_PDF = process.env.RD_PARSE_PDF !== '0';

  const pool = await getDbPool();
  console.log(`Scrapeo SENASA RDs · max_pages=${MAX_PAGES} · parse_pdf=${PARSE_PDF}`);

  const seenSlugs = new Set<string>();
  let inserted = 0, updated = 0, skipped = 0, errors = 0;

  for (let sheet = 1; sheet <= MAX_PAGES; sheet++) {
    let listingHtml: string;
    try {
      listingHtml = await fetchText(`${BASE}${LISTING_URL}?sheet=${sheet}`);
    } catch (e) {
      console.error(`Sheet ${sheet} listing fail: ${(e as Error).message}`);
      errors++;
      continue;
    }
    const detailLinks = parseListingDetailLinks(listingHtml).filter(l => !seenSlugs.has(l));
    console.log(`\nSheet ${sheet}: ${detailLinks.length} detail URLs nuevas`);
    if (detailLinks.length === 0) {
      console.log('  (fin del listado o sin nuevas)');
      break;
    }

    for (const path of detailLinks) {
      seenSlugs.add(path);
      let det: RDDetail | null = null;
      try {
        det = await fetchRDDetail(path);
        if (!det) { skipped++; continue; }
      } catch (e) {
        console.warn(`  ✗ detail ${path}: ${(e as Error).message}`);
        errors++;
        continue;
      }

      // Filtrar: sólo RDs que parezcan tener relación con plaguicidas
      if (!isPlaguicidaRD(det)) { skipped++; continue; }

      let tipoAccion = classifyAccion(det.titulo + ' ' + det.body_text.substring(0, 5000));
      let pquas = extractPQUAs(det.body_text);
      let snippet = getSnippet(det.body_text);

      if (PARSE_PDF && det.pdf_url) {
        try {
          const pdf = await fetchAndParsePdf(det.pdf_url);
          if (pdf?.text) {
            const txt = pdf.text.slice(0, 50000);
            const fromPdf = classifyAccion(txt);
            if (fromPdf !== 'OTRO') tipoAccion = fromPdf;
            const morePquas = extractPQUAs(txt);
            morePquas.forEach(p => pquas.includes(p) || pquas.push(p));
            if (!snippet) snippet = getSnippet(txt);
          }
        } catch (e) {
          console.warn(`  PDF parse fail ${det.numero_rd}: ${(e as Error).message}`);
        }
      }

      try {
        const ex = await pool.request().input('nrd', sql.NVarChar(80), det.numero_rd)
          .query(`SELECT resolucion_id FROM dbo.icb_dim_senasa_resolucion WHERE numero_rd=@nrd`);
        if (ex.recordset.length) {
          await pool.request()
            .input('nrd', sql.NVarChar(80), det.numero_rd)
            .input('ttl', sql.NVarChar(500), det.titulo)
            .input('an', sql.Int, det.anio)
            .input('fc', sql.Date, det.fecha)
            .input('tip', sql.NVarChar(40), tipoAccion)
            .input('pq', sql.NVarChar(sql.MAX), JSON.stringify(pquas))
            .input('pdf', sql.NVarChar(800), det.pdf_url)
            .input('det', sql.NVarChar(800), det.detail_url)
            .input('fr', sql.NVarChar(sql.MAX), snippet)
            .query(`UPDATE dbo.icb_dim_senasa_resolucion
                    SET titulo=@ttl, anio=@an, fecha=@fc, tipo_accion=@tip,
                        productos_pqua=@pq, pdf_url=@pdf, detail_url=@det,
                        fragmento_texto=@fr, captured_at=SYSUTCDATETIME()
                    WHERE numero_rd=@nrd`);
          updated++;
        } else {
          await pool.request()
            .input('nrd', sql.NVarChar(80), det.numero_rd)
            .input('ttl', sql.NVarChar(500), det.titulo)
            .input('an', sql.Int, det.anio)
            .input('fc', sql.Date, det.fecha)
            .input('tip', sql.NVarChar(40), tipoAccion)
            .input('pq', sql.NVarChar(sql.MAX), JSON.stringify(pquas))
            .input('pdf', sql.NVarChar(800), det.pdf_url)
            .input('det', sql.NVarChar(800), det.detail_url)
            .input('fr', sql.NVarChar(sql.MAX), snippet)
            .query(`INSERT INTO dbo.icb_dim_senasa_resolucion
                      (numero_rd, titulo, anio, fecha, tipo_accion, productos_pqua, pdf_url, detail_url, fragmento_texto)
                    VALUES (@nrd, @ttl, @an, @fc, @tip, @pq, @pdf, @det, @fr)`);
          inserted++;
        }
        console.log(`  ${ex.recordset.length ? '✎' : '+'} ${det.numero_rd} · ${tipoAccion}${pquas.length ? ` · PQUA[${pquas.length}]` : ''}${det.fecha ? ` · ${det.fecha.toISOString().slice(0,10)}` : ''}`);
      } catch (e) {
        errors++;
        console.error(`  ✗ DB ${det.numero_rd}: ${(e as Error).message}`);
      }
    }
  }

  console.log(`\n=== RESUMEN ===`);
  console.log(`  Insertados: ${inserted} · Actualizados: ${updated} · Filtradas no-plaguicida: ${skipped} · Errores: ${errors}`);

  const tipos = await pool.request().query(`SELECT tipo_accion, COUNT(*) AS qty FROM dbo.icb_dim_senasa_resolucion GROUP BY tipo_accion ORDER BY qty DESC`);
  console.log('\nDistribución tipo_accion:'); console.table(tipos.recordset);
  const years = await pool.request().query(`SELECT anio, COUNT(*) AS qty FROM dbo.icb_dim_senasa_resolucion GROUP BY anio ORDER BY anio DESC`);
  console.log('Distribución año:'); console.table(years.recordset);
  const conPqua = await pool.request().query(`SELECT COUNT(*) AS con_pqua FROM dbo.icb_dim_senasa_resolucion WHERE productos_pqua IS NOT NULL AND productos_pqua <> '[]'`);
  console.log(`Con PQUA cross-ref: ${conPqua.recordset[0].con_pqua}`);

  await closeDb();
}

main().catch(e => { console.error(e); process.exit(1); });
