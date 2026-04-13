import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { requireModule } from '../middleware/rbac';
import { dbService } from '../services/database.service';
import { graphService } from '../services/graph.service';

const router = Router();

router.use(authenticateToken, requireModule('alertas'));

router.get('/sap', async (_req, res) => {
  try {
    const data = await dbService.getAlertasSAP();
    return res.json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Error al obtener alertas SAP' });
  }
});

router.get('/ordenes-no-atendidas', async (_req, res) => {
  try {
    const data = await dbService.getOrdenesNoAtendidas();
    return res.json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Error al obtener órdenes no atendidas' });
  }
});

router.get('/resultado/:alertaId', async (req, res) => {
  try {
    const alertaId = parseInt(req.params.alertaId, 10);
    const fecha = (req.query.fecha as string) || new Date().toISOString().split('T')[0];
    const data = await dbService.getAlertaResultado(alertaId, fecha);
    return res.json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Error al obtener resultado de alerta' });
  }
});

// Placeholder para pedidos rechazados (vista SQL en construcción)
router.get('/pedidos-rechazados', async (_req, res) => {
  return res.json({
    success: true,
    data: [],
    message: 'Vista SQL en construcción - datos mock pendientes',
  });
});

// ---- Microsoft 365 Email Integration ----

router.get('/emails', async (req, res) => {
  try {
    const count = parseInt(req.query.count as string) || 20;
    const filter = req.query.filter as string | undefined;
    const emails = await graphService.getAlertEmails(count, filter);
    return res.json({
      success: true,
      configured: graphService.isConfigured(),
      data: emails,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Error al obtener correos de alertas' });
  }
});

router.get('/emails/:messageId', async (req, res) => {
  try {
    const html = await graphService.getEmailBody(req.params.messageId);
    return res.json({ success: true, data: { html } });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Error al obtener contenido del correo' });
  }
});

router.get('/emails/status', async (_req, res) => {
  return res.json({
    success: true,
    configured: graphService.isConfigured(),
    email: process.env.MS_ALERT_EMAIL || 'alertasSapPA@pointamericas.com',
  });
});

export default router;
