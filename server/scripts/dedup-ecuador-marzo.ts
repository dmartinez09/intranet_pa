/**
 * DEDUP CONTROLADO — Solo Ecuador marzo 2026 BACB000008
 * Usa transacción con verificación PRE/POST. Aborta si los totales no calzan.
 */
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env'), override: true });

async function main() {
  const { getDbPool, closeDb } = await import('../src/config/database');
  const pool = await getDbPool();

  // Snapshot PRE
  console.log('▸ ESTADO PRE:\n');
  const preEcuador = await pool.request().query(`
    SELECT COUNT(*) AS filas,
           SUM(TRY_CAST([Valor_Venta_Dolares_Presentacion] AS DECIMAL(19,2))) AS venta,
           SUM(TRY_CAST([Costo_Total_Presentacion] AS DECIMAL(19,2))) AS costo
    FROM dbo.stg_rpt_ventas_detallado
    WHERE Pais='Ecuador' AND Fecha_Emision BETWEEN '2026-03-01' AND '2026-03-31'
  `);
  console.log('  Ecuador marzo:', preEcuador.recordset[0]);

  const preTotal = await pool.request().query(`
    SELECT COUNT(*) AS filas,
           SUM(TRY_CAST([Valor_Venta_Dolares_Presentacion] AS DECIMAL(19,2))) AS venta,
           SUM(TRY_CAST([Costo_Total_Presentacion] AS DECIMAL(19,2))) AS costo
    FROM dbo.stg_rpt_ventas_detallado
    WHERE Fecha_Emision BETWEEN '2026-03-01' AND '2026-03-31'
  `);
  console.log('  TODOS los países marzo:', preTotal.recordset[0]);

  // Conteo por key (verificar que TODOS los keys Ecuador marzo BACB000008 tienen exactamente 2 filas)
  const dupCheck = await pool.request().query(`
    SELECT Numero_SAP, Codigo_Producto, COUNT(*) AS filas
    FROM dbo.stg_rpt_ventas_detallado
    WHERE Pais='Ecuador' AND Fecha_Emision BETWEEN '2026-03-01' AND '2026-03-31'
    GROUP BY Numero_SAP, Codigo_Producto
    HAVING COUNT(*) > 1
    ORDER BY 1
  `);
  console.log(`\n  Keys con duplicados (>1 fila): ${dupCheck.recordset.length}`);
  dupCheck.recordset.forEach((x: any) => console.log(`    ${x.Numero_SAP} / ${x.Codigo_Producto}: ${x.filas} filas`));

  if (dupCheck.recordset.length === 0) {
    console.log('\n✓ No hay duplicados — nada que hacer.');
    await closeDb();
    return;
  }

  // EJECUCIÓN con transacción
  console.log('\n▸ EJECUTANDO DEDUP en transacción...');
  const tx = pool.transaction();
  await tx.begin();
  try {
    const r = await tx.request().query(`
      WITH dups AS (
        SELECT
          ROW_NUMBER() OVER (
            PARTITION BY Numero_SAP, Codigo_Producto, Tipo_Documento, Fecha_Emision, Pais,
                         TRY_CAST([Valor_Venta_Dolares_Presentacion] AS DECIMAL(19,2))
            ORDER BY (SELECT NULL)
          ) AS rn
        FROM dbo.stg_rpt_ventas_detallado
        WHERE Pais='Ecuador'
          AND Fecha_Emision BETWEEN '2026-03-01' AND '2026-03-31'
      )
      DELETE FROM dups WHERE rn > 1;
      SELECT @@ROWCOUNT AS deleted;
    `);
    const deleted = r.recordset[0]?.deleted ?? 0;
    console.log(`  Filas eliminadas: ${deleted}`);

    // Validar POST dentro de la TX
    const postEcuador = await tx.request().query(`
      SELECT COUNT(*) AS filas,
             SUM(TRY_CAST([Valor_Venta_Dolares_Presentacion] AS DECIMAL(19,2))) AS venta,
             SUM(TRY_CAST([Costo_Total_Presentacion] AS DECIMAL(19,2))) AS costo
      FROM dbo.stg_rpt_ventas_detallado
      WHERE Pais='Ecuador' AND Fecha_Emision BETWEEN '2026-03-01' AND '2026-03-31'
    `);
    const postTotal = await tx.request().query(`
      SELECT COUNT(*) AS filas,
             SUM(TRY_CAST([Valor_Venta_Dolares_Presentacion] AS DECIMAL(19,2))) AS venta,
             SUM(TRY_CAST([Costo_Total_Presentacion] AS DECIMAL(19,2))) AS costo
      FROM dbo.stg_rpt_ventas_detallado
      WHERE Fecha_Emision BETWEEN '2026-03-01' AND '2026-03-31'
    `);
    console.log('\n▸ ESTADO POST (dentro de TX, antes de COMMIT):');
    console.log('  Ecuador marzo:', postEcuador.recordset[0]);
    console.log('  TODOS los países marzo:', postTotal.recordset[0]);

    // Verificación: aún debe haber 5 keys Ecuador (no 0, no más)
    const remainKeys = await tx.request().query(`
      SELECT COUNT(DISTINCT Numero_SAP + '|' + Codigo_Producto) AS keys_distintos,
             COUNT(*) AS filas
      FROM dbo.stg_rpt_ventas_detallado
      WHERE Pais='Ecuador' AND Fecha_Emision BETWEEN '2026-03-01' AND '2026-03-31'
    `);
    console.log('  Keys distintos Ecuador marzo:', remainKeys.recordset[0]);

    const expectedTotalVenta = 1316793.64 + 600;     // 1,317,393.64
    const actualVenta = Number(postTotal.recordset[0].venta);
    console.log(`\n  Esperado venta total: ${expectedTotalVenta.toFixed(2)}`);
    console.log(`  Actual venta total:   ${actualVenta.toFixed(2)}`);
    console.log(`  Δ: ${(actualVenta - expectedTotalVenta).toFixed(2)}`);

    if (Math.abs(actualVenta - expectedTotalVenta) > 0.5) {
      throw new Error(`Δ venta muy grande: ${actualVenta - expectedTotalVenta}. ROLLBACK por seguridad.`);
    }

    if (deleted !== 5) {
      throw new Error(`Esperaba eliminar 5 filas, se eliminaron ${deleted}. ROLLBACK por seguridad.`);
    }

    await tx.commit();
    console.log('\n✓ COMMIT exitoso');
  } catch (err) {
    await tx.rollback();
    console.error('\n✗ ROLLBACK:', (err as any).message);
    throw err;
  }

  await closeDb();
}

main().catch(e => { console.error(e); process.exit(1); });
