import { runAll, etlTablesReady } from '../src/services/etl';
import { closeDb } from '../src/config/database';

async function main() {
  console.log('========================================');
  console.log('Inteligencia Comercial Beta - ETL full run');
  console.log('========================================\n');

  const ready = await etlTablesReady();
  if (!ready) {
    console.error('✗ Las tablas icb_* no existen. Ejecuta primero la migración 002.');
    process.exit(1);
  }

  const start = Date.now();
  console.log('Ejecutando los 9 collectors...\n');
  const results = await runAll('script_cli');
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  console.log('\n========================================');
  console.log('RESUMEN');
  console.log('========================================');
  let totalInserted = 0, totalUpdated = 0, totalRead = 0, totalSkipped = 0;
  for (const r of results) {
    const flag = r.result.status === 'SUCCESS' ? '✓' : r.result.status === 'PARTIAL' ? '~' : '✗';
    const line = `${flag} ${r.sourceCode.padEnd(22)} ${r.result.status.padEnd(8)} | leidos ${String(r.result.recordsRead).padStart(4)} | insertados ${String(r.result.recordsInserted).padStart(4)} | actualizados ${String(r.result.recordsUpdated).padStart(4)} | omitidos ${String(r.result.recordsSkipped).padStart(4)}`;
    console.log(line);
    if (r.result.errorMessage) console.log(`   ERROR: ${r.result.errorMessage}`);
    totalInserted += r.result.recordsInserted;
    totalUpdated += r.result.recordsUpdated;
    totalRead += r.result.recordsRead;
    totalSkipped += r.result.recordsSkipped;
  }
  console.log('----------------------------------------');
  const ok = results.filter(r => r.result.status === 'SUCCESS').length;
  const failed = results.filter(r => r.result.status === 'FAILED').length;
  const partial = results.filter(r => r.result.status === 'PARTIAL').length;
  console.log(`TOTALES: ${ok} OK, ${partial} parciales, ${failed} fallidos de ${results.length}`);
  console.log(`         Registros leídos=${totalRead}, insertados=${totalInserted}, actualizados=${totalUpdated}, omitidos=${totalSkipped}`);
  console.log(`         Tiempo total: ${elapsed}s`);

  await closeDb();
  process.exit(failed > 0 && ok === 0 ? 1 : 0);
}

main().catch(err => {
  console.error('\n✗ ETL FALLÓ:', err);
  process.exit(1);
});
