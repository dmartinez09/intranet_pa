import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { ventaRCApi } from '../services/api';
import MultiSelect from '../components/filters/MultiSelect';
import DateRangeFilter from '../components/filters/DateRangeFilter';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import { Users, TrendingUp, Droplets, Filter, ChevronDown, Search, Loader2, X } from 'lucide-react';
import { getGrupoFromSlug } from '../lib/utils';

interface FiltrosRC {
  familias: string[];
  sub_familias: string[];
  ingredientes_activos: string[];
  vendedores: string[];
  zonas: string[];
  tipos_documento: string[];
  series_documentos: string[];
  maestro_tipos: string[];
  productos_formulados: string[];
  nombres_producto: string[];
}

const MONTHS_SHORT = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const COLORS = ['#00A651', '#34D67B', '#0EA5E9', '#6366F1', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316', '#06B6D4', '#A855F7'];
const ZONE_COLORS: Record<string, string> = {
  'LIMA': '#00A651', 'ICA': '#34D67B', 'LA LIBERTAD': '#0EA5E9', 'JUNIN': '#6366F1',
  'AREQUIPA': '#F59E0B', 'PIURA': '#EF4444', 'CAJAMARCA': '#8B5CF6', 'AMAZONAS': '#EC4899',
  'LAMBAYEQUE': '#14B8A6', 'HUANCAVELICA': '#F97316', 'TACNA': '#06B6D4',
};

function formatUSD(n: number) { return '$' + n.toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 }); }
function formatKG(n: number) { return n.toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' KG/LT'; }


