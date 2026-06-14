/**
 * Module pour les statistiques globales agrégées (panneau Vue Globale)
 * Phase 2 - Panneau d'accueil géotechnique
 * Chantier B - Source unique de vérité pour les stats globales
 */

import { getApiBase } from './api-base'
import { currentFilters } from './filters-state'
import { Chart, registerables } from 'chart.js'
import { normalizeEssaisTypes, type EssaisTypeCounts } from './cell-metrics'

// Enregistrer les composants Chart.js
Chart.register(...registerables)

// Instance du graphique profondeur
let depthChart: Chart | null = null

// Types pour les stats globales
export interface GlobalStats {
  mailles_total: number
  mailles_filtrees: number
  mailles_avec_donnees: number
  taux_couverture_pct: number
  sondages: number
  echantillons: number
  essais: number
  essais_par_type: {
    atterberg: number
    vbs: number
    classif: number
    proctor: number
    granulo: number
    gonflement: number
  }
  profondeur: {
    min_m: number | null
    max_m: number | null
    moy_m: number | null
    bins: Array<{ range: string; count: number }>
  }
  gtr: Record<string, number>
  argilosite: {
    vbs_moyen: number | null
    pct_argileux: number | null
    ip_moyen: number | null
  }
}

// Cache pour éviter les appels répétés
let lastFetchTime = 0
let cachedStats: GlobalStats | null = null
const CACHE_DURATION_MS = 5000 // 5 secondes

/**
 * Récupère les stats globales depuis l'API
 */
export async function fetchGlobalStats(): Promise<GlobalStats | null> {
  const now = Date.now()
  if (cachedStats && (now - lastFetchTime) < CACHE_DURATION_MS) {
    return cachedStats
  }

  try {
    const params = new URLSearchParams()
    if (currentFilters.adm1) params.set('adm1', currentFilters.adm1)
    if (currentFilters.adm2) params.set('adm2', currentFilters.adm2)
    if (currentFilters.adm3) params.set('adm3', currentFilters.adm3)
    if (currentFilters.minSondages > 0) params.set('min_sondages', String(currentFilters.minSondages))
    if (currentFilters.minEssais > 0) params.set('min_essais', String(currentFilters.minEssais))

    const url = `${getApiBase()}/stats/global?${params.toString()}`
    const res = await fetch(url)
    if (!res.ok) {
      console.error('[GlobalStats] Erreur API:', res.status)
      return null
    }

    const raw = await res.json()
    
    // Chantier B - Normaliser les données pour éviter les undefined
    const stats: GlobalStats = {
      ...raw,
      essais_par_type: normalizeEssaisTypes(raw.essais_par_type),
      profondeur: {
        min_m: raw.profondeur?.min_m ?? null,
        max_m: raw.profondeur?.max_m ?? null,
        moy_m: raw.profondeur?.moy_m ?? null,
        bins: raw.profondeur?.bins ?? [],
      },
      argilosite: {
        vbs_moyen: raw.argilosite?.vbs_moyen ?? null,
        pct_argileux: raw.argilosite?.pct_argileux ?? null,
        ip_moyen: raw.argilosite?.ip_moyen ?? null,
      },
    }
    
    cachedStats = stats
    lastFetchTime = now
    return stats
  } catch (e) {
    console.error('[GlobalStats] Erreur fetch:', e)
    return null
  }
}

/**
 * Met à jour le panneau Vue Globale avec les stats
 */
