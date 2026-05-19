// ============================================================
// Backfill producto_id en icb_cx_fact_importacion
// Asigna producto aleatorio dentro de la misma familia PA
// (vía partida_id -> familia_pa -> producto_id)
// ============================================================

import { getDbPool, closeDb } from '../src/config/database';

async function main() {
  const pool = await getDbPool();

  console.log('=== Backfill producto_id ===\n');

  const beforeRes = await pool.request().query(`
    SELECT COUNT(*) AS total,
           SUM(CASE WHEN producto_id IS NOT NULL THEN 1 ELSE 0 END) AS con_producto
    FROM dbo.icb_cx_fact_importacion
  `);
  const before = beforeRes.recordset[0];
  console.log(`Antes: ${before.con_producto} / ${before.total} filas tienen producto_id`);

  // Batchear en chunks de 5000 con timeout extendido para evitar request timeout
  const BATCH = 5000;
  let totalUpdated = 0;
  while (true) {
    const req = pool.request();
    req.timeout = 120000; // 2 min por batch
    const r = await req.query(`
      UPDATE TOP (${BATCH}) f
      SET producto_id = (
        SELECT TOP 1 p.producto_id
        FROM dbo.icb_cx_dim_producto p
        INNER JOIN dbo.icb_cx_dim_partida pa
          ON pa.familia_pa = p.familia_pa
        WHERE pa.partida_id = f.partida_id
          AND p.active_flag = 1
        ORDER BY NEWID()
      )
      FROM dbo.icb_cx_fact_importacion f
      WHERE f.producto_id IS NULL
    `);
    const n = r.rowsAffected[0] || 0;
    totalUpdated += n;
    process.stdout.write(`\rBatch +${n}, total ${totalUpdated}...`);
    if (n === 0) break;
  }
  console.log(`\nFilas actualizadas: ${totalUpdated}`);

  const afterRes = await pool.request().query(`
    SELECT COUNT(*) AS total,
           SUM(CASE WHEN producto_id IS NOT NULL THEN 1 ELSE 0 END) AS con_producto
    FROM dbo.icb_cx_fact_importacion
  `);
  const after = afterRes.recordset[0];
  const coverage = after.total > 0 ? ((after.con_producto / after.total) * 100).toFixed(2) : '0';
  console.log(`Después: ${after.con_producto} / ${after.total} filas tienen producto_id (${coverage}%)`);

  // Top productos para verificación
  const topRes = await pool.request().query(`
    SELECT TOP 10
      pr.ingrediente_activo,
      pr.familia_pa,
      COUNT(*) AS operaciones,
      SUM(f.valor_cif_usd) AS cif_usd
    FROM dbo.icb_cx_fact_importacion f
    INNER JOIN dbo.icb_cx_dim_producto pr ON f.producto_id = pr.producto_id
    GROUP BY pr.ingrediente_activo, pr.familia_pa
    ORDER BY cif_usd DESC
  `);
  console.log('\nTop 10 productos por CIF:');
  console.table(topRes.recordset.map((r: any) => ({
    producto: r.ingrediente_activo,
    familia: r.familia_pa,
    ops: r.operaciones,
    cif_usd: `$${Math.round(Number(r.cif_usd)).toLocaleString('es-PE')}`,
  })));

  await closeDb();
}

main().catch(err => {
  console.error('Backfill FALLÓ:', err);
  process.exit(1);
});
