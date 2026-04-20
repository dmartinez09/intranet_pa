import { getDbPool, closeDb } from '../src/config/database';

async function main() {
  const p = await getDbPool();
  const r = await p.request().query(`
    SELECT TOP 5 run_id, pipeline_name, status,
      records_inserted, records_updated,
      started_at, finished_at,
      DATEDIFF(SECOND, started_at, COALESCE(finished_at, SYSUTCDATETIME())) AS secs
    FROM dbo.icb_etl_run_log
    WHERE pipeline_name LIKE 'baseline%'
    ORDER BY run_id DESC
  `);
  console.table(r.recordset);
  await closeDb();
}
main().catch(e => { console.error(e); process.exit(1); });
