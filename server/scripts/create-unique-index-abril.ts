/**
 * Crea FILTERED UNIQUE INDEX en (DocEntry, LineNum, ObjType) — solo
 * aplica a Fecha_Emision >= 2026-04-01.
 *
 *  - Marzo y meses anteriores NO se ven afectados (filtered index)
 *  - Abril+: cualquier intento de INSERT duplicado fallará con error 2601
 *  - DataFactory que reinserta los últimos 10 días generará ROLLBACKs
 *    en duplicados sin necesidad de SP fix
 *
 * IDEMPOTENTE: si el índice ya existe, no falla.
 */
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env'), override: true });

const INDEX_NAME = 'UX_ventas_doc_line_type_abril';
const FILTER_DATE = '2026-04-01';

async function main() {
  const { getDbPool, closeDb } = await import('../src/config/database');
  const pool = await getDbPool();

  // Verificar si ya existe
  const exists = await pool.request().query(`
    SELECT name, is_unique, has_filter, filter_definition
    FROM sys.indexes
    WHERE object_id = OBJECT_ID('dbo.stg_rpt_ventas_detallado')
      AND name = '${INDEX_NAME}'
  `);
  if (exists.recordset.length > 0) {
    console.log(`▸ El índice "${INDEX_NAME}" ya existe:`);
    console.table(exists.recordset);
    console.log('   No se hace nada (idempotente)');
    await closeDb();
    return;
  }

  // Validar que abril sea único antes de crear (sino fallaría)
  const v = await pool.request().query(`
    SELECT COUNT(*) AS filas, COUNT(DISTINCT CAST(DocEntry AS VARCHAR) + '|' + CAST(LineNum AS VARCHAR) + '|' + CAST(ObjType AS VARCHAR)) AS keys
    FROM dbo.stg_rpt_ventas_detallado
    WHERE Fecha_Emision >= '${FILTER_DATE}'
  `);
  const m = v.recordset[0];
  console.log(`▸ Pre-check abril+: ${m.filas} filas · ${m.keys} keys únicos`);
  if (m.filas !== m.keys) {
    throw new Error(`Aún hay duplicados en abril+ (${m.filas - m.keys}). Aborto creación de índice.`);
  }

  // Crear índice
  console.log(`\n▸ Creando FILTERED UNIQUE INDEX:`);
  console.log(`   Nombre: ${INDEX_NAME}`);
  console.log(`   Columnas: (DocEntry, LineNum, ObjType)`);
  console.log(`   Filtro: WHERE Fecha_Emision >= '${FILTER_DATE}'`);

  await pool.request().query(`
    CREATE UNIQUE INDEX ${INDEX_NAME}
    ON dbo.stg_rpt_ventas_detallado (DocEntry, LineNum, ObjType)
    WHERE Fecha_Emision >= '${FILTER_DATE}'
      AND DocEntry IS NOT NULL AND LineNum IS NOT NULL AND ObjType IS NOT NULL;
  `);
  console.log('\n✓ Índice creado');

  // Verificar
  const post = await pool.request().query(`
    SELECT i.name, i.is_unique, i.has_filter, i.filter_definition,
           STRING_AGG(c.name, ', ') WITHIN GROUP (ORDER BY ic.key_ordinal) AS cols
    FROM sys.indexes i
    JOIN sys.index_columns ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id
    JOIN sys.columns c ON c.object_id = i.object_id AND c.column_id = ic.column_id
    WHERE i.object_id = OBJECT_ID('dbo.stg_rpt_ventas_detallado')
      AND i.name = '${INDEX_NAME}'
    GROUP BY i.name, i.is_unique, i.has_filter, i.filter_definition
  `);
  console.log('\n▸ Índice verificado:');
  console.table(post.recordset);

  // Test: simular INSERT duplicado abril (en TX para rollback)
  console.log('\n▸ Test de protección — intentando insertar duplicado en abril (con ROLLBACK):');
  const tx = pool.transaction();
  await tx.begin();
  try {
    // Tomar una fila existente abril
    const sample = await tx.request().query(`
      SELECT TOP 1 DocEntry, LineNum, ObjType, Fecha_Emision, Pais, Numero_SAP
      FROM dbo.stg_rpt_ventas_detallado
      WHERE Fecha_Emision >= '${FILTER_DATE}'
    `);
    const s = sample.recordset[0];
    console.log(`   Sample: DocEntry=${s.DocEntry} LineNum=${s.LineNum} ObjType=${s.ObjType} (${s.Numero_SAP})`);

    try {
      await tx.request()
        .input('de', s.DocEntry).input('ln', s.LineNum).input('ot', s.ObjType)
        .input('f', s.Fecha_Emision).input('p', s.Pais).input('n', s.Numero_SAP)
        .query(`
          INSERT INTO dbo.stg_rpt_ventas_detallado
            (DocEntry, LineNum, ObjType, Fecha_Emision, Pais, Numero_SAP)
          VALUES (@de, @ln, @ot, @f, @p, @n);
        `);
      console.log('   ⚠ El INSERT NO falló — el índice no protegió. ROLLBACK.');
      await tx.rollback();
      throw new Error('Test failed: el índice no bloqueó duplicado');
    } catch (insertErr: any) {
      const msg = insertErr?.message || '';
      if (/duplicate|unique|2601|2627/i.test(msg)) {
        console.log(`   ✓ INSERT bloqueado correctamente: "${msg.split('\n')[0].substring(0, 100)}"`);
      } else {
        console.log(`   ⚠ Error inesperado: ${msg}`);
      }
      await tx.rollback();
    }
  } catch (e: any) {
    try { await tx.rollback(); } catch {}
    throw e;
  }

  await closeDb();
}

main().catch(e => { console.error('\n✗', e.message); process.exit(1); });
