import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, CheckCircle2, Crosshair, MapPinPlus } from 'lucide-react-native';
import { mobileApi, type MapContext, type PlannedPoint } from '@/api/mobile';
import { repository } from '@/db/repository';
import { locationService, type GPSPosition } from '@/services/locationService';
import { haversineDistanceM, isWithinTolerance, nearestPlannedPoint } from '@/services/toleranceService';
import { colors, radius } from '@/theme/tokens';
import type { RootStackParamList } from '@/navigation/routes';
import { activePackageMeta } from '@/services/atlaspack/unlock';
import { explodeMbtilesIfNeeded, offlineTilesDirFor } from '@/services/atlaspack/offlineTiles';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Rt = RouteProp<RootStackParamList, 'MissionMap'>;
const RULE_RADIUS_M = 10;

function safeJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

export function buildLeafletHtml(ctx: MapContext, initialPosition: GPSPosition | null, offlineTilesUrl: string | null = null): string {
  const payload = safeJson({
    maille: ctx.maille_geojson,
    planned: ctx.planned_points,
    existing: ctx.existing_sondages,
    center: [ctx.center_lat ?? 6.1319, ctx.center_lon ?? 1.2228],
    position: initialPosition,
    offlineTilesUrl,
  });
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
  <style>html,body,#map{height:100%;margin:0;background:#e5e7eb}.leaflet-control-attribution{font-size:9px}.leaflet-top.leaflet-right{top:92px}.leaflet-control-layers{border:0;border-radius:10px;box-shadow:0 2px 10px rgba(15,23,42,.18)}.leaflet-control-layers-expanded{max-height:55vh;overflow:auto;font:12px sans-serif}.planned-label{background:#fff;border:2px solid #f59e0b;border-radius:50%;color:#111827;font:700 11px sans-serif;text-align:center;line-height:24px}.planned-done{border-color:#22c55e}.gps-dot{width:18px;height:18px;border:4px solid #fff;border-radius:50%;background:#2563eb;box-shadow:0 0 0 3px rgba(37,99,235,.28)}</style>
  </head><body><div id="map"></div><script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script><script>
  const data=${payload}; const map=L.map('map',{zoomControl:true}).setView(data.center,14); const bounds=[];
  const osm=L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap contributors'}).addTo(map);
  const positron=L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',{subdomains:'abcd',maxZoom:20,attribution:'&copy; OpenStreetMap contributors &copy; CARTO'});
  const voyager=L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',{subdomains:'abcd',maxZoom:20,attribution:'&copy; OpenStreetMap contributors &copy; CARTO'});
  const opentopo=L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',{maxZoom:17,attribution:'Map data &copy; OpenStreetMap contributors, SRTM | Style &copy; OpenTopoMap'});
  const esriSat=L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxZoom:19,attribution:'Tiles &copy; Esri'});
  const esriTopo=L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',{maxZoom:19,attribution:'Tiles &copy; Esri'});
  const googleOptions={subdomains:['mt0','mt1','mt2','mt3'],maxZoom:20,attribution:'&copy; Google - test de compatibilite'};
  const googleRoad=L.tileLayer('https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',googleOptions);
  const googleSat=L.tileLayer('https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',googleOptions);
  const googleHybrid=L.tileLayer('https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',googleOptions);
  const googleRelief=L.tileLayer('https://{s}.google.com/vt/lyrs=p&x={x}&y={y}&z={z}',googleOptions);
  const baseLayers={'OSM Standard':osm,'Carto Positron':positron,'Carto Voyager':voyager,'OpenTopoMap':opentopo,'Esri Satellite':esriSat,'Esri Topographique':esriTopo,'Google Routes (test)':googleRoad,'Google Satellite (test)':googleSat,'Google Hybride (test)':googleHybrid,'Google Relief (test)':googleRelief};
  if(data.offlineTilesUrl){const offline=L.tileLayer(data.offlineTilesUrl,{maxZoom:19,minZoom:1,attribution:'Tuiles hors-ligne (paquet .atlaspack)'});baseLayers['Hors-ligne (paquet)']=offline;offline.addTo(map);osm.remove()}
  const layerControl=L.control.layers(baseLayers,null,{position:'topright',collapsed:true}).addTo(map);
  map.on('baselayerchange',()=>{layerControl.collapse();L.DomUtil.removeClass(layerControl.getContainer(),'leaflet-control-layers-expanded')});
  if(data.maille){const g=L.geoJSON(data.maille,{style:{color:'#7c3aed',weight:3,fillColor:'#8b5cf6',fillOpacity:.08}}).addTo(map);try{const b=g.getBounds();if(b.isValid()){bounds.push(b.getSouthWest(),b.getNorthEast())}}catch(e){}}
  (data.planned||[]).forEach(p=>{const done=!!p.confirmed_sondage_id;const icon=L.divIcon({className:'',html:'<div class="planned-label '+(done?'planned-done':'')+'">'+p.numero+'</div>',iconSize:[28,28],iconAnchor:[14,14]});const m=L.marker([p.lat,p.lon],{icon}).addTo(map);L.circle([p.lat,p.lon],{radius:${RULE_RADIUS_M},color:done?'#22c55e':'#f59e0b',weight:2,fillOpacity:.10}).addTo(map);m.bindPopup('<b>'+(p.label||('Point '+p.numero))+'</b><br>Rayon autorisé : 10 m');m.on('click',()=>window.ReactNativeWebView.postMessage(JSON.stringify({type:'selectPoint',pointId:p.id})));bounds.push([p.lat,p.lon]);});
  (data.existing||[]).forEach(s=>{L.circleMarker([s.latitude,s.longitude],{radius:5,color:'#fff',weight:2,fillColor:'#64748b',fillOpacity:1}).addTo(map).bindPopup(s.code||'Sondage enregistré');bounds.push([s.latitude,s.longitude]);});
  let gpsMarker=null,gpsAccuracy=null;window.updateGps=(lat,lon,accuracy)=>{if(!gpsMarker){gpsMarker=L.marker([lat,lon],{icon:L.divIcon({className:'',html:'<div class="gps-dot"></div>',iconSize:[26,26],iconAnchor:[13,13]})}).addTo(map).bindPopup('Votre position GPS');gpsAccuracy=L.circle([lat,lon],{radius:accuracy||0,color:'#2563eb',weight:1,fillOpacity:.06}).addTo(map)}else{gpsMarker.setLatLng([lat,lon]);gpsAccuracy.setLatLng([lat,lon]).setRadius(accuracy||0)}};
  if(data.position)window.updateGps(data.position.latitude,data.position.longitude,data.position.accuracy);if(bounds.length)map.fitBounds(bounds,{padding:[36,36],maxZoom:17});setTimeout(()=>map.invalidateSize(),150);
  </script></body></html>`;
}

export const MissionMapScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<Rt>();
  const insets = useSafeAreaInsets();
  const webRef = useRef<WebView>(null);
  const watchRef = useRef<{ remove: () => void } | null>(null);
  const [ctx, setCtx] = useState<MapContext | null>(null);
  const [position, setPosition] = useState<GPSPosition | null>(null);
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [mapError, setMapError] = useState<string | null>(null);
  const [offlineTilesUrl, setOfflineTilesUrl] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [captured, setCaptured] = useState<{ point: PlannedPoint; position: GPSPosition; distanceM: number } | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const fresh = await mobileApi.getMapContext(params.missionId);
        const normalized = { ...fresh, tolerance_m: RULE_RADIUS_M };
        setCtx(normalized);
        await repository.saveMapContext(params.missionId, normalized);
      } catch {
        const cached = await repository.getCachedMapContext(params.missionId);
        if (cached) setCtx({ ...cached, tolerance_m: RULE_RADIUS_M });
      } finally { setLoading(false); }
    })();
  }, [params.missionId]);

  useEffect(() => {
    void (async () => {
      const meta = await activePackageMeta();
      if (!meta?.mbtilesPath) return;
      try {
        await explodeMbtilesIfNeeded(meta.packageId, meta.mbtilesPath);
        setOfflineTilesUrl(`file://${offlineTilesDirFor(meta.packageId)}{z}/{x}/{y}.png`);
      } catch {
        // Pas de fond hors-ligne disponible : les fonds distants restent
        // utilisables si le réseau revient — jamais bloquant.
      }
    })();
  }, []);

  useEffect(() => {
    void locationService.requestForegroundPermission().then((granted) => {
      if (!granted) return;
      void locationService.watchPosition(setPosition).then((sub) => { watchRef.current = sub; });
    });
    return () => watchRef.current?.remove();
  }, []);

  useEffect(() => {
    if (position) webRef.current?.injectJavaScript(`window.updateGps&&window.updateGps(${position.latitude},${position.longitude},${position.accuracy || 0});true;`);
  }, [position]);

  const nearest = useMemo(() => {
    if (!position || !ctx) return null;
    return nearestPlannedPoint(ctx.planned_points.filter((p) => !p.confirmed_sondage_id), position.latitude, position.longitude);
  }, [position, ctx]);
  const selected = useMemo(() => {
    if (!ctx || !position) return null;
    const point = ctx.planned_points.find((p) => p.id === selectedPointId && !p.confirmed_sondage_id) ?? nearest?.point;
    return point ? { point, distanceM: haversineDistanceM(position.latitude, position.longitude, point.lat, point.lon) } : null;
  }, [ctx, position, selectedPointId, nearest]);
  const canConfirm = !!selected && isWithinTolerance(selected.distanceM, RULE_RADIUS_M);

  const openForm = useCallback((mode: 'confirm' | 'relocate') => {
    if (!captured) return;
    navigation.navigate('SondageForm', {
      missionId: params.missionId,
      plannedPointId: captured.point.id,
      plannedPointLabel: captured.point.label ?? `Point ${captured.point.numero}`,
      plannedLat: captured.point.lat,
      plannedLon: captured.point.lon,
      mode,
      distanceM: captured.distanceM,
      lat: captured.position.latitude,
      lon: captured.position.longitude,
    });
  }, [captured, navigation, params.missionId]);

  const capturePosition = useCallback(async () => {
    if (!selected) return;
    setCapturing(true);
    try {
      const fresh = await locationService.getCurrentPosition();
      const distanceM = haversineDistanceM(fresh.latitude, fresh.longitude, selected.point.lat, selected.point.lon);
      setPosition(fresh);
      setSelectedPointId(selected.point.id);
      setCaptured({ point: selected.point, position: fresh, distanceM });
    } catch {
      Alert.alert('Position indisponible', 'Impossible de capturer une position GPS précise. Vérifiez la localisation puis réessayez.');
    } finally {
      setCapturing(false);
    }
  }, [selected]);

  const onMapMessage = (event: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data) as { type?: string; pointId?: string };
      if (msg.type === 'selectPoint' && msg.pointId) { setSelectedPointId(msg.pointId); setCaptured(null); }
    } catch { /* message cartographique non reconnue */ }
  };

  if (loading) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.gray50 }}><ActivityIndicator color={colors.blue600} /></View>;
  if (!ctx) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: colors.gray50 }}><Text style={{ color: colors.gray900, textAlign: 'center' }}>Carte indisponible hors connexion : ouvrez d’abord cette mission avec le réseau actif.</Text><Pressable onPress={() => navigation.goBack()} style={{ marginTop: 18 }}><Text style={{ color: colors.blue600 }}>Retour</Text></Pressable></View>;

  return <View style={{ flex: 1, backgroundColor: colors.gray50 }}>
    <WebView
      ref={webRef}
      originWhitelist={['*']}
      source={{ html: buildLeafletHtml(ctx, position, offlineTilesUrl) }}
      onMessage={onMapMessage}
      onError={() => setMapError('Impossible de charger la carte terrain')}
      javaScriptEnabled
      domStorageEnabled
      allowFileAccess
      allowUniversalAccessFromFileURLs
      allowFileAccessFromFileURLs
      style={{ flex: 1 }}
    />
    <View style={{ position: 'absolute', top: insets.top + 8, left: 12, right: 12, gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Pressable accessibilityLabel="Retour" onPress={() => navigation.goBack()} style={{ backgroundColor: colors.white, borderRadius: radius.full, padding: 11 }}><ArrowLeft size={20} color={colors.gray900} /></Pressable>
        <View style={{ flex: 1, backgroundColor: colors.white, borderRadius: radius.xl, paddingHorizontal: 12, paddingVertical: 8 }}>
          <Text style={{ fontSize: 12, fontWeight: '700', color: canConfirm ? colors.green500 : colors.gray900 }}>{selected ? `${selected.point.label ?? `Point ${selected.point.numero}`} · ${Math.round(selected.distanceM)} m` : ctx.planned_points.length ? 'Position GPS en attente…' : 'Aucun point prévisionnel'}</Text>
          <Text style={{ fontSize: 10, color: colors.gray500 }}>Rayon obligatoire : 10 m · touchez un point pour le sélectionner</Text>
        </View>
      </View>
      {mapError ? <View style={{ backgroundColor: '#fee2e2', borderRadius: 10, padding: 9 }}><Text style={{ color: '#991b1b', fontSize: 12 }}>{mapError}. Vérifiez la connexion utilisée par le fond sélectionné.</Text></View> : null}
    </View>
    {selected && position ? <View style={{ position: 'absolute', left: 16, right: 16, bottom: insets.bottom + 16, gap: 8 }}>
      {!captured ? <Pressable disabled={capturing} onPress={() => void capturePosition()} style={{ backgroundColor: colors.blue600, borderRadius: radius.xl, paddingVertical: 15, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, opacity: capturing ? 0.7 : 1 }}><Crosshair size={18} color={colors.white} /><Text style={{ color: colors.white, fontWeight: '700' }}>{capturing ? 'Capture GPS en cours…' : 'Capturer ma position pour ce point'}</Text></Pressable>
      : isWithinTolerance(captured.distanceM, RULE_RADIUS_M) ? <Pressable onPress={() => openForm('confirm')} style={{ backgroundColor: colors.green500, borderRadius: radius.xl, paddingVertical: 15, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 }}><CheckCircle2 size={18} color={colors.white} /><Text style={{ color: colors.white, fontWeight: '700' }}>Continuer avec ce point · {Math.round(captured.distanceM)} m</Text></Pressable>
      : <View style={{ backgroundColor: colors.white, borderRadius: radius.xl, padding: 12, gap: 9 }}><Text style={{ color: '#b45309', fontWeight: '700', fontSize: 13 }}>Position capturée à {Math.round(captured.distanceM)} m · confirmation normale bloquée</Text><Pressable onPress={() => openForm('relocate')} style={{ backgroundColor: '#d97706', borderRadius: radius.xl, paddingVertical: 13, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 }}><MapPinPlus size={18} color={colors.white} /><Text style={{ color: colors.white, fontWeight: '700' }}>Enregistrer un point alternatif</Text></Pressable></View>}
    </View> : null}
  </View>;
};

export function distanceToNearestPlanned(points: PlannedPoint[], lat: number, lon: number) {
  const nearest = nearestPlannedPoint(points, lat, lon);
  return nearest ? { pointId: nearest.point.id, distanceM: nearest.distanceM } : null;
}
