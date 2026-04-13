import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import ExcelJS from 'exceljs';
import { authenticateToken } from '../middleware/auth';
import { requireAdmin } from '../middleware/rbac';
import { budgetService, BudgetEntry } from '../services/budget.service';

const router = Router();

// Multer config for Excel uploads (temp folder)
const tmpDir = path.resolve(__dirname, '../../tmp');
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

const excelUpload = multer({
  dest: tmpDir,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['.xlsx', '.xls', '.csv'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Solo se permiten archivos Excel (.xlsx, .xls) o CSV'));
  },
});

// All budget routes require authentication
router.use(authenticateToken);

// ---------------------------------------------------------------------------
// GET /budget/years  —  list available budget years
// ---------------------------------------------------------------------------
router.get('/years', (_req: Request, res: Response) => {
  try {
    const years = budgetService.getBudgetYears();
    res.json({ success: true, data: years });
  } catch (err: any) {
    console.error('[Budget] Error fetching years:', err);
    res.status(500).json({ success: false, message: 'Error al obtener los anios de presupuesto' });
  }
});

// ---------------------------------------------------------------------------
// GET /budget/:year  —  get full budget for a year
// ---------------------------------------------------------------------------
router.get('/:year', (req: Request, res: Response) => {
  try {
    const year = parseInt(req.params.year, 10);
    if (isNaN(year)) {
      res.status(400).json({ success: false, message: 'Anio invalido' });
      return;
    }

    const entries = budgetService.getBudgetByYear(year);
    const uploadedAt = budgetService.getUploadDate(year);

    res.json({
      success: true,
      data: {
        year,
        entries,
        count: entries.length,
        uploaded_at: uploadedAt,
      },
    });
  } catch (err: any) {
    console.error('[Budget] Error fetching budget:', err);
    res.status(500).json({ success: false, message: 'Error al obtener el presupuesto' });
  }
});

// ---------------------------------------------------------------------------
// GET /budget/:year/summary  —  aggregated summary
// ---------------------------------------------------------------------------
router.get('/:year/summary', (req: Request, res: Response) => {
  try {
    const year = parseInt(req.params.year, 10);
    if (isNaN(year)) {
      res.status(400).json({ success: false, message: 'Anio invalido' });
      return;
    }

    const summary = budgetService.getBudgetSummary(year);
    const uploadedAt = budgetService.getUploadDate(year);

    res.json({
      success: true,
      data: {
        year,
        ...summary,
        uploaded_at: uploadedAt,
      },
    });
  } catch (err: any) {
    console.error('[Budget] Error fetching summary:', err);
    res.status(500).json({ success: false, message: 'Error al obtener el resumen de presupuesto' });
  }
});

// ---------------------------------------------------------------------------
// GET /budget/:year/:month  —  budget for specific month
// ---------------------------------------------------------------------------
router.get('/:year/:month', (req: Request, res: Response) => {
  try {
    const year = parseInt(req.params.year, 10);
    const month = parseInt(req.params.month, 10);
    if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
      res.status(400).json({ success: false, message: 'Anio o mes invalido' });
      return;
    }

    const entries = budgetService.getBudgetByMonth(year, month);

    res.json({
      success: true,
      data: {
        year,
        month,
        entries,
        count: entries.length,
      },
    });
  } catch (err: any) {
    console.error('[Budget] Error fetching monthly budget:', err);
    res.status(500).json({ success: false, message: 'Error al obtener el presupuesto mensual' });
  }
});

