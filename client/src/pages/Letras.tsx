import { useState, useEffect, useMemo } from 'react';
import Header from '../components/layout/Header';
import { facturacionApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  Search, Download, FileText, Loader2, ScrollText, AlertCircle,
  ChevronDown, ChevronRight, Mail, Paperclip, Send, CheckCircle2, XCircle, X,
  RefreshCw, Clock, Bot, Settings, History, Play, AlertTriangle,
  Eye, User, Hand,
} from 'lucide-react';

// Resumen de envíos y aperturas por letra (cargado en bulk)
interface LetraSendSummary {
  letra_id: string;
  last_sent_at: string;
  total_sends: number;
  history_id: number;
  trigger_type: 'auto' | 'manual';
  recipients_to: string;
  recipients_cc: string | null;
  total_opens: number;
  real_opens: number;
  unique_openers: number;
  last_open_at: string | null;
}

interface LetraFile {
  id: string;
  name: string;
  letras: string[];
  facturaCode: string;
  cliente: string;
  downloadUrl: string;
  webUrl: string;
  lastModified: string;
  size: number;
}

interface Comprobante {
  id: string;
  subject: string;
  tipoDocumento: string;
  numeroDocumento: string;
  cliente: string;
  to: string[];
  cc: string[];
  destinatarios: string[];
  fechaEmision: string;
  hasAttachments: boolean;
  attachments: Array<{ id: string; name: string; size: number; contentType: string }>;
}

interface ComprobantesData {
  emails: Comprobante[];
  destinatarios: string[];
  totalComprobantes: number;
  totalAdjuntos: number;
}

interface SyncStatus {
  lastSync: string | null;
  fileCount: number;
  newTodayCount: number;
  isStale: boolean;
  syncInProgress: boolean;
  lastError: string | null;
}

interface BotConfig {
  enabled: boolean;
  sendHour: number;
  sendMinute: number;
  defaultCc: string;
  updatedBy: string | null;
  updatedAt: string | null;
  currentCron: string | null;
}

interface BotHistoryEntry {
  id: number;
  runDate: string;
  runAt: string;
  triggerType: 'auto' | 'manual';
  letraId: string;
  letraName: string;
  facturaCode: string | null;
  cliente: string | null;
  recipientsTo: string | null;
  recipientsCc: string | null;
  attachmentsQty: number;
  status: 'sent' | 'skipped' | 'failed';
  errorMessage: string | null;
}

