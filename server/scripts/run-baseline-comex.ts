// ============================================================
// Baseline COMEX - inserta importaciones representativas del mercado
// de agroquímicos peruano para poblar el dashboard desde el primer run.
//
// Datos aproximados basados en órdenes de magnitud públicos
// (SUNAT, ADEX, BCR) - sirven como baseline mientras maduran los collectors.
// ============================================================

import crypto from 'crypto';
import { getDbPool, closeDb, sql } from '../src/config/database';

function sha256(s: string): string {
  return crypto.createHash('sha256').update(s).digest('hex');
}

// Market share aproximado (%) de competidores clave en Perú (plaguicidas)
// Basado en conocimiento público del mercado — valores representativos
const COMPETITOR_SHARE: Array<[string, number]> = [
  // [nombre_comercial, share %]
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
  ['Point Andina',       3.2],
];

// Distribución heurística por familia (plaguicidas importados en PE)
// Suma ~100%
const FAMILIA_MIX: Record<string, number> = {
  INSECTICIDAS: 0.32,
  FUNGICIDAS:   0.28,
  HERBICIDAS:   0.22,
  NUTRICIONALES: 0.08,
  BIOLOGICOS:   0.04,
  COADYUVANTES: 0.03,
  ORGANICOS:    0.02,
  OTROS:        0.01,
};

// Distribución heurística por país de origen (importaciones agroquímicos PE)
const PAIS_MIX: Array<[string, number]> = [
  ['CN', 0.48],  // China
  ['IN', 0.17],  // India
  ['US', 0.08],  // USA
  ['DE', 0.05],  // Alemania
  ['BR', 0.04],  // Brasil
  ['AR', 0.03],  // Argentina
  ['ES', 0.03],  // España
  ['IT', 0.02],  // Italia
  ['IL', 0.02],  // Israel
  ['MX', 0.02],  // México
  ['JP', 0.02],  // Japón
  ['GB', 0.015], // UK
  ['FR', 0.01],  // Francia
  ['BE', 0.005], // Bélgica
  ['NL', 0.005], // Países Bajos
  ['CH', 0.005], // Suiza
  ['CL', 0.005], // Chile
];

// Mercado total aproximado anual de plaguicidas + fertilizantes importados PE (USD CIF)
// Aproximadamente USD 400M - 500M para agroquímicos formulados (3808)
const TOTAL_CIF_USD_ANUAL = 450_000_000;

// Distribución mensual (estacionalidad agrícola PE)
const MONTH_DISTRIBUTION: number[] = [
  // Ene  Feb  Mar  Abr  May  Jun  Jul  Ago  Sep  Oct  Nov  Dic
    0.07, 0.06, 0.07, 0.09, 0.11, 0.11, 0.10, 0.09, 0.09, 0.08, 0.07, 0.06,
];

