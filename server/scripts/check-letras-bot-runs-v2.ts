import { getDbPool, closeDb } from '../src/config/database';

async function main() {
  const pool = await getDbPool();

  console.log('=== Configuración actual del bot Letras ===');
  const cfg = await pool.request().query(`
    SELECT TOP 1 enabled, send_hour, send_minute, default_cc, updated_at, updated_by
    FROM dbo.intranet_letras_bot_config
  `);
  console.table(cfg.recordset);

  console.log('\n=== Últimas 30 ejecuciones (ordenadas por run_at DESC) ===');
  const runs = await pool.request().query(`
    SELECT TOP 30 id, run_at, trigger_type, status,
      letra_name, factura_code, cliente,
      recipients_to, recipients_cc,
      LEFT(error_message, 80) AS error_message
    FROM dbo.intranet_letras_bot_history
    ORDER BY run_at DESC
  `);
  console.table(runs.recordset.map((r: any) => ({
    id: r.id,
    fecha_lima: r.run_at ? new Date(r.run_at).toLocaleString('es-PE', { timeZone: 'America/Lima', hour12: false }) : '—',
    tipo: r.trigger_type,
    status: r.status,
    factura: r.factura_code,
    cobranzas_en_cc: (r.recipients_cc || '').toLowerCase().includes('cobranzas@pointamericas.com') ? '✓' : '✗',
    err: (r.error_message || '').substring(0, 40),
  })));

  console.log('\n=== Ejecuciones agrupadas por hora Lima (últimos 7 días) ===');
  const byHour = await pool.request().query(`
    SELECT
      CAST(DATEADD(HOUR, -5, run_at) AS DATE) AS fecha_lima,
      DATEPART(HOUR, DATEADD(HOUR, -5, run_at)) AS hora_lima,
      trigger_type,
      COUNT(*) AS ejecuciones
    FROM dbo.intranet_letras_bot_history
    WHERE run_at >= DATEADD(DAY, -7, GETUTCDATE())
    GROUP BY CAST(DATEADD(HOUR, -5, run_at) AS DATE),
             DATEPART(HOUR, DATEADD(HOUR, -5, run_at)), trigger_type
    ORDER BY fecha_lima DESC, hora_lima
  `);
  console.table(byHour.recordset.map((r: any) => ({
    fecha_lima: r.fecha_lima ? new Date(r.fecha_lima).toISOString().substring(0, 10) : '—',
    hora_lima: `${String(r.hora_lima).padStart(2, '0')}:xx`,
    tipo: r.trigger_type,
    ejecuciones: r.ejecuciones,
  })));

  console.log('\n=== Hora servidor ===');
  const now = await pool.request().query(`
    SELECT
      GETUTCDATE() AS utc_now,
      DATEADD(HOUR, -5, GETUTCDATE()) AS lima_now
  `);
  console.log('Server UTC :', now.recordset[0].utc_now);
  console.log('Server Lima:', now.recordset[0].lima_now);
  console.log('Local JS    :', new Date().toLocaleString('es-PE', { timeZone: 'America/Lima', hour12: false }));

  await closeDb();
}

main().catch(e => { console.error(e); process.exit(1); });
