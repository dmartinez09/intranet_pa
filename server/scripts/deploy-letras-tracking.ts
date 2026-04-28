import { getDbPool, closeDb } from '../src/config/database';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const pool = await getDbPool();
  const ddl = fs.readFileSync(path.join(__dirname, '../sql/005_letras_email_tracking.sql'), 'utf-8');
  // Split por GO y ejecutar batches separados
  const batches = ddl.split(/^\s*GO\s*$/im).map(s => s.trim()).filter(Boolean);
  console.log(`▸ Ejecutando ${batches.length} batches...`);
  for (const b of batches) {
    await pool.request().batch(b);
  }
  console.log('✓ Migración OK');
  await closeDb();
}
main().catch(e => { console.error(e); process.exit(1); });
