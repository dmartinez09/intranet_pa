import ExcelJS from 'exceljs';
import { getDbPool } from '../src/config/database';

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

  // Cada fila del Excel agrupada por (Numero_SAP, Codigo_Producto)
  const excelKey: Record<string, { venta: number; costoPres: number; filas: number; rows: any[] }> = {};
  for (let r = 4; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const fechaRaw = row.getCell(9).value;
    let fecha: Date | null = null;
    if (fechaRaw instanceof Date) fecha = fechaRaw;
    if (!fecha) continue;
    if (fecha.getUTCFullYear() !== 2026 || fecha.getUTCMonth() !== 3) continue;

    const doc = String(row.getCell(40).value ?? '').trim();
    const codProd = String(row.getCell(15).value ?? '').trim();
    const key = doc + '|' + codProd;
    const venta = num(row.getCell(29));
    const costo = num(row.getCell(27));
    if (!excelKey[key]) excelKey[key] = { venta: 0, costoPres: 0, filas: 0, rows: [] };
    excelKey[key].venta += venta;
    excelKey[key].costoPres += costo;
    excelKey[key].filas++;
    excelKey[key].rows.push({ doc, codProd, nombreProd: String(row.getCell(16).value ?? ''), venta, costo });
  }

  // BD agrupado por (Numero_SAP, Codigo_Producto)
  const p = await getDbPool();
  const r = await p.request().query(`
    SELECT Numero_SAP doc, ISNULL(Codigo_Producto,'') codprod, Nombre_Producto producto,
      SUM(CAST([Valor_Venta_Dolares_Presentacion] AS DECIMAL(18,2))) venta,
      SUM(CAST([Costo_Total_Presentacion] AS DECIMAL(18,2))) costo,
      COUNT(*) filas
    FROM dbo.stg_rpt_ventas_detallado
    WHERE YEAR(Fecha_Emision)=2026 AND MONTH(Fecha_Emision)=4
    GROUP BY Numero_SAP, Codigo_Producto, Nombre_Producto
  `);
  const bdKey: Record<string, any> = {};
  for (const row of r.recordset) {
    const key = row.doc + '|' + row.codprod;
    bdKey[key] = { doc: row.doc, codprod: row.codprod, producto: row.producto, venta: Number(row.venta), costo: Number(row.costo), filas: row.filas };
  }

  // Diff costo por (doc, codProd)
  const diffs: { doc: string; codProd: string; producto: string; bdC: number; excelC: number; diff: number; venta: number }[] = [];
  for (const [key, bd] of Object.entries(bdKey)) {
    const excel = excelKey[key];
    const excelC = excel?.costoPres ?? 0;
    const d = excelC - bd.costo;
    if (Math.abs(d) > 0.1) {
      diffs.push({ doc: bd.doc, codProd: bd.codprod, producto: bd.producto, bdC: bd.costo, excelC, diff: d, venta: bd.venta });
    }
  }
  // Excel que NO está en BD
  for (const [key, excel] of Object.entries(excelKey)) {
    if (!bdKey[key]) {
      diffs.push({ doc: excel.rows[0]?.doc || '?', codProd: excel.rows[0]?.codProd || '?', producto: excel.rows[0]?.nombreProd || '?', bdC: 0, excelC: excel.costoPres, diff: excel.costoPres, venta: excel.venta });
    }
  }
  diffs.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));

  console.log(`═══ TOP DIFERENCIAS DE COSTO ABRIL — BD vs Excel SAP ═══`);
  console.log(`Total grupos con diff: ${diffs.length}`);
  console.log(`Suma diff costo: $${diffs.reduce((s, x) => s + x.diff, 0).toFixed(2)} (Excel - BD)`);
  console.log('\nTop 25:');
  for (const x of diffs.slice(0, 25)) {
    console.log(`  ${x.doc.padEnd(22)} | ${x.codProd.padEnd(12)} | ${(x.producto||'').slice(0,30).padEnd(30)} | BD costo $${x.bdC.toFixed(2).padStart(10)} | Excel $${x.excelC.toFixed(2).padStart(10)} | diff $${x.diff.toFixed(2)} | venta $${x.venta}`);
  }

  process.exit(0);
})().catch(e => { console.error(e.message); process.exit(1); });
