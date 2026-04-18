-- ============================================================
-- MIGRACIÓN 002: Inteligencia Comercial Beta
-- Todas las tablas con prefijo icb_ para no chocar con SAP
-- ============================================================

-- DIMENSIONES
-- ------------------------------------------------------------

IF OBJECT_ID('dbo.icb_dim_source', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.icb_dim_source (
    source_id         INT IDENTITY(1,1) PRIMARY KEY,
    source_code       NVARCHAR(40)  NOT NULL UNIQUE,   -- ej: SIEA_INDEX, MIDAGRI_ANUARIOS
    source_name       NVARCHAR(200) NOT NULL,
    source_url        NVARCHAR(500) NOT NULL,
    source_owner      NVARCHAR(100) NULL,              -- MIDAGRI, INEI, SENASA, POINT_ANDINA
    source_country    NVARCHAR(10)  NOT NULL DEFAULT 'PE',
    source_type       NVARCHAR(50)  NOT NULL,          -- html_index, pdf_document, dataset, catalog_internal
    extraction_method NVARCHAR(50)  NOT NULL,          -- scraping_html, pdf_parse, dataset_download, internal
    active_flag       BIT           NOT NULL DEFAULT 1,
    created_at        DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
  );
END
GO

IF OBJECT_ID('dbo.icb_dim_crop', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.icb_dim_crop (
    crop_id            INT IDENTITY(1,1) PRIMARY KEY,
    crop_code          NVARCHAR(40) NOT NULL UNIQUE,
    crop_name_raw      NVARCHAR(120) NOT NULL,          -- como aparece en la fuente
    crop_name_standard NVARCHAR(120) NOT NULL,          -- nombre normalizado
    crop_group         NVARCHAR(60)  NULL,              -- Hortalizas, Tuberculos, Frutales, Granos, etc.
    active_flag        BIT NOT NULL DEFAULT 1,
    created_at         DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
  );
END
GO

IF OBJECT_ID('dbo.icb_dim_region', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.icb_dim_region (
    region_id     INT IDENTITY(1,1) PRIMARY KEY,
    region_code   NVARCHAR(10)  NOT NULL UNIQUE,      -- UBIGEO o ISO
    country_name  NVARCHAR(80)  NOT NULL DEFAULT 'Perú',
    department    NVARCHAR(80)  NOT NULL,
    province      NVARCHAR(80)  NULL,
    district      NVARCHAR(80)  NULL,
    latitude      DECIMAL(9,6)  NULL,
    longitude     DECIMAL(9,6)  NULL,
    active_flag   BIT NOT NULL DEFAULT 1,
    created_at    DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
  );
END
GO

IF OBJECT_ID('dbo.icb_dim_point_category', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.icb_dim_point_category (
    category_id       INT IDENTITY(1,1) PRIMARY KEY,
    category_code     NVARCHAR(40) NOT NULL UNIQUE,
    category_name     NVARCHAR(120) NOT NULL,
    category_group    NVARCHAR(60) NULL,               -- Protección / Bioestimulantes / Nutrición
    source_reference  NVARCHAR(300) NULL,
    active_flag       BIT NOT NULL DEFAULT 1,
    created_at        DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
  );
END
GO

-- HECHOS
-- ------------------------------------------------------------

IF OBJECT_ID('dbo.icb_fact_agri_market_snapshot', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.icb_fact_agri_market_snapshot (
    snapshot_id       BIGINT IDENTITY(1,1) PRIMARY KEY,
    source_id         INT NOT NULL,
    crop_id           INT NULL,
    region_id         INT NULL,
    category_id       INT NULL,
    document_title    NVARCHAR(400) NULL,
    document_url      NVARCHAR(800) NULL,
    document_type     NVARCHAR(40)  NULL,              -- pdf, html, xlsx, csv, dataset
    period_label      NVARCHAR(60)  NULL,              -- "Campaña 2023-2024", "Anuario 2023", etc.
    publication_date  DATE NULL,
    capture_date      DATE NOT NULL DEFAULT CAST(SYSUTCDATETIME() AS DATE),
    [year]            INT NULL,
    [month]           INT NULL,
    hectares          DECIMAL(18,2) NULL,
    production_value  DECIMAL(18,2) NULL,
    opportunity_score DECIMAL(6,2)  NULL,              -- 0..100
    opportunity_level NVARCHAR(20)  NULL,              -- Alta, Media, Baja
    business_note     NVARCHAR(800) NULL,
    record_hash       NVARCHAR(64)  NULL,              -- sha256 para deduplicar
    created_at        DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT fk_icb_snap_source   FOREIGN KEY (source_id)   REFERENCES dbo.icb_dim_source(source_id),
    CONSTRAINT fk_icb_snap_crop     FOREIGN KEY (crop_id)     REFERENCES dbo.icb_dim_crop(crop_id),
    CONSTRAINT fk_icb_snap_region   FOREIGN KEY (region_id)   REFERENCES dbo.icb_dim_region(region_id),
    CONSTRAINT fk_icb_snap_category FOREIGN KEY (category_id) REFERENCES dbo.icb_dim_point_category(category_id)
  );
  CREATE INDEX ix_icb_snap_source_capture ON dbo.icb_fact_agri_market_snapshot(source_id, capture_date DESC);
  CREATE INDEX ix_icb_snap_crop_region    ON dbo.icb_fact_agri_market_snapshot(crop_id, region_id);
  CREATE UNIQUE INDEX ux_icb_snap_hash    ON dbo.icb_fact_agri_market_snapshot(record_hash) WHERE record_hash IS NOT NULL;
END
GO

IF OBJECT_ID('dbo.icb_fact_geo_resource', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.icb_fact_geo_resource (
    geo_id            BIGINT IDENTITY(1,1) PRIMARY KEY,
    source_id         INT NOT NULL,
    region_id         INT NULL,
    resource_name     NVARCHAR(300) NOT NULL,
    resource_url      NVARCHAR(800) NOT NULL,
    resource_type     NVARCHAR(40)  NULL,              -- shapefile, geojson, vector, tabular
    reference_year    INT NULL,
    capture_date      DATE NOT NULL DEFAULT CAST(SYSUTCDATETIME() AS DATE),
    geometry_metadata NVARCHAR(800) NULL,
    created_at        DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT fk_icb_geo_source FOREIGN KEY (source_id) REFERENCES dbo.icb_dim_source(source_id),
    CONSTRAINT fk_icb_geo_region FOREIGN KEY (region_id) REFERENCES dbo.icb_dim_region(region_id)
  );
END
GO

-- ETL Y STAGING
-- ------------------------------------------------------------

IF OBJECT_ID('dbo.icb_etl_run_log', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.icb_etl_run_log (
    run_id             BIGINT IDENTITY(1,1) PRIMARY KEY,
    pipeline_name      NVARCHAR(100) NOT NULL,
    source_id          INT NULL,
    started_at         DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    finished_at        DATETIME2 NULL,
    status             NVARCHAR(20) NOT NULL DEFAULT 'RUNNING', -- RUNNING, SUCCESS, FAILED, PARTIAL
    records_read       INT NOT NULL DEFAULT 0,
    records_inserted   INT NOT NULL DEFAULT 0,
    records_updated    INT NOT NULL DEFAULT 0,
    records_skipped    INT NOT NULL DEFAULT 0,
    error_message      NVARCHAR(2000) NULL,
    triggered_by       NVARCHAR(60) NULL,               -- cron_nightly, manual_admin, api_trigger
    CONSTRAINT fk_icb_run_source FOREIGN KEY (source_id) REFERENCES dbo.icb_dim_source(source_id)
  );
  CREATE INDEX ix_icb_run_source_started ON dbo.icb_etl_run_log(source_id, started_at DESC);
END
GO

IF OBJECT_ID('dbo.icb_stg_raw_document', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.icb_stg_raw_document (
    raw_id              BIGINT IDENTITY(1,1) PRIMARY KEY,
    source_id           INT NOT NULL,
    source_url          NVARCHAR(800) NOT NULL,
    file_url            NVARCHAR(800) NULL,
    file_type           NVARCHAR(20) NULL,
    raw_payload         NVARCHAR(MAX) NULL,              -- HTML/JSON/CSV snippet
    raw_payload_location NVARCHAR(400) NULL,             -- si se guarda fuera (blob)
    checksum            NVARCHAR(64) NULL,
    captured_at         DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT fk_icb_raw_source FOREIGN KEY (source_id) REFERENCES dbo.icb_dim_source(source_id)
  );
  CREATE INDEX ix_icb_raw_source_captured ON dbo.icb_stg_raw_document(source_id, captured_at DESC);
END
GO

-- ============================================================
-- SEEDS INICIALES
-- ============================================================

-- Fuentes
IF NOT EXISTS (SELECT 1 FROM dbo.icb_dim_source WHERE source_code = 'SIEA_INDEX')
INSERT INTO dbo.icb_dim_source (source_code, source_name, source_url, source_owner, source_type, extraction_method) VALUES
  ('SIEA_INDEX',         'SIEA / MIDAGRI - Informacion Estadistica',          'https://siea.midagri.gob.pe/portal/publicaciones/informacion-estadistica', 'MIDAGRI',      'html_index',      'scraping_html'),
  ('SIEA_SUPERFICIE',    'SIEA / MIDAGRI - Superficie Agricola',              'https://siea.midagri.gob.pe/portal/informativos/superficie-agricola-peruana', 'MIDAGRI',    'html_index',      'scraping_html'),
  ('MIDAGRI_ANUARIOS',   'MIDAGRI - Anuarios de Estadisticas de Produccion',  'https://www.gob.pe/institucion/midagri/colecciones/5149-anuarios-estadisticas-de-produccion-agropecuaria', 'MIDAGRI', 'html_index', 'scraping_html'),
  ('INEI_ENA',           'INEI - Encuesta Nacional Agropecuaria (ENA)',       'https://www.gob.pe/institucion/inei/informes-publicaciones/6879473-productores-agropecuarios-principales-resultados-de-la-encuesta-nacional-agropecuaria-ena-2018-2019-y-2022-2024', 'INEI', 'pdf_document', 'pdf_parse'),
  ('DATOS_ABIERTOS_ENA', 'Datos Abiertos Peru - ENA 2024',                    'https://datosabiertos.gob.pe/dataset/encuesta-nacional-agropecuaria-ena-2024-instituto-nacional-de-estad%C3%ADstica-e-inform%C3%A1tica-inei', 'INEI', 'dataset',        'dataset_download'),
  ('SENASA_ROOT',        'SENASA - Portal institucional',                     'https://www.gob.pe/senasa',                                             'SENASA',       'html_index',      'scraping_html'),
  ('SENASA_REPORTES',    'SENASA - Reportes o Registros',                     'https://www.gob.pe/institucion/senasa/tema/reportes-o-registros',       'SENASA',       'html_index',      'scraping_html'),
  ('SENASA_SIGIA',       'SENASA - SIGIA Consulta Cultivo',                   'https://servicios.senasa.gob.pe/SIGIAWeb/sigia_consulta_cultivo.html',  'SENASA',       'html_index',      'scraping_html'),
  ('POINT_ANDINA_CAT',   'Point Andina - Catalogo de Productos (maestra interna)', 'https://pointandina.pe/productos/',                              'POINT_ANDINA', 'catalog_internal','internal');
GO

-- Cultivos objetivo (MVP)
IF NOT EXISTS (SELECT 1 FROM dbo.icb_dim_crop WHERE crop_code = 'PAPA')
INSERT INTO dbo.icb_dim_crop (crop_code, crop_name_raw, crop_name_standard, crop_group) VALUES
  ('PAPA',     'Papa',     'Papa',     'Tuberculos'),
  ('TOMATE',   'Tomate',   'Tomate',   'Hortalizas'),
  ('MAIZ',     'Maiz',     'Maiz',     'Granos'),
  ('ARROZ',    'Arroz',    'Arroz',    'Granos'),
  ('CEBOLLA',  'Cebolla',  'Cebolla',  'Hortalizas'),
  ('CAFE',     'Cafe',     'Cafe',     'Industriales'),
  ('PALTA',    'Palta',    'Palta',    'Frutales'),
  ('CITRICOS', 'Citricos', 'Citricos', 'Frutales'),
  ('UVA',      'Uva',      'Uva',      'Frutales');
GO

-- Categorias Point Andina (maestra interna - tabla fija por bloqueo 406)
IF NOT EXISTS (SELECT 1 FROM dbo.icb_dim_point_category WHERE category_code = 'FUNGICIDAS')
INSERT INTO dbo.icb_dim_point_category (category_code, category_name, category_group, source_reference) VALUES
  ('FUNGICIDAS',    'Fungicidas',    'Proteccion',     'https://pointandina.pe/productos/'),
  ('INSECTICIDAS',  'Insecticidas',  'Proteccion',     'https://pointandina.pe/productos/'),
  ('HERBICIDAS',    'Herbicidas',    'Proteccion',     'https://pointandina.pe/productos/'),
  ('BIOLOGICOS',    'Biologicos',    'Bioestimulantes','https://pointandina.pe/productos/'),
  ('COADYUVANTES',  'Coadyuvantes',  'Aditivos',       'https://pointandina.pe/productos/'),
  ('ORGANICOS',     'Certificacion Organica', 'Especial', 'https://pointandina.pe/productos/');
GO

-- Departamentos del Peru (25 regiones) con centroides aproximados
IF NOT EXISTS (SELECT 1 FROM dbo.icb_dim_region WHERE region_code = '01')
INSERT INTO dbo.icb_dim_region (region_code, department, latitude, longitude) VALUES
  ('01', 'Amazonas',       -6.2299,  -77.8724),
  ('02', 'Ancash',         -9.5279,  -77.5278),
  ('03', 'Apurimac',       -14.0489, -73.0975),
  ('04', 'Arequipa',       -16.3989, -71.5350),
  ('05', 'Ayacucho',       -13.1588, -74.2232),
  ('06', 'Cajamarca',      -7.1638,  -78.5003),
  ('07', 'Callao',         -12.0500, -77.1181),
  ('08', 'Cusco',          -13.5319, -71.9675),
  ('09', 'Huancavelica',   -12.7867, -74.9739),
  ('10', 'Huanuco',        -9.9306,  -76.2422),
  ('11', 'Ica',            -14.0678, -75.7286),
  ('12', 'Junin',          -12.0500, -75.2167),
  ('13', 'La Libertad',    -8.1167,  -79.0333),
  ('14', 'Lambayeque',     -6.7700,  -79.8400),
  ('15', 'Lima',           -12.0464, -77.0428),
  ('16', 'Loreto',         -3.7491,  -73.2538),
  ('17', 'Madre de Dios',  -12.5933, -69.1891),
  ('18', 'Moquegua',       -17.1938, -70.9350),
  ('19', 'Pasco',          -10.6828, -76.2564),
  ('20', 'Piura',          -5.1945,  -80.6328),
  ('21', 'Puno',           -15.8402, -70.0219),
  ('22', 'San Martin',     -6.4786,  -76.3647),
  ('23', 'Tacna',          -18.0066, -70.2462),
  ('24', 'Tumbes',         -3.5670,  -80.4516),
  ('25', 'Ucayali',        -8.3791,  -74.5539);
GO

PRINT 'Migracion 002 - Inteligencia Comercial Beta completada.';
