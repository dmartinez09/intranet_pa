import { useEffect, useMemo, useState } from 'react';
import Header from '../components/layout/Header';
import { inteligenciaApi } from '../services/api';
import {
  RefreshCw, Database, Sprout, MapPin, Tag, FileText, ExternalLink,
  AlertCircle, CheckCircle2, Clock, Filter, X, ChevronDown,
  Search, TrendingUp, Layers, Globe,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Meta {
  sources: number;
  crops: number;
  regions: number;
  categories: number;
  snapshots: number;
  last_run: string | null;
  last_run_status: string | null;
  tables_exist: boolean;
}

interface Source {
  source_id: number;
  source_code: string;
  source_name: string;
  source_url: string;
  source_owner: string | null;
  source_type: string;
  extraction_method: string;
  active_flag: boolean;
  last_run_at: string | null;
  last_run_status: string | null;
  last_run_records: number | null;
}

interface Crop { crop_id: number; crop_code: string; crop_name_standard: string; crop_group: string | null; }
interface Region { region_id: number; region_code: string; department: string; }
interface Category { category_id: number; category_code: string; category_name: string; category_group: string | null; }

interface Snapshot {
  snapshot_id: number;
  source_name: string;
  source_owner: string | null;
  crop_name: string | null;
  crop_group: string | null;
  department: string | null;
  category_name: string | null;
  document_title: string | null;
  document_url: string | null;
  document_type: string | null;
  period_label: string | null;
  publication_date: string | null;
  capture_date: string;
  hectares: number | null;
  opportunity_score: number | null;
  opportunity_level: string | null;
  business_note: string | null;
}

interface TopCrop {
  crop_name: string; crop_group: string | null;
  total_hectares: number; snapshots: number; opportunity_avg: number | null;
}

interface EtlRun {
  run_id: number;
  pipeline_name: string;
  source_name: string | null;
  started_at: string;
  finished_at: string | null;
  status: string;
  records_inserted: number;
  error_message: string | null;
  triggered_by: string | null;
}

const CROP_COLORS = ['#00A651', '#008C44', '#007038', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#EC4899', '#10B981'];

// ---------------------------------------------------------------------------

export default function InteligenciaComercial() {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [crops, setCrops] = useState<Crop[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [topCrops, setTopCrops] = useState<TopCrop[]>([]);
  const [etlRuns, setEtlRuns] = useState<EtlRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(true);
  const [search, setSearch] = useState('');

  // Filtros
  const [cropId, setCropId] = useState<number | ''>('');
  const [regionId, setRegionId] = useState<number | ''>('');
  const [categoryId, setCategoryId] = useState<number | ''>('');
  const [sourceId, setSourceId] = useState<number | ''>('');

  useEffect(() => { void loadAll(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadAll() {
    setLoading(true);
    try {
      const [m, s, c, r, cat, top, log] = await Promise.all([
        inteligenciaApi.getMeta(),
        inteligenciaApi.getSources(),
        inteligenciaApi.getCrops(),
        inteligenciaApi.getRegions(),
        inteligenciaApi.getCategories(),
        inteligenciaApi.getTopCrops(10),
        inteligenciaApi.getEtlRuns(10),
      ]);
      setMeta(m.data.data);
      setSources(s.data.data || []);
      setCrops(c.data.data || []);
      setRegions(r.data.data || []);
      setCategories(cat.data.data || []);
      setTopCrops(top.data.data || []);
      setEtlRuns(log.data.data || []);
      await applyFilters({});
    } catch (err) {
      console.error('[IC] error cargando datos:', err);
    } finally {
      setLoading(false);
    }
  }

  async function applyFilters(params: any = null) {
    try {
      const p = params === null ? {
        crop_id: cropId || undefined,
        region_id: regionId || undefined,
        category_id: categoryId || undefined,
        source_id: sourceId || undefined,
        limit: 500,
      } : params;
      const res = await inteligenciaApi.getSnapshots(p);
      setSnapshots(res.data.data || []);
    } catch (err) {
      console.error('[IC] error snapshots:', err);
    }
  }

  function clearFilters() {
    setCropId(''); setRegionId(''); setCategoryId(''); setSourceId('');
    applyFilters({ limit: 500 });
  }

  const filteredSnapshots = useMemo(() => {
    if (!search.trim()) return snapshots;
    const q = search.toLowerCase();
    return snapshots.filter(s =>
      (s.document_title || '').toLowerCase().includes(q) ||
      (s.source_name || '').toLowerCase().includes(q) ||
      (s.crop_name || '').toLowerCase().includes(q) ||
      (s.department || '').toLowerCase().includes(q)
    );
  }, [snapshots, search]);

  const activeFilterCount = [cropId, regionId, categoryId, sourceId].filter(v => v !== '').length;

  const categoryDist = useMemo(() => {
    const map = new Map<string, number>();
    snapshots.forEach(s => {
      if (s.category_name) map.set(s.category_name, (map.get(s.category_name) || 0) + 1);
    });
    return Array.from(map.entries()).map(([name, count]) => ({ name, count }));
  }, [snapshots]);

  if (loading && !meta) {
    return (
      <div className="min-h-screen">
        <Header title="Inteligencia Comercial" subtitle="Datos agrícolas integrados desde fuentes peruanas" />
        <div className="flex items-center justify-center h-96">
          <div className="w-12 h-12 border-4 border-brand-200 border-t-brand-500 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  const hasData = meta?.snapshots && meta.snapshots > 0;
  const tablesReady = meta?.tables_exist;

  return (
    <div className="min-h-screen">
      <Header title="Inteligencia Comercial" subtitle="Datos agrícolas integrados desde fuentes peruanas" />

      <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4 sm:space-y-6">

        {/* Banner de estado ETL */}
        <div className={`flex flex-wrap items-center gap-3 px-4 py-3 rounded-xl border text-sm
          ${tablesReady
            ? 'bg-brand-50 border-brand-100 text-brand-700'
            : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
          <div className="flex items-center gap-2">
            {tablesReady
              ? <CheckCircle2 className="w-4 h-4" />
              : <AlertCircle className="w-4 h-4" />}
            <span className="font-semibold">
              {tablesReady ? 'Base de datos Azure SQL conectada' : 'Tablas pendientes de migración'}
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <Clock className="w-3.5 h-3.5" />
            <span className="font-medium">Última ejecución ETL:</span>
            <span className="font-semibold">
              {meta?.last_run
                ? new Date(meta.last_run).toLocaleString('es-PE')
                : '— (sin ejecuciones todavía)'}
            </span>
            {meta?.last_run_status && (
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold
                ${meta.last_run_status === 'SUCCESS' ? 'bg-green-100 text-green-700' :
                  meta.last_run_status === 'FAILED' ? 'bg-red-100 text-red-700' :
                  'bg-amber-100 text-amber-700'}`}>
                {meta.last_run_status}
              </span>
            )}
          </div>
          <button
            onClick={loadAll}
            className="ml-auto flex items-center gap-1.5 text-xs font-medium text-brand-700 hover:text-brand-800"
            title="Recargar datos"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Recargar
          </button>
        </div>

        {/* KPIs catálogo */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 sm:gap-4">
          <KpiCard icon={Database} label="Fuentes" value={meta?.sources ?? 0} gradient="from-brand-500 to-brand-700" />
          <KpiCard icon={Sprout} label="Cultivos" value={meta?.crops ?? 0} gradient="from-accent-400 to-accent-600" />
          <KpiCard icon={MapPin} label="Departamentos" value={meta?.regions ?? 0} gradient="from-purple-400 to-purple-600" />
          <KpiCard icon={Tag} label="Categorías PA" value={meta?.categories ?? 0} gradient="from-brand-400 to-brand-600" />
          <KpiCard icon={Layers} label="Registros" value={meta?.snapshots ?? 0} gradient="from-cyan-400 to-cyan-600" />
        </div>

        {/* Toggle filtros */}
        <div className="flex items-center justify-between">
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
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar en resultados..."
              className="input-field pl-10 w-64"
            />
          </div>
        </div>

        {/* Panel filtros */}
        {showFilters && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6 animate-fade-in">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <FilterSelect label="Cultivo" value={cropId} onChange={setCropId}
                options={crops.map(c => ({ value: c.crop_id, label: c.crop_name_standard }))} />
              <FilterSelect label="Departamento" value={regionId} onChange={setRegionId}
                options={regions.map(r => ({ value: r.region_id, label: r.department }))} />
              <FilterSelect label="Categoría PA" value={categoryId} onChange={setCategoryId}
                options={categories.map(c => ({ value: c.category_id, label: c.category_name }))} />
              <FilterSelect label="Fuente" value={sourceId} onChange={setSourceId}
                options={sources.map(s => ({ value: s.source_id, label: s.source_name }))} />
            </div>
            <div className="flex justify-end mt-4 pt-4 border-t border-gray-100">
              <button onClick={() => applyFilters(null)} className="btn-primary">Aplicar Filtros</button>
            </div>
          </div>
        )}

        {/* Empty state */}
        {!hasData && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
            <div className="flex flex-col items-center text-center gap-3 py-10">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center">
                <Sprout className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">Inteligencia Comercial Beta — Fase 1</h3>
              <p className="text-sm text-gray-500 max-w-xl">
                {tablesReady
                  ? 'Catálogo inicial cargado. Los snapshots agrícolas reales (SIEA, MIDAGRI, INEI, SENASA) se cargarán cuando el ETL programado se ejecute por primera vez.'
                  : 'Primero debe ejecutarse la migración SQL 002_inteligencia_comercial.sql en Azure SQL para crear las tablas icb_*. Contacta al administrador del sistema.'}
              </p>
            </div>
          </div>
        )}

        {/* Gráficos — solo si hay datos */}
        {hasData && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top cultivos */}
            <div className="chart-container">
              <h3 className="text-base font-bold text-gray-900 mb-1">Top Cultivos por Superficie</h3>
              <p className="text-xs text-gray-400 mb-4">Ranking por hectáreas totales</p>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={topCrops.slice(0, 10)} layout="vertical" margin={{ left: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="crop_name" tick={{ fontSize: 11 }} width={60} />
                  <Tooltip formatter={(value: any) => [`${Number(value).toLocaleString('es-PE')} ha`, 'Hectáreas']} />
                  <Bar dataKey="total_hectares" radius={[0, 6, 6, 0]}>
                    {topCrops.slice(0, 10).map((_, i) => (
                      <Cell key={i} fill={CROP_COLORS[i % CROP_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Distribución categorías PA */}
            <div className="chart-container">
              <h3 className="text-base font-bold text-gray-900 mb-1">Distribución por Categoría Point Andina</h3>
              <p className="text-xs text-gray-400 mb-4">Snapshots clasificados por categoría comercial</p>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={categoryDist}
                    dataKey="count"
                    nameKey="name"
                    cx="50%" cy="50%"
                    outerRadius={95} innerRadius={50}
                    paddingAngle={2} stroke="none"
                  >
                    {categoryDist.map((_, i) => (
                      <Cell key={i} fill={CROP_COLORS[i % CROP_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Tabla de Fuentes (trazabilidad) */}
        <div className="chart-container">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <Globe className="w-4 h-4 text-brand-600" />
                Fuentes Configuradas
              </h3>
              <p className="text-xs text-gray-400">Trazabilidad de origen: URL, método y última ejecución</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="table-modern">
              <thead>
                <tr>
                  <th>Fuente</th>
                  <th>Entidad</th>
                  <th>Tipo</th>
                  <th>Método</th>
                  <th>Última Ejecución</th>
                  <th>Estado</th>
                  <th>Registros</th>
                  <th>URL</th>
                </tr>
              </thead>
              <tbody>
                {sources.length === 0 && (
                  <tr><td colSpan={8} className="text-center text-gray-400 py-8">No hay fuentes configuradas</td></tr>
                )}
                {sources.map(s => (
                  <tr key={s.source_id}>
                    <td className="font-semibold">{s.source_name}</td>
                    <td className="text-gray-500">{s.source_owner || '—'}</td>
                    <td><span className="badge bg-gray-100 text-gray-700">{s.source_type}</span></td>
                    <td className="text-xs text-gray-500">{s.extraction_method}</td>
                    <td className="text-xs">
                      {s.last_run_at ? new Date(s.last_run_at).toLocaleString('es-PE') : <span className="text-gray-400">Sin ejecuciones</span>}
                    </td>
                    <td>
                      {s.last_run_status ? (
                        <span className={`badge ${
                          s.last_run_status === 'SUCCESS' ? 'badge-success' :
                          s.last_run_status === 'FAILED' ? 'badge-danger' :
                          'badge-warning'
                        }`}>{s.last_run_status}</span>
                      ) : <span className="text-gray-400 text-xs">—</span>}
                    </td>
                    <td className="text-right text-sm">{s.last_run_records ?? '—'}</td>
                    <td>
                      <a href={s.source_url} target="_blank" rel="noopener noreferrer"
                         className="text-brand-600 hover:text-brand-800 inline-flex items-center gap-1 text-xs">
                        Abrir <ExternalLink className="w-3 h-3" />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Tabla de Snapshots (datos crudos con trazabilidad) */}
        {hasData && (
          <div className="chart-container">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-brand-600" />
                  Snapshots Agrícolas
                </h3>
                <p className="text-xs text-gray-400">{filteredSnapshots.length} de {snapshots.length} registros | Fuente · Fecha captura · Fecha publicación</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="table-modern">
                <thead>
                  <tr>
                    <th>Fuente</th>
                    <th>Documento</th>
                    <th>Cultivo</th>
                    <th>Departamento</th>
                    <th>Categoría PA</th>
                    <th>Período</th>
                    <th className="text-right">Hectáreas</th>
                    <th>Oportunidad</th>
                    <th>F. Publicación</th>
                    <th>F. Captura</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSnapshots.slice(0, 100).map(s => (
                    <tr key={s.snapshot_id}>
                      <td className="text-xs">
                        <div className="font-semibold">{s.source_owner}</div>
                        <div className="text-gray-400">{s.source_name}</div>
                      </td>
                      <td className="max-w-xs truncate" title={s.document_title || ''}>{s.document_title || '—'}</td>
                      <td>{s.crop_name || '—'}</td>
                      <td>{s.department || '—'}</td>
                      <td className="text-xs">{s.category_name || '—'}</td>
                      <td className="text-xs text-gray-500">{s.period_label || '—'}</td>
                      <td className="text-right font-mono">{s.hectares ? Number(s.hectares).toLocaleString('es-PE') : '—'}</td>
                      <td>
                        {s.opportunity_level ? (
                          <span className={`badge ${
                            s.opportunity_level === 'Alta' ? 'badge-success' :
                            s.opportunity_level === 'Media' ? 'badge-warning' :
                            'badge-info'
                          }`}>{s.opportunity_level}</span>
                        ) : '—'}
                      </td>
                      <td className="text-xs text-gray-500">
                        {s.publication_date ? new Date(s.publication_date).toLocaleDateString('es-PE') : '—'}
                      </td>
                      <td className="text-xs text-gray-500">
                        {new Date(s.capture_date).toLocaleDateString('es-PE')}
                      </td>
                      <td>
                        {s.document_url && (
                          <a href={s.document_url} target="_blank" rel="noopener noreferrer"
                             className="text-brand-600 hover:text-brand-800 inline-flex items-center gap-1 text-xs">
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredSnapshots.length > 100 && (
                <div className="text-xs text-gray-400 mt-2 text-center">Mostrando 100 de {filteredSnapshots.length} resultados. Refina los filtros para ver menos.</div>
              )}
            </div>
          </div>
        )}

        {/* Log ETL */}
        <div className="chart-container">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-brand-600" />
                Ejecuciones ETL
              </h3>
              <p className="text-xs text-gray-400">Auditoría de procesos de extracción</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="table-modern">
              <thead>
                <tr>
                  <th>Pipeline</th>
                  <th>Fuente</th>
                  <th>Inicio</th>
                  <th>Fin</th>
                  <th>Estado</th>
                  <th className="text-right">Insertados</th>
                  <th>Disparado por</th>
                  <th>Error</th>
                </tr>
              </thead>
              <tbody>
                {etlRuns.length === 0 && (
                  <tr><td colSpan={8} className="text-center text-gray-400 py-8">Sin ejecuciones registradas</td></tr>
                )}
                {etlRuns.map(r => (
                  <tr key={r.run_id}>
                    <td className="font-semibold text-xs">{r.pipeline_name}</td>
                    <td className="text-xs text-gray-500">{r.source_name || '—'}</td>
                    <td className="text-xs">{new Date(r.started_at).toLocaleString('es-PE')}</td>
                    <td className="text-xs">{r.finished_at ? new Date(r.finished_at).toLocaleString('es-PE') : '—'}</td>
                    <td>
                      <span className={`badge ${
                        r.status === 'SUCCESS' ? 'badge-success' :
                        r.status === 'FAILED' ? 'badge-danger' :
                        r.status === 'RUNNING' ? 'badge-info' : 'badge-warning'
                      }`}>{r.status}</span>
                    </td>
                    <td className="text-right font-mono text-sm">{r.records_inserted}</td>
                    <td className="text-xs text-gray-500">{r.triggered_by || '—'}</td>
                    <td className="text-xs text-red-500 max-w-sm truncate" title={r.error_message || ''}>{r.error_message || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function KpiCard({ icon: Icon, label, value, gradient }:
  { icon: any; label: string; value: number; gradient: string }) {
  return (
    <div className="kpi-card">
      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center mb-3 shadow-sm`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <p className="text-xl sm:text-2xl font-extrabold text-gray-900">{value.toLocaleString('es-PE')}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
}

function FilterSelect({ label, value, onChange, options }:
  { label: string; value: number | ''; onChange: (v: number | '') => void;
    options: { value: number; label: string }[] }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 mb-1.5">{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value === '' ? '' : parseInt(e.target.value))}
        className="input-field text-sm"
      >
        <option value="">Todos</option>
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}
