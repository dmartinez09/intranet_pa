/**
 * FIX SEGURO — corrige costo de las 5 filas Ecuador BACB000008 con valores Excel/Finanzas
 * TX con validación PRE/POST.
 */
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env'), override: true });

const FIX = [
  { num: '01-F001-00039227', costoTotal:  587.21, costoUnit:  48.93 },  // 587.21 / 12
  { num: '01-F001-00039277', costoTotal:  557.40, costoUnit:  46.45 },  // 557.40 / 12
  { num: '01-F001-00039541', costoTotal:  585.18, costoUnit:  48.77 },  // 585.18 / 12
  { num: '07-FC01-00001922', costoTotal: -559.66, costoUnit: -46.64 },  // -559.66 / 12
  { num: '07-FC01-00001925', costoTotal: -575.16, costoUnit: -47.93 },  // ya está OK
];

async function main() {
  const { getDbPool, closeDb } = await import('../src/config/database');
  const pool = await getDbPool();

  // PRE
  console.log('▸ ESTADO PRE:');
  const pre = await pool.request().query(`
    SELECT Numero_SAP, Codigo_Producto,
      TRY_CAST([Costo_unitario_Presentacion] AS DECIMAL(19,4)) AS costo_unit,
      TRY_CAST([Costo_Total_Presentacion] AS DECIMAL(19,2)) AS costo_total,
      TRY_CAST([Cantidad_KG/LT] AS DECIMAL(19,4)) AS cantidad
    FROM dbo.stg_rpt_ventas_detallado
    WHERE Codigo_Producto = 'BACB000008'
      AND Pais = 'Ecuador'
      AND Fecha_Emision BETWEEN '2026-03-01' AND '2026-03-31'
    ORDER BY Numero_SAP
  `);
  console.table(pre.recordset);

  const totalCostoMarzoPre = await pool.request().query(`
    SELECT SUM(TRY_CAST([Costo_Total_Presentacion] AS DECIMAL(19,2))) AS costo
    FROM dbo.stg_rpt_ventas_detallado
    WHERE Fecha_Emision BETWEEN '2026-03-01' AND '2026-03-31'
  `);
  console.log(`  Costo total marzo PRE: ${Number(totalCostoMarzoPre.recordset[0].costo).toFixed(2)}`);

  // EJECUCIÓN
  console.log('\n▸ Ejecutando 5 UPDATEs en transacción...');
  const tx = pool.transaction();
  await tx.begin();
  try {
    let totalAffected = 0;
    for (const f of FIX) {
      const r = await tx.request()
        .input('n', f.num)
        .input('ct', f.costoTotal)
        .input('cu', f.costoUnit)
        .query(`
          UPDATE dbo.stg_rpt_ventas_detallado
          SET [Costo_Total_Presentacion] = @ct,
              [Costo_unitario_Presentacion] = @cu
          WHERE Numero_SAP = @n
            AND Codigo_Producto = 'BACB000008'
            AND Pais = 'Ecuador'
            AND Fecha_Emision BETWEEN '2026-03-01' AND '2026-03-31';
          SELECT @@ROWCOUNT AS n;
        `);
      const n = r.recordset[0]?.n ?? 0;
      console.log(`  ${f.num}: ${n} fila(s) actualizada(s) (costo_total=${f.costoTotal}, costo_unit=${f.costoUnit})`);
      totalAffected += n;
    }
    if (totalAffected !== 5) {
      throw new Error(`Esperaba 5 filas afectadas, fueron ${totalAffected}. ROLLBACK.`);
    }

    // POST
    const totalCostoMarzoPost = await tx.request().query(`
      SELECT SUM(TRY_CAST([Costo_Total_Presentacion] AS DECIMAL(19,2))) AS costo,
             SUM(TRY_CAST([Valor_Venta_Dolares_Presentacion] AS DECIMAL(19,2))) AS venta
      FROM dbo.stg_rpt_ventas_detallado
      WHERE Fecha_Emision BETWEEN '2026-03-01' AND '2026-03-31'
    `);
    const cPost = Number(totalCostoMarzoPost.recordset[0].costo);
    const vPost = Number(totalCostoMarzoPost.recordset[0].venta);
    console.log(`\n  Costo total marzo POST: ${cPost.toFixed(2)}  (Finanzas: 1057286.68 · Δ ${(cPost - 1057286.68).toFixed(2)})`);
    console.log(`  Venta total marzo POST: ${vPost.toFixed(2)}  (Finanzas: 1317393.64 · Δ ${(vPost - 1317393.64).toFixed(2)})`);

    if (Math.abs(cPost - 1057286.68) > 1) {
      throw new Error(`Costo total fuera de tolerancia (Δ=${(cPost - 1057286.68).toFixed(2)}). ROLLBACK.`);
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
