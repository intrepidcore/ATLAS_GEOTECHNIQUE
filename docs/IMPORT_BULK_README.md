# 📁 Import Bulk - Guide Rapide

**Voir le cahier des charges complet:** [CAHIER_CHARGES_IMPORT_BULK.md](./CAHIER_CHARGES_IMPORT_BULK.md)

---

## 🎯 Résumé Exécutif

Le système d'import bulk permet d'importer des sondages géotechniques **sans coordonnées GPS** à partir de fichiers CSV/Excel/JSON.

**Fonctionnalités clés:**
- ✅ Import sans coordonnées GPS
- ✅ Détection automatique du format
- ✅ 4 modes de géolocalisation (centroïde, unknown, random, maille)
- ✅ Support analyses qualitatives
- ✅ Géocodage ultérieur possible

---

## 📊 Format Standard Recommandé

### Format "Long" (Une ligne par mesure)

```csv
code,localite,type_essai,profondeur_m,valeur,unite,analyse_qualitative,date,source,operator,adm3
,Adjengré,Granulometrie,1.0,77.73,%,,2024-01-15,Lab LNBTP,LNBTP,Sotouboua
,Adjengré,Granulometrie,1.5,81.8,%,,2024-01-15,Lab LNBTP,LNBTP,Sotouboua
,Akéi,BleuMethylene_VBS,1.0,1.75,g/100g,Faible,2024-02-10,Lab LNBTP,LNBTP,Bassar
,Adjengré,Atterberg_WL,1.0,50.34,%,Elevé,2024-03-01,Lab LNBTP,LNBTP,Sotouboua
,Adjengré,Atterberg_WP,1.0,22.64,%,,2024-03-01,Lab LNBTP,LNBTP,Sotouboua
```

### Champs Obligatoires

| Champ | Obligatoire | Description |
|-------|-------------|-------------|
| `localite` | ✅ | Nom de la localité |
| `type_essai` | ✅ | Type d'essai (Granulometrie, BleuMethylene_VBS, etc.) |
| `profondeur_m` | ✅ | Profondeur en mètres |
| `valeur` OU `analyse_qualitative` | ⚠️ | Au moins un des deux |

---

## 🗺️ Modes de Géolocalisation

### 1. Centroïde ADM (Recommandé)
- Point au centre de la zone administrative
- Nécessite: Colonne `adm3` ou sélection manuelle
- Géocodage ultérieur: ✅ Possible

### 2. Position Inconnue (Unknown)
- Aucune coordonnée
- Rattaché uniquement à une zone ADM
- Géocodage ultérieur: ⚠️ Obligatoire

### 3. Point Aléatoire
- Position aléatoire déterministe dans la zone
- Rayon de jitter: ±150m, ±400m, ±1000m
- Géocodage ultérieur: ✅ Possible

### 4. Rattachement Maille
- Point au centroïde d'une maille
- Sélection sur carte ou code maille
- Géocodage ultérieur: ✅ Possible

---

## 🚀 Workflow Rapide

1. **Préparez votre fichier CSV** (format "Long")
2. **Cliquez sur "📁 Import Bulk"**
3. **Uploadez le fichier**
4. **Vérifiez le mapping automatique**
5. **Choisissez le mode de géolocalisation**
6. **Validez l'import**
7. **Géocodez ultérieurement si nécessaire** (via "🗺️ Géocoder")

---

## 📋 Types d'Essais Supportés

| Type | Code | Unité |
|------|------|-------|
| Granulométrie | `Granulometrie` | % |
| Bleu de Méthylène | `BleuMethylene_VBS` | g/100g |
| Limite de liquidité | `Atterberg_WL` | % |
| Limite de plasticité | `Atterberg_WP` | % |
| Indice de plasticité | `Atterberg_IP` | % |
| Proctor γd max | `Proctor_gdmax` | t/m³ |
| Proctor wopt | `Proctor_wopt` | % |
| Potentiel de gonflement | `PotentielGonflement_eg` | % |

---

## ⚠️ Limitations

- **Taille max:** 10 MB
- **Lignes max:** 50 000
- **Sondages max:** 10 000 par import
- **Formats:** CSV, XLSX, JSON

---

## 📚 Documentation Complète

Voir [CAHIER_CHARGES_IMPORT_BULK.md](./CAHIER_CHARGES_IMPORT_BULK.md) pour:
- Spécifications techniques détaillées
- Workflows complets
- Exemples de fichiers
- Tests et validation
- Roadmap d'implémentation
