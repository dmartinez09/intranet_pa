import { useState, useEffect, useMemo } from 'react';
import Header from '../components/layout/Header';
import api from '../services/api';
import {
  BookOpen,
  Search,
  Layers,
  GitBranch,
  FlaskConical,
  UserCheck,
  MapPin,
  Briefcase,
  Hash,
} from 'lucide-react';

interface Vendedor {
  nombre: string;
  zona: string;
  equipo: string;
}

interface DiccionarioData {
  familias: string[];
  sub_familias: string[];
  ingredientes_activos: string[];
  vendedores: Vendedor[];
  zonas: string[];
  lineas_negocio: string[];
  centros_costo: string[];
}

const TAB_CONFIG = [
  { key: 'familias', label: 'Familias', icon: Layers },
  { key: 'sub_familias', label: 'Sub-Familias', icon: GitBranch },
  { key: 'ingredientes_activos', label: 'Ingredientes Activos', icon: FlaskConical },
  { key: 'vendedores', label: 'Vendedores', icon: UserCheck },
  { key: 'zonas', label: 'Zonas', icon: MapPin },
  { key: 'lineas_negocio', label: 'Lineas de Negocio', icon: Briefcase },
] as const;

type TabKey = (typeof TAB_CONFIG)[number]['key'];

export default function Diccionario() {
  const [data, setData] = useState<DiccionarioData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>('familias');
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const res = await api.get('/diccionario');
      setData(res.data.data ?? res.data);
    } catch (err) {
      console.error('Error loading diccionario:', err);
    } finally {
      setLoading(false);
    }
  }

  // Filtered data based on search
  const filtered = useMemo(() => {
    if (!data) return null;
    const q = search.toLowerCase().trim();
    if (!q) return data;

    return {
      familias: data.familias.filter((f) => f.toLowerCase().includes(q)),
      sub_familias: data.sub_familias.filter((f) => f.toLowerCase().includes(q)),
      ingredientes_activos: data.ingredientes_activos.filter((f) => f.toLowerCase().includes(q)),
      vendedores: data.vendedores.filter(
        (v) =>
          v.nombre.toLowerCase().includes(q) ||
          v.zona.toLowerCase().includes(q) ||
          v.equipo.toLowerCase().includes(q)
      ),
      zonas: data.zonas.filter((z) => z.toLowerCase().includes(q)),
      lineas_negocio: data.lineas_negocio.filter((l) => l.toLowerCase().includes(q)),
      centros_costo: data.centros_costo.filter((c) => c.toLowerCase().includes(q)),
    };
  }, [data, search]);

  function getCount(key: TabKey): number {
    if (!filtered) return 0;
    const val = filtered[key];
    return Array.isArray(val) ? val.length : 0;
  }

  function getTotalCount(key: TabKey): number {
    if (!data) return 0;
    const val = data[key];
    return Array.isArray(val) ? val.length : 0;
  }

  if (loading) {
    return (
      <div className="min-h-screen">
        <Header title="Diccionario" subtitle="Datos de referencia del sistema" />
        <div className="flex items-center justify-center h-96">
          <div className="w-12 h-12 border-4 border-brand-200 border-t-brand-500 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header title="Diccionario" subtitle="Datos de referencia del sistema" />

      <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4 sm:space-y-6">
        {/* Title card with icon and global search */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900">Catalogo de Referencia</h3>
              <p className="text-xs text-gray-500">
                Familias, vendedores, zonas y mas datos del sistema
              </p>
            </div>
          </div>

          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar en todo el diccionario..."
              className="input-field pl-10"
            />
          </div>
        </div>

        {/* Tabs - same style as Cartera.tsx */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-full overflow-x-auto">
          {TAB_CONFIG.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-1.5 px-3 sm:px-5 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap
                ${activeTab === key ? 'bg-white text-brand-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{label}</span>
              <span
                className={`ml-1 text-[10px] px-1.5 py-0.5 rounded-full font-bold
                  ${activeTab === key ? 'bg-brand-100 text-brand-700' : 'bg-gray-200 text-gray-500'}`}
              >
                {getCount(key)}
              </span>
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="animate-fade-in">
          {activeTab === 'vendedores' ? (
            <VendedoresTable
              vendedores={filtered?.vendedores ?? []}
              total={getTotalCount('vendedores')}
              search={search}
            />
          ) : (
            <SimpleListCard
              items={
                activeTab === 'familias'
                  ? filtered?.familias ?? []
                  : activeTab === 'sub_familias'
                  ? filtered?.sub_familias ?? []
                  : activeTab === 'ingredientes_activos'
                  ? filtered?.ingredientes_activos ?? []
                  : activeTab === 'zonas'
                  ? filtered?.zonas ?? []
                  : filtered?.lineas_negocio ?? []
              }
              total={getTotalCount(activeTab)}
              label={TAB_CONFIG.find((t) => t.key === activeTab)?.label ?? ''}
              search={search}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Simple list card for string arrays                                  */
/* ------------------------------------------------------------------ */

function SimpleListCard({
  items,
  total,
  label,
  search,
}: {
  items: string[];
  total: number;
  label: string;
  search: string;
}) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      {/* Card header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <Hash className="w-4 h-4 text-brand-500" />
          <h4 className="text-sm font-bold text-gray-900">{label}</h4>
        </div>
        <span className="text-xs text-gray-400">
          {search && items.length !== total
            ? `${items.length} de ${total} resultados`
            : `${total} registros`}
        </span>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400">
          <Search className="w-8 h-8 mb-3 text-gray-300" />
          <p className="text-sm font-medium">Sin resultados</p>
          <p className="text-xs mt-1">Intenta con otro termino de busqueda</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="table-modern">
            <thead>
              <tr>
                <th className="w-16">#</th>
                <th>Nombre</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={`${item}-${i}`}>
                  <td>
                    <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold bg-gray-100 text-gray-500">
                      {i + 1}
                    </span>
                  </td>
                  <td className="font-medium text-gray-800">{item}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Vendedores table with zone and team columns                         */
/* ------------------------------------------------------------------ */

function VendedoresTable({
  vendedores,
  total,
  search,
}: {
  vendedores: Vendedor[];
  total: number;
  search: string;
}) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      {/* Card header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <UserCheck className="w-4 h-4 text-brand-500" />
          <h4 className="text-sm font-bold text-gray-900">Vendedores</h4>
        </div>
        <span className="text-xs text-gray-400">
          {search && vendedores.length !== total
            ? `${vendedores.length} de ${total} resultados`
            : `${total} registros`}
        </span>
      </div>

      {vendedores.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400">
          <Search className="w-8 h-8 mb-3 text-gray-300" />
          <p className="text-sm font-medium">Sin resultados</p>
          <p className="text-xs mt-1">Intenta con otro termino de busqueda</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="table-modern">
            <thead>
              <tr>
                <th className="w-16">#</th>
                <th>Nombre</th>
                <th>Zona</th>
                <th>Equipo</th>
              </tr>
            </thead>
            <tbody>
              {vendedores.map((v, i) => (
                <tr key={`${v.nombre}-${i}`}>
                  <td>
                    <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold bg-gray-100 text-gray-500">
                      {i + 1}
                    </span>
                  </td>
                  <td className="font-semibold text-gray-800">{v.nombre}</td>
                  <td className="text-gray-500">{v.zona}</td>
                  <td>
                    <span className="badge-info">{v.equipo}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
