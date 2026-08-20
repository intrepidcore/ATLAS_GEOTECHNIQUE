import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import MapLibreGL from '@maplibre/maplibre-react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, radius } from '@/theme/tokens';
import { repository } from '@/db/repository';
import { mobileApi, type MapContext, type PlannedPoint } from '@/api/mobile';
import { locationService, type GPSPosition } from '@/services/locationService';
import { haversineDistanceM, isWithinTolerance, nearestPlannedPoint } from '@/services/toleranceService';
import type { RootStackParamList } from '@/navigation/routes';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Rt = RouteProp<RootStackParamList, 'MissionMap'>;

// Style vecteur OSM libre — pas de clé API requise. À remplacer par des
// tuiles pré-téléchargées pour l'offline complet (hors périmètre V0.1,
// cf. roadmap "Hors périmètre").
const MAP_STYLE_URL = 'https://demotiles.maplibre.org/style.json';

export const MissionMapScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<Rt>();
  const [ctx, setCtx] = useState<MapContext | null>(null);
  const [position, setPosition] = useState<GPSPosition | null>(null);
  const [loading, setLoading] = useState(true);
  const watchRef = useRef<{ remove: () => void } | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const fresh = await mobileApi.getMapContext(params.missionId);
        setCtx(fresh);
        await repository.saveMapContext(params.missionId, fresh);
      } catch {
        const points = await repository.getPlannedPoints(params.missionId);
        const tolerance = (await repository.getCachedTolerance(params.missionId)) ?? 15;
        setCtx({
          mission_id: params.missionId,
          maille_geojson: null,
          center_lon: null,
          center_lat: null,
          bbox: null,
          tolerance_m: tolerance,
          planned_points: points,
          existing_sondages: [],
        });
      } finally {
        setLoading(false);
      }
    })();
  }, [params.missionId]);

  useEffect(() => {
    void locationService.requestForegroundPermission().then((granted) => {
      if (!granted) return;
      void locationService.watchPosition(setPosition).then((sub) => {
        watchRef.current = sub;
      });
    });
    return () => watchRef.current?.remove();
  }, []);

  const nearest = useMemo(() => {
    if (!position || !ctx || ctx.planned_points.length === 0) return null;
    return nearestPlannedPoint(ctx.planned_points, position.latitude, position.longitude);
  }, [position, ctx]);

  const canConfirm =
    !!nearest && !!ctx && isWithinTolerance(nearest.distanceM, ctx.tolerance_m) && !nearest.point.confirmed_sondage_id;

  const onConfirm = useCallback(async () => {
    if (!nearest || !position) return;
    navigation.navigate('SondageForm', {
      missionId: params.missionId,
      plannedPointId: nearest.point.id,
      lat: position.latitude,
      lon: position.longitude,
    });
  }, [nearest, position, navigation, params.missionId]);

  if (loading || !ctx) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.gray50 }}>
        <ActivityIndicator color={colors.blue600} />
      </View>
    );
  }

  const centerLon = ctx.center_lon ?? position?.longitude ?? 1.2228;
  const centerLat = ctx.center_lat ?? position?.latitude ?? 6.1319;

  return (
    <View style={{ flex: 1 }}>
      <MapLibreGL.MapView style={{ flex: 1 }} styleURL={MAP_STYLE_URL}>
        <MapLibreGL.Camera zoomLevel={14} centerCoordinate={[centerLon, centerLat]} />

        {ctx.maille_geojson ? (
          <MapLibreGL.ShapeSource id="maille" shape={ctx.maille_geojson as GeoJSON.Geometry}>
            <MapLibreGL.FillLayer id="maille-fill" style={{ fillColor: colors.blue600, fillOpacity: 0.1 }} />
            <MapLibreGL.LineLayer id="maille-line" style={{ lineColor: colors.blue600, lineWidth: 2 }} />
          </MapLibreGL.ShapeSource>
        ) : null}

        {ctx.planned_points.map((p: PlannedPoint) => (
          <MapLibreGL.PointAnnotation key={p.id} id={`planned-${p.id}`} coordinate={[p.lon, p.lat]}>
            <View
              style={{
                width: 16,
                height: 16,
                borderRadius: 8,
                backgroundColor: p.confirmed_sondage_id ? colors.green500 : colors.yellow500,
                borderWidth: 2,
                borderColor: colors.white,
              }}
            />
          </MapLibreGL.PointAnnotation>
        ))}

        {ctx.existing_sondages.map((s) => (
          <MapLibreGL.PointAnnotation key={s.id} id={`sondage-${s.id}`} coordinate={[s.longitude, s.latitude]}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.gray400, borderWidth: 2, borderColor: colors.white }} />
          </MapLibreGL.PointAnnotation>
        ))}

        <MapLibreGL.UserLocation visible showsUserHeadingIndicator />
      </MapLibreGL.MapView>

      <View style={{ position: 'absolute', top: 12, left: 12, right: 12, flexDirection: 'row', justifyContent: 'space-between' }}>
        <Pressable onPress={() => navigation.goBack()} style={{ backgroundColor: colors.white, borderRadius: radius.full, padding: 10 }}>
          <Text>←</Text>
        </Pressable>
        {nearest ? (
          <View style={{ backgroundColor: colors.white, borderRadius: radius.full, paddingHorizontal: 12, paddingVertical: 6 }}>
            <Text style={{ fontSize: 12, fontWeight: '600' }}>
              {Math.round(nearest.distanceM)} m du point {nearest.point.numero} (tolérance {ctx.tolerance_m} m)
            </Text>
          </View>
        ) : null}
      </View>

      {canConfirm ? (
        <View style={{ position: 'absolute', bottom: 24, left: 16, right: 16 }}>
          <Pressable
            onPress={onConfirm}
            style={{ backgroundColor: colors.green500, borderRadius: radius.xl, paddingVertical: 16, alignItems: 'center' }}
          >
            <Text style={{ color: colors.white, fontWeight: '700', fontSize: 15 }}>
              Confirmer le point {nearest?.point.numero}
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
};

// Exporté pour test unitaire (pas de dépendance carte).
export function distanceToNearestPlanned(points: PlannedPoint[], lat: number, lon: number) {
  const nearest = nearestPlannedPoint(points, lat, lon);
  if (!nearest) return null;
  return { pointId: nearest.point.id, distanceM: haversineDistanceM(lat, lon, nearest.point.lat, nearest.point.lon) };
}
