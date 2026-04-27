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

// Registro centralizado
const COLLECTORS: BaseCollector[] = [
  new SieaIndexCollector(),
  new SieaSuperficieCollector(),
  new MidagriAnuariosCollector(),
  new IneiEnaCollector(),
  new DatosAbiertosEnaCollector(),
  new SenasaRootCollector(),
  new SenasaReportesCollector(),
  new SenasaSigiaCollector(),
  new PointAndinaCatCollector(),
  new BaselineCropsCollector(),
  new BaselineCropsExtendedCollector(),
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
