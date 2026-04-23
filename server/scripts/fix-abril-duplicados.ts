// ============================================================
// CORRECCIÓN DUPLICADOS ABRIL 2026 — con transacción + validaciones
// Mismo patrón que fix-febrero-duplicados.ts pero para MONTH=4
// ============================================================

import { getDbPool, closeDb } from '../src/config/database';

async function main() {
  const pool = await getDbPool();

  console.log('=========================================================');
  console.log('  FIX DUPLICADOS ABRIL 2026 — modo TRANSACCIÓN');
  console.log('=========================================================\n');

  // 1. Verificar tabla
  const tipoRes = await pool.request().query(`
    SELECT TABLE_TYPE FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_NAME = 'stg_rpt_ventas_detallado'
  `);
  if (tipoRes.recordset[0]?.TABLE_TYPE !== 'BASE TABLE') {
    console.log('⚠ No es BASE TABLE. Abortado.');
    await closeDb();
    return;
  }

  // 2. Estado inicial
  const before = await pool.request().query(`
    SELECT COUNT(*) AS filas,
           COUNT(DISTINCT CAST(DocEntry AS NVARCHAR) + '|' + CAST(LineNum AS NVARCHAR) + '|' + ObjType) AS unicos,
           SUM(CAST(Valor_Venta_Dolares_Presentacion AS DECIMAL(18,2))) AS venta
    FROM dbo.stg_rpt_ventas_detallado
    WHERE Pais = 'Peru' AND YEAR(Fecha_Emision) = 2026 AND MONTH(Fecha_Emision) = 4
  `);
  const b = before.recordset[0];
  const expectedExtras = b.filas - b.unicos;
  console.log(`Estado inicial abril 2026:`);
  console.log(`  Filas totales : ${b.filas}`);
  console.log(`  Únicos        : ${b.unicos}`);
  console.log(`  Venta (infl.) : $${Math.round(Number(b.venta || 0)).toLocaleString('es-PE')}`);
  console.log(`  A eliminar    : ${expectedExtras}`);

  if (expectedExtras === 0) {
    console.log('\n✓ No hay nada que eliminar. Salida sin cambios.');
    await closeDb();
    return;
  }

  // 3. Distribución de repeticiones (para entender si es 2x, 3x, mixto)
  const distrib = await pool.request().query(`
    SELECT repes, COUNT(*) AS combos
    FROM (
      SELECT DocEntry, LineNum, ObjType, COUNT(*) AS repes
      FROM dbo.stg_rpt_ventas_detallado
      WHERE Pais = 'Peru' AND YEAR(Fecha_Emision) = 2026 AND MONTH(Fecha_Emision) = 4
      GROUP BY DocEntry, LineNum, ObjType
    ) x
    GROUP BY repes
    ORDER BY repes
  `);
  console.log('\nDistribución de repeticiones:');
  console.table(distrib.recordset);

  // 4. DELETE con transacción
  const tx = pool.transaction();
  await tx.begin();
  console.log('→ Transacción iniciada');

  try {
    const deleteRes = await tx.request().query(`
      WITH dup AS (
        SELECT
          ROW_NUMBER() OVER (
            PARTITION BY DocEntry, LineNum, ObjType
            ORDER BY (SELECT NULL)
          ) AS rn
        FROM dbo.stg_rpt_ventas_detallado
        WHERE Pais = 'Peru'
          AND YEAR(Fecha_Emision) = 2026
          AND MONTH(Fecha_Emision) = 4
      )
      DELETE FROM dup WHERE rn > 1;
    `);
    const deleted = (deleteRes as any).rowsAffected?.[0] ?? 0;
    console.log(`  Filas eliminadas: ${deleted}`);

    // 5. Verificar
    const after = await tx.request().query(`
      SELECT COUNT(*) AS filas,
             COUNT(DISTINCT CAST(DocEntry AS NVARCHAR) + '|' + CAST(LineNum AS NVARCHAR) + '|' + ObjType) AS unicos,
             SUM(CAST(Valor_Venta_Dolares_Presentacion AS DECIMAL(18,2))) AS venta
      FROM dbo.stg_rpt_ventas_detallado
      WHERE Pais='Peru' AND YEAR(Fecha_Emision)=2026 AND MONTH(Fecha_Emision)=4
    `);
    const a = after.recordset[0];
    console.log(`\nEstado post-fix abril 2026:`);
    console.log(`  Filas totales : ${a.filas}`);
    console.log(`  Únicos        : ${a.unicos}`);
    console.log(`  Venta (real)  : $${Math.round(Number(a.venta || 0)).toLocaleString('es-PE')}`);

    if (a.filas !== a.unicos) {
      throw new Error(`Inconsistencia: filas (${a.filas}) != unicos (${a.unicos}) después del DELETE`);
    }
    if (deleted !== expectedExtras) {
      console.warn(`⚠ Eliminadas ${deleted} filas pero se esperaban ${expectedExtras}.`);
    }

    await tx.commit();
    console.log('\n✓ TRANSACCIÓN CONFIRMADA (commit)');
  } catch (err) {
    await tx.rollback();
    console.error('\n✗ ERROR — ROLLBACK ejecutado.');
    throw err;
  }

  await closeDb();
}

main().catch(e => { console.error(e); process.exit(1); });
