import { getDbPool } from '../src/config/database';

async function main() {
  const pool = await getDbPool();

  console.log('═══════════════════════════════════════════════════════════');
  console.log(' LIMPIEZA DE DUPLICADOS — stg_rpt_ventas_detallado');
  console.log('═══════════════════════════════════════════════════════════\n');

  // 1. Pre-count
  const pre = await pool.request().query(`
    SELECT COUNT(*) AS total
    FROM dbo.stg_rpt_ventas_detallado
    WHERE Fecha_Emision >= '2026-03-01'
  `);
  console.log(`Antes: ${pre.recordset[0].total} filas desde marzo`);

  // 2. Identificar duplicados
  const dup = await pool.request().query(`
    SELECT
      Numero_SAP, Codigo_Producto, Fecha_Emision,
      [Cantidad KG/LT] AS cant,
      [Valor_Venta_Dolares_Presentación] AS venta,
      COUNT(*) AS veces
    FROM dbo.stg_rpt_ventas_detallado
    WHERE Fecha_Emision >= '2026-03-01'
    GROUP BY Numero_SAP, Codigo_Producto, Fecha_Emision,
             [Cantidad KG/LT], [Valor_Venta_Dolares_Presentación]
    HAVING COUNT(*) > 1
  `);
  console.log(`\nGrupos con duplicados: ${dup.recordset.length}`);
  if (dup.recordset.length > 0) console.table(dup.recordset);

  // 3. Eliminar duplicados en transacción
  const del = await pool.request().query(`
    BEGIN TRANSACTION;

    WITH CTE AS (
      SELECT
        ROW_NUMBER() OVER (
          PARTITION BY
            Numero_SAP, Codigo_Producto, Fecha_Emision,
            [Cantidad KG/LT], [Valor_Venta_Dolares_Presentación]
          ORDER BY (SELECT NULL)
        ) AS rn
      FROM dbo.stg_rpt_ventas_detallado
      WHERE Fecha_Emision >= '2026-03-01'
    )
    DELETE FROM CTE WHERE rn > 1;

    COMMIT;

    SELECT @@ROWCOUNT AS filas_eliminadas;
  `);
  console.log(`\n✓ Filas eliminadas: revisando...`);

  // Post-count
  const post = await pool.request().query(`
    SELECT COUNT(*) AS total
    FROM dbo.stg_rpt_ventas_detallado
    WHERE Fecha_Emision >= '2026-03-01'
  `);
  console.log(`Después: ${post.recordset[0].total} filas desde marzo`);
  console.log(`Diferencia: ${pre.recordset[0].total - post.recordset[0].total} filas eliminadas`);

  // 4. Validar por mes
  const byMonth = await pool.request().query(`
    SELECT
      YEAR(Fecha_Emision) AS anio,
      MONTH(Fecha_Emision) AS mes,
      COUNT(*) AS filas,
      SUM(TRY_CAST([Valor_Venta_Dolares_Presentación] AS DECIMAL(19,2))) AS venta,
      SUM(TRY_CAST([Costo Total _Presentación] AS DECIMAL(19,2))) AS costo,
      SUM(TRY_CAST(Ganancia AS DECIMAL(19,2))) AS ganancia
    FROM dbo.stg_rpt_ventas_detallado
    WHERE Fecha_Emision >= '2026-03-01'
    GROUP BY YEAR(Fecha_Emision), MONTH(Fecha_Emision)
    ORDER BY anio, mes
  `);
  console.log('\n▸ POR MES (post-limpieza)');
  console.table(byMonth.recordset);

  // 5. Verificar duplicados restantes
  const remaining = await pool.request().query(`
    SELECT COUNT(*) AS grupos_dup
    FROM (
      SELECT Numero_SAP, Codigo_Producto, Fecha_Emision,
             [Cantidad KG/LT], [Valor_Venta_Dolares_Presentación]
      FROM dbo.stg_rpt_ventas_detallado
      WHERE Fecha_Emision >= '2026-03-01'
      GROUP BY Numero_SAP, Codigo_Producto, Fecha_Emision,
               [Cantidad KG/LT], [Valor_Venta_Dolares_Presentación]
      HAVING COUNT(*) > 1
    ) x
  `);
  console.log(`\n▸ Duplicados restantes: ${remaining.recordset[0].grupos_dup}`);

  await pool.close();
}

main().catch(e => { console.error(e); process.exit(1); });