async function main() {
  console.log('=====================================================');
  console.log('BASELINE COMEX - Importaciones representativas 2024-2026');
  console.log('=====================================================\n');

  const pool = await getDbPool();

  // 1) Obtener IDs necesarios
  const srcRes = await pool.request().query(
    `SELECT source_id FROM dbo.icb_dim_source WHERE source_code = 'BASELINE_PE_COMEX'`
  );
  const sourceId = srcRes.recordset[0]?.source_id;
  if (!sourceId) throw new Error('Source BASELINE_PE_COMEX no existe. Ejecuta migración 004 primero.');

  const empsRes = await pool.request().query(
    `SELECT empresa_id, nombre_comercial, razon_social FROM dbo.icb_cx_dim_empresa WHERE es_competidor = 1`
  );
  const empresasByComercial = new Map<string, number>();
  for (const e of empsRes.recordset) {
    if (e.nombre_comercial) empresasByComercial.set(e.nombre_comercial, e.empresa_id);
  }

  const paisesRes = await pool.request().query(
    `SELECT pais_id, iso2 FROM dbo.icb_cx_dim_pais WHERE active_flag = 1`
  );
  const paisesByIso = new Map<string, number>();
  for (const p of paisesRes.recordset) paisesByIso.set(p.iso2, p.pais_id);

  const partidasRes = await pool.request().query(
    `SELECT partida_id, hs_code, familia_pa FROM dbo.icb_cx_dim_partida WHERE active_flag = 1`
  );
  const partidasByFamilia = new Map<string, number[]>();
  for (const p of partidasRes.recordset) {
    const fam = p.familia_pa || 'OTROS';
    if (!partidasByFamilia.has(fam)) partidasByFamilia.set(fam, []);
    partidasByFamilia.get(fam)!.push(p.partida_id);
  }

  // 2) Generar snapshots de importaciones
  const years = [2024, 2025, 2026];
  let inserted = 0;
  let skipped = 0;

  // Abrir log
  const openRes = await pool.request()
    .input('pipeline', sql.NVarChar(100), 'baseline-pe-comex')
    .input('source_id', sql.Int, sourceId)
    .input('triggered_by', sql.NVarChar(60), 'script_baseline_comex')
    .query(`
      INSERT INTO dbo.icb_etl_run_log (pipeline_name, source_id, status, triggered_by)
      OUTPUT INSERTED.run_id
      VALUES (@pipeline, @source_id, 'RUNNING', @triggered_by)
    `);
  const runId = openRes.recordset[0].run_id;

  for (const year of years) {
    const yearMult = year === 2024 ? 0.90 : year === 2025 ? 1.00 : 1.08;
    for (let month = 1; month <= 12; month++) {
      const monthCif = TOTAL_CIF_USD_ANUAL * yearMult * MONTH_DISTRIBUTION[month - 1];

      for (const [empComercial, share] of COMPETITOR_SHARE) {
        const empId = empresasByComercial.get(empComercial);
        if (!empId) continue;
        const empMonthlyCif = monthCif * (share / 100);

        for (const [familia, famShare] of Object.entries(FAMILIA_MIX)) {
          const familiaCif = empMonthlyCif * famShare;
          if (familiaCif < 100) continue;  // skip mini
          const partidasInFam = partidasByFamilia.get(familia);
          if (!partidasInFam?.length) continue;
          const partidaId = partidasInFam[Math.floor(Math.random() * partidasInFam.length)];

          for (const [iso, paisShare] of PAIS_MIX) {
            const paisId = paisesByIso.get(iso);
            if (!paisId) continue;
            const cif = familiaCif * paisShare;
            if (cif < 50) continue;  // skip cifras muy pequeñas

            // Ratio USD/kg típico 3-8 para agroquímicos formulados
            const pricePerKg = 4 + Math.random() * 4;
            const kg = cif / pricePerKg;
            const fob = cif * 0.92;

            const hash = sha256(`baseline|${sourceId}|${year}|${month}|${empId}|${partidaId}|${paisId}`);

            // Upsert
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
              skipped++;
            } else {
              await pool.request()
                .input('source_id', sql.Int, sourceId)
                .input('empresa_id', sql.Int, empId)
                .input('partida_id', sql.Int, partidaId)
                .input('pais_id', sql.Int, paisId)
                .input('year', sql.Int, year)
                .input('month', sql.Int, month)
                .input('cif', sql.Decimal(18, 2), Math.round(cif * 100) / 100)
                .input('fob', sql.Decimal(18, 2), Math.round(fob * 100) / 100)
                .input('kg',  sql.Decimal(18, 2), Math.round(kg * 100) / 100)
                .input('hash', sql.NVarChar(64), hash)
                .input('note', sql.NVarChar(800), `Baseline representativo ${empComercial} ${familia} desde ${iso} en ${year}-${String(month).padStart(2,'0')}`)
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
      }
      process.stdout.write(`\r  ${year}-${String(month).padStart(2,'0')}: ${inserted} insertados, ${skipped} actualizados...`);
    }
  }

  console.log('\n\nCerrando log...');
  await pool.request()
    .input('run_id', sql.BigInt, runId)
    .input('ri', sql.Int, inserted)
    .input('ru', sql.Int, skipped)
    .query(`
      UPDATE dbo.icb_etl_run_log
      SET finished_at = SYSUTCDATETIME(),
          status = 'SUCCESS',
          records_read = @ri + @ru,
          records_inserted = @ri,
          records_updated = @ru
      WHERE run_id = @run_id
    `);

  // Verificación
  console.log('\n=== Resumen post-baseline ===');
  const top = await pool.request().query(`
    SELECT TOP 5 e.nombre_comercial, SUM(f.valor_cif_usd) AS total_cif
    FROM dbo.icb_cx_fact_importacion f
    INNER JOIN dbo.icb_cx_dim_empresa e ON f.empresa_id = e.empresa_id
    GROUP BY e.nombre_comercial
    ORDER BY total_cif DESC
  `);
  console.table(top.recordset.map((r: any) => ({
    empresa: r.nombre_comercial,
    cif_usd: `$${Math.round(r.total_cif).toLocaleString('es-PE')}`,
  })));

  const topPais = await pool.request().query(`
    SELECT TOP 5 p.nombre AS pais, SUM(f.valor_cif_usd) AS total_cif
    FROM dbo.icb_cx_fact_importacion f
    INNER JOIN dbo.icb_cx_dim_pais p ON f.pais_origen_id = p.pais_id
    GROUP BY p.nombre
    ORDER BY total_cif DESC
  `);
  console.table(topPais.recordset.map((r: any) => ({
    pais: r.pais,
    cif_usd: `$${Math.round(r.total_cif).toLocaleString('es-PE')}`,
  })));

  const totalRes = await pool.request().query(
    `SELECT COUNT(*) AS cnt, SUM(valor_cif_usd) AS total FROM dbo.icb_cx_fact_importacion`
  );
  const t = totalRes.recordset[0];
  console.log(`\n✓ Totales: ${t.cnt} operaciones | CIF $${Math.round(t.total).toLocaleString('es-PE')}`);
  console.log(`  Insertados nuevos: ${inserted} | Actualizados: ${skipped}\n`);

  await closeDb();
}

main().catch(err => {
  console.error('\n✗ BASELINE FALLÓ:', err);
  process.exit(1);
});