// ---------------------------------------------------------------------------
// POST /budget/upload  —  upload / replace budget data (Admin only)
// ---------------------------------------------------------------------------
router.post('/upload', requireAdmin, (req: Request, res: Response) => {
  try {
    const { year, entries } = req.body as { year: number; entries: BudgetEntry[] };

    if (!year || !entries || !Array.isArray(entries)) {
      res.status(400).json({
        success: false,
        message: 'Se requiere year (number) y entries (array)',
      });
      return;
    }

    if (entries.length === 0) {
      res.status(400).json({
        success: false,
        message: 'El array de entries no puede estar vacio',
      });
      return;
    }

    // Basic validation of entries
    for (const entry of entries) {
      if (!entry.zona || !entry.rc || !entry.month || entry.monto_usd === undefined) {
        res.status(400).json({
          success: false,
          message: 'Cada entry debe tener zona, rc, month y monto_usd',
        });
        return;
      }
      if (entry.month < 1 || entry.month > 12) {
        res.status(400).json({
          success: false,
          message: `Mes invalido: ${entry.month}. Debe estar entre 1 y 12`,
        });
        return;
      }
    }

    budgetService.saveBudget(year, entries);

    res.json({
      success: true,
      message: `Presupuesto ${year} guardado correctamente`,
      data: {
        year,
        entries_count: entries.length,
        uploaded_at: budgetService.getUploadDate(year),
      },
    });
  } catch (err: any) {
    console.error('[Budget] Error uploading budget:', err);
    res.status(500).json({ success: false, message: 'Error al guardar el presupuesto' });
  }
});

