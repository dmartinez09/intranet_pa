import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 || error.response?.status === 403) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Auth
export const authApi = {
  login: (username: string, password: string) => api.post('/auth/login', { username, password }),
  me: () => api.get('/auth/me'),
};

// Users
export const usersApi = {
  getAll: () => api.get('/users'),
  create: (data: { username: string; password: string; full_name: string; email?: string; modules: string[] }) =>
    api.post('/users', data),
  update: (id: number, data: { full_name?: string; email?: string; modules?: string[]; is_active?: boolean }) =>
    api.put(`/users/${id}`, data),
  changePassword: (id: number, password: string) => api.put(`/users/${id}/password`, { password }),
  setActive: (id: number, is_active: boolean) => api.patch(`/users/${id}/active`, { is_active }),
  remove: (id: number) => api.delete(`/users/${id}`),
};

// Ventas
export const ventasApi = {
  getKPIs: (params?: any) => api.get('/ventas/kpis', { params }),
  getPorCliente: (params?: any) => api.get('/ventas/por-cliente', { params }),
  getPorIA: (params?: any) => api.get('/ventas/por-ingrediente-activo', { params }),
  getPorVendedor: (params?: any) => api.get('/ventas/por-vendedor', { params }),
  getPorFamilia: (params?: any) => api.get('/ventas/por-familia', { params }),
  getPorSubFamilia: (params?: any) => api.get('/ventas/por-sub-familia', { params }),
  getDiarias: (params?: any) => api.get('/ventas/diarias', { params }),
  getFiltros: () => api.get('/ventas/filtros'),
  getPorProductoZona: (params?: any) => api.get('/ventas/por-producto-zona', { params }),
  getPorDepartamento: (params?: any) => api.get('/ventas/por-departamento', { params }),
  getDetalle: (params?: any) => api.get('/ventas/detalle', { params }),
};

// Venta RC
export const ventaRCApi = {
  getKPIs: (params?: any) => api.get('/venta-rc/kpis', { params }),
  getPorCliente: (params?: any) => api.get('/venta-rc/por-cliente', { params }),
  getPorIA: (params?: any) => api.get('/venta-rc/por-ingrediente-activo', { params }),
  getPorVendedor: (params?: any) => api.get('/venta-rc/por-vendedor', { params }),
  getPorFamilia: (params?: any) => api.get('/venta-rc/por-familia', { params }),
  getDiarias: (params?: any) => api.get('/venta-rc/diarias', { params }),
  getPorGrupoCliente: (params?: any) => api.get('/venta-rc/por-grupo-cliente', { params }),
  getClientes: (params?: any) => api.get('/venta-rc/clientes', { params }),
  getFiltros: () => api.get('/venta-rc/filtros'),
};

// Cartera
export const carteraApi = {
  getGrupos: () => api.get('/cartera/grupos'),
  getKPIs: (params?: { grupo?: string }) => api.get('/cartera/kpis', { params }),
  getPorEdad: (params?: { grupo?: string }) => api.get('/cartera/por-edad', { params }),
  getPorVendedor: (params?: { grupo?: string }) => api.get('/cartera/por-vendedor', { params }),
  getTransacciones: (params?: { grupo?: string }) => api.get('/cartera/transacciones', { params }),
  getMeta: () => api.get('/cartera/meta'),
  getLetrasNoAceptadas: (params?: { grupo?: string }) => api.get('/cartera/letras-no-aceptadas', { params }),
  getLineaCreditos: (params?: { grupo?: string }) => api.get('/cartera/linea-creditos', { params }),
  // Estado de Cuenta
  getEstadoCuenta: (params?: any) => api.get('/cartera/estado-cuenta', { params }),
  getEstadoCuentaFiltros: () => api.get('/cartera/estado-cuenta/filtros'),
  getEstadoCuentaResumen: () => api.get('/cartera/estado-cuenta/resumen'),
  exportEstadoCuentaUrl: (params?: any) => {
    const qs = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => { if (v) qs.set(k, String(v)); });
    }
    return `/api/cartera/estado-cuenta/export?${qs.toString()}`;
  },
  generarEstadoCuenta: (fechaCorte: string) => api.post('/cartera/estado-cuenta/generar', { fechaCorte }),
  getPipelineStatus: (runId: string) => api.get(`/cartera/estado-cuenta/pipeline-status/${runId}`),
};

