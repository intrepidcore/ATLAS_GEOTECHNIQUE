# Script d'import simplifié des données ADM (sans dépendances externes)
# Insère des données de test pour le Togo

Write-Host "📥 Import des données administratives du Togo..." -ForegroundColor Cyan

$DB_NAME = "atlas"
$DB_USER = "atlas"
$DB_PASSWORD = "atlas"

# Fonction pour exécuter une commande SQL
function Invoke-Sql {
    param([string]$Query)
    
    $env:PGPASSWORD = $DB_PASSWORD
    docker exec atlas-db psql -U $DB_USER -d $DB_NAME -c $Query
}

# Créer et remplir les tables
Write-Host "`n📋 Création et remplissage des tables ADM..." -ForegroundColor Cyan

$sql = @"
-- Supprimer et recréer les tables
DROP TABLE IF EXISTS adm3_tg CASCADE;
DROP TABLE IF EXISTS adm2_tg CASCADE;
DROP TABLE IF EXISTS adm1_tg CASCADE;

-- Table ADM1 (Régions)
CREATE TABLE adm1_tg (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    geom GEOMETRY(MultiPolygon, 4326),
    bbox NUMERIC[],
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Table ADM2 (Préfectures)
CREATE TABLE adm2_tg (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    adm1_name TEXT NOT NULL,
    geom GEOMETRY(MultiPolygon, 4326),
    bbox NUMERIC[],
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Table ADM3 (Communes)
CREATE TABLE adm3_tg (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    adm1_name TEXT NOT NULL,
    adm2_name TEXT NOT NULL,
    geom GEOMETRY(MultiPolygon, 4326),
    bbox NUMERIC[],
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Insérer les 5 régions du Togo
INSERT INTO adm1_tg (code, name) VALUES
    ('ADM1-MARITIME', 'Maritime'),
    ('ADM1-PLATEAUX', 'Plateaux'),
    ('ADM1-CENTRALE', 'Centrale'),
    ('ADM1-KARA', 'Kara'),
    ('ADM1-SAVANES', 'Savanes');

-- Insérer les préfectures (39 au total)
INSERT INTO adm2_tg (code, name, adm1_name) VALUES
    -- Maritime (8 préfectures)
    ('ADM2-GOLFE', 'Golfe', 'Maritime'),
    ('ADM2-LACS', 'Lacs', 'Maritime'),
    ('ADM2-VO', 'Vo', 'Maritime'),
    ('ADM2-YOTO', 'Yoto', 'Maritime'),
    ('ADM2-ZIO', 'Zio', 'Maritime'),
    ('ADM2-AVEME', 'Avé', 'Maritime'),
    ('ADM2-BAS-MONO', 'Bas-Mono', 'Maritime'),
    ('ADM2-AGOE-NYIVE', 'Agoè-Nyivé', 'Maritime'),
    
    -- Plateaux (12 préfectures)
    ('ADM2-AGOU', 'Agou', 'Plateaux'),
    ('ADM2-AMOU', 'Amou', 'Plateaux'),
    ('ADM2-ANIE', 'Anié', 'Plateaux'),
    ('ADM2-DANYI', 'Danyi', 'Plateaux'),
    ('ADM2-EST-MONO', 'Est-Mono', 'Plateaux'),
    ('ADM2-HAHO', 'Haho', 'Plateaux'),
    ('ADM2-KLOTO', 'Kloto', 'Plateaux'),
    ('ADM2-KPELE', 'Kpélé', 'Plateaux'),
    ('ADM2-MOYEN-MONO', 'Moyen-Mono', 'Plateaux'),
    ('ADM2-OGOU', 'Ogou', 'Plateaux'),
    ('ADM2-WAWA', 'Wawa', 'Plateaux'),
    ('ADM2-AKEBOU', 'Akébou', 'Plateaux'),
    
    -- Centrale (6 préfectures)
    ('ADM2-BLITTA', 'Blitta', 'Centrale'),
    ('ADM2-SOTOUBOUA', 'Sotouboua', 'Centrale'),
    ('ADM2-TCHAMBA', 'Tchamba', 'Centrale'),
    ('ADM2-TCHAOUDJO', 'Tchaoudjo', 'Centrale'),
    ('ADM2-MO', 'Mô', 'Centrale'),
    ('ADM2-ASSOLI', 'Assoli', 'Centrale'),
    
    -- Kara (7 préfectures)
    ('ADM2-ASSOLI-KARA', 'Assoli', 'Kara'),
    ('ADM2-BASSAR', 'Bassar', 'Kara'),
    ('ADM2-BINAH', 'Binah', 'Kara'),
    ('ADM2-DANKPEN', 'Dankpen', 'Kara'),
    ('ADM2-DOUFELGOU', 'Doufelgou', 'Kara'),
    ('ADM2-KERAN', 'Kéran', 'Kara'),
    ('ADM2-KOZAH', 'Kozah', 'Kara'),
    
    -- Savanes (6 préfectures)
    ('ADM2-CINKASSE', 'Cinkassé', 'Savanes'),
    ('ADM2-KPENDJAL', 'Kpendjal', 'Savanes'),
    ('ADM2-OTI', 'Oti', 'Savanes'),
    ('ADM2-OTI-SUD', 'Oti-Sud', 'Savanes'),
    ('ADM2-TANDJOURE', 'Tandjoaré', 'Savanes'),
    ('ADM2-TONE', 'Tône', 'Savanes');

-- Insérer quelques communes principales (échantillon)
INSERT INTO adm3_tg (code, name, adm1_name, adm2_name) VALUES
    -- Golfe
    ('ADM3-LOME', 'Lomé', 'Maritime', 'Golfe'),
    ('ADM3-AGOE', 'Agoè', 'Maritime', 'Golfe'),
    ('ADM3-KPOGAN', 'Kpogan', 'Maritime', 'Golfe'),
    
    -- Lacs
    ('ADM3-ANEHO', 'Aného', 'Maritime', 'Lacs'),
    ('ADM3-GLIDJI', 'Glidji', 'Maritime', 'Lacs'),
    
    -- Plateaux
    ('ADM3-KPALIME', 'Kpalimé', 'Plateaux', 'Kloto'),
    ('ADM3-ATAKPAME', 'Atakpamé', 'Plateaux', 'Ogou'),
    ('ADM3-NOTSE', 'Notsé', 'Plateaux', 'Haho'),
    ('ADM3-BADOU', 'Badou', 'Plateaux', 'Wawa'),
    
    -- Centrale
    ('ADM3-SOKODE', 'Sokodé', 'Centrale', 'Tchaoudjo'),
    ('ADM3-SOTOUBOUA-VILLE', 'Sotouboua', 'Centrale', 'Sotouboua'),
    ('ADM3-TCHAMBA-VILLE', 'Tchamba', 'Centrale', 'Tchamba'),
    
    -- Kara
    ('ADM3-KARA-VILLE', 'Kara', 'Kara', 'Kozah'),
    ('ADM3-BASSAR-VILLE', 'Bassar', 'Kara', 'Bassar'),
    ('ADM3-NIAMTOUGOU', 'Niamtougou', 'Kara', 'Doufelgou'),
    
    -- Savanes
    ('ADM3-DAPAONG', 'Dapaong', 'Savanes', 'Tone'),
    ('ADM3-MANGO', 'Mango', 'Savanes', 'Oti'),
    ('ADM3-CINKASSE-VILLE', 'Cinkassé', 'Savanes', 'Cinkasse');

-- Créer les index
CREATE INDEX idx_adm1_tg_name ON adm1_tg(name);
CREATE INDEX idx_adm2_tg_name ON adm2_tg(name);
CREATE INDEX idx_adm2_tg_adm1 ON adm2_tg(adm1_name);
CREATE INDEX idx_adm3_tg_name ON adm3_tg(name);
CREATE INDEX idx_adm3_tg_adm1 ON adm3_tg(adm1_name);
CREATE INDEX idx_adm3_tg_adm2 ON adm3_tg(adm2_name);
"@

# Écrire le SQL dans un fichier temporaire
$sqlFile = [System.IO.Path]::GetTempFileName()
$sql | Out-File -FilePath $sqlFile -Encoding UTF8

# Copier le fichier dans le conteneur et l'exécuter
docker cp $sqlFile atlas-db:/tmp/import-adm.sql
docker exec atlas-db psql -U $DB_USER -d $DB_NAME -f /tmp/import-adm.sql

# Nettoyer
Remove-Item $sqlFile

Write-Host "✅ Tables créées et remplies" -ForegroundColor Green

# Afficher les statistiques
Write-Host "`n📊 Statistiques:" -ForegroundColor Cyan
docker exec atlas-db psql -U $DB_USER -d $DB_NAME -c "SELECT 'ADM1' as level, COUNT(*) as count FROM adm1_tg UNION ALL SELECT 'ADM2', COUNT(*) FROM adm2_tg UNION ALL SELECT 'ADM3', COUNT(*) FROM adm3_tg;"

Write-Host "`n✅ Import terminé avec succès !" -ForegroundColor Green
Write-Host "`n🔍 Test rapide:" -ForegroundColor Yellow
Write-Host "   curl http://127.0.0.1:8000/adm1" -ForegroundColor Gray
Write-Host "   curl http://127.0.0.1:8000/adm2?adm1=Maritime" -ForegroundColor Gray
Write-Host "   curl http://127.0.0.1:8000/adm3?adm2=Golfe" -ForegroundColor Gray
