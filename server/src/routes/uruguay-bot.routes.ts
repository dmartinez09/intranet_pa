import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { requireAdmin } from '../middleware/rbac';
import { ventasUruguayService } from '../services/ventas-uruguay.service';
import { sharepointService, parseSharePointUrl } from '../services/sharepoint.service';
import { readConfig, writeConfig, runBot, getRuns } from '../services/uruguay-bot.service';
import { uruguayBotScheduler } from '../services/uruguay-bot-scheduler.service';

const router = Router();

router.use(authenticateToken);
router.use(requireAdmin);

// -------- CONFIG --------

router.get('/config', async (_req: Request, res: Response) => {
  try {
    const cfg = readConfig();
    const sched = uruguayBotScheduler.status();
    res.json({ success: true, data: { ...cfg, scheduler: sched } });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/config', async (req: Request, res: Response) => {
  try {
    const cur = readConfig();
    const body = req.body || {};
    const next = {
      ...cur,
      enabled: body.enabled !== undefined ? !!body.enabled : cur.enabled,
      scheduleHour: body.scheduleHour !== undefined ? Math.min(23, Math.max(0, parseInt(body.scheduleHour))) : cur.scheduleHour,
      scheduleMinute: body.scheduleMinute !== undefined ? Math.min(59, Math.max(0, parseInt(body.scheduleMinute))) : cur.scheduleMinute,
      sharepointUrl: body.sharepointUrl !== undefined ? String(body.sharepointUrl) : cur.sharepointUrl,
      timezone: cur.timezone,
    };
    writeConfig(next, req.user?.username || 'admin');
    uruguayBotScheduler.reschedule();
    res.json({ success: true, data: readConfig() });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// -------- DIAGNÓSTICO DE LA VISTA --------

router.get('/data-info', async (_req: Request, res: Response) => {
  try {
    const r = await ventasUruguayService.rangoDisponible();
    res.json({ success: true, data: r });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// -------- SHAREPOINT --------

router.get('/sharepoint/resolve', async (req: Request, res: Response) => {
  try {
    const url = String(req.query.url || readConfig().sharepointUrl);
    if (!url) return res.status(400).json({ success: false, message: 'Falta URL' });
    if (!sharepointService.isConfigured()) {
      return res.status(400).json({ success: false, message: 'Microsoft Graph no está configurado en el server.' });
    }
    const parsed = parseSharePointUrl(url);
    const loc = await sharepointService.resolveLocation(url);
    res.json({ success: true, data: { ...loc, parsed } });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/sharepoint/list', async (req: Request, res: Response) => {
  try {
    const url = String(req.query.url || readConfig().sharepointUrl);
    const subPath = String(req.query.path || '');  // e.g. '/Uruguay/Carpetas Individuales'
    if (!url) return res.status(400).json({ success: false, message: 'Falta URL base' });
    const loc = await sharepointService.resolveLocation(url);
    const folder = subPath || loc.folderPath;
    const items = await sharepointService.listChildren(loc.driveId, folder);
    res.json({ success: true, data: { folderPath: folder, items } });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// -------- EJECUCIÓN --------

router.post('/run', async (req: Request, res: Response) => {
  try {
    const { dateFrom, dateTo } = req.body || {};
    const today = new Date();
    const yymmdd = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
    const yest = new Date(today.getTime() - 24 * 3600 * 1000);

    const df = dateFrom || yymmdd(yest);
    const dt = dateTo || df;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(df) || !/^\d{4}-\d{2}-\d{2}$/.test(dt)) {
      return res.status(400).json({ success: false, message: 'Fechas inválidas (YYYY-MM-DD)' });
    }
    if (df > dt) {
      return res.status(400).json({ success: false, message: 'dateFrom debe ser <= dateTo' });
    }

    const triggerType: 'manual' | 'range' = df === dt ? 'manual' : 'range';
    const result = await runBot({
      dateFrom: df, dateTo: dt,
      triggeredBy: req.user?.username || 'admin',
      triggerType,
    });
    res.json({ success: result.status === 'SUCCESS', data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// -------- HISTORIAL --------

router.get('/runs', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(String(req.query.limit || '50'));
    const runs = await getRuns(limit);
    res.json({ success: true, data: runs });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// -------- CONTROL SCHEDULER --------

router.post('/scheduler/start', async (_req: Request, res: Response) => {
  uruguayBotScheduler.start();
  res.json({ success: true, data: uruguayBotScheduler.status() });
});

router.post('/scheduler/stop', async (_req: Request, res: Response) => {
  uruguayBotScheduler.stop();
  res.json({ success: true, data: uruguayBotScheduler.status() });
});

export default router;
