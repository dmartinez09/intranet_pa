import { Routes, Route, Navigate, useParams } from 'react-router-dom';
import { useAuth, type AuthUser } from './context/AuthContext';
import MainLayout from './components/layout/MainLayout';
import Login from './pages/Login';
import DashboardVentas from './pages/DashboardVentas';
import Cartera from './pages/Cartera';
import Alertas from './pages/Alertas';
import Admin from './pages/Admin';
import Diccionario from './pages/Diccionario';
import Facturacion from './pages/Facturacion';
import EstadoCuenta from './pages/EstadoCuenta';
// Lazy-load new pages (will create these next)
import { lazy, Suspense } from 'react';
const Presupuesto = lazy(() => import('./pages/Presupuesto'));
const AvanceComercial = lazy(() => import('./pages/AvanceComercial'));
const Letras = lazy(() => import('./pages/Letras'));
// Venta RC
import DashboardVentaRC from './pages/DashboardVentaRC';
const PresupuestoRC = lazy(() => import('./pages/PresupuestoRC'));
const AvanceComercialRC = lazy(() => import('./pages/AvanceComercialRC'));
const VentasMargenesZona = lazy(() => import('./pages/VentasMargenesZona'));
// Inteligencia Comercial Beta
const InteligenciaComercial = lazy(() => import('./pages/InteligenciaComercial'));
const MapaInteractivo = lazy(() => import('./pages/MapaInteractivo'));
// COMEX y Competidores
const DashboardCOMEX = lazy(() => import('./pages/DashboardCOMEX'));
const PartidasArancelarias = lazy(() => import('./pages/PartidasArancelarias'));
const Competidores = lazy(() => import('./pages/Competidores'));
const MapaFlujosCOMEX = lazy(() => import('./pages/MapaFlujosCOMEX'));

// Map: module access → landing route. Order defines priority.
const MODULE_ROUTES: Array<{ module: string; path: string }> = [
  { module: 'dashboard_ventas', path: '/ventas/dashboard' },
  { module: 'venta_rc', path: '/venta-rc/agroindustrias/dashboard' },
  { module: 'venta_rc_agro', path: '/venta-rc/agroindustrias/dashboard' },
  { module: 'venta_rc_sierra_selva', path: '/venta-rc/sierra-selva/dashboard' },
  { module: 'venta_rc_costa', path: '/venta-rc/costa/dashboard' },
  { module: 'venta_rc_online', path: '/venta-rc/online/dashboard' },
  { module: 'cartera', path: '/credito/cartera' },
  { module: 'facturacion', path: '/logistica/comprobantes' },
  { module: 'letras', path: '/logistica/letras' },
  { module: 'alertas', path: '/alertas' },
  { module: 'inteligencia_comercial', path: '/inteligencia/dashboard' },
  { module: 'mapa_interactivo', path: '/inteligencia/mapa' },
  { module: 'comex', path: '/inteligencia/comex/dashboard' },
];

// Mapping grupo URL → venta_rc submódulo granular
const VENTA_RC_GRUPO_MODULE: Record<string, string> = {
  agroindustrias: 'venta_rc_agro',
  'sierra-selva': 'venta_rc_sierra_selva',
  costa: 'venta_rc_costa',
  online: 'venta_rc_online',
};

function getDefaultRoute(user: AuthUser | null): string {
  if (!user) return '/login';
  if (user.is_admin) return '/ventas/dashboard';
  const mods = user.modules || [];
  const match = MODULE_ROUTES.find((r) => mods.includes(r.module));
  return match ? match.path : '/sin-acceso';
}

function SinAcceso() {
  const { user, logout } = useAuth();
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="max-w-md bg-white rounded-lg shadow-md p-8 text-center">
        <h1 className="text-2xl font-bold text-brand-700 mb-2">Sin accesos asignados</h1>
        <p className="text-gray-600 mb-6">
          Hola {user?.full_name || user?.username}, tu cuenta no tiene módulos asignados aún. Contacta a un administrador para que te otorgue acceso.
        </p>
        <button onClick={logout} className="btn-primary">Cerrar sesión</button>
      </div>
    </div>
  );
}

function ProtectedRoute({ children, module, anyOf }: { children: React.ReactNode; module?: string; anyOf?: string[] }) {
  const { user, loading, hasModule } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
          <p className="text-gray-500 text-sm font-medium">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (module && !hasModule(module)) return <Navigate to={getDefaultRoute(user)} replace />;
  if (anyOf && anyOf.length > 0 && !anyOf.some((m) => hasModule(m))) return <Navigate to={getDefaultRoute(user)} replace />;
  return <>{children}</>;
}

// Guard wrapper for venta_rc grupo routes: permite umbrella `venta_rc` o el sub-módulo del grupo
function VentaRCGrupoRoute({ children }: { children: React.ReactNode }) {
  const { grupo } = useParams<{ grupo: string }>();
  const grupoMod = grupo ? VENTA_RC_GRUPO_MODULE[grupo] : undefined;
  const mods = grupoMod ? ['venta_rc', grupoMod] : ['venta_rc'];
  return <ProtectedRoute anyOf={mods}>{children}</ProtectedRoute>;
}

