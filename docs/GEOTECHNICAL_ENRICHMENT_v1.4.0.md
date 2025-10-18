# Atlas Géotechnique - Enrichissement v1.4.0

**Date:** 2025-10-18  
**Version:** 1.4.0  
**Statut:** ✅ Implémenté et testé

---

## 📋 Vue d'ensemble

Cette version transforme Atlas Géotechnique d'un simple visualiseur en une **plateforme complète de saisie et gestion de données géotechniques**, alignée sur les standards professionnels documentés dans les rapports d'études de sol.

### Objectifs atteints

✅ Modèle de données enrichi avec types de sol, classifications et essais complets  
✅ API REST complète pour saisie manuelle et en batch  
✅ Interface utilisateur guidée avec formulaire multi-étapes  
✅ Support de la granulométrie complète (courbes avec plusieurs tamis)  
✅ Calcul automatique de l'indice de plasticité (IP = WL - WP)  
✅ Validation stricte des données selon ENUMs PostgreSQL  

---

## 🗄️ Architecture Base de Données

### Migration 007: `007_geotechnical_enrichment.sql`

#### 1. Nouveaux types ENUM

```sql
-- Types de sol (classification pédologique)
CREATE TYPE type_sol_enum AS ENUM (
    'Vertisols et Paravertisols',
    'Ferrugineux Tropicaux et Pseudogley',
    'Hydromorphes',
    'Faiblement Ferralitique',
    'Ferralitique Typique ou Modaux',
    'Ferrugineux Tropicaux Lessivés',
    'Autre'
);

-- Analyses qualitatives
CREATE TYPE analyse_qualitative_enum AS ENUM (
    'Faible', 'Moyen', 'Moyenne', 'Fort', 'Forte', 'Très forte',
    'Elevé', 'Très élevé', 'Non gonflant', 'Gonflant',
    'Peu gonflant', 'Moyennement gonflant', 'Très gonflant'
);

-- Méthodes de classification
CREATE TYPE methode_classification_enum AS ENUM (
    'CHASSAGNEUX D. et al. ;1996',
    'Dakshanamurthy et Raman (1973)',
    'SEED H. (1962)',
    'VIJAYVERGIYA et GHAZZALY 1973',
    'Williams et Donaldson (1980)',
    'Chen (1988)',
    'Autre'
);
```

#### 2. Modifications table `sondages`

```sql
ALTER TABLE sondages
  ADD COLUMN type_sol type_sol_enum;
```

#### 3. Modifications table `essais`

```sql
-- Renommage pour clarté
ALTER TABLE essais RENAME COLUMN value TO valeur_numerique;
ALTER TABLE essais RENAME COLUMN type TO type_essai;

-- Support valeurs qualitatives
ALTER TABLE essais ADD COLUMN valeur_qualitative analyse_qualitative_enum;

-- Métadonnées JSON (ex: {"sieve_mm": 0.08} pour granulométrie)
ALTER TABLE essais ADD COLUMN meta JSONB DEFAULT '{}'::jsonb;
```

**Migration automatique:** `Tamisat_0.08mm` → `Granulometrie` avec `meta.sieve_mm = 0.08`

#### 4. Nouvelle table `classifications`

```sql
CREATE TABLE classifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sondage_id UUID NOT NULL REFERENCES sondages(id) ON DELETE CASCADE,
  profondeur_m NUMERIC NOT NULL,
  methode methode_classification_enum NOT NULL,
  resultat analyse_qualitative_enum NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT unique_classification UNIQUE(sondage_id, profondeur_m, methode)
);
```

#### 5. Nouvelle table `granulometrie_points`

Pour supporter les courbes granulométriques complètes (plusieurs tamis par essai) :

```sql
CREATE TABLE granulometrie_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  essai_id UUID NOT NULL REFERENCES essais(id) ON DELETE CASCADE,
  sieve_mm NUMERIC NOT NULL CHECK (sieve_mm > 0),
  percent_passing NUMERIC NOT NULL CHECK (percent_passing >= 0 AND percent_passing <= 100),
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_granulo_point UNIQUE(essai_id, sieve_mm)
);
```

#### 6. Trigger automatique : Calcul IP

```sql
CREATE TRIGGER essais_calculate_ip
  AFTER INSERT OR UPDATE ON essais
  FOR EACH ROW
  EXECUTE FUNCTION calculate_atterberg_ip();
```

Calcule automatiquement **IP = WL - WP** lors de la saisie des limites d'Atterberg.

