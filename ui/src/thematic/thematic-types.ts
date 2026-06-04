// Types et interfaces pour les cartes thématiques v2.0
// Organisation métier pour ingénieurs géotechniciens

// ============================================================================
// OBJECTIFS MÉTIER - Bloc A
// ============================================================================

export type ObjectifMetier = 
  | 'couverture'      // Couverture & instrumentation
  | 'argilosite'      // Argilosité / plasticité
  | 'gonflement'      // Potentiel de gonflement
  | 'compacite'       // Compacité / portance (Proctor)
  | 'granulometrie'   // Granulométrie
  | 'contexte'        // Contexte géographique
  | 'ia_ag'           // IA / Interpolation / AG
  | 'personnalise'    // Power user - tous les paramètres

export interface ObjectifConfig {
  id: ObjectifMetier
  label: string
  description: string
  /** @deprecated Ancien champ emoji — l'UI utilise des icônes Lucide dans thematic-panel */
  icon: string
  parameters: string[]  // IDs des paramètres associés
  defaultParameter: string
  defaultPalette: string
}

export const OBJECTIFS_METIER: ObjectifConfig[] = [
  {
    id: 'couverture',
    label: 'Couverture & instrumentation',
    description: 'Densité de sondages et essais par maille',
    icon: '',
    parameters: ['n_sondages', 'n_echantillons', 'n_essais_total'],
    defaultParameter: 'n_sondages',
    defaultPalette: 'Greens'
  },
  {
    id: 'argilosite',
    label: 'Argilosité / plasticité',
    description: 'Caractérisation de la fraction argileuse',
    icon: '',
    parameters: ['vbs_avg', 'ip_avg', 'wl_avg', 'wp_avg'],
    defaultParameter: 'vbs_avg',
    defaultPalette: 'YlOrRd'
  },
  {
    id: 'gonflement',
    label: 'Potentiel de gonflement',
    description: 'Risque de gonflement des argiles',
    icon: '',
    parameters: ['eg_avg', 'eg_max', 'eg_min'],
    defaultParameter: 'eg_avg',
    defaultPalette: 'Blues'
  },
  {
    id: 'compacite',
    label: 'Compacité / portance (Proctor)',
    description: 'Caractéristiques de compactage',
    icon: '',
    parameters: ['gamma_d_max_avg', 'w_opt_avg'],
    defaultParameter: 'gamma_d_max_avg',
    defaultPalette: 'Oranges'
  },
  {
    id: 'granulometrie',
    label: 'Granulométrie',
    description: 'Distribution granulométrique',
    icon: '',
    parameters: ['passant_80um_avg', 'passant_2mm_avg', 'passant_20mm_avg'],
    defaultParameter: 'passant_80um_avg',
    defaultPalette: 'BrBG'
  },
  {
    id: 'contexte',
    label: 'Contexte géographique',
    description: 'Paramètres géographiques et topographiques',
    icon: '',
    parameters: ['altitude_mean'],
    defaultParameter: 'altitude_mean',
    defaultPalette: 'Terrain'
  },
  {
    id: 'ia_ag',
    label: 'IA / Interpolation / AG',
    description: 'Sources de donnees derivees: IA infer, kriging proxy, AG fondation, L1-L4 ML',
    icon: '',
    parameters: [
      'ai_rga_score_infer', 'ai_portance_kpa_infer',
      'kriging_ip', 'kriging_vbs',
      'ag_safety_factor', 'ag_cout_millions', 'data_density',
      // L2a RK-SCORPAN
      'vbs_rk_h1', 'vbs_rk_h2', 'vbs_rk_h3',
      'ip_rk_h1', 'ip_rk_h2', 'ip_rk_h3',
      'wl_rk_h1', 'wl_rk_h2', 'wl_rk_h3',
      'wp_rk_h1', 'wp_rk_h2', 'wp_rk_h3',
      'eg_rk_h1', 'eg_rk_h2', 'eg_rk_h3',
      // L2b BLUP
      'vbs_blup_h1', 'vbs_blup_h2', 'vbs_blup_h3',
      'ip_blup_h1', 'ip_blup_h2', 'ip_blup_h3',
      'wl_blup_h1', 'wl_blup_h2', 'wl_blup_h3',
      'wp_blup_h1', 'wp_blup_h2', 'wp_blup_h3',
      'eg_blup_h1', 'eg_blup_h2', 'eg_blup_h3',
      // L4 MTGP
      'vbs_mtgp_h1', 'vbs_mtgp_h2', 'vbs_mtgp_h3',
      'ip_mtgp_h1', 'ip_mtgp_h2', 'ip_mtgp_h3',
      'eg_mtgp_h1', 'eg_mtgp_h2', 'eg_mtgp_h3',
      // L3 VfS
      'vbs_vfs',
    ],
    defaultParameter: 'vbs_blup_h1',
    defaultPalette: 'YlOrRd'
  },
  {
    id: 'personnalise',
    label: 'Personnalisé',
    description: 'Accès à tous les paramètres disponibles',
    icon: '',
    parameters: [], // Tous les paramètres
    defaultParameter: 'n_sondages',
    defaultPalette: 'Greens'
  }
]

// ============================================================================
// PARAMÈTRES THÉMATIQUES
// ============================================================================

export type ParameterCategory = 'density' | 'granulo' | 'atterberg' | 'vbs' | 'proctor' | 'gonflement' | 'contexte' | 'ai'
export type ThematicSource =
  | 'base'        // Données terrain (mesures sondages)
  | 'l1_ked'      // ML L1 — KED Hiérarchique 5 niveaux
  | 'l2a_rk'      // ML L2a — RK-SCORPAN
  | 'l2b_blup'    // ML L2b — Fusion Bayésienne BLUP
  | 'l3_vfs'      // ML L3 — VfS-PLS (Sentinel-2, VBS surface)
  | 'l4_mtgp'     // ML L4 — MTGP/ICM (Multi-Tâches)
  | 'interpolation' // Legacy alias → équivaut à l1_ked
  | 'ia'            // Legacy alias → équivaut à l4_mtgp

export interface ThematicParameter {
  id: string
  label: string
  unit: string
  category: ParameterCategory
  description: string
  formula?: string           // Formule pour tooltip
  defaultBreaks?: number[]
  defaultPalette?: string
  minEssaisField?: string    // Champ pour filtre "essais minimum"
  /** Anciens IDs kriging_vbs / kriging_ip — masqués du catalogue interpolation moderne */
  deprecated?: boolean
}

