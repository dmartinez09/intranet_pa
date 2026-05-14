import ExcelJS from 'exceljs';
import { getDbPool } from '../src/config/database';

(async () => {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile('C:\\Users\\diego.martinez\\Downloads\\REPORTE DE VENTAS ABRIL 2026 SAP.xlsx');
  const sheet = wb.getWorksheet('detalle ventas')!;

  // Columnas conocidas (row 3 son los headers reales)
  const COL = {
    tipo_venta: 1, pais: 2, fecha_emision: 9, codigo_vendedor: 11, vendedor: 12,
    razon_social: 14, codigo_producto: 15, nombre_producto: 16,
    cant_kg_lt: 17, costo_total_pres: 27, valor_venta_pres: 29,
    ganancia_sap: 35, ganancia_real_calc: 36, tipo_documento: 39, numero_sap: 40,
  };

  // Helper para extraer numero de celda (con o sin formula)
  const num = (cell: ExcelJS.Cell): number => {
    const v = cell.value;
    if (v == null) return 0;
    if (typeof v === 'number') return v;
    if (typeof v === 'object' && 'result' in (v as any)) return Number((v as any).result) || 0;
    return Number(v) || 0;
  };

  // Iterar desde fila 4
  let totalFilas = 0, totalVenta = 0, totalCostoPres = 0, totalGanSAP = 0, totalGanCalc = 0;
  const docs: Record<string, { venta: number; costo: number; gananciaSAP: number; filas: number }> = {};
  const filasSinProducto: any[] = [];

  for (let r = 4; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const fechaRaw = row.getCell(COL.fecha_emision).value;
    let fecha: Date | null = null;
    if (fechaRaw instanceof Date) fecha = fechaRaw;
    else if (typeof fechaRaw === 'string') { const t = Date.parse(fechaRaw); if (!isNaN(t)) fecha = new Date(t); }
    else if (typeof fechaRaw === 'number') { fecha = new Date(Math.round((fechaRaw - 25569) * 86400 * 1000)); }
    if (!fecha) continue;
    if (fecha.getUTCFullYear() !== 2026 || fecha.getUTCMonth() !== 3) continue;

    const venta = num(row.getCell(COL.valor_venta_pres));
    const costoPres = num(row.getCell(COL.costo_total_pres));
    const ganSAP = num(row.getCell(COL.ganancia_sap));
    const ganCalc = num(row.getCell(COL.ganancia_real_calc));
    const doc = String(row.getCell(COL.numero_sap).value ?? '').trim();
    const codProd = String(row.getCell(COL.codigo_producto).value ?? '').trim();
    const nombreProd = String(row.getCell(COL.nombre_producto).value ?? '').trim();

    totalFilas++;
    totalVenta += venta;
    totalCostoPres += costoPres;
    totalGanSAP += ganSAP;
    totalGanCalc += ganCalc;

    if (!codProd) {
      filasSinProducto.push({ doc, nombreProd, venta, costoPres });
    }

    if (doc) {
      if (!docs[doc]) docs[doc] = { venta: 0, costo: 0, gananciaSAP: 0, filas: 0 };
      docs[doc].venta += venta;
      docs[doc].costo += costoPres;
      docs[doc].gananciaSAP += ganSAP;
      docs[doc].filas++;
    }
  }

  console.log('═══ EXCEL SAP ABRIL 2026 (hoja detalle ventas) ═══');
  console.log('Filas:                   ', totalFilas);
  console.log('Venta:                   $' + totalVenta.toFixed(2));
  console.log('Costo Total Presentacion:$' + totalCostoPres.toFixed(2));
  console.log('Ganancia SAP ME (col):   $' + totalGanSAP.toFixed(2));
  console.log('Ganancia calc (V-C):     $' + totalGanCalc.toFixed(2));
  console.log('V - C:                   $' + (totalVenta - totalCostoPres).toFixed(2));

  console.log('\n► Filas SIN Codigo_Producto (no-venta):');
  console.log('  Cantidad:', filasSinProducto.length);
  let sumSinProd = 0;
  for (const f of filasSinProducto.slice(0, 15)) {
    console.log(`  ${f.doc.padEnd(22)} | ${f.nombreProd.slice(0,40).padEnd(40)} | v=$${f.venta} c=$${f.costoPres}`);
    sumSinProd += f.venta;
  }
  console.log(`  Suma venta filas sin prod: $${sumSinProd.toFixed(2)}`);

  // CEO numbers
  const CEO = { venta: 1080473, costo: 858847, ganancia: 221626 };
  console.log('\n═══ CEO ESPERA ═══');
  console.log(`Venta:    $${CEO.venta}`);
  console.log(`Costo:    $${CEO.costo}`);
  console.log(`Ganancia: $${CEO.ganancia} (= venta - costo: $${CEO.venta - CEO.costo})`);

  console.log('\n═══ COMPARACION SAP Excel vs CEO ═══');
  console.log(`Venta:    SAP $${totalVenta.toFixed(2)} vs CEO $${CEO.venta} → diff $${(totalVenta - CEO.venta).toFixed(2)}`);
  console.log(`Costo:    SAP $${totalCostoPres.toFixed(2)} vs CEO $${CEO.costo} → diff $${(totalCostoPres - CEO.costo).toFixed(2)}`);
  console.log(`Ganancia: SAP $${totalGanSAP.toFixed(2)} vs CEO $${CEO.ganancia} → diff $${(totalGanSAP - CEO.ganancia).toFixed(2)}`);

  // BD comparacion
  const p = await getDbPool();
  const r = await p.request().query(`
    SELECT
      COUNT(*) filas,
      SUM(CAST([Valor_Venta_Dolares_Presentacion] AS DECIMAL(18,2))) venta,
      SUM(CAST([Costo_Total_Presentacion] AS DECIMAL(18,2))) costo,
      SUM(CAST([Ganancia] AS DECIMAL(18,2))) ganancia_sap
    FROM dbo.stg_rpt_ventas_detallado
    WHERE YEAR(Fecha_Emision)=2026 AND MONTH(Fecha_Emision)=4
  `);
  const bd = r.recordset[0];
  console.log('\n═══ BD ABRIL 2026 (sin filtros) ═══');
  console.log(`Filas:    ${bd.filas}`);
  console.log(`Venta:    $${Number(bd.venta).toFixed(2)}`);
  console.log(`Costo:    $${Number(bd.costo).toFixed(2)}`);
  console.log(`Gan SAP:  $${Number(bd.ganancia_sap).toFixed(2)}`);

  console.log('\n═══ COMPARACION BD vs SAP Excel ═══');
  console.log(`Filas:    BD ${bd.filas} vs Excel ${totalFilas} → diff ${bd.filas - totalFilas}`);
  console.log(`Venta:    BD $${Number(bd.venta).toFixed(2)} vs Excel $${totalVenta.toFixed(2)} → diff $${(Number(bd.venta) - totalVenta).toFixed(2)}`);
  console.log(`Costo:    BD $${Number(bd.costo).toFixed(2)} vs Excel $${totalCostoPres.toFixed(2)} → diff $${(Number(bd.costo) - totalCostoPres).toFixed(2)}`);

  process.exit(0);
})().catch(e => { console.error(e.message); process.exit(1); });
