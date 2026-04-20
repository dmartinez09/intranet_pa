// ============================================================
// SENASA - Portal institucional
// URL: https://www.gob.pe/senasa
// Método: fuente raíz para descubrir secciones especializadas
// ============================================================

import { BaseCollector, extractLinks } from './base.collector';
import { CollectorContext, CollectorResult, ParsedSnapshot, Frequency } from '../types';
import { CatalogMaps } from '../normalizers';
import { scoreSnapshot } from '../scoring';
import { fetchText } from '../http';

const URL = 'https://www.gob.pe/senasa';

export class SenasaRootCollector extends BaseCollector {
  readonly sourceCode = 'SENASA_ROOT';
  readonly pipelineName = 'senasa-root-collector';
  readonly frequency: Frequency = 'daily';
  readonly description = 'Portal raíz SENASA - descubrimiento de secciones sanitarias';

  async run(_ctx: CollectorContext, _maps: CatalogMaps): Promise<CollectorResult> {
    const snapshots: ParsedSnapshot[] = [];

    const html = await fetchText(URL, { timeout: 30000 });
    const links = extractLinks(html, URL);

    // Secciones relevantes del SENASA
    const keywords = /sanitari|cultiv|fitosanitari|plaga|vigilancia|registro|tr[aá]mite|constat/i;
    const relevant = links.filter(l => keywords.test(l.text) && l.href.includes('gob.pe'));

    for (const l of relevant.slice(0, 30)) {
      snapshots.push(scoreSnapshot({
        documentTitle: l.text.substring(0, 380),
        documentUrl: l.href.substring(0, 790),
        documentType: 'html',
        businessNote: 'Sección SENASA detectada desde portal raíz.',
      }));
    }

    return {
      recordsRead: links.length,
      recordsInserted: 0, recordsUpdated: 0, recordsSkipped: 0,
      status: 'SUCCESS', snapshots,
    };
  }
}
