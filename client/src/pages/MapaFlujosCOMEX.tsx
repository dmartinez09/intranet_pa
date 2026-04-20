import { useEffect, useState, useMemo } from 'react';
import Header from '../components/layout/Header';
import { comexApi } from '../services/api';
import {
  Share2, RefreshCw, Globe, Filter,
} from 'lucide-react';
import ComexSourcesPanel from '../components/ComexSourcesPanel';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';

interface FlowRow {
  pais_origen: string;
  iso2: string;
  latitude: number | null;
  longitude: number | null;
  total_valor_cif_usd: number;
  total_cantidad_kg: number;
  empresas: number;
  share_pct: number;
}

const FAMILIAS = ['FUNGICIDAS', 'INSECTICIDAS', 'HERBICIDAS', 'NUTRICIONALES', 'BIOLOGICOS', 'COADYUVANTES'];

const COUNTRY_FLAGS: Record<string, string> = {
  CN: '🇨🇳', IN: '🇮🇳', US: '🇺🇸', DE: '🇩🇪', BR: '🇧🇷', AR: '🇦🇷', ES: '🇪🇸',
  IT: '🇮🇹', IL: '🇮🇱', MX: '🇲🇽', JP: '🇯🇵', GB: '🇬🇧', FR: '🇫🇷', BE: '🇧🇪',
  NL: '🇳🇱', CH: '🇨🇭', CL: '🇨🇱', CO: '🇨🇴', EC: '🇪🇨', TR: '🇹🇷', KR: '🇰🇷', AU: '🇦🇺',
};

const BAR_COLORS = ['#00A651', '#008C44', '#007038', '#34D67B', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#EC4899', '#10B981', '#84CC16', '#A855F7'];

export default function MapaFlujosCOMEX() {
  const [data, setData] = useState<FlowRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [familiaFilter, setFamiliaFilter] = useState<string>('');

  useEffect(() => { void load(); }, [year, familiaFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    setLoading(true);
    try {
      const res = await comexApi.getFlows(year, familiaFilter || undefined);
      setData(res.data.data || []);
    } catch (err) {
      console.error('[MapaFlujos] error:', err);
    } finally {
      setLoading(false);
    }
  }

  const top = useMemo(() => data.slice(0, 15), [data]);
  const totalCIF = data.reduce((s, f) => s + f.total_valor_cif_usd, 0);

  return (
    <div className="min-h-screen">
      <Header title="Mapa de Flujos COMEX" subtitle="Orígenes de las importaciones de agroquímicos hacia Perú" />

      <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4 sm:space-y-6">

        {/* Toolbar */}
        <div className="flex items-center gap-3 flex-wrap">
          <select value={familiaFilter} onChange={e => setFamiliaFilter(e.target.value)} className="input-field text-sm">
            <option value="">Todas las familias PA</option>
            {FAMILIAS.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
          <select value={year} onChange={e => setYear(parseInt(e.target.value))} className="input-field text-sm">
            {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={load} className="btn-secondary">
            <RefreshCw className="w-4 h-4" /> Recargar
          </button>
          <div className="ml-auto text-sm text-gray-500">
            <span className="font-semibold text-gray-700">{data.length}</span> países con importaciones ·
            Total CIF: <span className="font-semibold text-brand-700">${Math.round(totalCIF / 1000).toLocaleString('es-PE')}K</span>
          </div>
        </div>

        {/* Empty state */}
        {!loading && data.length === 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
            <Globe className="w-14 h-14 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-bold text-gray-900 mb-2">Sin flujos de origen registrados</h3>
            <p className="text-sm text-gray-500 max-w-md mx-auto">
              Aún no hay importaciones cargadas para los filtros seleccionados.
              Ejecuta el collector BASELINE_PE_COMEX desde el panel admin para poblar datos.
            </p>
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center h-64">
            <div className="w-10 h-10 border-4 border-brand-200 border-t-brand-500 rounded-full animate-spin" />
          </div>
        )}

        {!loading && data.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Ranking de países como "flujos" */}
            <div className="chart-container">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center">
                  <Share2 className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">Flujos de Origen — Top 15 Países</h3>
                  <p className="text-xs text-gray-400">Cada flujo representa importaciones hacia Perú</p>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={480}>
                <BarChart data={top} layout="vertical" margin={{ left: 100 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="pais_origen" tick={{ fontSize: 11 }} width={100} />
                  <Tooltip formatter={(v: any) => [`$${Number(v).toLocaleString('es-PE')}`, 'CIF USD']} />
                  <Bar dataKey="total_valor_cif_usd" radius={[0, 6, 6, 0]}>
                    {top.map((_, i) => <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Tabla detalle */}
            <div className="chart-container">
              <h3 className="text-base font-bold text-gray-900 mb-1">Detalle por País de Origen</h3>
              <p className="text-xs text-gray-400 mb-4">Valor CIF, kilos, empresas y % del total</p>
              <div className="overflow-x-auto">
                <table className="table-modern">
                  <thead>
                    <tr>
                      <th>País</th>
                      <th className="text-right">CIF USD</th>
                      <th className="text-right">Kg</th>
                      <th className="text-right">Empresas</th>
                      <th className="text-right">Share %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.map((f, i) => (
                      <tr key={f.iso2}>
                        <td className="font-semibold">
                          <span className="mr-1">{COUNTRY_FLAGS[f.iso2] || '🌎'}</span>
                          {f.pais_origen}
                          <span className="text-xs text-gray-400 ml-2">{f.iso2}</span>
                        </td>
                        <td className="text-right font-mono font-bold">
                          ${f.total_valor_cif_usd.toLocaleString('es-PE', { maximumFractionDigits: 0 })}
                        </td>
                        <td className="text-right font-mono text-xs">
                          {f.total_cantidad_kg.toLocaleString('es-PE', { maximumFractionDigits: 0 })}
                        </td>
                        <td className="text-right">{f.empresas}</td>
                        <td className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full rounded-full"
                                   style={{
                                     width: `${Math.min(100, f.share_pct * 2)}%`,
                                     backgroundColor: BAR_COLORS[i % BAR_COLORS.length],
                                   }} />
                            </div>
                            <span className="font-mono text-xs font-bold">{f.share_pct}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Info card */}
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-700 flex items-start gap-3">
          <Filter className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold mb-1">Mapa de flujos</p>
            <p className="text-xs text-blue-600 leading-relaxed">
              Esta vista muestra el ranking de países de origen. Para visualización geográfica avanzada
              (conexiones origen→destino sobre mapa mundial), considerar integración futura con D3 o
              leaflet-arc en una Fase posterior.
            </p>
          </div>
        </div>

        <ComexSourcesPanel />

      </div>
    </div>
  );
}
