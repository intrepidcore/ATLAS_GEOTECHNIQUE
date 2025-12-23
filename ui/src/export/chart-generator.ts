/**
 * Module de génération de graphes statistiques pour Atlas Export
 * Génère des graphes PNG pour chaque thématique exportée
 * 
 * Utilise Chart.js pour le rendu côté client
 */

// Types pour les données de graphes
export interface ChartData {
  values: number[]
  labels?: string[]
  adm2Data?: Record<string, number[]>
  correlationData?: { x: number; y: number; label?: string }[]
}

export interface ChartConfig {
  width: number
  height: number
  title: string
  xLabel?: string
  yLabel?: string
  colors?: string[]
}

export interface ThematicChartSet {
  thematicId: string
  thematicLabel: string
  charts: Array<{
    type: string
    title: string
    blob: Blob
    filename: string
  }>
}

// Palettes de couleurs par thématique
const CHART_PALETTES = {
  couverture: ['#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe', '#dbeafe'],
  argilosite: ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4'],
  gonflement: ['#dc2626', '#ea580c', '#ca8a04', '#16a34a', '#0891b2'],
  proctor: ['#7c3aed', '#8b5cf6', '#a78bfa', '#c4b5fd', '#ddd6fe'],
  granulo: ['#0d9488', '#14b8a6', '#2dd4bf', '#5eead4', '#99f6e4'],
  default: ['#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899']
}

// Configuration des graphes par thématique
export const THEMATIC_CHART_CONFIG: Record<string, {
  category: string
  charts: Array<{
    type: 'histogram' | 'boxplot' | 'pie' | 'scatter' | 'bar' | 'correlation' | 'casagrande'
    title: string
    xParam?: string
    yParam?: string
    groupBy?: 'adm2' | 'adm1'
  }>
}> = {
  // Couverture & Instrumentation
  n_sondages: {
    category: 'couverture',
    charts: [
      { type: 'histogram', title: 'Distribution du nombre de sondages par maille' },
      { type: 'pie', title: 'Couverture spatiale (mailles avec/sans données)' },
      { type: 'bar', title: 'Nombre de sondages par préfecture', groupBy: 'adm2' },
      { type: 'boxplot', title: 'Distribution des sondages par préfecture', groupBy: 'adm2' }
    ]
  },
  n_echantillons: {
    category: 'couverture',
    charts: [
      { type: 'histogram', title: 'Distribution du nombre d\'échantillons par maille' },
      { type: 'bar', title: 'Nombre d\'échantillons par préfecture', groupBy: 'adm2' }
    ]
  },
  n_essais_total: {
    category: 'couverture',
    charts: [
      { type: 'histogram', title: 'Distribution du nombre d\'essais par maille' },
      { type: 'bar', title: 'Nombre d\'essais par préfecture', groupBy: 'adm2' }
    ]
  },
  
  // Argilosité / Plasticité
  vbs_avg: {
    category: 'argilosite',
    charts: [
      { type: 'histogram', title: 'Distribution des VBS moyens par maille' },
      { type: 'boxplot', title: 'VBS par préfecture', groupBy: 'adm2' },
      { type: 'scatter', title: 'VBS vs % fines (<80µm)', xParam: 'passant_80um_avg', yParam: 'vbs_avg' },
      { type: 'scatter', title: 'VBS vs Indice de Plasticité', xParam: 'ip_avg', yParam: 'vbs_avg' }
    ]
  },
  ip_avg: {
    category: 'argilosite',
    charts: [
      { type: 'histogram', title: 'Distribution des IP moyens par maille' },
      { type: 'boxplot', title: 'IP par préfecture', groupBy: 'adm2' },
      { type: 'casagrande', title: 'Diagramme de Casagrande (IP vs WL)', xParam: 'wl_avg', yParam: 'ip_avg' },
      { type: 'scatter', title: 'IP vs VBS', xParam: 'vbs_avg', yParam: 'ip_avg' }
    ]
  },
  wl_avg: {
    category: 'argilosite',
    charts: [
      { type: 'histogram', title: 'Distribution des limites de liquidité par maille' },
      { type: 'boxplot', title: 'WL par préfecture', groupBy: 'adm2' }
    ]
  },
  wp_avg: {
    category: 'argilosite',
    charts: [
      { type: 'histogram', title: 'Distribution des limites de plasticité par maille' },
      { type: 'boxplot', title: 'WP par préfecture', groupBy: 'adm2' }
    ]
  },
  
  // Potentiel de gonflement
  eg_avg: {
    category: 'gonflement',
    charts: [
      { type: 'histogram', title: 'Distribution du gonflement Eg moyen par maille' },
      { type: 'boxplot', title: 'Eg par préfecture', groupBy: 'adm2' },
      { type: 'scatter', title: 'Gonflement Eg vs VBS', xParam: 'vbs_avg', yParam: 'eg_avg' },
      { type: 'scatter', title: 'Gonflement Eg vs IP', xParam: 'ip_avg', yParam: 'eg_avg' }
    ]
  },
  eg_max: {
    category: 'gonflement',
    charts: [
      { type: 'histogram', title: 'Distribution du gonflement Eg max par maille' },
      { type: 'boxplot', title: 'Eg max par préfecture', groupBy: 'adm2' }
    ]
  },
  
  // Compacité / Portance (Proctor)
  gamma_d_max_avg: {
    category: 'proctor',
    charts: [
      { type: 'histogram', title: 'Distribution de γd,max par maille' },
      { type: 'boxplot', title: 'γd,max par préfecture', groupBy: 'adm2' },
      { type: 'scatter', title: 'γd,max vs Teneur en eau optimale', xParam: 'w_opt_avg', yParam: 'gamma_d_max_avg' },
      { type: 'scatter', title: 'γd,max vs % fines', xParam: 'passant_80um_avg', yParam: 'gamma_d_max_avg' }
    ]
  },
  w_opt_avg: {
    category: 'proctor',
    charts: [
      { type: 'histogram', title: 'Distribution de wopt par maille' },
      { type: 'boxplot', title: 'wopt par préfecture', groupBy: 'adm2' }
    ]
  },
  
  // Granulométrie
  passant_80um_avg: {
    category: 'granulo',
    charts: [
      { type: 'histogram', title: 'Distribution du % passant 80µm par maille' },
      { type: 'boxplot', title: '% fines par préfecture', groupBy: 'adm2' },
      { type: 'scatter', title: '% fines vs % passant 2mm', xParam: 'passant_2mm_avg', yParam: 'passant_80um_avg' }
    ]
  },
  passant_2mm_avg: {
    category: 'granulo',
    charts: [
      { type: 'histogram', title: 'Distribution du % passant 2mm par maille' },
      { type: 'boxplot', title: '% passant 2mm par préfecture', groupBy: 'adm2' }
    ]
  },
  passant_20mm_avg: {
    category: 'granulo',
    charts: [
      { type: 'histogram', title: 'Distribution du % passant 20mm par maille' },
      { type: 'boxplot', title: '% passant 20mm par préfecture', groupBy: 'adm2' }
    ]
  }
}

