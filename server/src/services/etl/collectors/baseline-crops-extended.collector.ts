// ============================================================
// Baseline Peru Crops EXTENDED Collector
// Amplía la cobertura agregando 18 cultivos comerciales adicionales
// con superficies por departamento basadas en MIDAGRI/SIEA 2023-2024.
//
// Cobertura: cultivos exportables (Esparrago, Palta, Cacao, Mango,
// Quinua, Arandano), tradicionales (Cana de Azucar, Algodon),
// andinos (Quinua), forrajeros (Alfalfa) y de subsistencia (Yuca, Camote).
// ============================================================

import { BaseCollector } from './base.collector';
import { CollectorContext, CollectorResult, ParsedSnapshot, Frequency } from '../types';
import { CatalogMaps, fold } from '../normalizers';
import { scoreSnapshot } from '../scoring';

// [cropCode, deptName, hectares] — datos representativos MIDAGRI 2023-2024
const BASELINE_EXT: Array<[string, string, number]> = [
  // ESPARRAGO — exportador líder mundial
  ['ESPARRAGO', 'La Libertad', 14500],
  ['ESPARRAGO', 'Ica',          11800],
  ['ESPARRAGO', 'Lima',          2200],
  ['ESPARRAGO', 'Ancash',        1500],
  ['ESPARRAGO', 'Lambayeque',     900],

  // CACAO — auge en selva
  ['CACAO', 'San Martin',  62000],
  ['CACAO', 'Junin',       21000],
  ['CACAO', 'Ucayali',     18000],
  ['CACAO', 'Cusco',       16000],
  ['CACAO', 'Huanuco',     14000],
  ['CACAO', 'Amazonas',     8000],
  ['CACAO', 'Ayacucho',     6500],
  ['CACAO', 'Pasco',        4500],
  ['CACAO', 'Loreto',       3200],

  // PLATANO — principal cultivo selva
  ['PLATANO', 'San Martin', 48000],
  ['PLATANO', 'Loreto',     38000],
  ['PLATANO', 'Ucayali',    28000],
  ['PLATANO', 'Junin',      22000],
  ['PLATANO', 'Piura',      14000],
  ['PLATANO', 'Tumbes',      6500],
  ['PLATANO', 'Lambayeque',  4200],

  // MANGO — exportador (Piura concentra 70%)
  ['MANGO', 'Piura',       28000],
  ['MANGO', 'Lambayeque',   5500],
  ['MANGO', 'Ancash',       3200],
  ['MANGO', 'Lima',         2100],
  ['MANGO', 'Cajamarca',    1500],

  // QUINUA — granos andinos (líder mundial)
  ['QUINUA', 'Puno',       40000],
  ['QUINUA', 'Junin',      11000],
  ['QUINUA', 'Apurimac',    8500],
  ['QUINUA', 'Ayacucho',    7800],
  ['QUINUA', 'Cusco',       6500],
  ['QUINUA', 'Huancavelica',3200],
  ['QUINUA', 'Arequipa',    2500],

  // CANA DE AZUCAR — agroindustrial costa norte/centro
  ['CANA_AZUCAR', 'La Libertad', 30000],
  ['CANA_AZUCAR', 'Lambayeque',  28000],
  ['CANA_AZUCAR', 'Lima',        15000],
  ['CANA_AZUCAR', 'Ancash',       6800],
  ['CANA_AZUCAR', 'Arequipa',     3500],

  // ALGODON — caída histórica pero relevante
  ['ALGODON', 'Ica',         8500],
  ['ALGODON', 'Piura',       6000],
  ['ALGODON', 'Lima',        3200],
  ['ALGODON', 'Lambayeque',  2100],
  ['ALGODON', 'Ancash',      1500],

  // PIMIENTO — exportador
  ['PIMIENTO', 'Lambayeque', 4500],
  ['PIMIENTO', 'La Libertad',2800],
  ['PIMIENTO', 'Piura',      2100],
  ['PIMIENTO', 'Ica',         900],

  // OLIVO — Tacna líder
  ['OLIVO', 'Tacna',     15000],
  ['OLIVO', 'Arequipa',   4500],
  ['OLIVO', 'Ica',        2800],
  ['OLIVO', 'Lima',       1200],

  // CEBADA — sierra
  ['CEBADA', 'Puno',        18000],
  ['CEBADA', 'Cusco',       12000],
  ['CEBADA', 'Junin',        8500],
  ['CEBADA', 'Huancavelica', 7500],
  ['CEBADA', 'Apurimac',     6500],
  ['CEBADA', 'Ayacucho',     5500],
  ['CEBADA', 'Cajamarca',    4200],

  // TRIGO — sierra
  ['TRIGO', 'La Libertad', 14000],
  ['TRIGO', 'Cusco',        12000],
  ['TRIGO', 'Cajamarca',    11000],
  ['TRIGO', 'Ancash',        8500],
  ['TRIGO', 'Apurimac',      6800],
  ['TRIGO', 'Junin',         4500],

  // FRIJOL — costa y selva
  ['FRIJOL', 'Cajamarca',  18000],
  ['FRIJOL', 'San Martin', 12000],
  ['FRIJOL', 'Lima',        8500],
  ['FRIJOL', 'La Libertad', 6500],
  ['FRIJOL', 'Piura',       4500],
  ['FRIJOL', 'Junin',       3500],

  // CAMOTE — costa
  ['CAMOTE', 'Lima',        8500],
  ['CAMOTE', 'La Libertad', 3500],
  ['CAMOTE', 'Ica',         2800],
  ['CAMOTE', 'Lambayeque',  1800],
  ['CAMOTE', 'Cajamarca',   1200],

  // YUCA — selva y costa
  ['YUCA', 'Loreto',     22000],
  ['YUCA', 'San Martin', 18000],
  ['YUCA', 'Ucayali',    14000],
  ['YUCA', 'Amazonas',    8500],
  ['YUCA', 'Junin',       6500],
  ['YUCA', 'Madre de Dios',3500],

  // ALFALFA — forraje, costa/sierra
  ['ALFALFA', 'Arequipa',  35000],
  ['ALFALFA', 'Cajamarca', 18000],
  ['ALFALFA', 'Junin',     12000],
  ['ALFALFA', 'Cusco',      8500],
  ['ALFALFA', 'Lima',       6500],
  ['ALFALFA', 'Tacna',      3500],

  // AGUAYMANTO — emergente sierra
  ['AGUAYMANTO', 'Cajamarca', 1800],
  ['AGUAYMANTO', 'Ancash',     800],
  ['AGUAYMANTO', 'Junin',      500],
  ['AGUAYMANTO', 'La Libertad',400],

  // ARANDANO — boom exportador 2018-2024
  ['ARANDANO', 'La Libertad', 11500],
  ['ARANDANO', 'Lambayeque',   4500],
  ['ARANDANO', 'Ancash',       2200],
  ['ARANDANO', 'Ica',          1500],
  ['ARANDANO', 'Lima',         1200],
  ['ARANDANO', 'Piura',         800],

  // PECANA — exportador menor
  ['PECANA', 'Ica',         3500],
  ['PECANA', 'Lima',        1200],
  ['PECANA', 'Arequipa',     800],
];

