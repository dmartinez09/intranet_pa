import { getDbPool, closeDb } from '../src/config/database';

async function main() {
  const pool = await getDbPool();

  const r = await pool.request().query(`
    SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'stg_rpt_ventas_detallado'
    ORDER BY ORDINAL_POSITION
  `);
  console.log(`Total columnas: ${r.recordset.length}`);
  console.table(r.recordset);

  await closeDb();
}

main().catch(e => { console.error(e); process.exit(1); });
