import { useState, useEffect, useMemo } from 'react';
import Header from '../components/layout/Header';
import DateRangeFilter from '../components/filters/DateRangeFilter';
import MultiSelect from '../components/filters/MultiSelect';
import { ventasApi } from '../services/api';
import { formatUSD, formatPercent } from '../lib/utils';
import { ComposableMap, Geographies, Geography, ZoomableGroup } from 'react-simple-maps';
import { Filter, ChevronDown, MapPin, Loader2 } from 'lucide-react';
import peruGeo from '../data/peru-departments.json';

interface DeptData {
  departamento: string;
  total_venta_usd: number;
  total_costo: number;
  total_ganancia: number;
  margen_pct: number;
  transacciones: number;
  vendedores: string[];
  grupos_cliente: string[];
}

const COLOR_SCALE = [
  { min: 0, max: 1, color: '#f1f5f9' },
  { min: 1, max: 10000, color: '#dcfce7' },
  { min: 10000, max: 50000, color: '#bbf7d0' },
  { min: 50000, max: 100000, color: '#86efac' },
  { min: 100000, max: 300000, color: '#4ade80' },
  { min: 300000, max: 500000, color: '#22c55e' },
  { min: 500000, max: 1000000, color: '#16a34a' },
  { min: 1000000, max: Infinity, color: '#15803d' },
];

function getColor(value: number): string {
  if (value <= 0) return '#f1f5f9'; // Sin venta = gris claro
  for (const s of COLOR_SCALE) {
    if (value >= s.min && value < s.max) return s.color;
  }
  return '#15803d';
}

