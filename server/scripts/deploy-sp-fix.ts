import { getDbPool } from '../src/config/database';

const SP_BODY = `
ALTER PROCEDURE [dbo].[sp_fix_ventas_detallado_escala]
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @filas_dup_eliminadas INT = 0;
    DECLARE @filas_nc_corregidas  INT = 0;
    DECLARE @filas_decimal_corregidas INT = 0;

    BEGIN TRANSACTION;

    -- 1) DEDUPLICACIÓN
    ;WITH CTE AS (
        SELECT
            ROW_NUMBER() OVER (
                PARTITION BY
                    [Numero_SAP],
                    [Codigo_Producto],
                    [Fecha_Emision],
                    ROUND(TRY_CAST([Cantidad KG/LT] AS DECIMAL(19,2)), 2),
                    ROUND(TRY_CAST([Valor_Venta_Dolares_Presentación] AS DECIMAL(19,2)), 2)
                ORDER BY ABS(TRY_CAST([Costo Total _Presentación] AS DECIMAL(19,6))) DESC
            ) AS rn
        FROM [dbo].[stg_rpt_ventas_detallado]
    )
    DELETE FROM CTE WHERE rn > 1;
    SET @filas_dup_eliminadas = @@ROWCOUNT;

    -- 2) FIX SIGNO NC
    UPDATE [dbo].[stg_rpt_ventas_detallado]
    SET
        [Costo Total _Presentación] = -ABS(TRY_CAST([Costo Total _Presentación] AS DECIMAL(19,6))),
        [Costo Total USD (KG/LT)]   = -ABS(TRY_CAST([Costo Total USD (KG/LT)] AS DECIMAL(19,6))),
        Ganancia = TRY_CAST([Valor_Venta_Dolares_Presentación] AS DECIMAL(19,6))
                 - (-ABS(TRY_CAST([Costo Total _Presentación] AS DECIMAL(19,6)))),
        [Ganancia (%)] = CASE
            WHEN TRY_CAST([Valor_Venta_Dolares_Presentación] AS DECIMAL(19,6)) = 0 THEN 0
            ELSE ROUND(
                (TRY_CAST([Valor_Venta_Dolares_Presentación] AS DECIMAL(19,6))
                 - (-ABS(TRY_CAST([Costo Total _Presentación] AS DECIMAL(19,6)))))
                / TRY_CAST([Valor_Venta_Dolares_Presentación] AS DECIMAL(19,6)) * 100, 2)
        END
    WHERE ([Numero_SAP] LIKE '07-%'
           OR [Tipo Documento] LIKE '%CRÉDITO%'
           OR [Tipo Documento] LIKE '%CREDITO%')
      AND TRY_CAST([Valor_Venta_Dolares_Presentación] AS DECIMAL(19,6)) < 0
      AND TRY_CAST([Costo Total _Presentación] AS DECIMAL(19,6)) > 0;
    SET @filas_nc_corregidas = @@ROWCOUNT;

    -- 3) FIX DECIMALES
    UPDATE [dbo].[stg_rpt_ventas_detallado]
    SET
        [Cantidad KG/LT]                      = ROUND(TRY_CAST([Cantidad KG/LT] AS DECIMAL(19,4)), 2),
        [Costo Unitario USD (KG/LT)]          = ROUND(TRY_CAST([Costo Unitario USD (KG/LT)] AS DECIMAL(19,6)), 4),
        [Costo Total USD (KG/LT)]             = ROUND(TRY_CAST([Costo Total USD (KG/LT)] AS DECIMAL(19,6)), 2),
        [Precio Venta USD (KG/LT)]            = ROUND(TRY_CAST([Precio Venta USD (KG/LT)] AS DECIMAL(19,6)), 4),
        [Venta Total USD (KG/LT)]             = ROUND(TRY_CAST([Venta Total USD (KG/LT)] AS DECIMAL(19,6)), 2),
        [Costo_unitario_Presentación]         = ROUND(TRY_CAST([Costo_unitario_Presentación] AS DECIMAL(19,6)), 4),
        [Costo Total _Presentación]           = ROUND(TRY_CAST([Costo Total _Presentación] AS DECIMAL(19,6)), 2),
        [Valor_Venta_Dolares_Presentación]    = ROUND(TRY_CAST([Valor_Venta_Dolares_Presentación] AS DECIMAL(19,6)), 2),
        [Ganancia]                            = ROUND(TRY_CAST(Ganancia AS DECIMAL(19,6)), 2),
        [Ganancia (%)]                        = ROUND(TRY_CAST([Ganancia (%)] AS DECIMAL(19,6)), 2);
    SET @filas_decimal_corregidas = @@ROWCOUNT;

    COMMIT TRANSACTION;

    PRINT '═══════════════════════════════════════════════';
    PRINT 'Duplicados eliminados:  ' + CAST(@filas_dup_eliminadas AS VARCHAR);
    PRINT 'NC corregidas signo:    ' + CAST(@filas_nc_corregidas AS VARCHAR);
    PRINT 'Filas redondeadas:      ' + CAST(@filas_decimal_corregidas AS VARCHAR);
    PRINT '═══════════════════════════════════════════════';
END;
`;

