// ============================================================
// COMEX Service - queries sobre tablas icb_cx_*
// Bloque "Competidores" de Inteligencia Comercial Beta
// Solo data externa (SUNAT, BCR, MINCETUR, INEI, etc.)
// NO cruza con Point Andina ni SAP.
// ============================================================

import { getDbPool, sql } from '../config/database';

// ------------------------------------------------------------
// Tipos
// ------------------------------------------------------------

export interface CxMeta {
  empresas_competidoras: number;
  partidas: number;
  paises: number;
  productos: number;
  importaciones_count: number;
  periodo_desde: string | null;
  periodo_hasta: string | null;
  last_run: string | null;
  last_run_status: string | null;
  tables_exist: boolean;
}

export interface Partida {
  partida_id: number;
  hs_code: string;
  hs_chapter: string;
  descripcion: string;
  familia_pa: string | null;
  tipo_grupo: string | null;
}

export interface Empresa {
  empresa_id: number;
  ruc: string | null;
  razon_social: string;
  nombre_comercial: string | null;
  tipo_empresa: string | null;
  es_competidor: boolean;
}

export interface Pais {
  pais_id: number;
  iso2: string;
  iso3: string | null;
  nombre: string;
  continente: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface ImportacionRow {
  import_id: number;
  empresa: string | null;
  empresa_tipo: string | null;
  partida: string | null;
  partida_descripcion: string | null;
  familia_pa: string | null;
  pais_origen: string | null;
  pais_iso2: string | null;
  producto: string | null;
  periodo_year: number;
  periodo_month: number | null;
  cantidad_kg: number | null;
  valor_cif_usd: number | null;
  valor_fob_usd: number | null;
  source_name: string | null;
  created_at: string;
}

export interface RankingCompetidor {
  empresa_id: number;
  razon_social: string;
  nombre_comercial: string | null;
  tipo_empresa: string | null;
  total_valor_cif_usd: number;
  total_cantidad_kg: number;
  operaciones: number;
  partidas_distintas: number;
  paises_distintos: number;
  share_pct: number;
}

export interface FlowRow {
  pais_origen: string;
  iso2: string;
  latitude: number | null;
  longitude: number | null;
  total_valor_cif_usd: number;
  total_cantidad_kg: number;
  empresas: number;
  share_pct: number;
}

export interface CxSource {
  source_id: number;
  source_code: string;
  source_name: string;
  source_url: string;
  source_owner: string | null;
  source_type: string;
  extraction_method: string;
  active_flag: boolean;
  last_run_at: string | null;
  last_run_status: string | null;
  last_run_records: number | null;
}

export interface PartidaResumen {
  partida_id: number;
  hs_code: string;
  descripcion: string;
  familia_pa: string | null;
  total_valor_cif_usd: number;
  total_cantidad_kg: number;
  empresas_activas: number;
  empresas_nombres: string[];   // nombres comerciales (top 5 por CIF)
  paises_origen: number;
}

// ------------------------------------------------------------
// Helper: verifica existencia de las tablas
// ------------------------------------------------------------

async function tablesExist(): Promise<boolean> {
  try {
    const pool = await getDbPool();
    const res = await pool.request().query(`
      SELECT COUNT(*) AS cnt
      FROM sys.tables
      WHERE name IN (
        'icb_cx_dim_partida','icb_cx_dim_empresa','icb_cx_dim_pais',
        'icb_cx_fact_importacion'
      )
    `);
    return (res.recordset[0]?.cnt || 0) >= 4;
  } catch {
    return false;
  }
}

// ------------------------------------------------------------
// Service
// ------------------------------------------------------------

class ComexService {
  async getMeta(): Promise<CxMeta> {
    const exists = await tablesExist();
    if (!exists) {
      return {
        empresas_competidoras: 0, partidas: 0, paises: 0, productos: 0,
        importaciones_count: 0, periodo_desde: null, periodo_hasta: null,
        last_run: null, last_run_status: null, tables_exist: false,
      };
    }

    const pool = await getDbPool();
    const q = await pool.request().query(`
      SELECT
        (SELECT COUNT(*) FROM dbo.icb_cx_dim_empresa WHERE active_flag = 1 AND es_competidor = 1) AS empresas,
        (SELECT COUNT(*) FROM dbo.icb_cx_dim_partida WHERE active_flag = 1) AS partidas,
        (SELECT COUNT(*) FROM dbo.icb_cx_dim_pais WHERE active_flag = 1) AS paises,
        (SELECT COUNT(*) FROM dbo.icb_cx_dim_producto WHERE active_flag = 1) AS productos,
        (SELECT COUNT(*) FROM dbo.icb_cx_fact_importacion) AS imps,
        (SELECT MIN(periodo_year * 100 + ISNULL(periodo_month, 1)) FROM dbo.icb_cx_fact_importacion) AS periodo_desde,
        (SELECT MAX(periodo_year * 100 + ISNULL(periodo_month, 12)) FROM dbo.icb_cx_fact_importacion) AS periodo_hasta
    `);
    const last = await pool.request().query(`
      SELECT TOP 1 r.finished_at, r.status
      FROM dbo.icb_etl_run_log r
      INNER JOIN dbo.icb_dim_source s ON r.source_id = s.source_id
      WHERE r.finished_at IS NOT NULL
        AND s.source_code IN ('SUNAT_TRANSPARENCIA','SUNAT_ADUANET','BCR_COMEX','MINCETUR_ESTADISTICAS','INEI_COMEX','DATOS_ABIERTOS_COMEX','ADEX_ESTADISTICAS','CCL_COMEX','SENASA_PLAGUICIDAS','BASELINE_PE_COMEX')
      ORDER BY r.finished_at DESC
    `);
    const row = q.recordset[0];
    const lastRow = last.recordset[0];
    return {
      empresas_competidoras: row?.empresas || 0,
      partidas: row?.partidas || 0,
      paises: row?.paises || 0,
      productos: row?.productos || 0,
      importaciones_count: row?.imps || 0,
      periodo_desde: row?.periodo_desde ? String(row.periodo_desde) : null,
      periodo_hasta: row?.periodo_hasta ? String(row.periodo_hasta) : null,
      last_run: lastRow?.finished_at || null,
      last_run_status: lastRow?.status || null,
      tables_exist: true,
    };
  }

