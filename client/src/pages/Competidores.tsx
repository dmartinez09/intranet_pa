import { useEffect, useState, useMemo } from 'react';
import Header from '../components/layout/Header';
import { comexApi } from '../services/api';
import {
  Trophy, RefreshCw, Search, Briefcase, DollarSign, Package, Award, Eye, FlaskConical,
} from 'lucide-react';
import ComexSourcesPanel from '../components/ComexSourcesPanel';
import ComexPeriodFilter from '../components/filters/ComexPeriodFilter';
import ComexDetailModal from '../components/ComexDetailModal';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie,
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
  es_point_andina?: number;
}

interface ProductoRow {
  ingrediente_activo: string;
  nombre_comercial: string;
  familia_pa: string;
  cif_usd: number;
  kg: number;
  ops: number;
  empresas_distintas: number;
}

const BAR_COLORS = ['#00A651', '#008C44', '#007038', '#34D67B', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#EC4899', '#10B981'];
const TIPO_COLORS: Record<string, string> = {
  Multinacional: '#8B5CF6', Nacional: '#00A651', Distribuidor: '#F59E0B', Formulador: '#06B6D4',
};
const FAMILIA_COLORS: Record<string, string> = {
  FUNGICIDAS: 'bg-green-100 text-green-700',
  INSECTICIDAS: 'bg-red-100 text-red-700',
  HERBICIDAS: 'bg-amber-100 text-amber-700',
  NUTRICIONALES: 'bg-purple-100 text-purple-700',
  BIOLOGICOS: 'bg-cyan-100 text-cyan-700',
  COADYUVANTES: 'bg-pink-100 text-pink-700',
  ORGANICOS: 'bg-emerald-100 text-emerald-700',
  OTROS: 'bg-slate-100 text-slate-700',
};

const fmtUSD = (v: any) => `$${(Number(v) || 0).toLocaleString('es-PE', { maximumFractionDigits: 0 })}`;
const fmtKg = (v: any) => `${(Number(v) || 0).toLocaleString('es-PE', { maximumFractionDigits: 0 })} kg`;

export default function Competidores() {
  const [data, setData] = useState<RankingRow[]>([]);
  const [productos, setProductos] = useState<ProductoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState<number | undefined>();
  const [month, setMonth] = useState<number | undefined>();
  const [search, setSearch] = useState('');
  const [tipoFilter, setTipoFilter] = useState<string>('');
  const [detailId, setDetailId] = useState<number | null>(null);

  useEffect(() => { if (year) void load(); /* eslint-disable-next-line */ }, [year, month]);

  async function load() {
    setLoading(true);
    try {
      const [r1, r2] = await Promise.all([
        comexApi.getRanking(year, 100, month),
        comexApi.getProductosResumen({ year, month, limit: 50 }),
      ]);
      setData(r1.data.data || []);
      setProductos(r2.data.data || []);
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

  const top10 = useMemo(() => filtered.slice(0, 10).map(r => ({
    name: (r.nombre_comercial || r.razon_social).substring(0, 22),
    cif: Number(r.total_valor_cif_usd) || 0,
    share: Number(r.share_pct) || 0,
  })), [filtered]);

  const totalCIF = filtered.reduce((s, r) => s + (Number(r.total_valor_cif_usd) || 0), 0);
  const totalOps = filtered.reduce((s, r) => s + (Number(r.operaciones) || 0), 0);

  const tipoDistribution = useMemo(() => {
    const grouped = new Map<string, number>();
    filtered.forEach(r => {
      const t = r.tipo_empresa || 'Otros';
      grouped.set(t, (grouped.get(t) || 0) + Number(r.total_valor_cif_usd || 0));
    });
    return Array.from(grouped.entries()).map(([tipo, cif]) => ({ tipo, cif }));
  }, [filtered]);

  return (
    <div className="min-h-screen">
      <Header title="Competidores" subtitle="Ranking de importadores agroquímicos en Perú · No acumulado, por periodo" />

      <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4 sm:space-y-6">

        {/* Toolbar */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar competidor..." className="input-field pl-10 text-sm w-64" />
            </div>
            <select value={tipoFilter} onChange={e => setTipoFilter(e.target.value)} className="input-field text-sm">
              <option value="">Todos los tipos</option>
              <option value="Multinacional">Multinacional</option>
              <option value="Nacional">Nacional</option>
              <option value="Distribuidor">Distribuidor</option>
              <option value="Formulador">Formulador</option>
            </select>
          </div>
          <div className="flex items-center gap-3">
            <ComexPeriodFilter year={year} month={month} onChange={(y, mo) => { setYear(y); setMonth(mo); }} />
            <button onClick={load} className="flex items-center gap-1.5 text-xs font-medium text-brand-700 hover:text-brand-800">
              <RefreshCw className="w-3.5 h-3.5" /> Recargar
            </button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          <KpiMini icon={Briefcase} label="Competidores activos" value={filtered.length.toString()} />
          <KpiMini icon={DollarSign} label="CIF USD periodo" value={fmtUSD(totalCIF)} />
          <KpiMini icon={Package} label="Operaciones" value={totalOps.toLocaleString('es-PE')} />
          <KpiMini icon={Award} label="Top 3 share %" value={`${filtered.slice(0, 3).reduce((s, r) => s + Number(r.share_pct || 0), 0).toFixed(1)}%`} />
        </div>

        {/* Charts: top 10 + distribución por tipo */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="chart-container">
            <h3 className="text-base font-bold text-gray-900 mb-1">Top 10 Competidores — CIF USD</h3>
            <p className="text-xs text-gray-400 mb-4">Ranking por valor CIF | {year}{month ? `-${String(month).padStart(2,'0')}` : ' (año completo)'}</p>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={top10} layout="vertical" margin={{ left: 100 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={100} />
                <Tooltip formatter={(v: any) => fmtUSD(v)} />
                <Bar dataKey="cif" radius={[0, 6, 6, 0]}>
                  {top10.map((_, i) => <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="chart-container">
            <h3 className="text-base font-bold text-gray-900 mb-1">Distribución por Tipo de Empresa</h3>
            <p className="text-xs text-gray-400 mb-4">Cuota CIF según naturaleza</p>
            <ResponsiveContainer width="100%" height={320}>
              <PieChart>
                <Pie data={tipoDistribution} dataKey="cif" nameKey="tipo" cx="50%" cy="50%" outerRadius={110} innerRadius={60} stroke="none" label={(e: any) => `${e.tipo}: ${fmtUSD(e.cif)}`}>
                  {tipoDistribution.map((t, i) => <Cell key={i} fill={TIPO_COLORS[t.tipo] || BAR_COLORS[i]} />)}
                </Pie>
                <Tooltip formatter={(v: any) => fmtUSD(v)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Tabla ranking */}
        <div className="chart-container">
          <div className="flex items-center gap-3 mb-4">
            <Trophy className="w-5 h-5 text-amber-600" />
            <div>
              <h3 className="text-base font-bold text-gray-900">Ranking Detallado de Competidores · {year}{month ? `-${String(month).padStart(2,'0')}` : ''}</h3>
              <p className="text-xs text-gray-400">{filtered.length} empresas importadoras · click en el ojo para ver productos y partidas</p>
            </div>
          </div>
          {loading ? (
            <div className="flex items-center justify-center h-48"><div className="w-8 h-8 border-4 border-brand-200 border-t-brand-500 rounded-full animate-spin" /></div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Trophy className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p className="text-sm">No hay datos para los filtros seleccionados.</p>
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
                    <th className="text-center">Detalle</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r, i) => (
                    <tr key={r.empresa_id} className={r.es_point_andina ? 'bg-brand-50/40' : ''}>
                      <td>
                        <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${i < 3 ? 'bg-amber-100 text-amber-700' : i < 10 ? 'bg-brand-100 text-brand-700' : 'bg-gray-100 text-gray-500'}`}>{i + 1}</span>
                      </td>
                      <td>
                        <div className="font-semibold">{r.nombre_comercial || r.razon_social}{r.es_point_andina ? <span className="ml-2 text-[10px] text-brand-700 font-bold">🏆 POINT ANDINA</span> : ''}</div>
                        {r.nombre_comercial && <div className="text-xs text-gray-400">{r.razon_social}</div>}
                      </td>
                      <td>{r.tipo_empresa && <span className={`badge text-[10px] ${r.tipo_empresa === 'Multinacional' ? 'bg-purple-50 text-purple-700' : r.tipo_empresa === 'Nacional' ? 'bg-brand-50 text-brand-700' : 'bg-gray-100 text-gray-700'}`}>{r.tipo_empresa}</span>}</td>
                      <td className="text-right font-mono font-bold">{fmtUSD(r.total_valor_cif_usd)}</td>
                      <td className="text-right font-mono text-xs">{Number(r.total_cantidad_kg || 0).toLocaleString('es-PE', { maximumFractionDigits: 0 })}</td>
                      <td className="text-right">{r.operaciones}</td>
                      <td className="text-right text-xs text-gray-500">{r.partidas_distintas}</td>
                      <td className="text-right text-xs text-gray-500">{r.paises_distintos}</td>
                      <td className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-brand-400 to-brand-600" style={{ width: `${Math.min(100, Number(r.share_pct) * 5)}%` }} />
                          </div>
                          <span className="font-mono text-xs font-bold">{Number(r.share_pct).toFixed(2)}%</span>
                        </div>
                      </td>
                      <td className="text-center">
                        <button onClick={() => setDetailId(r.empresa_id)} className="p-1.5 hover:bg-brand-50 rounded text-brand-600 hover:text-brand-800 transition-colors" title="Ver productos, partidas y países">
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* TABLA: productos formulados / ingredientes activos que están importando */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-cyan-50 to-emerald-50 flex items-center gap-3">
            <FlaskConical className="w-5 h-5 text-emerald-600" />
            <div>
              <h3 className="text-base font-bold text-gray-900">¿Qué está trayendo la competencia? — Ingredientes activos y productos formulados</h3>
              <p className="text-xs text-gray-500 mt-0.5">Inteligencia comercial: qué moléculas/formulados están siendo importadas y cuántas empresas las traen</p>
            </div>
          </div>
          <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600 uppercase tracking-wide">#</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600 uppercase tracking-wide">Ingrediente Activo</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600 uppercase tracking-wide">Producto Comercial</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600 uppercase tracking-wide">Familia PA</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-600 uppercase tracking-wide">CIF USD</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-600 uppercase tracking-wide">Kg</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-600 uppercase tracking-wide">Ops</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-600 uppercase tracking-wide">Empresas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {productos.map((p, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-3 py-1.5 text-gray-500">{i + 1}</td>
                    <td className="px-3 py-1.5 font-semibold text-emerald-700">{p.ingrediente_activo}</td>
                    <td className="px-3 py-1.5 text-gray-700">{p.nombre_comercial || '—'}</td>
                    <td className="px-3 py-1.5"><span className={`badge text-[10px] ${FAMILIA_COLORS[p.familia_pa] || 'bg-gray-100 text-gray-700'}`}>{p.familia_pa}</span></td>
                    <td className="px-3 py-1.5 text-right tabular-nums font-semibold">{fmtUSD(p.cif_usd)}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-xs">{Number(p.kg || 0).toLocaleString('es-PE', { maximumFractionDigits: 0 })}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-xs">{p.ops}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{p.empresas_distintas}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <ComexSourcesPanel />
      </div>

      {detailId !== null && (
        <ComexDetailModal kind="empresa" id={detailId} year={year} month={month} onClose={() => setDetailId(null)} />
      )}
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
