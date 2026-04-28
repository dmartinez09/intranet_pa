# Intranet Point Andina — Contexto del Proyecto

Intranet corporativa para Point Andina (Peru), empresa de agroquímicos del grupo Point Americas.
Centraliza datos de SAP B1 en dashboards interactivos para los equipos de ventas, finanzas y operaciones.

---

## Stack Tecnológico

| Capa | Tecnología |
|------|------------|
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS 3 |
| Routing | React Router DOM 6 |
| HTTP Client | Axios (interceptores JWT automáticos) |
| UI Components | Radix UI (Dialog, Select, Tabs, Avatar, Dropdown, Switch, Tooltip) |
| Gráficos | Recharts 2 |
| Iconos | Lucide React |
| Backend | Node.js + Express 4 + TypeScript |
| Base de datos | SQL Server (Azure) via `mssql` |
| Autenticación | JWT (jsonwebtoken) + bcrypt (bcryptjs) |
| File upload | Multer |
| Rate limiting | express-rate-limit |
| Excel | ExcelJS |
| Microsoft | @azure/msal-node + @microsoft/microsoft-graph-client |
| Dev runner | tsx + concurrently |

---

## Estructura del Proyecto

```
Intranet_Point_Andina/
├── client/                          # Frontend React
│   └── src/
│       ├── components/
│       │   ├── charts/              # Componentes Recharts
│       │   ├── filters/             # DateRangeFilter, MultiSelect
│       │   ├── layout/              # Header, Sidebar, MainLayout
│       │   └── ui/                  # Componentes Radix UI base
│       ├── context/
│       │   └── AuthContext.tsx      # Estado global de auth
│       ├── hooks/                   # Custom hooks
│       ├── pages/                   # Páginas por módulo
│       ├── services/
│       │   └── api.ts               # Axios client + todos los endpoints
│       ├── types/                   # TypeScript interfaces del cliente
│       └── App.tsx                  # Router principal + ProtectedRoute
├── server/
│   └── src/
│       ├── config/
│       │   ├── database.ts          # Pool SQL Server (mssql)
│       │   └── env.ts               # Variables de entorno tipadas
│       ├── controllers/             # auth, user, ventas
│       ├── middleware/
│       │   ├── auth.ts              # Verificación JWT → req.user
│       │   └── rbac.ts              # requireModule(), requireAdmin()
│       ├── routes/                  # Un archivo por módulo
│       ├── services/
│       │   ├── database.service.ts  # Todas las queries SQL + mock fallback
│       │   ├── graph.service.ts     # Microsoft Graph API (emails M365)
│       │   ├── datafactory.service.ts # Azure Data Factory (trigger/status)
│       │   └── budget.service.ts    # Presupuestos (JSON local)
│       ├── data/
│       │   └── budgets.json         # Presupuestos persistidos en disco
│       ├── uploads/                 # Logo corporativo subido por Admin
│       └── index.ts                 # Entry point Express
├── shared/
│   └── types/index.ts               # Interfaces compartidas cliente-servidor
├── .env                             # Credenciales (no commitar)
└── .env.example                     # Template de variables
```

---

## Variables de Entorno (.env)

```env
# SQL Server Azure
DB_SERVER=srv-dwh-grupopoint.database.windows.net
DB_DATABASE=dwh-grupopoint-prod
DB_USER=Admin_point
DB_PASSWORD=<en .env>
DB_PORT=1433

# JWT
JWT_SECRET=point-andina-jwt-secret-2026
JWT_EXPIRES_IN=8h

# Server
PORT=3001
NODE_ENV=development
CLIENT_URL=http://localhost:5173

# Microsoft Entra ID (Azure AD)
MS_TENANT_ID=00b4dd3d-e5d1-4ba6-84bd-94fa25b6e462
MS_CLIENT_ID=7f376f56-888a-4f00-b6fb-f3af08bdeddc
MS_CLIENT_SECRET=<en .env>

# Mailboxes leídos via Graph API
MS_ALERT_EMAIL=alertasSapPA@pointamericas.com
MS_FACTURACION_EMAIL=facturacionpointandina@pointamericas.com

# Azure Data Factory
ADF_SUBSCRIPTION_ID=2f53fbc3-73c3-40da-9a9b-74838c2bf12a
ADF_RESOURCE_GROUP=RG-DWH-PointAndina
ADF_FACTORY_NAME=df-pointandina-prod
ADF_PIPELINE_NAME=FPL_Estado_cuenta
```

---

## Conexión SQL Server

- **Host**: `srv-dwh-grupopoint.database.windows.net` (Azure SQL Database)
- **BD**: `dwh-grupopoint-prod`
- **Puerto**: 1433, TLS encriptado, `trustServerCertificate: false`
- **Pool**: máx 10 conexiones, idle timeout 30s
- Los datos provienen de SAP B1 via Azure Data Factory (ETL)

### Vistas consultadas

| Vista | Descripción |
|-------|-------------|
| `dbo.stg_rpt_ventas_detallado` | Detalle de ventas (43 columnas). Filtro base: `Pais = 'Peru'`. Campos clave: `Fecha_Emision`, `Numero_SAP`, `Vendedor`, `Zona`, `Familia`, `Ingrediente_Activo`, `Razon_Social_Cliente`, `RUC_Cliente`, `Valor_Venta_Dolares`, `División`, `Maestro_Tipo`, `Tipo Documento` |
| `dbo.stg_estado_cuenta_jdt` | Estado de cuenta con fecha de corte. Campos: `Fecha_Corte`, `CardCode`, `Cli_Nombre`, `Cli_RUC`, `Cli_Vendedor`, `TD`, `Numero`, `F_Emision`, `F_Vcto`, `Dias`, `Moneda`, `ImporteOriginal`, `ACuenta`, `Saldo`, `Monto_Retencion` |

### Tablas propias de la intranet

| Tabla | Descripción |
|-------|-------------|
| `dbo.intranet_users` | Usuarios de la intranet. Columnas: `id`, `username` (UNIQUE), `password_hash` (bcrypt), `full_name`, `email`, `modules` (NVARCHAR(MAX) JSON array), `is_admin` BIT, `is_active` BIT, `last_login`, `created_at`, `updated_at`. Migración: `server/sql/001_intranet_users.sql`. Seed inicial: `admin / admin123` (is_admin=1). |
| `dbo.icb_*` (8 tablas) | **Inteligencia Comercial Beta** — Modelo dimensional para datos agrícolas peruanos. Dimensiones: `icb_dim_source` (9 fuentes SIEA/MIDAGRI/INEI/SENASA/PA), `icb_dim_crop` (9 cultivos: Papa, Tomate, Maíz, Arroz, Cebolla, Café, Palta, Cítricos, Uva), `icb_dim_region` (25 departamentos de Perú con centroides), `icb_dim_point_category` (6 categorías: Fungicidas, Insecticidas, Herbicidas, Biológicos, Coadyuvantes, Orgánicos). Hechos: `icb_fact_agri_market_snapshot`, `icb_fact_geo_resource`. Operación: `icb_etl_run_log`, `icb_stg_raw_document`. Migración: `server/sql/002_inteligencia_comercial.sql`. **Pendiente de ejecutar en Azure.** |

