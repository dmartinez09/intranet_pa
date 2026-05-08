-- ============================================================
-- 005_plaguicidas_ficha_extra.sql
-- Agrega campos enriquecidos del endpoint GETBYID de SIGIA
-- ============================================================

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE Name='estado_fisico' AND Object_ID=Object_ID('dbo.icb_dim_plaguicida_ficha'))
ALTER TABLE dbo.icb_dim_plaguicida_ficha
  ADD estado_fisico NVARCHAR(40) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE Name='tipo_formulacion' AND Object_ID=Object_ID('dbo.icb_dim_plaguicida_ficha'))
ALTER TABLE dbo.icb_dim_plaguicida_ficha
  ADD tipo_formulacion NVARCHAR(120) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE Name='resolucion_directoral' AND Object_ID=Object_ID('dbo.icb_dim_plaguicida_ficha'))
ALTER TABLE dbo.icb_dim_plaguicida_ficha
  ADD resolucion_directoral NVARCHAR(200) NULL;
GO
