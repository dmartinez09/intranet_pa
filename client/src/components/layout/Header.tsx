import { Bell } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface HeaderProps {
  title: string;
  subtitle?: string;
  disclaimer?: string;     // texto en rojo al lado del título
}

export default function Header({ title, subtitle, disclaimer }: HeaderProps) {
  const { user } = useAuth();

  return (
    <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-gray-100">
      <div className="flex items-center justify-between px-4 sm:px-6 lg:px-8 py-3 sm:py-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h2 className="text-lg sm:text-2xl font-bold text-gray-900 truncate">{title}</h2>
            {disclaimer && (
              <span
                className="inline-flex items-center gap-1 text-[10px] sm:text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-full px-2.5 py-1 leading-tight"
                title={disclaimer}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                Disclaimer: {disclaimer}
              </span>
            )}
          </div>
          {subtitle && <p className="text-xs sm:text-sm text-gray-500 mt-0.5 truncate">{subtitle}</p>}
        </div>

        <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
          {/* Notifications */}
          <button className="relative p-2 sm:p-2.5 rounded-xl hover:bg-gray-100 transition-colors">
            <Bell className="w-5 h-5 text-gray-600" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-danger-500 rounded-full" />
          </button>

          {/* User Avatar */}
          <div className="flex items-center gap-3 pl-2 sm:pl-4 border-l border-gray-200">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center">
              <span className="text-white text-xs sm:text-sm font-bold">
                {user?.full_name?.charAt(0).toUpperCase() || 'U'}
              </span>
            </div>
            <div className="hidden lg:block">
              <p className="text-sm font-semibold text-gray-800">{user?.full_name}</p>
              <p className="text-xs text-gray-500">{user?.is_admin ? 'Administrador' : 'Usuario'}</p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
