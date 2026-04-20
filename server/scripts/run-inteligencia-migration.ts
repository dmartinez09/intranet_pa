import fs from 'fs';
import path from 'path';
import { getDbPool, closeDb } from '../src/config/database';

async function main() {
  const sqlPath = path.resolve(__dirname, '../sql/002_inteligencia_comercial.sql');
  console.log(`Leyendo migración: ${sqlPath}`);
  const raw = fs.readFileSync(sqlPath, 'utf8');

  // Split on lines containing only "GO"
  const batches = raw.split(/^\s*GO\s*$/mi).map(b => b.trim()).filter(Boolean);
  console.log(`Total de batches: ${batches.length}`);

  const pool = await getDbPool();

  for (let i = 0; i < batches.length; i++) {
    const b = batches[i];
    const preview = b.substring(0, 80).replace(/\s+/g, ' ');
    console.log(`\n--- Batch ${i + 1}/${batches.length}: ${preview}... ---`);
    try {
      await pool.request().batch(b);
      console.log('   OK');
    } catch (e) {
      console.error('   ERROR:', (e as Error).message);
      throw e;
    }
  }

  // Verifica todas las tablas icb_*
  const r = await pool.request().query(
    `SELECT name FROM sys.tables WHERE name LIKE 'icb_%' ORDER BY name`
  );
  console.log('\n========================================');
  console.log('Tablas icb_* creadas:', r.recordset.length);
  for (const row of r.recordset) console.log('  -', row.name);

  // Verifica seeds
  const seeds = await pool.request().query(`
    SELECT 'icb_dim_source' AS tabla, COUNT(*) AS cnt FROM dbo.icb_dim_source
    UNION ALL
    SELECT 'icb_dim_crop', COUNT(*) FROM dbo.icb_dim_crop
    UNION ALL
    SELECT 'icb_dim_region', COUNT(*) FROM dbo.icb_dim_region
    UNION ALL
    SELECT 'icb_dim_point_category', COUNT(*) FROM dbo.icb_dim_point_category
  `);
  console.log('\nSeeds cargados:');
  for (const row of seeds.recordset) {
    console.log(`  - ${row.tabla}: ${row.cnt} registros`);
  }

  console.log('\n✓ Migración 002 completada.');
  await closeDb();
}

main().catch(err => {
  console.error('\n✗ MIGRACIÓN FALLÓ:', err);
  process.exit(1);
});
