// API simplifiée pour le gestionnaire de BDD
import { getApiBase } from '../api-base'
import { tokenStorage } from '../services/token-storage'

const API_GEO = getApiBase()

import type { DatabaseSchema, TableDataResponse, TableDataQuery, PostgresType } from './types'

const BASE_URL = '/db'

// Helper pour obtenir les headers d'authentification
function getAuthHeaders(): HeadersInit {
  const token = tokenStorage.getAccessToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export async function getPostgresTypes(): Promise<PostgresType[]> {
  const response = await fetch(`${API_GEO}${BASE_URL}/types`, {
    headers: getAuthHeaders()
  })
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`)
  }
  
  const text = await response.text()
  if (!text || text.trim() === '') {
    throw new Error('Empty response from server')
  }
  
  try {
    return JSON.parse(text)
  } catch (err) {
    console.error('Failed to parse JSON:', text)
    throw new Error('Invalid JSON response from server')
  }
}

export async function getSchema(): Promise<DatabaseSchema> {
  const response = await fetch(`${API_GEO}${BASE_URL}/schema`, {
    headers: getAuthHeaders()
  })
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`)
  }
  
  const text = await response.text()
  if (!text || text.trim() === '') {
    throw new Error('Empty response from server')
  }
  
  try {
    return JSON.parse(text)
  } catch (err) {
    console.error('Failed to parse JSON:', text)
    throw new Error('Invalid JSON response from server')
  }
}

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
    headers: getAuthHeaders()
  })
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`)
  }
  
  const text = await response.text()
  if (!text || text.trim() === '') {
    throw new Error('Empty response from server')
  }
  
  try {
    return JSON.parse(text)
  } catch (err) {
    console.error('Failed to parse JSON:', text)
    throw new Error('Invalid JSON response from server')
  }
}
