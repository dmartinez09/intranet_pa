// ============================================================
// Inteligencia Comercial Beta - Service
// Queries sobre tablas icb_* en Azure SQL
// Si las tablas no existen todavía (migración 002 no ejecutada),
// retorna datos vacíos sin romper la UI.
// ============================================================

import { getDbPool, sql } from '../config/database';

// Tipos compartidos
export interface IcbSource {
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

export interface IcbCrop {
  crop_id: number;
  crop_code: string;
  crop_name_standard: string;
  crop_group: string | null;
}

export interface IcbRegion {
  region_id: number;
  region_code: string;
  department: string;
  latitude: number | null;
  longitude: number | null;
}

export interface IcbCategory {
  category_id: number;
  category_code: string;
  category_name: string;
  category_group: string | null;
}

export interface IcbSnapshot {
  snapshot_id: number;
  source_name: string;
  source_owner: string | null;
  crop_name: string | null;
  crop_group: string | null;
  department: string | null;
  category_name: string | null;
  document_title: string | null;
  document_url: string | null;
  document_type: string | null;
  period_label: string | null;
  publication_date: string | null;
  capture_date: string;
  hectares: number | null;
  production_value: number | null;
  opportunity_score: number | null;
  opportunity_level: string | null;
  business_note: string | null;
}

export interface IcbGeoSummary {
  region_code: string;
  department: string;
  latitude: number | null;
  longitude: number | null;
  total_hectares: number;
  total_snapshots: number;
  opportunity_avg: number | null;
  opportunity_level: string | null;
  crops: string[];
}

export interface IcbMeta {
  sources: number;
  crops: number;
  regions: number;
  categories: number;
  snapshots: number;
  last_run: string | null;
  last_run_status: string | null;
  tables_exist: boolean;
}

export interface IcbEtlRun {
  run_id: number;
  pipeline_name: string;
  source_name: string | null;
  started_at: string;
  finished_at: string | null;
  status: string;
  records_read: number;
  records_inserted: number;
  records_updated: number;
  records_skipped: number;
  error_message: string | null;
  triggered_by: string | null;
}

// Helper: verifica si las tablas icb_* existen
async function tablesExist(): Promise<boolean> {
  try {
    const pool = await getDbPool();
    const res = await pool.request().query(`
      SELECT COUNT(*) AS cnt
      FROM sys.tables
      WHERE name IN ('icb_dim_source','icb_dim_crop','icb_dim_region','icb_dim_point_category','icb_fact_agri_market_snapshot','icb_etl_run_log')
    `);
    return (res.recordset[0]?.cnt || 0) >= 5;
  } catch (_err) {
    return false;
  }
}

class InteligenciaService {
  async getMeta(): Promise<IcbMeta> {
    const exists = await tablesExist();
    if (!exists) {
      return {
        sources: 0, crops: 0, regions: 0, categories: 0, snapshots: 0,
        last_run: null, last_run_status: null, tables_exist: false,
      };
    }

    const pool = await getDbPool();
    const q = await pool.request().query(`
      SELECT
        (SELECT COUNT(*) FROM dbo.icb_dim_source WHERE active_flag = 1) AS sources,
        (SELECT COUNT(*) FROM dbo.icb_dim_crop WHERE active_flag = 1) AS crops,
        (SELECT COUNT(*) FROM dbo.icb_dim_region WHERE active_flag = 1) AS regions,
        (SELECT COUNT(*) FROM dbo.icb_dim_point_category WHERE active_flag = 1) AS categories,
        (SELECT COUNT(*) FROM dbo.icb_fact_agri_market_snapshot) AS snapshots
    `);
    const last = await pool.request().query(`
      SELECT TOP 1 finished_at, status
      FROM dbo.icb_etl_run_log
      WHERE finished_at IS NOT NULL
      ORDER BY finished_at DESC
    `);
    const row = q.recordset[0];
    const lastRow = last.recordset[0];
    return {
      sources: row?.sources || 0,
      crops: row?.crops || 0,
      regions: row?.regions || 0,
      categories: row?.categories || 0,
      snapshots: row?.snapshots || 0,
      last_run: lastRow?.finished_at || null,
      last_run_status: lastRow?.status || null,
      tables_exist: true,
    };
  }

