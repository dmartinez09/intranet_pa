import { getDbPool, closeDb } from '../src/config/database';

async function main() {
  const p = await getDbPool();
  const byYear = await p.request().query(
    `SELECT periodo_year, COUNT(*) AS ops, COUNT(DISTINCT empresa_id) AS empresas
     FROM dbo.icb_cx_fact_importacion
     GROUP BY periodo_year ORDER BY periodo_year`
  );
  console.log('Operaciones por año:');
  console.table(byYear.recordset);

  const paByYear = await p.request().query(
    `SELECT f.periodo_year, COUNT(*) AS ops, SUM(f.valor_cif_usd) AS cif
     FROM dbo.icb_cx_fact_importacion f
     INNER JOIN dbo.icb_cx_dim_empresa e ON f.empresa_id = e.empresa_id
     WHERE e.es_point_andina = 1
     GROUP BY f.periodo_year`
  );
  console.log('\nPoint Andina por año:');
  console.table(paByYear.recordset);
  await closeDb();
}
main().catch(e => { console.error(e); process.exit(1); });
