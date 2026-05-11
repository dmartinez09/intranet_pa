// ============================================================
// Carga etiquetas oficiales SENASA en icb_dim_plaguicida_etiqueta
// Para cada producto con etiquetas_ids, llama a:
//   /sig/upload?C=MANT&S=GETLIST&numeregiarc=XXX
// Extrae filename, descripcion, fecha_registro, tamano_bytes, extension
// Infiere presentacion desde filename (ej. "Bolsa 100 gramos")
// ============================================================

import * as sql from 'mssql';
import { getDbPool, closeDb } from '../src/config/database';

const BASE = 'https://servicios.senasa.gob.pe';
const H = { 'User-Agent': 'Mozilla/5.0', 'Referer': `${BASE}/SIGIAWeb/sigia_consulta_producto.html` };

async function fetchList(numeregiarc: string): Promise<any[]> {
  const url = `${BASE}/sig/upload?C=MANT&S=GETLIST&numeregiarc=${numeregiarc}`;
  const r = await fetch(url, { headers: H, signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const buf = await r.arrayBuffer();
  const text = new TextDecoder('iso-8859-1').decode(buf);
  try { return JSON.parse(text); } catch { return []; }
}

// Convierte fecha DD/MM/YYYY → Date
function parseFecha(s: string): Date | null {
  if (!s) return null;
  const m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) return null;
  return new Date(`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`);
}

// Infiere "presentación" desde el filename
// Ej: "Consist Full Bolsa 100 gramos.pdf" → "Bolsa 100 gramos"
function inferPresentacion(filename: string, nombreProducto?: string): string {
  if (!filename) return '';
  let s = filename.replace(/\.[a-z]+$/i, ''); // quita extensión
  // Si tiene nombre del producto delante, removerlo
  if (nombreProducto) {
    const np = nombreProducto.replace(/[^\w\s]/g, '').trim();
    s = s.replace(new RegExp(`^${np}\\s*`, 'i'), '');
  }
  return s.trim();
}

async function main() {
  const pool = await getDbPool();

  // Productos con etiquetas_ids
  const prods = await pool.request().query(`
    SELECT plaguicida_id, producto_id, nombre_comercial, etiquetas_ids
    FROM dbo.icb_dim_plaguicida_ficha
    WHERE etiquetas_ids IS NOT NULL AND etiquetas_ids <> ''
  `);
  console.log(`Productos con etiquetas: ${prods.recordset.length}`);

  let totalFetched = 0, totalInserted = 0, totalUpdated = 0, errors = 0;

  for (let i = 0; i < prods.recordset.length; i++) {
    const p = prods.recordset[i];
    const ids = String(p.etiquetas_ids).split(',').map(s => s.trim()).filter(Boolean);

    for (const ne of ids) {
      try {
        const list = await fetchList(ne);
        if (!list.length) continue;
        // Schema: [idfile, descripcion, filename, fechregiarc, tamano(¿?), extension, ?, tamanoBytes]
        // Por inspección: ["02211239.1.pdf","Consist Full Bolsa 100 gramos.pdf","Consist Full Bolsa 100 gramos.pdf","30/01/2020","","pdf",1,741449]
        for (const row of list) {
          const idfile = String(row[0] || '');
          const descripcion = String(row[1] || '');
          const filename = String(row[2] || '');
          const fechRaw = String(row[3] || '');
          const extension = String(row[5] || '').toLowerCase();
          const tamano = Number(row[7] || 0) || null;
          const fecha = parseFecha(fechRaw);
          const presentacion = inferPresentacion(filename, p.nombre_comercial);
          const downloadUrl = `${BASE}/sig/upload?C=DL&f=${encodeURIComponent(idfile)}&fns=${encodeURIComponent(filename)}`;

          totalFetched++;
          const ex = await pool.request()
            .input('pid', sql.BigInt, p.plaguicida_id)
            .input('ne', sql.NVarChar(40), ne)
            .input('idf', sql.NVarChar(100), idfile)
            .query(`SELECT etiqueta_id FROM dbo.icb_dim_plaguicida_etiqueta WHERE plaguicida_id=@pid AND numeregiarc=@ne AND id_file=@idf`);

          if (ex.recordset.length) {
            await pool.request()
              .input('eid', sql.BigInt, ex.recordset[0].etiqueta_id)
              .input('fn', sql.NVarChar(400), filename)
              .input('desc', sql.NVarChar(400), descripcion)
              .input('fc', sql.Date, fecha)
              .input('tm', sql.BigInt, tamano)
              .input('ext', sql.NVarChar(10), extension)
              .input('pres', sql.NVarChar(200), presentacion)
              .input('dl', sql.NVarChar(800), downloadUrl)
              .query(`UPDATE dbo.icb_dim_plaguicida_etiqueta
                      SET filename=@fn, descripcion=@desc, fecha_registro=@fc,
                          tamano_bytes=@tm, extension=@ext, presentacion=@pres,
                          download_url=@dl, captured_at=SYSUTCDATETIME()
                      WHERE etiqueta_id=@eid`);
            totalUpdated++;
          } else {
            await pool.request()
              .input('pid', sql.BigInt, p.plaguicida_id)
              .input('ne', sql.NVarChar(40), ne)
              .input('idf', sql.NVarChar(100), idfile)
              .input('fn', sql.NVarChar(400), filename)
              .input('desc', sql.NVarChar(400), descripcion)
              .input('fc', sql.Date, fecha)
              .input('tm', sql.BigInt, tamano)
              .input('ext', sql.NVarChar(10), extension)
              .input('pres', sql.NVarChar(200), presentacion)
              .input('dl', sql.NVarChar(800), downloadUrl)
              .query(`INSERT INTO dbo.icb_dim_plaguicida_etiqueta
                        (plaguicida_id, numeregiarc, id_file, filename, descripcion,
                         fecha_registro, tamano_bytes, extension, presentacion, download_url)
                      VALUES (@pid, @ne, @idf, @fn, @desc, @fc, @tm, @ext, @pres, @dl)`);
            totalInserted++;
          }
        }
      } catch (e) {
        errors++;
        console.warn(`  err ${p.producto_id}/${ne}: ${(e as Error).message}`);
      }
    }
    if (i > 0 && i % 50 === 0) console.log(`  Progreso: ${i}/${prods.recordset.length} productos · ${totalFetched} fetched · ${totalInserted} ins · ${totalUpdated} upd`);
  }

  console.log(`\n=== RESUMEN ===`);
  console.log(`  Productos procesados: ${prods.recordset.length}`);
  console.log(`  Etiquetas fetched: ${totalFetched}`);
  console.log(`  Insertadas: ${totalInserted}`);
  console.log(`  Actualizadas: ${totalUpdated}`);
  console.log(`  Errores: ${errors}`);

  // Stats
  const stats = await pool.request().query(`
    SELECT
      COUNT(*) AS total_etiquetas,
      COUNT(DISTINCT plaguicida_id) AS productos_con_etiqueta,
      COUNT(fecha_registro) AS con_fecha,
      MIN(fecha_registro) AS min_fecha,
      MAX(fecha_registro) AS max_fecha,
      COUNT(NULLIF(presentacion, '')) AS con_presentacion
    FROM dbo.icb_dim_plaguicida_etiqueta
  `);
  console.log('\nStats finales:'); console.table(stats.recordset);

  // Distribución por año de registro
  const porAnio = await pool.request().query(`
    SELECT YEAR(fecha_registro) AS anio, COUNT(*) AS etiquetas
    FROM dbo.icb_dim_plaguicida_etiqueta WHERE fecha_registro IS NOT NULL
    GROUP BY YEAR(fecha_registro) ORDER BY anio DESC
  `);
  console.log('Etiquetas por año de registro:'); console.table(porAnio.recordset);

  await closeDb();
}

main().catch(e => { console.error(e); process.exit(1); });
