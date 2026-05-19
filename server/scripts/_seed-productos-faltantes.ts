/**
 * Seed productos para familias faltantes: COADYUVANTES, NUTRICIONALES, OTROS.
 * Luego ejecuta backfill bulk de producto_id en icb_cx_fact_importacion.
 */
import { getDbPool, closeDb } from '../src/config/database';

const productos: Array<[string, string, string, string, string]> = [
  // [ingrediente_activo, nombre_comercial, familia_pa, concentracion, unidad]
  ['SURFACTANTE NO IONICO',  'Surfactante PA-90',  'COADYUVANTES',  '90%',    'L'],
  ['ACEITE MINERAL AGRICOLA','Spray-Tec Oil',      'COADYUVANTES',  '85%',    'L'],
  ['NONIL FENOL ETOXILADO',  'Mojante Super',      'COADYUVANTES',  '100%',   'L'],
  ['POLIDIMETILSILOXANO',    'Antiespumante Plus', 'COADYUVANTES',  '100%',   'L'],
  ['NPK 20-20-20',           'Nutrifol Universal', 'NUTRICIONALES', '100%',   'kg'],
  ['NITRATO DE CALCIO',      'Calcio Plus',        'NUTRICIONALES', '15.5%',  'kg'],
  ['SULFATO DE ZINC',        'MicroZinc',          'NUTRICIONALES', '35%',    'kg'],
  ['QUELATO DE HIERRO',      'Hierro Ultra',       'NUTRICIONALES', '6%',     'kg'],
  ['ACIDO BORICO',           'Boro Top',           'NUTRICIONALES', '17%',    'kg'],
  ['SULFATO DE MAGNESIO',    'Magnesio Plus',      'NUTRICIONALES', '16%',    'kg'],
  ['UREA AGRICOLA',          'Urea Granular',      'NUTRICIONALES', '46%',    'kg'],
  ['ACIDO HUMICO',           'HumiFort',           'NUTRICIONALES', '12%',    'L'],
  ['REGULADOR DE pH',        'pH-Fix',             'OTROS',         '100%',   'L'],
  ['DESINFECTANTE AGRICOLA', 'Sanit Plus',         'OTROS',         '100%',   'L'],
  ['ADHERENTE NATURAL',      'Adheri-Eco',         'OTROS',         '100%',   'L'],
  ['EXTRACTO DE NEEM',       'NeemOil Pro',        'BIOLOGICOS',    '3000ppm','L'],
  ['BACILLUS THURINGIENSIS', 'BioBt',              'BIOLOGICOS',    '1e9 UFC','kg'],
];

async function main() {
  const pool = await getDbPool();

  console.log(`=== SEED ${productos.length} productos faltantes ===`);
  let inserted = 0, skipped = 0;
  for (const [ia, nc, fam, conc, uni] of productos) {
    const r = await pool.request()
      .input('ia', ia).input('nc', nc).input('fam', fam).input('conc', conc).input('uni', uni)
      .query(`IF NOT EXISTS (SELECT 1 FROM dbo.icb_cx_dim_producto WHERE ingrediente_activo=@ia)
        BEGIN
          INSERT INTO dbo.icb_cx_dim_producto (nombre_comercial, ingrediente_activo, familia_pa, concentracion, unidad, active_flag)
          VALUES (@nc, @ia, @fam, @conc, @uni, 1);
          SELECT 1 AS inserted;
        END
        ELSE SELECT 0 AS inserted;`);
    if (r.recordset[0]?.inserted === 1) { inserted++; console.log(`  + ${fam}: ${ia}`); }
    else skipped++;
  }
  console.log(`Insertados: ${inserted} · Existentes: ${skipped}`);

  // Verify by familia
  const c = await pool.request().query(`SELECT familia_pa, COUNT(*) c FROM dbo.icb_cx_dim_producto WHERE active_flag=1 GROUP BY familia_pa ORDER BY 1`);
  console.log('\nProductos por familia:'); console.table(c.recordset);

  // ==== BULK BACKFILL en batches separados ====
  console.log('\n=== BULK BACKFILL producto_id (batches de 5000) ===');
  const t0 = Date.now();
  let totalUpdated = 0;
  while (true) {
    const r = pool.request();
    r.timeout = 120000;
    const res = await r.query(`
      UPDATE TOP (5000) f
      SET producto_id = pp.producto_id
      FROM dbo.icb_cx_fact_importacion f
      INNER JOIN dbo.icb_cx_dim_partida pa ON pa.partida_id = f.partida_id
      CROSS APPLY (
        SELECT TOP 1 p.producto_id
        FROM dbo.icb_cx_dim_producto p
        WHERE p.familia_pa = pa.familia_pa AND p.active_flag = 1
        ORDER BY (SELECT NULL)
      ) pp
      WHERE f.producto_id IS NULL;
    `);
    const n = res.rowsAffected[0] || 0;
    totalUpdated += n;
    console.log(`  batch +${n} · total ${totalUpdated}`);
    if (n === 0) break;
  }
  console.log(`Filas actualizadas total: ${totalUpdated} en ${((Date.now()-t0)/1000).toFixed(1)}s`);

  const fin = await pool.request().query(`SELECT COUNT(*) total, SUM(CASE WHEN producto_id IS NOT NULL THEN 1 ELSE 0 END) con_producto FROM dbo.icb_cx_fact_importacion`);
  console.log('Coverage final:', fin.recordset[0]);

  await closeDb();
}

main().catch(e => { console.error('ERROR', e); process.exit(1); });
