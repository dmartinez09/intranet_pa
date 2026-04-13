import { useState, useEffect, useCallback } from 'react';
import { carteraApi } from '../services/api';
import {
  Search,
  Download,
  Filter,
  RefreshCw,
  FileSpreadsheet,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Calendar,
  Loader2,
} from 'lucide-react';

interface EstadoCuentaRow {
  fecha_corte: string;
  card_code: string;
  cli_nombre: string;
  cli_ruc: string;
  cli_direccion: string;
  cli_linea_credito: number;
  cli_vendedor: string;
  cli_contacto: string;
  cli_vencimiento: string;
  td: string;
  tipo_transaccion: string;
  numero: string;
  f_emision: string;
  f_vcto: string;
  dias: number;
  moneda: string;
  importe_original: number;
  a_cuenta: number;
  saldo: number;
  monto_retencion: number;
  banco: string;
  n_unico: string;
  observacion: string;
}

interface Filtros {
  vendedor: string;
  cliente: string;
  tipoDocumento: string;
  moneda: string;
  numero: string;
}

interface Resumen {
  total_registros: number;
  total_clientes: number;
  saldo_total: number;
  saldo_vencido: number;
  saldo_vigente: number;
  fecha_corte: string;
}

const TD_LABELS: Record<string, { label: string; color: string }> = {
  FAC: { label: 'FAC', color: 'bg-green-100 text-green-700' },
  LT: { label: 'LT', color: 'bg-blue-100 text-blue-700' },
  NC: { label: 'NC', color: 'bg-amber-100 text-amber-700' },
  ANT: { label: 'ANT', color: 'bg-purple-100 text-purple-700' },
  PAGO: { label: 'PAGO', color: 'bg-teal-100 text-teal-700' },
  DET: { label: 'DET', color: 'bg-orange-100 text-orange-700' },
  FN: { label: 'FN', color: 'bg-indigo-100 text-indigo-700' },
  OTRO: { label: 'OTRO', color: 'bg-gray-100 text-gray-700' },
};