export const THEMATIC_PARAMETERS: ThematicParameter[] = [
  // ─────────────────────────────────────────────────────────────────────────
  // COUVERTURE & INSTRUMENTATION
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'n_sondages',
    label: 'Nombre de sondages',
    unit: '',
    category: 'density',
    description: 'Densité de sondages par maille (UTM 2 km × 2 km)',
    defaultBreaks: [1, 2, 3, 4, 5],
    defaultPalette: 'Greens'
  },
  {
    id: 'n_echantillons',
    label: 'Nombre d\'échantillons',
    unit: '',
    category: 'density',
    description: 'Nombre total d\'échantillons prélevés par maille',
    defaultPalette: 'Greens'
  },
  {
    id: 'n_essais_total',
    label: 'Nombre d\'essais',
    unit: '',
    category: 'density',
    description: 'Nombre total d\'essais géotechniques par maille',
    defaultPalette: 'Greens'
  },

  // ─────────────────────────────────────────────────────────────────────────
  // ARGILOSITÉ / PLASTICITÉ
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'vbs_avg',
    label: 'VBS moyen',
    unit: 'g/100g',
    category: 'vbs',
    description: 'Valeur de Bleu de Méthylène moyenne - mesure de l\'argilosité',
    formula: 'VBS = masse de bleu absorbé / masse de sol sec × 100',
    defaultBreaks: [0.2, 1.5, 2.5, 6, 8],
    defaultPalette: 'YlOrRd',
    minEssaisField: 'n_essais_vbs'
  },
  {
    id: 'ip_avg',
    label: 'IP moyen',
    unit: '%',
    category: 'atterberg',
    description: 'Indice de plasticité moyen - caractérise la plasticité du sol',
    formula: 'IP = WL - WP',
    defaultBreaks: [7, 12, 25, 40],
    defaultPalette: 'PuRd',
    minEssaisField: 'n_essais_atterberg'
  },
  {
    id: 'wl_avg',
    label: 'Limite de liquidité WL',
    unit: '%',
    category: 'atterberg',
    description: 'Teneur en eau à la transition plastique → liquide',
    defaultPalette: 'PuBu',
    minEssaisField: 'n_essais_atterberg'
  },
  {
    id: 'wp_avg',
    label: 'Limite de plasticité WP',
    unit: '%',
    category: 'atterberg',
    description: 'Teneur en eau à la transition solide → plastique',
    defaultPalette: 'BuPu',
    minEssaisField: 'n_essais_atterberg'
  },

  // ─────────────────────────────────────────────────────────────────────────
  // IP dérivé (P5): WL_ked - WP_ked par horizon
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'ip_derived_h1',
    label: 'IP dérivé H1 (0.5m)',
    unit: '%',
    category: 'atterberg',
    description: 'Indice de plasticité dérivé: WL_ked - WP_ked (clipping négatif à 0)',
    formula: 'IP_derived = max(0, WL_ked - WP_ked)',
    defaultBreaks: [7, 12, 25, 40],
    defaultPalette: 'PuRd',
    minEssaisField: 'n_essais_atterberg'
  },
  {
    id: 'ip_derived_h2',
    label: 'IP dérivé H2 (1.5m)',
    unit: '%',
    category: 'atterberg',
    description: 'Indice de plasticité dérivé: WL_ked - WP_ked (clipping négatif à 0)',
    formula: 'IP_derived = max(0, WL_ked - WP_ked)',
    defaultBreaks: [7, 12, 25, 40],
    defaultPalette: 'PuRd',
    minEssaisField: 'n_essais_atterberg'
  },
  {
    id: 'ip_derived_h3',
    label: 'IP dérivé H3 (2.0m)',
    unit: '%',
    category: 'atterberg',
    description: 'Indice de plasticité dérivé: WL_ked - WP_ked (clipping négatif à 0)',
    formula: 'IP_derived = max(0, WL_ked - WP_ked)',
    defaultBreaks: [7, 12, 25, 40],
    defaultPalette: 'PuRd',
    minEssaisField: 'n_essais_atterberg'
  },

  // ─────────────────────────────────────────────────────────────────────────
  // POTENTIEL DE GONFLEMENT
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'eg_avg',
    label: 'Eg moyen',
    unit: '%',
    category: 'gonflement',
    description: 'Potentiel de gonflement moyen - risque de gonflement des argiles',
    formula: 'Eg = (h_final - h_initial) / h_initial × 100',
    defaultBreaks: [0.5, 2, 5, 10],
    defaultPalette: 'Reds',
    minEssaisField: 'n_essais_gonflement'
  },
  {
    id: 'eg_max',
    label: 'Eg maximum',
    unit: '%',
    category: 'gonflement',
    description: 'Potentiel de gonflement maximal observé (pire cas)',
    defaultBreaks: [1, 3, 7, 12],
    defaultPalette: 'Reds',
    minEssaisField: 'n_essais_gonflement'
  },
  {
    id: 'eg_min',
    label: 'Eg minimum',
    unit: '%',
    category: 'gonflement',
    description: 'Potentiel de gonflement minimal observé',
    defaultPalette: 'Greens',
    minEssaisField: 'n_essais_gonflement'
  },

  // ─────────────────────────────────────────────────────────────────────────
  // COMPACITÉ / PORTANCE (PROCTOR)
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'gamma_d_max_avg',
    label: 'γd,max moyen',
    unit: 't/m³',
    category: 'proctor',
    description: 'Densité sèche maximale moyenne au Proctor',
    formula: 'γd,max = masse sèche / volume à compactage optimal',
    defaultBreaks: [1.6, 1.8, 2.0, 2.2],
    defaultPalette: 'Oranges',
    minEssaisField: 'n_essais_proctor'
  },
  {
    id: 'w_opt_avg',
    label: 'wopt moyenne',
    unit: '%',
    category: 'proctor',
    description: 'Teneur en eau optimale moyenne pour compactage',
    formula: 'wopt = teneur en eau à γd,max',
    defaultBreaks: [8, 12, 18, 25],
    defaultPalette: 'Blues',
    minEssaisField: 'n_essais_proctor'
  },

  // ─────────────────────────────────────────────────────────────────────────
  // GRANULOMÉTRIE
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'passant_80um_avg',
    label: '% Passant 80µm',
    unit: '%',
    category: 'granulo',
    description: 'Fraction argileuse + limoneuse (< 80µm)',
    defaultBreaks: [12, 35, 50, 70],
    defaultPalette: 'BrBG',
    minEssaisField: 'n_essais_granulo'
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Passant (P4 KED granulométrie) par horizon
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'passant_80um_ked_h1',
    label: '% Passant 80µm KED H1 (0.5m)',
    unit: '%',
    category: 'granulo',
    description: 'Fraction argileuse + limoneuse (< 80µm) interpolée KED via résiduels par horizon',
    defaultBreaks: [12, 35, 50, 70],
    defaultPalette: 'BrBG',
    minEssaisField: 'n_essais_granulo'
  },
  {
    id: 'passant_80um_ked_h2',
    label: '% Passant 80µm KED H2 (1.5m)',
    unit: '%',
    category: 'granulo',
    description: 'Fraction argileuse + limoneuse (< 80µm) interpolée KED via résiduels par horizon',
    defaultBreaks: [12, 35, 50, 70],
    defaultPalette: 'BrBG',
    minEssaisField: 'n_essais_granulo'
  },
  {
    id: 'passant_80um_ked_h3',
    label: '% Passant 80µm KED H3 (2.0m)',
    unit: '%',
    category: 'granulo',
    description: 'Fraction argileuse + limoneuse (< 80µm) interpolée KED via résiduels par horizon',
    defaultBreaks: [12, 35, 50, 70],
    defaultPalette: 'BrBG',
    minEssaisField: 'n_essais_granulo'
  },

  // ─────────────────────────────────────────────────────────────────────────
  // CONTEXTE GÉOGRAPHIQUE
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'altitude_mean',
    label: 'Altitude moyenne (DSM COP30)',
    unit: 'm',
    category: 'contexte',
    description: 'Altitude moyenne par maille issue du Modèle Numérique de Surface Copernicus DEM GLO-30',
    defaultBreaks: [100, 200, 300, 400, 500],
    defaultPalette: 'Terrain'
  },

  {
    id: 'passant_2mm_avg',
    label: '% Passant 2mm',
    unit: '%',
    category: 'granulo',
    description: 'Fraction sable + fines (< 2mm)',
    defaultPalette: 'YlGnBu',
    minEssaisField: 'n_essais_granulo'
  },

  {
    id: 'passant_2mm_ked_h1',
    label: '% Passant 2mm KED H1 (0.5m)',
    unit: '%',
    category: 'granulo',
    description: 'Fraction sable + fines (< 2mm) interpolée KED via résiduels par horizon',
    defaultPalette: 'YlGnBu',
    minEssaisField: 'n_essais_granulo'
  },
  {
    id: 'passant_2mm_ked_h2',
    label: '% Passant 2mm KED H2 (1.5m)',
    unit: '%',
    category: 'granulo',
    description: 'Fraction sable + fines (< 2mm) interpolée KED via résiduels par horizon',
    defaultPalette: 'YlGnBu',
    minEssaisField: 'n_essais_granulo'
  },
  {
    id: 'passant_2mm_ked_h3',
    label: '% Passant 2mm KED H3 (2.0m)',
    unit: '%',
    category: 'granulo',
    description: 'Fraction sable + fines (< 2mm) interpolée KED via résiduels par horizon',
    defaultPalette: 'YlGnBu',
    minEssaisField: 'n_essais_granulo'
  },
  {
    id: 'passant_20mm_avg',
    label: '% Passant 20mm',
    unit: '%',
    category: 'granulo',
    description: 'Fraction graviers + fines (< 20mm)',
    defaultPalette: 'YlGnBu',
    minEssaisField: 'n_essais_granulo'
  },
  {
    id: 'ai_rga_score_infer',
    label: 'Score RGA IA (infer)',
    unit: 'score',
    category: 'ai',
    description: 'Score de risque RGA predit par modele IA supervisé-like',
    defaultPalette: 'YlOrRd'
  },
  {
    id: 'ai_portance_kpa_infer',
    label: 'Portance IA estimee',
    unit: 'kPa',
    category: 'ai',
    description: 'Capacite portante estimee par le modele IA',
    defaultPalette: 'Blues'
  },
  {
    id: 'kriging_ip',
    label: 'IP interpole (kriging proxy)',
    unit: '%',
    category: 'ai',
    description: 'Interpolation intra-maille de l indice de plasticite',
    defaultPalette: 'PuRd',
    deprecated: true,
  },
  {
    id: 'kriging_vbs',
    label: 'VBS interpole (kriging proxy)',
    unit: 'g/100g',
    category: 'ai',
    description: 'Interpolation intra-maille de la VBS',
    defaultPalette: 'YlOrRd',
    deprecated: true,
  },

  // ─────────────────────────────────────────────────────────────────────────
  // REGRESSION KRIGING SCORPAN (VBS)
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'vbs_rk_h1',
    label: 'VBS RK H1 (1.0m)',
    unit: 'g/100g',
    category: 'ai',
    description: 'VBS interpolée par Regression Kriging SCORPAN - Horizon 1 (0.5-1.5m)',
    defaultBreaks: [0.5, 2, 4, 6, 8],
    defaultPalette: 'YlOrRd'
  },
  {
    id: 'vbs_rk_h2',
    label: 'VBS RK H2 (1.5m)',
    unit: 'g/100g',
    category: 'ai',
    description: 'VBS interpolée par Regression Kriging SCORPAN - Horizon 2 (1.0-2.0m)',
    defaultBreaks: [0.5, 2, 4, 6, 8],
    defaultPalette: 'YlOrRd'
  },
  {
    id: 'vbs_rk_h3',
    label: 'VBS RK H3 (2.0m)',
    unit: 'g/100g',
    category: 'ai',
    description: 'VBS interpolée par Regression Kriging SCORPAN - Horizon 3 (1.5-2.5m)',
    defaultBreaks: [0.5, 2, 4, 6, 8],
    defaultPalette: 'YlOrRd'
  },

  // ─────────────────────────────────────────────────────────────────────────
  // REGRESSION KRIGING SCORPAN (IP)
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'ip_rk_h1',
    label: 'IP RK H1 (1.0m)',
    unit: '%',
    category: 'ai',
    description: 'IP interpolé par Regression Kriging SCORPAN - Horizon 1 (0.5-1.5m)',
    defaultBreaks: [5, 10, 20, 35, 50],
    defaultPalette: 'PuRd'
  },
  {
    id: 'ip_rk_h2',
    label: 'IP RK H2 (1.5m)',
    unit: '%',
    category: 'ai',
    description: 'IP interpolé par Regression Kriging SCORPAN - Horizon 2 (1.0-2.0m)',
    defaultBreaks: [5, 10, 20, 35, 50],
    defaultPalette: 'PuRd'
  },
  {
    id: 'ip_rk_h3',
    label: 'IP RK H3 (2.0m)',
    unit: '%',
    category: 'ai',
    description: 'IP interpolé par Regression Kriging SCORPAN - Horizon 3 (1.5-2.5m)',
    defaultBreaks: [5, 10, 20, 35, 50],
    defaultPalette: 'PuRd'
  },

  // ─────────────────────────────────────────────────────────────────────────
  // REGRESSION KRIGING SCORPAN (WL)
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'wl_rk_h1',
    label: 'WL RK H1 (1.0m)',
    unit: '%',
    category: 'ai',
    description: 'Limite de liquidité interpolée par Regression Kriging SCORPAN - Horizon 1',
    defaultBreaks: [20, 35, 50, 65, 80],
    defaultPalette: 'PuBu'
  },
  {
    id: 'wl_rk_h2',
    label: 'WL RK H2 (1.5m)',
    unit: '%',
    category: 'ai',
    description: 'Limite de liquidité interpolée par Regression Kriging SCORPAN - Horizon 2',
    defaultBreaks: [20, 35, 50, 65, 80],
    defaultPalette: 'PuBu'
  },
  {
    id: 'wl_rk_h3',
    label: 'WL RK H3 (2.0m)',
    unit: '%',
    category: 'ai',
    description: 'Limite de liquidité interpolée par Regression Kriging SCORPAN - Horizon 3',
    defaultBreaks: [20, 35, 50, 65, 80],
    defaultPalette: 'PuBu'
  },

  // ─────────────────────────────────────────────────────────────────────────
  // REGRESSION KRIGING SCORPAN (WP)
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'wp_rk_h1',
    label: 'WP RK H1 (1.0m)',
    unit: '%',
    category: 'ai',
    description: 'Limite de plasticité interpolée par Regression Kriging SCORPAN - Horizon 1',
    defaultBreaks: [10, 20, 30, 40, 50],
    defaultPalette: 'BuPu'
  },
  {
    id: 'wp_rk_h2',
    label: 'WP RK H2 (1.5m)',
    unit: '%',
    category: 'ai',
    description: 'Limite de plasticité interpolée par Regression Kriging SCORPAN - Horizon 2',
    defaultBreaks: [10, 20, 30, 40, 50],
    defaultPalette: 'BuPu'
  },
  {
    id: 'wp_rk_h3',
    label: 'WP RK H3 (2.0m)',
    unit: '%',
    category: 'ai',
    description: 'Limite de plasticité interpolée par Regression Kriging SCORPAN - Horizon 3',
    defaultBreaks: [10, 20, 30, 40, 50],
    defaultPalette: 'BuPu'
  },

  // ─────────────────────────────────────────────────────────────────────────
  // REGRESSION KRIGING SCORPAN (EG - Gonflement)
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'eg_rk_h1',
    label: 'EG RK H1 (1.0m)',
    unit: '%',
    category: 'ai',
    description: 'Essai de Gonflement interpolé par Regression Kriging SCORPAN - Horizon 1',
    defaultBreaks: [0, 2, 4, 6, 10],
    defaultPalette: 'Blues'
  },
  {
    id: 'eg_rk_h2',
    label: 'EG RK H2 (1.5m)',
    unit: '%',
    category: 'ai',
    description: 'Essai de Gonflement interpolé par Regression Kriging SCORPAN - Horizon 2',
    defaultBreaks: [0, 2, 4, 6, 10],
    defaultPalette: 'Blues'
  },
  {
    id: 'eg_rk_h3',
    label: 'EG RK H3 (2.0m)',
    unit: '%',
    category: 'ai',
    description: 'Essai de Gonflement interpolé par Regression Kriging SCORPAN - Horizon 3',
    defaultBreaks: [0, 2, 4, 6, 10],
    defaultPalette: 'Blues'
  },

  {
    id: 'data_density',
    label: 'Densité de données (sondages à 20 km)',
    unit: 'count',
    category: 'density',
    description: 'Nombre de sondages dans un rayon de 20 km autour du centroïde de la maille (fiabilité)',
    defaultBreaks: [0, 1, 2, 3, 5, 10],
    defaultPalette: 'Viridis',
  },
  {
    id: 'ag_safety_factor',
    label: 'Facteur securite AG',
    unit: 'FS',
    category: 'ai',
    description: 'Facteur de securite de la strategie fondation AG',
    defaultPalette: 'Greens'
  },
  {
    id: 'ag_cout_millions',
    label: 'Cout AG',
    unit: 'M FCFA',
    category: 'ai',
    description: 'Cout estime de la strategie fondation AG',
    defaultPalette: 'Oranges'
  },

  // ─────────────────────────────────────────────────────────────────────────
  // L2b FUSION BLUP — API param = vbs_blup_h1, DB parameter_id = vbs_fusion_h1
  // ─────────────────────────────────────────────────────────────────────────
  { id: 'vbs_blup_h1', label: 'VBS BLUP H1 (0.5m)', unit: 'g/100g', category: 'ai',
    description: 'VBS Fusion BLUP (KED+RK bayésien) — Horizon 1 (0.5-1.5m)',
    defaultBreaks: [0.5, 2, 4, 6, 8], defaultPalette: 'YlOrRd' },
  { id: 'vbs_blup_h2', label: 'VBS BLUP H2 (1.5m)', unit: 'g/100g', category: 'ai',
    description: 'VBS Fusion BLUP (KED+RK bayésien) — Horizon 2 (1.0-2.0m)',
    defaultBreaks: [0.5, 2, 4, 6, 8], defaultPalette: 'YlOrRd' },
  { id: 'vbs_blup_h3', label: 'VBS BLUP H3 (2.0m)', unit: 'g/100g', category: 'ai',
    description: 'VBS Fusion BLUP (KED+RK bayésien) — Horizon 3 (1.5-2.5m)',
    defaultBreaks: [0.5, 2, 4, 6, 8], defaultPalette: 'YlOrRd' },

  { id: 'ip_blup_h1', label: 'IP BLUP H1 (0.5m)', unit: '%', category: 'ai',
    description: 'IP Fusion BLUP — Horizon 1', defaultBreaks: [5, 10, 20, 35, 50], defaultPalette: 'PuRd' },
  { id: 'ip_blup_h2', label: 'IP BLUP H2 (1.5m)', unit: '%', category: 'ai',
    description: 'IP Fusion BLUP — Horizon 2', defaultBreaks: [5, 10, 20, 35, 50], defaultPalette: 'PuRd' },
  { id: 'ip_blup_h3', label: 'IP BLUP H3 (2.0m)', unit: '%', category: 'ai',
    description: 'IP Fusion BLUP — Horizon 3', defaultBreaks: [5, 10, 20, 35, 50], defaultPalette: 'PuRd' },

  { id: 'wl_blup_h1', label: 'WL BLUP H1 (0.5m)', unit: '%', category: 'ai',
    description: 'WL Fusion BLUP — Horizon 1', defaultPalette: 'PuBu' },
  { id: 'wl_blup_h2', label: 'WL BLUP H2 (1.5m)', unit: '%', category: 'ai',
    description: 'WL Fusion BLUP — Horizon 2', defaultPalette: 'PuBu' },
  { id: 'wl_blup_h3', label: 'WL BLUP H3 (2.0m)', unit: '%', category: 'ai',
    description: 'WL Fusion BLUP — Horizon 3', defaultPalette: 'PuBu' },

  { id: 'wp_blup_h1', label: 'WP BLUP H1 (0.5m)', unit: '%', category: 'ai',
    description: 'WP Fusion BLUP — Horizon 1', defaultPalette: 'BuPu' },
  { id: 'wp_blup_h2', label: 'WP BLUP H2 (1.5m)', unit: '%', category: 'ai',
    description: 'WP Fusion BLUP — Horizon 2', defaultPalette: 'BuPu' },
  { id: 'wp_blup_h3', label: 'WP BLUP H3 (2.0m)', unit: '%', category: 'ai',
    description: 'WP Fusion BLUP — Horizon 3', defaultPalette: 'BuPu' },

  { id: 'eg_blup_h1', label: 'EG BLUP H1 (0.5m)', unit: '%', category: 'ai',
    description: 'EG Fusion BLUP — Horizon 1', defaultBreaks: [0, 2, 4, 6, 10], defaultPalette: 'Blues' },
  { id: 'eg_blup_h2', label: 'EG BLUP H2 (1.5m)', unit: '%', category: 'ai',
    description: 'EG Fusion BLUP — Horizon 2', defaultBreaks: [0, 2, 4, 6, 10], defaultPalette: 'Blues' },
  { id: 'eg_blup_h3', label: 'EG BLUP H3 (2.0m)', unit: '%', category: 'ai',
    description: 'EG Fusion BLUP — Horizon 3', defaultBreaks: [0, 2, 4, 6, 10], defaultPalette: 'Blues' },

  // ─────────────────────────────────────────────────────────────────────────
  // L4 MTGP/ICM — VBS/IP/EG × H1/H2/H3 (WL/WP non exposés dans l'API Rust)
  // ─────────────────────────────────────────────────────────────────────────
  { id: 'vbs_mtgp_h1', label: 'VBS MTGP H1 (0.5m)', unit: 'g/100g', category: 'ai',
    description: 'VBS MTGP/ICM (Multi-Tâches GPflow) — Horizon 1',
    defaultBreaks: [0.5, 2, 4, 6, 8], defaultPalette: 'YlOrRd' },
  { id: 'vbs_mtgp_h2', label: 'VBS MTGP H2 (1.5m)', unit: 'g/100g', category: 'ai',
    description: 'VBS MTGP/ICM — Horizon 2', defaultBreaks: [0.5, 2, 4, 6, 8], defaultPalette: 'YlOrRd' },
  { id: 'vbs_mtgp_h3', label: 'VBS MTGP H3 (2.0m)', unit: 'g/100g', category: 'ai',
    description: 'VBS MTGP/ICM — Horizon 3', defaultBreaks: [0.5, 2, 4, 6, 8], defaultPalette: 'YlOrRd' },

  { id: 'ip_mtgp_h1', label: 'IP MTGP H1 (0.5m)', unit: '%', category: 'ai',
    description: 'IP MTGP/ICM — Horizon 1', defaultBreaks: [5, 10, 20, 35, 50], defaultPalette: 'PuRd' },
  { id: 'ip_mtgp_h2', label: 'IP MTGP H2 (1.5m)', unit: '%', category: 'ai',
    description: 'IP MTGP/ICM — Horizon 2', defaultBreaks: [5, 10, 20, 35, 50], defaultPalette: 'PuRd' },
  { id: 'ip_mtgp_h3', label: 'IP MTGP H3 (2.0m)', unit: '%', category: 'ai',
    description: 'IP MTGP/ICM — Horizon 3', defaultBreaks: [5, 10, 20, 35, 50], defaultPalette: 'PuRd' },

  { id: 'eg_mtgp_h1', label: 'EG MTGP H1 (0.5m)', unit: '%', category: 'ai',
    description: 'EG MTGP/ICM — Horizon 1', defaultBreaks: [0, 2, 4, 6, 10], defaultPalette: 'Blues' },
  { id: 'eg_mtgp_h2', label: 'EG MTGP H2 (1.5m)', unit: '%', category: 'ai',
    description: 'EG MTGP/ICM — Horizon 2', defaultBreaks: [0, 2, 4, 6, 10], defaultPalette: 'Blues' },
  { id: 'eg_mtgp_h3', label: 'EG MTGP H3 (2.0m)', unit: '%', category: 'ai',
    description: 'EG MTGP/ICM — Horizon 3', defaultBreaks: [0, 2, 4, 6, 10], defaultPalette: 'Blues' },

  // ─────────────────────────────────────────────────────────────────────────
  // L3 VfS-PLS — Sentinel-2 (VBS surface uniquement)
  // ─────────────────────────────────────────────────────────────────────────
  { id: 'vbs_vfs', label: 'VBS VfS surface (Sentinel-2)', unit: 'g/100g', category: 'ai',
    description: 'VBS prédit par PLS spectral (SWIR B11/B12) — couverture partielle (végétation dense exclue)',
    defaultBreaks: [0.5, 2, 4, 6, 8], defaultPalette: 'YlOrRd' },
]

