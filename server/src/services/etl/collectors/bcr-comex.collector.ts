// ============================================================
// BCR / BCRP — Series de comercio exterior (API JSON pública)
// URL: https://estadisticas.bcrp.gob.pe/estadisticas/series/api/<codigo>/json/
// ============================================================

import { BaseCollector } from './base.collector';
import { CollectorContext, CollectorResult, ParsedSnapshot, Frequency } from '../types';
import { CatalogMaps } from '../normalizers';
import { scoreSnapshot } from '../scoring';
import { fetchWithRetry } from '../http';

const SERIES = [
  { code: 'PN02110AA', label: 'Importaciones FOB — productos químicos (mensual)' },
  { code: 'PN02087AA', label: 'Exportaciones agrarias FOB (mensual)' },
  { code: 'PN02088AA', label: 'Importaciones de insumos para la agricultura (mensual)' },
];

export class BcrComexCollector extends BaseCollector {
  readonly sourceCode = 'BCR_COMEX';
  readonly pipelineName = 'bcr-comex-collector';
  readonly frequency: Frequency = 'weekly';
  readonly description = 'BCRP — series mensuales de comercio exterior (API JSON pública)';

  async run(_ctx: CollectorContext, _maps: CatalogMaps): Promise<CollectorResult> {
    const snapshots: ParsedSnapshot[] = [];
    let liveCount = 0;

    for (const s of SERIES) {
      const url = `https://estadisticas.bcrp.gob.pe/estadisticas/series/api/${s.code}/json/`;
      try {
        const res = await fetchWithRetry(url, { timeout: 15000, accept: 'application/json', retries: 0 });
        if (res.ok) {
          const json: any = await res.json();
          const periods = json?.periods || json?.config?.series?.[0]?.periods || [];
          const last = Array.isArray(periods) && periods.length ? periods[periods.length - 1] : null;
          const periodLabel = last?.name || String(new Date().getFullYear());
          snapshots.push(scoreSnapshot({
            documentTitle: `BCR ${s.code} — ${s.label}`.substring(0, 380),
            documentUrl: url, documentType: 'json',
            periodLabel,
            businessNote: `Serie BCR ${s.code} (último período: ${periodLabel}). Fuente oficial pública para comercio exterior.`,
            rawPayload: JSON.stringify(json).substring(0, 4000),
          }));
          liveCount++;
          continue;
        }
      } catch {
        /* fallback */
      }
      snapshots.push(scoreSnapshot({
        documentTitle: `BCR ${s.code} — ${s.label} (fallback)`,
        documentUrl: url, documentType: 'json',
        periodLabel: String(new Date().getFullYear()),
        businessNote: `Serie BCR ${s.code} catalogada para uso futuro (API no respondió).`,
      }));
    }

    // Snapshots de contexto adicionales
    snapshots.push(scoreSnapshot({
      documentTitle: 'BCRP — Portal de estadísticas (series macro y comercio exterior)',
      documentUrl: 'https://estadisticas.bcrp.gob.pe/',
      documentType: 'html', periodLabel: String(new Date().getFullYear()),
      businessNote: 'Portal raíz BCRP con todas las series macroeconómicas (TC, balanza comercial, importaciones por sector).',
    }));

    return {
      recordsRead: SERIES.length + 1,
      recordsInserted: 0, recordsUpdated: 0, recordsSkipped: 0,
      status: 'SUCCESS', snapshots,
      errorMessage: liveCount === 0 ? 'API BCR no respondió; se usaron snapshots fallback' : undefined,
    };
  }
}
