import { useState, useEffect } from 'react';
import { ScrollText, Search, Filter, ChevronDown, ChevronUp, Loader2, AlertCircle, Download } from 'lucide-react';

// Letras data will come from stg_estado_cuenta_jdt where TD = 'LT'
// This page reuses the cartera estado-cuenta backend with a TD filter

function formatDate(d: string | null): string {
  if (!d) return '';
  return new Date(d).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatNumber(n: number | null): string {
  if (n == null) return '';
  return n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const ESTADO_LABELS: Record<string, { label: string; color: string }> = {
  'LT': { label: 'Letra', color: 'bg-blue-100 text-blue-700' },
  'LT_R': { label: 'Renovada', color: 'bg-purple-100 text-purple-700' },
};

export default function Letras() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(true);
  const [cliente, setCliente] = useState('');
  const [vendedor, setVendedor] = useState('');
  const [moneda, setMoneda] = useState('');
  const [filtrosOpciones, setFiltrosOpciones] = useState<any>(null);
  const [page, setPage] = useState(0);
  const pageSize = 50;

  useEffect(() => {
    loadFiltros();
    loadData();
  }, []);

  async function loadFiltros() {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/cartera/estado-cuenta/filtros', { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      setFiltrosOpciones(json.data);
    } catch (err) { console.error(err); }
  }

  async function loadData() {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams();
      params.set('tipoDocumento', 'LT'); // Only letras
      if (cliente) params.set('cliente', cliente);
      if (vendedor) params.set('vendedor', vendedor);
      if (moneda) params.set('moneda', moneda);
      const res = await fetch(`/api/cartera/estado-cuenta?${params.toString()}`, { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      setData(json.data || []);
      setPage(0);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  async function handleExport() {
    const token = localStorage.getItem('token');
    const params = new URLSearchParams();
    params.set('tipoDocumento', 'LT');
    if (cliente) params.set('cliente', cliente);
    if (vendedor) params.set('vendedor', vendedor);
    if (moneda) params.set('moneda', moneda);
    const res = await fetch(`/api/cartera/estado-cuenta/export?${params.toString()}`, { headers: { Authorization: `Bearer ${token}` } });
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'Letras_Renovadas.xlsx';
    a.click();
  }

  const pagedData = data.slice(page * pageSize, (page + 1) * pageSize);
  const totalPages = Math.ceil(data.length / pageSize);

  // KPI totals
  const totalSaldo = data.reduce((s, r) => s + (Number(r.saldo) || 0), 0);
  const totalImporte = data.reduce((s, r) => s + (Number(r.importe_original) || 0), 0);
  const vencidas = data.filter(r => r.dias < 0).length;
  const vigentes = data.filter(r => r.dias >= 0).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Letras y Letras Renovadas</h1>
          <p className="text-gray-500 text-sm mt-1">Gestión de letras por cobrar</p>
        </div>
        <button onClick={handleExport} disabled={data.length === 0} className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50 text-sm font-medium">
          <Download className="w-4 h-4" /> Exportar Excel
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <p className="text-xs text-gray-500 uppercase">Total Letras</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{data.length.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <p className="text-xs text-gray-500 uppercase">Importe Total</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">${formatNumber(totalImporte)}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-green-100 p-5">
          <p className="text-xs text-green-600 uppercase">Vigentes</p>
          <p className="text-2xl font-bold text-green-700 mt-1">{vigentes.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-red-100 p-5">
          <p className="text-xs text-red-600 uppercase">Vencidas</p>
          <p className="text-2xl font-bold text-red-700 mt-1">{vencidas.toLocaleString()}</p>
          <p className="text-xs text-red-400 mt-1">Saldo: ${formatNumber(totalSaldo)}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
        <button onClick={() => setShowFilters(!showFilters)} className="w-full flex items-center justify-between px-5 py-3 text-sm font-medium text-gray-700">
          <span className="flex items-center gap-2"><Filter className="w-4 h-4" /> Filtros</span>
          {showFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        {showFilters && (
          <div className="px-5 pb-4 border-t border-gray-100 pt-3">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="text-xs text-gray-500 uppercase mb-1 block">Cliente / RUC</label>
                <input type="text" value={cliente} onChange={e => setCliente(e.target.value)} placeholder="Buscar..."
                  className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs text-gray-500 uppercase mb-1 block">Vendedor</label>
                <select value={vendedor} onChange={e => setVendedor(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
                  <option value="">Todos</option>
                  {filtrosOpciones?.vendedores?.map((v: string) => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 uppercase mb-1 block">Moneda</label>
                <select value={moneda} onChange={e => setMoneda(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
                  <option value="">Todas</option>
                  {filtrosOpciones?.monedas?.map((m: string) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div className="flex items-end">
                <button onClick={loadData} className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 text-sm font-medium">
                  <Search className="w-4 h-4" /> Buscar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-brand-600" /></div>
      ) : data.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
          <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No se encontraron letras</p>
        </div>
      ) : (
        <>
          <div className="hidden lg:block bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Número</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Cliente</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase">RUC</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Vendedor</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Emisión</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Vencimiento</th>
                    <th className="px-3 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Días</th>
                    <th className="px-3 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Mon.</th>
                    <th className="px-3 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Importe</th>
                    <th className="px-3 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Saldo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {pagedData.map((row: any, idx: number) => {
                    const isOverdue = row.dias < 0;
                    return (
                      <tr key={idx} className={`hover:bg-gray-50 ${isOverdue ? 'bg-red-50/40' : ''}`}>
                        <td className="px-3 py-2.5 font-mono text-xs">{row.numero}</td>
                        <td className="px-3 py-2.5 max-w-[180px] truncate" title={row.cli_nombre}>{row.cli_nombre}</td>
                        <td className="px-3 py-2.5 text-xs text-gray-600">{row.cli_ruc}</td>
                        <td className="px-3 py-2.5 text-xs max-w-[140px] truncate">{row.cli_vendedor}</td>
                        <td className="px-3 py-2.5 text-xs">{formatDate(row.f_emision)}</td>
                        <td className="px-3 py-2.5 text-xs">{formatDate(row.f_vcto)}</td>
                        <td className={`px-3 py-2.5 text-xs font-semibold text-right ${isOverdue ? 'text-red-600' : 'text-green-600'}`}>{row.dias}</td>
                        <td className="px-3 py-2.5 text-xs text-center">{row.moneda}</td>
                        <td className="px-3 py-2.5 text-right font-mono text-xs">{formatNumber(row.importe_original)}</td>
                        <td className={`px-3 py-2.5 text-right font-mono text-xs font-semibold ${Number(row.saldo) < 0 ? 'text-red-600' : ''}`}>{formatNumber(row.saldo)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile cards */}
          <div className="lg:hidden space-y-3">
            {pagedData.map((row: any, idx: number) => {
              const isOverdue = row.dias < 0;
              return (
                <div key={idx} className={`bg-white rounded-xl shadow-sm border p-4 ${isOverdue ? 'border-red-200 bg-red-50/30' : 'border-gray-100'}`}>
                  <div className="flex items-start justify-between mb-2">
                    <span className="px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-700">LT</span>
                    <span className={`text-xs font-semibold ${isOverdue ? 'text-red-600' : 'text-green-600'}`}>{row.dias} días</span>
                  </div>
                  <p className="font-mono text-sm">{row.numero}</p>
                  <p className="text-sm font-medium text-gray-900 truncate mt-1">{row.cli_nombre}</p>
                  <p className="text-xs text-brand-600">{row.cli_vendedor}</p>
                  <div className="flex justify-between mt-2 pt-2 border-t border-gray-100">
                    <span className="text-xs text-gray-400">Vcto: {formatDate(row.f_vcto)}</span>
                    <span className="text-sm font-bold font-mono">{row.moneda} {formatNumber(row.saldo)}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between bg-white rounded-xl shadow-sm border border-gray-100 px-4 py-3">
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="px-3 py-1.5 text-sm bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-40">Anterior</button>
              <span className="text-sm text-gray-600">Página {page + 1} de {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="px-3 py-1.5 text-sm bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-40">Siguiente</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