// ============================================================================
// Classe principale de génération de graphes
// ============================================================================

export class ChartGenerator {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private width: number
  private height: number
  
  constructor(width = 800, height = 600) {
    this.width = width
    this.height = height
    this.canvas = document.createElement('canvas')
    this.canvas.width = width
    this.canvas.height = height
    this.ctx = this.canvas.getContext('2d')!
  }
  
  /**
   * Génère tous les graphes pour une thématique donnée
   */
  async generateChartsForThematic(
    thematicId: string,
    features: any[],
    allThematicData?: Record<string, any[]>
  ): Promise<ThematicChartSet> {
    const config = THEMATIC_CHART_CONFIG[thematicId]
    if (!config) {
      console.warn(`[ChartGenerator] Pas de config pour ${thematicId}`)
      return {
        thematicId,
        thematicLabel: thematicId,
        charts: []
      }
    }
    
    const palette = CHART_PALETTES[config.category as keyof typeof CHART_PALETTES] || CHART_PALETTES.default
    const charts: ThematicChartSet['charts'] = []
    
    // Extraire les valeurs du paramètre principal
    const values = this.extractValues(features, 'value')
    const adm2Groups = this.groupByAdm2(features)
    
    for (const chartConfig of config.charts) {
      try {
        let blob: Blob | null = null
        
        switch (chartConfig.type) {
          case 'histogram':
            blob = await this.generateHistogram(values, chartConfig.title, palette[0])
            break
            
          case 'pie':
            blob = await this.generatePieChart(features, chartConfig.title, palette)
            break
            
          case 'bar':
            blob = await this.generateBarChart(adm2Groups, chartConfig.title, palette[0])
            break
            
          case 'boxplot':
            blob = await this.generateBoxplot(adm2Groups, chartConfig.title, palette)
            break
            
          case 'scatter':
            if (chartConfig.xParam && chartConfig.yParam && allThematicData) {
              const xValues = allThematicData[chartConfig.xParam] 
                ? this.extractValues(allThematicData[chartConfig.xParam], 'value')
                : []
              const yValues = values
              blob = await this.generateScatterPlot(xValues, yValues, chartConfig.title, chartConfig.xParam, chartConfig.yParam, palette[0])
            }
            break
            
          case 'casagrande':
            if (chartConfig.xParam && chartConfig.yParam && allThematicData) {
              const wlValues = allThematicData[chartConfig.xParam] 
                ? this.extractValues(allThematicData[chartConfig.xParam], 'value')
                : []
              const ipValues = values
              blob = await this.generateCasagrandeChart(wlValues, ipValues, chartConfig.title, palette)
            }
            break
            
          case 'correlation':
            if (allThematicData) {
              blob = await this.generateCorrelationMatrix(allThematicData, chartConfig.title)
            }
            break
        }
        
        if (blob) {
          const filename = `${thematicId}_${chartConfig.type}_${charts.length + 1}.png`
          charts.push({
            type: chartConfig.type,
            title: chartConfig.title,
            blob,
            filename
          })
        }
      } catch (e) {
        console.warn(`[ChartGenerator] Erreur génération ${chartConfig.type}:`, e)
      }
    }
    
    return {
      thematicId,
      thematicLabel: this.getThematicLabel(thematicId),
      charts
    }
  }
  
  // ============================================================================
  // Générateurs de graphes individuels
  // ============================================================================
  
  /**
   * Histogramme de distribution
   */
  async generateHistogram(
    values: number[],
    title: string,
    color: string
  ): Promise<Blob> {
    this.clearCanvas()
    const ctx = this.ctx
    const validValues = values.filter(v => v != null && Number.isFinite(v))
    
    if (validValues.length === 0) {
      return this.generateEmptyChart(title, 'Pas de données disponibles')
    }
    
    // Calculer les bins
    const min = Math.min(...validValues)
    const max = Math.max(...validValues)
    const numBins = Math.min(20, Math.ceil(Math.sqrt(validValues.length)))
    const binWidth = (max - min) / numBins || 1
    
    const bins: number[] = new Array(numBins).fill(0)
    for (const v of validValues) {
      const binIndex = Math.min(Math.floor((v - min) / binWidth), numBins - 1)
      bins[binIndex]++
    }
    
    // Dimensions du graphe
    const margin = { top: 60, right: 40, bottom: 80, left: 70 }
    const chartWidth = this.width - margin.left - margin.right
    const chartHeight = this.height - margin.top - margin.bottom
    
    // Fond
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, this.width, this.height)
    
    // Titre
    ctx.fillStyle = '#1f2937'
    ctx.font = 'bold 18px Arial'
    ctx.textAlign = 'center'
    ctx.fillText(title, this.width / 2, 35)
    
    // Axes
    const maxBin = Math.max(...bins)
    const barWidth = chartWidth / numBins - 2
    
