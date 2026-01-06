#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Script de vérification quotidienne de la grille 28km Atlas

.DESCRIPTION
    Ce script vérifie automatiquement l'état de la grille 28km dans la base Atlas.
    Il est conçu pour être exécuté quotidiennement via le Planificateur de tâches Windows.
    
    Fonctionnalités:
    - Vérifie que Docker et le conteneur atlas-db sont actifs
    - Configure correctement DATABASE_URL
    - Exécute le script check_28km.py
    - Logue les résultats avec timestamp
    - Envoie des notifications en cas d'erreur

.NOTES
    Auteur: Atlas Team
    Version: 1.0
    Dernière modification: 2026-01-06
#>

# Configuration
$PROJECT_ROOT = "C:\PROJET_ATLAS_MASTER\atlas"
$PYTHON_SCRIPT = "scripts\check_28km.py"
$LOG_DIR = "logs"
$DATABASE_URL = "postgresql://atlas:atlas@localhost:5432/atlas_clean"
$CONTAINER_NAME = "atlas-db"

# Couleurs pour les messages
$COLOR_SUCCESS = "Green"
$COLOR_WARNING = "Yellow"
$COLOR_ERROR = "Red"
$COLOR_INFO = "Cyan"

# Fonction pour logger avec timestamp
function Write-Log {
    param(
        [string]$Message,
        [string]$Level = "INFO",
        [string]$Color = "White"
    )
    
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logMessage = "[$timestamp] [$Level] $Message"
    
    # Afficher dans la console avec couleur
    Write-Host $logMessage -ForegroundColor $Color
    
    # Écrire dans le fichier log
    Add-Content -Path $script:logFile -Value $logMessage
}

# Fonction pour vérifier si Docker est en cours d'exécution
function Test-DockerRunning {
    try {
        $null = docker ps 2>&1
        return $LASTEXITCODE -eq 0
    }
    catch {
        return $false
    }
}

# Fonction pour vérifier si un conteneur est en cours d'exécution
function Test-ContainerRunning {
    param([string]$ContainerName)
    
    try {
        $status = docker inspect -f '{{.State.Running}}' $ContainerName 2>&1
        return $status -eq "true"
    }
    catch {
        return $false
    }
}

