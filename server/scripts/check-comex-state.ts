import { getDbPool, closeDb } from '../src/config/database';

async function main() {
  const pool = await getDbPool();
  const t = await pool.request().query(
    'SELECT COUNT(*) AS cnt, SUM(valor_cif_usd) AS cif FROM dbo.icb_cx_fact_importacion'
  );
  console.log(`Importaciones: ${t.recordset[0].cnt}`);
  console.log(`CIF total: $${Math.round(t.recordset[0].cif || 0).toLocaleString('es-PE')}`);

  const r = await pool.request().query(
    `SELECT TOP 1 run_id, status, records_inserted, records_updated, started_at, finished_at
     FROM dbo.icb_etl_run_log
     WHERE pipeline_name = 'baseline-pe-comex'
     ORDER BY run_id DESC`
  );
  console.log('\nÚltimo run baseline-pe-comex:');
  console.log(r.recordset[0] || '— sin registros');

  await closeDb();
}

main().catch(e => { console.error(e); process.exit(1); });