// Alertas
export const alertasApi = {
  getSAP: () => api.get('/alertas/sap'),
  getOrdenesNoAtendidas: () => api.get('/alertas/ordenes-no-atendidas'),
  getResultado: (alertaId: number, fecha: string) => api.get(`/alertas/resultado/${alertaId}`, { params: { fecha } }),
  getPedidosRechazados: () => api.get('/alertas/pedidos-rechazados'),
  getEmails: (count?: number) => api.get('/alertas/emails', { params: { count } }),
  getEmailBody: (messageId: string) => api.get(`/alertas/emails/${messageId}`),
  getEmailStatus: () => api.get('/alertas/emails/status'),
};

// Facturación
export const facturacionApi = {
  getEmails: (params?: any) => api.get('/facturacion/emails', { params }),
  getAttachments: (messageId: string) => api.get(`/facturacion/emails/${messageId}/attachments`),
  downloadUrl: (messageId: string, attachmentId: string) => `/api/facturacion/emails/${messageId}/attachments/${attachmentId}/download`,
  getVendedores: () => api.get('/facturacion/vendedores'),
  getStatus: () => api.get('/facturacion/status'),
  getLetrasFiles: (params?: any) => api.get('/facturacion/letras-files', { params }),
  getLetrasComprobantes: (facturaCode: string) => api.get('/facturacion/letras-comprobantes', { params: { facturaCode } }),
  getLetraDownloadUrl: (itemId: string) => api.get(`/facturacion/letras-download/${itemId}`),
  sendLetra: (data: { letraDriveItemId: string; facturaCode: string; to: string[]; cc?: string[]; cliente?: string; force?: boolean }) => api.post('/facturacion/letras-send', data),
  // Letras scheduler + bot
  getLetrasStatus: () => api.get('/facturacion/letras-status'),
  refreshLetras: () => api.post('/facturacion/letras-refresh'),
  getLetrasBotConfig: () => api.get('/facturacion/letras-bot/config'),
  updateLetrasBotConfig: (data: { enabled?: boolean; sendHour?: number; sendMinute?: number; defaultCc?: string }) =>
    api.put('/facturacion/letras-bot/config', data),
  getLetrasBotHistory: (limit = 50) => api.get('/facturacion/letras-bot/history', { params: { limit } }),
  runLetrasBotNow: () => api.post('/facturacion/letras-bot/run-now'),
  // Tracking de envíos y aperturas
  getLetrasSendsSummary: () => api.get('/facturacion/letras-sends-summary'),
  getLetrasSends: (letraId: string) => api.get(`/facturacion/letras-sends/${encodeURIComponent(letraId)}`),
  getLetrasOpens: (historyId: number) => api.get(`/facturacion/letras-opens/${historyId}`),
};

