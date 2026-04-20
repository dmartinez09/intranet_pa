import { useState, useEffect } from 'react';
import Header from '../components/layout/Header';
import MultiSelect from '../components/filters/MultiSelect';
import DateRangeFilter from '../components/filters/DateRangeFilter';
import { ventasApi } from '../services/api';
import { formatUSD, formatNumber, formatPercent } from '../lib/utils';
import {
  DollarSign,
  Droplets,
  UsersRound,
  FileText,
  TrendingUp,
  Target,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
  X,
  ChevronDown,
  Percent,
  Wallet,
  Receipt,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ComposedChart, Line, Area,
  PieChart, Pie, Cell,
  LineChart,
  Legend,
} from 'recharts';

// Colores corporativos - verde Point Andina
const CHART_COLORS = ['#00A651', '#008C44', '#007038', '#34D67B', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4'];
const PIE_COLORS = ['#003D1F', '#00572C', '#007038', '#008C44', '#00A651', '#34D67B', '#6EE7A8', '#F59E0B'];

interface KPIs {
  total_venta_usd: number;
  total_kilolitros: number;
  total_clientes: number;
  total_transacciones: number;
  ticket_promedio: number;
  meta_mensual_usd: number;
  porcentaje_avance: number;
  total_costo: number;
  total_ganancia: number;
  margen_promedio: number;
}

interface Filtros {
  familias: string[];
  sub_familias: string[];
  ingredientes_activos: string[];
  vendedores: string[];
  zonas: string[];
  tipos_documento: string[];
  series_documentos: string[];
  maestro_tipos: string[];
}


export default function DashboardVentas() {
  const [grupoCliente, setGrupoCliente] = useState('');

  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [ventasCliente, setVentasCliente] = useState<any[]>([]);
  const [ventasSubFamilia, setVentasSubFamilia] = useState<any[]>([]);
  const [ventasFamilia, setVentasFamilia] = useState<any[]>([]);
  const [ventasDiarias, setVentasDiarias] = useState<any[]>([]);
  const [ventasVendedor, setVentasVendedor] = useState<any[]>([]);
  const [detalleData, setDetalleData] = useState<{ rows: any[]; total_rows: number; returned: number } | null>(null);
  const [detalleLoading, setDetalleLoading] = useState(false);
  const [detalleSearch, setDetalleSearch] = useState('');
  const [onlyAnomalias, setOnlyAnomalias] = useState(false);
  const [detallePage, setDetallePage] = useState(1);
  const [lastParams, setLastParams] = useState<any>(null);
  const [opcionesFiltro, setOpcionesFiltro] = useState<any>(null);
  const [showFilters, setShowFilters] = useState(true);
  const [loading, setLoading] = useState(true);

  // Date filters — default to current month
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1-12
  const [year, setYear] = useState(currentYear);
  const [monthStart, setMonthStart] = useState(currentMonth);
  const [monthEnd, setMonthEnd] = useState(currentMonth);

  // Multi-select filters
  const [filtros, setFiltros] = useState<Filtros>({
    familias: [],
    sub_familias: [],
    ingredientes_activos: [],
    vendedores: [],
    zonas: [],
    tipos_documento: [],
    series_documentos: [],
    maestro_tipos: [],
  });

  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    loadFiltros();
    loadData({ year: currentYear, month_start: currentMonth, month_end: currentMonth });
    setInitialized(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (initialized) {
      // Only reload when grupo changes after initial load
      loadData({ year, month_start: monthStart, month_end: monthEnd });
    }
  }, [grupoCliente]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadData(params?: any) {
    setLoading(true);
    try {
      const p = { ...params };
      if (grupoCliente) p.grupo_cliente = grupoCliente;
      const [kpiRes, clienteRes, iaRes, familiaRes, diariaRes, vendedorRes] = await Promise.all([
        ventasApi.getKPIs(p),
        ventasApi.getPorCliente(p),
        ventasApi.getPorSubFamilia(p),
        ventasApi.getPorFamilia(p),
        ventasApi.getDiarias(p),
        ventasApi.getPorVendedor(p),
      ]);
      setKpis(kpiRes.data.data);
      setVentasCliente(clienteRes.data.data);
      setVentasSubFamilia(iaRes.data.data);
      setVentasFamilia(familiaRes.data.data);
      setVentasDiarias(diariaRes.data.data);
      setVentasVendedor(vendedorRes.data.data);
      setLastParams(p);
      // Lanza detalle en paralelo (no bloquea el render del dashboard)
      loadDetalle(p);
    } catch (err) {
      console.error('Error loading dashboard:', err);
    } finally {
      setLoading(false);
    }
  }

  async function loadDetalle(p: any) {
    setDetalleLoading(true);
    try {
      const res = await ventasApi.getDetalle({ ...p, limit: 5000 });
      setDetalleData(res.data.data);
      setDetallePage(1);
    } catch (err) {
      console.error('Error loading detalle:', err);
    } finally {
      setDetalleLoading(false);
    }
  }

  function exportDetalleExcel() {
    if (!detalleData?.rows?.length) return;
    const rows = filteredDetalle();
    const headers = [
      'Fecha','N SAP','Tipo Doc','División','Maestro','RUC','Cliente','Grupo',
      'Vendedor','Cód Vend','Zona','Dpto Despacho','Familia','SubFamilia','Ingr. Activo',
      'Cantidad','Venta USD','Costo','Ganancia','Gan %','Margen Unit','% Gan Unit','Alerta',
    ];
    const csv = [headers.join(';')]
      .concat(rows.map(r => [
        r.fecha_emision, r.numero_sap, r.tipo_documento, r.division, r.maestro_tipo,
        r.ruc_cliente, `"${(r.cliente||'').replace(/"/g,'""')}"`, r.grupo_cliente,
        `"${(r.vendedor||'').replace(/"/g,'""')}"`, r.codigo_vendedor, r.zona, r.departamento_despacho,
        r.familia, r.sub_familia, r.ingrediente_activo,
        r.cantidad, r.valor_venta_dolares, r.costo_total, r.ganancia,
        r.ganancia_pct, r.margen_unitario, r.porcentaje_ganancia_unitario,
        r.alerta_signo ? 'SIGNO_COSTO_INCONSISTENTE' : '',
      ].join(';'))).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ventas_detalle_${new Date().toISOString().substring(0,10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function filteredDetalle(): any[] {
    if (!detalleData?.rows) return [];
    let rows = detalleData.rows;
    if (onlyAnomalias) rows = rows.filter(r => r.alerta_signo);
    if (detalleSearch.trim()) {
      const q = detalleSearch.toLowerCase();
      rows = rows.filter(r =>
        (r.numero_sap || '').toLowerCase().includes(q) ||
        (r.cliente || '').toLowerCase().includes(q) ||
        (r.ruc_cliente || '').toLowerCase().includes(q) ||
        (r.vendedor || '').toLowerCase().includes(q) ||
        (r.familia || '').toLowerCase().includes(q) ||
        (r.ingrediente_activo || '').toLowerCase().includes(q)
      );
    }
    return rows;
  }

  async function loadFiltros() {
    try {
      const res = await ventasApi.getFiltros();
      setOpcionesFiltro(res.data.data);
    } catch (err) {
      console.error('Error loading filtros:', err);
    }
  }

  function applyFilters() {
    const params: any = {};
    // Solo enviar filtros que tengan selección
    if (filtros.familias.length) params.familia = filtros.familias.join(',');
    if (filtros.sub_familias.length) params.sub_familia = filtros.sub_familias.join(',');
    if (filtros.ingredientes_activos.length) params.ingrediente_activo = filtros.ingredientes_activos.join(',');
    if (filtros.vendedores.length) params.vendedor = filtros.vendedores.join(',');
    if (filtros.zonas.length) params.zona = filtros.zonas.join(',');
    if (filtros.tipos_documento.length) params.tipo_documento = filtros.tipos_documento.join(',');
    if (filtros.series_documentos.length) params.division = filtros.series_documentos.join(',');
    if (filtros.maestro_tipos.length) params.maestro_tipo = filtros.maestro_tipos.join(',');
    params.year = year;
    params.month_start = monthStart;
    params.month_end = monthEnd;
    loadData(params);
  }

  function clearFilters() {
    setFiltros({
      familias: [], sub_familias: [], ingredientes_activos: [],
      vendedores: [], zonas: [], tipos_documento: [],
      series_documentos: [], maestro_tipos: [],
    });
    setYear(currentYear);
    setMonthStart(currentMonth);
    setMonthEnd(currentMonth);
    loadData({ year: currentYear, month_start: currentMonth, month_end: currentMonth });
  }

  const activeFilterCount = Object.values(filtros).filter((v) => v.length > 0).length;

  // Pareto data (top 15)
  const paretoData = ventasCliente.slice(0, 15).map((c) => ({
    name: c.razon_social_cliente.length > 18 ? c.razon_social_cliente.substring(0, 18) + '...' : c.razon_social_cliente,
    venta: Math.round(c.total_venta_usd),
    acumulado: c.porcentaje_acumulado,
  }));

  const MONTHS_SHORT = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const periodLabel = monthStart === monthEnd
    ? `${MONTHS_SHORT[monthStart - 1]} ${year}`
    : `${MONTHS_SHORT[monthStart - 1]} — ${MONTHS_SHORT[monthEnd - 1]} ${year}`;

  if (loading && !kpis) {
    return (
      <div className="min-h-screen">
        <Header title="Dashboard de Ventas" subtitle={`${periodLabel} - Peru`} />
        <div className="flex items-center justify-center h-96">
          <div className="w-12 h-12 border-4 border-brand-200 border-t-brand-500 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header title="Dashboard de Ventas" subtitle={`${periodLabel} - Peru`} />

      <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4 sm:space-y-6">
        {/* Filter Toggle Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
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
          <div className="flex items-center gap-3">
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
            <p className="text-xs sm:text-sm text-gray-400">
              Fecha base: <span className="font-semibold text-gray-600">Fecha de Emisión</span> | País: Peru
            </p>
          </div>
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
                  selected={filtros.familias}
                  onChange={(v) => setFiltros({ ...filtros, familias: v })}
                />
                <MultiSelect
                  label="Sub-familia"
                  options={(opcionesFiltro.sub_familias || []).map((f: string) => ({ value: f, label: f }))}
                  selected={filtros.sub_familias}
                  onChange={(v) => setFiltros({ ...filtros, sub_familias: v })}
                />
                <MultiSelect
                  label="Ingrediente Activo"
                  options={(opcionesFiltro.ingredientes_activos || []).map((f: string) => ({ value: f, label: f }))}
                  selected={filtros.ingredientes_activos}
                  onChange={(v) => setFiltros({ ...filtros, ingredientes_activos: v })}
                />
                <MultiSelect
                  label="Vendedor"
                  options={(opcionesFiltro.vendedores || []).map((v: any) => ({ value: v.nombre, label: v.nombre }))}
                  selected={filtros.vendedores}
                  onChange={(v) => setFiltros({ ...filtros, vendedores: v })}
                />
                <MultiSelect
                  label="Zona"
                  options={(opcionesFiltro.zonas || []).map((f: string) => ({ value: f, label: f }))}
                  selected={filtros.zonas}
                  onChange={(v) => setFiltros({ ...filtros, zonas: v })}
                />
                <MultiSelect
                  label="Tipo Documento"
                  options={(opcionesFiltro.tipos_documento || []).map((f: string) => ({ value: f, label: f }))}
                  selected={filtros.tipos_documento}
                  onChange={(v) => setFiltros({ ...filtros, tipos_documento: v })}
                />
                <MultiSelect
                  label="División"
                  options={(opcionesFiltro.divisiones || []).map((f: string) => ({ value: f, label: f }))}
                  selected={filtros.series_documentos}
                  onChange={(v) => setFiltros({ ...filtros, series_documentos: v })}
                />
                <MultiSelect
                  label="Maestro Tipo"
                  options={(opcionesFiltro.maestro_tipos || []).map((f: string) => ({ value: f, label: f }))}
                  selected={filtros.maestro_tipos}
                  onChange={(v) => setFiltros({ ...filtros, maestro_tipos: v })}
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

        {/* KPI Cards */}
        {kpis && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <KpiCard icon={DollarSign} label="Venta Total USD" value={formatUSD(kpis.total_venta_usd)} trend={12.5} color="brand" />
            <KpiCard icon={Receipt} label="Costo Total" value={formatUSD(kpis.total_costo || 0)} color="red" />
            <KpiCard icon={Wallet} label="Ganancia" value={formatUSD(kpis.total_ganancia || 0)} color="teal" />
            <KpiCard icon={Percent} label="Margen %" value={formatPercent(kpis.margen_promedio || 0)} color="accent" />
            <KpiCard icon={UsersRound} label="Clientes Activos" value={String(kpis.total_clientes)} color="purple" />
            <KpiCard icon={FileText} label="Transacciones" value={formatNumber(kpis.total_transacciones)} color="cyan" />
          </div>
        )}

        {/* Charts Row 1: Pareto + Ventas Diarias */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="chart-container">
            <h3 className="text-base font-bold text-gray-900 mb-1">Diagrama de Pareto - Ventas por Cliente</h3>
            <p className="text-xs text-gray-400 mb-4">Top 15 clientes | Barra = venta USD, Línea = % acumulado</p>
            <ResponsiveContainer width="100%" height={340}>
              <ComposedChart data={paretoData} margin={{ top: 5, right: 30, left: 0, bottom: 80 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" tick={{ fontSize: 10 }} interval={0} />
                <YAxis yAxisId="left" tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
                <Tooltip formatter={(value: any, name: string) => [name === 'venta' ? formatUSD(value) : `${value}%`, name === 'venta' ? 'Venta USD' : '% Acumulado']} />
                <Bar yAxisId="left" dataKey="venta" fill="#00A651" radius={[4, 4, 0, 0]} opacity={0.85} />
                <Line yAxisId="right" type="monotone" dataKey="acumulado" stroke="#F59E0B" strokeWidth={2.5} dot={{ fill: '#F59E0B', r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <div className="chart-container">
            <h3 className="text-base font-bold text-gray-900 mb-1">Tendencia de Ventas Diarias</h3>
            <p className="text-xs text-gray-400 mb-4">{periodLabel} | Valor de venta en USD</p>
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={ventasDiarias} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <defs>
                  <linearGradient id="colorVenta" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00A651" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#00A651" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="fecha" tick={{ fontSize: 10 }} tickFormatter={(v) => v.split('-')[2]} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(value: any) => [formatUSD(value), 'Venta USD']} />
                <Area type="monotone" dataKey="total_venta_usd" fill="url(#colorVenta)" stroke="transparent" />
                <Line type="monotone" dataKey="total_venta_usd" stroke="#00A651" strokeWidth={2.5} dot={{ fill: '#00A651', r: 3 }} activeDot={{ r: 6, fill: '#F59E0B' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Charts Row 2: Familia + Ingrediente Activo */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="chart-container">
            <h3 className="text-base font-bold text-gray-900 mb-1">Ventas por Familia</h3>
            <p className="text-xs text-gray-400 mb-4">Distribución porcentual</p>
            <div className="flex flex-col sm:flex-row items-center">
              <ResponsiveContainer width="100%" height={280} className="sm:!w-[55%]">
                <PieChart>
                  <Pie
                    data={ventasFamilia}
                    dataKey="total_venta_usd"
                    nameKey="familia"
                    cx="50%" cy="50%"
                    outerRadius={100} innerRadius={55}
                    paddingAngle={2} stroke="none"
                  >
                    {ventasFamilia.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: any) => formatUSD(value as number)} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-2">
                {ventasFamilia.slice(0, 6).map((f, i) => (
                  <div key={f.familia} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                    <span className="text-xs text-gray-600 truncate flex-1">{f.familia}</span>
                    <span className="text-xs font-bold text-gray-800">{formatPercent(f.porcentaje)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="chart-container">
            <h3 className="text-base font-bold text-gray-900 mb-1">Ventas por Sub-Familia</h3>
            <p className="text-xs text-gray-400 mb-4">Distribución porcentual</p>
            <div className="flex flex-col sm:flex-row items-center">
              <ResponsiveContainer width="100%" height={280} className="sm:!w-[55%]">
                <PieChart>
                  <Pie
                    data={ventasSubFamilia.slice(0, 10)}
                    dataKey="total_venta_usd"
                    nameKey="sub_familia"
                    cx="50%" cy="50%"
                    outerRadius={100} innerRadius={55}
                    paddingAngle={2} stroke="none"
                  >
                    {ventasSubFamilia.slice(0, 10).map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: any) => formatUSD(value as number)} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-2">
                {ventasSubFamilia.slice(0, 10).map((f, i) => (
                  <div key={f.sub_familia} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                    <span className="text-xs text-gray-600 truncate flex-1">{f.sub_familia}</span>
                    <span className="text-xs font-bold text-gray-800">{formatPercent(f.porcentaje)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Table: Top Vendedores */}
        <div className="chart-container">
          <h3 className="text-base font-bold text-gray-900 mb-1">Ranking de Vendedores</h3>
          <p className="text-xs text-gray-400 mb-4">Desempeño del mes | Ordenado por venta total USD</p>
          <div className="overflow-x-auto">
            <table className="table-modern">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Vendedor</th>
                  <th>Zona</th>
                  <th className="text-right">KG/LT</th>
                  <th className="text-right">Venta USD</th>
                  <th className="text-right">Unidades</th>
                  <th className="text-right">Clientes</th>
                </tr>
              </thead>
              <tbody>
                {ventasVendedor.slice(0, 12).map((v, i) => (
                  <tr key={v.vendedor}>
                    <td>
                      <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold
                        ${i < 3 ? 'bg-brand-100 text-brand-700' : 'bg-gray-100 text-gray-500'}`}>
                        {i + 1}
                      </span>
                    </td>
                    <td className="font-semibold whitespace-normal break-words">{v.vendedor}</td>
                    <td className="text-gray-500">{v.zona}</td>
                    <td className="text-right">{formatNumber(v.total_kg_lt)}</td>
                    <td className="text-right font-bold text-brand-700">{formatUSD(v.total_venta_usd)}</td>
                    <td className="text-right">{formatNumber(v.total_unidades)}</td>
                    <td className="text-right">{v.cantidad_clientes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Detalle de transacciones para auditoría / revisión de errores de origen */}
        <div className="chart-container">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <div>
              <h3 className="text-base font-bold text-gray-900 mb-1">Detalle de Transacciones — Auditoría</h3>
              <p className="text-xs text-gray-400">
                {detalleData
                  ? `Mostrando ${filteredDetalle().length} de ${detalleData.total_rows.toLocaleString('es-PE')} registros (límite ${detalleData.returned.toLocaleString('es-PE')}) — incluye costo, ganancia y alertas de signo`
                  : 'Aplique filtros arriba para cargar el detalle por transacción'}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <input
                  type="text"
                  value={detalleSearch}
                  onChange={e => { setDetalleSearch(e.target.value); setDetallePage(1); }}
                  placeholder="Buscar N SAP, cliente, vendedor..."
                  className="input-field text-sm pl-3 w-64"
                />
              </div>
              <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none bg-amber-50 text-amber-700 px-2.5 py-1.5 rounded-lg border border-amber-200">
                <input
                  type="checkbox"
                  checked={onlyAnomalias}
                  onChange={e => { setOnlyAnomalias(e.target.checked); setDetallePage(1); }}
                  className="rounded text-amber-600"
                />
                <span className="font-semibold">Solo alertas de signo</span>
              </label>
              <button onClick={exportDetalleExcel}
                disabled={!detalleData?.rows?.length}
                className="btn-secondary text-xs">
                📥 Export CSV
              </button>
              <button onClick={() => lastParams && loadDetalle(lastParams)}
                disabled={detalleLoading}
                className="btn-secondary text-xs">
                🔄 Recargar
              </button>
            </div>
          </div>

          {detalleLoading && !detalleData && (
            <div className="flex justify-center py-8">
              <div className="w-8 h-8 border-4 border-brand-200 border-t-brand-500 rounded-full animate-spin" />
            </div>
          )}

          {detalleData && (() => {
            const all = filteredDetalle();
            const PAGE_SIZE = 100;
            const totalPages = Math.max(1, Math.ceil(all.length / PAGE_SIZE));
            const pageRows = all.slice((detallePage - 1) * PAGE_SIZE, detallePage * PAGE_SIZE);
            const totVenta = all.reduce((s, r) => s + (r.valor_venta_dolares || 0), 0);
            const totCosto = all.reduce((s, r) => s + (r.costo_total || 0), 0);
            const totGan = all.reduce((s, r) => s + (r.ganancia || 0), 0);
            const anomalias = all.filter(r => r.alerta_signo).length;

            return (
              <>
                {anomalias > 0 && !onlyAnomalias && (
                  <div className="mb-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                    ⚠️ <strong>{anomalias}</strong> transacciones con signo de costo inconsistente vs. venta (probables errores de origen SAP).
                    Activa el checkbox <strong>"Solo alertas de signo"</strong> para aislarlas.
                  </div>
                )}

                <div className="overflow-x-auto border border-gray-100 rounded-lg">
                  <table className="table-modern text-xs">
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>N SAP</th>
                        <th>Tipo Doc</th>
                        <th>División</th>
                        <th>Maestro</th>
                        <th>RUC</th>
                        <th>Cliente</th>
                        <th>Grupo</th>
                        <th>Vendedor</th>
                        <th>Zona</th>
                        <th>Dpto Despacho</th>
                        <th>Familia</th>
                        <th>Sub Familia</th>
                        <th>Ingr. Activo</th>
                        <th className="text-right">Cantidad</th>
                        <th className="text-right">Venta USD</th>
                        <th className="text-right">Costo</th>
                        <th className="text-right">Ganancia</th>
                        <th className="text-right">Gan %</th>
                        <th>Alerta</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pageRows.map((r, i) => (
                        <tr key={`${r.numero_sap}-${i}`}
                          className={r.alerta_signo ? 'bg-amber-50' : ''}>
                          <td className="whitespace-nowrap">
                            {r.fecha_emision ? new Date(r.fecha_emision).toLocaleDateString('es-PE') : '—'}
                          </td>
                          <td className="font-mono text-[11px]">{r.numero_sap || '—'}</td>
                          <td className="whitespace-nowrap">{r.tipo_documento || '—'}</td>
                          <td>{r.division || '—'}</td>
                          <td>{r.maestro_tipo || '—'}</td>
                          <td className="font-mono text-[11px]">{r.ruc_cliente || '—'}</td>
                          <td className="max-w-[180px] truncate" title={r.cliente || ''}>{r.cliente || '—'}</td>
                          <td>{r.grupo_cliente || '—'}</td>
                          <td className="max-w-[140px] truncate" title={r.vendedor || ''}>{r.vendedor || '—'}</td>
                          <td>{r.zona || '—'}</td>
                          <td>{r.departamento_despacho || '—'}</td>
                          <td className="max-w-[120px] truncate" title={r.familia || ''}>{r.familia || '—'}</td>
                          <td className="max-w-[120px] truncate" title={r.sub_familia || ''}>{r.sub_familia || '—'}</td>
                          <td className="max-w-[120px] truncate" title={r.ingrediente_activo || ''}>{r.ingrediente_activo || '—'}</td>
                          <td className="text-right font-mono">{Number(r.cantidad || 0).toLocaleString('es-PE')}</td>
                          <td className={`text-right font-mono ${r.valor_venta_dolares < 0 ? 'text-red-600' : ''}`}>
                            {formatUSD(r.valor_venta_dolares)}
                          </td>
                          <td className={`text-right font-mono ${r.alerta_signo ? 'text-amber-700 font-bold' : ''}`}>
                            {formatUSD(r.costo_total)}
                          </td>
                          <td className={`text-right font-mono ${r.ganancia < 0 ? 'text-red-600' : 'text-brand-700'}`}>
                            {formatUSD(r.ganancia)}
                          </td>
                          <td className="text-right font-mono">{Number(r.ganancia_pct || 0).toFixed(2)}%</td>
                          <td>
                            {r.alerta_signo && (
                              <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-300">
                                ⚠ signo
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-50 font-semibold">
                      <tr>
                        <td colSpan={14}>Totales ({all.length} registros filtrados)</td>
                        <td></td>
                        <td className="text-right font-mono">{formatUSD(totVenta)}</td>
                        <td className="text-right font-mono">{formatUSD(totCosto)}</td>
                        <td className={`text-right font-mono ${totGan < 0 ? 'text-red-600' : 'text-brand-700'}`}>
                          {formatUSD(totGan)}
                        </td>
                        <td className="text-right font-mono">
                          {totVenta !== 0 ? ((totGan / totVenta) * 100).toFixed(2) : '0.00'}%
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-3 text-xs text-gray-600">
                    <span>Página {detallePage} de {totalPages} · {PAGE_SIZE} por página</span>
                    <div className="flex gap-1">
                      <button onClick={() => setDetallePage(Math.max(1, detallePage - 1))}
                        disabled={detallePage === 1}
                        className="btn-secondary text-xs disabled:opacity-50">Anterior</button>
                      <button onClick={() => setDetallePage(Math.min(totalPages, detallePage + 1))}
                        disabled={detallePage === totalPages}
                        className="btn-secondary text-xs disabled:opacity-50">Siguiente</button>
                    </div>
                  </div>
                )}
              </>
            );
          })()}
        </div>

      </div>
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, subtext, trend, color }: {
  icon: any; label: string; value: string; subtext?: string; trend?: number; color: string;
}) {
  const colorMap: Record<string, string> = {
    brand: 'from-brand-500 to-brand-700',
    accent: 'from-accent-400 to-accent-600',
    teal: 'from-teal-400 to-teal-600',
    purple: 'from-purple-400 to-purple-600',
    cyan: 'from-cyan-400 to-cyan-600',
    amber: 'from-amber-400 to-amber-600',
  };

  return (
    <div className="kpi-card">
      <div className="flex items-center justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${colorMap[color]} flex items-center justify-center shadow-lg`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        {trend !== undefined && (
          <div className={`flex items-center gap-0.5 text-xs font-bold ${trend >= 0 ? 'text-brand-600' : 'text-danger-500'}`}>
            {trend >= 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
            {Math.abs(trend)}%
          </div>
        )}
      </div>
      <p className="text-lg sm:text-2xl font-extrabold text-gray-900 mb-0.5 truncate">{value}</p>
      <p className="text-[10px] sm:text-xs text-gray-500">{label}</p>
      {subtext && <p className="text-[10px] text-gray-400 mt-1">{subtext}</p>}
    </div>
  );
}
