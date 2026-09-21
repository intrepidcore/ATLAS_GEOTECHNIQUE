jest.mock('react-native-webview', () => ({ WebView: 'WebView' }));
jest.mock('lucide-react-native', () => ({
  ArrowLeft: 'ArrowLeft',
  CheckCircle2: 'CheckCircle2',
  Crosshair: 'Crosshair',
  MapPinPlus: 'MapPinPlus',
}));

import { buildLeafletHtml } from '@/screens/MissionMapScreen';
import type { MapContext } from '@/api/mobile';

describe('Atlas Terrain Leaflet map', () => {
  const context: MapContext = {
    mission_id: 'm1', tolerance_m: 10,
    maille_geojson: { type: 'Polygon', coordinates: [[[1, 6], [1.1, 6], [1.1, 6.1], [1, 6]]] },
    center_lon: 1.05, center_lat: 6.05, bbox: null,
    planned_points: [{ id: 'p1', numero: 1, label: 'Prévu 1', lat: 6.05, lon: 1.05, confirmed_sondage_id: null }],
    existing_sondages: [],
  };

  it('embeds OpenStreetMap, the maille, planned points and the 10 m rule', () => {
    const html = buildLeafletHtml(context, null);
    expect(html).toContain('tile.openstreetmap.org');
    expect(html).toContain('L.geoJSON');
    expect(html).toContain('radius:10');
    expect(html).toContain('Prévu 1');
    expect(html).toContain('updateGps');
  });

  it('expose les fonds OSM, Carto, OpenTopoMap, Esri et Google de test', () => {
    const html = buildLeafletHtml(context, null);
    expect(html).toContain('L.control.layers');
    expect(html).toContain('Carto Positron');
    expect(html).toContain('Carto Voyager');
    expect(html).toContain('tile.opentopomap.org');
    expect(html).toContain('World_Imagery');
    expect(html).toContain('Google Routes (test)');
    expect(html).toContain('Google Satellite (test)');
    expect(html).toContain('Google Hybride (test)');
    expect(html).toContain('Google Relief (test)');
    expect(html).toContain("map.on('baselayerchange'");
    expect(html).toContain('layerControl.collapse()');
  });

  it('escapes closing markup from labels before injecting JSON into the WebView', () => {
    const malicious = { ...context, planned_points: [{ ...context.planned_points[0], label: '</script><script>alert(1)</script>' }] };
    expect(buildLeafletHtml(malicious, null)).not.toContain('</script><script>alert(1)</script>');
  });
});