// ---------------------------------------------------------------------------
// POST /budget/upload-excel  —  upload Excel file with budget data (Admin only)
// Supported Excel formats:
//   Pivot: Zona | RC | Ene | Feb | ... | Dic     (month names as columns)
//   Flat:  Zona | RC | Mes | Monto
// The endpoint auto-detects the format.
// ---------------------------------------------------------------------------
router.post('/upload-excel', requireAdmin, excelUpload.single('file'), async (req: Request, res: Response) => {
  const file = req.file;
  if (!file) {
    res.status(400).json({ success: false, message: 'No se envió ningún archivo' });
    return;
  }

  const yearParam = parseInt(req.body.year, 10);
  if (!yearParam || isNaN(yearParam)) {
    fs.unlinkSync(file.path);
    res.status(400).json({ success: false, message: 'Se requiere el parámetro year' });
    return;
  }

  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(file.path);

    const entries: BudgetEntry[] = [];

    // Month name mapping (Spanish)
    const MONTH_MAP: Record<string, number> = {
      ene: 1, enero: 1, jan: 1, january: 1,
      feb: 2, febrero: 2, february: 2,
      mar: 3, marzo: 3, march: 3,
      abr: 4, abril: 4, apr: 4, april: 4,
      may: 5, mayo: 5,
      jun: 6, junio: 6, june: 6,
      jul: 7, julio: 7, july: 7,
      ago: 8, agosto: 8, aug: 8, august: 8,
      sep: 9, sept: 9, septiembre: 9, september: 9,
      oct: 10, octubre: 10, october: 10,
      nov: 11, noviembre: 11, november: 11,
      dic: 12, diciembre: 12, dec: 12, december: 12,
    };

    // Process each worksheet
    workbook.eachSheet((worksheet) => {
      const headerRow = worksheet.getRow(1);
      const headers: string[] = [];
      headerRow.eachCell({ includeEmpty: true }, (_cell, colNumber) => {
        const val = headerRow.getCell(colNumber).value;
        headers[colNumber] = val ? String(val).trim().toLowerCase() : '';
      });

      // Detect column indices
      let zonaCol = -1;
      let rcCol = -1;
      const monthCols: { col: number; month: number }[] = [];

      headers.forEach((h, idx) => {
        if (!h) return;
        // Zona column
        if (h === 'zona' || h === 'zone' || h === 'region') {
          zonaCol = idx;
        }
        // RC column
        if (h === 'rc' || h === 'vendedor' || h === 'representante' || h === 'rep. comercial' ||
            h === 'nombre' || h === 'responsable comercial') {
          rcCol = idx;
        }
        // Try to detect month columns
        const monthNum = MONTH_MAP[h.replace(/[^a-záéíóú]/gi, '').toLowerCase()];
        if (monthNum) {
          monthCols.push({ col: idx, month: monthNum });
        }
      });

      // If we couldn't find zona/rc by exact name, try by position
      if (zonaCol === -1 && rcCol === -1) {
        // Assume first column is zona, second is rc
        zonaCol = 1;
        rcCol = 2;
      } else if (zonaCol === -1) {
        // Try to find it
        for (let i = 1; i <= headers.length; i++) {
          if (i !== rcCol && !monthCols.find(m => m.col === i) && headers[i]) {
            zonaCol = i;
            break;
          }
        }
      } else if (rcCol === -1) {
        for (let i = 1; i <= headers.length; i++) {
          if (i !== zonaCol && !monthCols.find(m => m.col === i) && headers[i]) {
            rcCol = i;
            break;
          }
        }
      }

      // If no month columns were detected, try to find them by number pattern (1-12)
      if (monthCols.length === 0) {
        headers.forEach((h, idx) => {
          const num = parseInt(h, 10);
          if (num >= 1 && num <= 12) {
            monthCols.push({ col: idx, month: num });
          }
        });
      }

      if (monthCols.length === 0 || zonaCol === -1 || rcCol === -1) {
        return; // Skip this sheet — can't parse it
      }

      // Parse data rows
      let lastZona = '';
      worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        if (rowNumber === 1) return; // Skip header

        const zonaRaw = row.getCell(zonaCol).value;
        const rcRaw = row.getCell(rcCol).value;

        const zona = zonaRaw ? String(zonaRaw).trim() : lastZona;
        const rc = rcRaw ? String(rcRaw).trim() : '';

        if (zona) lastZona = zona;
        if (!rc) return; // Skip empty RC rows

        for (const mc of monthCols) {
          const cellValue = row.getCell(mc.col).value;
          let monto = 0;
          if (typeof cellValue === 'number') {
            monto = cellValue;
          } else if (cellValue !== null && cellValue !== undefined) {
            monto = parseFloat(String(cellValue).replace(/[,$\s]/g, '')) || 0;
          }

          entries.push({
            zona,
            rc,
            year: yearParam,
            month: mc.month,
            monto_usd: Math.round(monto * 100) / 100,
          });
        }
      });
    });

    // Clean up temp file
    fs.unlinkSync(file.path);

    if (entries.length === 0) {
      res.status(400).json({
        success: false,
        message: 'No se pudieron extraer datos del archivo. Verifique que el formato tenga columnas: Zona, RC/Vendedor, y meses (Ene, Feb, ... Dic)',
      });
      return;
    }

    // Filter out entries with zero amounts
    const nonZeroEntries = entries.filter(e => e.monto_usd !== 0);

    budgetService.saveBudget(yearParam, nonZeroEntries.length > 0 ? nonZeroEntries : entries);

    const summary = budgetService.getBudgetSummary(yearParam);

    res.json({
      success: true,
      message: `Presupuesto ${yearParam} cargado correctamente`,
      data: {
        year: yearParam,
        entries_count: nonZeroEntries.length > 0 ? nonZeroEntries.length : entries.length,
        total_usd: summary.total,
        zonas: summary.by_zona.length,
        rcs: new Set(entries.map(e => e.rc)).size,
        uploaded_at: budgetService.getUploadDate(yearParam),
      },
    });
  } catch (err: any) {
    // Clean up temp file on error
    if (file && fs.existsSync(file.path)) fs.unlinkSync(file.path);
    console.error('[Budget] Error parsing Excel:', err);
    res.status(500).json({
      success: false,
      message: `Error al procesar el archivo: ${err.message}`,
    });
  }
});

// ---------------------------------------------------------------------------
// DELETE /budget/:year  —  delete budget for a year (Admin only)
// ---------------------------------------------------------------------------
router.delete('/:year', requireAdmin, (req: Request, res: Response) => {
  try {
    const year = parseInt(req.params.year, 10);
    if (isNaN(year)) {
      res.status(400).json({ success: false, message: 'Anio invalido' });
      return;
    }

    const deleted = budgetService.deleteBudget(year);
    if (!deleted) {
      res.status(404).json({
        success: false,
        message: `No se encontro presupuesto para el anio ${year}`,
      });
      return;
    }

    res.json({
      success: true,
      message: `Presupuesto ${year} eliminado correctamente`,
    });
  } catch (err: any) {
    console.error('[Budget] Error deleting budget:', err);
    res.status(500).json({ success: false, message: 'Error al eliminar el presupuesto' });
  }
});

export default router;
