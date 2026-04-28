-- ============================================================
-- Tabla de auditoría del bot Venta Diaria Uruguay
-- ============================================================
IF OBJECT_ID('dbo.uruguay_bot_runs', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.uruguay_bot_runs (
        run_id              INT IDENTITY(1,1) PRIMARY KEY,
        triggered_at        DATETIME2       NOT NULL DEFAULT SYSUTCDATETIME(),
        triggered_by        NVARCHAR(100)   NOT NULL,        -- 'scheduler' | username
        trigger_type        VARCHAR(20)     NOT NULL,        -- 'auto' | 'manual' | 'range'
        date_from           DATE            NOT NULL,
        date_to             DATE            NOT NULL,
        status              VARCHAR(20)     NOT NULL,        -- 'RUNNING' | 'SUCCESS' | 'FAILED'
        rows_processed      INT             NULL,
        excel_file_name     NVARCHAR(100)   NULL,
        sharepoint_path     NVARCHAR(1000)  NULL,
        sharepoint_url      NVARCHAR(1000)  NULL,
        error_message       NVARCHAR(MAX)   NULL,
        duration_ms         INT             NULL,
        finished_at         DATETIME2       NULL
    );
    CREATE INDEX IX_uruguay_bot_runs_triggered ON dbo.uruguay_bot_runs (triggered_at DESC);
    PRINT 'Tabla dbo.uruguay_bot_runs creada';
END
ELSE
    PRINT 'Tabla dbo.uruguay_bot_runs ya existe';
