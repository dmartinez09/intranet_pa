// ============================================================
// SIEA / MIDAGRI - Información Estadística (índice)
// URL: https://siea.midagri.gob.pe/portal/publicaciones/informacion-estadistica
// Método: scraping HTML - extrae enlaces a boletines y publicaciones
// ============================================================

import { BaseCollector, extractLinks, classifyDocumentType } from './base.collector';
import { CollectorContext, CollectorResult, ParsedSnapshot, Frequency } from '../types';
import { CatalogMaps, detectCrop, detectRegion, detectCategory } from '../normalizers';
import { scoreSnapshot } from '../scoring';
import { fetchText } from '../http';

const URL = 'https://siea.midagri.gob.pe/portal/publicaciones/informacion-estadistica';

export class SieaIndexCollector extends BaseCollector {
  readonly sourceCode = 'SIEA_INDEX';
  readonly pipelineName = 'siea-index-collector';
  readonly frequency: Frequency = 'daily';
  readonly description = 'Scraping del índice de publicaciones estadísticas de SIEA/MIDAGRI';

  async run(_ctx: CollectorContext, maps: CatalogMaps): Promise<CollectorResult> {
    const snapshots: ParsedSnapshot[] = [];

    const html = await fetchText(URL, { timeout: 30000 });
    const links = extractLinks(html, URL);

    // Filtra enlaces relevantes (que mencionen boletín/anuario/estadística/precios)
    const keywords = /bolet[ií]n|anuario|estad[ií]stica|precio|reporte|produc|superficie|rendimiento/i;
    const relevant = links.filter(l => l.text && (keywords.test(l.text) || keywords.test(l.href)));

    for (const l of relevant.slice(0, 50)) {
      const type = classifyDocumentType(l.href);
      const text = `${l.text} ${l.href}`;
      const crop = detectCrop(text, maps);
      const region = detectRegion(text, maps);
      const category = detectCategory(text, maps);

      const snap: ParsedSnapshot = {
        documentTitle: l.text.substring(0, 380),
        documentUrl: l.href.substring(0, 790),
        documentType: type,
        periodLabel: null,
        cropCode: crop ? findCodeById(maps.cropByCode, crop) : null,
        regionCode: region ? findCodeById(maps.regionByCode, region) : null,
        categoryCode: category ? findCodeById(maps.categoryByCode, category) : null,
        businessNote: 'Enlace detectado en índice SIEA; clasificación heurística por keywords.',
      };
      snapshots.push(scoreSnapshot(snap));
    }

    return {
      recordsRead: links.length,
      recordsInserted: 0,
      recordsUpdated: 0,
      recordsSkipped: 0,
      status: 'SUCCESS',
      snapshots,
    };
  }
}

function findCodeById(map: Map<string, number>, id: number): string | null {
  for (const [k, v] of map) if (v === id) return k;
  return null;
}
