import ExcelJS from 'exceljs';
import fs from 'fs';
import path from 'path';
import { getDbPool } from '../src/config/database';

const XLSX = 'C:\\Users\\diego.martinez\\Point Americas\\Tecnologías Avanzadas - Tecnologías Avanzadas\\Datos y Automatización\\Point Andina\\Ventas\\Ppto 2026 cuotas vendedores y focos.xlsx';
const BUDGETS_FILE = path.resolve(__dirname, '..', 'data', 'budgets.json');
const YEAR = 2026;

interface BudgetEntry {
  zona: string;
  rc: string;
  year: number;
  month: number;
  monto_usd: number;
  codigo_vendedor?: number;
  grupo?: string;
  tipo_meta?: string;
}

// Normaliza: quita tildes, mayusculas, trim. Tambien normaliza Z final -> S
// (GONZALES vs GONZALEZ)
function norm(s: string): string {
  return (s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toUpperCase().trim().replace(/\s+/g, ' ')
    .replace(/Z\b/g, 'S');
}

// Matchea un nombre corto contra el maestro: requiere que TODOS los tokens
// del nombre corto aparezcan en el nombre del maestro (en cualquier orden).
function matchMaestro(excelName: string, maestro: { codigo: number; vendedor: string; grupo: string }[]): { codigo: number; vendedor: string; grupo: string } | null {
  const tokens = norm(excelName).split(' ').filter(t => t.length >= 3);
  if (!tokens.length) return null;
  // Best match = max token overlap
  let best: { codigo: number; vendedor: string; grupo: string } | null = null;
  let bestScore = 0;
  for (const m of maestro) {
    const mTokens = norm(m.vendedor).split(' ');
    const matched = tokens.filter(t => mTokens.includes(t)).length;
    if (matched === tokens.length && matched > bestScore) {
      bestScore = matched;
      best = m;
    }
  }
  return best;
}

const SKIP_ROWS = new Set([
  'Total General', 'TOTAL GENERAL', 'SUB TOTAL POINT ANDINA', 'Total general',
]);

const isTotalRow = (rc: string) => SKIP_ROWS.has(rc?.trim()) || /total/i.test(rc || '');

function getNum(cell: any): number {
  if (cell == null) return 0;
  if (typeof cell === 'number') return cell;
  if (typeof cell === 'object' && 'result' in cell) return Number(cell.result) || 0;
  if (typeof cell === 'string') return Number(cell.replace(/[, ]/g, '')) || 0;
  return 0;
}

(async () => {
  console.log('Leyendo:', XLSX);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(XLSX);

  const sheet = wb.getWorksheet('Forecast 2026');
  if (!sheet) throw new Error('Hoja "Forecast 2026" no encontrada');

  // Cargar maestro desde BD para hacer fuzzy match
  const pool = await getDbPool();
  const mRes = await pool.request().query('SELECT codigo_vendedor codigo, vendedor, grupo FROM dbo.intranet_maestro_vendedores WHERE activo=1');
  const maestro = mRes.recordset as { codigo: number; vendedor: string; grupo: string }[];
  console.log(`✓ Maestro: ${maestro.length} vendedores cargados`);

  const entries: BudgetEntry[] = [];
  const unmatched: string[] = [];
  // Columnas: A=ZONA, B=RC, C..N = meses 1..12, O = Total
  for (let r = 4; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const zona = String(row.getCell(1).value ?? '').trim();
    const rc = String(row.getCell(2).value ?? '').trim();
    if (!zona || !rc) continue;
    if (isTotalRow(rc)) continue;
    if (zona === 'ONLINE' && rc === 'ONLINE') continue; // empty row
    if (zona.toUpperCase().includes('SUB TOTAL') || zona.toUpperCase().includes('TOTAL GENERAL')) continue;

    // Fuzzy match contra maestro: si encontramos, usamos el nombre canonico + codigo + grupo
    const match = matchMaestro(rc, maestro);
    const canonicalRc = match ? match.vendedor : rc;
    const codigo = match?.codigo;
    const grupo = match?.grupo;
    if (!match) unmatched.push(`${zona} | ${rc}`);

    let totalRow = 0;
    for (let m = 1; m <= 12; m++) {
      const val = getNum(row.getCell(2 + m).value);
      if (val > 0) {
        entries.push({
          zona, rc: canonicalRc, year: YEAR, month: m, monto_usd: val,
          codigo_vendedor: codigo, grupo, tipo_meta: 'FORECAST GENERAL',
        });
        totalRow += val;
      }
    }
    if (totalRow > 0) {
      const tag = match ? `[${grupo}]` : '[SIN GRUPO]';
      console.log(`  ${zona.padEnd(28)} ${(canonicalRc).padEnd(40)} ${tag.padEnd(28)} $${totalRow.toLocaleString()}`);
    }
  }
  if (unmatched.length) {
    console.log('\n⚠ Sin match en maestro (', unmatched.length, '):');
    unmatched.forEach(u => console.log('  -', u));
  }

  // Resumen por grupo (estimado por zona prefix)
  const byZona: Record<string, number> = {};
  for (const e of entries) byZona[e.zona] = (byZona[e.zona] || 0) + e.monto_usd;
  console.log('\nResumen por zona:');
  for (const [z, t] of Object.entries(byZona)) console.log(`  ${z.padEnd(35)} $${t.toLocaleString()}`);

  console.log(`\nTotal entries: ${entries.length} · Total USD: $${entries.reduce((s, e) => s + e.monto_usd, 0).toLocaleString()}`);

  // Guardar en budgets.json (reemplaza año)
  let data: any = { budgets: {}, uploaded_at: {} };
  if (fs.existsSync(BUDGETS_FILE)) {
    try { data = JSON.parse(fs.readFileSync(BUDGETS_FILE, 'utf8')); } catch {}
  }
  // Backup
  const bk = BUDGETS_FILE + '.bak';
  if (fs.existsSync(BUDGETS_FILE)) fs.copyFileSync(BUDGETS_FILE, bk);
  console.log('Backup creado:', bk);

  data.budgets[String(YEAR)] = entries;
  data.uploaded_at[String(YEAR)] = new Date().toISOString();
  fs.writeFileSync(BUDGETS_FILE, JSON.stringify(data, null, 2), 'utf8');
  console.log('\n✓ budgets.json actualizado');
})();
