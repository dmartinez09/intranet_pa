// ============================================================
// ETL Scheduler - intervalos diarios y semanales
// Usa setInterval; calcula próxima hora esperada para ejecución nocturna.
// Se inicia con etlScheduler.start() desde index.ts si NODE_ENV=production
// o si ETL_AUTO_START=1
// ============================================================

import { runByFrequency, etlTablesReady } from './index';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

interface SchedulerState {
  dailyTimer: NodeJS.Timeout | null;
  weeklyTimer: NodeJS.Timeout | null;
  lastDaily: Date | null;
  lastWeekly: Date | null;
}

const state: SchedulerState = {
  dailyTimer: null,
  weeklyTimer: null,
  lastDaily: null,
  lastWeekly: null,
};

// Calcula ms hasta la próxima ejecución nocturna (2:30 AM Lima)
function msUntilNext(hourUTC: number, minuteUTC = 0): number {
  const now = new Date();
  const next = new Date(Date.UTC(
    now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(),
    hourUTC, minuteUTC, 0, 0,
  ));
  if (next.getTime() <= now.getTime()) next.setUTCDate(next.getUTCDate() + 1);
  return next.getTime() - now.getTime();
}

async function runDaily() {
  console.log('[ETL-Scheduler] Iniciando ejecución diaria...');
  const ready = await etlTablesReady();
  if (!ready) {
    console.warn('[ETL-Scheduler] Tablas icb_* no listas. Saltando ejecución.');
    return;
  }
  try {
    const results = await runByFrequency('daily', 'cron_nightly');
    state.lastDaily = new Date();
    const ok = results.filter(r => r.result.status === 'SUCCESS').length;
    console.log(`[ETL-Scheduler] Diario completado: ${ok}/${results.length} collectors OK`);
  } catch (err: any) {
    console.error('[ETL-Scheduler] Error en ejecución diaria:', err?.message);
  }
}

async function runWeekly() {
  console.log('[ETL-Scheduler] Iniciando ejecución semanal...');
  const ready = await etlTablesReady();
  if (!ready) {
    console.warn('[ETL-Scheduler] Tablas icb_* no listas. Saltando ejecución.');
    return;
  }
  try {
    const results = await runByFrequency('weekly', 'cron_weekly');
    state.lastWeekly = new Date();
    const ok = results.filter(r => r.result.status === 'SUCCESS').length;
    console.log(`[ETL-Scheduler] Semanal completado: ${ok}/${results.length} collectors OK`);
  } catch (err: any) {
    console.error('[ETL-Scheduler] Error en ejecución semanal:', err?.message);
  }
}

// Ejecución diaria: cada 24h a partir de las 07:30 UTC (02:30 Lima)
function scheduleDaily() {
  const initial = msUntilNext(7, 30);
  console.log(`[ETL-Scheduler] Próxima ejecución diaria en ${Math.round(initial / 60000)} min`);
  state.dailyTimer = setTimeout(() => {
    void runDaily();
    state.dailyTimer = setInterval(() => { void runDaily(); }, DAY);
  }, initial);
}

// Ejecución semanal: cada lunes 08:00 UTC (03:00 Lima)
function scheduleWeekly() {
  const now = new Date();
  const daysUntilMonday = (8 - now.getUTCDay()) % 7 || 7;  // siguiente lunes
  const next = new Date(Date.UTC(
    now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + daysUntilMonday, 8, 0, 0, 0,
  ));
  const initial = next.getTime() - now.getTime();
  console.log(`[ETL-Scheduler] Próxima ejecución semanal en ${Math.round(initial / HOUR)} horas`);
  state.weeklyTimer = setTimeout(() => {
    void runWeekly();
    state.weeklyTimer = setInterval(() => { void runWeekly(); }, 7 * DAY);
  }, initial);
}

export const etlScheduler = {
  start(): void {
    if (state.dailyTimer || state.weeklyTimer) {
      console.log('[ETL-Scheduler] Ya está corriendo.');
      return;
    }
    scheduleDaily();
    scheduleWeekly();
    console.log('[ETL-Scheduler] Iniciado.');
  },
  stop(): void {
    if (state.dailyTimer) clearTimeout(state.dailyTimer);
    if (state.weeklyTimer) clearTimeout(state.weeklyTimer);
    state.dailyTimer = null;
    state.weeklyTimer = null;
    console.log('[ETL-Scheduler] Detenido.');
  },
  status(): { running: boolean; lastDaily: string | null; lastWeekly: string | null } {
    return {
      running: !!(state.dailyTimer || state.weeklyTimer),
      lastDaily: state.lastDaily?.toISOString() || null,
      lastWeekly: state.lastWeekly?.toISOString() || null,
    };
  },
};
