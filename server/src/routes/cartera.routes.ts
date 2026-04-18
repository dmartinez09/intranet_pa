import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { requireModule } from '../middleware/rbac';
import { dbService } from '../services/database.service';
import ExcelJS from 'exceljs';

const router = Router();

router.use(authenticateToken, requireModule('cartera'));

router.get('/kpis', async (_req, res) => {
  try {
    const data = await dbService.getCarteraKPIs();
    return res.json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Error al obtener KPIs de cartera' });
  }
});

router.get('/por-edad', async (_req, res) => {
  try {
    const data = await dbService.getCarteraPorEdad();
    return res.json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Error al obtener cartera por edad' });
  }
});

router.get('/por-vendedor', async (_req, res) => {
  try {
    const data = await dbService.getCarteraPorVendedor();
    return res.json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Error al obtener cartera por vendedor' });
  }
});

router.get('/transacciones', async (_req, res) => {
  try {
    const data = await dbService.getCarteraTransacciones();
    return res.json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Error al obtener transacciones' });
  }
});

router.get('/meta', async (_req, res) => {
  try {
    const data = await dbService.getCarteraMeta();
    return res.json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Error al obtener meta de cartera' });
  }
});

router.get('/letras-no-aceptadas', async (_req, res) => {
  try {
    const data = await dbService.getLetrasNoAceptadas();
    return res.json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Error al obtener letras no aceptadas' });
  }
});

router.get('/linea-creditos', async (_req, res) => {
  try {
    const data = await dbService.getLineaCreditos();
    return res.json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Error al obtener líneas de crédito' });
  }
});

// ============================================================
// ESTADO DE CUENTA F. CORTE
// ============================================================

// Get filter options
router.get('/estado-cuenta/filtros', async (_req, res) => {
  try {
    const data = await dbService.getEstadoCuentaFiltros();
    return res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching estado cuenta filtros:', error);
    return res.status(500).json({ success: false, message: 'Error al obtener filtros' });
  }
});

// Get summary KPIs
router.get('/estado-cuenta/resumen', async (_req, res) => {
  try {
    const data = await dbService.getEstadoCuentaResumen();
    return res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching estado cuenta resumen:', error);
    return res.status(500).json({ success: false, message: 'Error al obtener resumen' });
  }
});

// Get data with filters
router.get('/estado-cuenta', async (req, res) => {
  try {
    const filtros = {
      vendedor: req.query.vendedor as string | undefined,
      cliente: req.query.cliente as string | undefined,
      tipoDocumento: req.query.tipoDocumento as string | undefined,
      moneda: req.query.moneda as string | undefined,
      numero: req.query.numero as string | undefined,
    };
    const data = await dbService.getEstadoCuenta(filtros);
    return res.json({ success: true, data, total: data.length });
  } catch (error) {
    console.error('Error fetching estado cuenta:', error);
    return res.status(500).json({ success: false, message: 'Error al obtener estado de cuenta' });
  }
});