  // Fuentes externas del dominio COMEX (SUNAT, BCR, MINCETUR, etc.)
  async getSources(): Promise<CxSource[]> {
    if (!(await tablesExist())) return [];
    const pool = await getDbPool();
    const res = await pool.request().query(`
      SELECT
        s.source_id, s.source_code, s.source_name, s.source_url,
        s.source_owner, s.source_type, s.extraction_method, s.active_flag,
        r.finished_at AS last_run_at, r.status AS last_run_status, r.records_inserted AS last_run_records
      FROM dbo.icb_dim_source s
      OUTER APPLY (
        SELECT TOP 1 finished_at, status, records_inserted
        FROM dbo.icb_etl_run_log
        WHERE source_id = s.source_id AND finished_at IS NOT NULL
        ORDER BY finished_at DESC
      ) r
      WHERE s.active_flag = 1
        AND s.source_code IN (
          'SUNAT_TRANSPARENCIA','SUNAT_ADUANET','BCR_COMEX',
          'MINCETUR_ESTADISTICAS','INEI_COMEX','DATOS_ABIERTOS_COMEX',
          'ADEX_ESTADISTICAS','CCL_COMEX','SENASA_PLAGUICIDAS','BASELINE_PE_COMEX'
        )
      ORDER BY s.source_owner, s.source_name
    `);
    return res.recordset;
  }

  async getPartidas(): Promise<Partida[]> {
    if (!(await tablesExist())) return [];
    const pool = await getDbPool();
    const res = await pool.request().query(`
      SELECT partida_id, hs_code, hs_chapter, descripcion, familia_pa, tipo_grupo
      FROM dbo.icb_cx_dim_partida WHERE active_flag = 1
      ORDER BY hs_code
    `);
    return res.recordset;
  }

  async getEmpresas(): Promise<Empresa[]> {
    if (!(await tablesExist())) return [];
    const pool = await getDbPool();
    const res = await pool.request().query(`
      SELECT empresa_id, ruc, razon_social, nombre_comercial, tipo_empresa,
        CAST(es_competidor AS BIT) AS es_competidor
      FROM dbo.icb_cx_dim_empresa
      WHERE active_flag = 1
      ORDER BY es_competidor DESC, razon_social
    `);
    return res.recordset;
  }

  async getPaises(): Promise<Pais[]> {
    if (!(await tablesExist())) return [];
    const pool = await getDbPool();
    const res = await pool.request().query(`
      SELECT pais_id, iso2, iso3, nombre, continente, latitude, longitude
      FROM dbo.icb_cx_dim_pais WHERE active_flag = 1
      ORDER BY nombre
    `);
    return res.recordset;
  }

