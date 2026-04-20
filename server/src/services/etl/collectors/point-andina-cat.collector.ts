// ============================================================
// Point Andina - Catálogo de productos (maestra interna)
// URL: https://pointandina.pe/productos/ (bloqueado por Mod_Security)
// Método: TABLA MAESTRA INTERNA - no scraping por bloqueo 406
// ============================================================

import { BaseCollector } from './base.collector';
import { CollectorContext, CollectorResult, ParsedSnapshot, Frequency } from '../types';
import { CatalogMaps } from '../normalizers';
import { scoreSnapshot } from '../scoring';

const URL = 'https://pointandina.pe/productos/';

export class PointAndinaCatCollector extends BaseCollector {
  readonly sourceCode = 'POINT_ANDINA_CAT';
  readonly pipelineName = 'point-andina-cat-collector';
  readonly frequency: Frequency = 'on_demand';
  readonly description = 'Catálogo comercial Point Andina (maestra interna)';

  async run(_ctx: CollectorContext, maps: CatalogMaps): Promise<CollectorResult> {
    // No scraping - genera snapshots a partir del catálogo interno (icb_dim_point_category)
    // para registrar la vigencia y trazabilidad en el fact table.
    const snapshots: ParsedSnapshot[] = [];

    for (const [code, _id] of maps.categoryByCode) {
      snapshots.push(scoreSnapshot({
        documentTitle: `Categoría Point Andina: ${code}`,
        documentUrl: URL,
        documentType: 'catalog_internal',
        categoryCode: code,
        businessNote: 'Categoría comercial vigente - mantenida en tabla maestra interna (sitio bloquea scraping con 406).',
      }));
    }

    return {
      recordsRead: snapshots.length,
      recordsInserted: 0, recordsUpdated: 0, recordsSkipped: 0,
      status: 'SUCCESS', snapshots,
    };
  }
}
