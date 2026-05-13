import { getDbPool, sql } from '../config/database';

export interface MaestroVendedor {
  id: number;
  codigo_vendedor: number;
  vendedor: string;
  serie_documento: string;
  grupo: string;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export const maestroVendedoresService = {
  async list(): Promise<MaestroVendedor[]> {
    const p = await getDbPool();
    const r = await p.request().query(`
      SELECT id, codigo_vendedor, vendedor, serie_documento, grupo, activo, created_at, updated_at
      FROM dbo.intranet_maestro_vendedores
      ORDER BY grupo, vendedor
    `);
    return r.recordset;
  },

  async listGrupos(): Promise<string[]> {
    const p = await getDbPool();
    const r = await p.request().query(`
      SELECT DISTINCT grupo FROM dbo.intranet_maestro_vendedores WHERE activo=1 ORDER BY grupo
    `);
    return r.recordset.map(x => x.grupo);
  },

  async create(input: { codigo_vendedor: number; vendedor: string; serie_documento: string; grupo: string; activo?: boolean }): Promise<MaestroVendedor> {
    const p = await getDbPool();
    const r = await p.request()
      .input('codigo', sql.Int, input.codigo_vendedor)
      .input('vendedor', sql.NVarChar, input.vendedor.trim())
      .input('serie', sql.NVarChar, (input.serie_documento || '').trim())
      .input('grupo', sql.NVarChar, input.grupo.trim())
      .input('activo', sql.Bit, input.activo === undefined ? 1 : (input.activo ? 1 : 0))
      .query(`
        INSERT INTO dbo.intranet_maestro_vendedores (codigo_vendedor, vendedor, serie_documento, grupo, activo)
        OUTPUT inserted.*
        VALUES (@codigo, @vendedor, @serie, @grupo, @activo)
      `);
    return r.recordset[0];
  },

  async update(id: number, input: Partial<{ codigo_vendedor: number; vendedor: string; serie_documento: string; grupo: string; activo: boolean }>): Promise<MaestroVendedor | null> {
    const p = await getDbPool();
    const sets: string[] = [];
    const req = p.request().input('id', sql.Int, id);
    if (input.codigo_vendedor !== undefined) { sets.push('codigo_vendedor=@codigo'); req.input('codigo', sql.Int, input.codigo_vendedor); }
    if (input.vendedor !== undefined) { sets.push('vendedor=@vendedor'); req.input('vendedor', sql.NVarChar, input.vendedor.trim()); }
    if (input.serie_documento !== undefined) { sets.push('serie_documento=@serie'); req.input('serie', sql.NVarChar, input.serie_documento.trim()); }
    if (input.grupo !== undefined) { sets.push('grupo=@grupo'); req.input('grupo', sql.NVarChar, input.grupo.trim()); }
    if (input.activo !== undefined) { sets.push('activo=@activo'); req.input('activo', sql.Bit, input.activo ? 1 : 0); }
    if (sets.length === 0) return this.getById(id);
    sets.push('updated_at=SYSUTCDATETIME()');
    const r = await req.query(`
      UPDATE dbo.intranet_maestro_vendedores SET ${sets.join(', ')}
      OUTPUT inserted.*
      WHERE id=@id
    `);
    return r.recordset[0] || null;
  },

  async getById(id: number): Promise<MaestroVendedor | null> {
    const p = await getDbPool();
    const r = await p.request().input('id', sql.Int, id)
      .query('SELECT * FROM dbo.intranet_maestro_vendedores WHERE id=@id');
    return r.recordset[0] || null;
  },

  async remove(id: number): Promise<boolean> {
    const p = await getDbPool();
    const r = await p.request().input('id', sql.Int, id)
      .query('DELETE FROM dbo.intranet_maestro_vendedores WHERE id=@id');
    return (r.rowsAffected[0] || 0) > 0;
  },
};
