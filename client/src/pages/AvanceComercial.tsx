import { useState, useEffect, useMemo } from 'react';
import { ventasApi } from '../services/api';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ComposedChart, Line, PieChart, Pie, Cell, Legend, Treemap,
} from 'recharts';
import { Users, TrendingUp, Droplets, Filter, ChevronDown, ChevronUp, Search, Loader2 } from 'lucide-react';

const MONTHS_SHORT = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const COLORS = ['#00A651', '#34D67B', '#0EA5E9', '#6366F1', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316', '#06B6D4', '#A855F7'];
const ZONE_COLORS: Record<string, string> = {
  'LIMA': '#00A651', 'ICA': '#34D67B', 'LA LIBERTAD': '#0EA5E9', 'JUNIN': '#6366F1',
  'AREQUIPA': '#F59E0B', 'PIURA': '#EF4444', 'CAJAMARCA': '#8B5CF6', 'AMAZONAS': '#EC4899',
  'LAMBAYEQUE': '#14B8A6', 'HUANCAVELICA': '#F97316', 'TACNA': '#06B6D4',
};

function formatUSD(n: number) { return '$' + n.toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 }); }
function formatKG(n: number) { return n.toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' KG/LT'; }

export default function AvanceComercial() {
  const [vendedores, setVendedores] = useState<any[]>([]);
  const [familias, setFamilias] = useState<any[]>([]);
  const [clientes, setClientes] = useState<any[]>([]);
  const [opcionesFiltro, setOpcionesFiltro] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);

  const now = new Date();
  const [year] = useState(now.getFullYear());
  const [monthStart, setMonthStart] = useState(1);
  const [monthEnd, setMonthEnd] = useState(now.getMonth() + 1);
  const [division, setDivision] = useState('');
  const [maestroTipo, setMaestroTipo] = useState('');

  useEffect(() => {
    loadFiltros();
    loadData();
  }, []);

  async function loadFiltros() {
    try {
      const res = await ventasApi.getFiltros();
      setOpcionesFiltro(res.data.data);
    } catch (err) { console.error(err); }
  }

  async function loadData(params?: any) {
    setLoading(true);
    try {
      const p = params || { year, month_start: monthStart, month_end: monthEnd };
      if (division) p.division = division;
      if (maestroTipo) p.maestro_tipo = maestroTipo;

      const [vendRes, famRes, cliRes] = await Promise.all([
        ventasApi.getPorVendedor(p),
        ventasApi.getPorFamilia(p),
        ventasApi.getPorCliente(p),
      ]);
      setVendedores(vendRes.data.data || []);
      setFamilias(famRes.data.data || []);
      setClientes(cliRes.data.data || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  function applyFilters() {
    loadData({ year, month_start: monthStart, month_end: monthEnd, division, maestro_tipo: maestroTipo });
  }

  // Top 10 RC by venta
  const topRC = vendedores.slice(0, 10);
  const totalVenta = vendedores.reduce((s, v) => s + v.total_venta_usd, 0);
  const totalKG = vendedores.reduce((s, v) => s + (v.total_kg_lt || 0), 0);
  const totalClientes = vendedores.reduce((s, v) => s + (v.cantidad_clientes || 0), 0);

  // RC by zona
  const rcByZona = useMemo(() => {
    const map: Record<string, { zona: string; total_usd: number; total_kg: number; rcs: number }> = {};
    for (const v of vendedores) {
      const z = v.zona || 'SIN ZONA';
      if (!map[z]) map[z] = { zona: z, total_usd: 0, total_kg: 0, rcs: 0 };
      map[z].total_usd += v.total_venta_usd;
      map[z].total_kg += v.total_kg_lt || 0;
      map[z].rcs++;
    }
    return Object.values(map).sort((a, b) => b.total_usd - a.total_usd);
  }, [vendedores]);

  // KG/LT by RC
  const rcByKG = vendedores.slice(0, 12).map(v => ({
    name: v.vendedor?.length > 15 ? v.vendedor.substring(0, 15) + '...' : v.vendedor,
    kg_lt: Math.round(v.total_kg_lt || 0),
    venta: Math.round(v.total_venta_usd),
  })).sort((a, b) => b.kg_lt - a.kg_lt);

  // Family treemap
  const familiaTreemap = familias.slice(0, 8).map((f, i) => ({
    name: f.familia,
    size: Math.round(f.total_venta_usd),
    fill: COLORS[i % COLORS.length],
  }));

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-white/95 backdrop-blur-sm rounded-xl shadow-xl border border-gray-100 px-4 py-3">
        <p className="font-semibold text-gray-800 text-sm mb-1">{label}</p>
        {payload.map((p: any, i: number) => (
          <p key={i} className="text-xs" style={{ color: p.color }}>
            {p.name}: {typeof p.value === 'number' && p.value > 1000 ? formatUSD(p.value) : p.value}
          </p>
        ))}
      </div>
    );
  };

  const periodLabel = monthStart === monthEnd
    ? `${MONTHS_SHORT[monthStart - 1]} ${year}`
    : `${MONTHS_SHORT[monthStart - 1]} — ${MONTHS_SHORT[monthEnd - 1]} ${year}`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Avance Comercial</h1>
          <p className="text-gray-500 text-sm mt-1">Análisis por RC — {periodLabel}</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center"><TrendingUp className="w-5 h-5 text-brand-600" /></div>
            <span className="text-xs text-gray-500 uppercase">Venta Total</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{formatUSD(totalVenta)}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center"><Droplets className="w-5 h-5 text-blue-600" /></div>
            <span className="text-xs text-gray-500 uppercase">KG/LT Vendidos</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{formatKG(totalKG)}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center"><Users className="w-5 h-5 text-purple-600" /></div>
            <span className="text-xs text-gray-500 uppercase">RCs Activos</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{vendedores.length}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center"><Users className="w-5 h-5 text-amber-600" /></div>
            <span className="text-xs text-gray-500 uppercase">Clientes Atendidos</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{totalClientes}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
        <button onClick={() => setShowFilters(!showFilters)} className="w-full flex items-center justify-between px-5 py-3 text-sm font-medium text-gray-700">
          <span className="flex items-center gap-2"><Filter className="w-4 h-4" /> Filtros</span>
          {showFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        {showFilters && (
          <div className="px-5 pb-4 border-t border-gray-100 pt-3">
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              <div>
                <label className="text-xs text-gray-500 uppercase mb-1 block">Mes Inicio</label>
                <select value={monthStart} onChange={e => setMonthStart(Number(e.target.value))} className="w-full border rounded-lg px-3 py-2 text-sm">
                  {MONTHS_SHORT.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 uppercase mb-1 block">Mes Fin</label>
                <select value={monthEnd} onChange={e => setMonthEnd(Number(e.target.value))} className="w-full border rounded-lg px-3 py-2 text-sm">
                  {MONTHS_SHORT.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 uppercase mb-1 block">División</label>
                <select value={division} onChange={e => setDivision(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
                  <option value="">Todas</option>
                  {opcionesFiltro?.divisiones?.map((d: string) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 uppercase mb-1 block">Tipo Maestro</label>
                <select value={maestroTipo} onChange={e => setMaestroTipo(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
                  <option value="">Todos</option>
                  {opcionesFiltro?.maestro_tipos?.map((m: string) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div className="flex items-end">
                <button onClick={applyFilters} className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 text-sm font-medium">
                  <Search className="w-4 h-4" /> Aplicar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-brand-600" /></div>
      ) : (
        <>
          {/* Top 10 RC */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-1">Top 10 RC por Venta</h3>
            <p className="text-xs text-gray-400 mb-4">{periodLabel}</p>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topRC} layout="vertical" margin={{ left: 120 }}>
                  <defs>
                    <linearGradient id="gradRC" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#00A651" />
                      <stop offset="100%" stopColor="#34D67B" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="vendedor" tick={{ fontSize: 11 }} width={115} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="total_venta_usd" name="Venta USD" fill="url(#gradRC)" radius={[0, 8, 8, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* RC by Zone + KG/LT by RC */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-1">Venta por Zona</h3>
              <p className="text-xs text-gray-400 mb-4">Distribución geográfica de ventas</p>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={rcByZona} dataKey="total_usd" nameKey="zona" cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={3}>
                      {rcByZona.map((z, i) => <Cell key={i} fill={ZONE_COLORS[z.zona] || COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => formatUSD(v)} />
                    <Legend layout="vertical" align="right" verticalAlign="middle" wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-1">KG/LT por RC</h3>
              <p className="text-xs text-gray-400 mb-4">Volumen vendido por representante</p>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={rcByKG} layout="vertical" margin={{ left: 100 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={95} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="kg_lt" name="KG/LT" fill="#0EA5E9" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* RC by Family + Sub-family */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-1">Venta por Familia</h3>
              <p className="text-xs text-gray-400 mb-4">Distribución por línea de producto</p>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={familias.slice(0, 8)} dataKey="total_venta_usd" nameKey="familia" cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={3}
                      label={({ familia, porcentaje }) => `${(familia || '').substring(0, 10)}${familia?.length > 10 ? '..' : ''} ${porcentaje}%`}
                    >
                      {familias.slice(0, 8).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => formatUSD(v)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Top 15 Clientes</h3>
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {clientes.slice(0, 15).map((c: any, i: number) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${i < 3 ? 'bg-brand-600' : i < 7 ? 'bg-brand-400' : 'bg-gray-400'}`}>
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-800 truncate">{c.razon_social_cliente}</p>
                      <div className="w-full bg-gray-100 rounded-full h-1.5 mt-1">
                        <div className="bg-brand-500 h-1.5 rounded-full" style={{ width: `${c.porcentaje_acumulado > 100 ? 100 : c.porcentaje_acumulado}%` }} />
                      </div>
                    </div>
                    <span className="text-xs font-mono text-gray-600 whitespace-nowrap">{formatUSD(c.total_venta_usd)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
