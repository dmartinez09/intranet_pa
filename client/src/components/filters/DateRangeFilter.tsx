import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';

const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const MONTHS_SHORT = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
];

interface DateRangeFilterProps {
  year: number;
  monthStart: number; // 1-12
  monthEnd: number;   // 1-12
  onYearChange: (year: number) => void;
  onMonthStartChange: (month: number) => void;
  onMonthEndChange: (month: number) => void;
}

export default function DateRangeFilter({
  year, monthStart, monthEnd,
  onYearChange, onMonthStartChange, onMonthEndChange,
}: DateRangeFilterProps) {
  return (
    <div className="space-y-3">
      <label className="block text-xs font-semibold text-gray-500 uppercase">Periodo</label>

      {/* Year selector */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => onYearChange(year - 1)}
          className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <ChevronLeft className="w-4 h-4 text-gray-500" />
        </button>
        <span className="text-sm font-bold text-gray-800 min-w-[50px] text-center">{year}</span>
        <button
          onClick={() => onYearChange(year + 1)}
          className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <ChevronRight className="w-4 h-4 text-gray-500" />
        </button>
      </div>

      {/* Month grid */}
      <div className="grid grid-cols-4 gap-1">
        {MONTHS_SHORT.map((m, i) => {
          const monthNum = i + 1;
          const inRange = monthNum >= monthStart && monthNum <= monthEnd;
          const isStart = monthNum === monthStart;
          const isEnd = monthNum === monthEnd;

          return (
            <button
              key={m}
              onClick={() => {
                if (monthNum <= monthEnd) {
                  onMonthStartChange(monthNum);
                }
                if (monthNum >= monthStart) {
                  onMonthEndChange(monthNum);
                }
                // Click on single month = set both
                if (monthNum !== monthStart && monthNum !== monthEnd) {
                  onMonthStartChange(monthNum);
                  onMonthEndChange(monthNum);
                }
              }}
              className={`py-1.5 px-1 rounded-lg text-xs font-medium transition-all
                ${isStart || isEnd
                  ? 'bg-brand-500 text-white shadow-sm'
                  : inRange
                    ? 'bg-brand-50 text-brand-700'
                    : 'text-gray-500 hover:bg-gray-100'
                }`}
            >
              {m}
            </button>
          );
        })}
      </div>

      {/* Quick selectors */}
      <div className="flex gap-1.5 flex-wrap">
        <QuickBtn label="Mes actual" onClick={() => { const m = new Date().getMonth() + 1; onMonthStartChange(m); onMonthEndChange(m); onYearChange(new Date().getFullYear()); }} />
        <QuickBtn label="Q1" onClick={() => { onMonthStartChange(1); onMonthEndChange(3); }} />
        <QuickBtn label="Q2" onClick={() => { onMonthStartChange(4); onMonthEndChange(6); }} />
        <QuickBtn label="Q3" onClick={() => { onMonthStartChange(7); onMonthEndChange(9); }} />
        <QuickBtn label="Q4" onClick={() => { onMonthStartChange(10); onMonthEndChange(12); }} />
        <QuickBtn label="Año" onClick={() => { onMonthStartChange(1); onMonthEndChange(12); }} />
      </div>

      <div className="flex items-center gap-2 text-xs text-gray-500">
        <Calendar className="w-3.5 h-3.5" />
        <span>{MONTHS[monthStart - 1]} — {MONTHS[monthEnd - 1]} {year}</span>
      </div>
    </div>
  );
}

function QuickBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-gray-100 text-gray-600
                 hover:bg-brand-50 hover:text-brand-700 transition-colors"
    >
      {label}
    </button>
  );
}
