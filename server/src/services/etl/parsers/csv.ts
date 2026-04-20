// ============================================================
// CSV Parser - nativo, soporta comillas dobles y campos multilinea
// Para parseo sencillo de recursos de Datos Abiertos
// ============================================================

import { fetchWithRetry } from '../http';

export interface CsvParsed {
  headers: string[];
  rows: Record<string, string>[];
  totalRows: number;
}

/**
 * Parsea un string CSV. Delimitador auto-detectado entre , ; y \t.
 */
export function parseCsv(text: string, maxRows = 1000): CsvParsed {
  const delim = detectDelimiter(text);
  const allRows = splitCsv(text, delim);
  if (allRows.length === 0) return { headers: [], rows: [], totalRows: 0 };

  const headers = allRows[0].map(h => h.trim());
  const limited = allRows.slice(1, 1 + maxRows);

  const rows: Record<string, string>[] = limited.map(cells => {
    const r: Record<string, string> = {};
    headers.forEach((h, i) => { r[h] = cells[i] || ''; });
    return r;
  });

  return { headers, rows, totalRows: allRows.length - 1 };
}

/**
 * Descarga y parsea un CSV por URL.
 */
export async function fetchAndParseCsv(url: string, maxBytes = 5_000_000, maxRows = 1000): Promise<CsvParsed | null> {
  try {
    const res = await fetchWithRetry(url, { timeout: 30000, accept: 'text/csv,application/csv,*/*' });
    if (!res.ok) return null;
    const contentLength = parseInt(res.headers.get('content-length') || '0', 10);
    if (contentLength && contentLength > maxBytes) return null;

    const text = await res.text();
    if (text.length > maxBytes) return null;

    return parseCsv(text, maxRows);
  } catch (err: any) {
    console.warn(`[CSV] error en ${url}: ${err?.message || err}`);
    return null;
  }
}

function detectDelimiter(text: string): string {
  const sample = text.substring(0, 2000);
  const counts: Record<string, number> = {
    ',': (sample.match(/,/g) || []).length,
    ';': (sample.match(/;/g) || []).length,
    '\t': (sample.match(/\t/g) || []).length,
  };
  let best = ',';
  let max = 0;
  for (const [k, v] of Object.entries(counts)) {
    if (v > max) { max = v; best = k; }
  }
  return best;
}

/**
 * Split CSV respetando comillas dobles.
 */
function splitCsv(text: string, delim: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"'; i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === delim) {
        row.push(field); field = '';
      } else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && next === '\n') i++;
        row.push(field); field = '';
        if (row.some(f => f.length > 0)) rows.push(row);
        row = [];
      } else {
        field += ch;
      }
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    if (row.some(f => f.length > 0)) rows.push(row);
  }
  return rows;
}