export default function AvanceComercialRC() {
  const { grupo: grupoSlug } = useParams<{ grupo: string }>();
  const grupoInfo = getGrupoFromSlug(grupoSlug);
  const grupoCliente = grupoInfo.db;
  const [vendedores, setVendedores] = useState<any[]>([]);
  const [familias, setFamilias] = useState<any[]>([]);
  const [clientes, setClientes] = useState<any[]>([]);
  const [opcionesFiltro, setOpcionesFiltro] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [clientSearch, setClientSearch] = useState('');

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [monthStart, setMonthStart] = useState(1);
  const [monthEnd, setMonthEnd] = useState(now.getMonth() + 1);
  const [filtros, setFiltros] = useState<FiltrosRC>({
    familias: [], sub_familias: [], ingredientes_activos: [], vendedores: [],
    zonas: [], tipos_documento: [], series_documentos: [], maestro_tipos: [],
    productos_formulados: [], nombres_producto: [],
  });

  useEffect(() => {
    loadFiltros();
  }, []);

  useEffect(() => {
    loadData(grupoCliente);
  }, [grupoCliente]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadData(grupo: string) {
    setLoading(true);
    const params: any = { year, month_start: monthStart, month_end: monthEnd, grupo_cliente: grupo };
    if (filtros.familias.length) params.familia = filtros.familias.join(',');
    if (filtros.sub_familias.length) params.sub_familia = filtros.sub_familias.join(',');
    if (filtros.ingredientes_activos.length) params.ingrediente_activo = filtros.ingredientes_activos.join(',');
    if (filtros.vendedores.length) params.vendedor = filtros.vendedores.join(',');
    if (filtros.zonas.length) params.zona = filtros.zonas.join(',');
    if (filtros.tipos_documento.length) params.tipo_documento = filtros.tipos_documento.join(',');
    if (filtros.series_documentos.length) params.division = filtros.series_documentos.join(',');
    if (filtros.maestro_tipos.length) params.maestro_tipo = filtros.maestro_tipos.join(',');
    if (filtros.productos_formulados.length) params.producto_formulado = filtros.productos_formulados.join(',');
    if (filtros.nombres_producto.length) params.nombre_producto = filtros.nombres_producto.join(',');
    try {
      const [vendRes, famRes, cliRes] = await Promise.all([
        ventaRCApi.getPorVendedor(params),
        ventaRCApi.getPorFamilia(params),
        ventaRCApi.getPorCliente(params),
      ]);
      setVendedores(vendRes.data.data || []);
      setFamilias(famRes.data.data || []);
      setClientes(cliRes.data.data || []);
    } catch (err) {
      console.error('Error loading AvanceComercialRC:', err);
    } finally {
      setLoading(false);
    }
  }

  async function loadFiltros() {
    try {
      // Pasar grupo_cliente para que el dropdown de Vendedor se restrinja al grupo actual via maestro
      const res = await ventaRCApi.getFiltros({ grupo_cliente: grupoCliente });
      setOpcionesFiltro(res.data.data);
    } catch (err) {
      console.error(err);
    }
  }

  function applyFilters() { loadData(grupoCliente); }
  function clearFilters() {
    setFiltros({
      familias: [], sub_familias: [], ingredientes_activos: [], vendedores: [],
      zonas: [], tipos_documento: [], series_documentos: [], maestro_tipos: [],
      productos_formulados: [], nombres_producto: [],
    });
    setMonthStart(1); setMonthEnd(now.getMonth() + 1); setYear(now.getFullYear());
    setTimeout(() => loadData(grupoCliente), 0);
  }
  const activeFilterCount = Object.values(filtros).filter(v => v.length > 0).length;

  // KPIs
  const totalVenta = useMemo(() => vendedores.reduce((s: number, v: any) => s + (v.total_venta_usd || 0), 0), [vendedores]);
  const totalKG = useMemo(() => vendedores.reduce((s: number, v: any) => s + (v.total_kg_lt || 0), 0), [vendedores]);
  const rcActivos = vendedores.length;
  const totalClientes = useMemo(() => vendedores.reduce((s: number, v: any) => s + (v.cantidad_clientes || 0), 0), [vendedores]);

  // Charts data
  const top10RC = vendedores.slice(0, 10).map((v: any) => ({
    nombre: v.vendedor?.length > 14 ? v.vendedor.substring(0, 14) + '...' : v.vendedor,
    venta: Math.round(v.total_venta_usd),
  }));

  const ventasPorZona = useMemo(() => {
    const map: Record<string, number> = {};
    for (const v of vendedores) {
      const z = v.zona || 'SIN ZONA';
      map[z] = (map[z] || 0) + (v.total_venta_usd || 0);
    }
    return Object.entries(map).map(([zona, total]) => ({ zona, total: Math.round(total) })).sort((a, b) => b.total - a.total);
  }, [vendedores]);

  const top10KG = vendedores.slice(0, 10).map((v: any) => ({
    nombre: v.vendedor?.length > 14 ? v.vendedor.substring(0, 14) + '...' : v.vendedor,
    kg: Math.round(v.total_kg_lt || 0),
  }));

  const filteredClientes = useMemo(() =>
    clientes.filter(c => !clientSearch || c.razon_social_cliente?.toLowerCase().includes(clientSearch.toLowerCase())),
    [clientes, clientSearch]
  );

  const maxClienteVenta = clientes[0]?.total_venta_usd || 1;

  const grupoLabel = grupoInfo.label;
  const periodLabel = monthStart === monthEnd
    ? `${MONTHS_SHORT[monthStart - 1]} ${year}`
    : `${MONTHS_SHORT[monthStart - 1]} — ${MONTHS_SHORT[monthEnd - 1]} ${year}`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Avance Comercial RC</h1>
        <p className="text-gray-500 text-sm mt-1">Seguimiento de metas por grupo de clientes — {periodLabel}</p>
      </div>

      {/* Filter toggle bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={() => setShowFilters(!showFilters)} className="btn-secondary">
            <Filter className="w-4 h-4" />
            <span>Filtros</span>
            {activeFilterCount > 0 && (
              <span className="ml-1 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-brand-500 text-white text-xs font-semibold">
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
      </div>

      {/* Filter Panel — alineado con Venta Gerencia */}
      {showFilters && opcionesFiltro && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6 animate-fade-in">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 sm:gap-6">
            <div className="lg:col-span-1 lg:border-r border-gray-100 lg:pr-6 pb-4 lg:pb-0 border-b lg:border-b-0">
              <DateRangeFilter
                year={year} monthStart={monthStart} monthEnd={monthEnd}
                onYearChange={setYear} onMonthStartChange={setMonthStart} onMonthEndChange={setMonthEnd}
              />
            </div>
            <div className="lg:col-span-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
              <MultiSelect label="Familia"
                options={(opcionesFiltro.familias || []).map((f: string) => ({ value: f, label: f }))}
                selected={filtros.familias} onChange={(v) => setFiltros({ ...filtros, familias: v })} />
              <MultiSelect label="Sub-familia"
                options={(opcionesFiltro.sub_familias || []).map((f: string) => ({ value: f, label: f }))}
                selected={filtros.sub_familias} onChange={(v) => setFiltros({ ...filtros, sub_familias: v })} />
              <MultiSelect label="Ingrediente Activo"
                options={(opcionesFiltro.ingredientes_activos || []).map((f: string) => ({ value: f, label: f }))}
                selected={filtros.ingredientes_activos} onChange={(v) => setFiltros({ ...filtros, ingredientes_activos: v })} />
              <MultiSelect label="Vendedor"
                options={(opcionesFiltro.vendedores || []).map((v: any) => ({ value: v.nombre, label: v.nombre }))}
                selected={filtros.vendedores} onChange={(v) => setFiltros({ ...filtros, vendedores: v })} />
              <MultiSelect label="Zona"
                options={(opcionesFiltro.zonas || []).map((f: string) => ({ value: f, label: f }))}
                selected={filtros.zonas} onChange={(v) => setFiltros({ ...filtros, zonas: v })} />
              <MultiSelect label="Tipo Documento"
                options={(opcionesFiltro.tipos_documento || []).map((f: string) => ({ value: f, label: f }))}
                selected={filtros.tipos_documento} onChange={(v) => setFiltros({ ...filtros, tipos_documento: v })} />
              <MultiSelect label="División"
                options={(opcionesFiltro.divisiones || []).map((f: string) => ({ value: f, label: f }))}
                selected={filtros.series_documentos} onChange={(v) => setFiltros({ ...filtros, series_documentos: v })} />
              <MultiSelect label="Maestro Tipo"
                options={(opcionesFiltro.maestro_tipos || []).map((f: string) => ({ value: f, label: f }))}
                selected={filtros.maestro_tipos} onChange={(v) => setFiltros({ ...filtros, maestro_tipos: v })} />
              <MultiSelect label="Producto Formulado"
                options={(opcionesFiltro.productos_formulados || []).map((f: string) => ({ value: f, label: f }))}
                selected={filtros.productos_formulados} onChange={(v) => setFiltros({ ...filtros, productos_formulados: v })} />
              <MultiSelect label="Nombre Producto"
                options={(opcionesFiltro.nombres_producto || []).map((f: string) => ({ value: f, label: f }))}
                selected={filtros.nombres_producto} onChange={(v) => setFiltros({ ...filtros, nombres_producto: v })} />
            </div>
          </div>
          <div className="flex justify-end mt-4 pt-4 border-t border-gray-100">
            <button onClick={applyFilters} className="btn-primary">Aplicar Filtros</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { icon: TrendingUp, label: 'Venta Total', value: formatUSD(totalVenta), color: 'brand' },
              { icon: Droplets, label: 'KG/LT Vendidos', value: formatKG(totalKG), color: 'teal' },
              { icon: Users, label: 'RCs Activos', value: String(rcActivos), color: 'purple' },
              { icon: Users, label: 'Clientes Atendidos', value: String(totalClientes), color: 'amber' },
            ].map((kpi) => {
              const Icon = kpi.icon;
              const colorMap: Record<string, string> = { brand: 'bg-brand-50 text-brand-600', teal: 'bg-teal-50 text-teal-600', purple: 'bg-purple-50 text-purple-600', amber: 'bg-amber-50 text-amber-600' };
              return (
                <div key={kpi.label} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                  <div className={`w-10 h-10 rounded-xl ${colorMap[kpi.color]} flex items-center justify-center mb-3`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{kpi.value}</p>
                  <p className="text-xs text-gray-500 mt-1">{kpi.label}</p>
                  <p className="text-xs text-gray-400">{grupoLabel}</p>
                </div>
              );
            })}
          </div>

          {/* Charts Row 1 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h3 className="font-bold text-gray-900 mb-1">Top 10 RC por Venta</h3>
              <p className="text-xs text-gray-400 mb-4">{grupoLabel} — USD</p>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={top10RC} layout="vertical" margin={{ left: 10, right: 30 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                    <YAxis type="category" dataKey="nombre" tick={{ fontSize: 11 }} width={110} />
                    <Tooltip formatter={(v: any) => [formatUSD(v), 'Venta USD']} />
                    <Bar dataKey="venta" radius={[0, 8, 8, 0]}>
                      {top10RC.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h3 className="font-bold text-gray-900 mb-1">Venta por Zona</h3>
              <p className="text-xs text-gray-400 mb-4">{grupoLabel} — distribución geográfica</p>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={ventasPorZona} dataKey="total" nameKey="zona" cx="50%" cy="50%" outerRadius={100} innerRadius={50} paddingAngle={3} stroke="none">
                      {ventasPorZona.map((entry, i) => (
                        <Cell key={i} fill={ZONE_COLORS[entry.zona?.toUpperCase()] || COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: any) => formatUSD(v)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                {ventasPorZona.slice(0, 6).map((z, i) => (
                  <div key={z.zona} className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: ZONE_COLORS[z.zona?.toUpperCase()] || COLORS[i % COLORS.length] }} />
                    <span className="text-xs text-gray-600">{z.zona}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Charts Row 2 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h3 className="font-bold text-gray-900 mb-1">KG/LT por RC</h3>
              <p className="text-xs text-gray-400 mb-4">{grupoLabel} — volumen top 10</p>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={top10KG} layout="vertical" margin={{ left: 10, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <YAxis type="category" dataKey="nombre" tick={{ fontSize: 11 }} width={110} />
                    <Tooltip formatter={(v: any) => [formatKG(v), 'KG/LT']} />
                    <Bar dataKey="kg" fill="#0EA5E9" radius={[0, 8, 8, 0]}>
                      {top10KG.map((_, i) => <Cell key={i} fill={i % 2 === 0 ? '#0EA5E9' : '#38BDF8'} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h3 className="font-bold text-gray-900 mb-1">Venta por Familia</h3>
              <p className="text-xs text-gray-400 mb-4">{grupoLabel} — distribución</p>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={familias.slice(0, 8)} dataKey="total_venta_usd" nameKey="familia" cx="50%" cy="50%" outerRadius={100} innerRadius={50} paddingAngle={3} stroke="none">
                      {familias.slice(0, 8).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: any) => formatUSD(v)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                {familias.slice(0, 5).map((f, i) => (
                  <div key={f.familia} className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    <span className="text-xs text-gray-600 truncate max-w-[100px]">{f.familia}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Top 15 Clients */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="font-bold text-gray-900">Top 15 Clientes — {grupoLabel}</h3>
                <p className="text-xs text-gray-400 mt-0.5">Análisis de Pareto por venta USD</p>
              </div>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text" placeholder="Buscar cliente..."
                  value={clientSearch} onChange={e => setClientSearch(e.target.value)}
                  className="pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-300 w-56"
                />
              </div>
            </div>
            <div className="space-y-2">
              {filteredClientes.slice(0, 15).map((c, i) => {
                const pct = Math.round((c.total_venta_usd / maxClienteVenta) * 100);
                return (
                  <div key={c.ruc_cliente || i} className="flex items-center gap-3">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0
                      ${i < 3 ? 'bg-brand-100 text-brand-700' : 'bg-gray-100 text-gray-500'}`}>
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <p className="text-sm font-medium text-gray-800 truncate">{c.razon_social_cliente}</p>
                        <p className="text-sm font-bold text-brand-700 flex-shrink-0 ml-2">{formatUSD(c.total_venta_usd)}</p>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-1.5">
                        <div className="bg-brand-500 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
