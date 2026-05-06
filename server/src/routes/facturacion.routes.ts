import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { requireModule, requireAdmin } from '../middleware/rbac';
import { graphService } from '../services/graph.service';
import { dbService } from '../services/database.service';
import { letrasScheduler } from '../services/letras-scheduler.service';
import { letrasBot } from '../services/letras-bot.service';

const router = Router();

router.use(authenticateToken, requireModule('facturacion', 'letras'));

// Cached vendedor map (refreshes every 10 min)
let vendedorMapCache: Record<string, { vendedor: string; zona: string }> = {};
let vendedorMapTime = 0;
const CACHE_TTL = 10 * 60 * 1000; // 10 min

async function getVendedorMap(): Promise<Record<string, { vendedor: string; zona: string }>> {
  const now = Date.now();
  if (now - vendedorMapTime < CACHE_TTL && Object.keys(vendedorMapCache).length > 0) {
    return vendedorMapCache;
  }
  vendedorMapCache = await dbService.getVendedoresPorDocumentos();
  vendedorMapTime = now;
  return vendedorMapCache;
}

// List billing emails with search/filter/pagination + vendedor enrichment
router.get('/emails', async (req, res) => {
  try {
    const top = parseInt(req.query.top as string) || 25;
    const skip = parseInt(req.query.skip as string) || 0;
    const fechaDesde = req.query.fechaDesde as string | undefined;
    const fechaHasta = req.query.fechaHasta as string | undefined;
    const search = req.query.search as string | undefined;

    const [result, vendedorMap] = await Promise.all([
      graphService.getFacturacionEmails({ top, skip, fechaDesde, fechaHasta, search }),
      getVendedorMap(),
    ]);

    // Enrich emails with vendedor from SQL
    const enriched = result.emails.map(email => {
      const docNum = email.numeroDocumento?.split('/')[0]?.trim() || '';
      const match = vendedorMap[docNum];
      return {
        ...email,
        vendedor: match?.vendedor || '',
        zonaVendedor: match?.zona || '',
      };
    });

    // Module "Facturas Electrónicas" — restrict to FACTURA only
    let filtered = enriched.filter(e => e.tipoDocumento === 'FACTURA');
    const tipoDoc = req.query.tipoDocumento as string | undefined;
    const cliente = req.query.cliente as string | undefined;
    const numero = req.query.numero as string | undefined;
    const vendedor = req.query.vendedor as string | undefined;

    if (tipoDoc && tipoDoc !== 'TODOS') {
      filtered = filtered.filter(e => e.tipoDocumento === tipoDoc);
    }
    if (cliente) {
      const q = cliente.toUpperCase();
      filtered = filtered.filter(e =>
        e.cliente.toUpperCase().includes(q) ||
        e.to.some((t: string) => t.toUpperCase().includes(q))
      );
    }
    if (numero) {
      const q = numero.toUpperCase();
      const qDigits = (numero.match(/\d+/g) || []).join('');
      const qTail = qDigits.replace(/^0+/, '');
      filtered = filtered.filter(e => {
        const subj = (e.subject || '').toUpperCase();
        const num = (e.numeroDocumento || '').toUpperCase();
        if (num.includes(q) || subj.includes(q)) return true;
        if (qTail) {
          const subjDigits = (subj.match(/\d{4,}/g) || []).map((d: string) => d.replace(/^0+/, ''));
          const numDigits = (num.match(/\d{4,}/g) || []).map((d: string) => d.replace(/^0+/, ''));
          if (subjDigits.includes(qTail) || numDigits.includes(qTail)) return true;
        }
        return false;
      });
    }
    if (vendedor) {
      const q = vendedor.toUpperCase();
      filtered = filtered.filter(e => e.vendedor.toUpperCase().includes(q));
    }

    return res.json({
      success: true,
      data: filtered,
      filteredCount: filtered.length,
      totalCount: result.totalCount,
      configured: graphService.isConfigured(),
    });
  } catch (error) {
    console.error('Error fetching facturacion emails:', error);
    return res.status(500).json({ success: false, message: 'Error al obtener correos de facturación' });
  }
});

// List of vendedores for filter dropdown
router.get('/vendedores', async (_req, res) => {
  try {
    const vendedores = await dbService.getVendedoresFacturacion();
    return res.json({ success: true, data: vendedores });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Error al obtener vendedores' });
  }
});

