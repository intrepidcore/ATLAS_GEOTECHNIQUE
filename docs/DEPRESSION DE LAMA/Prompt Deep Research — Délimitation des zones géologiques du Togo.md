## CONTEXTE DU PROJET

Je développe l'Atlas Géotechnique National du Togo, un système SIG d'interpolation 
géostatistique couvrant 56 600 km² sur une grille de 29 407 mailles de 2 km × 2 km 
(EPSG:25231, UTM 31N). Le système modélise 11 paramètres géotechniques (VBS, IP, WL, WP, 
CBR95, γd, etc.) par krigeage à dérive externe (KED) en utilisant la carte nationale du 
risque RGA (Retrait-Gonflement des Argiles) comme covariable principale.

Cinq zones géologiques prioritaires structurent l'analyse : elles définissent les régions 
à forte concentration de sols argileux gonflants (montmorillonite/smectite) et guident la 
priorisation des sondages terrain. Leurs géométries actuelles dans le système sont des 
approximations grossières (polygones de 6-13 points calés sur des coordonnées arrondies) 
annotées "Emprise seed — à affiner par SIG officiel".

---

## MISSION

Recherche intensive et critique des **délimitations scientifiques précises** des cinq zones 
suivantes, en vue d'importer des géométries vérifiées (format GeoJSON/WKT, EPSG:4326) dans 
le système.

---

## ZONES À DOCUMENTER

### 1. DÉPRESSION DE LA LAMA (Bas-Togo / Plateaux)
**Code projet** : DEPRESSION_LAMA_TG  
**Emprise actuelle (approximative)** :  
- Longitude : 1.12 – 1.55°E  
- Latitude : 6.18 – 6.90°N  
- Centroïde estimé : Tabligbo, préfecture de Yoto  

**Ce que nous savons** :
- Sols : vertisols à montmorillonite dominante + kaolinite + illite
- Risque RGA classé TRÈS FORT (carte nationale ORSTOM/IRD)
- Prolongement occidental de la zone sédimentaire béninoise
- Sources connues : LAMOUROUX (1961), FAO SF:13/T0, EZI K.E. Elom (2022)
- Superficie estimée ~450 km² (notre calcul, incertain)

**Ce que nous cherchons** :
- Délimitation géologique officielle (limites lithostratigraphiques)
- Délimitation pédologique (extension réelle des vertisols/terres noires)
- Coordonnées précises des contours (shapefiles ou références cartographiques)
- Distinction entre Lama togolaise et Lama béninoise (frontière ?)
- Publications récentes post-2000 sur la géochimie minéralogique

---

### 2. DÉPRESSION DU BADO (Plateaux / Maritime)
**Code projet** : DEPRESSION_BADO_TG  
**Emprise actuelle (approximative)** :  
- Longitude : 1.10 – 1.45°E  
- Latitude : 6.28 – 6.58°N  

**Ce que nous savons** :
- Sols : vertisols hydromorphes (terres noires)
- Risque RGA FORT
- Minéraux : montmorillonite + kaolinite
- Sources dans notre DB : aucune référence bibliographique renseignée (lacune)

**Ce que nous cherchons** :
- Existe-t-il une "dépression de Bado" reconnue dans la littérature géologique togolaise ?
- Relation géologique avec la dépression de la Lama (même bassin sédimentaire ?)
- Délimitation et superficie
- Toute référence bibliographique (rapports ORSTOM, IGT, BRGM, thèses, articles)
- Distinction avec les plateaux environnants (Atakpamé, Badou)

---

### 3. FOSSE AUX LIONS (Région des Savanes, extrême nord)
**Code projet** : FOSSE_LIONS_TG  
**Emprise actuelle (très approximative)** :  
- Longitude : 0.10 – 0.22°E  
- Latitude : 10.72 – 10.82°N  
- Localisation : pied des monts de Bombouaka  

**Ce que nous savons** :
- Type : cuvette topographique (zone_risque_specifique)
- Sols : argiles de cuvette, vertisols (approx.)
- Minéraux : montmorillonite
- Risque RGA : TRÈS FORT
- Notre géométrie actuelle couvre ~15-30 mailles seulement — très incertaine
- Sources dans notre DB : aucune référence bibliographique renseignée

**Ce que nous cherchons** :
- Localisation précise et délimitation de la "Fosse aux Lions"
- Contexte géologique (formation, lithologie, âge)
- Est-ce une dépression tectonique, karstique, ou d'origine pédologique ?
- Superficie réelle et profondeur de la dépression
- Références bibliographiques (géologie régionale nord-Togo, monts Kabiyè/Bombouaka)
- Lien avec les formations géologiques du Buem ou des unités précambriennes ?

---

### 4. PLAINE DU MONO (Région des Plateaux / Maritime)
**Code projet** : PLAINE_MONO_TG  
**Emprise actuelle (approximative)** :  
- Longitude : 1.20 – 1.58°E  
- Latitude : 6.78 – 7.15°N  

