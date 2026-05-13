import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, X, Save, Users } from 'lucide-react';
import { maestroVendedoresApi } from '../../services/api';

interface MaestroVendedor {
  id: number;
  codigo_vendedor: number;
  vendedor: string;
  serie_documento: string;
  grupo: string;
  activo: boolean;
  updated_at: string;
}

type FormState = {
  id?: number;
  codigo_vendedor: string;
  vendedor: string;
  serie_documento: string;
  grupo: string;
  activo: boolean;
};

const emptyForm: FormState = { codigo_vendedor: '', vendedor: '', serie_documento: '', grupo: '', activo: true };

export default function MaestroVendedoresPanel() {
  const [rows, setRows] = useState<MaestroVendedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterGrupo, setFilterGrupo] = useState('');
  const [editing, setEditing] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const r = await maestroVendedoresApi.list();
      setRows(r.data.data);
      setError(null);
    } catch (e: any) {
      setError(e?.response?.data?.message || e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const grupos = Array.from(new Set(rows.map(r => r.grupo))).sort();
  const filtered = rows.filter(r => {
    if (filterGrupo && r.grupo !== filterGrupo) return false;
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      r.vendedor.toLowerCase().includes(s)
      || String(r.codigo_vendedor).includes(s)
      || r.serie_documento.toLowerCase().includes(s)
      || r.grupo.toLowerCase().includes(s)
    );
  });

  async function handleSave() {
    if (!editing) return;
    if (!editing.codigo_vendedor || !editing.vendedor.trim() || !editing.grupo.trim()) {
      alert('Código, Vendedor y Grupo son requeridos');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        codigo_vendedor: Number(editing.codigo_vendedor),
        vendedor: editing.vendedor.trim(),
        serie_documento: editing.serie_documento.trim(),
        grupo: editing.grupo.trim(),
        activo: editing.activo,
      };
      if (editing.id) {
        await maestroVendedoresApi.update(editing.id, payload);
      } else {
        await maestroVendedoresApi.create(payload);
      }
      setEditing(null);
      await load();
    } catch (e: any) {
      alert(e?.response?.data?.message || e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(row: MaestroVendedor) {
    if (!confirm(`¿Eliminar a "${row.vendedor}" (código ${row.codigo_vendedor})?`)) return;
    try {
      await maestroVendedoresApi.remove(row.id);
      await load();
    } catch (e: any) {
      alert(e?.response?.data?.message || e.message);
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-brand-600" />
              Maestro de Vendedores
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Cada vendedor está asociado a un grupo. Este maestro sobreescribe la columna <code className="text-xs bg-gray-100 px-1 rounded">Grupo_Cliente</code> que viene de SAP, para reflejar la venta real por equipo comercial en el Dashboard.
            </p>
          </div>
          <button
            onClick={() => setEditing({ ...emptyForm })}
            className="btn-primary flex items-center gap-2 whitespace-nowrap"
          >
            <Plus className="w-4 h-4" /> Nuevo vendedor
          </button>
        </div>

        <div className="flex gap-3 flex-wrap mb-4">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por código, nombre, serie o grupo…"
            className="input-field flex-1 min-w-[260px]"
          />
          <select
            value={filterGrupo}
            onChange={e => setFilterGrupo(e.target.value)}
            className="input-field min-w-[200px]"
          >
            <option value="">Todos los grupos</option>
            {grupos.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-3">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center py-10 text-gray-500">Cargando…</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-y border-gray-200">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600">Código</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600">Vendedor</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600">Serie</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600">Grupo (equivalente)</th>
                  <th className="px-3 py-2 text-center font-semibold text-gray-600">Activo</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-600">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-2 font-mono">{r.codigo_vendedor}</td>
                    <td className="px-3 py-2">{r.vendedor}</td>
                    <td className="px-3 py-2"><span className="text-xs bg-gray-100 rounded px-2 py-0.5">{r.serie_documento || '—'}</span></td>
                    <td className="px-3 py-2 font-medium text-brand-700">{r.grupo}</td>
                    <td className="px-3 py-2 text-center">
                      {r.activo
                        ? <span className="inline-flex items-center text-xs bg-green-100 text-green-700 rounded px-2 py-0.5">Activo</span>
                        : <span className="inline-flex items-center text-xs bg-gray-100 text-gray-500 rounded px-2 py-0.5">Inactivo</span>}
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <button
                        onClick={() => setEditing({
                          id: r.id,
                          codigo_vendedor: String(r.codigo_vendedor),
                          vendedor: r.vendedor,
                          serie_documento: r.serie_documento,
                          grupo: r.grupo,
                          activo: r.activo,
                        })}
                        className="p-1.5 rounded hover:bg-brand-50 text-brand-600"
                        title="Editar"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(r)}
                        className="p-1.5 rounded hover:bg-red-50 text-red-600 ml-1"
                        title="Eliminar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={6} className="text-center py-8 text-gray-500">Sin resultados.</td></tr>
                )}
              </tbody>
            </table>
            <div className="text-xs text-gray-500 pt-3">{filtered.length} de {rows.length} vendedores</div>
          </div>
        )}
      </div>

      {/* Modal */}
      {editing && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 w-full max-w-lg">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <h3 className="font-bold text-lg text-gray-900">
                {editing.id ? 'Editar vendedor' : 'Nuevo vendedor'}
              </h3>
              <button onClick={() => setEditing(null)} className="p-1 rounded hover:bg-gray-100">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Código Vendedor</label>
                <input
                  type="number"
                  value={editing.codigo_vendedor}
                  onChange={e => setEditing({ ...editing, codigo_vendedor: e.target.value })}
                  className="input-field w-full"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Vendedor</label>
                <input
                  value={editing.vendedor}
                  onChange={e => setEditing({ ...editing, vendedor: e.target.value })}
                  className="input-field w-full"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Serie de documento</label>
                <input
                  value={editing.serie_documento}
                  onChange={e => setEditing({ ...editing, serie_documento: e.target.value })}
                  placeholder="AGRO, COST, SISE, BIOS, ONL, DESA…"
                  className="input-field w-full"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Grupo (equivalente)</label>
                <input
                  value={editing.grupo}
                  onChange={e => setEditing({ ...editing, grupo: e.target.value })}
                  placeholder="AGROINDUSTRIAS, DIST. COSTA, DIST. SIERRA / SELVA…"
                  className="input-field w-full"
                  list="grupos-list"
                />
                <datalist id="grupos-list">
                  {grupos.map(g => <option key={g} value={g} />)}
                </datalist>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={editing.activo}
                  onChange={e => setEditing({ ...editing, activo: e.target.checked })}
                  className="rounded"
                />
                <span>Activo (incluido en dashboards)</span>
              </label>
            </div>
            <div className="flex justify-end gap-2 border-t border-gray-100 px-6 py-4">
              <button onClick={() => setEditing(null)} className="px-4 py-2 rounded-lg text-gray-600 hover:bg-gray-100 text-sm">
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="btn-primary flex items-center gap-2 disabled:opacity-60"
              >
                <Save className="w-4 h-4" /> {saving ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