export default function VentasMargenesZona() {
  const [data, setData] = useState<DeptData[]>([]);
  const [opcionesFiltro, setOpcionesFiltro] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(true);
  const [hoveredDept, setHoveredDept] = useState<DeptData | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [monthStart, setMonthStart] = useState(1);
  const [monthEnd, setMonthEnd] = useState(now.getMonth() + 1);

  const [selectedVendedores, setSelectedVendedores] = useState<string[]>([]);
  const [selectedGrupos, setSelectedGrupos] = useState<string[]>([]);
  const [selectedFamilias, setSelectedFamilias] = useState<string[]>([]);
  const [selectedSubFamilias, setSelectedSubFamilias] = useState<string[]>([]);
  const [selectedIA, setSelectedIA] = useState<string[]>([]);

  useEffect(() => {
    ventasApi.getFiltros().then(res => setOpcionesFiltro(res.data.data)).catch(() => {});
    loadData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadData(params?: any) {
    setLoading(true);
    try {
      const p = params || { year, month_start: monthStart, month_end: monthEnd };
      const res = await ventasApi.getPorDepartamento(p);
      setData(res.data.data || []);
    } catch (err) {
      console.error('Error loading map data:', err);
    } finally {
      setLoading(false);
    }
  }

  function applyFilters() {
    const params: any = { year, month_start: monthStart, month_end: monthEnd };
    if (selectedVendedores.length) params.vendedor = selectedVendedores.join(',');
    if (selectedGrupos.length) params.grupo_cliente = selectedGrupos.join(',');
    if (selectedFamilias.length) params.familia = selectedFamilias.join(',');
    if (selectedSubFamilias.length) params.sub_familia = selectedSubFamilias.join(',');
    if (selectedIA.length) params.ingrediente_activo = selectedIA.join(',');
    loadData(params);
  }

  const deptMap = useMemo(() => {
    const m: Record<string, DeptData> = {};
    for (const d of data) m[d.departamento.toUpperCase()] = d;
    return m;
  }, [data]);

  const totalVenta = useMemo(() => data.reduce((s, d) => s + d.total_venta_usd, 0), [data]);
  const totalGanancia = useMemo(() => data.reduce((s, d) => s + d.total_ganancia, 0), [data]);

  const MONTHS_SHORT = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const periodLabel = monthStart === monthEnd
    ? `${MONTHS_SHORT[monthStart - 1]} ${year}`
    : `${MONTHS_SHORT[monthStart - 1]} — ${MONTHS_SHORT[monthEnd - 1]} ${year}`;

  return (
    <div className="min-h-screen">
      <Header title="Ventas Margenes por Zona" subtitle={`${periodLabel} - Peru`} />

      <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4">

        {/* Filter Toggle */}
        <div className="flex items-center justify-between">
          <button onClick={() => setShowFilters(!showFilters)} className="btn-secondary">
            <Filter className="w-4 h-4" />
            Filtros
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </button>
          <p className="text-xs text-gray-400">
            Venta Total: <span className="font-bold text-gray-700">{formatUSD(totalVenta)}</span>
            {' | '}Ganancia: <span className="font-bold text-teal-700">{formatUSD(totalGanancia)}</span>
            {' | '}Margen: <span className="font-bold text-accent-700">{totalVenta > 0 ? formatPercent((totalGanancia / totalVenta) * 100) : '0%'}</span>
          </p>
        </div>

        {/* Filter Panel */}
        {showFilters && opcionesFiltro && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6 animate-fade-in relative z-30 overflow-visible">
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 overflow-visible">
              <div className="lg:col-span-1 lg:border-r border-gray-100 lg:pr-4">
                <DateRangeFilter
                  year={year} monthStart={monthStart} monthEnd={monthEnd}
                  onYearChange={setYear} onMonthStartChange={setMonthStart} onMonthEndChange={setMonthEnd}
                />
              </div>
              <div className="lg:col-span-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 overflow-visible">
                <MultiSelect label="Vendedor" options={(opcionesFiltro.vendedores || []).map((v: any) => ({ value: v.nombre, label: v.nombre }))} selected={selectedVendedores} onChange={setSelectedVendedores} />
                <MultiSelect label="Grupo de Cliente" options={(opcionesFiltro.grupos_cliente || []).map((g: string) => ({ value: g, label: g }))} selected={selectedGrupos} onChange={setSelectedGrupos} />
                <MultiSelect label="Familia" options={(opcionesFiltro.familias || []).map((f: string) => ({ value: f, label: f }))} selected={selectedFamilias} onChange={setSelectedFamilias} />
                <MultiSelect label="Sub-Familia" options={(opcionesFiltro.sub_familias || []).map((f: string) => ({ value: f, label: f }))} selected={selectedSubFamilias} onChange={setSelectedSubFamilias} />
                <MultiSelect label="Ingrediente Activo" options={(opcionesFiltro.ingredientes_activos || []).map((ia: string) => ({ value: ia, label: ia }))} selected={selectedIA} onChange={setSelectedIA} />
                <div className="flex items-end">
                  <button onClick={applyFilters} className="btn-primary w-full">Aplicar Filtros</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Map + Table */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Map */}
          <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 p-4 relative z-0">
            <h3 className="text-base font-bold text-gray-900 mb-2">
              <MapPin className="w-4 h-4 inline mr-1 text-brand-600" />
              Mapa de Ventas por Departamento
            </h3>
            {loading ? (
              <div className="flex items-center justify-center h-[500px]">
                <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
              </div>
            ) : (
              <div
                className="relative"
                onMouseMove={(e) => setTooltipPos({ x: e.clientX, y: e.clientY })}
              >
                <ComposableMap
                  projection="geoMercator"
                  projectionConfig={{ center: [-75.5, -9.5], scale: 2200 }}
                  width={600}
                  height={700}
                  style={{ width: '100%', height: 'auto' }}
                >
                  <Geographies geography={peruGeo}>
                    {({ geographies }) =>
                      geographies.map((geo) => {
                        const deptName = (geo.properties.NOMBDEP || '').toUpperCase();
                        const d = deptMap[deptName];
                        const value = d?.total_venta_usd || 0;
                        return (
                          <Geography
                            key={geo.rsmKey}
                            geography={geo}
                            fill={getColor(value)}
                            stroke="#94a3b8"
                            strokeWidth={0.5}
                            style={{
                              hover: { fill: '#f59e0b', stroke: '#000', strokeWidth: 1, outline: 'none' },
                              pressed: { outline: 'none' },
                              default: { outline: 'none' },
                            }}
                            onMouseEnter={() => setHoveredDept(d || { departamento: deptName, total_venta_usd: 0, total_costo: 0, total_ganancia: 0, margen_pct: 0, transacciones: 0, vendedores: [], grupos_cliente: [] })}
                            onMouseLeave={() => setHoveredDept(null)}
                          />
                        );
                      })
                    }
                  </Geographies>
                </ComposableMap>

                {/* Tooltip */}
                {hoveredDept && (
                  <div
                    className="fixed z-50 bg-gray-900 text-white px-4 py-3 rounded-xl shadow-xl text-sm pointer-events-none max-w-xs"
                    style={{ left: tooltipPos.x + 12, top: tooltipPos.y - 10 }}
                  >
                    <p className="font-bold text-accent-400 mb-1">{hoveredDept.departamento}</p>
                    <div className="space-y-0.5 text-xs">
                      <p>Venta: <span className="font-bold text-white">{formatUSD(hoveredDept.total_venta_usd)}</span></p>
                      <p>Ganancia: <span className="font-bold text-green-400">{formatUSD(hoveredDept.total_ganancia)}</span></p>
                      <p>Margen: <span className="font-bold text-accent-300">{formatPercent(hoveredDept.margen_pct)}</span></p>
                      <p>Transacciones: {hoveredDept.transacciones}</p>
                      {hoveredDept.vendedores.length > 0 && (
                        <p>Vendedores: <span className="text-blue-300">{hoveredDept.vendedores.slice(0, 3).join(', ')}{hoveredDept.vendedores.length > 3 ? ` +${hoveredDept.vendedores.length - 3}` : ''}</span></p>
                      )}
                      {hoveredDept.grupos_cliente.length > 0 && (
                        <p>Grupos: <span className="text-purple-300">{hoveredDept.grupos_cliente.join(', ')}</span></p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Color Legend */}
            <div className="flex items-center gap-1 mt-3 text-xs text-gray-500">
              <span>$0</span>
              {COLOR_SCALE.slice(1).map((s, i) => (
                <div key={i} className="w-8 h-3 rounded-sm" style={{ backgroundColor: s.color }} title={`${formatUSD(s.min)} - ${s.max === Infinity ? '+' : formatUSD(s.max)}`} />
              ))}
              <span>$1M+</span>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
            <h3 className="text-base font-bold text-gray-900 mb-3">Ranking por Departamento</h3>
            <div className="overflow-y-auto max-h-[600px] space-y-2">
              {data.filter(d => d.departamento !== 'SIN DEPARTAMENTO').map((d, i) => (
                <div key={d.departamento} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-50 border border-gray-50">
                  <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold
                    ${i < 3 ? 'bg-brand-100 text-brand-700' : 'bg-gray-100 text-gray-500'}`}>
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{d.departamento}</p>
                    <p className="text-xs text-gray-400">{d.transacciones} txns | {d.vendedores.length} vendedores</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-gray-900">{formatUSD(d.total_venta_usd)}</p>
                    <p className={`text-xs font-medium ${d.margen_pct >= 20 ? 'text-green-600' : d.margen_pct >= 10 ? 'text-amber-600' : 'text-red-500'}`}>
                      {formatPercent(d.margen_pct)} margen
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
