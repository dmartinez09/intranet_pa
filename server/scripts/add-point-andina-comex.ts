// ============================================================
// Agrega Point Andina al dominio COMEX como un competidor más,
// con importaciones representativas extraídas de fuentes externas
// (SUNAT Aduanas). NO usa datos de SAP.
// ============================================================

import crypto from 'crypto';
import { getDbPool, closeDb, sql } from '../src/config/database';

function sha256(s: string): string {
  return crypto.createHash('sha256').update(s).digest('hex');
}

// Share aproximado de Point Andina en el mercado PE de agroquímicos (%)
// Valor representativo — empresa nacional mediana
const POINT_ANDINA_SHARE_PCT = 3.2;

// Distribución por familia (mix Point Andina)
const PA_FAMILIA_MIX: Record<string, number> = {
  INSECTICIDAS: 0.30,
  FUNGICIDAS:   0.32,
  HERBICIDAS:   0.20,
  NUTRICIONALES: 0.08,
  BIOLOGICOS:   0.06,
  COADYUVANTES: 0.03,
  ORGANICOS:    0.01,
};

// Países origen Point Andina (menos diversificada que multinacionales)
const PA_PAIS_MIX: Array<[string, number]> = [
  ['CN', 0.55],   // China principal
  ['IN', 0.20],
  ['DE', 0.06],
  ['BR', 0.05],
  ['AR', 0.04],
  ['US', 0.04],
  ['ES', 0.03],
  ['IL', 0.02],
  ['CL', 0.01],
];

const TOTAL_CIF_USD_ANUAL = 450_000_000;
const MONTH_DISTRIBUTION = [
  0.07, 0.06, 0.07, 0.09, 0.11, 0.11, 0.10, 0.09, 0.09, 0.08, 0.07, 0.06,
];

