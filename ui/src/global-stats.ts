/**
 * Module pour les statistiques globales agrégées (panneau Vue Globale)
 * Phase 2 - Panneau d'accueil géotechnique
 */

import { getApiBase } from './api-base'
import { currentFilters } from './filters-state'
import { Chart, registerables } from 'chart.js'

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
    physiques: number
    classif: number
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

    const stats: GlobalStats = await res.json()
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
  
  if (depthMin) depthMin.textContent = stats.profondeur.min_m != null ? `${stats.profondeur.min_m.toFixed(1)}m` : '—'
  if (depthMoy) depthMoy.textContent = stats.profondeur.moy_m != null ? `${stats.profondeur.moy_m.toFixed(1)}m` : '—'
  if (depthMax) depthMax.textContent = stats.profondeur.max_m != null ? `${stats.profondeur.max_m.toFixed(1)}m` : '—'

  // Histogramme des profondeurs avec Chart.js
  const bins = stats.profondeur.bins
  const bin0_3 = bins.find(b => b.range === '0-3')?.count || 0
  const bin3_6 = bins.find(b => b.range === '3-6')?.count || 0
  const bin6_10 = bins.find(b => b.range === '6-10')?.count || 0
  const bin10_plus = bins.find(b => b.range === '>10')?.count || 0
  
  updateDepthChart([bin0_3, bin3_6, bin6_10, bin10_plus])

  // 2) Argilosité
  const vbsMoyen = document.getElementById('vbsMoyen')
  const pctArgileux = document.getElementById('pctArgileux')
  const ipMoyen = document.getElementById('ipMoyen')
  const interpretation = document.getElementById('argilositeInterpretation')
  
  if (vbsMoyen) vbsMoyen.textContent = stats.argilosite.vbs_moyen != null ? stats.argilosite.vbs_moyen.toFixed(1) : '—'
  if (pctArgileux) pctArgileux.textContent = stats.argilosite.pct_argileux != null ? `${stats.argilosite.pct_argileux.toFixed(0)}%` : '—'
  if (ipMoyen) ipMoyen.textContent = stats.argilosite.ip_moyen != null ? stats.argilosite.ip_moyen.toFixed(0) : '—'
  
  // Interprétation automatique
  if (interpretation) {
    interpretation.textContent = buildArgilositeInterpretation(stats.argilosite)
  }
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
  
  // Créer le nouveau graphique
  depthChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['0-3m', '3-6m', '6-10m', '>10m'],
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
          callbacks: {
            label: (ctx) => `${ctx.parsed.y} échantillons`
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: '#94a3b8', font: { size: 10 } }
        },
        y: {
          beginAtZero: true,
          grid: { color: '#1e293b' },
          ticks: { color: '#94a3b8', font: { size: 10 } }
        }
      }
    }
  })
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
