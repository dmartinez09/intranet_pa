// ============================================================
// SENASA - SIGIA Consulta Cultivo
// URL: https://servicios.senasa.gob.pe/SIGIAWeb/sigia_consulta_cultivo.html
// Método: scraping HTML - detección de catálogos y formularios
// ============================================================

import { BaseCollector, extractTitle } from './base.collector';
import { CollectorContext, CollectorResult, ParsedSnapshot, Frequency } from '../types';
import { CatalogMaps } from '../normalizers';
import { scoreSnapshot } from '../scoring';
import { fetchText } from '../http';

const URL = 'https://servicios.senasa.gob.pe/SIGIAWeb/sigia_consulta_cultivo.html';

export class SenasaSigiaCollector extends BaseCollector {
  readonly sourceCode = 'SENASA_SIGIA';
  readonly pipelineName = 'senasa-sigia-collector';
  readonly frequency: Frequency = 'weekly';
  readonly description = 'SENASA SIGIA consulta cultivo (catalogación del endpoint)';

  async run(_ctx: CollectorContext, _maps: CatalogMaps): Promise<CollectorResult> {
    const snapshots: ParsedSnapshot[] = [];

    try {
      const html = await fetchText(URL, { timeout: 20000 });
      const title = extractTitle(html) || 'SIGIA Consulta Cultivo';

      // Detecta opciones de <select> con cultivos (si existen)
      const selectMatch = html.match(/<select[^>]*>([\s\S]*?)<\/select>/i);
      const options: string[] = [];
      if (selectMatch) {
        const optRe = /<option[^>]*value\s*=\s*["'][^"']*["'][^>]*>([\s\S]*?)<\/option>/gi;
        let m: RegExpExecArray | null;
        while ((m = optRe.exec(selectMatch[1])) !== null) {
          const txt = m[1].replace(/<[^>]+>/g, '').trim();
          if (txt && txt.length < 60 && !/selec|todos/i.test(txt)) options.push(txt);
        }
      }

      snapshots.push(scoreSnapshot({
        documentTitle: title.substring(0, 380),
        documentUrl: URL,
        documentType: 'html',
        businessNote: options.length
          ? `Formulario SIGIA con ${options.length} cultivos disponibles: ${options.slice(0, 10).join(', ')}${options.length > 10 ? '...' : ''}`
          : 'Endpoint SIGIA catalogado (no expone API pública).',
      }));

      return {
        recordsRead: 1,
        recordsInserted: 0, recordsUpdated: 0, recordsSkipped: 0,
        status: 'SUCCESS', snapshots,
      };
    } catch (err: any) {
      // Si falla, registra un snapshot con el estado
      snapshots.push(scoreSnapshot({
        documentTitle: 'SIGIA Consulta Cultivo (no accesible)',
        documentUrl: URL,
        documentType: 'html',
        businessNote: `Endpoint inaccesible: ${err?.message || 'error'}. Requiere validación manual.`,
      }));
      return {
        recordsRead: 0,
        recordsInserted: 0, recordsUpdated: 0, recordsSkipped: 0,
        status: 'PARTIAL', snapshots,
        errorMessage: err?.message,
      };
    }
  }
}
