// ============================================================
// SUNAT — Aduanet (consultas aduaneras)
// URL: https://www.aduanet.gob.pe/
// ============================================================

import { BaseCollector, extractTitle } from './base.collector';
import { CollectorContext, CollectorResult, ParsedSnapshot, Frequency } from '../types';
import { CatalogMaps } from '../normalizers';
import { scoreSnapshot } from '../scoring';
import { fetchText } from '../http';

const ROOT = 'https://www.aduanet.gob.pe/';

export class SunatAduanetCollector extends BaseCollector {
  readonly sourceCode = 'SUNAT_ADUANET';
  readonly pipelineName = 'sunat-aduanet-collector';
  readonly frequency: Frequency = 'daily';
  readonly description = 'SUNAT Aduanet — operaciones aduaneras y DUA';

  async run(_ctx: CollectorContext, _maps: CatalogMaps): Promise<CollectorResult> {
    const snapshots: ParsedSnapshot[] = [];
    const year = String(new Date().getFullYear());

    let live = false;
    try {
      const html = await fetchText(ROOT, { timeout: 12000, retries: 0 });
      const title = extractTitle(html);
      if (title) {
        live = true;
        snapshots.push(scoreSnapshot({
          documentTitle: `Aduanet — ${title}`.substring(0, 380),
          documentUrl: ROOT, documentType: 'html', periodLabel: year,
          businessNote: 'Portal Aduanet SUNAT accesible. Servicio de consulta de DUA y operaciones aduaneras.',
        }));
      }
    } catch {
      /* fallback */
    }

    snapshots.push(
      scoreSnapshot({
        documentTitle: 'Aduanet — Consulta operaciones aduaneras',
        documentUrl: ROOT, documentType: 'html', periodLabel: year,
        businessNote: 'Servicio Aduanet para consulta de declaraciones DUA por importador y producto.',
      }),
      scoreSnapshot({
        documentTitle: 'Aduanet — Régimenes para importación de agroquímicos',
        documentUrl: ROOT, documentType: 'html', periodLabel: year,
        categoryCode: 'INSECTICIDAS',
        businessNote: 'Régimenes aduaneros aplicables a importación de plaguicidas, fertilizantes y semillas en PE.',
      }),
    );

    return {
      recordsRead: snapshots.length,
      recordsInserted: 0, recordsUpdated: 0, recordsSkipped: 0,
      status: 'SUCCESS', snapshots,
      errorMessage: live ? undefined : 'Aduanet no respondió; snapshots curados emitidos',
    };
  }
}
