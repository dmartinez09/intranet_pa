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

### Estado del mock

```typescript
// server/src/services/database.service.ts
const USE_MOCK_AUTH = true;    // Usuarios/roles siempre mock (no hay tabla en DWH)
const USE_MOCK_VENTAS = false; // Ventas consultan BD real
```

Cuando `USE_MOCK_VENTAS = true` se generan 500 registros ficticios con datos de marzo 2026.

---

## Autenticación

### Flujo completo

1. `POST /api/auth/login` → rate limit 20 req/15min, sin JWT requerido
2. `authController.login()` busca usuario (mock o BD) y compara contraseña con bcrypt
3. Genera JWT: `{ userId, username, roleId, roleName }`, expira en 8h
4. Frontend guarda token en `localStorage`, lo inyecta en cada request via interceptor Axios
5. `GET /api/auth/me` (protegido) valida token y retorna datos actualizados del usuario
6. Si el token expira o es inválido → 401/403 → interceptor limpia localStorage y redirige a `/login`

### Usuarios mock (USE_MOCK_AUTH=true)

| Usuario | Nombre | Rol | Password |
|---------|--------|-----|----------|
| `admin` | Administrador | Admin | `admin123` |
| `zmosquera` | Zaida Mosquera García | Jefe de Venta | `password` |
| `klopez` | Katye Lopez Montufar | Vendedor | `password` |
| `lquispe` | Liliana Quispe | Finanzas | `password` |

---

## RBAC — Roles y Módulos

### Roles disponibles

| Rol | Módulos accesibles |
|-----|-------------------|
| Admin | dashboard_ventas, cartera, alertas, admin, logistica, presupuesto |
| Jefe de Venta | dashboard_ventas, cartera, alertas, logistica, presupuesto |
| Vendedor | dashboard_ventas, alertas |
| Finanzas | dashboard_ventas, cartera, logistica, presupuesto |
| Logística | logistica, dashboard_ventas |
| Viewer | dashboard_ventas (solo lectura) |

### Middlewares

```typescript
authenticateToken   // Valida JWT → req.user
requireModule(m)    // Verifica permiso de módulo por rol
requireAdmin()      // Solo rol Admin
```

---

## Módulos y Páginas

| Módulo | Ruta | Página | Descripción |
|--------|------|--------|-------------|
| Ventas | `/ventas/dashboard` | `DashboardVentas.tsx` | KPIs, gráficos por cliente/IA/vendedor/familia, filtros |
| Ventas | `/ventas/presupuesto` | `Presupuesto.tsx` (lazy) | Carga Excel, comparativo presupuesto vs real |
| Ventas | `/ventas/avance-comercial` | `AvanceComercial.tsx` (lazy) | Seguimiento de metas comerciales |
| Crédito | `/credito/cartera` | `Cartera.tsx` | KPIs cartera, por edad de deuda, por vendedor |
| Crédito | `/credito/estado-cuenta` | `EstadoCuenta.tsx` | Detalle cliente-documento, exporta Excel, trigger ADF |
| Logística | `/logistica/comprobantes` | `Facturacion.tsx` | Emails facturación M365, descarga attachments |
| Logística | `/logistica/letras` | `Letras.tsx` (lazy) | Gestión de letras — **en construcción** |
| — | `/alertas` | `Alertas.tsx` | Alertas SAP, órdenes no atendidas |
| — | `/diccionario` | `Diccionario.tsx` | Catálogos: familias, ingredientes, vendedores, zonas |
| — | `/admin` | `Admin.tsx` | Gestión usuarios, roles, logo corporativo (solo Admin) |

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

# Usuarios
GET    /api/users                                JWT + admin
POST   /api/users                                JWT + admin
PUT    /api/users/:id                            JWT + admin
DELETE /api/users/:id                            JWT + admin
GET    /api/users/roles                          JWT + admin

# Health
GET    /api/health                               Sin JWT
```

---

## Reglas de Negocio Importantes

- **País**: todos los datos filtran `Pais = 'Peru'`
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

## Estado del Proyecto (al 2026-04-13)

| Componente | Estado |
|------------|--------|
| Login / Auth | Completo (mock) |
| Dashboard Ventas | Completo |
| Presupuesto | Completo |
| Avance Comercial | Completo |
| Cartera | Completo |
| Estado de Cuenta | Completo (BD real) |
| Alertas SAP | Completo |
| Facturación / Comprobantes | Completo (M365) |
| Diccionario | Completo |
| Admin (usuarios + logo) | Completo |
| Letras | Pendiente (ruta existe, página en construcción) |
| Auth con BD real | Pendiente (hoy usa mock) |
