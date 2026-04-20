import { getDbPool, closeDb } from '../src/config/database';

async function main() {
  const p = await getDbPool();
  const r = await p.request().query(`
    UPDATE dbo.icb_etl_run_log
    SET status = 'PARTIAL',
        finished_at = SYSUTCDATETIME(),
        error_message = 'Proceso interrumpido - data 2024 completa insertada'
    WHERE run_id = 14
  `);
  console.log(`Rows affected: ${(r as any).rowsAffected?.[0] ?? 0}`);
  await closeDb();
}
main().catch(e => { console.error(e); process.exit(1); });