  // Lista de importaciones filtrable
  async getImportaciones(filtros: {
    empresa_id?: number; partida_id?: number; pais_id?: number;
    year?: number; month?: number; familia_pa?: string;
    limit?: number;
  } = {}): Promise<ImportacionRow[]> {
    if (!(await tablesExist())) return [];
    const pool = await getDbPool();
    const req = pool.request();
    const where: string[] = [];

    if (filtros.empresa_id) { req.input('empresa_id', sql.Int, filtros.empresa_id); where.push('f.empresa_id = @empresa_id'); }
    if (filtros.partida_id) { req.input('partida_id', sql.Int, filtros.partida_id); where.push('f.partida_id = @partida_id'); }
    if (filtros.pais_id) { req.input('pais_id', sql.Int, filtros.pais_id); where.push('f.pais_origen_id = @pais_id'); }
    if (filtros.year) { req.input('year', sql.Int, filtros.year); where.push('f.periodo_year = @year'); }
    if (filtros.month) { req.input('month', sql.Int, filtros.month); where.push('f.periodo_month = @month'); }
    if (filtros.familia_pa) { req.input('familia_pa', sql.NVarChar(40), filtros.familia_pa); where.push('p.familia_pa = @familia_pa'); }

    const limit = Math.min(Math.max(filtros.limit || 500, 1), 5000);
    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const res = await req.query(`
      SELECT TOP ${limit}
        f.import_id,
        e.razon_social AS empresa,
        e.tipo_empresa AS empresa_tipo,
        p.hs_code AS partida,
        p.descripcion AS partida_descripcion,
        p.familia_pa,
        pa.nombre AS pais_origen,
        pa.iso2 AS pais_iso2,
        pr.ingrediente_activo AS producto,
        f.periodo_year,
        f.periodo_month,
        f.cantidad_kg,
        f.valor_cif_usd,
        f.valor_fob_usd,
        s.source_name,
        f.created_at
      FROM dbo.icb_cx_fact_importacion f
      LEFT JOIN dbo.icb_cx_dim_empresa e ON f.empresa_id = e.empresa_id
      LEFT JOIN dbo.icb_cx_dim_partida p ON f.partida_id = p.partida_id
      LEFT JOIN dbo.icb_cx_dim_pais pa ON f.pais_origen_id = pa.pais_id
      LEFT JOIN dbo.icb_cx_dim_producto pr ON f.producto_id = pr.producto_id
      LEFT JOIN dbo.icb_dim_source s ON f.source_id = s.source_id
      ${whereClause}
      ORDER BY f.periodo_year DESC, f.periodo_month DESC, f.valor_cif_usd DESC
    `);
    return res.recordset;
  }

  // Ranking de competidores por valor importado
  async getRankingCompetidores(year?: number, limit = 20): Promise<RankingCompetidor[]> {
    if (!(await tablesExist())) return [];
    const pool = await getDbPool();
    const req = pool.request();
    const where: string[] = ['e.es_competidor = 1'];
    if (year) { req.input('year', sql.Int, year); where.push('f.periodo_year = @year'); }

    const cap = Math.min(Math.max(limit, 1), 100);

    // Total general para calcular share
    const totalRes = await pool.request()
      .input('year', sql.Int, year ?? null)
      .query(`
        SELECT SUM(f.valor_cif_usd) AS total_cif
        FROM dbo.icb_cx_fact_importacion f
        INNER JOIN dbo.icb_cx_dim_empresa e ON f.empresa_id = e.empresa_id
        WHERE e.es_competidor = 1
          AND (@year IS NULL OR f.periodo_year = @year)
      `);
    const totalCif = Number(totalRes.recordset[0]?.total_cif || 0);

    const res = await req.query(`
      SELECT TOP ${cap}
        e.empresa_id, e.razon_social, e.nombre_comercial, e.tipo_empresa,
        SUM(f.valor_cif_usd) AS total_valor_cif_usd,
        SUM(f.cantidad_kg) AS total_cantidad_kg,
        COUNT(f.import_id) AS operaciones,
        COUNT(DISTINCT f.partida_id) AS partidas_distintas,
        COUNT(DISTINCT f.pais_origen_id) AS paises_distintos
      FROM dbo.icb_cx_fact_importacion f
      INNER JOIN dbo.icb_cx_dim_empresa e ON f.empresa_id = e.empresa_id
      WHERE ${where.join(' AND ')}
      GROUP BY e.empresa_id, e.razon_social, e.nombre_comercial, e.tipo_empresa
      ORDER BY total_valor_cif_usd DESC
    `);

    return res.recordset.map((r: any) => {
      const cif = Number(r.total_valor_cif_usd || 0);
      return {
        empresa_id: r.empresa_id,
        razon_social: r.razon_social,
        nombre_comercial: r.nombre_comercial,
        tipo_empresa: r.tipo_empresa,
        total_valor_cif_usd: Math.round(cif * 100) / 100,
        total_cantidad_kg: Math.round(Number(r.total_cantidad_kg || 0) * 100) / 100,
        operaciones: r.operaciones,
        partidas_distintas: r.partidas_distintas,
        paises_distintos: r.paises_distintos,
        share_pct: totalCif > 0 ? Math.round((cif / totalCif) * 10000) / 100 : 0,
      };
    });
  }

