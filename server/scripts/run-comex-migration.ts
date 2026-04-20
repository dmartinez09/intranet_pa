import fs from 'fs';
import path from 'path';
import { getDbPool, closeDb } from '../src/config/database';

async function main() {
  const sqlPath = path.resolve(__dirname, '../sql/004_comex_competidores.sql');
  console.log(`Leyendo migración: ${sqlPath}`);
  const raw = fs.readFileSync(sqlPath, 'utf8');
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

  // Verifica tablas icb_cx_*
  const r = await pool.request().query(
    `SELECT name FROM sys.tables WHERE name LIKE 'icb_cx_%' ORDER BY name`
  );
  console.log('\n========================================');
  console.log('Tablas icb_cx_* creadas:', r.recordset.length);
  for (const row of r.recordset) console.log('  -', row.name);

  const seeds = await pool.request().query(`
    SELECT 'icb_cx_dim_partida' AS tabla, COUNT(*) AS cnt FROM dbo.icb_cx_dim_partida
    UNION ALL
    SELECT 'icb_cx_dim_empresa', COUNT(*) FROM dbo.icb_cx_dim_empresa WHERE es_competidor = 1
    UNION ALL
    SELECT 'icb_cx_dim_pais', COUNT(*) FROM dbo.icb_cx_dim_pais
    UNION ALL
    SELECT 'icb_cx_dim_producto', COUNT(*) FROM dbo.icb_cx_dim_producto
    UNION ALL
    SELECT 'new icb_dim_source rows', COUNT(*) FROM dbo.icb_dim_source WHERE source_code LIKE '%COMEX%' OR source_code IN ('SUNAT_TRANSPARENCIA','SUNAT_ADUANET','BCR_COMEX','MINCETUR_ESTADISTICAS','INEI_COMEX','ADEX_ESTADISTICAS','CCL_COMEX','SENASA_PLAGUICIDAS')
  `);
  console.log('\nSeeds cargados:');
  for (const row of seeds.recordset) console.log(`  - ${row.tabla}: ${row.cnt}`);

  console.log('\n✓ Migración 004 completada.');
  await closeDb();
}

main().catch(err => {
  console.error('\n✗ MIGRACIÓN FALLÓ:', err);
  process.exit(1);
});