// Get attachments for a specific email
router.get('/emails/:messageId/attachments', async (req, res) => {
  try {
    const attachments = await graphService.getFacturacionAttachments(req.params.messageId);
    return res.json({ success: true, data: attachments });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Error al obtener adjuntos' });
  }
});

// Download a specific attachment
router.get('/emails/:messageId/attachments/:attachmentId/download', async (req, res) => {
  try {
    const file = await graphService.downloadFacturacionAttachment(
      req.params.messageId,
      req.params.attachmentId
    );
    if (!file) {
      return res.status(404).json({ success: false, message: 'Adjunto no encontrado' });
    }

    const buffer = Buffer.from(file.contentBytes, 'base64');
    res.setHeader('Content-Type', file.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${file.name}"`);
    res.setHeader('Content-Length', buffer.length);
    return res.send(buffer);
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Error al descargar adjunto' });
  }
});

// ---- LETRAS (SharePoint) — served from scheduler cache ----
router.get('/letras-files', async (req, res) => {
  try {
    const search = ((req.query.search as string) || '').toLowerCase().trim();
    let files = letrasScheduler.getFiles();
    // If cache empty (first boot before initial sync completed), do inline sync
    if (files.length === 0) {
      await letrasScheduler.sync('auto');
      files = letrasScheduler.getFiles();
    }
    if (search) {
      files = files.filter(f =>
        f.name.toLowerCase().includes(search) ||
        (f.facturaCode || '').toLowerCase().includes(search) ||
        (f.cliente || '').toLowerCase().includes(search) ||
        f.letras.some(l => l.includes(search))
      );
    }
    return res.json({ success: true, data: files, status: letrasScheduler.getStatus() });
  } catch (error) {
    console.error('Error fetching letras files:', error);
    return res.status(500).json({ success: false, message: 'Error al obtener letras desde SharePoint' });
  }
});

// Sync status (last sync, staleness, new-today count)
router.get('/letras-status', async (_req, res) => {
  return res.json({ success: true, data: letrasScheduler.getStatus() });
});

// Fresh download URL per file — bypasses stale cached pre-signed URLs that expire ~1h
router.get('/letras-download/:itemId', async (req, res) => {
  try {
    const url = await graphService.getLetraDownloadUrl(req.params.itemId);
    if (!url) return res.status(404).json({ success: false, message: 'Archivo no encontrado' });
    return res.json({ success: true, data: { url } });
  } catch (error) {
    console.error('Error obtaining download url:', error);
    return res.status(500).json({ success: false, message: 'Error al generar URL de descarga' });
  }
});

// Force manual sync with SharePoint
router.post('/letras-refresh', async (_req, res) => {
  try {
    const status = await letrasScheduler.sync('manual');
    return res.json({ success: true, data: status });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Error al refrescar desde SharePoint' });
  }
});

// ---- LETRAS BOT (Admin only) ----
router.get('/letras-bot/config', requireAdmin, async (_req, res) => {
  try {
    const cfg = await letrasBot.getConfig();
    return res.json({ success: true, data: { ...cfg, currentCron: letrasBot.getCurrentCron() } });
  } catch (e) {
    return res.status(500).json({ success: false, message: (e as Error).message });
  }
});

router.put('/letras-bot/config', requireAdmin, async (req, res) => {
  try {
    const { enabled, sendHour, sendMinute, defaultCc } = req.body;
    if (typeof sendHour === 'number' && (sendHour < 0 || sendHour > 23))
      return res.status(400).json({ success: false, message: 'sendHour fuera de rango (0-23)' });
    if (typeof sendMinute === 'number' && (sendMinute < 0 || sendMinute > 59))
      return res.status(400).json({ success: false, message: 'sendMinute fuera de rango (0-59)' });
    const user = (req.user as any)?.username || 'admin';
    const cfg = await letrasBot.setConfig({ enabled, sendHour, sendMinute, defaultCc }, user);
    return res.json({ success: true, data: { ...cfg, currentCron: letrasBot.getCurrentCron() } });
  } catch (e) {
    return res.status(500).json({ success: false, message: (e as Error).message });
  }
});

router.get('/letras-bot/history', requireAdmin, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 500);
    const history = await letrasBot.getHistory(limit);
    return res.json({ success: true, data: history });
  } catch (e) {
    return res.status(500).json({ success: false, message: (e as Error).message });
  }
});

