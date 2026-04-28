/**
 * READ-ONLY: Verifica si DocEntry/LineNum/ObjType están poblados en abril
 * y si forman una key natural única para esos registros.
 */
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env'), override: true });

async function main() {
  const { getDbPool, closeDb } = await import('../src/config/database');
  const pool = await getDbPool();

  // ¿Existen las columnas?
  const cols = await pool.request().query(`
    SELECT COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'stg_rpt_ventas_detallado'
      AND COLUMN_NAME IN ('DocEntry','LineNum','ObjType','BaseEntry','BaseLineNum','BaseType','UpdateDate','CreateDate','CreateTS','EsReserva')
    ORDER BY ORDINAL_POSITION
  `);
  console.log('▸ Columnas key disponibles en la tabla:');
  cols.recordset.forEach((c: any) => console.log(`   ${c.COLUMN_NAME}`));

  if (cols.recordset.length === 0) {
    console.log('\n⚠ No existen columnas DocEntry/LineNum/ObjType — usar key compuesta alternativa');

    // Verificar key compuesta alternativa: Numero_SAP + Codigo_Producto + Fecha + venta
    const r = await pool.request().query(`
      SELECT COUNT(*) AS filas,
             COUNT(DISTINCT Numero_SAP + '|' + Codigo_Producto + '|' + CONVERT(VARCHAR(10), Fecha_Emision, 23) + '|' + CAST(TRY_CAST([Valor_Venta_Dolares_Presentacion] AS DECIMAL(19,2)) AS VARCHAR(50))) AS keys_unicos
      FROM dbo.stg_rpt_ventas_detallado
      WHERE Fecha_Emision BETWEEN '2026-04-01' AND '2026-04-30'
    `);
    console.log('\n▸ Cardinalidad abril usando (Numero_SAP, Codigo_Producto, Fecha, Venta):');
    console.log(`   Filas: ${r.recordset[0].filas} · Keys únicos: ${r.recordset[0].keys_unicos}`);
    if (r.recordset[0].filas === r.recordset[0].keys_unicos) {
      console.log('   ✓ Key alternativa es ÚNICA en abril (post-dedup)');
    } else {
      console.log('   ✗ Key alternativa NO es única — faltarían columnas');
    }
    await closeDb();
    return;
  }

  // Verificar populación en abril
  console.log('\n▸ Verificación de poblamiento en abril 2026:');
  const fillRates: Record<string, any> = {};
  for (const c of cols.recordset.map((x: any) => x.COLUMN_NAME)) {
    const r = await pool.request().query(`
      SELECT COUNT(*) AS total,
             SUM(CASE WHEN [${c}] IS NULL THEN 1 ELSE 0 END) AS nulls
      FROM dbo.stg_rpt_ventas_detallado
      WHERE Fecha_Emision BETWEEN '2026-04-01' AND '2026-04-30'
    `);
    const t = r.recordset[0];
    fillRates[c] = { total: t.total, nulls: t.nulls, pct_null: t.total ? ((t.nulls / t.total) * 100).toFixed(1) : '—' };
  }
  console.table(fillRates);

  // Cardinalidad de DocEntry+LineNum+ObjType si existen
  const hasKey = cols.recordset.some((c: any) => c.COLUMN_NAME === 'DocEntry')
    && cols.recordset.some((c: any) => c.COLUMN_NAME === 'LineNum')
    && cols.recordset.some((c: any) => c.COLUMN_NAME === 'ObjType');
  if (hasKey) {
    const r = await pool.request().query(`
      SELECT COUNT(*) AS filas,
             COUNT(DISTINCT CAST(DocEntry AS VARCHAR) + '|' + CAST(LineNum AS VARCHAR) + '|' + CAST(ObjType AS VARCHAR)) AS keys_unicos
      FROM dbo.stg_rpt_ventas_detallado
      WHERE Fecha_Emision BETWEEN '2026-04-01' AND '2026-04-30'
    `);
    console.log(`\n▸ Key (DocEntry, LineNum, ObjType) en abril:`);
    console.log(`   Filas: ${r.recordset[0].filas} · Keys únicos: ${r.recordset[0].keys_unicos}`);
    console.log(`   ${r.recordset[0].filas === r.recordset[0].keys_unicos ? '✓ KEY ES ÚNICA' : '✗ Key NO única — hay duplicados o NULLs'}`);

    // ¿Cuántas filas tienen DocEntry NULL?
    const rNull = await pool.request().query(`
      SELECT COUNT(*) AS filas_null
      FROM dbo.stg_rpt_ventas_detallado
      WHERE Fecha_Emision BETWEEN '2026-04-01' AND '2026-04-30'
        AND (DocEntry IS NULL OR LineNum IS NULL OR ObjType IS NULL)
    `);
    console.log(`   Filas con NULL en DocEntry/LineNum/ObjType: ${rNull.recordset[0].filas_null}`);
  }

  await closeDb();
}

main().catch(e => { console.error(e); process.exit(1); });
