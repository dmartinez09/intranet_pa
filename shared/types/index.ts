// ============================================================
// SHARED TYPES - Intranet Point Andina
// Inferidos de las vistas SQL (Excel: Avance de ventas SAP)
// ============================================================

// ---- AUTH & RBAC ----

export type AppModule =
  | 'dashboard_ventas'
  | 'presupuesto'
  | 'avance_comercial'
  | 'cartera'
  | 'estado_cuenta'
  | 'facturacion'
  | 'letras'
  | 'alertas'
  | 'diccionario';

export const MODULE_LABELS: Record<AppModule, string> = {
  dashboard_ventas: 'Ventas — Dashboard',
  presupuesto: 'Ventas — Presupuesto',
  avance_comercial: 'Ventas — Avance Comercial',
  cartera: 'Crédito — Cartera',
  estado_cuenta: 'Crédito — Estado de Cuenta',
  facturacion: 'Logística — Facturas Electrónicas',
  letras: 'Logística — Letras',
  alertas: 'Alertas',
  diccionario: 'Diccionario',
};

export const MODULE_GROUPS: { group: string; modules: AppModule[] }[] = [
  { group: 'Ventas', modules: ['dashboard_ventas', 'presupuesto', 'avance_comercial'] },
  { group: 'Crédito', modules: ['cartera', 'estado_cuenta'] },
  { group: 'Logística', modules: ['facturacion', 'letras'] },
  { group: 'General', modules: ['alertas', 'diccionario'] },
];

export interface AuthUser {
  id: number;
  username: string;
  full_name: string;
  email: string | null;
  modules: AppModule[];
  is_admin: boolean;
  is_active: boolean;
  last_login?: string | null;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: AuthUser;
}

// ---- VENTAS (Vista principal - 43 columnas) ----

export interface VentaRecord {
  tipo_venta: string;
  pais: string;
  facturador: string;
  orden_de_venta: number | null;
  fecha_pedido: string | null;
  fecha_guia: string | null;
  fecha_emision: string;                          // FECHA BASE (rosado)
  zona: string | null;
  codigo_vendedor: number;
  vendedor: string;
  razon_social_cliente: string;
  ruc_cliente: string;
  codigo_producto: string | null;
  division: string | null;                        // AGROCHEM | BIOSCIENCE
  familia: string | null;                         // Filtro nutricionales
  sub_familia: string | null;
  ingrediente_activo: string | null;
  producto_formulado: string | null;
  marca: string | null;
  nombre_producto: string;
  unidades_presentacion: number;                  // (amarillo) volumen
  precio_unitario_venta_dolares: number;          // (amarillo)
  valor_venta_dolares: number;                    // (amarillo) METRICA PRINCIPAL
  tipo_de_cambio: number;
  moneda_emision: 'USD' | 'PEN';
  tipo_documento: string;                         // Factura, Boleta, NC, ND, Anticipo
  numero_sap: string;
  doc_referencia_orden: string | null;
  condicion_pago: string;
  dias_credito: number | null;
  usuario_creador: string;
  grupo_cliente: string;
  maestro_tipo: 'FOCO' | 'EN VIVO' | 'OTROS';   // (naranja)
  tipo_de_cliente: string;
  clasificacion_bcg: string | null;               // VACA | INTERROGANTE | PERRO
  origen_producto: string | null;                 // EXTERIOR | NACIONAL
  distrito_fiscal: string;
  direccion_fiscal: string;
  departamento_fiscal: string;
  distrito_despacho: string;
  direccion_despacho: string;
  departamento_despacho: string;
  series_de_documentos: string;                   // AGRO|BIOS|COST|DESA|ONL|SISE
}

// ---- KPIs & Aggregates ----

export interface VentasKPI {
  total_venta_usd: number;
  total_kilolitros: number;
  total_clientes: number;
  total_transacciones: number;
  ticket_promedio: number;
  meta_mensual_usd: number;
  porcentaje_avance: number;
}

export interface VentaPorCliente {
  razon_social_cliente: string;
  ruc_cliente: string;
  total_venta_usd: number;
  porcentaje_acumulado: number;  // Para Pareto
  cantidad_transacciones: number;
}

export interface VentaPorIngredienteActivo {
  ingrediente_activo: string;
  total_venta_usd: number;
  total_unidades: number;
}

export interface VentaPorVendedor {
  vendedor: string;
  codigo_vendedor: number;
  zona: string;
  series_documentos: string;
  total_venta_usd: number;
  total_unidades: number;
  cantidad_clientes: number;
}

