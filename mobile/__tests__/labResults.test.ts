jest.mock('lucide-react-native', () => ({
  Beaker: 'Beaker', ChevronDown: 'ChevronDown', ChevronUp: 'ChevronUp',
  CircleCheck: 'CircleCheck', ClipboardPenLine: 'ClipboardPenLine', Plus: 'Plus', Save: 'Save',
}));

import { buildInput, validateForm } from '@/screens/LabResultsScreen';

describe('fiche de laboratoire mobile', () => {
  const base = {
    sampleCode: 'S-01-ECH-01', depthTop: '0', depthBottom: '1,5',
    description: 'Argile', condition: '', wl: '45', wp: '22', ipReport: '',
    vbs: '', eg: '', egClass: '', proctorDensity: '', proctorWater: '',
    cbr: '', rd: '', em: '', pl: '', pass2mm: '', pass80um: '',
  };

  it('accepte la virgule décimale et construit Atterberg', () => {
    expect(validateForm(base, new Set(['atterberg']), true)).toBeNull();
    const input = buildInput('sondage-1', base, new Set(['atterberg']), 'complete');
    expect(input.depth_bottom_m).toBe(1.5);
    expect(input.tests).toEqual({
      atterberg: { wl_pct: 45, wp_pct: 22, ip_rapport: undefined, norme: 'NF P 94-051' },
    });
  });

  it('refuse une profondeur inversée et WL inférieure à WP', () => {
    expect(validateForm({ ...base, depthBottom: '0' }, new Set(['atterberg']), true)).toContain('profondeur');
    expect(validateForm({ ...base, wl: '20', wp: '30' }, new Set(['atterberg']), true)).toContain('WL');
  });
});
