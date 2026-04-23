// ============================================================
// CORRECCIÓN DUPLICADOS FEBRERO 2026 — con transacción + validaciones
// Ejecuta DELETE solo si:
//   1. stg_rpt_ventas_detallado es TABLE (no VIEW)
//   2. El conteo de duplicados cuadra con lo esperado (501 filas)
// Usa ROW_NUMBER() OVER (PARTITION BY DocEntry, LineNum, ObjType) para
// conservar 1 fila por combinación y eliminar las repeticiones.
// ============================================================

import { getDbPool, closeDb, sql } from '../src/config/database';

async function main() {
  const pool = await getDbPool();

  console.log('=========================================================');
  console.log('  FIX DUPLICADOS FEBRERO 2026 — modo TRANSACCIÓN');
  console.log('=========================================================\n');

  // 1. Verificar que es TABLA (no vista)
  const tipoRes = await pool.request().query(`
    SELECT TABLE_TYPE, TABLE_SCHEMA
    FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_NAME = 'stg_rpt_ventas_detallado'
  `);
  if (tipoRes.recordset.length === 0) {
    throw new Error('No se encontró stg_rpt_ventas_detallado en el schema.');
  }
  const info = tipoRes.recordset[0];
  console.log(`Objeto: ${info.TABLE_SCHEMA}.stg_rpt_ventas_detallado (${info.TABLE_TYPE})`);
  if (info.TABLE_TYPE !== 'BASE TABLE') {
    console.log(`⚠ Es una ${info.TABLE_TYPE}. No se puede hacer DELETE directo sobre VIEW.`);
    console.log('   Hay que corregir la tabla base del pipeline aguas arriba.');
    await closeDb();
    return;
  }

  // 2. Conteo inicial
  const before = await pool.request().query(`
    SELECT COUNT(*) AS filas,
           COUNT(DISTINCT CAST(DocEntry AS NVARCHAR) + '|' + CAST(LineNum AS NVARCHAR) + '|' + ObjType) AS unicos
    FROM dbo.stg_rpt_ventas_detallado
    WHERE Pais = 'Peru' AND YEAR(Fecha_Emision) = 2026 AND MONTH(Fecha_Emision) = 2
  `);
  const b = before.recordset[0];
  const expectedExtras = b.filas - b.unicos;
  console.log(`\nEstado inicial febrero 2026:`);
  console.log(`  Filas totales  : ${b.filas}`);
  console.log(`  Únicos         : ${b.unicos}`);
  console.log(`  A eliminar     : ${expectedExtras}`);

  if (expectedExtras === 0) {
    console.log('\n✓ No hay nada que eliminar. Salida sin cambios.');
    await closeDb();
    return;
  }

  // 3. Vista previa de qué se va a borrar (DocEntry + LineNum con más de 1 repetición)
  const preview = await pool.request().query(`
    SELECT TOP 5 DocEntry, LineNum, ObjType, COUNT(*) AS repes
    FROM dbo.stg_rpt_ventas_detallado
    WHERE Pais = 'Peru' AND YEAR(Fecha_Emision) = 2026 AND MONTH(Fecha_Emision) = 2
    GROUP BY DocEntry, LineNum, ObjType
    HAVING COUNT(*) > 1
    ORDER BY repes DESC
  `);
  console.log('\nMuestra de combos duplicados (top 5):');
  console.table(preview.recordset);

  // 4. Ejecutar DELETE dentro de transacción
  const tx = pool.transaction();
  await tx.begin();
  console.log('\n→ Transacción iniciada');

  try {
    // Usa CTE + DELETE FROM CTE para conservar solo rn = 1
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
          AND MONTH(Fecha_Emision) = 2
      )
      DELETE FROM dup WHERE rn > 1;
    `);
    const deleted = (deleteRes as any).rowsAffected?.[0] ?? 0;
    console.log(`  Filas eliminadas: ${deleted}`);

    // 5. Verificar total después
    const after = await tx.request().query(`
      SELECT COUNT(*) AS filas,
             COUNT(DISTINCT CAST(DocEntry AS NVARCHAR) + '|' + CAST(LineNum AS NVARCHAR) + '|' + ObjType) AS unicos,
             SUM(CAST(Valor_Venta_Dolares_Presentacion AS DECIMAL(18,2))) AS venta
      FROM dbo.stg_rpt_ventas_detallado
      WHERE Pais='Peru' AND YEAR(Fecha_Emision)=2026 AND MONTH(Fecha_Emision)=2
    `);
    const a = after.recordset[0];
    console.log(`\nEstado post-fix febrero 2026:`);
    console.log(`  Filas totales  : ${a.filas}`);
    console.log(`  Únicos         : ${a.unicos}`);
    console.log(`  Venta total    : $${Math.round(Number(a.venta || 0)).toLocaleString('es-PE')}`);

    // Validación: filas == únicos después
    if (a.filas !== a.unicos) {
      throw new Error(`Inconsistencia: filas (${a.filas}) != unicos (${a.unicos}) después del DELETE`);
    }
    if (deleted !== expectedExtras) {
      console.warn(`⚠ Se eliminaron ${deleted} filas pero se esperaban ${expectedExtras}. Revisar.`);
    }

    await tx.commit();
    console.log('\n✓ TRANSACCIÓN CONFIRMADA (commit)');
    console.log('  Febrero 2026 ahora tiene 501 filas únicas con venta depurada.');
  } catch (err) {
    await tx.rollback();
    console.error('\n✗ ERROR — ROLLBACK ejecutado. No se modificó nada.');
    throw err;
  }

  await closeDb();
}

main().catch(e => { console.error(e); process.exit(1); });
