-- ============================================================================
-- Migration 064: Atlas Colab - Mobile Sync & Tracks (Phase 3)
-- Tables pour synchronisation offline et traces GPS
-- ============================================================================

-- ============================================================================
-- 1. TABLE SYNC QUEUE (actions en attente côté serveur)
-- ============================================================================

CREATE TABLE IF NOT EXISTS atlas.colab_sync_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Utilisateur
    user_id UUID NOT NULL REFERENCES atlas.users(id) ON DELETE CASCADE,
    
    -- Action
    action_type TEXT NOT NULL CHECK (action_type IN (
        'create_sondage', 'update_sondage', 'delete_sondage',
        'create_field_log', 'update_field_log',
        'upload_photo', 'update_position'
    )),
    
    -- Identifiant client (pour réconciliation)
    client_id TEXT NOT NULL,
    
    -- Payload de l'action
    payload JSONB NOT NULL,
    
    -- État de traitement
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    
    -- Résultat (ID serveur créé, etc.)
    result JSONB,
    
    -- Métadonnées
    created_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    
    -- Éviter les doublons
    UNIQUE(user_id, client_id)
);

CREATE INDEX IF NOT EXISTS idx_sync_queue_user_status ON atlas.colab_sync_queue(user_id, status);
CREATE INDEX IF NOT EXISTS idx_sync_queue_created ON atlas.colab_sync_queue(created_at);

-- ============================================================================
-- 2. TABLE TRACES GPS
-- ============================================================================

CREATE TABLE IF NOT EXISTS atlas.colab_tracks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Mission associée
    mission_id UUID NOT NULL REFERENCES atlas.colab_missions(id) ON DELETE CASCADE,
    
    -- Utilisateur
    user_id UUID NOT NULL REFERENCES atlas.users(id) ON DELETE CASCADE,
    
    -- Métadonnées de la trace
    name TEXT,
    started_at TIMESTAMPTZ NOT NULL,
    ended_at TIMESTAMPTZ,
    
    -- Géométrie (LineString)
    geom GEOMETRY(LineString, 4326),
    
    -- Statistiques
    total_distance_m REAL,
    total_duration_seconds INTEGER,
    points_count INTEGER DEFAULT 0,
    
    -- État
    is_active BOOLEAN DEFAULT true,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_colab_tracks_mission ON atlas.colab_tracks(mission_id);
CREATE INDEX IF NOT EXISTS idx_colab_tracks_user ON atlas.colab_tracks(user_id);
CREATE INDEX IF NOT EXISTS idx_colab_tracks_geom ON atlas.colab_tracks USING GIST(geom);

-- ============================================================================
-- 3. TABLE POINTS DE TRACE (pour stockage détaillé)
-- ============================================================================

