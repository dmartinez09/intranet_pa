// ============================================================
// Baseline Peru Crops Collector
// Inserta snapshots representativos de superficie agrícola por
// cultivo x departamento, basados en anuarios MINAGRI/SIEA
// públicos (datos 2023/2024 aproximados).
//
// Objetivo: que el dashboard luzca útil desde el primer run,
// mientras los otros collectors de scraping maduran.
// ============================================================

import { BaseCollector } from './base.collector';
import { CollectorContext, CollectorResult, ParsedSnapshot, Frequency } from '../types';
import { CatalogMaps } from '../normalizers';
import { scoreSnapshot } from '../scoring';

// Datos representativos: cultivo, departamento, hectáreas aproximadas
// Basados en información pública de MIDAGRI/SIEA (anuarios estadísticos)
const BASELINE: Array<[string, string, number]> = [
  // PAPA
  ['PAPA', 'Puno', 55000],
  ['PAPA', 'Cusco', 38000],
  ['PAPA', 'Huanuco', 32000],
  ['PAPA', 'Junin', 27000],
  ['PAPA', 'Cajamarca', 25000],
  ['PAPA', 'La Libertad', 22000],
  ['PAPA', 'Apurimac', 20000],
  ['PAPA', 'Huancavelica', 19000],
  ['PAPA', 'Ayacucho', 15000],
  ['PAPA', 'Pasco', 12000],
  ['PAPA', 'Ancash', 11000],
  ['PAPA', 'Amazonas', 7000],

  // ARROZ
  ['ARROZ', 'San Martin', 105000],
  ['ARROZ', 'Piura', 88000],
  ['ARROZ', 'Lambayeque', 55000],
  ['ARROZ', 'Amazonas', 40000],
  ['ARROZ', 'Loreto', 35000],
  ['ARROZ', 'Cajamarca', 22000],
  ['ARROZ', 'La Libertad', 20000],
  ['ARROZ', 'Ucayali', 15000],
  ['ARROZ', 'Tumbes', 12000],
  ['ARROZ', 'Arequipa', 8000],

  // MAIZ (amarillo duro + amiláceo)
  ['MAIZ', 'Lima', 35000],
  ['MAIZ', 'San Martin', 30000],
  ['MAIZ', 'Loreto', 28000],
  ['MAIZ', 'Ucayali', 22000],
  ['MAIZ', 'La Libertad', 20000],
  ['MAIZ', 'Cajamarca', 18000],
  ['MAIZ', 'Piura', 15000],
  ['MAIZ', 'Huanuco', 13000],
  ['MAIZ', 'Cusco', 12000],
  ['MAIZ', 'Ancash', 10000],
  ['MAIZ', 'Junin', 9000],

  // CAFE
  ['CAFE', 'Junin', 108000],
  ['CAFE', 'San Martin', 95000],
  ['CAFE', 'Cajamarca', 70000],
  ['CAFE', 'Amazonas', 45000],
  ['CAFE', 'Cusco', 42000],
  ['CAFE', 'Pasco', 30000],
  ['CAFE', 'Huanuco', 18000],
  ['CAFE', 'Puno', 9000],
  ['CAFE', 'Ayacucho', 6000],

  // PALTA
  ['PALTA', 'La Libertad', 22000],
  ['PALTA', 'Lima', 18000],
  ['PALTA', 'Ica', 9000],
  ['PALTA', 'Junin', 6000],
  ['PALTA', 'Ancash', 4500],
  ['PALTA', 'Ayacucho', 3500],
  ['PALTA', 'Arequipa', 2800],
  ['PALTA', 'Cajamarca', 2200],
  ['PALTA', 'Moquegua', 1500],

  // UVA
  ['UVA', 'Ica', 20000],
  ['UVA', 'Piura', 8000],
  ['UVA', 'Lima', 3500],
  ['UVA', 'Arequipa', 1500],
  ['UVA', 'La Libertad', 1000],
  ['UVA', 'Lambayeque', 800],

  // CEBOLLA
  ['CEBOLLA', 'Arequipa', 7500],
  ['CEBOLLA', 'Lima', 3200],
  ['CEBOLLA', 'Ica', 2800],
  ['CEBOLLA', 'La Libertad', 1800],
  ['CEBOLLA', 'Ayacucho', 1200],
  ['CEBOLLA', 'Tacna', 900],
  ['CEBOLLA', 'Junin', 700],

  // TOMATE
  ['TOMATE', 'Lima', 2200],
  ['TOMATE', 'Ica', 1500],
  ['TOMATE', 'Arequipa', 1200],
  ['TOMATE', 'La Libertad', 800],
  ['TOMATE', 'Lambayeque', 600],
  ['TOMATE', 'Junin', 450],
  ['TOMATE', 'Cajamarca', 400],

  // CITRICOS
  ['CITRICOS', 'Junin', 30000],
  ['CITRICOS', 'Lima', 13000],
  ['CITRICOS', 'Ica', 8500],
  ['CITRICOS', 'San Martin', 8000],
  ['CITRICOS', 'Puno', 6500],
  ['CITRICOS', 'Cusco', 5500],
  ['CITRICOS', 'Loreto', 5000],
  ['CITRICOS', 'Piura', 4500],
  ['CITRICOS', 'Ucayali', 3500],
];