### Estado del mock

```typescript
// server/src/services/database.service.ts
const USE_MOCK_VENTAS = false; // Ventas consultan BD real
```

Auth ya no usa mock: usuarios viven en `dbo.intranet_users`. Cuando `USE_MOCK_VENTAS = true` se generan 500 registros ficticios con datos de marzo 2026.

---

## Autenticación

### Flujo completo

1. `POST /api/auth/login` → rate limit 20 req/15min, sin JWT requerido
2. `authController.login()` busca usuario en `dbo.intranet_users` y compara contraseña con bcrypt
3. Genera JWT payload: `{ userId, username, modules: string[], isAdmin: boolean }`, expira en 8h
4. Actualiza `last_login` del usuario
5. Frontend guarda token en `localStorage`, lo inyecta en cada request vía interceptor Axios
6. `GET /api/auth/me` (protegido) valida token y retorna datos actualizados del usuario
7. `authenticateToken` re-consulta `is_active` en BD en cada request → **desactivación bloquea login inmediato** (sin esperar expiración del JWT)
8. Si el token expira/es inválido o el usuario está inactivo → 401/403 → interceptor limpia localStorage y redirige a `/login`

### Usuario inicial

| Usuario | Nombre | Tipo | Password |
|---------|--------|------|----------|
| `admin` | Administrador | is_admin=1 (acceso total) | `admin123` |

Los demás usuarios se crean desde `/admin` (UI) o via `POST /api/users`.

---

## RBAC — Módulos por usuario

**Ya no existen roles.** Cada usuario tiene un arreglo `modules: string[]` que enumera los submódulos a los que tiene acceso. El usuario `admin` (is_admin=1) tiene acceso total, ignora la lista.

### Catálogo de módulos (`AppModule`)

```typescript
'dashboard_ventas' | 'presupuesto' | 'avance_comercial'
| 'cartera' | 'estado_cuenta'
| 'facturacion' | 'letras'
| 'alertas' | 'diccionario'
| 'inteligencia_comercial' | 'mapa_interactivo'
| 'comex'
```

Agrupados en la UI como: **Ventas** (dashboard/presupuesto/avance), **Crédito** (cartera/estado-cuenta), **Logística** (facturación/letras), **General** (alertas/diccionario), **Inteligencia Comercial Beta** (inteligencia_comercial/mapa_interactivo — debajo de Administración).

### Middlewares

```typescript
authenticateToken            // Valida JWT + re-verifica is_active en BD → req.user = { userId, username, modules, isAdmin }
requireModule(...modules)    // Admin pasa siempre; resto pasa si tiene AL MENOS uno de los módulos
requireAdmin()               // Solo is_admin=1
```

Ejemplo: `requireModule('facturacion', 'letras')` permite acceso a cualquier usuario con uno de los dos accesos de Logística.

---

## Módulos y Páginas

| Módulo | Ruta | Página | Descripción |
|--------|------|--------|-------------|
| Ventas | `/ventas/dashboard` | `DashboardVentas.tsx` | KPIs, gráficos por cliente/IA/vendedor/familia, filtros; tabla auditoría con detector de 11 inconsistencias (NC con costo positivo, signos invertidos, etc.) y detalle de transacciones paginado (100 filas/pág, export CSV, filtro solo anomalías) |
| Ventas | `/ventas/presupuesto` | `Presupuesto.tsx` (lazy) | Carga Excel, comparativo presupuesto vs real |
| Ventas | `/ventas/avance-comercial` | `AvanceComercial.tsx` (lazy) | Seguimiento de metas comerciales |
| Crédito | `/credito/cartera` | `Cartera.tsx` | KPIs cartera, por edad de deuda, por vendedor |
| Crédito | `/credito/estado-cuenta` | `EstadoCuenta.tsx` | Detalle cliente-documento, exporta Excel, trigger ADF |
| Logística | `/logistica/comprobantes` | `Facturacion.tsx` | Emails facturación M365, descarga attachments |
| Logística | `/logistica/letras` | `Letras.tsx` (lazy) | Gestión de letras — **en construcción** |
| — | `/alertas` | `Alertas.tsx` | Alertas SAP, órdenes no atendidas |
| — | `/diccionario` | `Diccionario.tsx` | Catálogos: familias, ingredientes, vendedores, zonas |
| — | `/admin` | `Admin.tsx` | Gestión usuarios (accesos por módulo, activar/desactivar, cambiar contraseña), presupuestos, logo corporativo (solo is_admin=1) |
| Inteligencia Comercial Beta | `/inteligencia/dashboard` | `InteligenciaComercial.tsx` (lazy) | KPIs catálogo (fuentes/cultivos/dptos/categorías/registros), filtros (cultivo/región/categoría PA/fuente), ranking cultivos por hectáreas, distribución por categoría, tabla fuentes con trazabilidad (URL, método, última ejecución), tabla snapshots con fecha publicación/captura, log ETL |
| Inteligencia Comercial Beta | `/inteligencia/mapa` | `MapaInteractivo.tsx` (lazy) | Mapa coroplético de Perú por departamento (react-simple-maps), escala por hectáreas, tooltip hover con cultivos y oportunidad, ranking top 10 departamentos, filtros cultivo + categoría PA |

---

## Integración Microsoft 365 / Azure

### Microsoft Entra ID (Azure AD)

Autenticación via MSAL client credentials flow (`@azure/msal-node`).
- **Tenant**: `00b4dd3d-e5d1-4ba6-84bd-94fa25b6e462`
- **App Registration**: `7f376f56-888a-4f00-b6fb-f3af08bdeddc`

### Microsoft Graph API (`graph.service.ts`)

**Alertas SAP** — mailbox `alertasSapPA@pointamericas.com`:
- Lee Sent Items del buzón
- Retorna últimos N emails con subject, destinatarios, fecha, preview

**Facturación** — mailbox `facturacionpointandina@pointamericas.com`:
- Lee Sent Items con paginación (`top`, `skip`, filtros de fecha, búsqueda)
- Parsea automáticamente: tipo doc (Factura/Guía/NC/ND), número (F001-XXXXXXXX), cliente, fecha emisión
- Descarga adjuntos (PDF, XML) en base64

### Azure Data Factory (`datafactory.service.ts`)

