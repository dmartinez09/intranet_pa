-- ============================================================
-- 007_plaguicida_estado_secuencia.sql
-- Campos enriquecidos desde SIGIA PRODUCTO/GETLIST:
--   estado_registro (Vigente / No Vigente / Cancelado / etc.)
--   etiquetas_ids   (CSV de IDs de etiquetas oficiales numeregiarc)
--   secuencia_registro (parte numérica de numero_registro, para ordenar por antigüedad)
-- ============================================================

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE Name='estado_registro' AND Object_ID=Object_ID('dbo.icb_dim_plaguicida_ficha'))
ALTER TABLE dbo.icb_dim_plaguicida_ficha ADD estado_registro NVARCHAR(40) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE Name='etiquetas_ids' AND Object_ID=Object_ID('dbo.icb_dim_plaguicida_ficha'))
ALTER TABLE dbo.icb_dim_plaguicida_ficha ADD etiquetas_ids NVARCHAR(MAX) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE Name='secuencia_registro' AND Object_ID=Object_ID('dbo.icb_dim_plaguicida_ficha'))
ALTER TABLE dbo.icb_dim_plaguicida_ficha ADD secuencia_registro INT NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='ix_plaguicida_estado')
CREATE INDEX ix_plaguicida_estado ON dbo.icb_dim_plaguicida_ficha (estado_registro);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='ix_plaguicida_secuencia')
CREATE INDEX ix_plaguicida_secuencia ON dbo.icb_dim_plaguicida_ficha (secuencia_registro);
GO
