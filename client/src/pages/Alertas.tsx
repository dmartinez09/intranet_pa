import { useState, useEffect } from 'react';
import Header from '../components/layout/Header';
import { alertasApi } from '../services/api';
import { formatUSD, formatDate } from '../lib/utils';
import {
  Bell,
  AlertTriangle,
  Clock,
  Package,
  FileWarning,
  ChevronRight,
  ArrowLeft,
  Calendar,
  Search,
  XCircle,
  Eye,
  Mail,
  ExternalLink,
} from 'lucide-react';

const MODULE_COLORS: Record<string, { bg: string; text: string; label: string; border: string }> = {
  VEN: { bg: 'bg-green-50', text: 'text-green-700', label: 'Ventas', border: 'border-green-200' },
  INV: { bg: 'bg-purple-50', text: 'text-purple-700', label: 'Inventario', border: 'border-purple-200' },
  CXC: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'Créditos/Cobr.', border: 'border-amber-200' },
  CMP: { bg: 'bg-blue-50', text: 'text-blue-700', label: 'Compras', border: 'border-blue-200' },
  FIN: { bg: 'bg-red-50', text: 'text-red-700', label: 'Finanzas', border: 'border-red-200' },
  SER: { bg: 'bg-cyan-50', text: 'text-cyan-700', label: 'Servicios', border: 'border-cyan-200' },
  TES: { bg: 'bg-pink-50', text: 'text-pink-700', label: 'Tesorería', border: 'border-pink-200' },
  CAP: { bg: 'bg-orange-50', text: 'text-orange-700', label: 'Capital', border: 'border-orange-200' },
};

interface Alerta {
  id: number;
  modulo: string;
  nombre: string;
  consulta_guardada: string;
  prioridad: string;
  frecuencia: number;
  periodo: string;
  activa: boolean;
  hora_envio: string;
  destinatarios: string[];
}

