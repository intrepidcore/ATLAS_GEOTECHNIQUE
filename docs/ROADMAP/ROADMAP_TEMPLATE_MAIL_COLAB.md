Email reçu et parfait. Je vais d'abord cartographier la base de données complète avant de proposer quoi que ce soit.

J'ai toutes les données nécessaires. Voici ma proposition architecturale complète :

---

## Proposition — Email de mission terrain : analyse architecturale

### Contexte de lecture

J'ai interrogé 155 tables. Ce qui suit est une **proposition de produit**, pas encore du code. Chaque section identifie les données DB disponibles, le contenu email correspondant, et les règles de confidentialité applicables.

---

## 1. Ce que l'email actuel contient

```
Mission + code  ✓
Maille code     ✓
Centroïde WGS84 ✓
Lien Google Maps ✓
BBox N/S/E/O    ✓
```

C'est le minimum viable. Voici l'analyse de ce qui manque.

---

## 2. Cartographie des données disponibles × pertinence terrain

### BLOC A — Identité de la mission _(déjà en DB, pas dans l'email)_

|Donnée|Table|Colonne|Pertinence terrain|
|---|---|---|---|
|Thème de mission|`colab_missions`|`theme`|Oriente le protocole (reconnaissance ≠ étude détaillée)|
|Objectifs|`colab_missions`|`objectifs`|Indispensable — l'opérateur doit savoir _pourquoi_|
|Nombre de sondages attendus|`colab_missions`|`expected_sondages`|Planification matériel|
|Dates début/fin|`colab_missions`|`start_date / end_date`|Deadline visible immédiatement|
|Rôle dans la mission|`colab_mission_assignments`|`role`|primary / assistant / observer|
|Notes d'affectation|`colab_mission_assignments`|`notes`|Instructions spécifiques du coordinateur|

### BLOC B — Encadrement _(données superviseur)_

|Donnée|Table|Colonnes|Pertinence|
|---|---|---|---|
|Nom + titre du superviseur|`colab_supervisors` + `users`|`titre`, `first_name`, `last_name`|Contact principal terrain|
|Email superviseur|`users`|`email`|Lien mailto direct|
|Téléphone|`colab_supervisors`|`telephone`|**Critique** — urgence terrain sans internet|
|Institution|`colab_supervisors`|`institution`|Identification institutionnelle|

### BLOC C — Contexte géographique enrichi _(PostGIS disponible)_

|Donnée|Source|Note|
|---|---|---|
|Région / Préfecture / Canton|`adm1_tg` + `adm2_tg` + `adm3_tg` via `ST_Intersects`|Localisation administrative précise|
|Altitude moyenne|`mailles.altitude_mean`|~13m — anticiper matériel|
|Pente moyenne|`mailles.dem_slope_mean_deg`|~0.3° → terrain quasi-plat|
|Distance au cours d'eau le plus proche|`mailles.distance_river_m`|~10.8km — accès eau sur site|
|Précipitations annuelles / saison sèche / saison humide|`maille_climate_features`|Planification météo|

### BLOC D — Contexte géotechnique prédictif _(données ML disponibles)_

> **Règle de confidentialité** : ces données sont des **prédictions ML** (pas des mesures certifiées). L'email doit les présenter avec disclaimer explicite : _"données prévisionnelles — à confirmer par reconnaissance terrain"_.

|Donnée|Table|Valeur TG-0489-0214-01|Usage terrain|
|---|---|---|---|
|Score RGA (risque géotechnique agrégé)|`maille_geotech_infer.rga_score`|**62/100 — classe FORT**|Alerte sur difficulté attendue|
|Capacité portante estimée|`maille_geotech_infer.bearing_capacity_kpa`|161.7 kPa|Protocole fondations|
|Risque de tassement|`maille_geotech_infer.settlement_risk_pct`|92.7%|Matériel & profondeur sondage|
|Confiance du modèle|`maille_geotech_infer.confidence_score`|85%|Crédibilité de la prédiction|
|Type de fondation recommandé|`maille_geotech_foundation.fondation_type`|radier_renforcé|Contexte étude|
|Traitement sol|`maille_geotech_foundation.traitement_sol`|ciment_ou_chaux|Matériaux à prévoir si étude détaillée|
|Coût estimatif fondations|`maille_geotech_foundation.estimated_cost_fcfa`|36M FCFA|Contexte budgétaire (ne pas inclure — confidentiel)|
|VBS moyen H1|`mailles.vbs_rk_h1`|3.72|Sol argileux gonflant probable|
|IP moyen H1|`mailles.ip_rk_h1`|21.4|Classification LCPC — argileux|

### BLOC E — Contexte géologique/pédologique _(intersections spatiales)_

|Donnée|Table|Valeur TG-0489-0214-01|
|---|---|---|
|Formation géologique|`unites_geologiques`|Mésozoïque-Cénozoïque Sédimentaire du Bas Togo|
|Type de sol pédologique|`unites_pedologiques`|Sols ferralitiques non indurés + Sols hydromorphes|
|Niveau de risque gonflement|`risque_gonflement`|**Risque Moyen**|

### BLOC F — Sondages existants _(données de référence)_

|Donnée|Table|Valeur|
|---|---|---|
|Nb sondages existants dans la maille|`sondages` COUNT|1 sondage|
|Profondeurs min/max existantes|`sondages.depth_m_min/max`|Contexte profondeur à viser|