  // Flujos origen-destino (agregado por país)
  async getFlows(year?: number, familiaPa?: string): Promise<FlowRow[]> {
    if (!(await tablesExist())) return [];
    const pool = await getDbPool();
    const req = pool.request();
    const where: string[] = ['pa.active_flag = 1'];
    if (year) { req.input('year', sql.Int, year); where.push('f.periodo_year = @year'); }
    if (familiaPa) { req.input('familia_pa', sql.NVarChar(40), familiaPa); where.push('p.familia_pa = @familia_pa'); }

    const totalRes = await pool.request()
      .input('year', sql.Int, year ?? null)
      .input('familia_pa', sql.NVarChar(40), familiaPa ?? null)
      .query(`
        SELECT SUM(f.valor_cif_usd) AS total_cif
        FROM dbo.icb_cx_fact_importacion f
        LEFT JOIN dbo.icb_cx_dim_partida p ON f.partida_id = p.partida_id
        WHERE (@year IS NULL OR f.periodo_year = @year)
          AND (@familia_pa IS NULL OR p.familia_pa = @familia_pa)
      `);
    const totalCif = Number(totalRes.recordset[0]?.total_cif || 0);

    const res = await req.query(`
      SELECT
        pa.nombre AS pais_origen,
        pa.iso2,
        pa.latitude,
        pa.longitude,
        SUM(f.valor_cif_usd) AS total_valor_cif_usd,
        SUM(f.cantidad_kg) AS total_cantidad_kg,
        COUNT(DISTINCT f.empresa_id) AS empresas
      FROM dbo.icb_cx_fact_importacion f
      INNER JOIN dbo.icb_cx_dim_pais pa ON f.pais_origen_id = pa.pais_id
      LEFT JOIN dbo.icb_cx_dim_partida p ON f.partida_id = p.partida_id
      WHERE ${where.join(' AND ')}
      GROUP BY pa.nombre, pa.iso2, pa.latitude, pa.longitude
      ORDER BY total_valor_cif_usd DESC
    `);

    return res.recordset.map((r: any) => {
      const cif = Number(r.total_valor_cif_usd || 0);
      return {
        pais_origen: r.pais_origen,
        iso2: r.iso2,
        latitude: r.latitude,
        longitude: r.longitude,
        total_valor_cif_usd: Math.round(cif * 100) / 100,
        total_cantidad_kg: Math.round(Number(r.total_cantidad_kg || 0) * 100) / 100,
        empresas: r.empresas,
        share_pct: totalCif > 0 ? Math.round((cif / totalCif) * 10000) / 100 : 0,
      };
    });
  }

