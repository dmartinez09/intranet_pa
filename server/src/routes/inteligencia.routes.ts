// ============================================================
// Inteligencia Comercial Beta - Routes
// Todas las rutas requieren módulo inteligencia_comercial o mapa_interactivo
// ============================================================

import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { requireModule } from '../middleware/rbac';
import { inteligenciaService } from '../services/inteligencia.service';

const router = Router();

// Auth en todo el módulo
router.use(authenticateToken);

// Todos los usuarios con inteligencia_comercial O mapa_interactivo pueden leer catálogos
const canRead = requireModule('inteligencia_comercial', 'mapa_interactivo');

// ---------------------------------------------------------------------------
// GET /api/inteligencia/meta - KPIs y estado general
// ---------------------------------------------------------------------------
router.get('/meta', canRead, async (_req: Request, res: Response) => {
  try {
    const data = await inteligenciaService.getMeta();
    res.json({ success: true, data });
  } catch (err: any) {
    console.error('[Inteligencia] getMeta error:', err);
    res.status(500).json({ success: false, message: 'Error al obtener metadatos' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/inteligencia/sources - Fuentes con trazabilidad
// ---------------------------------------------------------------------------
router.get('/sources', canRead, async (_req: Request, res: Response) => {
  try {
    const data = await inteligenciaService.getSources();
    res.json({ success: true, data });
  } catch (err: any) {
    console.error('[Inteligencia] getSources error:', err);
    res.status(500).json({ success: false, message: 'Error al obtener fuentes' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/inteligencia/crops - Catálogo de cultivos
// ---------------------------------------------------------------------------
router.get('/crops', canRead, async (_req: Request, res: Response) => {
  try {
    const data = await inteligenciaService.getCrops();
    res.json({ success: true, data });
  } catch (err: any) {
    console.error('[Inteligencia] getCrops error:', err);
    res.status(500).json({ success: false, message: 'Error al obtener cultivos' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/inteligencia/regions - Departamentos
// ---------------------------------------------------------------------------
router.get('/regions', canRead, async (_req: Request, res: Response) => {
  try {
    const data = await inteligenciaService.getRegions();
    res.json({ success: true, data });
  } catch (err: any) {
    console.error('[Inteligencia] getRegions error:', err);
    res.status(500).json({ success: false, message: 'Error al obtener regiones' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/inteligencia/categories - Categorías Point Andina
// ---------------------------------------------------------------------------
router.get('/categories', canRead, async (_req: Request, res: Response) => {
  try {
    const data = await inteligenciaService.getCategories();
    res.json({ success: true, data });
  } catch (err: any) {
    console.error('[Inteligencia] getCategories error:', err);
    res.status(500).json({ success: false, message: 'Error al obtener categorías' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/inteligencia/snapshots - Snapshots filtrables
// ---------------------------------------------------------------------------
router.get('/snapshots', canRead, async (req: Request, res: Response) => {
  try {
    const filtros = {
      crop_id: req.query.crop_id ? parseInt(String(req.query.crop_id)) : undefined,
      region_id: req.query.region_id ? parseInt(String(req.query.region_id)) : undefined,
      category_id: req.query.category_id ? parseInt(String(req.query.category_id)) : undefined,
      source_id: req.query.source_id ? parseInt(String(req.query.source_id)) : undefined,
      from_date: req.query.from_date ? String(req.query.from_date) : undefined,
      to_date: req.query.to_date ? String(req.query.to_date) : undefined,
      limit: req.query.limit ? parseInt(String(req.query.limit)) : 500,
    };
    const data = await inteligenciaService.getSnapshots(filtros);
    res.json({ success: true, data });
  } catch (err: any) {
    console.error('[Inteligencia] getSnapshots error:', err);
    res.status(500).json({ success: false, message: 'Error al obtener snapshots' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/inteligencia/geo-summary - Resumen por departamento (para mapa)
// ---------------------------------------------------------------------------
router.get('/geo-summary', canRead, async (req: Request, res: Response) => {
  try {
    const filtros = {
      crop_id: req.query.crop_id ? parseInt(String(req.query.crop_id)) : undefined,
      category_id: req.query.category_id ? parseInt(String(req.query.category_id)) : undefined,
    };
    const data = await inteligenciaService.getGeoSummary(filtros);
    res.json({ success: true, data });
  } catch (err: any) {
    console.error('[Inteligencia] getGeoSummary error:', err);
    res.status(500).json({ success: false, message: 'Error al obtener resumen geográfico' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/inteligencia/top-crops - Ranking de cultivos por hectáreas
// ---------------------------------------------------------------------------
router.get('/top-crops', canRead, async (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? parseInt(String(req.query.limit)) : 10;
    const data = await inteligenciaService.getTopCrops(limit);
    res.json({ success: true, data });
  } catch (err: any) {
    console.error('[Inteligencia] getTopCrops error:', err);
    res.status(500).json({ success: false, message: 'Error al obtener ranking de cultivos' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/inteligencia/etl-runs - Log de ejecuciones ETL
// ---------------------------------------------------------------------------
router.get('/etl-runs', canRead, async (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? parseInt(String(req.query.limit)) : 30;
    const data = await inteligenciaService.getEtlRuns(limit);
    res.json({ success: true, data });
  } catch (err: any) {
    console.error('[Inteligencia] getEtlRuns error:', err);
    res.status(500).json({ success: false, message: 'Error al obtener log ETL' });
  }
});

export default router;
