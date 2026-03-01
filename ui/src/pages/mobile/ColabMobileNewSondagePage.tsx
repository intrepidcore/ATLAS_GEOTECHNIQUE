/**
 * Page "Nouveau Sondage Terrain" - PWA Mobile Atlas Colab
 * 
 * Formulaire de saisie rapide d'un sondage sur le terrain
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { 
  ArrowLeft, MapPin, Crosshair, Camera, Save, 
  Cloud, CloudOff, Loader2, CheckCircle, AlertCircle
} from 'lucide-react';
import { syncService, gpsService, type GPSPosition, type CreateFieldSondageRequest } from '@/services/colab-mobile-api';

// ============================================================================
// Composants UI
// ============================================================================

const MobileHeader: React.FC<{
  title: string;
  onBack: () => void;
}> = ({ title, onBack }) => (
  <header className="sticky top-0 z-50 bg-blue-600 text-white px-4 py-3 shadow-lg">
    <div className="flex items-center gap-3">
      <button onClick={onBack} className="p-1 -ml-1">
        <ArrowLeft className="h-6 w-6" />
      </button>
      <h1 className="text-lg font-semibold">{title}</h1>
    </div>
  </header>
);

const FormField: React.FC<{
  label: string;
  required?: boolean;
  children: React.ReactNode;
  hint?: string;
}> = ({ label, required, children, hint }) => (
  <div className="space-y-1">
    <label className="block text-sm font-medium text-gray-700">
      {label}
      {required && <span className="text-red-500 ml-1">*</span>}
    </label>
    {children}
    {hint && <p className="text-xs text-gray-500">{hint}</p>}
  </div>
);

const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = (props) => (
  <input
    {...props}
    className={`w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base ${props.className || ''}`}
  />
);

const TextArea: React.FC<React.TextareaHTMLAttributes<HTMLTextAreaElement>> = (props) => (
  <textarea
    {...props}
    className={`w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base resize-none ${props.className || ''}`}
  />
);

const GPSCard: React.FC<{
  position: GPSPosition | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}> = ({ position, loading, error, onRefresh }) => (
  <div className="bg-gray-50 rounded-xl p-4">
    <div className="flex items-center justify-between mb-2">
      <div className="flex items-center gap-2 text-gray-700">
        <MapPin className="h-5 w-5 text-blue-500" />
        <span className="font-medium">Position GPS</span>
      </div>
      <button
        onClick={onRefresh}
        disabled={loading}
        className="text-blue-600 text-sm font-medium flex items-center gap-1"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Crosshair className="h-4 w-4" />
        )}
        Actualiser
      </button>
    </div>
    
    {error ? (
      <div className="text-red-600 text-sm flex items-center gap-1">
        <AlertCircle className="h-4 w-4" />
        {error}
      </div>
    ) : position ? (
      <div className="space-y-1 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-500">Longitude</span>
          <span className="font-mono">{position.longitude.toFixed(6)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Latitude</span>
          <span className="font-mono">{position.latitude.toFixed(6)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Précision</span>
          <span className={position.accuracy > 20 ? 'text-yellow-600' : 'text-green-600'}>
            ±{Math.round(position.accuracy)}m
          </span>
        </div>
      </div>
    ) : (
      <div className="text-gray-400 text-sm">En attente de position...</div>
    )}
  </div>
);

const PhotoButton: React.FC<{
  label: string;
  count: number;
  onClick: () => void;
}> = ({ label, count, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="flex-1 flex flex-col items-center gap-1 p-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:border-blue-400 hover:text-blue-500 transition-colors"
  >
    <Camera className="h-6 w-6" />
    <span className="text-xs">{label}</span>
    {count > 0 && (
      <span className="bg-blue-500 text-white text-xs px-2 py-0.5 rounded-full">{count}</span>
    )}
  </button>
);

// ============================================================================
// Page principale
// ============================================================================

const ColabMobileNewSondagePage: React.FC = () => {
  const navigate = useNavigate();
  const { id: missionId } = useParams<{ id: string }>();
  const location = useLocation();
  
  // État du formulaire
  const [position, setPosition] = useState<GPSPosition | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  
  const [depthM, setDepthM] = useState('');
  const [layersCount, setLayersCount] = useState('');
  const [profileDescription, setProfileDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [photos, setPhotos] = useState<{ type: string; uri: string }[]>([]);
  
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<{ success: boolean; offline: boolean; message: string } | null>(null);

  // Initialiser avec la position passée en state (depuis la carte)
  useEffect(() => {
    const state = location.state as { longitude?: number; latitude?: number; accuracy?: number } | undefined;
    if (state?.longitude && state?.latitude) {
      setPosition({
        longitude: state.longitude,
        latitude: state.latitude,
        accuracy: state.accuracy || 0,
        altitude: null,
        timestamp: Date.now(),
      });
    } else {
      refreshGPS();
    }
  }, []);

  const refreshGPS = async () => {
    setGpsLoading(true);
    setGpsError(null);
    
    try {
      const pos = await gpsService.getCurrentPosition({ timeout: 15000 });
      setPosition(pos);
    } catch (err: any) {
      setGpsError(err.message);
    } finally {
      setGpsLoading(false);
    }
  };

  const handlePhotoClick = (type: string) => {
    // TODO: Implémenter la capture photo
    // Pour l'instant, on simule l'ajout d'une photo
    alert(`Capture photo "${type}" - Fonctionnalité à venir`);
  };

  const handleSubmit = async (syncNow: boolean) => {
    if (!position || !missionId) {
      alert('Position GPS requise');
      return;
    }

    setSaving(true);
    setSaveResult(null);

    try {
      const data: CreateFieldSondageRequest = {
        longitude: position.longitude,
        latitude: position.latitude,
        location_accuracy_m: position.accuracy,
        depth_m: depthM ? parseFloat(depthM) : undefined,
        layers_count: layersCount ? parseInt(layersCount) : undefined,
        profile_description: profileDescription || undefined,
        notes: notes || undefined,
      };

      if (syncNow && syncService.isOnline()) {
        const result = await syncService.createSondage(missionId, data);
        setSaveResult({
          success: true,
          offline: result.offline,
          message: result.offline 
            ? 'Sondage enregistré localement (à synchroniser)'
            : 'Sondage enregistré avec succès',
        });
      } else {
        // Forcer le mode offline
        const result = await syncService.createSondage(missionId, data);
        setSaveResult({
          success: true,
          offline: true,
          message: 'Sondage enregistré localement',
        });
      }

      // Retourner à la carte après 2 secondes
      setTimeout(() => {
        navigate(-1);
      }, 2000);
    } catch (err: any) {
      setSaveResult({
        success: false,
        offline: false,
        message: err.message || 'Erreur lors de l\'enregistrement',
      });
    } finally {
      setSaving(false);
    }
  };

  const isOnline = syncService.isOnline();
  const canSubmit = position !== null && !saving;

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      <MobileHeader title="Nouveau sondage" onBack={() => navigate(-1)} />

      <main className="p-4 space-y-4">
        {/* Résultat de sauvegarde */}
        {saveResult && (
          <div className={`rounded-xl p-4 flex items-center gap-3 ${
            saveResult.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
          }`}>
            {saveResult.success ? (
              <CheckCircle className="h-6 w-6 flex-shrink-0" />
            ) : (
              <AlertCircle className="h-6 w-6 flex-shrink-0" />
            )}
            <div>
              <div className="font-medium">{saveResult.message}</div>
              {saveResult.offline && (
                <div className="text-sm opacity-75">Sera synchronisé dès que possible</div>
              )}
            </div>
          </div>
        )}

        {/* Position GPS */}
        <GPSCard
          position={position}
          loading={gpsLoading}
          error={gpsError}
          onRefresh={refreshGPS}
        />

        {/* Formulaire */}
        <div className="bg-white rounded-xl shadow-sm p-4 space-y-4">
          <FormField label="Profondeur atteinte" hint="En mètres">
            <Input
              type="number"
              inputMode="decimal"
              step="0.1"
              min="0"
              max="50"
              placeholder="Ex: 3.5"
              value={depthM}
              onChange={(e) => setDepthM(e.target.value)}
            />
          </FormField>

          <FormField label="Nombre de couches">
            <Input
              type="number"
              inputMode="numeric"
              min="1"
              max="20"
              placeholder="Ex: 4"
              value={layersCount}
              onChange={(e) => setLayersCount(e.target.value)}
            />
          </FormField>

          <FormField 
            label="Description du profil" 
            hint="Type de sol, couleur, texture pour chaque couche"
          >
            <TextArea
              rows={4}
              placeholder="Ex: 0-0.5m: Terre végétale brune&#10;0.5-2m: Argile rouge compacte&#10;2-3.5m: Sable argileux beige"
              value={profileDescription}
              onChange={(e) => setProfileDescription(e.target.value)}
            />
          </FormField>

          <FormField label="Notes / Observations">
            <TextArea
              rows={3}
              placeholder="Observations particulières, difficultés rencontrées..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </FormField>
        </div>

        {/* Photos */}
        <div className="bg-white rounded-xl shadow-sm p-4">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Photos</h3>
          <div className="flex gap-2">
            <PhotoButton
              label="Surface"
              count={photos.filter(p => p.type === 'surface').length}
              onClick={() => handlePhotoClick('surface')}
            />
            <PhotoButton
              label="Fouille"
              count={photos.filter(p => p.type === 'fouille').length}
              onClick={() => handlePhotoClick('fouille')}
            />
            <PhotoButton
              label="Détail"
              count={photos.filter(p => p.type === 'detail').length}
              onClick={() => handlePhotoClick('detail')}
            />
          </div>
        </div>
      </main>

      {/* Boutons d'action fixes */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 safe-area-inset-bottom">
        <div className="flex gap-3">
          <button
            onClick={() => handleSubmit(false)}
            disabled={!canSubmit}
            className="flex-1 flex items-center justify-center gap-2 bg-gray-100 text-gray-700 py-3 px-4 rounded-xl font-medium disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <CloudOff className="h-5 w-5" />
            )}
            Enregistrer offline
          </button>
          <button
            onClick={() => handleSubmit(true)}
            disabled={!canSubmit || !isOnline}
            className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white py-3 px-4 rounded-xl font-medium disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Cloud className="h-5 w-5" />
            )}
            Synchroniser
          </button>
        </div>
        {!isOnline && (
          <p className="text-center text-xs text-gray-500 mt-2">
            Mode hors-ligne • Synchronisation non disponible
          </p>
        )}
      </div>
    </div>
  );
};

export default ColabMobileNewSondagePage;