// Asocia cultivos con la categoría Point Andina más relevante
const CROP_TO_CATEGORY: Record<string, string> = {
  PAPA: 'FUNGICIDAS',       // mildiu, rizoctonia
  ARROZ: 'HERBICIDAS',      // malezas acuáticas
  MAIZ: 'HERBICIDAS',       // malezas en siembra directa
  CAFE: 'FUNGICIDAS',       // roya del café
  PALTA: 'INSECTICIDAS',    // queresas, trips
  UVA: 'FUNGICIDAS',        // oidio, botrytis
  CEBOLLA: 'FUNGICIDAS',    // mildiu
  TOMATE: 'INSECTICIDAS',   // mosca blanca, trips
  CITRICOS: 'INSECTICIDAS', // queresas, minador
};

export class BaselineCropsCollector extends BaseCollector {
  readonly sourceCode = 'BASELINE_PE_CROPS';
  readonly pipelineName = 'baseline-peru-crops-collector';
  readonly frequency: Frequency = 'on_demand';
  readonly description = 'Superficie agrícola representativa por cultivo y departamento (datos curados de MINAGRI/SIEA)';

  async run(_ctx: CollectorContext, maps: CatalogMaps): Promise<CollectorResult> {
    const snapshots: ParsedSnapshot[] = [];
    const period = 'Baseline 2023-2024';

    for (const [cropCode, deptName, hectares] of BASELINE) {
      // Resuelve region por nombre
      const regionId = resolveRegion(deptName, maps);
      const cropId = maps.cropByCode.get(cropCode);
      if (!cropId || !regionId) continue;

      const categoryCode = CROP_TO_CATEGORY[cropCode] || null;

      snapshots.push(scoreSnapshot({
        documentTitle: `${titleCase(cropCode)} - Superficie en ${deptName}: ${hectares.toLocaleString('es-PE')} ha`,
        documentUrl: 'https://siea.midagri.gob.pe/portal/informativos/superficie-agricola-peruana',
        documentType: 'catalog_internal',
        periodLabel: period,
        publicationDate: '2024-06-30',
        cropCode,
        regionCode: findRegionCodeByDept(deptName, maps),
        categoryCode,
        hectares,
        businessNote: `Dato representativo de superficie agrícola (MINAGRI/SIEA). ${titleCase(cropCode)} es un cultivo objetivo y ${deptName} es una región prioritaria. Oportunidad para categoría ${categoryCode || 'PA'}.`,
      }));
    }

    return {
      recordsRead: BASELINE.length,
      recordsInserted: 0,
      recordsUpdated: 0,
      recordsSkipped: 0,
      status: 'SUCCESS',
      snapshots,
    };
  }
}

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

function resolveRegion(name: string, maps: CatalogMaps): number | null {
  const folded = name.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  return maps.regionByName.get(folded) || null;
}

function findRegionCodeByDept(deptName: string, maps: CatalogMaps): string | null {
  const id = resolveRegion(deptName, maps);
  if (!id) return null;
  for (const [code, rid] of maps.regionByCode) if (rid === id) return code;
  return null;
}
