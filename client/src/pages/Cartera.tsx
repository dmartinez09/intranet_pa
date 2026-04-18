import { useState, useEffect } from 'react';
import Header from '../components/layout/Header';
import { carteraApi } from '../services/api';
import { formatUSD, formatNumber, formatPercent } from '../lib/utils';
import {
  Wallet,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Users,
  TrendingDown,
  Search,
  ChevronDown,
  ArrowUpDown,
  RefreshCw,
  FileWarning,
  CreditCard,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  RadialBarChart, RadialBar,
} from 'recharts';

const AGING_COLORS = ['#00A651', '#34D67B', '#FBBF24', '#F59E0B', '#EF4444'];

type CarteraTab = 'resumen' | 'vendedores' | 'transacciones' | 'letras_no_aceptadas' | 'linea_creditos';

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('es-PE', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function Cartera() {
  const [kpis, setKpis] = useState<any>(null);
  const [carteraEdad, setCarteraEdad] = useState<any[]>([]);
  const [carteraVendedor, setCarteraVendedor] = useState<any[]>([]);
  const [transacciones, setTransacciones] = useState<any[]>([]);
  const [letrasNoAcept, setLetrasNoAcept] = useState<any[]>([]);
  const [lineaCreditos, setLineaCreditos] = useState<any[]>([]);
  const [meta, setMeta] = useState<{ al004: string | null; al006: string | null; al007: string | null }>({ al004: null, al006: null, al007: null });
  const [grupos, setGrupos] = useState<string[]>([]);
  const [grupo, setGrupo] = useState<string>('');
  const [activeTab, setActiveTab] = useState<CarteraTab>('resumen');
  const [searchTx, setSearchTx] = useState('');
  const [searchLNA, setSearchLNA] = useState('');
  const [searchLC, setSearchLC] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    carteraApi.getGrupos().then(r => setGrupos(r.data.data)).catch(() => {});
  }, []);

  useEffect(() => {
    loadData();
    // reset lazy loaded tabs when grupo changes
    setLnaLoaded(false);
    setLcLoaded(false);
    setLetrasNoAcept([]);
    setLineaCreditos([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grupo]);

  const [lnaLoaded, setLnaLoaded] = useState(false);
  const [lcLoaded, setLcLoaded] = useState(false);

  async function loadData() {
    setLoading(true);
    try {
      const params = grupo ? { grupo } : undefined;
      const [kpiRes, edadRes, vendRes, txRes, metaRes] = await Promise.all([
        carteraApi.getKPIs(params),
        carteraApi.getPorEdad(params),
        carteraApi.getPorVendedor(params),
        carteraApi.getTransacciones(params),
        carteraApi.getMeta(),
      ]);
      setKpis(kpiRes.data.data);
      setCarteraEdad(edadRes.data.data);
      setCarteraVendedor(vendRes.data.data);
      setTransacciones(txRes.data.data);
      setMeta(metaRes.data.data);
    } catch (err) {
      console.error('Error loading cartera:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const params = grupo ? { grupo } : undefined;
    if (activeTab === 'letras_no_aceptadas' && !lnaLoaded) {
      carteraApi.getLetrasNoAceptadas(params)
        .then(r => setLetrasNoAcept(r.data.data))
        .catch(e => console.error('LNA load error:', e))
        .finally(() => setLnaLoaded(true));
    }
    if (activeTab === 'linea_creditos' && !lcLoaded) {
      carteraApi.getLineaCreditos(params)
        .then(r => setLineaCreditos(r.data.data))
        .catch(e => console.error('LC load error:', e))
        .finally(() => setLcLoaded(true));
    }
  }, [activeTab, lnaLoaded, lcLoaded, grupo]);

  const currentUpdate = activeTab === 'letras_no_aceptadas' ? meta.al006
    : activeTab === 'linea_creditos' ? meta.al007
    : meta.al004;

  const filteredTx = transacciones.filter((t) =>
    !searchTx || t.cliente.toLowerCase().includes(searchTx.toLowerCase()) ||
    t.vendedor.toLowerCase().includes(searchTx.toLowerCase()) ||
    t.numero_doc.toLowerCase().includes(searchTx.toLowerCase())
  );

  const filteredLNA = letrasNoAcept.filter((l) => {
    if (!searchLNA) return true;
    const q = searchLNA.toLowerCase();
    return (l.cliente || '').toLowerCase().includes(q)
      || (l.vendedor || '').toLowerCase().includes(q)
      || (l.numero_documento || '').toLowerCase().includes(q)
      || (l.numero_letra || '').toLowerCase().includes(q);
  });

  const filteredLC = lineaCreditos.filter((l) => {
    if (!searchLC) return true;
    const q = searchLC.toLowerCase();
    return (l.cliente || '').toLowerCase().includes(q)
      || (l.vendedor || '').toLowerCase().includes(q)
      || (l.codigo_cliente || '').toLowerCase().includes(q);
  });

  const lnaKpis = {
    total: filteredLNA.reduce((s, l) => s + (l.importe_pendiente || 0), 0),
    cantidad: filteredLNA.length,
    clientes: new Set(filteredLNA.map(l => l.ruc)).size,
  };
  const lcKpis = {
    totalLinea: filteredLC.reduce((s, l) => s + (l.linea_credito || 0), 0),
    totalUsada: filteredLC.reduce((s, l) => s + (l.linea_usada || 0), 0),
    totalDisp: filteredLC.reduce((s, l) => s + (l.linea_disponible || 0), 0),
    clientes: filteredLC.length,
  };

  if (loading) {
    return (
      <div className="min-h-screen">
        <Header title="Cartera y Recaudo" subtitle="Gestión de cuentas por cobrar" />
        <div className="flex items-center justify-center h-96">
          <div className="w-12 h-12 border-4 border-brand-200 border-t-brand-500 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  const recaudoData = [{ name: 'Recaudo', value: kpis?.porcentaje_recaudo || 0, fill: '#00A651' }];

  return (
    <div className="min-h-screen">
      <Header title="Cartera y Recaudo" subtitle="Estado de cuentas por cobrar" />

      <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4 sm:space-y-6">
        {/* Filtro de Grupo + Leyenda de última actualización */}
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={grupo}
            onChange={(e) => setGrupo(e.target.value)}
            className="input-field text-sm py-1.5 px-3 pr-8 min-w-[200px]"
          >
            <option value="">Todos los Grupos</option>
            {grupos.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
          <div className="flex items-center gap-2 px-3 py-2 bg-brand-50 border border-brand-100 rounded-lg text-xs text-brand-700">
            <RefreshCw className="w-3.5 h-3.5" />
            <span className="font-medium">Última actualización:</span>
            <span className="font-semibold">{formatDateTime(currentUpdate)}</span>
          </div>
        </div>

        {/* KPI Cards */}
        {kpis && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
            <div className="kpi-card">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center mb-3">
                <Wallet className="w-5 h-5 text-white" />
              </div>
              <p className="text-lg sm:text-2xl font-extrabold text-gray-900 truncate">{formatUSD(kpis.total_cartera)}</p>
              <p className="text-[10px] sm:text-xs text-gray-500">Cartera Total</p>
            </div>
            <div className="kpi-card">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-danger-400 to-danger-600 flex items-center justify-center mb-3">
                <AlertTriangle className="w-5 h-5 text-white" />
              </div>
              <p className="text-lg sm:text-2xl font-extrabold text-danger-600 truncate">{formatUSD(kpis.cartera_vencida)}</p>
              <p className="text-xs text-gray-500">Cartera Vencida</p>
            </div>
            <div className="kpi-card">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center mb-3">
                <CheckCircle2 className="w-5 h-5 text-white" />
              </div>
              <p className="text-lg sm:text-2xl font-extrabold text-brand-600 truncate">{formatUSD(kpis.cartera_vigente)}</p>
              <p className="text-xs text-gray-500">Cartera Vigente</p>
            </div>
            <div className="kpi-card">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent-400 to-accent-600 flex items-center justify-center mb-3">
                <TrendingDown className="w-5 h-5 text-white" />
              </div>
              <p className="text-lg sm:text-2xl font-extrabold text-gray-900">{formatPercent(kpis.porcentaje_recaudo)}</p>
              <p className="text-xs text-gray-500">% Recaudo</p>
            </div>
            <div className="kpi-card">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center mb-3">
                <Clock className="w-5 h-5 text-white" />
              </div>
              <p className="text-lg sm:text-2xl font-extrabold text-gray-900">{kpis.dias_promedio_cobro}</p>
              <p className="text-xs text-gray-500">Días Prom. Cobro</p>
            </div>
            <div className="kpi-card">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-400 to-red-600 flex items-center justify-center mb-3">
                <Users className="w-5 h-5 text-white" />
              </div>
              <p className="text-lg sm:text-2xl font-extrabold text-gray-900">{kpis.clientes_morosos}</p>
              <p className="text-xs text-gray-500">Clientes Morosos</p>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-full sm:w-fit overflow-x-auto">
          {([
            { key: 'resumen', label: 'Resumen' },
            { key: 'vendedores', label: 'Recaudo por Vendedor' },
            { key: 'transacciones', label: 'Detalle Transacciones' },
            { key: 'letras_no_aceptadas', label: 'Letras No Aceptadas' },
            { key: 'linea_creditos', label: 'Línea de Créditos' },
          ] as { key: CarteraTab; label: string }[]).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-3 sm:px-5 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap
                ${activeTab === tab.key ? 'bg-white text-brand-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab: Resumen */}
        {activeTab === 'resumen' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-in">
            <div className="chart-container">
              <h3 className="text-base font-bold text-gray-900 mb-1">Antigüedad de Cartera</h3>
              <p className="text-xs text-gray-400 mb-4">Distribución por rango de días</p>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={carteraEdad} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="rango" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(value: any) => [formatUSD(value), 'Monto']} />
                  <Bar dataKey="monto" radius={[8, 8, 0, 0]}>
                    {carteraEdad.map((_, i) => (
                      <Cell key={i} fill={AGING_COLORS[i % AGING_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="chart-container">
              <h3 className="text-base font-bold text-gray-900 mb-1">Índice de Recaudo</h3>
              <p className="text-xs text-gray-400 mb-4">Porcentaje de recaudo sobre cartera total</p>
              <div className="flex items-center justify-center">
                <ResponsiveContainer width="50%" height={250}>
                  <RadialBarChart cx="50%" cy="50%" innerRadius="70%" outerRadius="100%" startAngle={180} endAngle={0} data={recaudoData} barSize={20}>
                    <RadialBar background dataKey="value" cornerRadius={10} fill="#00A651" />
                  </RadialBarChart>
                </ResponsiveContainer>
              </div>
              <div className="text-center -mt-16">
                <p className="text-4xl font-extrabold text-gray-900">{formatPercent(kpis?.porcentaje_recaudo || 0)}</p>
                <p className="text-sm text-gray-500 mt-1">de recaudo efectivo</p>
              </div>
              <div className="mt-8 space-y-2">
                {carteraEdad.map((c, i) => (
                  <div key={c.rango} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: AGING_COLORS[i] }} />
                      <span className="text-sm text-gray-700">{c.rango}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm font-semibold">{formatUSD(c.monto)}</span>
                      <span className="text-xs text-gray-400">{c.cantidad_documentos} docs</span>
                      <span className="badge-info text-[10px]">{formatPercent(c.porcentaje)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tab: Recaudo por Vendedor */}
        {activeTab === 'vendedores' && (
          <div className="animate-fade-in">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto">
              <table className="table-modern">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Vendedor</th>
                    <th>Zona</th>
                    <th>Equipo</th>
                    <th className="text-right">Cartera Total</th>
                    <th className="text-right">Vencida</th>
                    <th className="text-right">Vigente</th>
                    <th className="text-right">Recaudado</th>
                    <th className="text-right">% Recaudo</th>
                    <th className="text-right">Clientes</th>
                    <th className="text-right">Días Prom.</th>
                  </tr>
                </thead>
                <tbody>
                  {carteraVendedor.map((v, i) => (
                    <tr key={v.vendedor}>
                      <td>
                        <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold
                          ${i < 3 ? 'bg-brand-100 text-brand-700' : 'bg-gray-100 text-gray-500'}`}>
                          {i + 1}
                        </span>
                      </td>
                      <td className="font-semibold">{v.vendedor}</td>
                      <td className="text-gray-500">{v.zona}</td>
                      <td><span className="badge-info">{v.equipo}</span></td>
                      <td className="text-right font-bold">{formatUSD(v.cartera_total)}</td>
                      <td className="text-right text-danger-600 font-medium">{formatUSD(v.cartera_vencida)}</td>
                      <td className="text-right text-brand-600 font-medium">{formatUSD(v.cartera_vigente)}</td>
                      <td className="text-right font-bold text-brand-700">{formatUSD(v.recaudado)}</td>
                      <td className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${Math.min(v.porcentaje_recaudo, 100)}%`,
                                backgroundColor: v.porcentaje_recaudo >= 70 ? '#00A651' : v.porcentaje_recaudo >= 40 ? '#F59E0B' : '#EF4444',
                              }}
                            />
                          </div>
                          <span className={`text-xs font-bold ${
                            v.porcentaje_recaudo >= 70 ? 'text-brand-600' : v.porcentaje_recaudo >= 40 ? 'text-accent-600' : 'text-danger-500'
                          }`}>
                            {formatPercent(v.porcentaje_recaudo)}
                          </span>
                        </div>
                      </td>
                      <td className="text-right">{v.clientes_con_deuda}</td>
                      <td className="text-right">
                        <span className={`badge ${
                          v.dias_promedio_cobro > 60 ? 'badge-danger' : v.dias_promedio_cobro > 30 ? 'badge-warning' : 'bg-brand-50 text-brand-600'
                        }`}>
                          {v.dias_promedio_cobro}d
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          </div>
        )}

        {/* Tab: Detalle Transacciones */}
        {activeTab === 'transacciones' && (
          <div className="animate-fade-in space-y-4">
            <div className="flex items-center gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchTx}
                  onChange={(e) => setSearchTx(e.target.value)}
                  placeholder="Buscar por cliente, vendedor o documento..."
                  className="input-field pl-10"
                />
              </div>
              <p className="text-sm text-gray-400">{filteredTx.length} documentos</p>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="table-modern">
                  <thead>
                    <tr>
                      <th>Documento</th>
                      <th>Cliente</th>
                      <th>Vendedor</th>
                      <th>Zona</th>
                      <th>Condición</th>
                      <th className="text-right">Monto Original</th>
                      <th className="text-right">Pagado</th>
                      <th className="text-right">Saldo Pend.</th>
                      <th className="text-right">Días Mora</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTx.map((t) => (
                      <tr key={t.numero_doc}>
                        <td className="font-mono text-xs font-bold text-brand-700">{t.numero_doc}</td>
                        <td className="font-medium max-w-[200px] truncate" title={t.cliente}>{t.cliente}</td>
                        <td className="text-sm">{t.vendedor}</td>
                        <td className="text-sm text-gray-500">{t.zona}</td>
                        <td><span className="text-xs text-gray-500">{t.condicion_pago}</span></td>
                        <td className="text-right">{formatUSD(t.monto_original)}</td>
                        <td className="text-right text-brand-600">{formatUSD(t.monto_pagado)}</td>
                        <td className="text-right font-bold">{formatUSD(t.saldo_pendiente)}</td>
                        <td className="text-right">
                          <span className={`badge ${
                            t.dias_mora > 90 ? 'badge-danger' : t.dias_mora > 30 ? 'badge-warning' : 'bg-brand-50 text-brand-600'
                          }`}>
                            {t.dias_mora}d
                          </span>
                        </td>
                        <td>
                          <span className={`badge text-[10px] ${
                            t.estado === 'Vencido Crítico' ? 'bg-red-100 text-red-700' :
                            t.estado === 'Vencido' ? 'bg-amber-50 text-amber-700' :
                            t.estado === 'Por Vencer' ? 'bg-yellow-50 text-yellow-700' :
                            'bg-brand-50 text-brand-700'
                          }`}>
                            {t.estado}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Tab: Letras Emitidas No Aceptadas (AL006) */}
        {activeTab === 'letras_no_aceptadas' && (
          <div className="animate-fade-in space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
              <div className="kpi-card">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center mb-3">
                  <FileWarning className="w-5 h-5 text-white" />
                </div>
                <p className="text-lg sm:text-2xl font-extrabold text-gray-900 truncate">{formatUSD(lnaKpis.total)}</p>
                <p className="text-xs text-gray-500">Importe Pendiente Total</p>
              </div>
              <div className="kpi-card">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center mb-3">
                  <AlertTriangle className="w-5 h-5 text-white" />
                </div>
                <p className="text-lg sm:text-2xl font-extrabold text-gray-900">{formatNumber(lnaKpis.cantidad)}</p>
                <p className="text-xs text-gray-500">Letras No Aceptadas</p>
              </div>
              <div className="kpi-card">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center mb-3">
                  <Users className="w-5 h-5 text-white" />
                </div>
                <p className="text-lg sm:text-2xl font-extrabold text-gray-900">{formatNumber(lnaKpis.clientes)}</p>
                <p className="text-xs text-gray-500">Clientes Afectados</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchLNA}
                  onChange={(e) => setSearchLNA(e.target.value)}
                  placeholder="Buscar por cliente, vendedor, documento o letra..."
                  className="input-field pl-10"
                />
              </div>
              <p className="text-sm text-gray-400">
                {filteredLNA.length > 200 ? `Mostrando 200 de ${filteredLNA.length}` : `${filteredLNA.length} letras`}
              </p>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="table-modern">
                  <thead>
                    <tr>
                      <th>N° Letra</th>
                      <th>Doc. Origen</th>
                      <th>Cliente</th>
                      <th>RUC</th>
                      <th>Vendedor</th>
                      <th>F. Creación</th>
                      <th>F. Emisión</th>
                      <th>F. Vencimiento</th>
                      <th>Moneda</th>
                      <th className="text-right">Importe Pend.</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLNA.slice(0, 200).map((l, i) => (
                      <tr key={`${l.numero_letra}-${i}`}>
                        <td className="font-mono text-xs font-bold text-brand-700">{l.numero_letra || '—'}</td>
                        <td className="font-mono text-xs text-gray-600">{l.documento_origen || l.numero_documento || '—'}</td>
                        <td className="font-medium max-w-[220px] truncate" title={l.cliente}>{l.cliente}</td>
                        <td className="font-mono text-xs text-gray-500">{l.ruc}</td>
                        <td className="text-sm">{l.vendedor || '—'}</td>
                        <td className="text-xs text-gray-600">{l.fecha_creacion || '—'}</td>
                        <td className="text-xs text-gray-600">{l.fecha_emision || '—'}</td>
                        <td className="text-xs text-gray-600">{l.fecha_vencimiento || '—'}</td>
                        <td><span className="badge-info text-[10px]">{l.moneda}</span></td>
                        <td className="text-right font-bold">{formatUSD(l.importe_pendiente)}</td>
                        <td>
                          <span className="badge bg-amber-50 text-amber-700 text-[10px]">
                            {l.estado_letra || '—'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Tab: Línea de Créditos (AL007) */}
        {activeTab === 'linea_creditos' && (
          <div className="animate-fade-in space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 sm:gap-4">
              <div className="kpi-card">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center mb-3">
                  <CreditCard className="w-5 h-5 text-white" />
                </div>
                <p className="text-lg sm:text-2xl font-extrabold text-gray-900 truncate">{formatUSD(lcKpis.totalLinea)}</p>
                <p className="text-xs text-gray-500">Línea Total Asignada</p>
              </div>
              <div className="kpi-card">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent-400 to-accent-600 flex items-center justify-center mb-3">
                  <TrendingDown className="w-5 h-5 text-white" />
                </div>
                <p className="text-lg sm:text-2xl font-extrabold text-accent-700 truncate">{formatUSD(lcKpis.totalUsada)}</p>
                <p className="text-xs text-gray-500">Línea Usada</p>
              </div>
              <div className="kpi-card">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center mb-3">
                  <CheckCircle2 className="w-5 h-5 text-white" />
                </div>
                <p className="text-lg sm:text-2xl font-extrabold text-brand-600 truncate">{formatUSD(lcKpis.totalDisp)}</p>
                <p className="text-xs text-gray-500">Línea Disponible</p>
              </div>
              <div className="kpi-card">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center mb-3">
                  <Users className="w-5 h-5 text-white" />
                </div>
                <p className="text-lg sm:text-2xl font-extrabold text-gray-900">{formatNumber(lcKpis.clientes)}</p>
                <p className="text-xs text-gray-500">Clientes con Línea</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchLC}
                  onChange={(e) => setSearchLC(e.target.value)}
                  placeholder="Buscar por cliente, código o vendedor..."
                  className="input-field pl-10"
                />
              </div>
              <p className="text-sm text-gray-400">
                {filteredLC.length > 200 ? `Mostrando 200 de ${filteredLC.length}` : `${filteredLC.length} clientes`}
              </p>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="table-modern">
                  <thead>
                    <tr>
                      <th>Código</th>
                      <th>Cliente</th>
                      <th>Vendedor</th>
                      <th>Zona</th>
                      <th>Equipo</th>
                      <th>Moneda</th>
                      <th className="text-right">Línea Crédito</th>
                      <th className="text-right">Línea Usada</th>
                      <th className="text-right">Línea Disponible</th>
                      <th className="text-right">% Uso</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLC.slice(0, 200).map((l, i) => (
                      <tr key={`${l.codigo_cliente}-${i}`}>
                        <td className="font-mono text-xs font-bold text-brand-700">{l.codigo_cliente}</td>
                        <td className="font-medium max-w-[240px] truncate" title={l.cliente}>{l.cliente}</td>
                        <td className="text-sm">{l.vendedor || '—'}</td>
                        <td className="text-sm text-gray-500">{l.zona || '—'}</td>
                        <td>{l.grupo_cliente ? <span className="badge-info text-[10px]">{l.grupo_cliente}</span> : '—'}</td>
                        <td><span className="text-xs text-gray-500">{l.moneda}</span></td>
                        <td className="text-right font-bold">{formatUSD(l.linea_credito)}</td>
                        <td className="text-right text-accent-600 font-medium">{formatUSD(l.linea_usada)}</td>
                        <td className="text-right text-brand-600 font-medium">{formatUSD(l.linea_disponible)}</td>
                        <td className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-16 h-2 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{
                                  width: `${Math.min(l.porcentaje_uso, 100)}%`,
                                  backgroundColor: l.porcentaje_uso >= 90 ? '#EF4444' : l.porcentaje_uso >= 70 ? '#F59E0B' : '#00A651',
                                }}
                              />
                            </div>
                            <span className={`text-xs font-bold ${
                              l.porcentaje_uso >= 90 ? 'text-danger-500' : l.porcentaje_uso >= 70 ? 'text-accent-600' : 'text-brand-600'
                            }`}>
                              {formatPercent(l.porcentaje_uso)}
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