function timeAgo(iso: string | Date | null | undefined): string {
  if (!iso) return 'nunca';
  try {
    const t = new Date(iso).getTime();
    if (isNaN(t)) return '—';
    const diff = Date.now() - t;
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'hace segundos';
    if (m < 60) return `hace ${m} min`;
    const h = Math.floor(m / 60);
    if (h < 24) return `hace ${h}h ${m % 60}m`;
    const d = Math.floor(h / 24);
    return `hace ${d}d`;
  } catch {
    return '—';
  }
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' });
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(0) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function Letras() {
  const { isAdmin } = useAuth();
  const [files, setFiles] = useState<LetraFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [comprobantesData, setComprobantesData] = useState<ComprobantesData | null>(null);
  const [loadingComprobantes, setLoadingComprobantes] = useState(false);

  // Sync status
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Bot panel (admin only)
  const [showBotPanel, setShowBotPanel] = useState(false);
  const [botConfig, setBotConfig] = useState<BotConfig | null>(null);
  const [botHistory, setBotHistory] = useState<BotHistoryEntry[]>([]);
  const [botSaving, setBotSaving] = useState(false);
  const [botRunning, setBotRunning] = useState(false);
  const [botMessage, setBotMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Send modal state
  const [sendModal, setSendModal] = useState<{ letra: LetraFile; comprobantes: ComprobantesData } | null>(null);
  const [sendTo, setSendTo] = useState('');
  const [sendCc, setSendCc] = useState('');
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ success: boolean; message: string } | null>(null);

  // Resumen de envíos/aperturas por letra
  const [sendsByLetra, setSendsByLetra] = useState<Record<string, LetraSendSummary>>({});
  const [opensModalHistoryId, setOpensModalHistoryId] = useState<number | null>(null);

  useEffect(() => { loadFiles(); loadStatus(); loadSendsSummary(); }, []);

  async function loadSendsSummary() {
    try {
      const r = await facturacionApi.getLetrasSendsSummary();
      const rows = Array.isArray(r?.data?.data) ? r.data.data : [];
      const map: Record<string, LetraSendSummary> = {};
      rows.forEach((s: any) => {
        if (s && s.letra_id) {
          // Normalizar tipos: history_id puede venir como string desde mssql
          map[s.letra_id] = {
            ...s,
            history_id: typeof s.history_id === 'string' ? Number(s.history_id) : (s.history_id ?? 0),
            total_sends: Number(s.total_sends ?? 0),
            total_opens: Number(s.total_opens ?? 0),
            real_opens: Number(s.real_opens ?? 0),
            unique_openers: Number(s.unique_openers ?? 0),
          };
        }
      });
      setSendsByLetra(map);
    } catch (e) {
      console.warn('[letras] sends-summary error', e);
      setSendsByLetra({});  // garantizar estado consistente
    }
  }
  // Refresh status every 60s
  useEffect(() => {
    const iv = setInterval(loadStatus, 60000);
    return () => clearInterval(iv);
  }, []);

  async function loadFiles() {
    setLoading(true);
    try {
      const res = await facturacionApi.getLetrasFiles();
      setFiles(res.data.data || []);
      if (res.data.status) setSyncStatus(res.data.status);
    } catch (err) {
      setError('Error al cargar letras desde SharePoint');
    } finally {
      setLoading(false);
    }
  }

  async function loadStatus() {
    try {
      const res = await facturacionApi.getLetrasStatus();
      setSyncStatus(res.data.data);
    } catch { /* silent */ }
  }

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await facturacionApi.refreshLetras();
      await loadFiles();
    } catch {
      setError('Error al refrescar desde SharePoint');
    } finally {
      setRefreshing(false);
    }
  }

  async function openBotPanel() {
    setShowBotPanel(true);
    setBotMessage(null);
    try {
      const [cfgRes, histRes] = await Promise.all([
        facturacionApi.getLetrasBotConfig(),
        facturacionApi.getLetrasBotHistory(50),
      ]);
      setBotConfig(cfgRes.data.data);
      setBotHistory(histRes.data.data || []);
    } catch (e: any) {
      setBotMessage({ type: 'err', text: e?.response?.data?.message || 'Error al cargar config del bot' });
    }
  }

  async function saveBotConfig() {
    if (!botConfig) return;
    setBotSaving(true);
    setBotMessage(null);
    try {
      const res = await facturacionApi.updateLetrasBotConfig({
        enabled: botConfig.enabled,
        sendHour: botConfig.sendHour,
        sendMinute: botConfig.sendMinute,
        defaultCc: botConfig.defaultCc,
      });
      setBotConfig(res.data.data);
      setBotMessage({ type: 'ok', text: 'Configuración guardada' });
    } catch (e: any) {
      setBotMessage({ type: 'err', text: e?.response?.data?.message || 'Error al guardar' });
    } finally {
      setBotSaving(false);
    }
  }

  async function runBotNow() {
    if (!confirm('¿Ejecutar el bot ahora? Se enviarán las letras cargadas hoy que aún no hayan sido enviadas.')) return;
    setBotRunning(true);
    setBotMessage(null);
    try {
      const res = await facturacionApi.runLetrasBotNow();
      const d = res.data.data;
      setBotMessage({ type: 'ok', text: `Procesadas: ${d.processed} — enviadas: ${d.sent}, omitidas: ${d.skipped}, fallidas: ${d.failed}` });
      const histRes = await facturacionApi.getLetrasBotHistory(50);
      setBotHistory(histRes.data.data || []);
    } catch (e: any) {
      setBotMessage({ type: 'err', text: e?.response?.data?.message || 'Error ejecutando bot' });
    } finally {
      setBotRunning(false);
    }
  }

  async function toggleExpand(file: LetraFile) {
    if (expandedId === file.id) {
      setExpandedId(null);
      setComprobantesData(null);
      return;
    }
    setExpandedId(file.id);
    setComprobantesData(null);
    if (!file.facturaCode) return;

    setLoadingComprobantes(true);
    try {
      const res = await facturacionApi.getLetrasComprobantes(file.facturaCode);
      setComprobantesData(res.data.data);
    } catch (err) {
      console.error('Error loading comprobantes:', err);
    } finally {
      setLoadingComprobantes(false);
    }
  }

  function openSendModal(letra: LetraFile, comprobantes: ComprobantesData) {
    setSendModal({ letra, comprobantes });
    setSendTo(comprobantes.destinatarios.join('; ')); // Pre-filled from expandable row edits
    setSendCc('');
    setSendResult(null);
  }

  async function handleSend(force = false) {
    if (!sendModal) return;
    const toList = sendTo.split(/[;,]/).map(e => e.trim()).filter(Boolean);
    const ccList = sendCc ? sendCc.split(/[;,]/).map(e => e.trim()).filter(Boolean) : [];
    if (toList.length === 0) return;

    setSending(true);
    setSendResult(null);
    try {
      const res = await facturacionApi.sendLetra({
        letraDriveItemId: sendModal.letra.id,
        facturaCode: sendModal.letra.facturaCode,
        to: toList,
        cc: ccList,
        cliente: sendModal.letra.cliente,
        force,
      });
      setSendResult({ success: true, message: res.data.message || 'Email enviado exitosamente' });
    } catch (err: any) {
      const data = err.response?.data;
      if (data?.alreadySent && !force) {
        if (confirm(`${data.message}\n\n¿Reenviar de todas formas?`)) {
          return handleSend(true);
        }
        setSendResult({ success: false, message: data.message });
      } else {
        setSendResult({ success: false, message: data?.message || err?.message || 'Error al enviar' });
        console.error('[letras-send] error:', err?.response?.status, data, err);
      }
    } finally {
      setSending(false);
    }
  }

  const filtered = useMemo(() => {
    if (!search.trim()) return files;
    const q = search.toLowerCase();
    return files.filter(f =>
      f.name.toLowerCase().includes(q) ||
      f.letras.some(l => l.includes(q)) ||
      f.facturaCode.toLowerCase().includes(q) ||
      f.cliente.toLowerCase().includes(q)
    );
  }, [files, search]);

  if (loading) {
    return (
      <div className="min-h-screen">
        <Header title="Letras" subtitle="Repositorio de Letras — SharePoint" />
        <div className="flex items-center justify-center h-96">
          <Loader2 className="w-10 h-10 animate-spin text-brand-500" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header title="Letras" subtitle="Repositorio de Letras — SharePoint" />

      <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Stale banner */}
        {syncStatus && (syncStatus.isStale || syncStatus.newTodayCount === 0) && (
          <div className={`rounded-xl p-3 flex items-center gap-3 border ${
            syncStatus.isStale
              ? 'bg-amber-50 border-amber-200 text-amber-800'
              : 'bg-blue-50 border-blue-200 text-blue-800'
          }`}>
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <div className="text-sm">
              {syncStatus.isStale ? (
                <>La caché tiene más de 3 horas. Última sincronización: <strong>{formatDateTime(syncStatus.lastSync)}</strong></>
              ) : (
                <>No se detectan nuevas letras cargadas hoy en SharePoint.</>
              )}
            </div>
          </div>
        )}

        {/* Toolbar: search + sync controls */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por N° letra, factura o cliente..."
              className="input-field w-full pl-10" />
          </div>
          <div className="flex items-center gap-2 flex-wrap text-sm">
            {syncStatus && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gray-50 border border-gray-100 text-gray-600 text-xs">
                <Clock className="w-3.5 h-3.5" />
                Sincronizado {timeAgo(syncStatus.lastSync)}
                <span className="text-gray-300">·</span>
                <span className={syncStatus.newTodayCount > 0 ? 'text-brand-700 font-semibold' : 'text-gray-400'}>
                  {syncStatus.newTodayCount} hoy
                </span>
              </span>
            )}
            <button onClick={handleRefresh} disabled={refreshing}
              className="btn-secondary text-xs flex items-center gap-1.5">
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Actualizando...' : 'Actualizar'}
            </button>
            {isAdmin && (
              <button onClick={openBotPanel} className="btn-primary text-xs flex items-center gap-1.5">
                <Bot className="w-3.5 h-3.5" /> Envío Automático
              </button>
            )}
            <span className="text-gray-500 text-xs ml-1">
              <ScrollText className="w-3.5 h-3.5 inline mr-1" />{filtered.length} docs
            </span>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table-modern w-full">
              <thead>
                <tr>
                  <th className="w-[40px]"></th>
                  <th>N° Letras</th>
                  <th>Factura</th>
                  <th>Cliente</th>
                  <th className="w-[100px]">Fecha</th>
                  <th className="w-[70px] text-right">Tamaño</th>
                  <th className="w-[110px] text-center" title="Estado del envío del email">Estado envío</th>
                  <th className="w-[100px] text-center" title="Aperturas del cliente">Aperturas</th>
                  <th className="w-[80px] text-center">PDF</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((f) => {
                  const isExpanded = expandedId === f.id;
                  return (
                    <ExpandableRow
                      key={f.id}
                      file={f}
                      isExpanded={isExpanded}
                      onToggle={() => toggleExpand(f)}
                      loadingComprobantes={isExpanded && loadingComprobantes}
                      comprobantes={isExpanded ? comprobantesData : null}
                      onSend={(comp) => openSendModal(f, comp)}
                      sendSummary={sendsByLetra[f.id] || null}
                      onShowOpens={(historyId) => setOpensModalHistoryId(historyId)}
                    />
                  );
                })}
                {filtered.length === 0 && (
                  <tr><td colSpan={9} className="text-center py-12 text-gray-400">
                    <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    {search ? 'Sin resultados' : 'No se encontraron letras'}
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Bot Config Panel (Admin only) */}
      {showBotPanel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowBotPanel(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between rounded-t-2xl">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Bot className="w-5 h-5 text-brand-600" />
                Envío Automático de Letras
              </h3>
              <button onClick={() => setShowBotPanel(false)} className="p-1 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Config */}
              <div className="space-y-3">
                <h4 className="font-semibold text-gray-800 flex items-center gap-2">
                  <Settings className="w-4 h-4 text-gray-500" /> Configuración
                </h4>
                {!botConfig ? (
                  <div className="flex items-center gap-2 text-sm text-gray-500"><Loader2 className="w-4 h-4 animate-spin" /> Cargando...</div>
                ) : (
                  <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input type="checkbox" checked={botConfig.enabled}
                        onChange={e => setBotConfig({ ...botConfig, enabled: e.target.checked })}
                        className="w-4 h-4 text-brand-600 rounded" />
                      <span className="text-sm font-medium text-gray-700">Activar envío automático diario</span>
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">Hora</label>
                        <input type="number" min={0} max={23} value={botConfig.sendHour}
                          onChange={e => setBotConfig({ ...botConfig, sendHour: parseInt(e.target.value) || 0 })}
                          className="input-field w-full text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">Minuto</label>
                        <input type="number" min={0} max={59} value={botConfig.sendMinute}
                          onChange={e => setBotConfig({ ...botConfig, sendMinute: parseInt(e.target.value) || 0 })}
                          className="input-field w-full text-sm" />
                      </div>
                      <div className="flex items-end">
                        <div className="bg-white rounded-lg border border-gray-200 px-3 py-2 text-sm w-full text-center">
                          <span className="text-gray-400 text-xs">Ejecuta a las</span>
                          <div className="font-mono font-bold text-brand-700 text-lg">
                            {String(botConfig.sendHour).padStart(2, '0')}:{String(botConfig.sendMinute).padStart(2, '0')}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">CC por defecto (separados por ;)</label>
                      <input type="text" value={botConfig.defaultCc}
                        onChange={e => setBotConfig({ ...botConfig, defaultCc: e.target.value })}
                        placeholder="facturacion@pointamericas.com; copia@pointamericas.com"
                        className="input-field w-full text-sm font-mono" />
                    </div>
                    {botConfig.currentCron && (
                      <p className="text-xs text-gray-400">Cron activo: <span className="font-mono">{botConfig.currentCron}</span></p>
                    )}
                    {botConfig.updatedBy && (
                      <p className="text-xs text-gray-400">Última actualización: {botConfig.updatedBy} — {formatDateTime(botConfig.updatedAt)}</p>
                    )}
                    <div className="flex gap-2 pt-2">
                      <button onClick={saveBotConfig} disabled={botSaving} className="btn-primary text-sm flex items-center gap-2">
                        {botSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                        Guardar
                      </button>
                      <button onClick={runBotNow} disabled={botRunning} className="btn-secondary text-sm flex items-center gap-2">
                        {botRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                        Ejecutar ahora
                      </button>
                    </div>
                  </div>
                )}
                {botMessage && (
                  <div className={`rounded-xl p-3 flex items-center gap-2 text-sm ${botMessage.type === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                    {botMessage.type === 'ok' ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                    {botMessage.text}
                  </div>
                )}
              </div>

              {/* History */}
              <div className="space-y-3">
                <h4 className="font-semibold text-gray-800 flex items-center gap-2">
                  <History className="w-4 h-4 text-gray-500" /> Historial de envíos
                </h4>
                {botHistory.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-6">Sin envíos registrados</p>
                ) : (
                  <div className="border border-gray-100 rounded-xl overflow-hidden">
                    <table className="table-modern w-full text-xs">
                      <thead>
                        <tr>
                          <th>Fecha</th>
                          <th>Trigger</th>
                          <th>Letra</th>
                          <th>Cliente</th>
                          <th>Destinatarios</th>
                          <th className="text-center">Adj.</th>
                          <th>Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {botHistory.map(h => (
                          <tr key={h.id}>
                            <td className="whitespace-nowrap">{formatDateTime(h.runAt)}</td>
                            <td>
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${h.triggerType === 'auto' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'}`}>
                                {h.triggerType}
                              </span>
                            </td>
                            <td className="max-w-[200px] truncate" title={h.letraName}>{h.letraName}</td>
                            <td className="max-w-[150px] truncate" title={h.cliente || ''}>{h.cliente || '-'}</td>
                            <td className="max-w-[200px] truncate" title={h.recipientsTo || ''}>{h.recipientsTo || '-'}</td>
                            <td className="text-center">{h.attachmentsQty}</td>
                            <td>
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                                h.status === 'sent' ? 'bg-green-50 text-green-700' :
                                h.status === 'failed' ? 'bg-red-50 text-red-700' :
                                'bg-gray-100 text-gray-600'
                              }`} title={h.errorMessage || ''}>
                                {h.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Send Modal */}
      {sendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => !sending && setSendModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Send className="w-5 h-5 text-brand-600" />
                Enviar Letra + Comprobantes
              </h3>
              <button onClick={() => !sending && setSendModal(null)} className="p-1 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-gray-50 rounded-xl p-3 text-sm space-y-1">
                <p><span className="font-medium text-gray-500">Letra:</span> {sendModal.letra.name}</p>
                <p><span className="font-medium text-gray-500">Factura:</span> {sendModal.letra.facturaCode}</p>
                <p><span className="font-medium text-gray-500">Cliente:</span> {sendModal.letra.cliente || 'Sin identificar'}</p>
                <p><span className="font-medium text-gray-500">Adjuntos:</span> 1 letra PDF + {sendModal.comprobantes.totalAdjuntos} comprobantes</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">Para (separados por ;)</label>
                <textarea value={sendTo} onChange={e => setSendTo(e.target.value)}
                  className="input-field w-full h-16 text-sm" placeholder="email1@ejemplo.com; email2@ejemplo.com" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">CC (opcional)</label>
                <input value={sendCc} onChange={e => setSendCc(e.target.value)}
                  className="input-field w-full text-sm" placeholder="cc@ejemplo.com" />
              </div>

              {sendResult && (
                <div className={`rounded-xl p-3 flex items-center gap-2 text-sm ${sendResult.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                  {sendResult.success ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                  {sendResult.message}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setSendModal(null)} disabled={sending}
                  className="btn-secondary">Cancelar</button>
                <button onClick={() => handleSend()} disabled={sending || !!sendResult?.success}
                  className="btn-primary flex items-center gap-2">
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  {sending ? 'Enviando...' : 'Enviar Email'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Detalle de aperturas */}
      {opensModalHistoryId !== null && (
        <OpensDetailModal historyId={opensModalHistoryId} onClose={() => setOpensModalHistoryId(null)} />
      )}
    </div>
  );
}

/* Modal de detalle de aperturas */
function OpensDetailModal({ historyId, onClose }: { historyId: number; onClose: () => void }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{
    send: any;
    summary: Array<{
      recipient: string; recipient_role: string;
      total_opens: number; real_opens: number; proxy_opens: number;
      first_open_at: string | null; last_open_at: string | null;
    }>;
    detail: Array<{
      open_id: number; recipient: string; recipient_role: string;
      opened_at: string; ip_address: string | null; user_agent: string | null; is_proxied: boolean;
    }>;
  } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const r = await facturacionApi.getLetrasOpens(historyId);
        if (!mounted) return;
        setData(r.data?.data || null);
      } catch (e: any) {
        setError(e?.response?.data?.message || e.message || 'Error');
      } finally { if (mounted) setLoading(false); }
    })();
    return () => { mounted = false; };
  }, [historyId]);

  function summarizeUA(ua: string | null): string {
    if (!ua) return '—';
    const u = ua.toLowerCase();
    if (u.includes('googleimageproxy') || /^66\.249\./.test(u)) return 'Gmail (proxy)';
    if (u.includes('outlook')) return 'Outlook';
    if (u.includes('mimecast')) return 'Mimecast (proxy)';
    if (u.includes('chrome')) return 'Chrome';
    if (u.includes('firefox')) return 'Firefox';
    if (u.includes('safari') && !u.includes('chrome')) return 'Safari';
    if (u.includes('edge')) return 'Edge';
    if (u.includes('thunderbird')) return 'Thunderbird';
    return ua.length > 60 ? ua.slice(0, 60) + '…' : ua;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Eye className="w-5 h-5 text-brand-600" />
            Aperturas del email — Letra
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {loading && (
            <div className="flex items-center gap-2 text-sm text-gray-500 py-4">
              <Loader2 className="w-4 h-4 animate-spin" /> Cargando...
            </div>
          )}
          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
              <AlertCircle className="w-4 h-4" /> {error}
            </div>
          )}

          {!loading && data && (
            <>
              {/* Send info */}
              <div className="bg-gradient-to-br from-brand-50 to-blue-50 rounded-xl p-4 border border-brand-100 text-sm space-y-1">
                <div className="flex items-center gap-2 text-xs">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-bold uppercase
                    ${data.send?.trigger_type === 'auto'
                      ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                    {data.send?.trigger_type === 'auto' ? <><Bot className="w-3 h-3" /> Bot automático</> : <><Hand className="w-3 h-3" /> Manual (intranet)</>}
                  </span>
                  <span className="text-gray-500">enviado el</span>
                  <span className="font-mono text-gray-700">{data.send?.run_at ? new Date(data.send.run_at).toLocaleString('es-PE') : '—'}</span>
                </div>
                <div><span className="text-gray-500">Cliente:</span> <strong>{data.send?.cliente || '—'}</strong></div>
                <div><span className="text-gray-500">Factura:</span> <span className="font-mono">{data.send?.factura_code || '—'}</span></div>
                <div><span className="text-gray-500">Letra:</span> <span className="font-mono text-xs">{data.send?.letra_name}</span></div>
                <div><span className="text-gray-500">Para:</span> <span className="font-mono text-xs">{data.send?.recipients_to}</span></div>
                {data.send?.recipients_cc && (
                  <div><span className="text-gray-500">CC:</span> <span className="font-mono text-xs">{data.send.recipients_cc}</span></div>
                )}
              </div>

              {/* Resumen por destinatario */}
              <div>
                <h4 className="text-sm font-bold text-gray-800 mb-2 flex items-center gap-2">
                  <User className="w-4 h-4 text-gray-500" /> Resumen por destinatario
                </h4>
                {data.summary.length === 0 ? (
                  <div className="text-sm text-gray-400 italic bg-gray-50 rounded-lg p-3 text-center">
                    Aún no hay aperturas registradas
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 text-gray-600 uppercase">
                        <tr>
                          <th className="text-left p-2 font-semibold">Destinatario</th>
                          <th className="text-center p-2 font-semibold">Rol</th>
                          <th className="text-right p-2 font-semibold">Reales</th>
                          <th className="text-right p-2 font-semibold">Proxy</th>
                          <th className="text-left p-2 font-semibold">Primera</th>
                          <th className="text-left p-2 font-semibold">Última</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {data.summary.map((s, i) => (
                          <tr key={i} className="hover:bg-gray-50">
                            <td className="p-2 font-mono">{s.recipient}</td>
                            <td className="p-2 text-center uppercase text-gray-600">{s.recipient_role}</td>
                            <td className="p-2 text-right font-bold text-brand-700">{s.real_opens}</td>
                            <td className="p-2 text-right text-yellow-700">{s.proxy_opens}</td>
                            <td className="p-2 text-gray-600">{s.first_open_at ? new Date(s.first_open_at).toLocaleString('es-PE') : '—'}</td>
                            <td className="p-2 text-gray-600">{s.last_open_at ? new Date(s.last_open_at).toLocaleString('es-PE') : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Detalle (últimas 100) */}
              {data.detail.length > 0 && (
                <div>
                  <h4 className="text-sm font-bold text-gray-800 mb-2 flex items-center gap-2">
                    <History className="w-4 h-4 text-gray-500" /> Detalle ({data.detail.length} aperturas)
                  </h4>
                  <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg">
                    <table className="w-full text-[11px]">
                      <thead className="bg-gray-50 text-gray-600 uppercase sticky top-0">
                        <tr>
                          <th className="text-left p-2 font-semibold">Fecha/Hora</th>
                          <th className="text-left p-2 font-semibold">Destinatario</th>
                          <th className="text-left p-2 font-semibold">Cliente / Proxy</th>
                          <th className="text-left p-2 font-semibold">IP</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {data.detail.map((d) => (
                          <tr key={d.open_id} className={d.is_proxied ? 'bg-yellow-50/40' : 'hover:bg-gray-50'}>
                            <td className="p-2 font-mono text-gray-700">{new Date(d.opened_at).toLocaleString('es-PE')}</td>
                            <td className="p-2 font-mono text-gray-700">{d.recipient}</td>
                            <td className="p-2 text-gray-600">
                              {summarizeUA(d.user_agent)}
                              {d.is_proxied && <span className="ml-1 text-[9px] uppercase bg-yellow-200 text-yellow-800 px-1 rounded">proxy</span>}
                            </td>
                            <td className="p-2 font-mono text-gray-500">{d.ip_address || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <p className="text-[11px] text-gray-400 italic">
                Las aperturas marcadas como <strong>proxy</strong> corresponden a precargas automáticas
                de Gmail/Outlook (no son aperturas reales del cliente). Algunos clientes de email
                bloquean el tracking pixel por defecto, así que es posible que existan aperturas no registradas.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* Expandable Row Component */
function ExpandableRow({ file, isExpanded, onToggle, loadingComprobantes, comprobantes, onSend, sendSummary, onShowOpens }: {
  file: LetraFile;
  isExpanded: boolean;
  onToggle: () => void;
  loadingComprobantes: boolean;
  comprobantes: ComprobantesData | null;
  onSend: (comp: ComprobantesData) => void;
  sendSummary: LetraSendSummary | null;
  onShowOpens: (historyId: number) => void;
}) {
  const DEFAULT_CC = 'cobranzas@pointamericas.com';
  const [editTo, setEditTo] = useState('');
  const [editCc, setEditCc] = useState(DEFAULT_CC);
  const [showBody, setShowBody] = useState(false);

  // Sync destinatarios when comprobantes load — el CC siempre arranca con cobranzas
  useEffect(() => {
    if (comprobantes?.destinatarios) {
      setEditTo(comprobantes.destinatarios.join('; '));
      setEditCc(DEFAULT_CC);
    }
  }, [comprobantes]);

  const emailBody = `<div style="font-family:Arial,sans-serif;color:#333;">
  <h2 style="color:#00A651;">Point Andina S.A.</h2>
  <p>Estimado Cliente <strong>${file.cliente || ''}</strong>,</p>
  <p>Adjuntamos la(s) letra(s) y comprobantes de pago electrónicos correspondientes a la factura <strong>${file.facturaCode}</strong>.</p>
  <p>Documentos adjuntos: <strong>${1 + (comprobantes?.totalAdjuntos || 0)}</strong></p>
  <ul>
    <li>${file.name}</li>
    ${(comprobantes?.emails || []).flatMap(e => (e.attachments || []).map(a => `<li>${a.name}</li>`)).join('\n    ')}
  </ul>
  <br/>
  <p>Atentamente,<br/><strong>Point Andina S.A.</strong><br/>Facturación y Despacho</p>
</div>`;
  return (
    <>
      <tr className={`cursor-pointer transition-colors ${isExpanded ? 'bg-brand-50/50' : 'hover:bg-gray-50'}`} onClick={onToggle}>
        <td className="text-center">
          {isExpanded ? <ChevronDown className="w-4 h-4 text-brand-600" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
        </td>
        <td>
          <div className="flex flex-wrap gap-1">
            {file.letras.map((l, i) => (
              <span key={i} className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold bg-brand-50 text-brand-700 border border-brand-200">
                LT {l}
              </span>
            ))}
          </div>
        </td>
        <td className="font-mono text-sm font-semibold text-gray-800">{file.facturaCode || '-'}</td>
        <td className="text-sm font-medium text-gray-700 max-w-[200px] truncate" title={file.cliente}>
          {file.cliente || <span className="text-gray-300 italic">Sin cliente</span>}
        </td>
        <td className="text-sm text-gray-500">{formatDate(file.lastModified)}</td>
        <td className="text-sm text-gray-400 text-right">{formatFileSize(file.size)}</td>

        {/* Estado de envío: Bot/Manual badge + fecha + sello idempotencia */}
        <td className="text-center" onClick={e => e.stopPropagation()}>
          {sendSummary ? (
            <div className="flex flex-col items-center gap-0.5" title={`Enviado ${sendSummary.total_sends || 0} vez(es) — última: ${formatDateTime(sendSummary.last_sent_at)}`}>
              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase
                ${sendSummary.trigger_type === 'auto'
                  ? 'bg-blue-100 text-blue-700 border border-blue-200'
                  : 'bg-amber-100 text-amber-700 border border-amber-200'}`}>
                {sendSummary.trigger_type === 'auto'
                  ? <><Bot className="w-3 h-3" /> Bot</>
                  : <><Hand className="w-3 h-3" /> Manual</>}
              </span>
              <span className="text-[10px] text-gray-500">{timeAgo(sendSummary.last_sent_at)}</span>
              {sendSummary.total_sends > 1 && (
                <span className="text-[9px] text-gray-400">×{sendSummary.total_sends} envíos</span>
              )}
            </div>
          ) : (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-500">
              <Clock className="w-3 h-3" /> Sin enviar
            </span>
          )}
        </td>

        {/* Aperturas: ojo + count */}
        <td className="text-center" onClick={e => e.stopPropagation()}>
          {sendSummary ? (
            <button
              type="button"
              onClick={() => onShowOpens(sendSummary.history_id)}
              title={
                sendSummary.real_opens > 0
                  ? `${sendSummary.real_opens} apertura(s) real(es) · ${sendSummary.unique_openers} destinatario(s) — click para detalle`
                  : sendSummary.total_opens > 0
                    ? `${sendSummary.total_opens} apertura(s) (proxy/precarga) — click para detalle`
                    : 'Aún no abierto — click para más info'
              }
              className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold transition-colors
                ${sendSummary.real_opens > 0
                  ? 'bg-brand-100 text-brand-700 hover:bg-brand-200 border border-brand-200'
                  : sendSummary.total_opens > 0
                    ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200 border border-yellow-200'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200 border border-gray-200'}`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span className="font-mono">{sendSummary.real_opens || sendSummary.total_opens || 0}</span>
              {sendSummary.unique_openers > 0 && (
                <span className="text-[10px] opacity-70">/{sendSummary.unique_openers}u</span>
              )}
            </button>
          ) : (
            <span className="text-gray-300 text-xs">—</span>
          )}
        </td>

        <td className="text-center" onClick={e => e.stopPropagation()}>
          <button type="button" onClick={async () => {
            try {
              const res = await facturacionApi.getLetraDownloadUrl(file.id);
              const url = res.data.data?.url;
              if (url) window.open(url, '_blank', 'noopener,noreferrer');
              else if (file.webUrl) window.open(file.webUrl, '_blank', 'noopener,noreferrer');
            } catch {
              if (file.webUrl) window.open(file.webUrl, '_blank', 'noopener,noreferrer');
            }
          }} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-brand-50 text-brand-700 hover:bg-brand-100">
            <Download className="w-3.5 h-3.5" /> PDF
          </button>
        </td>
      </tr>

      {/* Expanded detail */}
      {isExpanded && (
        <tr>
          <td colSpan={9} className="p-0">
            <div className="bg-gray-50 border-t border-b border-gray-100 px-6 py-4 animate-fade-in">
              {loadingComprobantes ? (
                <div className="flex items-center gap-2 py-4 text-sm text-gray-500">
                  <Loader2 className="w-4 h-4 animate-spin" /> Buscando comprobantes asociados...
                </div>
              ) : !comprobantes || comprobantes.totalComprobantes === 0 ? (
                <div className="flex items-center gap-2 py-3 text-sm text-amber-600">
                  <AlertCircle className="w-4 h-4" />
                  No se encontraron comprobantes electrónicos para {file.facturaCode}
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Stats */}
                  <div className="flex items-center gap-4 text-sm">
                    <span className="flex items-center gap-1.5 text-gray-600">
                      <Mail className="w-4 h-4 text-blue-500" />
                      <strong>{comprobantes.totalComprobantes}</strong> comprobante{comprobantes.totalComprobantes > 1 ? 's' : ''}
                    </span>
                    <span className="flex items-center gap-1.5 text-gray-600">
                      <Paperclip className="w-4 h-4 text-amber-500" />
                      <strong>{comprobantes.totalAdjuntos}</strong> adjunto{comprobantes.totalAdjuntos > 1 ? 's' : ''}
                    </span>
                  </div>

                  {/* Editable destinatarios */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">Para (editable — separados por ;)</label>
                      <textarea value={editTo} onChange={e => setEditTo(e.target.value)}
                        className="input-field w-full h-16 text-xs font-mono" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">CC (opcional)</label>
                      <input value={editCc} onChange={e => setEditCc(e.target.value)}
                        className="input-field w-full text-xs font-mono" placeholder="cc@ejemplo.com" />
                    </div>
                  </div>

                  {/* Body preview toggle */}
                  <div>
                    <button onClick={() => setShowBody(!showBody)}
                      className="text-xs text-brand-600 hover:text-brand-700 font-medium flex items-center gap-1">
                      <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showBody ? 'rotate-180' : ''}`} />
                      {showBody ? 'Ocultar' : 'Ver'} cuerpo del correo
                    </button>
                    {showBody && (
                      <div className="mt-2 bg-white border border-gray-200 rounded-xl p-4 text-sm"
                        dangerouslySetInnerHTML={{ __html: emailBody }} />
                    )}
                  </div>

                  {/* Send button */}
                  <div className="flex justify-end">
                    <button onClick={() => {
                      const customComp = { ...comprobantes, destinatarios: editTo.split(/[;,]/).map(e => e.trim()).filter(Boolean) };
                      onSend(customComp);
                    }} className="btn-primary text-sm flex items-center gap-2">
                      <Send className="w-4 h-4" /> Enviar al Cliente
                    </button>
                  </div>

                  {/* Comprobantes list */}
                  <div className="space-y-2">
                    {comprobantes.emails.map((email) => (
                      <div key={email.id} className="bg-white rounded-xl border border-gray-100 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold bg-teal-50 text-teal-700 uppercase">
                                {email.tipoDocumento || 'DOC'}
                              </span>
                              <span className="font-mono text-sm font-semibold text-gray-800">{email.numeroDocumento}</span>
                            </div>
                            <p className="text-xs text-gray-500 truncate">{email.subject}</p>
                          </div>
                          <span className="text-xs text-gray-400 whitespace-nowrap">{formatDate(email.fechaEmision)}</span>
                        </div>
                        {email.attachments && email.attachments.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {email.attachments.map((att, i) => (
                              <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] bg-gray-50 text-gray-600 border border-gray-100">
                                <Paperclip className="w-3 h-3" />
                                {att.name.length > 30 ? att.name.substring(0, 27) + '...' : att.name}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
