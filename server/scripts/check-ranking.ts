import { getDbPool, closeDb } from '../src/config/database';

async function main() {
  const pool = await getDbPool();
  const r = await pool.request().query(`
    SELECT TOP 15
      e.nombre_comercial,
      CAST(e.es_point_andina AS INT) AS es_pa,
      SUM(f.valor_cif_usd) AS total_cif,
      COUNT(f.import_id) AS ops
    FROM dbo.icb_cx_fact_importacion f
    INNER JOIN dbo.icb_cx_dim_empresa e ON f.empresa_id = e.empresa_id
    WHERE e.es_competidor = 1
    GROUP BY e.nombre_comercial, e.es_point_andina
    ORDER BY total_cif DESC
  `);
  console.log('Ranking actual:');
  console.table(r.recordset.map((row: any, i: number) => ({
    pos: i + 1,
    empresa: row.nombre_comercial,
    pa: row.es_pa ? '★' : '',
    cif_usd: `$${Math.round(row.total_cif).toLocaleString('es-PE')}`,
    operaciones: row.ops,
  })));
  await closeDb();
}

main().catch(e => { console.error(e); process.exit(1); });
