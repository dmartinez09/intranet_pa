import { useState, useEffect, useMemo } from 'react';
import { ventasApi } from '../services/api';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ComposedChart, Line, PieChart, Pie, Cell, Legend, Treemap,
} from 'recharts';
import MultiSelect from '../components/filters/MultiSelect';
import DateRangeFilter from '../components/filters/DateRangeFilter';
import { Users, TrendingUp, Droplets, Filter, ChevronDown, ChevronUp, Search, Loader2, X } from 'lucide-react';

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
  const [grupoCliente, setGrupoCliente] = useState('');

  const [vendedores, setVendedores] = useState<any[]>([]);
  const [familias, setFamilias] = useState<any[]>([]);
  const [clientes, setClientes] = useState<any[]>([]);
  const [productosZona, setProductosZona] = useState<any[]>([]);
  const [subFamilias, setSubFamilias] = useState<any[]>([]);
  const [zonaFilter, setZonaFilter] = useState('');
  const [opcionesFiltro, setOpcionesFiltro] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const [year, setYear] = useState(currentYear);
  const [monthStart, setMonthStart] = useState(1);
  const [monthEnd, setMonthEnd] = useState(currentMonth);
  const [division, setDivision] = useState('');
  const [maestroTipo, setMaestroTipo] = useState('');

  // Multi-select filters
  const [selectedFamilias, setSelectedFamilias] = useState<string[]>([]);
  const [selectedSubFamilias, setSelectedSubFamilias] = useState<string[]>([]);
  const [selectedVendedores, setSelectedVendedores] = useState<string[]>([]);
  const [selectedZonas, setSelectedZonas] = useState<string[]>([]);
  const [selectedIA, setSelectedIA] = useState<string[]>([]);

  useEffect(() => {
    loadFiltros();
  }, []);

  useEffect(() => {
    loadData();
  }, [grupoCliente]); // eslint-disable-line react-hooks/exhaustive-deps

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
      if (grupoCliente) p.grupo_cliente = grupoCliente;

      const [vendRes, famRes, cliRes, prodZonaRes, subFamRes] = await Promise.all([
        ventasApi.getPorVendedor(p),
        ventasApi.getPorFamilia(p),
        ventasApi.getPorCliente(p),
        ventasApi.getPorProductoZona(p),
        ventasApi.getPorSubFamilia(p),
      ]);
      setVendedores(vendRes.data.data || []);
      setFamilias(famRes.data.data || []);
      setClientes(cliRes.data.data || []);
      setProductosZona(prodZonaRes.data.data || []);
      setSubFamilias(subFamRes.data.data || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  const activeFilterCount = [selectedFamilias, selectedSubFamilias, selectedVendedores, selectedZonas, selectedIA].filter(v => v.length > 0).length
    + (division ? 1 : 0) + (maestroTipo ? 1 : 0);

  function applyFilters() {
    const params: any = { year, month_start: monthStart, month_end: monthEnd };
    if (division) params.division = division;
    if (maestroTipo) params.maestro_tipo = maestroTipo;
    if (selectedFamilias.length) params.familia = selectedFamilias.join(',');
    if (selectedSubFamilias.length) params.sub_familia = selectedSubFamilias.join(',');
    if (selectedVendedores.length) params.vendedor = selectedVendedores.join(',');
    if (selectedZonas.length) params.zona = selectedZonas.join(',');
    if (selectedIA.length) params.ingrediente_activo = selectedIA.join(',');
    if (grupoCliente) params.grupo_cliente = grupoCliente;
    loadData(params);
  }

  function clearFilters() {
    setSelectedFamilias([]);
    setSelectedSubFamilias([]);
    setSelectedVendedores([]);
    setSelectedZonas([]);
    setSelectedIA([]);
    setDivision('');
    setMaestroTipo('');
    setYear(currentYear);
    setMonthStart(1);
    setMonthEnd(currentMonth);
    loadData({ year: currentYear, month_start: 1, month_end: currentMonth });
  }

  // Shorten vendor name: "CLAUDIA VANESSA REYES MANAYAY" → "C. REYES MANAYAY"
  function shortName(name: string): string {
    if (!name) return '';
    const parts = name.trim().split(/\s+/);
    if (parts.length <= 2) return name;
    // Take first initial + last 2 words (apellidos)
    return parts[0][0] + '. ' + parts.slice(-2).join(' ');
  }

  // Top 10 RC by venta
  const topRC = vendedores.slice(0, 10).map(v => ({
    ...v,
    label: shortName(v.vendedor),
  }));
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

  // KG/LT by RC (top 10)
  const rcByKG = vendedores.slice(0, 10).map(v => ({
    name: shortName(v.vendedor),
    fullName: v.vendedor,
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
        {payload.map((p: any, i: number) => {
          const isKG = p.dataKey === 'kg_lt' || p.name === 'KG/LT';
          const formatted = typeof p.value === 'number'
            ? isKG ? formatKG(p.value) : formatUSD(p.value)
            : p.value;
          return (
            <p key={i} className="text-xs" style={{ color: p.color }}>
              {p.name}: {formatted}
            </p>
          );
        })}
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
          <p className="text-gray-500 text-sm mt-1">Análisis por vendedor — {periodLabel}</p>
        </div>
        <select
          value={grupoCliente}
          onChange={(e) => setGrupoCliente(e.target.value)}
          className="input-field text-sm py-1.5 px-3 pr-8 min-w-[200px]"
        >
          <option value="">Todos los Grupos</option>
          {(opcionesFiltro?.grupos_cliente || []).map((g: string) => (
            <option key={g} value={g}>{g}</option>
          ))}
        </select>
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

      {/* Filter Toggle Bar */}
      <div className="flex items-center gap-3">
        <button onClick={() => setShowFilters(!showFilters)} className="btn-secondary">
          <Filter className="w-4 h-4" />
          Filtros
          {activeFilterCount > 0 && (
            <span className="ml-1 w-5 h-5 rounded-full bg-brand-500 text-white text-xs flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
        </button>
        {activeFilterCount > 0 && (
          <button onClick={clearFilters} className="text-sm text-gray-500 hover:text-danger-500 flex items-center gap-1">
            <X className="w-3.5 h-3.5" /> Limpiar filtros
          </button>
        )}
      </div>

      {/* Filter Panel */}
      {showFilters && opcionesFiltro && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6 animate-fade-in">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 sm:gap-6">
            {/* Date Range - takes 1 column */}
            <div className="lg:col-span-1 lg:border-r border-gray-100 lg:pr-6 pb-4 lg:pb-0 border-b lg:border-b-0">
              <DateRangeFilter
                year={year}
                monthStart={monthStart}
                monthEnd={monthEnd}
                onYearChange={setYear}
                onMonthStartChange={setMonthStart}
                onMonthEndChange={setMonthEnd}
              />
            </div>

            {/* Multi-selects - 4 columns */}
            <div className="lg:col-span-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
              <MultiSelect
                label="Familia"
                options={(opcionesFiltro.familias || []).map((f: string) => ({ value: f, label: f }))}
                selected={selectedFamilias}
                onChange={setSelectedFamilias}
              />
              <MultiSelect
                label="Sub-familia"
                options={(opcionesFiltro.sub_familias || []).map((f: string) => ({ value: f, label: f }))}
                selected={selectedSubFamilias}
                onChange={setSelectedSubFamilias}
              />
              <MultiSelect
                label="Ingrediente Activo"
                options={(opcionesFiltro.ingredientes_activos || []).map((f: string) => ({ value: f, label: f }))}
                selected={selectedIA}
                onChange={setSelectedIA}
              />
              <MultiSelect
                label="Vendedor"
                options={(opcionesFiltro.vendedores || []).map((v: any) => ({ value: v.nombre || v, label: v.nombre || v }))}
                selected={selectedVendedores}
                onChange={setSelectedVendedores}
              />
              <MultiSelect
                label="Zona"
                options={(opcionesFiltro.zonas || []).map((f: string) => ({ value: f, label: f }))}
                selected={selectedZonas}
                onChange={setSelectedZonas}
              />
              <MultiSelect
                label="División"
                options={(opcionesFiltro.divisiones || []).map((f: string) => ({ value: f, label: f }))}
                selected={division ? [division] : []}
                onChange={(v) => setDivision(v[0] || '')}
              />
              <MultiSelect
                label="Maestro Tipo"
                options={(opcionesFiltro.maestro_tipos || []).map((f: string) => ({ value: f, label: f }))}
                selected={maestroTipo ? [maestroTipo] : []}
                onChange={(v) => setMaestroTipo(v[0] || '')}
              />
            </div>
          </div>

          <div className="flex justify-end mt-4 pt-4 border-t border-gray-100">
            <button onClick={applyFilters} className="btn-primary">
              Aplicar Filtros
            </button>
          </div>
        </div>
      )}

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
                <BarChart data={topRC} layout="vertical" margin={{ left: 10 }} barSize={24}>
                  <defs>
                    <linearGradient id="gradRC" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#00A651" />
                      <stop offset="100%" stopColor="#34D67B" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="label" tick={{ fontSize: 11, fontWeight: 600 }} width={160} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="total_venta_usd" name="Venta USD" fill="url(#gradRC)" radius={[0, 8, 8, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* RC by Zone + KG/LT by RC */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-1">Top Productos por Zona</h3>
              <p className="text-xs text-gray-400 mb-4">Top 10 productos — venta USD</p>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={productosZona.slice(0, 10).map(p => ({ ...p, label: `${p.producto.substring(0, 16)} | ${p.zona.substring(0, 10)}` }))} layout="vertical" margin={{ left: 160 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                    <YAxis type="category" dataKey="label" tick={{ fontSize: 10 }} width={155} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="total_venta_usd" name="Venta USD" fill="#00A651" radius={[0, 6, 6, 0]}>
                      {productosZona.slice(0, 10).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-1">KG/LT por RC</h3>
              <p className="text-xs text-gray-400 mb-4">Volumen vendido por representante</p>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={rcByKG} layout="vertical" margin={{ left: 10 }} barSize={22}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fontWeight: 600 }} width={150} />
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
              <h3 className="text-lg font-semibold text-gray-800 mb-1">Ventas por Sub-Familia</h3>
              <p className="text-xs text-gray-400 mb-4">Distribución porcentual</p>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={subFamilias.slice(0, 10)} dataKey="total_venta_usd" nameKey="sub_familia" cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={3}
                      label={({ sub_familia, porcentaje }) => `${(sub_familia || '').substring(0, 18)}${sub_familia?.length > 18 ? '...' : ''} ${porcentaje}%`}
                    >
                      {subFamilias.slice(0, 10).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
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

          {/* Ranking Productos por Zona */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-800">Ranking de Productos por Zona</h3>
                <p className="text-xs text-gray-400">Top productos ordenados por venta — {periodLabel}</p>
              </div>
              <select value={zonaFilter} onChange={e => setZonaFilter(e.target.value)}
                className="input-field text-sm py-1.5 px-3 pr-8 min-w-[180px]">
                <option value="">Todas las Zonas</option>
                {[...new Set(productosZona.map(p => p.zona))].sort().map(z => (
                  <option key={z} value={z}>{z}</option>
                ))}
              </select>
            </div>
            <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
              <table className="table-modern w-full text-sm">
                <thead>
                  <tr>
                    <th className="w-[40px]">#</th>
                    <th>Producto</th>
                    <th>Zona</th>
                    <th>Familia</th>
                    <th className="text-right">Venta USD</th>
                    <th className="text-right">KG/LT</th>
                    <th className="text-right">Txns</th>
                  </tr>
                </thead>
                <tbody>
                  {productosZona
                    .filter(p => !zonaFilter || p.zona === zonaFilter)
                    .slice(0, 30)
                    .map((p, i) => (
                    <tr key={i}>
                      <td className="text-center">
                        <span className={`inline-flex w-6 h-6 items-center justify-center rounded-lg text-xs font-bold
                          ${i < 3 ? 'bg-brand-100 text-brand-700' : 'bg-gray-100 text-gray-500'}`}>{i + 1}</span>
                      </td>
                      <td className="font-medium text-gray-800 max-w-[200px] truncate" title={p.producto}>{p.producto}</td>
                      <td className="text-gray-500">{p.zona}</td>
                      <td className="text-xs text-gray-400">{p.familia}</td>
                      <td className="text-right font-bold text-gray-900">{formatUSD(p.total_venta_usd)}</td>
                      <td className="text-right text-gray-600">{p.total_kg_lt.toLocaleString('es-PE')}</td>
                      <td className="text-right text-gray-400">{p.transacciones}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
