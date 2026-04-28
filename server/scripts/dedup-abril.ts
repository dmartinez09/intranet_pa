/**
 * DEDUP CONTROLADO — Abril 2026 (todos países, todos productos)
 * Usa ROW_NUMBER() PARTITION BY (todas las columnas key) y borra rn > 1.
 * Sólo elimina copias IDÉNTICAS (mismas todas columnas físicas).
 */
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env'), override: true });

async function main() {
  const { getDbPool, closeDb } = await import('../src/config/database');
  const pool = await getDbPool();

  // PRE
  console.log('▸ ESTADO PRE:\n');
  const pre = await pool.request().query(`
    SELECT COUNT(*) AS filas,
           COUNT(DISTINCT Numero_SAP + '|' + Codigo_Producto) AS keys,
           SUM(TRY_CAST([Valor_Venta_Dolares_Presentacion] AS DECIMAL(19,2))) AS venta,
           SUM(TRY_CAST([Costo_Total_Presentacion] AS DECIMAL(19,2))) AS costo
    FROM dbo.stg_rpt_ventas_detallado
    WHERE Fecha_Emision BETWEEN '2026-04-01' AND '2026-04-30'
  `);
  console.log('  Abril (todos países):', pre.recordset[0]);

  // Cantidad esperada de borrados
  const expected = await pool.request().query(`
    SELECT SUM(copies - 1) AS filas_extra
    FROM (
      SELECT COUNT(*) AS copies
      FROM dbo.stg_rpt_ventas_detallado
      WHERE Fecha_Emision BETWEEN '2026-04-01' AND '2026-04-30'
      GROUP BY Numero_SAP, Codigo_Producto, Pais, Tipo_Documento,
               CONVERT(VARCHAR(10), Fecha_Emision, 23),
               TRY_CAST([Valor_Venta_Dolares_Presentacion] AS DECIMAL(19,2)),
               TRY_CAST([Costo_Total_Presentacion] AS DECIMAL(19,2)),
               TRY_CAST([Cantidad_KG/LT] AS DECIMAL(19,4))
      HAVING COUNT(*) > 1
    ) g
  `);
  const expDelete = expected.recordset[0]?.filas_extra ?? 0;
  console.log(`  Filas extra esperadas a eliminar: ${expDelete}`);

  if (expDelete === 0) {
    console.log('\n✓ No hay duplicados — nada que hacer.');
    await closeDb();
    return;
  }

  // EJECUCIÓN
  console.log('\n▸ Ejecutando DEDUP en transacción...');
  const tx = pool.transaction();
  await tx.begin();
  try {
    const r = await tx.request().query(`
      WITH dups AS (
        SELECT
          ROW_NUMBER() OVER (
            PARTITION BY Numero_SAP, Codigo_Producto, Pais, Tipo_Documento,
                         CONVERT(VARCHAR(10), Fecha_Emision, 23),
                         TRY_CAST([Valor_Venta_Dolares_Presentacion] AS DECIMAL(19,2)),
                         TRY_CAST([Costo_Total_Presentacion] AS DECIMAL(19,2)),
                         TRY_CAST([Cantidad_KG/LT] AS DECIMAL(19,4))
            ORDER BY (SELECT NULL)
          ) AS rn
        FROM dbo.stg_rpt_ventas_detallado
        WHERE Fecha_Emision BETWEEN '2026-04-01' AND '2026-04-30'
      )
      DELETE FROM dups WHERE rn > 1;
      SELECT @@ROWCOUNT AS deleted;
    `);
    const deleted = r.recordset[0]?.deleted ?? 0;
    console.log(`  Filas eliminadas: ${deleted}`);

    // POST
    const post = await tx.request().query(`
      SELECT COUNT(*) AS filas,
             COUNT(DISTINCT Numero_SAP + '|' + Codigo_Producto) AS keys,
             SUM(TRY_CAST([Valor_Venta_Dolares_Presentacion] AS DECIMAL(19,2))) AS venta,
             SUM(TRY_CAST([Costo_Total_Presentacion] AS DECIMAL(19,2))) AS costo
      FROM dbo.stg_rpt_ventas_detallado
      WHERE Fecha_Emision BETWEEN '2026-04-01' AND '2026-04-30'
    `);
    console.log('\n▸ ESTADO POST (en TX, antes de COMMIT):');
    console.log('  Abril (todos países):', post.recordset[0]);

    // Verificar que ya no haya duplicados
    const remaining = await tx.request().query(`
      SELECT COUNT(*) AS grupos
      FROM (
        SELECT COUNT(*) AS copies
        FROM dbo.stg_rpt_ventas_detallado
        WHERE Fecha_Emision BETWEEN '2026-04-01' AND '2026-04-30'
        GROUP BY Numero_SAP, Codigo_Producto, Pais, Tipo_Documento,
                 CONVERT(VARCHAR(10), Fecha_Emision, 23),
                 TRY_CAST([Valor_Venta_Dolares_Presentacion] AS DECIMAL(19,2)),
                 TRY_CAST([Costo_Total_Presentacion] AS DECIMAL(19,2)),
                 TRY_CAST([Cantidad_KG/LT] AS DECIMAL(19,4))
        HAVING COUNT(*) > 1
      ) g
    `);
    console.log(`  Grupos duplicados restantes: ${remaining.recordset[0].grupos}`);

    if (remaining.recordset[0].grupos !== 0) {
      throw new Error(`Aún quedan ${remaining.recordset[0].grupos} grupos duplicados. ROLLBACK.`);
    }

    if (Math.abs(deleted - expDelete) > 0) {
      console.log(`  ⚠ Diferencia entre esperado (${expDelete}) y real (${deleted})`);
    }

    // Verificar venta no se redujo más de lo esperado (delta debe ser ~0 si los duplicados eran exactos)
    const dvVenta = Number(pre.recordset[0].venta) - Number(post.recordset[0].venta);
    const dvCosto = Number(pre.recordset[0].costo) - Number(post.recordset[0].costo);
    console.log(`  Δ Venta: -${dvVenta.toFixed(2)}  Δ Costo: -${dvCosto.toFixed(2)}`);

    await tx.commit();
    console.log('\n✓ COMMIT exitoso');

    // Sumario final
    console.log('\n========================================');
    console.log('  RESULTADO FINAL ABRIL 2026');
    console.log('========================================');
    console.log(`  Filas:    ${pre.recordset[0].filas} → ${post.recordset[0].filas}  (-${deleted})`);
    console.log(`  Venta:    ${Number(pre.recordset[0].venta).toLocaleString('es-PE',{maximumFractionDigits:2})} → ${Number(post.recordset[0].venta).toLocaleString('es-PE',{maximumFractionDigits:2})}`);
    console.log(`  Costo:    ${Number(pre.recordset[0].costo).toLocaleString('es-PE',{maximumFractionDigits:2})} → ${Number(post.recordset[0].costo).toLocaleString('es-PE',{maximumFractionDigits:2})}`);
  } catch (err) {
    await tx.rollback();
    console.error('\n✗ ROLLBACK:', (err as any).message);
    throw err;
  }

  await closeDb();
}

main().catch(e => { console.error(e); process.exit(1); });
