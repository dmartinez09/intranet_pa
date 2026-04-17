import { useState, useRef, useEffect } from 'react';
import { ChevronDown, X, Check, Search } from 'lucide-react';

interface Option {
  value: string;
  label: string;
}

interface MultiSelectProps {
  label: string;
  options: Option[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
}

export default function MultiSelect({ label, options, selected, onChange, placeholder = 'Todos' }: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filtered = options.filter((o) =>
    o.label.toLowerCase().includes(search.toLowerCase())
  );

  function toggle(value: string) {
    if (selected.includes(value)) {
      onChange(selected.filter((s) => s !== value));
    } else {
      onChange([...selected, value]);
    }
  }

  function selectAll() {
    onChange(options.map((o) => o.value));
  }

  function clearAll() {
    onChange([]);
  }

  return (
    <div ref={containerRef} className="multi-select-container">
      <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase">{label}</label>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="multi-select-trigger w-full"
      >
        <span className={`truncate ${selected.length === 0 ? 'text-gray-400' : 'text-gray-800'}`}>
          {selected.length === 0
            ? placeholder
            : selected.length === 1
              ? options.find((o) => o.value === selected[0])?.label || selected[0]
              : `${selected.length} seleccionados`}
        </span>
        <div className="flex items-center gap-1">
          {selected.length > 0 && (
            <span
              onClick={(e) => { e.stopPropagation(); clearAll(); }}
              className="w-5 h-5 rounded-full bg-gray-100 hover:bg-danger-50 flex items-center justify-center"
            >
              <X className="w-3 h-3 text-gray-400 hover:text-danger-500" />
            </span>
          )}
          <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {open && (
        <div className="multi-select-dropdown animate-fade-in">
          {/* Search */}
          {options.length > 6 && (
            <div className="relative mb-2">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar..."
                className="w-full h-8 pl-8 pr-3 text-xs rounded-lg border border-gray-100 bg-gray-50
                           focus:outline-none focus:border-brand-400"
                autoFocus
              />
            </div>
          )}

          {/* Select all / Clear */}
          <div className="flex items-center justify-between px-2 py-1.5 mb-1 border-b border-gray-100">
            <button onClick={selectAll} className="text-[11px] font-medium text-brand-600 hover:text-brand-700">
              Seleccionar todo
            </button>
            <button onClick={clearAll} className="text-[11px] font-medium text-gray-400 hover:text-danger-500">
              Limpiar
            </button>
          </div>

          {/* Options */}
          {filtered.map((option) => {
            const isSelected = selected.includes(option.value);
            return (
              <button
                type="button"
                key={option.value}
                onClick={() => toggle(option.value)}
                className="multi-select-option w-full"
              >
                <div className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors
                  ${isSelected
                    ? 'bg-brand-500 border-brand-500'
                    : 'border-gray-300 bg-white hover:border-brand-400'}`}
                >
                  {isSelected && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                </div>
                <span className={`truncate text-left ${isSelected ? 'font-medium text-gray-900' : 'text-gray-600'}`}>
                  {option.label}
                </span>
              </button>
            );
          })}

          {filtered.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-3">Sin resultados</p>
          )}
        </div>
      )}
    </div>
  );
}
