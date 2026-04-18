import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import Header from '../components/layout/Header';
import { usersApi, configApi } from '../services/api';
import {
  Users,
  Plus,
  Pencil,
  Trash2,
  Upload,
  Image,
  Check,
  X,
  Shield,
  Building2,
  Eye,
  EyeOff,
  Target,
  Calendar,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  Loader2,
  DollarSign,
  MapPin,
  UserCheck,
} from 'lucide-react';

interface UserRow {
  id: number;
  username: string;
  full_name: string;
  email: string | null;
  modules: string[];
  is_admin: boolean;
  is_active: boolean;
  last_login?: string | null;
}

const MODULE_GROUPS: { group: string; icon: any; modules: { code: string; label: string }[] }[] = [
  { group: 'Ventas', icon: Target, modules: [
    { code: 'dashboard_ventas', label: 'Dashboard' },
    { code: 'presupuesto', label: 'Presupuesto' },
    { code: 'avance_comercial', label: 'Avance Comercial' },
  ]},
  { group: 'Crédito', icon: DollarSign, modules: [
    { code: 'cartera', label: 'Cartera y Recaudo' },
    { code: 'estado_cuenta', label: 'Estado de Cuenta' },
  ]},
  { group: 'Logística', icon: Building2, modules: [
    { code: 'facturacion', label: 'Facturas Electrónicas' },
    { code: 'letras', label: 'Letras' },
  ]},
  { group: 'General', icon: UserCheck, modules: [
    { code: 'alertas', label: 'Alertas Operativas' },
    { code: 'diccionario', label: 'Diccionario' },
  ]},
];
const ALL_MODULE_CODES = MODULE_GROUPS.flatMap(g => g.modules.map(m => m.code));

interface BudgetYear {
  year: number;
  count: number;
  total: number;
  uploaded_at: string | null;
  zonas: number;
  rcs: number;
}

