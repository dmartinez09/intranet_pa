import * as cron from 'node-cron';
import type { ScheduledTask } from 'node-cron';
import { graphService } from './graph.service';
import { getDbPool } from '../config/database';
import { letrasScheduler, LetraFileCached } from './letras-scheduler.service';

export interface BotConfig {
  enabled: boolean;
  sendHour: number;   // 0..23
  sendMinute: number; // 0..59
  defaultCc: string;  // separado por ;
  updatedBy: string | null;
  updatedAt: string | null;
}

export interface BotHistoryEntry {
  id: number;
  runDate: string;
  runAt: string;
  triggerType: 'auto' | 'manual';
  letraId: string;
  letraName: string;
  facturaCode: string | null;
  cliente: string | null;
  recipientsTo: string | null;
  recipientsCc: string | null;
  attachmentsQty: number;
  status: 'sent' | 'skipped' | 'failed';
  errorMessage: string | null;
}

// NOTE: keep in sync with facturacion.routes.ts and graph.service.ts
const DRIVE_ID = 'b!aDBAYXgyCUifG71OViKVOiShCsAuAlVOqAljzYTa1vGXuJpv-DDtTZw_GIbFTKRX';

let scheduledTask: ScheduledTask | null = null;
let currentCron: string | null = null;

async function readConfig(): Promise<BotConfig> {
  const pool = await getDbPool();
  const r = await pool.request().query(
    `SELECT TOP 1 enabled, send_hour, send_minute, default_cc, updated_by, updated_at
     FROM dbo.intranet_letras_bot_config ORDER BY id ASC`
  );
  if (!r.recordset.length) {
    return { enabled: false, sendHour: 17, sendMinute: 0, defaultCc: '', updatedBy: null, updatedAt: null };
  }
  const row = r.recordset[0];
  return {
    enabled: !!row.enabled,
    sendHour: row.send_hour,
    sendMinute: row.send_minute,
    defaultCc: row.default_cc || '',
    updatedBy: row.updated_by,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
  };
}

async function writeConfig(cfg: Partial<BotConfig>, user: string): Promise<BotConfig> {
  const pool = await getDbPool();
  const current = await readConfig();
  const merged = { ...current, ...cfg };
  await pool.request()
    .input('en', merged.enabled ? 1 : 0)
    .input('h', merged.sendHour)
    .input('m', merged.sendMinute)
    .input('cc', merged.defaultCc || null)
    .input('u', user)
    .query(`UPDATE dbo.intranet_letras_bot_config
            SET enabled=@en, send_hour=@h, send_minute=@m, default_cc=@cc,
                updated_by=@u, updated_at=SYSDATETIME()
            WHERE id = (SELECT TOP 1 id FROM dbo.intranet_letras_bot_config ORDER BY id ASC)`);
  return readConfig();
}

async function logSend(entry: Omit<BotHistoryEntry, 'id' | 'runAt'>) {
  try {
    const pool = await getDbPool();
    await pool.request()
      .input('rd', entry.runDate)
      .input('tt', entry.triggerType)
      .input('lid', entry.letraId)
      .input('ln', entry.letraName)
      .input('fc', entry.facturaCode)
      .input('cl', entry.cliente)
      .input('rt', entry.recipientsTo)
      .input('rc', entry.recipientsCc)
      .input('aq', entry.attachmentsQty)
      .input('st', entry.status)
      .input('em', entry.errorMessage)
      .query(`INSERT INTO dbo.intranet_letras_bot_history
                (run_date, trigger_type, letra_id, letra_name, factura_code, cliente,
                 recipients_to, recipients_cc, attachments_qty, status, error_message)
              VALUES (@rd, @tt, @lid, @ln, @fc, @cl, @rt, @rc, @aq, @st, @em)`);
  } catch (e) {
    console.error('[letras-bot] log insert failed:', (e as Error).message);
  }
}

