-- ============================================================
-- MIGRACIÓN 004: COMEX y Competidores
-- Bloque: Inteligencia Comercial Beta / Competidores
-- Tablas con prefijo icb_cx_ para el dominio de comercio exterior
-- ============================================================

-- DIMENSIONES
-- ------------------------------------------------------------

-- Partidas arancelarias (sistema armonizado)
IF OBJECT_ID('dbo.icb_cx_dim_partida', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.icb_cx_dim_partida (
    partida_id        INT IDENTITY(1,1) PRIMARY KEY,
    hs_code           NVARCHAR(20)  NOT NULL UNIQUE,          -- ej: 3808.92.30.00
    hs_chapter        NVARCHAR(4)   NOT NULL,                 -- ej: 3808
    descripcion       NVARCHAR(400) NOT NULL,
    familia_pa        NVARCHAR(40)  NULL,                     -- FUNGICIDAS, INSECTICIDAS, HERBICIDAS, NUTRICIONALES, OTROS
    tipo_grupo        NVARCHAR(40)  NULL,                     -- Plaguicidas / Fertilizantes / Biologicos / Precursores
    active_flag       BIT NOT NULL DEFAULT 1,
    created_at        DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
  );
  CREATE INDEX ix_icb_cx_partida_chapter ON dbo.icb_cx_dim_partida(hs_chapter);
  CREATE INDEX ix_icb_cx_partida_familia ON dbo.icb_cx_dim_partida(familia_pa);
END
GO

-- Empresas (importadores / exportadores / competidores)
IF OBJECT_ID('dbo.icb_cx_dim_empresa', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.icb_cx_dim_empresa (
    empresa_id        INT IDENTITY(1,1) PRIMARY KEY,
    ruc               NVARCHAR(20)  NULL,
    razon_social      NVARCHAR(200) NOT NULL,
    nombre_comercial  NVARCHAR(200) NULL,
    pais_origen       NVARCHAR(80)  NULL DEFAULT 'Peru',
    es_competidor     BIT NOT NULL DEFAULT 0,                 -- 1 = competidor directo identificado
    es_point_andina   BIT NOT NULL DEFAULT 0,                 -- reservado para cruce futuro, NO se usa ahora
    tipo_empresa      NVARCHAR(60)  NULL,                     -- Multinacional / Nacional / Distribuidor / Formulador
    sitio_web         NVARCHAR(300) NULL,
    active_flag       BIT NOT NULL DEFAULT 1,
    created_at        DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
  );
  CREATE INDEX ix_icb_cx_empresa_competidor ON dbo.icb_cx_dim_empresa(es_competidor);
  CREATE INDEX ix_icb_cx_empresa_ruc        ON dbo.icb_cx_dim_empresa(ruc);
END
GO

-- Países de origen
IF OBJECT_ID('dbo.icb_cx_dim_pais', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.icb_cx_dim_pais (
    pais_id        INT IDENTITY(1,1) PRIMARY KEY,
    iso2           NVARCHAR(2)  NOT NULL UNIQUE,
    iso3           NVARCHAR(3)  NULL,
    nombre         NVARCHAR(80) NOT NULL,
    continente     NVARCHAR(40) NULL,
    latitude       DECIMAL(9,6) NULL,
    longitude      DECIMAL(9,6) NULL,
    active_flag    BIT NOT NULL DEFAULT 1
  );
END
GO

-- Productos / ingredientes activos reconocidos (opcional, se llena con el ETL)
IF OBJECT_ID('dbo.icb_cx_dim_producto', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.icb_cx_dim_producto (
    producto_id         INT IDENTITY(1,1) PRIMARY KEY,
    nombre_comercial    NVARCHAR(200) NULL,
    ingrediente_activo  NVARCHAR(200) NULL,
    familia_pa          NVARCHAR(40)  NULL,
    concentracion       NVARCHAR(60)  NULL,
    unidad              NVARCHAR(20)  NULL,
    active_flag         BIT NOT NULL DEFAULT 1,
    created_at          DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
  );
END
GO

-- HECHOS
-- ------------------------------------------------------------

-- Importaciones: una fila por operación aduanera o agregado mensual
IF OBJECT_ID('dbo.icb_cx_fact_importacion', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.icb_cx_fact_importacion (
    import_id         BIGINT IDENTITY(1,1) PRIMARY KEY,
    source_id         INT NOT NULL,                            -- FK a icb_dim_source
    empresa_id        INT NULL,
    partida_id        INT NULL,
    pais_origen_id    INT NULL,
    producto_id       INT NULL,
    periodo_year      INT NOT NULL,
    periodo_month     INT NULL,                                -- NULL si el snapshot es anual
    fecha_dua         DATE NULL,                               -- fecha DUA si es operación específica
    dua_numero        NVARCHAR(60) NULL,
    cantidad_kg       DECIMAL(18,2) NULL,
    valor_cif_usd     DECIMAL(18,2) NULL,
    valor_fob_usd     DECIMAL(18,2) NULL,
    flete_usd         DECIMAL(18,2) NULL,
    seguro_usd        DECIMAL(18,2) NULL,
    ad_valorem_usd    DECIMAL(18,2) NULL,
    puerto            NVARCHAR(100) NULL,
    notas             NVARCHAR(800) NULL,
    record_hash       NVARCHAR(64) NULL,                       -- sha256 dedup
    created_at        DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT fk_icb_cx_imp_source  FOREIGN KEY (source_id)      REFERENCES dbo.icb_dim_source(source_id),
    CONSTRAINT fk_icb_cx_imp_emp     FOREIGN KEY (empresa_id)     REFERENCES dbo.icb_cx_dim_empresa(empresa_id),
    CONSTRAINT fk_icb_cx_imp_part    FOREIGN KEY (partida_id)     REFERENCES dbo.icb_cx_dim_partida(partida_id),
    CONSTRAINT fk_icb_cx_imp_pais    FOREIGN KEY (pais_origen_id) REFERENCES dbo.icb_cx_dim_pais(pais_id),
    CONSTRAINT fk_icb_cx_imp_prod    FOREIGN KEY (producto_id)    REFERENCES dbo.icb_cx_dim_producto(producto_id)
  );
  CREATE INDEX ix_icb_cx_imp_period   ON dbo.icb_cx_fact_importacion(periodo_year, periodo_month);
  CREATE INDEX ix_icb_cx_imp_emp      ON dbo.icb_cx_fact_importacion(empresa_id);
  CREATE INDEX ix_icb_cx_imp_part     ON dbo.icb_cx_fact_importacion(partida_id);
  CREATE INDEX ix_icb_cx_imp_pais     ON dbo.icb_cx_fact_importacion(pais_origen_id);
  CREATE UNIQUE INDEX ux_icb_cx_imp_hash ON dbo.icb_cx_fact_importacion(record_hash) WHERE record_hash IS NOT NULL;
END
GO

-- Exportaciones (para completar el panorama)
IF OBJECT_ID('dbo.icb_cx_fact_exportacion', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.icb_cx_fact_exportacion (
    export_id         BIGINT IDENTITY(1,1) PRIMARY KEY,
    source_id         INT NOT NULL,
    empresa_id        INT NULL,
    partida_id        INT NULL,
    pais_destino_id   INT NULL,
    producto_id       INT NULL,
    periodo_year      INT NOT NULL,
    periodo_month     INT NULL,
    cantidad_kg       DECIMAL(18,2) NULL,
    valor_fob_usd     DECIMAL(18,2) NULL,
    record_hash       NVARCHAR(64) NULL,
    created_at        DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT fk_icb_cx_exp_source FOREIGN KEY (source_id)      REFERENCES dbo.icb_dim_source(source_id),
    CONSTRAINT fk_icb_cx_exp_emp    FOREIGN KEY (empresa_id)     REFERENCES dbo.icb_cx_dim_empresa(empresa_id),
    CONSTRAINT fk_icb_cx_exp_part   FOREIGN KEY (partida_id)     REFERENCES dbo.icb_cx_dim_partida(partida_id),
    CONSTRAINT fk_icb_cx_exp_pais   FOREIGN KEY (pais_destino_id) REFERENCES dbo.icb_cx_dim_pais(pais_id)
  );
  CREATE INDEX ix_icb_cx_exp_period ON dbo.icb_cx_fact_exportacion(periodo_year, periodo_month);
  CREATE UNIQUE INDEX ux_icb_cx_exp_hash ON dbo.icb_cx_fact_exportacion(record_hash) WHERE record_hash IS NOT NULL;
END
GO

-- ============================================================
-- SEEDS INICIALES
-- ============================================================

-- Nuevas fuentes en icb_dim_source
IF NOT EXISTS (SELECT 1 FROM dbo.icb_dim_source WHERE source_code = 'SUNAT_TRANSPARENCIA')
INSERT INTO dbo.icb_dim_source (source_code, source_name, source_url, source_owner, source_type, extraction_method) VALUES
  ('SUNAT_TRANSPARENCIA', 'SUNAT - Transparencia Aduanera',                 'https://www.sunat.gob.pe/operatividadaduanera/',                                                            'SUNAT',    'html_index',        'scraping_html'),
  ('SUNAT_ADUANET',       'SUNAT - Aduanet Consultas',                      'https://aduanet.gob.pe/',                                                                                  'SUNAT',    'html_index',        'scraping_html'),
  ('BCR_COMEX',           'BCR / BCRP - Series de Comercio Exterior',       'https://estadisticas.bcrp.gob.pe/estadisticas/series/mensuales/comercio-exterior',                         'BCRP',     'dataset',           'api_json'),
  ('MINCETUR_ESTADISTICAS','MINCETUR - Estadisticas de Comercio Exterior',  'https://www.gob.pe/mincetur',                                                                              'MINCETUR', 'html_index',        'scraping_html'),
  ('INEI_COMEX',          'INEI - Estadisticas de Comercio Exterior',       'https://www.inei.gob.pe/estadisticas/indice-tematico/foreign-trade/',                                      'INEI',     'html_index',        'scraping_html'),
  ('DATOS_ABIERTOS_COMEX','Datos Abiertos Peru - Comercio Exterior',        'https://www.datosabiertos.gob.pe/search/type/dataset?query=comercio+exterior',                             'PCM',      'dataset',           'dataset_download'),
  ('ADEX_ESTADISTICAS',   'ADEX - Asociacion de Exportadores',              'https://www.adexperu.org.pe/',                                                                             'ADEX',     'html_index',        'scraping_html'),
  ('CCL_COMEX',           'CCL - Camara de Comercio de Lima',               'https://www.camaralima.org.pe/',                                                                           'CCL',      'html_index',        'scraping_html'),
  ('SENASA_PLAGUICIDAS',  'SENASA - Registro de plaguicidas',               'https://servicios.senasa.gob.pe/SIGIAWeb/',                                                                'SENASA',   'html_index',        'scraping_html'),
  ('BASELINE_PE_COMEX',   'Baseline Peru COMEX - Importaciones (curado)',   'https://www.sunat.gob.pe/operatividadaduanera/',                                                           'PA',       'catalog_internal',  'internal');
GO

-- Partidas arancelarias principales (capitulos 3808, 3105, 3002, 2930)
IF NOT EXISTS (SELECT 1 FROM dbo.icb_cx_dim_partida WHERE hs_code = '3808.91.10')
INSERT INTO dbo.icb_cx_dim_partida (hs_code, hs_chapter, descripcion, familia_pa, tipo_grupo) VALUES
  -- 3808.91 Insecticidas
  ('3808.91.10', '3808', 'Insecticidas a base de piretroides',                                  'INSECTICIDAS', 'Plaguicidas'),
  ('3808.91.20', '3808', 'Insecticidas a base de hidrocarburos clorados',                       'INSECTICIDAS', 'Plaguicidas'),
  ('3808.91.30', '3808', 'Insecticidas a base de carbamatos',                                   'INSECTICIDAS', 'Plaguicidas'),
  ('3808.91.40', '3808', 'Insecticidas a base de organofosforados',                             'INSECTICIDAS', 'Plaguicidas'),
  ('3808.91.90', '3808', 'Los demas insecticidas',                                              'INSECTICIDAS', 'Plaguicidas'),
  -- 3808.92 Fungicidas
  ('3808.92.11', '3808', 'Fungicidas a base de compuestos de cobre',                            'FUNGICIDAS',   'Plaguicidas'),
  ('3808.92.19', '3808', 'Los demas fungicidas inorganicos',                                    'FUNGICIDAS',   'Plaguicidas'),
  ('3808.92.20', '3808', 'Fungicidas a base de diazoles o triazoles',                           'FUNGICIDAS',   'Plaguicidas'),
  ('3808.92.30', '3808', 'Fungicidas a base de diazinas o morfolinas',                          'FUNGICIDAS',   'Plaguicidas'),
  ('3808.92.90', '3808', 'Los demas fungicidas organicos',                                      'FUNGICIDAS',   'Plaguicidas'),
  -- 3808.93 Herbicidas
  ('3808.93.11', '3808', 'Herbicidas a base de hormonas',                                       'HERBICIDAS',   'Plaguicidas'),
  ('3808.93.19', '3808', 'Los demas herbicidas a base de carbamatos',                           'HERBICIDAS',   'Plaguicidas'),
  ('3808.93.21', '3808', 'Herbicidas a base de dinitroanilinas',                                'HERBICIDAS',   'Plaguicidas'),
  ('3808.93.29', '3808', 'Herbicidas a base de ureas',                                          'HERBICIDAS',   'Plaguicidas'),
  ('3808.93.90', '3808', 'Los demas herbicidas',                                                'HERBICIDAS',   'Plaguicidas'),
  -- 3808.94 Desinfectantes
  ('3808.94.10', '3808', 'Desinfectantes a base de sales de amonio cuaternario',                'COADYUVANTES', 'Plaguicidas'),
  ('3808.94.20', '3808', 'Desinfectantes a base de compuestos halogenados',                     'COADYUVANTES', 'Plaguicidas'),
  ('3808.94.90', '3808', 'Los demas desinfectantes',                                            'COADYUVANTES', 'Plaguicidas'),
  -- 3808.99 Otros plaguicidas y reguladores
  ('3808.99.11', '3808', 'Reguladores de crecimiento de plantas',                               'BIOLOGICOS',   'Plaguicidas'),
  ('3808.99.91', '3808', 'Otros productos con fines agricolas',                                 'OTROS',        'Plaguicidas'),
  -- 3105 Abonos con N-P-K
  ('3105.10.00', '3105', 'Abonos en tabletas o formas similares (envase < 10 kg)',              'NUTRICIONALES', 'Fertilizantes'),
  ('3105.20.00', '3105', 'Abonos minerales NPK (N, P y K)',                                     'NUTRICIONALES', 'Fertilizantes'),
  ('3105.30.00', '3105', 'Hidrogenoortofosfato de diamonio (DAP)',                              'NUTRICIONALES', 'Fertilizantes'),
  ('3105.40.00', '3105', 'Dihidrogenoortofosfato de amonio (MAP)',                              'NUTRICIONALES', 'Fertilizantes'),
  ('3105.51.00', '3105', 'Nitrato potasico',                                                    'NUTRICIONALES', 'Fertilizantes'),
  ('3105.59.00', '3105', 'Los demas abonos con nitratos y fosfatos',                            'NUTRICIONALES', 'Fertilizantes'),
  ('3105.60.00', '3105', 'Abonos minerales con PK',                                             'NUTRICIONALES', 'Fertilizantes'),
  ('3105.90.00', '3105', 'Los demas abonos',                                                    'NUTRICIONALES', 'Fertilizantes'),
  -- 3002 Productos biologicos (subset)
  ('3002.90.00', '3002', 'Los demas productos biologicos (uso veterinario/agricola)',           'BIOLOGICOS',   'Biologicos'),
  -- 2930 Tiocompuestos (precursores)
  ('2930.30.00', '2930', 'Tioureas y compuestos relacionados',                                  'OTROS',        'Precursores'),
  ('2930.80.00', '2930', 'Aldicarb, captafol y metamidofos',                                    'INSECTICIDAS', 'Precursores'),
  ('2930.90.90', '2930', 'Los demas tiocompuestos organicos',                                   'OTROS',        'Precursores');
GO

-- Paises principales de origen en importaciones agroquimicas a Peru
IF NOT EXISTS (SELECT 1 FROM dbo.icb_cx_dim_pais WHERE iso2 = 'CN')
INSERT INTO dbo.icb_cx_dim_pais (iso2, iso3, nombre, continente, latitude, longitude) VALUES
  ('CN', 'CHN', 'China',          'Asia',      35.8617,  104.1954),
  ('IN', 'IND', 'India',          'Asia',      20.5937,   78.9629),
  ('US', 'USA', 'Estados Unidos', 'America',   37.0902,  -95.7129),
  ('DE', 'DEU', 'Alemania',       'Europa',    51.1657,   10.4515),
  ('BR', 'BRA', 'Brasil',         'America',  -14.2350,  -51.9253),
  ('AR', 'ARG', 'Argentina',      'America',  -38.4161,  -63.6167),
  ('ES', 'ESP', 'Espana',         'Europa',    40.4637,   -3.7492),
  ('IT', 'ITA', 'Italia',         'Europa',    41.8719,   12.5674),
  ('IL', 'ISR', 'Israel',         'Asia',      31.0461,   34.8516),
  ('MX', 'MEX', 'Mexico',         'America',   23.6345, -102.5528),
  ('JP', 'JPN', 'Japon',          'Asia',      36.2048,  138.2529),
  ('GB', 'GBR', 'Reino Unido',    'Europa',    55.3781,   -3.4360),
  ('FR', 'FRA', 'Francia',        'Europa',    46.2276,    2.2137),
  ('BE', 'BEL', 'Belgica',        'Europa',    50.5039,    4.4699),
  ('NL', 'NLD', 'Paises Bajos',   'Europa',    52.1326,    5.2913),
  ('CH', 'CHE', 'Suiza',          'Europa',    46.8182,    8.2275),
  ('CL', 'CHL', 'Chile',          'America',  -35.6751,  -71.5430),
  ('CO', 'COL', 'Colombia',       'America',    4.5709,  -74.2973),
  ('EC', 'ECU', 'Ecuador',        'America',   -1.8312,  -78.1834),
  ('TR', 'TUR', 'Turquia',        'Asia',      38.9637,   35.2433),
  ('KR', 'KOR', 'Corea del Sur',  'Asia',      35.9078,  127.7669),
  ('AU', 'AUS', 'Australia',      'Oceania',  -25.2744,  133.7751),
  ('PE', 'PER', 'Peru',           'America',   -9.1900,  -75.0152);
GO

-- Competidores conocidos en el mercado peruano de agroquimicos
IF NOT EXISTS (SELECT 1 FROM dbo.icb_cx_dim_empresa WHERE razon_social = 'Bayer S.A.')
INSERT INTO dbo.icb_cx_dim_empresa (razon_social, nombre_comercial, tipo_empresa, es_competidor) VALUES
  ('Bayer S.A.',                              'Bayer CropScience',  'Multinacional', 1),
  ('Syngenta Crop Protection S.A.',           'Syngenta',           'Multinacional', 1),
  ('FMC Quimica del Peru S.A.',               'FMC',                'Multinacional', 1),
  ('BASF Peruana S.A.',                       'BASF',               'Multinacional', 1),
  ('Corteva Agriscience Peru S.A.C.',         'Corteva',            'Multinacional', 1),
  ('UPL Peru S.A.C.',                         'UPL',                'Multinacional', 1),
  ('Adama Peru S.A.',                         'Adama',              'Multinacional', 1),
  ('Farmex S.A.',                             'Farmex',             'Nacional',      1),
  ('Silvestre Peru S.A.C.',                   'Silvestre',          'Nacional',      1),
  ('TQC S.A.C.',                              'TQC',                'Nacional',      1),
  ('Montana S.A.',                            'Montana',            'Nacional',      1),
  ('Agroklinge S.A.',                         'Agroklinge',         'Nacional',      1),
  ('Neoagrum S.A.C.',                         'Neoagrum',           'Nacional',      1),
  ('Agrovet Market S.A.',                     'Agrovet',            'Nacional',      1),
  ('Drokasa Peru S.A.',                       'Drokasa',            'Nacional',      1),
  ('Rotam Agrochemical Peru S.A.C.',          'Rotam',              'Multinacional', 1),
  ('Sumitomo Chemical Peru S.A.',             'Sumitomo',           'Multinacional', 1),
  ('Nufarm Peru S.A.C.',                      'Nufarm',             'Multinacional', 1),
  ('Stoller del Peru S.A.',                   'Stoller',            'Multinacional', 1),
  ('Valagro Peru S.A.C.',                     'Valagro',            'Multinacional', 1),
  ('Serfi S.A.',                              'Serfi',              'Nacional',      1),
  ('Bioqualitas S.A.C.',                      'Bioqualitas',        'Nacional',      1);
GO

-- Productos relevantes conocidos (ingredientes activos comunes)
IF NOT EXISTS (SELECT 1 FROM dbo.icb_cx_dim_producto WHERE ingrediente_activo = 'Glifosato')
INSERT INTO dbo.icb_cx_dim_producto (ingrediente_activo, familia_pa) VALUES
  ('Glifosato',         'HERBICIDAS'),
  ('Paraquat',          'HERBICIDAS'),
  ('2,4-D',             'HERBICIDAS'),
  ('Atrazina',          'HERBICIDAS'),
  ('Metribuzin',        'HERBICIDAS'),
  ('Cipermetrina',      'INSECTICIDAS'),
  ('Clorpirifos',       'INSECTICIDAS'),
  ('Imidacloprid',      'INSECTICIDAS'),
  ('Metamidofos',       'INSECTICIDAS'),
  ('Abamectina',        'INSECTICIDAS'),
  ('Lambda cihalotrina','INSECTICIDAS'),
  ('Mancozeb',          'FUNGICIDAS'),
  ('Carbendazim',       'FUNGICIDAS'),
  ('Propineb',          'FUNGICIDAS'),
  ('Metalaxil',         'FUNGICIDAS'),
  ('Azoxistrobin',      'FUNGICIDAS'),
  ('Oxido cuproso',     'FUNGICIDAS'),
  ('Tebuconazole',      'FUNGICIDAS'),
  ('Acido giberelico',  'BIOLOGICOS'),
  ('Trichoderma spp.',  'BIOLOGICOS');
GO

PRINT 'Migracion 004 - COMEX y Competidores completada.';
