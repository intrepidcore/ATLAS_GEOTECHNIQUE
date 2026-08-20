// Distance haversine en mètres. Approximation suffisante pour le retour visuel
// côté client — la validation qui compte est côté serveur (PostGIS geography,
// ADR-MOBILE-004). Ne jamais bloquer une confirmation uniquement sur ce calcul.
const EARTH_RADIUS_M = 6371000;

export function haversineDistanceM(
  lat1: number, lon1: number, lat2: number, lon2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_M * c;
}

export function isWithinTolerance(distanceM: number, toleranceM: number): boolean {
  return distanceM <= toleranceM;
}

export function nearestPlannedPoint<T extends { lat: number; lon: number }>(
  points: T[],
  lat: number,
  lon: number
): { point: T; distanceM: number } | null {
  if (points.length === 0) return null;
  let best = points[0];
  let bestDist = haversineDistanceM(lat, lon, best.lat, best.lon);
  for (const p of points.slice(1)) {
    const d = haversineDistanceM(lat, lon, p.lat, p.lon);
    if (d < bestDist) {
      best = p;
      bestDist = d;
    }
  }
  return { point: best, distanceM: bestDist };
}
