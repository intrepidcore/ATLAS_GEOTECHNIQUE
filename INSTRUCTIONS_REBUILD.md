# 🔧 Instructions pour Rebuild API

## Problème Identifié

L'API ne peut pas extraire les valeurs `NUMERIC` de PostgreSQL comme `f64` en Rust.

## Solution Appliquée

**Fichier modifié** : `services/api-geo/src/thematic/routes.rs`

Changement ligne 49 :
```rust
// AVANT
{} as value,

// APRÈS  
CAST({} AS DOUBLE PRECISION) as value,
```

Cela convertit les valeurs `NUMERIC` en `DOUBLE PRECISION` que Rust peut lire.

---

## Étapes de Rebuild

### 1. Redémarrer Docker Desktop

Si Docker a des erreurs I/O :
1. Clic droit sur l'icône Docker Desktop
2. "Quit Docker Desktop"
3. Relancer Docker Desktop
4. Attendre que Docker soit prêt (icône verte)

### 2. Rebuild l'API

```powershell
cd C:\PROJET_ATLAS_MASTER\atlas
docker compose build api-geo
```

**Temps estimé** : 3-5 minutes

### 3. Redémarrer les services

```powershell
docker compose up -d
```

### 4. Tester

```powershell
.\diagnostic_complet.ps1
```

**Résultat attendu** :
```
[ETAPE 1] Test sans geometrie ni filtres
  Features retournees: 187  ✅
```

---

## Si le build échoue

### Erreur "input/output error"

```powershell
# Nettoyer Docker
docker system prune -a -f

# Ou redémarrer complètement Docker Desktop
```

### Erreur de compilation Rust

Vérifier que le fichier `routes.rs` est bien modifié :
```powershell
Select-String -Path services\api-geo\src\thematic\routes.rs -Pattern "CAST.*DOUBLE PRECISION"
```

---

## Test Final

Une fois l'API rebuildée et redémarrée :

1. Ouvrir le navigateur en mode privé : `Ctrl + Shift + N`
2. Aller sur `http://127.0.0.1:8080`
3. Ouvrir la carte thématique (icône bas droite)
4. Sélectionner "Passant 80µm (moyen)"
5. Cliquer "Appliquer"

**Résultat attendu** : Carte colorée avec des mailles ✅

---

**Statut actuel** : ⏳ En attente de rebuild