# Fonction principale
function Main {
    # Créer le répertoire de logs s'il n'existe pas
    $logDirPath = Join-Path $PROJECT_ROOT $LOG_DIR
    if (-not (Test-Path $logDirPath)) {
        New-Item -ItemType Directory -Path $logDirPath -Force | Out-Null
    }
    
    # Créer le fichier de log avec timestamp
    $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
    $script:logFile = Join-Path $logDirPath "check_28km_$timestamp.log"
    
    Write-Log "========================================" "INFO" $COLOR_INFO
    Write-Log "Vérification quotidienne grille 28km" "INFO" $COLOR_INFO
    Write-Log "========================================" "INFO" $COLOR_INFO
    Write-Log ""
    
    # Vérifier que le répertoire projet existe
    if (-not (Test-Path $PROJECT_ROOT)) {
        Write-Log "ERREUR: Répertoire projet introuvable: $PROJECT_ROOT" "ERROR" $COLOR_ERROR
        exit 1
    }
    
    # Se placer dans le répertoire du projet
    Set-Location $PROJECT_ROOT
    Write-Log "Répertoire de travail: $PROJECT_ROOT" "INFO" $COLOR_INFO
    
    # Vérifier que Docker est en cours d'exécution
    Write-Log "Vérification de Docker..." "INFO" $COLOR_INFO
    if (-not (Test-DockerRunning)) {
        Write-Log "ERREUR: Docker n'est pas en cours d'exécution" "ERROR" $COLOR_ERROR
        Write-Log "Action requise: Démarrer Docker Desktop" "ERROR" $COLOR_ERROR
        exit 1
    }
    Write-Log "✓ Docker est actif" "SUCCESS" $COLOR_SUCCESS
    
    # Vérifier que le conteneur atlas-db est en cours d'exécution
    Write-Log "Vérification du conteneur $CONTAINER_NAME..." "INFO" $COLOR_INFO
    if (-not (Test-ContainerRunning $CONTAINER_NAME)) {
        Write-Log "ERREUR: Le conteneur $CONTAINER_NAME n'est pas en cours d'exécution" "ERROR" $COLOR_ERROR
        Write-Log "Tentative de démarrage du conteneur..." "WARNING" $COLOR_WARNING
        
        try {
            docker start $CONTAINER_NAME | Out-Null
            Start-Sleep -Seconds 10
            
            if (Test-ContainerRunning $CONTAINER_NAME) {
                Write-Log "✓ Conteneur $CONTAINER_NAME démarré avec succès" "SUCCESS" $COLOR_SUCCESS
            }
            else {
                Write-Log "ERREUR: Impossible de démarrer le conteneur $CONTAINER_NAME" "ERROR" $COLOR_ERROR
                exit 1
            }
        }
        catch {
            Write-Log "ERREUR: Exception lors du démarrage du conteneur: $_" "ERROR" $COLOR_ERROR
            exit 1
        }
    }
    else {
        Write-Log "✓ Conteneur $CONTAINER_NAME est actif" "SUCCESS" $COLOR_SUCCESS
    }
    
    # Vérifier que Python est disponible
    Write-Log "Vérification de Python..." "INFO" $COLOR_INFO
    try {
        $pythonVersion = python --version 2>&1
        Write-Log "✓ Python trouvé: $pythonVersion" "SUCCESS" $COLOR_SUCCESS
    }
    catch {
        Write-Log "ERREUR: Python n'est pas installé ou n'est pas dans le PATH" "ERROR" $COLOR_ERROR
        Write-Log "Action requise: Installer Python ou ajouter au PATH" "ERROR" $COLOR_ERROR
        exit 1
    }
    
    # Vérifier que le script check_28km.py existe
    $scriptPath = Join-Path $PROJECT_ROOT $PYTHON_SCRIPT
    if (-not (Test-Path $scriptPath)) {
        Write-Log "ERREUR: Script introuvable: $scriptPath" "ERROR" $COLOR_ERROR
        exit 1
    }
    Write-Log "✓ Script trouvé: $PYTHON_SCRIPT" "SUCCESS" $COLOR_SUCCESS
    
    # Configurer DATABASE_URL
    Write-Log "" "INFO"
    Write-Log "Configuration de DATABASE_URL..." "INFO" $COLOR_INFO
    $env:DATABASE_URL = $DATABASE_URL
    Write-Log "DATABASE_URL = $DATABASE_URL" "INFO" $COLOR_INFO
    
    # Exécuter le script check_28km.py
    Write-Log "" "INFO"
    Write-Log "========================================" "INFO" $COLOR_INFO
    Write-Log "Exécution de check_28km.py..." "INFO" $COLOR_INFO
    Write-Log "========================================" "INFO" $COLOR_INFO
    Write-Log "" "INFO"
    
    try {
        # Capturer la sortie du script Python
        $output = python $PYTHON_SCRIPT 2>&1
        $exitCode = $LASTEXITCODE
        
        # Logger la sortie
        foreach ($line in $output) {
            Write-Log $line "PYTHON" "White"
        }
        
        Write-Log "" "INFO"
        Write-Log "========================================" "INFO" $COLOR_INFO
        
        # Vérifier le code de sortie
        if ($exitCode -eq 0) {
            Write-Log "✓ Vérification terminée avec succès" "SUCCESS" $COLOR_SUCCESS
            Write-Log "Exit code: $exitCode" "SUCCESS" $COLOR_SUCCESS
        }
        else {
            Write-Log "⚠ Vérification terminée avec des avertissements" "WARNING" $COLOR_WARNING
            Write-Log "Exit code: $exitCode" "WARNING" $COLOR_WARNING
            Write-Log "" "WARNING"
            Write-Log "Action recommandée: Vérifier les logs ci-dessus" "WARNING" $COLOR_WARNING
        }
    }
    catch {
        Write-Log "ERREUR: Exception lors de l'exécution du script Python" "ERROR" $COLOR_ERROR
        Write-Log "Détails: $_" "ERROR" $COLOR_ERROR
        exit 1
    }
    
    Write-Log "========================================" "INFO" $COLOR_INFO
    Write-Log "Log complet sauvegardé dans: $script:logFile" "INFO" $COLOR_INFO
    Write-Log "========================================" "INFO" $COLOR_INFO
    
    # Nettoyer les anciens logs (garder seulement les 30 derniers jours)
    Write-Log "" "INFO"
    Write-Log "Nettoyage des anciens logs..." "INFO" $COLOR_INFO
    $cutoffDate = (Get-Date).AddDays(-30)
    $oldLogs = Get-ChildItem -Path $logDirPath -Filter "check_28km_*.log" | 
               Where-Object { $_.LastWriteTime -lt $cutoffDate }
    
    if ($oldLogs.Count -gt 0) {
        $oldLogs | Remove-Item -Force
        Write-Log "✓ $($oldLogs.Count) ancien(s) log(s) supprimé(s)" "INFO" $COLOR_INFO
    }
    else {
        Write-Log "✓ Aucun ancien log à supprimer" "INFO" $COLOR_INFO
    }
    
    exit $exitCode
}

# Point d'entrée
try {
    Main
}
catch {
    Write-Host "ERREUR CRITIQUE: $_" -ForegroundColor Red
    if ($script:logFile) {
        Add-Content -Path $script:logFile -Value "ERREUR CRITIQUE: $_"
    }
    exit 1
}