// Cultivo → categoría SENASA más usada según boletines fitosanitarios
const CROP_TO_CATEGORY: Record<string, string> = {
  ESPARRAGO:   'INSECTICIDAS',  // trips, gusano de tierra
  CACAO:       'FUNGICIDAS',    // moniliasis, escoba de bruja
  PLATANO:     'FUNGICIDAS',    // sigatoka negra
  MANGO:       'INSECTICIDAS',  // mosca de la fruta
  QUINUA:      'FUNGICIDAS',    // mildiu
  CANA_AZUCAR: 'HERBICIDAS',    // malezas competitivas
  ALGODON:     'INSECTICIDAS',  // gusano rosado
  PIMIENTO:    'FUNGICIDAS',    // antracnosis
  OLIVO:       'INSECTICIDAS',  // mosca del olivo
  CEBADA:      'HERBICIDAS',    // malezas
  TRIGO:       'HERBICIDAS',    // malezas en siembra
  FRIJOL:      'HERBICIDAS',    // malezas
  CAMOTE:      'INSECTICIDAS',  // gorgojo del camote
  YUCA:        'INSECTICIDAS',  // moscas blancas
  ALFALFA:     'INSECTICIDAS',  // pulgon
  AGUAYMANTO:  'FUNGICIDAS',    // alternariosis
  ARANDANO:    'FUNGICIDAS',    // botrytis
  PECANA:      'FUNGICIDAS',    // sarna del nogal
};

