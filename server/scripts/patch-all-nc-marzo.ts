import { getDbPool } from '../src/config/database';

async function main() {
  const pool = await getDbPool();

  console.log('═══════════════════════════════════════════════════════════');
  console.log(' PATCH MASIVO NC MARZO 2026 — Corrección signo costo');
  console.log('═══════════════════════════════════════════════════════════\n');

  // 1. BEFORE — contar NC con bug
  const before = await pool.request().query(`
    SELECT
      COUNT(*) AS nc_con_bug,
      SUM(TRY_CAST([Costo Total _Presentación] AS DECIMAL(19,6))) AS costo_positivo_total,
      SUM(TRY_CAST(Ganancia AS DECIMAL(19,6))) AS ganancia_actual
    FROM dbo.stg_rpt_ventas_detallado
    WHERE Fecha_Emision BETWEEN '2026-03-01' AND '2026-03-31'
      AND TRY_CAST([Valor_Venta_Dolares_Presentación] AS DECIMAL(19,6)) < 0
      AND TRY_CAST([Costo Total _Presentación] AS DECIMAL(19,6)) > 0
  `);
  console.log('ANTES del patch:');
  console.table(before.recordset);

  // KPIs globales antes
  const kpiBefore = await pool.request().query(`
    SELECT
      COUNT(*) AS filas,
      SUM(TRY_CAST([Valor_Venta_Dolares_Presentación] AS DECIMAL(19,2))) AS venta,
      SUM(TRY_CAST([Costo Total _Presentación] AS DECIMAL(19,2))) AS costo,
      SUM(TRY_CAST(Ganancia AS DECIMAL(19,2))) AS ganancia
    FROM dbo.stg_rpt_ventas_detallado
    WHERE Fecha_Emision BETWEEN '2026-03-01' AND '2026-03-31'
  `);
  const k = kpiBefore.recordset[0];
  console.log(`\nKPIs marzo antes: Venta=${Number(k.venta).toFixed(2)}  Costo=${Number(k.costo).toFixed(2)}  Ganancia=${Number(k.ganancia).toFixed(2)}  Margen=${((k.ganancia/k.venta)*100).toFixed(2)}%`);

  // 2. UPDATE masivo
  console.log('\n▸ Ejecutando UPDATE masivo...\n');
  const upd = await pool.request().query(`
    BEGIN TRANSACTION;

    UPDATE dbo.stg_rpt_ventas_detallado
    SET
      [Costo Total _Presentación]     = -ABS(TRY_CAST([Costo Total _Presentación] AS DECIMAL(19,6))),
      [Costo Total USD (KG/LT)]       = -ABS(TRY_CAST([Costo Total USD (KG/LT)] AS DECIMAL(19,6))),
      Ganancia                        = TRY_CAST([Valor_Venta_Dolares_Presentación] AS DECIMAL(19,6))
                                        - (-ABS(TRY_CAST([Costo Total _Presentación] AS DECIMAL(19,6)))),
      [Ganancia (%)]                  = CASE
            WHEN TRY_CAST([Valor_Venta_Dolares_Presentación] AS DECIMAL(19,6)) = 0 THEN 0
            ELSE ROUND(
                (TRY_CAST([Valor_Venta_Dolares_Presentación] AS DECIMAL(19,6))
                  - (-ABS(TRY_CAST([Costo Total _Presentación] AS DECIMAL(19,6)))))
                 / TRY_CAST([Valor_Venta_Dolares_Presentación] AS DECIMAL(19,6)) * 100
                , 2)
          END
    WHERE Fecha_Emision BETWEEN '2026-03-01' AND '2026-03-31'
      AND TRY_CAST([Valor_Venta_Dolares_Presentación] AS DECIMAL(19,6)) < 0
      AND TRY_CAST([Costo Total _Presentación] AS DECIMAL(19,6)) > 0;

    COMMIT;

    SELECT @@ROWCOUNT AS filas_patcheadas;
  `);
  console.log(`✓ Filas patcheadas en transacción`);

  // 3. AFTER — verificar
  const after = await pool.request().query(`
    SELECT
      COUNT(*) AS nc_con_bug_restantes
    FROM dbo.stg_rpt_ventas_detallado
    WHERE Fecha_Emision BETWEEN '2026-03-01' AND '2026-03-31'
      AND TRY_CAST([Valor_Venta_Dolares_Presentación] AS DECIMAL(19,6)) < 0
      AND TRY_CAST([Costo Total _Presentación] AS DECIMAL(19,6)) > 0
  `);
  console.log('\nDESPUÉS del patch:');
  console.table(after.recordset);

  // KPIs después
  const kpiAfter = await pool.request().query(`
    SELECT
      COUNT(*) AS filas,
      SUM(TRY_CAST([Valor_Venta_Dolares_Presentación] AS DECIMAL(19,2))) AS venta,
      SUM(TRY_CAST([Costo Total _Presentación] AS DECIMAL(19,2))) AS costo,
      SUM(TRY_CAST(Ganancia AS DECIMAL(19,2))) AS ganancia
    FROM dbo.stg_rpt_ventas_detallado
    WHERE Fecha_Emision BETWEEN '2026-03-01' AND '2026-03-31'
  `);
  const k2 = kpiAfter.recordset[0];
  const margen2 = k2.venta > 0 ? (k2.ganancia / k2.venta * 100).toFixed(2) : '—';
  console.log('\n▸ KPIs MARZO 2026 — POST-PATCH vs FINANZAS');
  console.log(`   Filas:     ${k2.filas}           (Finanzas: 1,907)`);
  console.log(`   Venta:     ${Number(k2.venta).toLocaleString('en-US',{maximumFractionDigits:2})}    (Finanzas: 1,316,793.64)`);
  console.log(`   Costo:     ${Number(k2.costo).toLocaleString('en-US',{maximumFractionDigits:2})}    (Finanzas: 1,056,691.70)`);
  console.log(`   Ganancia:  ${Number(k2.ganancia).toLocaleString('en-US',{maximumFractionDigits:2})}    (Finanzas: 260,101.94)`);
  console.log(`   Margen:    ${margen2}%             (Finanzas: 19.75%)`);

  await pool.close();
}

main().catch(e => { console.error(e); process.exit(1); });
