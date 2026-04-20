// ============================================================
// ETL Runner - orquestador
// - Abre log en icb_etl_run_log
// - Llama al collector
// - Persiste snapshots en icb_fact_agri_market_snapshot
// - Persiste raw payload en icb_stg_raw_document (best-effort)
// - Cierra log con status / counts
// ============================================================

import crypto from 'crypto';
import { getDbPool, sql } from '../../config/database';
import { loadCatalogMaps, CatalogMaps } from './normalizers';
import { BaseCollector } from './collectors/base.collector';
import { CollectorContext, CollectorResult, ParsedSnapshot } from './types';

function sha256(payload: string): string {
  return crypto.createHash('sha256').update(payload).digest('hex');
}

export async function runCollector(
  collector: BaseCollector,
  triggeredBy: string = 'manual_admin'
): Promise<CollectorResult> {
  const pool = await getDbPool();
  const sourceCode = collector.sourceCode;

  // Lookup source_id
  const srcRes = await pool.request()
    .input('code', sql.NVarChar(40), sourceCode)
    .query(`SELECT source_id FROM dbo.icb_dim_source WHERE source_code = @code`);
  const sourceId: number | undefined = srcRes.recordset[0]?.source_id;
  if (!sourceId) {
    throw new Error(`Fuente no encontrada en icb_dim_source: ${sourceCode}. ¿Se ejecutó la migración 002?`);
  }

  // Abrir log
  const openRes = await pool.request()
    .input('pipeline', sql.NVarChar(100), collector.pipelineName)
    .input('source_id', sql.Int, sourceId)
    .input('triggered_by', sql.NVarChar(60), triggeredBy)
    .query(`
      INSERT INTO dbo.icb_etl_run_log (pipeline_name, source_id, status, triggered_by)
      OUTPUT INSERTED.run_id
      VALUES (@pipeline, @source_id, 'RUNNING', @triggered_by)
    `);
  const runId: number = openRes.recordset[0].run_id;

  const ctx: CollectorContext = { runId, sourceId, sourceCode, triggeredBy };
  let result: CollectorResult = {
    recordsRead: 0, recordsInserted: 0, recordsUpdated: 0, recordsSkipped: 0,
    status: 'SUCCESS',
  };

  try {
    const maps = await loadCatalogMaps();
    result = await collector.run(ctx, maps);
    await persistSnapshots(sourceId, result.snapshots || [], maps, result);
  } catch (err: any) {
    console.error(`[ETL] ${sourceCode} failed:`, err);
    result.status = 'FAILED';
    result.errorMessage = err?.message || 'unknown error';
  }

  // Cerrar log
  await pool.request()
    .input('run_id', sql.BigInt, runId)
    .input('status', sql.NVarChar(20), result.status)
    .input('rr', sql.Int, result.recordsRead)
    .input('ri', sql.Int, result.recordsInserted)
    .input('ru', sql.Int, result.recordsUpdated)
    .input('rs', sql.Int, result.recordsSkipped)
    .input('err', sql.NVarChar(2000), result.errorMessage || null)
    .query(`
      UPDATE dbo.icb_etl_run_log
      SET finished_at = SYSUTCDATETIME(),
          status = @status,
          records_read = @rr,
          records_inserted = @ri,
          records_updated = @ru,
          records_skipped = @rs,
          error_message = @err
      WHERE run_id = @run_id
    `);

  return result;
}