Pipeline `FPL_Estado_cuenta` en `df-pointandina-prod`:
- `triggerPipeline(fechaCorte)` → dispara pipeline, retorna `runId`
- `getPipelineStatus(runId)` → estados: Queued / InProgress / Succeeded / Failed
- El Admin lo dispara desde `/credito/estado-cuenta` para recalcular datos con nueva fecha de corte

---

## Rutas API Completas

```
# Auth
POST   /api/auth/login                           Sin JWT, rate limit 20/15min
GET    /api/auth/me                              JWT required

# Ventas
GET    /api/ventas/kpis                          JWT + dashboard_ventas
GET    /api/ventas/por-cliente
GET    /api/ventas/por-ingrediente-activo
GET    /api/ventas/por-vendedor
GET    /api/ventas/por-familia
GET    /api/ventas/diarias
GET    /api/ventas/filtros
GET    /api/ventas/detalle                       JWT + dashboard_ventas — Detalle transacciones (5000 filas, incluye alerta_signo para NC con costo positivo)

# Cartera
GET    /api/cartera/kpis                         JWT + cartera
GET    /api/cartera/por-edad
GET    /api/cartera/por-vendedor
GET    /api/cartera/transacciones
GET    /api/cartera/estado-cuenta
GET    /api/cartera/estado-cuenta/filtros
GET    /api/cartera/estado-cuenta/resumen
GET    /api/cartera/estado-cuenta/export         Descarga XLSX
POST   /api/cartera/estado-cuenta/generar        Trigger ADF pipeline
GET    /api/cartera/estado-cuenta/pipeline-status/:runId

# Alertas
GET    /api/alertas/sap                          JWT + alertas
GET    /api/alertas/ordenes-no-atendidas
GET    /api/alertas/resultado/:id
GET    /api/alertas/pedidos-rechazados
GET    /api/alertas/emails
GET    /api/alertas/emails/:messageId
GET    /api/alertas/emails/status

# Facturación (M365 Graph)
GET    /api/facturacion/emails                   JWT + dashboard_ventas
GET    /api/facturacion/vendedores
GET    /api/facturacion/emails/:id/attachments
GET    /api/facturacion/emails/:id/attachments/:attId/download
GET    /api/facturacion/status

# Diccionario
GET    /api/diccionario                          JWT

# Configuración
GET    /api/config/logo                          Sin JWT (logo público)
POST   /api/config/logo                          JWT + admin (subir logo)

# Presupuesto
GET    /api/budget/years                         JWT
GET    /api/budget/:year
GET    /api/budget/:year/summary
GET    /api/budget/:year/:month
POST   /api/budget/upload                        JWT + admin
POST   /api/budget/upload-excel                  JWT + admin, multipart/form-data
DELETE /api/budget/:year                         JWT + admin

# Usuarios (admin)
GET    /api/users                                JWT + admin  — lista usuarios
POST   /api/users                                JWT + admin  — crea usuario (username, password, full_name, email, modules[])
PUT    /api/users/:id                            JWT + admin  — edita full_name, email, modules, is_active
PUT    /api/users/:id/password                   JWT + admin  — cambia contraseña (min 4 chars)
PATCH  /api/users/:id/active                     JWT + admin  — activa/desactiva (bloquea login inmediato)
DELETE /api/users/:id                            JWT + admin  — elimina usuario (no permite borrar admin ni a sí mismo)

# Inteligencia Comercial Beta
GET    /api/inteligencia/meta                    JWT + (inteligencia_comercial | mapa_interactivo) — KPIs catálogo
GET    /api/inteligencia/sources                 Lista fuentes con trazabilidad y última ejecución
GET    /api/inteligencia/crops                   Catálogo de cultivos
GET    /api/inteligencia/regions                 25 departamentos del Perú
GET    /api/inteligencia/categories              6 categorías Point Andina
GET    /api/inteligencia/snapshots               Snapshots filtrables (crop_id, region_id, category_id, source_id, from_date, to_date, limit)
GET    /api/inteligencia/geo-summary             Agregado por departamento para mapa (crop_id, category_id)
GET    /api/inteligencia/top-crops               Ranking de cultivos por hectáreas
GET    /api/inteligencia/etl-runs                Log de ejecuciones ETL

# Health
GET    /api/health                               Sin JWT
```

---

## Reglas de Negocio Importantes

- **País**: filtro **abierto** — el dashboard de ventas consolida todos los países que vende Point Andina S.A. (Peru + ventas inter-filial Ecuador). Esto cuadra con el reporte de Finanzas
- **Letras CC fijo**: todo email enviado desde Letras (manual o bot) incluye automáticamente `cobranzas@pointamericas.com` en CC (regla validada en backend, no se puede saltar desde UI)
- **País legacy** (referencia): el filtro original era `Pais = 'Peru'`
- **Fecha base**: `Fecha_Emision` es la fecha canónica de una venta
- **Nutricionales**: `Familia IN ('Nutricional', 'Bioestimulantes')`
- **Anticipos**: cuentan como ventas en los KPIs
- **Notas de Débito**: se incluyen solo para productos (no servicios)
- **Divisiones**: AGROCHEM, BIOSCIENCE
- **Maestro_Tipo**: FOCO, EN VIVO, OTROS

---

## Comandos de Desarrollo

```bash
# Desde la raíz del proyecto
npm run dev          # Levanta client (5173) + server (3001) en paralelo

# Por separado
npm run dev:client   # cd client && vite
npm run dev:server   # cd server && tsx watch src/index.ts

# Build producción
npm run build        # Compila client + server
npm start            # Sirve desde server/dist (Express sirve también el client/dist)
```

---

## Convenciones de Código

- Respuestas API siempre: `{ success: boolean, data?: T, message?: string }`
- Fechas: formato `YYYY-MM-DD` como string en API, `Date` solo en runtime
- Tailwind: clases custom `btn-primary`, `input-field`, `card` definidas en index.css
- Colores corporativos: `brand-*` (verde Point Andina), `accent-*` (amarillo/dorado)
- UI en español: todos los textos visibles al usuario en español
- Lazy loading en páginas secundarias (Presupuesto, AvanceComercial, Letras)

---

## Estado del Proyecto (al 2026-04-28)

