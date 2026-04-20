// Análisis detallado de las 121 Notas de Crédito de marzo 2026
import { getDbPool, closeDb } from '../src/config/database';

async function main() {
  const pool = await getDbPool();

  console.log('=========================================================');
  console.log('  NOTAS DE CRÉDITO - Marzo 2026 - Análisis detallado');
  console.log('=========================================================\n');

  // 1. Distribución por signo de venta y costo
  console.log('--- 1. Distribución por signo (venta, costo, ganancia) ---');
  const r1 = await pool.request().query(`
    SELECT
      CASE
        WHEN [Valor_Venta_Dolares_Presentación] > 0 THEN 'POS'
        WHEN [Valor_Venta_Dolares_Presentación] < 0 THEN 'NEG'
        ELSE 'CERO' END AS venta_signo,
      CASE
        WHEN [Costo Total _Presentación] > 0 THEN 'POS'
        WHEN [Costo Total _Presentación] < 0 THEN 'NEG'
        WHEN [Costo Total _Presentación] IS NULL THEN 'NULL'
        ELSE 'CERO' END AS costo_signo,
      CASE
        WHEN Ganancia > 0 THEN 'POS'
        WHEN Ganancia < 0 THEN 'NEG'
        ELSE 'CERO' END AS ganancia_signo,
      COUNT(*) AS tx,
      SUM(CAST([Valor_Venta_Dolares_Presentación] AS DECIMAL(18,2))) AS venta,
      SUM(CAST([Costo Total _Presentación] AS DECIMAL(18,2))) AS costo,
      SUM(CAST(Ganancia AS DECIMAL(18,2))) AS ganancia
    FROM dbo.stg_rpt_ventas_detallado
    WHERE Pais='Peru' AND YEAR(Fecha_Emision)=2026 AND MONTH(Fecha_Emision)=3
      AND [Tipo Documento] = '07 - NOTA DE CRÉDITO'
    GROUP BY
      CASE WHEN [Valor_Venta_Dolares_Presentación] > 0 THEN 'POS' WHEN [Valor_Venta_Dolares_Presentación] < 0 THEN 'NEG' ELSE 'CERO' END,
      CASE WHEN [Costo Total _Presentación] > 0 THEN 'POS' WHEN [Costo Total _Presentación] < 0 THEN 'NEG' WHEN [Costo Total _Presentación] IS NULL THEN 'NULL' ELSE 'CERO' END,
      CASE WHEN Ganancia > 0 THEN 'POS' WHEN Ganancia < 0 THEN 'NEG' ELSE 'CERO' END
    ORDER BY tx DESC
  `);
  console.table(r1.recordset.map((r: any) => ({
    venta: r.venta_signo,
    costo: r.costo_signo,
    ganancia: r.ganancia_signo,
    tx: r.tx,
    venta_sum: `$${Math.round(r.venta||0).toLocaleString('es-PE')}`,
    costo_sum: `$${Math.round(r.costo||0).toLocaleString('es-PE')}`,
    ganancia_sum: `$${Math.round(r.ganancia||0).toLocaleString('es-PE')}`,
  })));

  // 2. Muestra de 15 NC individuales
  console.log('\n--- 2. Muestra de 15 NC (venta, costo, ganancia por transacción) ---');
  const r2 = await pool.request().query(`
    SELECT TOP 15
      Numero_SAP,
      Fecha_Emision,
      LEFT(Razon_Social_Cliente, 30) AS cliente,
      LEFT(Grupo_Cliente, 20) AS grupo,
      CAST([Valor_Venta_Dolares_Presentación] AS DECIMAL(18,2)) AS venta,
      CAST([Costo Total _Presentación] AS DECIMAL(18,2)) AS costo,
      CAST(Ganancia AS DECIMAL(18,2)) AS ganancia
    FROM dbo.stg_rpt_ventas_detallado
    WHERE Pais='Peru' AND YEAR(Fecha_Emision)=2026 AND MONTH(Fecha_Emision)=3
      AND [Tipo Documento] = '07 - NOTA DE CRÉDITO'
    ORDER BY ABS(CAST([Valor_Venta_Dolares_Presentación] AS DECIMAL(18,2))) DESC
  `);
  console.table(r2.recordset.map((r: any) => ({
    doc: r.Numero_SAP,
    cliente: r.cliente,
    grupo: r.grupo,
    venta: `$${Number(r.venta||0).toFixed(0)}`,
    costo: `$${Number(r.costo||0).toFixed(0)}`,
    ganancia: `$${Number(r.ganancia||0).toFixed(0)}`,
    coherente: (Number(r.venta) <= 0 && Number(r.costo) >= 0) ? '❌ costo+ y venta-' : 'ok',
  })));

  // 3. Comparación: NC con costo POSITIVO vs NC con costo NEGATIVO
  console.log('\n--- 3. ¿Cuántas NC tienen costo de signo correcto? ---');
  const r3 = await pool.request().query(`
    SELECT
      CASE
        WHEN [Valor_Venta_Dolares_Presentación] < 0 AND [Costo Total _Presentación] > 0 THEN '❌ VENTA- / COSTO+ (incoherente)'
        WHEN [Valor_Venta_Dolares_Presentación] < 0 AND [Costo Total _Presentación] < 0 THEN '✓ VENTA- / COSTO- (correcto)'
        WHEN [Valor_Venta_Dolares_Presentación] < 0 AND ([Costo Total _Presentación] = 0 OR [Costo Total _Presentación] IS NULL) THEN '✓ VENTA- / COSTO 0'
        WHEN [Valor_Venta_Dolares_Presentación] >= 0 THEN 'VENTA +/0'
        ELSE 'otro' END AS caso,
      COUNT(*) AS tx,
      SUM(CAST([Valor_Venta_Dolares_Presentación] AS DECIMAL(18,2))) AS venta,
      SUM(CAST([Costo Total _Presentación] AS DECIMAL(18,2))) AS costo
    FROM dbo.stg_rpt_ventas_detallado
    WHERE Pais='Peru' AND YEAR(Fecha_Emision)=2026 AND MONTH(Fecha_Emision)=3
      AND [Tipo Documento] = '07 - NOTA DE CRÉDITO'
    GROUP BY CASE
      WHEN [Valor_Venta_Dolares_Presentación] < 0 AND [Costo Total _Presentación] > 0 THEN '❌ VENTA- / COSTO+ (incoherente)'
      WHEN [Valor_Venta_Dolares_Presentación] < 0 AND [Costo Total _Presentación] < 0 THEN '✓ VENTA- / COSTO- (correcto)'
      WHEN [Valor_Venta_Dolares_Presentación] < 0 AND ([Costo Total _Presentación] = 0 OR [Costo Total _Presentación] IS NULL) THEN '✓ VENTA- / COSTO 0'
      WHEN [Valor_Venta_Dolares_Presentación] >= 0 THEN 'VENTA +/0'
      ELSE 'otro' END
    ORDER BY tx DESC
  `);
  console.table(r3.recordset.map((r: any) => ({
    caso: r.caso,
    tx: r.tx,
    venta: `$${Math.round(r.venta||0).toLocaleString('es-PE')}`,
    costo: `$${Math.round(r.costo||0).toLocaleString('es-PE')}`,
  })));

  // 4. Verificar: ¿Ganancia = Venta - Costo siempre?
  console.log('\n--- 4. ¿La columna Ganancia coincide con Venta - Costo? ---');
  const r4 = await pool.request().query(`
    SELECT
      SUM(CAST([Valor_Venta_Dolares_Presentación] AS DECIMAL(18,2))) AS venta,
      SUM(CAST([Costo Total _Presentación] AS DECIMAL(18,2))) AS costo,
      SUM(CAST(Ganancia AS DECIMAL(18,2))) AS ganancia_col,
      SUM(CAST([Valor_Venta_Dolares_Presentación] AS DECIMAL(18,2))) -
        SUM(CAST([Costo Total _Presentación] AS DECIMAL(18,2))) AS ganancia_calc
    FROM dbo.stg_rpt_ventas_detallado
    WHERE Pais='Peru' AND YEAR(Fecha_Emision)=2026 AND MONTH(Fecha_Emision)=3
      AND [Tipo Documento] = '07 - NOTA DE CRÉDITO'
  `);
  const row = r4.recordset[0];
  const diff = Number(row.ganancia_col) - Number(row.ganancia_calc);
  console.log(`  Venta total NC:        $${Math.round(Number(row.venta||0)).toLocaleString('es-PE')}`);
  console.log(`  Costo total NC:        $${Math.round(Number(row.costo||0)).toLocaleString('es-PE')}`);
  console.log(`  Ganancia (columna):    $${Math.round(Number(row.ganancia_col||0)).toLocaleString('es-PE')}`);
  console.log(`  Ganancia (v - c calc): $${Math.round(Number(row.ganancia_calc||0)).toLocaleString('es-PE')}`);
  console.log(`  DIFERENCIA:            $${Math.round(diff).toLocaleString('es-PE')} ${Math.abs(diff) > 1 ? '❌ NO COINCIDEN' : '✓ coinciden'}`);

  // 5. Ver una NC específica en detalle
  console.log('\n--- 5. NC con mayor impacto individual ---');
  const r5 = await pool.request().query(`
    SELECT TOP 5
      Numero_SAP,
      Fecha_Emision,
      LEFT(Razon_Social_Cliente, 40) AS cliente,
      Familia, Ingrediente_Activo,
      CAST([Valor_Venta_Dolares_Presentación] AS DECIMAL(18,2)) AS venta,
      CAST([Costo Total _Presentación] AS DECIMAL(18,2)) AS costo,
      CAST(Ganancia AS DECIMAL(18,2)) AS ganancia
    FROM dbo.stg_rpt_ventas_detallado
    WHERE Pais='Peru' AND YEAR(Fecha_Emision)=2026 AND MONTH(Fecha_Emision)=3
      AND [Tipo Documento] = '07 - NOTA DE CRÉDITO'
    ORDER BY ABS(CAST(Ganancia AS DECIMAL(18,2))) DESC
  `);
  console.table(r5.recordset.map((r: any) => ({
    doc: r.Numero_SAP,
    cliente: r.cliente,
    familia: r.Familia,
    IA: r.Ingrediente_Activo,
    venta: Number(r.venta).toFixed(2),
    costo: Number(r.costo).toFixed(2),
    ganancia_col: Number(r.ganancia).toFixed(2),
    v_menos_c: (Number(r.venta) - Number(r.costo)).toFixed(2),
  })));

  await closeDb();
}

main().catch(e => { console.error(e); process.exit(1); });
