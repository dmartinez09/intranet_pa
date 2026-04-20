// ============================================================
// FAST baseline - completa solo 2025 y 2026 para los 22 competidores
// (Point Andina ya tiene los 3 años).
// Usa bulk insert con Table-Valued Parameter para máxima velocidad.
// ============================================================

import crypto from 'crypto';
import { getDbPool, closeDb, sql } from '../src/config/database';

function sha256(s: string): string {
  return crypto.createHash('sha256').update(s).digest('hex');
}

const COMPETITORS: Array<[string, number]> = [
  ['Bayer CropScience', 14.5],
  ['Syngenta',          12.0],
  ['FMC',                9.0],
  ['BASF',               7.5],
  ['Farmex',             6.5],
  ['Silvestre',          6.0],
  ['UPL',                5.5],
  ['Corteva',            5.0],
  ['TQC',                4.5],
  ['Montana',            4.0],
  ['Adama',              3.8],
  ['Agroklinge',         3.5],
  ['Nufarm',             3.0],
  ['Rotam',              2.8],
  ['Sumitomo',           2.5],
  ['Drokasa',            2.3],
  ['Neoagrum',           2.0],
  ['Agrovet',            1.8],
  ['Stoller',            1.5],
  ['Valagro',            1.3],
  ['Serfi',              1.0],
  ['Bioqualitas',        0.8],
];

const FAMILIA_MIX: Record<string, number> = {
  INSECTICIDAS: 0.32, FUNGICIDAS: 0.28, HERBICIDAS: 0.22,
  NUTRICIONALES: 0.08, BIOLOGICOS: 0.04, COADYUVANTES: 0.03,
  ORGANICOS: 0.02, OTROS: 0.01,
};

const PAIS_MIX: Array<[string, number]> = [
  ['CN', 0.48], ['IN', 0.17], ['US', 0.08], ['DE', 0.05],
  ['BR', 0.04], ['AR', 0.03], ['ES', 0.03], ['IT', 0.02],
  ['IL', 0.02], ['MX', 0.02], ['JP', 0.02], ['GB', 0.015],
  ['FR', 0.01], ['BE', 0.005], ['NL', 0.005], ['CH', 0.005], ['CL', 0.005],
];

const TOTAL_CIF_USD_ANUAL = 450_000_000;
const MONTH_DIST = [0.07, 0.06, 0.07, 0.09, 0.11, 0.11, 0.10, 0.09, 0.09, 0.08, 0.07, 0.06];

