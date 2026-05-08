// ============================================================
// SENASA Perú — SIGIA Fichas Técnicas de Plaguicidas (v2)
// Estrategia:
//   1. Obtener IDs de productos vía cascada CULTIVO→PLAGA→PRODUCTO
//   2. Para cada producto NUEVO, llamar a GETBYID para obtener TODOS
//      sus usos (cultivo×plaga) + campos enriquecidos
//      (estado_fisico, tipo_formulacion, resolucion_directoral).
//   3. Persistir 1 fila en icb_dim_plaguicida_ficha + N en icb_fact_plaguicida_uso.
//
// Por qué cambió: el endpoint cascada PLAGAPRODUCTOGETLIST devuelve
// TODOS los usos del producto (no respeta el filtro de cultivo/plaga).
// Antes nuestro código asumía que respetaba el filtro y guardaba el
// cultivo del LOOP EXTERNO → todos los registros quedaron como "Cebolla".
// ============================================================

import * as sql from 'mssql';
import { BaseCollector } from './base.collector';
import { CollectorContext, CollectorResult, ParsedSnapshot, Frequency } from '../types';
import { CatalogMaps, detectCrop } from '../normalizers';
import { scoreSnapshot } from '../scoring';
import { getDbPool } from '../../../config/database';

const BASE = 'https://servicios.senasa.gob.pe/SIGIAWeb';
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; PointAndinaIntranet/1.0)',
  'Referer': `${BASE}/sigia_consulta_cultivo.html`,
  'Accept': 'application/json, text/plain, */*',
  'X-Requested-With': 'XMLHttpRequest',
};

async function fetchSigia(path: string): Promise<any> {
  const url = BASE + path;
  const r = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw new Error(`HTTP ${r.status} ${url}`);
  const buf = await r.arrayBuffer();
  const text = new TextDecoder('iso-8859-1').decode(buf).trim();
  if (!text) return [];
  try { return JSON.parse(text); } catch { return []; }
}

const clean = (s: any): string => s == null ? '' : String(s).replace(/\s+/g, ' ').trim();
const num = (s: any): number | null => {
  if (s === '' || s == null) return null;
  const n = Number(String(s).replace(',', '.'));
  return isNaN(n) ? null : n;
};
const intOrNull = (s: any): number | null => {
  if (s === '' || s == null) return null;
  const n = parseInt(String(s), 10);
  return isNaN(n) ? null : n;
};

function mapClaseToCategory(clase: string, maps: CatalogMaps): number | null {
  const c = clean(clase).toLowerCase();
  if (!c) return null;
  if (/fungicida/.test(c)) return maps.categoryByCode.get('FUNGICIDAS') || null;
  if (/insecticida|acaricida/.test(c)) return maps.categoryByCode.get('INSECTICIDAS') || null;
  if (/herbicida/.test(c)) return maps.categoryByCode.get('HERBICIDAS') || null;
  if (/biolog|microbi|bact|hongo entomop/.test(c)) return maps.categoryByCode.get('BIOLOGICOS') || null;
  if (/nutri|fertili|enmienda/.test(c)) return maps.categoryByCode.get('ORGANICOS') || null;
  if (/coadyuv|adher|sinergi/.test(c)) return maps.categoryByCode.get('COADYUVANTES') || null;
  return null;
}

export class SenasaSigiaFichasCollector extends BaseCollector {
  readonly sourceCode = 'SENASA_PLAGUICIDAS';
  readonly pipelineName = 'senasa-sigia-fichas-collector';
  readonly frequency: Frequency = 'weekly';
  readonly description = 'SENASA SIGIA: registro nacional de plaguicidas (cascada + GETBYID enriquecido)';

