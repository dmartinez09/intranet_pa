-- ============================================================
-- Migration 001 — Tabla de usuarios de la intranet
-- ============================================================
-- Reemplaza el sistema de roles por permisos granulares por módulo.
-- Los módulos permitidos se guardan como JSON array de códigos.
-- El usuario admin se crea con is_admin=1 (bypass de permisos).
--
-- Ejecutar una sola vez contra dwh-grupopoint-prod
-- ============================================================

IF OBJECT_ID('dbo.intranet_users', 'U') IS NOT NULL
BEGIN
    PRINT 'La tabla dbo.intranet_users ya existe. Saltando creación.';
END
ELSE
BEGIN
    CREATE TABLE dbo.intranet_users (
        id             INT IDENTITY(1,1) PRIMARY KEY,
        username       NVARCHAR(50)  NOT NULL UNIQUE,
        password_hash  NVARCHAR(200) NOT NULL,
        full_name      NVARCHAR(150) NOT NULL,
        email          NVARCHAR(150) NULL,
        modules        NVARCHAR(MAX) NOT NULL DEFAULT N'[]', -- JSON array: ["dashboard_ventas","letras",...]
        is_admin       BIT           NOT NULL DEFAULT 0,
        is_active      BIT           NOT NULL DEFAULT 1,
        last_login     DATETIME2     NULL,
        created_at     DATETIME2     NOT NULL DEFAULT SYSDATETIME(),
        updated_at     DATETIME2     NOT NULL DEFAULT SYSDATETIME()
    );

    CREATE INDEX IX_intranet_users_username ON dbo.intranet_users(username);
    CREATE INDEX IX_intranet_users_active   ON dbo.intranet_users(is_active);

    PRINT 'Tabla dbo.intranet_users creada.';
END
GO

-- Seed admin (solo si no existe)
IF NOT EXISTS (SELECT 1 FROM dbo.intranet_users WHERE username = 'admin')
BEGIN
    -- Hash bcrypt de 'admin123'
    INSERT INTO dbo.intranet_users (username, password_hash, full_name, email, modules, is_admin, is_active)
    VALUES (
        'admin',
        '$2a$10$9cKoZsj8b6PfkAeLoUgwUOmHIQDzEeQ1vHd4vwJ4N70DlJsXTpuMm',
        'Administrador',
        'admin@pointandina.com',
        N'[]',
        1,
        1
    );
    PRINT 'Usuario admin creado (password: admin123).';
END
ELSE
BEGIN
    PRINT 'Usuario admin ya existe. No se modificó.';
END
GO
