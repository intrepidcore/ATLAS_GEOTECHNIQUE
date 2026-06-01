# 📐 ARCHITECTURE RELATIONNELLE UNIVERSELLE V10 (ATLAS)

L'objectif de cette architecture est de "déplier" la 3ème dimension (Profondeur Z) tout en conservant une structure tabulaire stricte (CSV/SQL). 
Si une profondeur `Z = 1.6m` existe dans un projet, le schéma doit être capable de l'accueillir pour tous les autres projets (avec `NULL` si non testée).

Pour éviter un CSV unique avec 10 000 colonnes (ce qui serait illisible), la V10 repose sur un **Modèle Relationnel à 4 Tables** (Fichiers CSV distincts liés par des clés primaires).

---

## 🏗️ 1. Table : `V10_PROJETS_METADATA.csv`
*(Un projet = 1 ligne)*

**Clé Primaire :** `id_projet`

| Champ | Type | Description |
| :--- | :--- | :--- |
| `id_projet` | STRING | Ex: LOGOTE_2021, PISTES_PLATEAUX_2026 |
| `nom_projet` | STRING | |
| `type_projet` | STRING | Ouvrage ponctuel, Piste, Forage Géoph. |
| `description_localisation` | STRING | |
| `capacite_ouvrage_m3` | FLOAT | |
| `diametre_moyen_tour_m` | FLOAT | |
| `recom_type_fondation` | STRING | Radier, Semelles isolées |
| `recom_ancrage_m` | FLOAT | Profondeur d'assise recommandée |
| `recom_contrainte_els_mpa` | FLOAT | |
| `recom_contrainte_elu_mpa` | FLOAT | |
| `recom_tassement_total_cm` | FLOAT | |
| `recom_module_kv` | FLOAT | |

---

## 📍 2. Table : `V10_SONDAGES_LOCALISATION.csv`
*(Un point géographique = 1 ligne)*

**Clé Primaire :** `id_sondage` | **Clé Étrangère :** `id_projet`

| Champ | Type | Description |
| :--- | :--- | :--- |
| `id_sondage` | STRING | Ex: LOGOTE_PD1, PC06_S1, NOTSE_S8 |
| `id_projet` | STRING | Lien vers le projet parent |
| `type_sondage` | STRING | SC (Carotté), PD (Pénétro), SP (Pressio), Emprunt |
| `pk_brut` | STRING | Ex: "0+300 Gauche" |
| `latitude_y_dec` | FLOAT | |
| `longitude_x_dec` | FLOAT | |
| `altitude_m` | FLOAT | |
| `nappe_phreatique_m` | FLOAT | NULL si non rencontrée |
| `refus_penetrometre_m` | FLOAT | Profondeur d'arrêt de l'essai |
| `observation_surface` | STRING | Purge nécessaire, zone boueuse... |

---

## 🧪 3. Table : `V10_LABORATOIRE_HORIZONS.csv`
*(Une couche de sol testée = 1 ligne)*

Cette table gère la stratigraphie. Si un échantillon est prélevé entre 1.0m et 1.5m, c'est une ligne. La clé est l'intervalle [Z_min, Z_max].

**Clés :** `id_sondage`, `z_min_m`, `z_max_m`

| Champ | Type | Description |
| :--- | :--- | :--- |
| `id_sondage` | STRING | Lien vers le sondage parent |
| `z_min_m` | FLOAT | Profondeur de début de couche (ex: 1.0) |
| `z_max_m` | FLOAT | Profondeur de fin de couche (ex: 1.5) |
| `nature_sol_brute` | STRING | "Sable argileux rouge" |
| `passant_2mm_pct` | FLOAT | |
| `passant_80um_pct` | FLOAT | |
| `limite_liquidite_ll` | FLOAT | |
| `indice_plasticite_ip` | FLOAT | |
| `indice_groupe_ig` | FLOAT | |
| `classe_sol_hbr` | STRING | Ex: A-2-6 |
| `densite_seche_nat_g_cm3` | FLOAT | |
| `teneur_eau_nat_pct` | FLOAT | |
| `densite_seche_opm` | FLOAT | |
| `cbr_95_pct` | FLOAT | Indice CBR de la couche |
| `volume_emprunt_m3` | FLOAT | Uniquement pour les gîtes |

---

## 📉 4. Table : `V10_INSITU_PROFIL_Z.csv`
*(Un pas de mesure Z = 1 ligne)*

**C'est ici qu'intervient votre logique mathématique absolue.**
Chaque pas de mesure (ex: tous les 0.20m) est une ligne.
Si pour `LOGOTE_PD1` on a une mesure à `Z=1.6m`, il y a une ligne.
Si pour `AKPARE_P1` on a rien à `Z=1.6m`, on génère la ligne avec des `NULL`.

**Clés :** `id_sondage`, `profondeur_z_m`

| Champ | Type | Description |
| :--- | :--- | :--- |
| `id_sondage` | STRING | Lien vers le sondage parent |
| `profondeur_z_m` | FLOAT | **L'axe Z absolu** (Ex: 0.20, 0.40, 1.60, 30.00) |
| `penetrometre_rd_mpa` | FLOAT | Résistance de pointe brute |
| `penetrometre_elu_mpa` | FLOAT | |
| `penetrometre_els_mpa` | FLOAT | |
| `pressiometre_pf_mpa` | FLOAT | Pression de fluage |
| `pressiometre_pl_mpa` | FLOAT | Pression limite |
| `pressiometre_em_mpa` | FLOAT | Module pressiométrique |
| `pressiometre_e_pl_ratio` | FLOAT | Rapport rhéologique |
| `geophysique_resistivite_ohm` | FLOAT | Pour les traînés électriques à Z |