import { useEffect, useState } from 'react';
import { comexApi } from '../../services/api';

const MES_LABEL: Record<number, string> = {
  1: 'Enero', 2: 'Febrero', 3: 'Marzo', 4: 'Abril', 5: 'Mayo', 6: 'Junio',
  7: 'Julio', 8: 'Agosto', 9: 'Septiembre', 10: 'Octubre', 11: 'Noviembre', 12: 'Diciembre',
};

interface Props {
  year: number | undefined;
  month: number | undefined;
  onChange: (year: number | undefined, month: number | undefined) => void;
  allowAllYears?: boolean;
  className?: string;
}

/**
 * Filtro de periodo dinámico para módulos COMEX.
 * Carga años desde la BD (no hardcoded) y meses dependientes del año seleccionado.
 */
export default function ComexPeriodFilter({ year, month, onChange, allowAllYears = false, className = '' }: Props) {
  const [years, setYears] = useState<number[]>([]);
  const [months, setMonths] = useState<number[]>([]);

  useEffect(() => {
    comexApi.getYears().then((res: any) => {
      const list: number[] = res.data?.data || res.data || [];
      setYears(list);
      if (!year && list.length > 0 && !allowAllYears) {
        onChange(list[0], undefined);
      }
    }).catch(() => setYears([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!year) { setMonths([]); return; }
    comexApi.getMonths(year).then((res: any) => {
      const list: number[] = res.data?.data || res.data || [];
      setMonths(list);
    }).catch(() => setMonths([]));
  }, [year]);

  return (
    <div className={`flex flex-wrap gap-3 items-end ${className}`}>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Año</label>
        <select
          value={year ?? ''}
          onChange={(e) => onChange(e.target.value ? Number(e.target.value) : undefined, undefined)}
          className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
        >
          {allowAllYears && <option value="">Todos</option>}
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Mes</label>
        <select
          value={month ?? ''}
          onChange={(e) => onChange(year, e.target.value ? Number(e.target.value) : undefined)}
          disabled={!year}
          className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 disabled:bg-gray-100"
        >
          <option value="">Todos</option>
          {months.map(m => <option key={m} value={m}>{MES_LABEL[m] || m}</option>)}
        </select>
      </div>
    </div>
  );
}
