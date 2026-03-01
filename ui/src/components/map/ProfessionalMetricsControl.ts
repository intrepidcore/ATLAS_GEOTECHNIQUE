import L from 'leaflet'
import proj4 from 'proj4'
import styles from './ProfessionalMetricsControl.module.css'

export type ProfessionalMetricsControlOptions = {
  position?: L.ControlPosition
  getMailleCode?: () => string | null
}

function formatLat(lat: number) {
  return lat.toFixed(6)
}

function formatLng(lng: number) {
  return lng.toFixed(6)
}

function formatEasting(x: number) {
  return x.toFixed(2)
}

function formatNorthing(y: number) {
  return y.toFixed(2)
}

function niceScaleMeters(targetMeters: number): number {
  if (!Number.isFinite(targetMeters) || targetMeters <= 0) return 0
  const pow = Math.pow(10, Math.floor(Math.log10(targetMeters)))
  const n = targetMeters / pow
  const step = n >= 5 ? 5 : n >= 2 ? 2 : 1
  return step * pow
}

function formatDistanceLabel(meters: number): string {
  if (!Number.isFinite(meters) || meters <= 0) return '—'
  if (meters >= 1000) {
    const km = meters / 1000
    const isInt = Math.abs(km - Math.round(km)) < 1e-9
    return `${isInt ? km.toFixed(0) : km.toFixed(1)} km`
  }
  return `${Math.round(meters)} m`
}

