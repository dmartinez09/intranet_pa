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
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  RadialBarChart, RadialBar,
} from 'recharts';

const AGING_COLORS = ['#00A651', '#34D67B', '#FBBF24', '#F59E0B', '#EF4444'];

export default function Cartera() {
  const [kpis, setKpis] = useState<any>(null);
  const [carteraEdad, setCarteraEdad] = useState<any[]>([]);
  const [carteraVendedor, setCarteraVendedor] = useState<any[]>([]);
  const [transacciones, setTransacciones] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'resumen' | 'vendedores' | 'transacciones'>('resumen');
  const [searchTx, setSearchTx] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [kpiRes, edadRes, vendRes, txRes] = await Promise.all([
        carteraApi.getKPIs(),
        carteraApi.getPorEdad(),
        carteraApi.getPorVendedor(),
        carteraApi.getTransacciones(),
      ]);
      setKpis(kpiRes.data.data);
      setCarteraEdad(edadRes.data.data);
      setCarteraVendedor(vendRes.data.data);
      setTransacciones(txRes.data.data);
    } catch (err) {
      console.error('Error loading cartera:', err);
    } finally {
      setLoading(false);
    }
  }

  const filteredTx = transacciones.filter((t) =>
    !searchTx || t.cliente.toLowerCase().includes(searchTx.toLowerCase()) ||
    t.vendedor.toLowerCase().includes(searchTx.toLowerCase()) ||
    t.numero_doc.toLowerCase().includes(searchTx.toLowerCase())
  );

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
      <Header title="Cartera y Recaudo" subtitle="Estado de cuentas por cobrar - Marzo 2026" />

      <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4 sm:space-y-6">
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
          {(['resumen', 'vendedores', 'transacciones'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 sm:px-5 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap
                ${activeTab === tab ? 'bg-white text-brand-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              {tab === 'resumen' ? 'Resumen' : tab === 'vendedores' ? 'Recaudo por Vendedor' : 'Detalle Transacciones'}
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
      </div>
    </div>
  );
}