export default function Alertas() {
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [ordenes, setOrdenes] = useState<any[]>([]);
  const [filtroModulo, setFiltroModulo] = useState('');
  const [loading, setLoading] = useState(true);

  // Email integration state
  const [emails, setEmails] = useState<any[]>([]);
  const [emailConfigured, setEmailConfigured] = useState(false);

  // Drill-down state
  const [selectedAlerta, setSelectedAlerta] = useState<Alerta | null>(null);
  const [alertaResultado, setAlertaResultado] = useState<any[]>([]);
  const [loadingResultado, setLoadingResultado] = useState(false);
  const [fechaAlerta, setFechaAlerta] = useState(new Date().toISOString().split('T')[0]);
  const [filtroVendedor, setFiltroVendedor] = useState('');
  const [filtroSupervisor, setFiltroSupervisor] = useState('');
  const [searchResultado, setSearchResultado] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [alertaRes, ordenesRes] = await Promise.all([
        alertasApi.getSAP(),
        alertasApi.getOrdenesNoAtendidas(),
      ]);
      setAlertas(alertaRes.data.data);
      setOrdenes(ordenesRes.data.data);
      // Try to load emails (non-blocking)
      try {
        const emailRes = await alertasApi.getEmails(10);
        setEmails(emailRes.data.data || []);
        setEmailConfigured(emailRes.data.configured);
      } catch {
        // Email integration not available
      }
    } catch (err) {
      console.error('Error loading alertas:', err);
    } finally {
      setLoading(false);
    }
  }

  async function openAlerta(alerta: Alerta) {
    setSelectedAlerta(alerta);
    setLoadingResultado(true);
    setFiltroVendedor('');
    setFiltroSupervisor('');
    setSearchResultado('');
    try {
      const res = await alertasApi.getResultado(alerta.id, fechaAlerta);
      setAlertaResultado(res.data.data);
    } catch (err) {
      console.error('Error loading resultado:', err);
    } finally {
      setLoadingResultado(false);
    }
  }

  async function changeFechaAlerta(fecha: string) {
    setFechaAlerta(fecha);
    if (selectedAlerta) {
      setLoadingResultado(true);
      try {
        const res = await alertasApi.getResultado(selectedAlerta.id, fecha);
        setAlertaResultado(res.data.data);
      } catch (err) {
        console.error('Error:', err);
      } finally {
        setLoadingResultado(false);
      }
    }
  }

  const alertasFiltradas = filtroModulo ? alertas.filter((a) => a.modulo === filtroModulo) : alertas;
  const modulosUnicos = [...new Set(alertas.map((a) => a.modulo))];

  // Filtrar resultado de alerta
  const vendedoresUnicos = [...new Set(alertaResultado.map((r) => r.vendedor).filter(Boolean))];
  const supervisoresUnicos = [...new Set(alertaResultado.map((r) => r.supervisor).filter(Boolean))];

  const resultadoFiltrado = alertaResultado.filter((r) => {
    if (filtroVendedor && r.vendedor !== filtroVendedor) return false;
    if (filtroSupervisor && r.supervisor !== filtroSupervisor) return false;
    if (searchResultado) {
      const s = searchResultado.toLowerCase();
      return r.cliente?.toLowerCase().includes(s) || r.numero_orden?.toLowerCase().includes(s) || r.descripcion?.toLowerCase().includes(s);
    }
    return true;
  });

  // ---- DRILL-DOWN VIEW ----
  if (selectedAlerta) {
    const mc = MODULE_COLORS[selectedAlerta.modulo] || MODULE_COLORS.VEN;
    return (
      <div className="min-h-screen">
        <Header title="Resultado de Alerta" subtitle={selectedAlerta.nombre} />
        <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4 sm:space-y-5">
          {/* Back + Info */}
          <div className="flex items-center justify-between">
            <button onClick={() => setSelectedAlerta(null)} className="btn-secondary">
              <ArrowLeft className="w-4 h-4" /> Volver a Alertas
            </button>
            <div className="flex items-center gap-4">
              <span className={`badge ${mc.bg} ${mc.text}`}>{mc.label}</span>
              <span className={`badge ${selectedAlerta.prioridad === 'Alta' ? 'badge-danger' : 'bg-gray-100 text-gray-600'}`}>
                {selectedAlerta.prioridad}
              </span>
              <span className="text-xs text-gray-400">Consulta: {selectedAlerta.consulta_guardada}</span>
            </div>
          </div>

          {/* Alert info card */}
          <div className={`rounded-2xl border ${mc.border} ${mc.bg} p-4`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Bell className={`w-5 h-5 ${mc.text}`} />
                <div>
                  <p className={`font-bold ${mc.text}`}>{selectedAlerta.nombre}</p>
                  <p className="text-xs text-gray-500">
                    Frecuencia: cada {selectedAlerta.frecuencia} {selectedAlerta.periodo} | Hora: {selectedAlerta.hora_envio}
                  </p>
                </div>
              </div>
              <p className="text-xs text-gray-500">
                Correo: alertasSapPA@pointamericas.com
              </p>
            </div>
          </div>

          {/* Filters for resultado */}
          <div className="flex flex-wrap items-end gap-4 bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase">Fecha</label>
              <input
                type="date"
                value={fechaAlerta}
                onChange={(e) => changeFechaAlerta(e.target.value)}
                className="filter-select"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase">Vendedor</label>
              <select value={filtroVendedor} onChange={(e) => setFiltroVendedor(e.target.value)} className="filter-select min-w-[180px]">
                <option value="">Todos</option>
                {vendedoresUnicos.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase">Supervisor</label>
              <select value={filtroSupervisor} onChange={(e) => setFiltroSupervisor(e.target.value)} className="filter-select min-w-[180px]">
                <option value="">Todos</option>
                {supervisoresUnicos.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase">Buscar</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchResultado}
                  onChange={(e) => setSearchResultado(e.target.value)}
                  placeholder="Cliente, orden, producto..."
                  className="filter-select w-full pl-10"
                />
              </div>
            </div>
            <p className="text-sm text-gray-500 font-medium">{resultadoFiltrado.length} registros</p>
          </div>

          {/* Resultado table */}
          {loadingResultado ? (
            <div className="flex items-center justify-center h-48">
              <div className="w-10 h-10 border-4 border-brand-200 border-t-brand-500 rounded-full animate-spin" />
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="table-modern">
                  <thead>
                    <tr>
                      <th>N° Orden</th>
                      <th>Cliente</th>
                      <th>Artículo</th>
                      <th>Descripción</th>
                      <th>Vendedor</th>
                      <th>Zona</th>
                      <th>Supervisor</th>
                      <th className="text-right">Días Atraso</th>
                      <th className="text-right">Total USD</th>
                      <th>Comentarios</th>
                      <th>Hora</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resultadoFiltrado.map((r, i) => (
                      <tr key={i}>
                        <td className="font-mono text-xs font-bold text-brand-700">{r.numero_orden}</td>
                        <td className="font-medium max-w-[180px] truncate" title={r.cliente}>{r.cliente}</td>
                        <td className="font-mono text-xs text-gray-500">{r.articulo}</td>
                        <td className="text-sm max-w-[150px] truncate">{r.descripcion}</td>
                        <td className="text-sm font-medium">{r.vendedor}</td>
                        <td className="text-sm text-gray-500">{r.zona}</td>
                        <td className="text-sm">{r.supervisor}</td>
                        <td className="text-right">
                          <span className={`badge ${r.dias_atraso > 30 ? 'badge-danger' : r.dias_atraso > 7 ? 'badge-warning' : 'bg-brand-50 text-brand-600'}`}>
                            {r.dias_atraso}d
                          </span>
                        </td>
                        <td className="text-right font-bold">{formatUSD(r.total_usd || r.total_linea)}</td>
                        <td className="text-xs text-gray-500 max-w-[180px] truncate" title={r.comentarios}>{r.comentarios}</td>
                        <td className="text-xs text-gray-400">{r.hora_alerta || r.hora_aprobacion}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {resultadoFiltrado.length === 0 && (
                <div className="text-center py-12 text-gray-400">
                  <Package className="w-10 h-10 mx-auto mb-2" />
                  <p>Sin resultados para los filtros seleccionados</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ---- MAIN VIEW ----
  return (
    <div className="min-h-screen">
      <Header title="Alertas Operativas" subtitle="Panel de control de alertas SAP y facturación" />

      <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4 sm:space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="kpi-card">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center">
                <Bell className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-extrabold text-gray-900">{alertas.length}</p>
                <p className="text-xs text-gray-500">Alertas Configuradas</p>
              </div>
            </div>
          </div>
          <div className="kpi-card">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center">
                <Package className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-extrabold text-gray-900">{ordenes.length}</p>
                <p className="text-xs text-gray-500">Órdenes No Atendidas</p>
              </div>
            </div>
          </div>
          <div className="kpi-card">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-400 to-red-600 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-extrabold text-gray-900">
                  {alertas.filter((a) => a.prioridad === 'Alta').length}
                </p>
                <p className="text-xs text-gray-500">Prioridad Alta</p>
              </div>
            </div>
          </div>
          <div className="kpi-card">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center">
                <Clock className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-extrabold text-gray-900">
                  {ordenes.length > 0 ? Math.max(...ordenes.map((o: any) => o.dias_atraso)) : 0}
                </p>
                <p className="text-xs text-gray-500">Max Días Atraso</p>
              </div>
            </div>
          </div>
        </div>

        {/* Module filter pills */}
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setFiltroModulo('')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all
              ${!filtroModulo ? 'bg-brand-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            Todos ({alertas.length})
          </button>
          {modulosUnicos.map((m) => {
            const mc = MODULE_COLORS[m] || MODULE_COLORS.VEN;
            return (
              <button
                key={m}
                onClick={() => setFiltroModulo(m === filtroModulo ? '' : m)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all
                  ${filtroModulo === m ? 'bg-brand-500 text-white' : `${mc.bg} ${mc.text} hover:opacity-80`}`}
              >
                {mc.label} ({alertas.filter((a) => a.modulo === m).length})
              </button>
            );
          })}
        </div>

        {/* Alerts Grid - clickable cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {alertasFiltradas.map((a) => {
            const mc = MODULE_COLORS[a.modulo] || MODULE_COLORS.VEN;
            return (
              <button
                key={a.id}
                onClick={() => openAlerta(a)}
                className={`text-left p-5 rounded-2xl border ${mc.border} ${mc.bg} hover:shadow-md
                           transition-all duration-200 hover:-translate-y-0.5 group`}
              >
                <div className="flex items-start justify-between mb-3">
                  <span className={`badge ${mc.bg} ${mc.text} border ${mc.border}`}>{a.modulo}</span>
                  <div className="flex items-center gap-2">
                    {a.prioridad === 'Alta' && <span className="badge-danger text-[10px]">Alta</span>}
                    <Eye className="w-4 h-4 text-gray-300 group-hover:text-brand-500 transition-colors" />
                  </div>
                </div>
                <h4 className="font-bold text-gray-900 text-sm mb-2 line-clamp-2">{a.nombre}</h4>
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>Cada {a.frecuencia} {a.periodo}</span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {a.hora_envio}
                  </span>
                </div>
                <div className="flex items-center gap-1 mt-2 text-xs text-brand-600 opacity-0 group-hover:opacity-100 transition-opacity">
                  Ver resultado del día <ChevronRight className="w-3 h-3" />
                </div>
              </button>
            );
          })}
        </div>

        {/* Quick: Ordenes no atendidas (always visible) */}
        <div className="chart-container">
          <h3 className="text-base font-bold text-gray-900 mb-1">Órdenes de Venta No Atendidas (Hoy)</h3>
          <p className="text-xs text-gray-400 mb-4">Grilla del correo SAP diario | alertasSapPA@pointamericas.com</p>
          <div className="overflow-x-auto">
            <table className="table-modern">
              <thead>
                <tr>
                  <th>N° Orden</th>
                  <th>Cliente</th>
                  <th>Descripción</th>
                  <th>Vendedor</th>
                  <th>Zona</th>
                  <th>F. Entrega</th>
                  <th className="text-right">Días Atraso</th>
                  <th className="text-right">Total USD</th>
                  <th>Comentarios</th>
                </tr>
              </thead>
              <tbody>
                {ordenes.map((o: any) => (
                  <tr key={o.numero_orden}>
                    <td className="font-mono font-bold text-brand-700">{o.numero_orden}</td>
                    <td className="font-medium max-w-[180px] truncate" title={o.cliente}>{o.cliente}</td>
                    <td className="text-sm">{o.descripcion}</td>
                    <td className="text-sm font-medium">{o.vendedor}</td>
                    <td className="text-sm text-gray-500">{o.zona}</td>
                    <td className="text-sm">{formatDate(o.fecha_entrega)}</td>
                    <td className="text-right">
                      <span className={`badge ${o.dias_atraso > 30 ? 'badge-danger' : 'badge-warning'}`}>
                        {o.dias_atraso}d
                      </span>
                    </td>
                    <td className="text-right font-bold">{formatUSD(o.total_usd)}</td>
                    <td className="text-xs text-gray-500 max-w-[200px] truncate" title={o.comentarios}>{o.comentarios}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Email Integration Section */}
        <div className="chart-container">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <Mail className="w-5 h-5 text-brand-500" />
                Correos de Alertas SAP
              </h3>
              <p className="text-xs text-gray-400 mt-1">
                Bandeja: alertasSapPA@pointamericas.com
                {emailConfigured ? (
                  <span className="ml-2 inline-flex items-center gap-1 text-brand-600 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-500" /> Conectado
                  </span>
                ) : (
                  <span className="ml-2 inline-flex items-center gap-1 text-amber-600 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Pendiente configurar
                  </span>
                )}
              </p>
            </div>
          </div>

          {!emailConfigured ? (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
              <p className="font-semibold mb-2">Configurar integración Microsoft 365</p>
              <ol className="list-decimal list-inside space-y-1 text-xs text-amber-700">
                <li>Registrar app en Azure AD (portal.azure.com &gt; App registrations)</li>
                <li>Agregar permiso <code className="bg-amber-100 px-1 rounded">Mail.Read</code> (Application)</li>
                <li>Dar consentimiento de admin para el tenant</li>
                <li>Configurar variables en .env: MS_TENANT_ID, MS_CLIENT_ID, MS_CLIENT_SECRET</li>
              </ol>
            </div>
          ) : emails.length > 0 ? (
            <div className="space-y-2">
              {emails.map((email: any) => (
                <div key={email.id} className="flex items-start sm:items-center gap-3 sm:gap-4 p-3 rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors">
                  <Mail className="w-4 h-4 text-brand-500 flex-shrink-0 mt-0.5 sm:mt-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{email.subject}</p>
                    <p className="text-xs text-gray-400 truncate">{email.preview}</p>
                    {email.to?.length > 0 && (
                      <p className="text-[10px] text-gray-400 mt-1 truncate">
                        Para: {email.to.slice(0, 3).join(', ')}{email.to.length > 3 ? ` +${email.to.length - 3} más` : ''}
                      </p>
                    )}
                  </div>
                  <span className="text-xs text-gray-400 whitespace-nowrap">
                    {new Date(email.sentDateTime).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 py-4 text-center">No se encontraron correos recientes</p>
          )}
        </div>
      </div>
    </div>
  );
}
