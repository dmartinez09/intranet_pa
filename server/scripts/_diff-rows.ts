import { getDbPool } from '../src/config/database';
import * as fs from 'fs';
import * as path from 'path';

interface FinRow { numero_sap: string; codigo_producto: string; cantidad_kg: number; venta_pres: number; costo_total_pres: number; }

async function main() {
  const pool = await getDbPool();
  const fin: FinRow[] = JSON.parse(fs.readFileSync(path.join(__dirname, '_finanzas-marzo.json'),'utf-8'));
  const finKeys = new Set(fin.map(r => `${r.numero_sap}||${r.codigo_producto}`));

  const sql = await pool.request().query(`
    SELECT Numero_SAP, Codigo_Producto, [Tipo Documento] AS tipo,
           TRY_CAST([Cantidad KG/LT] AS DECIMAL(19,2)) AS cant,
           TRY_CAST([Valor_Venta_Dolares_Presentación] AS DECIMAL(19,2)) AS venta,
           TRY_CAST([Costo Total _Presentación] AS DECIMAL(19,2)) AS costo
    FROM dbo.stg_rpt_ventas_detallado
    WHERE Fecha_Emision BETWEEN '2026-03-01' AND '2026-03-31'
  `);
  const sqlKeys = new Set(sql.recordset.map(r => `${r.Numero_SAP}||${r.Codigo_Producto ?? ''}`));

  // Filas EN Finanzas pero NO en SQL
  const enFinNoSQL = fin.filter(r => !sqlKeys.has(`${r.numero_sap}||${r.codigo_producto}`));
  console.log(`▸ Filas en Finanzas pero NO en SQL: ${enFinNoSQL.length}`);
  console.table(enFinNoSQL.slice(0, 15));

  // Filas EN SQL pero NO en Finanzas
  const enSQLNoFin = sql.recordset.filter(r => !finKeys.has(`${r.Numero_SAP}||${r.Codigo_Producto ?? ''}`));
  console.log(`\n▸ Filas en SQL pero NO en Finanzas: ${enSQLNoFin.length}`);
  console.table(enSQLNoFin.slice(0, 15));

  // Filas con costo=0 y sin match en Finanzas
  const zeroNoMatch = sql.recordset.filter(r =>
    Number(r.costo) === 0 &&
    Number(r.venta) !== 0 &&
    !finKeys.has(`${r.Numero_SAP}||${r.Codigo_Producto ?? ''}`)
  );
  console.log(`\n▸ Filas SQL con costo=0 sin match en Finanzas: ${zeroNoMatch.length}`);
  console.table(zeroNoMatch);

  await pool.close();
}
main().catch(e => { console.error(e); process.exit(1); });
