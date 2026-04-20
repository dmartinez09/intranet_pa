// ============================================================
// Gap Service - cruza inteligencia comercial (hectáreas potenciales)
// con ventas reales SAP para identificar oportunidades.
// ============================================================

import { getDbPool, sql } from '../config/database';

// Mapeo heurístico de Categoría Point Andina a Familias SAP
// (la Familia SAP puede ser Fungicidas, Insecticidas, etc.)
const CATEGORY_TO_FAMILIES: Record<string, string[]> = {
  FUNGICIDAS:   ['FUNGICIDA', 'FUNGICIDAS'],
  INSECTICIDAS: ['INSECTICIDA', 'INSECTICIDAS', 'ACARICIDA', 'ACARICIDAS'],
  HERBICIDAS:   ['HERBICIDA', 'HERBICIDAS'],
  BIOLOGICOS:   ['BIOLOGICOS', 'BIOLOGICO', 'NUTRICIONAL', 'BIOESTIMULANTES'],
  COADYUVANTES: ['COADYUVANTE', 'COADYUVANTES'],
  ORGANICOS:    ['ORGANICO', 'ORGANICOS'],
};

export interface MarketGapRow {
  departamento: string;
  region_code: string | null;
  hectareas_potenciales: number;
  snapshots_count: number;
  ventas_usd: number;
  transacciones: number;
  ventas_por_hectarea: number;   // USD por hectárea (indicador de penetración)
  penetration_level: 'Baja' | 'Media' | 'Alta';
  opportunity_gap_usd: number;   // estimado = hectáreas × target_usd_per_ha - ventas
}

export interface CropGapRow {
  crop_name: string;
  crop_code: string;
  departamento: string | null;
  region_code: string | null;
  hectareas_potenciales: number;
  ventas_usd: number;
  ventas_por_hectarea: number;
  opportunity_level: 'Alta' | 'Media' | 'Baja';
}

// Helper: verifica si las tablas icb_* y la vista ventas existen
async function dataReady(): Promise<boolean> {
  try {
    const pool = await getDbPool();
    const res = await pool.request().query(`
      SELECT COUNT(*) AS cnt FROM sys.tables
      WHERE name IN ('icb_fact_agri_market_snapshot','icb_dim_region','icb_dim_crop')
    `);
    return (res.recordset[0]?.cnt || 0) >= 3;
  } catch { return false; }
}

class GapService {
  /**
   * Análisis de brecha por departamento:
   * - Suma hectáreas del baseline/snapshots
   * - Suma ventas USD últimos 12 meses de stg_rpt_ventas_detallado
   * - Calcula penetración USD/hectárea
   */
  async getMarketGapByDepartment(): Promise<MarketGapRow[]> {
    const ready = await dataReady();
    if (!ready) return [];

    const pool = await getDbPool();

    // 1. Hectáreas potenciales por departamento (suma snapshots con hectares>0)
    const hectRes = await pool.request().query(`
      SELECT r.region_code, r.department,
        SUM(f.hectares) AS ha_total,
        COUNT(*) AS snap_count
      FROM dbo.icb_fact_agri_market_snapshot f
      INNER JOIN dbo.icb_dim_region r ON f.region_id = r.region_id
      WHERE f.hectares IS NOT NULL AND f.hectares > 0
      GROUP BY r.region_code, r.department
    `);

    // 2. Ventas SAP agregadas por departamento (últimos 12 meses)
    const ventasRes = await pool.request().query(`
      SELECT
        UPPER(LTRIM(RTRIM(Departamento_Despacho))) AS dpto,
        SUM(CAST([Valor_Venta_Dolares_Presentación] AS DECIMAL(18,2))) AS ventas_usd,
        COUNT(*) AS tx
      FROM dbo.stg_rpt_ventas_detallado
      WHERE Pais = 'Peru'
        AND Departamento_Despacho IS NOT NULL
        AND Fecha_Emision >= DATEADD(MONTH, -12, CAST(GETDATE() AS DATE))
      GROUP BY UPPER(LTRIM(RTRIM(Departamento_Despacho)))
    `);

    // Indexa ventas por deptoUpper (normalizado)
    const ventasMap = new Map<string, { ventas_usd: number; tx: number }>();
    for (const v of ventasRes.recordset) {
      ventasMap.set(String(v.dpto || ''), { ventas_usd: Number(v.ventas_usd || 0), tx: v.tx });
    }

    // USD/ha objetivo de referencia (valor típico para fijar gap)
    // 80 USD/ha es aproximación razonable para mercado de agroquímicos en PE
    const TARGET_USD_PER_HA = 80;

    const rows: MarketGapRow[] = [];
    for (const h of hectRes.recordset) {
      const ha = Number(h.ha_total || 0);
      const deptUpper = String(h.department || '').toUpperCase().trim();
      const v = ventasMap.get(deptUpper) || { ventas_usd: 0, tx: 0 };
      const ratio = ha > 0 ? v.ventas_usd / ha : 0;

      const level: 'Baja' | 'Media' | 'Alta' =
        ratio >= TARGET_USD_PER_HA * 0.7 ? 'Alta' :
        ratio >= TARGET_USD_PER_HA * 0.3 ? 'Media' : 'Baja';

      const potential = ha * TARGET_USD_PER_HA;
      const gap = Math.max(0, potential - v.ventas_usd);

      rows.push({
        departamento: h.department,
        region_code: h.region_code,
        hectareas_potenciales: ha,
        snapshots_count: h.snap_count,
        ventas_usd: v.ventas_usd,
        transacciones: v.tx,
        ventas_por_hectarea: Math.round(ratio * 100) / 100,
        penetration_level: level,
        opportunity_gap_usd: Math.round(gap * 100) / 100,
      });
    }

    // Ordena por gap descendente (mayor oportunidad primero)
    rows.sort((a, b) => b.opportunity_gap_usd - a.opportunity_gap_usd);
    return rows;
  }

