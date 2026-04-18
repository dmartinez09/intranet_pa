import { useEffect, useState } from 'react';
import Header from '../components/layout/Header';
import { inteligenciaApi } from '../services/api';
import { RefreshCw, Database, Sprout, MapPin, Tag } from 'lucide-react';

interface Meta {
  sources: number;
  crops: number;
  regions: number;
  categories: number;
  last_run: string | null;
}

export default function InteligenciaComercial() {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    inteligenciaApi.getMeta()
      .then(r => setMeta(r.data.data))
      .catch(e => console.error('meta load error:', e))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen">
      <Header title="Inteligencia Comercial" subtitle="Datos agrícolas integrados desde fuentes peruanas" />

      <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4 sm:space-y-6">
        {/* Leyenda de última actualización */}
        <div className="flex items-center gap-2 px-3 py-2 bg-brand-50 border border-brand-100 rounded-lg text-xs text-brand-700 w-fit">
          <RefreshCw className="w-3.5 h-3.5" />
          <span className="font-medium">Última ejecución ETL:</span>
          <span className="font-semibold">{meta?.last_run ? new Date(meta.last_run).toLocaleString('es-PE') : '— (sin ejecuciones todavía)'}</span>
        </div>

        {/* KPIs de catálogo */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          <div className="kpi-card">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center mb-3">
              <Database className="w-5 h-5 text-white" />
            </div>
            <p className="text-xl sm:text-2xl font-extrabold text-gray-900">{meta?.sources ?? '—'}</p>
            <p className="text-xs text-gray-500">Fuentes configuradas</p>
          </div>
          <div className="kpi-card">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent-400 to-accent-600 flex items-center justify-center mb-3">
              <Sprout className="w-5 h-5 text-white" />
            </div>
            <p className="text-xl sm:text-2xl font-extrabold text-gray-900">{meta?.crops ?? '—'}</p>
            <p className="text-xs text-gray-500">Cultivos objetivo</p>
          </div>
          <div className="kpi-card">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center mb-3">
              <MapPin className="w-5 h-5 text-white" />
            </div>
            <p className="text-xl sm:text-2xl font-extrabold text-gray-900">{meta?.regions ?? '—'}</p>
            <p className="text-xs text-gray-500">Departamentos</p>
          </div>
          <div className="kpi-card">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center mb-3">
              <Tag className="w-5 h-5 text-white" />
            </div>
            <p className="text-xl sm:text-2xl font-extrabold text-gray-900">{meta?.categories ?? '—'}</p>
            <p className="text-xs text-gray-500">Categorías Point Andina</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <div className="flex flex-col items-center text-center gap-3 py-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center">
              <Sprout className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">Inteligencia Comercial Beta — Fase 1</h3>
            <p className="text-sm text-gray-500 max-w-xl">
              {loading ? 'Cargando...' : 'Catálogo inicial cargado. Los datos agrícolas reales (SIEA, MIDAGRI, INEI) se cargarán en la Fase 2 mediante el ETL programado.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