// ============================================================================
// TYPES DE CARTE - Bloc B
// ============================================================================

export type MapType = 'choropleth' | 'bubble' | 'binary' | 'heatmap'

export interface MapTypeConfig {
  id: MapType
  label: string
  description: string
  icon: string
}

export const MAP_TYPES: MapTypeConfig[] = [
  {
    id: 'choropleth',
    label: 'Choroplèthe (aplats)',
    description: 'Coloration des mailles selon la valeur',
    icon: ''
  },
  {
    id: 'bubble',
    label: 'Cercles proportionnels',
    description: 'Taille des cercles proportionnelle à la valeur',
    icon: ''
  },
  {
    id: 'binary',
    label: 'Binaire (présence/absence)',
    description: 'Zones couvertes vs non couvertes',
    icon: ''
  },
  {
    id: 'heatmap',
    label: 'Carte de chaleur (heatmap)',
    description: 'Densité de chaleur continue',
    icon: ''
  }
]

// ============================================================================
// MÉTHODES DE CLASSIFICATION
// ============================================================================

export type ClassificationMethod = 'quantiles' | 'equal_interval' | 'jenks' | 'manual'

export interface ClassificationConfig {
  id: ClassificationMethod
  label: string
  description: string
}

export const CLASSIFICATION_METHODS: ClassificationConfig[] = [
  {
    id: 'quantiles',
    label: 'Quantiles',
    description: 'Même nombre de mailles par classe (défaut, lisible)'
  },
  {
    id: 'equal_interval',
    label: 'Intervalles égaux',
    description: 'Même amplitude pour chaque classe'
  },
  {
    id: 'jenks',
    label: 'Seuils naturels (Jenks)',
    description: 'Minimise la variance intra-classe'
  },
  {
    id: 'manual',
    label: 'Seuils manuels',
    description: 'Définir ses propres seuils'
  }
]

