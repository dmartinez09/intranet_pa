import { getDbPool } from '../src/config/database';

async function main() {
  const pool = await getDbPool();

  console.log('═══════════════════════════════════════════════════════════');
  console.log(' VALIDACIÓN POST-DATAFACTORY — stg_rpt_ventas_detallado');
  console.log('═══════════════════════════════════════════════════════════\n');

  // 1. Conteo global y por período
  const r1 = await pool.request().query(`
    SELECT
      COUNT(*) AS total_filas,
      MIN(Fecha_Emision) AS fecha_min,
      MAX(Fecha_Emision) AS fecha_max,
      COUNT(DISTINCT Numero_SAP) AS docs_unicos,
      COUNT(DISTINCT Razon_Social_Cliente) AS clientes_unicos
    FROM dbo.stg_rpt_ventas_detallado
  `);
  console.log('▸ RESUMEN GLOBAL');
  console.table(r1.recordset);

  // 2. Por mes — para ver que marzo + abril coexisten
  const r2 = await pool.request().query(`
    SELECT
      YEAR(Fecha_Emision) AS anio,
      MONTH(Fecha_Emision) AS mes,
      COUNT(*) AS filas,
      SUM(TRY_CAST([Valor_Venta_Dolares_Presentación] AS DECIMAL(19,2))) AS venta_usd,
      SUM(TRY_CAST([Costo Total _Presentación] AS DECIMAL(19,2))) AS costo_usd,
      SUM(TRY_CAST(Ganancia AS DECIMAL(19,2))) AS ganancia_usd
    FROM dbo.stg_rpt_ventas_detallado
    WHERE Fecha_Emision >= '2026-01-01'
    GROUP BY YEAR(Fecha_Emision), MONTH(Fecha_Emision)
    ORDER BY anio, mes
  `);
  console.log('\n▸ POR MES (desde enero 2026)');
  console.table(r2.recordset);

  // 3. Duplicados
  const r3 = await pool.request().query(`
    SELECT TOP 5
      Numero_SAP, Codigo_Producto, COUNT(*) AS veces
    FROM dbo.stg_rpt_ventas_detallado
    WHERE Fecha_Emision >= '2026-03-01'
    GROUP BY Numero_SAP, Codigo_Producto
    HAVING COUNT(*) > 1
    ORDER BY veces DESC
  `);
  console.log('\n▸ DUPLICADOS por (Numero_SAP + Codigo_Producto) desde marzo');
  if (r3.recordset.length === 0) console.log('   ✓ Sin duplicados');
  else console.table(r3.recordset);

  // 4. Validar patch NC de marzo
  const r4 = await pool.request().query(`
    SELECT
      Numero_SAP,
      Codigo_Producto,
      [Costo Total _Presentación] AS costo_pres,
      [Valor_Venta_Dolares_Presentación] AS venta,
      Ganancia,
      [Ganancia (%)] AS margen_pct
    FROM dbo.stg_rpt_ventas_detallado
    WHERE Numero_SAP IN ('07-FC01-00001889','07-FC01-00001892',
                          '07-FC01-00001895','07-FC01-00001896')
      AND Fecha_Emision BETWEEN '2026-03-01' AND '2026-03-31'
      AND Codigo_Producto IN ('QHER000006','ECOD000006','QFUN000032',
                               'QINS000061','ECOD000009','QINS000111','QHER000002')
    ORDER BY Numero_SAP, Codigo_Producto
  `);
  console.log('\n▸ PATCH NC MARZO (debe verse con costo NEGATIVO)');
  console.table(r4.recordset);

  // 5. KPIs de marzo vs Finanzas
  const r5 = await pool.request().query(`
    SELECT
      COUNT(*) AS filas,
      COUNT(DISTINCT Numero_SAP) AS docs,
      COUNT(DISTINCT Razon_Social_Cliente) AS clientes,
      SUM(TRY_CAST([Valor_Venta_Dolares_Presentación] AS DECIMAL(19,2))) AS venta,
      SUM(TRY_CAST([Costo Total _Presentación] AS DECIMAL(19,2))) AS costo,
      SUM(TRY_CAST(Ganancia AS DECIMAL(19,2))) AS ganancia
    FROM dbo.stg_rpt_ventas_detallado
    WHERE Fecha_Emision BETWEEN '2026-03-01' AND '2026-03-31'
  `);
  const m = r5.recordset[0];
  const margen = m.venta > 0 ? ((m.ganancia / m.venta) * 100).toFixed(2) : '—';
  console.log('\n▸ KPIs MARZO 2026 (SQL)  vs  FINANZAS');
  console.log(`   Filas:     ${m.filas}   (Finanzas: 1,907)`);
  console.log(`   Docs:      ${m.docs}`);
  console.log(`   Clientes:  ${m.clientes}   (Finanzas: 264)`);
  console.log(`   Venta:     ${Number(m.venta).toLocaleString('en-US',{maximumFractionDigits:2})}  (Finanzas: 1,316,793.64)`);
  console.log(`   Costo:     ${Number(m.costo).toLocaleString('en-US',{maximumFractionDigits:2})}  (Finanzas: 1,056,691.70)`);
  console.log(`   Ganancia:  ${Number(m.ganancia).toLocaleString('en-US',{maximumFractionDigits:2})}  (Finanzas: 260,101.94)`);
  console.log(`   Margen:    ${margen}%   (Finanzas: 19.75%)`);

  // 6. Filas con costo 0 en marzo (post-patch deberían ser pocas)
  const r6 = await pool.request().query(`
    SELECT COUNT(*) AS filas_costo_cero
    FROM dbo.stg_rpt_ventas_detallado
    WHERE Fecha_Emision BETWEEN '2026-03-01' AND '2026-03-31'
      AND (TRY_CAST([Costo Total _Presentación] AS DECIMAL(19,6)) = 0 OR [Costo Total _Presentación] IS NULL)
      AND TRY_CAST([Valor_Venta_Dolares_Presentación] AS DECIMAL(19,6)) <> 0
  `);
  console.log(`\n▸ Filas marzo con costo=0 pero venta≠0: ${r6.recordset[0].filas_costo_cero}`);

  // 7. Últimas cargas (para ver que abril está entrando)
  const r7 = await pool.request().query(`
    SELECT TOP 7
      CONVERT(VARCHAR(10), Fecha_Emision, 120) AS fecha,
      COUNT(*) AS filas
    FROM dbo.stg_rpt_ventas_detallado
    WHERE Fecha_Emision >= DATEADD(DAY, -15, CAST(GETDATE() AS DATE))
    GROUP BY Fecha_Emision
    ORDER BY Fecha_Emision DESC
  `);
  console.log('\n▸ Últimos 15 días (ventana DataFactory)');
  console.table(r7.recordset);

  await pool.close();
}

main().catch(e => { console.error(e); process.exit(1); });
