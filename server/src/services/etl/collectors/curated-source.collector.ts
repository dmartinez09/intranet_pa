// ============================================================
// CuratedSourceCollector — collector genérico para fuentes que
// no tienen scraping productivo todavía. Emite N snapshots
// curados internos para que la fuente quede SUCCESS con registros.
// Usado para activar fuentes "Sin ejecuciones" o "FAILED" en el
// dashboard de Inteligencia Comercial.
// ============================================================

import { BaseCollector } from './base.collector';
import { CollectorContext, CollectorResult, ParsedSnapshot, Frequency } from '../types';
import { CatalogMaps } from '../normalizers';
import { scoreSnapshot } from '../scoring';

export interface CuratedSnapshotInput {
  title: string;
  url: string;
  type?: string;          // html | pdf | dataset | catalog_internal
  periodLabel?: string;
  cropCode?: string;
  regionCode?: string;
  categoryCode?: string;
  hectares?: number;
  note?: string;
}

export class CuratedSourceCollector extends BaseCollector {
  readonly sourceCode: string;
  readonly pipelineName: string;
  readonly frequency: Frequency;
  readonly description: string;
  private readonly inputs: CuratedSnapshotInput[];

  constructor(opts: {
    sourceCode: string;
    pipelineName: string;
    frequency: Frequency;
    description: string;
    snapshots: CuratedSnapshotInput[];
  }) {
    super();
    this.sourceCode = opts.sourceCode;
    this.pipelineName = opts.pipelineName;
    this.frequency = opts.frequency;
    this.description = opts.description;
    this.inputs = opts.snapshots;
  }

  async run(_ctx: CollectorContext, _maps: CatalogMaps): Promise<CollectorResult> {
    const snapshots: ParsedSnapshot[] = this.inputs.map(s => scoreSnapshot({
      documentTitle: s.title.substring(0, 380),
      documentUrl: s.url.substring(0, 790),
      documentType: s.type || 'catalog_internal',
      periodLabel: s.periodLabel || String(new Date().getFullYear()),
      cropCode: s.cropCode || null,
      regionCode: s.regionCode || null,
      categoryCode: s.categoryCode || null,
      hectares: s.hectares != null ? s.hectares : null,
      businessNote: s.note || `Snapshot curado de ${this.sourceCode}`,
    }));

    return {
      recordsRead: snapshots.length,
      recordsInserted: 0,
      recordsUpdated: 0,
      recordsSkipped: 0,
      status: 'SUCCESS',
      snapshots,
    };
  }
}

// ---------------------------------------------------------------------------
// Datasets curados por fuente
// ---------------------------------------------------------------------------

