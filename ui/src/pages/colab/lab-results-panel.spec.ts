import { describe, expect, it } from 'vitest';
import { qualityWarnings } from './lab-quality';

describe('qualityWarnings', () => {
  it('accepte une fiche complète avec des valeurs cohérentes', () => {
    expect(qualityWarnings({
      sondage_id: 'sondage-1',
      sample_code: 'S1-ECH-01',
      depth_top_m: 0,
      depth_bottom_m: 1,
      sample: {},
      tests: { atterberg: { wl_pct: 45, wp_pct: 22 } },
      status: 'complete',
    })).toEqual([]);
  });

  it('signale les plages invalides et les provenances manquantes', () => {
    const warnings = qualityWarnings({
      sondage_id: 'sondage-1',
      sample_code: 'S1-ECH-02',
      depth_top_m: 1,
      depth_bottom_m: 2,
      sample: {},
      tests: {
        vbs: { vbs_g100g: 31 },
        atterberg: { wl_pct: 20, wp_pct: 30 },
        proctor: { gamma_d_max_knm3: 40 },
      },
      status: 'draft',
    });

    expect(warnings).toContain('VBS doit être compris entre 0 et 30.');
    expect(warnings).toContain('WL doit être supérieure ou égale à WP.');
    expect(warnings).toContain('La méthode/fraction VBS est indispensable.');
    expect(warnings).toContain('La provenance Proctor est indispensable.');
  });
});
