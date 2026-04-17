-- Schema para modulo Logistica > Letras
-- Ejecutar una sola vez en la BD dwh-grupopoint-prod

-- Tabla de configuracion del bot (1 sola fila)
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'intranet_letras_bot_config')
BEGIN
  CREATE TABLE dbo.intranet_letras_bot_config (
    id              INT IDENTITY(1,1) PRIMARY KEY,
    enabled         BIT           NOT NULL DEFAULT 0,
    send_hour       INT           NOT NULL DEFAULT 17,  -- 0..23
    send_minute     INT           NOT NULL DEFAULT 0,   -- 0..59
    default_cc      NVARCHAR(1000)    NULL,             -- separado por ;
    updated_by      NVARCHAR(100)     NULL,
    updated_at      DATETIME2     NOT NULL DEFAULT SYSDATETIME()
  );
  -- fila inicial
  INSERT INTO dbo.intranet_letras_bot_config (enabled, send_hour, send_minute) VALUES (0, 17, 0);
END
GO

-- Tabla de historial de envios
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'intranet_letras_bot_history')
BEGIN
  CREATE TABLE dbo.intranet_letras_bot_history (
    id              BIGINT IDENTITY(1,1) PRIMARY KEY,
    run_date        DATE          NOT NULL,             -- dia de ejecucion
    run_at          DATETIME2     NOT NULL DEFAULT SYSDATETIME(),
    trigger_type    VARCHAR(20)   NOT NULL,             -- 'auto' | 'manual'
    letra_id        NVARCHAR(200) NOT NULL,             -- SharePoint drive item id
    letra_name      NVARCHAR(500) NOT NULL,
    factura_code    NVARCHAR(200)     NULL,
    cliente         NVARCHAR(500)     NULL,
    recipients_to   NVARCHAR(2000)    NULL,             -- separados por ;
    recipients_cc   NVARCHAR(1000)    NULL,
    attachments_qty INT           NOT NULL DEFAULT 0,
    status          VARCHAR(20)   NOT NULL,             -- 'sent' | 'skipped' | 'failed'
    error_message   NVARCHAR(2000)    NULL
  );
  CREATE INDEX ix_letras_bot_history_rundate ON dbo.intranet_letras_bot_history (run_date DESC);
  CREATE INDEX ix_letras_bot_history_letra ON dbo.intranet_letras_bot_history (letra_id);
END
GO

-- Tabla de snapshot del ultimo sync (para detectar cambios dia a dia)
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'intranet_letras_sync_log')
BEGIN
  CREATE TABLE dbo.intranet_letras_sync_log (
    id              BIGINT IDENTITY(1,1) PRIMARY KEY,
    synced_at       DATETIME2     NOT NULL DEFAULT SYSDATETIME(),
    file_count      INT           NOT NULL,
    new_today_count INT           NOT NULL DEFAULT 0,
    trigger_type    VARCHAR(20)   NOT NULL              -- 'auto' | 'manual'
  );
  CREATE INDEX ix_letras_sync_log_syncedat ON dbo.intranet_letras_sync_log (synced_at DESC);
END
GO
