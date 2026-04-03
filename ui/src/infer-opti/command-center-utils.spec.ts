import { describe, expect, it } from 'vitest'
import {
  classifyJobStatus,
  escapeHtml,
  formatLogLineForHtml,
  isKrigingJob,
  jobTypeLabel,
  jobsToCsv,
  stringifyJobLogs,
} from './command-center-utils'

describe('classifyJobStatus', () => {
  it('mappe finished vers success', () => {
    expect(classifyJobStatus('finished')).toBe('success')
  })
  it('mappe failed vers failed', () => {
    expect(classifyJobStatus('failed')).toBe('failed')
  })
  it('mappe running', () => {
    expect(classifyJobStatus('running')).toBe('running')
  })
  it('mappe queued', () => {
    expect(classifyJobStatus('queued')).toBe('queued')
  })
})

describe('jobTypeLabel', () => {
  it('détecte Kriging', () => {
    expect(jobTypeLabel('kriging_gp_global_v1', '')).toBe('Kriging')
  })
  it('détecte Train IA', () => {
    expect(jobTypeLabel('rga_predictor', 'manual')).toBe('Train IA')
  })
})

describe('escapeHtml', () => {
  it('échappe les caractères spéciaux', () => {
    expect(escapeHtml('<script>')).toBe('&lt;script&gt;')
  })
})

describe('formatLogLineForHtml', () => {
  it('entoure [INFO] avec une classe', () => {
    expect(formatLogLineForHtml('[INFO] ok')).toContain('infer-opti-cc-log-info')
    expect(formatLogLineForHtml('[INFO] ok')).toContain('[INFO]')
  })
})

describe('stringifyJobLogs', () => {
  it('sérialise un objet JSON', () => {
    expect(stringifyJobLogs({ a: 1 })).toBe('{\n  "a": 1\n}')
  })
})

describe('jobsToCsv', () => {
  it('produit un en-tête et une ligne', () => {
    const csv = jobsToCsv([
      {
        id: 'x',
        model_target: 'kriging',
        trigger_reason: 't',
        status: 'queued',
        requested_at: '2026-01-01',
        started_at: null,
        finished_at: null,
      },
    ])
    expect(csv.split('\r\n')[0]).toContain('model_target')
    expect(csv).toContain('kriging')
  })
})

describe('isKrigingJob', () => {
  it('identifie kriging', () => {
    expect(isKrigingJob('kriging_gp_global_v1')).toBe(true)
    expect(isKrigingJob('rga_predictor')).toBe(false)
  })
})
