import { Request, Response } from 'express';
import { dbService } from '../services/database.service';

export const ventasController = {
  async getKPIs(req: Request, res: Response) {
    try {
      const data = await dbService.getVentasKPIs(req.query);
      return res.json({ success: true, data });
    } catch (error) {
      console.error('[Ventas] KPIs error:', error);
      return res.status(500).json({ success: false, message: 'Error al obtener KPIs' });
    }
  },

  async getPorCliente(req: Request, res: Response) {
    try {
      const data = await dbService.getVentasPorCliente(req.query);
      return res.json({ success: true, data });
    } catch (error) {
      console.error('[Ventas] PorCliente error:', error);
      return res.status(500).json({ success: false, message: 'Error al obtener ventas por cliente' });
    }
  },

  async getPorIA(req: Request, res: Response) {
    try {
      const data = await dbService.getVentasPorIA(req.query);
      return res.json({ success: true, data });
    } catch (error) {
      console.error('[Ventas] PorIA error:', error);
      return res.status(500).json({ success: false, message: 'Error al obtener ventas por ingrediente activo' });
    }
  },

  async getPorVendedor(req: Request, res: Response) {
    try {
      const data = await dbService.getVentasPorVendedor(req.query);
      return res.json({ success: true, data });
    } catch (error) {
      console.error('[Ventas] PorVendedor error:', error);
      return res.status(500).json({ success: false, message: 'Error al obtener ventas por vendedor' });
    }
  },

  async getPorFamilia(req: Request, res: Response) {
    try {
      const data = await dbService.getVentasPorFamilia(req.query);
      return res.json({ success: true, data });
    } catch (error) {
      console.error('[Ventas] PorFamilia error:', error);
      return res.status(500).json({ success: false, message: 'Error al obtener ventas por familia' });
    }
  },

  async getDiarias(req: Request, res: Response) {
    try {
      const data = await dbService.getVentasDiarias(req.query);
      return res.json({ success: true, data });
    } catch (error) {
      console.error('[Ventas] Diarias error:', error);
      return res.status(500).json({ success: false, message: 'Error al obtener ventas diarias' });
    }
  },

  async getFiltros(_req: Request, res: Response) {
    try {
      const data = await dbService.getFiltrosOpciones();
      return res.json({ success: true, data });
    } catch (error) {
      console.error('[Ventas] Filtros error:', error);
      return res.status(500).json({ success: false, message: 'Error al obtener opciones de filtro' });
    }
  },
};