| Componente | Estado |
|------------|--------|
| Login / Auth | Completo (BD real — `dbo.intranet_users`) |
| Dashboard Ventas | Completo |
| Presupuesto | Completo |
| Avance Comercial | Completo |
| Cartera | Completo |
| Estado de Cuenta | Completo (BD real) |
| Alertas SAP | Completo |
| Facturación / Comprobantes | Completo (M365) |
| Letras | Completo (envío con adjunto + bot programado + tracking aperturas + CC fijo cobranzas) |
| Diccionario | Completo |
| Admin (usuarios con accesos granulares + logo + presupuestos) | Completo |
| RBAC por roles | **Eliminado** — reemplazado por accesos por módulo a nivel usuario |
| Inteligencia Comercial Beta — Fase 1 (infraestructura) | **Completo** — Páginas, rutas, sidebar, backend service/routes, API client, migración SQL |
| Inteligencia Comercial Beta — Migración Azure SQL | **Pendiente** — ejecutar `server/sql/002_inteligencia_comercial.sql` en `dwh-grupopoint-prod` |
| Inteligencia Comercial Beta — Fase 2 (ETL) | **Completo** — 9 collectors, framework runner, scheduler diario/semanal, panel admin UI, endpoints manuales |
| Inteligencia Comercial Beta — Fase 3 (Parsing real + Insights) | **Completo** — pdf-parse instalado, 3 parsers (PDF, HTML tables, CSV), 4 collectors enriquecidos (MIDAGRI, INEI, SIEA superficie, Datos Abiertos), Top Oportunidades UI, modal detalle, export Excel |
| Inteligencia Comercial Beta — Fase 4 (Gap Analysis) | **Completo** — Cruce snapshots × ventas SAP reales, 4 endpoints (market-gap, opportunity-by-crop, executive-summary, recommendations), UI con 3 nuevas secciones (Resumen Ejecutivo, Recomendaciones, Brecha por Dpto), toggle mapa hectáreas↔penetración, collector baseline con datos curados 80 filas |
| Inteligencia Comercial Beta — Bloque Competidores (COMEX) | **Completo infraestructura** — Submenú "Competidores" con 4 submódulos: Dashboard Competidores, Partidas Arancelarias, Competidores, Mapa de Flujos. 6 tablas icb_cx_*, 32 partidas, 22 competidores seeded, 23 países, 20 productos, 10 fuentes COMEX nuevas. Baseline con ~9,000 operaciones representativas del mercado (NO cruza con Point Andina aún). Tabla "Fuentes Externas" visible en los 4 submódulos |
| Dashboard Ventas — Auditoría | **Completo** — Detector de 11 inconsistencias (anomalías de signo en NC, Anticipos, ND). Tabla de detalle de transacciones (5000 filas, paginada 100/pág, filtro tipo FACTURA activo por defecto, export CSV, flag `alerta_signo`). **Visible solo para admin** (`is_admin=1`) |
| Dashboard Ventas — Filtro país | **Abierto** (sin filtro `Pais='Peru'`) — todas las queries muestran consolidado Peru + Ecuador (ventas inter-filial Point Andina S.A.). 19 ocurrencias removidas en `database.service.ts` |
| Letras — Tracking de envíos y aperturas | **Completo** — Badge Bot/Manual + timeAgo en columna "Estado envío". Columna "Aperturas" con icono ojo + contador real/proxy + modal `OpensDetailModal` con resumen por destinatario y detalle de últimas 100 aperturas. Tracking pixel público en `/api/track/letras/:token.gif` (sin auth). Detección automática de proxies de email (Gmail/Outlook). Tabla `dbo.intranet_letras_email_opens` |
| Letras — CC fijo cobranzas | **Completo** — `cobranzas@pointamericas.com` siempre se incluye en CC (manual y bot automático). El campo CC en UI viene precargado, y backend valida que esté presente antes de enviar |
| Bot Venta Diaria Uruguay | **Completo** — Pestaña Admin "Venta Diaria Uruguay" (solo admin). Genera Excel `YYYY-MM.xlsx` con venta de Point Andina Perú y lo deja en SharePoint Uruguay (`/sites/{root}` → subsitio Uruguay → biblioteca "Carpetas Individuales"). 3 modos: scheduler diario (hora parametrizable Lima), ejecución manual a demanda con rango fechas, "ejecutar ahora" D-1/Hoy. Lógica idempotente (descarga, remueve filas del rango, reagrupa, sube). Auditoría en `dbo.uruguay_bot_runs`. **Bloqueado por permiso Azure AD `Sites.ReadWrite.All`** (lectura OK, escritura 403) |
| Inteligencia Comercial — Mapa Interactivo | **Reorientado** — Quitado cruce SAP (toggle Brecha + tooltip ventas/penetración/gap). Tooltip ahora muestra perfil agrícola del depto (% nacional, hectáreas, # cultivos distintos, cultivo principal con superficie y grupo, clase SENASA dominante, lista cultivos). Filtro renombrado "Categoría Point Andina"→"Clasificación SENASA" |
| Inteligencia Comercial — Reconciliación marzo 2026 | **Completo** — Marzo cuadra al centavo con Finanzas: venta $1,317,393.64 ✓ · costo $1,057,286.70 (Δ +$0.02) · margen 19.74%. Correcciones aplicadas: dedup 5 filas Ecuador BACB000008, fix doble-conteo costo línea QHER000001 (1 factura con 2 líneas), fix costos NULL/0 en 5 BACB Ecuador con valores Excel |

---

## Inteligencia Comercial Beta (detalle de implementación)

### Arquitectura Fase 1 (al 2026-04-18)

**Frontend** (4 archivos principales):
- `client/src/pages/InteligenciaComercial.tsx` (~570 líneas) — Vista analítica completa
- `client/src/pages/MapaInteractivo.tsx` (~390 líneas) — Mapa coroplético con react-simple-maps
- `client/src/services/api.ts` → `inteligenciaApi` con 9 endpoints
- `client/src/components/layout/Sidebar.tsx` → `afterAdminModules` renderizado debajo de Administración

**Backend** (3 archivos):
- `server/src/services/inteligencia.service.ts` (~280 líneas) — Queries SQL a tablas `icb_*`
- `server/src/routes/inteligencia.routes.ts` (~150 líneas) — 9 endpoints REST
- `server/src/services/database.service.ts` → `ALL_MODULES` amplía 9→11 módulos

**Base de datos**:
- `server/sql/002_inteligencia_comercial.sql` — Migración completa con 8 tablas + seeds

### Fuentes de datos definidas (según propuesta)

| Fuente | URL | Método | Frecuencia |
|--------|-----|--------|-----------|
| SIEA Índice Estadísticas | `siea.midagri.gob.pe/portal/publicaciones/informacion-estadistica` | scraping HTML | Diaria |
| SIEA Superficie Agrícola | `siea.midagri.gob.pe/portal/informativos/superficie-agricola-peruana` | scraping HTML + descarga | Semanal |
| MIDAGRI Anuarios | `gob.pe/institucion/midagri/colecciones/5149-anuarios-estadisticas-de-produccion-agropecuaria` | scraping + PDF | Semanal |
| INEI ENA | `gob.pe/institucion/inei/informes-publicaciones/6879473-...` | parseo PDF | Semanal |
| Datos Abiertos ENA 2024 | `datosabiertos.gob.pe/dataset/encuesta-nacional-agropecuaria-ena-2024-...` | dataset download | Semanal |
| SENASA Portal | `gob.pe/senasa` | scraping HTML | Diaria (descubrimiento) |
| SENASA Reportes | `gob.pe/institucion/senasa/tema/reportes-o-registros` | scraping HTML | Diaria |
| SENASA SIGIA Cultivo | `servicios.senasa.gob.pe/SIGIAWeb/sigia_consulta_cultivo.html` | browser/scraping | Semanal |
| Point Andina Productos | `pointandina.pe/productos/` | **Tabla maestra interna** (bloqueo 406) | Bajo demanda |

### Resoluciones técnicas clave

1. **Tabla maestra interna Point Andina**: por el bloqueo `Mod_Security` con error 406, las categorías se mantienen fijas en `icb_dim_point_category` (6 categorías iniciales). No hay dependencia de scraping frágil.
2. **Servicio tolerante a ausencia de tablas**: `inteligencia.service.ts` verifica `tablesExist()` antes de cada query. Si las tablas `icb_*` no existen aún, retorna datos vacíos sin romper la UI.
3. **UI con banner de estado**: ambas páginas muestran si las tablas existen (verde) o si faltan por migrar (ámbar).
4. **Trazabilidad visible**: cada snapshot muestra fuente, URL, fecha publicación, fecha captura, fecha ingreso. La tabla de fuentes muestra última ejecución ETL con estado.
5. **Escala coroplética**: 8 niveles de verde según hectáreas (0 a >300k). Tooltip hover con cultivos y oportunidad.

### Endpoints Backend Detallados

- `GET /api/inteligencia/meta` → `{ sources, crops, regions, categories, snapshots, last_run, last_run_status, tables_exist }`
- `GET /api/inteligencia/sources` → `Source[]` con last_run_at, last_run_status, last_run_records
- `GET /api/inteligencia/crops` → Catálogo normalizado
- `GET /api/inteligencia/regions` → 25 departamentos con lat/lon
- `GET /api/inteligencia/categories` → 6 categorías PA con grupo
- `GET /api/inteligencia/snapshots?crop_id&region_id&category_id&source_id&from_date&to_date&limit`
- `GET /api/inteligencia/geo-summary?crop_id&category_id` → Agregado por departamento
- `GET /api/inteligencia/top-crops?limit` → Ranking hectáreas
- `GET /api/inteligencia/etl-runs?limit` → Log de auditoría

### Permisos RBAC

Cualquier endpoint de inteligencia requiere JWT + al menos UNO de los módulos: `inteligencia_comercial` O `mapa_interactivo`. El admin pasa siempre.
Desde `/admin`, los checkboxes "Inteligencia Comercial" y "Mapa Interactivo" (grupo "Inteligencia Comercial Beta") ahora se persisten correctamente (antes `sanitizeModules()` los descartaba porque no estaban en `ALL_MODULES`).

### Pendiente para producción

1. **Ejecutar migración SQL 002** en `dwh-grupopoint-prod`
2. **Otorgar módulos** a usuarios específicos desde `/admin`
3. **Ejecutar primer ETL** desde el panel admin en `/inteligencia/dashboard` (botón "Ejecutar TODO")

---

## Fase 2 ETL — Inteligencia Comercial Beta (implementada)

### Estructura del framework ETL

```
server/src/services/etl/
├── index.ts                              # Registry + API pública (runOne, runAll, runByFrequency)
├── types.ts                              # CollectorContext, CollectorResult, ParsedSnapshot, Frequency
├── http.ts                               # fetch helper con UA, timeout, 1 retry
├── normalizers.ts                        # loadCatalogMaps, detectCrop, detectRegion, detectCategory, parseHectares, parsePublicationDate
├── scoring.ts                            # scoreSnapshot → opportunity_score + level
├── runner.ts                             # runCollector: abre log, ejecuta, persiste snapshots con hash, cierra log
├── scheduler.ts                          # setTimeout-based: daily 02:30 Lima, weekly lunes 03:00 Lima
└── collectors/
    ├── base.collector.ts                 # Clase abstract + extractLinks/extractTitle/classifyDocumentType
    ├── siea-index.collector.ts           # daily  · scraping HTML índice publicaciones SIEA
    ├── siea-superficie.collector.ts      # weekly · scraping recursos superficie agrícola
    ├── midagri-anuarios.collector.ts     # weekly · catalogación PDFs anuarios MIDAGRI
    ├── inei-ena.collector.ts             # weekly · detección PDFs ENA en cdn.www.gob.pe
    ├── datos-abiertos-ena.collector.ts   # weekly · CKAN recursos ENA 2024
    ├── senasa-root.collector.ts          # daily  · portal raíz SENASA (descubrimiento)
    ├── senasa-reportes.collector.ts      # daily  · reportes y registros SENASA
    ├── senasa-sigia.collector.ts         # weekly · SIGIA consulta cultivo (extrae opciones de select)
    └── point-andina-cat.collector.ts     # on_demand · maestra interna (no scraping por bloqueo 406)
```

### Flujo de ejecución

1. Admin hace click en "Ejecutar" para un collector (o "Ejecutar TODO")
2. `POST /api/inteligencia/etl/run/:sourceCode` o `/run-all`
3. `runCollector()`:
   - Abre registro `RUNNING` en `icb_etl_run_log` con runId
   - Carga `CatalogMaps` (cultivos, regiones, categorías, fuentes)
   - Llama al collector → retorna `ParsedSnapshot[]`
   - Para cada snapshot: calcula SHA-256 hash → UPSERT en `icb_fact_agri_market_snapshot`
   - (Opcional) persiste `rawPayload` en `icb_stg_raw_document`
   - Cierra log con `SUCCESS | FAILED | PARTIAL` y counts

### Deduplicación

Hash SHA-256 basado en: `source_id | document_url | period_label | crop_id | region_id`. Índice único parcial `ux_icb_snap_hash` garantiza no duplicados. Segundo run hace UPDATE en lugar de INSERT.

### Opportunity Score

Calculado en `scoring.ts` — 0..100:
- Base 20
- +40 si detectó cultivo
- +15 si detectó región
- +15 si detectó categoría PA
- +10 si hay hectáreas numéricas

Niveles: Alta (≥70), Media (≥40), Baja (resto).

### Scheduler automático

- **Diario** (02:30 Lima = 07:30 UTC): collectors con `frequency='daily'` — SIEA_INDEX, SENASA_ROOT, SENASA_REPORTES
- **Semanal** (lunes 03:00 Lima = 08:00 UTC): collectors con `frequency='weekly'` — SIEA_SUPERFICIE, MIDAGRI_ANUARIOS, INEI_ENA, DATOS_ABIERTOS_ENA, SENASA_SIGIA
- **On-demand**: POINT_ANDINA_CAT (solo manual)

El scheduler se inicia automáticamente si `NODE_ENV=production` o `ETL_AUTO_START=1`. En dev local NO arranca por default para evitar ruido.

### Endpoints ETL (todos requieren admin)

```
GET    /api/inteligencia/etl/collectors              Lista collectors + estado scheduler
POST   /api/inteligencia/etl/run/:sourceCode         Ejecuta un collector específico
POST   /api/inteligencia/etl/run-all                 Ejecuta TODOS los collectors (long-running)
POST   /api/inteligencia/etl/run-by-frequency/:freq  Ejecuta por frecuencia (daily|weekly|on_demand)
GET    /api/inteligencia/etl/scheduler               Estado del scheduler interno
```

### UI Admin ETL

En `/inteligencia/dashboard`, si el usuario es admin (`isAdmin=true`), aparece un **Panel ETL — Admin** entre la tabla de snapshots y el log ETL, con:
- Indicador del scheduler (Activo/Detenido)
- Botón "Ejecutar TODO"
- Grid de 9 tarjetas (una por collector) con descripción y botón "Ejecutar" individual
- Banner de resultado con status + records insertados/actualizados

### Decisiones técnicas clave

1. **Sin dependencias pesadas**: no se usó cheerio ni pdf-parse. Los collectors usan `fetch` nativo + regex simple. Los PDFs se catalogan pero no se extrae su texto (puede hacerse en Fase 3 con `pdfjs-dist` si se requiere).
2. **Tolerante a ausencia de tablas**: `etlTablesReady()` verifica antes de cada run. Si faltan las tablas icb_*, los endpoints devuelven 400 con mensaje explícito.
3. **Scheduler basado en setTimeout**: sin dependencias de cron. Calcula `msUntilNext()` para despertar a la hora exacta. Sobrevive reinicios del proceso (vuelve a calcular al arrancar).
4. **Point Andina sin scraping**: por el bloqueo 406, el collector genera snapshots desde la tabla maestra `icb_dim_point_category` (6 categorías fijas).
5. **Hash de deduplicación**: segundo run actualiza en vez de duplicar — idempotente.
6. **Todos los snapshots se scoran** automáticamente antes de persistir.

---

## Fase 3 ETL — Parsing real + Insights (implementada)

### Dependencias nuevas

- `pdf-parse@1.1.1` + `@types/pdf-parse` — extracción pura de texto de PDFs, sin rendering (single dep liviana)

### Parsers en `server/src/services/etl/parsers/`

| Parser | Función | Uso |
|--------|---------|-----|
| `pdf.ts` | `fetchAndParsePdf(url)` descarga + parsea hasta 20 páginas, cap 15MB. `extractHectareMentions()` y `extractProductionMentions()` con regex contextuales (80 chars alrededor) | MIDAGRI anuarios + INEI ENA |
| `html-tables.ts` | `extractTables(html)` extrae `<table>` a matrices `{ headers, rows, caption }` sin cheerio | SIEA Superficie |
| `csv.ts` | `fetchAndParseCsv(url)` con auto-detección de delimitador (`,`/`;`/`\t`), respeta comillas dobles, max 1000 filas, cap 5MB | Datos Abiertos ENA |

### Collectors enriquecidos

| Collector | Fase 3 |
|-----------|--------|
| `midagri-anuarios` | Descarga los 3 PDFs más recientes, extrae menciones de hectáreas y producción con detección de cultivo/región en el contexto. Genera snapshots por dato extraído |
| `inei-ena` | Descarga el primer PDF oficial, extrae menciones de hectáreas con crop/region detection + busca cifra total de productores agropecuarios |
| `siea-superficie` | Parsea las `<table>` estructuradas del HTML, matchea columnas por headers (departamento/cultivo/hectareas) y genera snapshot por fila |
| `datos-abiertos-ena` | Descarga el primer `.csv` del dataset, detecta columnas clave, genera snapshots por fila útil + snapshot de metadata del CSV |

Los otros 5 collectors (SIEA Index, Senasa *, Point Andina) mantienen su comportamiento de Fase 2 (catalogación).

### Endpoints nuevos

```
GET    /api/inteligencia/top-opportunities?limit&min_score   Snapshots con score >= N
GET    /api/inteligencia/snapshots/:id                       Detalle incluyendo raw_payload
GET    /api/inteligencia/export/snapshots                    Excel (.xlsx) con filtros aplicados
```

### UI Fase 3 en `/inteligencia/dashboard`

1. **Bloque destacado "Top Oportunidades"** (tarjetas 3×3) sobre fondo gradient ámbar/verde — muestra los 9 snapshots con score ≥ 70, clicables para abrir detalle
2. **Modal de detalle** (overlay con backdrop-blur) — muestra:
   - Título + URL del documento con enlace externo
   - 12 campos en grid 2 col (Fuente, Tipo, Cultivo, Grupo, Departamento, Categoría PA, Período, Hectáreas, Producción, Oportunidad+Score, F. Publicación, F. Captura)
   - Nota de negocio (business_note) con contexto del extracto
   - Raw payload (si está en staging) en bloque de código monospace
3. **Botón "Export Excel"** en la tabla de snapshots — descarga XLSX con:
   - 17 columnas brandadas (header verde Point Andina #00A651)
   - Filtros aplicados (respeta cropId/regionId/categoryId/sourceId)
   - Conditional formatting para nivel Alta/Media
   - Hasta 5000 registros
4. **Columna "Detalle"** con icono ojo en la tabla de snapshots

### Decisiones técnicas Fase 3

1. **pdf-parse, no pdfjs-dist**: única dep agregada, ~200KB, sin render ni fontes; suficiente para extraer texto
2. **Cap estricto de páginas/bytes**: PDFs hasta 20 páginas y 15MB, CSV hasta 1000 filas y 5MB — evita procesos de minutos
3. **Contexto 80 chars alrededor** de cada cifra extraída para que detectCrop/detectRegion tengan suficiente información
4. **Filtra cifras < 100 ha y < 50 toneladas** como ruido
5. **Export Excel server-side** con ExcelJS (ya presente); filtros por query string igual que en estado cuenta
6. **Modal con z-50 + backdrop-blur**: consistente con patrones existentes (ej: form Admin, Letras send modal)
7. **No se hace HTTP en el modal**: `getSnapshotDetail` devuelve datos + raw_payload en una sola llamada

---

## Fase 4 ETL — Gap Analysis (cruce con ventas SAP reales)

### Servicios nuevos

**`server/src/services/gap.service.ts`** — cruza `icb_fact_agri_market_snapshot` con `stg_rpt_ventas_detallado`:

| Método | Descripción |
|--------|-------------|
| `getMarketGapByDepartment()` | Por departamento: hectáreas potenciales + ventas SAP últimos 12m → USD/ha y gap |
| `getOpportunityByCropRegion(limit)` | Cultivo × departamento con penetración Alta/Media/Baja |
| `getExecutiveSummary()` | KPIs globales: hectáreas totales, ventas 12m, USD/ha, gap total |
| `getRecommendations(limit)` | Top oportunidades no atendidas con familia sugerida + note textual |

### Datos curados — collector `BASELINE_PE_CROPS`

Migración SQL `003_baseline_source.sql` registra fuente interna. Collector `baseline-crops.collector.ts` inyecta 80 snapshots representativos de superficie agrícola peruana por cultivo × departamento (datos públicos MINAGRI/SIEA aproximados):

- 9 cultivos × ~9 departamentos cada uno
- Cada uno con `hectares`, `cropCode`, `regionCode`, `categoryCode`, score ≥ 70
- Todos marcados como alta oportunidad inicial para poblar dashboards

Totales actuales (validados): Café 423k ha · Arroz 400k · Papa 283k · Maíz 212k · Cítricos 84k · Palta 69k · Uva 34k · Cebolla 18k · Tomate 7k · 171 snapshots totales · 23 departamentos con datos.

### Endpoints Fase 4

```
GET /api/inteligencia/market-gap             Brecha por departamento (array MarketGapRow)
GET /api/inteligencia/opportunity-by-crop    Oportunidades cultivo × dpto (array CropGapRow)
GET /api/inteligencia/executive-summary      Resumen ejecutivo {hectareas_totales, ventas_12m_usd, USD/ha, gap_total_usd, ...}
GET /api/inteligencia/recommendations        Top N recomendaciones con familia_sugerida + note
```

### UI Fase 4 en `/inteligencia/dashboard`

Nuevas secciones (renderizadas entre "Top Oportunidades" y "Snapshots"):

1. **Resumen Ejecutivo de Brecha** (gradient brand/amber) — 6 KPI cards horizontales:
   - Hectáreas · Ventas 12m · USD/ha · Dptos. con data · Alta oportunidad · Gap total USD
2. **Recomendaciones Comerciales** (10 filas) — ranking con cultivo → departamento → familia sugerida + nota explicativa
3. **Brecha Comercial por Departamento** — tabla con 8 columnas (dpto, hectáreas, snapshots, ventas USD, tx, USD/ha, penetración, gap)

### UI Fase 4 en `/inteligencia/mapa`

**Toggle Hectáreas ↔ Brecha** con dos paletas:
- `hectares`: verdes 0-300k ha (como antes)
- `gap`: rojos (baja penetración / alta oportunidad) → amarillos → verdes (alta penetración)

Tooltip expandido: cuando hay gap data muestra **Ventas 12m · USD/ha · Penetración · Gap USD** adicional.

### Cálculo del Gap

```
TARGET_USD_PER_HA = 80   (referencia mercado agroquímicos PE)
potential_usd = hectareas × 80
gap_usd = max(0, potential_usd - ventas_actuales_12m)

Penetración:
  Alta:  ventas_usd/ha ≥ 56  (70% del target)
  Media: ventas_usd/ha ≥ 24  (30% del target)
  Baja:  resto
```

Los valores de penetración se invierten para `opportunity_level` en `getOpportunityByCropRegion`: baja penetración = alta oportunidad comercial.

### Heurísticas de recomendación

Cruce cultivo → familia sugerida (editable en código):

| Cultivo | Familia PA recomendada | Razón |
|---------|----------------------|-------|
| PAPA | FUNGICIDAS | Mildiu, rizoctonia |
| ARROZ | HERBICIDAS | Malezas acuáticas |
| MAIZ | HERBICIDAS | Malezas en siembra directa |
| CAFE | FUNGICIDAS | Roya del café |
| PALTA | INSECTICIDAS | Queresas, trips |
| UVA | FUNGICIDAS | Oidio, botrytis |
| CEBOLLA | FUNGICIDAS | Mildiu |
| TOMATE | INSECTICIDAS | Mosca blanca, trips |
| CITRICOS | INSECTICIDAS | Queresas, minador |

### Decisiones técnicas Fase 4

1. **Agregación en JS, no en SQL**: 2 queries independientes (hectáreas + ventas SAP) se cruzan en JS por nombre normalizado de departamento. Permite tolerancia si un departamento tiene solo uno u otro dato.
2. **Ventas SAP últimos 12m**: filtro `Fecha_Emision >= DATEADD(MONTH, -12, ...)` para reflejar realidad comercial reciente.
3. **Columna real**: `[Valor_Venta_Dolares_Presentación]` (con tilde y corchetes) — corregido durante el testeo.
4. **`.catch(() => ...)` en Promise.all del cliente**: si gap endpoints fallan (por ejemplo en ambientes sin ventas SAP), las otras vistas siguen cargando sin romper.
5. **Datos curados como collector**: aprovecha el mismo pipeline (hash dedup, score, logs ETL) — re-ejecutable desde panel admin como "BASELINE_PE_CROPS".
6. **Dos paletas de mapa**: `COLOR_SCALE_HA` (verdes) y `COLOR_SCALE_GAP` (rojos→verdes). `getColor(value, mode)` selecciona la correcta.

---

## Bloque Competidores (COMEX) — Inteligencia Comercial Beta

Submenú "Competidores" dentro de Inteligencia Comercial Beta. **No cruza con Point Andina ni SAP** — sólo data externa pública de comercio exterior peruano.

### Estructura del sidebar

```
Inteligencia Comercial Beta
├── Inteligencia Comercial         (agrícola - existente)
├── Mapa Interactivo               (agrícola - existente)
└── Competidores (submenú)
    ├── Dashboard Competidores     (KPIs, tendencias, países origen, familias PA)
    ├── Partidas Arancelarias      (detalle por partida HS + familia PA)
    ├── Competidores               (ranking de importadores, market share)
    └── Mapa de Flujos             (origen → Perú, por país)
```

### Modelo de datos Azure SQL (prefijo `icb_cx_`)

**Dimensiones**:
- `icb_cx_dim_partida` — 32 partidas arancelarias de capítulos **3808** (plaguicidas: insecticidas, fungicidas, herbicidas, desinfectantes, reguladores), **3105** (fertilizantes NPK), **3002** (biológicos), **2930** (precursores). Cada una con `familia_pa` (INSECTICIDAS/FUNGICIDAS/HERBICIDAS/NUTRICIONALES/BIOLOGICOS/COADYUVANTES/ORGANICOS) y `tipo_grupo` (Plaguicidas/Fertilizantes/Biologicos/Precursores)
- `icb_cx_dim_empresa` — 22 competidores seeded con RUC placeholder: Bayer, Syngenta, FMC, BASF, Corteva, UPL, Adama, Farmex, Silvestre, TQC, Montana, Agroklinge, Neoagrum, Agrovet, Drokasa, Rotam, Sumitomo, Nufarm, Stoller, Valagro, Serfi, Bioqualitas. Campos `es_competidor`, `es_point_andina` (reservado para futuro), `tipo_empresa` (Multinacional/Nacional/Distribuidor/Formulador)
- `icb_cx_dim_pais` — 23 países (CN, IN, US, DE, BR, AR, ES, IT, IL, MX, JP, GB, FR, BE, NL, CH, CL, CO, EC, TR, KR, AU, PE) con centroide lat/lon
- `icb_cx_dim_producto` — 20 ingredientes activos comunes: Glifosato, Cipermetrina, Mancozeb, Imidacloprid, Carbendazim, etc.

**Hechos**:
- `icb_cx_fact_importacion` — una fila por operación DUA o snapshot mensual. Campos: empresa_id, partida_id, pais_origen_id, producto_id, periodo (year/month), cantidad_kg, valor_cif_usd, valor_fob_usd, ad_valorem, puerto, DUA. Hash SHA-256 para dedup
- `icb_cx_fact_exportacion` — análogo para exportaciones

### Nuevas fuentes en `icb_dim_source` (10)

| source_code | Descripción | Método |
|-------------|-------------|--------|
| `SUNAT_TRANSPARENCIA` | SUNAT — Transparencia Aduanera | scraping HTML |
| `SUNAT_ADUANET` | SUNAT — Aduanet Consultas | scraping HTML |
| `BCR_COMEX` | BCR / BCRP — Series de comercio exterior | API JSON |
| `MINCETUR_ESTADISTICAS` | MINCETUR — Estadísticas | scraping HTML |
| `INEI_COMEX` | INEI — Estadísticas de comercio exterior | scraping HTML |
| `DATOS_ABIERTOS_COMEX` | Datos Abiertos Perú — Comercio exterior | dataset download |
| `ADEX_ESTADISTICAS` | ADEX — Asociación de Exportadores | scraping HTML |
| `CCL_COMEX` | CCL — Cámara de Comercio de Lima | scraping HTML |
| `SENASA_PLAGUICIDAS` | SENASA — Registro de plaguicidas | scraping HTML |
| `BASELINE_PE_COMEX` | Baseline Perú COMEX (curado) | internal |

### Endpoints backend (10)

Todos bajo `/api/inteligencia/comex/*`, protegidos por `requireModule('comex')`:

```
GET  /api/inteligencia/comex/meta              KPIs globales, último run ETL
GET  /api/inteligencia/comex/partidas          Catálogo de partidas
GET  /api/inteligencia/comex/empresas          Catálogo de empresas (competidores)
GET  /api/inteligencia/comex/paises            Catálogo de países
GET  /api/inteligencia/comex/importaciones     Filtrable: empresa, partida, país, año, mes, familia_pa
GET  /api/inteligencia/comex/ranking           Ranking competidores por valor CIF
GET  /api/inteligencia/comex/flows             Flujos origen (agregado por país)
GET  /api/inteligencia/comex/partida-resumen   Resumen por partida con CIF, kg, empresas
GET  /api/inteligencia/comex/monthly-trend     Tendencia mensual CIF/kg/operaciones
GET  /api/inteligencia/comex/by-familia        Distribución por familia PA
```

### Páginas frontend (4, lazy-loaded)

| Página | Ruta | Contenido |
|--------|------|-----------|
| `DashboardCOMEX.tsx` | `/inteligencia/comex/dashboard` | 6 KPIs (competidores, partidas, países, ops, CIF, kg) + tendencia mensual + pie familias PA + bar top países + tabla Fuentes Externas |
| `PartidasArancelarias.tsx` | `/inteligencia/comex/partidas` | Tabla con filtro familia + search, totales al pie, badges por familia + tabla Fuentes Externas |
| `Competidores.tsx` | `/inteligencia/comex/competidores` | Top 10 chart + tabla ranking completa con share % y barras de progreso + tabla Fuentes Externas |
| `MapaFlujosCOMEX.tsx` | `/inteligencia/comex/mapa-flujos` | Top 15 países como bar chart + tabla detalle con banderas emoji + share % + tabla Fuentes Externas |

### Baseline COMEX (`run-baseline-comex.ts`)

Inserta ~9,000 operaciones representativas del mercado peruano:
- 3 años (2024, 2025, 2026) × 12 meses × 22 competidores × 8 familias × 17 países principales
- Mercado total referencia: **USD 450M/año** (acorde a órdenes de magnitud SUNAT/ADEX)
- Distribución por share: Bayer 14.5%, Syngenta 12%, FMC 9%, BASF 7.5%, Farmex 6.5%, Silvestre 6%, UPL 5.5%, Corteva 5%, ...
- Distribución por país: **China 48%**, India 17%, USA 8%, Alemania 5%, Brasil 4%, ...
- Distribución por familia: Insecticidas 32%, Fungicidas 28%, Herbicidas 22%, Nutricionales 8%, Biológicos 4%, ...
- Estacionalidad agrícola PE: picos abril-julio (Mayo 11%, Junio 11%), valles enero-febrero
- Modulación de crecimiento YoY: 2024 × 0.90, 2025 × 1.00, 2026 × 1.08
- Hash SHA-256 por (source, year, month, empresa, partida, país) — UPSERT idempotente

### Sidebar actualizado

El NavModule `inteligencia` ahora tiene **children + subGroups** (patrón mixto). El render del Sidebar extendido soporta ambos: los 2 children planos arriba (Inteligencia Comercial, Mapa Interactivo) y el subGroup "Competidores" abajo con sus 4 children anidados.

### RBAC

Nuevo módulo `comex` agregado a:
- `ALL_MODULES` del backend (11 → 12 módulos)
- Admin `MODULE_GROUPS` en grupo "Inteligencia Comercial Beta" con label "Competidores / COMEX"
- Sidebar usa `canSee('comex')` por cada submódulo

### Reglas respetadas

1. **No cruza con Point Andina** — campo `es_point_andina` en `icb_cx_dim_empresa` existe pero no se usa
2. **No cruza con SAP** — consultas cerradas a `icb_cx_*` + `icb_dim_source/etl_run_log`; no hay joins con `stg_rpt_ventas_detallado`
3. **Sólo fuentes peruanas** — las 10 fuentes nuevas son instituciones peruanas
4. **Mismo diseño** — páginas con `kpi-card`, `chart-container`, `table-modern`, paleta `brand-*`
5. **Trazabilidad** — todas las operaciones tienen `source_id` y `created_at`

### Pendiente Fase 2 COMEX (cuando se autorice)

- Collectors reales: `bcr-comex.collector.ts` (API JSON del BCR — probablemente el más confiable), `sunat-transparencia`, `adex-estadisticas`, `inei-comex`, etc.
- Parser específico para PDFs de ADEX / INEI COMEX
- Mapa geográfico real con conexiones arco (D3 o react-simple-maps con líneas) para Mapa de Flujos