CREATE TABLE IF NOT EXISTS atlas.colab_track_points (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    track_id UUID NOT NULL REFERENCES atlas.colab_tracks(id) ON DELETE CASCADE,
    
    -- Position
    geom GEOMETRY(Point, 4326) NOT NULL,
    altitude_m REAL,
    accuracy_m REAL,
    
    -- Timestamp
    recorded_at TIMESTAMPTZ NOT NULL,
    
    -- Ordre dans la trace
    sequence_num INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_track_points_track ON atlas.colab_track_points(track_id, sequence_num);
CREATE INDEX IF NOT EXISTS idx_track_points_geom ON atlas.colab_track_points USING GIST(geom);

-- ============================================================================
-- 4. TABLE PHOTOS TERRAIN
-- ============================================================================

CREATE TABLE IF NOT EXISTS atlas.colab_photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Liens
    mission_id UUID REFERENCES atlas.colab_missions(id) ON DELETE SET NULL,
    sondage_id UUID,  -- Référence vers sondages
    field_log_id UUID REFERENCES atlas.colab_field_logs(id) ON DELETE SET NULL,
    
    -- Utilisateur
    uploaded_by UUID NOT NULL REFERENCES atlas.users(id),
    
    -- Fichier
    filename TEXT NOT NULL,
    original_filename TEXT,
    mime_type TEXT DEFAULT 'image/jpeg',
    file_size_bytes INTEGER,
    storage_path TEXT,  -- Chemin sur le stockage (S3, local, etc.)
    
    -- Métadonnées photo
    photo_type TEXT CHECK (photo_type IN ('surface', 'fouille', 'detail', 'panorama', 'equipment', 'other')),
    caption TEXT,
    
    -- Géolocalisation de la prise de vue
    geom GEOMETRY(Point, 4326),
    altitude_m REAL,
    
    -- EXIF (optionnel)
    exif_data JSONB,
    taken_at TIMESTAMPTZ,
    
    -- État sync
    sync_status TEXT DEFAULT 'pending' CHECK (sync_status IN ('pending', 'uploading', 'uploaded', 'failed')),
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_colab_photos_mission ON atlas.colab_photos(mission_id);
CREATE INDEX IF NOT EXISTS idx_colab_photos_sondage ON atlas.colab_photos(sondage_id);

-- ============================================================================
-- 5. TABLE SESSIONS TERRAIN (pour tracking des sessions de travail)
-- ============================================================================

CREATE TABLE IF NOT EXISTS atlas.colab_field_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Mission
    mission_id UUID NOT NULL REFERENCES atlas.colab_missions(id) ON DELETE CASCADE,
    
    -- Utilisateur
    user_id UUID NOT NULL REFERENCES atlas.users(id) ON DELETE CASCADE,
    
    -- Période
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    
    -- Localisation de départ/fin
    start_geom GEOMETRY(Point, 4326),
    end_geom GEOMETRY(Point, 4326),
    
    -- Statistiques de session
    sondages_created INTEGER DEFAULT 0,
    photos_taken INTEGER DEFAULT 0,
    distance_walked_m REAL,
    
    -- Device info
    device_info JSONB,
    
    -- État
    is_active BOOLEAN DEFAULT true,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_field_sessions_mission ON atlas.colab_field_sessions(mission_id);
CREATE INDEX IF NOT EXISTS idx_field_sessions_user ON atlas.colab_field_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_field_sessions_active ON atlas.colab_field_sessions(is_active) WHERE is_active = true;

-- ============================================================================
-- 6. TRIGGERS
-- ============================================================================

-- Trigger updated_at pour tracks
DROP TRIGGER IF EXISTS set_updated_at_colab_tracks ON atlas.colab_tracks;
CREATE TRIGGER set_updated_at_colab_tracks
    BEFORE UPDATE ON atlas.colab_tracks
    FOR EACH ROW
    EXECUTE FUNCTION atlas.update_updated_at_column();

-- Fonction pour reconstruire la géométrie de trace à partir des points
CREATE OR REPLACE FUNCTION atlas.rebuild_track_geometry()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE atlas.colab_tracks 
    SET 
        geom = (
            SELECT ST_MakeLine(geom ORDER BY sequence_num)
            FROM atlas.colab_track_points
            WHERE track_id = NEW.track_id
        ),
        points_count = (
            SELECT COUNT(*) FROM atlas.colab_track_points WHERE track_id = NEW.track_id
        ),
        total_distance_m = (
            SELECT ST_Length(ST_MakeLine(geom ORDER BY sequence_num)::geography)
            FROM atlas.colab_track_points
            WHERE track_id = NEW.track_id
        )
    WHERE id = NEW.track_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS rebuild_track_on_point_insert ON atlas.colab_track_points;
CREATE TRIGGER rebuild_track_on_point_insert
    AFTER INSERT ON atlas.colab_track_points
    FOR EACH ROW
    EXECUTE FUNCTION atlas.rebuild_track_geometry();

-- ============================================================================
-- 7. VUES
-- ============================================================================

-- Vue des missions avec contexte carte
CREATE OR REPLACE VIEW atlas.v_colab_missions_map_context AS
SELECT 
    m.id,
    m.code,
    m.title,
    m.theme,
    m.status,
    m.maille_id,
    ma.label AS maille_label,
    ST_AsGeoJSON(ma.geom)::jsonb AS maille_geojson,
    ST_X(ST_Centroid(ma.geom)) AS maille_center_lon,
    ST_Y(ST_Centroid(ma.geom)) AS maille_center_lat,
    ST_XMin(ma.geom) AS bbox_min_x,
    ST_YMin(ma.geom) AS bbox_min_y,
    ST_XMax(ma.geom) AS bbox_max_x,
    ST_YMax(ma.geom) AS bbox_max_y
FROM atlas.colab_missions m
LEFT JOIN atlas.mailles ma ON m.maille_id = ma.id;

-- Vue des sondages terrain par mission
CREATE OR REPLACE VIEW atlas.v_colab_mission_sondages AS
SELECT 
    cms.mission_id,
    s.id AS sondage_id,
    s.nom,
    s.code_sondage,
    ST_X(s.geom) AS longitude,
    ST_Y(s.geom) AS latitude,
    s.profondeur_atteinte,
    s.validation_status,
    s.location_mode,
    s.location_accuracy_m,
    s.created_at,
    cms.ordre
FROM atlas.colab_mission_sondages cms
JOIN atlas.sondages s ON cms.sondage_id = s.id
ORDER BY cms.mission_id, cms.ordre;

-- ============================================================================
-- 8. PERMISSIONS
-- ============================================================================

INSERT INTO atlas.permissions (id, resource, action, description) VALUES
    ('colab.mobile.access', 'colab.mobile', 'access', 'Accès à l''application mobile'),
    ('colab.tracks.read', 'colab.tracks', 'read', 'Voir les traces GPS'),
    ('colab.tracks.write', 'colab.tracks', 'write', 'Enregistrer des traces GPS'),
    ('colab.photos.upload', 'colab.photos', 'upload', 'Uploader des photos terrain'),
    ('colab.photos.delete', 'colab.photos', 'delete', 'Supprimer des photos'),
    ('colab.sync.execute', 'colab.sync', 'execute', 'Synchroniser les données offline')
ON CONFLICT (id) DO NOTHING;

-- Assigner aux rôles
INSERT INTO atlas.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM atlas.roles r, atlas.permissions p
WHERE r.name = 'admin' AND p.id IN (
    'colab.mobile.access', 'colab.tracks.read', 'colab.tracks.write',
    'colab.photos.upload', 'colab.photos.delete', 'colab.sync.execute'
)
ON CONFLICT DO NOTHING;

INSERT INTO atlas.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM atlas.roles r, atlas.permissions p
WHERE r.name = 'supervisor' AND p.id IN (
    'colab.mobile.access', 'colab.tracks.read', 'colab.tracks.write',
    'colab.photos.upload', 'colab.photos.delete', 'colab.sync.execute'
)
ON CONFLICT DO NOTHING;

INSERT INTO atlas.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM atlas.roles r, atlas.permissions p
WHERE r.name = 'student' AND p.id IN (
    'colab.mobile.access', 'colab.tracks.read', 'colab.tracks.write',
    'colab.photos.upload', 'colab.sync.execute'
)
ON CONFLICT DO NOTHING;

COMMIT;
