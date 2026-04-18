import { NavLink, useLocation } from 'react-router-dom';
import {
  BarChart3,
  LineChart,
  TrendingUp,
  Target,
  Wallet,
  ClipboardList,
  Bell,
  Shield,
  LogOut,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Building2,
  BookOpen,
  FileText,
  Package,
  X,
  CreditCard,
  Truck,
  FileCheck,
  ScrollText,
  Users,
  Store,
  Mountain,
  MapPin,
  Sprout,
  Map,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { configApi } from '../../services/api';
import { useState, useEffect } from 'react';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen?: boolean;
  isMobile?: boolean;
  onMobileClose?: () => void;
}

interface NavChild {
  to: string;
  icon: any;
  label: string;
  module?: string;
}

interface SubGroup {
  id: string;
  label: string;
  icon: any;
  children: NavChild[];
}

interface NavModule {
  id: string;
  icon: any;
  label: string;
  module: string; // permission module
  children?: NavChild[];
  subGroups?: SubGroup[];
}

const grupoChildren = (base: string): SubGroup[] => [
  {
    id: `${base}_agro`,
    label: 'Agroindustrias',
    icon: Store,
    children: [
      { to: `/${base}/agroindustrias/dashboard`, icon: TrendingUp, label: 'Dashboard' },
      { to: `/${base}/agroindustrias/presupuesto`, icon: Target, label: 'Presupuesto' },
      { to: `/${base}/agroindustrias/avance-comercial`, icon: Users, label: 'Avance Comercial' },
    ],
  },
  {
    id: `${base}_sierra`,
    label: 'Dist. Sierra / Selva',
    icon: Mountain,
    children: [
      { to: `/${base}/sierra-selva/dashboard`, icon: TrendingUp, label: 'Dashboard' },
      { to: `/${base}/sierra-selva/presupuesto`, icon: Target, label: 'Presupuesto' },
      { to: `/${base}/sierra-selva/avance-comercial`, icon: Users, label: 'Avance Comercial' },
    ],
  },
  {
    id: `${base}_costa`,
    label: 'Dist. Costa',
    icon: Truck,
    children: [
      { to: `/${base}/costa/dashboard`, icon: TrendingUp, label: 'Dashboard' },
      { to: `/${base}/costa/presupuesto`, icon: Target, label: 'Presupuesto' },
      { to: `/${base}/costa/avance-comercial`, icon: Users, label: 'Avance Comercial' },
    ],
  },
  {
    id: `${base}_online`,
    label: 'Online',
    icon: Package,
    children: [
      { to: `/${base}/online/dashboard`, icon: TrendingUp, label: 'Dashboard' },
      { to: `/${base}/online/presupuesto`, icon: Target, label: 'Presupuesto' },
      { to: `/${base}/online/avance-comercial`, icon: Users, label: 'Avance Comercial' },
    ],
  },
];

const navModules: NavModule[] = [
  {
    id: 'ventas',
    icon: BarChart3,
    label: 'Venta Gerencia',
    module: 'dashboard_ventas',
    children: [
      { to: '/ventas/dashboard', icon: TrendingUp, label: 'Dashboard', module: 'dashboard_ventas' },
      { to: '/ventas/presupuesto', icon: Target, label: 'Presupuesto', module: 'presupuesto' },
      { to: '/ventas/avance-comercial', icon: Users, label: 'Avance Comercial', module: 'avance_comercial' },
      { to: '/ventas/margenes-zona', icon: MapPin, label: 'Márgenes por Zona', module: 'dashboard_ventas' },
    ],
  },
  {
    id: 'venta_rc',
    icon: LineChart,
    label: 'Venta RC',
    module: '__admin_only__',
    subGroups: grupoChildren('venta-rc'),
  },
  {
    id: 'credito',
    icon: CreditCard,
    label: 'Crédito y Cobranzas',
    module: 'cartera',
    children: [
      { to: '/credito/cartera', icon: Wallet, label: 'Cartera y Recaudo', module: 'cartera' },
      { to: '/credito/estado-cuenta', icon: ClipboardList, label: 'Estado de Cuenta F. Corte', module: 'estado_cuenta' },
    ],
  },
  {
    id: 'logistica',
    icon: Truck,
    label: 'Logística',
    module: 'facturacion',
    children: [
      { to: '/logistica/comprobantes', icon: FileCheck, label: 'Facturas Electrónicas', module: 'facturacion' },
      { to: '/logistica/letras', icon: ScrollText, label: 'Letras', module: 'letras' },
    ],
  },
];