router.post('/letras-bot/run-now', requireAdmin, async (req, res) => {
  try {
    const letraId = typeof req.body?.letraId === 'string' ? req.body.letraId : undefined;
    const result = await letrasBot.runNow(letraId ? { letraId } : undefined);
    return res.json({ success: true, data: result });
  } catch (e) {
    return res.status(500).json({ success: false, message: (e as Error).message });
  }
});

// Get comprobantes (emails + attachments) matching a factura code
router.get('/letras-comprobantes', async (req, res) => {
  try {
    const facturaCode = req.query.facturaCode as string;
    if (!facturaCode) return res.status(400).json({ success: false, message: 'facturaCode requerido' });

    // Get recent emails and filter by factura code locally
    // (Graph $search doesn't reliably filter SentItems by doc number)
    const codes = facturaCode.split(' / ').map(c => c.trim()).filter(Boolean);
    // For each code, also compute its trailing-digits form (e.g. "F001-00039687" -> "39687")
    const codeTails = codes.map(c => {
      const digits = (c.match(/\d+/g) || []).join('');
      return digits.replace(/^0+/, '');
    }).filter(Boolean);

    const result = await graphService.getFacturacionEmails({ top: 500 });
    const allEmails = result.emails.filter((e: any) => {
      const num = (e.numeroDocumento || '').toUpperCase();
      const subj = (e.subject || '').toUpperCase();
      const preview = (e.preview || '').toUpperCase();
      const haystack = `${num} ${subj} ${preview}`;
      // Direct substring match against full code
      if (codes.some(c => haystack.includes(c.toUpperCase()))) return true;
      // Trailing-digits match (handles forwarded "RV: ... ELECT 00039687" subjects)
      if (codeTails.length) {
        const allDigits = (haystack.match(/\d{4,}/g) || []).map((d: string) => d.replace(/^0+/, ''));
        if (codeTails.some(t => allDigits.includes(t))) return true;
      }
      return false;
    });

    // Deduplicate by email id
    const uniqueEmails = [...new Map(allEmails.map(e => [e.id, e])).values()];

    // Fetch attachments for each email
    const emailsWithAttachments = await Promise.all(
      uniqueEmails.map(async (email: any) => {
        try {
          const attachments = email.hasAttachments
            ? await graphService.getFacturacionAttachments(email.id)
            : [];
          return { ...email, attachments: attachments || [] };
        } catch {
          return { ...email, attachments: [] };
        }
      })
    );

    // Collect unique destinatarios
    const allDestinatarios = [...new Set(
      emailsWithAttachments.flatMap((e: any) => [...(e.to || []), ...(e.cc || [])])
    )].filter(Boolean);

    return res.json({
      success: true,
      data: {
        emails: emailsWithAttachments,
        destinatarios: allDestinatarios,
        totalComprobantes: emailsWithAttachments.length,
        totalAdjuntos: emailsWithAttachments.reduce((s: number, e: any) => s + (e.attachments?.length || 0), 0),
      },
    });
  } catch (error) {
    console.error('Error fetching comprobantes for letra:', error);
    return res.status(500).json({ success: false, message: 'Error al buscar comprobantes asociados' });
  }
});