**Ce que nous savons** :
- Type : plaine alluviale de débordement du fleuve Mono
- Sols : alluvions hydromorphes, vertisols
- Minéraux : montmorillonite + smectite
- Risque RGA : FORT

**Ce que nous cherchons** :
- Délimitation hydrologique officielle de la plaine d'inondation du Mono
- Extension des alluvions récentes vs alluvions anciennes (Pléistocène vs Holocène)
- Cartes bathymétriques ou topographiques précises (MNT SRTM/Copernicus analysé ?)
- Distinction entre plaine du Mono togolais et portion béninoise
- Épaisseur des dépôts alluviaux et profondeur du substratum
- Impact du barrage de Nangbéto (1987) sur la sédimentation en aval

---

### 5. PLAINE DE L'OTI (Région des Savanes, nord)
**Code projet** : PLAINE_OTI_TG  
**Emprise actuelle** : Rectangle d'essai (0.60–1.20°E / 10.10–10.80°N) — très grossier

**Ce que nous savons** :
- Type : plaine alluviale, fleuve Oti (tributaire de la Volta)
- Sols : alluvions / sols hydromorphes
- Minéraux : kaolinite principalement
- Risque RGA : MOYEN (plus faible que les zones sud)
- Notre rectangle couvre ~600-800 mailles — emprise très surestimée probable

**Ce que nous cherchons** :
- Délimitation hydrologique précise de la plaine alluviale de l'Oti au Togo
- Distinction entre plaine de l'Oti togolaise / ghanéenne / béninoise
- Cartographie des sols alluviaux (ORSTOM, FAO)
- Caractérisation minéralogique des argiles (kaolinite vs smectite selon secteur)
- Lien avec la réserve de faune de l'Oti-Mandouri
- Dynamique saisonnière : superficie inondée en saison des pluies vs saison sèche

---

## FORMAT DE RÉPONSE ATTENDU

Pour chaque zone, structure ta réponse ainsi :

### [NOM DE LA ZONE]
**1. Délimitation scientifique confirmée**
- Coordonnées bounding box précises (si trouvées)
- Description textuelle des limites (références géologiques/topographiques)
- Superficie estimée (km²) — sources citées

**2. Contexte géologique et pédologique**
- Formation géologique (âge, lithologie)
- Type de sol dominant (classification FAO/WRB)
- Minéraux argileux identifiés (méthodes : DRX, ATD ?)
- Épaisseur de couche argileuse

**3. Bibliographie primaire**
- Références classiques (ORSTOM, IGT, FAO, BRGM)
- Publications récentes (2000-2025)
- Thèses et mémoires identifiés
- Données open source disponibles (OpenStreetMap, GADM, données gouvernementales Togo)

**4. Sources SIG disponibles**
- Shapefiles/GeoPackage officiels mentionnés
- Cartes scannées géoréférençables
- Modèles numériques de terrain pertinents (SRTM 30m, Copernicus 10m)
- Indices spectraux Sentinel-2 utiles (NDVI, NDWI, indices argileux)

**5. Lacunes et incertitudes**
- Ce qui n'est pas établi scientifiquement
- Désaccords entre sources
- Zones frontalières ambiguës (Bénin, Ghana, Burkina Faso)

**6. Recommandations pour le projet**
- Comment raffiner la géométrie actuelle
- Données accessibles sans terrain (open data)
- Investigations terrain prioritaires

---

## SOURCES PRIORITAIRES À CONSULTER

- IRD/ORSTOM — Archives pédologiques Togo (Lamouroux, Leveque, Guichard)
- IGT — Institut Géographique du Togo (Lomé)
- FAO — Soil Map of the World, rapports SF:13/T0 et SF:49/T0
- BRGM — Carte géologique 1/200 000 Togo (si accessible)
- Thèses : Université de Lomé (FAST), EAMAU, universités françaises (Paris VI, Bordeaux)
- OpenAfrica, RCMRD, AfSIS pour données SIG open source Afrique
- Copernicus Land Monitoring Service (CORINE équivalent Afrique)
- Global Surface Water (JRC) pour délimitation plaines inondables Mono/Oti
- ISRIC World Soil Database pour classification WRB
- Google Scholar : "vertisols Togo", "dépression Lama Togo", "Oti alluvial plain Togo"

---

## CONTRAINTES TECHNIQUES DU PROJET

- Projection cible : EPSG:25231 (UTM Zone 31N)
- Grille de référence : 29 407 mailles 2 km × 2 km couvrant le Togo entier
- Intersection minimale pour associer une maille à une zone : 10%
- Critère de priorité terrain : mailles avec pct_intersection ≥ 50%
- Les géométries doivent être importables en WKT MULTIPOLYGON (EPSG:4326 → transformation en 25231 faite par le système)

Toute donnée permettant de raffiner les polygones approximatifs actuels, même partiellement, 
est utile. Priorité absolue : Lama (déjà utilisée comme covariable IA), puis Fosse aux Lions 
(géométrie la plus incertaine).