export function createProfessionalMetricsControl(
  options: ProfessionalMetricsControlOptions = {}
): L.Control {
  const Control = L.Control.extend({
    options: {
      position: options.position ?? ('bottomleft' as L.ControlPosition),
    },

    onAdd: function (map: L.Map) {
      const container = L.DomUtil.create('div', styles.container)
      container.setAttribute('role', 'group')
      container.setAttribute('aria-label', 'Map metrics')

      const bar = L.DomUtil.create('div', styles.bar, container)

      const zoomItem = L.DomUtil.create('div', styles.item, bar)
      zoomItem.innerHTML = `<span class="${styles.k}">Zoom</span><span class="${styles.v}">—</span>`
      const zoomValue = zoomItem.querySelector(`.${styles.v}`) as HTMLSpanElement

      const sep1 = L.DomUtil.create('div', styles.sep, bar)
      sep1.setAttribute('aria-hidden', 'true')

      const latItem = L.DomUtil.create('div', styles.item, bar)
      latItem.innerHTML = `<span class="${styles.k}">Lat</span><span class="${styles.v} ${styles.mono}">—</span>`
      const latValue = latItem.querySelector(`.${styles.v}`) as HTMLSpanElement

      const sep2 = L.DomUtil.create('div', styles.sep, bar)
      sep2.setAttribute('aria-hidden', 'true')

      const lngItem = L.DomUtil.create('div', styles.item, bar)
      lngItem.innerHTML = `<span class="${styles.k}">Lng</span><span class="${styles.v} ${styles.mono}">—</span>`
      const lngValue = lngItem.querySelector(`.${styles.v}`) as HTMLSpanElement

      const sep3 = L.DomUtil.create('div', styles.sep, bar)
      sep3.setAttribute('aria-hidden', 'true')

      const eItem = L.DomUtil.create('div', styles.item, bar)
      eItem.innerHTML = `<span class="${styles.k}">E</span><span class="${styles.v} ${styles.mono}">—</span>`
      const eValue = eItem.querySelector(`.${styles.v}`) as HTMLSpanElement

      const sep4 = L.DomUtil.create('div', styles.sep, bar)
      sep4.setAttribute('aria-hidden', 'true')

      const nItem = L.DomUtil.create('div', styles.item, bar)
      nItem.innerHTML = `<span class="${styles.k}">N</span><span class="${styles.v} ${styles.mono}">—</span>`
      const nValue = nItem.querySelector(`.${styles.v}`) as HTMLSpanElement

      const sep5 = L.DomUtil.create('div', styles.sep, bar)
      sep5.setAttribute('aria-hidden', 'true')

      const mailleItem = L.DomUtil.create('div', styles.item, bar)
      mailleItem.innerHTML = `<span class="${styles.k}">Maille</span><span class="${styles.v}">–</span>`
      const mailleValue = mailleItem.querySelector(`.${styles.v}`) as HTMLSpanElement

      const sep6 = L.DomUtil.create('div', styles.sep, bar)
      sep6.setAttribute('aria-hidden', 'true')

      const scaleWrap = L.DomUtil.create('div', styles.scaleWrap, bar)
      const scaleBar = L.DomUtil.create('div', styles.scaleBar, scaleWrap)
      const scaleLine = L.DomUtil.create('div', styles.scaleLine, scaleBar)
      const scaleTickLeft = L.DomUtil.create('div', styles.scaleTick, scaleBar)
      scaleTickLeft.classList.add(styles.tickLeft)
      const scaleTickMid = L.DomUtil.create('div', styles.scaleTick, scaleBar)
      scaleTickMid.classList.add(styles.tickMid)
      const scaleTickRight = L.DomUtil.create('div', styles.scaleTick, scaleBar)
      scaleTickRight.classList.add(styles.tickRight)
      const scaleLabel = L.DomUtil.create('div', styles.scaleLabel, scaleWrap)

      const spacer = L.DomUtil.create('div', styles.spacer, bar)
      spacer.setAttribute('aria-hidden', 'true')

      const sep7 = L.DomUtil.create('div', styles.sep, bar)
      sep7.setAttribute('aria-hidden', 'true')

      const crsItem = L.DomUtil.create('div', styles.itemSecondary, bar)
      crsItem.textContent = 'CRS 4326 (view) | 25231 (internal)'

      const sep8 = L.DomUtil.create('div', styles.sep, bar)
      sep8.setAttribute('aria-hidden', 'true')

      const osmItem = L.DomUtil.create('div', styles.itemSecondary, bar)
      osmItem.textContent = '© OpenStreetMap contributors'

      L.DomEvent.disableClickPropagation(container)
      L.DomEvent.disableScrollPropagation(container)

      // Make the Leaflet bottom corner wrapper span full width for this control
      window.setTimeout(() => {
        const parent = container.parentElement
        if (!parent) return
        // The control wrapper is positioned in the Leaflet corner; stretch it across
        // the map container instead of using viewport units to avoid clipping.
        parent.style.left = '0'
        parent.style.right = '0'
        parent.style.width = 'auto'
        parent.style.margin = '0 8px 8px 8px'
        parent.style.pointerEvents = 'none'
        container.style.pointerEvents = 'auto'
      }, 0)

      const updateZoom = () => {
        zoomValue.textContent = String(map.getZoom())
      }

      const updateScale = () => {
        const center = map.getCenter()
        const p1 = center
        const p2 = L.latLng(center.lat, center.lng + 0.01)

        const dMeters = map.distance(p1, p2)
        const x1 = map.latLngToContainerPoint(p1).x
        const x2 = map.latLngToContainerPoint(p2).x
        const px = Math.max(1, Math.abs(x2 - x1))
        const metersPerPx = dMeters / px

        const targetPx = 120
        const targetMeters = metersPerPx * targetPx
        const niceMeters = niceScaleMeters(targetMeters)
        const barPx = Math.max(1, Math.round(niceMeters / metersPerPx))

        ;(scaleBar as HTMLElement).style.width = `${barPx}px`
        scaleLabel.textContent = formatDistanceLabel(niceMeters)
      }

      let rafId: number | null = null
      let pendingLatLng: L.LatLng | null = null

      const flushMouse = () => {
        rafId = null
        if (!pendingLatLng) return

        const { lat, lng } = pendingLatLng
        latValue.textContent = formatLat(lat)
        lngValue.textContent = formatLng(lng)

        try {
          const [x, y] = proj4('EPSG:4326', 'EPSG:25231', [lng, lat]) as [number, number]
          eValue.textContent = formatEasting(x)
          nValue.textContent = formatNorthing(y)
        } catch {
          eValue.textContent = '—'
          nValue.textContent = '—'
        }

        const maille = options.getMailleCode?.() ?? null
        mailleValue.textContent = maille || '–'
      }

      const onMouseMove = (e: L.LeafletMouseEvent) => {
        pendingLatLng = e.latlng
        if (rafId !== null) return
        rafId = window.requestAnimationFrame(flushMouse)
      }

      updateZoom()
      updateScale()
      map.on('zoomend', updateZoom)
      map.on('zoomend', updateScale)
      map.on('moveend', updateScale)
      map.on('mousemove', onMouseMove)

      // Return cleanup handler
      ;(this as any)._cleanup = () => {
        map.off('zoomend', updateZoom)
        map.off('zoomend', updateScale)
        map.off('moveend', updateScale)
        map.off('mousemove', onMouseMove)
        if (rafId !== null) {
          window.cancelAnimationFrame(rafId)
          rafId = null
        }
      }

      return container
    },

    onRemove: function () {
      const cleanup = (this as any)._cleanup
      if (typeof cleanup === 'function') cleanup()
    },
  })

  return new Control()
}
