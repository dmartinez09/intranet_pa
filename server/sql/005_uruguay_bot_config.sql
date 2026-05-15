-- ============================================================
-- Tabla de configuración persistente del bot Venta Diaria Uruguay
-- Mueve la config desde server/data/uruguay-bot-config.json (tracked en git,
-- se sobrescribe en cada deploy) a SQL para preservar el estado entre deploys.
-- ============================================================
IF OBJECT_ID('dbo.intranet_uruguay_bot_config', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.intranet_uruguay_bot_config (
        id                  INT IDENTITY(1,1) PRIMARY KEY,
        enabled             BIT             NOT NULL DEFAULT 0,
        schedule_hour       INT             NOT NULL DEFAULT 7,
        schedule_minute     INT             NOT NULL DEFAULT 0,
        timezone            NVARCHAR(50)    NOT NULL DEFAULT 'America/Lima',
        sharepoint_url      NVARCHAR(2000)  NULL,
        updated_by          NVARCHAR(100)   NULL,
        updated_at          DATETIME2       NULL
    );
    -- Seed inicial — un solo registro
    INSERT INTO dbo.intranet_uruguay_bot_config
        (enabled, schedule_hour, schedule_minute, timezone, sharepoint_url, updated_by, updated_at)
    VALUES
        (0, 7, 0, 'America/Lima', '', NULL, NULL);
    PRINT 'Tabla dbo.intranet_uruguay_bot_config creada con seed inicial';
END
ELSE
    PRINT 'Tabla dbo.intranet_uruguay_bot_config ya existe';
