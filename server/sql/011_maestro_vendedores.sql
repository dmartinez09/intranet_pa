-- ============================================================
-- 011_maestro_vendedores.sql
-- Maestro de Vendedores Point Andina:
--   Codigo_Vendedor -> Vendedor -> Serie -> Grupo (EQUIVALENTE)
--
-- Sustituye dinamicamente la columna Grupo_Cliente del dashboard
-- por el grupo que asigna RRHH/Comercial a cada vendedor.
-- ============================================================

IF OBJECT_ID('dbo.intranet_maestro_vendedores','U') IS NULL
BEGIN
  CREATE TABLE dbo.intranet_maestro_vendedores (
    id INT IDENTITY(1,1) PRIMARY KEY,
    codigo_vendedor INT NOT NULL,
    vendedor NVARCHAR(200) NOT NULL,
    serie_documento NVARCHAR(50) NOT NULL,
    grupo NVARCHAR(80) NOT NULL,
    activo BIT NOT NULL DEFAULT 1,
    created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
  );
  CREATE UNIQUE INDEX ux_maestro_vendedores_codigo ON dbo.intranet_maestro_vendedores(codigo_vendedor);
  CREATE INDEX ix_maestro_vendedores_grupo ON dbo.intranet_maestro_vendedores(grupo);
END
GO
