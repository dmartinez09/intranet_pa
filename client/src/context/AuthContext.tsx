import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { authApi } from '../services/api';

interface AuthUser {
  id: number;
  username: string;
  full_name: string;
  email: string;
  role_id: number;
  active: boolean;
  role: { id: number; name: string; description: string };
  permissions: any[];
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  isAdmin: boolean;
  hasModule: (module: string) => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

const MODULE_MAP: Record<string, string[]> = {
  Admin: ['dashboard_ventas', 'cartera', 'alertas', 'admin', 'logistica', 'presupuesto', 'venta_rc'],
  'Jefe de Venta': ['dashboard_ventas', 'cartera', 'alertas', 'logistica', 'presupuesto', 'venta_rc'],
  Vendedor: ['dashboard_ventas', 'alertas', 'venta_rc'],
  Finanzas: ['dashboard_ventas', 'cartera', 'logistica', 'presupuesto', 'venta_rc'],
  Viewer: ['dashboard_ventas'],
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      authApi.me()
        .then((res) => setUser(res.data.data))
        .catch(() => { localStorage.removeItem('token'); setToken(null); })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [token]);

  const login = useCallback(async (username: string, password: string) => {
    const res = await authApi.login(username, password);
    const { token: newToken, user: newUser } = res.data.data;
    localStorage.setItem('token', newToken);
    setToken(newToken);
    setUser(newUser);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  }, []);

  const isAdmin = user?.role?.name === 'Admin';

  const hasModule = useCallback((module: string) => {
    if (!user) return false;
    const allowed = MODULE_MAP[user.role?.name] || [];
    return allowed.includes(module);
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, isAdmin, hasModule }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
