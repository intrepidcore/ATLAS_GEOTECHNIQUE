import { API_BASE_URL } from './api'

// Types alignés sur backend /db_manager/types.rs
export type RowOperation = 'insert' | 'update' | 'delete'

export interface CreateStagingResponse {
  staging_id: string
  table_name: string
  schema_name: string
  created_at: string
  reason?: string
  row_count: number
  operations_count: number
}

export interface PreviewSummary {
  inserts: number
  updates: number
  deletes: number
  total: number
}

export interface StagingPreview {
  staging_id: string
  operations: Array<{
    op: RowOperation
    row_id?: string
    before?: Record<string, any>
    after?: Record<string, any>
  }>
  summary: PreviewSummary
}

export interface CommitResult {
  success: boolean
  rows_affected: number
  audit_id: string
}

export const stagingApiV2 = {
  async create(schema: string, table: string, reason?: string): Promise<CreateStagingResponse> {
    const res = await fetch(`${API_BASE_URL}/db/table/${schema}/${table}/staging`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    })
    if (!res.ok) throw new Error((await res.json()).message || 'Failed to create staging')
    return res.json()
  },

  async applyOperation(stagingId: string, op: RowOperation, data: Record<string, any>, rowId?: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/db/staging/${stagingId}/operation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ op, data, row_id: rowId }),
    })
    if (!res.ok) throw new Error((await res.json()).message || 'Failed to apply operation')
  },

  async preview(stagingId: string, limit?: number): Promise<StagingPreview> {
    let url = `${API_BASE_URL}/db/staging/${stagingId}/preview`
    if (limit) url += `?limit=${limit}`
    const res = await fetch(url)
    if (!res.ok) throw new Error((await res.json()).message || 'Failed to preview staging')
    return res.json()
  },

  async validate(stagingId: string) {
    const res = await fetch(`${API_BASE_URL}/db/staging/${stagingId}/validate`)
    if (!res.ok) throw new Error((await res.json()).message || 'Failed to validate staging')
    return res.json()
  },

  async commit(stagingId: string): Promise<CommitResult> {
    const res = await fetch(`${API_BASE_URL}/db/staging/${stagingId}/commit`, { method: 'POST' })
    if (!res.ok) throw new Error((await res.json()).message || 'Failed to commit staging')
    return res.json()
  },

  async cancel(stagingId: string) {
    const res = await fetch(`${API_BASE_URL}/db/staging/${stagingId}`, { method: 'DELETE' })
    if (!res.ok) throw new Error((await res.json()).message || 'Failed to cancel staging')
  },
}
