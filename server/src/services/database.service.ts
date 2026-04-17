import { getDbPool, sql } from '../config/database';

// ============================================================
// DATABASE SERVICE - Queries contra SQL Server / Mock fallback
// ============================================================

// Auth/Users/Roles always use mock (no users table in DWH)
// Ventas use real data from stg_rpt_ventas_detallado
const USE_MOCK_AUTH = true;
const USE_MOCK_VENTAS = false;

// ---- Mock Data (Marzo 2026 - basado en Excel Avance de ventas) ----

const MOCK_VENDEDORES = [
  { codigo: 1, nombre: 'Carlos Ramirez', zona: 'Lima Norte', series: 'AGRO' },
  { codigo: 2, nombre: 'Ana Torres', zona: 'Ica', series: 'AGRO' },
  { codigo: 3, nombre: 'Luis Centurion', zona: 'La Libertad', series: 'COST' },
  { codigo: 4, nombre: 'Felix Espiritu', zona: 'Junin', series: 'SISE' },
  { codigo: 5, nombre: 'Pedro Bustamante', zona: 'Arequipa', series: 'AGRO' },
  { codigo: 6, nombre: 'Jose Rivas', zona: 'Piura', series: 'COST' },
  { codigo: 7, nombre: 'Kenyi Cunyas', zona: 'Huancavelica', series: 'SISE' },
  { codigo: 8, nombre: 'Maria Gonzales', zona: 'Lambayeque', series: 'AGRO' },
  { codigo: 9, nombre: 'Jhon Ortiz', zona: 'Cajamarca', series: 'DESA' },
  { codigo: 10, nombre: 'William Milian', zona: 'Amazonas', series: 'DESA' },
  { codigo: 11, nombre: 'Rosa Paredes', zona: 'Tacna', series: 'BIOS' },
  { codigo: 12, nombre: 'Jorge Villanueva', zona: 'Lima Sur', series: 'ONL' },
];

const MOCK_CLIENTES = [
  'L Y B SERVIC Y NEGOCIOS GRLES E.I.R.LTDA',
  'AGRO INVERSIONES GENERALES MENDEZ S.A.C.',
  'INVERSIONES QUIVEN S.A.C.',
  'AGROINDUSTRIAS SAN JACINTO S.A.A.',
  'DISTRIBUIDORA AGRICOLA DEL NORTE S.A.C.',
  'CAMPOSOL S.A.',
  'DANPER TRUJILLO S.A.C.',
  'GANDULES INC S.A.C.',
  'SOCIEDAD AGRICOLA VIRU S.A.',
  'COMPLEJO AGROINDUSTRIAL BETA S.A.',
  'AGRICOLA CERRO PRIETO S.A.',
  'GRUPO ROCIO S.A.',
  'AVO PERU SAC',
  'GREENLAND PERU S.A.C.',
  'HASS PERU S.A.',
];

const MOCK_FAMILIAS = ['PLAGUICIDA QUIMICO', 'PLAGUICIDA BIOLOGICOS', 'NUTRICIONAL', 'BIOESTIMULANTES', 'FITOREGULADORES', 'ESPECIALIDADES'];
const MOCK_SUBFAMILIAS = ['HERBICIDA', 'INSECTICIDA', 'FUNGICIDA', 'ACARICIDA', 'FERTILIZANTE FOLIAR', 'BIOESTIMULANTE', 'COADYUVANTE'];
const MOCK_IA = ['GLIFOSATO', 'IMIDACLOPRID', 'MANCOZEB', 'AZOXISTROBIN', 'ABAMECTINA', 'CLORPIRIFOS', 'CIPERMETRINA', 'FIPRONIL'];
const MOCK_PRODUCTOS = [
  'DESTINO 1.8 EC X 1 LT', 'FULVI GROW EHT 85% X 500GR', 'ECO VIGOR STIM X 1LT',
  'WARRIOR 50 EC X 1 L', 'GALBEN M 8-65 WP X 1 KG', 'EXALT 60 SC X 250 ML',
  'MOVENTO 150 OD X 1 LT', 'ENGEO 247 SC X 1 LT', 'KARATE ZEON 50 CS X 1 LT',
  'AMISTAR TOP 325 SC X 1 LT', 'VERTIMEC 018 EC X 1 LT', 'SCORE 250 EC X 1 LT',
];

function generateMockVentas(count: number) {
  const records = [];
  const baseDate = new Date('2026-03-01');
  const tiposDoc = ['Factura', 'Boleta', 'Nota de Crédito', 'Anticipo', 'Nota de Débito'];
  const maestroTipos = ['FOCO', 'EN VIVO', 'OTROS'];

  for (let i = 0; i < count; i++) {
    const vendedor = MOCK_VENDEDORES[i % MOCK_VENDEDORES.length];
    const dia = Math.floor(Math.random() * 28) + 1;
    const familia = MOCK_FAMILIAS[Math.floor(Math.random() * MOCK_FAMILIAS.length)];
    const unidades = Math.floor(Math.random() * 500) + 1;
    const precio = Math.round((Math.random() * 50 + 5) * 100) / 100;
    const valor = Math.round(unidades * precio * 100) / 100;

    records.push({
      tipo_venta: 'VENTA REGULAR',
      pais: 'Peru',
      facturador: 'POINT ANDINA',
      orden_de_venta: 100000 + i,
      fecha_pedido: `2026-03-${String(Math.max(1, dia - 2)).padStart(2, '0')}`,
      fecha_guia: `2026-03-${String(Math.max(1, dia - 1)).padStart(2, '0')}`,
      fecha_emision: `2026-03-${String(dia).padStart(2, '0')}`,
      zona: vendedor.zona,
      codigo_vendedor: vendedor.codigo,
      vendedor: vendedor.nombre,
      razon_social_cliente: MOCK_CLIENTES[Math.floor(Math.random() * MOCK_CLIENTES.length)],
      ruc_cliente: `20${Math.floor(Math.random() * 900000000 + 100000000)}`,
      codigo_producto: `PROD${String(i % 150).padStart(4, '0')}`,
      division: familia.includes('BIOLOGICO') || familia === 'BIOESTIMULANTES' ? 'BIOSCIENCE' : 'AGROCHEM',
      familia,
      sub_familia: MOCK_SUBFAMILIAS[Math.floor(Math.random() * MOCK_SUBFAMILIAS.length)],
      ingrediente_activo: MOCK_IA[Math.floor(Math.random() * MOCK_IA.length)],
      producto_formulado: MOCK_PRODUCTOS[Math.floor(Math.random() * MOCK_PRODUCTOS.length)],
      marca: 'POINT',
      nombre_producto: MOCK_PRODUCTOS[Math.floor(Math.random() * MOCK_PRODUCTOS.length)],
      unidades_presentacion: unidades,
      precio_unitario_venta_dolares: precio,
      valor_venta_dolares: valor,
      tipo_de_cambio: 3.72,
      moneda_emision: Math.random() > 0.3 ? 'USD' : 'PEN',
      tipo_documento: tiposDoc[Math.floor(Math.random() * tiposDoc.length)],
      numero_sap: `FA${String(i + 1).padStart(6, '0')}`,
      doc_referencia_orden: null,
      condicion_pago: 'Crédito 30 días',
      dias_credito: 30,
      usuario_creador: 'manager',
      grupo_cliente: 'AGROINDUSTRIAS',
      maestro_tipo: maestroTipos[Math.floor(Math.random() * maestroTipos.length)],
      tipo_de_cliente: 'DISTRIBUIDOR',
      clasificacion_bcg: ['VACA', 'INTERROGANTE', 'PERRO'][Math.floor(Math.random() * 3)],
      origen_producto: Math.random() > 0.5 ? 'EXTERIOR' : 'NACIONAL',
      distrito_fiscal: 'SAN ISIDRO',
      direccion_fiscal: 'AV. EXAMPLE 123',
      departamento_fiscal: 'LIMA',
      distrito_despacho: 'CALLAO',
      direccion_despacho: 'AV. DESPACHO 456',
      departamento_despacho: 'LIMA',
      series_de_documentos: vendedor.series,
    });
  }
  return records;
}

const MOCK_VENTAS = generateMockVentas(500);

// ---- USERS Mock ----
const MOCK_USERS = [
  { id: 1, username: 'admin', password_hash: '$2a$10$9cKoZsj8b6PfkAeLoUgwUOmHIQDzEeQ1vHd4vwJ4N70DlJsXTpuMm', full_name: 'Administrador', email: 'admin@pointandina.com', role_id: 1, active: true, created_at: '2026-01-01', updated_at: '2026-01-01' },
  { id: 2, username: 'zmosquera', password_hash: '$2a$10$9cKoZsj8b6PfkAeLoUgwUOmHIQDzEeQ1vHd4vwJ4N70DlJsXTpuMm', full_name: 'Zaida Mosquera García', email: 'zmosquera@pointandina.com', role_id: 2, active: true, created_at: '2026-01-01', updated_at: '2026-01-01' },
  { id: 3, username: 'klopez', password_hash: '$2a$10$9cKoZsj8b6PfkAeLoUgwUOmHIQDzEeQ1vHd4vwJ4N70DlJsXTpuMm', full_name: 'Katye Lopez Montufar', email: 'klopez@pointandina.com', role_id: 3, active: true, created_at: '2026-01-01', updated_at: '2026-01-01' },
  { id: 4, username: 'lquispe', password_hash: '$2a$10$9cKoZsj8b6PfkAeLoUgwUOmHIQDzEeQ1vHd4vwJ4N70DlJsXTpuMm', full_name: 'Liliana Quispe', email: 'lquispe@pointandina.com', role_id: 4, active: true, created_at: '2026-01-01', updated_at: '2026-01-01' },
];

