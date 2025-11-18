import { API_BASE_URL } from './api'

export type FilterType = 'regex' | 'sql_filter' | 'expression'

export interface SelectionResponse {
  ids: string[]
  count: number
  bbox?: {
    min_x: number
    min_y: number
    max_x: number
    max_y: number
    srid: number
  }
}

export const selectionApi = {
  async selectRegex(schema: string, table: string, pattern: string): Promise<SelectionResponse> {
    const res = await fetch(`${API_BASE_URL}/db/table/${schema}/${table}/select`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filter: pattern, filter_type: 'regex' }),
    })
    if (!res.ok) throw new Error((await res.json()).message || 'Selection error')
    return res.json()
  },

  async selectSql(schema: string, table: string, filterSql: string): Promise<SelectionResponse> {
    const res = await fetch(`${API_BASE_URL}/db/table/${schema}/${table}/select`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filter: filterSql, filter_type: 'sql_filter' }),
    })
    if (!res.ok) throw new Error((await res.json()).message || 'Selection error')
    return res.json()
  },
}
