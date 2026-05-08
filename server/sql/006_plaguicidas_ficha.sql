-- ============================================================
-- 004_plaguicidas_ficha.sql
-- Tablas para fichas técnicas regulatorias SENASA Perú (SIGIA)
-- ============================================================

-- Maestra: 1 fila por producto registrado en SENASA
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'icb_dim_plaguicida_ficha')
CREATE TABLE dbo.icb_dim_plaguicida_ficha (
    plaguicida_id          BIGINT IDENTITY(1,1) PRIMARY KEY,
    producto_id            NVARCHAR(40)  NOT NULL UNIQUE,    -- ID SIGIA (productoid)
    numero_registro        NVARCHAR(120) NOT NULL,           -- ej: PQUA N° 2607-SENASA
    nombre_comercial       NVARCHAR(300) NOT NULL,
    titular_registro       NVARCHAR(300) NULL,               -- razon_social del titular
    empresa_id             NVARCHAR(40)  NULL,
    ingrediente_activo     NVARCHAR(500) NULL,
    principios_activos     NVARCHAR(500) NULL,
    clase                  NVARCHAR(100) NULL,               -- Fungicida / Insecticida / Herbicida / etc.
    categoria_toxicologica NVARCHAR(80)  NULL,               -- Ligeramente Peligroso / Moderado / etc. (OMS)
    tipo_producto          NVARCHAR(40)  NULL,               -- QUIMICO / BIOLOGICO / etc.
    categoria_pa_id        INT           NULL                -- mapeo a icb_dim_point_category (FK lógica)
        CONSTRAINT fk_plaguicida_ficha_cat REFERENCES dbo.icb_dim_point_category(category_id),
    fecha_captura          DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at             DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

CREATE INDEX IF NOT EXISTS ix_plaguicida_ficha_nombre
    ON dbo.icb_dim_plaguicida_ficha (nombre_comercial);
CREATE INDEX IF NOT EXISTS ix_plaguicida_ficha_clase
    ON dbo.icb_dim_plaguicida_ficha (clase);
CREATE INDEX IF NOT EXISTS ix_plaguicida_ficha_titular
    ON dbo.icb_dim_plaguicida_ficha (titular_registro);
GO

-- Hechos: 1 fila por (producto × cultivo × plaga) con dosis y carencia
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'icb_fact_plaguicida_uso')
CREATE TABLE dbo.icb_fact_plaguicida_uso (
    uso_id                 BIGINT IDENTITY(1,1) PRIMARY KEY,
    plaguicida_id          BIGINT NOT NULL
        CONSTRAINT fk_plag_uso_ficha REFERENCES dbo.icb_dim_plaguicida_ficha(plaguicida_id),
    cultivo_sigia_id       NVARCHAR(20)  NULL,
    cultivo_nombre_comun   NVARCHAR(200) NULL,
    cultivo_nombre_cient   NVARCHAR(200) NULL,
    plaga_sigia_id         NVARCHAR(20)  NULL,
    plaga_nombre_comun     NVARCHAR(300) NULL,
    plaga_nombre_cient     NVARCHAR(300) NULL,
    unidad_medida          NVARCHAR(40)  NULL,
    dosis_hectarea         DECIMAL(18,4) NULL,
    dosis_porcentaje       DECIMAL(18,4) NULL,
    capacidad_cilindro     DECIMAL(18,4) NULL,
    dosis_cilindro         DECIMAL(18,4) NULL,
    limite_max_residuo     DECIMAL(18,4) NULL,
    periodo_carencia_dias  INT           NULL,
    observacion            NVARCHAR(1000) NULL,
    crop_id                INT           NULL                -- mapeo a icb_dim_crop (FK lógica)
        CONSTRAINT fk_plag_uso_crop REFERENCES dbo.icb_dim_crop(crop_id),
    captured_at            DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

CREATE INDEX IF NOT EXISTS ix_plag_uso_plag_id
    ON dbo.icb_fact_plaguicida_uso (plaguicida_id);
CREATE INDEX IF NOT EXISTS ix_plag_uso_cultivo
    ON dbo.icb_fact_plaguicida_uso (cultivo_nombre_comun);
CREATE INDEX IF NOT EXISTS ix_plag_uso_plaga
    ON dbo.icb_fact_plaguicida_uso (plaga_nombre_comun);
GO
