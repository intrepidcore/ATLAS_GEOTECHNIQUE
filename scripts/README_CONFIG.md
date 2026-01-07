# Configuration centralisée des scripts PowerShell

## 📋 Vue d'ensemble

Le fichier `config.ps1` centralise toutes les variables de configuration pour les scripts PowerShell Atlas.

## 🎯 Utilisation

### Dans un nouveau script

```powershell
# Charger la configuration centralisée
. "$PSScriptRoot\config.ps1"

# Utiliser les variables globales
Write-AtlasLog "Connexion à $Global:ATLAS_DB_NAME" -Level 'Info'
Invoke-AtlasCommand "docker exec $Global:ATLAS_DB_CONTAINER psql -U $Global:ATLAS_DB_USER -d $Global:ATLAS_DB_NAME -c 'SELECT 1'"
```

## 📦 Variables disponibles

### Docker
- `$Global:ATLAS_DB_CONTAINER` = "atlas-db"
- `$Global:ATLAS_API_CONTAINER` = "atlas-api-geo"

### Base de données
- `$Global:ATLAS_DB_NAME` = "atlas_clean"
- `$Global:ATLAS_DB_USER` = "atlas"
- `$Global:ATLAS_DB_PASSWORD` = "atlas"
- `$Global:ATLAS_DB_HOST` = "localhost"
- `$Global:ATLAS_DB_PORT` = "5432"

### Chemins
- `$Global:ATLAS_BASE_PATH` = "c:\PROJET_ATLAS_MASTER\atlas"
- `$Global:ATLAS_BACKUP_PATH` = chemin vers backups/
- `$Global:ATLAS_RESOURCE_PATH` = chemin vers ressource/
- `$Global:ATLAS_SCRIPTS_PATH` = chemin vers scripts/

### DSM
- `$Global:DSM_SOURCE_PATH` = chemin vers rasters COP30
- `$Global:DSM_INPUT_FILE` = "output_hh.tif"
- `$Global:DSM_REPROJECTED_FILE` = "dsm_cop30_25231.tif"
- `$Global:DSM_NODATA_VALUE` = -9999
- `$Global:DSM_TARGET_SRID` = 25231
- `$Global:DSM_TILE_SIZE` = 256

### Couches contexte
- `$Global:CONTEXT_LAYERS_PATH` = chemin vers Couches_contexte/

## 🛠️ Fonctions utilitaires

### Test-DockerContainer
Vérifie si un conteneur Docker est en cours d'exécution.

```powershell
if (Test-DockerContainer $Global:ATLAS_DB_CONTAINER) {
    Write-Host "Conteneur DB actif"
}
```

### Get-AtlasConnectionString
Retourne la chaîne de connexion PostgreSQL.

```powershell
$connStr = Get-AtlasConnectionString
# postgresql://atlas:atlas@localhost:5432/atlas_clean
```

### Write-AtlasLog
Affiche un message avec timestamp et couleur.

```powershell
Write-AtlasLog "Opération réussie" -Level 'Success'
Write-AtlasLog "Attention" -Level 'Warning'
Write-AtlasLog "Erreur critique" -Level 'Error'
Write-AtlasLog "Information" -Level 'Info'
```

### Invoke-AtlasCommand
Exécute une commande avec gestion d'erreur robuste (vérifie `$LASTEXITCODE`).

```powershell
# Lève une exception si la commande échoue
Invoke-AtlasCommand "gdalwarp input.tif output.tif" -Description "Reprojection DSM"

# Équivalent à:
gdalwarp input.tif output.tif
if ($LASTEXITCODE -ne 0) {
    throw "Erreur: Reprojection DSM (exitcode=$LASTEXITCODE)"
}
```

## ✅ Scripts déjà migrés

- ✅ `config.ps1` - Configuration centralisée
- ✅ `import_dsm_cop30.ps1` - Import DSM avec gestion erreurs
- ✅ `reproject_dsm_with_nodata.ps1` - Reprojection DSM
- ✅ `backup_db.ps1` - Backup base de données

## 📝 Migration des scripts existants

Pour migrer un script existant:

1. Ajouter en haut du fichier:
   ```powershell
   . "$PSScriptRoot\config.ps1"
   ```

2. Remplacer les valeurs en dur:
   ```powershell
   # Avant
   $container = "atlas-db"
   $dbname = "atlas_clean"
   
   # Après
   $container = $Global:ATLAS_DB_CONTAINER
   $dbname = $Global:ATLAS_DB_NAME
   ```

3. Utiliser `Write-AtlasLog` au lieu de `Write-Host`:
   ```powershell
   # Avant
   Write-Host "Succès" -ForegroundColor Green
   
   # Après
   Write-AtlasLog "Succès" -Level 'Success'
   ```

4. Utiliser `Invoke-AtlasCommand` pour les commandes critiques:
   ```powershell
   # Avant
   docker exec atlas-db psql -c "SELECT 1"
   if ($LASTEXITCODE -ne 0) { exit 1 }
   
   # Après
   Invoke-AtlasCommand "docker exec $Global:ATLAS_DB_CONTAINER psql -c 'SELECT 1'" -Description "Test connexion DB"
   ```

## 🎯 Bonnes pratiques

1. **Toujours sourcer config.ps1** au début de chaque script
2. **Ne jamais** mettre de valeurs en dur (SRID, noms de conteneurs, chemins)
3. **Utiliser Invoke-AtlasCommand** pour toutes les opérations critiques (gdalwarp, raster2pgsql, docker exec, etc.)
4. **Préférer Write-AtlasLog** à Write-Host pour un logging cohérent
5. **Documenter** les nouveaux paramètres ajoutés à config.ps1

## 🔧 Extension

Pour ajouter de nouvelles variables:

```powershell
# Dans config.ps1
$Global:MA_NOUVELLE_VAR = "valeur"

# Export
Export-ModuleMember -Variable * -Function *
```
