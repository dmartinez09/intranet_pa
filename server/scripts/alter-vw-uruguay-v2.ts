// ============================================================
// ALTER vw_ventas_diarias_PointAndina_Uruguay (versión final)
// - Recupera la columna Origen_Producto (alias: Origen_producto) — EXTERIOR/NACIONAL
// - Renombra el alias GRUPO -> Grupo_Cliente (con valores AGROINDUSTRIAS, DIST. COSTA, etc.)
// ============================================================

import { getDbPool, closeDb } from '../src/config/database';

async function main() {
  const pool = await getDbPool();

  console.log('--- ALTER VIEW vw_ventas_diarias_PointAndina_Uruguay (v2) ---');
  await pool.request().query(`
    ALTER VIEW [dbo].[vw_ventas_diarias_PointAndina_Uruguay] AS
    SELECT
        [Tipo_Venta]                                                          AS TIPO,
        [Pais]                                                                AS PAIS,
        [Facturador]                                                          AS FACTURADOR,
        CAST([Fecha_Emision] AS DATE)                                         AS Fecha,
        [Zona]                                                                AS ZONA,
        [Vendedor]                                                            AS VENDEDOR,
        REPLACE(REPLACE([Razon_Social_Cliente], CHAR(13), ''), CHAR(10), ' ') AS CLIENTE,
        REPLACE(REPLACE([Nombre_Producto], CHAR(13), ''), CHAR(10), ' ')      AS PRODUCTO,
        CAST([Cantidad_KG/LT] AS DECIMAL(18,2))                               AS CANTIDAD_KG_LT,
        CAST([Precio_Venta_USD(KG/LT)] AS DECIMAL(18,2))                      AS VALOR_UNITARIO,
        CAST([Venta_Total_USD(KG/LT)] AS DECIMAL(18,2))                       AS VALOR_TOTAL,
        CAST([Unidades_Presentacion] AS DECIMAL(18,2))                        AS UNIDADES_POR_PRESENTACION,
        CAST([Factor_Conversion] AS DECIMAL(18,2))                            AS EMPAQUE,
        CAST([Fecha_Pedido] AS DATE)                                          AS FECHA2,
        [Origen_Producto]                                                     AS Origen_producto,
        [Ingrediente_Activo]                                                  AS IA,
        CAST([Cantidad_KG/LT] * -1 AS DECIMAL(18,2))                          AS CANTIDAD_NEGATIVA,
        [Grupo_Cliente]                                                       AS Grupo_Cliente,
        [Maestro_Tipo]                                                        AS FOCO
    FROM [dbo].[stg_rpt_ventas_detallado]
    WHERE [Pais] = 'Peru';
  `);
  console.log('✓ Vista actualizada.');

  console.log('\n--- Columnas resultantes ---');
  const cols = await pool.request().query(`
    SELECT COLUMN_NAME, DATA_TYPE, ORDINAL_POSITION
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'vw_ventas_diarias_PointAndina_Uruguay'
    ORDER BY ORDINAL_POSITION
  `);
  console.table(cols.recordset);

  console.log('\n--- Muestra 3 filas ---');
  const sample = await pool.request().query(`
    SELECT TOP 3 Fecha, CLIENTE, Origen_producto, Grupo_Cliente, FOCO
    FROM dbo.vw_ventas_diarias_PointAndina_Uruguay
    ORDER BY Fecha DESC
  `);
  console.table(sample.recordset);

  console.log('\n--- Distinct Grupo_Cliente ---');
  const grupos = await pool.request().query(`
    SELECT Grupo_Cliente, COUNT(*) AS filas
    FROM dbo.vw_ventas_diarias_PointAndina_Uruguay
    GROUP BY Grupo_Cliente
    ORDER BY filas DESC
  `);
  console.table(grupos.recordset);

  console.log('\n--- Distinct Origen_producto ---');
  const origen = await pool.request().query(`
    SELECT Origen_producto, COUNT(*) AS filas
    FROM dbo.vw_ventas_diarias_PointAndina_Uruguay
    GROUP BY Origen_producto
    ORDER BY filas DESC
  `);
  console.table(origen.recordset);

  await closeDb();
}

main().catch(e => { console.error(e); process.exit(1); });