  async run(_ctx: CollectorContext, maps: CatalogMaps): Promise<CollectorResult> {
    const snapshots: ParsedSnapshot[] = [];
    let recordsRead = 0, recordsInserted = 0, recordsUpdated = 0;

    let cultivos: any[];
    try {
      cultivos = await fetchSigia('/consultas?C=CULTIVO&S=GETLIST');
    } catch (err) {
      console.warn('[SENASA_PLAGUICIDAS] fetch cultivos falló:', (err as Error).message);
      snapshots.push(scoreSnapshot({
        documentTitle: 'SENASA — SIGIA registro de plaguicidas (referencia)',
        documentUrl: `${BASE}/sigia_consulta_cultivo.html`,
        documentType: 'html',
        periodLabel: String(new Date().getFullYear()),
        businessNote: 'Snapshot fallback. Portal SIGIA temporalmente no accesible.',
      }));
      return { recordsRead: 1, recordsInserted: 0, recordsUpdated: 0, recordsSkipped: 0, status: 'SUCCESS', snapshots };
    }

    console.log(`[SENASA_PLAGUICIDAS] ${cultivos.length} cultivos en SIGIA`);
    const pool = await getDbPool();

    // PASO 1 — Descubrir IDs de productos únicos vía cascada
    const productoIds = new Set<string>();
    const TIME_BUDGET_MS = Number(process.env.SIGIA_TIME_BUDGET_MS || 12 * 60 * 1000);
    const startTime = Date.now();

    for (const c of cultivos) {
      if (Date.now() - startTime > TIME_BUDGET_MS) {
        console.warn('[SENASA_PLAGUICIDAS] time budget descubrimiento alcanzado');
        break;
      }
      const [cultivoid] = c;
      try {
        const plagas = await fetchSigia(`/consultas?C=CULTIVO&S=PLAGAGETLIST&cultivoid=${cultivoid}`);
        if (!Array.isArray(plagas) || !plagas.length) continue;
        for (const p of plagas) {
          const [plagaid] = p;
          try {
            const prods = await fetchSigia(`/consultas?C=CULTIVO&S=PLAGAPRODUCTOGETLIST&cultivoid=${cultivoid}&plagas=${plagaid}&idclaseotrouso=`);
            if (!Array.isArray(prods)) continue;
            for (const row of prods) {
              const pid = clean(row[0]);
              if (pid) productoIds.add(pid);
            }
          } catch { /* skip */ }
        }
      } catch { /* skip */ }
    }
    console.log(`[SENASA_PLAGUICIDAS] descubiertos ${productoIds.size} productos únicos en ${(Date.now() - startTime) / 1000 | 0}s`);

    // PASO 2 — GETBYID por producto (paralelizamos fetches en lotes de 8)
    let processedCount = 0;
    const PERSIST_BUDGET_MS = Number(process.env.SIGIA_PERSIST_BUDGET_MS || 25 * 60 * 1000);
    const persistStart = Date.now();
    const ids = Array.from(productoIds);
    const CONCURRENCY = 8;

    async function fetchOneProduct(productoId: string) {
      try {
        return await fetchSigia(`/consultas?C=PRODUCTO&S=GETBYID&productoid=${productoId}`);
      } catch {
        return null;
      }
    }

    for (let i = 0; i < ids.length; i += CONCURRENCY) {
      if (Date.now() - persistStart > PERSIST_BUDGET_MS) {
        console.warn(`[SENASA_PLAGUICIDAS] time budget persistencia alcanzado (${i}/${ids.length})`);
        break;
      }
      const batch = ids.slice(i, i + CONCURRENCY);
      const details = await Promise.all(batch.map(fetchOneProduct));
      for (let k = 0; k < batch.length; k++) {
        const productoId = batch[k];
        const det = details[k];
        if (!det || typeof det !== 'object') continue;
      try {

        const numeroRegistro = clean(det.numeroregistro);
        const nombreComercial = clean(det.nombrecomercial);
        if (!nombreComercial) continue;

        const ingredienteActivo = clean(det.ingredienteactivo) || null;
        const clase = clean(det.clase) || null;
        const categoriaTox = clean(det.categoriatoxicologico) || null;
        const titular = clean(det.razonsocial) || null;
        const estadoFisico = clean(det.estadofisico) || null;
        const tipoFormulacion = clean(det.tipoformulacion) || null;
        const resolucion = clean(det.resoluciondirectoral) || null;
        const tipoProductoId = clean(det.tipoproductoid) || null; // PQUA, etc.
        const categoryId = mapClaseToCategory(clase || '', maps);

        // tipoProducto se infiere desde detalle[0][22] si está
        let tipoProducto: string | null = null;
        const detalle: any[] = Array.isArray(det.detalle) ? det.detalle : [];
        if (detalle.length && detalle[0][22]) tipoProducto = clean(detalle[0][22]);

        // empresaId desde detalle[0][2]
        const empresaId = detalle.length && detalle[0][2] ? clean(detalle[0][2]) : null;

        // UPSERT en icb_dim_plaguicida_ficha
        let plaguicidaId: number;
        const ex = await pool.request()
          .input('pid', sql.NVarChar(40), productoId)
          .query(`SELECT plaguicida_id FROM dbo.icb_dim_plaguicida_ficha WHERE producto_id=@pid`);

        if (ex.recordset.length) {
          plaguicidaId = Number(ex.recordset[0].plaguicida_id);
          await pool.request()
            .input('pid', sql.NVarChar(40), productoId)
            .input('nr', sql.NVarChar(120), numeroRegistro)
            .input('nc', sql.NVarChar(300), nombreComercial)
            .input('ti', sql.NVarChar(300), titular)
            .input('em', sql.NVarChar(40), empresaId)
            .input('ia', sql.NVarChar(500), ingredienteActivo)
            .input('pa', sql.NVarChar(500), clean(det.principiosactivos || ingredienteActivo) || null)
            .input('cl', sql.NVarChar(100), clase)
            .input('ct', sql.NVarChar(80), categoriaTox)
            .input('tp', sql.NVarChar(40), tipoProducto || tipoProductoId)
            .input('cat', sql.Int, categoryId)
            .input('ef', sql.NVarChar(40), estadoFisico)
            .input('tf', sql.NVarChar(120), tipoFormulacion)
            .input('rd', sql.NVarChar(200), resolucion)
            .query(`UPDATE dbo.icb_dim_plaguicida_ficha
                    SET numero_registro=@nr, nombre_comercial=@nc, titular_registro=@ti,
                        empresa_id=@em, ingrediente_activo=@ia, principios_activos=@pa,
                        clase=@cl, categoria_toxicologica=@ct, tipo_producto=@tp,
                        categoria_pa_id=@cat, estado_fisico=@ef, tipo_formulacion=@tf,
                        resolucion_directoral=@rd, updated_at=SYSUTCDATETIME()
                    WHERE producto_id=@pid`);
          recordsUpdated++;
        } else {
          const ins = await pool.request()
            .input('pid', sql.NVarChar(40), productoId)
            .input('nr', sql.NVarChar(120), numeroRegistro)
            .input('nc', sql.NVarChar(300), nombreComercial)
            .input('ti', sql.NVarChar(300), titular)
            .input('em', sql.NVarChar(40), empresaId)
            .input('ia', sql.NVarChar(500), ingredienteActivo)
            .input('pa', sql.NVarChar(500), clean(det.principiosactivos || ingredienteActivo) || null)
            .input('cl', sql.NVarChar(100), clase)
            .input('ct', sql.NVarChar(80), categoriaTox)
            .input('tp', sql.NVarChar(40), tipoProducto || tipoProductoId)
            .input('cat', sql.Int, categoryId)
            .input('ef', sql.NVarChar(40), estadoFisico)
            .input('tf', sql.NVarChar(120), tipoFormulacion)
            .input('rd', sql.NVarChar(200), resolucion)
            .query(`INSERT INTO dbo.icb_dim_plaguicida_ficha
                      (producto_id, numero_registro, nombre_comercial, titular_registro,
                       empresa_id, ingrediente_activo, principios_activos, clase,
                       categoria_toxicologica, tipo_producto, categoria_pa_id,
                       estado_fisico, tipo_formulacion, resolucion_directoral)
                    OUTPUT inserted.plaguicida_id
                    VALUES (@pid, @nr, @nc, @ti, @em, @ia, @pa, @cl, @ct, @tp, @cat, @ef, @tf, @rd)`);
          plaguicidaId = Number(ins.recordset[0].plaguicida_id);
          recordsInserted++;
        }

        // Reemplaza usos para este producto (delete + insert para purgar inconsistencias previas)
        await pool.request().input('pid', sql.BigInt, plaguicidaId)
          .query(`DELETE FROM dbo.icb_fact_plaguicida_uso WHERE plaguicida_id=@pid`);

        for (const row of detalle) {
          recordsRead++;
          // Schema fila: [productoid, nombrecomercial, empresaid, razonsocial, numeroregistro,
          //   ingredienteactivo, clase, categoriatoxicologico, cultivoid, plagaid,
          //   cultivonombrecientifico, plaganombrecientifico, cultivonombrecomun, plaganombrecomun,
          //   unidadmedida, dosishectarea, dosisporcentaje, capacidadcilindro, dosiscilindro,
          //   limitemaximoresiduo, periodocarenciadias, observacion, tipoproducto]
          const cultivoComun = clean(row[12]);
          const plagaComun = clean(row[13]);
          if (!cultivoComun && !plagaComun) continue;

          const cropId = detectCrop(`${cultivoComun} ${clean(row[10])}`, maps);

          await pool.request()
            .input('pid', sql.BigInt, plaguicidaId)
            .input('cid', sql.NVarChar(20), clean(row[8]) || null)
            .input('cnc', sql.NVarChar(200), cultivoComun || null)
            .input('cnci', sql.NVarChar(200), clean(row[10]) || null)
            .input('plgid', sql.NVarChar(20), clean(row[9]) || null)
            .input('pnc', sql.NVarChar(300), plagaComun || null)
            .input('pnci', sql.NVarChar(300), clean(row[11]) || null)
            .input('um', sql.NVarChar(40), clean(row[14]) || null)
            .input('dh', sql.Decimal(18, 4), num(row[15]))
            .input('dp', sql.Decimal(18, 4), num(row[16]))
            .input('cc', sql.Decimal(18, 4), num(row[17]))
            .input('dc', sql.Decimal(18, 4), num(row[18]))
            .input('lmr', sql.Decimal(18, 4), num(row[19]))
            .input('pcd', sql.Int, intOrNull(row[20]))
            .input('obs', sql.NVarChar(1000), clean(row[21]) || null)
            .input('crop', sql.Int, cropId)
            .query(`INSERT INTO dbo.icb_fact_plaguicida_uso
                      (plaguicida_id, cultivo_sigia_id, cultivo_nombre_comun, cultivo_nombre_cient,
                       plaga_sigia_id, plaga_nombre_comun, plaga_nombre_cient,
                       unidad_medida, dosis_hectarea, dosis_porcentaje,
                       capacidad_cilindro, dosis_cilindro, limite_max_residuo,
                       periodo_carencia_dias, observacion, crop_id)
                    VALUES (@pid, @cid, @cnc, @cnci, @plgid, @pnc, @pnci,
                            @um, @dh, @dp, @cc, @dc, @lmr, @pcd, @obs, @crop)`);
        }
        processedCount++;
      } catch (err) {
        console.warn(`[SENASA_PLAGUICIDAS] error producto ${productoId}:`, (err as Error).message);
      }
      } // end inner for k
      if (i % 200 < CONCURRENCY) {
        console.log(`[SENASA_PLAGUICIDAS] progreso ${Math.min(i + CONCURRENCY, ids.length)}/${ids.length} (${processedCount} procesados, ${recordsInserted} nuevos)`);
      }
    }

    snapshots.push(scoreSnapshot({
      documentTitle: `SENASA SIGIA — sincronización ${recordsInserted + recordsUpdated} productos`,
      documentUrl: `${BASE}/sigia_consulta_cultivo.html`,
      documentType: 'json',
      periodLabel: String(new Date().getFullYear()),
      businessNote: `Carga vía GETBYID: ${productoIds.size} productos descubiertos, ${processedCount} procesados, ${recordsInserted} nuevos, ${recordsUpdated} actualizados, ${recordsRead} usos.`,
    }));

    return {
      recordsRead,
      recordsInserted,
      recordsUpdated,
      recordsSkipped: productoIds.size - processedCount,
      status: 'SUCCESS',
      snapshots,
    };
  }
}
