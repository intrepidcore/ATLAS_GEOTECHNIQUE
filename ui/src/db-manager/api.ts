// Client API pour le gestionnaire de base de données
import { getApiBase } from '../api-base'

const API_GEO = getApiBase()

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

function getAuthHeaders(): HeadersInit {
  const token =
    localStorage.getItem('atlas_token') ||
    localStorage.getItem('atlas_access_token') ||
    (() => {
      try {
        const auth = localStorage.getItem('atlas_auth')
        return auth ? JSON.parse(auth).accessToken : null
      } catch {
        return null
      }
    })()

  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function httpJson<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_GEO}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  const text = await res.text()
  const data = text ? JSON.parse(text) : null

  if (!res.ok) {
    const msg = data?.message || data?.error || `HTTP ${res.status}: ${res.statusText}`
    throw new Error(msg)
  }

  return data as T
}

// ============================================================================
// Schema & Table Info
// ============================================================================

export async function getSchema(): Promise<DatabaseSchema> {
  const response = await fetch(`${API_GEO}${BASE_URL}/schema`, {
    headers: getAuthHeaders(),
  })
  return response.json()
}

export async function getTableInfo(schema: string, table: string): Promise<TableInfo> {
  const response = await fetch(`${API_GEO}${BASE_URL}/table/${schema}/${table}`, {
    headers: getAuthHeaders(),
  })
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
  const response = await fetch(url, {
    headers: getAuthHeaders(),
  })
  return response.json()
}

export async function selectRows(
  schema: string,
  table: string,
  request: SelectionRequest
): Promise<SelectionResponse> {
  return httpJson<SelectionResponse>('POST', `${BASE_URL}/table/${schema}/${table}/select`, request)
}

export async function addRow(schema: string, table: string): Promise<{ id: string }> {
  return httpJson<{ id: string }>('POST', `${BASE_URL}/table/${schema}/${table}/row`)
}

export async function updateCell(
  schema: string,
  table: string,
  rowId: string,
  column: string,
  value: any
): Promise<void> {
  await httpJson<void>('PUT', `${BASE_URL}/table/${schema}/${table}/row/${rowId}/${column}`, value)
}

export async function deleteRows(
  schema: string,
  table: string,
  rowIds: string[]
): Promise<{ deleted: number }> {
  return httpJson<{ deleted: number }>('DELETE', `${BASE_URL}/table/${schema}/${table}/rows`, rowIds)
}

// ============================================================================
// Staging
// ============================================================================

export async function createStaging(
  schema: string,
  table: string,
  request: CreateStagingRequest
): Promise<StagingInfo> {
  return httpJson<StagingInfo>('POST', `${BASE_URL}/table/${schema}/${table}/staging`, request)
}

export async function applyStagingOperation(
  stagingId: string,
  operation: StagingRowOperation
): Promise<void> {
  await httpJson<void>('POST', `${BASE_URL}/staging/${stagingId}/operation`, operation)
}

export async function validateStaging(stagingId: string): Promise<StagingValidationResult> {
  return httpJson<StagingValidationResult>('GET', `${BASE_URL}/staging/${stagingId}/validate`)
}

export async function previewStaging(
  stagingId: string,
  limit?: number
): Promise<StagingPreview> {
  const params = limit ? `?limit=${limit}` : ''
  return httpJson<StagingPreview>('GET', `${BASE_URL}/staging/${stagingId}/preview${params}`)
}

export async function commitStaging(stagingId: string): Promise<CommitResult> {
  return httpJson<CommitResult>('POST', `${BASE_URL}/staging/${stagingId}/commit`)
}

export async function cancelStaging(stagingId: string): Promise<void> {
  await httpJson<void>('DELETE', `${BASE_URL}/staging/${stagingId}`)
}

// ============================================================================
// Column Operations
// ============================================================================

export async function addColumn(
  schema: string,
  table: string,
  request: AddColumnRequest
): Promise<void> {
  await httpJson<void>('POST', `${BASE_URL}/table/${schema}/${table}/column`, request)
}

export async function deleteColumn(
  schema: string,
  table: string,
  column: string,
  request: DeleteColumnRequest
): Promise<void> {
  await httpJson<void>('DELETE', `${BASE_URL}/table/${schema}/${table}/column/${column}`, request)
}

export async function analyzeColumnImpact(
  schema: string,
  table: string,
  column: string
): Promise<ColumnImpactAnalysis> {
  return httpJson<ColumnImpactAnalysis>('GET', `${BASE_URL}/table/${schema}/${table}/column/${column}/impact`)
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
  return httpJson<AuditLog[]>('GET', url)
}

export async function getAuditStats(
  schema: string,
  table: string
): Promise<Record<string, any>> {
  return httpJson<Record<string, any>>('GET', `${BASE_URL}/table/${schema}/${table}/audit/stats`)
}

// ============================================================================
// Backup
// ============================================================================

export async function createBackup(request: CreateBackupRequest): Promise<BackupInfo> {
  return httpJson<BackupInfo>('POST', `${BASE_URL}/backup`, request)
}

export async function listBackups(): Promise<BackupInfo[]> {
  return httpJson<BackupInfo[]>('GET', `${BASE_URL}/backup`)
}

export async function restoreBackup(backupId: string): Promise<RestoreResult> {
  return httpJson<RestoreResult>('POST', `${BASE_URL}/backup/${backupId}/restore`)
}

export async function deleteBackup(backupId: string): Promise<void> {
  await httpJson<void>('DELETE', `${BASE_URL}/backup/${backupId}`)
}
