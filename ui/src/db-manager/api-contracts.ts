// API Contracts - Types partagés entre UI et backend
// Généré manuellement - À terme, générer depuis OpenAPI spec

// ============================================================================
// Schema & Metadata
// ============================================================================

export interface PostgresType {
  name: string
  category: string
  requires_length: boolean
  requires_precision: boolean
  requires_scale: boolean
  description: string
}

export interface ColumnInfo {
  name: string
  data_type: string
  is_nullable: boolean
  is_primary_key: boolean
  default_value?: string
  character_maximum_length?: number
  numeric_precision?: number
  numeric_scale?: number
  ui_label?: string
  ui_unit?: string
}

export interface ForeignKeyInfo {
  constraint_name: string
  column_name: string
  foreign_table_schema: string
  foreign_table_name: string
  foreign_column_name: string
}

export interface TableInfo {
  name: string
  schema: string
  table_type?: 'TABLE' | 'VIEW' | 'MATERIALIZED VIEW'
  row_count: number
  has_geom: boolean
  geom_column?: string
  geom_type?: string
  srid?: number
  columns: ColumnInfo[]
  primary_keys: string[]
  foreign_keys: ForeignKeyInfo[]
}

export interface SchemaInfo {
  name: string
  tables: TableInfo[]
  views: ViewInfo[]
}

export interface ViewInfo {
  name: string
  schema: string
  is_materialized: boolean
  definition?: string
}

export interface DatabaseSchema {
  schemas: SchemaInfo[]
}

// ============================================================================
// Table Data
// ============================================================================

export interface TableDataQuery {
  limit?: number
  offset?: number
  order_by?: string
  order_dir?: 'ASC' | 'DESC'
  filter?: Record<string, any>
}

export interface TableDataResponse {
  rows: Record<string, any>[]
  total_count: number
  columns: ColumnInfo[]
  has_more: boolean
}

// ============================================================================
// Staging
// ============================================================================

export interface StagingInfo {
  staging_id: string
  table_name: string
  schema_name: string
  created_at: string
  row_count: number
}

export interface StagingValidationError {
  message: string
  affected_rows: number
}

export interface StagingValidationWarning {
  message: string
  affected_rows: number
}

export interface StagingValidationResult {
  is_valid: boolean
  errors: StagingValidationError[]
  warnings: StagingValidationWarning[]
}

export interface StagingPreview {
  inserts: number
  updates: number
  deletes: number
  total: number
  sample_rows: Record<string, any>[]
}

export interface CommitResult {
  success: boolean
  rows_affected: number
  audit_id: string
}

// ============================================================================
// DDL Operations
// ============================================================================

export interface AddColumnRequest {
  name: string
  data_type: string
  is_nullable: boolean
  default_value?: string
  ui_label?: string
  ui_unit?: string
}

export interface AffectedObject {
  object_type: string  // 'table', 'view', 'index', 'constraint'
  object_name: string
  impact: string       // 'modified', 'dropped', 'recreated'
}

export interface DryRunResult {
  sql: string
  estimated_duration_ms?: number
  affected_objects: AffectedObject[]
  warnings: string[]
  is_safe: boolean
}

// ============================================================================
// Backup & Restore
// ============================================================================

export interface CreateBackupRequest {
  tables: string[]
  description?: string
}

export interface BackupInfo {
  backup_id: string
  tables: string[]
  created_at: string
  size_bytes: number
  description?: string
}

export interface RestoreResult {
  success: boolean
  tables_restored: string[]
  rows_restored: number
}

// ============================================================================
// Audit
// ============================================================================

export interface AuditLogEntry {
  id: string
  table_name: string
  schema_name: string
  operation: string
  rows_affected: number
  user_id?: string
  staging_id?: string
  created_at: string
  details?: Record<string, any>
}

export interface AuditStats {
  total_operations: number
  operations_by_type: Record<string, number>
  last_operation?: AuditLogEntry
}

// ============================================================================
// Error Response
// ============================================================================

export interface ApiError {
  code: string
  message: string
  details?: Record<string, any>
}
