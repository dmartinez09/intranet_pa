/**
 * Parche tactical: las 8 filas BACB/QINS de abril 2026 tienen costo=$0 en BD
 * pero el Excel SAP oficial tiene los valores correctos. Esto causa que el
 * dashboard reporte ganancia $24,250 MAS ALTA de lo real.
 *
 * Bug del ETL del DataFactory (mismo patron que el fix historico de marzo
 * "5 BACB Ecuador con costo NULL/0 con valores Excel").
 *
 * Este script: UPDATE directo a stg_rpt_ventas_detallado con valores Excel.
 * Idempotente: solo actualiza si BD costo es 0 o NULL.
 */
import ExcelJS from 'exceljs';
import { getDbPool, sql } from '../src/config/database';

(async () => {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile('C:\\Users\\diego.martinez\\Downloads\\REPORTE DE VENTAS ABRIL 2026 SAP.xlsx');
  const sheet = wb.getWorksheet('detalle ventas')!;
  const num = (cell: ExcelJS.Cell): number => {
    const v = cell.value;
    if (v == null) return 0;
    if (typeof v === 'number') return v;
    if (typeof v === 'object' && 'result' in (v as any)) return Number((v as any).result) || 0;
    return Number(v) || 0;
  };

  const FIX_DOCS = new Set([
    '08-FD01-00000289','07-FC01-00001957','01-F001-00040045','07-FC01-00001961',
    '08-FD01-00000286','08-FD01-00000287','07-FC01-00001944','07-FC01-00001956',
  ]);

  // Leer rows del Excel para los docs target
  const patches: any[] = [];
  for (let r = 4; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const doc = String(row.getCell(40).value ?? '').trim();
    if (!FIX_DOCS.has(doc)) continue;
    patches.push({
      doc,
      codProd: String(row.getCell(15).value ?? '').trim(),
      cantidad_kg_lt: num(row.getCell(17)),
      costo_cif: num(row.getCell(18)),
      costo_total_cif: num(row.getCell(19)),
      costo_unit_usd: num(row.getCell(20)),
      costo_total_usd: num(row.getCell(21)),
      costo_unit_pres: num(row.getCell(26)),
      costo_total_pres: num(row.getCell(27)),
      venta_pres: num(row.getCell(29)),
      costo_mn: num(row.getCell(31)),
      ganancia: num(row.getCell(35)),
    });
  }
  console.log(`Filas a parchar desde Excel: ${patches.length}`);
  for (const p of patches) {
    console.log(`  ${p.doc.padEnd(22)} | ${p.codProd} | cant ${p.cantidad_kg_lt} | costo_pres $${p.costo_total_pres} | venta $${p.venta_pres}`);
  }

  // Verificar que en BD esos costos son 0
  const pool = await getDbPool();
  const r1 = await pool.request().query(`
    SELECT Numero_SAP doc, Codigo_Producto codprod,
      CAST([Valor_Venta_Dolares_Presentacion] AS DECIMAL(18,2)) venta,
      CAST([Costo_Total_Presentacion] AS DECIMAL(18,2)) costo_bd
    FROM dbo.stg_rpt_ventas_detallado
    WHERE YEAR(Fecha_Emision)=2026 AND MONTH(Fecha_Emision)=4
      AND Numero_SAP IN (${Array.from(FIX_DOCS).map(d => `'${d}'`).join(',')})
    ORDER BY Numero_SAP
  `);
  console.log(`\nFilas correspondientes en BD: ${r1.recordset.length}`);
  for (const row of r1.recordset) {
    console.log(`  ${row.doc.padEnd(22)} | ${row.codprod} | venta $${row.venta} | costo BD $${row.costo_bd}`);
  }

  // Aplicar UPDATE
  console.log('\n► Aplicando UPDATE en BD...');
  let updated = 0;
  for (const p of patches) {
    const req = pool.request()
      .input('doc', sql.NVarChar, p.doc)
      .input('codprod', sql.NVarChar, p.codProd)
      .input('costo_cif', sql.Decimal(18, 4), p.costo_cif)
      .input('costo_total_cif', sql.Decimal(18, 4), p.costo_total_cif)
      .input('costo_unit_usd', sql.Decimal(18, 4), p.costo_unit_usd)
      .input('costo_total_usd', sql.Decimal(18, 4), p.costo_total_usd)
      .input('costo_unit_pres', sql.Decimal(18, 4), p.costo_unit_pres)
      .input('costo_total_pres', sql.Decimal(18, 4), p.costo_total_pres)
      .input('costo_mn', sql.Decimal(18, 4), p.costo_mn)
      .input('ganancia', sql.Decimal(18, 4), p.ganancia);
    const res = await req.query(`
      UPDATE dbo.stg_rpt_ventas_detallado
      SET [Costo_CIF(KG/LT)]                = @costo_cif,
          [Costo_Total_CIF(KG/LT)]          = @costo_total_cif,
          [Costo_Unitario_USD(KG/LT)]       = @costo_unit_usd,
          [Costo_Total_USD(KG/LT)]          = @costo_total_usd,
          [Costo_unitario_Presentacion]     = @costo_unit_pres,
          [Costo_Total_Presentacion]        = @costo_total_pres,
          [Costo_Total_MN]                  = @costo_mn,
          [Ganancia]                        = @ganancia
      WHERE Numero_SAP = @doc
        AND ISNULL(Codigo_Producto,'') = @codprod
        AND YEAR(Fecha_Emision)=2026 AND MONTH(Fecha_Emision)=4
        AND (ISNULL(CAST([Costo_Total_Presentacion] AS DECIMAL(18,2)), 0) = 0
             OR ABS(CAST([Costo_Total_Presentacion] AS DECIMAL(18,2)) - @costo_total_pres) > 0.5)
    `);
    updated += (res.rowsAffected[0] || 0);
    console.log(`  ${p.doc} ${p.codProd} → rows updated: ${res.rowsAffected[0]}`);
  }
  console.log(`\n✓ Total filas actualizadas: ${updated}`);

  // Verificar nuevo total abril
  const r2 = await pool.request().query(`
    SELECT COUNT(*) filas,
      SUM(CAST([Valor_Venta_Dolares_Presentacion] AS DECIMAL(18,2))) venta,
      SUM(CAST([Costo_Total_Presentacion] AS DECIMAL(18,2))) costo
    FROM dbo.stg_rpt_ventas_detallado
    WHERE YEAR(Fecha_Emision)=2026 AND MONTH(Fecha_Emision)=4
  `);
  const t = r2.recordset[0];
  const ganancia = Number(t.venta) - Number(t.costo);
  console.log('\n═══ TOTAL ABRIL POST-PATCH (sin filtros del dashboard) ═══');
  console.log(`Venta:    $${Number(t.venta).toFixed(2)}`);
  console.log(`Costo:    $${Number(t.costo).toFixed(2)}`);
  console.log(`Ganancia: $${ganancia.toFixed(2)} (= venta - costo)`);
  console.log('\nCEO esperaba:');
  console.log('Venta:    $1,080,473  Costo: $858,847  Ganancia: $221,626');

  process.exit(0);
})().catch(e => { console.error('ERROR:', e.message); console.error(e.stack); process.exit(1); });