async function main() {
  console.log('Fast baseline 2025+2026 (solo multinacionales) — Bulk insert');
  const pool = await getDbPool();

  const src = (await pool.request().query(
    `SELECT source_id FROM dbo.icb_dim_source WHERE source_code = 'BASELINE_PE_COMEX'`
  )).recordset[0];
  const sourceId = src?.source_id;

  const emps = (await pool.request().query(
    `SELECT empresa_id, nombre_comercial FROM dbo.icb_cx_dim_empresa WHERE es_competidor = 1 AND es_point_andina = 0`
  )).recordset;
  const empMap = new Map<string, number>();
  for (const e of emps) empMap.set(e.nombre_comercial, e.empresa_id);

  const paises = (await pool.request().query(
    `SELECT pais_id, iso2 FROM dbo.icb_cx_dim_pais`
  )).recordset;
  const paisMap = new Map<string, number>();
  for (const p of paises) paisMap.set(p.iso2, p.pais_id);

  const partidas = (await pool.request().query(
    `SELECT partida_id, familia_pa FROM dbo.icb_cx_dim_partida WHERE active_flag = 1`
  )).recordset;
  const partidasByFamilia = new Map<string, number[]>();
  for (const p of partidas) {
    const fam = p.familia_pa || 'OTROS';
    if (!partidasByFamilia.has(fam)) partidasByFamilia.set(fam, []);
    partidasByFamilia.get(fam)!.push(p.partida_id);
  }

  // Obtener hashes ya existentes en 2025/2026 para skip
  const existing = await pool.request().query(
    `SELECT record_hash FROM dbo.icb_cx_fact_importacion WHERE periodo_year IN (2025, 2026) AND record_hash IS NOT NULL`
  );
  const existingHashes = new Set(existing.recordset.map((r: any) => r.record_hash));
  console.log(`Hashes existentes en 2025+2026: ${existingHashes.size}`);

  // Abrir log
  const runRes = await pool.request()
    .input('pipeline', sql.NVarChar(100), 'fast-baseline-pe-comex')
    .input('source_id', sql.Int, sourceId)
    .input('triggered_by', sql.NVarChar(60), 'script_fast')
    .query(`INSERT INTO dbo.icb_etl_run_log (pipeline_name, source_id, status, triggered_by)
            OUTPUT INSERTED.run_id VALUES (@pipeline, @source_id, 'RUNNING', @triggered_by)`);
  const runId = runRes.recordset[0].run_id;

  // Generar todos los registros en memoria
  const rows: any[] = [];
  let skipped = 0;

  for (const year of [2025, 2026]) {
    const yearMult = year === 2025 ? 1.00 : 1.08;
    for (let month = 1; month <= 12; month++) {
      const monthCif = TOTAL_CIF_USD_ANUAL * yearMult * MONTH_DIST[month - 1];
      for (const [empName, share] of COMPETITORS) {
        const empId = empMap.get(empName);
        if (!empId) continue;
        const empMonthly = monthCif * (share / 100);
        for (const [familia, famShare] of Object.entries(FAMILIA_MIX)) {
          const famCif = empMonthly * famShare;
          if (famCif < 100) continue;
          const partidaList = partidasByFamilia.get(familia);
          if (!partidaList?.length) continue;
          const partidaId = partidaList[Math.floor(Math.random() * partidaList.length)];
          for (const [iso, paisShare] of PAIS_MIX) {
            const paisId = paisMap.get(iso);
            if (!paisId) continue;
            const cif = famCif * paisShare;
            if (cif < 50) continue;

            const hash = sha256(`baseline|${sourceId}|${year}|${month}|${empId}|${partidaId}|${paisId}`);
            if (existingHashes.has(hash)) { skipped++; continue; }

            const pricePerKg = 4 + Math.random() * 4;
            const kg = cif / pricePerKg;
            const fob = cif * 0.92;

            rows.push({
              source_id: sourceId, empresa_id: empId, partida_id: partidaId, pais_origen_id: paisId,
              periodo_year: year, periodo_month: month,
              cantidad_kg: Math.round(kg * 100) / 100,
              valor_cif_usd: Math.round(cif * 100) / 100,
              valor_fob_usd: Math.round(fob * 100) / 100,
              record_hash: hash,
              notas: `Baseline ${empName} ${familia} ${iso} ${year}-${String(month).padStart(2,'0')}`,
            });
          }
        }
      }
    }
  }

  console.log(`Rows a insertar: ${rows.length} (skipped ya existentes: ${skipped})`);

  // Bulk insert en chunks de 5000 con timeout extendido
  const CHUNK = 5000;
  const start = Date.now();
  let totalInserted = 0;

  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const table = new sql.Table('dbo.icb_cx_fact_importacion');
    table.create = false;
    table.columns.add('source_id', sql.Int, { nullable: false });
    table.columns.add('empresa_id', sql.Int, { nullable: true });
    table.columns.add('partida_id', sql.Int, { nullable: true });
    table.columns.add('pais_origen_id', sql.Int, { nullable: true });
    table.columns.add('periodo_year', sql.Int, { nullable: false });
    table.columns.add('periodo_month', sql.Int, { nullable: true });
    table.columns.add('cantidad_kg', sql.Decimal(18, 2), { nullable: true });
    table.columns.add('valor_cif_usd', sql.Decimal(18, 2), { nullable: true });
    table.columns.add('valor_fob_usd', sql.Decimal(18, 2), { nullable: true });
    table.columns.add('record_hash', sql.NVarChar(64), { nullable: true });
    table.columns.add('notas', sql.NVarChar(800), { nullable: true });

    for (const r of chunk) {
      table.rows.add(
        r.source_id, r.empresa_id, r.partida_id, r.pais_origen_id,
        r.periodo_year, r.periodo_month,
        r.cantidad_kg, r.valor_cif_usd, r.valor_fob_usd,
        r.record_hash, r.notas,
      );
    }

    const req = pool.request();
    req.query('SET LOCK_TIMEOUT 60000');  // wait locks
    (req as any).requestTimeout = 120000;
    const bulkRes = await req.bulk(table);
    totalInserted += bulkRes.rowsAffected || chunk.length;
    process.stdout.write(`\r  Chunk ${Math.ceil((i+chunk.length)/CHUNK)}/${Math.ceil(rows.length/CHUNK)} OK (${totalInserted} total)`);
  }
  console.log('');
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`✓ Bulk insert completado en ${elapsed}s: ${totalInserted} rows insertados`);

  await pool.request()
    .input('run_id', sql.BigInt, runId)
    .input('ri', sql.Int, totalInserted)
    .query(`UPDATE dbo.icb_etl_run_log
            SET finished_at = SYSUTCDATETIME(), status = 'SUCCESS',
                records_read = @ri, records_inserted = @ri
            WHERE run_id = @run_id`);

  // Verificar
  const final = await pool.request().query(
    `SELECT periodo_year, COUNT(*) AS ops, COUNT(DISTINCT empresa_id) AS emps
     FROM dbo.icb_cx_fact_importacion GROUP BY periodo_year ORDER BY periodo_year`
  );
  console.log('\nTotales post-baseline:');
  console.table(final.recordset);

  await closeDb();
}

main().catch(e => { console.error(e); process.exit(1); });