// ============================================================================
// CONFIGURATION COMPLÈTE
// ============================================================================

export interface ThematicMapConfig {
  id?: string
  name: string
  
  // Bloc A - Objectif
  objectif: ObjectifMetier
  parameter: string

  /** Mode expert : hachure fiabilité (mailles avec < 3 sondages à 20 km) */
  expertReliabilityOverlay?: boolean
  
  // Bloc B - Style
  type: MapType
  classification: {
    method: ClassificationMethod
    n_classes: number
    manual_breaks?: number[]
    binary_threshold?: number  // Seuil pour carte binaire
  }
  style: {
    palette: string
    opacity: number
    stroke_width: number
    stroke_color: string
  }
  
  // Bloc C - Filtres
  filters: {
    // Spatial
    adm1?: string
    adm2?: string
    adm3?: string
    bbox?: [number, number, number, number]
    grid?: '2km' | '28km' | 'combined'  // Niveau de grille (ajouté pour support 28km + mode combiné UI)
    
    // Instrumentation
    min_sondages: number
    min_essais_param?: number
    exclude_no_data: boolean
    exclude_outside_adm?: boolean  // Exclure mailles hors sélection ADM
    
    // Géotechnique (avancé)
    depth_min?: number
    depth_max?: number
    year_min?: number
    year_max?: number
  }
  
