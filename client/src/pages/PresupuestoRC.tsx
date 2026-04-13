import { useState, useEffect, useMemo } from 'react';
import { ventaRCApi } from '../services/api';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ComposedChart, Line, Area, Cell, PieChart, Pie, Legend,
} from 'recharts';
import { Target, TrendingUp, TrendingDown, DollarSign, Calendar, Loader2, AlertCircle, Store, Truck, Mountain } from 'lucide-react';

const MONTHS_SHORT = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const COLORS = ['#00A651', '#34D67B', '#0EA5E9', '#6366F1', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

function formatUSD(n: number) {
  return '$' + n.toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

const GRUPOS = [
  { id: 'AGROINDUSTRIAS',     label: 'Agroindustrias',     icon: Store },
  { id: 'DIST. SIERRA SELVA', label: 'Dist. Sierra Selva', icon: Mountain },
  { id: 'DISTRIBUCION COSTA', label: 'Distribución Costa', icon: Truck },
] as const;

type GrupoId = typeof GRUPOS[number]['id'];

interface BudgetEntry {
  zona: string;
  rc: string;
  year: number;
  month: number;
  monto_usd: number;
}

export default function PresupuestoRC() {
  const [activeGrupo, setActiveGrupo] = useState<GrupoId>('AGROINDUSTRIAS');
  const [budget, setBudget] = useState<BudgetEntry[]>([]);
  const [ventasMensuales, setVentasMensuales] = useState<Record<number, number>>({});
  const [ventasData, setVentasData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [year] = useState(new Date().getFullYear());

  useEffect(() => {
    loadBudget();
  }, []);

  useEffect(() => {
    loadVentas(activeGrupo);
  }, [activeGrupo]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadBudget() {
    try {
      const res = await fetch('/api/budget/2026', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      }).then(r => r.json());
      setBudget(res.data || []);
    } catch (err) {
      console.error(err);
    }
  }

  async function loadVentas(grupo: GrupoId) {
    setLoading(true);
    try {
      const [diariaRes, vendedorRes] = await Promise.all([
        ventaRCApi.getDiarias({ year: 2026, month_start: 1, month_end: 12, grupo_cliente: grupo }),
        ventaRCApi.getPorVendedor({ year: 2026, month_start: 1, month_end: 12, grupo_cliente: grupo }),
      ]);
      const diarias = diariaRes.data.data || [];
      const monthly: Record<number, number> = {};
      for (const d of diarias) {
        const date = new Date(d.fecha);
        const m = date.getMonth() + 1;
        monthly[m] = (monthly[m] || 0) + d.total_venta_usd;
      }
      setVentasMensuales(monthly);
      setVentasData(vendedorRes.data.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const budgetByMonth = useMemo(() => {
    const map: Record<number, number> = {};
    for (const e of budget) map[e.month] = (map[e.month] || 0) + e.monto_usd;
    return map;
  }, [budget]);

  const monthlyComparison = useMemo(() => {
    const currentMonth = new Date().getMonth() + 1;
    return MONTHS_SHORT.map((name, i) => {
      const m = i + 1;
      const ppto = budgetByMonth[m] || 0;
      const venta = ventasMensuales[m] || 0;
      const logro = ppto > 0 ? (venta / ppto) * 100 : 0;
      return { name, month: m, presupuesto: Math.round(ppto), venta: Math.round(venta), logro: Math.round(logro * 10) / 10, isFuture: m > currentMonth };
    });
  }, [budgetByMonth, ventasMensuales]);

  const budgetByRC = useMemo(() => {
    const map: Record<string, number> = {};
    for (const e of budget) map[e.rc] = (map[e.rc] || 0) + e.monto_usd;
    return Object.entries(map).map(([rc, ppto]) => {
      const ventaMatch = ventasData.find((v: any) => v.vendedor?.toUpperCase().includes(rc.split(' ')[0].toUpperCase()));
      const venta = ventaMatch?.total_venta_usd || 0;
      return { rc, presupuesto: Math.round(ppto), venta: Math.round(venta), logro: ppto > 0 ? Math.round((venta / ppto) * 1000) / 10 : 0 };
    }).sort((a, b) => b.presupuesto - a.presupuesto);
  }, [budget, ventasData]);

  const budgetByZona = useMemo(() => {
    const map: Record<string, number> = {};
    for (const e of budget) map[e.zona] = (map[e.zona] || 0) + e.monto_usd;
    return Object.entries(map).map(([zona, total]) => ({ zona, total })).sort((a, b) => b.total - a.total);
  }, [budget]);

  const totalPpto = Object.values(budgetByMonth).reduce((s, v) => s + v, 0);
  const totalVenta = Object.values(ventasMensuales).reduce((s, v) => s + v, 0);
  const logroGeneral = totalPpto > 0 ? (totalVenta / totalPpto) * 100 : 0;
  const currentMonthPpto = budgetByMonth[new Date().getMonth() + 1] || 0;
  const currentMonthVenta = ventasMensuales[new Date().getMonth() + 1] || 0;
  const currentMonthLogro = currentMonthPpto > 0 ? (currentMonthVenta / currentMonthPpto) * 100 : 0;

  const grupoActivo = GRUPOS.find(g => g.id === activeGrupo)!;

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-white/95 backdrop-blur-sm rounded-xl shadow-xl border border-gray-100 px-4 py-3">
        <p className="font-semibold text-gray-800 text-sm mb-1">{label}</p>
        {payload.map((p: any, i: number) => (
          <p key={i} className="text-xs" style={{ color: p.color }}>
            {p.name}: {p.name === '% Logro' ? `${p.value}%` : formatUSD(p.value)}
          </p>
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Presupuesto RC {year}</h1>
        <p className="text-gray-500 text-sm mt-1">Avance de ventas vs presupuesto por grupo de clientes</p>
      </div>

      {/* Group Tabs */}
      <div className="flex flex-wrap gap-2">
        {GRUPOS.map((g) => {
          const Icon = g.icon;
          const isActive = activeGrupo === g.id;
          return (
            <button
              key={g.id}
              onClick={() => setActiveGrupo(g.id)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 border
                ${isActive
                  ? 'bg-brand-600 text-white border-brand-600 shadow-md shadow-brand-200'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-brand-400 hover:text-brand-600'
                }`}
            >
              <Icon className="w-4 h-4" />
              {g.label}
            </button>
          );
        })}
      </div>

      {budget.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
          <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 mb-2">No hay presupuesto cargado para {year}</p>
          <p className="text-xs text-gray-400">Vaya a Administración para cargar el presupuesto</p>
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center">
                  <Target className="w-5 h-5 text-brand-600" />
                </div>
                <span className="text-xs text-gray-500 uppercase tracking-wide">Ppto Anual</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{formatUSD(totalPpto)}</p>
              <p className="text-xs text-gray-400 mt-1">{grupoActivo.label}</p>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-emerald-600" />
                </div>
                <span className="text-xs text-gray-500 uppercase tracking-wide">Venta Acumulada</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{formatUSD(totalVenta)}</p>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${logroGeneral >= 80 ? 'bg-green-50' : logroGeneral >= 50 ? 'bg-amber-50' : 'bg-red-50'}`}>
                  {logroGeneral >= 50 ? <TrendingUp className={`w-5 h-5 ${logroGeneral >= 80 ? 'text-green-600' : 'text-amber-600'}`} /> : <TrendingDown className="w-5 h-5 text-red-600" />}
                </div>
                <span className="text-xs text-gray-500 uppercase tracking-wide">% Logro Acum.</span>
              </div>
              <p className={`text-2xl font-bold ${logroGeneral >= 80 ? 'text-green-700' : logroGeneral >= 50 ? 'text-amber-700' : 'text-red-700'}`}>
                {logroGeneral.toFixed(1)}%
              </p>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-blue-600" />
                </div>
                <span className="text-xs text-gray-500 uppercase tracking-wide">Logro Mes Actual</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{currentMonthLogro.toFixed(1)}%</p>
              <p className="text-xs text-gray-400 mt-1">{formatUSD(currentMonthVenta)} / {formatUSD(currentMonthPpto)}</p>
            </div>
          </div>

          {/* Monthly comparison chart */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-1">Venta vs Presupuesto Mensual</h3>
            <p className="text-xs text-gray-400 mb-4">{grupoActivo.label} — comparación mensual en USD</p>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={monthlyComparison} barCategoryGap="20%">
                  <defs>
                    <linearGradient id="gradVentaRC" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#00A651" stopOpacity={0.9} />
                      <stop offset="100%" stopColor="#00A651" stopOpacity={0.6} />
                    </linearGradient>
                    <linearGradient id="gradPptoRC" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#94A3B8" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="#94A3B8" stopOpacity={0.2} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} domain={[0, 150]} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar yAxisId="left" dataKey="presupuesto" name="Presupuesto" fill="url(#gradPptoRC)" radius={[6, 6, 0, 0]} />
                  <Bar yAxisId="left" dataKey="venta" name="Venta Real" fill="url(#gradVentaRC)" radius={[6, 6, 0, 0]} />
                  <Line yAxisId="right" type="monotone" dataKey="logro" name="% Logro" stroke="#6366F1" strokeWidth={2.5} dot={{ r: 4, fill: '#6366F1' }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* RC Ranking table */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-1">Ranking RC vs Presupuesto</h3>
            <p className="text-xs text-gray-400 mb-4">{grupoActivo.label} — avance acumulado por representante comercial</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-3 text-xs font-semibold text-gray-500 uppercase">#</th>
                    <th className="text-left py-3 px-3 text-xs font-semibold text-gray-500 uppercase">RC</th>
                    <th className="text-right py-3 px-3 text-xs font-semibold text-gray-500 uppercase">Presupuesto</th>
                    <th className="text-right py-3 px-3 text-xs font-semibold text-gray-500 uppercase">Venta</th>
                    <th className="text-right py-3 px-3 text-xs font-semibold text-gray-500 uppercase">% Logro</th>
                    <th className="py-3 px-3 text-xs font-semibold text-gray-500 uppercase w-40">Avance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {budgetByRC.map((row, i) => (
                    <tr key={row.rc} className="hover:bg-gray-50/50">
                      <td className="py-3 px-3 text-xs text-gray-400">{i + 1}</td>
                      <td className="py-3 px-3 font-medium text-gray-800">{row.rc}</td>
                      <td className="py-3 px-3 text-right font-mono text-xs">{formatUSD(row.presupuesto)}</td>
                      <td className="py-3 px-3 text-right font-mono text-xs">{formatUSD(row.venta)}</td>
                      <td className={`py-3 px-3 text-right font-semibold ${row.logro >= 80 ? 'text-green-600' : row.logro >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                        {row.logro}%
                      </td>
                      <td className="py-3 px-3">
                        <div className="w-full bg-gray-100 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all ${row.logro >= 80 ? 'bg-green-500' : row.logro >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                            style={{ width: `${Math.min(row.logro, 100)}%` }}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Bottom row: Zona + Acumulado */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Distribución por Zona</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={budgetByZona} dataKey="total" nameKey="zona" cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={3}
                      label={({ zona, percent }: any) => `${zona?.substring(0, 12)} ${(percent * 100).toFixed(0)}%`}
                      labelLine={{ strokeWidth: 1 }}>
                      {budgetByZona.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => formatUSD(v)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Avance Acumulado</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={monthlyComparison.map((m, i) => ({
                    name: m.name,
                    presupuesto_acum: monthlyComparison.slice(0, i + 1).reduce((s, v) => s + v.presupuesto, 0),
                    venta_acum: monthlyComparison.slice(0, i + 1).reduce((s, v) => s + v.venta, 0),
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000000).toFixed(1)}M`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Area type="monotone" dataKey="presupuesto_acum" name="Ppto Acum." fill="#94A3B8" fillOpacity={0.15} stroke="#94A3B8" strokeWidth={2} strokeDasharray="5 5" />
                    <Area type="monotone" dataKey="venta_acum" name="Venta Acum." fill="#00A651" fillOpacity={0.15} stroke="#00A651" strokeWidth={2.5} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
