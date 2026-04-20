// ============================================================
// PDF Parser - extrae texto de PDFs descargados
// Usa pdf-parse (pura extracción de texto, sin rendering)
// ============================================================

import pdfParse from 'pdf-parse';
import { fetchWithRetry } from '../http';

export interface PdfExtraction {
  text: string;
  pages: number;
  info: Record<string, any> | null;
  title: string | null;
  firstPageSnippet: string;
  summary: string;  // primeros ~1500 chars normalizados
}

/**
 * Descarga un PDF por URL y extrae su texto.
 * Si el PDF es muy grande (>15MB) o falla la descarga, retorna null.
 */
export async function fetchAndParsePdf(url: string, maxBytes = 15_000_000): Promise<PdfExtraction | null> {
  try {
    const res = await fetchWithRetry(url, { timeout: 45000, accept: 'application/pdf' });
    if (!res.ok) return null;

    const contentLength = parseInt(res.headers.get('content-length') || '0', 10);
    if (contentLength && contentLength > maxBytes) {
      console.warn(`[PDF] skip ${url} (${contentLength} bytes > ${maxBytes})`);
      return null;
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length > maxBytes) return null;

    return await parsePdfBuffer(buffer);
  } catch (err: any) {
    console.warn(`[PDF] error en ${url}: ${err?.message || err}`);
    return null;
  }
}

export async function parsePdfBuffer(buffer: Buffer): Promise<PdfExtraction | null> {
  try {
    const data = await pdfParse(buffer, { max: 20 });  // max 20 páginas para control
    const rawText = data.text || '';
    const normalized = rawText
      .replace(/\r\n/g, '\n')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    const firstPage = normalized.substring(0, 2000);
    const summary = normalized.substring(0, 1500);

    const info = (data as any).info || null;
    const title = info?.Title || null;

    return {
      text: normalized,
      pages: data.numpages || 0,
      info,
      title,
      firstPageSnippet: firstPage,
      summary,
    };
  } catch (err: any) {
    console.warn(`[PDF] parse error: ${err?.message || err}`);
    return null;
  }
}

// Extrae todas las menciones de "NNN,NNN ha" o similar del texto
export function extractHectareMentions(text: string): Array<{ value: number; raw: string; context: string }> {
  const out: Array<{ value: number; raw: string; context: string }> = [];
  const re = /([\d]{1,3}(?:[.,]\d{3})*(?:[.,]\d+)?)\s*(?:ha|has|hect[aá]reas?)\b/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const raw = m[0];
    const numStr = m[1].replace(/[.,](?=\d{3}\b)/g, '').replace(',', '.');
    const val = parseFloat(numStr);
    if (isNaN(val) || val < 100) continue;  // filtra cifras pequeñas (ruido)
    const start = Math.max(0, m.index - 80);
    const end = Math.min(text.length, m.index + raw.length + 80);
    out.push({ value: val, raw, context: text.substring(start, end).replace(/\s+/g, ' ').trim() });
  }
  return out;
}

// Extrae menciones de producción en toneladas
export function extractProductionMentions(text: string): Array<{ value: number; raw: string; context: string }> {
  const out: Array<{ value: number; raw: string; context: string }> = [];
  const re = /([\d]{1,3}(?:[.,]\d{3})*(?:[.,]\d+)?)\s*(?:t|tm|toneladas?|ton\.?)\b/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const raw = m[0];
    const numStr = m[1].replace(/[.,](?=\d{3}\b)/g, '').replace(',', '.');
    const val = parseFloat(numStr);
    if (isNaN(val) || val < 50) continue;
    const start = Math.max(0, m.index - 80);
    const end = Math.min(text.length, m.index + raw.length + 80);
    out.push({ value: val, raw, context: text.substring(start, end).replace(/\s+/g, ' ').trim() });
  }
  return out;
}