const CROP_OBSERVATION: Record<string, string> = {
  ESPARRAGO:   'Per\u00fa es el principal exportador mundial de esp\u00e1rrago. Demanda alta de insecticidas selectivos.',
  CACAO:       'Crecimiento sostenido como cultivo alternativo a coca. Selva alta concentra producci\u00f3n.',
  PLATANO:     'Cultivo de subsistencia y exportaci\u00f3n org\u00e1nica. Sigatoka negra es plaga clave.',
  MANGO:       'Piura concentra el 70% de superficie. Exportador con ventana junio-octubre.',
  QUINUA:      'Per\u00fa es l\u00edder mundial junto con Bolivia. Puno concentra el 60%.',
  CANA_AZUCAR: 'Costa norte y central. Cultivo agroindustrial con bajo intervalo entre tratamientos.',
  ALGODON:     'En recuperaci\u00f3n. Ica y Piura son los principales productores.',
  PIMIENTO:    'Conservas exportables. Lambayeque y La Libertad lideran.',
  OLIVO:       'Tacna concentra el 55%. Aceite de oliva y aceituna de mesa.',
  CEBADA:      'Cultivo de altura. Insumo cervecero y forraje.',
  TRIGO:       'Importador neto. Producci\u00f3n local en sierra para autoconsumo.',
  FRIJOL:      'Variedades canario, panamito, ca\u00f1ete. Cultivo asociado.',
  CAMOTE:      'Lima Sur concentra producci\u00f3n para mercado limeño.',
  YUCA:        'Cultivo de subsistencia en selva. Mercado interno mayoritario.',
  ALFALFA:     'Forraje principal para ganader\u00eda lechera. Arequipa l\u00edder.',
  AGUAYMANTO:  'Cultivo emergente con potencial exportador (mercado nicho org\u00e1nico).',
  ARANDANO:    'Boom exportador desde 2015. Per\u00fa es el #1 mundial en valor exportado.',
  PECANA:      'Mercado interno y exportaci\u00f3n a EE.UU. y M\u00e9xico.',
};

export class BaselineCropsExtendedCollector extends BaseCollector {
  readonly sourceCode = 'BASELINE_PE_CROPS_EXT';
  readonly pipelineName = 'baseline-peru-crops-extended-collector';
  readonly frequency: Frequency = 'on_demand';
  readonly description = 'Superficie agr\u00edcola por cultivo y dpto - 18 cultivos adicionales (esparrago, cacao, mango, arandano, quinua, etc.). Datos MIDAGRI 2023-2024.';

  async run(_ctx: CollectorContext, maps: CatalogMaps): Promise<CollectorResult> {
    const snapshots: ParsedSnapshot[] = [];
    const period = 'MIDAGRI 2023-2024';

    for (const [cropCode, deptName, hectares] of BASELINE_EXT) {
      const regionId = resolveRegion(deptName, maps);
      const cropId = maps.cropByCode.get(cropCode);
      if (!cropId || !regionId) {
        console.warn(`[Baseline-Ext] Sin match: cropCode=${cropCode} dept=${deptName}`);
        continue;
      }

      const categoryCode = CROP_TO_CATEGORY[cropCode] || null;
      const obs = CROP_OBSERVATION[cropCode] || '';

      snapshots.push(scoreSnapshot({
        documentTitle: `${formatName(cropCode)} - Superficie en ${deptName}: ${hectares.toLocaleString('es-PE')} ha`,
        documentUrl: 'https://siea.midagri.gob.pe/portal/informativos/superficie-agricola-peruana',
        documentType: 'catalog_internal',
        periodLabel: period,
        publicationDate: '2024-12-31',
        cropCode,
        regionCode: findRegionCodeByDept(deptName, maps),
        categoryCode,
        hectares,
        businessNote: `${obs} ${deptName}: ${hectares.toLocaleString('es-PE')} ha. Categor\u00eda SENASA dominante: ${categoryCode || 'N/D'}.`,
      }));
    }

    return {
      recordsRead: BASELINE_EXT.length,
      recordsInserted: 0,
      recordsUpdated: 0,
      recordsSkipped: 0,
      status: 'SUCCESS',
      snapshots,
    };
  }
}

function formatName(code: string): string {
  const map: Record<string, string> = {
    CANA_AZUCAR: 'Cana de Azucar',
    ESPARRAGO:   'Esparrago',
    AGUAYMANTO:  'Aguaymanto',
    ARANDANO:    'Arandano',
  };
  if (map[code]) return map[code];
  return code.charAt(0).toUpperCase() + code.slice(1).toLowerCase();
}

function resolveRegion(name: string, maps: CatalogMaps): number | null {
  return maps.regionByName.get(fold(name)) || null;
}

function findRegionCodeByDept(deptName: string, maps: CatalogMaps): string | null {
  const id = resolveRegion(deptName, maps);
  if (!id) return null;
  for (const [code, rid] of maps.regionByCode) if (rid === id) return code;
  return null;
}
