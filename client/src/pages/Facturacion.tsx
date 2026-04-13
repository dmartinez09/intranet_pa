import { useState, useEffect } from 'react';
import Header from '../components/layout/Header';
import { facturacionApi } from '../services/api';
import {
  FileText,
  Search,
  Download,
  Paperclip,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Filter,
  X,
  File,
  FileSpreadsheet,
  User,
  RefreshCw,
  Loader2,
  Eye,
} from 'lucide-react';

const TIPOS_DOC = ['TODOS', 'FACTURA', 'GUIA DE REMISION', 'NOTA DE CREDITO', 'NOTA DE DEBITO', 'OTRO'];

const TIPO_COLORS: Record<string, string> = {
  'FACTURA': 'bg-brand-100 text-brand-700',
  'GUIA DE REMISION': 'bg-blue-100 text-blue-700',
  'NOTA DE CREDITO': 'bg-amber-100 text-amber-700',
  'NOTA DE DEBITO': 'bg-red-100 text-red-700',
  'OTRO': 'bg-gray-100 text-gray-600',
};

const TIPO_SHORT: Record<string, string> = {
  'FACTURA': 'FAC',
  'GUIA DE REMISION': 'GR',
  'NOTA DE CREDITO': 'NC',
  'NOTA DE DEBITO': 'ND',
  'OTRO': 'OTRO',
};

interface EmailDoc {
  id: string;
  subject: string;
  to: string[];
  cc: string[];
  sentDateTime: string;
  tipoDocumento: string;
  numeroDocumento: string;
  cliente: string;
  fechaEmision: string;
  hasAttachments: boolean;
  preview: string;
  vendedor: string;
  zonaVendedor: string;
}

interface Attachment {
  id: string;
  name: string;
  contentType: string;
  size: number;
}

