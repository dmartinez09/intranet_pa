import { useEffect, useState, useMemo } from 'react';
import Header from '../components/layout/Header';
import { comexApi } from '../services/api';
import {
  Landmark, RefreshCw, Search, Filter, X, DollarSign, Package, Briefcase, Eye,
} from 'lucide-react';
import ComexSourcesPanel from '../components/ComexSourcesPanel';
import ComexPeriodFilter from '../components/filters/ComexPeriodFilter';
import ComexDetailModal from '../components/ComexDetailModal';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';

interface PartidaResumen {
  partida_id: number;
  hs_code: string;
  descripcion: string;
  familia_pa: string | null;
  tipo_grupo?: string | null;
  total_valor_cif_usd: number;
  total_cantidad_kg: number;
  operaciones?: number;
  empresas_activas: number;
  empresas_nombres: string[];
  paises_origen: number;
  ingrediente_activo?: string;
  top_ingredientes?: string[];
  top_formulaciones?: string[];
}

interface ProductoRow {
  producto_id: number;
  ingrediente_activo: string;
  nombre_comercial: string;
  familia_pa: string;
  cif_usd: number;
  kg: number;
  ops: number;
  empresas_distintas: number;
}

const FAMILIAS = ['FUNGICIDAS', 'INSECTICIDAS', 'HERBICIDAS', 'NUTRICIONALES', 'BIOLOGICOS', 'COADYUVANTES', 'ORGANICOS', 'OTROS'];
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
const FAMILIA_HEX: Record<string, string> = {
  FUNGICIDAS: '#10B981', INSECTICIDAS: '#EF4444', HERBICIDAS: '#F59E0B',
  NUTRICIONALES: '#8B5CF6', BIOLOGICOS: '#06B6D4', COADYUVANTES: '#EC4899',
  ORGANICOS: '#22C55E', OTROS: '#64748B',
};

const fmtUSD = (v: any) => `$${(Number(v) || 0).toLocaleString('es-PE', { maximumFractionDigits: 0 })}`;
const fmtKg = (v: any) => `${(Number(v) || 0).toLocaleString('es-PE', { maximumFractionDigits: 0 })} kg`;

