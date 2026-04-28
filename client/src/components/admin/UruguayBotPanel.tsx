import { useEffect, useState } from 'react';
import { uruguayBotApi } from '../../services/api';
import {
  Clock, Save, Play, RefreshCw, Loader2, CheckCircle2, AlertCircle,
  FolderOpen, Calendar, FileSpreadsheet, ExternalLink, Zap,
  Power, History,
} from 'lucide-react';

interface BotConfig {
  enabled: boolean;
  scheduleHour: number;
  scheduleMinute: number;
  timezone: string;
  sharepointUrl: string;
  lastUpdate: string | null;
  lastUpdatedBy: string | null;
  scheduler?: {
    running: boolean;
    nextRunAt: string | null;
    lastTickAt: string | null;
  };
}

interface RunRow {
  run_id: number;
  triggered_at: string;
  triggered_by: string;
  trigger_type: 'auto' | 'manual' | 'range';
  date_from: string;
  date_to: string;
  status: 'RUNNING' | 'SUCCESS' | 'FAILED';
  rows_processed: number | null;
  excel_file_name: string | null;
  sharepoint_url: string | null;
  error_message: string | null;
  duration_ms: number | null;
  finished_at: string | null;
}

interface DataInfo { desde: string | null; hasta: string | null; filas: number; }

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function yesterdayStr(): string {
  const d = new Date(Date.now() - 24 * 3600 * 1000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function UruguayBotPanel() {
  const [cfg, setCfg] = useState<BotConfig | null>(null);
  const [info, setInfo] = useState<DataInfo | null>(null);
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [loading, setLoading] = useState(true);

  // Form state (config)
  const [enabled, setEnabled] = useState(false);
  const [hour, setHour] = useState(7);
  const [minute, setMinute] = useState(0);
  const [spUrl, setSpUrl] = useState('');

  // Run-now form
  const [runFrom, setRunFrom] = useState(yesterdayStr());
  const [runTo, setRunTo] = useState(yesterdayStr());

  // Toast
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);

  useEffect(() => { void loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const [c, i, r] = await Promise.all([
        uruguayBotApi.getConfig(),
        uruguayBotApi.dataInfo().catch(() => ({ data: { data: null } })),
        uruguayBotApi.getRuns(50).catch(() => ({ data: { data: [] } })),
      ]);
      const conf: BotConfig = c.data.data;
      setCfg(conf);
      setEnabled(conf.enabled);
      setHour(conf.scheduleHour);
      setMinute(conf.scheduleMinute);
      setSpUrl(conf.sharepointUrl || '');
      setInfo(i.data.data || null);
      setRuns(r.data.data || []);
    } catch (e: any) {
      setToast({ kind: 'err', msg: e?.response?.data?.message || e.message });
    } finally {
      setLoading(false);
    }
  }

  async function saveConfig() {
    setSaving(true);
    try {
      await uruguayBotApi.saveConfig({
        enabled, scheduleHour: hour, scheduleMinute: minute, sharepointUrl: spUrl,
      });
      setToast({ kind: 'ok', msg: 'Configuración guardada · scheduler re-agendado' });
      await loadAll();
    } catch (e: any) {
      setToast({ kind: 'err', msg: e?.response?.data?.message || e.message });
    } finally {
      setSaving(false);
    }
  }

  async function runNow() {
    setRunning(true);
    try {
      const r = await uruguayBotApi.run(runFrom, runTo);
      const data = r.data.data;
      if (r.data.success) {
        setToast({ kind: 'ok', msg: `Ejecutado · ${data.rowsProcessed} filas · ${data.perMonth?.length || 0} archivo(s)` });
      } else {
        setToast({ kind: 'err', msg: data.errorMessage || 'Error en ejecución' });
      }
      await loadAll();
    } catch (e: any) {
      setToast({ kind: 'err', msg: e?.response?.data?.message || e.message });
    } finally {
      setRunning(false);
    }
  }

  async function testSharePoint() {
    try {
      const r = await uruguayBotApi.resolveSharePoint(spUrl);
      const d = r.data.data;
      setToast({ kind: 'ok', msg: `SP OK · Site: ${d.siteName} · Carpeta: ${d.folderPath}` });
    } catch (e: any) {
      setToast({ kind: 'err', msg: e?.response?.data?.message || e.message });
    }
  }

  if (loading || !cfg) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
      </div>
    );
  }

  const trMap: Record<string, { label: string; cls: string }> = {
    auto:   { label: 'Automático', cls: 'bg-blue-100 text-blue-700' },
    manual: { label: 'Manual',     cls: 'bg-amber-100 text-amber-700' },
    range:  { label: 'Rango',      cls: 'bg-purple-100 text-purple-700' },
  };
  const stMap: Record<string, { label: string; cls: string }> = {
    SUCCESS: { label: '✓ OK',     cls: 'bg-brand-100 text-brand-700' },
    FAILED:  { label: '✗ Falló',  cls: 'bg-red-100 text-red-700' },
    RUNNING: { label: '… Corriendo', cls: 'bg-gray-100 text-gray-700' },
  };

  return (
    <div className="space-y-6">
      {/* Header / scheduler status */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-brand-600" />
              Bot Venta Diaria Uruguay
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              Genera diariamente un Excel <code className="bg-gray-100 px-1 rounded text-xs">YYYY-MM.xlsx</code> con
              la venta de Point Andina Perú y lo deja en SharePoint Uruguay.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold
              ${cfg.scheduler?.running
                ? 'bg-brand-50 text-brand-700 border border-brand-200'
                : 'bg-gray-100 text-gray-600'}`}>
              <Power className="w-3.5 h-3.5" />
              Scheduler {cfg.scheduler?.running ? 'activo' : 'detenido'}
            </span>
            {cfg.scheduler?.nextRunAt && (
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-gray-50 text-gray-700 border border-gray-200">
                <Clock className="w-3.5 h-3.5" />
                Próx: {new Date(cfg.scheduler.nextRunAt).toLocaleString('es-PE')}
              </span>
            )}
          </div>
        </div>

        {/* Info datos */}
        {info && (
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-gray-500">Filas en vista</div>
              <div className="font-bold text-gray-900 text-lg">{info.filas?.toLocaleString('es-PE') || 0}</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-gray-500">Desde</div>
              <div className="font-bold text-gray-900 text-lg">{info.desde || '—'}</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-gray-500">Hasta</div>
              <div className="font-bold text-gray-900 text-lg">{info.hasta || '—'}</div>
            </div>
          </div>
        )}
      </div>

      {/* Config */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6">
        <h4 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Clock className="w-4 h-4 text-brand-600" /> Configuración del scheduler
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <label className="flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100">
            <input
              type="checkbox"
              checked={enabled}
              onChange={e => setEnabled(e.target.checked)}
              className="w-5 h-5 accent-brand-500"
            />
            <div>
              <div className="font-semibold text-sm text-gray-900">Bot habilitado</div>
              <div className="text-xs text-gray-500">Procesa el día anterior</div>
            </div>
          </label>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Hora ejecución (Lima)</label>
            <div className="flex gap-2">
              <select
                value={hour}
                onChange={e => setHour(parseInt(e.target.value))}
                className="input-field text-sm flex-1"
              >
                {Array.from({ length: 24 }, (_, i) => (
                  <option key={i} value={i}>{String(i).padStart(2, '0')}</option>
                ))}
              </select>
              <span className="self-center text-gray-400">:</span>
              <select
                value={minute}
                onChange={e => setMinute(parseInt(e.target.value))}
                className="input-field text-sm flex-1"
              >
                {[0, 15, 30, 45].map(m => (
                  <option key={m} value={m}>{String(m).padStart(2, '0')}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex items-end">
            <button onClick={saveConfig} disabled={saving} className="btn-primary w-full">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Guardar configuración
            </button>
          </div>
        </div>

        <div className="mt-4">
          <label className="block text-xs font-semibold text-gray-600 mb-1.5">
            URL SharePoint (carpeta destino)
          </label>
          <div className="flex gap-2">
            <input
              type="url"
              value={spUrl}
              onChange={e => setSpUrl(e.target.value)}
              placeholder="https://pointamericas.sharepoint.com/Uruguay/..."
              className="input-field text-sm flex-1 font-mono text-xs"
            />
            <button onClick={testSharePoint} className="btn-secondary text-sm whitespace-nowrap">
              <FolderOpen className="w-4 h-4" /> Probar acceso
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Copia la URL desde el navegador (incluyendo <code className="bg-gray-100 px-1 rounded">?id=…</code> de la vista AllItems).
          </p>
        </div>
      </div>

      {/* Run on demand */}
      <div className="bg-gradient-to-br from-amber-50 to-yellow-50 rounded-2xl border border-amber-200 p-4 sm:p-6">
        <h4 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-600" /> Ejecutar a demanda
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Desde</label>
            <input
              type="date"
              value={runFrom}
              onChange={e => setRunFrom(e.target.value)}
              className="input-field text-sm w-full"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Hasta</label>
            <input
              type="date"
              value={runTo}
              onChange={e => setRunTo(e.target.value)}
              className="input-field text-sm w-full"
            />
          </div>
          <div className="flex items-end gap-1">
            <button
              onClick={() => { setRunFrom(yesterdayStr()); setRunTo(yesterdayStr()); }}
              className="btn-secondary text-xs flex-1" type="button"
              title="Ayer"
            >
              D-1
            </button>
            <button
              onClick={() => { setRunFrom(todayStr()); setRunTo(todayStr()); }}
              className="btn-secondary text-xs flex-1" type="button"
              title="Hoy"
            >
              Hoy
            </button>
          </div>
          <div className="flex items-end">
            <button onClick={runNow} disabled={running} className="btn-primary w-full">
              {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              {running ? 'Procesando…' : 'Ejecutar ahora'}
            </button>
          </div>
        </div>
        <p className="text-xs text-amber-700 mt-3 flex items-start gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          Si el rango cubre varios meses se generará/actualizará un archivo por mes. Las filas existentes en
          el rango procesado se reemplazan con las nuevas (idempotente).
        </p>
      </div>

      {/* Historial */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <History className="w-4 h-4 text-brand-600" /> Historial de ejecuciones
          </h4>
          <button onClick={loadAll} className="btn-secondary text-xs">
            <RefreshCw className="w-3.5 h-3.5" /> Recargar
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 text-gray-600 uppercase">
              <tr>
                <th className="text-left p-2 font-semibold">Fecha ejecución</th>
                <th className="text-left p-2 font-semibold">Por</th>
                <th className="text-left p-2 font-semibold">Tipo</th>
                <th className="text-left p-2 font-semibold">Rango</th>
                <th className="text-left p-2 font-semibold">Estado</th>
                <th className="text-right p-2 font-semibold">Filas</th>
                <th className="text-left p-2 font-semibold">Archivo</th>
                <th className="text-right p-2 font-semibold">Duración</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {runs.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center p-6 text-gray-400 italic">
                    Sin ejecuciones aún. Ejecuta el bot a demanda o espera a la próxima ejecución.
                  </td>
                </tr>
              )}
              {runs.map(r => (
                <tr key={r.run_id} className="hover:bg-gray-50">
                  <td className="p-2 font-mono text-gray-700">
                    {new Date(r.triggered_at).toLocaleString('es-PE')}
                  </td>
                  <td className="p-2 text-gray-700">{r.triggered_by}</td>
                  <td className="p-2">
                    <span className={`px-1.5 py-0.5 rounded font-semibold ${trMap[r.trigger_type]?.cls || ''}`}>
                      {trMap[r.trigger_type]?.label || r.trigger_type}
                    </span>
                  </td>
                  <td className="p-2 text-gray-700">
                    {r.date_from === r.date_to ? r.date_from?.substring(0, 10) :
                      `${r.date_from?.substring(0, 10)} → ${r.date_to?.substring(0, 10)}`}
                  </td>
                  <td className="p-2">
                    <span className={`px-1.5 py-0.5 rounded font-semibold ${stMap[r.status]?.cls || ''}`}>
                      {stMap[r.status]?.label || r.status}
                    </span>
                    {r.error_message && (
                      <span className="block text-[10px] text-red-600 mt-0.5 truncate max-w-[280px]" title={r.error_message}>
                        {r.error_message}
                      </span>
                    )}
                  </td>
                  <td className="p-2 text-right font-mono text-gray-700">
                    {r.rows_processed?.toLocaleString('es-PE') || '—'}
                  </td>
                  <td className="p-2">
                    {r.sharepoint_url ? (
                      <a href={r.sharepoint_url} target="_blank" rel="noreferrer"
                        className="text-brand-600 hover:text-brand-800 flex items-center gap-1">
                        {r.excel_file_name}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : <span className="text-gray-400">—</span>}
                  </td>
                  <td className="p-2 text-right text-gray-500">
                    {r.duration_ms ? `${(r.duration_ms / 1000).toFixed(1)}s` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2
          ${toast.kind === 'ok' ? 'bg-brand-600 text-white' : 'bg-red-600 text-white'}`}>
          {toast.kind === 'ok' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          <span className="text-sm font-medium">{toast.msg}</span>
          <button onClick={() => setToast(null)} className="ml-2 opacity-70 hover:opacity-100">×</button>
        </div>
      )}
    </div>
  );
}