async function persistSnapshots(
  sourceId: number,
  snapshots: ParsedSnapshot[],
  maps: CatalogMaps,
  out: CollectorResult
): Promise<void> {
  if (!snapshots?.length) return;
  const pool = await getDbPool();

  for (const s of snapshots) {
    try {
      // Resolver FKs por código
      const cropId = s.cropCode ? maps.cropByCode.get(s.cropCode.toUpperCase()) || null : null;
      const regionId = s.regionCode ? maps.regionByCode.get(s.regionCode) || null : null;
      const categoryId = s.categoryCode ? maps.categoryByCode.get(s.categoryCode.toUpperCase()) || null : null;

      // Hash para deduplicación (usa source + url + período como clave natural)
      const keyParts = [
        sourceId,
        s.documentUrl || s.documentTitle || '',
        s.periodLabel || '',
        cropId || '',
        regionId || '',
      ].join('|');
      const hash = sha256(keyParts);

      const req = pool.request()
        .input('source_id', sql.Int, sourceId)
        .input('crop_id', sql.Int, cropId)
        .input('region_id', sql.Int, regionId)
        .input('category_id', sql.Int, categoryId)
        .input('document_title', sql.NVarChar(400), s.documentTitle || null)
        .input('document_url', sql.NVarChar(800), s.documentUrl || null)
        .input('document_type', sql.NVarChar(40), s.documentType || null)
        .input('period_label', sql.NVarChar(60), s.periodLabel || null)
        .input('publication_date', sql.Date, s.publicationDate || null)
        .input('hectares', sql.Decimal(18, 2), s.hectares ?? null)
        .input('production_value', sql.Decimal(18, 2), s.productionValue ?? null)
        .input('opportunity_score', sql.Decimal(6, 2), s.opportunityScore ?? null)
        .input('opportunity_level', sql.NVarChar(20), s.opportunityLevel || null)
        .input('business_note', sql.NVarChar(800), s.businessNote || null)
        .input('hash', sql.NVarChar(64), hash);

      // Upsert: si ya existe el hash, actualiza; si no, inserta
      const check = await pool.request()
        .input('hash', sql.NVarChar(64), hash)
        .query(`SELECT snapshot_id FROM dbo.icb_fact_agri_market_snapshot WHERE record_hash = @hash`);

      if (check.recordset.length > 0) {
        await req.query(`
          UPDATE dbo.icb_fact_agri_market_snapshot
          SET document_title = @document_title,
              document_url = @document_url,
              document_type = @document_type,
              period_label = @period_label,
              publication_date = @publication_date,
              hectares = @hectares,
              production_value = @production_value,
              opportunity_score = @opportunity_score,
              opportunity_level = @opportunity_level,
              business_note = @business_note,
              capture_date = CAST(SYSUTCDATETIME() AS DATE)
          WHERE record_hash = @hash
        `);
        out.recordsUpdated++;
      } else {
        await req.query(`
          INSERT INTO dbo.icb_fact_agri_market_snapshot
            (source_id, crop_id, region_id, category_id,
             document_title, document_url, document_type, period_label,
             publication_date,
             hectares, production_value, opportunity_score, opportunity_level, business_note,
             record_hash)
          VALUES
            (@source_id, @crop_id, @region_id, @category_id,
             @document_title, @document_url, @document_type, @period_label,
             @publication_date,
             @hectares, @production_value, @opportunity_score, @opportunity_level, @business_note,
             @hash)
        `);
        out.recordsInserted++;
      }

      // Raw payload (opcional)
      if (s.rawPayload) {
        await pool.request()
          .input('source_id', sql.Int, sourceId)
          .input('source_url', sql.NVarChar(800), s.documentUrl || '')
          .input('file_url', sql.NVarChar(800), s.documentUrl || null)
          .input('file_type', sql.NVarChar(20), s.documentType || null)
          .input('payload', sql.NVarChar(sql.MAX), s.rawPayload.substring(0, 500000))  // cap 500kb
          .input('checksum', sql.NVarChar(64), hash)
          .query(`
            INSERT INTO dbo.icb_stg_raw_document
              (source_id, source_url, file_url, file_type, raw_payload, checksum)
            VALUES
              (@source_id, @source_url, @file_url, @file_type, @payload, @checksum)
          `);
      }
    } catch (err: any) {
      console.error(`[ETL] persist error on snapshot:`, err?.message || err);
      out.recordsSkipped++;
    }
  }
}

// Verifica que las tablas icb_* existan antes de ejecutar cualquier collector
export async function etlTablesReady(): Promise<boolean> {
  try {
    const pool = await getDbPool();
    const res = await pool.request().query(`
      SELECT COUNT(*) AS cnt FROM sys.tables
      WHERE name IN ('icb_dim_source','icb_etl_run_log','icb_fact_agri_market_snapshot','icb_stg_raw_document')
    `);
    return (res.recordset[0]?.cnt || 0) >= 4;
  } catch (_e) {
    return false;
  }
}
