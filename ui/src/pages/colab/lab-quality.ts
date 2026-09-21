export interface LabQualityInput {
  sondage_id: string;
  sample_code: string;
  depth_top_m: number;
  depth_bottom_m: number;
  tests: Record<string, any>;
  /**
   * Champs portés par le formulaire de saisie mais non contrôlés ici. Déclarés
   * pour que la fiche complète puisse être passée telle quelle : sans eux, un
   * littéral d'objet est rejeté par le contrôle des propriétés excédentaires.
   */
  sample?: Record<string, unknown>;
  status?: string;
}

function fieldWarning(label: string, value: unknown, min: number, max: number, warnings: string[]) {
  if (typeof value === 'number' && (value < min || value > max)) {
    warnings.push(`${label} doit être compris entre ${min} et ${max}.`);
  }
}

export function qualityWarnings(form: LabQualityInput): string[] {
  const warnings: string[] = [];
  if (!form.sondage_id) warnings.push('Sélectionnez un sondage lié à la mission.');
  if (!form.sample_code.trim()) warnings.push('Le code échantillon est obligatoire.');
  if (form.depth_top_m < 0 || form.depth_bottom_m <= form.depth_top_m) warnings.push('La profondeur basse doit être supérieure à la profondeur haute.');
  const t = form.tests;
  fieldWarning('VBS', t.vbs?.vbs_g100g, 0, 30, warnings);
  fieldWarning('WL', t.atterberg?.wl_pct, 20, 120, warnings);
  fieldWarning('WP', t.atterberg?.wp_pct, 10, 60, warnings);
  if (typeof t.atterberg?.wl_pct === 'number' && typeof t.atterberg?.wp_pct === 'number' && t.atterberg.wl_pct < t.atterberg.wp_pct) warnings.push('WL doit être supérieure ou égale à WP.');
  fieldWarning('EG', t.gonflement?.eg_pct, 0, 20, warnings);
  fieldWarning('Densité sèche Proctor', t.proctor?.gamma_d_max_knm3, 10, 26, warnings);
  fieldWarning('Teneur en eau optimale', t.proctor?.w_opt_pct, 2, 30, warnings);
  fieldWarning('CBR', t.cbr?.cbr_pct, 0, 200, warnings);
  fieldWarning('Résistance dynamique', t.penetrometre?.rd_mpa, 0, 150, warnings);
  fieldWarning('Module pressiométrique', t.pressiometre?.em_mpa, 0, 100, warnings);
  fieldWarning('Pression limite', t.pressiometre?.pl_mpa, 0, 10, warnings);
  (t.granulometrie?.points ?? []).forEach((point: Record<string, unknown>) => fieldWarning('Passant granulométrique', point.passant_pct, 0, 100, warnings));
  if (t.vbs && !t.vbs.methode) warnings.push('La méthode/fraction VBS est indispensable.');
  if (t.proctor && !t.proctor.provenance) warnings.push('La provenance Proctor est indispensable.');
  if (t.cbr && !t.cbr.provenance) warnings.push('La provenance CBR est indispensable.');
  if (Object.keys(t).length === 0) warnings.push('Ajoutez au moins un type d’essai.');
  return warnings;
}
