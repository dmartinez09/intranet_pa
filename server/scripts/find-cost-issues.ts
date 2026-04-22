import { getDbPool } from '../src/config/database';

async function main() {
  const pool = await getDbPool();

  console.log('▸ TOP 15 filas con mayor costo en marzo 2026\n');
  const r1 = await pool.request().query(`
    SELECT TOP 15
      Numero_SAP, Codigo_Producto, Nombre_Producto,
      [Cantidad KG/LT] AS cant,
      [Costo Total _Presentación] AS costo,
      [Valor_Venta_Dolares_Presentación] AS venta,
      Ganancia, [Ganancia (%)] AS margen
    FROM dbo.stg_rpt_ventas_detallado
    WHERE Fecha_Emision BETWEEN '2026-03-01' AND '2026-03-31'
    ORDER BY TRY_CAST([Costo Total _Presentación] AS DECIMAL(19,6)) DESC
  `);
  console.table(r1.recordset);

  console.log('\n▸ Filas con costo > venta (posible signo invertido)\n');
  const r2 = await pool.request().query(`
    SELECT COUNT(*) AS casos,
           SUM(TRY_CAST([Costo Total _Presentación] AS DECIMAL(19,6)) -
               TRY_CAST([Valor_Venta_Dolares_Presentación] AS DECIMAL(19,6))) AS exceso_costo
    FROM dbo.stg_rpt_ventas_detallado
    WHERE Fecha_Emision BETWEEN '2026-03-01' AND '2026-03-31'
      AND TRY_CAST([Costo Total _Presentación] AS DECIMAL(19,6)) >
          TRY_CAST([Valor_Venta_Dolares_Presentación] AS DECIMAL(19,6))
      AND TRY_CAST([Valor_Venta_Dolares_Presentación] AS DECIMAL(19,6)) > 0
  `);
  console.table(r2.recordset);

  console.log('\n▸ Distribución por Tipo Documento\n');
  const r3 = await pool.request().query(`
    SELECT
      [Tipo Documento] AS tipo_doc,
      COUNT(*) AS filas,
      SUM(TRY_CAST([Valor_Venta_Dolares_Presentación] AS DECIMAL(19,2))) AS venta,
      SUM(TRY_CAST([Costo Total _Presentación] AS DECIMAL(19,2))) AS costo,
      SUM(TRY_CAST(Ganancia AS DECIMAL(19,2))) AS ganancia
    FROM dbo.stg_rpt_ventas_detallado
    WHERE Fecha_Emision BETWEEN '2026-03-01' AND '2026-03-31'
    GROUP BY [Tipo Documento]
    ORDER BY COUNT(*) DESC
  `);
  console.table(r3.recordset);

  console.log('\n▸ NC que faltan por patchar (venta<0 y costo>0)\n');
  const r4 = await pool.request().query(`
    SELECT Numero_SAP, Codigo_Producto,
           [Cantidad KG/LT] AS cant,
           [Costo Total _Presentación] AS costo,
           [Valor_Venta_Dolares_Presentación] AS venta,
           Ganancia
    FROM dbo.stg_rpt_ventas_detallado
    WHERE Fecha_Emision BETWEEN '2026-03-01' AND '2026-03-31'
      AND TRY_CAST([Valor_Venta_Dolares_Presentación] AS DECIMAL(19,6)) < 0
      AND TRY_CAST([Costo Total _Presentación] AS DECIMAL(19,6)) > 0
    ORDER BY Numero_SAP
  `);
  console.table(r4.recordset);
  console.log(`Total: ${r4.recordset.length} NC con bug de signo`);

  await pool.close();
}

main().catch(e => { console.error(e); process.exit(1); });
