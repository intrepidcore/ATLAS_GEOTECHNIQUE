# 💾 Stratégie de Dump/Restauration - Éviter la perte des mailles 28km

## 🎯 Objectif

Garantir que les mailles 28km ne soient **jamais perdues** lors des opérations de dump/restauration.

## ❌ Problème actuel

Les dumps partiels ou anciens ne contiennent pas `atlas.maille_28km`, donc chaque restauration = perte des mailles 28km.

## ✅ Solution : Dumps complets avec ordre correct

### 1. Script de dump complet (à utiliser systématiquement)

```powershell
# Dump COMPLET incluant structure + données + migrations
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
docker exec -t atlas-db-1 pg_dump -U atlas -d atlas --clean --if-exists > "dumps/full_atlas_${timestamp}.sql"
```

**Important:** Le flag `--clean --if-exists` garantit que les tables existantes seront supprimées proprement avant restauration.

### 2. Vérifier qu'un dump contient les mailles 28km

```powershell
# Rechercher "maille_28km" dans le dump
Select-String -Path "dumps/full_atlas_20260106.sql" -Pattern "maille_28km" | Select-Object -First 10
```

Si aucun résultat → le dump ne contient PAS les mailles 28km.

### 3. Restauration sécurisée

```powershell
# Restaurer le dump
docker exec -i atlas-db-1 psql -U atlas -d atlas < dumps/full_atlas_20260106.sql

# IMMÉDIATEMENT après, vérifier
python atlas/scripts/check_28km.py
```

Si `check_28km.py` montre 0 mailles → **rejouer la migration 080**:

```powershell
python atlas/scripts/run_migration_080.py
```

### 4. Ordre des migrations

Les migrations doivent être rejouées dans l'ordre si la base est recréée from scratch:

```
001_*.sql
...
079_*.sql
080_create_maille_28km.sql  ← CRITIQUE
081_*.sql (si existe)
```

**Automatisation:** Créer un script `replay_all_migrations.py` qui:
1. Liste tous les fichiers `db/migrations/*.sql`
2. Les trie par numéro
3. Les exécute dans l'ordre
4. Log chaque migration

## 📋 Checklist avant chaque dump

- [ ] Vérifier que `atlas.maille_28km` contient des données: `SELECT COUNT(*) FROM atlas.maille_28km;`
- [ ] Utiliser `pg_dump` avec `--clean --if-exists`
- [ ] Nommer le dump avec timestamp: `full_atlas_YYYYMMDD_HHMMSS.sql`
- [ ] Vérifier le contenu: `grep -c "maille_28km" dump.sql`
- [ ] Tester la restauration sur une DB de test avant de l'utiliser en prod

## 📋 Checklist après chaque restauration

- [ ] Exécuter `python atlas/scripts/check_28km.py`
- [ ] Vérifier le nombre de mailles 28km (devrait être ~100)
- [ ] Vérifier les profils (devrait être ~20)
- [ ] Vérifier les liaisons avec mailles 2km
- [ ] Tester l'endpoint API: `curl http://localhost:8000/coverage/mailles?grid=28km`

## 🔧 Script de dump automatisé (recommandé)

Créer `atlas/scripts/dump_complet.ps1`:

```powershell
#!/usr/bin/env pwsh
# Script de dump complet avec vérifications

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$dumpFile = "dumps/full_atlas_${timestamp}.sql"

Write-Host "🔍 Vérification pré-dump..."
docker exec atlas-db-1 psql -U atlas -d atlas -c "SELECT COUNT(*) FROM atlas.maille_28km;"

Write-Host "`n💾 Création du dump..."
docker exec -t atlas-db-1 pg_dump -U atlas -d atlas --clean --if-exists > $dumpFile

Write-Host "`n✅ Dump créé: $dumpFile"
$size = (Get-Item $dumpFile).Length / 1MB
Write-Host "   Taille: $([math]::Round($size, 2)) MB"

Write-Host "`n🔍 Vérification du contenu..."
$maille28kmCount = (Select-String -Path $dumpFile -Pattern "maille_28km").Count
Write-Host "   Occurrences 'maille_28km': $maille28kmCount"

if ($maille28kmCount -eq 0) {
    Write-Host "   ❌ WARNING: Le dump ne contient PAS maille_28km!"
} else {
    Write-Host "   ✅ Le dump contient maille_28km"
}
```

## 🚨 Procédure d'urgence si mailles 28km perdues

Si après une restauration les mailles 28km ont disparu:

```powershell
# 1. Vérifier l'état
python atlas/scripts/check_28km.py

# 2. Rejouer la migration 080
python atlas/scripts/run_migration_080.py

# 3. Re-vérifier
python atlas/scripts/check_28km.py

# 4. Faire un nouveau dump IMMÉDIATEMENT
./atlas/scripts/dump_complet.ps1
```

## 📝 Convention de nommage des dumps

```
dumps/
├── full_atlas_20260106_153000.sql      ← Dump complet avec mailles 28km
├── full_atlas_20260105_133418.sql      ← Ancien dump (peut-être sans 28km)
└── partial_colab_20260106.sql          ← Dump partiel (seulement tables colab)
```

**Règle:** Toujours préfixer avec `full_` ou `partial_` pour éviter la confusion.

## 🎓 Bonnes pratiques

1. **Un dump par jour** minimum en développement
2. **Tester la restauration** sur une DB de test avant de l'utiliser
3. **Garder les 5 derniers dumps** (rotation automatique)
4. **Documenter chaque dump** (commit git, changelog, etc.)
5. **Ne jamais restaurer un dump sans vérifier son contenu**

## 🔗 Scripts associés

- `scripts/diagnostic_db_complet.py` - Diagnostic multi-DB
- `scripts/check_28km.py` - Vérification rapide
- `scripts/run_migration_080.py` - Création/recréation mailles 28km
- `scripts/dump_complet.ps1` - Dump automatisé avec vérifications
