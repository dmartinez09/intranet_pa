import * as cron from 'node-cron';
import { readConfig, runBot } from './uruguay-bot.service';

/**
 * Scheduler para el bot de Uruguay.
 *
 * [FIX 2026-05-15] Reescrito de setTimeout → node-cron con timezone explícito.
 * Razones:
 *  - setTimeout con delay 24h puede morir silenciosamente si el proceso es idle
 *    en Azure App Service (sin Always On). Cron re-arma cada minuto.
 *  - Cron con tz='America/Lima' elimina la matemática manual de offsets UTC.
 *  - try/catch defensivo evita que un error en readConfig() o runBot() mate el
 *    scheduler — re-agenda siempre en el siguiente tick.
 *  - Lock `running` evita pile-up si un tick tarda más que el intervalo.
 */

let cronTask: cron.ScheduledTask | null = null;
let nextRunAt: Date | null = null;
let lastTickAt: Date | null = null;
let lastRunStatus: 'SUCCESS' | 'FAILED' | 'SKIPPED' | null = null;
let running = false;

function ymd(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

async function tick(): Promise<void> {
  lastTickAt = new Date();

  // Concurrency lock — si el tick anterior aún está corriendo, skip
  if (running) {
    console.log('[UruguayBotScheduler] Tick anterior aún en ejecución, skip.');
    return;
  }
  running = true;

  try {
    const cfg = await readConfig();
    if (!cfg.enabled) {
      console.log('[UruguayBotScheduler] Bot deshabilitado, skip tick.');
      lastRunStatus = 'SKIPPED';
      return;
    }

    // Procesar día anterior en zona Lima
    const limaNow = new Date(Date.now() - 5 * 60 * 60 * 1000);
    const yest = new Date(limaNow);
    yest.setUTCDate(yest.getUTCDate() - 1);
    const fecha = ymd(yest);

    console.log(`[UruguayBotScheduler] Disparando run automático para ${fecha}`);
    const r = await runBot({
      dateFrom: fecha, dateTo: fecha,
      triggeredBy: 'scheduler',
      triggerType: 'auto',
    });
    lastRunStatus = r.status as 'SUCCESS' | 'FAILED';
    console.log(`[UruguayBotScheduler] Resultado: ${r.status} · ${r.rowsProcessed} filas`);
  } catch (err: any) {
    lastRunStatus = 'FAILED';
    console.error('[UruguayBotScheduler] Error en tick:', err?.message || err);
  } finally {
    running = false;
  }
}

/** Calcula próximo Date que represente HH:MM en zona Lima (UTC-5). */
function computeNextRunAt(hour: number, minute: number): Date {
  const now = new Date();
  const limaNow = new Date(now.getTime() - 5 * 60 * 60 * 1000);
  const target = new Date(Date.UTC(
    limaNow.getUTCFullYear(), limaNow.getUTCMonth(), limaNow.getUTCDate(),
    hour, minute, 0, 0
  ));
  if (target.getTime() <= limaNow.getTime() + 30 * 1000) {
    // Si ya pasó hoy (o pasa en los próximos 30s), siguiente día
    target.setUTCDate(target.getUTCDate() + 1);
  }
  return new Date(target.getTime() + 5 * 60 * 60 * 1000);
}

async function buildCronExpression(): Promise<{ expr: string; hour: number; minute: number }> {
  const cfg = await readConfig();
  const h = Math.min(23, Math.max(0, cfg.scheduleHour));
  const m = Math.min(59, Math.max(0, cfg.scheduleMinute));
  // cron sintaxis: "minute hour * * *" — todos los días a HH:MM
  return { expr: `${m} ${h} * * *`, hour: h, minute: m };
}

async function startInternal(): Promise<void> {
  if (cronTask) return;
  const { expr, hour, minute } = await buildCronExpression();
  cronTask = cron.schedule(expr, () => {
    void tick();
  }, {
    timezone: 'America/Lima',
  });
  nextRunAt = computeNextRunAt(hour, minute);
  const cfg = await readConfig();
  console.log(`[UruguayBotScheduler] Cron registrado: '${expr}' tz=America/Lima · próxima ejecución ${nextRunAt.toISOString()} (${cfg.enabled ? 'habilitado' : 'DESHABILITADO'})`);
}

export const uruguayBotScheduler = {
  /** Arranca el cron. Idempotente. */
  start(): void {
    void startInternal().catch(err => {
      console.error('[UruguayBotScheduler] Error en start():', err?.message || err);
    });
  },

  /** Detiene el cron. */
  stop(): void {
    if (cronTask) {
      cronTask.stop();
      cronTask = null;
    }
    nextRunAt = null;
  },

  /** Re-registra el cron con la config actualizada. */
  reschedule(): void {
    if (cronTask) {
      cronTask.stop();
      cronTask = null;
    }
    void startInternal().catch(err => {
      console.error('[UruguayBotScheduler] Error en reschedule():', err?.message || err);
    });
  },

  status(): {
    running: boolean;
    nextRunAt: string | null;
    lastTickAt: string | null;
    lastRunStatus: string | null;
    currentlyExecuting: boolean;
  } {
    return {
      running: !!cronTask,
      nextRunAt: nextRunAt ? nextRunAt.toISOString() : null,
      lastTickAt: lastTickAt ? lastTickAt.toISOString() : null,
      lastRunStatus,
      currentlyExecuting: running,
    };
  },
};
