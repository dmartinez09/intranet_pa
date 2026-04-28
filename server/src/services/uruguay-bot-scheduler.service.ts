import { readConfig, runBot } from './uruguay-bot.service';

/**
 * Scheduler para el bot de Uruguay.
 * Lee config (hora/min en zona Lima), calcula próxima ejecución, dispara runBot
 * con triggerType='auto' procesando el día anterior.
 */

let timerHandle: NodeJS.Timeout | null = null;
let nextRunAt: Date | null = null;
let lastTickAt: Date | null = null;

/** Calcula el próximo Date (UTC) que represente HH:MM en hora Lima (UTC-5). */
function nextLimaTime(hour: number, minute: number): Date {
  // Lima = UTC-5 fijo (sin DST)
  const now = new Date();
  // hora Lima ahora
  const limaNow = new Date(now.getTime() - 5 * 60 * 60 * 1000);
  const target = new Date(Date.UTC(
    limaNow.getUTCFullYear(), limaNow.getUTCMonth(), limaNow.getUTCDate(),
    hour, minute, 0, 0
  ));
  // si ya pasó hoy, usar mañana
  if (target.getTime() <= limaNow.getTime()) {
    target.setUTCDate(target.getUTCDate() + 1);
  }
  // convertir target Lima -> UTC sumando 5h
  return new Date(target.getTime() + 5 * 60 * 60 * 1000);
}

function ymd(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

async function tick() {
  lastTickAt = new Date();
  try {
    const cfg = readConfig();
    if (!cfg.enabled) {
      console.log('[UruguayBotScheduler] Bot deshabilitado, skip.');
      schedule(); // re-agendar igual
      return;
    }
    // procesar día anterior (Lima)
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
    console.log(`[UruguayBotScheduler] Resultado: ${r.status} · ${r.rowsProcessed} filas`);
  } catch (err: any) {
    console.error('[UruguayBotScheduler] Error en tick:', err?.message || err);
  } finally {
    schedule();
  }
}

function schedule() {
  if (timerHandle) clearTimeout(timerHandle);
  const cfg = readConfig();
  const next = nextLimaTime(cfg.scheduleHour, cfg.scheduleMinute);
  nextRunAt = next;
  const ms = Math.max(1000, next.getTime() - Date.now());
  timerHandle = setTimeout(() => { void tick(); }, ms);
  console.log(`[UruguayBotScheduler] Próxima ejecución: ${next.toISOString()} (${cfg.enabled ? 'habilitado' : 'DESHABILITADO'})`);
}

export const uruguayBotScheduler = {
  start(): void {
    if (timerHandle) return;
    schedule();
  },
  stop(): void {
    if (timerHandle) { clearTimeout(timerHandle); timerHandle = null; }
    nextRunAt = null;
  },
  /** Re-calcula próximo run (ej: tras cambio de config). */
  reschedule(): void {
    schedule();
  },
  status(): { running: boolean; nextRunAt: string | null; lastTickAt: string | null } {
    return {
      running: !!timerHandle,
      nextRunAt: nextRunAt ? nextRunAt.toISOString() : null,
      lastTickAt: lastTickAt ? lastTickAt.toISOString() : null,
    };
  },
};