#### 7. Table de référence

```sql
CREATE TABLE ref_types_essais (
  code TEXT PRIMARY KEY,
  nom_fr TEXT NOT NULL,
  categorie TEXT NOT NULL,
  unite_defaut TEXT,
  ordre_affichage INT
);
```

Pré-remplie avec 9 types d'essais standards.

---

## 🔌 API Backend (Rust)

### Nouveau module : `geotechnical.rs`

#### Endpoint 1: POST `/surveys/geotech`

**Création complète d'un sondage avec essais et classifications**

**Requête JSON:**

```json
{
  "survey": {
    "code": "SND-ADJ-2024-001",
    "date": "2024-10-20",
    "source": "Rapport AMESSEFE K. Y. F.",
    "type_sol": "Vertisols et Paravertisols",
    "operator": "Utilisateur X",
    "notes": "Données issues du PDF page 1."
  },
  "location": { "lon": 1.084, "lat": 8.592 },
  
  "essais_par_profondeur": [
    {
      "profondeur_m": 1.0,
      "mesures": [
        { 
          "type": "Granulometrie", 
          "valeur_numerique": 77.73, 
          "unit": "%",
          "meta": { "sieve_mm": 0.08 }
        },
        { "type": "BleuMethylene_VBS", "valeur_numerique": 3.00 },
        { "type": "Analyse_Bleu", "valeur_qualitative": "Moyen" },
        { "type": "Atterberg_WL", "valeur_numerique": 50.34 },
        { "type": "Atterberg_WP", "valeur_numerique": 22.64 }
      ]
    },
    {
      "profondeur_m": 1.5,
      "mesures": [
        { "type": "Granulometrie", "valeur_numerique": 81.80, "unit": "%" }
      ]
    }
  ],

  "classifications_par_profondeur": [
    {
      "profondeur_m": 1.0,
      "analyses": [
        { "methode": "CHASSAGNEUX D. et al. ;1996", "resultat": "Moyen" },
        { "methode": "SEED H. (1962)", "resultat": "Elevé" },
        { "methode": "VIJAYVERGIYA et GHAZZALY 1973", "resultat": "Non gonflant" }
      ]
    }
  ],
  
  "snap_to_grid": true
}
```

**Réponse:**

```json
{
  "sondage_id": "a1b2c3d4-...",
  "code": "SND-ADJ-2024-001",
  "maille_code": "M-08N-01E",
  "location_accuracy": "exact",
  "n_essais": 6,
  "n_classifications": 3
}
```

**Validations:**
- Type de sol obligatoire et doit être dans l'ENUM
- Au moins 1 profondeur avec essais
- Chaque mesure doit avoir `valeur_numerique` OU `valeur_qualitative`
- Méthodes de classification validées contre l'ENUM
- Transaction atomique (rollback si erreur)

#### Endpoint 2: GET `/surveys/:id/geotech`

**Récupération complète d'un sondage**

**Réponse:**

```json
{
  "id": "a1b2c3d4-...",
  "code": "SND-ADJ-2024-001",
  "type_sol": "Vertisols et Paravertisols",
  "location": {
    "lon": 1.084,
    "lat": 8.592,
    "maille_code": "M-08N-01E",
    "adm1_name": "Région Maritime",
    "adm2_name": "Golfe",
    "adm3_name": "Agoè-Nyivé"
  },
  "location_accuracy": "exact",
  "date": "2024-10-20",
  "source": "Rapport AMESSEFE K. Y. F.",
  "essais": [
    {
      "id": "...",
      "profondeur_m": 1.0,
      "type_essai": "Granulometrie",
      "valeur_numerique": 77.73,
      "unit": "%",
      "meta": { "sieve_mm": 0.08 }
    },
    {
      "id": "...",
      "profondeur_m": 1.0,
      "type_essai": "Atterberg_IP",
      "valeur_numerique": 27.7,
      "unit": "%"
    }
  ],
  "classifications": [
    {
      "id": "...",
      "profondeur_m": 1.0,
      "methode": "CHASSAGNEUX D. et al. ;1996",
      "resultat": "Moyen"
    }
  ]
}
```

#### Endpoint 3: GET `/classifications/:sondage_id`

Liste toutes les classifications pour un sondage donné.

---

## 🎨 Frontend (TypeScript)

### Nouveau module : `geotechnical-form.ts`

**Classe:** `GeotechnicalFormManager`

