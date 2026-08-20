import { haversineDistanceM, isWithinTolerance, nearestPlannedPoint } from '@/services/toleranceService';

describe('haversineDistanceM', () => {
  it('returns ~0 for identical coordinates', () => {
    expect(haversineDistanceM(6.1319, 1.2228, 6.1319, 1.2228)).toBeCloseTo(0, 3);
  });

  it('matches a known distance order of magnitude (Lomé area, ~1.5km)', () => {
    // Deux points espacés d'environ 1.5 km (delta lat ~0.0135°).
    const d = haversineDistanceM(6.1319, 1.2228, 6.1454, 1.2228);
    expect(d).toBeGreaterThan(1400);
    expect(d).toBeLessThan(1600);
  });
});

describe('isWithinTolerance', () => {
  it('accepts distance strictly under tolerance', () => {
    expect(isWithinTolerance(4.9, 15)).toBe(true);
  });

  it('accepts distance exactly at tolerance (inclusive)', () => {
    expect(isWithinTolerance(15, 15)).toBe(true);
  });

  it('rejects distance over tolerance', () => {
    expect(isWithinTolerance(15.01, 15)).toBe(false);
  });
});

describe('nearestPlannedPoint', () => {
  const points = [
    { id: 'a', lat: 6.1319, lon: 1.2228 },
    { id: 'b', lat: 6.2, lon: 1.3 },
  ];

  it('returns null for an empty list', () => {
    expect(nearestPlannedPoint([], 6.13, 1.22)).toBeNull();
  });

  it('picks the closest point among several', () => {
    const result = nearestPlannedPoint(points, 6.132, 1.223);
    expect(result?.point.id).toBe('a');
  });
});