export function updateGlobalStatsPanel(stats: GlobalStats): void {
  // 1) Profondeurs - valeurs textuelles
  const depthMin = document.getElementById('depthMin')
  const depthMoy = document.getElementById('depthMoy')
  const depthMax = document.getElementById('depthMax')
  const depthSubtitle = document.getElementById('depthSubtitle')
  
  if (depthMin) depthMin.textContent = stats.profondeur.min_m != null ? `${stats.profondeur.min_m.toFixed(1)}m` : '—'
  if (depthMoy) depthMoy.textContent = stats.profondeur.moy_m != null ? `${stats.profondeur.moy_m.toFixed(1)}m` : '—'
  if (depthMax) depthMax.textContent = stats.profondeur.max_m != null ? `${stats.profondeur.max_m.toFixed(1)}m` : '—'
  
  // Sous-titre avec nombre d'échantillons
  if (depthSubtitle) {
    depthSubtitle.textContent = `Calculé sur ${stats.echantillons.toLocaleString()} échantillons filtrés`
  }

  // Histogramme des profondeurs avec Chart.js (bins adaptés 0-1 / 1-1.5 / 1.5-2 / >2)
  const bins = stats.profondeur.bins
  const bin0_1 = bins.find(b => b.range === '0-1')?.count || 0
  const bin1_15 = bins.find(b => b.range === '1-1.5')?.count || 0
  const bin15_2 = bins.find(b => b.range === '1.5-2')?.count || 0
  const bin2_plus = bins.find(b => b.range === '>2')?.count || 0
  
  updateDepthChart([bin0_1, bin1_15, bin15_2, bin2_plus])

  // 2) Argilosité
  const vbsMoyen = document.getElementById('vbsMoyen')
  const pctArgileux = document.getElementById('pctArgileux')
  const ipMoyen = document.getElementById('ipMoyen')
  const interpretation = document.getElementById('argilositeInterpretation')
  const argiloSubtitle = document.getElementById('argiloSubtitle')
  
  if (vbsMoyen) vbsMoyen.textContent = stats.argilosite.vbs_moyen != null ? stats.argilosite.vbs_moyen.toFixed(1) : '—'
  if (pctArgileux) pctArgileux.textContent = stats.argilosite.pct_argileux != null ? `${stats.argilosite.pct_argileux.toFixed(0)}%` : '—'
  if (ipMoyen) ipMoyen.textContent = stats.argilosite.ip_moyen != null ? stats.argilosite.ip_moyen.toFixed(0) : '—'
  
  // Sous-titre avec nombre d'échantillons/essais
  if (argiloSubtitle) {
    argiloSubtitle.textContent = `Calculé sur ${stats.echantillons.toLocaleString()} échantillons / ${stats.essais.toLocaleString()} essais`
  }
  
  // Interprétation automatique
  if (interpretation) {
    interpretation.textContent = buildArgilositeInterpretation(stats.argilosite)
  }
  
  // 3) Répartition des essais (6 types)
  updateEssaisTypeBar(stats.essais_par_type)
}

/**
 * Met à jour le graphique Chart.js des profondeurs
 */
function updateDepthChart(data: number[]): void {
  const canvas = document.getElementById('depthChartCanvas') as HTMLCanvasElement | null
  if (!canvas) return
  
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  
  // Détruire l'ancien graphique si existant
  if (depthChart) {
    depthChart.destroy()
    depthChart = null
  }
  
  // Lire les CSS vars pour le thème courant
  const style = getComputedStyle(document.documentElement)
  const clrMuted = style.getPropertyValue('--muted').trim() || '#94a3b8'
  const clrGrid  = style.getPropertyValue('--field-border').trim() || '#1e293b'
  const clrText  = style.getPropertyValue('--text').trim() || '#f8fafc'

  // Créer le nouveau graphique
  depthChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['0-1m', '1-1.5m', '1.5-2m', '>2m'],
      datasets: [{
        label: 'Échantillons',
        data: data,
        backgroundColor: ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444'],
        borderRadius: 4,
        barPercentage: 0.8,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: style.getPropertyValue('--card-bg').trim() || '#0f172a',
          titleColor: clrText,
          bodyColor: clrMuted,
          borderColor: clrGrid,
          borderWidth: 1,
          callbacks: {
            label: (ctx) => `${ctx.parsed.y} échantillons`
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: clrMuted, font: { size: 10 } }
        },
        y: {
          beginAtZero: true,
          grid: { color: clrGrid },
          ticks: { color: clrMuted, font: { size: 10 } }
        }
      }
    }
  })
}

