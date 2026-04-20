import { getDbPool, closeDb } from '../src/config/database';

async function main() {
  const pool = await getDbPool();
  const r = await pool.request().query(`
    UPDATE dbo.icb_etl_run_log
    SET status = 'PARTIAL',
        finished_at = SYSUTCDATETIME(),
        error_message = 'Proceso interrumpido - re-ejecutar'
    WHERE status = 'RUNNING'
  `);
  console.log(`Runs cerrados: ${(r as any).rowsAffected?.[0] ?? 0}`);
  await closeDb();
}

main().catch(e => { console.error(e); process.exit(1); });
