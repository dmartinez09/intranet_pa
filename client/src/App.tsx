import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
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

function ProtectedRoute({ children, module }: { children: React.ReactNode; module?: string }) {
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
  if (module && !hasModule(module)) return <Navigate to="/" replace />;
  return <>{children}</>;
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

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/ventas/dashboard" replace /> : <Login />} />
      <Route
        element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }
      >
        {/* Ventas module — panoramic view with grupo filter */}
        <Route path="/" element={<Navigate to="/ventas/dashboard" replace />} />
        <Route path="/ventas/dashboard" element={<ProtectedRoute module="dashboard_ventas"><DashboardVentas /></ProtectedRoute>} />
        <Route path="/ventas/presupuesto" element={<ProtectedRoute module="dashboard_ventas"><Suspense fallback={LazyFallback}><Presupuesto /></Suspense></ProtectedRoute>} />
        <Route path="/ventas/avance-comercial" element={<ProtectedRoute module="dashboard_ventas"><Suspense fallback={LazyFallback}><AvanceComercial /></Suspense></ProtectedRoute>} />
        <Route path="/ventas/margenes-zona" element={<ProtectedRoute module="dashboard_ventas"><Suspense fallback={LazyFallback}><VentasMargenesZona /></Suspense></ProtectedRoute>} />

        {/* Venta RC module — parameterized by grupo */}
        <Route path="/venta-rc/:grupo/dashboard" element={<ProtectedRoute module="venta_rc"><DashboardVentaRC /></ProtectedRoute>} />
        <Route path="/venta-rc/:grupo/presupuesto" element={<ProtectedRoute module="venta_rc"><Suspense fallback={LazyFallback}><PresupuestoRC /></Suspense></ProtectedRoute>} />
        <Route path="/venta-rc/:grupo/avance-comercial" element={<ProtectedRoute module="venta_rc"><Suspense fallback={LazyFallback}><AvanceComercialRC /></Suspense></ProtectedRoute>} />

        {/* Legacy redirects for old flat routes */}
        <Route path="/venta-rc/dashboard" element={<Navigate to="/venta-rc/agroindustrias/dashboard" replace />} />
        <Route path="/venta-rc/presupuesto" element={<Navigate to="/venta-rc/agroindustrias/presupuesto" replace />} />
        <Route path="/venta-rc/avance-comercial" element={<Navigate to="/venta-rc/agroindustrias/avance-comercial" replace />} />

        {/* Credito y Cobranzas module */}
        <Route path="/credito/cartera" element={<ProtectedRoute module="cartera"><Cartera /></ProtectedRoute>} />
        <Route path="/credito/estado-cuenta" element={<ProtectedRoute module="cartera"><EstadoCuenta /></ProtectedRoute>} />

        {/* Logistica module */}
        <Route path="/logistica/comprobantes" element={<ProtectedRoute module="dashboard_ventas"><Facturacion /></ProtectedRoute>} />
        <Route path="/logistica/letras" element={<ProtectedRoute module="dashboard_ventas"><Suspense fallback={LazyFallback}><Letras /></Suspense></ProtectedRoute>} />

        {/* Standalone */}
        <Route path="/alertas" element={<ProtectedRoute module="alertas"><Alertas /></ProtectedRoute>} />
        <Route path="/diccionario" element={<ProtectedRoute module="dashboard_ventas"><Diccionario /></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute module="admin"><Admin /></ProtectedRoute>} />

        {/* Legacy redirects */}
        <Route path="/cartera" element={<Navigate to="/credito/cartera" replace />} />
        <Route path="/cartera/estado-cuenta" element={<Navigate to="/credito/estado-cuenta" replace />} />
        <Route path="/facturacion" element={<Navigate to="/logistica/comprobantes" replace />} />
      </Route>
      <Route path="*" element={<Navigate to="/ventas/dashboard" replace />} />
    </Routes>
  );
}