// Export to Excel
router.get('/estado-cuenta/export', async (req, res) => {
  try {
    const filtros = {
      vendedor: req.query.vendedor as string | undefined,
      cliente: req.query.cliente as string | undefined,
      tipoDocumento: req.query.tipoDocumento as string | undefined,
      moneda: req.query.moneda as string | undefined,
      numero: req.query.numero as string | undefined,
    };
    const data = await dbService.getEstadoCuenta(filtros);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Point Andina - Intranet';
    const sheet = workbook.addWorksheet('Estado de Cuenta');

    // Title row
    const fechaCorte = data[0]?.fecha_corte
      ? new Date(data[0].fecha_corte).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0];
    sheet.mergeCells('A1:N1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = `POINT ANDINA S.A. - Estado de Cuenta al ${fechaCorte}`;
    titleCell.font = { size: 14, bold: true, color: { argb: 'FF00A651' } };
    titleCell.alignment = { horizontal: 'center' };

    // Headers
    const columns = [
      { header: 'Cliente', key: 'cli_nombre', width: 35 },
      { header: 'RUC', key: 'cli_ruc', width: 15 },
      { header: 'Vendedor', key: 'cli_vendedor', width: 30 },
      { header: 'Cond. Pago', key: 'cli_vencimiento', width: 22 },
      { header: 'Línea Crédito', key: 'cli_linea_credito', width: 15 },
      { header: 'Tipo Doc', key: 'td', width: 10 },
      { header: 'Número', key: 'numero', width: 15 },
      { header: 'F. Emisión', key: 'f_emision', width: 14 },
      { header: 'F. Vencimiento', key: 'f_vcto', width: 14 },
      { header: 'Días', key: 'dias', width: 8 },
      { header: 'Moneda', key: 'moneda', width: 10 },
      { header: 'Importe Original', key: 'importe_original', width: 18 },
      { header: 'A Cuenta', key: 'a_cuenta', width: 15 },
      { header: 'Saldo', key: 'saldo', width: 18 },
    ];

    // Set columns starting at row 3
    sheet.getRow(3).values = columns.map(c => c.header);
    columns.forEach((col, i) => {
      sheet.getColumn(i + 1).width = col.width;
    });

    // Style header row
    const headerRow = sheet.getRow(3);
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF00A651' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin' }, bottom: { style: 'thin' },
        left: { style: 'thin' }, right: { style: 'thin' },
      };
    });

    // Data rows
    data.forEach((row: any, idx: number) => {
      const r = sheet.getRow(idx + 4);
      r.values = columns.map(col => {
        const val = row[col.key];
        if (col.key === 'f_emision' || col.key === 'f_vcto') {
          return val ? new Date(val).toISOString().split('T')[0] : '';
        }
        return val ?? '';
      });

      // Number formatting
      const numCols = ['cli_linea_credito', 'importe_original', 'a_cuenta', 'saldo'];
      columns.forEach((col, ci) => {
        const cell = r.getCell(ci + 1);
        if (numCols.includes(col.key)) {
          cell.numFmt = '#,##0.00';
        }
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFD0D0D0' } },
          bottom: { style: 'thin', color: { argb: 'FFD0D0D0' } },
          left: { style: 'thin', color: { argb: 'FFD0D0D0' } },
          right: { style: 'thin', color: { argb: 'FFD0D0D0' } },
        };
      });

      // Highlight overdue rows
      if (row.dias < 0) {
        r.eachCell((cell) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF0F0' } };
        });
      }
    });

    // Auto filter
    sheet.autoFilter = { from: 'A3', to: `N${data.length + 3}` };

    // Freeze panes
    sheet.views = [{ state: 'frozen', ySplit: 3 }];

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="Estado_Cuenta_${fechaCorte}.xlsx"`);

    await workbook.xlsx.write(res);
    return res.end();
  } catch (error) {
    console.error('Error exporting estado cuenta:', error);
    return res.status(500).json({ success: false, message: 'Error al exportar' });
  }
});

// Trigger Data Factory pipeline
router.post('/estado-cuenta/generar', async (req, res) => {
  try {
    const { fechaCorte } = req.body;
    if (!fechaCorte) {
      return res.status(400).json({ success: false, message: 'Fecha de corte requerida' });
    }

    // Dynamic import to avoid issues if ADF not configured
    const { adfService } = await import('../services/datafactory.service');
    const runId = await adfService.triggerPipeline(fechaCorte);
    return res.json({ success: true, runId });
  } catch (error: any) {
    console.error('Error triggering pipeline:', error);
    return res.status(500).json({ success: false, message: error.message || 'Error al ejecutar pipeline' });
  }
});

// Check pipeline run status
router.get('/estado-cuenta/pipeline-status/:runId', async (req, res) => {
  try {
    const { adfService } = await import('../services/datafactory.service');
    const status = await adfService.getPipelineStatus(req.params.runId);
    return res.json({ success: true, ...status });
  } catch (error: any) {
    console.error('Error checking pipeline status:', error);
    return res.status(500).json({ success: false, message: error.message || 'Error al consultar estado' });
  }
});

export default router;
