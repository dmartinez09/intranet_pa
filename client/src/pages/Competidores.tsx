import { useEffect, useState, useMemo } from 'react';
import Header from '../components/layout/Header';
import { comexApi } from '../services/api';
import {
  Trophy, RefreshCw, Search, Briefcase, DollarSign, Package, Award,
} from 'lucide-react';
import ComexSourcesPanel from '../components/ComexSourcesPanel';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';

interface RankingRow {
  empresa_id: number;
  razon_social: string;
  nombre_comercial: string | null;
  tipo_empresa: string | null;
  total_valor_cif_usd: number;
  total_cantidad_kg: number;
  operaciones: number;
  partidas_distintas: number;
  paises_distintos: number;
  share_pct: number;
}


const BAR_COLORS = ['#00A651', '#008C44', '#007038', '#34D67B', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#EC4899', '#10B981'];

export default function Competidores() {
  const [data, setData] = useState<RankingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [search, setSearch] = useState('');
  const [tipoFilter, setTipoFilter] = useState<string>('');

  useEffect(() => { void load(); }, [year]); // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    setLoading(true);
    try {
      const res = await comexApi.getRanking(year, 50);
      setData(res.data.data || []);
    } catch (err) {
      console.error('[Competidores] error:', err);
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    let result = data;
    if (tipoFilter) result = result.filter(r => r.tipo_empresa === tipoFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(r =>
        r.razon_social.toLowerCase().includes(q) ||
        (r.nombre_comercial || '').toLowerCase().includes(q)
      );
    }
    return result;
  }, [data, search, tipoFilter]);

  const top10 = useMemo(() =>
    filtered.slice(0, 10).map(r => ({
      name: (r.nombre_comercial || r.razon_social).substring(0, 20),
      cif: r.total_valor_cif_usd,
      share: r.share_pct,
    })),
  [filtered]);

  const totalCIF = filtered.reduce((s, r) => s + r.total_valor_cif_usd, 0);
  const totalOps = filtered.reduce((s, r) => s + r.operaciones, 0);

  return (
    <div className="min-h-screen">
      <Header title="Competidores" subtitle="Ranking de importadores agroquímicos en Perú por valor CIF" />

      <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4 sm:space-y-6">

        {/* Toolbar */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar competidor..."
                className="input-field pl-10 text-sm w-64"
              />
            </div>
            <select value={tipoFilter} onChange={e => setTipoFilter(e.target.value)} className="input-field text-sm">
              <option value="">Todos los tipos</option>
              <option value="Multinacional">Multinacional</option>
              <option value="Nacional">Nacional</option>
              <option value="Distribuidor">Distribuidor</option>
              <option value="Formulador">Formulador</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-600">Año:</label>
            <select value={year} onChange={e => setYear(parseInt(e.target.value))}
                    className="text-xs border border-gray-200 rounded-md px-2 py-1 bg-white">
              {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <button onClick={load} className="flex items-center gap-1.5 text-xs font-medium text-brand-700 hover:text-brand-800">
              <RefreshCw className="w-3.5 h-3.5" /> Recargar
            </button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          <KpiMini icon={Briefcase} label="Competidores" value={filtered.length.toString()} />
          <KpiMini icon={DollarSign} label="CIF USD total" value={`$${Math.round(totalCIF / 1000).toLocaleString('es-PE')}K`} />
          <KpiMini icon={Package} label="Operaciones" value={totalOps.toLocaleString('es-PE')} />
          <KpiMini icon={Award} label="Top 3 share %" value={`${filtered.slice(0, 3).reduce((s, r) => s + r.share_pct, 0).toFixed(1)}%`} />
        </div>

        {/* Top 10 chart */}
        {top10.length > 0 && (
          <div className="chart-container">
            <h3 className="text-base font-bold text-gray-900 mb-1">Top 10 Competidores — CIF USD</h3>
            <p className="text-xs text-gray-400 mb-4">Ranking por valor CIF importado | {year}</p>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={top10} layout="vertical" margin={{ left: 100 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={100} />
                <Tooltip formatter={(v: any, n: any) => {
                  if (n === 'cif') return [`$${Number(v).toLocaleString('es-PE')}`, 'CIF USD'];
                  return v;
                }} />
                <Bar dataKey="cif" radius={[0, 6, 6, 0]}>
                  {top10.map((_, i) => <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Tabla detalle */}
        <div className="chart-container">
          <div className="flex items-center gap-3 mb-4">
            <Trophy className="w-5 h-5 text-amber-600" />
            <div>
              <h3 className="text-base font-bold text-gray-900">Ranking Detallado de Competidores</h3>
              <p className="text-xs text-gray-400">{filtered.length} empresas importadoras activas</p>
            </div>
          </div>
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <div className="w-8 h-8 border-4 border-brand-200 border-t-brand-500 rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Trophy className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p className="text-sm">No hay datos para los filtros seleccionados.</p>
              <p className="text-xs mt-1">Ejecuta el collector BASELINE_PE_COMEX para poblar el ranking.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table-modern">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Competidor</th>
                    <th>Tipo</th>
                    <th className="text-right">CIF USD</th>
                    <th className="text-right">Kg</th>
                    <th className="text-right">Operaciones</th>
                    <th className="text-right">Partidas</th>
                    <th className="text-right">Países</th>
                    <th className="text-right">Share %</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r, i) => (
                    <tr key={r.empresa_id}>
                      <td>
                        <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold
                          ${i < 3 ? 'bg-amber-100 text-amber-700' :
                             i < 10 ? 'bg-brand-100 text-brand-700' :
                             'bg-gray-100 text-gray-500'}`}>
                          {i + 1}
                        </span>
                      </td>
                      <td>
                        <div className="font-semibold">{r.nombre_comercial || r.razon_social}</div>
                        {r.nombre_comercial && (
                          <div className="text-xs text-gray-400">{r.razon_social}</div>
                        )}
                      </td>
                      <td>
                        {r.tipo_empresa && (
                          <span className={`badge text-[10px] ${
                            r.tipo_empresa === 'Multinacional' ? 'bg-purple-50 text-purple-700' :
                            r.tipo_empresa === 'Nacional' ? 'bg-brand-50 text-brand-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>{r.tipo_empresa}</span>
                        )}
                      </td>
                      <td className="text-right font-mono font-bold">
                        ${r.total_valor_cif_usd.toLocaleString('es-PE', { maximumFractionDigits: 0 })}
                      </td>
                      <td className="text-right font-mono text-xs">
                        {r.total_cantidad_kg.toLocaleString('es-PE', { maximumFractionDigits: 0 })}
                      </td>
                      <td className="text-right">{r.operaciones}</td>
                      <td className="text-right text-xs text-gray-500">{r.partidas_distintas}</td>
                      <td className="text-right text-xs text-gray-500">{r.paises_distintos}</td>
                      <td className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-brand-400 to-brand-600"
                                 style={{ width: `${Math.min(100, r.share_pct * 5)}%` }} />
                          </div>
                          <span className="font-mono text-xs font-bold">{r.share_pct}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <ComexSourcesPanel />

      </div>
    </div>
  );
}

function KpiMini({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="kpi-card">
      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center mb-3 shadow-sm">
        <Icon className="w-5 h-5 text-white" />
      </div>
      <p className="text-xl sm:text-2xl font-extrabold text-gray-900 truncate">{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
}
