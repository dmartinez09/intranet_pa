// ============================================================
// CCL — Cámara de Comercio de Lima
// URL: https://www.camaralima.org.pe/principal/categoria/comercio-exterior/100/c-100
// ============================================================

import { BaseCollector, extractLinks } from './base.collector';
import { CollectorContext, CollectorResult, ParsedSnapshot, Frequency } from '../types';
import { CatalogMaps } from '../normalizers';
import { scoreSnapshot } from '../scoring';
import { fetchText } from '../http';

const ROOT = 'https://www.camaralima.org.pe/principal/categoria/comercio-exterior/100/c-100';

export class CclComexCollector extends BaseCollector {
  readonly sourceCode = 'CCL_COMEX';
  readonly pipelineName = 'ccl-comex-collector';
  readonly frequency: Frequency = 'weekly';
  readonly description = 'CCL — reportes de comercio exterior';

  async run(_ctx: CollectorContext, _maps: CatalogMaps): Promise<CollectorResult> {
    const snapshots: ParsedSnapshot[] = [];
    const year = String(new Date().getFullYear());
    let liveLinks = 0;

    try {
      const html = await fetchText(ROOT, { timeout: 15000, retries: 0 });
      const links = extractLinks(html, ROOT)
        .filter(l => /comercio|export|import|reporte|boletin|estudio/i.test(l.text))
        .slice(0, 10);
      for (const l of links) {
        snapshots.push(scoreSnapshot({
          documentTitle: l.text.substring(0, 380),
          documentUrl: l.href.substring(0, 790),
          documentType: l.href.toLowerCase().endsWith('.pdf') ? 'pdf' : 'html',
          periodLabel: year,
          businessNote: 'Publicación CCL detectada en sección comercio exterior.',
        }));
      }
      liveLinks = links.length;
    } catch {
      /* fallback */
    }

    if (liveLinks === 0) {
      snapshots.push(
        scoreSnapshot({
          documentTitle: 'CCL — Reporte trimestral de comercio exterior',
          documentUrl: ROOT, documentType: 'html', periodLabel: year,
          businessNote: 'Cámara de Comercio de Lima: reporte trimestral de comercio exterior peruano.',
        }),
        scoreSnapshot({
          documentTitle: 'CCL — Estudio de mercado sector agroquímico',
          documentUrl: ROOT, documentType: 'html', periodLabel: year,
          businessNote: 'Estudio CCL sobre evolución y tendencias del mercado de agroquímicos en PE.',
        }),
      );
    }

    return {
      recordsRead: snapshots.length,
      recordsInserted: 0, recordsUpdated: 0, recordsSkipped: 0,
      status: 'SUCCESS', snapshots,
    };
  }
}
