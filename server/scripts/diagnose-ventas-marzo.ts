// ============================================================
// Diagnóstico de ventas marzo 2026 (cerrado)
// Verifica los cálculos que llegan al Dashboard
// ============================================================

import { getDbPool, closeDb } from '../src/config/database';

async function main() {
  const pool = await getDbPool();

  console.log('=========================================================');
  console.log('  DIAGNÓSTICO VENTAS - MARZO 2026 (cerrado)');
  console.log('=========================================================\n');

  // 1. Información general de la vista
  console.log('--- 1. Registros totales por mes en 2026 ---');
  const res1 = await pool.request().query(`
    SELECT
      YEAR(Fecha_Emision)  AS anio,
      MONTH(Fecha_Emision) AS mes,
      COUNT(*) AS transacciones,
      COUNT(DISTINCT Numero_SAP) AS docs,
      SUM(CAST([Valor_Venta_Dolares_Presentación] AS DECIMAL(18,2))) AS venta_usd,
      SUM(CAST([Costo Total _Presentación] AS DECIMAL(18,2))) AS costo_total,
      SUM(CAST(Ganancia AS DECIMAL(18,2))) AS ganancia
    FROM dbo.stg_rpt_ventas_detallado
    WHERE Pais = 'Peru' AND YEAR(Fecha_Emision) = 2026
    GROUP BY YEAR(Fecha_Emision), MONTH(Fecha_Emision)
    ORDER BY mes
  `);
  console.table(res1.recordset.map((r: any) => ({
    mes: `${r.anio}-${String(r.mes).padStart(2,'0')}`,
    tx: r.transacciones,
    docs: r.docs,
    venta_usd: `$${Math.round(Number(r.venta_usd||0)).toLocaleString('es-PE')}`,
    costo: `$${Math.round(Number(r.costo_total||0)).toLocaleString('es-PE')}`,
    ganancia_directa: `$${Math.round(Number(r.ganancia||0)).toLocaleString('es-PE')}`,
    ganancia_calc: `$${Math.round(Number(r.venta_usd||0) - Number(r.costo_total||0)).toLocaleString('es-PE')}`,
    margen_directo: r.venta_usd > 0 ? `${((Number(r.ganancia||0) / Number(r.venta_usd)) * 100).toFixed(2)}%` : 'N/A',
    margen_calc:   r.venta_usd > 0 ? `${(((Number(r.venta_usd||0) - Number(r.costo_total||0)) / Number(r.venta_usd)) * 100).toFixed(2)}%` : 'N/A',
  })));

  // 2. Por división (AGROCHEM vs BIOSCIENCE) marzo 2026
  console.log('\n--- 2. Marzo 2026 por División ---');
  const res2 = await pool.request().query(`
    SELECT
      [División] AS division,
      COUNT(*) AS transacciones,
      SUM(CAST([Valor_Venta_Dolares_Presentación] AS DECIMAL(18,2))) AS venta,
      SUM(CAST([Costo Total _Presentación] AS DECIMAL(18,2))) AS costo,
      SUM(CAST(Ganancia AS DECIMAL(18,2))) AS ganancia
    FROM dbo.stg_rpt_ventas_detallado
    WHERE Pais = 'Peru'
      AND YEAR(Fecha_Emision) = 2026
      AND MONTH(Fecha_Emision) = 3
    GROUP BY [División]
    ORDER BY venta DESC
  `);
  console.table(res2.recordset.map((r: any) => ({
    division: r.division || '(NULL)',
    tx: r.transacciones,
    venta: `$${Math.round(Number(r.venta||0)).toLocaleString('es-PE')}`,
    costo: `$${Math.round(Number(r.costo||0)).toLocaleString('es-PE')}`,
    ganancia: `$${Math.round(Number(r.ganancia||0)).toLocaleString('es-PE')}`,
    margen: r.venta > 0 ? `${((Number(r.ganancia||0) / Number(r.venta)) * 100).toFixed(2)}%` : 'N/A',
  })));

  // 3. Por grupo cliente marzo 2026
  console.log('\n--- 3. Marzo 2026 por Grupo Cliente ---');
  const res3 = await pool.request().query(`
    SELECT
      Grupo_Cliente,
      COUNT(*) AS tx,
      SUM(CAST([Valor_Venta_Dolares_Presentación] AS DECIMAL(18,2))) AS venta,
      SUM(CAST([Costo Total _Presentación] AS DECIMAL(18,2))) AS costo,
      SUM(CAST(Ganancia AS DECIMAL(18,2))) AS ganancia
    FROM dbo.stg_rpt_ventas_detallado
    WHERE Pais = 'Peru'
      AND YEAR(Fecha_Emision) = 2026
      AND MONTH(Fecha_Emision) = 3
    GROUP BY Grupo_Cliente
    ORDER BY venta DESC
  `);
  console.table(res3.recordset.map((r: any) => ({
    grupo: r.Grupo_Cliente || '(NULL)',
    tx: r.tx,
    venta: `$${Math.round(Number(r.venta||0)).toLocaleString('es-PE')}`,
    costo: `$${Math.round(Number(r.costo||0)).toLocaleString('es-PE')}`,
    ganancia: `$${Math.round(Number(r.ganancia||0)).toLocaleString('es-PE')}`,
    margen: r.venta > 0 ? `${((Number(r.ganancia||0) / Number(r.venta)) * 100).toFixed(2)}%` : 'N/A',
  })));

  // 4. Casos problemáticos: ganancia negativa
  console.log('\n--- 4. Marzo 2026: registros con ganancia NEGATIVA ---');
  const res4 = await pool.request().query(`
    SELECT COUNT(*) AS tx_negativas,
           SUM(CAST(Ganancia AS DECIMAL(18,2))) AS ganancia_neg_total
    FROM dbo.stg_rpt_ventas_detallado
    WHERE Pais = 'Peru'
      AND YEAR(Fecha_Emision) = 2026
      AND MONTH(Fecha_Emision) = 3
      AND Ganancia < 0
  `);
  console.table(res4.recordset);

  // 5. Casos con costo NULL o 0
  console.log('\n--- 5. Marzo 2026: registros con costo NULL/0 ---');
  const res5 = await pool.request().query(`
    SELECT
      CASE
        WHEN [Costo Total _Presentación] IS NULL THEN 'NULL'
        WHEN [Costo Total _Presentación] = 0 THEN '0'
        ELSE 'NUMERICO'
      END AS estado_costo,
      COUNT(*) AS tx,
      SUM(CAST([Valor_Venta_Dolares_Presentación] AS DECIMAL(18,2))) AS venta
    FROM dbo.stg_rpt_ventas_detallado
    WHERE Pais = 'Peru'
      AND YEAR(Fecha_Emision) = 2026
      AND MONTH(Fecha_Emision) = 3
    GROUP BY
      CASE
        WHEN [Costo Total _Presentación] IS NULL THEN 'NULL'
        WHEN [Costo Total _Presentación] = 0 THEN '0'
        ELSE 'NUMERICO'
      END
  `);
  console.table(res5.recordset);

  // 6. Comparación valores: Valor_Venta_Dolares vs Valor_Venta_Dolares_Presentación
  console.log('\n--- 6. Diferencia entre columnas de Venta ---');
  try {
    const res6 = await pool.request().query(`
      SELECT
        SUM(CAST(Valor_Venta_Dolares AS DECIMAL(18,2))) AS venta_sin_presentacion,
        SUM(CAST([Valor_Venta_Dolares_Presentación] AS DECIMAL(18,2))) AS venta_con_presentacion
      FROM dbo.stg_rpt_ventas_detallado
      WHERE Pais = 'Peru'
        AND YEAR(Fecha_Emision) = 2026
        AND MONTH(Fecha_Emision) = 3
    `);
    console.table(res6.recordset.map((r: any) => ({
      Valor_Venta_Dolares: `$${Math.round(Number(r.venta_sin_presentacion||0)).toLocaleString('es-PE')}`,
      Valor_Venta_Dolares_Presentacion: `$${Math.round(Number(r.venta_con_presentacion||0)).toLocaleString('es-PE')}`,
      diferencia: `$${Math.round(Number(r.venta_sin_presentacion||0) - Number(r.venta_con_presentacion||0)).toLocaleString('es-PE')}`,
    })));
  } catch (e: any) {
    console.log('No se pudo comparar (posiblemente no existe Valor_Venta_Dolares sin Presentación):', e.message);
  }

  // 7. Tipos de documento en marzo
  console.log('\n--- 7. Marzo 2026 por Tipo Documento ---');
  const res7 = await pool.request().query(`
    SELECT
      [Tipo Documento] AS tipo_doc,
      COUNT(*) AS tx,
      SUM(CAST([Valor_Venta_Dolares_Presentación] AS DECIMAL(18,2))) AS venta,
      SUM(CAST([Costo Total _Presentación] AS DECIMAL(18,2))) AS costo,
      SUM(CAST(Ganancia AS DECIMAL(18,2))) AS ganancia
    FROM dbo.stg_rpt_ventas_detallado
    WHERE Pais = 'Peru'
      AND YEAR(Fecha_Emision) = 2026
      AND MONTH(Fecha_Emision) = 3
    GROUP BY [Tipo Documento]
    ORDER BY venta DESC
  `);
  console.table(res7.recordset.map((r: any) => ({
    tipo: r.tipo_doc || '(NULL)',
    tx: r.tx,
    venta: `$${Math.round(Number(r.venta||0)).toLocaleString('es-PE')}`,
    costo: `$${Math.round(Number(r.costo||0)).toLocaleString('es-PE')}`,
    ganancia: `$${Math.round(Number(r.ganancia||0)).toLocaleString('es-PE')}`,
    margen: r.venta > 0 ? `${((Number(r.ganancia||0) / Number(r.venta)) * 100).toFixed(2)}%` : 'N/A',
  })));

  await closeDb();
}

main().catch(e => { console.error(e); process.exit(1); });