async function buildAndSendForLetra(
  letra: LetraFileCached,
  defaultCc: string,
  triggerType: 'auto' | 'manual'
): Promise<{ status: 'sent' | 'skipped' | 'failed'; error?: string; recipients?: string[]; attachments?: number }> {
  const runDate = new Date().toISOString().slice(0, 10);
  try {
    // 1. Find matching comprobantes
    const codes = (letra.facturaCode || '').split(' / ').map(c => c.trim()).filter(Boolean);
    if (!codes.length) {
      await logSend({
        runDate, triggerType, letraId: letra.id, letraName: letra.name,
        facturaCode: letra.facturaCode, cliente: letra.cliente || null,
        recipientsTo: null, recipientsCc: null, attachmentsQty: 0,
        status: 'skipped', errorMessage: 'Sin facturaCode',
      });
      return { status: 'skipped', error: 'Sin facturaCode' };
    }

    const result = await graphService.getFacturacionEmails({ top: 500 });
    const tails = codes.map(c => (c.match(/\d+/g) || []).join('').replace(/^0+/, '')).filter(Boolean);
    const matching = result.emails.filter((e: any) => {
      const num = (e.numeroDocumento || '').toUpperCase();
      const subj = (e.subject || '').toUpperCase();
      const preview = (e.preview || '').toUpperCase();
      const haystack = `${num} ${subj} ${preview}`;
      if (codes.some(c => haystack.includes(c.toUpperCase()))) return true;
      const allDigits = (haystack.match(/\d{4,}/g) || []).map((d: string) => d.replace(/^0+/, ''));
      return tails.some(t => allDigits.includes(t));
    });

    // 2. Collect recipients from the comprobantes
    const toSet = new Set<string>();
    for (const e of matching) {
      for (const addr of (e.to || [])) toSet.add(addr);
    }
    const to = [...toSet].filter(Boolean);
    if (!to.length) {
      await logSend({
        runDate, triggerType, letraId: letra.id, letraName: letra.name,
        facturaCode: letra.facturaCode, cliente: letra.cliente || null,
        recipientsTo: null, recipientsCc: null, attachmentsQty: 0,
        status: 'skipped', errorMessage: 'Sin destinatarios en comprobantes',
      });
      return { status: 'skipped', error: 'Sin destinatarios en comprobantes' };
    }

    // CC siempre incluye cobranzas@pointamericas.com (fijo) + lo que venga en defaultCc
    const FIXED_CC = 'cobranzas@pointamericas.com';
    const ccList = (defaultCc || '').split(/[;,]/).map(s => s.trim()).filter(Boolean);
    if (!ccList.some(e => e.toLowerCase() === FIXED_CC.toLowerCase())) ccList.unshift(FIXED_CC);
    const cc = ccList;

    // 3. Download letra + attachments
    const letraFile = await graphService.downloadDriveItem(DRIVE_ID, letra.id);
    const attachments: Array<{ name: string; contentType: string; contentBytes: string }> = [{
      name: letraFile.name, contentType: 'application/pdf', contentBytes: letraFile.contentBytes,
    }];

    for (const email of matching.filter((e: any) => e.hasAttachments)) {
      const isFac = (email.tipoDocumento || '').toUpperCase() === 'FACTURA';
      const atts = await graphService.getFacturacionAttachments(email.id);
      for (const att of (atts || [])) {
        if ((att as any).isInline) continue;
        const isXml = /\.xml$/i.test(att.name) || /xml/i.test(att.contentType || '');
        if (!isFac && !isXml) continue;
        const dl = await graphService.downloadFacturacionAttachment(email.id, att.id);
        if (dl) attachments.push({ name: dl.name, contentType: dl.contentType, contentBytes: dl.contentBytes });
      }
    }

    // 4. Dedupe
    const seen = new Set<string>();
    const unique = attachments.filter(a => {
      const k = a.name.toLowerCase().replace(/\s+/g, '');
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });

    // 5. Pre-insert history para tracking pixels
    const pool = await getDbPool();
    const ins = await pool.request()
      .input('rd', runDate)
      .input('tt', triggerType)
      .input('lid', letra.id)
      .input('ln', letra.name)
      .input('fc', letra.facturaCode)
      .input('cl', letra.cliente || null)
      .input('rt', to.join('; '))
      .input('rc', cc.join('; '))
      .input('aq', unique.length)
      .input('st', 'sending')
      .input('em', null)
      .query(`INSERT INTO dbo.intranet_letras_bot_history
                (run_date, trigger_type, letra_id, letra_name, factura_code, cliente,
                 recipients_to, recipients_cc, attachments_qty, status, error_message)
              OUTPUT INSERTED.id
              VALUES (@rd, @tt, @lid, @ln, @fc, @cl, @rt, @rc, @aq, @st, @em)`);
    const historyId: number | null = ins.recordset[0]?.id ?? null;

    // 6. Tracking pixels por destinatario
    const baseUrl = process.env.PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 3001}`;
    const buildPixel = (recipient: string, role: 'to' | 'cc'): string => {
      if (!historyId) return '';
      const token = Buffer.from(JSON.stringify({ h: historyId, r: recipient, role })).toString('base64url');
      return `<img src="${baseUrl}/api/track/letras/${token}.gif" width="1" height="1" alt="" style="display:block;border:0;" />`;
    };
    const pixelsHtml = [
      ...to.map(r => buildPixel(r, 'to')),
      ...cc.map(r => buildPixel(r, 'cc')),
    ].join('\n');

    // 7. Send
    const subject = `Letra y Comprobantes de Pago — ${letra.facturaCode || ''} — ${letra.cliente || 'Cliente'}`;
    const bodyHtml = `
      <div style="font-family:Arial,sans-serif;color:#333;">
        <h2 style="color:#00A651;">Point Andina S.A.</h2>
        <p>Estimado Cliente <strong>${letra.cliente || ''}</strong>,</p>
        <p>Adjuntamos la(s) letra(s) y comprobantes de pago electrónicos correspondientes a la factura <strong>${letra.facturaCode}</strong>.</p>
        <p>Documentos adjuntos: <strong>${unique.length}</strong></p>
        <ul>${unique.map(a => `<li>${a.name}</li>`).join('')}</ul>
        <br/>
        <p>Atentamente,<br/><strong>Point Andina S.A.</strong><br/>Facturación y Despacho</p>
        ${pixelsHtml}
      </div>`;

    await graphService.sendEmailWithAttachments({ to, cc, subject, bodyHtml, attachments: unique });

    if (historyId) {
      await pool.request().input('id', historyId).query(
        `UPDATE dbo.intranet_letras_bot_history SET status='sent' WHERE id=@id`
      );
    } else {
      await logSend({
        runDate, triggerType, letraId: letra.id, letraName: letra.name,
        facturaCode: letra.facturaCode, cliente: letra.cliente || null,
        recipientsTo: to.join('; '), recipientsCc: cc.join('; '),
        attachmentsQty: unique.length, status: 'sent', errorMessage: null,
      });
    }
    return { status: 'sent', recipients: to, attachments: unique.length };
  } catch (e) {
    const msg = (e as Error).message || 'Unknown error';
    await logSend({
      runDate, triggerType, letraId: letra.id, letraName: letra.name,
      facturaCode: letra.facturaCode, cliente: letra.cliente || null,
      recipientsTo: null, recipientsCc: null, attachmentsQty: 0,
      status: 'failed', errorMessage: msg.slice(0, 1900),
    });
    return { status: 'failed', error: msg };
  }
}

async function alreadySent(letraId: string): Promise<boolean> {
  try {
    const pool = await getDbPool();
    const r = await pool.request()
      .input('lid', letraId)
      .query(`SELECT TOP 1 1 AS x FROM dbo.intranet_letras_bot_history
              WHERE letra_id=@lid AND status='sent'`);
    return r.recordset.length > 0;
  } catch { return false; }
}

async function runDailyJob(
  triggerType: 'auto' | 'manual' = 'auto',
  options?: { letraId?: string }
) {
  console.log(`[letras-bot] running daily job (${triggerType})${options?.letraId ? ` letraId=${options.letraId}` : ''}`);
  const cfg = await readConfig();

  // Ensure cache is fresh (force sync)
  await letrasScheduler.sync(triggerType);
  let todayFiles = letrasScheduler.getTodayFiles();

  // Test mode: limitar a una sola letra
  if (options?.letraId) {
    todayFiles = todayFiles.filter(f => f.id === options.letraId);
  }

  if (!todayFiles.length) {
    console.log('[letras-bot] no letras uploaded today — skipping');
    return { processed: 0, sent: 0, skipped: 0, failed: 0 };
  }

  let sent = 0, skipped = 0, failed = 0;
  for (const letra of todayFiles) {
    if (await alreadySent(letra.id)) { skipped++; continue; }
    const r = await buildAndSendForLetra(letra, cfg.defaultCc, triggerType);
    if (r.status === 'sent') sent++;
    else if (r.status === 'skipped') skipped++;
    else failed++;
  }
  console.log(`[letras-bot] daily job done: sent=${sent}, skipped=${skipped}, failed=${failed}`);
  return { processed: todayFiles.length, sent, skipped, failed };
}

// ---------------------------------------------------------------------------
// Catchup-on-boot: protege contra suspensiones de iisnode/App Service
// Si llegó la hora programada hoy y no se ejecutó ningún run auto exitoso,
// dispara la corrida ahora. Mantiene la hora parametrizada como referencia.
// ---------------------------------------------------------------------------

function nowInLima(): { y: number; m: number; d: number; h: number; min: number } {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Lima',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(new Date()).map(p => [p.type, p.value]));
  return {
    y: Number(parts.year), m: Number(parts.month), d: Number(parts.day),
    h: Number(parts.hour), min: Number(parts.minute),
  };
}

async function autoRunHappenedToday(): Promise<boolean> {
  try {
    const pool = await getDbPool();
    const lima = nowInLima();
    const isoDate = `${lima.y}-${String(lima.m).padStart(2, '0')}-${String(lima.d).padStart(2, '0')}`;
    const r = await pool.request()
      .input('d', isoDate)
      .query(`SELECT TOP 1 id FROM dbo.intranet_letras_bot_history
              WHERE trigger_type = 'auto' AND CAST(run_date AS DATE) = @d`);
    return r.recordset.length > 0;
  } catch (e) {
    console.error('[letras-bot] autoRunHappenedToday error:', e);
    return true; // ante duda, NO disparamos para no duplicar
  }
}

async function catchupOnBoot() {
  try {
    const cfg = await readConfig();
    if (!cfg.enabled) {
      console.log('[letras-bot] catchup: bot disabled — skip');
      return;
    }
    const lima = nowInLima();
    const scheduledMinutes = cfg.sendHour * 60 + cfg.sendMinute;
    const nowMinutes = lima.h * 60 + lima.min;
    if (nowMinutes < scheduledMinutes) {
      console.log(`[letras-bot] catchup: aún no es hora programada (Lima ${lima.h}:${String(lima.min).padStart(2,'0')} < ${cfg.sendHour}:${String(cfg.sendMinute).padStart(2,'0')}) — el cron disparará`);
      return;
    }
    if (await autoRunHappenedToday()) {
      console.log('[letras-bot] catchup: ya se ejecutó un run auto hoy — skip');
      return;
    }
    console.log(`[letras-bot] catchup: hora programada ya pasó hoy y no hubo run auto — disparando ahora (Lima ${lima.h}:${String(lima.min).padStart(2,'0')})`);
    await runDailyJob('auto');
  } catch (e) {
    console.error('[letras-bot] catchup error:', e);
  }
}

export const letrasBot = {
  async getConfig() { return readConfig(); },

  async setConfig(cfg: Partial<BotConfig>, user: string) {
    const updated = await writeConfig(cfg, user);
    await this.reschedule(updated);
    return updated;
  },

  async getHistory(limit = 50): Promise<BotHistoryEntry[]> {
    const pool = await getDbPool();
    const r = await pool.request()
      .input('lim', limit)
      .query(`SELECT TOP (@lim) id, run_date, run_at, trigger_type, letra_id, letra_name,
                     factura_code, cliente, recipients_to, recipients_cc,
                     attachments_qty, status, error_message
              FROM dbo.intranet_letras_bot_history
              ORDER BY run_at DESC`);
    return r.recordset.map((row: any) => ({
      id: row.id,
      runDate: row.run_date instanceof Date ? row.run_date.toISOString().slice(0, 10) : String(row.run_date),
      runAt: row.run_at ? new Date(row.run_at).toISOString() : '',
      triggerType: row.trigger_type,
      letraId: row.letra_id,
      letraName: row.letra_name,
      facturaCode: row.factura_code,
      cliente: row.cliente,
      recipientsTo: row.recipients_to,
      recipientsCc: row.recipients_cc,
      attachmentsQty: row.attachments_qty,
      status: row.status,
      errorMessage: row.error_message,
    }));
  },

  async runNow(options?: { letraId?: string }) { return runDailyJob('manual', options); },

  async reschedule(cfg?: BotConfig) {
    const c = cfg || await readConfig();
    if (scheduledTask) { scheduledTask.stop(); scheduledTask = null; }
    currentCron = null;
    if (!c.enabled) {
      console.log('[letras-bot] disabled — no cron scheduled');
      return;
    }
    const expr = `${c.sendMinute} ${c.sendHour} * * *`;
    // IMPORTANTE: forzar timezone America/Lima para que el cron interprete
    // sendHour como hora local Lima. Sin esto, node-cron usa la timezone del
    // proceso (UTC en Azure Web App) y la ejecución se desfasa 5 horas.
    scheduledTask = cron.schedule(expr, () => {
      runDailyJob('auto').catch(err => console.error('[letras-bot] auto run error:', err));
    }, { timezone: 'America/Lima' });
    currentCron = expr;
    console.log(`[letras-bot] scheduled daily @ ${String(c.sendHour).padStart(2, '0')}:${String(c.sendMinute).padStart(2, '0')} Lima (cron: ${expr} TZ:America/Lima)`);
  },

  async start() {
    await this.reschedule();
    // Catchup: si el proceso estuvo suspendido durante la ventana programada,
    // disparar ahora para no perder el envío de hoy.
    // Demoramos 30s para que el resto del boot termine antes (DB, sync inicial).
    setTimeout(() => { catchupOnBoot().catch(() => {}); }, 30000);
  },

  getCurrentCron() { return currentCron; },
};