// Inteligencia Comercial Beta
export const inteligenciaApi = {
  getMeta: () => api.get('/inteligencia/meta'),
  getSources: () => api.get('/inteligencia/sources'),
  getCrops: () => api.get('/inteligencia/crops'),
  getRegions: () => api.get('/inteligencia/regions'),
  getCategories: () => api.get('/inteligencia/categories'),
  getSnapshots: (params?: {
    crop_id?: number; region_id?: number; category_id?: number;
    source_id?: number; from_date?: string; to_date?: string; limit?: number;
  }) => api.get('/inteligencia/snapshots', { params }),
  getGeoSummary: (params?: { crop_id?: number; category_id?: number }) =>
    api.get('/inteligencia/geo-summary', { params }),
  getTopCrops: (limit = 10) => api.get('/inteligencia/top-crops', { params: { limit } }),
  getEtlRuns: (limit = 30) => api.get('/inteligencia/etl-runs', { params: { limit } }),
  getTopOpportunities: (limit = 10, minScore = 70) => api.get('/inteligencia/top-opportunities', { params: { limit, min_score: minScore } }),
  getSnapshotDetail: (id: number) => api.get(`/inteligencia/snapshots/${id}`),
  exportSnapshotsUrl: (params?: { crop_id?: number; region_id?: number; category_id?: number; source_id?: number }) => {
    const qs = new URLSearchParams();
    if (params) Object.entries(params).forEach(([k, v]) => { if (v) qs.set(k, String(v)); });
    return `/api/inteligencia/export/snapshots?${qs.toString()}`;
  },
  // Fase 4 - Gap analysis
  getMarketGap: () => api.get('/inteligencia/market-gap'),
  getOpportunityByCrop: (limit = 50) => api.get('/inteligencia/opportunity-by-crop', { params: { limit } }),
  getExecutiveSummary: () => api.get('/inteligencia/executive-summary'),
  getRecommendations: (limit = 10) => api.get('/inteligencia/recommendations', { params: { limit } }),
  // ETL (admin)
  listCollectors: () => api.get('/inteligencia/etl/collectors'),
  runCollector: (sourceCode: string) => api.post(`/inteligencia/etl/run/${sourceCode}`),
  runAllCollectors: () => api.post('/inteligencia/etl/run-all'),
  runCollectorsByFrequency: (freq: 'daily' | 'weekly' | 'on_demand') =>
    api.post(`/inteligencia/etl/run-by-frequency/${freq}`),
  getSchedulerStatus: () => api.get('/inteligencia/etl/scheduler'),
};

// COMEX y Competidores
export const comexApi = {
  getMeta: () => api.get('/inteligencia/comex/meta'),
  getSources: () => api.get('/inteligencia/comex/sources'),
  getPartidas: () => api.get('/inteligencia/comex/partidas'),
  getEmpresas: () => api.get('/inteligencia/comex/empresas'),
  getPaises: () => api.get('/inteligencia/comex/paises'),
  getImportaciones: (params?: {
    empresa_id?: number; partida_id?: number; pais_id?: number;
    year?: number; month?: number; familia_pa?: string; limit?: number;
  }) => api.get('/inteligencia/comex/importaciones', { params }),
  getRanking: (year?: number, limit = 20) => api.get('/inteligencia/comex/ranking', { params: { year, limit } }),
  getFlows: (year?: number, familia_pa?: string) => api.get('/inteligencia/comex/flows', { params: { year, familia_pa } }),
  getPartidaResumen: (year?: number) => api.get('/inteligencia/comex/partida-resumen', { params: { year } }),
  getMonthlyTrend: (year?: number) => api.get('/inteligencia/comex/monthly-trend', { params: { year } }),
  getByFamilia: (year?: number) => api.get('/inteligencia/comex/by-familia', { params: { year } }),
};

// Config
export const configApi = {
  getLogo: () => '/api/config/logo',
  uploadLogo: (file: File) => {
    const formData = new FormData();
    formData.append('logo', file);
    return api.post('/config/logo', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

// Uruguay Daily Sales Bot
export const uruguayBotApi = {
  getConfig: () => api.get('/uruguay-bot/config'),
  saveConfig: (cfg: { enabled?: boolean; scheduleHour?: number; scheduleMinute?: number; sharepointUrl?: string }) =>
    api.put('/uruguay-bot/config', cfg),
  dataInfo: () => api.get('/uruguay-bot/data-info'),
  resolveSharePoint: (url?: string) => api.get('/uruguay-bot/sharepoint/resolve', { params: { url } }),
  listSharePoint: (path?: string, url?: string) => api.get('/uruguay-bot/sharepoint/list', { params: { path, url } }),
  run: (dateFrom?: string, dateTo?: string) => api.post('/uruguay-bot/run', { dateFrom, dateTo }),
  getRuns: (limit = 50) => api.get('/uruguay-bot/runs', { params: { limit } }),
  schedulerStart: () => api.post('/uruguay-bot/scheduler/start'),
  schedulerStop: () => api.post('/uruguay-bot/scheduler/stop'),
};

export default api;
