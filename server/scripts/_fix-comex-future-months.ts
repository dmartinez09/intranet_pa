import { getDbPool, closeDb, sql } from '../src/config/database';
(async () => {
  const p = await getDbPool();
  const now = new Date();
  const curY = now.getFullYear();
  const curM = now.getMonth() + 1;
  // Borrar: año futuro completo, y año actual mes >= curM (mes en curso aún no terminado)
  // Borrar mes-a-mes en lotes pequeños para evitar timeout
  let totalDel = 0;
  const targets: Array<[number, number]> = [];
  for (let m = curM; m <= 12; m++) targets.push([curY, m]);
  for (let y = curY + 1; y <= 2030; y++) for (let m = 1; m <= 12; m++) targets.push([y, m]);
  for (const [y, m] of targets) {
    const req = p.request();
    req.input('y', sql.Int, y).input('m', sql.Int, m);
    const r = await req.query(`DELETE FROM dbo.icb_cx_fact_importacion WHERE periodo_year=@y AND periodo_month=@m`);
    const n = r.rowsAffected[0];
    if (n > 0) { console.log(`  ${y}-${String(m).padStart(2,'0')}: deleted ${n}`); totalDel += n; }
  }
  console.log(`Total deleted: ${totalDel}`);

  const r2 = await p.request().query(
    `SELECT periodo_year, COUNT(*) ops, SUM(valor_cif_usd) cif,
       MIN(periodo_month) min_m, MAX(periodo_month) max_m, COUNT(DISTINCT periodo_month) meses
     FROM dbo.icb_cx_fact_importacion GROUP BY periodo_year ORDER BY periodo_year`
  );
  console.table(r2.recordset);
  await closeDb();
})();
