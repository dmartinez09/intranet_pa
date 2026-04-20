// ============================================================
// Opportunity scoring - calcula score 0-100 y nivel
// Heurísticas simples; ajustables cuando haya datos reales
// ============================================================

import { ParsedSnapshot } from './types';

/**
 * Calcula opportunity_score en rango 0..100:
 * - Base 20
 * - +40 si hay cultivo detectado
 * - +15 si hay región detectada
 * - +15 si hay categoría PA detectada
 * - +10 si hay hectáreas numéricas
 * Luego se convierte a nivel:
 *   >=70 Alta, >=40 Media, resto Baja
 */
export function scoreSnapshot(s: ParsedSnapshot): ParsedSnapshot {
  let score = 20;
  if (s.cropCode) score += 40;
  if (s.regionCode) score += 15;
  if (s.categoryCode) score += 15;
  if (s.hectares && s.hectares > 0) score += 10;

  const level: 'Alta' | 'Media' | 'Baja' =
    score >= 70 ? 'Alta' : score >= 40 ? 'Media' : 'Baja';

  return { ...s, opportunityScore: Math.min(100, score), opportunityLevel: level };
}
