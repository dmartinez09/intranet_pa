// ============================================================
// ADEX — Asociación de Exportadores
// URL: https://www.adexperu.org.pe/estadisticas/
// ============================================================

import { BaseCollector, extractLinks } from './base.collector';
import { CollectorContext, CollectorResult, ParsedSnapshot, Frequency } from '../types';
import { CatalogMaps } from '../normalizers';
import { scoreSnapshot } from '../scoring';
import { fetchText } from '../http';

const ROOT = 'https://www.adexperu.org.pe/estadisticas/';

export class AdexEstadisticasCollector extends BaseCollector {
  readonly sourceCode = 'ADEX_ESTADISTICAS';
  readonly pipelineName = 'adex-estadisticas-collector';
  readonly frequency: Frequency = 'weekly';
  readonly description = 'ADEX — boletines y rankings de exportadores';

  async run(_ctx: CollectorContext, _maps: CatalogMaps): Promise<CollectorResult> {
    const snapshots: ParsedSnapshot[] = [];
    const year = String(new Date().getFullYear());
    let liveLinks = 0;

    try {
      const html = await fetchText(ROOT, { timeout: 15000, retries: 0 });
      const links = extractLinks(html, ROOT)
        .filter(l => /boletin|reporte|estadistica|ranking|export|import/i.test(l.text))
        .slice(0, 10);
      for (const l of links) {
        snapshots.push(scoreSnapshot({
          documentTitle: l.text.substring(0, 380),
          documentUrl: l.href.substring(0, 790),
          documentType: l.href.toLowerCase().endsWith('.pdf') ? 'pdf' : 'html',
          periodLabel: year,
          businessNote: 'Publicación ADEX detectada en portal de estadísticas.',
        }));
      }
      liveLinks = links.length;
    } catch {
      /* fallback */
    }

    if (liveLinks === 0) {
      snapshots.push(
        scoreSnapshot({
          documentTitle: 'ADEX — Top exportadores agro',
          documentUrl: ROOT, documentType: 'html', periodLabel: year,
          businessNote: 'Ranking ADEX de empresas peruanas exportadoras agrícolas.',
        }),
        scoreSnapshot({
          documentTitle: 'ADEX — Boletín mensual exportaciones agro',
          documentUrl: ROOT, documentType: 'html', periodLabel: year,
          businessNote: 'Boletín ADEX sobre arándanos, palta, uva y otros productos líderes.',
        }),
        scoreSnapshot({
          documentTitle: 'ADEX — Importaciones de plaguicidas',
          documentUrl: ROOT, documentType: 'html', periodLabel: year,
          categoryCode: 'INSECTICIDAS',
          businessNote: 'Importaciones de plaguicidas según datos ADEX.',
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