const MOCK_ROLES = [
  { id: 1, name: 'Admin', description: 'Acceso total al sistema' },
  { id: 2, name: 'Jefe de Venta', description: 'Acceso a ventas, cartera y alertas' },
  { id: 3, name: 'Vendedor', description: 'Acceso a ventas y alertas' },
  { id: 4, name: 'Finanzas', description: 'Acceso a ventas y cartera' },
  { id: 5, name: 'Viewer', description: 'Solo lectura en dashboard de ventas' },
];

// ============================================================
// SERVICE METHODS
// ============================================================

export const dbService = {
  // ---- AUTH ----
  async findUserByUsername(username: string) {
    if (USE_MOCK_AUTH) {
      return MOCK_USERS.find(u => u.username === username) || null;
    }
    const pool = await getDbPool();
    const result = await pool.request()
      .input('username', sql.VarChar, username)
      .query('SELECT * FROM users WHERE username = @username AND active = 1');
    return result.recordset[0] || null;
  },

  async findUserById(id: number) {
    if (USE_MOCK_AUTH) {
      return MOCK_USERS.find(u => u.id === id) || null;
    }
    const pool = await getDbPool();
    const result = await pool.request()
      .input('id', sql.Int, id)
      .query('SELECT * FROM users WHERE id = @id');
    return result.recordset[0] || null;
  },

  async getAllUsers() {
    if (USE_MOCK_AUTH) {
      return MOCK_USERS.map(({ password_hash, ...u }) => u);
    }
    const pool = await getDbPool();
    const result = await pool.request()
      .query('SELECT id, username, full_name, email, role_id, active, created_at, updated_at FROM users ORDER BY id');
    return result.recordset;
  },

  async createUser(user: { username: string; password_hash: string; full_name: string; email: string; role_id: number }) {
    if (USE_MOCK_AUTH) {
      const newUser = { id: MOCK_USERS.length + 1, ...user, active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      MOCK_USERS.push(newUser);
      const { password_hash, ...safe } = newUser;
      return safe;
    }
    const pool = await getDbPool();
    const result = await pool.request()
      .input('username', sql.VarChar, user.username)
      .input('password_hash', sql.VarChar, user.password_hash)
      .input('full_name', sql.NVarChar, user.full_name)
      .input('email', sql.VarChar, user.email)
      .input('role_id', sql.Int, user.role_id)
      .query(`INSERT INTO users (username, password_hash, full_name, email, role_id, active)
              OUTPUT INSERTED.id, INSERTED.username, INSERTED.full_name, INSERTED.email, INSERTED.role_id, INSERTED.active
              VALUES (@username, @password_hash, @full_name, @email, @role_id, 1)`);
    return result.recordset[0];
  },

  async updateUser(id: number, updates: Partial<{ full_name: string; email: string; role_id: number; active: boolean; password_hash: string }>) {
    if (USE_MOCK_AUTH) {
      const idx = MOCK_USERS.findIndex(u => u.id === id);
      if (idx === -1) return null;
      Object.assign(MOCK_USERS[idx], updates, { updated_at: new Date().toISOString() });
      const { password_hash, ...safe } = MOCK_USERS[idx];
      return safe;
    }
    const pool = await getDbPool();
    const sets: string[] = [];
    const request = pool.request().input('id', sql.Int, id);
    if (updates.full_name) { sets.push('full_name = @full_name'); request.input('full_name', sql.NVarChar, updates.full_name); }
    if (updates.email) { sets.push('email = @email'); request.input('email', sql.VarChar, updates.email); }
    if (updates.role_id) { sets.push('role_id = @role_id'); request.input('role_id', sql.Int, updates.role_id); }
    if (updates.active !== undefined) { sets.push('active = @active'); request.input('active', sql.Bit, updates.active); }
    if (updates.password_hash) { sets.push('password_hash = @password_hash'); request.input('password_hash', sql.VarChar, updates.password_hash); }
    sets.push('updated_at = GETDATE()');
    const result = await request.query(`UPDATE users SET ${sets.join(', ')} OUTPUT INSERTED.* WHERE id = @id`);
    return result.recordset[0] || null;
  },

  async deleteUser(id: number) {
    if (USE_MOCK_AUTH) {
      const idx = MOCK_USERS.findIndex(u => u.id === id);
      if (idx === -1) return false;
      MOCK_USERS.splice(idx, 1);
      return true;
    }
    const pool = await getDbPool();
    const result = await pool.request().input('id', sql.Int, id).query('DELETE FROM users WHERE id = @id');
    return (result.rowsAffected[0] || 0) > 0;
  },

  // ---- ROLES ----
  async getAllRoles() {
    if (USE_MOCK_AUTH) return MOCK_ROLES;
    const pool = await getDbPool();
    const result = await pool.request().query('SELECT * FROM roles ORDER BY id');
    return result.recordset;
  },

  async getRoleById(id: number) {
    if (USE_MOCK_AUTH) return MOCK_ROLES.find(r => r.id === id) || null;
    const pool = await getDbPool();
    const result = await pool.request().input('id', sql.Int, id).query('SELECT * FROM roles WHERE id = @id');
    return result.recordset[0] || null;
  },

  // ---- VENTAS ----
  async getVentas(filtros: any) {
    if (USE_MOCK_VENTAS) {
      let data = [...MOCK_VENTAS];
      if (filtros.familia) data = data.filter(v => v.familia === filtros.familia);
      if (filtros.sub_familia) data = data.filter(v => v.sub_familia === filtros.sub_familia);
      if (filtros.vendedor) data = data.filter(v => v.vendedor === filtros.vendedor);
      if (filtros.zona) data = data.filter(v => v.zona === filtros.zona);
      if (filtros.ingrediente_activo) data = data.filter(v => v.ingrediente_activo === filtros.ingrediente_activo);
      if (filtros.tipo_documento) data = data.filter(v => v.tipo_documento === filtros.tipo_documento);
      if (filtros.series_documentos) data = data.filter(v => v.series_de_documentos === filtros.series_documentos);
      if (filtros.maestro_tipo) data = data.filter(v => v.maestro_tipo === filtros.maestro_tipo);
      if (filtros.division) data = data.filter(v => v.division === filtros.division);
      if (filtros.grupo_cliente) {
        const grupos = (filtros.grupo_cliente as string).split(',').map((g: string) => g.trim().toUpperCase());
        data = data.filter(v => grupos.includes((v.grupo_cliente || '').toUpperCase()));
      }
      // Solo Peru
      data = data.filter(v => v.pais === 'Peru');
      return data;
    }
    const pool = await getDbPool();
    const request = pool.request();
    const where: string[] = ["Pais = 'Peru'"];

    if (filtros.familia) {
      const vals = (filtros.familia as string).split(',');
      where.push(`Familia IN (${vals.map((_: string, i: number) => `@fam${i}`).join(',')})`);
      vals.forEach((v: string, i: number) => request.input(`fam${i}`, sql.NVarChar, v));
    }
    if (filtros.sub_familia) {
      const vals = (filtros.sub_familia as string).split(',');
      where.push(`[Sub Familia] IN (${vals.map((_: string, i: number) => `@sf${i}`).join(',')})`);
      vals.forEach((v: string, i: number) => request.input(`sf${i}`, sql.NVarChar, v));
    }
    if (filtros.vendedor) {
      const vals = (filtros.vendedor as string).split(',');
      where.push(`Vendedor IN (${vals.map((_: string, i: number) => `@vend${i}`).join(',')})`);
      vals.forEach((v: string, i: number) => request.input(`vend${i}`, sql.NVarChar, v));
    }
    if (filtros.zona) {
      const vals = (filtros.zona as string).split(',');
      where.push(`Zona IN (${vals.map((_: string, i: number) => `@zon${i}`).join(',')})`);
      vals.forEach((v: string, i: number) => request.input(`zon${i}`, sql.NVarChar, v));
    }
    if (filtros.ingrediente_activo) {
      const vals = (filtros.ingrediente_activo as string).split(',');
      where.push(`Ingrediente_Activo IN (${vals.map((_: string, i: number) => `@ia${i}`).join(',')})`);
      vals.forEach((v: string, i: number) => request.input(`ia${i}`, sql.NVarChar, v));
    }
    if (filtros.tipo_documento) {
      const vals = (filtros.tipo_documento as string).split(',');
      where.push(`[Tipo Documento] IN (${vals.map((_: string, i: number) => `@td${i}`).join(',')})`);
      vals.forEach((v: string, i: number) => request.input(`td${i}`, sql.NVarChar, v));
    }
    if (filtros.division) {
      const vals = (filtros.division as string).split(',');
      where.push(`[División] IN (${vals.map((_: string, i: number) => `@div${i}`).join(',')})`);
      vals.forEach((v: string, i: number) => request.input(`div${i}`, sql.NVarChar, v));
    }
    if (filtros.maestro_tipo) {
      const vals = (filtros.maestro_tipo as string).split(',');
      where.push(`Maestro_Tipo IN (${vals.map((_: string, i: number) => `@mt${i}`).join(',')})`);
      vals.forEach((v: string, i: number) => request.input(`mt${i}`, sql.NVarChar, v));
    }
    if (filtros.grupo_cliente) {
      const vals = (filtros.grupo_cliente as string).split(',').map((v: string) => v.trim());
      where.push(`Grupo_Cliente IN (${vals.map((_: string, i: number) => `@gc${i}`).join(',')})`);
      vals.forEach((v: string, i: number) => request.input(`gc${i}`, sql.NVarChar, v));
    }
    if (filtros.year && filtros.month_start && filtros.month_end) {
      request.input('yr', sql.Int, parseInt(filtros.year));
      request.input('ms', sql.Int, parseInt(filtros.month_start));
      request.input('me', sql.Int, parseInt(filtros.month_end));
      where.push('YEAR(Fecha_Emision) = @yr AND MONTH(Fecha_Emision) BETWEEN @ms AND @me');
    }

    const query = `
      SELECT
        [Tipo Venta]                     AS tipo_venta,
        Pais                             AS pais,
        Facturador                       AS facturador,
        Orden_de_Venta                   AS orden_de_venta,
        Fecha_Pedido                     AS fecha_pedido,
        Fecha_Guia                       AS fecha_guia,
        Fecha_Emision                    AS fecha_emision,
        Zona                             AS zona,
        Codigo_Vendedor                  AS codigo_vendedor,
        Vendedor                         AS vendedor,
        Razon_Social_Cliente             AS razon_social_cliente,
        RUC_Cliente                      AS ruc_cliente,
        Codigo_Producto                  AS codigo_producto,
        [División]                       AS division,
        Familia                          AS familia,
        [Sub Familia]                    AS sub_familia,
        Ingrediente_Activo               AS ingrediente_activo,
        [Producto Formulado]             AS producto_formulado,
        Marca                            AS marca,
        Nombre_Producto                  AS nombre_producto,
        [Cantidad KG/LT]                AS cantidad_kg_lt,
        [Unidades Presentación]          AS unidades_presentacion,
        [Precio Unitario de Venta Dolares_Presentación] AS precio_unitario_venta_dolares,
        [Valor_Venta_Dolares_Presentación] AS valor_venta_dolares,
        Tipo_de_Cambio                   AS tipo_de_cambio,
        Moneda_Emision                   AS moneda_emision,
        Ganancia                         AS ganancia,
        [Ganancia (%)]                   AS ganancia_pct,
        [Tipo Documento]                 AS tipo_documento,
        Numero_SAP                       AS numero_sap,
        Doc_Referencia_Orden             AS doc_referencia_orden,
        Condicion_Pago                   AS condicion_pago,
        Dias_Credito                     AS dias_credito,
        Usuario_Creador                  AS usuario_creador,
        Grupo_Cliente                    AS grupo_cliente,
        Maestro_Tipo                     AS maestro_tipo,
        [Tipo de Cliente]                AS tipo_de_cliente,
        Clasificacion_BCG                AS clasificacion_bcg,
        [UPPER(Origen_Producto)]         AS origen_producto,
        [Costo Total _Presentación]      AS costo_total,
        [Costo_unitario_Presentación]    AS costo_unitario,
        Magen_Unitario                   AS margen_unitario,
        [Porcentaje_Unitario_Ganancia (%)] AS porcentaje_ganancia_unitario,
        Departamento_Despacho            AS departamento_despacho,
        Distrito_Despacho                AS distrito_despacho
      FROM dbo.stg_rpt_ventas_detallado
      WHERE ${where.join(' AND ')}
    `;
    const result = await request.query(query);
    return result.recordset;
  },

  async getVentasKPIs(filtros: any) {
    const ventas = await this.getVentas(filtros);
    const totalVenta = ventas.reduce((sum: number, v: any) => sum + (Number(v.valor_venta_dolares) || 0), 0);
    const totalKL = ventas.reduce((sum: number, v: any) => sum + (Number(v.cantidad_kg_lt) || 0), 0);
    const totalUnidades = ventas.reduce((sum: number, v: any) => sum + (Number(v.unidades_presentacion) || 0), 0);
    const totalCosto = ventas.reduce((sum: number, v: any) => sum + (Number(v.costo_total) || 0), 0);
    const totalGanancia = ventas.reduce((sum: number, v: any) => sum + (Number(v.ganancia) || 0), 0);
    const clientesUnicos = new Set(ventas.map((v: any) => v.ruc_cliente).filter(Boolean)).size;
    const margenPromedio = totalVenta > 0 ? (totalGanancia / totalVenta) * 100 : 0;

    return {
      total_venta_usd: Math.round(totalVenta * 100) / 100,
      total_kilolitros: Math.round(totalKL * 100) / 100,
      total_unidades: Math.round(totalUnidades * 100) / 100,
      total_clientes: clientesUnicos,
      total_transacciones: ventas.length,
      ticket_promedio: ventas.length > 0 ? Math.round((totalVenta / ventas.length) * 100) / 100 : 0,
      meta_mensual_usd: 1500000,
      porcentaje_avance: Math.round((totalVenta / 1500000) * 10000) / 100,
      total_costo: Math.round(totalCosto * 100) / 100,
      total_ganancia: Math.round(totalGanancia * 100) / 100,
      margen_promedio: Math.round(margenPromedio * 100) / 100,
    };
  },

  async getVentasPorCliente(filtros: any) {
    const ventas = await this.getVentas(filtros);
    const agrupado: Record<string, { razon_social_cliente: string; ruc_cliente: string; total_venta_usd: number; cantidad_transacciones: number }> = {};

    for (const v of ventas) {
      const ruc = v.ruc_cliente || 'SIN_RUC';
      if (!agrupado[ruc]) {
        agrupado[ruc] = { razon_social_cliente: v.razon_social_cliente || '', ruc_cliente: ruc, total_venta_usd: 0, cantidad_transacciones: 0 };
      }
      agrupado[ruc].total_venta_usd += Number(v.valor_venta_dolares) || 0;
      agrupado[ruc].cantidad_transacciones++;
    }

    const sorted = Object.values(agrupado).sort((a, b) => b.total_venta_usd - a.total_venta_usd);
    const totalGeneral = sorted.reduce((s, c) => s + c.total_venta_usd, 0);
    let acumulado = 0;

    return sorted.map(c => {
      acumulado += c.total_venta_usd;
      return { ...c, total_venta_usd: Math.round(c.total_venta_usd * 100) / 100, porcentaje_acumulado: totalGeneral ? Math.round((acumulado / totalGeneral) * 10000) / 100 : 0 };
    });
  },

  async getVentasPorIA(filtros: any) {
    const ventas = await this.getVentas(filtros);
    const agrupado: Record<string, { ingrediente_activo: string; total_venta_usd: number; total_unidades: number }> = {};

    for (const v of ventas) {
      const ia = v.ingrediente_activo || 'SIN IA';
      if (!agrupado[ia]) agrupado[ia] = { ingrediente_activo: ia, total_venta_usd: 0, total_unidades: 0 };
      agrupado[ia].total_venta_usd += Number(v.valor_venta_dolares) || 0;
      agrupado[ia].total_unidades += Number(v.unidades_presentacion) || 0;
    }

    return Object.values(agrupado).sort((a, b) => b.total_venta_usd - a.total_venta_usd);
  },

  async getVentasPorVendedor(filtros: any) {
    const ventas = await this.getVentas(filtros);
    const agrupado: Record<string, { vendedor: string; codigo_vendedor: number; zona: string; total_venta_usd: number; total_kg_lt: number; total_unidades: number; clientes: Set<string> }> = {};

    for (const v of ventas) {
      const key = v.vendedor || 'SIN VENDEDOR';
      if (!agrupado[key]) {
        agrupado[key] = { vendedor: key, codigo_vendedor: v.codigo_vendedor, zona: v.zona || '', total_venta_usd: 0, total_kg_lt: 0, total_unidades: 0, clientes: new Set() };
      }
      agrupado[key].total_venta_usd += Number(v.valor_venta_dolares) || 0;
      agrupado[key].total_kg_lt += Number(v.cantidad_kg_lt) || 0;
      agrupado[key].total_unidades += Number(v.unidades_presentacion) || 0;
      if (v.ruc_cliente) agrupado[key].clientes.add(v.ruc_cliente);
      if (v.zona && !agrupado[key].zona) agrupado[key].zona = v.zona;
    }

    return Object.values(agrupado).map(v => ({
      vendedor: v.vendedor,
      codigo_vendedor: v.codigo_vendedor,
      zona: v.zona,
      total_venta_usd: Math.round(v.total_venta_usd * 100) / 100,
      total_kg_lt: Math.round(v.total_kg_lt * 100) / 100,
      total_unidades: Math.round(v.total_unidades * 100) / 100,
      cantidad_clientes: v.clientes.size,
    })).sort((a, b) => b.total_venta_usd - a.total_venta_usd);
  },

  async getVentasPorFamilia(filtros: any) {
    const ventas = await this.getVentas(filtros);
    const agrupado: Record<string, { familia: string; total_venta_usd: number; total_unidades: number }> = {};

    for (const v of ventas) {
      const f = v.familia || 'SIN FAMILIA';
      if (!agrupado[f]) agrupado[f] = { familia: f, total_venta_usd: 0, total_unidades: 0 };
      agrupado[f].total_venta_usd += Number(v.valor_venta_dolares) || 0;
      agrupado[f].total_unidades += Number(v.unidades_presentacion) || 0;
    }

    const total = Object.values(agrupado).reduce((s, f) => s + f.total_venta_usd, 0);
    return Object.values(agrupado).map(f => ({
      ...f,
      total_venta_usd: Math.round(f.total_venta_usd * 100) / 100,
      porcentaje: total ? Math.round((f.total_venta_usd / total) * 10000) / 100 : 0,
    })).sort((a, b) => b.total_venta_usd - a.total_venta_usd);
  },

  async getVentasPorProductoZona(filtros: any) {
    const ventas = await this.getVentas(filtros);
    const agrupado: Record<string, { producto: string; zona: string; familia: string; total_venta_usd: number; total_kg_lt: number; total_unidades: number; transacciones: number }> = {};
    for (const v of ventas) {
      const producto = v.nombre_producto || v.producto_formulado || 'SIN PRODUCTO';
      const zona = v.zona || 'SIN ZONA';
      const key = `${producto}|${zona}`;
      if (!agrupado[key]) agrupado[key] = { producto, zona, familia: v.familia || '', total_venta_usd: 0, total_kg_lt: 0, total_unidades: 0, transacciones: 0 };
      agrupado[key].total_venta_usd += Number(v.valor_venta_dolares) || 0;
      agrupado[key].total_kg_lt += Number(v.cantidad_kg_lt) || 0;
      agrupado[key].total_unidades += Number(v.unidades_presentacion) || 0;
      agrupado[key].transacciones++;
    }
    return Object.values(agrupado).map(p => ({
      ...p,
      total_venta_usd: Math.round(p.total_venta_usd * 100) / 100,
      total_kg_lt: Math.round(p.total_kg_lt * 100) / 100,
    })).sort((a, b) => b.total_venta_usd - a.total_venta_usd);
  },

  async getVentasPorSubFamilia(filtros: any) {
    const ventas = await this.getVentas(filtros);
    const agrupado: Record<string, { sub_familia: string; total_venta_usd: number; total_unidades: number }> = {};
    for (const v of ventas) {
      const sf = v.sub_familia || 'SIN SUB-FAMILIA';
      if (!agrupado[sf]) agrupado[sf] = { sub_familia: sf, total_venta_usd: 0, total_unidades: 0 };
      agrupado[sf].total_venta_usd += Number(v.valor_venta_dolares) || 0;
      agrupado[sf].total_unidades += Number(v.unidades_presentacion) || 0;
    }
    const total = Object.values(agrupado).reduce((s, f) => s + f.total_venta_usd, 0);
    return Object.values(agrupado).map(f => ({
      ...f,
      total_venta_usd: Math.round(f.total_venta_usd * 100) / 100,
      porcentaje: total ? Math.round((f.total_venta_usd / total) * 10000) / 100 : 0,
    })).sort((a, b) => b.total_venta_usd - a.total_venta_usd);
  },

  async getVentasDiarias(filtros: any) {
    const ventas = await this.getVentas(filtros);
    const agrupado: Record<string, { fecha: string; total_venta_usd: number; cantidad_documentos: number }> = {};

    for (const v of ventas) {
      const fechaRaw = v.fecha_emision;
      const fecha = fechaRaw instanceof Date ? fechaRaw.toISOString().split('T')[0] : String(fechaRaw || '').split('T')[0];
      if (!fecha) continue;
      if (!agrupado[fecha]) agrupado[fecha] = { fecha, total_venta_usd: 0, cantidad_documentos: 0 };
      agrupado[fecha].total_venta_usd += Number(v.valor_venta_dolares) || 0;
      agrupado[fecha].cantidad_documentos++;
    }

    return Object.values(agrupado).sort((a, b) => a.fecha.localeCompare(b.fecha));
  },

  async getVentasPorDepartamento(filtros: any) {
    const ventas = await this.getVentas(filtros);
    const agrupado: Record<string, { departamento: string; total_venta_usd: number; total_costo: number; total_ganancia: number; transacciones: number; vendedores: Set<string>; grupos: Set<string> }> = {};
    for (const v of ventas) {
      const dep = (v.departamento_despacho || 'SIN DEPARTAMENTO').toUpperCase().trim();
      if (!agrupado[dep]) agrupado[dep] = { departamento: dep, total_venta_usd: 0, total_costo: 0, total_ganancia: 0, transacciones: 0, vendedores: new Set(), grupos: new Set() };
      agrupado[dep].total_venta_usd += Number(v.valor_venta_dolares) || 0;
      agrupado[dep].total_costo += Number(v.costo_total) || 0;
      agrupado[dep].total_ganancia += Number(v.ganancia) || 0;
      agrupado[dep].transacciones++;
      if (v.vendedor) agrupado[dep].vendedores.add(v.vendedor);
      if (v.grupo_cliente) agrupado[dep].grupos.add(v.grupo_cliente);
    }
    return Object.values(agrupado).map((d) => {
      const venta = Math.round(d.total_venta_usd * 100) / 100;
      const costo = Math.round(d.total_costo * 100) / 100;
      const ganancia = Math.round(d.total_ganancia * 100) / 100;
      return {
        departamento: d.departamento,
        total_venta_usd: venta,
        total_costo: costo,
        total_ganancia: ganancia,
        margen_pct: venta > 0 ? Math.round((ganancia / venta) * 10000) / 100 : 0,
        transacciones: d.transacciones,
        vendedores: [...d.vendedores],
        grupos_cliente: [...d.grupos],
      };
    }).sort((a, b) => b.total_venta_usd - a.total_venta_usd);
  },

  async getFiltrosOpciones() {
    if (USE_MOCK_VENTAS) {
      return {
        familias: MOCK_FAMILIAS,
        sub_familias: MOCK_SUBFAMILIAS,
        ingredientes_activos: MOCK_IA,
        vendedores: MOCK_VENDEDORES.map(v => ({ codigo: v.codigo, nombre: v.nombre })),
        zonas: [...new Set(MOCK_VENDEDORES.map(v => v.zona))],
        tipos_documento: ['Factura', 'Boleta', 'Nota de Crédito', 'Anticipo', 'Nota de Débito'],
        series_documentos: ['AGRO', 'BIOS', 'COST', 'DESA', 'ONL', 'SISE'],
        divisiones: ['AGROCHEM', 'BIOSCIENCE'],
        maestro_tipos: ['FOCO', 'EN VIVO', 'OTROS'],
        grupos_cliente: ['AGROINDUSTRIAS', 'DIST. COSTA', 'DIST. SIERRA / SELVA', 'ONLINE'],
      };
    }
    const pool = await getDbPool();
    const [fam, sf, ia, vend, zon, td, div, mt, gc] = await Promise.all([
      pool.request().query(`SELECT DISTINCT Familia FROM dbo.stg_rpt_ventas_detallado WHERE Pais='Peru' AND Familia IS NOT NULL ORDER BY Familia`),
      pool.request().query(`SELECT DISTINCT [Sub Familia] AS sub_familia FROM dbo.stg_rpt_ventas_detallado WHERE Pais='Peru' AND [Sub Familia] IS NOT NULL ORDER BY [Sub Familia]`),
      pool.request().query(`SELECT DISTINCT Ingrediente_Activo FROM dbo.stg_rpt_ventas_detallado WHERE Pais='Peru' AND Ingrediente_Activo IS NOT NULL AND Ingrediente_Activo != '' ORDER BY Ingrediente_Activo`),
      pool.request().query(`SELECT DISTINCT Codigo_Vendedor, Vendedor, Zona FROM dbo.stg_rpt_ventas_detallado WHERE Pais='Peru' AND Vendedor IS NOT NULL AND Vendedor != '' AND Zona IS NOT NULL AND Zona != '' ORDER BY Vendedor`),
      pool.request().query(`SELECT DISTINCT Zona FROM dbo.stg_rpt_ventas_detallado WHERE Pais='Peru' AND Zona IS NOT NULL AND Zona != '' ORDER BY Zona`),
      pool.request().query(`SELECT DISTINCT [Tipo Documento] AS tipo_documento FROM dbo.stg_rpt_ventas_detallado WHERE Pais='Peru' AND [Tipo Documento] IS NOT NULL ORDER BY [Tipo Documento]`),
      pool.request().query(`SELECT DISTINCT [División] AS division FROM dbo.stg_rpt_ventas_detallado WHERE Pais='Peru' AND [División] IS NOT NULL AND [División] != '' ORDER BY [División]`),
      pool.request().query(`SELECT DISTINCT Maestro_Tipo FROM dbo.stg_rpt_ventas_detallado WHERE Pais='Peru' AND Maestro_Tipo IS NOT NULL ORDER BY Maestro_Tipo`),
      pool.request().query(`SELECT DISTINCT Grupo_Cliente FROM dbo.stg_rpt_ventas_detallado WHERE Pais='Peru' AND Grupo_Cliente IS NOT NULL AND Grupo_Cliente != '' ORDER BY Grupo_Cliente`),
    ]);
    return {
      familias: fam.recordset.map((r: any) => r.Familia),
      sub_familias: sf.recordset.map((r: any) => r.sub_familia),
      ingredientes_activos: ia.recordset.map((r: any) => r.Ingrediente_Activo),
      vendedores: vend.recordset.map((r: any) => ({ codigo: r.Codigo_Vendedor, nombre: r.Vendedor, zona: r.Zona })),
      zonas: zon.recordset.map((r: any) => r.Zona),
      tipos_documento: td.recordset.map((r: any) => r.tipo_documento),
      divisiones: div.recordset.map((r: any) => r.division),
      maestro_tipos: mt.recordset.map((r: any) => r.Maestro_Tipo),
      grupos_cliente: gc.recordset.map((r: any) => r.Grupo_Cliente),
    };
  },

  // ---- VENTA RC ----
  async getVentaRCPorGrupoCliente(filtros: any) {
    const ventas = await this.getVentas(filtros);
    const agrupado: Record<string, { grupo_cliente: string; total_venta_usd: number; cantidad_clientes: Set<string>; cantidad_transacciones: number }> = {};
    for (const v of ventas) {
      const g = (v.grupo_cliente || 'SIN GRUPO').toUpperCase();
      if (!agrupado[g]) agrupado[g] = { grupo_cliente: g, total_venta_usd: 0, cantidad_clientes: new Set(), cantidad_transacciones: 0 };
      agrupado[g].total_venta_usd += Number(v.valor_venta_dolares) || 0;
      agrupado[g].cantidad_transacciones++;
      if (v.ruc_cliente) agrupado[g].cantidad_clientes.add(v.ruc_cliente);
    }
    const total = Object.values(agrupado).reduce((s, g) => s + g.total_venta_usd, 0);
    return Object.values(agrupado).map(g => ({
      grupo_cliente: g.grupo_cliente,
      total_venta_usd: Math.round(g.total_venta_usd * 100) / 100,
      cantidad_clientes: g.cantidad_clientes.size,
      cantidad_transacciones: g.cantidad_transacciones,
      porcentaje: total ? Math.round((g.total_venta_usd / total) * 10000) / 100 : 0,
    })).sort((a, b) => b.total_venta_usd - a.total_venta_usd);
  },

  async getClientesMaestro(filtros?: { grupo_cliente?: string }) {
    const pool = await getDbPool();
    const request = pool.request();
    const where: string[] = [];
    if (filtros?.grupo_cliente) {
      request.input('gc', sql.NVarChar, filtros.grupo_cliente);
      where.push('GrupoCliente = @gc');
    }
    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const result = await request.query(`
      SELECT TOP 500
        CardCode,
        CardName,
        RUC,
        GrupoCliente,
        Vendedor,
        Zona
      FROM dbo.stg_clientes_sap
      ${whereClause}
      ORDER BY CardName
    `);
    return result.recordset;
  },

  // ---- CARTERA (SQL Real — AL004, AL006, AL007) ----
  async getCarteraKPIs() {
    try {
      const pool = await getDbPool();
      const result = await pool.request().query(`
        SELECT
          SUM(CASE WHEN [Importe Pendiente] > 0 THEN [Importe Pendiente] ELSE 0 END) AS total_cartera_positiva,
          SUM(CASE WHEN [Importe Pendiente] < 0 THEN [Importe Pendiente] ELSE 0 END) AS total_notas_credito,
          SUM(CASE WHEN [Importe Pendiente] > 0 AND [Fecha Vencimiento] < GETDATE() THEN [Importe Pendiente] ELSE 0 END) AS cartera_vencida,
          SUM(CASE WHEN [Importe Pendiente] > 0 AND [Fecha Vencimiento] >= GETDATE() THEN [Importe Pendiente] ELSE 0 END) AS cartera_vigente,
          SUM(ABS([Pago a Cuenta])) AS total_recaudado,
          SUM(ABS([Importe Facturado])) AS total_facturado,
          COUNT(DISTINCT CASE WHEN [Importe Pendiente] > 0 AND [Fecha Vencimiento] < GETDATE() THEN Ruc END) AS clientes_morosos,
          COUNT(DISTINCT CASE WHEN [Importe Pendiente] > 0 THEN Ruc END) AS total_clientes_con_deuda
        FROM dbo.stg_al004_letras_facturas
        WHERE [Importe Pendiente] != 0
      `);
      const r = result.recordset[0];
      const totalCartera = Math.round((r.total_cartera_positiva || 0) * 100) / 100;
      const carteraVencida = Math.round((r.cartera_vencida || 0) * 100) / 100;
      const carteraVigente = Math.round((r.cartera_vigente || 0) * 100) / 100;
      const totalFacturado = Math.abs(r.total_facturado || 1);
      const totalRecaudado = Math.abs(r.total_recaudado || 0);
      const porcentajeRecaudo = totalFacturado > 0 ? Math.round((totalRecaudado / totalFacturado) * 10000) / 100 : 0;

      // Días promedio de cobro
      const diasRes = await pool.request().query(`
        SELECT AVG(CAST(DATEDIFF(day, [Fecha Emisión], GETDATE()) AS FLOAT)) AS dias_promedio
        FROM dbo.stg_al004_letras_facturas
        WHERE [Importe Pendiente] > 0 AND [Fecha Emisión] IS NOT NULL
      `);
      const diasPromedio = Math.round(diasRes.recordset[0].dias_promedio || 0);

      return {
        total_cartera: totalCartera,
        cartera_vencida: carteraVencida,
        cartera_vigente: carteraVigente,
        porcentaje_recaudo: porcentajeRecaudo,
        dias_promedio_cobro: diasPromedio,
        clientes_morosos: r.clientes_morosos || 0,
      };
    } catch (error) {
      console.error('Error in getCarteraKPIs:', error);
      return { total_cartera: 0, cartera_vencida: 0, cartera_vigente: 0, porcentaje_recaudo: 0, dias_promedio_cobro: 0, clientes_morosos: 0 };
    }
  },

  async getCarteraPorEdad() {
    try {
      const pool = await getDbPool();
      const result = await pool.request().query(`
        SELECT rango, orden, SUM(monto) AS monto, SUM(docs) AS cantidad_documentos
        FROM (
          SELECT
            CASE
              WHEN DATEDIFF(day, [Fecha Vencimiento], GETDATE()) <= 0 THEN 'Vigente'
              WHEN DATEDIFF(day, [Fecha Vencimiento], GETDATE()) BETWEEN 1 AND 30 THEN '1-30 dias'
              WHEN DATEDIFF(day, [Fecha Vencimiento], GETDATE()) BETWEEN 31 AND 60 THEN '31-60 dias'
              WHEN DATEDIFF(day, [Fecha Vencimiento], GETDATE()) BETWEEN 61 AND 90 THEN '61-90 dias'
              WHEN DATEDIFF(day, [Fecha Vencimiento], GETDATE()) BETWEEN 91 AND 120 THEN '91-120 dias'
              ELSE '>120 dias'
            END AS rango,
            CASE
              WHEN DATEDIFF(day, [Fecha Vencimiento], GETDATE()) <= 0 THEN 0
              WHEN DATEDIFF(day, [Fecha Vencimiento], GETDATE()) BETWEEN 1 AND 30 THEN 1
              WHEN DATEDIFF(day, [Fecha Vencimiento], GETDATE()) BETWEEN 31 AND 60 THEN 2
              WHEN DATEDIFF(day, [Fecha Vencimiento], GETDATE()) BETWEEN 61 AND 90 THEN 3
              WHEN DATEDIFF(day, [Fecha Vencimiento], GETDATE()) BETWEEN 91 AND 120 THEN 4
              ELSE 5
            END AS orden,
            [Importe Pendiente] AS monto,
            1 AS docs
          FROM dbo.stg_al004_letras_facturas
          WHERE [Importe Pendiente] > 0
        ) sub
        GROUP BY rango, orden
        ORDER BY orden
      `);
      const total = result.recordset.reduce((s: number, r: any) => s + (Number(r.monto) || 0), 0);
      return result.recordset.map((r: any) => ({
        rango: r.rango,
        monto: Math.round((Number(r.monto) || 0) * 100) / 100,
        cantidad_documentos: r.cantidad_documentos,
        porcentaje: total > 0 ? Math.round(((Number(r.monto) || 0) / total) * 1000) / 10 : 0,
      }));
    } catch (error) {
      console.error('Error in getCarteraPorEdad:', error);
      return [];
    }
  },

  async getCarteraPorVendedor() {
    try {
      const pool = await getDbPool();
      const result = await pool.request().query(`
        SELECT
          Vendedor AS vendedor,
          MAX(Zona) AS zona,
          MAX([Grupo Cliente]) AS equipo,
          SUM(CASE WHEN [Importe Pendiente] > 0 THEN [Importe Pendiente] ELSE 0 END) AS cartera_total,
          SUM(CASE WHEN [Importe Pendiente] > 0 AND [Fecha Vencimiento] < GETDATE() THEN [Importe Pendiente] ELSE 0 END) AS cartera_vencida,
          SUM(CASE WHEN [Importe Pendiente] > 0 AND [Fecha Vencimiento] >= GETDATE() THEN [Importe Pendiente] ELSE 0 END) AS cartera_vigente,
          SUM(ABS([Pago a Cuenta])) AS recaudado,
          COUNT(DISTINCT CASE WHEN [Importe Pendiente] > 0 THEN Ruc END) AS clientes_con_deuda,
          AVG(CASE WHEN [Importe Pendiente] > 0 AND [Fecha Emisión] IS NOT NULL
              THEN CAST(DATEDIFF(day, [Fecha Emisión], GETDATE()) AS FLOAT) END) AS dias_promedio_cobro
        FROM dbo.stg_al004_letras_facturas
        WHERE Vendedor IS NOT NULL AND Vendedor != ''
        GROUP BY Vendedor
        HAVING SUM(CASE WHEN [Importe Pendiente] > 0 THEN [Importe Pendiente] ELSE 0 END) > 0
        ORDER BY cartera_total DESC
      `);
      return result.recordset.map((r: any) => {
        const ct = Number(r.cartera_total) || 0;
        const rec = Number(r.recaudado) || 0;
        return {
          vendedor: r.vendedor,
          zona: r.zona || '',
          equipo: r.equipo || '',
          cartera_total: Math.round(ct * 100) / 100,
          cartera_vencida: Math.round((Number(r.cartera_vencida) || 0) * 100) / 100,
          cartera_vigente: Math.round((Number(r.cartera_vigente) || 0) * 100) / 100,
          recaudado: Math.round(rec * 100) / 100,
          porcentaje_recaudo: ct > 0 ? Math.round((rec / (ct + rec)) * 10000) / 100 : 0,
          clientes_con_deuda: r.clientes_con_deuda || 0,
          dias_promedio_cobro: Math.round(Number(r.dias_promedio_cobro) || 0),
        };
      });
    } catch (error) {
      console.error('Error in getCarteraPorVendedor:', error);
      return [];
    }
  },

  async getCarteraTransacciones() {
    try {
      const pool = await getDbPool();
      const result = await pool.request().query(`
        SELECT TOP 500
          [Número Documento]                        AS numero_doc,
          Cliente                                    AS cliente,
          Ruc                                        AS ruc,
          Vendedor                                   AS vendedor,
          Zona                                       AS zona,
          [Fecha Emisión]                            AS fecha_emision,
          [Fecha Vencimiento]                        AS fecha_vencimiento,
          [Importe Facturado]                        AS monto_original,
          [Pago a Cuenta]                            AS monto_pagado,
          [Importe Pendiente]                        AS saldo_pendiente,
          DATEDIFF(day, [Fecha Vencimiento], GETDATE()) AS dias_mora,
          [Condición de Pago]                        AS condicion_pago,
          [Tipo Documento]                           AS tipo_documento,
          Moneda                                     AS moneda,
          [Estado Letra / Factura Negociable]        AS estado_letra,
          [Grupo Cliente]                            AS grupo_cliente,
          CASE
            WHEN DATEDIFF(day, [Fecha Vencimiento], GETDATE()) > 90 THEN 'Vencido Crítico'
            WHEN DATEDIFF(day, [Fecha Vencimiento], GETDATE()) > 30 THEN 'Vencido'
            WHEN DATEDIFF(day, [Fecha Vencimiento], GETDATE()) > 0  THEN 'Por Vencer'
            ELSE 'Vigente'
          END AS estado
        FROM dbo.stg_al004_letras_facturas
        WHERE [Importe Pendiente] != 0
        ORDER BY ABS([Importe Pendiente]) DESC
      `);
      return result.recordset.map((r: any) => ({
        ...r,
        monto_original: Math.round((Number(r.monto_original) || 0) * 100) / 100,
        monto_pagado: Math.round(Math.abs(Number(r.monto_pagado) || 0) * 100) / 100,
        saldo_pendiente: Math.round((Number(r.saldo_pendiente) || 0) * 100) / 100,
        fecha_emision: r.fecha_emision ? new Date(r.fecha_emision).toISOString().split('T')[0] : '',
        fecha_vencimiento: r.fecha_vencimiento ? new Date(r.fecha_vencimiento).toISOString().split('T')[0] : '',
      }));
    } catch (error) {
      console.error('Error in getCarteraTransacciones:', error);
      return [];
    }
  },

  // ---- ALERTAS (Mock completo basado en las 55 alertas SAP) ----
  async getAlertasSAP() {
    return [
      { id: 1, modulo: 'INV', nombre: 'Estados de producto en almacén Monteazul', consulta_guardada: 'AL007', prioridad: 'Normal', frecuencia: 15, periodo: 'Días', activa: true, hora_envio: '08:00', destinatarios: ['zmosquera@pointandina.com'] },
      { id: 2, modulo: 'INV', nombre: 'Stock mínimo - Considerar stock + pedido', consulta_guardada: 'AL001', prioridad: 'Normal', frecuencia: 1, periodo: 'Días', activa: true, hora_envio: '07:00', destinatarios: ['zmosquera@pointandina.com'] },
      { id: 3, modulo: 'INV', nombre: 'Alerta de Fecha de Vencimiento por Lote 300 días antes', consulta_guardada: 'AL002', prioridad: 'Normal', frecuencia: 1, periodo: 'Semanas', activa: true, hora_envio: '08:00', destinatarios: ['klopez@pointandina.com'] },
      { id: 4, modulo: 'INV', nombre: 'Almacén de Cuarentena (40 días)', consulta_guardada: 'AL003', prioridad: 'Normal', frecuencia: 1, periodo: 'Días', activa: true, hora_envio: '08:00', destinatarios: ['klopez@pointandina.com'] },
      { id: 5, modulo: 'INV', nombre: 'Ordenes de venta por despachar', consulta_guardada: 'AL004', prioridad: 'Normal', frecuencia: 1, periodo: 'Días', activa: true, hora_envio: '16:00', destinatarios: ['klopez@pointandina.com'] },
      { id: 6, modulo: 'INV', nombre: 'Guías sin facturas, máximo 1 día de diferencia', consulta_guardada: 'AL005', prioridad: 'Normal', frecuencia: 1, periodo: 'Días', activa: true, hora_envio: '16:00', destinatarios: ['klopez@pointandina.com'] },
      { id: 7, modulo: 'CXC', nombre: 'Letras con seguro INSUR', consulta_guardada: 'AL001', prioridad: 'Normal', frecuencia: 1, periodo: 'Días', activa: true, hora_envio: '09:00', destinatarios: ['lquispe@pointandina.com'] },
      { id: 8, modulo: 'CXC', nombre: 'Todas las letras (2 días por vencer) y facturas', consulta_guardada: 'AL004', prioridad: 'Normal', frecuencia: 1, periodo: 'Días', activa: true, hora_envio: '09:00', destinatarios: ['lquispe@pointandina.com'] },
      { id: 9, modulo: 'CXC', nombre: 'Todas las letras (8 días de retraso) y facturas', consulta_guardada: 'AL005', prioridad: 'Normal', frecuencia: 1, periodo: 'Días', activa: true, hora_envio: '09:00', destinatarios: ['lquispe@pointandina.com'] },
      { id: 10, modulo: 'CXC', nombre: 'Letras emitidas no aceptadas', consulta_guardada: 'AL005', prioridad: 'Normal', frecuencia: 1, periodo: 'Días', activa: true, hora_envio: '10:00', destinatarios: ['lquispe@pointandina.com'] },
      { id: 11, modulo: 'CXC', nombre: 'Alerta de cartera total', consulta_guardada: 'AL008', prioridad: 'Normal', frecuencia: 1, periodo: 'Semanas', activa: true, hora_envio: '08:00', destinatarios: ['lquispe@pointandina.com'] },
      { id: 16, modulo: 'VEN', nombre: 'Margen entre 25% a 11%', consulta_guardada: 'AL002', prioridad: 'Normal', frecuencia: 1, periodo: 'Minutos', activa: true, hora_envio: 'Tiempo real', destinatarios: ['zmosquera@pointandina.com'] },
      { id: 17, modulo: 'VEN', nombre: 'Margen menor a 11%', consulta_guardada: 'AL004', prioridad: 'Normal', frecuencia: 1, periodo: 'Minutos', activa: true, hora_envio: 'Tiempo real', destinatarios: ['zmosquera@pointandina.com'] },
      { id: 18, modulo: 'FIN', nombre: 'Anticipos por generar 11 AM', consulta_guardada: 'AL003', prioridad: 'Normal', frecuencia: 1, periodo: 'Días', activa: true, hora_envio: '11:00', destinatarios: ['lquispe@pointandina.com'] },
      { id: 19, modulo: 'FIN', nombre: 'Anticipos por generar', consulta_guardada: 'AL003', prioridad: 'Normal', frecuencia: 1, periodo: 'Días', activa: true, hora_envio: '17:00', destinatarios: ['lquispe@pointandina.com'] },
      { id: 20, modulo: 'VEN', nombre: 'Leads creados', consulta_guardada: 'AL008', prioridad: 'Normal', frecuencia: 1, periodo: 'Días', activa: true, hora_envio: '18:00', destinatarios: ['zmosquera@pointandina.com'] },
      { id: 21, modulo: 'VEN', nombre: 'Ordenes de venta no atendidas 6PM', consulta_guardada: 'AL001', prioridad: 'Normal', frecuencia: 1, periodo: 'Días', activa: true, hora_envio: '18:00', destinatarios: ['zmosquera@pointandina.com'] },
      { id: 22, modulo: 'VEN', nombre: 'Ordenes de venta no atendidas 2PM', consulta_guardada: 'AL001', prioridad: 'Normal', frecuencia: 1, periodo: 'Días', activa: true, hora_envio: '14:00', destinatarios: ['zmosquera@pointandina.com'] },
      { id: 23, modulo: 'VEN', nombre: 'Pedidos aprobados sin generarse 08:50 AM', consulta_guardada: 'AL007', prioridad: 'Normal', frecuencia: 1, periodo: 'Días', activa: true, hora_envio: '08:50', destinatarios: ['klopez@pointandina.com'] },
      { id: 24, modulo: 'VEN', nombre: 'Pedidos aprobados sin generarse 02:50 PM', consulta_guardada: 'AL007', prioridad: 'Normal', frecuencia: 1, periodo: 'Días', activa: true, hora_envio: '14:50', destinatarios: ['klopez@pointandina.com'] },
      { id: 25, modulo: 'VEN', nombre: 'Pedidos creados desde Mobile 08:30', consulta_guardada: 'AL006', prioridad: 'Normal', frecuencia: 1, periodo: 'Días', activa: true, hora_envio: '08:30', destinatarios: ['klopez@pointandina.com'] },
      { id: 26, modulo: 'VEN', nombre: 'Pedidos creados desde Mobile 2:30 PM', consulta_guardada: 'AL006', prioridad: 'Normal', frecuencia: 1, periodo: 'Días', activa: true, hora_envio: '14:30', destinatarios: ['klopez@pointandina.com'] },
      { id: 27, modulo: 'VEN', nombre: 'Productos en almacén de vendedor (+15 días)', consulta_guardada: 'AL011', prioridad: 'Normal', frecuencia: 1, periodo: 'Semanas', activa: true, hora_envio: '08:00', destinatarios: ['zmosquera@pointandina.com'] },
      { id: 28, modulo: 'VEN', nombre: 'Alerta de factura y su margen', consulta_guardada: 'AL012', prioridad: 'Alta', frecuencia: 1, periodo: 'Días', activa: true, hora_envio: '19:00', destinatarios: ['zmosquera@pointandina.com'] },
      { id: 45, modulo: 'VEN', nombre: 'Alerta por vendedor y zona', consulta_guardada: 'AL009', prioridad: 'Normal', frecuencia: 1, periodo: 'Días', activa: true, hora_envio: '18:00', destinatarios: ['zmosquera@pointandina.com'] },
      { id: 48, modulo: 'CMP', nombre: 'Alerta de fecha de entrega (7 días antes)', consulta_guardada: 'AL001', prioridad: 'Alta', frecuencia: 1, periodo: 'Días', activa: true, hora_envio: '08:00', destinatarios: ['klopez@pointandina.com'] },
      { id: 53, modulo: 'VEN', nombre: 'Alerta por zona y vendedor 1 día antes', consulta_guardada: 'AL009', prioridad: 'Normal', frecuencia: 1, periodo: 'Días', activa: true, hora_envio: '07:00', destinatarios: ['zmosquera@pointandina.com'] },
      { id: 46, modulo: 'VEN', nombre: 'Guías despachadas 12am a 2pm', consulta_guardada: 'AL010', prioridad: 'Normal', frecuencia: 1, periodo: 'Días', activa: true, hora_envio: '14:00', destinatarios: ['klopez@pointandina.com'] },
      { id: 47, modulo: 'VEN', nombre: 'Guías despachadas 2pm a 11:59pm', consulta_guardada: 'AL010', prioridad: 'Normal', frecuencia: 1, periodo: 'Días', activa: true, hora_envio: '23:59', destinatarios: ['klopez@pointandina.com'] },
      { id: 43, modulo: 'VEN', nombre: 'Clientes con deudas vencidas y sin línea disponible', consulta_guardada: 'AL003', prioridad: 'Normal', frecuencia: 1, periodo: 'Días', activa: true, hora_envio: '09:00', destinatarios: ['zmosquera@pointandina.com'] },
    ];
  },

  async getAlertaResultado(alertaId: number, fecha: string) {
    // Mock: genera resultado de la alerta como si fuera el contenido del correo
    const vendedores = MOCK_VENDEDORES;
    const clientes = MOCK_CLIENTES;
    const productos = MOCK_PRODUCTOS;

    const rows = [];
    const count = Math.floor(Math.random() * 8) + 3;
    for (let i = 0; i < count; i++) {
      const v = vendedores[i % vendedores.length];
      rows.push({
        numero_orden: `${Math.floor(Math.random() * 900000000 + 100000000)}`,
        cliente: clientes[i % clientes.length],
        ruc: `20${Math.floor(Math.random() * 900000000 + 100000000)}`,
        articulo: `PROD${String(i).padStart(4, '0')}`,
        descripcion: productos[i % productos.length],
        fecha_entrega: fecha,
        dias_atraso: Math.floor(Math.random() * 45),
        total_linea: Math.round(Math.random() * 5000 + 100),
        total_usd: Math.round(Math.random() * 10000 + 500),
        comentarios: ['Modificar precio', 'Transferencia gratuita', 'LETRAS A 90,100,110 DIAS', 'Pendiente aprobación', 'Despacho urgente'][Math.floor(Math.random() * 5)],
        vendedor: v.nombre,
        zona: v.zona,
        supervisor: v.series === 'AGRO' || v.series === 'COST' ? 'Zaida Mosquera' : 'Katye Lopez',
        hora_alerta: `${String(Math.floor(Math.random() * 12 + 7)).padStart(2, '0')}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}`,
        fecha_aprobacion: fecha,
      });
    }
    return rows;
  },

  async getOrdenesNoAtendidas() {
    return [
      { numero_orden: '10', cliente: 'L Y B SERVIC Y NEGOCIOS GRLES E.I.R.LTDA', articulo: 'QINS000031', descripcion: 'DESTINO 1.8 EC X 1 LT', fecha_entrega: '2026-03-05', dias_atraso: 34, total_usd: 3834.00, comentarios: 'Modificar precio Destino 6.25 USD, Lite 9 USD, Mandatario 15 USD', fecha_aprobacion: '2026-03-04', hora_aprobacion: '09:59', vendedor: 'Carlos Ramirez', zona: 'Lima Norte', supervisor: 'Zaida Mosquera' },
      { numero_orden: '600000011', cliente: 'AGRO INVERSIONES GENERALES MENDEZ S.A.C.', articulo: 'NENO000002', descripcion: 'FULVI GROW EHT 85% X 500GR', fecha_entrega: '2026-03-07', dias_atraso: 32, total_usd: 107.08, comentarios: 'Transferencia gratuita, POINT paga el flete', fecha_aprobacion: '2026-03-09', hora_aprobacion: '16:53', vendedor: 'Ana Torres', zona: 'Ica', supervisor: 'Zaida Mosquera' },
      { numero_orden: '200000049', cliente: 'INVERSIONES QUIVEN S.A.C.', articulo: 'BNAT000002', descripcion: 'ECO VIGOR STIM X 1LT', fecha_entrega: '2026-03-07', dias_atraso: 32, total_usd: 360.36, comentarios: 'CARGUEROS CELENDINO SRL, LETRAS A 90,100,110 Y 120 DIAS', fecha_aprobacion: '2026-03-06', hora_aprobacion: '17:24', vendedor: 'Luis Centurion', zona: 'La Libertad', supervisor: 'Zaida Mosquera' },
      { numero_orden: '200000050', cliente: 'INVERSIONES QUIVEN S.A.C.', articulo: 'QINS000107', descripcion: 'WARRIOR 50 EC X 1 L', fecha_entrega: '2026-03-07', dias_atraso: 32, total_usd: 648.65, comentarios: 'CARGUEROS CELENDINO SRL, LETRAS A 90,100,110 Y 120 DIAS', fecha_aprobacion: '2026-03-06', hora_aprobacion: '17:24', vendedor: 'Felix Espiritu', zona: 'Junin', supervisor: 'Katye Lopez' },
      { numero_orden: '200000051', cliente: 'INVERSIONES QUIVEN S.A.C.', articulo: 'BNAT000002', descripcion: 'ECO VIGOR STIM X 1LT', fecha_entrega: '2026-03-07', dias_atraso: 32, total_usd: 2162.16, comentarios: 'CARGUEROS CELENDINO SRL', fecha_aprobacion: '2026-03-06', hora_aprobacion: '17:24', vendedor: 'Pedro Bustamante', zona: 'Arequipa', supervisor: 'Zaida Mosquera' },
    ];
  },

  async getDiccionario() {
    if (USE_MOCK_VENTAS) {
      return {
        familias: MOCK_FAMILIAS,
        sub_familias: MOCK_SUBFAMILIAS,
        ingredientes_activos: MOCK_IA,
        vendedores: MOCK_VENDEDORES.map(v => ({ nombre: v.nombre, zona: v.zona, equipo: v.series })),
        zonas: [...new Set(MOCK_VENDEDORES.map(v => v.zona))],
        lineas_negocio: ['Agroquímicos', 'Nutricionales', 'Bioestimulantes', 'Especialidades', 'Semillas'],
        centros_costo: ['CC001 - Ventas Lima', 'CC002 - Ventas Norte', 'CC003 - Ventas Sur', 'CC004 - Ventas Centro', 'CC005 - Ventas Oriente', 'CC006 - Marketing', 'CC007 - Logística'],
        grupos_cliente: ['AGROINDUSTRIAS', 'DIST. COSTA', 'DIST. SIERRA / SELVA', 'ONLINE'],
      };
    }
    const pool = await getDbPool();
    const [familias, subFam, ia, vendedores, zonas, divisiones, gc] = await Promise.all([
      pool.request().query(`SELECT DISTINCT Familia FROM dbo.stg_rpt_ventas_detallado WHERE Pais='Peru' AND Familia IS NOT NULL ORDER BY Familia`),
      pool.request().query(`SELECT DISTINCT [Sub Familia] AS sf FROM dbo.stg_rpt_ventas_detallado WHERE Pais='Peru' AND [Sub Familia] IS NOT NULL ORDER BY [Sub Familia]`),
      pool.request().query(`SELECT DISTINCT Ingrediente_Activo FROM dbo.stg_rpt_ventas_detallado WHERE Pais='Peru' AND Ingrediente_Activo IS NOT NULL AND Ingrediente_Activo != '' ORDER BY Ingrediente_Activo`),
      pool.request().query(`SELECT DISTINCT Codigo_Vendedor, Vendedor, Zona FROM dbo.stg_rpt_ventas_detallado WHERE Pais='Peru' AND Vendedor IS NOT NULL AND Vendedor != '' AND Zona IS NOT NULL AND Zona != '' ORDER BY Vendedor`),
      pool.request().query(`SELECT DISTINCT Zona FROM dbo.stg_rpt_ventas_detallado WHERE Pais='Peru' AND Zona IS NOT NULL AND Zona != '' ORDER BY Zona`),
      pool.request().query(`SELECT DISTINCT [División] AS div FROM dbo.stg_rpt_ventas_detallado WHERE Pais='Peru' AND [División] IS NOT NULL AND [División] != '' ORDER BY [División]`),
      pool.request().query(`SELECT DISTINCT Grupo_Cliente FROM dbo.stg_rpt_ventas_detallado WHERE Pais='Peru' AND Grupo_Cliente IS NOT NULL AND Grupo_Cliente != '' ORDER BY Grupo_Cliente`),
    ]);
    return {
      familias: familias.recordset.map((r: any) => r.Familia),
      sub_familias: subFam.recordset.map((r: any) => r.sf),
      ingredientes_activos: ia.recordset.map((r: any) => r.Ingrediente_Activo),
      vendedores: vendedores.recordset.map((r: any) => ({ nombre: r.Vendedor, zona: r.Zona, equipo: '' })),
      zonas: zonas.recordset.map((r: any) => r.Zona),
      lineas_negocio: divisiones.recordset.map((r: any) => r.div),
      centros_costo: [],
      grupos_cliente: gc.recordset.map((r: any) => r.Grupo_Cliente),
    };
  },

  // ---- FACTURACION: cruce documento → vendedor ----
  async getVendedoresPorDocumentos(): Promise<Record<string, { vendedor: string; zona: string }>> {
    if (USE_MOCK_VENTAS) return {};

    try {
      const pool = await getDbPool();
      // Build lookup: strip "01-" prefix from Numero_SAP, group by doc suffix → vendedor
      // docNumbers come as "F001-00039306" from emails, SQL has "01-F001-00039306"
      const result = await pool.request().query(`
        SELECT
          SUBSTRING(Numero_SAP, CHARINDEX('-', Numero_SAP) + 1, LEN(Numero_SAP)) AS doc_num,
          Vendedor,
          Zona
        FROM dbo.stg_rpt_ventas_detallado
        WHERE Pais = 'Peru' AND Numero_SAP IS NOT NULL AND Numero_SAP != ''
        GROUP BY SUBSTRING(Numero_SAP, CHARINDEX('-', Numero_SAP) + 1, LEN(Numero_SAP)), Vendedor, Zona
      `);

      const map: Record<string, { vendedor: string; zona: string }> = {};
      for (const row of result.recordset) {
        if (row.doc_num && row.Vendedor) {
          map[row.doc_num] = { vendedor: row.Vendedor, zona: row.Zona || '' };
        }
      }
      return map;
    } catch (error) {
      console.error('Error in getVendedoresPorDocumentos:', error);
      return {};
    }
  },

  async getVendedoresFacturacion(): Promise<string[]> {
    if (USE_MOCK_VENTAS) return [];
    try {
      const pool = await getDbPool();
      const result = await pool.request().query(`
        SELECT DISTINCT Vendedor FROM dbo.stg_rpt_ventas_detallado
        WHERE Pais = 'Peru' AND Vendedor IS NOT NULL AND Vendedor != ''
        ORDER BY Vendedor
      `);
      return result.recordset.map((r: any) => r.Vendedor);
    } catch (error) {
      console.error('Error fetching vendedores facturacion:', error);
      return [];
    }
  },

  // ---- ESTADO DE CUENTA (stg_estado_cuenta_jdt) ----

  async getEstadoCuenta(filtros: any): Promise<any[]> {
    const pool = await getDbPool();
    const request = pool.request();
    const where: string[] = ['1=1'];

    if (filtros.vendedor) {
      request.input('vendedor', sql.NVarChar, filtros.vendedor);
      where.push('Cli_Vendedor = @vendedor');
    }
    if (filtros.cliente) {
      request.input('cliente', sql.NVarChar, `%${filtros.cliente}%`);
      where.push('(Cli_Nombre LIKE @cliente OR Cli_RUC LIKE @cliente)');
    }
    if (filtros.tipoDocumento) {
      request.input('td', sql.NVarChar, filtros.tipoDocumento);
      where.push('TD = @td');
    }
    if (filtros.moneda) {
      request.input('moneda', sql.NVarChar, filtros.moneda);
      where.push('Moneda = @moneda');
    }
    if (filtros.numero) {
      request.input('numero', sql.NVarChar, `%${filtros.numero}%`);
      where.push('Numero LIKE @numero');
    }

    const result = await request.query(`
      SELECT
        Fecha_Corte AS fecha_corte,
        CardCode AS card_code,
        Cli_Nombre AS cli_nombre,
        Cli_RUC AS cli_ruc,
        Cli_Direccion AS cli_direccion,
        Cli_LineaCredito AS cli_linea_credito,
        Cli_Telefono AS cli_telefono,
        Cli_Email AS cli_email,
        Cli_Estado AS cli_estado,
        Cli_Condado AS cli_condado,
        Cli_Ciudad AS cli_ciudad,
        Cli_Vendedor AS cli_vendedor,
        Cli_Contacto AS cli_contacto,
        Cli_Vencimiento AS cli_vencimiento,
        TD AS td,
        TipoTransaccion AS tipo_transaccion,
        TransId AS trans_id,
        NroAsiento AS nro_asiento,
        Numero AS numero,
        F_Emision AS f_emision,
        F_Vcto AS f_vcto,
        Dias AS dias,
        Moneda AS moneda,
        ImporteOriginal AS importe_original,
        ACuenta AS a_cuenta,
        Saldo AS saldo,
        Monto_Retencion AS monto_retencion,
        Banco AS banco,
        N_Unico AS n_unico,
        Observacion AS observacion
      FROM dbo.stg_estado_cuenta_jdt
      WHERE ${where.join(' AND ')}
      ORDER BY Cli_Nombre, F_Vcto
    `);

    return result.recordset;
  },

  async getEstadoCuentaFiltros(): Promise<any> {
    const pool = await getDbPool();
    const [vendedores, tiposDoc, monedas, fechaCorte] = await Promise.all([
      pool.request().query(`SELECT DISTINCT Cli_Vendedor FROM dbo.stg_estado_cuenta_jdt WHERE Cli_Vendedor IS NOT NULL ORDER BY Cli_Vendedor`),
      pool.request().query(`SELECT DISTINCT TD FROM dbo.stg_estado_cuenta_jdt WHERE TD IS NOT NULL ORDER BY TD`),
      pool.request().query(`SELECT DISTINCT Moneda FROM dbo.stg_estado_cuenta_jdt WHERE Moneda IS NOT NULL ORDER BY Moneda`),
      pool.request().query(`SELECT TOP 1 Fecha_Corte FROM dbo.stg_estado_cuenta_jdt ORDER BY Fecha_Corte DESC`),
    ]);
    return {
      vendedores: vendedores.recordset.map((r: any) => r.Cli_Vendedor),
      tipos_documento: tiposDoc.recordset.map((r: any) => r.TD),
      monedas: monedas.recordset.map((r: any) => r.Moneda),
      fecha_corte: fechaCorte.recordset[0]?.Fecha_Corte || null,
    };
  },

  async getEstadoCuentaResumen(): Promise<any> {
    const pool = await getDbPool();
    const result = await pool.request().query(`
      SELECT
        COUNT(*) AS total_registros,
        COUNT(DISTINCT CardCode) AS total_clientes,
        SUM(CAST(Saldo AS FLOAT)) AS saldo_total,
        SUM(CASE WHEN Dias < 0 THEN CAST(Saldo AS FLOAT) ELSE 0 END) AS saldo_vencido,
        SUM(CASE WHEN Dias >= 0 THEN CAST(Saldo AS FLOAT) ELSE 0 END) AS saldo_vigente,
        MAX(Fecha_Corte) AS fecha_corte
      FROM dbo.stg_estado_cuenta_jdt
    `);
    return result.recordset[0];
  },
};