    // Barres
    ctx.fillStyle = color
    for (let i = 0; i < numBins; i++) {
      const barHeight = (bins[i] / maxBin) * chartHeight
      const x = margin.left + i * (chartWidth / numBins) + 1
      const y = margin.top + chartHeight - barHeight
      
      ctx.fillRect(x, y, barWidth, barHeight)
      
      // Bordure
      ctx.strokeStyle = '#1e40af'
      ctx.lineWidth = 1
      ctx.strokeRect(x, y, barWidth, barHeight)
    }
    
    // Axe X
    ctx.strokeStyle = '#374151'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(margin.left, margin.top + chartHeight)
    ctx.lineTo(margin.left + chartWidth, margin.top + chartHeight)
    ctx.stroke()
    
    // Labels X
    ctx.fillStyle = '#4b5563'
    ctx.font = '12px Arial'
    ctx.textAlign = 'center'
    for (let i = 0; i <= numBins; i += Math.ceil(numBins / 5)) {
      const value = min + i * binWidth
      const x = margin.left + i * (chartWidth / numBins)
      ctx.fillText(value.toFixed(1), x, margin.top + chartHeight + 20)
    }
    
    // Axe Y
    ctx.beginPath()
    ctx.moveTo(margin.left, margin.top)
    ctx.lineTo(margin.left, margin.top + chartHeight)
    ctx.stroke()
    
    // Labels Y
    ctx.textAlign = 'right'
    for (let i = 0; i <= 5; i++) {
      const value = Math.round((maxBin / 5) * i)
      const y = margin.top + chartHeight - (i / 5) * chartHeight
      ctx.fillText(String(value), margin.left - 10, y + 4)
      
      // Grille
      ctx.strokeStyle = '#e5e7eb'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(margin.left, y)
      ctx.lineTo(margin.left + chartWidth, y)
      ctx.stroke()
    }
    
    // Label axes
    ctx.fillStyle = '#374151'
    ctx.font = '14px Arial'
    ctx.textAlign = 'center'
    ctx.fillText('Valeur', this.width / 2, this.height - 20)
    
    ctx.save()
    ctx.translate(20, this.height / 2)
    ctx.rotate(-Math.PI / 2)
    ctx.fillText('Nombre de mailles', 0, 0)
    ctx.restore()
    
    // Stats
    const mean = validValues.reduce((a, b) => a + b, 0) / validValues.length
    const statsText = `n=${validValues.length} | moy=${mean.toFixed(2)} | min=${min.toFixed(2)} | max=${max.toFixed(2)}`
    ctx.fillStyle = '#6b7280'
    ctx.font = '11px Arial'
    ctx.textAlign = 'center'
    ctx.fillText(statsText, this.width / 2, this.height - 5)
    
