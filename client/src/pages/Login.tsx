import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Building2, Eye, EyeOff, Lock, User, AlertCircle } from 'lucide-react';
import { configApi } from '../services/api';

export default function Login() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [logoError, setLogoError] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username, password);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Brand */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-gradient-to-br from-brand-900 via-brand-800 to-brand-950 overflow-hidden">
        {/* Decorative circles */}
        <div className="absolute top-20 -left-20 w-80 h-80 bg-brand-700/20 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-accent-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-brand-600/15 rounded-full blur-2xl" />

        <div className="relative z-10 flex flex-col items-center justify-center w-full px-16">
          <div className="w-24 h-24 rounded-3xl bg-white/10 backdrop-blur-sm flex items-center justify-center mb-8 shadow-2xl">
            {!logoError ? (
              <img
                src={configApi.getLogo()}
                alt="Logo"
                className="w-full h-full object-contain p-3"
                onError={() => setLogoError(true)}
              />
            ) : (
              <Building2 className="w-12 h-12 text-accent-400" />
            )}
          </div>
          <h1 className="text-5xl font-extrabold text-white mb-3 tracking-tight">Point Andina</h1>
          <p className="text-brand-200 text-lg font-light tracking-widest uppercase mb-12">Intranet Corporativa</p>

          <div className="grid grid-cols-2 gap-6 max-w-sm w-full">
            {[
              { value: 'Ventas', label: 'Dashboard' },
              { value: 'Cartera', label: 'Recaudo' },
              { value: 'Alertas', label: 'Operativas' },
              { value: 'Control', label: 'Acceso' },
            ].map((item) => (
              <div key={item.label} className="bg-white/5 backdrop-blur rounded-2xl p-4 border border-white/10">
                <p className="text-white font-bold text-lg">{item.value}</p>
                <p className="text-brand-300 text-xs">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center px-8 py-12 bg-slate-50">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden flex flex-col items-center mb-10">
            <div className="w-16 h-16 rounded-2xl bg-brand-900 flex items-center justify-center mb-4">
              <Building2 className="w-8 h-8 text-accent-400" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Point Andina</h1>
          </div>

          <div className="mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Bienvenido</h2>
            <p className="text-gray-500">Ingresa tus credenciales para acceder al sistema</p>
          </div>

          {error && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-danger-50 border border-danger-100 mb-6 animate-fade-in">
              <AlertCircle className="w-5 h-5 text-danger-500 flex-shrink-0" />
              <p className="text-danger-600 text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Usuario</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="ej: dmartinez"
                  className="input-field pl-12"
                  required
                  autoFocus
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Contraseña</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Ingrese su contraseña"
                  className="input-field pl-12 pr-12"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !username || !password}
              className="btn-primary w-full h-12 text-base mt-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                'Iniciar sesión'
              )}
            </button>
          </form>

          <p className="text-center text-xs text-gray-400 mt-10">
            Point Andina &copy; {new Date().getFullYear()} &mdash; Todos los derechos reservados
          </p>
        </div>
      </div>
    </div>
  );
}
