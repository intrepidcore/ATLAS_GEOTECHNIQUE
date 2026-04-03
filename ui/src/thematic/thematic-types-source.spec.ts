import { describe, expect, it } from 'vitest'
import { getParametersForObjectifAndSource } from './thematic-types'

describe('getParametersForObjectifAndSource', () => {
  it('base + argilosité conserve IP / VBS / Atterberg', () => {
    const p = getParametersForObjectifAndSource('argilosite', 'base')
    const ids = p.map((x) => x.id)
    expect(ids).toContain('ip_avg')
    expect(ids).toContain('vbs_avg')
    expect(ids).toContain('wl_avg')
  })

  it('interpolation + argilosité → ip_derived_h* + kriging_vbs', () => {
    const p = getParametersForObjectifAndSource('argilosite', 'interpolation')
    const ids = p.map((x) => x.id)
    expect(ids).toContain('ip_derived_h1')
    expect(ids).toContain('ip_derived_h2')
    expect(ids).toContain('ip_derived_h3')
    expect(ids).toContain('kriging_vbs')
    expect(ids).not.toContain('kriging_ip')
  })

  it('interpolation + gonflement → aucun param (pas de kriging EG en thématique API)', () => {
    const p = getParametersForObjectifAndSource('gonflement', 'interpolation')
    expect(p).toEqual([])
  })

  it('interpolation + granulometrie → passant_*_ked_h*', () => {
    const p = getParametersForObjectifAndSource('granulometrie', 'interpolation')
    const ids = p.map((x) => x.id)
    expect(ids).toContain('passant_2mm_ked_h1')
    expect(ids).toContain('passant_2mm_ked_h2')
    expect(ids).toContain('passant_2mm_ked_h3')
    expect(ids).toContain('passant_80um_ked_h1')
    expect(ids).toContain('passant_80um_ked_h2')
    expect(ids).toContain('passant_80um_ked_h3')
  })

  it('ia + argilosité → score IA + AG safety/cost', () => {
    const p = getParametersForObjectifAndSource('argilosite', 'ia')
    expect(p.map((x) => x.id).sort()).toEqual(
      ['ai_portance_kpa_infer', 'ai_rga_score_infer', 'ag_safety_factor', 'ag_cout_millions'].sort(),
    )
  })

  it('ne force pas ia_ag: interpolation + personnalisé liste tout kriging', () => {
    const p = getParametersForObjectifAndSource('personnalise', 'interpolation')
    expect(p.length).toBeGreaterThanOrEqual(2)
    expect(p.some((x) => x.id === 'kriging_ip')).toBe(true)
  })
})
