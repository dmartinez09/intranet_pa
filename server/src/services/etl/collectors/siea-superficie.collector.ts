// ============================================================
// SIEA / MIDAGRI - Superficie Agrícola Peruana
// Fase 3: scraping HTML + PARSEO DE TABLAS <table>
// ============================================================

import { BaseCollector, extractLinks, classifyDocumentType } from './base.collector';
import { CollectorContext, CollectorResult, ParsedSnapshot, Frequency } from '../types';
import { CatalogMaps, detectRegion, detectCrop, parseHectares } from '../normalizers';
import { scoreSnapshot } from '../scoring';
import { fetchText } from '../http';
import { extractTables } from '../parsers/html-tables';

const URL = 'https://siea.midagri.gob.pe/portal/informativos/superficie-agricola-peruana';

export class SieaSuperficieCollector extends BaseCollector {
  readonly sourceCode = 'SIEA_SUPERFICIE';
  readonly pipelineName = 'siea-superficie-collector';
  readonly frequency: Frequency = 'weekly';
  readonly description = 'Recursos de superficie agrícola peruana (HTML + tablas + recursos)';

  async run(_ctx: CollectorContext, maps: CatalogMaps): Promise<CollectorResult> {
    const snapshots: ParsedSnapshot[] = [];

    const html = await fetchText(URL, { timeout: 30000 });
    const year = extractYear(html);

    // Fase 3: extrae tablas estructuradas directamente
    const tables = extractTables(html);
    for (const table of tables) {
      // Busca columnas relevantes por header
      const headers = table.headers.map(h => h.toLowerCase());
      const regionCol = headers.findIndex(h => /departamento|region|dpto/i.test(h));
      const cropCol = headers.findIndex(h => /cultivo|producto|especie/i.test(h));
      const haCol = headers.findIndex(h => /hectarea|superficie|ha\b/i.test(h));

      if (regionCol < 0 && cropCol < 0) continue;

      for (const row of table.rows.slice(0, 100)) {
        const regionText = regionCol >= 0 ? row[regionCol] : '';
        const cropText = cropCol >= 0 ? row[cropCol] : '';
        const haText = haCol >= 0 ? row[haCol] : '';
        const text = `${regionText} ${cropText} ${haText}`;

        const region = detectRegion(regionText || text, maps);
        const crop = detectCrop(cropText || text, maps);
        const hectares = haText ? parseHectares(haText) : null;

        if (!region && !crop) continue;

        snapshots.push(scoreSnapshot({
          documentTitle: `Superficie agrícola${cropText ? ` - ${cropText}` : ''}${regionText ? ` - ${regionText}` : ''}`.substring(0, 380),
          documentUrl: URL,
          documentType: 'html',
          periodLabel: year || null,
          cropCode: crop ? findCodeById(maps.cropByCode, crop) : null,
          regionCode: region ? findCodeById(maps.regionByCode, region) : null,
          hectares: hectares || null,
          businessNote: `Fila de tabla SIEA: ${JSON.stringify(row).substring(0, 300)}`,
        }));
      }
    }

    // Catalogación de enlaces descargables (shape, PDF, excel)
    const links = extractLinks(html, URL);
    const resourceLinks = links.filter(l =>
      /superficie|agricola|shape|vector|tabular|descarga|mapa/i.test(l.text) ||
      /\.(shp|pdf|xlsx|zip|csv)($|\?)/i.test(l.href)
    );

    for (const l of resourceLinks.slice(0, 30)) {
      const type = classifyDocumentType(l.href);
      const region = detectRegion(`${l.text} ${l.href}`, maps);

      snapshots.push(scoreSnapshot({
        documentTitle: l.text.substring(0, 380),
        documentUrl: l.href.substring(0, 790),
        documentType: type,
        periodLabel: year || null,
        regionCode: region ? findCodeById(maps.regionByCode, region) : null,
        businessNote: 'Recurso descargable del informativo SIEA Superficie Agrícola.',
      }));
    }

    return {
      recordsRead: tables.length + links.length,
      recordsInserted: 0, recordsUpdated: 0, recordsSkipped: 0,
      status: 'SUCCESS', snapshots,
    };
  }
}

function extractYear(html: string): string | null {
  const m = html.match(/(?:actualizad[ao]|20\d{2}-20\d{2})\s*(?:al\s+)?(\d{4})/i);
  if (m) return m[1];
  const yr = html.match(/\b(202[0-9])\b/);
  return yr ? yr[1] : null;
}

function findCodeById(map: Map<string, number>, id: number): string | null {
  for (const [k, v] of map) if (v === id) return k;
  return null;
}
