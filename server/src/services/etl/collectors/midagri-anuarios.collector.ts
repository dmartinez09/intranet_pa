// ============================================================
// MIDAGRI - Anuarios de Estadísticas de Producción Agropecuaria
// URL: https://www.gob.pe/institucion/midagri/colecciones/5149-...
// Fase 3: scraping + DESCARGA Y PARSING de primer PDF de cada año
// ============================================================

import { BaseCollector, extractLinks, classifyDocumentType } from './base.collector';
import { CollectorContext, CollectorResult, ParsedSnapshot, Frequency } from '../types';
import { CatalogMaps, detectCrop, detectRegion } from '../normalizers';
import { scoreSnapshot } from '../scoring';
import { fetchText } from '../http';
import { fetchAndParsePdf, extractHectareMentions, extractProductionMentions } from '../parsers/pdf';

const URL = 'https://www.gob.pe/institucion/midagri/colecciones/5149-anuarios-estadisticas-de-produccion-agropecuaria';
const MAX_PDFS_TO_PARSE = 3;  // cap para evitar tiempos largos

export class MidagriAnuariosCollector extends BaseCollector {
  readonly sourceCode = 'MIDAGRI_ANUARIOS';
  readonly pipelineName = 'midagri-anuarios-collector';
  readonly frequency: Frequency = 'weekly';
  readonly description = 'Anuarios estadísticos de producción agropecuaria MIDAGRI - parsea los PDFs más recientes';

  async run(_ctx: CollectorContext, maps: CatalogMaps): Promise<CollectorResult> {
    const snapshots: ParsedSnapshot[] = [];

    const html = await fetchText(URL, { timeout: 30000 });
    const links = extractLinks(html, URL);

    const pdfLinks = links.filter(l => /anuario|\.pdf/i.test(l.href));

    // Catalogación básica de todos los enlaces
    for (const l of pdfLinks.slice(0, 30)) {
      const yearMatch = l.text.match(/20\d{2}/) || l.href.match(/20\d{2}/);
      const year = yearMatch ? yearMatch[0] : null;

      snapshots.push(scoreSnapshot({
        documentTitle: l.text.substring(0, 380) || `Anuario MIDAGRI ${year || ''}`,
        documentUrl: l.href.substring(0, 790),
        documentType: classifyDocumentType(l.href) || 'pdf',
        periodLabel: year ? `Anuario ${year}` : null,
        publicationDate: year ? `${year}-12-31` : null,
        businessNote: 'Anuario estadístico de producción agropecuaria MIDAGRI.',
      }));
    }

    // Fase 3: descarga y parsea los PDFs más recientes (limitado por MAX_PDFS_TO_PARSE)
    const directPdfs = pdfLinks
      .filter(l => /\.pdf($|\?)/i.test(l.href))
      .sort((a, b) => {
        const yA = a.href.match(/20\d{2}/)?.[0] || '0';
        const yB = b.href.match(/20\d{2}/)?.[0] || '0';
        return yB.localeCompare(yA);  // más reciente primero
      })
      .slice(0, MAX_PDFS_TO_PARSE);

    for (const pdfLink of directPdfs) {
      const pdf = await fetchAndParsePdf(pdfLink.href);
      if (!pdf || !pdf.text) continue;

      const yearMatch = pdfLink.text.match(/20\d{2}/) || pdfLink.href.match(/20\d{2}/);
      const year = yearMatch ? yearMatch[0] : null;

      // Busca menciones de hectáreas con contexto
      const haMentions = extractHectareMentions(pdf.text).slice(0, 20);
      for (const m of haMentions) {
        const crop = detectCrop(m.context, maps);
        const region = detectRegion(m.context, maps);
        // Sólo genera snapshot si pudo detectar cultivo O región
        if (!crop && !region) continue;

        snapshots.push(scoreSnapshot({
          documentTitle: `${pdf.title || 'Anuario'} - ${m.raw}`.substring(0, 380),
          documentUrl: pdfLink.href,
          documentType: 'pdf',
          periodLabel: year ? `Anuario ${year}` : null,
          publicationDate: year ? `${year}-12-31` : null,
          cropCode: crop ? findCodeById(maps.cropByCode, crop) : null,
          regionCode: region ? findCodeById(maps.regionByCode, region) : null,
          hectares: m.value,
          businessNote: `Extraído del PDF: "${m.context.substring(0, 300)}"`,
        }));
      }

      // Menciones de producción
      const prodMentions = extractProductionMentions(pdf.text).slice(0, 10);
      for (const m of prodMentions) {
        const crop = detectCrop(m.context, maps);
        if (!crop) continue;

        snapshots.push(scoreSnapshot({
          documentTitle: `${pdf.title || 'Anuario'} - Producción ${m.raw}`.substring(0, 380),
          documentUrl: pdfLink.href,
          documentType: 'pdf',
          periodLabel: year ? `Anuario ${year}` : null,
          cropCode: findCodeById(maps.cropByCode, crop),
          productionValue: m.value,
          businessNote: `Producción extraída: "${m.context.substring(0, 300)}"`,
        }));
      }
    }

    return {
      recordsRead: links.length + directPdfs.length,
      recordsInserted: 0, recordsUpdated: 0, recordsSkipped: 0,
      status: 'SUCCESS', snapshots,
    };
  }
}

function findCodeById(map: Map<string, number>, id: number): string | null {
  for (const [k, v] of map) if (v === id) return k;
  return null;
}
