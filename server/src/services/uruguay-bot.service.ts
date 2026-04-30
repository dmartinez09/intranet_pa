import * as fs from 'fs';
import * as path from 'path';
import ExcelJS from 'exceljs';
import { getDbPool, sql } from '../config/database';
import { ventasUruguayService, VentaUruguayRow } from './ventas-uruguay.service';
import { sharepointService } from './sharepoint.service';

// ============================================================
// CONFIG
// ============================================================

export interface UruguayBotConfig {
  enabled: boolean;
  scheduleHour: number;       // 0-23 hora Lima
  scheduleMinute: number;     // 0-59
  timezone: string;
  sharepointUrl: string;
  lastUpdate: string | null;
  lastUpdatedBy: string | null;
}

const CONFIG_PATH = path.join(__dirname, '../../data/uruguay-bot-config.json');

export function readConfig(): UruguayBotConfig {
  if (!fs.existsSync(CONFIG_PATH)) {
    return {
      enabled: false, scheduleHour: 7, scheduleMinute: 0, timezone: 'America/Lima',
      sharepointUrl: '', lastUpdate: null, lastUpdatedBy: null,
    };
  }
  return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
}

export function writeConfig(c: UruguayBotConfig, by: string): void {
  c.lastUpdate = new Date().toISOString();
  c.lastUpdatedBy = by;
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(c, null, 2), 'utf-8');
}

// ============================================================
// EXCEL
// ============================================================

const COLUMNS: { key: keyof VentaUruguayRow; header: string; width: number; numFmt?: string }[] = [
  { key: 'TIPO',                       header: 'TIPO',                       width: 14 },
  { key: 'PAIS',                       header: 'PAIS',                       width: 10 },
  { key: 'FACTURADOR',                 header: 'FACTURADOR',                 width: 22 },
  { key: 'Fecha',                      header: 'Fecha',                      width: 12, numFmt: 'yyyy-mm-dd' },
  { key: 'ZONA',                       header: 'ZONA',                       width: 14 },
  { key: 'VENDEDOR',                   header: 'VENDEDOR',                   width: 26 },
  { key: 'CLIENTE',                    header: 'CLIENTE',                    width: 30 },
  { key: 'PRODUCTO',                   header: 'PRODUCTO',                   width: 30 },
  { key: 'CANTIDAD_KG_LT',             header: 'CANTIDAD_KG_LT',             width: 14, numFmt: '#,##0.00' },
  { key: 'VALOR_UNITARIO',             header: 'VALOR_UNITARIO',             width: 14, numFmt: '#,##0.00' },
  { key: 'VALOR_TOTAL',                header: 'VALOR_TOTAL',                width: 14, numFmt: '#,##0.00' },
  { key: 'UNIDADES_POR_PRESENTACION',  header: 'UNIDADES_POR_PRESENTACION',  width: 14, numFmt: '#,##0.00' },
  { key: 'EMPAQUE',                    header: 'EMPAQUE',                    width: 12, numFmt: '#,##0.00' },
  { key: 'FECHA2',                     header: 'FECHA2',                     width: 12, numFmt: 'yyyy-mm-dd' },
  { key: 'Origen_producto',            header: 'Origen producto',            width: 14 },
  { key: 'IA',                         header: 'I.A.',                       width: 24 },
  { key: 'CANTIDAD_NEGATIVA',          header: 'CANTIDAD_NEGATIVA',          width: 14, numFmt: '#,##0.00' },
  { key: 'Grupo_Cliente',              header: 'Grupo_Cliente',              width: 22 },
  { key: 'FOCO',                       header: 'FOCO',                       width: 12 },
];

/** Aplica estilo Point Andina (header verde) — versión simple y robusta. */
function applyHeaderStyleAndClean(ws: ExcelJS.Worksheet): void {
  // Estructura de columnas (anchos + numFmt)
  ws.columns = COLUMNS.map(c => ({
    header: c.header, key: c.key as string, width: c.width,
    style: c.numFmt ? { numFmt: c.numFmt } : undefined,
  }));

  // Header verde Point Andina (#00A651), texto blanco, negrita
  const head = ws.getRow(1);
  head.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
  head.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF00A651' } };
  head.alignment = { horizontal: 'center', vertical: 'middle' };
  head.commit();

  // Page setup explícito para evitar el bug "reading 'margins' of null"
  ws.pageSetup = {
    margins: { left: 0.7, right: 0.7, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3 },
    paperSize: 9,
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
  };

  // Filtros + freeze pane
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: COLUMNS.length } };
  ws.views = [{ state: 'frozen', ySplit: 1 }];
}

