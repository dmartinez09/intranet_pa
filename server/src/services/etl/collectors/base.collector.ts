// ============================================================
// BaseCollector - clase abstracta
// ============================================================

import { CollectorContext, CollectorResult, Frequency } from '../types';
import { CatalogMaps } from '../normalizers';

export abstract class BaseCollector {
  abstract readonly sourceCode: string;     // coincide con icb_dim_source.source_code
  abstract readonly pipelineName: string;   // nombre visible en logs
  abstract readonly frequency: Frequency;   // daily | weekly | on_demand
  abstract readonly description: string;

  abstract run(ctx: CollectorContext, maps: CatalogMaps): Promise<CollectorResult>;
}

// Helper: extrae todos los enlaces de un HTML crudo
export function extractLinks(html: string, baseUrl?: string): Array<{ href: string; text: string }> {
  const out: Array<{ href: string; text: string }> = [];
  const re = /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const hrefRaw = m[1];
    const text = stripTags(m[2]).replace(/\s+/g, ' ').trim();
    if (!hrefRaw) continue;
    const abs = absolutize(hrefRaw, baseUrl);
    out.push({ href: abs, text });
  }
  return out;
}

export function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, '');
}

export function absolutize(href: string, base?: string): string {
  if (!base) return href;
  try {
    return new URL(href, base).toString();
  } catch {
    return href;
  }
}

// Helper para extraer el <title> o primer H1
export function extractTitle(html: string): string | null {
  const t1 = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (t1) return stripTags(t1[1]).trim();
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1) return stripTags(h1[1]).trim();
  return null;
}

// Detecta si un href apunta a un documento descargable
export function classifyDocumentType(href: string): string | null {
  const h = href.toLowerCase();
  if (h.endsWith('.pdf')) return 'pdf';
  if (h.endsWith('.xlsx') || h.endsWith('.xls')) return 'xlsx';
  if (h.endsWith('.csv')) return 'csv';
  if (h.endsWith('.zip')) return 'zip';
  if (h.endsWith('.json')) return 'json';
  if (h.endsWith('.shp')) return 'shapefile';
  if (h.includes('/dataset/') || h.includes('datosabiertos')) return 'dataset';
  if (h.startsWith('http')) return 'html';
  return null;
}