### BLOC G — Pièce jointe GeoJSON _(à générer à l'envoi)_

> C'est l'**élément différenciant** d'un email institutionnel. Le fichier peut être généré à la volée par l'API depuis PostGIS.

**Contenu du GeoJSON :**

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": "<ST_AsGeoJSON(ma.geom)>",   // polygone exact de la maille
      "properties": {
        "code": "TG-0489-0214-01",
        "mission_code": "M-TEST-EMAIL-20260612",
        "prefecture": "Agoe-Nyive",
        "region": "Maritime",
        "rga_class": "fort",
        "bearing_capacity_kpa": 161.73,
        "fondation_type": "radier_renforce",
        "nb_sondages_existants": 1,
        "source": "Atlas Géotechnique Togo — DGTP/MTPTMU",
        "generated_at": "2026-06-12T07:56:09Z",
        "classification": "USAGE INTERNE — NE PAS DIFFUSER"
      }
    }
  ]
}
```

**Format optionnel :** GPKG (GeoPackage) avec plusieurs couches :

- `maille_assignee` — polygone de la maille
- `sondages_existants` — points de sondages dans la maille
- `contexte_adm` — découpage Adm3 intersectant

---

## 3. Ce qu'il NE faut PAS inclure _(règles confidentialité)_

|Donnée|Raison d'exclusion|
|---|---|
|`estimated_cost_fcfa` (36M FCFA)|Sensible financièrement — pression sur l'opérateur, risque de fuite|
|`notes_internal` de la mission|Réservé coordinateurs uniquement|
|Hash/token d'authentification|Jamais dans un email|
|Données d'autres missions ou opérateurs|Cloisonnement strict par mission|
|Données ML brutes (JSON complet)|Format technique — présenter les conclusions uniquement|
|Coordonnées exactes de sondages d'autres missions|Protection des données opérationnelles|
|Score RGA sans disclaimer|Risque de mauvaise interprétation sans contexte|

---

## 4. Structure email proposée (7 blocs)

```
[ENTÊTE INSTITUTIONNEL]
  Logo + "République Togolaise — DGTP"
  Numéro de mission + date d'émission + ID unique de notification

[BLOC 1 — VOTRE MISSION]
  Titre, thème, rôle assigné, objectifs, dates, nb sondages attendus
  Contact superviseur : nom + téléphone + email

[BLOC 2 — LOCALISATION TERRAIN]
  Préfecture / Canton / Région
  Centroïde + lien Google Maps
  BBox (tableau N/S/E/O)
  Altitude moyenne, pente, distance au cours d'eau

[BLOC 3 — CONTEXTE GÉOTECHNIQUE]
  ⚠️ Disclaimer ML visible
  Niveau de risque global (RGA : FORT / MOYEN / FAIBLE) avec couleur
  Risque de gonflement
  Formation géologique dominante
  Type de sol pédologique
  Paramètres indicatifs (VBS, IP) en texte lisible, pas en tableau de chiffres bruts

[BLOC 4 — PROTOCOLE RECOMMANDÉ]
  Nombre de sondages à réaliser
  Profondeur indicative à atteindre (basée sur bearing_capacity + settlement_risk)
  Précautions particulières (ex : sol gonflant → humidifier + prélèvement non remanié)
  Conditions météo attendues (précipitations saison)

[BLOC 5 — SONDAGES DE RÉFÉRENCE]
  "X sondage(s) déjà réalisé(s) dans cette maille"
  Lien vers la plateforme Atlas pour consulter les données existantes

[BLOC 6 — PIÈCE JOINTE]
  📎 mission_MXXX_TG-0489-0214-01.geojson
  "Ce fichier peut être ouvert dans QGIS, Google Earth, ou l'application Atlas Mobile"
  "Classification : USAGE INTERNE — NE PAS DIFFUSER"

[PIED DE PAGE INSTITUTIONNEL]
  "Cette notification est nominative et confidentielle."
  "Toute reproduction est interdite sans autorisation de la DGTP."
  Numéro de notification unique (traçabilité)
  "En cas d'urgence terrain : [téléphone superviseur]"
```

---

## 5. Pratiques institutionnelles supplémentaires à intégrer

**Traçabilité** : chaque email génère un `notification_id` unique (UUID) affiché en pied de page → permet à l'administration de prouver qu'un opérateur a bien été notifié (auditabilité).

**Accusé de lecture** : le lien Google Maps peut embarquer un pixel de tracking ou un token URL unique → l'ouverture de l'email et le clic Maps sont enregistrés dans `colab_maille_notification_logs`.

**Chiffrement de la pièce jointe** : le GeoJSON peut être zippé avec un mot de passe = les 4 derniers chiffres du matricule de l'étudiant → données utilisables uniquement par le destinataire.

**Expiration** : mention "Ce document est valide jusqu'au [end_date]" → responsabilisation sur les délais.

**Non-répudiation** : stocker le hash SHA-256 du GeoJSON envoyé dans `colab_email_job_logs.details` → preuve que les données envoyées n'ont pas été altérées après.

---

**Validez les blocs que vous souhaitez implémenter**, en particulier :**

1. Le GeoJSON en pièce jointe (génération PostGIS dans l'API Rust)
2. Le niveau de risque RGA avec code couleur
3. Le disclaimer ML
4. Le contact superviseur avec téléphone

Je code uniquement ce que vous confirmez.