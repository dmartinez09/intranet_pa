import { getDbPool, closeDb } from '../src/config/database';

async function main() {
  const pool = await getDbPool();

  console.log('--- Definición actual de vw_ventas_diarias_PointAndina_Uruguay ---');
  const def = await pool.request().query(`
    SELECT OBJECT_DEFINITION(OBJECT_ID('dbo.vw_ventas_diarias_PointAndina_Uruguay')) AS def
  `);
  console.log(def.recordset[0]?.def || '(no existe)');

  console.log('\n--- Columnas actuales de la vista ---');
  const cols = await pool.request().query(`
    SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, ORDINAL_POSITION
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'vw_ventas_diarias_PointAndina_Uruguay'
    ORDER BY ORDINAL_POSITION
  `);
  console.table(cols.recordset);

  console.log('\n--- Muestra de 3 filas ---');
  const sample = await pool.request().query(`SELECT TOP 3 * FROM dbo.vw_ventas_diarias_PointAndina_Uruguay ORDER BY Fecha DESC`);
  console.log(JSON.stringify(sample.recordset, null, 2));

  console.log('\n--- Distinct de Grupo_Cliente en stg_rpt_ventas_detallado (PE) ---');
  const grupos = await pool.request().query(`
    SELECT DISTINCT Grupo_Cliente, COUNT(*) AS filas
    FROM dbo.stg_rpt_ventas_detallado
    WHERE Pais = 'Peru' AND Grupo_Cliente IS NOT NULL
    GROUP BY Grupo_Cliente
    ORDER BY filas DESC
  `);
  console.table(grupos.recordset);

  await closeDb();
}

main().catch(e => { console.error(e); process.exit(1); });