export default function PartidasArancelarias() {
  const [data, setData] = useState<PartidaResumen[]>([]);
  const [productos, setProductos] = useState<ProductoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState<number | undefined>();
  const [month, setMonth] = useState<number | undefined>();
  const [search, setSearch] = useState('');
  const [familiaFilter, setFamiliaFilter] = useState<string>('');
  const [detailId, setDetailId] = useState<number | null>(null);

  useEffect(() => { if (year) void load(); /* eslint-disable-next-line */ }, [year, month]);

  async function load() {
    setLoading(true);
    try {
      const [r1, r2] = await Promise.all([
        comexApi.getPartidaResumen(year, month),
        comexApi.getProductosResumen({ year, month, limit: 50 }),
      ]);
      setData(r1.data.data || []);
      setProductos(r2.data.data || []);
    } catch (err) {
      console.error('[Partidas] error:', err);
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    let result = data;
    if (familiaFilter) result = result.filter(p => p.familia_pa === familiaFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(p =>
        p.hs_code.toLowerCase().includes(q) ||
        p.descripcion.toLowerCase().includes(q) ||
        (p.ingrediente_activo || '').toLowerCase().includes(q) ||
        (p.top_ingredientes || []).some(i => i.toLowerCase().includes(q)) ||
        (p.top_formulaciones || []).some(f => f.toLowerCase().includes(q))
      );
    }
    return result;
  }, [data, search, familiaFilter]);

  const totalCIF = filtered.reduce((s, p) => s + (Number(p.total_valor_cif_usd) || 0), 0);
  const totalKg = filtered.reduce((s, p) => s + (Number(p.total_cantidad_kg) || 0), 0);
  const totalOps = filtered.reduce((s, p) => s + (Number(p.operaciones) || 0), 0);

  const familiaChart = useMemo(() => {
    const grouped = new Map<string, number>();
    filtered.forEach(p => {
      const f = p.familia_pa || 'OTROS';
      grouped.set(f, (grouped.get(f) || 0) + Number(p.total_valor_cif_usd || 0));
    });
    return Array.from(grouped.entries()).map(([familia_pa, cif]) => ({ familia_pa, cif }));
  }, [filtered]);

  const top10Partidas = useMemo(() => [...filtered].sort((a, b) => Number(b.total_valor_cif_usd) - Number(a.total_valor_cif_usd)).slice(0, 10), [filtered]);

  return (
    <div className="min-h-screen">
      <Header title="Partidas Arancelarias" subtitle="Detalle por partida, ingrediente activo, familia PA y valor CIF" />

      <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4 sm:space-y-6">

        {/* Toolbar */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar HS, descripción o ingrediente..." className="input-field pl-10 text-sm w-72" />
            </div>
            <select value={familiaFilter} onChange={e => setFamiliaFilter(e.target.value)} className="input-field text-sm">
              <option value="">Todas las familias PA</option>
              {FAMILIAS.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
            {(search || familiaFilter) && (
              <button onClick={() => { setSearch(''); setFamiliaFilter(''); }} className="text-sm text-gray-500 hover:text-danger-500 flex items-center gap-1">
                <X className="w-3.5 h-3.5" /> Limpiar
              </button>
            )}
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
          <KpiMini icon={Landmark} label="Partidas" value={filtered.length.toString()} />
          <KpiMini icon={DollarSign} label="CIF USD" value={fmtUSD(totalCIF)} />
          <KpiMini icon={Package} label="Kg totales" value={fmtKg(totalKg)} />
          <KpiMini icon={Briefcase} label="Operaciones" value={totalOps.toLocaleString('es-PE')} />
        </div>

        {/* Charts: distribución + Top 10 partidas */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="chart-container">
            <h3 className="text-base font-bold text-gray-900 mb-1">Distribución CIF por Familia PA</h3>
            <p className="text-xs text-gray-400 mb-4">{filtered.length} partidas</p>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={familiaChart} dataKey="cif" nameKey="familia_pa" cx="50%" cy="50%" outerRadius={95} innerRadius={50} stroke="none" label={(e: any) => e.familia_pa}>
                  {familiaChart.map((f, i) => <Cell key={i} fill={FAMILIA_HEX[f.familia_pa] || '#64748B'} />)}
                </Pie>
                <Tooltip formatter={(v: any) => fmtUSD(v)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="chart-container">
            <h3 className="text-base font-bold text-gray-900 mb-1">Top 10 Partidas Arancelarias</h3>
            <p className="text-xs text-gray-400 mb-4">CIF USD</p>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={top10Partidas} layout="vertical" margin={{ left: 80 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <YAxis type="category" dataKey="hs_code" tick={{ fontSize: 10 }} width={80} />
                <Tooltip formatter={(v: any) => fmtUSD(v)} labelFormatter={(_l, p: any) => p?.[0]?.payload?.descripcion?.slice(0, 60)} />
                <Bar dataKey="total_valor_cif_usd" fill="#F59E0B" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Tabla principal */}
        <div className="chart-container">
          <h3 className="text-base font-bold text-gray-900 mb-3">Detalle de Partidas {year}{month ? `-${String(month).padStart(2, '0')}` : ''}</h3>
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="w-8 h-8 border-4 border-brand-200 border-t-brand-500 rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Filter className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p className="text-sm">No hay partidas con los filtros seleccionados.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table-modern">
                <thead>
                  <tr>
                    <th>HS Code</th>
                    <th>Descripción</th>
                    <th>Ingredientes / Formulado</th>
                    <th>Familia PA</th>
                    <th>Tipo grupo</th>
                    <th className="text-right">CIF USD</th>
                    <th className="text-right">Kg</th>
                    <th className="text-right">Ops</th>
                    <th>Empresas</th>
                    <th className="text-right">Países</th>
                    <th className="text-center">Detalle</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(p => (
                    <tr key={p.partida_id} className="hover:bg-gray-50">
                      <td className="font-mono text-xs font-bold text-brand-700">{p.hs_code}</td>
                      <td className="max-w-md text-sm">{p.descripcion}</td>
                      <td className="max-w-xs">
                        {(p.top_ingredientes && p.top_ingredientes.length > 0) ? (
                          <div className="flex flex-wrap gap-1">
                            {p.top_ingredientes.slice(0, 3).map((ing, i) => (
                              <span key={i} className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200" title={ing}>{ing}</span>
                            ))}
                            {(p.top_formulaciones && p.top_formulaciones.length > 0) && (
                              <span className="inline-flex items-center gap-0.5 ml-0.5">
                                {p.top_formulaciones.slice(0, 4).map((f, i) => (
                                  <span key={i} className="inline-block px-1 py-0.5 rounded text-[9px] font-mono font-bold bg-amber-50 text-amber-700 border border-amber-200" title={`Formulación ${f}`}>{f}</span>
                                ))}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[11px] text-gray-400">—</span>
                        )}
                      </td>
                      <td>
                        {p.familia_pa ? (
                          <span className={`badge text-[10px] ${FAMILIA_COLORS[p.familia_pa] || 'bg-gray-100 text-gray-700'}`}>{p.familia_pa}</span>
                        ) : '—'}
                      </td>
                      <td className="text-xs text-gray-600">{p.tipo_grupo || '—'}</td>
                      <td className="text-right font-mono">{fmtUSD(p.total_valor_cif_usd)}</td>
                      <td className="text-right font-mono text-xs">{Number(p.total_cantidad_kg || 0).toLocaleString('es-PE', { maximumFractionDigits: 0 })}</td>
                      <td className="text-right font-mono text-xs">{Number(p.operaciones || 0).toLocaleString('es-PE')}</td>
                      <td className="text-xs"><EmpresasCell count={p.empresas_activas} names={p.empresas_nombres} /></td>
                      <td className="text-right text-xs text-gray-500">{p.paises_origen}</td>
                      <td className="text-center">
                        <button onClick={() => setDetailId(p.partida_id)} className="p-1.5 hover:bg-brand-50 rounded text-brand-600 hover:text-brand-800 transition-colors" title="Ver detalle">
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="font-bold bg-gray-50">
                    <td colSpan={5}>Totales ({filtered.length})</td>
                    <td className="text-right font-mono">{fmtUSD(totalCIF)}</td>
                    <td className="text-right font-mono text-xs">{Number(totalKg).toLocaleString('es-PE', { maximumFractionDigits: 0 })}</td>
                    <td className="text-right font-mono text-xs">{totalOps.toLocaleString('es-PE')}</td>
                    <td colSpan={3}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        {/* TABLA: Ingredientes Activos / Productos Formulados */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-emerald-50 to-green-50">
            <h3 className="text-base font-bold text-gray-900">Ingredientes Activos / Productos Formulados — Mayor importación</h3>
            <p className="text-xs text-gray-500 mt-0.5">Datos clave para inteligencia comercial: qué ingredientes químicos están entrando y por quién</p>
          </div>
          <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600 uppercase tracking-wide">#</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600 uppercase tracking-wide">Ingrediente Activo</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600 uppercase tracking-wide">Producto Formulado</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600 uppercase tracking-wide">Familia</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-600 uppercase tracking-wide">CIF USD</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-600 uppercase tracking-wide">Kg</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-600 uppercase tracking-wide">Ops</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-600 uppercase tracking-wide">Empresas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {productos.map((p, i) => (
                  <tr key={p.producto_id || i} className="hover:bg-gray-50">
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
        <ComexDetailModal kind="partida" id={detailId} year={year} month={month} onClose={() => setDetailId(null)} />
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

function EmpresasCell({ count, names }: { count: number; names: string[] }) {
  if (!count || count === 0) return <span className="text-gray-400">—</span>;
  if (!names || names.length === 0) return <span className="text-gray-600">{count} {count === 1 ? 'empresa' : 'empresas'}</span>;
  const renderBadge = (n: string, key: number) => {
    const isPA = n.toLowerCase().includes('point andina');
    return (
      <span key={key} className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-medium mr-1 mb-1 ${isPA ? 'bg-brand-100 text-brand-800 border border-brand-300' : 'bg-gray-100 text-gray-700'}`} title={n}>{n}</span>
    );
  };
  if (count === 1) return <div className="flex flex-wrap">{renderBadge(names[0], 0)}</div>;
  if (count <= 3) return <div className="flex flex-wrap">{names.slice(0, 3).map(renderBadge)}</div>;
  return (
    <div className="flex flex-wrap items-center gap-0.5" title={names.join(', ')}>
      {names.slice(0, 3).map(renderBadge)}
      <span className="text-[11px] text-gray-500 font-medium">+{count - 3} más</span>
    </div>
  );
}
