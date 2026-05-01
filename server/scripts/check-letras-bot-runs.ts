// ============================================================
// Diagnóstico: ¿el bot Letras ejecutó antes de la hora programada?
// SOLO LECTURA
// ============================================================

import { getDbPool, closeDb } from '../src/config/database';

async function main() {
  const pool = await getDbPool();

  console.log('=== Configuración actual del bot Letras ===');
  const cfg = await pool.request().query(`
    SELECT TOP 1 enabled, send_hour, send_minute, default_cc, updated_at, updated_by
    FROM dbo.intranet_letras_bot_config
  `);
  console.table(cfg.recordset);

  console.log('\n=== Últimas 20 ejecuciones del bot Letras ===');
  const runs = await pool.request().query(`
    SELECT TOP 20 history_id, executed_at, trigger_type, triggered_by,
      letra_id, letra_name, factura_code, sent_to,
      LEFT(error_message, 100) AS error_message,
      success_flag
    FROM dbo.intranet_letras_bot_history
    ORDER BY executed_at DESC
  `);
  console.table(runs.recordset.map((r: any) => ({
    id: r.history_id,
    fecha_lima: r.executed_at ? new Date(r.executed_at).toLocaleString('es-PE', { timeZone: 'America/Lima' }) : '—',
    tipo: r.trigger_type,
    by: r.triggered_by,
    factura: r.factura_code,
    success: r.success_flag,
    error: (r.error_message || '').substring(0, 50),
  })));

  console.log('\n=== Ejecuciones agrupadas por hora (Lima) — para detectar disparos extraños ===');
  const byHour = await pool.request().query(`
    SELECT
      DATEPART(HOUR, DATEADD(HOUR, -5, executed_at)) AS hora_lima,
      trigger_type,
      COUNT(*) AS ejecuciones,
      MIN(executed_at) AS primera_utc,
      MAX(executed_at) AS ultima_utc
    FROM dbo.intranet_letras_bot_history
    WHERE executed_at >= DATEADD(DAY, -7, GETUTCDATE())
    GROUP BY DATEPART(HOUR, DATEADD(HOUR, -5, executed_at)), trigger_type
    ORDER BY hora_lima, trigger_type
  `);
  console.table(byHour.recordset.map((r: any) => ({
    hora_lima: `${String(r.hora_lima).padStart(2, '0')}:xx`,
    tipo: r.trigger_type,
    ejecuciones: r.ejecuciones,
    primera_lima: r.primera_utc ? new Date(r.primera_utc).toLocaleString('es-PE', { timeZone: 'America/Lima' }) : '—',
    ultima_lima: r.ultima_utc ? new Date(r.ultima_utc).toLocaleString('es-PE', { timeZone: 'America/Lima' }) : '—',
  })));

  console.log('\n=== Hora actual servidor vs Lima ===');
  const now = await pool.request().query(`
    SELECT
      GETUTCDATE() AS utc_now,
      DATEADD(HOUR, -5, GETUTCDATE()) AS lima_now
  `);
  console.table(now.recordset.map((r: any) => ({
    utc: r.utc_now,
    lima: r.lima_now,
    js_local: new Date().toLocaleString('es-PE', { timeZone: 'America/Lima' }),
  })));

  await closeDb();
}

main().catch(e => { console.error(e); process.exit(1); });