  /**
   * Análisis por cultivo × departamento: gap a nivel más granular
   */
  async getOpportunityByCropRegion(limit = 50): Promise<CropGapRow[]> {
    const ready = await dataReady();
    if (!ready) return [];

    const pool = await getDbPool();
    const capLimit = Math.min(Math.max(limit, 1), 200);

    // Hectáreas por cultivo + departamento
    const res = await pool.request().query(`
      SELECT TOP ${capLimit}
        c.crop_name_standard AS crop_name,
        c.crop_code,
        r.department,
        r.region_code,
        SUM(f.hectares) AS ha_total
      FROM dbo.icb_fact_agri_market_snapshot f
      INNER JOIN dbo.icb_dim_crop c ON f.crop_id = c.crop_id
      INNER JOIN dbo.icb_dim_region r ON f.region_id = r.region_id
      WHERE f.hectares IS NOT NULL AND f.hectares > 0
      GROUP BY c.crop_name_standard, c.crop_code, r.department, r.region_code
      ORDER BY ha_total DESC
    `);

    // Ventas SAP por departamento (agregado, últimos 12 meses)
    const ventasRes = await pool.request().query(`
      SELECT
        UPPER(LTRIM(RTRIM(Departamento_Despacho))) AS dpto,
        SUM(CAST([Valor_Venta_Dolares_Presentación] AS DECIMAL(18,2))) AS ventas_usd
      FROM dbo.stg_rpt_ventas_detallado
      WHERE Pais = 'Peru'
        AND Departamento_Despacho IS NOT NULL
        AND Fecha_Emision >= DATEADD(MONTH, -12, CAST(GETDATE() AS DATE))
      GROUP BY UPPER(LTRIM(RTRIM(Departamento_Despacho)))
    `);
    const ventasMap = new Map<string, number>();
    for (const v of ventasRes.recordset) {
      ventasMap.set(String(v.dpto || ''), Number(v.ventas_usd || 0));
    }

    const TARGET_USD_PER_HA = 80;
    const rows: CropGapRow[] = res.recordset.map((r: any) => {
      const ha = Number(r.ha_total || 0);
      const deptUpper = String(r.department || '').toUpperCase().trim();
      const ventas = ventasMap.get(deptUpper) || 0;
      // Ratio proporcional: asumimos que las ventas se reparten por hectáreas
      const ratio = ha > 0 ? ventas / ha : 0;

      const level: 'Alta' | 'Media' | 'Baja' =
        ratio < TARGET_USD_PER_HA * 0.3 ? 'Alta' :   // baja penetración = alta oportunidad
        ratio < TARGET_USD_PER_HA * 0.7 ? 'Media' :
        'Baja';

      return {
        crop_name: r.crop_name,
        crop_code: r.crop_code,
        departamento: r.department,
        region_code: r.region_code,
        hectareas_potenciales: ha,
        ventas_usd: Math.round(ventas * 100) / 100,
        ventas_por_hectarea: Math.round(ratio * 100) / 100,
        opportunity_level: level,
      };
    });

    return rows;
  }

