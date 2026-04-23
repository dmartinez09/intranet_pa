// ============================================================
// Diagnóstico febrero 2026 — schema NUEVO stg_rpt_ventas_detallado
// SOLO LECTURA
// Usa DocEntry + LineNum para identificar duplicados reales
// ============================================================

import { getDbPool, closeDb } from '../src/config/database';

async function main() {
  const pool = await getDbPool();

  console.log('=========================================================');
  console.log('  DIAGNÓSTICO FEBRERO 2026 — schema nuevo');
  console.log('=========================================================\n');

  // 1. Resumen por mes
  console.log('--- 1. Resumen por mes (ene-abr 2026) ---');
  const r1 = await pool.request().query(`
    SELECT
      YEAR(Fecha_Emision) AS anio,
      MONTH(Fecha_Emision) AS mes,
      COUNT(*) AS filas,
      COUNT(DISTINCT Numero_SAP) AS docs_unicos,
      COUNT(DISTINCT CAST(DocEntry AS NVARCHAR) + '|' + CAST(LineNum AS NVARCHAR)) AS doc_line_unicos,
      SUM(CAST(Valor_Venta_Dolares_Presentacion AS DECIMAL(18,2))) AS venta,
      MAX(UpdateDate) AS ultima_actualizacion
    FROM dbo.stg_rpt_ventas_detallado
    WHERE Pais='Peru' AND YEAR(Fecha_Emision)=2026 AND MONTH(Fecha_Emision) BETWEEN 1 AND 4
    GROUP BY YEAR(Fecha_Emision), MONTH(Fecha_Emision)
    ORDER BY mes
  `);
  console.table(r1.recordset.map((r: any) => ({
    periodo: `${r.anio}-${String(r.mes).padStart(2, '0')}`,
    filas: r.filas,
    docs_unicos: r.docs_unicos,
    doc_line_unicos: r.doc_line_unicos,
    duplicados: r.filas - r.doc_line_unicos,
    venta: `$${Math.round(Number(r.venta || 0)).toLocaleString('es-PE')}`,
    ultima_act: r.ultima_actualizacion ? new Date(r.ultima_actualizacion).toISOString().substring(0,10) : '—',
  })));
  console.log('   ℹ duplicados = filas - doc_line_unicos. Si > 0 → hay filas con el mismo DocEntry+LineNum.');

  // 2. DUPLICADOS REALES: mismo DocEntry + LineNum aparece más de una vez
  console.log('\n--- 2. ¿Duplicados por DocEntry+LineNum en FEBRERO? ---');
  const r2 = await pool.request().query(`
    SELECT DocEntry, LineNum, ObjType, COUNT(*) AS repes
    FROM dbo.stg_rpt_ventas_detallado
    WHERE Pais='Peru' AND YEAR(Fecha_Emision)=2026 AND MONTH(Fecha_Emision)=2
    GROUP BY DocEntry, LineNum, ObjType
    HAVING COUNT(*) > 1
    ORDER BY repes DESC
  `);
  if (r2.recordset.length === 0) {
    console.log('   ✓ No hay filas con el mismo DocEntry+LineNum+ObjType. No hay duplicación a nivel de línea.');
  } else {
    const totalExtras = r2.recordset.reduce((s: number, r: any) => s + (r.repes - 1), 0);
    console.log(`   ❌ ${r2.recordset.length} combinaciones (DocEntry, LineNum, ObjType) duplicadas.`);
    console.log(`   ❌ Filas sobrantes: ${totalExtras}`);
    console.log('\n   Primeras 10:');
    console.table(r2.recordset.slice(0, 10));
  }

  // 3. Si la duplicación ocurrió en otros meses también
  console.log('\n--- 3. Duplicados DocEntry+LineNum por mes (2026) ---');
  const r3 = await pool.request().query(`
    WITH dup AS (
      SELECT YEAR(Fecha_Emision) AS anio, MONTH(Fecha_Emision) AS mes,
             DocEntry, LineNum, ObjType, COUNT(*) AS repes
      FROM dbo.stg_rpt_ventas_detallado
      WHERE Pais='Peru' AND YEAR(Fecha_Emision)=2026
      GROUP BY YEAR(Fecha_Emision), MONTH(Fecha_Emision), DocEntry, LineNum, ObjType
      HAVING COUNT(*) > 1
    )
    SELECT anio, mes, COUNT(*) AS combos_duplicados, SUM(repes - 1) AS filas_extras
    FROM dup
    GROUP BY anio, mes
    ORDER BY mes
  `);
  if (r3.recordset.length === 0) {
    console.log('   ✓ No hay duplicación en ningún mes de 2026.');
  } else {
    console.table(r3.recordset);
  }

  // 4. Duplicados con misma Numero_SAP+Codigo_Producto (otra forma de validar)
  console.log('\n--- 4. ¿Mismo Numero_SAP + Codigo_Producto duplicado en febrero? ---');
  const r4 = await pool.request().query(`
    SELECT Numero_SAP, Codigo_Producto, COUNT(*) AS repes,
      SUM(CAST(Valor_Venta_Dolares_Presentacion AS DECIMAL(18,2))) AS suma_venta
    FROM dbo.stg_rpt_ventas_detallado
    WHERE Pais='Peru' AND YEAR(Fecha_Emision)=2026 AND MONTH(Fecha_Emision)=2
    GROUP BY Numero_SAP, Codigo_Producto
    HAVING COUNT(*) > 1
    ORDER BY COUNT(*) DESC, suma_venta DESC
  `);
  if (r4.recordset.length === 0) {
    console.log('   ✓ Ningún N SAP tiene el mismo producto más de una vez.');
  } else {
    console.log(`   ⚠ ${r4.recordset.length} combinaciones con el mismo N SAP + Producto. Top 10:`);
    console.table(r4.recordset.slice(0, 10));
  }

  // 5. Tendencia por día en febrero — detectar picos anormales
  console.log('\n--- 5. Actividad diaria febrero 2026 ---');
  const r5 = await pool.request().query(`
    SELECT Fecha_Emision AS fecha,
           COUNT(*) AS filas,
           COUNT(DISTINCT Numero_SAP) AS docs,
           SUM(CAST(Valor_Venta_Dolares_Presentacion AS DECIMAL(18,2))) AS venta
    FROM dbo.stg_rpt_ventas_detallado
    WHERE Pais='Peru' AND YEAR(Fecha_Emision)=2026 AND MONTH(Fecha_Emision)=2
    GROUP BY Fecha_Emision
    ORDER BY Fecha_Emision
  `);
  console.log(`   Total días activos: ${r5.recordset.length}`);
  console.table(r5.recordset.map((r: any) => ({
    fecha: r.fecha ? new Date(r.fecha).toISOString().substring(0,10) : '—',
    filas: r.filas,
    docs: r.docs,
    lineas_por_doc: (r.filas / Math.max(1, r.docs)).toFixed(2),
    venta: `$${Math.round(Number(r.venta||0)).toLocaleString('es-PE')}`,
  })));

  // 6. Por tipo de documento
  console.log('\n--- 6. Febrero por Tipo_Documento ---');
  const r6 = await pool.request().query(`
    SELECT Tipo_Documento AS tipo,
           COUNT(*) AS filas,
           COUNT(DISTINCT Numero_SAP) AS docs,
           SUM(CAST(Valor_Venta_Dolares_Presentacion AS DECIMAL(18,2))) AS venta,
           SUM(CAST(Costo_Total_Presentacion AS DECIMAL(18,2))) AS costo,
           SUM(CAST(Ganancia AS DECIMAL(18,2))) AS ganancia
    FROM dbo.stg_rpt_ventas_detallado
    WHERE Pais='Peru' AND YEAR(Fecha_Emision)=2026 AND MONTH(Fecha_Emision)=2
    GROUP BY Tipo_Documento
    ORDER BY venta DESC
  `);
  console.table(r6.recordset.map((r: any) => ({
    tipo: r.tipo || '(NULL)',
    filas: r.filas,
    docs: r.docs,
    ratio: (r.filas / Math.max(1, r.docs)).toFixed(2),
    venta: `$${Math.round(Number(r.venta||0)).toLocaleString('es-PE')}`,
    costo: `$${Math.round(Number(r.costo||0)).toLocaleString('es-PE')}`,
    ganancia: `$${Math.round(Number(r.ganancia||0)).toLocaleString('es-PE')}`,
  })));

  // 7. UpdateDate — ¿cuándo fue el último update?
  console.log('\n--- 7. UpdateDate (¿cuándo corrió el ETL?) ---');
  const r7 = await pool.request().query(`
    SELECT
      MIN(UpdateDate) AS min_upd,
      MAX(UpdateDate) AS max_upd,
      COUNT(DISTINCT UpdateDate) AS fechas_upd_distintas
    FROM dbo.stg_rpt_ventas_detallado
    WHERE Pais='Peru' AND YEAR(Fecha_Emision)=2026 AND MONTH(Fecha_Emision)=2
  `);
  console.table(r7.recordset);

  // 8. Comparar si los valores de febrero cuadran con marzo
  console.log('\n--- 8. Marzo 2026 (referencia) ---');
  const r8 = await pool.request().query(`
    SELECT COUNT(*) AS filas,
           COUNT(DISTINCT Numero_SAP) AS docs,
           SUM(CAST(Valor_Venta_Dolares_Presentacion AS DECIMAL(18,2))) AS venta
    FROM dbo.stg_rpt_ventas_detallado
    WHERE Pais='Peru' AND YEAR(Fecha_Emision)=2026 AND MONTH(Fecha_Emision)=3
  `);
  console.table(r8.recordset.map((r: any) => ({
    mes: 'marzo 2026',
    filas: r.filas, docs: r.docs,
    venta: `$${Math.round(Number(r.venta||0)).toLocaleString('es-PE')}`,
  })));

  await closeDb();
}

main().catch(e => { console.error(e); process.exit(1); });
