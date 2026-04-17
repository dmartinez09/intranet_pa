import * as cron from 'node-cron';
import type { ScheduledTask } from 'node-cron';
import { graphService } from './graph.service';
import { getDbPool } from '../config/database';

export interface LetraFileCached {
  id: string;
  name: string;
  letras: string[];
  facturaCode: string;
  downloadUrl: string;
  webUrl: string;
  lastModified: string;
  created: string;
  size: number;
  cliente?: string;
}

interface SyncStatus {
  lastSync: string | null;
  fileCount: number;
  newTodayCount: number;
  isStale: boolean;
  syncInProgress: boolean;
  lastError: string | null;
}

const POLL_INTERVAL_HOURS = 3;
const STALE_THRESHOLD_MS = POLL_INTERVAL_HOURS * 60 * 60 * 1000;

let cachedFiles: LetraFileCached[] = [];
let lastSyncAt: Date | null = null;
let lastError: string | null = null;
let syncInProgress = false;
let scheduledTask: ScheduledTask | null = null;

function isToday(iso: string): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() &&
         d.getMonth() === now.getMonth() &&
         d.getDate() === now.getDate();
}

async function enrichWithClients(files: LetraFileCached[]): Promise<LetraFileCached[]> {
  try {
    const pool = await getDbPool();
    const result = await pool.request().query(
      `SELECT DISTINCT Numero_SAP, Razon_Social_Cliente
       FROM dbo.stg_rpt_ventas_detallado
       WHERE Pais='Peru' AND Numero_SAP IS NOT NULL AND Razon_Social_Cliente IS NOT NULL`
    );
    const lookup: Record<string, string> = {};
    for (const r of result.recordset) {
      const num = (r.Numero_SAP || '').replace(/^\d+-/, '');
      if (num) lookup[num] = r.Razon_Social_Cliente;
    }
    return files.map(f => {
      const codes = (f.facturaCode || '').split(' / ').map(c => c.trim());
      const cliente = codes.map(c => lookup[c]).find(Boolean) || '';
      return { ...f, cliente };
    });
  } catch (e) {
    console.error('[letras-scheduler] enrich clients failed:', (e as Error).message);
    return files;
  }
}

async function logSync(fileCount: number, newTodayCount: number, triggerType: 'auto' | 'manual') {
  try {
    const pool = await getDbPool();
    await pool.request()
      .input('fc', fileCount)
      .input('nt', newTodayCount)
      .input('tt', triggerType)
      .query(`INSERT INTO dbo.intranet_letras_sync_log (file_count, new_today_count, trigger_type)
              VALUES (@fc, @nt, @tt)`);
  } catch (e) {
    console.error('[letras-scheduler] sync log insert failed:', (e as Error).message);
  }
}

export const letrasScheduler = {
  async sync(triggerType: 'auto' | 'manual' = 'auto'): Promise<SyncStatus> {
    if (syncInProgress) return this.getStatus();
    syncInProgress = true;
    lastError = null;
    try {
      const raw = await graphService.getLetrasFiles();
      const enriched = await enrichWithClients(raw as LetraFileCached[]);
      cachedFiles = enriched;
      lastSyncAt = new Date();
      const newToday = enriched.filter(f => isToday(f.lastModified)).length;
      await logSync(enriched.length, newToday, triggerType);
      console.log(`[letras-scheduler] sync ok (${triggerType}): ${enriched.length} files, ${newToday} nuevos hoy`);
    } catch (e) {
      lastError = (e as Error).message || 'Unknown sync error';
      console.error('[letras-scheduler] sync failed:', lastError);
    } finally {
      syncInProgress = false;
    }
    return this.getStatus();
  },

  getStatus(): SyncStatus {
    const now = Date.now();
    const isStale = !lastSyncAt || (now - lastSyncAt.getTime()) > STALE_THRESHOLD_MS;
    const newTodayCount = cachedFiles.filter(f => isToday(f.lastModified)).length;
    return {
      lastSync: lastSyncAt ? lastSyncAt.toISOString() : null,
      fileCount: cachedFiles.length,
      newTodayCount,
      isStale,
      syncInProgress,
      lastError,
    };
  },

  getFiles(): LetraFileCached[] {
    return cachedFiles;
  },

  getTodayFiles(): LetraFileCached[] {
    return cachedFiles.filter(f => isToday(f.lastModified));
  },

  start() {
    if (scheduledTask) return;
    // Run at 00, 03, 06, 09, 12, 15, 18, 21
    scheduledTask = cron.schedule('0 */3 * * *', () => {
      this.sync('auto').catch(err => console.error('[letras-scheduler] cron error:', err));
    });
    // Initial sync on boot (non-blocking)
    this.sync('auto').catch(err => console.error('[letras-scheduler] initial sync error:', err));
    console.log('[letras-scheduler] started (poll every 3h)');
  },

  stop() {
    if (scheduledTask) { scheduledTask.stop(); scheduledTask = null; }
  },
};
