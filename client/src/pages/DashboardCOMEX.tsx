import { useEffect, useState, useMemo } from 'react';
import Header from '../components/layout/Header';
import { comexApi } from '../services/api';
import {
  Globe, Briefcase, Landmark, DollarSign, TrendingUp,
  AlertCircle, CheckCircle2, Clock, RefreshCw, Package, Trophy,
} from 'lucide-react';
import ComexSourcesPanel from '../components/ComexSourcesPanel';
import ComexPeriodFilter from '../components/filters/ComexPeriodFilter';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Area,
} from 'recharts';

interface Meta {
  empresas_competidoras: number;
  partidas: number;
  paises: number;
  productos: number;
  importaciones_count: number;
  periodo_desde: string | null;
  periodo_hasta: string | null;
  last_run: string | null;
  last_run_status: string | null;
  tables_exist: boolean;
}

const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const FAMILIA_COLORS: Record<string, string> = {
  FUNGICIDAS: '#00A651', INSECTICIDAS: '#EF4444', HERBICIDAS: '#F59E0B',
  NUTRICIONALES: '#8B5CF6', BIOLOGICOS: '#06B6D4', COADYUVANTES: '#EC4899',
  ORGANICOS: '#10B981', OTROS: '#64748B',
};

const fmtUSD = (v: any) => `$${(Number(v) || 0).toLocaleString('es-PE', { maximumFractionDigits: 0 })}`;
const fmtKg = (v: any) => `${(Number(v) || 0).toLocaleString('es-PE', { maximumFractionDigits: 0 })} kg`;

