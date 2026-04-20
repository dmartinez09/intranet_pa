-- ============================================================
-- MIGRACIÓN 003: Fuente "Baseline Peru Crops" para datos curados
-- Datos representativos de superficie agrícola por cultivo y depto
-- Fuente: MINAGRI/SIEA anuarios recientes (datos públicos)
-- ============================================================

IF NOT EXISTS (SELECT 1 FROM dbo.icb_dim_source WHERE source_code = 'BASELINE_PE_CROPS')
INSERT INTO dbo.icb_dim_source
  (source_code, source_name, source_url, source_owner, source_type, extraction_method)
VALUES
  ('BASELINE_PE_CROPS',
   'Baseline Peru - Superficie agrícola por cultivo (curado)',
   'https://siea.midagri.gob.pe/portal/informativos/superficie-agricola-peruana',
   'MIDAGRI',
   'catalog_internal',
   'internal');
GO

PRINT 'Migración 003 - Fuente BASELINE_PE_CROPS registrada.';