function ymKey(d: Date | string): string {
  const dt = typeof d === 'string' ? new Date(d) : d;
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}`;
}

function fmtDate(d: Date | string | null): string {
  if (!d) return '';
  const dt = typeof d === 'string' ? new Date(d) : d;
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
}

/**
 * Construye un workbook desde cero con los rows entregados (header verde, sin comentarios).
 */
async function buildWorkbookFromRows(rows: VentaUruguayRow[]): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Intranet Point Andina';
  const ws = wb.addWorksheet('Ventas Diarias');
  applyHeaderStyleAndClean(ws);
  // FECHA2 espejo de Fecha (solicitud usuaria Uruguay)
  rows.forEach(r => ws.addRow({ ...r, FECHA2: r.Fecha }));
  return wb;
}

/**
 * Lee un workbook existente desde buffer (si existe) — solo para extraer filas.
 * El output se reconstruye fresh con buildWorkbookWithMerge() para garantizar
 * header verde y sin comentarios heredados.
 */
async function loadExistingWorkbook(buf: Buffer | null): Promise<ExcelJS.Workbook | null> {
  if (!buf) return null;
  try {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as any);
    return wb;
  } catch (err) {
    console.warn('[UruguayBot] Excel existente no se pudo leer, se reconstruye desde cero:', (err as any).message);
    return null;
  }
}

/**
 * Reconstruye el workbook desde cero combinando filas preservadas (fuera del rango)
 * con las filas nuevas (dentro del rango). Garantiza header verde y sin comentarios.
 */
function rebuildWorkbookWithMerge(
  existingWb: ExcelJS.Workbook | null,
  rangoDesde: string,
  rangoHasta: string,
  newRows: VentaUruguayRow[],
): { wb: ExcelJS.Workbook; totalRows: number; preservedRows: number } {
  // 1. Recolectar filas existentes fuera del rango (preservar)
  // Envolvemos en try/catch defensivo: si el Excel viejo tiene estructuras raras
  // (margins null, comentarios huérfanos, etc) lo descartamos y reconstruimos limpio.
  const existing: any[] = [];
  if (existingWb) {
    try {
      const existingWs = existingWb.getWorksheet('Ventas Diarias') || existingWb.worksheets[0];
      if (existingWs) {
        // Mapear headers del archivo existente para tolerar reordenamiento o nombres antiguos
        const headerMap: Record<string, number> = {};
        try {
          existingWs.getRow(1).eachCell({ includeEmpty: true }, (cell, col) => {
            try {
              const v = cell.value;
              if (v) headerMap[String(v).trim()] = col;
            } catch {}
          });
        } catch (e: any) {
          console.warn('[UruguayBot] header read failed:', e?.message);
        }

        // Aliasing para nombres antiguos (Excels históricos pueden tener columnas
        // con nombres previos). Grupo_Cliente: antes "AGROINDUSTRIA_DISTRIBUCION"
        // o "AGROINDUSTRIA_DISTRITO" o "AGROINDUSTRIA/DISTRIBUCION" o "GRUPO".
        // Origen_producto: antes "GRUPO" cuando contenía Origen_Producto.
        const aliasMap: Record<string, string> = {
          'I.A.': 'IA',
          'AGROINDUSTRIA_DISTRIBUCION': 'Grupo_Cliente',
          'AGROINDUSTRIA/DISTRIBUCION': 'Grupo_Cliente',
          'AGROINDUSTRIA_DISTRITO': 'Grupo_Cliente',
          'GRUPO': 'Grupo_Cliente',
        };
        const resolveCol = (key: string, header: string): number | undefined => {
          return headerMap[header]
            || headerMap[header.replace(/_/g, ' ')]
            || headerMap[key]
            || headerMap[aliasMap[header] || ''];
        };

        // Iteración manual por número de fila — más tolerante que eachRow ante metadatos rotos
        const totalRowsExisting = (existingWs.actualRowCount || existingWs.rowCount || 0);
        for (let rNum = 2; rNum <= totalRowsExisting; rNum++) {
          try {
            const row = existingWs.getRow(rNum);
            if (!row || (row as any).hasValues === false) continue;
            const obj: any = {};
            for (const c of COLUMNS) {
              const colIdx = resolveCol(String(c.key), c.header);
              if (colIdx) {
                try {
                  const val = row.getCell(colIdx).value;
                  obj[c.key] = val && typeof val === 'object' && 'result' in (val as any)
                    ? (val as any).result : val;
                } catch {}
              }
            }
            // Solo guardamos si tiene fecha o key válido
            if (obj.Fecha || obj.CLIENTE || obj.PRODUCTO) existing.push(obj);
          } catch (rowErr: any) {
            console.warn(`[UruguayBot] skip row ${rNum}:`, rowErr?.message);
          }
        }
      }
    } catch (wsErr: any) {
      console.warn('[UruguayBot] existing workbook unreadable, descartado:', wsErr?.message);
    }
  }
  const recolectadasInfo = existing.length;

  // 2. Filtrar filas FUERA del rango (las preservamos)
  const desdeMs = new Date(rangoDesde + 'T00:00:00Z').getTime();
  const hastaMs = new Date(rangoHasta + 'T23:59:59Z').getTime();
  const preserved = existing.filter(r => {
    if (!r.Fecha) return false;
    const d = r.Fecha instanceof Date ? r.Fecha : new Date(r.Fecha);
    const ms = d.getTime();
    if (isNaN(ms)) return false;
    return ms < desdeMs || ms > hastaMs;
  });

  // 3. Combinar con las nuevas y ordenar por Fecha asc
  const allRows = [...preserved, ...newRows].sort((a: any, b: any) => {
    const fa = a.Fecha ? new Date(a.Fecha).getTime() : 0;
    const fb = b.Fecha ? new Date(b.Fecha).getTime() : 0;
    return fa - fb;
  });

  // 4. Construir workbook FRESH (header verde, sin comentarios heredados)
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Intranet Point Andina';
  const ws = wb.addWorksheet('Ventas Diarias');
  applyHeaderStyleAndClean(ws);
  // FECHA2 espejo de Fecha (solicitud usuaria Uruguay) — aplica también a filas
  // preservadas del Excel anterior (puede traer FECHA2 distinta del histórico).
  allRows.forEach((r: any) => ws.addRow({ ...r, FECHA2: r.Fecha }));

  console.log(`[UruguayBot] merge: existentes=${recolectadasInfo} · preservadas=${preserved.length} · nuevas=${newRows.length} · total=${allRows.length}`);
  return { wb, totalRows: allRows.length, preservedRows: preserved.length };
}

// ============================================================
// AUDITORÍA
// ============================================================

async function logRunStart(triggeredBy: string, triggerType: 'auto' | 'manual' | 'range', desde: string, hasta: string): Promise<number> {
  const pool = await getDbPool();
  const r = await pool.request()
    .input('by', sql.NVarChar, triggeredBy)
    .input('tp', sql.VarChar, triggerType)
    .input('df', sql.Date, desde)
    .input('dt', sql.Date, hasta)
    .query(`
      INSERT INTO dbo.uruguay_bot_runs (triggered_by, trigger_type, date_from, date_to, status)
      OUTPUT INSERTED.run_id
      VALUES (@by, @tp, @df, @dt, 'RUNNING');
    `);
  return r.recordset[0].run_id;
}

async function logRunEnd(
  runId: number,
  status: 'SUCCESS' | 'FAILED',
  rowsProcessed: number | null,
  fileName: string | null,
  spPath: string | null,
  spUrl: string | null,
  err: string | null,
  durationMs: number,
): Promise<void> {
  const pool = await getDbPool();
  await pool.request()
    .input('id', sql.Int, runId)
    .input('st', sql.VarChar, status)
    .input('rp', sql.Int, rowsProcessed)
    .input('fn', sql.NVarChar, fileName)
    .input('sp', sql.NVarChar, spPath)
    .input('su', sql.NVarChar, spUrl)
    .input('er', sql.NVarChar, err ? err.substring(0, 4000) : null)
    .input('du', sql.Int, durationMs)
    .query(`
      UPDATE dbo.uruguay_bot_runs
      SET status = @st, rows_processed = @rp, excel_file_name = @fn,
          sharepoint_path = @sp, sharepoint_url = @su,
          error_message = @er, duration_ms = @du,
          finished_at = SYSUTCDATETIME()
      WHERE run_id = @id;
    `);
}

// ============================================================
// EJECUCIÓN PRINCIPAL
// ============================================================

export interface RunResult {
  runId: number;
  status: 'SUCCESS' | 'FAILED';
  rowsProcessed: number;
  fileName: string;
  sharepointUrl: string | null;
  errorMessage: string | null;
  durationMs: number;
  perMonth: Array<{ month: string; rows: number; fileName: string; webUrl: string | null }>;
}

/**
 * Ejecuta el bot para un rango de fechas.
 * - Agrupa por mes (YYYY-MM) → un Excel por mes
 * - Para cada mes: descarga existente, mergea filas del rango, sube
 */
export async function runBot(opts: {
  dateFrom: string;            // 'YYYY-MM-DD'
  dateTo: string;              // 'YYYY-MM-DD'
  triggeredBy: string;
  triggerType: 'auto' | 'manual' | 'range';
}): Promise<RunResult> {
  const t0 = Date.now();
  const runId = await logRunStart(opts.triggeredBy, opts.triggerType, opts.dateFrom, opts.dateTo);

  try {
    if (!sharepointService.isConfigured()) {
      throw new Error('SharePoint/Graph no está configurado (faltan MS_TENANT_ID/MS_CLIENT_ID/MS_CLIENT_SECRET).');
    }

    const cfg = readConfig();
    if (!cfg.sharepointUrl) throw new Error('Falta configurar la URL de SharePoint en el bot.');

    // Resolver SharePoint
    const loc = await sharepointService.resolveLocation(cfg.sharepointUrl);

    // Query data
    const rows = await ventasUruguayService.getVentaPorRango(opts.dateFrom, opts.dateTo);

    // Agrupar por mes
    const byMonth = new Map<string, VentaUruguayRow[]>();
    rows.forEach(r => {
      if (!r.Fecha) return;
      const k = ymKey(r.Fecha);
      if (!byMonth.has(k)) byMonth.set(k, []);
      byMonth.get(k)!.push(r);
    });

    // Si el rango cubre meses que no tienen filas, igual se procesan para mantener archivos consistentes
    const dStart = new Date(opts.dateFrom + 'T00:00:00Z');
    const dEnd = new Date(opts.dateTo + 'T00:00:00Z');
    const monthsInRange = new Set<string>();
    for (let d = new Date(dStart); d <= dEnd; d.setUTCMonth(d.getUTCMonth() + 1)) {
      monthsInRange.add(ymKey(d));
    }
    monthsInRange.add(ymKey(dEnd));
    monthsInRange.forEach(k => { if (!byMonth.has(k)) byMonth.set(k, []); });

    // Procesar cada mes
    const perMonth: RunResult['perMonth'] = [];
    let totalRows = 0;
    let lastWebUrl: string | null = null;
    let lastFileName = '';

    for (const [ym, monthRows] of byMonth) {
      const fileName = `${ym}.xlsx`;
      const filePath = `${loc.folderPath}/${fileName}`;

      // límites del rango aplicable en este mes
      const [yyyy, mm] = ym.split('-').map(Number);
      const monthFirstDay = `${yyyy}-${String(mm).padStart(2, '0')}-01`;
      const monthLastDay = `${yyyy}-${String(mm).padStart(2, '0')}-${new Date(Date.UTC(yyyy, mm, 0)).getUTCDate()}`;
      const effectiveFrom = opts.dateFrom > monthFirstDay ? opts.dateFrom : monthFirstDay;
      const effectiveTo = opts.dateTo < monthLastDay ? opts.dateTo : monthLastDay;

      // descargar existente (solo para preservar filas fuera del rango)
      const buf = await sharepointService.downloadFile(loc.driveId, filePath);
      const existingWb = await loadExistingWorkbook(buf);

      // reconstruir workbook FRESH: header verde, sin comentarios
      const { wb, totalRows: rowCount } = rebuildWorkbookWithMerge(
        existingWb, effectiveFrom, effectiveTo, monthRows
      );
      const xlsxBuf = await wb.xlsx.writeBuffer();
      const buffer: Buffer = Buffer.isBuffer(xlsxBuf) ? xlsxBuf : Buffer.from(xlsxBuf as ArrayBuffer);

      // subir
      const up = await sharepointService.uploadFile(
        loc.driveId, filePath, buffer,
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );

      perMonth.push({ month: ym, rows: monthRows.length, fileName, webUrl: up.webUrl });
      totalRows += monthRows.length;
      lastWebUrl = up.webUrl;
      lastFileName = fileName;
      console.log(`[UruguayBot] ${fileName} actualizado · ${rowCount} filas totales · ${monthRows.length} del rango`);
    }

    const elapsed = Date.now() - t0;
    await logRunEnd(runId, 'SUCCESS', totalRows, lastFileName, loc.folderPath, lastWebUrl, null, elapsed);

    return {
      runId, status: 'SUCCESS', rowsProcessed: totalRows,
      fileName: lastFileName, sharepointUrl: lastWebUrl,
      errorMessage: null, durationMs: elapsed, perMonth,
    };
  } catch (err: any) {
    const elapsed = Date.now() - t0;
    const msg = err?.message || String(err);
    console.error('[UruguayBot] ERROR:', msg);
    await logRunEnd(runId, 'FAILED', null, null, null, null, msg, elapsed);
    return {
      runId, status: 'FAILED', rowsProcessed: 0,
      fileName: '', sharepointUrl: null, errorMessage: msg, durationMs: elapsed, perMonth: [],
    };
  }
}

// ============================================================
// HISTORIAL
// ============================================================

export async function getRuns(limit = 50): Promise<any[]> {
  const pool = await getDbPool();
  const cap = Math.min(Math.max(limit, 1), 200);
  const r = await pool.request().query(`
    SELECT TOP ${cap} run_id, triggered_at, triggered_by, trigger_type,
           date_from, date_to, status, rows_processed,
           excel_file_name, sharepoint_url, error_message,
           duration_ms, finished_at
    FROM dbo.uruguay_bot_runs
    ORDER BY triggered_at DESC
  `);
  return r.recordset;
}