export interface VentaPorFamilia {
  familia: string;
  total_venta_usd: number;
  total_unidades: number;
  porcentaje: number;
}

export interface VentaDiaria {
  fecha: string;
  total_venta_usd: number;
  cantidad_documentos: number;
}

export interface ProductoEnVivo {
  nombre_producto: string;
  maestro_tipo: string;
  total_venta_usd: number;
  total_unidades: number;
}

// ---- FILTROS GLOBALES ----

export interface FiltrosVentas {
  fecha_inicio: string;
  fecha_fin: string;
  familia?: string;
  sub_familia?: string;
  ingrediente_activo?: string;
  vendedor?: string;
  zona?: string;
  tipo_documento?: string;
  series_documentos?: string;
  maestro_tipo?: string;
  division?: string;
}

export interface OpcionesFiltro {
  familias: string[];
  sub_familias: string[];
  ingredientes_activos: string[];
  vendedores: { codigo: number; nombre: string }[];
  zonas: string[];
  tipos_documento: string[];
  series_documentos: string[];
  divisiones: string[];
  maestro_tipos: string[];
}

// ---- CONVENIOS ----

export interface Convenio {
  ruc: string;
  cliente: string;
  vigencia: string;
  meta_anual: number;
  bono_anual_general: number;          // porcentaje (ej: 0.03 = 3%)
  meta_trim1: number | null;
  meta_trim2: number | null;
  meta_trim3: number | null;
  meta_trim4: number | null;
  bonificacion_productos: string | null;
  meta_nutricion: number | null;
  bono_nutri: number | null;           // porcentaje
  meta_foco: number | null;
  bono_foco: number | null;            // porcentaje
  rc: string;                          // Representante Comercial
  equipo: string;                      // Cayo | Arce
  vta_2025: number | null;
  cumplimiento_meta: string;
  monto_liq_general: number;
  vta_nutri_2025: number | null;
  cumplimiento_nutri: string;
  monto_liq_nutri: number;
  vta_foco_2025: number | null;
  cumplimiento_foco: string;
  monto_liq_foco: number;
  liquidacion_total: number;
  estado_convenio: string;
}

// ---- CARTERA Y RECAUDO ----

export interface CarteraKPI {
  total_cartera: number;
  cartera_vencida: number;
  cartera_vigente: number;
  porcentaje_recaudo: number;
  dias_promedio_cobro: number;
  clientes_morosos: number;
}

export interface CarteraPorCliente {
  razon_social: string;
  ruc: string;
  saldo_total: number;
  saldo_vencido: number;
  saldo_vigente: number;
  dias_mora_promedio: number;
  condicion_pago: string;
}

export interface CarteraPorEdad {
  rango: string;         // "0-30", "31-60", "61-90", "91-120", ">120"
  monto: number;
  cantidad_documentos: number;
  porcentaje: number;
}

// ---- ALERTAS OPERATIVAS ----

export type AlertaModulo = 'VEN' | 'INV' | 'CXC' | 'CMP' | 'FIN' | 'SER' | 'TES' | 'CAP';

export interface AlertaSAP {
  id: number;
  modulo: AlertaModulo;
  nombre: string;
  consulta_guardada: string;
  prioridad: 'Normal' | 'Alta';
  frecuencia: number;
  periodo: 'Minutos' | 'Horas' | 'Días' | 'Semanas' | 'Meses';
  dia_ejecucion?: string;
  activa: boolean;
}

export interface AlertaOrdenNoAtendida {
  numero_orden: string;
  cliente: string;
  articulo: string;
  descripcion: string;
  fecha_entrega: string;
  dias_atraso: number;
  total_usd: number;
  comentarios: string;
  fecha_aprobacion: string | null;
  hora_aprobacion: string | null;
}

export interface PedidoPendiente {
  numero_pedido: string;
  cliente: string;
  vendedor: string;
  fecha_pedido: string;
  estado: 'Aprobado' | 'Pendiente' | 'Rechazado';
  total_usd: number;
  comentarios: string;
}

export interface FacturacionDiaria {
  fecha: string;
  total_facturado_usd: number;
  cantidad_facturas: number;
  vendedor: string;
  zona: string;
}

// ---- CONFIGURACION APP ----

export interface AppConfig {
  logo_url: string | null;
  company_name: string;
}

// ---- API RESPONSES ----

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  total: number;
  page: number;
  limit: number;
}
