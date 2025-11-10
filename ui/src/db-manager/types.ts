// Types pour le gestionnaire de base de données

export interface DatabaseSchema {
  schemas: SchemaInfo[]
}

export interface SchemaInfo {
  name: string
  tables: TableInfo[]
  views: ViewInfo[]
}

export interface TableInfo {
  name: string
  schema: string
  row_count: number
  has_geom: boolean
  geom_column?: string
  geom_type?: string
  srid?: number
  columns: ColumnInfo[]
  primary_keys: string[]
  foreign_keys: ForeignKeyInfo[]
}

export interface ViewInfo {
  name: string
  schema: string
  is_materialized: boolean
  definition?: string
}

export interface ColumnInfo {
  name: string
  data_type: string
  is_nullable: boolean
  column_default?: string
  character_maximum_length?: number
  numeric_precision?: number
  numeric_scale?: number
  is_primary_key: boolean
  is_foreign_key: boolean
  ui_order?: number
  ui_visible: boolean
  ui_label?: string
  ui_unit?: string
}

export interface ForeignKeyInfo {
  column_name: string
  foreign_table_schema: string
  foreign_table_name: string
  foreign_column_name: string
}

export interface TableDataResponse {
  table_name: string
  schema_name: string
  columns: ColumnInfo[]
  rows: Record<string, any>[]
  total_count: number
  offset: number
  limit: number
}

export interface TableDataQuery {
  limit?: number
  offset?: number
  filter?: string
  order_by?: string
  order_dir?: 'ASC' | 'DESC'
}

export interface SelectionRequest {
  filter: string
  filter_type: 'regex' | 'sql_filter' | 'expression'
}

export interface SelectionResponse {
  ids: string[]
  count: number
  bbox?: BBox
}

export interface BBox {
  min_x: number
  min_y: number
  max_x: number
  max_y: number
  srid: number
}

export interface StagingInfo {
  staging_id: string
  table_name: string
  schema_name: string
  created_at: string
  reason?: string
  row_count: number
  operations_count: number
}

export interface CreateStagingRequest {
  reason?: string
}

export interface StagingRowOperation {
  op: 'insert' | 'update' | 'delete'
  data: Record<string, any>
  row_id?: string
}

export interface StagingValidationResult {
  is_valid: boolean
  errors: ValidationError[]
  warnings: ValidationWarning[]
}

export interface ValidationError {
  row_id?: string
  column?: string
  error_type: string
  message: string
}

export interface ValidationWarning {
  message: string
  affected_rows: number
}

export interface StagingPreview {
  staging_id: string
  operations: PreviewOperation[]
  summary: PreviewSummary
}

export interface PreviewOperation {
  op: 'insert' | 'update' | 'delete'
  row_id?: string
  before?: Record<string, any>
  after?: Record<string, any>
}

export interface PreviewSummary {
  inserts: number
  updates: number
  deletes: number
  total: number
}

export interface CommitResult {
  success: boolean
  rows_affected: number
  audit_id: string
}

export interface AddColumnRequest {
  name: string
  data_type: string
  is_nullable: boolean
  default_value?: string
  character_length?: number
  ui_label?: string
  ui_unit?: string
}

export interface DeleteColumnRequest {
  mode: 'soft' | 'hard'
  confirm_token?: string
}

export interface ColumnImpactAnalysis {
  column_name: string
  affected_rows: number
  dependent_views: string[]
  dependent_materialized_views: string[]
  dependent_functions: string[]
  dependent_triggers: string[]
}

export interface AuditLog {
  id: string
  table_name: string
  schema_name: string
  operation: string
  user_id?: string
  sql_query?: string
  rows_affected: number
  staging_id?: string
  created_at: string
  metadata?: any
}

export interface AuditQuery {
  limit?: number
  offset?: number
  operation?: string
  from_date?: string
  to_date?: string
}

export interface BackupInfo {
  backup_id: string
  tables: string[]
  created_at: string
  size_bytes: number
  description?: string
}

export interface CreateBackupRequest {
  tables: string[]
  description?: string
}

export interface RestoreResult {
  success: boolean
  tables_restored: string[]
  errors: string[]
}

export interface DbManagerError {
  error_type: string
  message: string
  details?: any
}

// Types pour l'état du gestionnaire
export interface DbManagerState {
  mode: 'read' | 'edit'
  selectedSchema?: string
  selectedTable?: string
  tableData?: TableDataResponse
  selection: Set<string>
  currentPage: number
  pageSize: number
  filter?: string
  orderBy?: string
  orderDir?: 'ASC' | 'DESC'
  staging?: StagingInfo
  backupBeforeEdit?: BackupInfo
}

// Types PostgreSQL supportés
export const POSTGRES_TYPES = [
  'bigint',
  'bigserial',
  'bit',
  'bit varying',
  'boolean',
  'box',
  'bytea',
  'character',
  'character varying',
  'cidr',
  'circle',
  'date',
  'double precision',
  'inet',
  'integer',
  'interval',
  'json',
  'jsonb',
  'line',
  'lseg',
  'macaddr',
  'macaddr8',
  'money',
  'numeric',
  'path',
  'pg_lsn',
  'pg_snapshot',
  'point',
  'polygon',
  'real',
  'smallint',
  'smallserial',
  'serial',
  'text',
  'time',
  'time with time zone',
  'timestamp',
  'timestamp with time zone',
  'tsquery',
  'tsvector',
  'txid_snapshot',
  'uuid',
  'xml',
  'geometry',
  'geography'
] as const

export type PostgresType = typeof POSTGRES_TYPES[number]
