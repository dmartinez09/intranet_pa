// ============================================================
// Enriquece icb_dim_plaguicida_ficha con:
//   estado_registro     (Vigente / No Vigente / Cancelado)
//   etiquetas_ids       (CSV de IDs de etiquetas oficiales)
//   secuencia_registro  (parte numérica de numero_registro, para ordenar)
//
// Fuente: SIGIA PRODUCTO/GETLIST con tipoproductoid=PQUA y PBUA
// ============================================================

import * as sql from 'mssql';
import { getDbPool, closeDb } from '../src/config/database';

const BASE = 'https://servicios.senasa.gob.pe/SIGIAWeb';
const H = { 'User-Agent': 'Mozilla/5.0', 'Referer': `${BASE}/sigia_consulta_producto.html` };

async function fetchList(tipoproductoid: string): Promise<any[]> {
  const url = `${BASE}/consultas?C=PRODUCTO&S=GETLIST&tipoproductoid=${tipoproductoid}&nombre=&ingrediente=`;
  console.log(`Fetching SIGIA list ${tipoproductoid}...`);
  const r = await fetch(url, { headers: H, signal: AbortSignal.timeout(180000) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const buf = await r.arrayBuffer();
  const text = new TextDecoder('iso-8859-1').decode(buf);
  try { return JSON.parse(text); } catch { return []; }
}

function extractSecuencia(numeroRegistro: string): number | null {
  // ej: "PQUA N° 2607-SENASA" → 2607; "086-SENASA-PBA-ACBM" → 86
  if (!numeroRegistro) return null;
  const m = numeroRegistro.match(/(\d{1,6})/);
  return m ? parseInt(m[1], 10) : null;
}

async function main() {
  const pool = await getDbPool();

  // Producto schema GETLIST:
  // 0: productoid, 1: razonsocial, 2: nombrecomercialproducto, 3: nroregistro,
  // 4: ingredienteactivo, 5: clase, 6: tipoformulacion, 7: tipoproducto,
  // 8: numeregiarc, 9: CESTADO_PUA
  const allRows: any[] = [];
  for (const tipo of ['PQUA', 'PBUA']) {
    try {
      const list = await fetchList(tipo);
      console.log(`  ${tipo}: ${list.length} productos`);
      allRows.push(...list);
    } catch (e) {
      console.warn(`  ${tipo} fail: ${(e as Error).message}`);
    }
  }

  console.log(`\nTotal productos SIGIA: ${allRows.length}`);

  // Mapeo por productoid (un mismo productoid puede aparecer múltiples veces,
  // tomamos el primer estado / mergeamos numeregiarcs)
  const byProductoId = new Map<string, { estado: string; etiquetas: Set<string>; nro: string }>();
  for (const row of allRows) {
    const pid = String(row[0] || '').trim();
    if (!pid) continue;
    const estado = String(row[9] || '').trim();
    const numeregiarc = String(row[8] || '').trim();
    const nro = String(row[3] || '').trim();
    const cur = byProductoId.get(pid) || { estado, etiquetas: new Set(), nro };
    if (estado && !cur.estado) cur.estado = estado;
    if (numeregiarc) numeregiarc.split(',').map(s => s.trim()).filter(Boolean).forEach(s => cur.etiquetas.add(s));
    byProductoId.set(pid, cur);
  }
  console.log(`ProductoIDs únicos: ${byProductoId.size}`);

  // Productos en BD
  const dbProds = await pool.request().query(`SELECT plaguicida_id, producto_id, numero_registro FROM dbo.icb_dim_plaguicida_ficha`);
  console.log(`Productos en BD: ${dbProds.recordset.length}`);

  let matched = 0, updated = 0, sinMatch = 0;
  for (const p of dbProds.recordset) {
    const info = byProductoId.get(p.producto_id);
    const secuencia = extractSecuencia(p.numero_registro);

    if (info) {
      matched++;
      await pool.request()
        .input('pid', sql.BigInt, p.plaguicida_id)
        .input('est', sql.NVarChar(40), info.estado || null)
        .input('et', sql.NVarChar(sql.MAX), info.etiquetas.size ? Array.from(info.etiquetas).join(',') : null)
        .input('seq', sql.Int, secuencia)
        .query(`UPDATE dbo.icb_dim_plaguicida_ficha
                SET estado_registro=@est, etiquetas_ids=@et, secuencia_registro=@seq, updated_at=SYSUTCDATETIME()
                WHERE plaguicida_id=@pid`);
      updated++;
    } else {
      sinMatch++;
      // Aun asi actualizamos secuencia si tenemos numero_registro
      if (secuencia != null) {
        await pool.request().input('pid', sql.BigInt, p.plaguicida_id).input('seq', sql.Int, secuencia)
          .query(`UPDATE dbo.icb_dim_plaguicida_ficha SET secuencia_registro=@seq WHERE plaguicida_id=@pid`);
      }
    }
  }

  console.log(`\n=== RESULTADOS ===`);
  console.log(`  En BD: ${dbProds.recordset.length}`);
  console.log(`  Match con SIGIA list: ${matched} (estado_registro + etiquetas)`);
  console.log(`  Sin match (sólo secuencia actualizada): ${sinMatch}`);
  console.log(`  Total actualizados: ${updated + sinMatch}`);

  // Stats finales
  const dist = await pool.request().query(`
    SELECT ISNULL(estado_registro, '(sin estado)') AS estado, COUNT(*) AS qty
    FROM dbo.icb_dim_plaguicida_ficha GROUP BY estado_registro ORDER BY qty DESC
  `);
  console.log('\nDistribución estado_registro:');
  console.table(dist.recordset);

  const conEtiq = await pool.request().query(`SELECT COUNT(*) AS con_etiq FROM dbo.icb_dim_plaguicida_ficha WHERE etiquetas_ids IS NOT NULL AND etiquetas_ids <> ''`);
  console.log(`Con etiquetas_ids: ${conEtiq.recordset[0].con_etiq}`);

  const conSeq = await pool.request().query(`SELECT COUNT(*) AS con_seq, MAX(secuencia_registro) AS max_seq, MIN(secuencia_registro) AS min_seq FROM dbo.icb_dim_plaguicida_ficha WHERE secuencia_registro IS NOT NULL`);
  console.log(`Con secuencia_registro: ${conSeq.recordset[0].con_seq} (min=${conSeq.recordset[0].min_seq}, max=${conSeq.recordset[0].max_seq})`);

  // Top 10 más recientes (mayor secuencia)
  const recientes = await pool.request().query(`
    SELECT TOP 10 nombre_comercial, numero_registro, titular_registro, estado_registro, secuencia_registro
    FROM dbo.icb_dim_plaguicida_ficha
    WHERE secuencia_registro IS NOT NULL
    ORDER BY secuencia_registro DESC
  `);
  console.log('\nTop 10 más recientes (por secuencia):');
  console.table(recientes.recordset);

  await closeDb();
}

main().catch(e => { console.error(e); process.exit(1); });