**Fonctionnalités:**

1. **Formulaire multi-sections:**
   - Section 1: Informations générales (code, date, type de sol, source, opérateur)
   - Section 2: Localisation (lon/lat ou commune)
   - Section 3: Gestion des profondeurs (ajout/suppression dynamique)
   - Section 4: Essais par profondeur (onglets dynamiques)
   - Section 5: Classifications par profondeur (onglets dynamiques)

2. **Interface à onglets:**
   - Un onglet par profondeur
   - Formulaire adapté selon le type d'essai (numérique vs qualitatif)
   - Calcul automatique des unités

3. **Menus déroulants pré-remplis:**
   - Types de sol (7 valeurs)
   - Analyses qualitatives (13 valeurs)
   - Méthodes de classification (7 valeurs)

4. **Validation côté client:**
   - Type de sol obligatoire
   - Au moins 1 profondeur
   - Coordonnées valides (si fournies)

**Utilisation:**

```typescript
import { GeotechnicalFormManager } from './geotechnical-form'

const formManager = new GeotechnicalFormManager(
  'http://localhost:8000',
  (response) => {
    console.log('Sondage créé:', response)
    alert(`Sondage ${response.code} créé avec succès !`)
  },
  (error) => {
    console.error('Erreur:', error)
    alert(`Erreur: ${error}`)
  }
)

formManager.initForm('form-container')
```

### Styles : `geotechnical-form.css`

- Design moderne et responsive
- Onglets interactifs avec animations
- Boutons d'ajout/suppression intuitifs
- Indicateurs visuels pour champs requis
- Support mobile (breakpoint 768px)

---

## 📊 Types d'essais supportés

| Code | Nom | Catégorie | Unité | Type |
|------|-----|-----------|-------|------|
| `Granulometrie` | Granulométrie (% passant) | Granulometrie | % | Numérique |
| `BleuMethylene_VBS` | Valeur au bleu de méthylène | Atterberg | g/100g | Numérique |
| `Atterberg_WL` | Limite de liquidité | Atterberg | % | Numérique |
| `Atterberg_WP` | Limite de plasticité | Atterberg | % | Numérique |
| `Atterberg_IP` | Indice de plasticité | Atterberg | % | Auto-calculé |
| `PotentielGonflement_eg` | Potentiel de gonflement | Gonflement | % | Numérique |
| `Analyse_Bleu` | Analyse qualitative VBS | Atterberg | - | Qualitatif |
| `Analyse_Atterberg` | Analyse qualitative Atterberg | Atterberg | - | Qualitatif |
| `Analyse_Gonflement` | Analyse qualitative gonflement | Gonflement | - | Qualitatif |

---

## 🔄 Workflow complet

### Saisie manuelle (UI)

1. Utilisateur ouvre le formulaire géotechnique
2. Remplit les informations générales (type de sol obligatoire)
3. Ajoute des profondeurs (ex: 1.0m, 1.5m, 2.0m)
4. Pour chaque profondeur, saisit les essais dans les onglets
5. Ajoute des classifications (optionnel)
6. Clique sur "Enregistrer"
7. Le système valide et envoie à `POST /surveys/geotech`
8. Transaction atomique : sondage + essais + classifications
9. Confirmation avec ID et code du sondage

### Saisie en batch (API)

1. Préparer un fichier JSON avec tableau de sondages
2. Envoyer à `POST /surveys/bulk` (existant) ou créer un script
3. Pour chaque sondage, appeler `POST /surveys/geotech`
4. Gérer les erreurs et logs

### Consultation

1. Lister les sondages : `GET /surveys`
2. Détails complets : `GET /surveys/:id/geotech`
3. Afficher essais et classifications dans l'UI
4. Visualiser sur la carte

---

## 🧪 Tests

### Test 1: Création sondage complet

```bash
curl -X POST http://localhost:8000/surveys/geotech \
  -H "Content-Type: application/json" \
  -d '{
    "survey": {
      "code": "TEST-001",
      "type_sol": "Vertisols et Paravertisols",
      "date": "2025-10-18"
    },
    "location": {"lon": 1.0, "lat": 8.5},
    "essais_par_profondeur": [
      {
        "profondeur_m": 1.0,
        "mesures": [
          {"type": "Granulometrie", "valeur_numerique": 75.0, "unit": "%"},
          {"type": "Atterberg_WL", "valeur_numerique": 45.0},
          {"type": "Atterberg_WP", "valeur_numerique": 20.0}
        ]
      }
    ],
    "classifications_par_profondeur": [
      {
        "profondeur_m": 1.0,
        "analyses": [
          {"methode": "SEED H. (1962)", "resultat": "Moyen"}
        ]
      }
    ]
  }'
```

