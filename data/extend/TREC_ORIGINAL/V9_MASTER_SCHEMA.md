# 📝 SCHEMA MASTER V9 TOLÉRANT (GESTION DES AMBIGUÏTÉS)

Ce schéma est conçu pour parser directement les PDF géotechniques en séparant techniquement la donnée textuelle brute (pour traçabilité et révision experte) de la donnée numérique parsée (pour ingestion SQL/Atlas).

## 📊 STRUCTURE DES COLONNES (EXTRACT)

| Catégorie | Colonne | Type | Description / Tolérance |
| :--- | :--- | :--- | :--- |
| **IDENTIFICATION** | `id_document` | STRING | ID unique du rapport (ex: BAFILO_2018). |
| | `nom_projet` | STRING | Nom du projet (ex: Route Sokodé). |
| | `type_projet` | STRING | Piste, Bâtiment, Emprunt, Ouvrage d'art. |
| | `id_point_sondage` | STRING | ID du point (SC1, PD1, Puits 2). |
| **LOCALISATION** | `pk_brut` | STRING | Capture textuelle (ex: "7+900 – 8+100", "Axe"). |
| | `pk_debut` | FLOAT | PK de début converti en kilomètres (ex: 7.900). |
| | `pk_fin` | FLOAT | PK de fin converti en kilomètres (ex: 8.100). |
| | `coord_brute` | STRING | Capture GPS brute (ex: "06°14’39’’ N"). |
| | `lat_y_dec` | FLOAT | Latitude décimale normalisée. |
| | `lon_x_dec` | FLOAT | Longitude décimale normalisée. |
| **SONDAGE** | `prof_brute_m` | STRING | Capture brute de la profondeur (ex: "5.40 - 5.80", "~ 3m"). |
| | `prof_min_m` | FLOAT | Borne inférieure de l'horizon. |
| | `prof_max_m` | FLOAT | Borne supérieure de l'horizon. |
| | `nature_sol_brute` | STRING | Lithologie exacte (ex: "Refus sur cuirasse"). |
| | `nappe_remarque` | STRING | "Non rencontrée", "Venue d'eau", etc. |
| | `nappe_phreatique_m` | FLOAT | Niveau statique numérique si existant. |
| **MÉCANIQUE** | `rd_brut` | STRING | (ex: "4.91 - 81.06", "Refus", "> 50"). |
| | `rd_mpa_min` | FLOAT | Résistance de pointe (borne basse). |
| | `rd_mpa_max` | FLOAT | Résistance de pointe (borne haute). |
| | `contrainte_els_brute`| STRING | (ex: "0.07 - 0.20", "variable"). |
| | `contrainte_els_mpa` | FLOAT | Valeur sécuritaire ou min pour ELS. |
| **LABORATOIRE** | `cbr_brut` | STRING | (ex: "14 - 23", "< 5"). |
| | `cbr_95_pct_min` | FLOAT | Indice CBR min. |
| | `cbr_95_pct_max` | FLOAT | Indice CBR max. |
| | `observation_qualit` | STRING | Tout commentaire (Purge, roche altérée). |

---
**Règle d'or de la V9 :** On remplit systématiquement la colonne `*_brut`. Les colonnes numériques `_min`, `_max`, ou valeurs absolues ne sont remplies que si une extraction déterministe est mathématiquement possible.