  /**
   * Resumen ejecutivo - KPIs globales
   */
  async getExecutiveSummary(): Promise<{
    hectareas_totales: number;
    ventas_12m_usd: number;
    ventas_por_hectarea: number;
    departamentos_con_datos: number;
    departamentos_alta_oportunidad: number;
    gap_total_usd: number;
  }> {
    const gaps = await this.getMarketGapByDepartment();
    const hectareas_totales = gaps.reduce((s, g) => s + g.hectareas_potenciales, 0);
    const ventas_12m_usd = gaps.reduce((s, g) => s + g.ventas_usd, 0);
    const ventas_por_hectarea = hectareas_totales > 0
      ? Math.round((ventas_12m_usd / hectareas_totales) * 100) / 100 : 0;
    const departamentos_con_datos = gaps.length;
    const departamentos_alta_oportunidad = gaps.filter(g => g.penetration_level === 'Baja').length;
    const gap_total_usd = Math.round(gaps.reduce((s, g) => s + g.opportunity_gap_usd, 0) * 100) / 100;

    return {
      hectareas_totales,
      ventas_12m_usd: Math.round(ventas_12m_usd * 100) / 100,
      ventas_por_hectarea,
      departamentos_con_datos,
      departamentos_alta_oportunidad,
      gap_total_usd,
    };
  }

  /**
   * Recomendaciones: Top oportunidades no atendidas ordenadas por gap USD
   */
  async getRecommendations(limit = 10): Promise<Array<{
    departamento: string;
    cultivo: string | null;
    hectareas: number;
    ventas_actuales: number;
    gap_usd: number;
    familia_sugerida: string;
    note: string;
  }>> {
    const cropGaps = await this.getOpportunityByCropRegion(100);
    const TARGET_USD_PER_HA = 80;

    // Filtra oportunidades Alta (ratio < 24 USD/ha)
    const altas = cropGaps.filter(g => g.opportunity_level === 'Alta' && g.hectareas_potenciales > 1000);
    altas.sort((a, b) => b.hectareas_potenciales - a.hectareas_potenciales);

    const CROP_TO_FAMILIA: Record<string, string> = {
      PAPA: 'FUNGICIDAS',
      ARROZ: 'HERBICIDAS',
      MAIZ: 'HERBICIDAS',
      CAFE: 'FUNGICIDAS',
      PALTA: 'INSECTICIDAS',
      UVA: 'FUNGICIDAS',
      CEBOLLA: 'FUNGICIDAS',
      TOMATE: 'INSECTICIDAS',
      CITRICOS: 'INSECTICIDAS',
    };

    return altas.slice(0, limit).map(g => {
      const potential = g.hectareas_potenciales * TARGET_USD_PER_HA;
      const gap_usd = Math.round(Math.max(0, potential - g.ventas_usd) * 100) / 100;
      const familia = CROP_TO_FAMILIA[g.crop_code] || 'FUNGICIDAS';

      return {
        departamento: g.departamento || 'N/D',
        cultivo: g.crop_name,
        hectareas: g.hectareas_potenciales,
        ventas_actuales: g.ventas_usd,
        gap_usd,
        familia_sugerida: familia,
        note: `${g.hectareas_potenciales.toLocaleString('es-PE')} ha de ${g.crop_name} en ${g.departamento} con ventas USD ${g.ventas_por_hectarea}/ha → oportunidad de gap USD ${gap_usd.toLocaleString('es-PE')} en ${familia}.`,
      };
    });
  }
}

export const gapService = new GapService();
export { CATEGORY_TO_FAMILIES };
