import { getDbPool, closeDb } from '../src/config/database';

async function main() {
  const pool = await getDbPool();

  console.log('\n=== Total snapshots por fuente ===');
  const bySource = await pool.request().query(`
    SELECT s.source_code, src.source_name, COUNT(*) AS total,
      SUM(CASE WHEN f.crop_id IS NOT NULL THEN 1 ELSE 0 END) AS con_cultivo,
      SUM(CASE WHEN f.region_id IS NOT NULL THEN 1 ELSE 0 END) AS con_region,
      SUM(CASE WHEN f.category_id IS NOT NULL THEN 1 ELSE 0 END) AS con_categoria,
      SUM(CASE WHEN f.hectares IS NOT NULL THEN 1 ELSE 0 END) AS con_hectareas,
      SUM(f.hectares) AS total_ha,
      AVG(f.opportunity_score) AS score_prom
    FROM dbo.icb_fact_agri_market_snapshot f
    LEFT JOIN dbo.icb_dim_source s ON f.source_id = s.source_id
    LEFT JOIN dbo.icb_dim_source src ON f.source_id = src.source_id
    GROUP BY s.source_code, src.source_name
    ORDER BY total DESC
  `);
  console.table(bySource.recordset);

  console.log('\n=== Snapshots por cultivo (top 10) ===');
  const byCrop = await pool.request().query(`
    SELECT c.crop_name_standard, COUNT(*) AS snapshots, SUM(f.hectares) AS total_ha
    FROM dbo.icb_fact_agri_market_snapshot f
    LEFT JOIN dbo.icb_dim_crop c ON f.crop_id = c.crop_id
    GROUP BY c.crop_name_standard
    ORDER BY snapshots DESC
  `);
  console.table(byCrop.recordset);

  console.log('\n=== Snapshots con score >= 50 (oportunidades) ===');
  const topOpp = await pool.request().query(`
    SELECT TOP 10 f.snapshot_id, LEFT(f.document_title, 60) AS title,
      c.crop_name_standard AS cultivo, r.department AS dpto,
      f.hectares, f.opportunity_score, f.opportunity_level
    FROM dbo.icb_fact_agri_market_snapshot f
    LEFT JOIN dbo.icb_dim_crop c ON f.crop_id = c.crop_id
    LEFT JOIN dbo.icb_dim_region r ON f.region_id = r.region_id
    WHERE f.opportunity_score >= 50
    ORDER BY f.opportunity_score DESC
  `);
  console.table(topOpp.recordset);

  console.log('\n=== Muestra primeros 5 snapshots ===');
  const sample = await pool.request().query(`
    SELECT TOP 5 f.snapshot_id,
      src.source_code,
      LEFT(f.document_title, 70) AS title,
      c.crop_name_standard AS cultivo,
      r.department AS dpto,
      cat.category_name AS cat,
      f.hectares,
      f.opportunity_score
    FROM dbo.icb_fact_agri_market_snapshot f
    LEFT JOIN dbo.icb_dim_source src ON f.source_id = src.source_id
    LEFT JOIN dbo.icb_dim_crop c ON f.crop_id = c.crop_id
    LEFT JOIN dbo.icb_dim_region r ON f.region_id = r.region_id
    LEFT JOIN dbo.icb_dim_point_category cat ON f.category_id = cat.category_id
    ORDER BY f.snapshot_id DESC
  `);
  console.table(sample.recordset);

  await closeDb();
}

main().catch(e => { console.error(e); process.exit(1); });