/**
 * Met à jour la barre de répartition des essais (6 types)
 */
function updateEssaisTypeBar(essais: GlobalStats['essais_par_type']): void {
  const { atterberg, vbs, classif, proctor, granulo, gonflement } = essais
  const total = atterberg + vbs + classif + proctor + granulo + gonflement
  
  // Mise à jour des compteurs
  const statAtterberg = document.getElementById('statAtterberg')
  const statVbs = document.getElementById('statVbs')
  const statClassif = document.getElementById('statClassif')
  const statProctor = document.getElementById('statProctor')
  const statGranulo = document.getElementById('statGranulo')
  const statGonflement = document.getElementById('statGonflement')
  
  if (statAtterberg) statAtterberg.textContent = String(atterberg)
  if (statVbs) statVbs.textContent = String(vbs)
  if (statClassif) statClassif.textContent = String(classif)
  if (statProctor) statProctor.textContent = String(proctor)
  if (statGranulo) statGranulo.textContent = String(granulo)
  if (statGonflement) statGonflement.textContent = String(gonflement)
  
  // Mise à jour de la barre de progression (6 segments)
  const barAtterberg = document.getElementById('barAtterberg')
  const barVbs = document.getElementById('barVbs')
  const barClassif = document.getElementById('barClassif')
  const barProctor = document.getElementById('barProctor')
  const barGranulo = document.getElementById('barGranulo')
  const barGonflement = document.getElementById('barGonflement')
  
  if (total > 0) {
    if (barAtterberg) barAtterberg.style.width = `${(atterberg / total) * 100}%`
    if (barVbs) barVbs.style.width = `${(vbs / total) * 100}%`
    if (barClassif) barClassif.style.width = `${(classif / total) * 100}%`
    if (barProctor) barProctor.style.width = `${(proctor / total) * 100}%`
    if (barGranulo) barGranulo.style.width = `${(granulo / total) * 100}%`
    if (barGonflement) barGonflement.style.width = `${(gonflement / total) * 100}%`
  } else {
    if (barAtterberg) barAtterberg.style.width = '0%'
    if (barVbs) barVbs.style.width = '0%'
    if (barClassif) barClassif.style.width = '0%'
    if (barProctor) barProctor.style.width = '0%'
    if (barGranulo) barGranulo.style.width = '0%'
    if (barGonflement) barGonflement.style.width = '0%'
  }
}

/**
 * Génère une interprétation textuelle de l'argilosité
 */
function buildArgilositeInterpretation(argilosite: GlobalStats['argilosite']): string {
  const parts: string[] = []
  
  // VBS
  if (argilosite.vbs_moyen != null) {
    if (argilosite.vbs_moyen < 1) {
      parts.push('sols peu argileux / sableux')
    } else if (argilosite.vbs_moyen < 2.5) {
      parts.push('sols limono-argileux')
    } else if (argilosite.vbs_moyen < 6) {
      parts.push('sols argileux')
    } else {
      parts.push('sols très argileux')
    }
  }
  
  // IP
  if (argilosite.ip_moyen != null) {
    if (argilosite.ip_moyen < 7) {
      parts.push('plasticité faible')
    } else if (argilosite.ip_moyen <= 17) {
      parts.push('plasticité moyenne')
    } else if (argilosite.ip_moyen <= 35) {
      parts.push('plasticité élevée')
    } else {
      parts.push('plasticité très élevée')
    }
  }
  
  if (parts.length === 0) return 'Données insuffisantes pour l\'interprétation'
  
  return `Zone à ${parts.join(', ')}`
}

/**
 * Invalide le cache pour forcer un rechargement
 */
export function invalidateGlobalStatsCache(): void {
  cachedStats = null
  lastFetchTime = 0
}

/**
 * Charge et affiche les stats globales
 */
export async function loadAndDisplayGlobalStats(): Promise<void> {
  const stats = await fetchGlobalStats()
  if (stats) {
    updateGlobalStatsPanel(stats)
  }
}
