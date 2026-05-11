-- ============================================================
-- 009_fechas_etiquetas.sql
-- Columnas derivadas de etiquetas para permitir filtros temporales
--   fecha_primera_etiqueta  = MIN(fecha_registro) de sus etiquetas
--   fecha_ultima_etiqueta   = MAX(fecha_registro) de sus etiquetas
--   anio_primer_registro    = YEAR(fecha_primera_etiqueta)
--   anio_ultima_actividad   = YEAR(fecha_ultima_etiqueta)
-- ============================================================

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE Name='fecha_primera_etiqueta' AND Object_ID=Object_ID('dbo.icb_dim_plaguicida_ficha'))
ALTER TABLE dbo.icb_dim_plaguicida_ficha ADD fecha_primera_etiqueta DATE NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE Name='fecha_ultima_etiqueta' AND Object_ID=Object_ID('dbo.icb_dim_plaguicida_ficha'))
ALTER TABLE dbo.icb_dim_plaguicida_ficha ADD fecha_ultima_etiqueta DATE NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE Name='anio_primer_registro' AND Object_ID=Object_ID('dbo.icb_dim_plaguicida_ficha'))
ALTER TABLE dbo.icb_dim_plaguicida_ficha ADD anio_primer_registro INT NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE Name='anio_ultima_actividad' AND Object_ID=Object_ID('dbo.icb_dim_plaguicida_ficha'))
ALTER TABLE dbo.icb_dim_plaguicida_ficha ADD anio_ultima_actividad INT NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='ix_plaguicida_anio_primer')
CREATE INDEX ix_plaguicida_anio_primer ON dbo.icb_dim_plaguicida_ficha (anio_primer_registro);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='ix_plaguicida_anio_ultima')
CREATE INDEX ix_plaguicida_anio_ultima ON dbo.icb_dim_plaguicida_ficha (anio_ultima_actividad);
GO