    return this.canvasToBlob()
  }
  
  /**
   * Camembert (couverture spatiale)
   */
  async generatePieChart(
    features: any[],
    title: string,
    colors: string[]
  ): Promise<Blob> {
    this.clearCanvas()
    const ctx = this.ctx
    
    // Compter mailles avec/sans données
    const withData = features.filter(f => f.properties?.value != null || f.properties?.n_sondages > 0).length
    const withoutData = features.length - withData
    const total = features.length
    
    if (total === 0) {
      return this.generateEmptyChart(title, 'Pas de données disponibles')
    }
    
    // Fond
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, this.width, this.height)
    
    // Titre
    ctx.fillStyle = '#1f2937'
    ctx.font = 'bold 18px Arial'
    ctx.textAlign = 'center'
    ctx.fillText(title, this.width / 2, 35)
    
    // Camembert
    const centerX = this.width / 2
    const centerY = this.height / 2
    const radius = Math.min(this.width, this.height) / 3
    
    const data = [
      { label: 'Avec données', value: withData, color: colors[0] || '#22c55e' },
      { label: 'Sans données', value: withoutData, color: '#e5e7eb' }
    ]
    
    let startAngle = -Math.PI / 2
    
    for (const item of data) {
      const sliceAngle = (item.value / total) * 2 * Math.PI
      
      ctx.beginPath()
      ctx.moveTo(centerX, centerY)
      ctx.arc(centerX, centerY, radius, startAngle, startAngle + sliceAngle)
      ctx.closePath()
      ctx.fillStyle = item.color
      ctx.fill()
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 2
      ctx.stroke()
      
      // Label sur la tranche
      if (item.value > 0) {
        const midAngle = startAngle + sliceAngle / 2
        const labelRadius = radius * 0.7
        const labelX = centerX + Math.cos(midAngle) * labelRadius
        const labelY = centerY + Math.sin(midAngle) * labelRadius
        
        const percent = ((item.value / total) * 100).toFixed(1)
        ctx.fillStyle = item.color === '#e5e7eb' ? '#374151' : '#ffffff'
        ctx.font = 'bold 14px Arial'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(`${percent}%`, labelX, labelY)
      }
      
      startAngle += sliceAngle
    }
    
    // Légende
    const legendY = this.height - 80
    ctx.font = '13px Arial'
    ctx.textAlign = 'left'
    
    for (let i = 0; i < data.length; i++) {
      const x = this.width / 2 - 100 + i * 150
      
      ctx.fillStyle = data[i].color
      ctx.fillRect(x, legendY, 20, 20)
      ctx.strokeStyle = '#9ca3af'
      ctx.strokeRect(x, legendY, 20, 20)
      
      ctx.fillStyle = '#374151'
      ctx.fillText(`${data[i].label} (${data[i].value})`, x + 28, legendY + 14)
    }
    
    return this.canvasToBlob()
  }
  
  /**
   * Barres par ADM2
   */
  async generateBarChart(
    adm2Groups: Record<string, number[]>,
    title: string,
    color: string
  ): Promise<Blob> {
    this.clearCanvas()
    const ctx = this.ctx
    
    const adm2Names = Object.keys(adm2Groups).sort()
    if (adm2Names.length === 0) {
      return this.generateEmptyChart(title, 'Pas de données par préfecture')
    }
    
    // Calculer les totaux ou moyennes par ADM2
    const adm2Totals = adm2Names.map(name => ({
      name,
      total: adm2Groups[name].reduce((a, b) => a + b, 0),
      count: adm2Groups[name].length
    }))
    
    // Trier par total décroissant
    adm2Totals.sort((a, b) => b.total - a.total)
    
    // Limiter à 15 ADM2 max
    const displayData = adm2Totals.slice(0, 15)
    const maxValue = Math.max(...displayData.map(d => d.total))
    
    // Dimensions
    const margin = { top: 60, right: 40, bottom: 120, left: 70 }
    const chartWidth = this.width - margin.left - margin.right
    const chartHeight = this.height - margin.top - margin.bottom
    const barWidth = chartWidth / displayData.length - 10
    
    // Fond
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, this.width, this.height)
    
    // Titre
    ctx.fillStyle = '#1f2937'
    ctx.font = 'bold 18px Arial'
    ctx.textAlign = 'center'
    ctx.fillText(title, this.width / 2, 35)
    
    // Barres
    for (let i = 0; i < displayData.length; i++) {
      const barHeight = (displayData[i].total / maxValue) * chartHeight
      const x = margin.left + i * (chartWidth / displayData.length) + 5
      const y = margin.top + chartHeight - barHeight
      
      // Dégradé
      const gradient = ctx.createLinearGradient(x, y, x, y + barHeight)
      gradient.addColorStop(0, color)
      gradient.addColorStop(1, this.adjustColor(color, -30))
      ctx.fillStyle = gradient
      ctx.fillRect(x, y, barWidth, barHeight)
      
      // Valeur au-dessus
      ctx.fillStyle = '#374151'
      ctx.font = '11px Arial'
      ctx.textAlign = 'center'
      ctx.fillText(String(Math.round(displayData[i].total)), x + barWidth / 2, y - 5)
    }
    
    // Axe X avec labels rotatés
    ctx.fillStyle = '#4b5563'
    ctx.font = '11px Arial'
    ctx.textAlign = 'right'
    
    for (let i = 0; i < displayData.length; i++) {
      const x = margin.left + i * (chartWidth / displayData.length) + barWidth / 2 + 5
      const y = margin.top + chartHeight + 10
      
      ctx.save()
      ctx.translate(x, y)
      ctx.rotate(-Math.PI / 4)
      ctx.fillText(displayData[i].name.substring(0, 15), 0, 0)
      ctx.restore()
    }
    
    // Axe Y
    ctx.strokeStyle = '#374151'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(margin.left, margin.top)
    ctx.lineTo(margin.left, margin.top + chartHeight)
    ctx.lineTo(margin.left + chartWidth, margin.top + chartHeight)
    ctx.stroke()
    
    return this.canvasToBlob()
  }
  
  /**
   * Boxplot par ADM2
   */
  async generateBoxplot(
    adm2Groups: Record<string, number[]>,
    title: string,
    colors: string[]
  ): Promise<Blob> {
    this.clearCanvas()
    const ctx = this.ctx
    
    const adm2Names = Object.keys(adm2Groups).filter(name => adm2Groups[name].length >= 3).sort()
    if (adm2Names.length === 0) {
      return this.generateEmptyChart(title, 'Pas assez de données par préfecture (min 3)')
    }
    
    // Calculer les stats pour chaque ADM2
    const boxplotData = adm2Names.slice(0, 12).map(name => {
      const values = adm2Groups[name].filter(v => v != null && Number.isFinite(v)).sort((a, b) => a - b)
      const n = values.length
      return {
        name,
        min: values[0],
        q1: values[Math.floor(n * 0.25)],
        median: values[Math.floor(n * 0.5)],
        q3: values[Math.floor(n * 0.75)],
        max: values[n - 1],
        n
      }
    })
    
    // Dimensions
    const margin = { top: 60, right: 40, bottom: 120, left: 70 }
    const chartWidth = this.width - margin.left - margin.right
    const chartHeight = this.height - margin.top - margin.bottom
    
    const allValues = Object.values(adm2Groups).flat().filter(v => v != null && Number.isFinite(v))
    const globalMin = Math.min(...allValues)
    const globalMax = Math.max(...allValues)
    const range = globalMax - globalMin || 1
    
    const boxWidth = chartWidth / boxplotData.length - 20
    
    // Fond
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, this.width, this.height)
    
    // Titre
    ctx.fillStyle = '#1f2937'
    ctx.font = 'bold 18px Arial'
    ctx.textAlign = 'center'
    ctx.fillText(title, this.width / 2, 35)
    
    // Fonction de conversion valeur -> Y
    const valueToY = (v: number) => margin.top + chartHeight - ((v - globalMin) / range) * chartHeight
    
    // Dessiner les boxplots
    for (let i = 0; i < boxplotData.length; i++) {
      const d = boxplotData[i]
      const x = margin.left + i * (chartWidth / boxplotData.length) + 10
      const centerX = x + boxWidth / 2
      
      const color = colors[i % colors.length]
      
      // Whiskers (min-max)
      ctx.strokeStyle = '#6b7280'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(centerX, valueToY(d.min))
      ctx.lineTo(centerX, valueToY(d.q1))
      ctx.moveTo(centerX, valueToY(d.q3))
      ctx.lineTo(centerX, valueToY(d.max))
      ctx.stroke()
      
      // Caps
      ctx.beginPath()
      ctx.moveTo(centerX - boxWidth / 4, valueToY(d.min))
      ctx.lineTo(centerX + boxWidth / 4, valueToY(d.min))
      ctx.moveTo(centerX - boxWidth / 4, valueToY(d.max))
      ctx.lineTo(centerX + boxWidth / 4, valueToY(d.max))
      ctx.stroke()
      
      // Box (Q1-Q3)
      const boxTop = valueToY(d.q3)
      const boxBottom = valueToY(d.q1)
      const boxHeight = boxBottom - boxTop
      
      ctx.fillStyle = color + '80' // Semi-transparent
      ctx.fillRect(x, boxTop, boxWidth, boxHeight)
      ctx.strokeStyle = color
      ctx.lineWidth = 2
      ctx.strokeRect(x, boxTop, boxWidth, boxHeight)
      
      // Médiane
      ctx.strokeStyle = '#1f2937'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(x, valueToY(d.median))
      ctx.lineTo(x + boxWidth, valueToY(d.median))
      ctx.stroke()
    }
    
    // Labels X
    ctx.fillStyle = '#4b5563'
    ctx.font = '10px Arial'
    ctx.textAlign = 'right'
    
    for (let i = 0; i < boxplotData.length; i++) {
      const x = margin.left + i * (chartWidth / boxplotData.length) + boxWidth / 2 + 10
      const y = margin.top + chartHeight + 10
      
      ctx.save()
      ctx.translate(x, y)
      ctx.rotate(-Math.PI / 4)
      ctx.fillText(`${boxplotData[i].name.substring(0, 12)} (n=${boxplotData[i].n})`, 0, 0)
      ctx.restore()
    }
    
    // Axe Y avec labels
    ctx.strokeStyle = '#374151'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(margin.left, margin.top)
    ctx.lineTo(margin.left, margin.top + chartHeight)
    ctx.stroke()
    
    ctx.fillStyle = '#4b5563'
    ctx.font = '11px Arial'
    ctx.textAlign = 'right'
    for (let i = 0; i <= 5; i++) {
      const value = globalMin + (range / 5) * i
      const y = valueToY(value)
      ctx.fillText(value.toFixed(1), margin.left - 5, y + 4)
      
      ctx.strokeStyle = '#e5e7eb'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(margin.left, y)
      ctx.lineTo(margin.left + chartWidth, y)
      ctx.stroke()
    }
    
    return this.canvasToBlob()
  }
  
  /**
   * Nuage de points (scatter plot)
   */
  async generateScatterPlot(
    xValues: number[],
    yValues: number[],
    title: string,
    xLabel: string,
    yLabel: string,
    color: string
  ): Promise<Blob> {
    this.clearCanvas()
    const ctx = this.ctx
    
    // Créer les paires de points valides
    const points: { x: number; y: number }[] = []
    const minLen = Math.min(xValues.length, yValues.length)
    
    for (let i = 0; i < minLen; i++) {
      if (xValues[i] != null && yValues[i] != null && 
          Number.isFinite(xValues[i]) && Number.isFinite(yValues[i])) {
        points.push({ x: xValues[i], y: yValues[i] })
      }
    }
    
    if (points.length < 3) {
      return this.generateEmptyChart(title, 'Pas assez de données pour le nuage de points')
    }
    
    // Dimensions
    const margin = { top: 60, right: 40, bottom: 80, left: 80 }
    const chartWidth = this.width - margin.left - margin.right
    const chartHeight = this.height - margin.top - margin.bottom
    
    const xMin = Math.min(...points.map(p => p.x))
    const xMax = Math.max(...points.map(p => p.x))
    const yMin = Math.min(...points.map(p => p.y))
    const yMax = Math.max(...points.map(p => p.y))
    const xRange = xMax - xMin || 1
    const yRange = yMax - yMin || 1
    
    // Fond
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, this.width, this.height)
    
    // Titre
    ctx.fillStyle = '#1f2937'
    ctx.font = 'bold 18px Arial'
    ctx.textAlign = 'center'
    ctx.fillText(title, this.width / 2, 35)
    
    // Grille
    ctx.strokeStyle = '#e5e7eb'
    ctx.lineWidth = 1
    for (let i = 0; i <= 5; i++) {
      const x = margin.left + (i / 5) * chartWidth
      const y = margin.top + (i / 5) * chartHeight
      
      ctx.beginPath()
      ctx.moveTo(x, margin.top)
      ctx.lineTo(x, margin.top + chartHeight)
      ctx.stroke()
      
      ctx.beginPath()
      ctx.moveTo(margin.left, y)
      ctx.lineTo(margin.left + chartWidth, y)
      ctx.stroke()
    }
    
    // Points
    ctx.fillStyle = color + 'aa'
    ctx.strokeStyle = color
    ctx.lineWidth = 1
    
    for (const p of points) {
      const px = margin.left + ((p.x - xMin) / xRange) * chartWidth
      const py = margin.top + chartHeight - ((p.y - yMin) / yRange) * chartHeight
      
      ctx.beginPath()
      ctx.arc(px, py, 4, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
    }
    
    // Ligne de tendance (régression linéaire simple)
    const n = points.length
    const sumX = points.reduce((a, p) => a + p.x, 0)
    const sumY = points.reduce((a, p) => a + p.y, 0)
    const sumXY = points.reduce((a, p) => a + p.x * p.y, 0)
    const sumX2 = points.reduce((a, p) => a + p.x * p.x, 0)
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)
    const intercept = (sumY - slope * sumX) / n
    
    if (Number.isFinite(slope) && Number.isFinite(intercept)) {
      ctx.strokeStyle = '#ef4444'
      ctx.lineWidth = 2
      ctx.setLineDash([5, 5])
      
      const y1 = slope * xMin + intercept
      const y2 = slope * xMax + intercept
      
      const px1 = margin.left
      const py1 = margin.top + chartHeight - ((y1 - yMin) / yRange) * chartHeight
      const px2 = margin.left + chartWidth
      const py2 = margin.top + chartHeight - ((y2 - yMin) / yRange) * chartHeight
      
      ctx.beginPath()
      ctx.moveTo(px1, Math.max(margin.top, Math.min(margin.top + chartHeight, py1)))
      ctx.lineTo(px2, Math.max(margin.top, Math.min(margin.top + chartHeight, py2)))
      ctx.stroke()
      ctx.setLineDash([])
      
      // R² (coefficient de détermination)
      const yMean = sumY / n
      const ssTot = points.reduce((a, p) => a + Math.pow(p.y - yMean, 2), 0)
      const ssRes = points.reduce((a, p) => a + Math.pow(p.y - (slope * p.x + intercept), 2), 0)
      const r2 = 1 - ssRes / ssTot
      
      ctx.fillStyle = '#ef4444'
      ctx.font = '12px Arial'
      ctx.textAlign = 'left'
      ctx.fillText(`R² = ${r2.toFixed(3)}`, margin.left + 10, margin.top + 20)
    }
    
    // Axes
    ctx.strokeStyle = '#374151'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(margin.left, margin.top)
    ctx.lineTo(margin.left, margin.top + chartHeight)
    ctx.lineTo(margin.left + chartWidth, margin.top + chartHeight)
    ctx.stroke()
    
    // Labels axes
    ctx.fillStyle = '#374151'
    ctx.font = '13px Arial'
    ctx.textAlign = 'center'
    ctx.fillText(this.formatParamLabel(xLabel), this.width / 2, this.height - 20)
    
    ctx.save()
    ctx.translate(25, this.height / 2)
    ctx.rotate(-Math.PI / 2)
    ctx.fillText(this.formatParamLabel(yLabel), 0, 0)
    ctx.restore()
    
    // Valeurs axes
    ctx.fillStyle = '#6b7280'
    ctx.font = '11px Arial'
    ctx.textAlign = 'center'
    for (let i = 0; i <= 5; i++) {
      const xVal = xMin + (xRange / 5) * i
      const x = margin.left + (i / 5) * chartWidth
      ctx.fillText(xVal.toFixed(1), x, margin.top + chartHeight + 20)
    }
    
    ctx.textAlign = 'right'
    for (let i = 0; i <= 5; i++) {
      const yVal = yMin + (yRange / 5) * i
      const y = margin.top + chartHeight - (i / 5) * chartHeight
      ctx.fillText(yVal.toFixed(1), margin.left - 5, y + 4)
    }
    
    // Stats
    ctx.fillStyle = '#6b7280'
    ctx.font = '11px Arial'
    ctx.textAlign = 'right'
    ctx.fillText(`n = ${points.length}`, this.width - margin.right, margin.top + 20)
    
    return this.canvasToBlob()
  }
  
  /**
   * Diagramme de Casagrande (IP vs WL)
   */
  async generateCasagrandeChart(
    wlValues: number[],
    ipValues: number[],
    title: string,
    colors: string[]
  ): Promise<Blob> {
    this.clearCanvas()
    const ctx = this.ctx
    
    // Créer les paires de points valides
    const points: { wl: number; ip: number }[] = []
    const minLen = Math.min(wlValues.length, ipValues.length)
    
    for (let i = 0; i < minLen; i++) {
      if (wlValues[i] != null && ipValues[i] != null && 
          Number.isFinite(wlValues[i]) && Number.isFinite(ipValues[i])) {
        points.push({ wl: wlValues[i], ip: ipValues[i] })
      }
    }
    
    if (points.length < 3) {
      return this.generateEmptyChart(title, 'Pas assez de données pour le diagramme')
    }
    
    // Dimensions
    const margin = { top: 60, right: 40, bottom: 80, left: 80 }
    const chartWidth = this.width - margin.left - margin.right
    const chartHeight = this.height - margin.top - margin.bottom
    
    // Échelle fixe pour Casagrande (0-100 pour WL, 0-60 pour IP typiquement)
    const wlMin = 0
    const wlMax = Math.max(100, ...points.map(p => p.wl))
    const ipMin = 0
    const ipMax = Math.max(60, ...points.map(p => p.ip))
    
    // Fond
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, this.width, this.height)
    
    // Titre
    ctx.fillStyle = '#1f2937'
    ctx.font = 'bold 18px Arial'
    ctx.textAlign = 'center'
    ctx.fillText(title, this.width / 2, 35)
    
    // Fonctions de conversion
    const wlToX = (wl: number) => margin.left + ((wl - wlMin) / (wlMax - wlMin)) * chartWidth
    const ipToY = (ip: number) => margin.top + chartHeight - ((ip - ipMin) / (ipMax - ipMin)) * chartHeight
    
    // Ligne A (IP = 0.73 * (WL - 20))
    ctx.strokeStyle = '#dc2626'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(wlToX(20), ipToY(0))
    ctx.lineTo(wlToX(wlMax), ipToY(0.73 * (wlMax - 20)))
    ctx.stroke()
    
    // Label ligne A
    ctx.fillStyle = '#dc2626'
    ctx.font = '12px Arial'
    ctx.textAlign = 'left'
    ctx.fillText('Ligne A', wlToX(wlMax) - 60, ipToY(0.73 * (wlMax - 20)) - 10)
    
    // Ligne U (IP = 0.9 * (WL - 8))
    ctx.strokeStyle = '#2563eb'
    ctx.lineWidth = 2
    ctx.setLineDash([5, 5])
    ctx.beginPath()
    ctx.moveTo(wlToX(8), ipToY(0))
    ctx.lineTo(wlToX(wlMax), ipToY(0.9 * (wlMax - 8)))
    ctx.stroke()
    ctx.setLineDash([])
    
    // Label ligne U
    ctx.fillStyle = '#2563eb'
    ctx.fillText('Ligne U', wlToX(wlMax) - 60, ipToY(0.9 * (wlMax - 8)) - 10)
    
    // Zones de classification
    ctx.fillStyle = '#fef3c7'
    ctx.globalAlpha = 0.3
    // Zone CL (argiles peu plastiques)
    ctx.fillRect(wlToX(0), ipToY(7), wlToX(50) - wlToX(0), ipToY(0) - ipToY(7))
    ctx.globalAlpha = 1
    
    // Points
    ctx.fillStyle = colors[0] + 'cc'
    ctx.strokeStyle = colors[0]
    ctx.lineWidth = 1
    
    for (const p of points) {
      const px = wlToX(p.wl)
      const py = ipToY(p.ip)
      
      ctx.beginPath()
      ctx.arc(px, py, 5, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
    }
    
    // Axes
    ctx.strokeStyle = '#374151'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(margin.left, margin.top)
    ctx.lineTo(margin.left, margin.top + chartHeight)
    ctx.lineTo(margin.left + chartWidth, margin.top + chartHeight)
    ctx.stroke()
    
    // Labels
    ctx.fillStyle = '#374151'
    ctx.font = '14px Arial'
    ctx.textAlign = 'center'
    ctx.fillText('Limite de liquidité WL (%)', this.width / 2, this.height - 20)
    
    ctx.save()
    ctx.translate(25, this.height / 2)
    ctx.rotate(-Math.PI / 2)
    ctx.fillText('Indice de plasticité IP (%)', 0, 0)
    ctx.restore()
    
    // Grille et valeurs
    ctx.fillStyle = '#6b7280'
    ctx.font = '11px Arial'
    ctx.strokeStyle = '#e5e7eb'
    ctx.lineWidth = 1
    
    for (let wl = 0; wl <= wlMax; wl += 20) {
      const x = wlToX(wl)
      ctx.beginPath()
      ctx.moveTo(x, margin.top)
      ctx.lineTo(x, margin.top + chartHeight)
      ctx.stroke()
      ctx.textAlign = 'center'
      ctx.fillText(String(wl), x, margin.top + chartHeight + 15)
    }
    
    for (let ip = 0; ip <= ipMax; ip += 10) {
      const y = ipToY(ip)
      ctx.beginPath()
      ctx.moveTo(margin.left, y)
      ctx.lineTo(margin.left + chartWidth, y)
      ctx.stroke()
      ctx.textAlign = 'right'
      ctx.fillText(String(ip), margin.left - 5, y + 4)
    }
    
    // Stats
    ctx.fillStyle = '#6b7280'
    ctx.font = '11px Arial'
    ctx.textAlign = 'right'
    ctx.fillText(`n = ${points.length}`, this.width - margin.right, margin.top + 20)
    
    return this.canvasToBlob()
  }
  
  /**
   * Matrice de corrélation
   */
  async generateCorrelationMatrix(
    allData: Record<string, any[]>,
    title: string
  ): Promise<Blob> {
    this.clearCanvas()
    const ctx = this.ctx
    
    const params = Object.keys(allData).filter(k => allData[k].length > 0).slice(0, 8)
    if (params.length < 2) {
      return this.generateEmptyChart(title, 'Pas assez de paramètres pour la matrice')
    }
    
    // Calculer les corrélations
    const correlations: number[][] = []
    for (let i = 0; i < params.length; i++) {
      correlations[i] = []
      for (let j = 0; j < params.length; j++) {
        correlations[i][j] = this.calculateCorrelation(
          this.extractValues(allData[params[i]], 'value'),
          this.extractValues(allData[params[j]], 'value')
        )
      }
    }
    
    // Dimensions
    const margin = { top: 80, right: 40, bottom: 40, left: 120 }
    const matrixSize = Math.min(this.width - margin.left - margin.right, this.height - margin.top - margin.bottom)
    const cellSize = matrixSize / params.length
    
    // Fond
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, this.width, this.height)
    
    // Titre
    ctx.fillStyle = '#1f2937'
    ctx.font = 'bold 18px Arial'
    ctx.textAlign = 'center'
    ctx.fillText(title, this.width / 2, 35)
    
    // Dessiner la matrice
    for (let i = 0; i < params.length; i++) {
      for (let j = 0; j < params.length; j++) {
        const x = margin.left + j * cellSize
        const y = margin.top + i * cellSize
        const corr = correlations[i][j]
        
        // Couleur selon corrélation
        const color = this.correlationToColor(corr)
        ctx.fillStyle = color
        ctx.fillRect(x, y, cellSize - 1, cellSize - 1)
        
        // Valeur
        ctx.fillStyle = Math.abs(corr) > 0.5 ? '#ffffff' : '#1f2937'
        ctx.font = '11px Arial'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(corr.toFixed(2), x + cellSize / 2, y + cellSize / 2)
      }
    }
    
    // Labels
    ctx.fillStyle = '#374151'
    ctx.font = '10px Arial'
    ctx.textAlign = 'right'
    ctx.textBaseline = 'middle'
    
    for (let i = 0; i < params.length; i++) {
      // Labels Y (gauche)
      ctx.fillText(this.formatParamLabel(params[i]).substring(0, 15), margin.left - 5, margin.top + i * cellSize + cellSize / 2)
      
      // Labels X (haut)
      ctx.save()
      ctx.translate(margin.left + i * cellSize + cellSize / 2, margin.top - 5)
      ctx.rotate(-Math.PI / 4)
      ctx.textAlign = 'left'
      ctx.fillText(this.formatParamLabel(params[i]).substring(0, 15), 0, 0)
      ctx.restore()
    }
    
    // Légende
    const legendX = margin.left + matrixSize + 20
    const legendY = margin.top
    const legendHeight = matrixSize
    const legendWidth = 20
    
    const gradient = ctx.createLinearGradient(legendX, legendY + legendHeight, legendX, legendY)
    gradient.addColorStop(0, '#2563eb')
    gradient.addColorStop(0.5, '#ffffff')
    gradient.addColorStop(1, '#dc2626')
    
    ctx.fillStyle = gradient
    ctx.fillRect(legendX, legendY, legendWidth, legendHeight)
    ctx.strokeStyle = '#9ca3af'
    ctx.strokeRect(legendX, legendY, legendWidth, legendHeight)
    
    ctx.fillStyle = '#374151'
    ctx.font = '10px Arial'
    ctx.textAlign = 'left'
    ctx.fillText('+1', legendX + legendWidth + 5, legendY + 10)
    ctx.fillText('0', legendX + legendWidth + 5, legendY + legendHeight / 2)
    ctx.fillText('-1', legendX + legendWidth + 5, legendY + legendHeight - 5)
    
    return this.canvasToBlob()
  }
  
  // ============================================================================
  // Méthodes utilitaires
  // ============================================================================
  
  private clearCanvas(): void {
    this.ctx.clearRect(0, 0, this.width, this.height)
  }
  
  private async canvasToBlob(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      this.canvas.toBlob(blob => {
        if (blob) resolve(blob)
        else reject(new Error('Erreur conversion canvas'))
      }, 'image/png')
    })
  }
  
  private async generateEmptyChart(title: string, message: string): Promise<Blob> {
    this.clearCanvas()
    const ctx = this.ctx
    
    ctx.fillStyle = '#f9fafb'
    ctx.fillRect(0, 0, this.width, this.height)
    
    ctx.fillStyle = '#1f2937'
    ctx.font = 'bold 18px Arial'
    ctx.textAlign = 'center'
    ctx.fillText(title, this.width / 2, this.height / 2 - 20)
    
    ctx.fillStyle = '#6b7280'
    ctx.font = '14px Arial'
    ctx.fillText(message, this.width / 2, this.height / 2 + 20)
    
    return this.canvasToBlob()
  }
  
  private extractValues(features: any[], key: string): number[] {
    return features
      .map(f => f.properties?.[key] ?? f[key])
      .filter(v => v != null && Number.isFinite(v))
  }
  
  private groupByAdm2(features: any[]): Record<string, number[]> {
    const groups: Record<string, number[]> = {}
    
    for (const f of features) {
      const adm2 = f.properties?.adm2 || f.properties?.adm2_name || f.properties?.prefecture || 'Inconnu'
      const value = f.properties?.value ?? f.properties?.n_sondages
      
      if (value != null && Number.isFinite(value)) {
        if (!groups[adm2]) groups[adm2] = []
        groups[adm2].push(value)
      }
    }
    
    return groups
  }
  
  private calculateCorrelation(x: number[], y: number[]): number {
    const n = Math.min(x.length, y.length)
    if (n < 3) return 0
    
    const pairs: { x: number; y: number }[] = []
    for (let i = 0; i < n; i++) {
      if (Number.isFinite(x[i]) && Number.isFinite(y[i])) {
        pairs.push({ x: x[i], y: y[i] })
      }
    }
    
    if (pairs.length < 3) return 0
    
    const sumX = pairs.reduce((a, p) => a + p.x, 0)
    const sumY = pairs.reduce((a, p) => a + p.y, 0)
    const sumXY = pairs.reduce((a, p) => a + p.x * p.y, 0)
    const sumX2 = pairs.reduce((a, p) => a + p.x * p.x, 0)
    const sumY2 = pairs.reduce((a, p) => a + p.y * p.y, 0)
    const pn = pairs.length
    
    const num = pn * sumXY - sumX * sumY
    const den = Math.sqrt((pn * sumX2 - sumX * sumX) * (pn * sumY2 - sumY * sumY))
    
    return den === 0 ? 0 : num / den
  }
  
  private correlationToColor(corr: number): string {
    // Rouge pour corrélation positive, bleu pour négative
    if (corr >= 0) {
      const intensity = Math.round(corr * 255)
      return `rgb(${220 + Math.round(35 * (1 - corr))}, ${Math.round(38 + 217 * (1 - corr))}, ${Math.round(38 + 217 * (1 - corr))})`
    } else {
      const intensity = Math.round(-corr * 255)
      return `rgb(${Math.round(37 + 218 * (1 + corr))}, ${Math.round(99 + 156 * (1 + corr))}, ${220 + Math.round(35 * (1 + corr))})`
    }
  }
  
  private adjustColor(hex: string, amount: number): string {
    const num = parseInt(hex.replace('#', ''), 16)
    const r = Math.min(255, Math.max(0, (num >> 16) + amount))
    const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + amount))
    const b = Math.min(255, Math.max(0, (num & 0x0000FF) + amount))
    return `#${(1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1)}`
  }
  
  private formatParamLabel(param: string): string {
    const labels: Record<string, string> = {
      n_sondages: 'Nb sondages',
      n_echantillons: 'Nb échantillons',
      n_essais_total: 'Nb essais',
      vbs_avg: 'VBS moyen',
      ip_avg: 'IP moyen',
      wl_avg: 'WL moyen',
      wp_avg: 'WP moyen',
      eg_avg: 'Eg moyen',
      eg_max: 'Eg max',
      gamma_d_max_avg: 'γd,max moyen',
      w_opt_avg: 'wopt moyen',
      passant_80um_avg: '% < 80µm',
      passant_2mm_avg: '% < 2mm',
      passant_20mm_avg: '% < 20mm'
    }
    return labels[param] || param
  }
  
  private getThematicLabel(thematicId: string): string {
    return this.formatParamLabel(thematicId)
  }
}

// ============================================================================
// Fonction principale d'export des graphes
// ============================================================================

/**
 * Génère tous les graphes pour les thématiques sélectionnées
 */
export async function generateAllCharts(
  thematics: string[],
  featuresMap: Record<string, any[]>,
  onProgress?: (msg: string, pct: number) => void
): Promise<Map<string, ThematicChartSet>> {
  const generator = new ChartGenerator(800, 600)
  const results = new Map<string, ThematicChartSet>()
  
  let current = 0
  const total = thematics.length
  
  for (const thematicId of thematics) {
    current++
    onProgress?.(`Génération graphes ${thematicId}...`, (current / total) * 100)
    
    const features = featuresMap[thematicId] || []
    if (features.length === 0) {
      console.warn(`[ChartGenerator] Pas de données pour ${thematicId}`)
      continue
    }
    
    try {
      const chartSet = await generator.generateChartsForThematic(
        thematicId,
        features,
        featuresMap // Pour les graphes de corrélation
      )
      results.set(thematicId, chartSet)
    } catch (e) {
      console.error(`[ChartGenerator] Erreur pour ${thematicId}:`, e)
    }
  }
  
  return results
}