  // Couches de contexte
  contextLayers?: {
    showGeologie: boolean
    showPedologie: boolean
    showRisqueGonflement: boolean
  }
}

// ============================================================================
// RÉPONSES API
// ============================================================================

export interface ThematicData {
  type: string
  features: GeoJSON.Feature[]
  statistics: Statistics
  metadata: ResponseMetadata
}

export interface Statistics {
  min: number
  max: number
  mean: number
  median: number
  stddev: number
  variance: number
  quantiles: {
    q25: number
    q50: number
    q75: number
    q90: number
    q95: number
  }
  count: number
  null_count: number
  // Champs enrichis (optionnels, depuis API v3.1)
  count_total?: number
  sum?: number
  parent_context?: {
    level: string
    parent_name: string
    parent_sum: number
    parent_cells: number
  }
}

export interface ResponseMetadata {
  parameter: string
  parameter_label: string
  unit: string
  category: string
  generated_at: string
  filters_applied: {
    grid?: '2km' | '28km'
    bbox?: [number, number, number, number]
    adm1?: string
    adm2?: string
    adm3?: string
    min_sondages?: number
  }
}

export interface Classification {
  breaks: number[]
  colors: string[]
  labels: string[]
  method: string
  n_classes: number
}

// ============================================================================
// TYPES EXPORT
// ============================================================================

export interface ThematicClassBreak {
  index: number        // 0,1,2,...
  min: number | null   // borne inf (null => "-∞")
  max: number | null   // borne sup (null => "+∞")
  color: string        // "#RRGGBB"
  label: string        // "2.5 - 6.0"
}

export interface ThematicExportFilters {
  adm1?: string | null
  adm2?: string | null
  adm3?: string | null
  minSondages?: number | null
}

export interface ThematicExportState {
  parameterId: string       // "vbs_avg"
  parameterLabel: string    // "VBS moyen"
  unit: string              // "g/100g"
  mapType: 'choropleth' | 'proportional' | 'binary'
  gridLevel?: '2km' | '28km' | 'combined'
  mode?: 'single' | 'combined'
  primaryGrid?: '2km' | '28km'
  secondaryGrid?: '28km' | null
  classes: ThematicClassBreak[]
  filters: ThematicExportFilters
  stats: {
    min?: number
    max?: number
    mean?: number
    median?: number
  } | null
  features?: any[]          // Features GeoJSON pour les statistiques d'export
  totalCellCount?: number   // Nombre total de mailles dans la zone (pour calcul couverture)

  secondary?: {
    gridLevel: '28km'
    features: any[]
    totalCellCount: number
    apiStats?: {
      count: number
      count_total?: number
      null_count?: number
      sum?: number
      min?: number
      max?: number
      mean?: number
      median?: number
      stddev?: number
      parent_context?: {
        level: string
        parent_name: string
        parent_sum: number
        parent_cells: number
      }
    }
  }

  /** Statistiques enrichies depuis l'API (pour export) */
  apiStats?: {
    count: number
    count_total?: number
    null_count?: number
    sum?: number
    min?: number
    max?: number
    mean?: number
    median?: number
    stddev?: number
    parent_context?: {
      level: string
      parent_name: string
      parent_sum: number
      parent_cells: number
    }
  }
}

export interface SavedConfig {
  id: string
  name: string
  description?: string
  objectif: ObjectifMetier
  parameter: string
  config: ThematicMapConfig
  is_public: boolean
  created_by?: string
  created_at?: string
  updated_at?: string
}

// ============================================================================
// PALETTES DE COULEURS
// ============================================================================

/**
 * Mapping centralisé thématique → palette recommandée
 * Source de vérité unique pour cartes ET graphes
 * 
 * Critères de sélection:
 * - Compatibilité impression (éviter palettes trop saturées)
 * - Accessibilité daltonisme (Viridis, Cividis préférés)
 * - Cohérence sémantique (rouge=risque, bleu=eau, vert=densité)
 */
export interface ThematicPaletteConfig {
  palette: string
  reversed?: boolean
  diverging?: boolean
  midpoint?: number
  /** Description pour l'UI */
  rationale?: string
}