**Résultat attendu:**
- Sondage créé avec code TEST-001
- 3 essais insérés (dont IP auto-calculé = 25.0)
- 1 classification insérée
- Retour JSON avec IDs

### Test 2: Validation type de sol

```bash
curl -X POST http://localhost:8000/surveys/geotech \
  -H "Content-Type: application/json" \
  -d '{"survey": {"type_sol": "InvalidType"}, "essais_par_profondeur": []}'
```

**Résultat attendu:**
- HTTP 422 Unprocessable Entity
- Message: "Type de sol invalide: InvalidType"

### Test 3: Récupération complète

```bash
curl http://localhost:8000/surveys/{id}/geotech
```

**Résultat attendu:**
- JSON complet avec sondage, essais et classifications
- IP calculé présent dans les essais

---

## 📈 Évolutions futures

### Phase 2: Granulométrie avancée

- Interface pour saisir plusieurs points de tamis
- Génération automatique de courbes granulométriques
- Calcul de D10, D50, Cu, Cc

### Phase 3: Import PDF

- OCR pour extraction automatique des tableaux
- Mapping intelligent vers les types d'essais
- Validation et correction manuelle

### Phase 4: Rapports

- Génération de rapports PDF conformes aux normes
- Export Excel avec tableaux formatés
- Graphiques de synthèse (courbes granulo, diagramme de Casagrande)

### Phase 5: Analyse spatiale

- Interpolation des propriétés géotechniques (IDW, Kriging)
- Cartes de risque de gonflement
- Recommandations de fondations par zone

---

## 🛠️ Maintenance

### Ajout d'un nouveau type d'essai

1. **Base de données:**
   ```sql
   INSERT INTO ref_types_essais (code, nom_fr, categorie, unite_defaut)
   VALUES ('NouveauTest', 'Nom du test', 'Categorie', 'unité');
   ```

2. **Frontend:**
   Ajouter dans `TYPES_ESSAIS` dans `geotechnical-form.ts`

3. **Backend:**
   Ajouter dans `get_default_unit()` si nécessaire

### Ajout d'un type de sol

1. **Migration SQL:**
   ```sql
   ALTER TYPE type_sol_enum ADD VALUE 'Nouveau Type';
   ```

2. **Frontend:**
   Ajouter dans `TYPES_SOL` dans `geotechnical-form.ts`

3. **Backend:**
   Ajouter dans `validate_type_sol()` dans `geotechnical.rs`

---

## 📝 Changelog

### v1.4.0 (2025-10-18)

**Ajouté:**
- ✅ Migration 007 avec ENUMs et nouvelle table classifications
- ✅ Module backend `geotechnical.rs` avec 3 endpoints
- ✅ Module frontend `geotechnical-form.ts` avec formulaire complet
- ✅ Styles CSS dédiés `geotechnical-form.css`
- ✅ Trigger auto-calcul IP (Atterberg)
- ✅ Support granulométrie avec meta JSON
- ✅ Table de référence `ref_types_essais`
- ✅ Views enrichies `v_sondages_enriched` et `v_essais_granulo`

**Modifié:**
- ✅ Table `essais`: colonnes renommées et ajout `valeur_qualitative`, `meta`
- ✅ Table `sondages`: ajout `type_sol`
- ✅ `main.rs`: routes géotechniques ajoutées

**Déprécié:**
- ⚠️ Type d'essai `Tamisat_0.08mm` → utiliser `Granulometrie`

---

## 👥 Contributeurs

- **Architecture DB:** Migration 007 complète
- **Backend Rust:** Module geotechnical avec validation stricte
- **Frontend TS:** Formulaire interactif multi-étapes
- **Documentation:** Ce document

---

## 📞 Support

Pour toute question ou problème :
1. Consulter les logs : `docker compose logs api-geo`
2. Vérifier la migration : `SELECT * FROM ref_types_essais;`
3. Tester l'API : `curl http://localhost:8000/healthz`

---

**Statut final:** ✅ **Implémentation complète et fonctionnelle**

- Migration SQL appliquée avec succès
- Backend Rust compilé (release mode)
- Services Docker redémarrés
- Prêt pour tests utilisateur