export default function Admin() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [activeTab, setActiveTab] = useState<'users' | 'logo' | 'presupuestos'>('users');
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [form, setForm] = useState({ username: '', password: '', full_name: '', email: '', modules: [] as string[] });
  const [showPassword, setShowPassword] = useState(false);
  const [pwdModal, setPwdModal] = useState<UserRow | null>(null);
  const [pwdValue, setPwdValue] = useState('');
  const [pwdMsg, setPwdMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Budget state
  const [budgetYears, setBudgetYears] = useState<BudgetYear[]>([]);
  const [budgetLoading, setBudgetLoading] = useState(false);
  const [budgetUploadYear, setBudgetUploadYear] = useState(new Date().getFullYear());
  const [budgetFile, setBudgetFile] = useState<File | null>(null);
  const [budgetUploading, setBudgetUploading] = useState(false);
  const [budgetMsg, setBudgetMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const budgetFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadData();
    loadBudgetYears();
  }, []);

  async function loadData() {
    try {
      const res = await usersApi.getAll();
      setUsers(res.data.data.users);
    } catch (err) {
      console.error('Error loading users:', err);
    }
  }

  function openCreate() {
    setEditingUser(null);
    setForm({ username: '', password: '', full_name: '', email: '', modules: [] });
    setShowForm(true);
  }

  function openEdit(user: UserRow) {
    setEditingUser(user);
    setForm({ username: user.username, password: '', full_name: user.full_name, email: user.email || '', modules: [...(user.modules || [])] });
    setShowForm(true);
  }

  function toggleModule(code: string) {
    setForm(f => ({
      ...f,
      modules: f.modules.includes(code) ? f.modules.filter(m => m !== code) : [...f.modules, code],
    }));
  }

  function toggleGroup(groupCodes: string[]) {
    const allSelected = groupCodes.every(c => form.modules.includes(c));
    setForm(f => ({
      ...f,
      modules: allSelected
        ? f.modules.filter(m => !groupCodes.includes(m))
        : Array.from(new Set([...f.modules, ...groupCodes])),
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (editingUser) {
        await usersApi.update(editingUser.id, {
          full_name: form.full_name,
          email: form.email,
          modules: form.modules,
        });
      } else {
        await usersApi.create({
          username: form.username.trim(),
          password: form.password,
          full_name: form.full_name,
          email: form.email || undefined,
          modules: form.modules,
        });
      }
      setShowForm(false);
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error al guardar');
    }
  }

  async function handleDelete(user: UserRow) {
    if (user.is_admin) return;
    if (!confirm(`¿Eliminar al usuario ${user.username}?`)) return;
    try {
      await usersApi.remove(user.id);
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error al eliminar');
    }
  }

  async function handleToggleActive(user: UserRow) {
    if (user.is_admin) return;
    try {
      await usersApi.setActive(user.id, !user.is_active);
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error al cambiar estado');
    }
  }

  function openPwd(user: UserRow) {
    setPwdModal(user);
    setPwdValue('');
    setPwdMsg(null);
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!pwdModal) return;
    if (pwdValue.length < 4) {
      setPwdMsg({ type: 'error', text: 'Mínimo 4 caracteres' });
      return;
    }
    try {
      await usersApi.changePassword(pwdModal.id, pwdValue);
      setPwdMsg({ type: 'success', text: 'Contraseña actualizada' });
      setTimeout(() => { setPwdModal(null); }, 1000);
    } catch (err: any) {
      setPwdMsg({ type: 'error', text: err.response?.data?.message || 'Error al actualizar' });
    }
  }

  function handleLogoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = () => setLogoPreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function handleLogoUpload() {
    if (!logoFile) return;
    setUploading(true);
    setUploadMsg('');
    try {
      await configApi.uploadLogo(logoFile);
      setUploadMsg('Logo actualizado correctamente');
      setLogoFile(null);
    } catch (err: any) {
      setUploadMsg(err.response?.data?.message || 'Error al subir logo');
    } finally {
      setUploading(false);
    }
  }

  // Budget functions
  async function loadBudgetYears() {
    setBudgetLoading(true);
    try {
      const token = localStorage.getItem('token');
      const yearsRes = await fetch('/api/budget/years', { headers: { Authorization: `Bearer ${token}` } });
      const yearsJson = await yearsRes.json();
      const years: number[] = yearsJson.data || [];

      const details: BudgetYear[] = [];
      for (const y of years) {
        const res = await fetch(`/api/budget/${y}/summary`, { headers: { Authorization: `Bearer ${token}` } });
        const json = await res.json();
        const d = json.data;
        details.push({
          year: y,
          count: 0,
          total: d.total || 0,
          uploaded_at: d.uploaded_at || null,
          zonas: d.by_zona?.length || 0,
          rcs: 0,
        });
        // Get entry count
        const entRes = await fetch(`/api/budget/${y}`, { headers: { Authorization: `Bearer ${token}` } });
        const entJson = await entRes.json();
        details[details.length - 1].count = entJson.data?.count || 0;
        details[details.length - 1].rcs = new Set((entJson.data?.entries || []).map((e: any) => e.rc)).size;
      }
      setBudgetYears(details);
    } catch (err) { console.error('Error loading budget years:', err); }
    finally { setBudgetLoading(false); }
  }

  async function handleBudgetUpload() {
    if (!budgetFile) return;
    setBudgetUploading(true);
    setBudgetMsg(null);
    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('file', budgetFile);
      formData.append('year', String(budgetUploadYear));

      const res = await fetch('/api/budget/upload-excel', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const json = await res.json();
      if (json.success) {
        setBudgetMsg({ type: 'success', text: `${json.message}. ${json.data.entries_count} registros, Total: $${(json.data.total_usd || 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}` });
        setBudgetFile(null);
        if (budgetFileRef.current) budgetFileRef.current.value = '';
        loadBudgetYears();
      } else {
        setBudgetMsg({ type: 'error', text: json.message || 'Error al cargar presupuesto' });
      }
    } catch (err: any) {
      setBudgetMsg({ type: 'error', text: err.message || 'Error de conexión' });
    } finally {
      setBudgetUploading(false);
    }
  }

  async function handleBudgetDelete(year: number) {
    if (!confirm(`¿Está seguro de eliminar el presupuesto ${year}?`)) return;
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/budget/${year}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.success) {
        setBudgetMsg({ type: 'success', text: `Presupuesto ${year} eliminado correctamente` });
        loadBudgetYears();
      } else {
        setBudgetMsg({ type: 'error', text: json.message });
      }
    } catch (err: any) {
      setBudgetMsg({ type: 'error', text: err.message });
    }
  }

  function formatBudgetDate(d: string | null): string {
    if (!d) return 'N/A';
    return new Date(d).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  const moduleLabel = (code: string) => {
    for (const g of MODULE_GROUPS) {
      const m = g.modules.find(x => x.code === code);
      if (m) return `${g.group} › ${m.label}`;
    }
    return code;
  };

  return (
    <div className="min-h-screen">
      <Header title="Administración" subtitle="Gestión de usuarios, roles y configuración del sistema" />

      <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit mb-8">
          <button
            onClick={() => setActiveTab('users')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all
              ${activeTab === 'users' ? 'bg-white text-brand-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <Users className="w-4 h-4" /> Usuarios y Accesos
          </button>
          <button
            onClick={() => setActiveTab('presupuestos')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all
              ${activeTab === 'presupuestos' ? 'bg-white text-brand-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <Target className="w-4 h-4" /> Presupuestos
          </button>
          <button
            onClick={() => setActiveTab('logo')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all
              ${activeTab === 'logo' ? 'bg-white text-brand-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <Image className="w-4 h-4" /> Logo Corporativo
          </button>
        </div>

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="animate-fade-in">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Mantenedor de Usuarios</h3>
                <p className="text-sm text-gray-500">{users.length} usuarios registrados</p>
              </div>
              <button onClick={openCreate} className="btn-primary">
                <Plus className="w-4 h-4" /> Nuevo Usuario
              </button>
            </div>

            {/* Users Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <table className="table-modern">
                <thead>
                  <tr>
                    <th>Usuario</th>
                    <th>Nombre Completo</th>
                    <th>Email</th>
                    <th>Accesos</th>
                    <th>Estado</th>
                    <th className="text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id}>
                      <td>
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${user.is_admin ? 'bg-gradient-to-br from-purple-400 to-purple-600' : 'bg-gradient-to-br from-brand-400 to-brand-600'}`}>
                            <span className="text-white text-xs font-bold">{user.full_name.charAt(0)}</span>
                          </div>
                          <span className="font-mono text-sm font-medium">{user.username}</span>
                        </div>
                      </td>
                      <td className="font-medium">{user.full_name}</td>
                      <td className="text-gray-500">{user.email || '—'}</td>
                      <td>
                        {user.is_admin ? (
                          <span className="badge bg-purple-50 text-purple-700"><Shield className="w-3 h-3 mr-1" />Acceso total</span>
                        ) : user.modules?.length ? (
                          <div className="flex flex-wrap gap-1 max-w-md">
                            {user.modules.map(m => (
                              <span key={m} className="badge bg-brand-50 text-brand-700 text-[11px]" title={moduleLabel(m)}>
                                {moduleLabel(m).split(' › ')[1] || m}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400 italic">Sin módulos</span>
                        )}
                      </td>
                      <td>
                        <button onClick={() => handleToggleActive(user)} disabled={user.is_admin} className={user.is_admin ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}>
                          {user.is_active ? <span className="badge-success">Activo</span> : <span className="badge-danger">Inactivo</span>}
                        </button>
                      </td>
                      <td>
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEdit(user)}
                            disabled={user.is_admin}
                            className={`p-2 rounded-lg transition-colors ${user.is_admin ? 'opacity-30 cursor-not-allowed' : 'hover:bg-gray-100'}`}
                            title={user.is_admin ? 'Admin no editable' : 'Editar accesos'}
                          >
                            <Pencil className="w-4 h-4 text-gray-500" />
                          </button>
                          <button
                            onClick={() => openPwd(user)}
                            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                            title="Cambiar contraseña"
                          >
                            <Shield className="w-4 h-4 text-brand-500" />
                          </button>
                          <button
                            onClick={() => handleDelete(user)}
                            disabled={user.is_admin}
                            className={`p-2 rounded-lg transition-colors ${user.is_admin ? 'opacity-30 cursor-not-allowed' : 'hover:bg-danger-50'}`}
                            title={user.is_admin ? 'Admin no eliminable' : 'Eliminar'}
                          >
                            <Trash2 className="w-4 h-4 text-danger-400" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Modal Create/Edit */}
            {showForm && createPortal(
              <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/40 backdrop-blur-sm overflow-y-auto p-4 sm:p-8">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-auto animate-fade-in max-h-[calc(100vh-4rem)] flex flex-col">
                  <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white rounded-t-2xl">
                    <h3 className="text-lg font-bold">{editingUser ? `Editar ${editingUser.username}` : 'Nuevo Usuario'}</h3>
                    <button onClick={() => setShowForm(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1">
                    {!editingUser && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-1.5">Usuario</label>
                          <input
                            value={form.username}
                            onChange={(e) => setForm({ ...form, username: e.target.value })}
                            placeholder="ej: dmartinez"
                            className="input-field"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-1.5">Contraseña</label>
                          <div className="relative">
                            <input
                              type={showPassword ? 'text' : 'password'}
                              value={form.password}
                              onChange={(e) => setForm({ ...form, password: e.target.value })}
                              className="input-field pr-12"
                              required
                              minLength={4}
                            />
                            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">
                              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Nombre Completo</label>
                        <input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className="input-field" required />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Email</label>
                        <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input-field" />
                      </div>
                    </div>

                    {/* Módulos */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-semibold text-gray-700">Accesos al sistema</label>
                        <div className="flex gap-2">
                          <button type="button" onClick={() => setForm(f => ({ ...f, modules: [...ALL_MODULE_CODES] }))} className="text-xs text-brand-600 hover:underline">Seleccionar todo</button>
                          <span className="text-gray-300">|</span>
                          <button type="button" onClick={() => setForm(f => ({ ...f, modules: [] }))} className="text-xs text-gray-500 hover:underline">Ninguno</button>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {MODULE_GROUPS.map(g => {
                          const groupCodes = g.modules.map(m => m.code);
                          const selected = groupCodes.filter(c => form.modules.includes(c)).length;
                          const all = selected === groupCodes.length;
                          const some = selected > 0 && !all;
                          return (
                            <div key={g.group} className="border border-gray-200 rounded-xl p-3">
                              <label className="flex items-center gap-2 mb-2 font-semibold text-sm text-gray-800 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={all}
                                  ref={el => { if (el) el.indeterminate = some; }}
                                  onChange={() => toggleGroup(groupCodes)}
                                  className="w-4 h-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                                />
                                <g.icon className="w-4 h-4 text-brand-500" />
                                {g.group}
                                <span className="text-xs text-gray-400 ml-auto">{selected}/{groupCodes.length}</span>
                              </label>
                              <div className="pl-6 space-y-1.5">
                                {g.modules.map(m => (
                                  <label key={m.code} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer hover:text-gray-900">
                                    <input
                                      type="checkbox"
                                      checked={form.modules.includes(m.code)}
                                      onChange={() => toggleModule(m.code)}
                                      className="w-4 h-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                                    />
                                    {m.label}
                                  </label>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="flex gap-3 pt-2">
                      <button type="button" onClick={() => setShowForm(false)} className="btn-secondary flex-1">Cancelar</button>
                      <button type="submit" className="btn-primary flex-1">
                        <Check className="w-4 h-4" /> {editingUser ? 'Guardar Cambios' : 'Crear Usuario'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            , document.body)}

            {/* Modal Cambiar Contraseña */}
            {pwdModal && createPortal(
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 animate-fade-in">
                  <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <h3 className="text-lg font-bold">Cambiar Contraseña</h3>
                    <button onClick={() => setPwdModal(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <form onSubmit={handleChangePassword} className="p-6 space-y-4">
                    <p className="text-sm text-gray-600">Usuario: <span className="font-mono font-semibold">{pwdModal.username}</span></p>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">Nueva contraseña</label>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={pwdValue}
                          onChange={(e) => setPwdValue(e.target.value)}
                          className="input-field pr-12"
                          required
                          minLength={4}
                          autoFocus
                        />
                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    {pwdMsg && (
                      <div className={`px-3 py-2 rounded-lg text-sm flex items-center gap-2 ${pwdMsg.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                        {pwdMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                        {pwdMsg.text}
                      </div>
                    )}
                    <div className="flex gap-3 pt-2">
                      <button type="button" onClick={() => setPwdModal(null)} className="btn-secondary flex-1">Cancelar</button>
                      <button type="submit" className="btn-primary flex-1"><Check className="w-4 h-4" /> Actualizar</button>
                    </div>
                  </form>
                </div>
              </div>
            , document.body)}
          </div>
        )}

        {/* Presupuestos Tab */}
        {activeTab === 'presupuestos' && (
          <div className="animate-fade-in space-y-6">
            {/* Upload Section */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center">
                  <Upload className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Cargar Presupuesto de Ventas</h3>
                  <p className="text-sm text-gray-500">Suba un archivo Excel con el presupuesto por año</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    <Calendar className="w-4 h-4 inline mr-1" />Año
                  </label>
                  <select
                    value={budgetUploadYear}
                    onChange={(e) => setBudgetUploadYear(parseInt(e.target.value))}
                    className="input-field"
                  >
                    {[2024, 2025, 2026, 2027, 2028].map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    <FileSpreadsheet className="w-4 h-4 inline mr-1" />Archivo Excel
                  </label>
                  <input
                    ref={budgetFileRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={(e) => setBudgetFile(e.target.files?.[0] || null)}
                    className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100 cursor-pointer border border-gray-200 rounded-lg"
                  />
                </div>
                <div>
                  <button
                    onClick={handleBudgetUpload}
                    disabled={!budgetFile || budgetUploading}
                    className="btn-primary w-full"
                  >
                    {budgetUploading ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Procesando...</>
                    ) : (
                      <><Upload className="w-4 h-4" /> Cargar Presupuesto</>
                    )}
                  </button>
                </div>
              </div>

              {/* Format guide */}
              <div className="mt-4 p-3 bg-blue-50 rounded-xl text-xs text-blue-700">
                <p className="font-semibold mb-1">Formato esperado del Excel:</p>
                <p>Columnas: <span className="font-mono bg-blue-100 px-1 rounded">Zona</span> | <span className="font-mono bg-blue-100 px-1 rounded">RC/Vendedor</span> | <span className="font-mono bg-blue-100 px-1 rounded">Ene</span> | <span className="font-mono bg-blue-100 px-1 rounded">Feb</span> | ... | <span className="font-mono bg-blue-100 px-1 rounded">Dic</span></p>
                <p className="mt-1 text-blue-500">Los valores deben ser montos en USD. Se procesan todas las hojas del archivo.</p>
              </div>

              {/* Messages */}
              {budgetMsg && (
                <div className={`mt-4 px-4 py-3 rounded-xl text-sm flex items-center gap-2 ${
                  budgetMsg.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
                }`}>
                  {budgetMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
                  {budgetMsg.text}
                </div>
              )}
            </div>

            {/* Loaded Budgets List */}
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-4">Presupuestos Cargados</h3>

              {budgetLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
                </div>
              ) : budgetYears.length === 0 ? (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
                  <Target className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No hay presupuestos cargados</p>
                  <p className="text-sm text-gray-400 mt-1">Suba un archivo Excel para comenzar</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {budgetYears.map((by) => (
                    <div key={by.year} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center">
                            <span className="text-white font-bold text-lg">{by.year}</span>
                          </div>
                          <div>
                            <h4 className="font-bold text-gray-900">Presupuesto {by.year}</h4>
                            <p className="text-xs text-gray-400">{formatBudgetDate(by.uploaded_at)}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleBudgetDelete(by.year)}
                          className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                          title="Eliminar presupuesto"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-gray-50 rounded-lg p-3">
                          <div className="flex items-center gap-1.5 mb-1">
                            <DollarSign className="w-3.5 h-3.5 text-brand-600" />
                            <span className="text-[10px] text-gray-500 uppercase font-medium">Total Anual</span>
                          </div>
                          <p className="text-sm font-bold text-gray-900">
                            ${(by.total || 0).toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          </p>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-3">
                          <div className="flex items-center gap-1.5 mb-1">
                            <FileSpreadsheet className="w-3.5 h-3.5 text-blue-600" />
                            <span className="text-[10px] text-gray-500 uppercase font-medium">Registros</span>
                          </div>
                          <p className="text-sm font-bold text-gray-900">{by.count.toLocaleString()}</p>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-3">
                          <div className="flex items-center gap-1.5 mb-1">
                            <MapPin className="w-3.5 h-3.5 text-purple-600" />
                            <span className="text-[10px] text-gray-500 uppercase font-medium">Zonas</span>
                          </div>
                          <p className="text-sm font-bold text-gray-900">{by.zonas}</p>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-3">
                          <div className="flex items-center gap-1.5 mb-1">
                            <UserCheck className="w-3.5 h-3.5 text-green-600" />
                            <span className="text-[10px] text-gray-500 uppercase font-medium">RCs</span>
                          </div>
                          <p className="text-sm font-bold text-gray-900">{by.rcs}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Logo Tab */}
        {activeTab === 'logo' && (
          <div className="animate-fade-in max-w-2xl">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Logo Corporativo</h3>
            <p className="text-sm text-gray-500 mb-6">
              Sube el logo de la empresa. Se mostrará en la barra lateral y en la pantalla de inicio de sesión.
            </p>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
              {/* Preview */}
              <div className="flex items-center gap-6 mb-8">
                <div className="w-28 h-28 rounded-2xl bg-gradient-to-br from-brand-950 to-brand-900 flex items-center justify-center overflow-hidden border-2 border-dashed border-brand-300">
                  {logoPreview ? (
                    <img src={logoPreview} alt="Preview" className="w-full h-full object-contain p-3" />
                  ) : (
                    <div className="text-center">
                      <Building2 className="w-10 h-10 text-brand-400 mx-auto mb-1" />
                      <p className="text-brand-400 text-[10px]">Sin logo</p>
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-1">Vista previa del logo</p>
                  <p className="text-xs text-gray-400">Formatos: PNG, JPG, SVG, WebP. Máximo 5MB.</p>
                  <p className="text-xs text-gray-400">Recomendado: imagen cuadrada, fondo transparente (PNG)</p>
                </div>
              </div>

              {/* Upload */}
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleLogoSelect} className="hidden" />

              <div className="flex gap-3">
                <button onClick={() => fileInputRef.current?.click()} className="btn-secondary">
                  <Upload className="w-4 h-4" /> Seleccionar imagen
                </button>
                {logoFile && (
                  <button onClick={handleLogoUpload} disabled={uploading} className="btn-primary">
                    {uploading ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Check className="w-4 h-4" />
                    )}
                    Guardar Logo
                  </button>
                )}
              </div>

              {uploadMsg && (
                <div className={`mt-4 px-4 py-3 rounded-xl text-sm ${
                  uploadMsg.includes('Error') ? 'bg-danger-50 text-danger-600' : 'bg-success-50 text-success-600'
                }`}>
                  {uploadMsg}
                </div>
              )}
            </div>

            {/* Preview on sidebar mock */}
            <div className="mt-8">
              <h4 className="text-sm font-semibold text-gray-700 mb-3">Vista previa en barra lateral</h4>
              <div className="w-72 bg-gradient-to-b from-brand-950 via-brand-900 to-brand-950 rounded-2xl p-5 shadow-2xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center overflow-hidden">
                    {logoPreview ? (
                      <img src={logoPreview} alt="Preview" className="w-full h-full object-contain p-1" />
                    ) : (
                      <Building2 className="w-6 h-6 text-accent-400" />
                    )}
                  </div>
                  <div>
                    <p className="text-white font-bold text-sm">Point Andina</p>
                    <p className="text-brand-300 text-[10px] tracking-widest uppercase">Intranet</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
