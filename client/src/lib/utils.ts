import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatUSD(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('es-PE').format(value);
}

export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

export function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('es-PE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/** Maps URL slug → BD grupo_cliente value */
export const GRUPO_SLUG_MAP: Record<string, { db: string; label: string }> = {
  agroindustrias: { db: 'AGROINDUSTRIAS', label: 'Agroindustrias' },
  'sierra-selva': { db: 'DIST. SIERRA / SELVA', label: 'Dist. Sierra / Selva' },
  costa: { db: 'DIST. COSTA', label: 'Dist. Costa' },
  online: { db: 'ONLINE', label: 'Online' },
};

export function getGrupoFromSlug(slug?: string) {
  const entry = slug ? GRUPO_SLUG_MAP[slug] : null;
  return entry || GRUPO_SLUG_MAP['agroindustrias'];
}
