// ============================================================
// SENASA - Reportes o Registros
// URL: https://www.gob.pe/institucion/senasa/tema/reportes-o-registros
// Método: scraping HTML + catalogación de enlaces
// ============================================================

import { BaseCollector, extractLinks, classifyDocumentType } from './base.collector';
import { CollectorContext, CollectorResult, ParsedSnapshot, Frequency } from '../types';
import { CatalogMaps, detectCategory, detectCrop } from '../normalizers';
import { scoreSnapshot } from '../scoring';
import { fetchText } from '../http';

const URL = 'https://www.gob.pe/institucion/senasa/tema/reportes-o-registros';

export class SenasaReportesCollector extends BaseCollector {
  readonly sourceCode = 'SENASA_REPORTES';
  readonly pipelineName = 'senasa-reportes-collector';
  readonly frequency: Frequency = 'daily';
  readonly description = 'Reportes, servicios y registros administrativos SENASA';

  async run(_ctx: CollectorContext, maps: CatalogMaps): Promise<CollectorResult> {
    const snapshots: ParsedSnapshot[] = [];

    const html = await fetchText(URL, { timeout: 30000 });
    const links = extractLinks(html, URL);

    for (const l of links.slice(0, 100)) {
      const text = `${l.text} ${l.href}`;
      const category = detectCategory(text, maps);
      const crop = detectCrop(text, maps);

      // Sólo catalogamos los que tienen texto relevante
      if (!l.text || l.text.length < 8) continue;
      if (!l.href.includes('gob.pe')) continue;

      const type = classifyDocumentType(l.href) || 'html';

      snapshots.push(scoreSnapshot({
        documentTitle: l.text.substring(0, 380),
        documentUrl: l.href.substring(0, 790),
        documentType: type,
        cropCode: crop ? findCodeById(maps.cropByCode, crop) : null,
        categoryCode: category ? findCodeById(maps.categoryByCode, category) : null,
        businessNote: 'Reporte/registro SENASA - uso administrativo o fitosanitario.',
      }));
    }

    return {
      recordsRead: links.length,
      recordsInserted: 0, recordsUpdated: 0, recordsSkipped: 0,
      status: 'SUCCESS', snapshots,
    };
  }
}

function findCodeById(map: Map<string, number>, id: number): string | null {
  for (const [k, v] of map) if (v === id) return k;
  return null;
}
