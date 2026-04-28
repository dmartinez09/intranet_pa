import { getDbPool, sql } from '../config/database';

export interface VentaUruguayRow {
  PAIS: string | null;
  FACTURADOR: string | null;
  Fecha: Date | null;
  ZONA: string | null;
  VENDEDOR: string | null;
  CLIENTE: string | null;
  PRODUCTO: string | null;
  CANTIDAD_KG_LT: number | null;
  VALOR_UNITARIO: number | null;
  VALOR_TOTAL: number | null;
  UNIDADES_POR_PRESENTACION: number | null;
  EMPAQUE: number | null;
  FECHA2: Date | null;
  IA: string | null;
  CANTIDAD_NEGATIVA: number | null;
  AGROINDUSTRIA_DISTRITO: string | null;
  FOCO: string | null;
}

export const ventasUruguayService = {
  /** Obtiene filas de la vista en un rango de fechas (inclusivo). */
  async getVentaPorRango(desde: string, hasta: string): Promise<VentaUruguayRow[]> {
    const pool = await getDbPool();
    const r = await pool.request()
      .input('desde', sql.Date, desde)
      .input('hasta', sql.Date, hasta)
      .query(`
        SELECT *
        FROM dbo.vw_ventas_diarias_PointAndina_Uruguay
        WHERE Fecha BETWEEN @desde AND @hasta
        ORDER BY Fecha, VENDEDOR, CLIENTE
      `);
    return r.recordset;
  },

  /** Cuenta filas en un rango (para validaciones rápidas). */
  async contarFilas(desde: string, hasta: string): Promise<number> {
    const pool = await getDbPool();
    const r = await pool.request()
      .input('desde', sql.Date, desde)
      .input('hasta', sql.Date, hasta)
      .query(`
        SELECT COUNT(*) AS c
        FROM dbo.vw_ventas_diarias_PointAndina_Uruguay
        WHERE Fecha BETWEEN @desde AND @hasta
      `);
    return r.recordset[0].c;
  },

  /** Rango disponible en la vista. */
  async rangoDisponible(): Promise<{ desde: string | null; hasta: string | null; filas: number }> {
    const pool = await getDbPool();
    const r = await pool.request().query(`
      SELECT
        CONVERT(VARCHAR(10), MIN(Fecha), 23) AS desde,
        CONVERT(VARCHAR(10), MAX(Fecha), 23) AS hasta,
        COUNT(*) AS filas
      FROM dbo.vw_ventas_diarias_PointAndina_Uruguay
    `);
    return r.recordset[0];
  },
};
