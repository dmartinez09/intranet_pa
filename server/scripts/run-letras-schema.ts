import fs from 'fs';
import path from 'path';
import { getDbPool, closeDb } from '../src/config/database';

async function main() {
  const sqlPath = path.resolve(__dirname, '../sql/letras_bot_schema.sql');
  const raw = fs.readFileSync(sqlPath, 'utf8');
  // Split on lines containing only "GO"
  const batches = raw.split(/^\s*GO\s*$/mi).map(b => b.trim()).filter(Boolean);
  const pool = await getDbPool();
  for (let i = 0; i < batches.length; i++) {
    const b = batches[i];
    console.log(`\n--- Ejecutando batch ${i + 1}/${batches.length} ---`);
    try {
      await pool.request().batch(b);
      console.log('OK');
    } catch (e) {
      console.error('Error en batch:', (e as Error).message);
      throw e;
    }
  }
  // Verify tables exist
  const r = await pool.request().query(
    `SELECT name FROM sys.tables WHERE name IN
      ('intranet_letras_bot_config','intranet_letras_bot_history','intranet_letras_sync_log')
     ORDER BY name`
  );
  console.log('\nTablas creadas:', r.recordset.map(x => x.name));
  await closeDb();
}

main().catch(err => {
  console.error('FALLO:', err);
  process.exit(1);
});
