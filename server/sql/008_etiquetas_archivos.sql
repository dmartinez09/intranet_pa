-- ============================================================
-- 008_etiquetas_archivos.sql
-- Etiquetas oficiales SENASA (1 fila por archivo PDF)
-- Las etiquetas describen presentaciones del producto (envase)
-- ============================================================

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'icb_dim_plaguicida_etiqueta')
CREATE TABLE dbo.icb_dim_plaguicida_etiqueta (
    etiqueta_id        BIGINT IDENTITY(1,1) PRIMARY KEY,
    plaguicida_id      BIGINT NOT NULL
        CONSTRAINT fk_etiq_plag REFERENCES dbo.icb_dim_plaguicida_ficha(plaguicida_id),
    numeregiarc        NVARCHAR(40)  NOT NULL,
    id_file            NVARCHAR(100) NULL,
    filename           NVARCHAR(400) NULL,
    descripcion        NVARCHAR(400) NULL,
    fecha_registro     DATE          NULL,
    tamano_bytes       BIGINT        NULL,
    extension          NVARCHAR(10)  NULL,
    presentacion       NVARCHAR(200) NULL,        -- inferida del filename (Bolsa 100g, etc.)
    download_url       NVARCHAR(800) NULL,
    captured_at        DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='ix_etiq_plag_id')
CREATE INDEX ix_etiq_plag_id ON dbo.icb_dim_plaguicida_etiqueta (plaguicida_id);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='ix_etiq_numeregiarc')
CREATE INDEX ix_etiq_numeregiarc ON dbo.icb_dim_plaguicida_etiqueta (numeregiarc);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='ix_etiq_fecha')
CREATE INDEX ix_etiq_fecha ON dbo.icb_dim_plaguicida_etiqueta (fecha_registro);
GO