export const THEMATIC_PALETTE_MAP: Record<string, ThematicPaletteConfig> = {
  // Couverture & instrumentation
  'n_sondages': { palette: 'Greens', rationale: 'Densité de données (vert=bien couvert)' },
  'n_echantillons': { palette: 'Greens', rationale: 'Densité de données' },
  'n_essais_total': { palette: 'Greens', rationale: 'Densité de données' },
  'data_density': { palette: 'Viridis', rationale: 'Densité de sondages à 20 km (confiance locale)' },
  
  // Argilosité / plasticité - palettes chaudes (risque argileux)
  'vbs_avg': { palette: 'YlOrRd', rationale: 'Risque argileux croissant (jaune→rouge)' },
  'ip_avg': { palette: 'PuRd', rationale: 'Plasticité (mauve/rose)' },
  'ip_derived_h1': { palette: 'PuRd', rationale: 'IP dérivé H1 (WL_ked - WP_ked)' },
  'ip_derived_h2': { palette: 'PuRd', rationale: 'IP dérivé H2 (WL_ked - WP_ked)' },
  'ip_derived_h3': { palette: 'PuRd', rationale: 'IP dérivé H3 (WL_ked - WP_ked)' },
  'wl_avg': { palette: 'PuBu', rationale: 'Limite de liquidité (bleu)' },
  'wp_avg': { palette: 'BuPu', rationale: 'Limite de plasticité (violet)' },
  
  // Gonflement - palette bleue (eau/gonflement)
  'eg_avg': { palette: 'Blues', rationale: 'Gonflement (bleu=eau)' },
  'eg_max': { palette: 'Blues', rationale: 'Gonflement maximal' },
  'eg_min': { palette: 'Greens', reversed: true, rationale: 'Gonflement minimal (vert=faible risque)' },
  
  // Compacité / Proctor
  'gamma_d_max_avg': { palette: 'Oranges', rationale: 'Compacité (orange)' },
  'w_opt_avg': { palette: 'Blues', rationale: 'Teneur en eau optimale' },
  
  // Granulométrie - palette divergente (fines vs grossiers)
  'passant_80um_avg': { palette: 'BrBG', diverging: true, midpoint: 50, rationale: 'Fines vs sables (divergent)' },
  'passant_2mm_avg': { palette: 'YlGnBu', rationale: 'Granulométrie' },
  'passant_20mm_avg': { palette: 'YlGnBu', rationale: 'Granulométrie' },
  'passant_80um_ked_h1': { palette: 'BrBG', diverging: true, midpoint: 50, rationale: 'Fines (<80µm) KED H1' },
  'passant_80um_ked_h2': { palette: 'BrBG', diverging: true, midpoint: 50, rationale: 'Fines (<80µm) KED H2' },
  'passant_80um_ked_h3': { palette: 'BrBG', diverging: true, midpoint: 50, rationale: 'Fines (<80µm) KED H3' },
  'passant_2mm_ked_h1': { palette: 'YlGnBu', rationale: 'Sables + fines (<2mm) KED H1' },
  'passant_2mm_ked_h2': { palette: 'YlGnBu', rationale: 'Sables + fines (<2mm) KED H2' },
  'passant_2mm_ked_h3': { palette: 'YlGnBu', rationale: 'Sables + fines (<2mm) KED H3' },
  'ai_rga_score_infer': { palette: 'YlOrRd', rationale: 'Risque IA croissant' },
  'ai_portance_kpa_infer': { palette: 'Blues', rationale: 'Portance estimee IA' },
  'kriging_ip': { palette: 'PuRd', rationale: 'IP interpole (kriging proxy)' },
  'kriging_vbs': { palette: 'YlOrRd', rationale: 'VBS interpolee (kriging proxy)' },
  'ag_safety_factor': { palette: 'Greens', rationale: 'Securite strategie AG' },
  'ag_cout_millions': { palette: 'Oranges', rationale: 'Cout strategie AG' },
  
  // Regression Kriging SCORPAN - VBS
  'vbs_rk_h1': { palette: 'YlOrRd', rationale: 'VBS RK H1 (1.0m) - Regression Kriging terrain' },
  'vbs_rk_h2': { palette: 'YlOrRd', rationale: 'VBS RK H2 (1.5m) - Regression Kriging terrain' },
  'vbs_rk_h3': { palette: 'YlOrRd', rationale: 'VBS RK H3 (2.0m) - Regression Kriging terrain' },
  
  // Regression Kriging SCORPAN - IP
  'ip_rk_h1': { palette: 'PuRd', rationale: 'IP RK H1 (1.0m) - Regression Kriging terrain' },
  'ip_rk_h2': { palette: 'PuRd', rationale: 'IP RK H2 (1.5m) - Regression Kriging terrain' },
  'ip_rk_h3': { palette: 'PuRd', rationale: 'IP RK H3 (2.0m) - Regression Kriging terrain' },
  
  // Regression Kriging SCORPAN - WL
  'wl_rk_h1': { palette: 'PuBu', rationale: 'WL RK H1 (1.0m) - Regression Kriging terrain' },
  'wl_rk_h2': { palette: 'PuBu', rationale: 'WL RK H2 (1.5m) - Regression Kriging terrain' },
  'wl_rk_h3': { palette: 'PuBu', rationale: 'WL RK H3 (2.0m) - Regression Kriging terrain' },
  
  // Regression Kriging SCORPAN - WP
  'wp_rk_h1': { palette: 'BuPu', rationale: 'WP RK H1 (1.0m) - Regression Kriging terrain' },
  'wp_rk_h2': { palette: 'BuPu', rationale: 'WP RK H2 (1.5m) - Regression Kriging terrain' },
  'wp_rk_h3': { palette: 'BuPu', rationale: 'WP RK H3 (2.0m) - Regression Kriging terrain' },
  
  // Regression Kriging SCORPAN - EG (Gonflement)
  'eg_rk_h1': { palette: 'Blues', rationale: 'EG RK H1 (1.0m) - Regression Kriging terrain' },
  'eg_rk_h2': { palette: 'Blues', rationale: 'EG RK H2 (1.5m) - Regression Kriging terrain' },
  'eg_rk_h3': { palette: 'Blues', rationale: 'EG RK H3 (2.0m) - Regression Kriging terrain' },
  // L2b Fusion BLUP
  'vbs_blup_h1': { palette: 'YlOrRd', rationale: 'VBS BLUP H1 — Fusion KED+RK bayésien' },
  'vbs_blup_h2': { palette: 'YlOrRd', rationale: 'VBS BLUP H2' },
  'vbs_blup_h3': { palette: 'YlOrRd', rationale: 'VBS BLUP H3' },
  'ip_blup_h1': { palette: 'PuRd', rationale: 'IP BLUP H1' },
  'ip_blup_h2': { palette: 'PuRd', rationale: 'IP BLUP H2' },
  'ip_blup_h3': { palette: 'PuRd', rationale: 'IP BLUP H3' },
  'wl_blup_h1': { palette: 'PuBu', rationale: 'WL BLUP H1' },
  'wl_blup_h2': { palette: 'PuBu', rationale: 'WL BLUP H2' },
  'wl_blup_h3': { palette: 'PuBu', rationale: 'WL BLUP H3' },
  'wp_blup_h1': { palette: 'BuPu', rationale: 'WP BLUP H1' },
  'wp_blup_h2': { palette: 'BuPu', rationale: 'WP BLUP H2' },
  'wp_blup_h3': { palette: 'BuPu', rationale: 'WP BLUP H3' },
  'eg_blup_h1': { palette: 'Blues', rationale: 'EG BLUP H1' },
  'eg_blup_h2': { palette: 'Blues', rationale: 'EG BLUP H2' },
  'eg_blup_h3': { palette: 'Blues', rationale: 'EG BLUP H3' },
  // L4 MTGP/ICM
  'vbs_mtgp_h1': { palette: 'YlOrRd', rationale: 'VBS MTGP H1 — Multi-Tâches GPflow' },
  'vbs_mtgp_h2': { palette: 'YlOrRd', rationale: 'VBS MTGP H2' },
  'vbs_mtgp_h3': { palette: 'YlOrRd', rationale: 'VBS MTGP H3' },
  'ip_mtgp_h1': { palette: 'PuRd', rationale: 'IP MTGP H1' },
  'ip_mtgp_h2': { palette: 'PuRd', rationale: 'IP MTGP H2' },
  'ip_mtgp_h3': { palette: 'PuRd', rationale: 'IP MTGP H3' },
  'eg_mtgp_h1': { palette: 'Blues', rationale: 'EG MTGP H1' },
  'eg_mtgp_h2': { palette: 'Blues', rationale: 'EG MTGP H2' },
  'eg_mtgp_h3': { palette: 'Blues', rationale: 'EG MTGP H3' },
  // L3 VfS-PLS
  'vbs_vfs': { palette: 'YlOrRd', rationale: 'VBS VfS surface Sentinel-2' },
}

