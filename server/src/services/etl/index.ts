// ============================================================
// ETL Manager - registry + orquestador público
// ============================================================

import { BaseCollector } from './collectors/base.collector';
import { runCollector, etlTablesReady } from './runner';
import { CollectorResult, Frequency } from './types';

// Registry
import { SieaIndexCollector } from './collectors/siea-index.collector';
import { SieaSuperficieCollector } from './collectors/siea-superficie.collector';
import { MidagriAnuariosCollector } from './collectors/midagri-anuarios.collector';
import { IneiEnaCollector } from './collectors/inei-ena.collector';
import { DatosAbiertosEnaCollector } from './collectors/datos-abiertos-ena.collector';
import { SenasaRootCollector } from './collectors/senasa-root.collector';
import { SenasaReportesCollector } from './collectors/senasa-reportes.collector';
import { SenasaSigiaCollector } from './collectors/senasa-sigia.collector';
import { PointAndinaCatCollector } from './collectors/point-andina-cat.collector';
import { BaselineCropsCollector } from './collectors/baseline-crops.collector';
import { BaselineCropsExtendedCollector } from './collectors/baseline-crops-extended.collector';
import { CuratedSourceCollector, CURATED_DATASETS } from './collectors/curated-source.collector';

// Helper para crear collectors curados
function curated(sourceCode: string, pipelineName: string, description: string, frequency: Frequency = 'weekly') {
  return new CuratedSourceCollector({
    sourceCode, pipelineName, description, frequency,
    snapshots: CURATED_DATASETS[sourceCode] || [],
  });
}

// Registro centralizado
const COLLECTORS: BaseCollector[] = [
  // Agri scrapers (intentan scraping; con fallback interno cuando fallan)
  new SieaIndexCollector(),
  new SieaSuperficieCollector(),
  new MidagriAnuariosCollector(),
  new IneiEnaCollector(),
  new DatosAbiertosEnaCollector(),
  new SenasaRootCollector(),
  new SenasaReportesCollector(),
  new SenasaSigiaCollector(),
  new PointAndinaCatCollector(),
  // Baselines internos (siempre SUCCESS)
  new BaselineCropsCollector(),
  new BaselineCropsExtendedCollector(),
  // COMEX + SENASA Plaguicidas — datasets curados internos
  curated('ADEX_ESTADISTICAS',     'adex-estadisticas',     'ADEX — boletines y rankings exportadores (curado interno)'),
  curated('BCR_COMEX',             'bcr-comex',             'BCRP — series de comercio exterior (curado interno)'),
  curated('CCL_COMEX',             'ccl-comex',             'CCL — reportes de comercio exterior (curado interno)'),
  curated('MINCETUR_ESTADISTICAS', 'mincetur-estadisticas', 'MINCETUR — estadísticas oficiales (curado interno)'),
  curated('INEI_COMEX',            'inei-comex',            'INEI — estadísticas de comercio exterior (curado interno)'),
  curated('DATOS_ABIERTOS_COMEX',  'datos-abiertos-comex',  'Datos abiertos PE — comercio exterior (curado interno)'),
  curated('SUNAT_ADUANET',         'sunat-aduanet',         'SUNAT Aduanet — operaciones aduaneras (curado interno)'),
  curated('SUNAT_TRANSPARENCIA',   'sunat-transparencia',   'SUNAT — transparencia aduanera (curado interno)'),
  curated('SENASA_PLAGUICIDAS',    'senasa-plaguicidas',    'SENASA — registros de plaguicidas (curado interno)'),
];

export function listCollectors(): Array<{
  sourceCode: string; pipelineName: string; frequency: Frequency; description: string;
}> {
  return COLLECTORS.map(c => ({
    sourceCode: c.sourceCode,
    pipelineName: c.pipelineName,
    frequency: c.frequency,
    description: c.description,
  }));
}

export function findCollector(sourceCode: string): BaseCollector | undefined {
  return COLLECTORS.find(c => c.sourceCode === sourceCode);
}

export async function runOne(sourceCode: string, triggeredBy = 'manual_admin'): Promise<CollectorResult> {
  const col = findCollector(sourceCode);
  if (!col) throw new Error(`Collector no encontrado: ${sourceCode}`);
  return await runCollector(col, triggeredBy);
}

export async function runAll(triggeredBy = 'manual_admin'): Promise<Array<{ sourceCode: string; result: CollectorResult }>> {
  const results: Array<{ sourceCode: string; result: CollectorResult }> = [];
  for (const c of COLLECTORS) {
    try {
      const r = await runCollector(c, triggeredBy);
      results.push({ sourceCode: c.sourceCode, result: r });
    } catch (err: any) {
      results.push({
        sourceCode: c.sourceCode,
        result: {
          recordsRead: 0, recordsInserted: 0, recordsUpdated: 0, recordsSkipped: 0,
          status: 'FAILED', errorMessage: err?.message || 'unknown',
        },
      });
    }
  }
  return results;
}

export async function runByFrequency(freq: Frequency, triggeredBy: string): Promise<Array<{ sourceCode: string; result: CollectorResult }>> {
  const results: Array<{ sourceCode: string; result: CollectorResult }> = [];
  for (const c of COLLECTORS.filter(c => c.frequency === freq)) {
    try {
      const r = await runCollector(c, triggeredBy);
      results.push({ sourceCode: c.sourceCode, result: r });
    } catch (err: any) {
      results.push({
        sourceCode: c.sourceCode,
        result: {
          recordsRead: 0, recordsInserted: 0, recordsUpdated: 0, recordsSkipped: 0,
          status: 'FAILED', errorMessage: err?.message || 'unknown',
        },
      });
    }
  }
  return results;
}

export { etlTablesReady };
