-- ============================================================
-- 006_senasa_resoluciones.sql
-- Tabla para resoluciones directorales SENASA (gob.pe scraping)
-- Permite distinguir registros nuevos vs extensiones
-- ============================================================

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'icb_dim_senasa_resolucion')
CREATE TABLE dbo.icb_dim_senasa_resolucion (
    resolucion_id    BIGINT IDENTITY(1,1) PRIMARY KEY,
    numero_rd        NVARCHAR(80)  NOT NULL,              -- ej: 00057-2026-MIDAGRI-SENASA-OAD
    titulo           NVARCHAR(500) NOT NULL,
    anio             INT           NULL,
    fecha            DATE          NULL,
    tipo_accion      NVARCHAR(40)  NULL,                  -- NUEVO_REGISTRO | EXTENSION | CANCELACION | OTRO
    productos_pqua   NVARCHAR(MAX) NULL,                  -- JSON array de numeros PQUA mencionados
    pdf_url          NVARCHAR(800) NULL,
    detail_url       NVARCHAR(800) NULL,
    fragmento_texto  NVARCHAR(MAX) NULL,                  -- snippet del cuerpo con la palabra clave
    captured_at      DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ux_rd_numero')
CREATE UNIQUE INDEX ux_rd_numero ON dbo.icb_dim_senasa_resolucion (numero_rd);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_rd_anio')
CREATE INDEX ix_rd_anio ON dbo.icb_dim_senasa_resolucion (anio);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_rd_tipo')
CREATE INDEX ix_rd_tipo ON dbo.icb_dim_senasa_resolucion (tipo_accion);
GO
