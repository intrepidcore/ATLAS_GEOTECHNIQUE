# 📋 Template Excel - Exemple de Données

Ce fichier décrit la structure attendue pour l'import Excel. Créez un fichier `.xlsx` avec ces feuilles.

---

## 📊 Feuille: `sondages`

```csv
code,localite,date,lat,lon,source
S001,Dakar,2024-01-15,14.6937,-17.4441,LBTP
S002,Thiès,2024-02-20,14.7886,-16.9322,LBTP
S003,Saint-Louis,2024-03-10,16.0179,-16.4897,Bureau Etudes
S004,Kaolack,2024-03-25,14.1522,-16.0755,LBTP
S005,Ziguinchor,2024-04-05,12.5833,-16.2667,Consultant
```

**Notes:**
- `code`: Identifiant unique (obligatoire)
- `lat`, `lon`: Coordonnées WGS84 en décimales (obligatoires)
- `date`: Format YYYY-MM-DD (optionnel)
- `localite`, `source`: Texte libre (optionnel)

---

## 🧪 Feuille: `echantillons`

```csv
code,depth_m,date,laboratory,rho_s_gcm3,water_content_w,is_index
S001,0.5,2024-01-15,LBTP,2.65,8.2,0.05
S001,1.5,2024-01-15,LBTP,2.68,12.5,0.15
S001,3.0,2024-01-15,LBTP,2.70,15.8,0.22
S002,1.0,2024-02-20,LBTP,2.63,10.5,0.12
S002,2.5,2024-02-20,LBTP,2.67,14.2,0.18
S003,0.8,2024-03-10,Bureau Etudes,2.66,9.8,0.08
S003,2.0,2024-03-10,Bureau Etudes,2.69,13.5,0.16
```

**Notes:**
- `code`: Référence au sondage (obligatoire)
- `depth_m`: Profondeur en mètres, ≥ 0 (obligatoire)
- `rho_s_gcm3`: Densité des solides, 2.0-3.5 g/cm³ (optionnel)
- `water_content_w`: Teneur en eau, 0-100% (optionnel)
- `is_index`: Indice de gonflement, 0-1 (optionnel)

---

## 📈 Feuille: `atterberg`

```csv
code,depth_m,wl,wp
S001,0.5,32.5,18.2
S001,1.5,45.2,22.1
S001,3.0,52.8,25.3
S002,1.0,38.7,20.5
S002,2.5,48.3,23.8
S003,0.8,35.2,19.1
S003,2.0,42.6,21.7
S004,1.5,50.1,24.5
S005,2.0,55.3,27.2
```

**Notes:**
- `code`, `depth_m`: Référence à l'échantillon (obligatoires)
- `wl`: Limite de liquidité, 0-200% (optionnel)
- `wp`: Limite de plasticité, 0-200% (optionnel)
- `ip`: Calculé automatiquement (IP = WL - WP)

**Interprétation:**
- IP < 10: Sol peu plastique
- 10 ≤ IP < 20: Plasticité moyenne
- IP ≥ 20: Sol plastique

---

## 🔵 Feuille: `vbs`

```csv
code,depth_m,vbs,commentaire
S001,0.5,1.2,Sol sableux peu argileux
S001,1.5,2.5,Argile limoneuse
S001,3.0,4.2,Argile gonflante
S002,1.0,1.8,Sol limoneux
S002,2.5,3.5,Argile moyenne
S003,0.8,1.5,Sable argileux
S003,2.0,2.8,Argile limoneuse
S004,1.5,5.1,Argile très gonflante
S005,2.0,3.2,Argile moyenne
```

**Notes:**
- `code`, `depth_m`: Référence à l'échantillon (obligatoires)
- `vbs`: Valeur de Bleu, 0-20 g/100g (obligatoire)
- `commentaire`: Observations (optionnel)

**Interprétation (classification GTR):**
- VBS < 0.1: Sol insensible à l'eau
- 0.1 ≤ VBS < 0.2: Sol peu sensible
- 0.2 ≤ VBS < 1.5: Sol sensible
- 1.5 ≤ VBS < 2.5: Sol moyennement argileux
- 2.5 ≤ VBS < 6: Sol argileux
- VBS ≥ 6: Sol très argileux

---

## 🔨 Feuille: `proctor`

