import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { requireModule, requireAdmin } from '../middleware/rbac';
import { graphService } from '../services/graph.service';
import { dbService } from '../services/database.service';
import { letrasScheduler } from '../services/letras-scheduler.service';
import { letrasBot } from '../services/letras-bot.service';

const router = Router();

router.use(authenticateToken, requireModule('dashboard_ventas'));

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

    // Server-side filtering
    let filtered = enriched;
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

router.post('/letras-bot/run-now', requireAdmin, async (_req, res) => {
  try {
    const result = await letrasBot.runNow();
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

    const result = await graphService.getFacturacionEmails({ top: 200 });
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
    const { letraDriveItemId, facturaCode, to, cc, cliente } = req.body;
    if (!to || !to.length) return res.status(400).json({ success: false, message: 'Destinatarios requeridos' });
    if (!letraDriveItemId) return res.status(400).json({ success: false, message: 'ID de letra requerido' });

    const DRIVE_ID = 'b!aDBAYXgyCUifG71OViKVOiShCsAuAlVOqAljzYTa1vGXuJpv-DDtTZw_GIbFTKRX';

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
        const result = await graphService.getFacturacionEmails({ top: 100 });
        const matching = result.emails.filter((e: any) =>
          e.numeroDocumento && e.hasAttachments && codes.some((c: string) => e.numeroDocumento.includes(c))
        );
        for (const email of matching) {
          const emailAttachments = await graphService.getFacturacionAttachments(email.id);
          for (const att of (emailAttachments || [])) {
            if (att.isInline) continue;
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

    // 4. Send email
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
      </div>
    `;

    await graphService.sendEmailWithAttachments({
      to,
      cc: cc || [],
      subject,
      bodyHtml,
      attachments: uniqueAttachments,
    });

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

// Status check
router.get('/status', async (_req, res) => {
  return res.json({
    success: true,
    configured: graphService.isConfigured(),
    email: process.env.MS_FACTURACION_EMAIL || 'facturacionpointandina@pointamericas.com',
  });
});

export default router;