  // Resumen por partida arancelaria
  async getPartidaResumen(year?: number): Promise<PartidaResumen[]> {
    if (!(await tablesExist())) return [];
    const pool = await getDbPool();

    // Agregado principal por partida
    const reqAgg = pool.request();
    const whereAgg: string[] = ['p.active_flag = 1'];
    if (year) { reqAgg.input('year', sql.Int, year); whereAgg.push('(f.periodo_year = @year OR f.periodo_year IS NULL)'); }

    const aggRes = await reqAgg.query(`
      SELECT
        p.partida_id, p.hs_code, p.descripcion, p.familia_pa,
        COALESCE(SUM(f.valor_cif_usd), 0) AS total_valor_cif_usd,
        COALESCE(SUM(f.cantidad_kg), 0) AS total_cantidad_kg,
        COUNT(DISTINCT f.empresa_id) AS empresas_activas,
        COUNT(DISTINCT f.pais_origen_id) AS paises_origen
      FROM dbo.icb_cx_dim_partida p
      LEFT JOIN dbo.icb_cx_fact_importacion f ON f.partida_id = p.partida_id
      WHERE ${whereAgg.join(' AND ')}
      GROUP BY p.partida_id, p.hs_code, p.descripcion, p.familia_pa
      ORDER BY total_valor_cif_usd DESC
    `);

    // Top empresas por partida (por CIF) — para mostrar nombres
    const reqNames = pool.request();
    const whereNames: string[] = [];
    if (year) { reqNames.input('year', sql.Int, year); whereNames.push('f.periodo_year = @year'); }
    const namesRes = await reqNames.query(`
      SELECT partida_id, nombre_comercial, razon_social, total_cif, rn FROM (
        SELECT
          f.partida_id,
          e.nombre_comercial,
          e.razon_social,
          SUM(f.valor_cif_usd) AS total_cif,
          ROW_NUMBER() OVER (PARTITION BY f.partida_id ORDER BY SUM(f.valor_cif_usd) DESC) AS rn
        FROM dbo.icb_cx_fact_importacion f
        INNER JOIN dbo.icb_cx_dim_empresa e ON f.empresa_id = e.empresa_id
        ${whereNames.length ? 'WHERE ' + whereNames.join(' AND ') : ''}
        GROUP BY f.partida_id, e.nombre_comercial, e.razon_social
      ) x
      WHERE rn <= 5
    `);

    // Indexa por partida_id
    const namesByPartida = new Map<number, string[]>();
    for (const row of namesRes.recordset) {
      const key = row.partida_id as number;
      if (!namesByPartida.has(key)) namesByPartida.set(key, []);
      namesByPartida.get(key)!.push(row.nombre_comercial || row.razon_social);
    }

    return aggRes.recordset.map((r: any) => ({
      partida_id: r.partida_id,
      hs_code: r.hs_code,
      descripcion: r.descripcion,
      familia_pa: r.familia_pa,
      total_valor_cif_usd: Math.round(Number(r.total_valor_cif_usd) * 100) / 100,
      total_cantidad_kg: Math.round(Number(r.total_cantidad_kg) * 100) / 100,
      empresas_activas: r.empresas_activas,
      empresas_nombres: namesByPartida.get(r.partida_id) || [],
      paises_origen: r.paises_origen,
    }));
  }

  // Tendencia mensual
  async getMonthlyTrend(year?: number): Promise<Array<{
    periodo_year: number; periodo_month: number;
    total_valor_cif_usd: number; total_cantidad_kg: number; operaciones: number;
  }>> {
    if (!(await tablesExist())) return [];
    const pool = await getDbPool();
    const req = pool.request();
    const where: string[] = ['f.periodo_month IS NOT NULL'];
    if (year) { req.input('year', sql.Int, year); where.push('f.periodo_year = @year'); }

    const res = await req.query(`
      SELECT
        f.periodo_year, f.periodo_month,
        SUM(f.valor_cif_usd) AS total_valor_cif_usd,
        SUM(f.cantidad_kg) AS total_cantidad_kg,
        COUNT(f.import_id) AS operaciones
      FROM dbo.icb_cx_fact_importacion f
      WHERE ${where.join(' AND ')}
      GROUP BY f.periodo_year, f.periodo_month
      ORDER BY f.periodo_year, f.periodo_month
    `);
    return res.recordset.map((r: any) => ({
      periodo_year: r.periodo_year,
      periodo_month: r.periodo_month,
      total_valor_cif_usd: Math.round(Number(r.total_valor_cif_usd || 0) * 100) / 100,
      total_cantidad_kg: Math.round(Number(r.total_cantidad_kg || 0) * 100) / 100,
      operaciones: r.operaciones,
    }));
  }

  // Distribución por familia PA (insecticidas, fungicidas, etc.)
  async getByFamiliaPa(year?: number): Promise<Array<{
    familia_pa: string; total_valor_cif_usd: number; total_cantidad_kg: number; empresas: number;
  }>> {
    if (!(await tablesExist())) return [];
    const pool = await getDbPool();
    const req = pool.request();
    const where: string[] = ['p.familia_pa IS NOT NULL'];
    if (year) { req.input('year', sql.Int, year); where.push('f.periodo_year = @year'); }
    const res = await req.query(`
      SELECT
        p.familia_pa,
        SUM(f.valor_cif_usd) AS total_valor_cif_usd,
        SUM(f.cantidad_kg) AS total_cantidad_kg,
        COUNT(DISTINCT f.empresa_id) AS empresas
      FROM dbo.icb_cx_fact_importacion f
      INNER JOIN dbo.icb_cx_dim_partida p ON f.partida_id = p.partida_id
      WHERE ${where.join(' AND ')}
      GROUP BY p.familia_pa
      ORDER BY total_valor_cif_usd DESC
    `);
    return res.recordset.map((r: any) => ({
      familia_pa: r.familia_pa,
      total_valor_cif_usd: Math.round(Number(r.total_valor_cif_usd || 0) * 100) / 100,
      total_cantidad_kg: Math.round(Number(r.total_cantidad_kg || 0) * 100) / 100,
      empresas: r.empresas,
    }));
  }
}

export const comexService = new ComexService();
