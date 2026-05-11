-- ============================================================
-- 010_tipo_registro_inferido.sql
-- Columnas derivadas:
--   cantidad_etiquetas      = total de etiquetas/resoluciones del producto
--   tipo_registro_inferido  = 'NUEVO' (1 etiqueta) / 'CON EXTENSIONES' (≥2)
--
-- Cada etiqueta SENASA representa una resolución directoral (registro
-- inicial o extensión). Por lo tanto, productos con >1 etiqueta tienen
-- al menos una extensión histórica.
-- ============================================================

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE Name='cantidad_etiquetas' AND Object_ID=Object_ID('dbo.icb_dim_plaguicida_ficha'))
ALTER TABLE dbo.icb_dim_plaguicida_ficha ADD cantidad_etiquetas INT NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE Name='tipo_registro_inferido' AND Object_ID=Object_ID('dbo.icb_dim_plaguicida_ficha'))
ALTER TABLE dbo.icb_dim_plaguicida_ficha ADD tipo_registro_inferido NVARCHAR(30) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='ix_plaguicida_tipo_registro')
CREATE INDEX ix_plaguicida_tipo_registro ON dbo.icb_dim_plaguicida_ficha (tipo_registro_inferido);
GO
