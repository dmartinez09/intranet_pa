import { getDbPool, closeDb } from '../src/config/database';

async function main() {
  const pool = await getDbPool();

  console.log('▸ ALTER VIEW vw_ventas_diarias_PointAndina_Uruguay');
  console.log('   - Quitar filtro MONTH/YEAR (parametrizado desde intranet)');
  console.log('   - Cambiar filtro Pais: Uruguay → Peru');
  console.log('   - Mantener las 17 columnas transformadas\n');

  const ddl = `
ALTER VIEW [dbo].[vw_ventas_diarias_PointAndina_Uruguay] AS
SELECT
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
    [Ingrediente_Activo]                                                  AS IA,
    CAST([Cantidad_KG/LT] * -1 AS DECIMAL(18,2))                          AS CANTIDAD_NEGATIVA,
    [Distrito_Despacho]                                                   AS AGROINDUSTRIA_DISTRITO,
    [Zona]                                                                AS FOCO
FROM [dbo].[stg_rpt_ventas_detallado]
WHERE [Pais] = 'Peru';
  `;

  await pool.request().batch(ddl);
  console.log('✓ Vista actualizada\n');

  // Validar
  const r = await pool.request().query(`
    SELECT COUNT(*) AS filas, MIN(Fecha) AS desde, MAX(Fecha) AS hasta
    FROM dbo.vw_ventas_diarias_PointAndina_Uruguay
  `);
  const m = r.recordset[0];
  console.log(`▸ Validación:`);
  console.log(`   Filas:  ${m.filas.toLocaleString('es-PE')}`);
  console.log(`   Desde:  ${m.desde}`);
  console.log(`   Hasta:  ${m.hasta}`);

  await closeDb();
}

main().catch(e => { console.error(e); process.exit(1); });