// Send letra + comprobantes email to client
router.post('/letras-send', async (req, res) => {
  try {
    const { letraDriveItemId, facturaCode, to, cc: ccRaw, cliente, force } = req.body;
    console.log('[letras-send] request:', { letraDriveItemId, facturaCode, to, cc: ccRaw, cliente, force });
    if (!to || !to.length) return res.status(400).json({ success: false, message: 'Destinatarios requeridos' });
    if (!letraDriveItemId) return res.status(400).json({ success: false, message: 'ID de letra requerido' });

    // Garantizar que cobranzas@pointamericas.com SIEMPRE esté en CC (regla de negocio)
    const FIXED_CC = 'cobranzas@pointamericas.com';
    const cc: string[] = Array.isArray(ccRaw) ? [...ccRaw] : [];
    if (!cc.some((e: string) => (e || '').toLowerCase() === FIXED_CC.toLowerCase())) cc.unshift(FIXED_CC);

    const DRIVE_ID = 'b!aDBAYXgyCUifG71OViKVOiShCsAuAlVOqAljzYTa1vGXuJpv-DDtTZw_GIbFTKRX';

    // Idempotency: check if this letra was already sent previously (bot history)
    if (!force) {
      try {
        const pool = await (await import('../config/database')).getDbPool();
        const prev = await pool.request().input('lid', letraDriveItemId)
          .query(`SELECT TOP 1 run_at, recipients_to FROM dbo.intranet_letras_bot_history
                  WHERE letra_id=@lid AND status='sent' ORDER BY run_at DESC`);
        if (prev.recordset.length) {
          return res.status(409).json({
            success: false, alreadySent: true,
            message: `Esta letra ya fue enviada previamente (${new Date(prev.recordset[0].run_at).toLocaleString('es-PE')}). Use force:true para reenviar.`,
            previousRecipients: prev.recordset[0].recipients_to,
          });
        }
      } catch (e) { console.error('[letras-send] idempotency check failed:', (e as Error).message); }
    }

    // 1. Download letra PDF from SharePoint
    const letraFile = await graphService.downloadDriveItem(DRIVE_ID, letraDriveItemId);

    // 2. Find and download comprobante attachments
    const attachments: Array<{ name: string; contentType: string; contentBytes: string }> = [];

    // Add letra PDF first
    attachments.push({
      name: letraFile.name,
      contentType: 'application/pdf',
      contentBytes: letraFile.contentBytes,
    });

    // Find comprobante emails (load batch and filter locally — $search unreliable for SentItems)
    if (facturaCode) {
      const codes = facturaCode.split(' / ').map((c: string) => c.trim()).filter(Boolean);
      try {
        const result = await graphService.getFacturacionEmails({ top: 500 });
        const matching = result.emails.filter((e: any) => {
          if (!e.hasAttachments) return false;
          const num = (e.numeroDocumento || '').toUpperCase();
          const subj = (e.subject || '').toUpperCase();
          const preview = (e.preview || '').toUpperCase();
          const haystack = `${num} ${subj} ${preview}`;
          if (codes.some((c: string) => haystack.includes(c.toUpperCase()))) return true;
          const tails = codes.map((c: string) => (c.match(/\d+/g) || []).join('').replace(/^0+/, '')).filter(Boolean);
          const allDigits = (haystack.match(/\d{4,}/g) || []).map((d: string) => d.replace(/^0+/, ''));
          return tails.some((t: string) => allDigits.includes(t));
        });
        for (const email of matching) {
          const isFac = (email.tipoDocumento || '').toUpperCase() === 'FACTURA';
          const emailAttachments = await graphService.getFacturacionAttachments(email.id);
          for (const att of (emailAttachments || [])) {
            if (att.isInline) continue;
            const isXml = /\.xml$/i.test(att.name) || /xml/i.test(att.contentType || '');
            // Attach all FAC email contents (PDF+XML); from non-FAC emails, attach XML only
            if (!isFac && !isXml) continue;
            const downloaded = await graphService.downloadFacturacionAttachment(email.id, att.id);
            if (downloaded) {
              attachments.push({
                name: downloaded.name,
                contentType: downloaded.contentType,
                contentBytes: downloaded.contentBytes,
              });
            }
          }
        }
      } catch (e) {
        console.error('Error fetching comprobantes for send:', e);
      }
    }

    // 3. Deduplicate attachments by name AND content size
    const seen = new Set<string>();
    const uniqueAttachments = attachments.filter(a => {
      // Key = normalized name + content length to catch near-duplicates
      const key = a.name.toLowerCase().replace(/\s+/g, '') + '|' + a.contentBytes.length;
      const keyByName = a.name.toLowerCase().replace(/\s+/g, '');
      if (seen.has(key) || seen.has(keyByName)) return false;
      seen.add(key);
      seen.add(keyByName);
      return true;
    });

    // 4. PRIMERO crear el registro en historial para obtener el history_id
    let historyId: number | null = null;
    try {
      const pool = await (await import('../config/database')).getDbPool();
      const ins = await pool.request()
        .input('rd', new Date().toISOString().slice(0, 10))
        .input('tt', 'manual')
        .input('lid', letraDriveItemId)
        .input('ln', letraFile.name)
        .input('fc', facturaCode || null)
        .input('cl', cliente || null)
        .input('rt', (to || []).join('; '))
        .input('rc', (cc || []).join('; '))
        .input('aq', uniqueAttachments.length)
        .input('st', 'sending')
        .input('em', null)
        .query(`INSERT INTO dbo.intranet_letras_bot_history
                  (run_date, trigger_type, letra_id, letra_name, factura_code, cliente,
                   recipients_to, recipients_cc, attachments_qty, status, error_message)
                OUTPUT INSERTED.id
                VALUES (@rd, @tt, @lid, @ln, @fc, @cl, @rt, @rc, @aq, @st, @em)`);
      historyId = ins.recordset[0]?.id;
    } catch (e) { console.error('[letras-send] history pre-insert failed:', (e as Error).message); }

    // 5. Construir tracking pixels por destinatario
    const baseUrl = process.env.PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 3001}`;
    const buildPixel = (recipient: string, role: 'to' | 'cc'): string => {
      if (!historyId) return '';
      const token = Buffer.from(JSON.stringify({ h: historyId, r: recipient, role })).toString('base64url');
      return `<img src="${baseUrl}/api/track/letras/${token}.gif" width="1" height="1" alt="" style="display:block;border:0;" />`;
    };
    const pixelsHtml = [
      ...(to || []).map((r: string) => buildPixel(r, 'to')),
      ...((cc || []).map((r: string) => buildPixel(r, 'cc'))),
    ].join('\n');

    // 6. Send email (con pixels embebidos al final del body)
    const subject = `Letra y Comprobantes de Pago — ${facturaCode || 'Sin referencia'} — ${cliente || 'Cliente'}`;
    const bodyHtml = `
      <div style="font-family:Arial,sans-serif;color:#333;">
        <h2 style="color:#00A651;">Point Andina S.A.</h2>
        <p>Estimado Cliente <strong>${cliente || ''}</strong>,</p>
        <p>Adjuntamos la(s) letra(s) y comprobantes de pago electrónicos correspondientes a la factura <strong>${facturaCode}</strong>.</p>
        <p>Documentos adjuntos: <strong>${uniqueAttachments.length}</strong></p>
        <ul>
          ${uniqueAttachments.map(a => `<li>${a.name}</li>`).join('')}
        </ul>
        <br/>
        <p>Atentamente,<br/><strong>Point Andina S.A.</strong><br/>Facturación y Despacho</p>
        ${pixelsHtml}
      </div>
    `;

    await graphService.sendEmailWithAttachments({
      to,
      cc: cc || [],
      subject,
      bodyHtml,
      attachments: uniqueAttachments,
    });

    // 7. Marcar como enviado exitoso
    if (historyId) {
      try {
        const pool = await (await import('../config/database')).getDbPool();
        await pool.request().input('id', historyId).query(
          `UPDATE dbo.intranet_letras_bot_history SET status='sent' WHERE id=@id`
        );
      } catch (e) { console.error('[letras-send] status update failed:', (e as Error).message); }
    }

    return res.json({
      success: true,
      message: `Email enviado a ${to.join(', ')} con ${uniqueAttachments.length} adjuntos`,
      data: { to, cc, attachmentsCount: uniqueAttachments.length },
    });
  } catch (error) {
    console.error('Error sending letra email:', error);
    return res.status(500).json({ success: false, message: 'Error al enviar email: ' + (error as any).message });
  }
});

// ─────────── TRACKING DE ENVÍOS Y APERTURAS ───────────

// Resumen agregado por letra_id (para mostrar badges en la lista principal sin N queries)
router.get('/letras-sends-summary', async (_req, res) => {
  try {
    const pool = await (await import('../config/database')).getDbPool();
    const r = await pool.request().query(`
      WITH last_send AS (
        SELECT letra_id,
               MAX(run_at) AS last_sent_at,
               COUNT(*) AS total_sends
        FROM dbo.intranet_letras_bot_history
        WHERE status = 'sent'
        GROUP BY letra_id
      ),
      last_send_detail AS (
        SELECT h.letra_id, h.id AS history_id, h.run_at, h.trigger_type, h.recipients_to, h.recipients_cc
        FROM dbo.intranet_letras_bot_history h
        INNER JOIN last_send ls ON h.letra_id = ls.letra_id AND h.run_at = ls.last_sent_at
        WHERE h.status = 'sent'
      ),
      opens AS (
        SELECT h.letra_id,
               COUNT(*) AS total_opens,
               SUM(CASE WHEN o.is_proxied = 0 THEN 1 ELSE 0 END) AS real_opens,
               COUNT(DISTINCT o.recipient) AS unique_openers,
               MAX(o.opened_at) AS last_open_at
        FROM dbo.intranet_letras_email_opens o
        INNER JOIN dbo.intranet_letras_bot_history h ON o.history_id = h.id
        WHERE h.status = 'sent'
        GROUP BY h.letra_id
      )
      SELECT
        ls.letra_id, ls.last_sent_at, ls.total_sends,
        lsd.history_id, lsd.trigger_type,
        lsd.recipients_to, lsd.recipients_cc,
        ISNULL(o.total_opens, 0)    AS total_opens,
        ISNULL(o.real_opens, 0)     AS real_opens,
        ISNULL(o.unique_openers, 0) AS unique_openers,
        o.last_open_at
      FROM last_send ls
      INNER JOIN last_send_detail lsd ON lsd.letra_id = ls.letra_id
      LEFT  JOIN opens o ON o.letra_id = ls.letra_id;
    `);
    return res.json({ success: true, data: r.recordset });
  } catch (err) {
    console.error('[letras-sends-summary] error:', err);
    return res.status(500).json({ success: false, message: (err as any).message });
  }
});

// Lista de envíos para una letra específica con resumen de aperturas por destinatario
router.get('/letras-sends/:letraId', async (req, res) => {
  try {
    const letraId = String(req.params.letraId);
    const pool = await (await import('../config/database')).getDbPool();
    const r = await pool.request().input('lid', letraId).query(`
      SELECT
        h.id, h.run_at, h.trigger_type, h.status, h.factura_code, h.cliente,
        h.recipients_to, h.recipients_cc, h.attachments_qty, h.error_message,
        (SELECT COUNT(*) FROM dbo.intranet_letras_email_opens o WHERE o.history_id = h.id) AS total_opens,
        (SELECT COUNT(DISTINCT o.recipient) FROM dbo.intranet_letras_email_opens o WHERE o.history_id = h.id) AS unique_openers,
        (SELECT MIN(o.opened_at) FROM dbo.intranet_letras_email_opens o WHERE o.history_id = h.id AND o.is_proxied = 0) AS first_open_at,
        (SELECT MAX(o.opened_at) FROM dbo.intranet_letras_email_opens o WHERE o.history_id = h.id AND o.is_proxied = 0) AS last_open_at
      FROM dbo.intranet_letras_bot_history h
      WHERE h.letra_id = @lid
      ORDER BY h.run_at DESC;
    `);
    return res.json({ success: true, data: r.recordset });
  } catch (err) {
    console.error('[letras-sends] error:', err);
    return res.status(500).json({ success: false, message: (err as any).message });
  }
});

// Detalle de aperturas para un envío específico (history_id) — agregado por destinatario
router.get('/letras-opens/:historyId', async (req, res) => {
  try {
    const historyId = parseInt(String(req.params.historyId));
    if (!Number.isFinite(historyId)) {
      return res.status(400).json({ success: false, message: 'history_id inválido' });
    }
    const pool = await (await import('../config/database')).getDbPool();

    // Resumen por destinatario
    const summary = await pool.request().input('id', historyId).query(`
      SELECT
        recipient, recipient_role,
        COUNT(*) AS total_opens,
        SUM(CASE WHEN is_proxied = 0 THEN 1 ELSE 0 END) AS real_opens,
        SUM(CASE WHEN is_proxied = 1 THEN 1 ELSE 0 END) AS proxy_opens,
        MIN(opened_at) AS first_open_at,
        MAX(opened_at) AS last_open_at
      FROM dbo.intranet_letras_email_opens
      WHERE history_id = @id
      GROUP BY recipient, recipient_role
      ORDER BY MAX(opened_at) DESC;
    `);

    // Detalle (últimas 100 aperturas)
    const detail = await pool.request().input('id', historyId).query(`
      SELECT TOP 100
        open_id, recipient, recipient_role, opened_at,
        ip_address, user_agent, is_proxied
      FROM dbo.intranet_letras_email_opens
      WHERE history_id = @id
      ORDER BY opened_at DESC;
    `);

    // Datos del envío
    const send = await pool.request().input('id', historyId).query(`
      SELECT id, run_at, trigger_type, status, factura_code, cliente,
             recipients_to, recipients_cc, letra_name
      FROM dbo.intranet_letras_bot_history
      WHERE id = @id;
    `);

    return res.json({
      success: true,
      data: {
        send: send.recordset[0] || null,
        summary: summary.recordset,
        detail: detail.recordset,
      },
    });
  } catch (err) {
    console.error('[letras-opens] error:', err);
    return res.status(500).json({ success: false, message: (err as any).message });
  }
});

// Status check
router.get('/status', async (_req, res) => {
  return res.json({
    success: true,
    configured: graphService.isConfigured(),
    email: process.env.MS_FACTURACION_EMAIL || 'facturacionpointandina@pointamericas.com',
  });
});

export default router;
