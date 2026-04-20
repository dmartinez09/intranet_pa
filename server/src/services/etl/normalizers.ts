// ============================================================
// Normalizers - mapean nombres crudos a códigos del catálogo icb_*
// ============================================================

import { getDbPool } from '../../config/database';

// Helper: quita tildes y baja a minúsculas
export function fold(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

// ---- Mapas en memoria (cargados una sola vez por run) ----

export interface CatalogMaps {
  cropByName: Map<string, number>;     // nombre_normalizado -> crop_id
  cropByCode: Map<string, number>;     // crop_code -> crop_id
  regionByName: Map<string, number>;   // depto_normalizado -> region_id
  regionByCode: Map<string, number>;   // region_code -> region_id
  categoryByCode: Map<string, number>; // category_code -> category_id
  sourceByCode: Map<string, number>;   // source_code -> source_id
}

export async function loadCatalogMaps(): Promise<CatalogMaps> {
  const pool = await getDbPool();
  const [crops, regions, cats, sources] = await Promise.all([
    pool.request().query(`SELECT crop_id, crop_code, crop_name_raw, crop_name_standard FROM dbo.icb_dim_crop WHERE active_flag=1`),
    pool.request().query(`SELECT region_id, region_code, department FROM dbo.icb_dim_region WHERE active_flag=1`),
    pool.request().query(`SELECT category_id, category_code FROM dbo.icb_dim_point_category WHERE active_flag=1`),
    pool.request().query(`SELECT source_id, source_code FROM dbo.icb_dim_source WHERE active_flag=1`),
  ]);

  const cropByName = new Map<string, number>();
  const cropByCode = new Map<string, number>();
  for (const r of crops.recordset) {
    cropByCode.set(String(r.crop_code).toUpperCase(), r.crop_id);
    if (r.crop_name_raw) cropByName.set(fold(r.crop_name_raw), r.crop_id);
    if (r.crop_name_standard) cropByName.set(fold(r.crop_name_standard), r.crop_id);
  }

  const regionByName = new Map<string, number>();
  const regionByCode = new Map<string, number>();
  for (const r of regions.recordset) {
    regionByCode.set(String(r.region_code), r.region_id);
    if (r.department) regionByName.set(fold(r.department), r.region_id);
  }

  const categoryByCode = new Map<string, number>();
  for (const r of cats.recordset) {
    categoryByCode.set(String(r.category_code).toUpperCase(), r.category_id);
  }

  const sourceByCode = new Map<string, number>();
  for (const r of sources.recordset) {
    sourceByCode.set(String(r.source_code).toUpperCase(), r.source_id);
  }

  return { cropByName, cropByCode, regionByName, regionByCode, categoryByCode, sourceByCode };
}

// ---- Detección de cultivo en texto libre ----

export function detectCrop(text: string, maps: CatalogMaps): number | null {
  if (!text) return null;
  const folded = ' ' + fold(text) + ' ';
  for (const [name, id] of maps.cropByName) {
    // Match por palabra completa (rodeado por espacios o bordes)
    const re = new RegExp(`\\b${name}\\b`, 'i');
    if (re.test(folded)) return id;
  }
  return null;
}

// ---- Detección de departamento en texto libre ----

export function detectRegion(text: string, maps: CatalogMaps): number | null {
  if (!text) return null;
  const folded = ' ' + fold(text) + ' ';
  // Iterar por longitud descendente para que "madre de dios" gane a "lima"
  const entries = Array.from(maps.regionByName.entries()).sort((a, b) => b[0].length - a[0].length);
  for (const [name, id] of entries) {
    const re = new RegExp(`\\b${name}\\b`, 'i');
    if (re.test(folded)) return id;
  }
  return null;
}

// ---- Detección de categoría Point Andina por keywords ----

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  FUNGICIDAS:   ['fungicida', 'fungus', 'hongo', 'mildiu', 'royas', 'oidio', 'antracnosis'],
  INSECTICIDAS: ['insecticida', 'insecto', 'plaga', 'mosca', 'pulgon', 'trip', 'acaro', 'gusano'],
  HERBICIDAS:   ['herbicida', 'maleza', 'hierba'],
  BIOLOGICOS:   ['biologico', 'bioestimulante', 'biofertil', 'inoculante', 'rhizobium', 'trichoderma'],
  COADYUVANTES: ['coadyuvante', 'adyuvante', 'surfactante', 'humectante', 'esparcidor'],
  ORGANICOS:    ['organico', 'certificacion organica', 'eco'],
};

export function detectCategory(text: string, maps: CatalogMaps): number | null {
  if (!text) return null;
  const f = fold(text);
  for (const [code, kws] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const kw of kws) {
      if (f.includes(kw)) {
        const id = maps.categoryByCode.get(code);
        if (id) return id;
      }
    }
  }
  return null;
}

// ---- Parseo de hectáreas / cifras ----

export function parseHectares(s: string): number | null {
  if (!s) return null;
  // Quita " ha", " has", " hectáreas" y separadores de miles
  const cleaned = s
    .replace(/[.,](?=\d{3}\b)/g, '')  // quita separadores de miles
    .replace(/[^\d,.-]/g, '')
    .replace(',', '.');
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

// ---- Parseo fecha de publicación ES (intenta varios formatos) ----

export function parsePublicationDate(s: string): string | null {
  if (!s) return null;
  const clean = fold(s.trim());

  // ISO YYYY-MM-DD
  const iso = clean.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  // DD/MM/YYYY o DD-MM-YYYY
  const dmy = clean.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (dmy) {
    const d = dmy[1].padStart(2, '0'), m = dmy[2].padStart(2, '0'), y = dmy[3];
    return `${y}-${m}-${d}`;
  }

  // "15 de marzo de 2024"
  const months: Record<string, string> = {
    enero: '01', febrero: '02', marzo: '03', abril: '04', mayo: '05', junio: '06',
    julio: '07', agosto: '08', septiembre: '09', octubre: '10', noviembre: '11', diciembre: '12',
  };
  const m2 = clean.match(/(\d{1,2})\s+de\s+([a-z]+)\s+de\s+(\d{4})/);
  if (m2) {
    const d = m2[1].padStart(2, '0');
    const mo = months[m2[2]] || null;
    const y = m2[3];
    if (mo) return `${y}-${mo}-${d}`;
  }

  return null;
}