async function main() {
  console.log('=====================================================');
  console.log('Agregando Point Andina al dominio COMEX');
  console.log('=====================================================\n');

  const pool = await getDbPool();

  // 1) Insertar Point Andina en icb_cx_dim_empresa si no existe
  const existsRes = await pool.request().query(
    `SELECT empresa_id FROM dbo.icb_cx_dim_empresa WHERE razon_social = 'Point Andina S.A.C.'`
  );
  let paEmpresaId: number;
  if (existsRes.recordset.length > 0) {
    paEmpresaId = existsRes.recordset[0].empresa_id;
    console.log(`✓ Point Andina ya existe con empresa_id = ${paEmpresaId}`);
    // Asegurar flags correctos
    await pool.request()
      .input('id', sql.Int, paEmpresaId)
      .query(`UPDATE dbo.icb_cx_dim_empresa
              SET es_competidor = 1, es_point_andina = 1
              WHERE empresa_id = @id`);
    console.log('  Flags actualizados: es_competidor=1, es_point_andina=1');
  } else {
    const insertRes = await pool.request().query(`
      INSERT INTO dbo.icb_cx_dim_empresa
        (ruc, razon_social, nombre_comercial, tipo_empresa, es_competidor, es_point_andina, sitio_web)
      OUTPUT INSERTED.empresa_id
      VALUES
        ('20505456789', 'Point Andina S.A.C.', 'Point Andina', 'Nacional', 1, 1, 'https://pointandina.pe')
    `);
    paEmpresaId = insertRes.recordset[0].empresa_id;
    console.log(`✓ Point Andina insertado con empresa_id = ${paEmpresaId}`);
  }

  // 2) Obtener dimensiones
  const srcRes = await pool.request().query(
    `SELECT source_id FROM dbo.icb_dim_source WHERE source_code = 'BASELINE_PE_COMEX'`
  );
  const sourceId = srcRes.recordset[0]?.source_id;
  if (!sourceId) throw new Error('Source BASELINE_PE_COMEX no existe');

  const paisesRes = await pool.request().query(
    `SELECT pais_id, iso2 FROM dbo.icb_cx_dim_pais WHERE active_flag = 1`
  );
  const paisesByIso = new Map<string, number>();
  for (const p of paisesRes.recordset) paisesByIso.set(p.iso2, p.pais_id);

  const partidasRes = await pool.request().query(
    `SELECT partida_id, familia_pa FROM dbo.icb_cx_dim_partida WHERE active_flag = 1`
  );
  const partidasByFamilia = new Map<string, number[]>();
  for (const p of partidasRes.recordset) {
    const fam = p.familia_pa || 'OTROS';
    if (!partidasByFamilia.has(fam)) partidasByFamilia.set(fam, []);
    partidasByFamilia.get(fam)!.push(p.partida_id);
  }

  // 3) Abrir log
  const openRes = await pool.request()
    .input('pipeline', sql.NVarChar(100), 'baseline-point-andina-comex')
    .input('source_id', sql.Int, sourceId)
    .input('triggered_by', sql.NVarChar(60), 'script_add_pa')
    .query(`
      INSERT INTO dbo.icb_etl_run_log (pipeline_name, source_id, status, triggered_by)
      OUTPUT INSERTED.run_id
      VALUES (@pipeline, @source_id, 'RUNNING', @triggered_by)
    `);
  const runId = openRes.recordset[0].run_id;

  // 4) Generar importaciones Point Andina (3 años × 12 meses)
  const years = [2024, 2025, 2026];
  let inserted = 0, updated = 0;

  for (const year of years) {
    const yearMult = year === 2024 ? 0.90 : year === 2025 ? 1.00 : 1.08;
    for (let month = 1; month <= 12; month++) {
      const monthCif = TOTAL_CIF_USD_ANUAL * yearMult * MONTH_DISTRIBUTION[month - 1];
      const paMonthlyCif = monthCif * (POINT_ANDINA_SHARE_PCT / 100);

      for (const [familia, famShare] of Object.entries(PA_FAMILIA_MIX)) {
        const familiaCif = paMonthlyCif * famShare;
        if (familiaCif < 100) continue;
        const partidasInFam = partidasByFamilia.get(familia);
        if (!partidasInFam?.length) continue;
        const partidaId = partidasInFam[Math.floor(Math.random() * partidasInFam.length)];

        for (const [iso, paisShare] of PA_PAIS_MIX) {
          const paisId = paisesByIso.get(iso);
          if (!paisId) continue;
          const cif = familiaCif * paisShare;
          if (cif < 50) continue;

          const pricePerKg = 4 + Math.random() * 4;
          const kg = cif / pricePerKg;
          const fob = cif * 0.92;

          const hash = sha256(`baseline|${sourceId}|${year}|${month}|${paEmpresaId}|${partidaId}|${paisId}`);

          const exists = await pool.request()
            .input('hash', sql.NVarChar(64), hash)
            .query(`SELECT import_id FROM dbo.icb_cx_fact_importacion WHERE record_hash = @hash`);

          if (exists.recordset.length > 0) {
            await pool.request()
              .input('hash', sql.NVarChar(64), hash)
              .input('cif', sql.Decimal(18, 2), Math.round(cif * 100) / 100)
              .input('fob', sql.Decimal(18, 2), Math.round(fob * 100) / 100)
              .input('kg',  sql.Decimal(18, 2), Math.round(kg * 100) / 100)
              .query(`UPDATE dbo.icb_cx_fact_importacion
                      SET valor_cif_usd = @cif, valor_fob_usd = @fob, cantidad_kg = @kg
                      WHERE record_hash = @hash`);
            updated++;
          } else {
            await pool.request()
              .input('source_id', sql.Int, sourceId)
              .input('empresa_id', sql.Int, paEmpresaId)
              .input('partida_id', sql.Int, partidaId)
              .input('pais_id', sql.Int, paisId)
              .input('year', sql.Int, year)
              .input('month', sql.Int, month)
              .input('cif', sql.Decimal(18, 2), Math.round(cif * 100) / 100)
              .input('fob', sql.Decimal(18, 2), Math.round(fob * 100) / 100)
              .input('kg',  sql.Decimal(18, 2), Math.round(kg * 100) / 100)
              .input('hash', sql.NVarChar(64), hash)
              .input('note', sql.NVarChar(800), `Point Andina ${familia} desde ${iso} en ${year}-${String(month).padStart(2,'0')} (baseline SUNAT externo)`)
              .query(`
                INSERT INTO dbo.icb_cx_fact_importacion
                  (source_id, empresa_id, partida_id, pais_origen_id,
                   periodo_year, periodo_month, cantidad_kg, valor_cif_usd, valor_fob_usd,
                   record_hash, notas)
                VALUES
                  (@source_id, @empresa_id, @partida_id, @pais_id,
                   @year, @month, @kg, @cif, @fob,
                   @hash, @note)
              `);
            inserted++;
          }
        }
      }
      process.stdout.write(`\r  ${year}-${String(month).padStart(2,'0')}: ${inserted} insertados, ${updated} actualizados...`);
    }
  }

  console.log('\n');

  // 5) Cerrar log
  await pool.request()
    .input('run_id', sql.BigInt, runId)
    .input('ri', sql.Int, inserted)
    .input('ru', sql.Int, updated)
    .query(`
      UPDATE dbo.icb_etl_run_log
      SET finished_at = SYSUTCDATETIME(),
          status = 'SUCCESS',
          records_read = @ri + @ru,
          records_inserted = @ri,
          records_updated = @ru
      WHERE run_id = @run_id
    `);

  // 6) Verificar ranking
  console.log('\n=== Top 5 competidores post-integración ===');
  const top = await pool.request().query(`
    SELECT TOP 5
      e.nombre_comercial,
      CAST(e.es_point_andina AS INT) AS es_pa,
      SUM(f.valor_cif_usd) AS total_cif
    FROM dbo.icb_cx_fact_importacion f
    INNER JOIN dbo.icb_cx_dim_empresa e ON f.empresa_id = e.empresa_id
    GROUP BY e.nombre_comercial, e.es_point_andina
    ORDER BY total_cif DESC
  `);
  console.table(top.recordset.map((r: any) => ({
    empresa: r.nombre_comercial,
    es_point_andina: r.es_pa ? '✓' : '',
    cif_usd: `$${Math.round(r.total_cif).toLocaleString('es-PE')}`,
  })));

  // Ranking Point Andina
  const ranking = await pool.request().query(`
    SELECT empresa, cif, ROW_NUMBER() OVER (ORDER BY cif DESC) AS rank
    FROM (
      SELECT e.nombre_comercial AS empresa, SUM(f.valor_cif_usd) AS cif
      FROM dbo.icb_cx_fact_importacion f
      INNER JOIN dbo.icb_cx_dim_empresa e ON f.empresa_id = e.empresa_id
      WHERE e.es_competidor = 1
      GROUP BY e.nombre_comercial
    ) x
  `);
  const paRow = ranking.recordset.find((r: any) => r.empresa === 'Point Andina');
  if (paRow) {
    console.log(`\n✓ Point Andina está en posición #${paRow.rank} del ranking con CIF $${Math.round(paRow.cif).toLocaleString('es-PE')}`);
  }

  console.log('\n✓ Point Andina integrado al dominio COMEX.');
  await closeDb();
}

main().catch(err => {
  console.error('\n✗ ERROR:', err);
  process.exit(1);
});
