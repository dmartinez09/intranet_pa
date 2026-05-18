-- ============================================================
-- [2026-05-18] Agrega columna body_html_sample a intranet_letras_bot_history
-- Temporal: para auditar que el tracking pixel está siendo embebido en los
-- emails reales del bot. Se llena con los primeros 2000 chars del HTML enviado.
-- Una vez confirmado el funcionamiento se puede DROPear o limpiar la columna.
-- ============================================================
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE Name = 'body_html_sample'
      AND Object_ID = OBJECT_ID('dbo.intranet_letras_bot_history')
)
BEGIN
    ALTER TABLE dbo.intranet_letras_bot_history
    ADD body_html_sample NVARCHAR(MAX) NULL;
    PRINT 'Columna body_html_sample agregada a intranet_letras_bot_history';
END
ELSE
    PRINT 'Columna body_html_sample ya existe';