```csv
code,depth_m,gamma_d_max,w_opt,proctor_type
S001,0.5,18.2,10.5,normal
S001,1.5,18.5,12.5,normal
S001,3.0,19.2,11.8,modifie
S002,1.0,17.8,11.2,normal
S002,2.5,18.9,13.5,normal
S003,0.8,18.1,10.8,normal
S003,2.0,18.7,12.2,normal
S004,1.5,19.5,11.5,modifie
S005,2.0,18.3,13.8,normal
```

**Notes:**
- `code`, `depth_m`: Référence à l'échantillon (obligatoires)
- `gamma_d_max`: Densité sèche maximale, 10-30 kN/m³ (obligatoire)
- `w_opt`: Teneur en eau optimale, 0-50% (obligatoire)
- `proctor_type`: `normal` ou `modifie` (défaut: `normal`)

**Interprétation:**
- Proctor Normal: Énergie 0.6 MJ/m³
- Proctor Modifié: Énergie 2.7 MJ/m³ (sols plus denses)

---

## 📝 Conseils de Préparation

### 1. Nettoyage des Données

**Avant import:**
- ✅ Supprimer les lignes vides
- ✅ Supprimer les colonnes inutiles
- ✅ Vérifier l'orthographe des noms de colonnes
- ✅ Uniformiser les formats de dates (YYYY-MM-DD)
- ✅ Vérifier les coordonnées (décimales, pas DMS)

### 2. Validation Manuelle

**Vérifications rapides:**
```python
import pandas as pd

# Charger
df = pd.read_excel('mes_donnees.xlsx', sheet_name='sondages')

# Vérifier
print(df.columns.tolist())  # Noms colonnes
print(df.isnull().sum())    # Valeurs manquantes
print(df['lat'].min(), df['lat'].max())  # Plage lat
print(df['lon'].min(), df['lon'].max())  # Plage lon
print(df['code'].duplicated().sum())     # Doublons
```

### 3. Coordonnées Géographiques

**Conversion DMS → Décimales:**

Si vos coordonnées sont en degrés-minutes-secondes:
```
14°41'37"N, 17°26'39"W
```

Convertir en décimales:
```python
def dms_to_decimal(degrees, minutes, seconds, direction):
    decimal = degrees + minutes/60 + seconds/3600
    if direction in ['S', 'W']:
        decimal = -decimal
    return decimal

lat = dms_to_decimal(14, 41, 37, 'N')  # 14.6936
lon = dms_to_decimal(17, 26, 39, 'W')  # -17.4442
```

### 4. Gestion des Valeurs Manquantes

**Stratégies:**
- Laisser vide (NULL) pour valeurs optionnelles
- Ne pas mettre 0 si la valeur est inconnue
- Utiliser `commentaire` pour noter les incertitudes

### 5. Codes de Sondages

**Bonnes pratiques:**
- Format cohérent: `S001`, `S002`, etc.
- Éviter espaces et caractères spéciaux
- Préfixe par projet si nécessaire: `PROJ_S001`

---

## 🧪 Test avec Données Minimales

Pour tester le workflow, créez un fichier avec **5 sondages** minimum:

```
sondages: 5 lignes
echantillons: 10-15 lignes (2-3 par sondage)
atterberg: 8-10 lignes
vbs: 5-8 lignes
proctor: 5-8 lignes
```

Puis:
```bash
python scripts/02_import_excel.py --file test.xlsx --dsn "..." --dry-run
```

---

## 📦 Export depuis Autres Formats

### Depuis CSV
```python
import pandas as pd

# Charger CSV
df = pd.read_csv('sondages.csv', sep=';', encoding='utf-8')

# Sauver en Excel
with pd.ExcelWriter('import.xlsx') as writer:
    df.to_excel(writer, sheet_name='sondages', index=False)
```

### Depuis Base de Données
```python
import pandas as pd
import psycopg

conn = psycopg.connect("postgresql://...")
df = pd.read_sql("SELECT * FROM old_sondages", conn)

with pd.ExcelWriter('import.xlsx') as writer:
    df.to_excel(writer, sheet_name='sondages', index=False)
```

---

## ✅ Checklist Pré-Import

- [ ] Fichier `.xlsx` créé avec toutes les feuilles
- [ ] Noms de colonnes corrects (voir mappings)
- [ ] Pas de lignes vides
- [ ] Coordonnées en WGS84 décimales
- [ ] Dates au format YYYY-MM-DD
- [ ] Codes sondages uniques
- [ ] Références échantillons → sondages valides
- [ ] Valeurs dans les plages attendues
- [ ] Test en mode `--dry-run` réussi

---

**Prêt pour l'import !** 🚀

Voir: `scripts/README.md` et `GUIDE_IMPORT_GEOTECH.md`
