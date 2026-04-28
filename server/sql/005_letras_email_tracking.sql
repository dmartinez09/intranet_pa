-- ============================================================
-- Tabla de aperturas de emails de letras (tracking pixel)
-- ============================================================
IF OBJECT_ID('dbo.intranet_letras_email_opens', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.intranet_letras_email_opens (
        open_id         BIGINT IDENTITY(1,1) PRIMARY KEY,
        history_id      BIGINT          NOT NULL,
        recipient       NVARCHAR(320)   NOT NULL,        -- email del destinatario
        recipient_role  VARCHAR(10)     NOT NULL,        -- 'to' | 'cc'
        opened_at       DATETIME2       NOT NULL DEFAULT SYSUTCDATETIME(),
        ip_address      NVARCHAR(64)    NULL,
        user_agent      NVARCHAR(500)   NULL,
        country_hint    NVARCHAR(50)    NULL,             -- detección por IP (futuro)
        is_proxied      BIT             NOT NULL DEFAULT 0,  -- 1 = abierto por proxy de email (Gmail/Outlook prefetch)
        CONSTRAINT FK_letras_opens_history FOREIGN KEY (history_id)
            REFERENCES dbo.intranet_letras_bot_history(id) ON DELETE CASCADE
    );
    CREATE INDEX IX_letras_opens_history    ON dbo.intranet_letras_email_opens (history_id);
    CREATE INDEX IX_letras_opens_recipient  ON dbo.intranet_letras_email_opens (recipient);
    CREATE INDEX IX_letras_opens_opened_at  ON dbo.intranet_letras_email_opens (opened_at DESC);
    PRINT 'Tabla dbo.intranet_letras_email_opens creada';
END
ELSE
    PRINT 'Tabla dbo.intranet_letras_email_opens ya existe';
GO

-- ============================================================
-- Vista resumen: aperturas agregadas por letra/recipiente
-- ============================================================
IF OBJECT_ID('dbo.vw_intranet_letras_opens_summary', 'V') IS NOT NULL
    DROP VIEW dbo.vw_intranet_letras_opens_summary;
GO
CREATE VIEW dbo.vw_intranet_letras_opens_summary AS
SELECT
    h.id AS history_id,
    h.letra_id,
    h.letra_name,
    h.factura_code,
    h.cliente,
    h.run_at AS sent_at,
    h.trigger_type,
    h.recipients_to,
    h.recipients_cc,
    o.recipient,
    o.recipient_role,
    COUNT(o.open_id)               AS open_count,
    MIN(o.opened_at)               AS first_open_at,
    MAX(o.opened_at)               AS last_open_at,
    SUM(CASE WHEN o.is_proxied=0 THEN 1 ELSE 0 END) AS real_opens,
    SUM(CASE WHEN o.is_proxied=1 THEN 1 ELSE 0 END) AS proxy_opens
FROM dbo.intranet_letras_bot_history h
LEFT JOIN dbo.intranet_letras_email_opens o ON o.history_id = h.id
WHERE h.status = 'sent'
GROUP BY h.id, h.letra_id, h.letra_name, h.factura_code, h.cliente, h.run_at,
         h.trigger_type, h.recipients_to, h.recipients_cc, o.recipient, o.recipient_role;
