import { describe, expect, it } from 'vitest'
import { formatExpertTableCell, renderCell, statusBadge, qualityBadge } from './expert-table-format'

describe('formatExpertTableCell', () => {
  it('affiche les scalaires en texte', () => {
    expect(formatExpertTableCell(null)).toBe('—')
    expect(formatExpertTableCell(undefined)).toBe('—')
    expect(formatExpertTableCell(42)).toBe('42')
    expect(formatExpertTableCell('x')).toBe('x')
  })

  it('sérialise les objets JSON (évite [object Object])', () => {
    expect(formatExpertTableCell({ a: 1, b: [2] })).toBe('{"a":1,"b":[2]}')
  })
})

describe('renderCell', () => {
  it('returns — for null/undefined', () => {
    expect(renderCell(null)).toEqual(expect.objectContaining({ props: expect.objectContaining({ children: '—' }) }))
    expect(renderCell(undefined)).toEqual(expect.objectContaining({ props: expect.objectContaining({ children: '—' }) }))
  })

  it('returns string for numbers', () => {
    expect(renderCell(42)).toBe('42')
    expect(renderCell(3.14159)).toBe('3.1416')
  })

  it('returns string for strings', () => {
    expect(renderCell('hello')).toBe('hello')
  })

  it('returns pre for objects (no [object Object])', () => {
    const result = renderCell({ foo: 'bar' })
    expect(result).toEqual(expect.objectContaining({ type: 'pre' }))
  })
})

describe('statusBadge', () => {
  it('returns correct badge for known statuses', () => {
    expect(statusBadge('queued')).toEqual(expect.objectContaining({ props: expect.objectContaining({ variant: 'warning' }) }))
    expect(statusBadge('running')).toEqual(expect.objectContaining({ props: expect.objectContaining({ variant: 'info' }) }))
    expect(statusBadge('finished')).toEqual(expect.objectContaining({ props: expect.objectContaining({ variant: 'success' }) }))
    expect(statusBadge('failed')).toEqual(expect.objectContaining({ props: expect.objectContaining({ variant: 'destructive' }) }))
  })
})

describe('qualityBadge', () => {
  it('returns excellent for low ratio', () => {
    expect(qualityBadge(0.1, 1.0)).toEqual(expect.objectContaining({ props: expect.objectContaining({ variant: 'success' }) }))
  })
  it('returns bon for medium ratio', () => {
    expect(qualityBadge(0.4, 1.0)).toEqual(expect.objectContaining({ props: expect.objectContaining({ variant: 'info' }) }))
  })
  it('returns acceptable for high ratio', () => {
    expect(qualityBadge(0.8, 1.0)).toEqual(expect.objectContaining({ props: expect.objectContaining({ variant: 'warning' }) }))
  })
})