async function main() {
  const pool = await getDbPool();

  console.log('▸ 1. Aplicando ALTER PROCEDURE...');
  await pool.request().batch(SP_BODY);
  console.log('   ✓ SP actualizado\n');

  console.log('▸ 2. Estado ANTES de ejecutar SP');
  const before = await pool.request().query(`
    SELECT
      COUNT(*) AS filas,
      SUM(TRY_CAST([Valor_Venta_Dolares_Presentación] AS DECIMAL(19,2))) AS venta,
      SUM(TRY_CAST([Costo Total _Presentación] AS DECIMAL(19,2))) AS costo,
      SUM(TRY_CAST(Ganancia AS DECIMAL(19,2))) AS ganancia
    FROM dbo.stg_rpt_ventas_detallado
    WHERE Fecha_Emision BETWEEN '2026-03-01' AND '2026-03-31'
  `);
  console.table(before.recordset);

  console.log('\n▸ 3. Ejecutando EXEC sp_fix_ventas_detallado_escala...');
  await pool.request().query('EXEC dbo.sp_fix_ventas_detallado_escala');
  console.log('   ✓ SP ejecutado\n');

  console.log('▸ 4. Estado DESPUÉS');
  const after = await pool.request().query(`
    SELECT
      COUNT(*) AS filas,
      SUM(TRY_CAST([Valor_Venta_Dolares_Presentación] AS DECIMAL(19,2))) AS venta,
      SUM(TRY_CAST([Costo Total _Presentación] AS DECIMAL(19,2))) AS costo,
      SUM(TRY_CAST(Ganancia AS DECIMAL(19,2))) AS ganancia
    FROM dbo.stg_rpt_ventas_detallado
    WHERE Fecha_Emision BETWEEN '2026-03-01' AND '2026-03-31'
  `);
  console.table(after.recordset);

  // Verificar que no quedan duplicados ni NC con bug
  const dup = await pool.request().query(`
    SELECT COUNT(*) AS grupos_dup FROM (
      SELECT Numero_SAP, Codigo_Producto, Fecha_Emision,
             ROUND(TRY_CAST([Cantidad KG/LT] AS DECIMAL(19,2)), 2) AS c,
             ROUND(TRY_CAST([Valor_Venta_Dolares_Presentación] AS DECIMAL(19,2)), 2) AS v
      FROM dbo.stg_rpt_ventas_detallado
      WHERE Fecha_Emision >= '2026-03-01'
      GROUP BY Numero_SAP, Codigo_Producto, Fecha_Emision,
               ROUND(TRY_CAST([Cantidad KG/LT] AS DECIMAL(19,2)), 2),
               ROUND(TRY_CAST([Valor_Venta_Dolares_Presentación] AS DECIMAL(19,2)), 2)
      HAVING COUNT(*) > 1
    ) x
  `);
  console.log(`\n▸ Duplicados restantes: ${dup.recordset[0].grupos_dup}`);

  const ncBug = await pool.request().query(`
    SELECT COUNT(*) AS nc_bug
    FROM dbo.stg_rpt_ventas_detallado
    WHERE Fecha_Emision >= '2026-03-01'
      AND TRY_CAST([Valor_Venta_Dolares_Presentación] AS DECIMAL(19,6)) < 0
      AND TRY_CAST([Costo Total _Presentación] AS DECIMAL(19,6)) > 0
  `);
  console.log(`▸ NC con bug signo restantes: ${ncBug.recordset[0].nc_bug}`);

  // KPIs finales vs Finanzas
  const k = after.recordset[0];
  const margen = k.venta > 0 ? (k.ganancia / k.venta * 100).toFixed(2) : '—';
  console.log('\n▸ KPIs MARZO vs FINANZAS');
  console.log(`   Filas:     ${k.filas}       (Finanzas: 1,907)`);
  console.log(`   Venta:     ${Number(k.venta).toLocaleString('en-US',{maximumFractionDigits:2})}  (Finanzas: 1,316,793.64)`);
  console.log(`   Costo:     ${Number(k.costo).toLocaleString('en-US',{maximumFractionDigits:2})}  (Finanzas: 1,056,691.70)`);
  console.log(`   Ganancia:  ${Number(k.ganancia).toLocaleString('en-US',{maximumFractionDigits:2})}  (Finanzas: 260,101.94)`);
  console.log(`   Margen:    ${margen}%  (Finanzas: 19.75%)`);

  await pool.close();
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