/**
 * Récupère la palette recommandée pour un paramètre
 * Fallback sur 'Blues' si non défini
 */
export function getRecommendedPalette(parameterId: string): ThematicPaletteConfig {
  return THEMATIC_PALETTE_MAP[parameterId] || { palette: 'Blues' }
}

export interface PaletteOption {
  value: string
  label: string
  type: 'sequential' | 'diverging'
  colors: string[]  // Preview colors
  /** Accessible aux daltoniens */
  colorblindSafe?: boolean
}

export const PALETTE_OPTIONS: PaletteOption[] = [
  // Séquentielles - Monochrome
  { 
    value: 'Blues', 
    label: 'Blues', 
    type: 'sequential',
    colors: ['#f7fbff', '#6baed6', '#08306b']
  },
  { 
    value: 'Greens', 
    label: 'Greens', 
    type: 'sequential',
    colors: ['#f7fcf5', '#74c476', '#00441b']
  },
  { 
    value: 'Reds', 
    label: 'Reds', 
    type: 'sequential',
    colors: ['#fff5f0', '#fb6a4a', '#67000d']
  },
  { 
    value: 'Oranges', 
    label: 'Oranges', 
    type: 'sequential',
    colors: ['#fff5eb', '#fd8d3c', '#7f2704']
  },
  { 
    value: 'Purples', 
    label: 'Purples', 
    type: 'sequential',
    colors: ['#fcfbfd', '#9e9ac8', '#3f007d']
  },
  
  // Séquentielles - Multi-teintes
  { 
    value: 'YlOrRd', 
    label: 'YlOrRd', 
    type: 'sequential',
    colors: ['#ffffcc', '#fd8d3c', '#800026']
  },
  { 
    value: 'YlGnBu', 
    label: 'YlGnBu', 
    type: 'sequential',
    colors: ['#ffffd9', '#41b6c4', '#081d58']
  },
  { 
    value: 'PuBu', 
    label: 'PuBu', 
    type: 'sequential',
    colors: ['#fff7fb', '#67a9cf', '#023858']
  },
  { 
    value: 'BuPu', 
    label: 'BuPu', 
    type: 'sequential',
    colors: ['#f7fcfd', '#8c96c6', '#4d004b']
  },
  { 
    value: 'PuRd', 
    label: 'PuRd', 
    type: 'sequential',
    colors: ['#f7f4f9', '#df65b0', '#67001f']
  },
  
  // Séquentielles - Accessibles daltonisme
  { 
    value: 'Viridis', 
    label: 'Viridis ♿', 
    type: 'sequential',
    colors: ['#440154', '#21918c', '#fde725'],
    colorblindSafe: true
  },
  { 
    value: 'Cividis', 
    label: 'Cividis ♿', 
    type: 'sequential',
    colors: ['#00204d', '#7c7b78', '#ffea46'],
    colorblindSafe: true
  },
  
  // Divergentes
  { 
    value: 'RdYlGn', 
    label: 'RdYlGn', 
    type: 'diverging',
    colors: ['#d73027', '#ffffbf', '#1a9850']
  },
  { 
    value: 'RdBu', 
    label: 'RdBu', 
    type: 'diverging',
    colors: ['#b2182b', '#f7f7f7', '#2166ac']
  },
  { 
    value: 'BrBG', 
    label: 'BrBG', 
    type: 'diverging',
    colors: ['#8c510a', '#f5f5f5', '#01665e']
  },
  { 
    value: 'PuOr', 
    label: 'PuOr', 
    type: 'diverging',
    colors: ['#7f3b08', '#f7f7f7', '#2d004b']
  }
]

// ============================================================================
// RÉGIONS ADM
// ============================================================================

export const ADM1_OPTIONS = [
  { value: '', label: '— toutes régions —' },
  { value: 'Maritime', label: 'Maritime' },
  { value: 'Plateaux', label: 'Plateaux' },
  { value: 'Centrale', label: 'Centrale' },
  { value: 'Kara', label: 'Kara' },
  { value: 'Savanes', label: 'Savanes' }
]

// ============================================================================
// HELPERS
// ============================================================================

export function getParameterById(id: string): ThematicParameter | undefined {
  return THEMATIC_PARAMETERS.find(p => p.id === id)
}

export function getObjectifById(id: ObjectifMetier): ObjectifConfig | undefined {
  return OBJECTIFS_METIER.find(o => o.id === id)
}

export function getParametersForObjectif(objectifId: ObjectifMetier): ThematicParameter[] {
  const objectif = getObjectifById(objectifId)
  if (!objectif) return THEMATIC_PARAMETERS
  
  if (objectifId === 'personnalise') {
    return THEMATIC_PARAMETERS
  }
  
  return THEMATIC_PARAMETERS.filter(p => objectif.parameters.includes(p.id))
}

/**
 * Équivalence paramètre maille « base » → colonne kriging (mailles_geotechnique_stats_wgs84).
 * Seuls IP et VBS sont exposés côté API thématique pour l'instant — pas de kriging EG / WL / WP.
 */
const BASE_PARAM_TO_KRIGING_ID: Record<string, string> = {
  vbs_avg: 'kriging_vbs',
  ip_avg: 'kriging_ip',
}

/** Horizon KED national — aligné sur `ai_variograms` / `horizon_label` (H1, H2, H3). */
export type KedHorizon = 'H1' | 'H2' | 'H3'

/** Bases logiques (roadmap T1.1) : l'API reçoit `${base}_ked_${h}` ou `ip_derived_${h}`. */
export const INTERPOLATION_BASE_DEFS: ReadonlyArray<{
  baseId: string
  label: string
  unit: string
  objectifs: ObjectifMetier[]
}> = [
  { baseId: 'vbs', label: 'VBS (KED)', unit: 'g/100g', objectifs: ['argilosite', 'ia_ag', 'personnalise'] },
  { baseId: 'ip', label: 'IP (KED)', unit: '%', objectifs: ['argilosite', 'ia_ag', 'personnalise'] },
  { baseId: 'wl', label: 'WL (KED)', unit: '%', objectifs: ['argilosite', 'ia_ag', 'personnalise'] },
  { baseId: 'wp', label: 'WP (KED)', unit: '%', objectifs: ['argilosite', 'ia_ag', 'personnalise'] },
  { baseId: 'ip_derived', label: 'IP dérivé (WL−WP)', unit: '%', objectifs: ['argilosite', 'ia_ag', 'personnalise'] },
  { baseId: 'eg', label: 'Eg (KED)', unit: '%', objectifs: ['gonflement', 'ia_ag', 'personnalise'] },
  { baseId: 'passant_2mm', label: '% passant 2 mm (KED)', unit: '%', objectifs: ['granulometrie', 'ia_ag', 'personnalise'] },
  { baseId: 'passant_80um', label: '% passant 80 µm (KED)', unit: '%', objectifs: ['granulometrie', 'ia_ag', 'personnalise'] },
]

/** Préfixe option `<select>` pour bases KED (roadmap T1.1). */
export const KED_SELECT_PREFIX = 'ked:' as const

