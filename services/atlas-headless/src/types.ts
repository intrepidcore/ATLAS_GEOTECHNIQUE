/**
 * types.ts — Shared types for atlas-headless worker
 * Mirrors atlas.hq_export_jobs schema (migration 180)
 */

export type JobStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
export type Engine = 'puppeteer' | 'maplibre';

export interface HqOutputOptions {
  format: 'png' | 'pdf';
  dpi: number;
  width_px: number;
  height_px: number;
}

export interface HqStyleOptions {
  palette?: string;
  classification?: 'quantile' | 'jenks' | 'equal' | 'manual';
  n_classes?: number;
  show_empty_cells?: boolean;
  frame_style?: 'double' | 'single' | 'zebra' | 'none';
  mask_mode?: 'adm_boundary' | 'none';
}

export interface HqBbox {
  north: number;
  south: number;
  east: number;
  west: number;
}

/** Payload JSON stocke dans hq_export_jobs.payload */
export interface HqExportPayload {
  payload_version: '1.0';
  thematic_id: string;      // ex: "vbs_ked_h1", "cbr_95_ked_h1"
  adm_level: 'adm0' | 'adm1' | 'adm2' | 'adm3';
  adm_name?: string;
  grid?: '2km' | '5km';
  output: HqOutputOptions;
  style: HqStyleOptions;
  bbox?: HqBbox;
}

/** Ligne de la table hq_export_jobs */
export interface HqJob {
  id: string;
  status: JobStatus;
  progress: number;
  payload: HqExportPayload;
  engine: Engine;
  requested_by?: string;
  created_at: Date;
  error_message?: string;
  result_path?: string;
}

/** Defauts appliques si options manquantes dans le payload */
export const DEFAULT_OUTPUT: HqOutputOptions = {
  format: 'png',
  dpi: 150,
  width_px: 2480,
  height_px: 3508,
};

export const DEFAULT_STYLE: HqStyleOptions = {
  palette: 'reds',
  classification: 'quantile',
  n_classes: 5,
  show_empty_cells: true,
  frame_style: 'double',
  mask_mode: 'adm_boundary',
};

/** Bbox par defaut : Togo entier */
export const TOGO_BBOX: HqBbox = {
  north: 11.15,
  south: 5.92,
  east:  1.87,
  west: -0.15,
};
