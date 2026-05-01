import { getDbPool, closeDb } from '../src/config/database';

async function main() {
  const p = await getDbPool();
  const r = await p.request().query(`
    SELECT COLUMN_NAME, DATA_TYPE
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'intranet_letras_bot_history'
    ORDER BY ORDINAL_POSITION
  `);
  console.table(r.recordset);
  await closeDb();
}

main().catch(e => { console.error(e); process.exit(1); });
