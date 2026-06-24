import React, { useCallback, useEffect, useRef, useState } from 'react';
import { MapPin, Plus, Trash2, X, CheckCircle2 } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { maillesApi, MailleSuggestItem, SondagePointInput } from '../../services/colab-api';

// Fix Leaflet default marker icons (Vite asset issue)
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// ─── Maille picker ───────────────────────────────────────────────────────────

interface MaillePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (maille: MailleSuggestItem) => void;
  initialLat?: number;
  initialLon?: number;
}

export const MaillePickerModal: React.FC<MaillePickerModalProps> = ({
  isOpen,
  onClose,
  onSelect,
  initialLat = 8.6,
  initialLon = 0.8,
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resolved, setResolved] = useState<MailleSuggestItem | null>(null);
  const [clickedCoords, setClickedCoords] = useState<{ lat: number; lon: number } | null>(null);

  const resolveCoords = useCallback(async (lat: number, lon: number) => {
    setResolving(true);
    setError(null);
    setResolved(null);
    try {
      const m = await maillesApi.resolve({ lat, lon });
      setResolved(m);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Aucune maille trouvée à cet emplacement");
    } finally {
      setResolving(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen || !mapRef.current) return;

    if (leafletRef.current) {
      leafletRef.current.remove();
      leafletRef.current = null;
    }

    const map = L.map(mapRef.current, {
      center: [initialLat, initialLon],
      zoom: 7,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      maxZoom: 18,
    }).addTo(map);

    map.on('click', (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      setClickedCoords({ lat, lon: lng });

      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lng]);
      } else {
        markerRef.current = L.marker([lat, lng]).addTo(map);
      }

      resolveCoords(lat, lng);
    });

    leafletRef.current = map;

    return () => {
      map.remove();
      leafletRef.current = null;
      markerRef.current = null;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-2xl mx-4 flex flex-col"
        style={{ height: '80vh', maxHeight: 640 }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700 shrink-0">
          <div>
            <div className="text-base font-semibold flex items-center gap-2">
              <MapPin className="w-4 h-4 text-blue-500" />
              Sélectionner une maille
            </div>
            <div className="text-xs text-slate-500 mt-0.5">Cliquez sur la carte pour identifier la maille</div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Map */}
        <div ref={mapRef} className="flex-1 rounded-none" style={{ zIndex: 1 }} />

        {/* Footer */}
        <div className="shrink-0 px-5 py-3 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-b-2xl">
          {!clickedCoords && (
            <p className="text-sm text-slate-500 text-center">Cliquez sur la carte pour sélectionner</p>
          )}
          {clickedCoords && resolving && (
            <p className="text-sm text-blue-600 text-center animate-pulse">
              Résolution de la maille en cours...
            </p>
          )}
          {clickedCoords && error && (
            <p className="text-sm text-red-600 text-center">{error}</p>
          )}
          {resolved && (
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 min-w-0">
                <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                <div className="min-w-0">
                  <div className="font-mono text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                    {resolved.code}
                  </div>
                  <div className="text-xs text-slate-500 truncate">
                    {[resolved.adm1_name, resolved.adm2_name, resolved.adm3_name].filter(Boolean).join(' / ')}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={onClose}
                  className="px-3 py-1.5 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={() => {
                    onSelect(resolved);
                    onClose();
                  }}
                  className="px-4 py-1.5 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  Choisir cette maille
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Tile utilities for GPS picker ───────────────────────────────────────────

export type TileId =
  | 'esri_sat' | 'esri_topo'
  | 'google_hybrid' | 'google_sat' | 'google_road' | 'google_terrain'
  | 'carto_voyager' | 'carto_positron' | 'carto_dark'
  | 'stamen_terrain' | 'opentopo' | 'osm';

const TILE_DEFS: Record<TileId, { url: string; subdomains?: string | string[]; maxZoom: number; label: string }> = {
  esri_sat:       { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', maxZoom: 19, label: 'ESRI Sat' },
  esri_topo:      { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', maxZoom: 19, label: 'ESRI Topo' },
  google_hybrid:  { url: 'http://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', subdomains: ['mt0','mt1','mt2','mt3'], maxZoom: 20, label: 'G-Hybride' },
  google_sat:     { url: 'http://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', subdomains: ['mt0','mt1','mt2','mt3'], maxZoom: 20, label: 'G-Sat' },
  google_road:    { url: 'http://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', subdomains: ['mt0','mt1','mt2','mt3'], maxZoom: 20, label: 'G-Route' },
  google_terrain: { url: 'http://{s}.google.com/vt/lyrs=p&x={x}&y={y}&z={z}', subdomains: ['mt0','mt1','mt2','mt3'], maxZoom: 20, label: 'G-Relief' },
  carto_voyager:  { url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', subdomains: 'abcd', maxZoom: 19, label: 'Voyager' },
  carto_positron: { url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', subdomains: 'abcd', maxZoom: 19, label: 'Clair' },
  carto_dark:     { url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', subdomains: 'abcd', maxZoom: 19, label: 'Sombre' },
  stamen_terrain: { url: 'https://stamen-tiles-{s}.a.ssl.fastly.net/terrain/{z}/{x}/{y}.jpg', subdomains: 'abcd', maxZoom: 18, label: 'Terrain' },
  opentopo:       { url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', maxZoom: 17, label: 'OpenTopo' },
  osm:            { url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', maxZoom: 19, label: 'OSM' },
};

export function createTileLayer(id: TileId): L.TileLayer {
  const def = TILE_DEFS[id];
  return L.tileLayer(def.url, { maxZoom: def.maxZoom, subdomains: def.subdomains as any });
}

interface TileSelectorProps {
  current: TileId;
  onChange: (id: TileId) => void;
}

const TileSelector: React.FC<TileSelectorProps> = ({ current, onChange }) => (
  <div className="absolute bottom-2 left-2 flex gap-1 z-[1000]">
    {(Object.entries(TILE_DEFS) as [TileId, typeof TILE_DEFS[TileId]][]).map(([id, def]) => (
      <button
        key={id}
        onClick={() => onChange(id)}
        className={`px-2 py-0.5 rounded text-[10px] font-medium shadow transition-colors ${
          current === id
            ? 'bg-blue-600 text-white'
            : 'bg-white/90 text-slate-700 hover:bg-white border border-slate-200'
        }`}
      >
        {def.label}
      </button>
    ))}
  </div>
);

// ─── GPS sondage picker ───────────────────────────────────────────────────────

interface GpsPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (points: SondagePointInput[]) => void;
  initialPoints?: SondagePointInput[];
  initialLat?: number;
  initialLon?: number;
  /** Codes des mailles (ex: "TG-0048-0045-01") — affichées en bordure rose, fond transparent */
  mailleCodes?: string[];
}

export const GpsPickerModal: React.FC<GpsPickerModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  initialPoints = [],
  initialLat = 8.6,
  initialLon = 0.8,
  mailleCodes = [],
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const mailleLayerRef = useRef<L.GeoJSON | null>(null);
  const initialPointsRef = useRef(initialPoints);
  const [tileId, setTileId] = useState<TileId>('esri_sat');
  const [points, setPoints] = useState<SondagePointInput[]>(initialPoints);
  const [editingLabel, setEditingLabel] = useState<number | null>(null);
  const [labelInput, setLabelInput] = useState('');
  const [mailleLoadError, setMailleLoadError] = useState<string | null>(null);

  const redrawMarkers = useCallback((map: L.Map, pts: SondagePointInput[], onRemove: (idx: number) => void) => {
    markersRef.current.forEach(m => m.remove());
    markersRef.current = pts.map((pt, idx) => {
      const icon = L.divIcon({
        html: `<div style="
          background:#2563eb;color:white;border-radius:50%;width:24px;height:24px;
          display:flex;align-items:center;justify-content:center;
          font-size:11px;font-weight:700;border:2px solid white;
          box-shadow:0 1px 4px rgba(0,0,0,0.4)
        ">${idx + 1}</div>`,
        className: '',
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });
      const marker = L.marker([pt.lat, pt.lon], { icon })
        .addTo(map)
        .bindPopup(`<b>S${idx + 1}</b>${pt.label ? ' — ' + pt.label : ''}<br/>${pt.lat.toFixed(6)}, ${pt.lon.toFixed(6)}`);
      return marker;
    });
  }, []);

  // ── Map initialisation ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen || !mapRef.current) return;

    if (leafletRef.current) {
      leafletRef.current.remove();
      leafletRef.current = null;
    }

    const map = L.map(mapRef.current, {
      center: [initialLat, initialLon],
      zoom: 7,
      zoomControl: true,
    });

    const tile = createTileLayer(tileId);
    tile.addTo(map);
    tileLayerRef.current = tile;

    let currentPoints = [...initialPointsRef.current];

    const handleRemove = (idx: number) => {
      currentPoints = currentPoints.filter((_, i) => i !== idx);
      setPoints([...currentPoints]);
      redrawMarkers(map, currentPoints, handleRemove);
    };

    map.on('click', (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      const newPoint: SondagePointInput = {
        lat: Math.round(lat * 1000000) / 1000000,
        lon: Math.round(lng * 1000000) / 1000000,
        label: `S${currentPoints.length + 1}`,
      };
      currentPoints = [...currentPoints, newPoint];
      setPoints([...currentPoints]);
      redrawMarkers(map, currentPoints, handleRemove);
    });

    redrawMarkers(map, currentPoints, handleRemove);
    leafletRef.current = map;

    return () => {
      map.remove();
      leafletRef.current = null;
      markersRef.current = [];
      tileLayerRef.current = null;
      mailleLayerRef.current = null;
    };
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Maille overlay — se recharge si isOpen ou mailleCodes change ──────────
  const mailleCodesKey = mailleCodes.join(',');
  useEffect(() => {
    if (!isOpen) return;
    const map = leafletRef.current;
    if (!map) return;

    let cancelled = false;
    setMailleLoadError(null);

    if (mailleCodes.length === 0) {
      if (mailleLayerRef.current) { mailleLayerRef.current.remove(); mailleLayerRef.current = null; }
      return;
    }

    (async () => {
      if (mailleLayerRef.current) { mailleLayerRef.current.remove(); mailleLayerRef.current = null; }
      try {
        const geometries = await Promise.all(
          mailleCodes.map(code => maillesApi.getGeometry(code).catch((err: unknown) => {
            console.warn('[GpsPickerModal] geometry fetch failed for', code, err);
            return null;
          }))
        );
        if (cancelled || !leafletRef.current) return;

        const features = geometries.flatMap((geom, i) =>
          geom ? [{ type: 'Feature' as const, geometry: geom, properties: { code: mailleCodes[i] } }] : []
        );

        if (features.length === 0) {
          setMailleLoadError(`Géométrie indisponible pour ${mailleCodes.length} maille(s)`);
          return;
        }

        const layer = L.geoJSON(
          { type: 'FeatureCollection', features } as any,
          { style: { color: '#ec4899', weight: 2.5, opacity: 1, fillColor: '#ec4899', fillOpacity: 0.08 } }
        ).addTo(leafletRef.current);

        mailleLayerRef.current = layer;

        if (initialPointsRef.current.length === 0) {
          try {
            const bounds = layer.getBounds();
            if (bounds.isValid()) leafletRef.current.fitBounds(bounds, { padding: [30, 30] });
          } catch { /* ignore */ }
        }
      } catch (err: unknown) {
        if (!cancelled) setMailleLoadError('Erreur chargement contours mailles');
        console.error('[GpsPickerModal] maille geometry error:', err);
      }
    })();

    return () => { cancelled = true; };
  }, [isOpen, mailleCodesKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Tile swap ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!leafletRef.current) return;
    if (tileLayerRef.current) tileLayerRef.current.remove();
    const newTile = createTileLayer(tileId);
    newTile.addTo(leafletRef.current);
    if (mailleLayerRef.current) mailleLayerRef.current.bringToFront();
    tileLayerRef.current = newTile;
  }, [tileId]);

  const removePoint = (idx: number) => {
    const updated = points.filter((_, i) => i !== idx);
    setPoints(updated);
    if (leafletRef.current) redrawMarkers(leafletRef.current, updated, removePoint);
  };

  const updateLabel = (idx: number, label: string) => {
    const updated = points.map((p, i) => i === idx ? { ...p, label } : p);
    setPoints(updated);
    if (leafletRef.current) redrawMarkers(leafletRef.current, updated, removePoint);
    setEditingLabel(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full mx-4 flex flex-col"
        style={{ maxWidth: 900, height: '85vh', maxHeight: 700 }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700 shrink-0">
          <div>
            <div className="text-base font-semibold flex items-center gap-2">
              <MapPin className="w-4 h-4 text-green-500" />
              Localiser les sondages prévus
            </div>
            <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
              Cliquez sur la carte pour ajouter des points — {points.length} point{points.length !== 1 ? 's' : ''}
              {mailleCodes.length > 0 && !mailleLoadError && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-pink-50 text-pink-600 text-[10px] font-medium">
                  <span className="w-2 h-2 rounded-full bg-pink-400 inline-block" />
                  {mailleCodes.length} maille{mailleCodes.length !== 1 ? 's' : ''} affichée{mailleCodes.length !== 1 ? 's' : ''}
                </span>
              )}
              {mailleLoadError && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-red-50 text-red-600 text-[10px] font-medium">
                  ⚠ {mailleLoadError}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body — map + list side by side */}
        <div className="flex flex-1 min-h-0">
          {/* Map */}
          <div className="flex-1 relative" style={{ zIndex: 1 }}>
            <div ref={mapRef} className="w-full h-full" />
            <TileSelector current={tileId} onChange={setTileId} />
          </div>

          {/* Points list */}
          <div className="w-56 shrink-0 border-l border-slate-200 dark:border-slate-700 flex flex-col">
            <div className="px-3 py-2 text-xs font-medium text-slate-500 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
              Points ({points.length})
            </div>
            <div className="flex-1 overflow-y-auto">
              {points.length === 0 && (
                <div className="px-3 py-4 text-xs text-slate-400 text-center">Aucun point</div>
              )}
              {points.map((pt, idx) => (
                <div key={idx} className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 last:border-0">
                  <div className="flex items-center gap-1.5">
                    <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                      {idx + 1}
                    </div>
                    {editingLabel === idx ? (
                      <input
                        autoFocus
                        className="flex-1 text-xs border border-blue-400 rounded px-1 py-0.5 bg-white dark:bg-slate-900"
                        value={labelInput}
                        onChange={e => setLabelInput(e.target.value)}
                        onBlur={() => updateLabel(idx, labelInput || `S${idx + 1}`)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') updateLabel(idx, labelInput || `S${idx + 1}`);
                          if (e.key === 'Escape') setEditingLabel(null);
                        }}
                      />
                    ) : (
                      <button
                        className="flex-1 text-left text-xs text-slate-700 dark:text-slate-200 hover:text-blue-600 truncate"
                        onClick={() => { setEditingLabel(idx); setLabelInput(pt.label || `S${idx + 1}`); }}
                      >
                        {pt.label || `S${idx + 1}`}
                      </button>
                    )}
                    <button
                      onClick={() => removePoint(idx)}
                      className="shrink-0 text-slate-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5 pl-6 font-mono">
                    {pt.lat.toFixed(5)}, {pt.lon.toFixed(5)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 px-5 py-3 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between gap-4 bg-white dark:bg-slate-900 rounded-b-2xl">
          <span className="text-xs text-slate-500">
            {points.length === 0
              ? "Cliquez sur la carte pour ajouter des points GPS"
              : `${points.length} point${points.length !== 1 ? 's' : ''} — cliquez encore pour en ajouter`}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={() => {
                onConfirm(points);
                onClose();
              }}
              className="px-4 py-1.5 text-sm font-medium bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
            >
              Confirmer {points.length} point{points.length !== 1 ? 's' : ''}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