const LazyFallback = (
  <div className="flex items-center justify-center h-96">
    <div className="w-8 h-8 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
  </div>
);

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-12 h-12 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
      </div>
    );
  }

  const defaultRoute = getDefaultRoute(user);

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to={defaultRoute} replace /> : <Login />} />
      <Route path="/sin-acceso" element={user ? <SinAcceso /> : <Navigate to="/login" replace />} />
      <Route
        element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }
      >
        {/* Ventas module — panoramic view with grupo filter */}
        <Route path="/" element={<Navigate to={defaultRoute} replace />} />
        <Route path="/ventas/dashboard" element={<ProtectedRoute module="dashboard_ventas"><DashboardVentas /></ProtectedRoute>} />
        <Route path="/ventas/presupuesto" element={<ProtectedRoute module="dashboard_ventas"><Suspense fallback={LazyFallback}><Presupuesto /></Suspense></ProtectedRoute>} />
        <Route path="/ventas/avance-comercial" element={<ProtectedRoute module="dashboard_ventas"><Suspense fallback={LazyFallback}><AvanceComercial /></Suspense></ProtectedRoute>} />
        <Route path="/ventas/margenes-zona" element={<ProtectedRoute module="dashboard_ventas"><Suspense fallback={LazyFallback}><VentasMargenesZona /></Suspense></ProtectedRoute>} />

        {/* Venta RC module — parameterized by grupo */}
        <Route path="/venta-rc/:grupo/dashboard" element={<VentaRCGrupoRoute><DashboardVentaRC /></VentaRCGrupoRoute>} />
        <Route path="/venta-rc/:grupo/presupuesto" element={<VentaRCGrupoRoute><Suspense fallback={LazyFallback}><PresupuestoRC /></Suspense></VentaRCGrupoRoute>} />
        <Route path="/venta-rc/:grupo/avance-comercial" element={<VentaRCGrupoRoute><Suspense fallback={LazyFallback}><AvanceComercialRC /></Suspense></VentaRCGrupoRoute>} />

        {/* Legacy redirects for old flat routes */}
        <Route path="/venta-rc/dashboard" element={<Navigate to="/venta-rc/agroindustrias/dashboard" replace />} />
        <Route path="/venta-rc/presupuesto" element={<Navigate to="/venta-rc/agroindustrias/presupuesto" replace />} />
        <Route path="/venta-rc/avance-comercial" element={<Navigate to="/venta-rc/agroindustrias/avance-comercial" replace />} />

        {/* Credito y Cobranzas module */}
        <Route path="/credito/cartera" element={<ProtectedRoute module="cartera"><Cartera /></ProtectedRoute>} />
        <Route path="/credito/estado-cuenta" element={<ProtectedRoute module="cartera"><EstadoCuenta /></ProtectedRoute>} />

        {/* Logistica module */}
        <Route path="/logistica/comprobantes" element={<ProtectedRoute module="facturacion"><Facturacion /></ProtectedRoute>} />
        <Route path="/logistica/letras" element={<ProtectedRoute module="letras"><Suspense fallback={LazyFallback}><Letras /></Suspense></ProtectedRoute>} />

        {/* Standalone */}
        <Route path="/alertas" element={<ProtectedRoute module="alertas"><Alertas /></ProtectedRoute>} />
        <Route path="/diccionario" element={<ProtectedRoute module="diccionario"><Diccionario /></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute module="admin"><Admin /></ProtectedRoute>} />

        {/* Inteligencia Comercial Beta */}
        <Route path="/inteligencia/dashboard" element={<ProtectedRoute module="inteligencia_comercial"><Suspense fallback={LazyFallback}><InteligenciaComercial /></Suspense></ProtectedRoute>} />
        <Route path="/inteligencia/mapa" element={<ProtectedRoute module="mapa_interactivo"><Suspense fallback={LazyFallback}><MapaInteractivo /></Suspense></ProtectedRoute>} />

        {/* COMEX y Competidores */}
        <Route path="/inteligencia/comex/dashboard" element={<ProtectedRoute module="comex"><Suspense fallback={LazyFallback}><DashboardCOMEX /></Suspense></ProtectedRoute>} />
        <Route path="/inteligencia/comex/partidas" element={<ProtectedRoute module="comex"><Suspense fallback={LazyFallback}><PartidasArancelarias /></Suspense></ProtectedRoute>} />
        <Route path="/inteligencia/comex/competidores" element={<ProtectedRoute module="comex"><Suspense fallback={LazyFallback}><Competidores /></Suspense></ProtectedRoute>} />
        <Route path="/inteligencia/comex/mapa-flujos" element={<ProtectedRoute module="comex"><Suspense fallback={LazyFallback}><MapaFlujosCOMEX /></Suspense></ProtectedRoute>} />

        {/* Legacy redirects */}
        <Route path="/cartera" element={<Navigate to="/credito/cartera" replace />} />
        <Route path="/cartera/estado-cuenta" element={<Navigate to="/credito/estado-cuenta" replace />} />
        <Route path="/facturacion" element={<Navigate to="/logistica/comprobantes" replace />} />
      </Route>
      <Route path="*" element={<Navigate to={defaultRoute} replace />} />
    </Routes>
  );
}
