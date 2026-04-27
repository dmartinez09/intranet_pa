import { useEffect, useMemo, useState } from 'react';
import Header from '../components/layout/Header';
import { inteligenciaApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  RefreshCw, Database, Sprout, MapPin, Tag, FileText, ExternalLink,
  AlertCircle, CheckCircle2, Clock, Filter, X, ChevronDown,
  Search, TrendingUp, Layers, Globe, PlayCircle, Zap, Loader2, Shield,
  Download, Eye, Award, Target, DollarSign, Lightbulb, ArrowRight,
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

interface CollectorInfo {
  sourceCode: string;
  pipelineName: string;
  frequency: 'daily' | 'weekly' | 'on_demand';
  description: string;
}

// Fase 4 - Gap analysis
interface MarketGap {
  departamento: string;
  region_code: string | null;
  hectareas_potenciales: number;
  snapshots_count: number;
  ventas_usd: number;
  transacciones: number;
  ventas_por_hectarea: number;
  penetration_level: 'Alta' | 'Media' | 'Baja';
  opportunity_gap_usd: number;
}

interface ExecutiveSummary {
  hectareas_totales: number;
  ventas_12m_usd: number;
  ventas_por_hectarea: number;
  departamentos_con_datos: number;
  departamentos_alta_oportunidad: number;
  gap_total_usd: number;
}

interface Recommendation {
  departamento: string;
  cultivo: string | null;
  hectareas: number;
  ventas_actuales: number;
  gap_usd: number;
  familia_sugerida: string;
  note: string;
}

const CROP_COLORS = ['#00A651', '#008C44', '#007038', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#EC4899', '#10B981'];

// ---------------------------------------------------------------------------

export default function InteligenciaComercial() {
  const { isAdmin } = useAuth();
  // Estudio de mercado peruano: NO cruzar con SAP (Resumen Ejecutivo, Recomendaciones, Brecha)
  const SHOW_SAP_CROSS = false;
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

  // ETL Admin panel state
  const [collectors, setCollectors] = useState<CollectorInfo[]>([]);
  const [schedulerStatus, setSchedulerStatus] = useState<any>(null);
  const [runningCollector, setRunningCollector] = useState<string | null>(null);
  const [runningAll, setRunningAll] = useState(false);
  const [etlMsg, setEtlMsg] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Fase 3 - oportunidades + detalle
  const [topOpps, setTopOpps] = useState<Snapshot[]>([]);
  const [detailOpen, setDetailOpen] = useState<number | null>(null);
  const [detailData, setDetailData] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Fase 4 - Gap analysis
  const [marketGap, setMarketGap] = useState<MarketGap[]>([]);
  const [execSummary, setExecSummary] = useState<ExecutiveSummary | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);

  // Filtros
  const [cropId, setCropId] = useState<number | ''>('');
  const [regionId, setRegionId] = useState<number | ''>('');
  const [categoryId, setCategoryId] = useState<number | ''>('');
  const [sourceId, setSourceId] = useState<number | ''>('');

  useEffect(() => { void loadAll(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (isAdmin) void loadEtlPanel(); }, [isAdmin]);

  async function loadEtlPanel() {
    try {
      const res = await inteligenciaApi.listCollectors();
      setCollectors(res.data.data.collectors || []);
      setSchedulerStatus(res.data.data.scheduler || null);
    } catch (err) {
      console.error('[IC/ETL] error cargando panel:', err);
    }
  }

  async function runOne(code: string) {
    setRunningCollector(code);
    setEtlMsg(null);
    try {
      const res = await inteligenciaApi.runCollector(code);
      const r = res.data.data.result;
      setEtlMsg({
        type: r.status === 'SUCCESS' ? 'success' : r.status === 'PARTIAL' ? 'info' : 'error',
        text: `${code}: ${r.status} | Leídos ${r.recordsRead} | Insertados ${r.recordsInserted} | Actualizados ${r.recordsUpdated}${r.errorMessage ? ` | ${r.errorMessage}` : ''}`,
      });
      await loadAll();
    } catch (err: any) {
      setEtlMsg({ type: 'error', text: err?.response?.data?.message || err?.message || 'Error al ejecutar collector' });
    } finally {
      setRunningCollector(null);
    }
  }

  async function runAllEtl() {
    if (!confirm('¿Ejecutar TODOS los collectors? Esto puede tomar varios minutos.')) return;
    setRunningAll(true);
    setEtlMsg({ type: 'info', text: 'Ejecutando todos los collectors...' });
    try {
      const res = await inteligenciaApi.runAllCollectors();
      const s = res.data.data.summary;
      setEtlMsg({
        type: s.failed === 0 ? 'success' : s.success > 0 ? 'info' : 'error',
        text: `ETL completo: ${s.success}/${s.total} OK${s.failed > 0 ? `, ${s.failed} fallidos` : ''}${s.partial > 0 ? `, ${s.partial} parciales` : ''} | Insertados ${s.inserted}, Actualizados ${s.updated}`,
      });
      await loadAll();
    } catch (err: any) {
      setEtlMsg({ type: 'error', text: err?.response?.data?.message || 'Error al ejecutar ETL' });
    } finally {
      setRunningAll(false);
    }
  }

  async function loadAll() {
    setLoading(true);
    try {
      const [m, s, c, r, cat, top, log, opps, gap, exec, recs] = await Promise.all([
        inteligenciaApi.getMeta(),
        inteligenciaApi.getSources(),
        inteligenciaApi.getCrops(),
        inteligenciaApi.getRegions(),
        inteligenciaApi.getCategories(),
        inteligenciaApi.getTopCrops(10),
        inteligenciaApi.getEtlRuns(10),
        inteligenciaApi.getTopOpportunities(10, 70),
        inteligenciaApi.getMarketGap().catch(() => ({ data: { data: [] } })),
        inteligenciaApi.getExecutiveSummary().catch(() => ({ data: { data: null } })),
        inteligenciaApi.getRecommendations(10).catch(() => ({ data: { data: [] } })),
      ]);
      setMeta(m.data.data);
      setSources(s.data.data || []);
      setCrops(c.data.data || []);
      setRegions(r.data.data || []);
      setCategories(cat.data.data || []);
      setTopCrops(top.data.data || []);
      setEtlRuns(log.data.data || []);
      setTopOpps(opps.data.data || []);
      setMarketGap(gap.data.data || []);
      setExecSummary(exec.data.data || null);
      setRecommendations(recs.data.data || []);
      await applyFilters({});
    } catch (err) {
      console.error('[IC] error cargando datos:', err);
    } finally {
      setLoading(false);
    }
  }

  async function openDetail(id: number) {
    setDetailOpen(id);
    setDetailLoading(true);
    setDetailData(null);
    try {
      const res = await inteligenciaApi.getSnapshotDetail(id);
      setDetailData(res.data.data);
    } catch (err) {
      console.error('[IC] error detalle:', err);
    } finally {
      setDetailLoading(false);
    }
  }

  async function exportSnapshots() {
    setExporting(true);
    try {
      const token = localStorage.getItem('token');
      const url = inteligenciaApi.exportSnapshotsUrl({
        crop_id: cropId || undefined,
        region_id: regionId || undefined,
        category_id: categoryId || undefined,
        source_id: sourceId || undefined,
      });
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `inteligencia_snapshots_${new Date().toISOString().substring(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(downloadUrl);
    } catch (err: any) {
      alert(`Error al exportar: ${err?.message || err}`);
    } finally {
      setExporting(false);
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

  // Distribución por grupo de cultivo (Frutales, Granos, Hortalizas, etc.)
  const cropGroupDist = useMemo(() => {
    const map = new Map<string, number>();
    snapshots.forEach(s => {
      if (s.crop_group && s.hectares) {
        map.set(s.crop_group, (map.get(s.crop_group) || 0) + Number(s.hectares));
      }
    });
    return Array.from(map.entries())
      .map(([name, hectares]) => ({ name, hectares }))
      .sort((a, b) => b.hectares - a.hectares);
  }, [snapshots]);

  // Top 10 departamentos por superficie agrícola
  const topDepartments = useMemo(() => {
    const map = new Map<string, number>();
    snapshots.forEach(s => {
      if (s.department && s.hectares) {
        map.set(s.department, (map.get(s.department) || 0) + Number(s.hectares));
      }
    });
    return Array.from(map.entries())
      .map(([department, hectares]) => ({ department, hectares }))
      .sort((a, b) => b.hectares - a.hectares)
      .slice(0, 10);
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
          <KpiCard icon={Tag} label="Clases SENASA" value={meta?.categories ?? 0} gradient="from-brand-400 to-brand-600" />
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
              <FilterSelect label="Clasificación SENASA" value={categoryId} onChange={setCategoryId}
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

            {/* Clasificación SENASA — Plaguicidas de Uso Agrícola */}
            <div className="chart-container">
              <h3 className="text-base font-bold text-gray-900 mb-1">Clasificación SENASA — Plaguicidas de Uso Agrícola</h3>
              <p className="text-xs text-gray-400 mb-4">Distribución de snapshots por clase regulatoria del SENASA</p>
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

        {/* Estudio de mercado: 2 gráficos adicionales orientados a Peru */}
        {hasData && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Distribución por Grupo de Cultivo */}
            <div className="chart-container">
              <h3 className="text-base font-bold text-gray-900 mb-1">Superficie por Grupo de Cultivo</h3>
              <p className="text-xs text-gray-400 mb-4">Distribución de hectáreas según clasificación MIDAGRI · Total Perú</p>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={cropGroupDist} layout="vertical" margin={{ left: 80 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={80} />
                  <Tooltip formatter={(value: any) => [`${Number(value).toLocaleString('es-PE')} ha`, 'Hectáreas']} />
                  <Bar dataKey="hectares" radius={[0, 6, 6, 0]}>
                    {cropGroupDist.map((_, i) => (
                      <Cell key={i} fill={CROP_COLORS[i % CROP_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Top 10 Departamentos por Superficie Agrícola */}
            <div className="chart-container">
              <h3 className="text-base font-bold text-gray-900 mb-1">Top 10 Departamentos por Superficie Agrícola</h3>
              <p className="text-xs text-gray-400 mb-4">Hectáreas acumuladas por dpto · Estudio de mercado nacional</p>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={topDepartments} layout="vertical" margin={{ left: 80 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="department" tick={{ fontSize: 11 }} width={80} />
                  <Tooltip formatter={(value: any) => [`${Number(value).toLocaleString('es-PE')} ha`, 'Hectáreas']} />
                  <Bar dataKey="hectares" radius={[0, 6, 6, 0]}>
                    {topDepartments.map((_, i) => (
                      <Cell key={i} fill={CROP_COLORS[i % CROP_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
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

        {/* Top Oportunidades Destacadas */}
        {hasData && topOpps.length > 0 && (
          <div className="bg-gradient-to-br from-amber-50 via-white to-brand-50 rounded-2xl shadow-sm border border-amber-200 p-5">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center">
                  <Award className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">Top Oportunidades Destacadas</h3>
                  <p className="text-xs text-gray-500">Snapshots con score ≥ 70 (cultivo + región + categoría + hectáreas)</p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {topOpps.slice(0, 9).map(s => (
                <button
                  key={s.snapshot_id}
                  onClick={() => openDetail(s.snapshot_id)}
                  className="text-left bg-white rounded-xl p-3 border border-gray-100 hover:border-amber-300 hover:shadow-md transition-all"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className={`badge text-[10px] ${
                      s.opportunity_level === 'Alta' ? 'badge-success' : 'badge-warning'
                    }`}>{s.opportunity_level} · {Math.round(Number(s.opportunity_score))}</span>
                    <span className="text-[10px] text-gray-400 font-semibold uppercase">{s.source_owner}</span>
                  </div>
                  <div className="font-semibold text-sm text-gray-900 line-clamp-2 mb-1">{s.document_title || 'Sin título'}</div>
                  <div className="flex flex-wrap gap-1.5 text-xs text-gray-500">
                    {s.crop_name && <span className="inline-flex items-center gap-1"><Sprout className="w-3 h-3" />{s.crop_name}</span>}
                    {s.department && <span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3" />{s.department}</span>}
                    {s.category_name && <span className="inline-flex items-center gap-1"><Tag className="w-3 h-3" />{s.category_name}</span>}
                  </div>
                  {s.hectares && (
                    <div className="mt-2 text-sm font-bold text-brand-700">
                      {Number(s.hectares).toLocaleString('es-PE')} ha
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* FASE 4 - Resumen Ejecutivo de Brecha — DESACTIVADO: este módulo es solo estudio de mercado peruano, no cruza SAP */}
        {SHOW_SAP_CROSS && hasData && execSummary && execSummary.hectareas_totales > 0 && (
          <div className="chart-container bg-gradient-to-br from-brand-50 via-white to-amber-50 border-brand-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-600 to-brand-800 flex items-center justify-center">
                <Target className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">Análisis de Brechas Comerciales</h3>
                <p className="text-xs text-gray-500">Cruce de superficie agrícola potencial vs ventas SAP reales (últimos 12 meses)</p>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="bg-white rounded-xl p-3 border border-gray-100">
                <div className="flex items-center gap-1.5 mb-1">
                  <Sprout className="w-3.5 h-3.5 text-brand-600" />
                  <span className="text-[10px] text-gray-500 uppercase font-semibold">Hectáreas</span>
                </div>
                <p className="text-lg font-bold text-gray-900">
                  {execSummary.hectareas_totales.toLocaleString('es-PE')}
                </p>
              </div>
              <div className="bg-white rounded-xl p-3 border border-gray-100">
                <div className="flex items-center gap-1.5 mb-1">
                  <DollarSign className="w-3.5 h-3.5 text-green-600" />
                  <span className="text-[10px] text-gray-500 uppercase font-semibold">Ventas 12m</span>
                </div>
                <p className="text-lg font-bold text-gray-900">
                  ${execSummary.ventas_12m_usd.toLocaleString('es-PE', { maximumFractionDigits: 0 })}
                </p>
              </div>
              <div className="bg-white rounded-xl p-3 border border-gray-100">
                <div className="flex items-center gap-1.5 mb-1">
                  <TrendingUp className="w-3.5 h-3.5 text-purple-600" />
                  <span className="text-[10px] text-gray-500 uppercase font-semibold">USD/ha</span>
                </div>
                <p className="text-lg font-bold text-gray-900">
                  ${execSummary.ventas_por_hectarea.toLocaleString('es-PE', { maximumFractionDigits: 2 })}
                </p>
              </div>
              <div className="bg-white rounded-xl p-3 border border-gray-100">
                <div className="flex items-center gap-1.5 mb-1">
                  <MapPin className="w-3.5 h-3.5 text-cyan-600" />
                  <span className="text-[10px] text-gray-500 uppercase font-semibold">Dptos. con data</span>
                </div>
                <p className="text-lg font-bold text-gray-900">{execSummary.departamentos_con_datos}</p>
              </div>
              <div className="bg-white rounded-xl p-3 border border-gray-100">
                <div className="flex items-center gap-1.5 mb-1">
                  <Zap className="w-3.5 h-3.5 text-amber-600" />
                  <span className="text-[10px] text-gray-500 uppercase font-semibold">Alta oportunidad</span>
                </div>
                <p className="text-lg font-bold text-amber-700">{execSummary.departamentos_alta_oportunidad}</p>
              </div>
              <div className="bg-white rounded-xl p-3 border border-amber-200">
                <div className="flex items-center gap-1.5 mb-1">
                  <Award className="w-3.5 h-3.5 text-amber-600" />
                  <span className="text-[10px] text-gray-500 uppercase font-semibold">Gap total USD</span>
                </div>
                <p className="text-lg font-bold text-amber-700">
                  ${execSummary.gap_total_usd.toLocaleString('es-PE', { maximumFractionDigits: 0 })}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* FASE 4 - Recomendaciones Comerciales — DESACTIVADO: cruza con ventas SAP */}
        {SHOW_SAP_CROSS && hasData && recommendations.length > 0 && (
          <div className="chart-container">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center">
                <Lightbulb className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">Recomendaciones Comerciales</h3>
                <p className="text-xs text-gray-500">Top {recommendations.length} oportunidades de alto gap con producto sugerido</p>
              </div>
            </div>
            <div className="space-y-2">
              {recommendations.map((rec, i) => (
                <div key={i} className="flex items-start gap-3 p-3 bg-gradient-to-r from-amber-50 to-white rounded-xl border border-amber-100 hover:border-amber-300 transition-all">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-amber-100 text-amber-700 font-bold text-sm flex items-center justify-center">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5 mb-1">
                      <span className="font-semibold text-gray-900">{rec.cultivo}</span>
                      <ArrowRight className="w-3.5 h-3.5 text-gray-400" />
                      <span className="font-semibold text-gray-700">{rec.departamento}</span>
                      <span className="badge badge-warning text-[10px]">{rec.familia_sugerida}</span>
                    </div>
                    <p className="text-xs text-gray-600 leading-relaxed">{rec.note}</p>
                    <div className="flex gap-4 mt-1.5 text-[11px] text-gray-500">
                      <span>{rec.hectareas.toLocaleString('es-PE')} ha</span>
                      <span>Ventas: ${rec.ventas_actuales.toLocaleString('es-PE', { maximumFractionDigits: 0 })}</span>
                      <span className="font-bold text-amber-700">
                        Gap: ${rec.gap_usd.toLocaleString('es-PE', { maximumFractionDigits: 0 })}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* FASE 4 - Tabla de Brecha por Departamento — DESACTIVADO: cruza con ventas SAP */}
        {SHOW_SAP_CROSS && hasData && marketGap.length > 0 && (
          <div className="chart-container">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center">
                <MapPin className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">Brecha Comercial por Departamento</h3>
                <p className="text-xs text-gray-500">Hectáreas agrícolas × Ventas USD últimos 12 meses · Target referencia: 80 USD/ha</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="table-modern">
                <thead>
                  <tr>
                    <th>Departamento</th>
                    <th className="text-right">Hectáreas</th>
                    <th className="text-right">Snapshots</th>
                    <th className="text-right">Ventas USD</th>
                    <th className="text-right">Transacciones</th>
                    <th className="text-right">USD / ha</th>
                    <th>Penetración</th>
                    <th className="text-right">Gap Estimado</th>
                  </tr>
                </thead>
                <tbody>
                  {marketGap.map(g => (
                    <tr key={g.region_code || g.departamento}>
                      <td className="font-semibold">{g.departamento}</td>
                      <td className="text-right font-mono">{g.hectareas_potenciales.toLocaleString('es-PE')}</td>
                      <td className="text-right text-xs text-gray-500">{g.snapshots_count}</td>
                      <td className="text-right font-mono">${g.ventas_usd.toLocaleString('es-PE', { maximumFractionDigits: 0 })}</td>
                      <td className="text-right text-xs text-gray-500">{g.transacciones}</td>
                      <td className="text-right font-mono text-xs">${g.ventas_por_hectarea.toFixed(2)}</td>
                      <td>
                        <span className={`badge ${
                          g.penetration_level === 'Alta' ? 'badge-success' :
                          g.penetration_level === 'Media' ? 'badge-warning' :
                          'badge-danger'
                        }`}>
                          {g.penetration_level}
                        </span>
                      </td>
                      <td className="text-right font-mono font-bold text-amber-700">
                        ${g.opportunity_gap_usd.toLocaleString('es-PE', { maximumFractionDigits: 0 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

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
              <button
                onClick={exportSnapshots}
                disabled={exporting || snapshots.length === 0}
                className="btn-secondary"
                title="Exportar a Excel con los filtros aplicados"
              >
                {exporting ? <><Loader2 className="w-4 h-4 animate-spin" /> Exportando...</> : <><Download className="w-4 h-4" /> Export Excel</>}
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="table-modern">
                <thead>
                  <tr>
                    <th>Fuente</th>
                    <th>Documento</th>
                    <th>Cultivo</th>
                    <th>Departamento</th>
                    <th>Clasificación SENASA</th>
                    <th>Período</th>
                    <th className="text-right">Hectáreas</th>
                    <th>Oportunidad</th>
                    <th>F. Publicación</th>
                    <th>F. Captura</th>
                    <th>Detalle</th>
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
                        <button
                          onClick={() => openDetail(s.snapshot_id)}
                          className="p-1.5 rounded-lg hover:bg-brand-50 text-brand-600 transition-colors"
                          title="Ver detalle"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
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

        {/* Panel Admin ETL (solo admin) */}
        {isAdmin && (
          <div className="chart-container border-2 border-brand-100">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-brand-600" />
                <div>
                  <h3 className="text-base font-bold text-gray-900">Panel ETL — Admin</h3>
                  <p className="text-xs text-gray-400">
                    Ejecuta collectors manualmente · Scheduler: {' '}
                    <span className={`font-semibold ${schedulerStatus?.running ? 'text-green-600' : 'text-gray-500'}`}>
                      {schedulerStatus?.running ? 'Activo' : 'Detenido'}
                    </span>
                  </p>
                </div>
              </div>
              <button
                onClick={runAllEtl}
                disabled={runningAll || !!runningCollector}
                className="btn-primary"
              >
                {runningAll ? <><Loader2 className="w-4 h-4 animate-spin" /> Ejecutando...</> : <><Zap className="w-4 h-4" /> Ejecutar TODO</>}
              </button>
            </div>

            {etlMsg && (
              <div className={`mb-4 px-4 py-3 rounded-xl text-sm flex items-start gap-2 ${
                etlMsg.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' :
                etlMsg.type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' :
                'bg-blue-50 text-blue-700 border border-blue-200'
              }`}>
                {etlMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" /> :
                 etlMsg.type === 'error' ? <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" /> :
                 <Clock className="w-4 h-4 flex-shrink-0 mt-0.5" />}
                <span className="flex-1">{etlMsg.text}</span>
                <button onClick={() => setEtlMsg(null)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {collectors.length === 0 && (
                <div className="col-span-full text-center text-sm text-gray-400 py-6">
                  Cargando collectors... (si las tablas icb_* no existen, ejecuta primero la migración 002 en Azure SQL)
                </div>
              )}
              {collectors.map(c => (
                <div key={c.sourceCode} className="p-3 bg-gray-50 rounded-xl border border-gray-100 hover:border-brand-200 transition-colors">
                  <div className="flex items-start justify-between mb-2 gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold text-sm text-gray-900 truncate">{c.sourceCode}</div>
                      <div className="text-[10px] text-gray-400 uppercase tracking-wide">{c.frequency}</div>
                    </div>
                    <button
                      onClick={() => runOne(c.sourceCode)}
                      disabled={runningCollector === c.sourceCode || runningAll}
                      className="flex-shrink-0 flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-lg bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50"
                      title={`Ejecutar ${c.sourceCode}`}
                    >
                      {runningCollector === c.sourceCode
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <PlayCircle className="w-3.5 h-3.5" />}
                      Ejecutar
                    </button>
                  </div>
                  <p className="text-xs text-gray-600 leading-snug">{c.description}</p>
                </div>
              ))}
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

      {/* Modal detalle snapshot */}
      {detailOpen !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
             onClick={() => setDetailOpen(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col"
               onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-brand-600" />
                <div>
                  <h3 className="text-base font-bold text-gray-900">Detalle del Snapshot</h3>
                  <p className="text-xs text-gray-400">ID #{detailOpen} · Trazabilidad completa</p>
                </div>
              </div>
              <button onClick={() => setDetailOpen(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              {detailLoading && (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
                </div>
              )}
              {!detailLoading && detailData && (
                <div className="space-y-4">
                  <div>
                    <div className="text-xs text-gray-400 uppercase font-semibold mb-1">Documento</div>
                    <div className="font-semibold text-gray-900">{detailData.document_title || '—'}</div>
                    {detailData.document_url && (
                      <a href={detailData.document_url} target="_blank" rel="noopener noreferrer"
                         className="inline-flex items-center gap-1 text-xs text-brand-600 hover:text-brand-800 mt-1">
                        Abrir documento <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Fuente" value={`${detailData.source_owner || ''} - ${detailData.source_name || ''}`} />
                    <Field label="Tipo" value={detailData.document_type} />
                    <Field label="Cultivo" value={detailData.crop_name} />
                    <Field label="Grupo" value={detailData.crop_group} />
                    <Field label="Departamento" value={detailData.department} />
                    <Field label="Clasificación SENASA" value={detailData.category_name} />
                    <Field label="Período" value={detailData.period_label} />
                    <Field label="Hectáreas" value={detailData.hectares ? `${Number(detailData.hectares).toLocaleString('es-PE')} ha` : null} />
                    <Field label="Producción" value={detailData.production_value ? Number(detailData.production_value).toLocaleString('es-PE') : null} />
                    <Field
                      label="Oportunidad"
                      value={detailData.opportunity_level ? `${detailData.opportunity_level} (score ${Math.round(Number(detailData.opportunity_score))})` : null}
                    />
                    <Field
                      label="F. Publicación"
                      value={detailData.publication_date ? new Date(detailData.publication_date).toLocaleDateString('es-PE') : null}
                    />
                    <Field
                      label="F. Captura"
                      value={detailData.capture_date ? new Date(detailData.capture_date).toLocaleDateString('es-PE') : null}
                    />
                  </div>

                  {detailData.business_note && (
                    <div>
                      <div className="text-xs text-gray-400 uppercase font-semibold mb-1">Nota de negocio</div>
                      <div className="bg-gray-50 rounded-xl p-3 text-sm text-gray-700 leading-relaxed">
                        {detailData.business_note}
                      </div>
                    </div>
                  )}

                  {detailData.raw_payload && (
                    <div>
                      <div className="text-xs text-gray-400 uppercase font-semibold mb-1">Raw Payload (staging)</div>
                      <pre className="bg-gray-900 text-green-300 rounded-xl p-3 text-[11px] overflow-x-auto max-h-64">
{String(detailData.raw_payload).substring(0, 5000)}
{String(detailData.raw_payload).length > 5000 ? '\n\n... (truncado)' : ''}
                      </pre>
                    </div>
                  )}
                </div>
              )}
              {!detailLoading && !detailData && (
                <div className="text-center text-sm text-gray-400 py-12">
                  No se encontró el snapshot.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function Field({ label, value }: { label: string; value: any }) {
  return (
    <div>
      <div className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold mb-0.5">{label}</div>
      <div className="text-sm text-gray-900">{value || <span className="text-gray-400">—</span>}</div>
    </div>
  );
}

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
