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
  create: (data: any) => api.post('/users', data),
  update: (id: number, data: any) => api.put(`/users/${id}`, data),
  remove: (id: number) => api.delete(`/users/${id}`),
  getRoles: () => api.get('/users/roles'),
};

// Ventas
export const ventasApi = {
  getKPIs: (params?: any) => api.get('/ventas/kpis', { params }),
  getPorCliente: (params?: any) => api.get('/ventas/por-cliente', { params }),
  getPorIA: (params?: any) => api.get('/ventas/por-ingrediente-activo', { params }),
  getPorVendedor: (params?: any) => api.get('/ventas/por-vendedor', { params }),
  getPorFamilia: (params?: any) => api.get('/ventas/por-familia', { params }),
  getDiarias: (params?: any) => api.get('/ventas/diarias', { params }),
  getFiltros: () => api.get('/ventas/filtros'),
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
  getKPIs: () => api.get('/cartera/kpis'),
  getPorEdad: () => api.get('/cartera/por-edad'),
  getPorVendedor: () => api.get('/cartera/por-vendedor'),
  getTransacciones: () => api.get('/cartera/transacciones'),
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

export default api;
