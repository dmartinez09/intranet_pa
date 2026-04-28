import { getDbPool, closeDb } from '../src/config/database';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const pool = await getDbPool();
  const ddl = fs.readFileSync(path.join(__dirname, '../sql/004_uruguay_bot.sql'), 'utf-8');
  console.log('▸ Desplegando tabla dbo.uruguay_bot_runs ...');
  await pool.request().batch(ddl);
  const r = await pool.request().query(`
    SELECT COUNT(*) AS c FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'uruguay_bot_runs'
  `);
  console.log(r.recordset[0].c === 1 ? '✓ OK' : '✗ ERROR');
  await closeDb();
}
main().catch(e => { console.error(e); process.exit(1); });
