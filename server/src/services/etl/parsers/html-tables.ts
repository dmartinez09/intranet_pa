// ============================================================
// HTML Tables Parser - extrae tablas <table> a matrices
// Regex-based, sin cheerio (para mantener deps bajos)
// ============================================================

import { stripTags } from '../collectors/base.collector';

export interface HtmlTable {
  headers: string[];
  rows: string[][];
  caption: string | null;
}

/**
 * Extrae todas las tablas de un HTML. Si no hay <thead>, asume que la
 * primera <tr> es el header.
 */
export function extractTables(html: string): HtmlTable[] {
  const tables: HtmlTable[] = [];
  const tblRe = /<table\b[^>]*>([\s\S]*?)<\/table>/gi;
  let tm: RegExpExecArray | null;
  while ((tm = tblRe.exec(html)) !== null) {
    const inner = tm[1];
    const captionMatch = inner.match(/<caption[^>]*>([\s\S]*?)<\/caption>/i);
    const caption = captionMatch ? stripTags(captionMatch[1]).trim() : null;

    // Extrae todas las filas
    const rows: string[][] = [];
    const trRe = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
    let rm: RegExpExecArray | null;
    while ((rm = trRe.exec(inner)) !== null) {
      const cellRe = /<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi;
      const cells: string[] = [];
      let cm: RegExpExecArray | null;
      while ((cm = cellRe.exec(rm[1])) !== null) {
        cells.push(stripTags(cm[1]).replace(/\s+/g, ' ').trim());
      }
      if (cells.length > 0) rows.push(cells);
    }

    if (rows.length === 0) continue;

    // Primera fila como header si parece header (tiene <th> o está en <thead>)
    const hasTh = /<th\b/i.test(inner);
    const headers = hasTh ? rows.shift() || [] : [];

    tables.push({ headers, rows, caption });
  }
  return tables;
}

/**
 * Busca la columna que matchea un patrón y retorna los valores de esa columna
 */
export function getColumnValues(table: HtmlTable, patterns: RegExp[]): string[] {
  if (!table.headers.length) return [];
  const colIdx = table.headers.findIndex(h => patterns.some(p => p.test(h)));
  if (colIdx < 0) return [];
  return table.rows.map(r => r[colIdx] || '').filter(v => v.length > 0);
}
