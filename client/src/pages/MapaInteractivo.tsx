import { useEffect, useMemo, useState } from 'react';
import Header from '../components/layout/Header';
import { inteligenciaApi } from '../services/api';
import { ComposableMap, Geographies, Geography, ZoomableGroup } from 'react-simple-maps';
import {
  Map as MapIcon, AlertCircle, CheckCircle2, RefreshCw, Clock,
  Filter, ChevronDown, X, Sprout, Tag, TrendingUp, MapPin,
  Award, Layers,
} from 'lucide-react';
import peruGeo from '../data/peru-departments.json';

// ---------------------------------------------------------------------------

interface GeoSummary {
  region_code: string;
  department: string;
  latitude: number | null;
  longitude: number | null;
  total_hectares: number;
  total_snapshots: number;
  opportunity_avg: number | null;
  opportunity_level: string | null;
  crops: string[];
  crop_count: number;
  top_crop_name: string | null;
  top_crop_hectares: number | null;
  top_crop_group: string | null;
  top_senasa_class: string | null;
}

interface Crop { crop_id: number; crop_name_standard: string; }
interface Category { category_id: number; category_name: string; category_group: string | null; }

interface Meta {
  sources: number; snapshots: number;
  last_run: string | null; last_run_status: string | null;
  tables_exist: boolean;
}

// Paleta de colores para escala coroplética (hectáreas)
const COLOR_SCALE_HA = [
  { min: 0,      max: 1,       color: '#f1f5f9' }, // Sin dato
  { min: 1,      max: 1000,    color: '#dcfce7' },
  { min: 1000,   max: 5000,    color: '#bbf7d0' },
  { min: 5000,   max: 20000,   color: '#86efac' },
  { min: 20000,  max: 50000,   color: '#4ade80' },
  { min: 50000,  max: 100000,  color: '#22c55e' },
  { min: 100000, max: 300000,  color: '#16a34a' },
  { min: 300000, max: Infinity, color: '#15803d' },
];

function getColor(value: number): string {
  if (value <= 0) return '#f1f5f9';
  for (const s of COLOR_SCALE_HA) if (value >= s.min && value < s.max) return s.color;
  return COLOR_SCALE_HA[COLOR_SCALE_HA.length - 1].color;
}

// Normaliza nombres para matcheo con GeoJSON
function normalizeDeptName(name: string): string {
  return (name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z]/g, '');
}

// ---------------------------------------------------------------------------

