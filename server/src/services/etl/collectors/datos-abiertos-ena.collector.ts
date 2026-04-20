// ============================================================
// Datos Abiertos Perú - ENA 2024
// Fase 3: detecta recursos + DESCARGA Y PARSEA el primer CSV disponible
// ============================================================

import { BaseCollector, extractLinks, classifyDocumentType } from './base.collector';
import { CollectorContext, CollectorResult, ParsedSnapshot, Frequency } from '../types';
import { CatalogMaps, detectCrop, detectRegion, parseHectares } from '../normalizers';
import { scoreSnapshot } from '../scoring';
import { fetchText } from '../http';
import { fetchAndParseCsv } from '../parsers/csv';

const URL = 'https://datosabiertos.gob.pe/dataset/encuesta-nacional-agropecuaria-ena-2024-instituto-nacional-de-estad%C3%ADstica-e-inform%C3%A1tica-inei';
const MAX_CSV_ROWS = 500;

export class DatosAbiertosEnaCollector extends BaseCollector {
  readonly sourceCode = 'DATOS_ABIERTOS_ENA';
  readonly pipelineName = 'datos-abiertos-ena-collector';
  readonly frequency: Frequency = 'weekly';
  readonly description = 'Dataset ENA 2024 en Datos Abiertos Perú - parsea primer CSV detectado';

  async run(_ctx: CollectorContext, maps: CatalogMaps): Promise<CollectorResult> {
    const snapshots: ParsedSnapshot[] = [];

    const html = await fetchText(URL, { timeout: 30000 });
    const links = extractLinks(html, URL);

    const relevant = links.filter(l =>
      /resource|\.csv|\.xlsx|\.xls|\.json|download/i.test(l.href) ||
      /descargar|recurso|datos/i.test(l.text)
    );

    // Catalogación básica
    for (const l of relevant.slice(0, 30)) {
      const type = classifyDocumentType(l.href) || 'dataset';

      snapshots.push(scoreSnapshot({
        documentTitle: (l.text || 'Recurso dataset ENA 2024').substring(0, 380),
        documentUrl: l.href.substring(0, 790),
        documentType: type,
        periodLabel: 'ENA 2024',
        businessNote: 'Recurso dataset ENA 2024 - Datos Abiertos Perú.',
      }));
    }

    // Fase 3: descarga y parsea el primer CSV
    const csvLink = relevant.find(l => /\.csv($|\?)/i.test(l.href));
    if (csvLink) {
      const csv = await fetchAndParseCsv(csvLink.href, 5_000_000, MAX_CSV_ROWS);
      if (csv && csv.headers.length > 0) {
        // Intenta detectar columnas relevantes
        const hLower = csv.headers.map(h => h.toLowerCase());
        const regionIdx = hLower.findIndex(h => /departamento|region|dpto/i.test(h));
        const cropIdx = hLower.findIndex(h => /cultivo|producto|especie/i.test(h));
        const haIdx = hLower.findIndex(h => /hectarea|superficie|ha\b/i.test(h));

        // Procesa primeras N filas útiles
        for (const row of csv.rows.slice(0, 100)) {
          const regionText = regionIdx >= 0 ? Object.values(row)[regionIdx] : '';
          const cropText = cropIdx >= 0 ? Object.values(row)[cropIdx] : '';
          const haText = haIdx >= 0 ? Object.values(row)[haIdx] : '';
          const text = `${regionText} ${cropText} ${haText}`;

          const region = detectRegion(regionText || text, maps);
          const crop = detectCrop(cropText || text, maps);
          const hectares = haText ? parseHectares(haText) : null;

          if (!region && !crop) continue;

          snapshots.push(scoreSnapshot({
            documentTitle: `ENA 2024 - ${cropText || ''} ${regionText || ''}`.substring(0, 380).trim(),
            documentUrl: csvLink.href,
            documentType: 'csv',
            periodLabel: 'ENA 2024',
            cropCode: crop ? findCodeById(maps.cropByCode, crop) : null,
            regionCode: region ? findCodeById(maps.regionByCode, region) : null,
            hectares: hectares || null,
            businessNote: `Fila CSV ENA 2024 - columnas: ${Object.keys(row).slice(0, 6).join(', ')}`,
          }));
        }

        // Guarda metadata del CSV como snapshot
        snapshots.push(scoreSnapshot({
          documentTitle: `Dataset ENA 2024 - ${csv.headers.length} columnas, ${csv.totalRows} filas`.substring(0, 380),
          documentUrl: csvLink.href,
          documentType: 'csv',
          periodLabel: 'ENA 2024',
          businessNote: `Columnas: ${csv.headers.slice(0, 10).join(', ')}${csv.headers.length > 10 ? '...' : ''}`,
        }));
      }
    }

    return {
      recordsRead: links.length,
      recordsInserted: 0, recordsUpdated: 0, recordsSkipped: 0,
      status: 'SUCCESS', snapshots,
    };
  }
}

function findCodeById(map: Map<string, number>, id: number): string | null {
  for (const [k, v] of map) if (v === id) return k;
  return null;
}
