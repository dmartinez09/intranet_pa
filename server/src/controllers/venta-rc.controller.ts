import { Request, Response } from 'express';
import { dbService } from '../services/database.service';

export const ventaRCController = {
  async getKPIs(req: Request, res: Response) {
    try {
      const data = await dbService.getVentasKPIs(req.query);
      return res.json({ success: true, data });
    } catch (error) {
      console.error('[VentaRC] KPIs error:', error);
      return res.status(500).json({ success: false, message: 'Error al obtener KPIs' });
    }
  },

  async getPorCliente(req: Request, res: Response) {
    try {
      const data = await dbService.getVentasPorCliente(req.query);
      return res.json({ success: true, data });
    } catch (error) {
      console.error('[VentaRC] PorCliente error:', error);
      return res.status(500).json({ success: false, message: 'Error al obtener ventas por cliente' });
    }
  },

  async getPorIA(req: Request, res: Response) {
    try {
      const data = await dbService.getVentasPorIA(req.query);
      return res.json({ success: true, data });
    } catch (error) {
      console.error('[VentaRC] PorIA error:', error);
      return res.status(500).json({ success: false, message: 'Error al obtener ventas por ingrediente activo' });
    }
  },

  async getPorVendedor(req: Request, res: Response) {
    try {
      const data = await dbService.getVentasPorVendedor(req.query);
      return res.json({ success: true, data });
    } catch (error) {
      console.error('[VentaRC] PorVendedor error:', error);
      return res.status(500).json({ success: false, message: 'Error al obtener ventas por vendedor' });
    }
  },

  async getPorFamilia(req: Request, res: Response) {
    try {
      const data = await dbService.getVentasPorFamilia(req.query);
      return res.json({ success: true, data });
    } catch (error) {
      console.error('[VentaRC] PorFamilia error:', error);
      return res.status(500).json({ success: false, message: 'Error al obtener ventas por familia' });
    }
  },

  async getPorProductoFormulado(req: Request, res: Response) {
    try {
      const data = await dbService.getVentasPorProductoFormulado(req.query);
      return res.json({ success: true, data });
    } catch (error) {
      console.error('[VentaRC] PorProductoFormulado error:', error);
      return res.status(500).json({ success: false, message: 'Error al obtener ventas por producto formulado' });
    }
  },

  async getPorNombreProducto(req: Request, res: Response) {
    try {
      const data = await dbService.getVentasPorNombreProducto(req.query);
      return res.json({ success: true, data });
    } catch (error) {
      console.error('[VentaRC] PorNombreProducto error:', error);
      return res.status(500).json({ success: false, message: 'Error al obtener ventas por nombre producto' });
    }
  },

  async getDiarias(req: Request, res: Response) {
    try {
      const data = await dbService.getVentasDiarias(req.query);
      return res.json({ success: true, data });
    } catch (error) {
      console.error('[VentaRC] Diarias error:', error);
      return res.status(500).json({ success: false, message: 'Error al obtener ventas diarias' });
    }
  },

  async getPorGrupoCliente(req: Request, res: Response) {
    try {
      const data = await dbService.getVentaRCPorGrupoCliente(req.query);
      return res.json({ success: true, data });
    } catch (error) {
      console.error('[VentaRC] PorGrupoCliente error:', error);
      return res.status(500).json({ success: false, message: 'Error al obtener ventas por grupo cliente' });
    }
  },

  async getClientes(req: Request, res: Response) {
    try {
      const grupo_cliente = req.query.grupo_cliente as string | undefined;
      const data = await dbService.getClientesMaestro(grupo_cliente ? { grupo_cliente } : undefined);
      return res.json({ success: true, data });
    } catch (error) {
      console.error('[VentaRC] Clientes error:', error);
      return res.status(500).json({ success: false, message: 'Error al obtener maestro de clientes' });
    }
  },

  async getFiltros(req: Request, res: Response) {
    try {
      // Pasamos todos los filtros activos (incluyendo grupo_cliente) para que el cascading
      // restrinja cada dropdown — en particular Vendedor cae solo al grupo actual via maestro.
      const data = await dbService.getFiltrosOpciones(req.query);
      return res.json({ success: true, data });
    } catch (error) {
      console.error('[VentaRC] Filtros error:', error);
      return res.status(500).json({ success: false, message: 'Error al obtener opciones de filtro' });
    }
  },
};