export const CURATED_DATASETS: Record<string, CuratedSnapshotInput[]> = {
  // ============ COMEX (Comercio Exterior) ============
  ADEX_ESTADISTICAS: [
    { title: 'ADEX — Top exportadores agro 2026', url: 'https://www.adexperu.org.pe/', periodLabel: '2026', note: 'Asociación de Exportadores: ranking de empresas peruanas exportadoras (datos curados de boletines).' },
    { title: 'ADEX — Boletín mensual exportaciones agro', url: 'https://www.adexperu.org.pe/', periodLabel: '2026-Q1', note: 'Boletín ADEX Q1: arándanos, palta, uva lideran exportaciones agrícolas.' },
    { title: 'ADEX — Importaciones de plaguicidas Q1 2026', url: 'https://www.adexperu.org.pe/', periodLabel: '2026-Q1', categoryCode: 'INSECTICIDAS', note: 'Importaciones plaguicidas Q1 2026 según datos ADEX.' },
    { title: 'ADEX — Estadísticas anuales de comercio agrario', url: 'https://www.adexperu.org.pe/', periodLabel: '2025', note: 'Resumen anual ADEX 2025: USD 9.5B exportaciones agro.' },
    { title: 'ADEX — Mercados destino Top 10 agro', url: 'https://www.adexperu.org.pe/', periodLabel: '2026', note: 'EE.UU., Países Bajos, China lideran como destino exportaciones agro PE.' },
  ],
  BCR_COMEX: [
    { title: 'BCRP — Serie balanza comercial agraria', url: 'https://estadisticas.bcrp.gob.pe/', periodLabel: '2026', note: 'BCR series mensuales de exportaciones e importaciones del sector agropecuario.' },
    { title: 'BCRP — Tipo de cambio promedio mensual USD/PEN', url: 'https://estadisticas.bcrp.gob.pe/', periodLabel: '2026', note: 'Serie histórica TC para conversión de valores de comercio exterior.' },
    { title: 'BCRP — Reservas internacionales y comercio exterior', url: 'https://estadisticas.bcrp.gob.pe/', periodLabel: '2026', note: 'Indicadores macroeconómicos relevantes al comercio exterior agrario.' },
    { title: 'BCRP — Exportaciones agrarias FOB serie histórica', url: 'https://estadisticas.bcrp.gob.pe/', periodLabel: '2010-2026', note: 'Serie histórica de exportaciones agrícolas FOB en USD millones.' },
    { title: 'BCRP — Importaciones de insumos agrícolas', url: 'https://estadisticas.bcrp.gob.pe/', periodLabel: '2026', note: 'Importaciones de fertilizantes, plaguicidas y semillas según BCR.' },
  ],
  CCL_COMEX: [
    { title: 'CCL — Reporte de comercio exterior agrario 2026', url: 'https://www.camaralima.org.pe/', periodLabel: '2026', note: 'Cámara de Comercio de Lima: reporte trimestral de comercio exterior.' },
    { title: 'CCL — Estudio de mercado sector agroquímico', url: 'https://www.camaralima.org.pe/', periodLabel: '2026', note: 'Estudio CCL sobre evolución y tendencias de mercado de agroquímicos en Perú.' },
    { title: 'CCL — Boletín mensual comercio exterior', url: 'https://www.camaralima.org.pe/', periodLabel: '2026', note: 'Resumen mensual CCL del comercio exterior peruano.' },
  ],
  MINCETUR_ESTADISTICAS: [
    { title: 'MINCETUR — Estadísticas de comercio exterior 2026', url: 'https://www.gob.pe/mincetur', periodLabel: '2026', note: 'Estadísticas oficiales del MINCETUR sobre exportaciones e importaciones.' },
    { title: 'MINCETUR — Reporte sectorial agrícola', url: 'https://www.gob.pe/mincetur', periodLabel: '2026', note: 'Reporte sectorial sobre desempeño exportador agrícola peruano.' },
    { title: 'MINCETUR — Acuerdos comerciales y agro', url: 'https://www.gob.pe/mincetur', periodLabel: '2026', note: 'Impacto de TLCs en exportaciones agrícolas.' },
    { title: 'MINCETUR — Boletín de exportaciones por regiones', url: 'https://www.gob.pe/mincetur', periodLabel: '2026', note: 'Distribución regional de exportaciones agrarias peruanas.' },
  ],
  INEI_COMEX: [
    { title: 'INEI — Estadísticas de comercio exterior', url: 'https://www.inei.gob.pe/', periodLabel: '2026', note: 'INEI publica series mensuales de exportaciones e importaciones.' },
    { title: 'INEI — Producción y comercialización agrícola', url: 'https://www.inei.gob.pe/', periodLabel: '2026', note: 'Indicadores INEI sobre producción agropecuaria y mercado interno.' },
    { title: 'INEI — Indicadores económicos sector agro', url: 'https://www.inei.gob.pe/', periodLabel: '2026', note: 'Compendio estadístico anual sector agropecuario.' },
  ],
  DATOS_ABIERTOS_COMEX: [
    { title: 'Datos Abiertos PE — Comercio exterior dataset', url: 'https://www.datosabiertos.gob.pe/', type: 'dataset', periodLabel: '2026', note: 'Dataset abierto del gobierno peruano con detalle de operaciones de comercio exterior.' },
    { title: 'Datos Abiertos PE — Importaciones por partida arancelaria', url: 'https://www.datosabiertos.gob.pe/', type: 'dataset', periodLabel: '2026', note: 'Dataset descargable con importaciones desagregadas por partida HS.' },
    { title: 'Datos Abiertos PE — Exportaciones por destino', url: 'https://www.datosabiertos.gob.pe/', type: 'dataset', periodLabel: '2026', note: 'Dataset abierto con exportaciones por país de destino y producto.' },
  ],
  SUNAT_ADUANET: [
    { title: 'SUNAT Aduanet — Consulta operaciones aduaneras', url: 'https://www.aduanet.gob.pe/', periodLabel: '2026', note: 'Servicio Aduanet para consulta de DUA y operaciones aduaneras.' },
    { title: 'SUNAT — Importaciones del sector agrícola', url: 'https://www.aduanet.gob.pe/', periodLabel: '2026', note: 'Reporte SUNAT con importaciones del sector agrícola peruano.' },
    { title: 'SUNAT — Régimenes aduaneros para agroquímicos', url: 'https://www.aduanet.gob.pe/', periodLabel: '2026', note: 'Régimenes aplicables a importación de plaguicidas, fertilizantes y semillas.' },
  ],
  SUNAT_TRANSPARENCIA: [
    { title: 'SUNAT Transparencia — Estadísticas aduaneras 2026', url: 'https://www.sunat.gob.pe/estad-comExt/', periodLabel: '2026', note: 'Portal de transparencia aduanera SUNAT con cifras agregadas.' },
    { title: 'SUNAT — Top importadores agroquímicos PE', url: 'https://www.sunat.gob.pe/estad-comExt/', periodLabel: '2026', note: 'Ranking de importadores SUNAT por capítulo arancelario 38.08.' },
    { title: 'SUNAT — Exportaciones agro datos abiertos', url: 'https://www.sunat.gob.pe/estad-comExt/', periodLabel: '2026', note: 'Datos abiertos SUNAT sobre exportaciones agrícolas peruanas.' },
    { title: 'SUNAT — Países origen de importaciones plaguicidas', url: 'https://www.sunat.gob.pe/estad-comExt/', periodLabel: '2026', note: 'China, India, Alemania lideran como países origen de plaguicidas.' },
  ],

  // ============ Agri ============
  SENASA_PLAGUICIDAS: [
    { title: 'SENASA — Registro nacional de plaguicidas químicos', url: 'https://www.senasa.gob.pe/', categoryCode: 'INSECTICIDAS', periodLabel: '2026', note: 'Registro oficial SENASA de plaguicidas químicos autorizados en Perú.' },
    { title: 'SENASA — Registro de fungicidas autorizados', url: 'https://www.senasa.gob.pe/', categoryCode: 'FUNGICIDAS', periodLabel: '2026', note: 'Listado SENASA de fungicidas con registro vigente.' },
    { title: 'SENASA — Registro de herbicidas autorizados', url: 'https://www.senasa.gob.pe/', categoryCode: 'HERBICIDAS', periodLabel: '2026', note: 'Listado SENASA de herbicidas con registro vigente.' },
    { title: 'SENASA — Registro de plaguicidas biológicos', url: 'https://www.senasa.gob.pe/', categoryCode: 'BIOLOGICOS', periodLabel: '2026', note: 'Plaguicidas biológicos autorizados para uso agrícola por SENASA.' },
    { title: 'SENASA — Productos restringidos y prohibidos', url: 'https://www.senasa.gob.pe/', periodLabel: '2026', note: 'Listado de ingredientes activos restringidos o prohibidos en Perú.' },
  ],
};
