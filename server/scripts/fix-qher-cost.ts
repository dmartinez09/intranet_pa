/**
 * FIX SEGURO — corrige el costo total de las 2 líneas
 * 01-F001-00039367 / QHER000001 (FACTURA)
 * con prorrateo por cantidad (costo_unit × cantidad).
 * Idempotente · TX con rollback automático si los totales no calzan.
 */
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env'), override: true });

const TARGET_NUM = '01-F001-00039367';
const TARGET_COD = 'QHER000001';
const EXPECTED_TOTAL_COST = 3178.35;  // = Excel Finanzas

async function main() {
  const { getDbPool, closeDb } = await import('../src/config/database');
  const pool = await getDbPool();

  // PRE
  console.log('▸ ESTADO PRE:\n');
  const pre = await pool.request().query(`
    SELECT
      TRY_CAST([Cantidad_KG/LT] AS DECIMAL(19,4)) AS cantidad,
      TRY_CAST([Costo_unitario_Presentacion] AS DECIMAL(19,4)) AS costo_unit,
      TRY_CAST([Costo_Total_Presentacion] AS DECIMAL(19,2)) AS costo_total,
      TRY_CAST([Valor_Venta_Dolares_Presentacion] AS DECIMAL(19,2)) AS venta
    FROM dbo.stg_rpt_ventas_detallado
    WHERE Numero_SAP = '${TARGET_NUM}' AND Codigo_Producto = '${TARGET_COD}'
    ORDER BY TRY_CAST([Cantidad_KG/LT] AS DECIMAL(19,4))
  `);
  console.table(pre.recordset);
  const sumPre = pre.recordset.reduce((a: number, x: any) => a + Number(x.costo_total || 0), 0);
  console.log(`  Costo total ACTUAL: ${sumPre.toFixed(2)}  (esperado tras fix: ${EXPECTED_TOTAL_COST})`);

  // Total marzo PRE
  const totalMarzoPre = await pool.request().query(`
    SELECT SUM(TRY_CAST([Costo_Total_Presentacion] AS DECIMAL(19,2))) AS costo
    FROM dbo.stg_rpt_ventas_detallado
    WHERE Fecha_Emision BETWEEN '2026-03-01' AND '2026-03-31'
  `);
  const costoMarzoPre = Number(totalMarzoPre.recordset[0].costo);
  console.log(`\n  Costo total marzo (todos países) PRE: ${costoMarzoPre.toFixed(2)}`);

  // Verificación: ambos rows tienen mismo costo_unit ($3.15) y costo_total = $3,178.35
  if (pre.recordset.length !== 2) {
    throw new Error(`Esperaba 2 filas, encontré ${pre.recordset.length}. Aborto.`);
  }
  const c0 = Number(pre.recordset[0].costo_total);
  const c1 = Number(pre.recordset[1].costo_total);
  const cu0 = Number(pre.recordset[0].costo_unit);
  const cu1 = Number(pre.recordset[1].costo_unit);
  if (Math.abs(c0 - c1) > 0.01 || Math.abs(cu0 - cu1) > 0.01) {
    throw new Error(`Filas no comparables (costos distintos). Aborto.`);
  }
  console.log(`\n  ✓ Validación: ambas filas tienen costo_unit=${cu0.toFixed(4)} y costo_total=${c0.toFixed(2)} (idénticos — bug del SP)`);

  // EJECUCIÓN
  console.log('\n▸ Ejecutando UPDATE en transacción...');
  const tx = pool.transaction();
  await tx.begin();
  try {
    // Update: costo_total = costo_unit × cantidad (prorrateo correcto)
    const upd = await tx.request().query(`
      UPDATE dbo.stg_rpt_ventas_detallado
      SET [Costo_Total_Presentacion] =
            TRY_CAST([Costo_unitario_Presentacion] AS DECIMAL(19,4)) *
            TRY_CAST([Cantidad_KG/LT] AS DECIMAL(19,4))
      WHERE Numero_SAP = '${TARGET_NUM}' AND Codigo_Producto = '${TARGET_COD}';
      SELECT @@ROWCOUNT AS updated;
    `);
    console.log(`  Filas actualizadas: ${upd.recordset[0]?.updated}`);

    // POST dentro de TX
    const post = await tx.request().query(`
      SELECT
        TRY_CAST([Cantidad_KG/LT] AS DECIMAL(19,4)) AS cantidad,
        TRY_CAST([Costo_unitario_Presentacion] AS DECIMAL(19,4)) AS costo_unit,
        TRY_CAST([Costo_Total_Presentacion] AS DECIMAL(19,2)) AS costo_total
      FROM dbo.stg_rpt_ventas_detallado
      WHERE Numero_SAP = '${TARGET_NUM}' AND Codigo_Producto = '${TARGET_COD}'
      ORDER BY TRY_CAST([Cantidad_KG/LT] AS DECIMAL(19,4))
    `);
    console.log('\n▸ ESTADO POST (en TX):');
    console.table(post.recordset);
    const sumPost = post.recordset.reduce((a: number, x: any) => a + Number(x.costo_total || 0), 0);
    console.log(`  Costo total nuevo: ${sumPost.toFixed(2)}  (esperado: ${EXPECTED_TOTAL_COST})`);

    if (Math.abs(sumPost - EXPECTED_TOTAL_COST) > 0.5) {
      throw new Error(`Costo total post-update no calza (${sumPost} vs ${EXPECTED_TOTAL_COST}). ROLLBACK.`);
    }

    const totalMarzoPost = await tx.request().query(`
      SELECT SUM(TRY_CAST([Costo_Total_Presentacion] AS DECIMAL(19,2))) AS costo
      FROM dbo.stg_rpt_ventas_detallado
      WHERE Fecha_Emision BETWEEN '2026-03-01' AND '2026-03-31'
    `);
    const costoMarzoPost = Number(totalMarzoPost.recordset[0].costo);
    console.log(`\n  Costo total marzo POST: ${costoMarzoPost.toFixed(2)}`);
    console.log(`  Δ vs Finanzas (1057286.68): ${(costoMarzoPost - 1057286.68).toFixed(2)}`);

    // Tolerancia $50 (esperamos delta cercano a 0)
    if (Math.abs(costoMarzoPost - 1057286.68) > 50) {
      throw new Error(`Costo marzo total fuera de rango. ROLLBACK.`);
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
