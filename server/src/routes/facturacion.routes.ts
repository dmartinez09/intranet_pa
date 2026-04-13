import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { requireModule } from '../middleware/rbac';
import { graphService } from '../services/graph.service';
import { dbService } from '../services/database.service';

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
      filtered = filtered.filter(e =>
        e.numeroDocumento.toUpperCase().includes(q) ||
        e.subject.toUpperCase().includes(q)
      );
    }
    if (vendedor) {
      const q = vendedor.toUpperCase();
      filtered = filtered.filter(e => e.vendedor.toUpperCase().includes(q));
    }

    return res.json({
      success: true,
      data: filtered,
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

// Status check
router.get('/status', async (_req, res) => {
  return res.json({
    success: true,
    configured: graphService.isConfigured(),
    email: process.env.MS_FACTURACION_EMAIL || 'facturacionpointandina@pointamericas.com',
  });
});

export default router;
