import { getDbPool } from '../src/config/database';
import * as fs from 'fs';
import * as path from 'path';

interface FinRow {
  numero_sap: string;
  codigo_producto: string;
  cantidad_kg: number;
  costo_unit_kg: number;
  costo_total_kg: number;
  costo_unit_pres: number;
  costo_total_pres: number;
  venta_pres: number;
}

const key = (ns: string, cp: string) => `${ns}||${cp}`;

async function main() {
  const pool = await getDbPool();
  const fin: FinRow[] = JSON.parse(
    fs.readFileSync(path.join(__dirname, '_finanzas-marzo.json'), 'utf-8')
  );
  const finMap = new Map<string, FinRow[]>();
  for (const r of fin) {
    const k = key(r.numero_sap, r.codigo_producto);
    if (!finMap.has(k)) finMap.set(k, []);
    finMap.get(k)!.push(r);
  }

  // 1. SQL rows marzo
  const sqlRes = await pool.request().query(`
    SELECT
      Numero_SAP,
      Codigo_Producto,
      [Tipo Documento] AS tipo,
      TRY_CAST([Cantidad KG/LT] AS DECIMAL(19,6)) AS cant,
      TRY_CAST([Costo Total _Presentación] AS DECIMAL(19,6)) AS costo,
      TRY_CAST([Valor_Venta_Dolares_Presentación] AS DECIMAL(19,6)) AS venta,
      TRY_CAST(Ganancia AS DECIMAL(19,6)) AS ganancia
    FROM dbo.stg_rpt_ventas_detallado
    WHERE Fecha_Emision BETWEEN '2026-03-01' AND '2026-03-31'
  `);
  console.log(`SQL marzo: ${sqlRes.recordset.length} filas`);
  console.log(`Finanzas:  ${fin.length} filas\n`);

  // 2. Identificar filas EN SQL pero NO en Finanzas (extras)
  const extras: any[] = [];
  for (const r of sqlRes.recordset) {
    const k = key(r.Numero_SAP, r.Codigo_Producto ?? '');
    if (!finMap.has(k)) {
      extras.push(r);
    }
  }
  console.log(`▸ ${extras.length} filas en SQL que NO están en Finanzas (candidatas a excluir)`);

  // Agrupar por Tipo Documento
  const extraByTipo: Record<string, any[]> = {};
  for (const e of extras) {
    const t = e.tipo || '(null)';
    if (!extraByTipo[t]) extraByTipo[t] = [];
    extraByTipo[t].push(e);
  }
  console.log('\nPor tipo de documento:');
  for (const [tipo, rows] of Object.entries(extraByTipo)) {
    console.log(`  ${tipo}: ${rows.length} filas`);
  }

  console.log('\nDetalle de las primeras 15 extras:');
  console.table(extras.slice(0, 15).map(e => ({
    Numero_SAP: e.Numero_SAP,
    Cod: e.Codigo_Producto,
    tipo: e.tipo,
    cant: e.cant,
    costo: e.costo,
    venta: e.venta,
  })));

  // Guardar lista completa de extras en JSON para referencia
  fs.writeFileSync(
    path.join(__dirname, '_extras-excluir.json'),
    JSON.stringify(extras, null, 2)
  );
  console.log(`\n✓ Lista completa exportada a scripts/_extras-excluir.json`);

  // 3. Filas con costo=0 y venta≠0 — buscar en Finanzas para patchar
  const zeroRes = await pool.request().query(`
    SELECT
      Numero_SAP, Codigo_Producto,
      TRY_CAST([Cantidad KG/LT] AS DECIMAL(19,6)) AS cant,
      TRY_CAST([Valor_Venta_Dolares_Presentación] AS DECIMAL(19,6)) AS venta,
      TRY_CAST([Costo Total _Presentación] AS DECIMAL(19,6)) AS costo_actual
    FROM dbo.stg_rpt_ventas_detallado
    WHERE Fecha_Emision BETWEEN '2026-03-01' AND '2026-03-31'
      AND (TRY_CAST([Costo Total _Presentación] AS DECIMAL(19,6)) = 0
        OR [Costo Total _Presentación] IS NULL)
      AND TRY_CAST([Valor_Venta_Dolares_Presentación] AS DECIMAL(19,6)) <> 0
  `);
  console.log(`\n▸ ${zeroRes.recordset.length} filas con costo=0 y venta≠0`);

  let patchables = 0;
  let notFound = 0;
  const patches: any[] = [];

  for (const r of zeroRes.recordset) {
    const k = key(r.Numero_SAP, r.Codigo_Producto ?? '');
    const matches = finMap.get(k) || [];
    // Buscar match por cantidad + venta
    const m = matches.find(x =>
      Math.abs(x.cantidad_kg - Number(r.cant)) < 0.01 &&
      Math.abs(x.venta_pres - Number(r.venta)) < 0.01
    );
    if (m && m.costo_total_pres !== 0) {
      patches.push({ sql: r, fin: m });
      patchables++;
    } else {
      notFound++;
    }
  }
  console.log(`   Patchables (con dato en Finanzas): ${patchables}`);
  console.log(`   Sin match en Finanzas: ${notFound}`);

  // 4. Aplicar patches
  if (patches.length > 0) {
    console.log(`\n▸ Aplicando ${patches.length} UPDATEs de costo desde Finanzas...`);
    for (const p of patches) {
      const venta = p.fin.venta_pres;
      const costo_pres = p.fin.costo_total_pres;
      const costo_kg = p.fin.costo_total_kg;
      const costo_unit_pres = p.fin.costo_unit_pres;
      const costo_unit_kg = p.fin.costo_unit_kg;
      const ganancia = venta - costo_pres;
      const margen = venta !== 0 ? (ganancia / venta) * 100 : 0;

      await pool.request()
        .input('ns', p.sql.Numero_SAP)
        .input('cp', p.sql.Codigo_Producto)
        .input('cant', p.sql.cant)
        .input('cpres', costo_pres)
        .input('ckg', costo_kg)
        .input('cupres', costo_unit_pres)
        .input('cukg', costo_unit_kg)
        .input('gan', ganancia)
        .input('mar', Math.round(margen * 100) / 100)
        .query(`
          UPDATE dbo.stg_rpt_ventas_detallado
          SET
            [Costo Total _Presentación]        = @cpres,
            [Costo Total USD (KG/LT)]          = @ckg,
            [Costo_unitario_Presentación]      = @cupres,
            [Costo Unitario USD (KG/LT)]       = @cukg,
            Ganancia                           = @gan,
            [Ganancia (%)]                     = @mar
          WHERE Numero_SAP = @ns
            AND Codigo_Producto = @cp
            AND TRY_CAST([Cantidad KG/LT] AS DECIMAL(19,6)) = @cant
            AND Fecha_Emision BETWEEN '2026-03-01' AND '2026-03-31'
            AND (TRY_CAST([Costo Total _Presentación] AS DECIMAL(19,6)) = 0
              OR [Costo Total _Presentación] IS NULL)
        `);
    }
    console.log('   ✓ Patches aplicados');
  }

  // 5. KPIs finales
  const kpi = await pool.request().query(`
    SELECT
      COUNT(*) AS filas,
      SUM(TRY_CAST([Valor_Venta_Dolares_Presentación] AS DECIMAL(19,2))) AS venta,
      SUM(TRY_CAST([Costo Total _Presentación] AS DECIMAL(19,2))) AS costo,
      SUM(TRY_CAST(Ganancia AS DECIMAL(19,2))) AS ganancia
    FROM dbo.stg_rpt_ventas_detallado
    WHERE Fecha_Emision BETWEEN '2026-03-01' AND '2026-03-31'
  `);
  const k = kpi.recordset[0];
  const margen = k.venta > 0 ? (k.ganancia / k.venta * 100).toFixed(2) : '—';
  console.log('\n▸ KPIs FINALES vs FINANZAS');
  console.log(`   Filas:     ${k.filas}           (Finanzas: ${fin.length})`);
  console.log(`   Venta:     ${Number(k.venta).toLocaleString('en-US',{maximumFractionDigits:2})}    (Finanzas: 1,316,793.64)`);
  console.log(`   Costo:     ${Number(k.costo).toLocaleString('en-US',{maximumFractionDigits:2})}    (Finanzas: 1,056,691.70)`);
  console.log(`   Ganancia:  ${Number(k.ganancia).toLocaleString('en-US',{maximumFractionDigits:2})}    (Finanzas: 260,101.94)`);
  console.log(`   Margen:    ${margen}%                (Finanzas: 19.75%)`);

  // Zero check
  const zero = await pool.request().query(`
    SELECT COUNT(*) AS c FROM dbo.stg_rpt_ventas_detallado
    WHERE Fecha_Emision BETWEEN '2026-03-01' AND '2026-03-31'
      AND TRY_CAST([Costo Total _Presentación] AS DECIMAL(19,6)) = 0
      AND TRY_CAST([Valor_Venta_Dolares_Presentación] AS DECIMAL(19,6)) <> 0
  `);
  console.log(`\n▸ Filas con costo=0 y venta≠0 restantes: ${zero.recordset[0].c}`);

  await pool.close();
}

main().catch(e => { console.error(e); process.exit(1); });
