import { readFileSync } from 'fs';
import { resolve } from 'path';
import { getDbPool, closeDb } from '../config/database';

async function run() {
  const file = process.argv[2];
  if (!file) {
    console.error('Usage: tsx src/scripts/run-migration.ts <relative-sql-path>');
    process.exit(1);
  }
  const sqlPath = resolve(process.cwd(), file);
  const raw = readFileSync(sqlPath, 'utf8');
  const batches = raw.split(/^\s*GO\s*$/gim).map(b => b.trim()).filter(Boolean);

  const pool = await getDbPool();
  console.log(`[migration] running ${batches.length} batch(es) from ${file}`);
  for (let i = 0; i < batches.length; i++) {
    try {
      const result = await pool.request().query(batches[i]);
      const msgs = (result as any).recordset || [];
      console.log(`[migration] batch ${i + 1}/${batches.length} ok`);
      for (const row of msgs) console.log('  ', row);
    } catch (e) {
      console.error(`[migration] batch ${i + 1} failed:`, (e as Error).message);
      console.error('SQL:', batches[i].slice(0, 300));
      process.exit(1);
    }
  }
  await closeDb();
  console.log('[migration] done');
}

run().catch(e => { console.error(e); process.exit(1); });
