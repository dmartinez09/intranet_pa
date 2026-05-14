import { getDbPool } from '../src/config/database';
(async () => {
  const p = await getDbPool();
  const stamp = new Date().toISOString().slice(0,10).replace(/-/g,'');
  const t = `_backup_abril_costo_fix_${stamp}`;
  await p.request().query(`IF OBJECT_ID('dbo.${t}','U') IS NOT NULL DROP TABLE dbo.${t}`);
  const r = await p.request().query(`
    SELECT * INTO dbo.${t}
    FROM dbo.stg_rpt_ventas_detallado
    WHERE YEAR(Fecha_Emision)=2026 AND MONTH(Fecha_Emision)=4
      AND Numero_SAP IN ('08-FD01-00000289','07-FC01-00001957','01-F001-00040045','07-FC01-00001961','08-FD01-00000286','08-FD01-00000287','07-FC01-00001944','07-FC01-00001956')
  `);
  console.log(`✓ Backup creado en dbo.${t} con`, r.rowsAffected, 'filas');
  process.exit(0);
})().catch(e=>{console.error(e.message);process.exit(1);});