export default function Facturacion() {
  const [emails, setEmails] = useState<EmailDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 25;

  // Filters
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [tipoDocumento, setTipoDocumento] = useState('TODOS');
  const [searchCliente, setSearchCliente] = useState('');
  const [searchNumero, setSearchNumero] = useState('');
  const [searchVendedor, setSearchVendedor] = useState('');
  const [vendedoresList, setVendedoresList] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(true);

  // Attachment viewer
  const [selectedEmail, setSelectedEmail] = useState<EmailDoc | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loadingAttachments, setLoadingAttachments] = useState(false);

  useEffect(() => {
    loadEmails();
    loadVendedores();
  }, [page]);

  async function loadVendedores() {
    try {
      const res = await facturacionApi.getVendedores();
      setVendedoresList(res.data.data || []);
    } catch (err) {
      console.error('Error loading vendedores:', err);
    }
  }

  async function loadEmails() {
    setLoading(true);
    try {
      const params: any = { top: pageSize, skip: page * pageSize };
      if (fechaDesde) params.fechaDesde = fechaDesde;
      if (fechaHasta) params.fechaHasta = fechaHasta;
      if (tipoDocumento !== 'TODOS') params.tipoDocumento = tipoDocumento;
      if (searchCliente.trim()) params.cliente = searchCliente.trim();
      if (searchNumero.trim()) params.numero = searchNumero.trim();
      if (searchVendedor) params.vendedor = searchVendedor;

      const res = await facturacionApi.getEmails(params);
      setEmails(res.data.data || []);
      setTotalCount(res.data.totalCount || 0);
    } catch (err) {
      console.error('Error loading facturacion emails:', err);
    } finally {
      setLoading(false);
    }
  }

  function applyFilters() {
    setPage(0);
    loadEmails();
  }

  function clearFilters() {
    setFechaDesde('');
    setFechaHasta('');
    setTipoDocumento('TODOS');
    setSearchCliente('');
    setSearchNumero('');
    setSearchVendedor('');
    setPage(0);
    setTimeout(loadEmails, 0);
  }

  async function openAttachments(email: EmailDoc) {
    setSelectedEmail(email);
    setLoadingAttachments(true);
    try {
      const res = await facturacionApi.getAttachments(email.id);
      setAttachments(res.data.data || []);
    } catch (err) {
      console.error('Error loading attachments:', err);
      setAttachments([]);
    } finally {
      setLoadingAttachments(false);
    }
  }

  function downloadAttachment(messageId: string, att: Attachment) {
    const token = localStorage.getItem('token');
    const url = facturacionApi.downloadUrl(messageId, att.id);
    // Use fetch with auth header then trigger download
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.blob())
      .then(blob => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = att.name;
        a.click();
        URL.revokeObjectURL(a.href);
      })
      .catch(err => console.error('Download error:', err));
  }

  function getFileIcon(name: string) {
    const ext = name.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') return <File className="w-4 h-4 text-red-500" />;
    if (ext === 'xml') return <FileSpreadsheet className="w-4 h-4 text-green-600" />;
    return <FileText className="w-4 h-4 text-gray-500" />;
  }

  function formatFileSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function formatDate(isoStr: string) {
    if (!isoStr) return '-';
    const d = new Date(isoStr);
    return d.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  function formatTime(isoStr: string) {
    if (!isoStr) return '';
    const d = new Date(isoStr);
    return d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
  }

  const activeFilterCount = [
    fechaDesde, fechaHasta,
    tipoDocumento !== 'TODOS' ? tipoDocumento : '',
    searchCliente, searchNumero, searchVendedor,
  ].filter(Boolean).length;

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="min-h-screen">
      <Header title="Facturación Electrónica" subtitle="Comprobantes de Pago Electrónicos" />

      <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4">
        {/* Filter Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <button onClick={() => setShowFilters(!showFilters)} className="btn-secondary">
              <Filter className="w-4 h-4" />
              Filtros
              {activeFilterCount > 0 && (
                <span className="ml-1 w-5 h-5 rounded-full bg-brand-500 text-white text-xs flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </button>
            {activeFilterCount > 0 && (
              <button onClick={clearFilters} className="text-sm text-gray-500 hover:text-danger-500 flex items-center gap-1">
                <X className="w-3.5 h-3.5" /> Limpiar
              </button>
            )}
            <button onClick={() => { setPage(0); loadEmails(); }} className="btn-secondary" title="Actualizar">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs sm:text-sm text-gray-400">
            <span className="font-medium text-gray-600">{totalCount}</span> comprobantes encontrados
          </p>
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6 animate-fade-in">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Fecha Desde</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="date"
                    value={fechaDesde}
                    onChange={e => setFechaDesde(e.target.value)}
                    className="w-full pl-10 pr-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Fecha Hasta</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="date"
                    value={fechaHasta}
                    onChange={e => setFechaHasta(e.target.value)}
                    className="w-full pl-10 pr-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Tipo Documento</label>
                <select
                  value={tipoDocumento}
                  onChange={e => setTipoDocumento(e.target.value)}
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                >
                  {TIPOS_DOC.map(t => (
                    <option key={t} value={t}>{t === 'TODOS' ? 'Todos' : t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Cliente</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Buscar por nombre..."
                    value={searchCliente}
                    onChange={e => setSearchCliente(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && applyFilters()}
                    className="w-full pl-10 pr-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Nro. Documento</label>
                <div className="relative">
                  <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="F001-00039306"
                    value={searchNumero}
                    onChange={e => setSearchNumero(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && applyFilters()}
                    className="w-full pl-10 pr-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Vendedor</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <select
                    value={searchVendedor}
                    onChange={e => setSearchVendedor(e.target.value)}
                    className="w-full pl-10 pr-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent appearance-none"
                  >
                    <option value="">Todos</option>
                    {vendedoresList.map(v => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <div className="flex justify-end mt-4 pt-4 border-t border-gray-100">
              <button onClick={applyFilters} className="btn-primary">
                <Search className="w-4 h-4" /> Buscar
              </button>
            </div>
          </div>
        )}

        {/* Results Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
            </div>
          ) : emails.length === 0 ? (
            <div className="text-center py-20 text-gray-400">
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p className="text-sm">No se encontraron comprobantes</p>
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="table-modern">
                  <thead>
                    <tr>
                      <th>Tipo</th>
                      <th>Nro. Documento</th>
                      <th>Cliente</th>
                      <th>Vendedor</th>
                      <th>Destinatario</th>
                      <th>Fecha Emisión</th>
                      <th>Enviado</th>
                      <th className="text-center">Adjuntos</th>
                      <th className="text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {emails.map(email => (
                      <tr key={email.id} className="hover:bg-gray-50/50">
                        <td>
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold ${TIPO_COLORS[email.tipoDocumento] || TIPO_COLORS['OTRO']}`}>
                            {TIPO_SHORT[email.tipoDocumento] || email.tipoDocumento}
                          </span>
                        </td>
                        <td className="font-mono text-sm font-semibold text-gray-800">{email.numeroDocumento || '-'}</td>
                        <td className="max-w-[200px]">
                          <div className="truncate text-sm font-medium text-gray-700" title={email.cliente}>
                            {email.cliente || '-'}
                          </div>
                        </td>
                        <td className="max-w-[180px]">
                          {email.vendedor ? (
                            <div className="truncate text-sm text-gray-700" title={`${email.vendedor} — ${email.zonaVendedor}`}>
                              <span className="font-medium">{email.vendedor}</span>
                              {email.zonaVendedor && (
                                <span className="block text-xs text-gray-400">{email.zonaVendedor}</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-gray-300">—</span>
                          )}
                        </td>
                        <td className="max-w-[180px]">
                          <div className="truncate text-xs text-gray-500" title={email.to.join(', ')}>
                            {email.to[0] || '-'}
                          </div>
                        </td>
                        <td className="text-sm text-gray-600">{formatDate(email.fechaEmision)}</td>
                        <td className="text-xs text-gray-400">
                          {formatDate(email.sentDateTime)}
                          <br />
                          {formatTime(email.sentDateTime)}
                        </td>
                        <td className="text-center">
                          {email.hasAttachments && (
                            <Paperclip className="w-4 h-4 text-gray-400 mx-auto" />
                          )}
                        </td>
                        <td className="text-center">
                          {email.hasAttachments && (
                            <button
                              onClick={() => openAttachments(email)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-brand-700 bg-brand-50 hover:bg-brand-100 rounded-lg transition-colors"
                            >
                              <Download className="w-3.5 h-3.5" /> Descargar
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden divide-y divide-gray-100">
                {emails.map(email => (
                  <div key={email.id} className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold ${TIPO_COLORS[email.tipoDocumento] || TIPO_COLORS['OTRO']}`}>
                        {TIPO_SHORT[email.tipoDocumento] || email.tipoDocumento}
                      </span>
                      <span className="text-xs text-gray-400">{formatDate(email.sentDateTime)}</span>
                    </div>
                    <p className="font-mono text-sm font-semibold text-gray-800">{email.numeroDocumento || 'Sin número'}</p>
                    <p className="text-sm text-gray-600 truncate">{email.cliente || '-'}</p>
                    {email.vendedor && (
                      <p className="text-xs text-brand-600 font-medium truncate">{email.vendedor} {email.zonaVendedor ? `· ${email.zonaVendedor}` : ''}</p>
                    )}
                    <p className="text-xs text-gray-400 truncate">{email.to[0] || ''}</p>
                    {email.hasAttachments && (
                      <button
                        onClick={() => openAttachments(email)}
                        className="flex items-center gap-1.5 text-xs font-semibold text-brand-700 bg-brand-50 hover:bg-brand-100 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" /> Ver adjuntos
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-t border-gray-100 bg-gray-50/50">
                <p className="text-xs text-gray-500">
                  Mostrando {page * pageSize + 1}–{Math.min((page + 1) * pageSize, totalCount)} de {totalCount}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="p-2 rounded-lg hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-sm font-medium text-gray-600">
                    {page + 1} / {totalPages || 1}
                  </span>
                  <button
                    onClick={() => setPage(p => p + 1)}
                    disabled={page + 1 >= totalPages}
                    className="p-2 rounded-lg hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Attachment Modal */}
      {selectedEmail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setSelectedEmail(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-gray-100">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold ${TIPO_COLORS[selectedEmail.tipoDocumento] || TIPO_COLORS['OTRO']}`}>
                      {selectedEmail.tipoDocumento}
                    </span>
                    <span className="font-mono text-sm font-bold text-gray-800">{selectedEmail.numeroDocumento}</span>
                  </div>
                  <p className="text-sm text-gray-600 truncate">{selectedEmail.cliente}</p>
                  <p className="text-xs text-gray-400 mt-1">{formatDate(selectedEmail.fechaEmision)}</p>
                </div>
                <button onClick={() => setSelectedEmail(null)} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>
            </div>

            <div className="p-5 overflow-y-auto max-h-[50vh]">
              {loadingAttachments ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-brand-500" />
                </div>
              ) : attachments.length === 0 ? (
                <p className="text-center text-sm text-gray-400 py-8">No se encontraron adjuntos</p>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                    {attachments.length} archivo{attachments.length !== 1 ? 's' : ''} adjunto{attachments.length !== 1 ? 's' : ''}
                  </p>
                  {attachments.map(att => (
                    <div key={att.id} className="flex items-center justify-between gap-3 p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors group">
                      <div className="flex items-center gap-3 min-w-0">
                        {getFileIcon(att.name)}
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-700 truncate">{att.name}</p>
                          <p className="text-xs text-gray-400">{formatFileSize(att.size)}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => downloadAttachment(selectedEmail.id, att)}
                        className="flex-shrink-0 p-2 rounded-lg text-brand-600 hover:bg-brand-100 transition-colors"
                        title="Descargar"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
