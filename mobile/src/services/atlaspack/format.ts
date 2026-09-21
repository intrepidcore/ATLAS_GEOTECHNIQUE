/** Types miroir de services/api-geo/src/atlaspack/format.rs — ne pas diverger. */

export const FORMAT_VERSION = 1;
export const SCHEMA_VERSION = 1;

export const MANIFEST_FILE = 'manifest.json';
export const SIGNATURE_FILE = 'manifest.sig';
export const DATA_FILE = 'data.bin';
export const MBTILES_FILE = 'maps/offline.mbtiles';

export const RETURN_MANIFEST_FILE = 'manifest.json';
export const RETURN_MAC_FILE = 'manifest.mac';
export const RETURN_DATA_FILE = 'data.json';

export interface FileEntry {
  sha256: string;
  size_bytes: number;
}

export interface MapCoverage {
  zoom_min: number;
  zoom_max_requested: number;
  zoom_max_actual: number;
  tile_count: number;
  truncated: boolean;
  truncation_reason: string | null;
  bounds: [number, number, number, number];
}

export interface PackageManifest {
  format_version: number;
  schema_version: number;
  package_id: string;
  operator_user_id: string;
  operator_email: string;
  generated_at: string;
  expires_at: string;
  signing_key_id: string;
  mission_ids: string[];
  password_hash_algorithm: string;
  password_salt_b64: string;
  password_argon2_m_cost: number;
  password_argon2_t_cost: number;
  password_argon2_p_cost: number;
  password_hash_len: number;
  files: Record<string, FileEntry>;
  map_coverage: MapCoverage | null;
}

export interface OperatorIdentity {
  user_id: string;
  student_id: string | null;
  email: string;
  first_name: string | null;
  last_name: string | null;
  password_hash_phc: string;
}

export interface PackedPlannedPoint {
  id: string;
  numero: number;
  label: string | null;
  lat: number;
  lon: number;
  confirmed_sondage_id: string | null;
}

export interface PackedSondageMarker {
  id: string;
  code: string | null;
  longitude: number;
  latitude: number;
  status: string | null;
}

export interface PackedMission {
  id: string;
  code: string;
  title: string;
  theme: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  maille_id: string | null;
  maille_label: string | null;
  commune: string | null;
  region: string | null;
  expected_sondages: number;
  maille_geojson: unknown | null;
  bbox: [number, number, number, number] | null;
  center_lon: number | null;
  center_lat: number | null;
  tolerance_m: number;
  planned_points: PackedPlannedPoint[];
  existing_sondages: PackedSondageMarker[];
}

export interface OperatorPayload {
  schema_version: number;
  operator: OperatorIdentity;
  missions: PackedMission[];
  default_tolerance_m: number;
}

// ── .atlasreturn ────────────────────────────────────────────────────────

export interface ReturnManifest {
  format_version: number;
  export_id: string;
  package_id: string | null;
  operator_user_id: string;
  operator_email: string;
  generated_at: string;
  missions_count: number;
  sondages_count: number;
  essais_count: number;
  resultats_count: number;
  attachments_count: number;
  size_bytes: number;
  sha256: string;
  files: Record<string, FileEntry>;
}

export interface ReturnedSondage {
  id: string;
  mission_id: string;
  planned_point_id: string | null;
  code: string;
  longitude: number;
  latitude: number;
  location_accuracy_m: number | null;
  depth_m: number | null;
  layers_count: number | null;
  profile_description: string | null;
  notes: string | null;
  point_name: string | null;
  relocation_reason: string | null;
  created_at: string;
}

export interface ReturnedLabResult {
  id: string;
  mission_id: string;
  sondage_id: string;
  sample_code: string;
  depth_top_m: number;
  depth_bottom_m: number;
  sample: unknown;
  tests: unknown;
  status: string;
  created_at: string;
}

export interface ReturnedFieldLog {
  id: string;
  mission_id: string;
  log_type: string;
  content: string;
  longitude: number | null;
  latitude: number | null;
  created_at: string;
}

export interface ReturnedAttachment {
  id: string;
  sondage_id: string;
  mission_id: string | null;
  kind: string;
  file_name: string;
  content_type: string;
  caption: string | null;
  taken_at: string | null;
  archive_path: string;
  sha256: string;
  size_bytes: number;
}

export interface ReturnedAuditEvent {
  id: string;
  mission_id: string | null;
  event_type: string;
  occurred_at: string;
  object_type: string | null;
  object_id: string | null;
  old_values: unknown;
  new_values: unknown;
  metadata: unknown;
}

export interface ReturnData {
  schema_version: number;
  sondages: ReturnedSondage[];
  lab_results: ReturnedLabResult[];
  field_logs: ReturnedFieldLog[];
  attachments: ReturnedAttachment[];
  audit_events: ReturnedAuditEvent[];
}
