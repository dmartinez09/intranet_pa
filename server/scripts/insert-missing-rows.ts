import { getDbPool } from '../src/config/database';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const pool = await getDbPool();
  const rows: any[] = JSON.parse(fs.readFileSync(path.join(__dirname, '_missing-rows.json'), 'utf-8'));

  // Get real SQL column names
  const schema = await pool.request().query(`
    SELECT COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'stg_rpt_ventas_detallado'
    ORDER BY ORDINAL_POSITION
  `);
  const sqlCols = schema.recordset.map((r: any) => r.COLUMN_NAME);
  console.log(`Tabla SQL: ${sqlCols.length} columnas`);

  // Build insert using case-insensitive matching
  for (const row of rows) {
    // Map Finance keys to SQL columns (same names)
    const mappedCols: string[] = [];
    const params: { col: string; val: any }[] = [];
    for (const col of sqlCols) {
      if (row[col] !== undefined) {
        mappedCols.push(col);
        params.push({ col, val: row[col] });
      }
    }
    if (mappedCols.length === 0) continue;

    const colList = mappedCols.map(c => `[${c}]`).join(', ');
    const paramList = mappedCols.map((_, i) => `@p${i}`).join(', ');
    const req = pool.request();
    params.forEach((p, i) => req.input(`p${i}`, p.val));

    try {
      await req.query(`INSERT INTO dbo.stg_rpt_ventas_detallado (${colList}) VALUES (${paramList})`);
      console.log(`  ✓ INSERT ${row['Numero_SAP']} / ${row['Codigo_Producto']}`);
    } catch (e: any) {
      console.error(`  ✗ ${row['Numero_SAP']} / ${row['Codigo_Producto']}: ${e.message}`);
    }
  }

  // Now compute Ganancia for the inserted rows (= venta - costo)
  await pool.request().query(`
    UPDATE dbo.stg_rpt_ventas_detallado
    SET Ganancia = TRY_CAST([Valor_Venta_Dolares_Presentación] AS DECIMAL(19,6))
                 - TRY_CAST([Costo Total _Presentación] AS DECIMAL(19,6)),
        [Ganancia (%)] = CASE
          WHEN TRY_CAST([Valor_Venta_Dolares_Presentación] AS DECIMAL(19,6)) = 0 THEN 0
          ELSE ROUND(
            (TRY_CAST([Valor_Venta_Dolares_Presentación] AS DECIMAL(19,6))
             - TRY_CAST([Costo Total _Presentación] AS DECIMAL(19,6)))
            / TRY_CAST([Valor_Venta_Dolares_Presentación] AS DECIMAL(19,6)) * 100, 2) END
    WHERE Numero_SAP IN (
      '01-F001-00039750','07-FC01-00001942','08-FD01-00000282'
    )
      AND (Ganancia IS NULL OR TRY_CAST(Ganancia AS DECIMAL(19,6)) = 0);
  `);

  // KPIs finales
  const k = await pool.request().query(`
    SELECT COUNT(*) AS filas,
      SUM(TRY_CAST([Valor_Venta_Dolares_Presentación] AS DECIMAL(19,2))) AS venta,
      SUM(TRY_CAST([Costo Total _Presentación] AS DECIMAL(19,2))) AS costo,
      SUM(TRY_CAST(Ganancia AS DECIMAL(19,2))) AS ganancia
    FROM dbo.stg_rpt_ventas_detallado
    WHERE Fecha_Emision BETWEEN '2026-03-01' AND '2026-03-31'
  `);
  const m = k.recordset[0];
  const margen = m.venta > 0 ? (m.ganancia / m.venta * 100).toFixed(2) : '—';
  console.log('\n▸ KPIs FINALES MARZO vs FINANZAS');
  console.log(`   Filas:     ${m.filas}   (Finanzas: 1,952)`);
  console.log(`   Venta:     ${Number(m.venta).toLocaleString('en-US',{maximumFractionDigits:2})}  (Finanzas: 1,316,793.64)`);
  console.log(`   Costo:     ${Number(m.costo).toLocaleString('en-US',{maximumFractionDigits:2})}  (Finanzas: 1,056,691.70)`);
  console.log(`   Ganancia:  ${Number(m.ganancia).toLocaleString('en-US',{maximumFractionDigits:2})}  (Finanzas: 260,101.94)`);
  console.log(`   Margen:    ${margen}%   (Finanzas: 19.75%)`);

  await pool.close();
}

main().catch(e => { console.error(e); process.exit(1); });
