/**
 * READ-ONLY: Analiza TODOS los duplicados en abril 2026 (Peru + Ecuador)
 * para entender el alcance antes de actuar.
 */
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env'), override: true });

async function main() {
  const { getDbPool, closeDb } = await import('../src/config/database');
  const pool = await getDbPool();

  console.log('========================================');
  console.log('  ANÁLISIS DUPLICADOS ABRIL 2026');
  console.log('========================================\n');

  // Resumen total abril
  const tot = await pool.request().query(`
    SELECT Pais, COUNT(*) AS filas,
      COUNT(DISTINCT Numero_SAP + '|' + Codigo_Producto) AS keys_unicos,
      SUM(TRY_CAST([Valor_Venta_Dolares_Presentacion] AS DECIMAL(19,2))) AS venta,
      SUM(TRY_CAST([Costo_Total_Presentacion] AS DECIMAL(19,2))) AS costo
    FROM dbo.stg_rpt_ventas_detallado
    WHERE Fecha_Emision BETWEEN '2026-04-01' AND '2026-04-30'
    GROUP BY Pais
    ORDER BY 1
  `);
  console.log('▸ Resumen abril por país:');
  console.table(tot.recordset);

  // Duplicados: keys con más de 1 fila
  console.log('\n▸ Keys con duplicados en abril (filas > 1, agrupando por num+cod+tipo+fecha+venta):');
  const dups = await pool.request().query(`
    SELECT
      Numero_SAP, Codigo_Producto, Pais, Tipo_Documento,
      CONVERT(VARCHAR(10), Fecha_Emision, 23) AS Fecha,
      TRY_CAST([Valor_Venta_Dolares_Presentacion] AS DECIMAL(19,2)) AS venta,
      TRY_CAST([Costo_Total_Presentacion] AS DECIMAL(19,2)) AS costo,
      COUNT(*) AS copias
    FROM dbo.stg_rpt_ventas_detallado
    WHERE Fecha_Emision BETWEEN '2026-04-01' AND '2026-04-30'
    GROUP BY Numero_SAP, Codigo_Producto, Pais, Tipo_Documento,
             CONVERT(VARCHAR(10), Fecha_Emision, 23),
             TRY_CAST([Valor_Venta_Dolares_Presentacion] AS DECIMAL(19,2)),
             TRY_CAST([Costo_Total_Presentacion] AS DECIMAL(19,2))
    HAVING COUNT(*) > 1
    ORDER BY copias DESC, Numero_SAP
  `);
  console.log(`   ${dups.recordset.length} grupos con duplicados`);
  if (dups.recordset.length > 0) {
    // Mostrar top 30 por copias
    console.table(dups.recordset.slice(0, 30).map((r: any) => ({
      num: r.Numero_SAP,
      cod: r.Codigo_Producto,
      pais: r.Pais,
      tipo: (r.Tipo_Documento || '').substring(0, 14),
      fecha: r.Fecha,
      venta: Number(r.venta || 0).toFixed(2),
      costo: Number(r.costo || 0).toFixed(2),
      copias: r.copias,
    })));
    const totalCopiasExtra = dups.recordset.reduce((a: number, r: any) => a + (r.copias - 1), 0);
    const ventaDup = dups.recordset.reduce((a: number, r: any) => a + (Number(r.venta) * (r.copias - 1)), 0);
    const costoDup = dups.recordset.reduce((a: number, r: any) => a + (Number(r.costo) * (r.copias - 1)), 0);
    console.log(`\n   ▸ Filas extra a eliminar (sumando todas las copias > 1): ${totalCopiasExtra}`);
    console.log(`   ▸ Venta sobre-contada: ${ventaDup.toFixed(2)}`);
    console.log(`   ▸ Costo sobre-contado: ${costoDup.toFixed(2)}`);
  }

  // Comparativa últimos 10 días vs primeros 20 días (DataFactory solo recorre últimos 10)
  console.log('\n▸ Duplicados por rango (DataFactory recorre últimos 10 días):');
  const r10 = await pool.request().query(`
    SELECT
      CASE WHEN Fecha_Emision >= DATEADD(DAY, -10, GETDATE()) THEN 'Últimos 10 días'
           ELSE 'Primeros 20 días abril' END AS rango,
      COUNT(*) AS filas
    FROM dbo.stg_rpt_ventas_detallado
    WHERE Fecha_Emision BETWEEN '2026-04-01' AND '2026-04-30'
    GROUP BY CASE WHEN Fecha_Emision >= DATEADD(DAY, -10, GETDATE()) THEN 'Últimos 10 días' ELSE 'Primeros 20 días abril' END
  `);
  console.table(r10.recordset);

  // Verificar si los duplicados en últimos 10 días son distintos a los del 1-20
  const r11 = await pool.request().query(`
    SELECT
      CASE WHEN Fecha_Emision >= DATEADD(DAY, -10, GETDATE()) THEN 'Últimos 10' ELSE 'Primeros 20' END AS rango,
      COUNT(*) AS grupos_duplicados,
      SUM(copias - 1) AS filas_extra
    FROM (
      SELECT Numero_SAP, Codigo_Producto,
             MIN(Fecha_Emision) AS Fecha_Emision,
             COUNT(*) AS copias
      FROM dbo.stg_rpt_ventas_detallado
      WHERE Fecha_Emision BETWEEN '2026-04-01' AND '2026-04-30'
      GROUP BY Numero_SAP, Codigo_Producto, Tipo_Documento,
               CONVERT(VARCHAR(10), Fecha_Emision, 23),
               TRY_CAST([Valor_Venta_Dolares_Presentacion] AS DECIMAL(19,2))
      HAVING COUNT(*) > 1
    ) g
    GROUP BY CASE WHEN Fecha_Emision >= DATEADD(DAY, -10, GETDATE()) THEN 'Últimos 10' ELSE 'Primeros 20' END
  `);
  console.log('\n▸ Distribución de duplicados por rango:');
  console.table(r11.recordset);

  await closeDb();
}

main().catch(e => { console.error(e); process.exit(1); });