export default function DashboardCOMEX() {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [familias, setFamilias] = useState<any[]>([]);
  const [trend, setTrend] = useState<any[]>([]);
  const [flows, setFlows] = useState<any[]>([]);
  const [ranking, setRanking] = useState<any[]>([]);
  const [productos, setProductos] = useState<any[]>([]);
  const [ops, setOps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState<number | undefined>();
  const [month, setMonth] = useState<number | undefined>();

  useEffect(() => { if (year) void load(); /* eslint-disable-next-line */ }, [year, month]);

  async function load() {
    setLoading(true);
    try {
      const [m, f, t, fl, rk, pr, op] = await Promise.all([
        comexApi.getMeta(),
        comexApi.getByFamilia(year, month),
        comexApi.getMonthlyTrend(year),
        comexApi.getFlows(year, undefined, month),
        comexApi.getRanking(year, 10, month),
        comexApi.getProductosResumen({ year, month, limit: 10 }),
        comexApi.getImportaciones({ year, month, limit: 200 }),
      ]);
      setMeta(m.data.data);
      setFamilias(f.data.data || []);
      setTrend(t.data.data || []);
      setFlows((fl.data.data || []).slice(0, 10));
      setRanking(rk.data.data || []);
      setProductos(pr.data.data || []);
      setOps(op.data.data || []);
    } catch (err) {
      console.error('[COMEX Dashboard] error:', err);
    } finally {
      setLoading(false);
    }
  }

  const totalCIF = useMemo(() => familias.reduce((s, f) => s + (Number(f.total_valor_cif_usd) || 0), 0), [familias]);
  const totalKg = useMemo(() => familias.reduce((s, f) => s + (Number(f.total_cantidad_kg) || 0), 0), [familias]);
  const totalOps = useMemo(() => trend.reduce((s, t) => s + (Number(t.operaciones) || 0), 0), [trend]);

  const trendChart = useMemo(() => trend.map(t => ({
    mes: MONTHS[(t.periodo_month || 1) - 1] + ' ' + String(t.periodo_year).slice(-2),
    cif: Math.round(Number(t.total_valor_cif_usd) || 0),
  })), [trend]);

  const hasData = meta?.importaciones_count && meta.importaciones_count > 0;
  const tablesReady = meta?.tables_exist;

  if (loading && !meta) {
    return (
      <div className="min-h-screen">
        <Header title="Dashboard Competidores" subtitle="Importaciones de agroquímicos en Perú (fuentes externas)" />
        <div className="flex items-center justify-center h-96">
          <div className="w-12 h-12 border-4 border-brand-200 border-t-brand-500 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header title="Dashboard Competidores" subtitle="Importaciones de agroquímicos en Perú (fuentes externas)" />

      <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4 sm:space-y-6">

        {/* Banner estado */}
        <div className={`flex flex-wrap items-center gap-3 px-4 py-3 rounded-xl border text-sm
          ${tablesReady ? 'bg-brand-50 border-brand-100 text-brand-700' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
          <div className="flex items-center gap-2">
            {tablesReady ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            <span className="font-semibold">{tablesReady ? 'Azure SQL COMEX conectado' : 'Tablas pendientes'}</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <Clock className="w-3.5 h-3.5" />
            <span className="font-medium">Última ejecución ETL:</span>
            <span className="font-semibold">
              {meta?.last_run ? new Date(meta.last_run).toLocaleString('es-PE') : '— (sin ejecuciones)'}
            </span>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <ComexPeriodFilter year={year} month={month} onChange={(y, mo) => { setYear(y); setMonth(mo); }} />
            <button onClick={load} className="flex items-center gap-1.5 text-xs font-medium text-brand-700 hover:text-brand-800">
              <RefreshCw className="w-3.5 h-3.5" /> Recargar
            </button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
          <KpiCard icon={Briefcase} label="Competidores" value={meta?.empresas_competidoras ?? 0} gradient="from-brand-500 to-brand-700" />
          <KpiCard icon={Landmark} label="Partidas" value={meta?.partidas ?? 0} gradient="from-accent-400 to-accent-600" />
          <KpiCard icon={Globe} label="Países origen" value={meta?.paises ?? 0} gradient="from-purple-400 to-purple-600" />
          <KpiCard icon={Package} label="Operaciones" value={totalOps.toLocaleString('es-PE')} gradient="from-cyan-400 to-cyan-600" />
          <KpiCard icon={DollarSign} label="CIF USD" value={`$${Math.round(totalCIF / 1000).toLocaleString('es-PE')}K`} gradient="from-green-500 to-green-700" />
          <KpiCard icon={TrendingUp} label="Kg Totales" value={`${Math.round(totalKg / 1000).toLocaleString('es-PE')}K`} gradient="from-amber-400 to-amber-600" />
        </div>

        {!hasData && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
            <div className="flex flex-col items-center text-center gap-3 py-10">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center">
                <Globe className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">COMEX — en espera de datos</h3>
              <p className="text-sm text-gray-500 max-w-xl">
                {tablesReady
                  ? `Ejecuta el collector "BASELINE_PE_COMEX" desde el panel admin para poblar el dashboard.`
                  : 'Primero debe ejecutarse la migración 004_comex_competidores.sql en Azure SQL.'}
              </p>
            </div>
          </div>
        )}

        {hasData && (
          <>
            {/* Tendencia mensual */}
            <div className="chart-container">
              <h3 className="text-base font-bold text-gray-900 mb-1">Tendencia Mensual de Importaciones</h3>
              <p className="text-xs text-gray-400 mb-4">Valor CIF USD por mes — {year}</p>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={trendChart} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <defs>
                    <linearGradient id="colorCif" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00A651" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#00A651" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: any) => fmtUSD(v)} />
                  <Area type="monotone" dataKey="cif" fill="url(#colorCif)" stroke="transparent" />
                  <Line type="monotone" dataKey="cif" stroke="#00A651" strokeWidth={2.5}
                    dot={{ fill: '#00A651', r: 3 }} activeDot={{ r: 6, fill: '#F59E0B' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Por familia PA */}
              <div className="chart-container">
                <h3 className="text-base font-bold text-gray-900 mb-1">Distribución por Familia PA</h3>
                <p className="text-xs text-gray-400 mb-4">CIF USD por categoría comercial</p>
                <div className="flex flex-col sm:flex-row items-center">
                  <ResponsiveContainer width="100%" height={260} className="sm:!w-[55%]">
                    <PieChart>
                      <Pie data={familias} dataKey="total_valor_cif_usd" nameKey="familia_pa"
                           cx="50%" cy="50%" outerRadius={95} innerRadius={50} paddingAngle={2} stroke="none">
                        {familias.map((f, i) => <Cell key={i} fill={FAMILIA_COLORS[f.familia_pa] || '#64748B'} />)}
                      </Pie>
                      <Tooltip formatter={(v: any) => fmtUSD(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex-1 space-y-2 w-full">
                    {familias.slice(0, 8).map((f) => (
                      <div key={f.familia_pa} className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: FAMILIA_COLORS[f.familia_pa] || '#64748B' }} />
                        <span className="text-xs text-gray-600 truncate flex-1">{f.familia_pa}</span>
                        <span className="text-xs font-bold text-gray-800">{fmtUSD(f.total_valor_cif_usd)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Top países origen */}
              <div className="chart-container">
                <h3 className="text-base font-bold text-gray-900 mb-1">Top 10 Países de Origen</h3>
                <p className="text-xs text-gray-400 mb-4">Importaciones CIF USD | % del total</p>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={flows} layout="vertical" margin={{ left: 80 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                    <YAxis type="category" dataKey="pais_origen" tick={{ fontSize: 11 }} width={80} />
                    <Tooltip formatter={(v: any, _n: any, p: any) => [`${fmtUSD(v)} (${p.payload.share_pct}%)`, 'CIF']} />
                    <Bar dataKey="total_valor_cif_usd" fill="#00A651" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* NUEVOS: Top Competidores + Top Productos */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="chart-container">
                <h3 className="text-base font-bold text-gray-900 mb-1 flex items-center gap-2"><Trophy className="w-4 h-4 text-amber-500" /> Top 10 Competidores</h3>
                <p className="text-xs text-gray-400 mb-4">Por valor CIF USD</p>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={ranking.slice(0, 10)} layout="vertical" margin={{ left: 100 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                    <YAxis type="category" dataKey="razon_social" tick={{ fontSize: 10 }} width={100} />
                    <Tooltip formatter={(v: any) => fmtUSD(v)} />
                    <Bar dataKey="total_valor_cif_usd" fill="#3B82F6" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="chart-container">
                <h3 className="text-base font-bold text-gray-900 mb-1 flex items-center gap-2"><Package className="w-4 h-4 text-emerald-500" /> Top 10 Ingredientes Activos</h3>
                <p className="text-xs text-gray-400 mb-4">Productos formulados / ingredientes químicos</p>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={productos.slice(0, 10)} layout="vertical" margin={{ left: 100 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                    <YAxis type="category" dataKey="ingrediente_activo" tick={{ fontSize: 10 }} width={100} />
                    <Tooltip formatter={(v: any) => fmtUSD(v)} />
                    <Bar dataKey="cif_usd" fill="#10B981" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Tabla detalle operaciones */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
                <h3 className="text-base font-bold text-gray-900">Detalle de operaciones {year}{month ? `-${String(month).padStart(2,'0')}` : ''}</h3>
                <p className="text-xs text-gray-500 mt-0.5">Últimas {ops.length} operaciones de importación (muestra)</p>
              </div>
              <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 sticky top-0 z-10">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-gray-600 uppercase tracking-wide">Periodo</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-600 uppercase tracking-wide">Empresa</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-600 uppercase tracking-wide">Partida</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-600 uppercase tracking-wide">Producto</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-600 uppercase tracking-wide">Familia</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-600 uppercase tracking-wide">País</th>
                      <th className="px-3 py-2 text-right font-semibold text-gray-600 uppercase tracking-wide">Kg</th>
                      <th className="px-3 py-2 text-right font-semibold text-gray-600 uppercase tracking-wide">CIF USD</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {ops.map((o: any, i: number) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-3 py-1.5">{o.periodo_year}-{String(o.periodo_month).padStart(2,'0')}</td>
                        <td className="px-3 py-1.5 font-medium text-gray-800 truncate max-w-[180px]" title={o.empresa_razon_social || o.razon_social}>{o.empresa_razon_social || o.razon_social || '—'}</td>
                        <td className="px-3 py-1.5 font-mono text-[10px]">{o.hs_code || '—'}</td>
                        <td className="px-3 py-1.5 text-emerald-700">{o.ingrediente_activo || o.producto || '—'}</td>
                        <td className="px-3 py-1.5"><span className="px-1.5 py-0.5 rounded text-[10px] font-medium" style={{ backgroundColor: (FAMILIA_COLORS[o.familia_pa] || '#64748B') + '22', color: FAMILIA_COLORS[o.familia_pa] || '#64748B' }}>{o.familia_pa || '—'}</span></td>
                        <td className="px-3 py-1.5">{o.pais_origen || o.codigo_iso || '—'}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums">{fmtKg(o.cantidad_kg)}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums font-semibold text-gray-900">{fmtUSD(o.valor_cif_usd)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        <ComexSourcesPanel />
      </div>
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, gradient }: { icon: any; label: string; value: string | number; gradient: string }) {
  return (
    <div className="kpi-card">
      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center mb-3 shadow-sm`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <p className="text-lg sm:text-xl font-extrabold text-gray-900 truncate">{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
}