// Standalone items (no children)
const standaloneItems = [
  { to: '/alertas', icon: Bell, label: 'Alertas Operativas', module: 'alertas' },
  { to: '/diccionario', icon: BookOpen, label: 'Diccionario', module: 'diccionario' },
  { to: '/admin', icon: Shield, label: 'Administración', module: '__admin_only__' },
];

// Módulos que se muestran DESPUÉS de los standalones (debajo de Administración)
const afterAdminModules: NavModule[] = [
  {
    id: 'inteligencia',
    icon: Sprout,
    label: 'Inteligencia Comercial Beta',
    module: 'inteligencia_comercial',
    children: [
      { to: '/inteligencia/dashboard', icon: LineChart, label: 'Inteligencia Comercial', module: 'inteligencia_comercial' },
      { to: '/inteligencia/mapa', icon: Map, label: 'Mapa Interactivo', module: 'mapa_interactivo' },
    ],
  },
];

export default function Sidebar({ collapsed, onToggle, mobileOpen, isMobile, onMobileClose }: SidebarProps) {
  const { user, logout, hasModule, isAdmin } = useAuth();
  const canSee = (mod?: string) => {
    if (!mod) return true;
    if (mod === '__admin_only__') return isAdmin;
    return hasModule(mod);
  };
  const moduleVisible = (m: NavModule) => {
    if (isAdmin) return true;
    if (m.children) return m.children.some(c => canSee(c.module || m.module));
    return canSee(m.module);
  };
  const location = useLocation();
  const [logoError, setLogoError] = useState(false);
  const [logoKey, setLogoKey] = useState(0);
  const [openModules, setOpenModules] = useState<Set<string>>(new Set());

  useEffect(() => {
    setLogoError(false);
    setLogoKey((k) => k + 1);
  }, []);

  const getAllChildren = (mod: NavModule): NavChild[] => {
    if (mod.children) return mod.children;
    if (mod.subGroups) return mod.subGroups.flatMap((sg) => sg.children);
    return [];
  };

  // Auto-open the module and sub-group that matches the current route
  useEffect(() => {
    for (const mod of [...navModules, ...afterAdminModules]) {
      const allChildren = getAllChildren(mod);
      if (allChildren.some((c) => location.pathname.startsWith(c.to))) {
        setOpenModules((prev) => {
          const next = new Set(prev);
          next.add(mod.id);
          if (mod.subGroups) {
            for (const sg of mod.subGroups) {
              if (sg.children.some((c) => location.pathname.startsWith(c.to))) {
                next.add(sg.id);
              }
            }
          }
          return next;
        });
      }
    }
  }, [location.pathname]);

  const toggleModule = (id: string) => {
    setOpenModules((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const isModuleActive = (mod: NavModule) =>
    getAllChildren(mod).some((c) => location.pathname.startsWith(c.to));

  const showExpanded = !collapsed || isMobile;

  const sidebarClasses = isMobile
    ? `fixed left-0 top-0 h-screen z-50 flex flex-col w-72
       bg-gradient-to-b from-brand-950 via-brand-900 to-brand-950
       shadow-2xl shadow-brand-950/50
       transition-transform duration-300 ease-in-out
       ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`
    : `fixed left-0 top-0 h-screen z-40 flex flex-col transition-all duration-300 ease-in-out
       ${collapsed ? 'w-20' : 'w-72'}
       bg-gradient-to-b from-brand-950 via-brand-900 to-brand-950
       shadow-2xl shadow-brand-950/50`;

  return (
    <aside className={sidebarClasses}>
      {/* Logo / Brand */}
      <div className="flex items-center justify-between px-5 py-5 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="relative w-10 h-10 rounded-xl bg-white/10 backdrop-blur flex items-center justify-center overflow-hidden flex-shrink-0">
            {!logoError ? (
              <img
                key={logoKey}
                src={configApi.getLogo()}
                alt="Logo"
                className="w-full h-full object-contain p-1"
                onError={() => setLogoError(true)}
              />
            ) : (
              <Building2 className="w-6 h-6 text-accent-400" />
            )}
          </div>
          {showExpanded && (
            <div className="animate-fade-in">
              <h1 className="text-white font-bold text-lg leading-tight">Point Andina</h1>
              <p className="text-brand-300 text-[11px] font-medium tracking-wider uppercase">Intranet</p>
            </div>
          )}
        </div>
        {isMobile && (
          <button onClick={onMobileClose} className="p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/10">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10">
        {/* Module groups */}
        {navModules
          .filter(moduleVisible)
          .map((mod) => {
            const isOpen = openModules.has(mod.id);
            const isActive = isModuleActive(mod);

            return (
              <div key={mod.id}>
                {/* Module header */}
                <button
                  onClick={() => showExpanded ? toggleModule(mod.id) : undefined}
                  title={!showExpanded ? mod.label : undefined}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200
                    ${isActive
                      ? 'text-white bg-white/10'
                      : 'text-brand-200 hover:text-white hover:bg-white/5'}
                    ${!showExpanded ? 'justify-center px-0' : ''}`}
                >
                  <mod.icon className="w-5 h-5 flex-shrink-0" />
                  {showExpanded && (
                    <>
                      <span className="flex-1 text-left">{mod.label}</span>
                      <ChevronDown
                        className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                      />
                    </>
                  )}
                </button>

                {/* Sub-items (flat children) */}
                {showExpanded && isOpen && mod.children && (
                  <div className="mt-0.5 ml-4 pl-4 border-l border-white/10 space-y-0.5">
                    {mod.children.filter(c => canSee(c.module || mod.module)).map((child) => (
                      <NavLink
                        key={child.to}
                        to={child.to}
                        className={({ isActive }) =>
                          `flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] transition-all duration-200
                          ${isActive
                            ? 'text-white bg-brand-600/30 font-medium'
                            : 'text-brand-300 hover:text-white hover:bg-white/5'}`
                        }
                        onClick={() => isMobile && onMobileClose?.()}
                      >
                        <child.icon className="w-4 h-4 flex-shrink-0" />
                        <span>{child.label}</span>
                      </NavLink>
                    ))}
                  </div>
                )}

                {/* Sub-groups (2-level nesting) */}
                {showExpanded && isOpen && mod.subGroups && (
                  <div className="mt-0.5 ml-4 pl-3 border-l border-white/10 space-y-0.5">
                    {mod.subGroups.map((sg) => {
                      const sgOpen = openModules.has(sg.id);
                      const sgActive = sg.children.some((c) => location.pathname.startsWith(c.to));
                      return (
                        <div key={sg.id}>
                          <button
                            onClick={() => toggleModule(sg.id)}
                            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-200
                              ${sgActive
                                ? 'text-white bg-white/5'
                                : 'text-brand-300 hover:text-white hover:bg-white/5'}`}
                          >
                            <sg.icon className="w-4 h-4 flex-shrink-0" />
                            <span className="flex-1 text-left">{sg.label}</span>
                            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${sgOpen ? 'rotate-180' : ''}`} />
                          </button>
                          {sgOpen && (
                            <div className="mt-0.5 ml-3 pl-3 border-l border-white/5 space-y-0.5">
                              {sg.children.map((child) => (
                                <NavLink
                                  key={child.to}
                                  to={child.to}
                                  className={({ isActive }) =>
                                    `flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[12px] transition-all duration-200
                                    ${isActive
                                      ? 'text-white bg-brand-600/30 font-medium'
                                      : 'text-brand-300/80 hover:text-white hover:bg-white/5'}`
                                  }
                                  onClick={() => isMobile && onMobileClose?.()}
                                >
                                  <child.icon className="w-3.5 h-3.5 flex-shrink-0" />
                                  <span>{child.label}</span>
                                </NavLink>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

        {/* Divider */}
        <div className="my-3 border-t border-white/5" />

        {/* Standalone items */}
        {standaloneItems
          .filter((item) => canSee(item.module))
          .map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200
                ${isActive
                  ? 'text-white bg-white/10'
                  : 'text-brand-200 hover:text-white hover:bg-white/5'}
                ${!showExpanded ? 'justify-center px-0' : ''}`
              }
              title={!showExpanded ? item.label : undefined}
              onClick={() => isMobile && onMobileClose?.()}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {showExpanded && <span>{item.label}</span>}
            </NavLink>
          ))}

        {/* Módulos después de Administración (Inteligencia Comercial Beta) */}
        {afterAdminModules
          .filter(moduleVisible)
          .map((mod) => {
            const isOpen = openModules.has(mod.id);
            const isActive = isModuleActive(mod);
            return (
              <div key={mod.id} className="pt-1">
                <button
                  onClick={() => showExpanded ? toggleModule(mod.id) : undefined}
                  title={!showExpanded ? mod.label : undefined}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200
                    ${isActive
                      ? 'text-white bg-white/10'
                      : 'text-brand-200 hover:text-white hover:bg-white/5'}
                    ${!showExpanded ? 'justify-center px-0' : ''}`}
                >
                  <mod.icon className="w-5 h-5 flex-shrink-0" />
                  {showExpanded && (
                    <>
                      <span className="flex-1 text-left">{mod.label}</span>
                      <ChevronDown
                        className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                      />
                    </>
                  )}
                </button>
                {showExpanded && isOpen && mod.children && (
                  <div className="mt-0.5 ml-4 pl-4 border-l border-white/10 space-y-0.5">
                    {mod.children.filter(c => canSee(c.module || mod.module)).map((child) => (
                      <NavLink
                        key={child.to}
                        to={child.to}
                        className={({ isActive }) =>
                          `flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] transition-all duration-200
                          ${isActive
                            ? 'text-white bg-brand-600/30 font-medium'
                            : 'text-brand-300 hover:text-white hover:bg-white/5'}`
                        }
                        onClick={() => isMobile && onMobileClose?.()}
                      >
                        <child.icon className="w-4 h-4 flex-shrink-0" />
                        <span>{child.label}</span>
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
      </nav>

      {/* User & Logout */}
      <div className="px-3 py-4 border-t border-white/10">
        {showExpanded && user && (
          <div className="px-4 py-2 mb-2">
            <p className="text-white text-sm font-medium truncate">{user.full_name}</p>
            <p className="text-brand-400 text-xs truncate">{user.is_admin ? 'Administrador' : 'Usuario'}</p>
          </div>
        )}
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium
                     text-red-300 hover:text-red-200 hover:bg-red-500/10 transition-all duration-200"
          title={!showExpanded ? 'Cerrar sesión' : undefined}
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          {showExpanded && <span>Cerrar sesión</span>}
        </button>
      </div>

      {/* Desktop toggle */}
      {!isMobile && (
        <button
          onClick={onToggle}
          className="absolute -right-3 top-20 w-6 h-6 rounded-full bg-brand-600 text-white
                     flex items-center justify-center shadow-lg hover:bg-brand-500 transition-colors"
        >
          {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
        </button>
      )}
    </aside>
  );
}
