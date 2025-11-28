/**
 * Page "Carte Terrain" - PWA Mobile Atlas Colab
 * 
 * Carte plein écran avec GPS, maille et sondages
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { 
  ArrowLeft, Crosshair, Layers, Plus, Navigation, 
  AlertTriangle, CheckCircle, MapPin, X
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, Polygon, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import * as turf from '@turf/turf';
import { mobileApi, gpsService, type MapContext, type GPSPosition } from '@/services/colab-mobile-api';
import 'leaflet/dist/leaflet.css';

// Fix pour les icônes Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Icône personnalisée pour la position GPS
const gpsIcon = new L.DivIcon({
  className: 'gps-marker',
  html: `<div class="w-6 h-6 bg-blue-500 border-4 border-white rounded-full shadow-lg animate-pulse"></div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

// Icône pour les sondages
const sondageIcon = (status: string | null) => new L.DivIcon({
  className: 'sondage-marker',
  html: `<div class="w-4 h-4 ${
    status === 'validated' ? 'bg-green-500' :
    status === 'draft_field' ? 'bg-yellow-500' : 'bg-gray-400'
  } border-2 border-white rounded-full shadow"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

// ============================================================================
// Composants
// ============================================================================

const MapHeader: React.FC<{
  onBack: () => void;
  inMaille: boolean | null;
  accuracy: number | null;
}> = ({ onBack, inMaille, accuracy }) => (
  <div className="absolute top-0 left-0 right-0 z-[1000] p-2">
    <div className="flex items-center justify-between">
      <button
        onClick={onBack}
        className="bg-white shadow-lg rounded-full p-2"
      >
        <ArrowLeft className="h-6 w-6 text-gray-700" />
      </button>
      
      <div className="flex items-center gap-2">
        {accuracy !== null && (
          <div className="bg-white shadow-lg rounded-full px-3 py-1 text-sm flex items-center gap-1">
            <Navigation className="h-4 w-4 text-blue-500" />
            <span>±{Math.round(accuracy)}m</span>
          </div>
        )}
        
        {inMaille !== null && (
          <div className={`shadow-lg rounded-full px-3 py-1 text-sm flex items-center gap-1 ${
            inMaille ? 'bg-green-500 text-white' : 'bg-yellow-500 text-white'
          }`}>
            {inMaille ? (
              <>
                <CheckCircle className="h-4 w-4" />
                <span>Dans la maille</span>
              </>
            ) : (
              <>
                <AlertTriangle className="h-4 w-4" />
                <span>Hors maille</span>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  </div>
);

const MapControls: React.FC<{
  onCenterGPS: () => void;
  onCenterMaille: () => void;
  onNewSondage: () => void;
}> = ({ onCenterGPS, onCenterMaille, onNewSondage }) => (
  <div className="absolute bottom-24 right-4 z-[1000] flex flex-col gap-2">
    <button
      onClick={onCenterGPS}
      className="bg-white shadow-lg rounded-full p-3"
      title="Centrer sur ma position"
    >
      <Crosshair className="h-6 w-6 text-blue-600" />
    </button>
    <button
      onClick={onCenterMaille}
      className="bg-white shadow-lg rounded-full p-3"
      title="Centrer sur la maille"
    >
      <Layers className="h-6 w-6 text-gray-600" />
    </button>
    <button
      onClick={onNewSondage}
      className="bg-blue-600 shadow-lg rounded-full p-3"
      title="Nouveau sondage"
    >
      <Plus className="h-6 w-6 text-white" />
    </button>
  </div>
);

const MailleBanner: React.FC<{
  message: string;
  type: 'enter' | 'exit';
  onClose: () => void;
}> = ({ message, type, onClose }) => (
  <div className={`absolute top-16 left-4 right-4 z-[1000] ${
    type === 'enter' ? 'bg-green-500' : 'bg-red-500'
  } text-white rounded-lg shadow-lg p-3 flex items-center justify-between animate-slide-down`}>
    <div className="flex items-center gap-2">
      {type === 'enter' ? (
        <CheckCircle className="h-5 w-5" />
      ) : (
        <AlertTriangle className="h-5 w-5" />
      )}
      <span className="font-medium">{message}</span>
    </div>
    <button onClick={onClose}>
      <X className="h-5 w-5" />
    </button>
  </div>
);

// Composant pour gérer le recentrage de la carte
const MapController: React.FC<{
  center: [number, number] | null;
  zoom: number | null;
}> = ({ center, zoom }) => {
  const map = useMap();
  
  useEffect(() => {
    if (center && zoom) {
      map.flyTo(center, zoom, { duration: 0.5 });
    }
  }, [center, zoom, map]);
  
  return null;
};

// ============================================================================
// Page principale
// ============================================================================

const ColabMobileMissionMapPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  
  const [mapContext, setMapContext] = useState<MapContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [gpsPosition, setGpsPosition] = useState<GPSPosition | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [inMaille, setInMaille] = useState<boolean | null>(null);
  const [wasInMaille, setWasInMaille] = useState<boolean | null>(null);
  
  const [banner, setBanner] = useState<{ message: string; type: 'enter' | 'exit' } | null>(null);
  const [flyTo, setFlyTo] = useState<{ center: [number, number]; zoom: number } | null>(null);
  
  const watchIdRef = useRef<number>(-1);
  const maillePolygonRef = useRef<turf.Feature<turf.Polygon> | null>(null);

  // Charger le contexte carte
  useEffect(() => {
    if (id) {
      loadMapContext(id);
    }
    
    return () => {
      if (watchIdRef.current >= 0) {
        gpsService.clearWatch(watchIdRef.current);
      }
    };
  }, [id]);

  // Démarrer le suivi GPS une fois le contexte chargé
  useEffect(() => {
    if (mapContext) {
      startGPSTracking();
    }
  }, [mapContext]);

  // Détecter entrée/sortie de maille
  useEffect(() => {
    if (inMaille !== null && wasInMaille !== null && inMaille !== wasInMaille) {
      if (inMaille) {
        setBanner({ message: 'Vous êtes entré dans la maille de mission', type: 'enter' });
      } else {
        setBanner({ message: 'Vous êtes sorti de la maille de mission', type: 'exit' });
      }
      
      // Masquer le banner après 5 secondes
      setTimeout(() => setBanner(null), 5000);
    }
    setWasInMaille(inMaille);
  }, [inMaille]);

  const loadMapContext = async (missionId: string) => {
    setLoading(true);
    try {
      const context = await mobileApi.getMapContext(missionId);
      setMapContext(context);
      
      // Préparer le polygone Turf pour la détection
      if (context.maille_geojson) {
        maillePolygonRef.current = turf.feature(context.maille_geojson as turf.Polygon);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const startGPSTracking = () => {
    watchIdRef.current = gpsService.watchPosition(
      (position) => {
        setGpsPosition(position);
        setGpsError(null);
        
        // Vérifier si dans la maille
        if (maillePolygonRef.current) {
          const point = turf.point([position.longitude, position.latitude]);
          const isInside = turf.booleanPointInPolygon(point, maillePolygonRef.current);
          setInMaille(isInside);
        }
      },
      (error) => {
        setGpsError(error.message);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
    );
  };

  const handleCenterGPS = () => {
    if (gpsPosition) {
      setFlyTo({
        center: [gpsPosition.latitude, gpsPosition.longitude],
        zoom: 17,
      });
    }
  };

  const handleCenterMaille = () => {
    if (mapContext?.bbox) {
      setFlyTo({
        center: [mapContext.bbox.center_lat, mapContext.bbox.center_lon],
        zoom: 14,
      });
    }
  };

  const handleNewSondage = () => {
    navigate(`/missions/${id}/sondages/new`, {
      state: gpsPosition ? {
        longitude: gpsPosition.longitude,
        latitude: gpsPosition.latitude,
        accuracy: gpsPosition.accuracy,
      } : undefined,
    });
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Chargement de la carte...</p>
        </div>
      </div>
    );
  }

  if (error || !mapContext) {
    return (
      <div className="h-screen flex flex-col">
        <MapHeader onBack={() => navigate(-1)} inMaille={null} accuracy={null} />
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="bg-red-50 text-red-700 p-4 rounded-lg text-center">
            <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
            <p>{error || 'Impossible de charger la carte'}</p>
          </div>
        </div>
      </div>
    );
  }

  // Calculer le centre et le zoom initial
  const initialCenter: [number, number] = mapContext.center_lat && mapContext.center_lon
    ? [mapContext.center_lat, mapContext.center_lon]
    : [6.1319, 1.2228]; // Lomé par défaut
  
  const initialZoom = mapContext.bbox ? 14 : 12;

  // Convertir le GeoJSON de la maille en positions Leaflet
  const maillePositions: [number, number][] = [];
  if (mapContext.maille_geojson && mapContext.maille_geojson.type === 'Polygon') {
    const coords = (mapContext.maille_geojson as GeoJSON.Polygon).coordinates[0];
    coords.forEach(coord => {
      maillePositions.push([coord[1], coord[0]]);
    });
  }

  return (
    <div className="h-screen relative">
      <MapHeader 
        onBack={() => navigate(-1)} 
        inMaille={inMaille}
        accuracy={gpsPosition?.accuracy || null}
      />
      
      {banner && (
        <MailleBanner
          message={banner.message}
          type={banner.type}
          onClose={() => setBanner(null)}
        />
      )}

      <MapContainer
        center={initialCenter}
        zoom={initialZoom}
        className="h-full w-full"
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        <MapController 
          center={flyTo?.center || null} 
          zoom={flyTo?.zoom || null} 
        />

        {/* Polygone de la maille */}
        {maillePositions.length > 0 && (
          <Polygon
            positions={maillePositions}
            pathOptions={{
              color: inMaille ? '#10B981' : '#3B82F6',
              weight: 3,
              fillColor: inMaille ? '#10B981' : '#3B82F6',
              fillOpacity: 0.1,
            }}
          />
        )}

        {/* Sondages existants */}
        {mapContext.existing_sondages.map(sondage => (
          <Marker
            key={sondage.id}
            position={[sondage.latitude, sondage.longitude]}
            icon={sondageIcon(sondage.status)}
          >
            <Popup>
              <div className="text-sm">
                <strong>{sondage.code || 'Sans code'}</strong>
                <br />
                <span className="text-gray-500">
                  {sondage.status === 'validated' ? 'Validé' :
                   sondage.status === 'draft_field' ? 'Brouillon' : 'En attente'}
                </span>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Position GPS */}
        {gpsPosition && (
          <>
            <Circle
              center={[gpsPosition.latitude, gpsPosition.longitude]}
              radius={gpsPosition.accuracy}
              pathOptions={{
                color: '#3B82F6',
                fillColor: '#3B82F6',
                fillOpacity: 0.1,
                weight: 1,
              }}
            />
            <Marker
              position={[gpsPosition.latitude, gpsPosition.longitude]}
              icon={gpsIcon}
            >
              <Popup>
                <div className="text-sm">
                  <strong>Ma position</strong>
                  <br />
                  Précision: ±{Math.round(gpsPosition.accuracy)}m
                </div>
              </Popup>
            </Marker>
          </>
        )}
      </MapContainer>

      <MapControls
        onCenterGPS={handleCenterGPS}
        onCenterMaille={handleCenterMaille}
        onNewSondage={handleNewSondage}
      />

      {/* Message d'erreur GPS */}
      {gpsError && (
        <div className="absolute bottom-4 left-4 right-4 z-[1000] bg-yellow-100 text-yellow-800 rounded-lg p-3 text-sm">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            <span>{gpsError}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default ColabMobileMissionMapPage;
