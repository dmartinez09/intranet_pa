import { useState, useEffect, useRef } from 'react';
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
  email: string;
  role_id: number;
  active: boolean;
}

interface Role {
  id: number;
  name: string;
  description: string;
}

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
  const [roles, setRoles] = useState<Role[]>([]);
  const [activeTab, setActiveTab] = useState<'users' | 'logo' | 'presupuestos'>('users');
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [form, setForm] = useState({ username: '', password: '', full_name: '', email: '', role_id: 1 });
  const [showPassword, setShowPassword] = useState(false);
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
      setRoles(res.data.data.roles);
    } catch (err) {
      console.error('Error loading users:', err);
    }
  }

  function openCreate() {
    setEditingUser(null);
    setForm({ username: '', password: '', full_name: '', email: '', role_id: 1 });
    setShowForm(true);
  }

  function openEdit(user: UserRow) {
    setEditingUser(user);
    setForm({ username: user.username, password: '', full_name: user.full_name, email: user.email, role_id: user.role_id });
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (editingUser) {
        const data: any = { full_name: form.full_name, email: form.email, role_id: form.role_id };
        if (form.password) data.password = form.password;
        await usersApi.update(editingUser.id, data);
      } else {
        await usersApi.create(form);
      }
      setShowForm(false);
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error al guardar');
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('¿Está seguro de eliminar este usuario?')) return;
    try {
      await usersApi.remove(id);
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error al eliminar');
    }
  }

  async function handleToggleActive(user: UserRow) {
    try {
      await usersApi.update(user.id, { active: !user.active });
      loadData();
    } catch (err) {
      console.error('Error toggling user:', err);
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

  const getRoleName = (roleId: number) => roles.find((r) => r.id === roleId)?.name || 'N/A';

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
            <Users className="w-4 h-4" /> Usuarios y Roles
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
                    <th>Rol</th>
                    <th>Estado</th>
                    <th className="text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id}>
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center">
                            <span className="text-white text-xs font-bold">{user.full_name.charAt(0)}</span>
                          </div>
                          <span className="font-mono text-sm font-medium">{user.username}</span>
                        </div>
                      </td>
                      <td className="font-medium">{user.full_name}</td>
                      <td className="text-gray-500">{user.email}</td>
                      <td>
                        <span className={`badge ${
                          getRoleName(user.role_id) === 'Admin' ? 'bg-purple-50 text-purple-700' :
                          getRoleName(user.role_id) === 'Jefe de Venta' ? 'bg-brand-50 text-brand-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          <Shield className="w-3 h-3 mr-1" />
                          {getRoleName(user.role_id)}
                        </span>
                      </td>
                      <td>
                        <button onClick={() => handleToggleActive(user)} className="cursor-pointer">
                          {user.active ? (
                            <span className="badge-success">Activo</span>
                          ) : (
                            <span className="badge-danger">Inactivo</span>
                          )}
                        </button>
                      </td>
                      <td>
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => openEdit(user)} className="p-2 rounded-lg hover:bg-gray-100 transition-colors" title="Editar">
                            <Pencil className="w-4 h-4 text-gray-500" />
                          </button>
                          <button onClick={() => handleDelete(user.id)} className="p-2 rounded-lg hover:bg-danger-50 transition-colors" title="Eliminar">
                            <Trash2 className="w-4 h-4 text-danger-400" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Roles Info */}
            <div className="mt-8">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Roles del Sistema</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {roles.map((role) => (
                  <div key={role.id} className="kpi-card">
                    <div className="flex items-center gap-3 mb-2">
                      <Shield className="w-5 h-5 text-brand-500" />
                      <h4 className="font-bold text-gray-900">{role.name}</h4>
                    </div>
                    <p className="text-sm text-gray-500">{role.description}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Modal Form */}
            {showForm && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 animate-fade-in">
                  <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <h3 className="text-lg font-bold">{editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}</h3>
                    <button onClick={() => setShowForm(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {!editingUser && (
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Usuario</label>
                        <input
                          value={form.username}
                          onChange={(e) => setForm({ ...form, username: e.target.value })}
                          placeholder="ej: dmartinez"
                          className="input-field"
                          required
                        />
                        <p className="text-xs text-gray-400 mt-1">Formato: inicial del nombre + apellido</p>
                      </div>
                    )}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">Nombre Completo</label>
                      <input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className="input-field" required />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">Email</label>
                      <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input-field" required />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                        Contraseña {editingUser && <span className="text-gray-400 font-normal">(dejar vacío para no cambiar)</span>}
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={form.password}
                          onChange={(e) => setForm({ ...form, password: e.target.value })}
                          className="input-field pr-12"
                          required={!editingUser}
                        />
                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">Rol</label>
                      <select
                        value={form.role_id}
                        onChange={(e) => setForm({ ...form, role_id: parseInt(e.target.value) })}
                        className="input-field"
                      >
                        {roles.map((r) => (
                          <option key={r.id} value={r.id}>{r.name} — {r.description}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex gap-3 pt-4">
                      <button type="button" onClick={() => setShowForm(false)} className="btn-secondary flex-1">Cancelar</button>
                      <button type="submit" className="btn-primary flex-1">
                        <Check className="w-4 h-4" /> {editingUser ? 'Guardar Cambios' : 'Crear Usuario'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
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