  async getSources(): Promise<IcbSource[]> {
    const exists = await tablesExist();
    if (!exists) return [];

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
      ORDER BY s.source_owner, s.source_name
    `);
    return res.recordset;
  }

  async getCrops(): Promise<IcbCrop[]> {
    const exists = await tablesExist();
    if (!exists) return [];
    const pool = await getDbPool();
    const res = await pool.request().query(`
      SELECT crop_id, crop_code, crop_name_standard, crop_group
      FROM dbo.icb_dim_crop WHERE active_flag = 1
      ORDER BY crop_name_standard
    `);
    return res.recordset;
  }

  async getRegions(): Promise<IcbRegion[]> {
    const exists = await tablesExist();
    if (!exists) return [];
    const pool = await getDbPool();
    const res = await pool.request().query(`
      SELECT region_id, region_code, department, latitude, longitude
      FROM dbo.icb_dim_region WHERE active_flag = 1
      ORDER BY department
    `);
    return res.recordset;
  }

  async getCategories(): Promise<IcbCategory[]> {
    const exists = await tablesExist();
    if (!exists) return [];
    const pool = await getDbPool();
    const res = await pool.request().query(`
      SELECT category_id, category_code, category_name, category_group
      FROM dbo.icb_dim_point_category WHERE active_flag = 1
      ORDER BY category_group, category_name
    `);
    return res.recordset;
  }

  async getSnapshots(filtros: {
    crop_id?: number; region_id?: number; category_id?: number;
    source_id?: number; from_date?: string; to_date?: string;
    limit?: number;
  } = {}): Promise<IcbSnapshot[]> {
    const exists = await tablesExist();
    if (!exists) return [];

    const pool = await getDbPool();
    const req = pool.request();
    const where: string[] = [];

    if (filtros.crop_id) { req.input('crop_id', sql.Int, filtros.crop_id); where.push('s.crop_id = @crop_id'); }
    if (filtros.region_id) { req.input('region_id', sql.Int, filtros.region_id); where.push('s.region_id = @region_id'); }
    if (filtros.category_id) { req.input('category_id', sql.Int, filtros.category_id); where.push('s.category_id = @category_id'); }
    if (filtros.source_id) { req.input('source_id', sql.Int, filtros.source_id); where.push('s.source_id = @source_id'); }
    if (filtros.from_date) { req.input('from_date', sql.Date, filtros.from_date); where.push('s.capture_date >= @from_date'); }
    if (filtros.to_date) { req.input('to_date', sql.Date, filtros.to_date); where.push('s.capture_date <= @to_date'); }

    const limit = Math.min(Math.max(filtros.limit || 500, 1), 5000);
    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const res = await req.query(`
      SELECT TOP ${limit}
        s.snapshot_id,
        src.source_name, src.source_owner,
        c.crop_name_standard AS crop_name, c.crop_group,
        r.department,
        cat.category_name,
        s.document_title, s.document_url, s.document_type,
        s.period_label, s.publication_date, s.capture_date,
        s.hectares, s.production_value,
        s.opportunity_score, s.opportunity_level, s.business_note
      FROM dbo.icb_fact_agri_market_snapshot s
      LEFT JOIN dbo.icb_dim_source src ON s.source_id = src.source_id
      LEFT JOIN dbo.icb_dim_crop c ON s.crop_id = c.crop_id
      LEFT JOIN dbo.icb_dim_region r ON s.region_id = r.region_id
      LEFT JOIN dbo.icb_dim_point_category cat ON s.category_id = cat.category_id
      ${whereClause}
      ORDER BY s.capture_date DESC, s.snapshot_id DESC
    `);
    return res.recordset;
  }

  async getGeoSummary(filtros: { crop_id?: number; category_id?: number } = {}): Promise<IcbGeoSummary[]> {
    const exists = await tablesExist();
    if (!exists) return [];

    const pool = await getDbPool();
    const req = pool.request();
    const where: string[] = ['r.active_flag = 1'];

    if (filtros.crop_id) { req.input('crop_id', sql.Int, filtros.crop_id); where.push('s.crop_id = @crop_id'); }
    if (filtros.category_id) { req.input('category_id', sql.Int, filtros.category_id); where.push('s.category_id = @category_id'); }

    const res = await req.query(`
      SELECT
        r.region_code,
        r.department,
        r.latitude,
        r.longitude,
        COALESCE(SUM(s.hectares), 0) AS total_hectares,
        COUNT(s.snapshot_id) AS total_snapshots,
        AVG(s.opportunity_score) AS opportunity_avg,
        MAX(s.opportunity_level) AS opportunity_level,
        STUFF((
          SELECT DISTINCT ', ' + c2.crop_name_standard
          FROM dbo.icb_fact_agri_market_snapshot s2
          LEFT JOIN dbo.icb_dim_crop c2 ON s2.crop_id = c2.crop_id
          WHERE s2.region_id = r.region_id AND c2.crop_name_standard IS NOT NULL
          FOR XML PATH('')
        ), 1, 2, '') AS crops_list
      FROM dbo.icb_dim_region r
      LEFT JOIN dbo.icb_fact_agri_market_snapshot s ON s.region_id = r.region_id
      WHERE ${where.join(' AND ')}
      GROUP BY r.region_id, r.region_code, r.department, r.latitude, r.longitude
      ORDER BY total_hectares DESC, r.department
    `);
    return res.recordset.map((row: any) => ({
      region_code: row.region_code,
      department: row.department,
      latitude: row.latitude,
      longitude: row.longitude,
      total_hectares: Number(row.total_hectares || 0),
      total_snapshots: row.total_snapshots,
      opportunity_avg: row.opportunity_avg ? Number(row.opportunity_avg) : null,
      opportunity_level: row.opportunity_level,
      crops: row.crops_list ? String(row.crops_list).split(', ').filter(Boolean) : [],
    }));
  }

  async getEtlRuns(limit = 30): Promise<IcbEtlRun[]> {
    const exists = await tablesExist();
    if (!exists) return [];

    const pool = await getDbPool();
    const capLimit = Math.min(Math.max(limit, 1), 200);
    const res = await pool.request().query(`
      SELECT TOP ${capLimit}
        r.run_id, r.pipeline_name,
        s.source_name,
        r.started_at, r.finished_at, r.status,
        r.records_read, r.records_inserted, r.records_updated, r.records_skipped,
        r.error_message, r.triggered_by
      FROM dbo.icb_etl_run_log r
      LEFT JOIN dbo.icb_dim_source s ON r.source_id = s.source_id
      ORDER BY r.started_at DESC
    `);
    return res.recordset;
  }

  // Detalle de snapshot - incluye rawPayload del staging si existe
  async getSnapshotDetail(snapshotId: number): Promise<(IcbSnapshot & { raw_payload?: string | null }) | null> {
    const exists = await tablesExist();
    if (!exists) return null;

    const pool = await getDbPool();
    const res = await pool.request()
      .input('id', sql.BigInt, snapshotId)
      .query(`
        SELECT TOP 1
          s.snapshot_id,
          src.source_name, src.source_owner,
          c.crop_name_standard AS crop_name, c.crop_group,
          r.department,
          cat.category_name,
          s.document_title, s.document_url, s.document_type,
          s.period_label, s.publication_date, s.capture_date,
          s.hectares, s.production_value,
          s.opportunity_score, s.opportunity_level, s.business_note,
          s.record_hash
        FROM dbo.icb_fact_agri_market_snapshot s
        LEFT JOIN dbo.icb_dim_source src ON s.source_id = src.source_id
        LEFT JOIN dbo.icb_dim_crop c ON s.crop_id = c.crop_id
        LEFT JOIN dbo.icb_dim_region r ON s.region_id = r.region_id
        LEFT JOIN dbo.icb_dim_point_category cat ON s.category_id = cat.category_id
        WHERE s.snapshot_id = @id
      `);
    if (res.recordset.length === 0) return null;

    const snap = res.recordset[0] as any;

    // Intenta recuperar raw_payload más reciente con mismo hash
    if (snap.record_hash) {
      const raw = await pool.request()
        .input('cs', sql.NVarChar(64), snap.record_hash)
        .query(`SELECT TOP 1 raw_payload FROM dbo.icb_stg_raw_document WHERE checksum = @cs ORDER BY captured_at DESC`);
      snap.raw_payload = raw.recordset[0]?.raw_payload || null;
    }

    return snap as IcbSnapshot & { raw_payload?: string | null };
  }

  // Top oportunidades destacadas (score >= threshold)
  async getTopOpportunities(limit = 10, minScore = 70): Promise<IcbSnapshot[]> {
    const exists = await tablesExist();
    if (!exists) return [];

    const pool = await getDbPool();
    const capLimit = Math.min(Math.max(limit, 1), 50);
    const res = await pool.request()
      .input('min_score', sql.Decimal(6, 2), minScore)
      .query(`
        SELECT TOP ${capLimit}
          s.snapshot_id,
          src.source_name, src.source_owner,
          c.crop_name_standard AS crop_name, c.crop_group,
          r.department,
          cat.category_name,
          s.document_title, s.document_url, s.document_type,
          s.period_label, s.publication_date, s.capture_date,
          s.hectares, s.production_value,
          s.opportunity_score, s.opportunity_level, s.business_note
        FROM dbo.icb_fact_agri_market_snapshot s
        LEFT JOIN dbo.icb_dim_source src ON s.source_id = src.source_id
        LEFT JOIN dbo.icb_dim_crop c ON s.crop_id = c.crop_id
        LEFT JOIN dbo.icb_dim_region r ON s.region_id = r.region_id
        LEFT JOIN dbo.icb_dim_point_category cat ON s.category_id = cat.category_id
        WHERE s.opportunity_score >= @min_score
        ORDER BY s.opportunity_score DESC, s.hectares DESC, s.capture_date DESC
      `);
    return res.recordset;
  }

  // Ranking por cultivo con agregación de hectáreas
  async getTopCrops(limit = 10): Promise<Array<{
    crop_name: string; crop_group: string | null; total_hectares: number;
    snapshots: number; opportunity_avg: number | null;
  }>> {
    const exists = await tablesExist();
    if (!exists) return [];
    const pool = await getDbPool();
    const capLimit = Math.min(Math.max(limit, 1), 50);
    const res = await pool.request().query(`
      SELECT TOP ${capLimit}
        c.crop_name_standard AS crop_name,
        c.crop_group,
        COALESCE(SUM(s.hectares), 0) AS total_hectares,
        COUNT(s.snapshot_id) AS snapshots,
        AVG(s.opportunity_score) AS opportunity_avg
      FROM dbo.icb_dim_crop c
      LEFT JOIN dbo.icb_fact_agri_market_snapshot s ON s.crop_id = c.crop_id
      WHERE c.active_flag = 1
      GROUP BY c.crop_id, c.crop_name_standard, c.crop_group
      ORDER BY total_hectares DESC, snapshots DESC
    `);
    return res.recordset.map((row: any) => ({
      crop_name: row.crop_name,
      crop_group: row.crop_group,
      total_hectares: Number(row.total_hectares || 0),
      snapshots: row.snapshots,
      opportunity_avg: row.opportunity_avg ? Number(row.opportunity_avg) : null,
    }));
  }
}

export const inteligenciaService = new InteligenciaService();