function formatDate(d: string | null): string {
  if (!d) return '';
  return new Date(d).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatNumber(n: number | null, decimals = 2): string {
  if (n == null) return '';
  return n.toLocaleString('es-PE', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export default function EstadoCuenta() {
  const [data, setData] = useState<EstadoCuentaRow[]>([]);
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [filtrosOpciones, setFiltrosOpciones] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(true);
  const [exporting, setExporting] = useState(false);

  const [filtros, setFiltros] = useState<Filtros>({
    vendedor: '',
    cliente: '',
    tipoDocumento: '',
    moneda: '',
    numero: '',
  });

  // Pipeline generation
  const [generando, setGenerando] = useState(false);
  const [fechaCorteInput, setFechaCorteInput] = useState('');
  const [pipelineRunId, setPipelineRunId] = useState('');
  const [pipelineStatus, setPipelineStatus] = useState('');

  // Sort
  const [sortField, setSortField] = useState<string>('cli_nombre');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // Pagination
  const [page, setPage] = useState(0);
  const pageSize = 50;

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (filtros.vendedor) params.vendedor = filtros.vendedor;
      if (filtros.cliente) params.cliente = filtros.cliente;
      if (filtros.tipoDocumento) params.tipoDocumento = filtros.tipoDocumento;
      if (filtros.moneda) params.moneda = filtros.moneda;
      if (filtros.numero) params.numero = filtros.numero;

      const [dataRes, resumenRes] = await Promise.all([
        carteraApi.getEstadoCuenta(params),
        carteraApi.getEstadoCuentaResumen(),
      ]);

      setData(dataRes.data.data || []);
      setResumen(resumenRes.data.data || null);
      setPage(0);
    } catch (error) {
      console.error('Error loading estado de cuenta:', error);
    } finally {
      setLoading(false);
    }
  }, [filtros]);

  useEffect(() => {
    carteraApi.getEstadoCuentaFiltros().then(res => {
      setFiltrosOpciones(res.data.data);
      if (res.data.data?.fecha_corte) {
        setFechaCorteInput(new Date(res.data.data.fecha_corte).toISOString().split('T')[0]);
      }
    });
    loadData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = () => { loadData(); };

  const handleClear = () => {
    setFiltros({ vendedor: '', cliente: '', tipoDocumento: '', moneda: '', numero: '' });
    setTimeout(() => loadData(), 0);
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const params: any = {};
      if (filtros.vendedor) params.vendedor = filtros.vendedor;
      if (filtros.cliente) params.cliente = filtros.cliente;
      if (filtros.tipoDocumento) params.tipoDocumento = filtros.tipoDocumento;
      if (filtros.moneda) params.moneda = filtros.moneda;
      if (filtros.numero) params.numero = filtros.numero;

      const url = carteraApi.exportEstadoCuentaUrl(params);
      const token = localStorage.getItem('token');
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `Estado_Cuenta_${fechaCorteInput || 'export'}.xlsx`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (error) {
      console.error('Error exporting:', error);
    } finally {
      setExporting(false);
    }
  };

  const handleGenerar = async () => {
    if (!fechaCorteInput) return;
    setGenerando(true);
    setPipelineStatus('Iniciando...');
    try {
      const res = await carteraApi.generarEstadoCuenta(fechaCorteInput);
      const runId = res.data.runId;
      setPipelineRunId(runId);
      setPipelineStatus('InProgress');

      // Poll for status
      const poll = setInterval(async () => {
        try {
          const statusRes = await carteraApi.getPipelineStatus(runId);
          const st = statusRes.data.status;
          setPipelineStatus(st);
          if (st === 'Succeeded') {
            clearInterval(poll);
            setGenerando(false);
            loadData(); // Reload with new data
          } else if (st === 'Failed' || st === 'Cancelled') {
            clearInterval(poll);
            setGenerando(false);
          }
        } catch {
          clearInterval(poll);
          setGenerando(false);
          setPipelineStatus('Error');
        }
      }, 5000);
    } catch (error: any) {
      console.error('Error triggering pipeline:', error);
      setPipelineStatus(error.response?.data?.message || 'Error al generar');
      setGenerando(false);
    }
  };

  // Sorting
  const sortedData = [...data].sort((a: any, b: any) => {
    const av = a[sortField];
    const bv = b[sortField];
    if (av == null) return 1;
    if (bv == null) return -1;
    if (typeof av === 'number') return sortDir === 'asc' ? av - bv : bv - av;
    return sortDir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
  });

  const pagedData = sortedData.slice(page * pageSize, (page + 1) * pageSize);
  const totalPages = Math.ceil(sortedData.length / pageSize);

  const toggleSort = (field: string) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const SortIcon = ({ field }: { field: string }) => {
    if (sortField !== field) return null;
    return sortDir === 'asc' ? <ChevronUp className="w-3 h-3 inline ml-0.5" /> : <ChevronDown className="w-3 h-3 inline ml-0.5" />;
  };

  // Resumen totals from filtered data
  const filteredTotals = {
    saldo: data.reduce((s, r) => s + (Number(r.saldo) || 0), 0),
    importe: data.reduce((s, r) => s + (Number(r.importe_original) || 0), 0),
    a_cuenta: data.reduce((s, r) => s + (Number(r.a_cuenta) || 0), 0),
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Estado de Cuenta F. Corte</h1>
          <p className="text-gray-500 text-sm mt-1">
            Cuentas por cobrar al {resumen?.fecha_corte ? formatDate(resumen.fecha_corte) : '...'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            disabled={exporting || data.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50 text-sm font-medium"
          >
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
            Exportar Excel
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      {resumen && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Total Registros</p>
            <p className="text-xl font-bold text-gray-900 mt-1">{resumen.total_registros.toLocaleString()}</p>
            <p className="text-xs text-gray-400 mt-1">{resumen.total_clientes} clientes</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Saldo Total</p>
            <p className="text-xl font-bold text-gray-900 mt-1">${formatNumber(resumen.saldo_total)}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-green-100 p-4">
            <p className="text-xs text-green-600 uppercase tracking-wide">Vigente</p>
            <p className="text-xl font-bold text-green-700 mt-1">${formatNumber(resumen.saldo_vigente)}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-red-100 p-4">
            <p className="text-xs text-red-600 uppercase tracking-wide">Vencido</p>
            <p className="text-xl font-bold text-red-700 mt-1">${formatNumber(resumen.saldo_vencido)}</p>
          </div>
        </div>
      )}

      {/* Generate new report */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Generar nuevo corte:</span>
          </div>
          <input
            type="date"
            value={fechaCorteInput}
            onChange={(e) => setFechaCorteInput(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
          />
          <button
            onClick={handleGenerar}
            disabled={generando || !fechaCorteInput}
            className="flex items-center gap-2 px-4 py-1.5 bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50 text-sm font-medium"
          >
            {generando ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            {generando ? 'Generando...' : 'Generar Reporte'}
          </button>
          {pipelineStatus && (
            <span className={`text-xs px-2 py-1 rounded-full ${
              pipelineStatus === 'Succeeded' ? 'bg-green-100 text-green-700' :
              pipelineStatus === 'Failed' || pipelineStatus === 'Error' ? 'bg-red-100 text-red-700' :
              'bg-blue-100 text-blue-700'
            }`}>
              {pipelineStatus === 'InProgress' ? 'En proceso...' :
               pipelineStatus === 'Succeeded' ? 'Completado' :
               pipelineStatus}
            </span>
          )}
        </div>
        <p className="text-xs text-gray-400 mt-2">
          Ejecuta el pipeline de Data Factory para actualizar los datos con una nueva fecha de corte. Tiempo estimado: 1-3 minutos.
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-700"
        >
          <span className="flex items-center gap-2">
            <Filter className="w-4 h-4" /> Filtros
          </span>
          {showFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {showFilters && (
          <div className="px-4 pb-4 border-t border-gray-100 pt-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1 uppercase">Vendedor</label>
                <select
                  value={filtros.vendedor}
                  onChange={(e) => setFiltros(f => ({ ...f, vendedor: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                >
                  <option value="">Todos</option>
                  {filtrosOpciones?.vendedores?.map((v: string) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1 uppercase">Cliente / RUC</label>
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={filtros.cliente}
                    onChange={(e) => setFiltros(f => ({ ...f, cliente: e.target.value }))}
                    placeholder="Buscar..."
                    className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1 uppercase">Tipo Documento</label>
                <select
                  value={filtros.tipoDocumento}
                  onChange={(e) => setFiltros(f => ({ ...f, tipoDocumento: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                >
                  <option value="">Todos</option>
                  {filtrosOpciones?.tipos_documento?.map((t: string) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1 uppercase">Moneda</label>
                <select
                  value={filtros.moneda}
                  onChange={(e) => setFiltros(f => ({ ...f, moneda: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                >
                  <option value="">Todas</option>
                  {filtrosOpciones?.monedas?.map((m: string) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1 uppercase">Nro. Documento</label>
                <input
                  type="text"
                  value={filtros.numero}
                  onChange={(e) => setFiltros(f => ({ ...f, numero: e.target.value }))}
                  placeholder="Ej: 00039306"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                />
              </div>
            </div>
            <div className="flex items-center gap-3 mt-3">
              <button
                onClick={handleSearch}
                className="flex items-center gap-2 px-5 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 text-sm font-medium"
              >
                <Search className="w-4 h-4" /> Buscar
              </button>
              <button
                onClick={handleClear}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 text-sm"
              >
                Limpiar
              </button>
              <span className="text-xs text-gray-400 ml-auto">
                {data.length.toLocaleString()} registros encontrados
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
        </div>
      ) : data.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No se encontraron registros</p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden lg:block bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    {[
                      { key: 'td', label: 'Tipo' },
                      { key: 'numero', label: 'Número' },
                      { key: 'cli_nombre', label: 'Cliente' },
                      { key: 'cli_ruc', label: 'RUC' },
                      { key: 'cli_vendedor', label: 'Vendedor' },
                      { key: 'cli_vencimiento', label: 'Cond. Pago' },
                      { key: 'f_emision', label: 'Emisión' },
                      { key: 'f_vcto', label: 'Vencimiento' },
                      { key: 'dias', label: 'Días' },
                      { key: 'moneda', label: 'Mon.' },
                      { key: 'importe_original', label: 'Importe' },
                      { key: 'a_cuenta', label: 'A Cuenta' },
                      { key: 'saldo', label: 'Saldo' },
                    ].map(col => (
                      <th
                        key={col.key}
                        onClick={() => toggleSort(col.key)}
                        className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none whitespace-nowrap"
                      >
                        {col.label} <SortIcon field={col.key} />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {pagedData.map((row, idx) => {
                    const tdInfo = TD_LABELS[row.td] || TD_LABELS.OTRO;
                    const isOverdue = row.dias < 0;
                    return (
                      <tr key={idx} className={`hover:bg-gray-50 ${isOverdue ? 'bg-red-50/40' : ''}`}>
                        <td className="px-3 py-2.5">
                          <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${tdInfo.color}`}>
                            {tdInfo.label}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 font-mono text-xs">{row.numero}</td>
                        <td className="px-3 py-2.5 max-w-[200px] truncate" title={row.cli_nombre}>{row.cli_nombre}</td>
                        <td className="px-3 py-2.5 text-xs text-gray-600">{row.cli_ruc}</td>
                        <td className="px-3 py-2.5 text-xs max-w-[160px] truncate" title={row.cli_vendedor}>{row.cli_vendedor}</td>
                        <td className="px-3 py-2.5 text-xs text-gray-500 max-w-[120px] truncate" title={row.cli_vencimiento}>{row.cli_vencimiento}</td>
                        <td className="px-3 py-2.5 text-xs">{formatDate(row.f_emision)}</td>
                        <td className="px-3 py-2.5 text-xs">{formatDate(row.f_vcto)}</td>
                        <td className={`px-3 py-2.5 text-xs font-semibold text-right ${isOverdue ? 'text-red-600' : 'text-green-600'}`}>
                          {row.dias}
                        </td>
                        <td className="px-3 py-2.5 text-xs text-center">{row.moneda}</td>
                        <td className="px-3 py-2.5 text-right font-mono text-xs">{formatNumber(row.importe_original)}</td>
                        <td className="px-3 py-2.5 text-right font-mono text-xs">{formatNumber(row.a_cuenta)}</td>
                        <td className={`px-3 py-2.5 text-right font-mono text-xs font-semibold ${Number(row.saldo) < 0 ? 'text-red-600' : ''}`}>
                          {formatNumber(row.saldo)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 border-t-2 border-gray-300 font-semibold text-sm">
                    <td colSpan={10} className="px-3 py-3 text-right">Totales filtrados:</td>
                    <td className="px-3 py-3 text-right font-mono">{formatNumber(filteredTotals.importe)}</td>
                    <td className="px-3 py-3 text-right font-mono">{formatNumber(filteredTotals.a_cuenta)}</td>
                    <td className={`px-3 py-3 text-right font-mono ${filteredTotals.saldo < 0 ? 'text-red-600' : ''}`}>
                      {formatNumber(filteredTotals.saldo)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Mobile cards */}
          <div className="lg:hidden space-y-3">
            {pagedData.map((row, idx) => {
              const tdInfo = TD_LABELS[row.td] || TD_LABELS.OTRO;
              const isOverdue = row.dias < 0;
              return (
                <div key={idx} className={`bg-white rounded-xl shadow-sm border p-4 ${isOverdue ? 'border-red-200 bg-red-50/30' : 'border-gray-100'}`}>
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${tdInfo.color}`}>{tdInfo.label}</span>
                      <span className="font-mono text-sm font-medium">{row.numero}</span>
                    </div>
                    <span className={`text-xs font-semibold ${isOverdue ? 'text-red-600' : 'text-green-600'}`}>
                      {row.dias} días
                    </span>
                  </div>
                  <p className="text-sm font-medium text-gray-900 truncate">{row.cli_nombre}</p>
                  <p className="text-xs text-brand-600 mt-0.5">{row.cli_vendedor}</p>
                  <div className="grid grid-cols-2 gap-2 mt-3 text-xs text-gray-500">
                    <div>Emisión: {formatDate(row.f_emision)}</div>
                    <div>Vcto: {formatDate(row.f_vcto)}</div>
                    <div>Mon: {row.moneda}</div>
                    <div>Cond: {row.cli_vencimiento}</div>
                  </div>
                  <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-100">
                    <div className="text-xs"><span className="text-gray-400">Importe:</span> <span className="font-mono">{formatNumber(row.importe_original)}</span></div>
                    <div className={`text-sm font-bold font-mono ${Number(row.saldo) < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                      Saldo: {formatNumber(row.saldo)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between bg-white rounded-xl shadow-sm border border-gray-100 px-4 py-3">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="px-3 py-1.5 text-sm bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-40"
              >
                Anterior
              </button>
              <span className="text-sm text-gray-600">
                Página {page + 1} de {totalPages} ({sortedData.length.toLocaleString()} registros)
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="px-3 py-1.5 text-sm bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-40"
              >
                Siguiente
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