export function buildKedApiParameterId(baseId: string, horizon: KedHorizon): string {
  const h = horizon.toLowerCase()
  if (baseId === 'ip_derived') return `ip_derived_${h}`
  return `${baseId}_ked_${h}`
}

export function parseKedApiParameterId(apiId: string): { baseId: string; horizon: KedHorizon } | null {
  const id = apiId.trim()
  const dm = /^ip_derived_(h[123])$/i.exec(id)
  if (dm) return { baseId: 'ip_derived', horizon: dm[1]!.toUpperCase() as KedHorizon }
  const km = /^(.+)_ked_(h[123])$/i.exec(id)
  if (km) return { baseId: km[1]!, horizon: km[2]!.toUpperCase() as KedHorizon }
  return null
}

export function thematicParameterFromInterpolationBase(
  baseId: string,
  label: string,
  unit: string,
): ThematicParameter {
  return {
    id: `${KED_SELECT_PREFIX}${baseId}`,
    label,
    unit,
    category: 'ai',
    description:
      "Interpolation KED nationale — l'identifiant API est construit avec l'horizon H1/H2/H3 (voir sélecteur).",
  }
}

export function listInterpolationBasesForObjectif(objectifId: ObjectifMetier): ThematicParameter[] {
  return INTERPOLATION_BASE_DEFS.filter(
    (d) => objectifId === 'personnalise' || d.objectifs.includes(objectifId),
  ).map((d) => thematicParameterFromInterpolationBase(d.baseId, d.label, d.unit))
}

/** Suffixe DB pour chaque source ML. */
const ML_SOURCE_SUFFIX: Partial<Record<ThematicSource, string>> = {
  l1_ked:    'ked',
  l2a_rk:    'rk',
  l2b_blup:  'blup',
  l4_mtgp:   'mtgp',
}

/** Params de base (sans suffixe horizon) disponibles par source ML. */
const ML_BASE_PARAMS: Record<string, string[]> = {
  ked:   ['vbs', 'ip', 'wl', 'wp', 'eg', 'passant_80um', 'passant_2mm'],
  rk:    ['vbs', 'ip', 'wl', 'wp', 'eg'],
  blup:  ['vbs', 'ip', 'wl', 'wp', 'eg'],
  mtgp:  ['vbs', 'ip', 'eg'],   // WL/WP MTGP non exposés dans l'API Rust
}

/** Filtres par objectif (quels base params sont pertinents). */
const OBJECTIF_BASE_FILTER: Partial<Record<ObjectifMetier, string[]>> = {
  argilosite:    ['vbs', 'ip', 'wl', 'wp'],
  gonflement:    ['eg'],
  compacite:     [],   // Proctor non dispo dans ML
  granulometrie: ['passant_80um', 'passant_2mm'],
  contexte:      [],
  couverture:    [],
  ia_ag:         null as any, // null = tout
  personnalise:  null as any,
}

/**
 * Paramètres affichés selon la catégorie métier ET la source (base / interpolation / IA).
 * Gère les nouvelles sources ML L1-L4 dynamiquement.
 */
export function getParametersForObjectifAndSource(
  objectifId: ObjectifMetier,
  source: ThematicSource,
): ThematicParameter[] {
  // Legacy aliases
  if (source === 'interpolation') source = 'l1_ked'
  if (source === 'ia') source = 'l4_mtgp'

  if (source === 'base') {
    return getParametersForObjectif(objectifId)
  }

  // L3 VfS — VBS surface uniquement, pas d'horizon
  if (source === 'l3_vfs') {
    const vfs = THEMATIC_PARAMETERS.find((p) => p.id === 'vbs_vfs')
    if (objectifId === 'argilosite' || objectifId === 'ia_ag' || objectifId === 'personnalise') {
      return vfs ? [vfs] : []
    }
    return []
  }

  const suffix = ML_SOURCE_SUFFIX[source]
  if (!suffix) return []

  const baseBases = ML_BASE_PARAMS[suffix] ?? []
  const objFilter = OBJECTIF_BASE_FILTER[objectifId]

  // null = all params for this source (ia_ag / personnalise)
  const allowedBases = objFilter === null ? baseBases : baseBases.filter((b) => (objFilter ?? []).includes(b))

  if (allowedBases.length === 0) {
    // Couverture / contexte / compacite → données terrain uniquement
    if (objectifId === 'couverture') {
      const dd = THEMATIC_PARAMETERS.find((p) => p.id === 'data_density')
      return dd ? [dd] : []
    }
    return []
  }

  // Build param list from THEMATIC_PARAMETERS (already populated with _blup_/_mtgp_/_rk_/_ked_ variants)
  const horizons = ['h1', 'h2', 'h3'] as const
  const result: ThematicParameter[] = []

  for (const base of allowedBases) {
    // Special case: ip_derived for KED
    if (source === 'l1_ked' && base === 'ip') {
      // Include both ip_ked_h* AND ip_derived_h*
      for (const h of horizons) {
        const ipKed = THEMATIC_PARAMETERS.find((p) => p.id === `ip_ked_${h}`)
        const ipDerived = THEMATIC_PARAMETERS.find((p) => p.id === `ip_derived_${h}`)
        if (ipKed) result.push(ipKed)
        if (ipDerived) result.push(ipDerived)
      }
      continue
    }
    for (const h of horizons) {
      const id = `${base}_${suffix}_${h}`
      const p = THEMATIC_PARAMETERS.find((param) => param.id === id)
      if (p) result.push(p)
    }
  }

  // For ia_ag/personnalise + l1_ked: also add KED passant params
  if ((objectifId === 'ia_ag' || objectifId === 'personnalise') && source === 'l1_ked') {
    for (const base of ['passant_80um', 'passant_2mm']) {
      for (const h of horizons) {
        const p = THEMATIC_PARAMETERS.find((param) => param.id === `${base}_ked_${h}`)
        if (p) result.push(p)
      }
    }
  }

  return result
}

export function getParametersBySource(source: ThematicSource): ThematicParameter[] {
  // Legacy aliases
  if (source === 'interpolation') source = 'l1_ked'
  if (source === 'ia') source = 'l4_mtgp'

  if (source === 'base') {
    return THEMATIC_PARAMETERS.filter((p) => p.category !== 'ai')
  }
  if (source === 'l1_ked') {
    return THEMATIC_PARAMETERS.filter(
      (p) =>
        (p.id.includes('_ked_h') || p.id.startsWith('ip_derived_h') || p.id.startsWith('kriging_')) &&
        !p.deprecated,
    )
  }
  if (source === 'l2a_rk') {
    return THEMATIC_PARAMETERS.filter((p) => p.id.includes('_rk_h'))
  }
  if (source === 'l2b_blup') {
    return THEMATIC_PARAMETERS.filter((p) => p.id.includes('_blup_h'))
  }
  if (source === 'l3_vfs') {
    return THEMATIC_PARAMETERS.filter((p) => p.id === 'vbs_vfs')
  }
  if (source === 'l4_mtgp') {
    return THEMATIC_PARAMETERS.filter((p) => p.id.includes('_mtgp_h'))
  }
  return THEMATIC_PARAMETERS.filter((p) => p.id.startsWith('ai_') || p.id.startsWith('ag_'))
}

export function getDefaultConfig(): ThematicMapConfig {
  return {
    name: 'Nouvelle carte',
    objectif: 'couverture',
    parameter: 'n_sondages',
    type: 'choropleth',
    classification: {
      method: 'quantiles',
      n_classes: 5
    },
    style: {
      palette: 'Blues',
      opacity: 0.7,
      stroke_width: 1,
      stroke_color: '#333333'
    },
    filters: {
      min_sondages: 0,
      exclude_no_data: true
    },
    contextLayers: {
      showGeologie: false,
      showPedologie: false,
      showRisqueGonflement: false
    }
  }
}
