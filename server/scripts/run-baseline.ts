import fs from 'fs';
import path from 'path';
import { getDbPool, closeDb } from '../src/config/database';
import { runOne, etlTablesReady } from '../src/services/etl';

async function main() {
  // 1. Ejecuta migración 003
  const sqlPath = path.resolve(__dirname, '../sql/003_baseline_source.sql');
  console.log('Ejecutando migración 003...');
  const raw = fs.readFileSync(sqlPath, 'utf8');
  const batches = raw.split(/^\s*GO\s*$/mi).map(b => b.trim()).filter(Boolean);
  const pool = await getDbPool();
  for (const b of batches) {
    try {
      await pool.request().batch(b);
    } catch (e) {
      console.error('Error en batch:', (e as Error).message);
      throw e;
    }
  }
  console.log('✓ Migración 003 completada.\n');

  const ready = await etlTablesReady();
  if (!ready) {
    console.error('✗ Tablas icb_* no existen.');
    process.exit(1);
  }

  // 2. Ejecuta el collector baseline
  console.log('Ejecutando BASELINE_PE_CROPS...');
  const result = await runOne('BASELINE_PE_CROPS', 'script_baseline');
  console.log(`Status: ${result.status}`);
  console.log(`Leídos: ${result.recordsRead}, Insertados: ${result.recordsInserted}, Actualizados: ${result.recordsUpdated}`);
  if (result.errorMessage) console.log(`Error: ${result.errorMessage}`);

  // 3. Valida
  console.log('\n=== Top cultivos después del baseline ===');
  const top = await pool.request().query(`
    SELECT c.crop_name_standard, COUNT(*) AS snapshots, SUM(f.hectares) AS total_ha
    FROM dbo.icb_fact_agri_market_snapshot f
    LEFT JOIN dbo.icb_dim_crop c ON f.crop_id = c.crop_id
    WHERE c.crop_id IS NOT NULL
    GROUP BY c.crop_name_standard
    ORDER BY total_ha DESC
  `);
  console.table(top.recordset);

  console.log('\n=== Top departamentos ===');
  const dpt = await pool.request().query(`
    SELECT r.department, COUNT(*) AS snapshots, SUM(f.hectares) AS total_ha
    FROM dbo.icb_fact_agri_market_snapshot f
    LEFT JOIN dbo.icb_dim_region r ON f.region_id = r.region_id
    WHERE r.region_id IS NOT NULL
    GROUP BY r.department
    ORDER BY total_ha DESC
  `);
  console.table(dpt.recordset.slice(0, 15));

  await closeDb();
}

main().catch(e => { console.error(e); process.exit(1); });
