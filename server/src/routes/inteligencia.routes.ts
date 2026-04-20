// ============================================================
// Inteligencia Comercial Beta - Routes
// Todas las rutas requieren módulo inteligencia_comercial o mapa_interactivo
// ============================================================

import { Router, Request, Response } from 'express';
import ExcelJS from 'exceljs';
import { authenticateToken } from '../middleware/auth';
import { requireModule, requireAdmin } from '../middleware/rbac';
import { inteligenciaService } from '../services/inteligencia.service';
import { gapService } from '../services/gap.service';
import { comexService } from '../services/comex.service';
import { listCollectors, runOne, runAll, runByFrequency, etlTablesReady } from '../services/etl';
import { etlScheduler } from '../services/etl/scheduler';

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
// GET /api/inteligencia/top-opportunities - Oportunidades destacadas
// ---------------------------------------------------------------------------
router.get('/top-opportunities', canRead, async (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? parseInt(String(req.query.limit)) : 10;
    const minScore = req.query.min_score ? parseInt(String(req.query.min_score)) : 70;
    const data = await inteligenciaService.getTopOpportunities(limit, minScore);
    res.json({ success: true, data });
  } catch (err: any) {
    console.error('[Inteligencia] getTopOpportunities error:', err);
    res.status(500).json({ success: false, message: 'Error al obtener oportunidades' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/inteligencia/snapshots/:id - Detalle de snapshot (incluye raw_payload)
// ---------------------------------------------------------------------------
router.get('/snapshots/:id', canRead, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ success: false, message: 'ID inválido' });
      return;
    }
    const data = await inteligenciaService.getSnapshotDetail(id);
    if (!data) {
      res.status(404).json({ success: false, message: 'Snapshot no encontrado' });
      return;
    }
    res.json({ success: true, data });
  } catch (err: any) {
    console.error('[Inteligencia] getSnapshotDetail error:', err);
    res.status(500).json({ success: false, message: 'Error al obtener detalle' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/inteligencia/snapshots/export - Export Excel de snapshots
// ---------------------------------------------------------------------------
router.get('/export/snapshots', canRead, async (req: Request, res: Response) => {
  try {
    const filtros = {
      crop_id: req.query.crop_id ? parseInt(String(req.query.crop_id)) : undefined,
      region_id: req.query.region_id ? parseInt(String(req.query.region_id)) : undefined,
      category_id: req.query.category_id ? parseInt(String(req.query.category_id)) : undefined,
      source_id: req.query.source_id ? parseInt(String(req.query.source_id)) : undefined,
      limit: 5000,
    };
    const data = await inteligenciaService.getSnapshots(filtros);

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Point Andina Intranet';
    wb.created = new Date();
    const ws = wb.addWorksheet('Snapshots', {
      views: [{ state: 'frozen', ySplit: 1 }],
    });

    ws.columns = [
      { header: 'ID', key: 'snapshot_id', width: 10 },
      { header: 'Fuente', key: 'source_owner', width: 15 },
      { header: 'Documento', key: 'document_title', width: 60 },
      { header: 'Tipo', key: 'document_type', width: 10 },
      { header: 'Cultivo', key: 'crop_name', width: 15 },
      { header: 'Grupo', key: 'crop_group', width: 15 },
      { header: 'Departamento', key: 'department', width: 18 },
      { header: 'Categoría PA', key: 'category_name', width: 20 },
      { header: 'Período', key: 'period_label', width: 15 },
      { header: 'Hectáreas', key: 'hectares', width: 15 },
      { header: 'Producción', key: 'production_value', width: 15 },
      { header: 'Score', key: 'opportunity_score', width: 10 },
      { header: 'Nivel', key: 'opportunity_level', width: 10 },
      { header: 'Fecha Publ.', key: 'publication_date', width: 12 },
      { header: 'Fecha Captura', key: 'capture_date', width: 14 },
      { header: 'URL', key: 'document_url', width: 60 },
      { header: 'Nota', key: 'business_note', width: 80 },
    ];

    // Header style (verde Point Andina)
    const header = ws.getRow(1);
    header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF00A651' } };
    header.alignment = { vertical: 'middle', horizontal: 'center' };
    header.height = 24;

    for (const s of data) {
      ws.addRow({
        snapshot_id: s.snapshot_id,
        source_owner: s.source_owner || s.source_name,
        document_title: s.document_title,
        document_type: s.document_type,
        crop_name: s.crop_name,
        crop_group: s.crop_group,
        department: s.department,
        category_name: s.category_name,
        period_label: s.period_label,
        hectares: s.hectares,
        production_value: s.production_value,
        opportunity_score: s.opportunity_score,
        opportunity_level: s.opportunity_level,
        publication_date: s.publication_date,
        capture_date: s.capture_date,
        document_url: s.document_url,
        business_note: s.business_note,
      });
    }

    // Conditional highlight por oportunidad
    ws.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const levelCell = row.getCell('opportunity_level');
      const level = String(levelCell.value || '');
      if (level === 'Alta') {
        levelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } };
        levelCell.font = { bold: true, color: { argb: 'FF166534' } };
      } else if (level === 'Media') {
        levelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
        levelCell.font = { bold: true, color: { argb: 'FF92400E' } };
      }
    });

    const buffer = await wb.xlsx.writeBuffer();
    const filename = `inteligencia_snapshots_${new Date().toISOString().substring(0, 10)}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(Buffer.from(buffer));
  } catch (err: any) {
    console.error('[Inteligencia] export error:', err);
    res.status(500).json({ success: false, message: 'Error al exportar snapshots' });
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

// ===========================================================================
// FASE 4 - GAP ANALYSIS (cruce con ventas SAP reales)
// ===========================================================================

// GET /api/inteligencia/market-gap - Brecha por departamento
router.get('/market-gap', canRead, async (_req: Request, res: Response) => {
  try {
    const data = await gapService.getMarketGapByDepartment();
    res.json({ success: true, data });
  } catch (err: any) {
    console.error('[Inteligencia] market-gap error:', err);
    res.status(500).json({ success: false, message: err?.message || 'Error en market-gap' });
  }
});

// GET /api/inteligencia/opportunity-by-crop - Oportunidades cultivo x departamento
router.get('/opportunity-by-crop', canRead, async (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? parseInt(String(req.query.limit)) : 50;
    const data = await gapService.getOpportunityByCropRegion(limit);
    res.json({ success: true, data });
  } catch (err: any) {
    console.error('[Inteligencia] opportunity-by-crop error:', err);
    res.status(500).json({ success: false, message: err?.message || 'Error en opportunity-by-crop' });
  }
});

// GET /api/inteligencia/executive-summary - KPIs globales de brecha
router.get('/executive-summary', canRead, async (_req: Request, res: Response) => {
  try {
    const data = await gapService.getExecutiveSummary();
    res.json({ success: true, data });
  } catch (err: any) {
    console.error('[Inteligencia] executive-summary error:', err);
    res.status(500).json({ success: false, message: err?.message || 'Error en executive-summary' });
  }
});

// GET /api/inteligencia/recommendations - Top recomendaciones comerciales
router.get('/recommendations', canRead, async (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? parseInt(String(req.query.limit)) : 10;
    const data = await gapService.getRecommendations(limit);
    res.json({ success: true, data });
  } catch (err: any) {
    console.error('[Inteligencia] recommendations error:', err);
    res.status(500).json({ success: false, message: err?.message || 'Error en recommendations' });
  }
});

// ===========================================================================
// COMEX y Competidores - bloque independiente (icb_cx_*)
// ===========================================================================

const canReadComex = requireModule('comex');

router.get('/comex/meta', canReadComex, async (_req: Request, res: Response) => {
  try {
    const data = await comexService.getMeta();
    res.json({ success: true, data });
  } catch (err: any) {
    console.error('[COMEX] getMeta error:', err);
    res.status(500).json({ success: false, message: 'Error al obtener metadatos COMEX' });
  }
});

router.get('/comex/sources', canReadComex, async (_req: Request, res: Response) => {
  try {
    const data = await comexService.getSources();
    res.json({ success: true, data });
  } catch (err: any) {
    console.error('[COMEX] getSources error:', err);
    res.status(500).json({ success: false, message: 'Error al obtener fuentes COMEX' });
  }
});

router.get('/comex/partidas', canReadComex, async (_req: Request, res: Response) => {
  try {
    const data = await comexService.getPartidas();
    res.json({ success: true, data });
  } catch (err: any) {
    console.error('[COMEX] getPartidas error:', err);
    res.status(500).json({ success: false, message: 'Error al obtener partidas' });
  }
});

router.get('/comex/empresas', canReadComex, async (_req: Request, res: Response) => {
  try {
    const data = await comexService.getEmpresas();
    res.json({ success: true, data });
  } catch (err: any) {
    console.error('[COMEX] getEmpresas error:', err);
    res.status(500).json({ success: false, message: 'Error al obtener empresas' });
  }
});

router.get('/comex/paises', canReadComex, async (_req: Request, res: Response) => {
  try {
    const data = await comexService.getPaises();
    res.json({ success: true, data });
  } catch (err: any) {
    console.error('[COMEX] getPaises error:', err);
    res.status(500).json({ success: false, message: 'Error al obtener paises' });
  }
});

router.get('/comex/importaciones', canReadComex, async (req: Request, res: Response) => {
  try {
    const data = await comexService.getImportaciones({
      empresa_id: req.query.empresa_id ? parseInt(String(req.query.empresa_id)) : undefined,
      partida_id: req.query.partida_id ? parseInt(String(req.query.partida_id)) : undefined,
      pais_id: req.query.pais_id ? parseInt(String(req.query.pais_id)) : undefined,
      year: req.query.year ? parseInt(String(req.query.year)) : undefined,
      month: req.query.month ? parseInt(String(req.query.month)) : undefined,
      familia_pa: req.query.familia_pa ? String(req.query.familia_pa) : undefined,
      limit: req.query.limit ? parseInt(String(req.query.limit)) : 500,
    });
    res.json({ success: true, data });
  } catch (err: any) {
    console.error('[COMEX] getImportaciones error:', err);
    res.status(500).json({ success: false, message: 'Error al obtener importaciones' });
  }
});

router.get('/comex/ranking', canReadComex, async (req: Request, res: Response) => {
  try {
    const year = req.query.year ? parseInt(String(req.query.year)) : undefined;
    const limit = req.query.limit ? parseInt(String(req.query.limit)) : 20;
    const data = await comexService.getRankingCompetidores(year, limit);
    res.json({ success: true, data });
  } catch (err: any) {
    console.error('[COMEX] getRanking error:', err);
    res.status(500).json({ success: false, message: 'Error al obtener ranking' });
  }
});

router.get('/comex/flows', canReadComex, async (req: Request, res: Response) => {
  try {
    const year = req.query.year ? parseInt(String(req.query.year)) : undefined;
    const familia_pa = req.query.familia_pa ? String(req.query.familia_pa) : undefined;
    const data = await comexService.getFlows(year, familia_pa);
    res.json({ success: true, data });
  } catch (err: any) {
    console.error('[COMEX] getFlows error:', err);
    res.status(500).json({ success: false, message: 'Error al obtener flujos' });
  }
});

router.get('/comex/partida-resumen', canReadComex, async (req: Request, res: Response) => {
  try {
    const year = req.query.year ? parseInt(String(req.query.year)) : undefined;
    const data = await comexService.getPartidaResumen(year);
    res.json({ success: true, data });
  } catch (err: any) {
    console.error('[COMEX] getPartidaResumen error:', err);
    res.status(500).json({ success: false, message: 'Error al obtener resumen de partidas' });
  }
});

router.get('/comex/monthly-trend', canReadComex, async (req: Request, res: Response) => {
  try {
    const year = req.query.year ? parseInt(String(req.query.year)) : undefined;
    const data = await comexService.getMonthlyTrend(year);
    res.json({ success: true, data });
  } catch (err: any) {
    console.error('[COMEX] getMonthlyTrend error:', err);
    res.status(500).json({ success: false, message: 'Error al obtener tendencia mensual' });
  }
});

router.get('/comex/by-familia', canReadComex, async (req: Request, res: Response) => {
  try {
    const year = req.query.year ? parseInt(String(req.query.year)) : undefined;
    const data = await comexService.getByFamiliaPa(year);
    res.json({ success: true, data });
  } catch (err: any) {
    console.error('[COMEX] getByFamilia error:', err);
    res.status(500).json({ success: false, message: 'Error al obtener distribucion por familia' });
  }
});

// ===========================================================================
// ENDPOINTS ETL (solo admin)
// ===========================================================================

// GET /api/inteligencia/etl/collectors - Lista de collectors disponibles
router.get('/etl/collectors', requireAdmin, async (_req: Request, res: Response) => {
  try {
    const data = listCollectors();
    const ready = await etlTablesReady();
    res.json({ success: true, data: { collectors: data, tables_ready: ready, scheduler: etlScheduler.status() } });
  } catch (err: any) {
    console.error('[Inteligencia/ETL] listCollectors error:', err);
    res.status(500).json({ success: false, message: 'Error al listar collectors' });
  }
});

// POST /api/inteligencia/etl/run/:sourceCode - Ejecuta un collector específico
router.post('/etl/run/:sourceCode', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { sourceCode } = req.params;
    const ready = await etlTablesReady();
    if (!ready) {
      res.status(400).json({ success: false, message: 'Las tablas icb_* no existen en Azure SQL. Ejecuta primero la migración 002.' });
      return;
    }
    const result = await runOne(sourceCode, `manual_admin_${req.user?.username || 'unknown'}`);
    res.json({ success: true, data: { source_code: sourceCode, result } });
  } catch (err: any) {
    console.error('[Inteligencia/ETL] runOne error:', err);
    res.status(500).json({ success: false, message: err?.message || 'Error al ejecutar collector' });
  }
});

// POST /api/inteligencia/etl/run-all - Ejecuta TODOS los collectors (long running)
router.post('/etl/run-all', requireAdmin, async (req: Request, res: Response) => {
  try {
    const ready = await etlTablesReady();
    if (!ready) {
      res.status(400).json({ success: false, message: 'Las tablas icb_* no existen en Azure SQL. Ejecuta primero la migración 002.' });
      return;
    }
    const results = await runAll(`manual_admin_${req.user?.username || 'unknown'}`);
    const summary = {
      total: results.length,
      success: results.filter(r => r.result.status === 'SUCCESS').length,
      failed: results.filter(r => r.result.status === 'FAILED').length,
      partial: results.filter(r => r.result.status === 'PARTIAL').length,
      inserted: results.reduce((s, r) => s + r.result.recordsInserted, 0),
      updated: results.reduce((s, r) => s + r.result.recordsUpdated, 0),
    };
    res.json({ success: true, data: { summary, results } });
  } catch (err: any) {
    console.error('[Inteligencia/ETL] runAll error:', err);
    res.status(500).json({ success: false, message: err?.message || 'Error al ejecutar ETL' });
  }
});

// POST /api/inteligencia/etl/run-by-frequency/:freq - Ejecuta por frecuencia (daily|weekly|on_demand)
router.post('/etl/run-by-frequency/:freq', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { freq } = req.params;
    if (!['daily', 'weekly', 'on_demand'].includes(freq)) {
      res.status(400).json({ success: false, message: 'Frecuencia inválida. Usa: daily | weekly | on_demand' });
      return;
    }
    const ready = await etlTablesReady();
    if (!ready) {
      res.status(400).json({ success: false, message: 'Las tablas icb_* no existen en Azure SQL.' });
      return;
    }
    const results = await runByFrequency(freq as any, `manual_admin_${req.user?.username || 'unknown'}`);
    res.json({ success: true, data: { frequency: freq, results } });
  } catch (err: any) {
    console.error('[Inteligencia/ETL] runByFrequency error:', err);
    res.status(500).json({ success: false, message: err?.message || 'Error al ejecutar ETL' });
  }
});

// GET /api/inteligencia/etl/scheduler - Estado del scheduler
router.get('/etl/scheduler', requireAdmin, (_req: Request, res: Response) => {
  res.json({ success: true, data: etlScheduler.status() });
});

export default router;
