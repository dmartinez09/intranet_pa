// ============================================================
// Panel compartido: Fuentes Externas COMEX / Competidores
// Usado al pie de todas las sub-páginas de Competidores
// (Dashboard, Partidas, Competidores, Mapa Flujos)
// ============================================================

import { useEffect, useState } from 'react';
import { comexApi } from '../services/api';
import { Globe, ExternalLink } from 'lucide-react';

interface SourceRow {
  source_id: number;
  source_code: string;
  source_name: string;
  source_url: string;
  source_owner: string | null;
  source_type: string;
  extraction_method: string;
  last_run_at: string | null;
  last_run_status: string | null;
  last_run_records: number | null;
}

export default function ComexSourcesPanel() {
  const [sources, setSources] = useState<SourceRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    comexApi.getSources()
      .then(res => { if (active) setSources(res.data.data || []); })
      .catch(err => console.error('[ComexSourcesPanel] error:', err))
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  return (
    <div className="chart-container">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-500 to-slate-700 flex items-center justify-center">
            <Globe className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-base font-bold text-gray-900">Fuentes Externas — COMEX / Competidores</h3>
            <p className="text-xs text-gray-400">
              Trazabilidad de origen: instituciones peruanas públicas consultadas · {sources.length} fuentes activas
            </p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="w-6 h-6 border-4 border-brand-200 border-t-brand-500 rounded-full animate-spin" />
        </div>
      ) : sources.length === 0 ? (
        <div className="text-center py-8 text-gray-400 text-sm">Sin fuentes configuradas.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="table-modern">
            <thead>
              <tr>
                <th>Fuente</th>
                <th>Institución</th>
                <th>Tipo</th>
                <th>Método</th>
                <th>Última Ejecución</th>
                <th>Estado</th>
                <th className="text-right">Registros</th>
                <th>URL</th>
              </tr>
            </thead>
            <tbody>
              {sources.map(s => (
                <tr key={s.source_id}>
                  <td className="font-semibold text-sm">{s.source_name}</td>
                  <td className="text-gray-500 text-xs">{s.source_owner || '—'}</td>
                  <td>
                    <span className="badge bg-gray-100 text-gray-700 text-[10px]">{s.source_type}</span>
                  </td>
                  <td className="text-xs text-gray-500">{s.extraction_method}</td>
                  <td className="text-xs">
                    {s.last_run_at
                      ? new Date(s.last_run_at).toLocaleString('es-PE')
                      : <span className="text-gray-400">Sin ejecuciones</span>}
                  </td>
                  <td>
                    {s.last_run_status ? (
                      <span className={`badge text-[10px] ${
                        s.last_run_status === 'SUCCESS' ? 'badge-success' :
                        s.last_run_status === 'FAILED' ? 'badge-danger' :
                        'badge-warning'
                      }`}>{s.last_run_status}</span>
                    ) : <span className="text-gray-400 text-xs">—</span>}
                  </td>
                  <td className="text-right font-mono text-sm">
                    {s.last_run_records != null ? s.last_run_records.toLocaleString('es-PE') : '—'}
                  </td>
                  <td>
                    <a
                      href={s.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-brand-600 hover:text-brand-800 inline-flex items-center gap-1 text-xs"
                      title={s.source_url}
                    >
                      Abrir <ExternalLink className="w-3 h-3" />
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-gray-100 text-xs text-gray-500 leading-relaxed">
        <p className="font-semibold text-gray-600 mb-1">Notas de trazabilidad:</p>
        <ul className="list-disc ml-5 space-y-0.5">
          <li>Los datos de importaciones provienen exclusivamente de fuentes peruanas públicas.</li>
          <li>No se cruza información con SAP ni otros módulos internos.</li>
          <li>El baseline representativo (<span className="font-mono">BASELINE_PE_COMEX</span>) se nutre de órdenes de magnitud públicos conocidos (SUNAT/ADEX) hasta que los collectors reales maduren.</li>
          <li>Las fuentes "sin ejecuciones" están registradas en el catálogo pero su collector está pendiente (Fase 2 COMEX).</li>
          <li>Todas las ejecuciones quedan auditadas en <span className="font-mono">icb_etl_run_log</span>.</li>
        </ul>
      </div>
    </div>
  );
}
