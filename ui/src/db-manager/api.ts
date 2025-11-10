// Client API pour le gestionnaire de base de données
const API_GEO = (
  localStorage.getItem('API_GEO') ?? 
  (import.meta as any).env?.VITE_API_GEO ?? 
  (window as any).__API_GEO__ ?? 
  '/api'
) as string

import type {
  DatabaseSchema,
  TableInfo,
  TableDataResponse,
  TableDataQuery,
  SelectionRequest,
  SelectionResponse,
  StagingInfo,
  CreateStagingRequest,
  StagingRowOperation,
  StagingValidationResult,
  StagingPreview,
  CommitResult,
  AddColumnRequest,
  DeleteColumnRequest,
  ColumnImpactAnalysis,
  AuditLog,
  AuditQuery,
  BackupInfo,
  CreateBackupRequest,
  RestoreResult
} from './types'

const BASE_URL = '/db'

// ============================================================================
// Schema & Table Info
// ============================================================================

export async function getSchema(): Promise<DatabaseSchema> {
  const response = await fetch(`${API_GEO}${BASE_URL}/schema`)
  return response.json()
}

export async function getTableInfo(schema: string, table: string): Promise<TableInfo> {
  const response = await fetch(`${API_GEO}${BASE_URL}/table/${schema}/${table}`)
  return response.json()
}

// ============================================================================
// Table Data
// ============================================================================

export async function getTableData(
  schema: string,
  table: string,
  query?: TableDataQuery
): Promise<TableDataResponse> {
  const params = new URLSearchParams()
  if (query?.limit) params.append('limit', query.limit.toString())
  if (query?.offset) params.append('offset', query.offset.toString())
  if (query?.filter) params.append('filter', query.filter)
  if (query?.order_by) params.append('order_by', query.order_by)
  if (query?.order_dir) params.append('order_dir', query.order_dir)
  
  const url = `${API_GEO}${BASE_URL}/table/${schema}/${table}/data${params.toString() ? '?' + params.toString() : ''}`
  const response = await fetch(url)
  return response.json()
}

export async function selectRows(
  schema: string,
  table: string,
  request: SelectionRequest
): Promise<SelectionResponse> {
  const response = await http.post(`${BASE_URL}/table/${schema}/${table}/select`, request)
  return response.data
}

export async function addRow(schema: string, table: string): Promise<{ id: string }> {
  const response = await http.post(`${BASE_URL}/table/${schema}/${table}/row`)
  return response.data
}

export async function updateCell(
  schema: string,
  table: string,
  rowId: string,
  column: string,
  value: any
): Promise<void> {
  await http.put(`${BASE_URL}/table/${schema}/${table}/row/${rowId}/${column}`, value)
}

export async function deleteRows(
  schema: string,
  table: string,
  rowIds: string[]
): Promise<{ deleted: number }> {
  const response = await http.delete(`${BASE_URL}/table/${schema}/${table}/rows`, {
    data: rowIds
  })
  return response.data
}

// ============================================================================
// Staging
// ============================================================================

export async function createStaging(
  schema: string,
  table: string,
  request: CreateStagingRequest
): Promise<StagingInfo> {
  const response = await http.post(`${BASE_URL}/table/${schema}/${table}/staging`, request)
  return response.data
}

export async function applyStagingOperation(
  stagingId: string,
  operation: StagingRowOperation
): Promise<void> {
  await http.post(`${BASE_URL}/staging/${stagingId}/operation`, operation)
}

export async function validateStaging(stagingId: string): Promise<StagingValidationResult> {
  const response = await http.get(`${BASE_URL}/staging/${stagingId}/validate`)
  return response.data
}

export async function previewStaging(
  stagingId: string,
  limit?: number
): Promise<StagingPreview> {
  const params = limit ? `?limit=${limit}` : ''
  const response = await http.get(`${BASE_URL}/staging/${stagingId}/preview${params}`)
  return response.data
}

export async function commitStaging(stagingId: string): Promise<CommitResult> {
  const response = await http.post(`${BASE_URL}/staging/${stagingId}/commit`)
  return response.data
}

export async function cancelStaging(stagingId: string): Promise<void> {
  await http.delete(`${BASE_URL}/staging/${stagingId}`)
}

// ============================================================================
// Column Operations
// ============================================================================

export async function addColumn(
  schema: string,
  table: string,
  request: AddColumnRequest
): Promise<void> {
  await http.post(`${BASE_URL}/table/${schema}/${table}/column`, request)
}

export async function deleteColumn(
  schema: string,
  table: string,
  column: string,
  request: DeleteColumnRequest
): Promise<void> {
  await http.delete(`${BASE_URL}/table/${schema}/${table}/column/${column}`, {
    data: request
  })
}

export async function analyzeColumnImpact(
  schema: string,
  table: string,
  column: string
): Promise<ColumnImpactAnalysis> {
  const response = await http.get(`${BASE_URL}/table/${schema}/${table}/column/${column}/impact`)
  return response.data
}

// ============================================================================
// Audit
// ============================================================================

export async function getAuditLog(
  schema: string,
  table: string,
  query?: AuditQuery
): Promise<AuditLog[]> {
  const params = new URLSearchParams()
  if (query?.limit) params.append('limit', query.limit.toString())
  if (query?.offset) params.append('offset', query.offset.toString())
  if (query?.operation) params.append('operation', query.operation)
  if (query?.from_date) params.append('from_date', query.from_date)
  if (query?.to_date) params.append('to_date', query.to_date)
  
  const url = `${BASE_URL}/table/${schema}/${table}/audit${params.toString() ? '?' + params.toString() : ''}`
  const response = await http.get(url)
  return response.data
}

export async function getAuditStats(
  schema: string,
  table: string
): Promise<Record<string, any>> {
  const response = await http.get(`${BASE_URL}/table/${schema}/${table}/audit/stats`)
  return response.data
}

// ============================================================================
// Backup
// ============================================================================

export async function createBackup(request: CreateBackupRequest): Promise<BackupInfo> {
  const response = await http.post(`${BASE_URL}/backup`, request)
  return response.data
}

export async function listBackups(): Promise<BackupInfo[]> {
  const response = await http.get(`${BASE_URL}/backup`)
  return response.data
}

export async function restoreBackup(backupId: string): Promise<RestoreResult> {
  const response = await http.post(`${BASE_URL}/backup/${backupId}/restore`)
  return response.data
}

export async function deleteBackup(backupId: string): Promise<void> {
  await http.delete(`${BASE_URL}/backup/${backupId}`)
}
