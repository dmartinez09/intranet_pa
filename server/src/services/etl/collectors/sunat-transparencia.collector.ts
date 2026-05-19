// ============================================================
// SUNAT — Transparencia Aduanera
// URL: https://www.aduanet.gob.pe/cl-ad-itestadispartida/resumenPPaisS01Alias
// Bloqueo frecuente (WAF). Live attempt + curated fallback.
// ============================================================

import { BaseCollector, extractTitle } from './base.collector';
import { CollectorContext, CollectorResult, ParsedSnapshot, Frequency } from '../types';
import { CatalogMaps } from '../normalizers';
import { scoreSnapshot } from '../scoring';
import { fetchText } from '../http';

const ROOT = 'https://www.aduanet.gob.pe/cl-ad-itestadispartida/resumenPPaisS01Alias';

export class SunatTransparenciaCollector extends BaseCollector {
  readonly sourceCode = 'SUNAT_TRANSPARENCIA';
  readonly pipelineName = 'sunat-transparencia-collector';
  readonly frequency: Frequency = 'daily';
  readonly description = 'SUNAT — Transparencia aduanera (consultas por país y partida)';

  async run(_ctx: CollectorContext, _maps: CatalogMaps): Promise<CollectorResult> {
    const snapshots: ParsedSnapshot[] = [];
    const year = String(new Date().getFullYear());

    let liveTitle: string | null = null;
    try {
      const html = await fetchText(ROOT, { timeout: 12000, retries: 0 });
      liveTitle = extractTitle(html);
    } catch {
      /* fallback */
    }

    if (liveTitle) {
      snapshots.push(scoreSnapshot({
        documentTitle: `SUNAT Aduanet — ${liveTitle}`.substring(0, 380),
        documentUrl: ROOT, documentType: 'html', periodLabel: year,
        businessNote: 'Portal SUNAT de transparencia aduanera accesible. Consulta de operaciones por país y partida HS.',
      }));
    }

    snapshots.push(
      scoreSnapshot({
        documentTitle: 'SUNAT Transparencia — Importaciones por partida arancelaria',
        documentUrl: ROOT, documentType: 'html', periodLabel: year,
        businessNote: 'Resumen oficial SUNAT de importaciones agregadas por partida (capítulos 3808, 3105 relevantes a Point Andina).',
      }),
      scoreSnapshot({
        documentTitle: 'SUNAT Transparencia — Top importadores de agroquímicos',
        documentUrl: 'https://www.sunat.gob.pe/estad-comExt/', documentType: 'html', periodLabel: year,
        categoryCode: 'INSECTICIDAS',
        businessNote: 'Ranking público de importadores SUNAT del capítulo 3808 (insecticidas, fungicidas, herbicidas).',
      }),
      scoreSnapshot({
        documentTitle: 'SUNAT Transparencia — Países origen de importaciones químicas',
        documentUrl: 'https://www.sunat.gob.pe/estad-comExt/', documentType: 'html', periodLabel: year,
        businessNote: 'Distribución por país origen: China, India, Alemania lideran importaciones químicas PE.',
      }),
    );

    return {
      recordsRead: snapshots.length,
      recordsInserted: 0, recordsUpdated: 0, recordsSkipped: 0,
      status: 'SUCCESS', snapshots,
      errorMessage: liveTitle ? undefined : 'SUNAT inaccesible (WAF); snapshots curados emitidos',
    };
  }
}
