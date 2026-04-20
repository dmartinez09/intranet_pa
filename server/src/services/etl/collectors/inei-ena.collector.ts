// ============================================================
// INEI - Encuesta Nacional Agropecuaria (ENA)
// Fase 3: DESCARGA Y PARSING del PDF oficial para extraer cifras clave
// ============================================================

import { BaseCollector, extractLinks, classifyDocumentType } from './base.collector';
import { CollectorContext, CollectorResult, ParsedSnapshot, Frequency } from '../types';
import { CatalogMaps, detectCrop, detectRegion } from '../normalizers';
import { scoreSnapshot } from '../scoring';
import { fetchText } from '../http';
import { fetchAndParsePdf, extractHectareMentions } from '../parsers/pdf';

const URL = 'https://www.gob.pe/institucion/inei/informes-publicaciones/6879473-productores-agropecuarios-principales-resultados-de-la-encuesta-nacional-agropecuaria-ena-2018-2019-y-2022-2024';

export class IneiEnaCollector extends BaseCollector {
  readonly sourceCode = 'INEI_ENA';
  readonly pipelineName = 'inei-ena-collector';
  readonly frequency: Frequency = 'weekly';
  readonly description = 'ENA INEI - extrae cifras clave del PDF oficial (productores, superficie, hectáreas por cultivo/región)';

  async run(_ctx: CollectorContext, maps: CatalogMaps): Promise<CollectorResult> {
    const snapshots: ParsedSnapshot[] = [];

    const html = await fetchText(URL, { timeout: 30000 });
    const links = extractLinks(html, URL);

    const pdfs = links.filter(l =>
      (l.href.includes('cdn.www.gob.pe') && l.href.endsWith('.pdf')) ||
      /\.pdf($|\?)/i.test(l.href)
    );

    // Catalogación básica
    for (const l of pdfs.slice(0, 20)) {
      const periodMatch = l.text.match(/ENA\s*(\d{4}(?:-\d{4})?)/i) ||
                          l.text.match(/(\d{4})\s*-\s*(\d{4})/);
      const period = periodMatch ? periodMatch[0] : 'ENA 2022-2024';

      snapshots.push(scoreSnapshot({
        documentTitle: l.text.substring(0, 380) || 'ENA - Encuesta Nacional Agropecuaria',
        documentUrl: l.href.substring(0, 790),
        documentType: classifyDocumentType(l.href) || 'pdf',
        periodLabel: period,
        businessNote: 'Resultados ENA - productores agropecuarios y caracterización de unidades.',
      }));
    }

    // Fase 3: parsea el primer PDF de la ENA
    const firstPdf = pdfs.find(l => /\.pdf($|\?)/i.test(l.href));
    if (firstPdf) {
      const pdf = await fetchAndParsePdf(firstPdf.href);
      if (pdf?.text) {
        // Extrae cifras de hectáreas con contexto
        const haMentions = extractHectareMentions(pdf.text).slice(0, 15);
        for (const m of haMentions) {
          const crop = detectCrop(m.context, maps);
          const region = detectRegion(m.context, maps);
          if (!crop && !region) continue;

          snapshots.push(scoreSnapshot({
            documentTitle: `ENA - ${m.raw}${region ? ` en ${region}` : ''}`.substring(0, 380),
            documentUrl: firstPdf.href,
            documentType: 'pdf',
            periodLabel: 'ENA 2022-2024',
            cropCode: crop ? findCodeById(maps.cropByCode, crop) : null,
            regionCode: region ? findCodeById(maps.regionByCode, region) : null,
            hectares: m.value,
            businessNote: `Extracto ENA: "${m.context.substring(0, 300)}"`,
          }));
        }

        // Búsqueda específica: número de productores agropecuarios
        const productoresMatch = pdf.text.match(/([\d]{1,3}(?:[.,]\d{3})+)\s*(?:productores|unidades agropecuarias|UA)/i);
        if (productoresMatch) {
          const numStr = productoresMatch[1].replace(/[.,]/g, '');
          const num = parseInt(numStr, 10);
          if (!isNaN(num)) {
            snapshots.push(scoreSnapshot({
              documentTitle: `ENA - ${num.toLocaleString('es-PE')} productores agropecuarios`.substring(0, 380),
              documentUrl: firstPdf.href,
              documentType: 'pdf',
              periodLabel: 'ENA 2022-2024',
              productionValue: num,
              businessNote: `Total de productores reportados en resultados ENA.`,
            }));
          }
        }
      }
    }

    return {
      recordsRead: pdfs.length,
      recordsInserted: 0, recordsUpdated: 0, recordsSkipped: 0,
      status: 'SUCCESS', snapshots,
    };
  }
}

function findCodeById(map: Map<string, number>, id: number): string | null {
  for (const [k, v] of map) if (v === id) return k;
  return null;
}
