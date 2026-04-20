// ============================================================
// Inteligencia Comercial - ETL Types
// ============================================================

export interface CollectorContext {
  runId: number;           // ID del registro en icb_etl_run_log
  sourceId: number;        // ID de la fuente en icb_dim_source
  sourceCode: string;
  triggeredBy: string;     // cron_nightly, cron_weekly, manual_admin
}

export interface CollectorResult {
  recordsRead: number;
  recordsInserted: number;
  recordsUpdated: number;
  recordsSkipped: number;
  status: 'SUCCESS' | 'FAILED' | 'PARTIAL';
  errorMessage?: string;
  snapshots?: ParsedSnapshot[];  // opcional - para debugging
}

export interface ParsedSnapshot {
  documentTitle?: string | null;
  documentUrl?: string | null;
  documentType?: string | null;   // pdf, html, xlsx, csv, dataset
  periodLabel?: string | null;
  publicationDate?: string | null; // ISO date
  cropCode?: string | null;        // PAPA, MAIZ, etc (para mapear a crop_id)
  regionCode?: string | null;      // 01-25 (para mapear a region_id)
  categoryCode?: string | null;    // FUNGICIDAS, etc
  hectares?: number | null;
  productionValue?: number | null;
  opportunityScore?: number | null;
  opportunityLevel?: 'Alta' | 'Media' | 'Baja' | null;
  businessNote?: string | null;
  rawPayload?: string | null;      // HTML/JSON snippet para stg_raw_document
}

export type Frequency = 'daily' | 'weekly' | 'on_demand';

export interface CollectorDescriptor {
  sourceCode: string;
  frequency: Frequency;
  description: string;
}
