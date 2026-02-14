export interface ThematicCacheEntry<T> {
  value: T
  createdAt: number
}

export interface ThematicCacheStats {
  size: number
  hits: number
  misses: number
  stores: number
  evictions: number
}

const MAX_CACHE_SIZE = 50

const thematicCache = new Map<string, ThematicCacheEntry<any>>()

const stats: ThematicCacheStats = {
  size: 0,
  hits: 0,
  misses: 0,
  stores: 0,
  evictions: 0
}

export function buildCacheKey(config: any): string {
  return JSON.stringify(config)
}

export function getThematicCacheStats(): ThematicCacheStats {
  return {
    ...stats,
    size: thematicCache.size
  }
}

export function clearThematicCache(): void {
  thematicCache.clear()
  stats.size = 0
  stats.hits = 0
  stats.misses = 0
  stats.stores = 0
  stats.evictions = 0
}

export function getFromThematicCache<T>(key: string): T | null {
  const disable = (window as any).__DISABLE_EXPORT_CACHE === true
  if (disable) return null

  const entry = thematicCache.get(key)
  if (!entry) {
    stats.misses++
    console.log('[CACHE] MISS', { key })
    return null
  }

  stats.hits++
  console.log('[CACHE] HIT', { key })
  return entry.value as T
}

export function storeInThematicCache<T>(key: string, value: T): void {
  const disable = (window as any).__DISABLE_EXPORT_CACHE === true
  if (disable) return

  thematicCache.set(key, { value, createdAt: Date.now() })
  stats.stores++

  if (thematicCache.size > MAX_CACHE_SIZE) {
    let oldestKey: string | null = null
    let oldestAt = Infinity
    for (const [k, v] of thematicCache.entries()) {
      if (v.createdAt < oldestAt) {
        oldestAt = v.createdAt
        oldestKey = k
      }
    }
    if (oldestKey) {
      thematicCache.delete(oldestKey)
      stats.evictions++
    }
  }

  console.log('[CACHE] STORE', { key })
}

export function logExportCacheSummary(payload: { totalMaps?: number; successful?: number; failed?: number } = {}): void {
  console.log('[EXPORT SUMMARY]', {
    ...payload,
    cache: getThematicCacheStats()
  })
}

;(window as any).__DISABLE_EXPORT_CACHE ??= false
;(window as any).__logExportCacheSummary = logExportCacheSummary
