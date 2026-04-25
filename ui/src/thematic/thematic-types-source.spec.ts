import { describe, expect, it } from 'vitest'
import {
  buildKedApiParameterId,
  getParametersForObjectifAndSource,
  KED_SELECT_PREFIX,
  listInterpolationBasesForObjectif,
} from './thematic-types'

describe('getParametersForObjectifAndSource', () => {
  it('base + argilosité conserve IP / VBS / Atterberg', () => {
    const p = getParametersForObjectifAndSource('argilosite', 'base')
    const ids = p.map((x) => x.id)
    expect(ids).toContain('ip_avg')
    expect(ids).toContain('vbs_avg')
    expect(ids).toContain('wl_avg')
  })

  it('interpolation + argilosité → bases KED (ked:*) sans entrées plates ip_derived_h*', () => {
    const p = getParametersForObjectifAndSource('argilosite', 'interpolation')
    const ids = p.map((x) => x.id)
    expect(ids.some((id) => id.startsWith(KED_SELECT_PREFIX))).toBe(true)
    expect(ids).toContain(`${KED_SELECT_PREFIX}vbs`)
    expect(ids).toContain(`${KED_SELECT_PREFIX}ip_derived`)
    expect(ids).not.toContain('kriging_vbs')
  })

  it('interpolation + gonflement → Eg (KED)', () => {
    const p = getParametersForObjectifAndSource('gonflement', 'interpolation')
    const ids = p.map((x) => x.id)
    expect(ids).toEqual([`${KED_SELECT_PREFIX}eg`])
  })

  it('interpolation + granulometrie → uniquement passant_2mm et passant_80um (bases KED)', () => {
    const p = getParametersForObjectifAndSource('granulometrie', 'interpolation')
    const ids = p.map((x) => x.id).sort()
    expect(ids).toEqual([`${KED_SELECT_PREFIX}passant_2mm`, `${KED_SELECT_PREFIX}passant_80um`].sort())
  })

  it('interpolation + couverture → data_density', () => {
    const p = getParametersForObjectifAndSource('couverture', 'interpolation')
    expect(p.map((x) => x.id)).toContain('data_density')
  })

  it('ia + argilosité → score IA + AG safety/cost', () => {
    const p = getParametersForObjectifAndSource('argilosite', 'ia')
    expect(p.map((x) => x.id).sort()).toEqual(
      ['ai_portance_kpa_infer', 'ai_rga_score_infer', 'ag_cout_millions', 'ag_safety_factor'].sort(),
    )
  })

  it('interpolation + personnalisé liste KED + densité', () => {
    const p = getParametersForObjectifAndSource('personnalise', 'interpolation')
    expect(p.length).toBeGreaterThanOrEqual(3)
    expect(p.some((x) => x.id === 'data_density')).toBe(true)
  })
})

describe('buildKedApiParameterId', () => {
  it('construit vbs_ked_h2 depuis base + horizon', () => {
    expect(buildKedApiParameterId('vbs', 'H2')).toBe('vbs_ked_h2')
  })
  it('construit ip_derived_h3', () => {
    expect(buildKedApiParameterId('ip_derived', 'H3')).toBe('ip_derived_h3')
  })
})

describe('listInterpolationBasesForObjectif', () => {
  it('argilosite expose VBS, IP, WL, WP, IP dérivé', () => {
    const bases = listInterpolationBasesForObjectif('argilosite')
    expect(bases.length).toBe(5)
  })
})
