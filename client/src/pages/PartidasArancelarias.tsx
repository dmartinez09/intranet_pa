import { useEffect, useState, useMemo } from 'react';
import Header from '../components/layout/Header';
import { comexApi } from '../services/api';
import {
  Landmark, RefreshCw, Search, Filter, X, DollarSign, Package, Briefcase, Globe,
} from 'lucide-react';

interface PartidaResumen {
  partida_id: number;
  hs_code: string;
  descripcion: string;
  familia_pa: string | null;
  total_valor_cif_usd: number;
  total_cantidad_kg: number;
  empresas_activas: number;
  empresas_nombres: string[];
  paises_origen: number;
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

export default function PartidasArancelarias() {
  const [data, setData] = useState<PartidaResumen[]>([]);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [search, setSearch] = useState('');
  const [familiaFilter, setFamiliaFilter] = useState<string>('');

  useEffect(() => { void load(); }, [year]); // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    setLoading(true);
    try {
      const res = await comexApi.getPartidaResumen(year);
      setData(res.data.data || []);
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
        p.descripcion.toLowerCase().includes(q)
      );
    }
    return result;
  }, [data, search, familiaFilter]);

  const totalCIF = filtered.reduce((s, p) => s + p.total_valor_cif_usd, 0);
  const totalKg = filtered.reduce((s, p) => s + p.total_cantidad_kg, 0);
  const totalEmpresas = new Set(filtered.filter(p => p.empresas_activas > 0).map(p => p.hs_code)).size;

  return (
    <div className="min-h-screen">
      <Header title="Partidas Arancelarias" subtitle="Detalle por partida, familia PA y valor CIF" />

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
                placeholder="Buscar partida o descripción..."
                className="input-field pl-10 text-sm w-72"
              />
            </div>
            <select
              value={familiaFilter}
              onChange={e => setFamiliaFilter(e.target.value)}
              className="input-field text-sm"
            >
              <option value="">Todas las familias PA</option>
              {FAMILIAS.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
            {(search || familiaFilter) && (
              <button
                onClick={() => { setSearch(''); setFamiliaFilter(''); }}
                className="text-sm text-gray-500 hover:text-danger-500 flex items-center gap-1"
              >
                <X className="w-3.5 h-3.5" /> Limpiar
              </button>
            )}
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
          <KpiMini icon={Landmark} label="Partidas" value={filtered.length.toString()} />
          <KpiMini icon={DollarSign} label="CIF USD" value={`$${Math.round(totalCIF / 1000).toLocaleString('es-PE')}K`} />
          <KpiMini icon={Package} label="Kg totales" value={`${Math.round(totalKg / 1000).toLocaleString('es-PE')}K`} />
          <KpiMini icon={Briefcase} label="Partidas con operación" value={String(totalEmpresas)} />
        </div>

        {/* Tabla */}
        <div className="chart-container">
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
                    <th>Familia PA</th>
                    <th className="text-right">CIF USD</th>
                    <th className="text-right">Kg</th>
                    <th>Empresas importadoras</th>
                    <th className="text-right">Países</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(p => (
                    <tr key={p.partida_id}>
                      <td className="font-mono text-xs font-bold text-brand-700">{p.hs_code}</td>
                      <td className="max-w-md text-sm">{p.descripcion}</td>
                      <td>
                        {p.familia_pa ? (
                          <span className={`badge text-[10px] ${FAMILIA_COLORS[p.familia_pa] || 'bg-gray-100 text-gray-700'}`}>
                            {p.familia_pa}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="text-right font-mono">
                        ${p.total_valor_cif_usd.toLocaleString('es-PE', { maximumFractionDigits: 0 })}
                      </td>
                      <td className="text-right font-mono text-xs">
                        {p.total_cantidad_kg.toLocaleString('es-PE', { maximumFractionDigits: 0 })}
                      </td>
                      <td className="text-xs">
                        <EmpresasCell count={p.empresas_activas} names={p.empresas_nombres} />
                      </td>
                      <td className="text-right text-xs text-gray-500">{p.paises_origen}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="font-bold bg-gray-50">
                    <td colSpan={3}>Totales ({filtered.length})</td>
                    <td className="text-right font-mono">
                      ${totalCIF.toLocaleString('es-PE', { maximumFractionDigits: 0 })}
                    </td>
                    <td className="text-right font-mono text-xs">
                      {totalKg.toLocaleString('es-PE', { maximumFractionDigits: 0 })}
                    </td>
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

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

// Muestra las empresas importadoras de una partida.
// - Si no hay → "—"
// - 1 empresa → nombre solo
// - 2-3 empresas → lista separada por coma
// - 4+ empresas → top 3 + "+N más"
function EmpresasCell({ count, names }: { count: number; names: string[] }) {
  if (!count || count === 0) return <span className="text-gray-400">—</span>;
  if (!names || names.length === 0) {
    return <span className="text-gray-600">{count} {count === 1 ? 'empresa' : 'empresas'}</span>;
  }

  // Badge por empresa - Point Andina destacado
  const renderBadge = (n: string, key: number) => {
    const isPA = n.toLowerCase().includes('point andina');
    return (
      <span key={key}
        className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-medium mr-1 mb-1
          ${isPA
            ? 'bg-brand-100 text-brand-800 border border-brand-300'
            : 'bg-gray-100 text-gray-700'}`}
        title={n}
      >
        {n}
      </span>
    );
  };

  if (count === 1) {
    return <div className="flex flex-wrap">{renderBadge(names[0], 0)}</div>;
  }
  if (count <= 3) {
    return <div className="flex flex-wrap">{names.slice(0, 3).map(renderBadge)}</div>;
  }
  return (
    <div className="flex flex-wrap items-center gap-0.5" title={names.join(', ')}>
      {names.slice(0, 3).map(renderBadge)}
      <span className="text-[11px] text-gray-500 font-medium">+{count - 3} más</span>
    </div>
  );
}
