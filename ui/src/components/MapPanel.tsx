import React, { useMemo, useRef } from 'react'
import { MapContainer, TileLayer, useMap } from 'react-leaflet'
import L, { LatLngBoundsExpression } from 'leaflet'

interface MapPanelProps {
  onBboxDraw: (bbox: [number, number, number, number]) => void
  bboxToZoom?: { min_x: number; min_y: number; max_x: number; max_y: number } | null
}

function BoxZoomHook({ onBboxDraw, bboxToZoom }: MapPanelProps) {
  const map = useMap()

  React.useEffect(() => {
    function handleBoxZoomEnd(e: any) {
      const b = e.boxZoomBounds as L.LatLngBounds
      const sw = b.getSouthWest()
      const ne = b.getNorthEast()
      onBboxDraw([sw.lng, sw.lat, ne.lng, ne.lat])
    }
    map.on('boxzoomend', handleBoxZoomEnd)
    return () => {
      map.off('boxzoomend', handleBoxZoomEnd)
    }
  }, [map, onBboxDraw])

  React.useEffect(() => {
    if (bboxToZoom) {
      const bounds: LatLngBoundsExpression = [
        [bboxToZoom.min_y, bboxToZoom.min_x],
        [bboxToZoom.max_y, bboxToZoom.max_x],
      ]
      map.fitBounds(bounds, { padding: [20, 20] })
    }
  }, [bboxToZoom, map])

  return null
}

export function MapPanel(props: MapPanelProps) {
  return (
    <div className="h-full min-h-[300px]">
      <MapContainer center={[6.15, 1.21]} zoom={7} style={{ height: '100%', width: '100%' }} boxZoom={true}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" />
        <BoxZoomHook {...props} />
      </MapContainer>
    </div>
  )
}