export default function MapaInteractivo() {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [data, setData] = useState<GeoSummary[]>([]);
  const [crops, setCrops] = useState<Crop[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(true);
  const [hoveredDept, setHoveredDept] = useState<GeoSummary | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  // Filtros
  const [cropId, setCropId] = useState<number | ''>('');
  const [categoryId, setCategoryId] = useState<number | ''>('');

  useEffect(() => { void loadAll(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadAll() {
    setLoading(true);
    try {
      const [m, c, cat, g] = await Promise.all([
        inteligenciaApi.getMeta(),
        inteligenciaApi.getCrops(),
        inteligenciaApi.getCategories(),
        inteligenciaApi.getGeoSummary({}),
      ]);
      setMeta(m.data.data);
      setCrops(c.data.data || []);
      setCategories(cat.data.data || []);
      setData(g.data.data || []);
    } catch (err) {
      console.error('[MapaInteractivo] error:', err);
    } finally {
      setLoading(false);
    }
  }

  async function applyFilters() {
    setLoading(true);
    try {
      const res = await inteligenciaApi.getGeoSummary({
        crop_id: cropId || undefined,
        category_id: categoryId || undefined,
      });
      setData(res.data.data || []);
    } catch (err) {
      console.error('[MapaInteractivo] filter error:', err);
    } finally {
      setLoading(false);
    }
  }

  function clearFilters() {
    setCropId(''); setCategoryId('');
    setLoading(true);
    inteligenciaApi.getGeoSummary({})
      .then(r => setData(r.data.data || []))
      .catch(e => console.error(e))
      .finally(() => setLoading(false));
  }

  // Mapa por nombre normalizado para lookup en el choropleth
  const deptMap = useMemo(() => {
    const m = new Map<string, GeoSummary>();
    data.forEach(d => m.set(normalizeDeptName(d.department), d));
    return m;
  }, [data]);

  const totalHectares = useMemo(() =>
    data.reduce((sum, d) => sum + (d.total_hectares || 0), 0), [data]);

  const totalSnapshots = useMemo(() =>
    data.reduce((sum, d) => sum + (d.total_snapshots || 0), 0), [data]);

  const topDepts = useMemo(() =>
    [...data]
      .filter(d => d.total_hectares > 0)
      .sort((a, b) => b.total_hectares - a.total_hectares)
      .slice(0, 10),
    [data]);

  const activeFilterCount = [cropId, categoryId].filter(v => v !== '').length;
  const hasData = meta?.snapshots && meta.snapshots > 0;
  const tablesReady = meta?.tables_exist;

  if (loading && !meta) {
    return (
      <div className="min-h-screen">
        <Header title="Mapa Interactivo" subtitle="Visualización geográfica por departamento del Perú" />
        <div className="flex items-center justify-center h-96">
          <div className="w-12 h-12 border-4 border-brand-200 border-t-brand-500 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header title="Mapa Interactivo" subtitle="Visualización geográfica por departamento del Perú" />

      <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4 sm:space-y-6">

        {/* Banner trazabilidad */}
        <div className={`flex flex-wrap items-center gap-3 px-4 py-3 rounded-xl border text-sm
          ${tablesReady
            ? 'bg-brand-50 border-brand-100 text-brand-700'
            : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
          <div className="flex items-center gap-2">
            {tablesReady
              ? <CheckCircle2 className="w-4 h-4" />
              : <AlertCircle className="w-4 h-4" />}
            <span className="font-semibold">
              {tablesReady ? 'Datos geográficos sincronizados' : 'Tablas pendientes de migración'}
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <Clock className="w-3.5 h-3.5" />
            <span className="font-medium">Última actualización:</span>
            <span className="font-semibold">
              {meta?.last_run
                ? new Date(meta.last_run).toLocaleString('es-PE')
                : '— (sin ejecuciones todavía)'}
            </span>
          </div>
          <button
            onClick={loadAll}
            className="ml-auto flex items-center gap-1.5 text-xs font-medium text-brand-700 hover:text-brand-800"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Recargar
          </button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          <KpiMini icon={MapPin} label="Departamentos" value={data.length} />
          <KpiMini icon={Sprout} label="Hectáreas Totales" value={Math.round(totalHectares).toLocaleString('es-PE')} />
          <KpiMini icon={TrendingUp} label="Snapshots" value={totalSnapshots.toLocaleString('es-PE')} />
          <KpiMini
            icon={Tag}
            label="Departamentos con datos"
            value={`${data.filter(d => d.total_hectares > 0).length} / ${data.length}`}
          />
        </div>

        {/* Toggle filtros */}
        <div className="flex items-center gap-3">
          <button onClick={() => setShowFilters(!showFilters)} className="btn-secondary">
            <Filter className="w-4 h-4" /> Filtros
            {activeFilterCount > 0 && (
              <span className="ml-1 w-5 h-5 rounded-full bg-brand-500 text-white text-xs flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </button>
          {activeFilterCount > 0 && (
            <button onClick={clearFilters} className="text-sm text-gray-500 hover:text-danger-500 flex items-center gap-1">
              <X className="w-3.5 h-3.5" /> Limpiar
            </button>
          )}
        </div>

        {/* Panel filtros */}
        {showFilters && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6 animate-fade-in">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Cultivo</label>
                <select
                  value={cropId}
                  onChange={e => setCropId(e.target.value === '' ? '' : parseInt(e.target.value))}
                  className="input-field text-sm"
                >
                  <option value="">Todos los cultivos</option>
                  {crops.map(c => (
                    <option key={c.crop_id} value={c.crop_id}>{c.crop_name_standard}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Clasificación SENASA</label>
                <select
                  value={categoryId}
                  onChange={e => setCategoryId(e.target.value === '' ? '' : parseInt(e.target.value))}
                  className="input-field text-sm"
                >
                  <option value="">Todas las categorías</option>
                  {categories.map(c => (
                    <option key={c.category_id} value={c.category_id}>
                      {c.category_group ? `[${c.category_group}] ` : ''}{c.category_name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <button onClick={applyFilters} className="btn-primary w-full">Aplicar Filtros</button>
              </div>
            </div>
          </div>
        )}

        {/* Empty state */}
        {!hasData && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
            <div className="flex flex-col items-center text-center gap-3 py-10">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center">
                <MapIcon className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">Mapa en espera de datos</h3>
              <p className="text-sm text-gray-500 max-w-xl">
                {tablesReady
                  ? 'Las tablas icb_* están listas, pero aún no se han cargado snapshots. El mapa se poblará cuando el ETL integre datos de SIEA superficie agrícola y resultados ENA.'
                  : 'Primero debe ejecutarse la migración SQL 002_inteligencia_comercial.sql en Azure. El mapa se visualizará cuando haya datos geográficos.'}
              </p>
            </div>
          </div>
        )}

        {/* Mapa + Ranking */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Mapa */}
          <div className="lg:col-span-2 chart-container relative">
            <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
              <h3 className="text-base font-bold text-gray-900">
                Superficie Agrícola por Departamento — Perú
              </h3>
            </div>
            <p className="text-xs text-gray-400 mb-4">
              Escala coroplética por hectáreas · Pasa el cursor para ver perfil agrícola del departamento
            </p>

            <div className="relative" style={{ minHeight: 500 }}>
              <ComposableMap
                projection="geoMercator"
                projectionConfig={{ center: [-75, -9], scale: 1800 }}
                style={{ width: '100%', height: 500 }}
              >
                <ZoomableGroup>
                  <Geographies geography={peruGeo}>
                    {({ geographies }: { geographies: any[] }) =>
                      geographies.map((geo: any) => {
                        const deptName: string = geo.properties.NOMBDEP || geo.properties.name || '';
                        const key = normalizeDeptName(deptName);
                        const match = deptMap.get(key);
                        const value = match?.total_hectares || 0;
                        const color = getColor(value);
                        return (
                          <Geography
                            key={geo.rsmKey}
                            geography={geo}
                            fill={color}
                            stroke="#ffffff"
                            strokeWidth={0.6}
                            onMouseEnter={(evt) => {
                              setHoveredDept(match || {
                                region_code: '',
                                department: deptName,
                                latitude: null, longitude: null,
                                total_hectares: 0, total_snapshots: 0,
                                opportunity_avg: null, opportunity_level: null,
                                crops: [],
                                crop_count: 0,
                                top_crop_name: null, top_crop_hectares: null,
                                top_crop_group: null, top_senasa_class: null,
                              });
                              setTooltipPos({ x: evt.clientX, y: evt.clientY });
                            }}
                            onMouseMove={(evt) => setTooltipPos({ x: evt.clientX, y: evt.clientY })}
                            onMouseLeave={() => setHoveredDept(null)}
                            style={{
                              default: { outline: 'none', cursor: 'pointer' },
                              hover: { outline: 'none', fill: '#F59E0B', opacity: 0.9 },
                              pressed: { outline: 'none' },
                            }}
                          />
                        );
                      })
                    }
                  </Geographies>
                </ZoomableGroup>
              </ComposableMap>

              {/* Tooltip flotante — perfil agrícola del departamento (datos públicos peruanos) */}
              {hoveredDept && (
                <div
                  className="fixed z-50 pointer-events-none bg-white rounded-xl shadow-2xl border border-gray-200 p-3 text-xs min-w-[280px] max-w-[320px]"
                  style={{
                    left: Math.min(tooltipPos.x + 12, window.innerWidth - 340),
                    top: Math.min(tooltipPos.y + 12, window.innerHeight - 280),
                  }}
                >
                  <div className="font-bold text-gray-900 text-sm mb-2 flex items-center gap-1.5 pb-2 border-b border-gray-100">
                    <MapPin className="w-3.5 h-3.5 text-brand-600" />
                    {hoveredDept.department}
                    {hoveredDept.total_hectares > 0 && totalHectares > 0 && (
                      <span className="ml-auto text-[10px] font-semibold bg-brand-50 text-brand-700 px-1.5 py-0.5 rounded">
                        {((hoveredDept.total_hectares / totalHectares) * 100).toFixed(1)}% nacional
                      </span>
                    )}
                  </div>

                  {hoveredDept.total_hectares === 0 ? (
                    <div className="text-gray-400 text-center py-3 italic">Sin datos disponibles</div>
                  ) : (
                    <div className="space-y-2 text-gray-700">
                      {/* Resumen agrícola */}
                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-gray-50 rounded p-2">
                          <div className="text-[10px] text-gray-400 uppercase">Hectáreas totales</div>
                          <div className="font-bold text-gray-900">
                            {Math.round(hoveredDept.total_hectares).toLocaleString('es-PE')}
                          </div>
                        </div>
                        <div className="bg-gray-50 rounded p-2">
                          <div className="text-[10px] text-gray-400 uppercase">Cultivos</div>
                          <div className="font-bold text-gray-900">
                            {hoveredDept.crop_count} <span className="text-[10px] font-normal text-gray-500">distintos</span>
                          </div>
                        </div>
                      </div>

                      {/* Cultivo principal */}
                      {hoveredDept.top_crop_name && (
                        <div className="bg-amber-50 rounded p-2 border border-amber-100">
                          <div className="text-[10px] text-amber-700 uppercase font-semibold flex items-center gap-1">
                            <Award className="w-3 h-3" /> Cultivo Principal
                          </div>
                          <div className="font-bold text-gray-900">{hoveredDept.top_crop_name}</div>
                          <div className="text-[11px] text-gray-600">
                            {hoveredDept.top_crop_hectares
                              ? `${Math.round(hoveredDept.top_crop_hectares).toLocaleString('es-PE')} ha`
                              : ''}
                            {hoveredDept.top_crop_group && (
                              <span className="ml-1.5 inline-block px-1.5 py-0.5 bg-white rounded text-[9px] font-semibold text-amber-700 border border-amber-200">
                                {hoveredDept.top_crop_group}
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Clase SENASA dominante */}
                      {hoveredDept.top_senasa_class && (
                        <div className="flex items-center gap-2 bg-brand-50 rounded p-2 border border-brand-100">
                          <Tag className="w-3.5 h-3.5 text-brand-700 flex-shrink-0" />
                          <div className="flex-1">
                            <div className="text-[10px] text-brand-700 uppercase font-semibold">Clase SENASA dominante</div>
                            <div className="font-bold text-gray-900 text-[12px]">{hoveredDept.top_senasa_class}</div>
                          </div>
                        </div>
                      )}

                      {/* Lista cultivos */}
                      {hoveredDept.crops.length > 0 && (
                        <div className="pt-1.5 border-t border-gray-100">
                          <div className="text-[10px] text-gray-400 uppercase mb-1 flex items-center gap-1">
                            <Layers className="w-3 h-3" /> Cultivos en el dpto
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {hoveredDept.crops.slice(0, 8).map((c, i) => (
                              <span key={i} className="inline-block bg-gray-100 text-gray-700 text-[10px] px-1.5 py-0.5 rounded">
                                {c}
                              </span>
                            ))}
                            {hoveredDept.crops.length > 8 && (
                              <span className="text-[10px] text-gray-400 italic">+{hoveredDept.crops.length - 8} más</span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Footer trazabilidad */}
                      <div className="pt-1.5 border-t border-gray-100 text-[10px] text-gray-400 flex items-center justify-between">
                        <span>{hoveredDept.total_snapshots} snapshots</span>
                        <span>Fuente: MIDAGRI / SIEA / SENASA</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Leyenda */}
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-xs text-gray-400 mb-2">Escala por hectáreas agrícolas</p>
              <div className="flex items-center gap-1 flex-wrap">
                {COLOR_SCALE_HA.map((s, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-[10px] text-gray-600">
                    <div className="w-5 h-3 rounded" style={{ backgroundColor: s.color }} />
                    <span>
                      {s.min === 0 ? 'Sin dato' :
                       s.max === Infinity ? `>${s.min.toLocaleString('es-PE')}` :
                       `${s.min.toLocaleString('es-PE')}–${s.max.toLocaleString('es-PE')}`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Ranking */}
          <div className="chart-container">
            <h3 className="text-base font-bold text-gray-900 mb-1">Top 10 Departamentos</h3>
            <p className="text-xs text-gray-400 mb-4">Ranking por hectáreas</p>
            <div className="space-y-2">
              {topDepts.length === 0 && (
                <p className="text-center text-gray-400 text-sm py-8">Sin datos disponibles</p>
              )}
              {topDepts.map((d, i) => {
                const pct = topDepts[0]?.total_hectares
                  ? (d.total_hectares / topDepts[0].total_hectares) * 100
                  : 0;
                return (
                  <div key={d.region_code} className="p-2.5 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold
                          ${i < 3 ? 'bg-brand-100 text-brand-700' : 'bg-gray-200 text-gray-600'}`}>
                          {i + 1}
                        </span>
                        <span className="text-sm font-semibold text-gray-900">{d.department}</span>
                      </div>
                      <span className="text-xs font-mono text-gray-600">
                        {Math.round(d.total_hectares).toLocaleString('es-PE')} ha
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-white rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-brand-400 to-brand-600"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    {d.opportunity_level && (
                      <div className="mt-1.5 flex items-center justify-between text-[10px]">
                        <span className="text-gray-400">{d.total_snapshots} snapshots</span>
                        <span className={`px-1.5 py-0.5 rounded font-semibold
                          ${d.opportunity_level === 'Alta' ? 'bg-green-100 text-green-700' :
                           d.opportunity_level === 'Media' ? 'bg-amber-100 text-amber-700' :
                           'bg-blue-100 text-blue-700'}`}>
                          {d.opportunity_level}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function KpiMini({ icon: Icon, label, value }: { icon: any; label: string; value: string | number }) {
  return (
    <div className="kpi-card">
      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center mb-3 shadow-sm">
        <Icon className="w-5 h-5 text-white" />
      </div>
      <p className="text-xl sm:text-2xl font-extrabold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
}
