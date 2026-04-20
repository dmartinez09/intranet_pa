import { useEffect, useState, useMemo } from 'react';
import Header from '../components/layout/Header';
import { comexApi } from '../services/api';
import {
  Globe, Briefcase, Landmark, DollarSign, TrendingUp,
  AlertCircle, CheckCircle2, Clock, RefreshCw, Package, Target,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line, Area,
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

interface FamiliaRow {
  familia_pa: string;
  total_valor_cif_usd: number;
  total_cantidad_kg: number;
  empresas: number;
}

interface TrendRow {
  periodo_year: number;
  periodo_month: number;
  total_valor_cif_usd: number;
  total_cantidad_kg: number;
  operaciones: number;
}

interface FlowRow {
  pais_origen: string;
  iso2: string;
  total_valor_cif_usd: number;
  total_cantidad_kg: number;
  empresas: number;
  share_pct: number;
}

const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const FAMILIA_COLORS: Record<string, string> = {
  FUNGICIDAS: '#00A651',
  INSECTICIDAS: '#EF4444',
  HERBICIDAS: '#F59E0B',
  NUTRICIONALES: '#8B5CF6',
  BIOLOGICOS: '#06B6D4',
  COADYUVANTES: '#EC4899',
  ORGANICOS: '#10B981',
  OTROS: '#64748B',
};

export default function DashboardCOMEX() {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [familias, setFamilias] = useState<FamiliaRow[]>([]);
  const [trend, setTrend] = useState<TrendRow[]>([]);
  const [flows, setFlows] = useState<FlowRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState<number>(new Date().getFullYear());

  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { void load(); }, [year]); // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    setLoading(true);
    try {
      const [m, f, t, fl] = await Promise.all([
        comexApi.getMeta(),
        comexApi.getByFamilia(year),
        comexApi.getMonthlyTrend(year),
        comexApi.getFlows(year),
      ]);
      setMeta(m.data.data);
      setFamilias(f.data.data || []);
      setTrend(t.data.data || []);
      setFlows((fl.data.data || []).slice(0, 10));
    } catch (err) {
      console.error('[COMEX Dashboard] error:', err);
    } finally {
      setLoading(false);
    }
  }

  const totalCIF = useMemo(() => familias.reduce((s, f) => s + f.total_valor_cif_usd, 0), [familias]);
  const totalKg = useMemo(() => familias.reduce((s, f) => s + f.total_cantidad_kg, 0), [familias]);
  const totalOps = useMemo(() => trend.reduce((s, t) => s + t.operaciones, 0), [trend]);

  const trendChart = useMemo(() => trend.map(t => ({
    mes: MONTHS[(t.periodo_month || 1) - 1] + ' ' + String(t.periodo_year).slice(-2),
    cif: Math.round(t.total_valor_cif_usd),
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
          ${tablesReady
            ? 'bg-brand-50 border-brand-100 text-brand-700'
            : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
          <div className="flex items-center gap-2">
            {tablesReady
              ? <CheckCircle2 className="w-4 h-4" />
              : <AlertCircle className="w-4 h-4" />}
            <span className="font-semibold">
              {tablesReady ? 'Azure SQL COMEX conectado' : 'Tablas pendientes de migración'}
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <Clock className="w-3.5 h-3.5" />
            <span className="font-medium">Última ejecución ETL:</span>
            <span className="font-semibold">
              {meta?.last_run ? new Date(meta.last_run).toLocaleString('es-PE') : '— (sin ejecuciones)'}
            </span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <label className="text-xs text-gray-600">Año:</label>
            <select value={year} onChange={e => setYear(parseInt(e.target.value))}
                    className="text-xs border border-gray-200 rounded-md px-2 py-1 bg-white">
              {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
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

        {/* Empty state */}
        {!hasData && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
            <div className="flex flex-col items-center text-center gap-3 py-10">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center">
                <Globe className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">COMEX — en espera de datos</h3>
              <p className="text-sm text-gray-500 max-w-xl">
                {tablesReady
                  ? `Las tablas icb_cx_* están listas con ${meta?.partidas ?? 0} partidas, ${meta?.empresas_competidoras ?? 0} competidores y ${meta?.paises ?? 0} países. Ejecuta el collector "BASELINE_PE_COMEX" desde el panel admin de Inteligencia Comercial para poblar el dashboard.`
                  : 'Primero debe ejecutarse la migración 004_comex_competidores.sql en Azure SQL.'}
              </p>
            </div>
          </div>
        )}

        {/* Gráficos */}
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
                  <Tooltip formatter={(value: any) => [`$${Number(value).toLocaleString('es-PE')}`, 'CIF USD']} />
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
                        {familias.map((f, i) => (
                          <Cell key={i} fill={FAMILIA_COLORS[f.familia_pa] || '#64748B'} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: any) => `$${Number(v).toLocaleString('es-PE')}`} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex-1 space-y-2 w-full">
                    {familias.slice(0, 8).map((f) => (
                      <div key={f.familia_pa} className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: FAMILIA_COLORS[f.familia_pa] || '#64748B' }} />
                        <span className="text-xs text-gray-600 truncate flex-1">{f.familia_pa}</span>
                        <span className="text-xs font-bold text-gray-800">
                          ${Math.round(f.total_valor_cif_usd / 1000).toLocaleString('es-PE')}k
                        </span>
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
                    <Tooltip formatter={(v: any, n: any, p: any) => {
                      if (n === 'total_valor_cif_usd') return [`$${Number(v).toLocaleString('es-PE')} (${p.payload.share_pct}%)`, 'CIF USD'];
                      return v;
                    }} />
                    <Bar dataKey="total_valor_cif_usd" fill="#00A651" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </>
        )}

      </div>
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, gradient }:
  { icon: any; label: string; value: string | number; gradient: string }) {
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
