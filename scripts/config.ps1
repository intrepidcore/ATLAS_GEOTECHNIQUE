# Configuration centralisée pour les scripts PowerShell Atlas
# À sourcer dans chaque script avec: . "$PSScriptRoot\config.ps1"

# Configuration Docker
$Global:ATLAS_DB_CONTAINER = "atlas-db"
$Global:ATLAS_API_CONTAINER = "atlas-api-geo"

# Configuration Base de données
$Global:ATLAS_DB_NAME = "atlas_clean"
$Global:ATLAS_DB_USER = "atlas"
$Global:ATLAS_DB_PASSWORD = "atlas"
$Global:ATLAS_DB_HOST = "localhost"
$Global:ATLAS_DB_PORT = "5432"

# Chemins de base
$Global:ATLAS_BASE_PATH = "c:\PROJET_ATLAS_MASTER\atlas"
$Global:ATLAS_BACKUP_PATH = Join-Path $ATLAS_BASE_PATH "backups"
$Global:ATLAS_RESOURCE_PATH = Join-Path $ATLAS_BASE_PATH "ressource"
$Global:ATLAS_SCRIPTS_PATH = Join-Path $ATLAS_BASE_PATH "scripts"

# Configuration DSM
$Global:DSM_SOURCE_PATH = Join-Path $ATLAS_RESOURCE_PATH "DSM\rasters_COP30"
$Global:DSM_INPUT_FILE = "output_hh.tif"
$Global:DSM_REPROJECTED_FILE = "dsm_cop30_25231.tif"
$Global:DSM_NODATA_VALUE = -9999
$Global:DSM_TARGET_SRID = 25231
$Global:DSM_TILE_SIZE = 256

# Configuration couches contexte
$Global:CONTEXT_LAYERS_PATH = Join-Path $ATLAS_RESOURCE_PATH "Couches_contexte"

# Fonctions utilitaires
function Test-DockerContainer {
    param([string]$ContainerName)
    
    $running = docker ps --filter "name=$ContainerName" --filter "status=running" --format "{{.Names}}"
    return $running -eq $ContainerName
}

function Get-AtlasConnectionString {
    return "postgresql://${Global:ATLAS_DB_USER}:${Global:ATLAS_DB_PASSWORD}@${Global:ATLAS_DB_HOST}:${Global:ATLAS_DB_PORT}/${Global:ATLAS_DB_NAME}"
}

function Write-AtlasLog {
    param(
        [string]$Message,
        [ValidateSet('Info', 'Success', 'Warning', 'Error')]
        [string]$Level = 'Info'
    )
    
    $colors = @{
        'Info' = 'Gray'
        'Success' = 'Green'
        'Warning' = 'Yellow'
        'Error' = 'Red'
    }
    
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Write-Host "[$timestamp] $Message" -ForegroundColor $colors[$Level]
}

# Export des variables pour qu'elles soient disponibles globalement
Export-ModuleMember -Variable * -Function *
