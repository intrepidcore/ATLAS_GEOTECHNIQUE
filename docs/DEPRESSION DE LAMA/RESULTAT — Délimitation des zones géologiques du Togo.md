# Rapport d'Expertise Scientifique : Délimitation et Caractérisation Géotechnique des Domaines Argileux et Alluviaux du Togo


[[Prompt Deep Research — Délimitation des zones géologiques du Togo]]
L'élaboration de l'Atlas Géotechnique National du Togo repose sur une architecture d'interpolation spatiale rigoureuse, structurée autour d'une grille de 29 407 mailles de 4 km² (2 km × 2 km) projetée dans le système de coordonnées EPSG:25231 (UTM Zone 31N). La modélisation des paramètres géotechniques fondamentaux, tels que la Valeur au Bleu de Sol (VBS), l'Indice de Plasticité (IP) ou les limites d'Atterberg (WL, WP), requiert l'application d'un krigeage à dérive externe (KED). L'efficacité de cette méthode géostatistique dépend intrinsèquement de la qualité des covariables introduites dans le modèle, au premier rang desquelles figure la cartographie du risque de Retrait-Gonflement des Argiles (RGA).

La présence de géométries d'amorçage (« emprises seed ») constituées de polygones rudimentaires pour définir les zones à fort potentiel gonflant introduit un biais majeur dans l'ajustement des variogrammes. Le présent rapport d'expertise livre une analyse exhaustive et critique visant à substituer ces approximations par des délimitations scientifiques de haute précision géospatiale. L'investigation se concentre sur cinq domaines géologiques et morpho-pédologiques prioritaires. Elle mobilise une synthèse approfondie de la littérature géologique (système voltaïen, bassin sédimentaire côtier), des archives pédologiques historiques (ORSTOM, IRD, FAO) et des données de télédétection contemporaines afin de fournir des géométries robustes, justifiées et directement importables (GeoJSON/WKT, EPSG:4326) dans le système de l'Atlas.

## 1. Dépression de la Lama (Régions Maritime et Plateaux)

La Dépression de la Lama constitue la charnière géomorphologique et lithostratigraphique la plus critique du bassin sédimentaire côtier togolais en matière de risques géotechniques. Orientée selon un axe sud-ouest / nord-est, elle scinde le plateau continental en deux sous-unités et abrite les formations argileuses les plus réactives du territoire.

### 1.1. Délimitation scientifique confirmée

La morphologie de la Dépression de la Lama se caractérise par une goulotte topographique s'étendant sur une longueur d'environ 35 kilomètres en territoire togolais, encastrée entre les plateaux d'Aného et de Tabligbo sur une largeur moyenne de 6 à 7 kilomètres. La littérature historique évalue la superficie de cette portion strictement togolaise (comprise entre le bassin du Zio/Haho à l'ouest et le fleuve Mono à l'est) à environ 23 000 hectares, soit 230 km². Cependant, l'intégration des bordures colluviales de transition porte l'emprise du bassin versant géologique global d'influence argileuse à près de 450 km². La dépression se prolonge de manière ininterrompue au-delà de la frontière orientale, formant la Dépression de la Lama béninoise qui s'étire d'Allada jusqu'au nord de Pobè.

Topographiquement, le raccordement avec les plateaux environnants est asymétrique. Au nord, la transition vers le glacis crétacé s'effectue selon une pente faible, variant de 3 à 5 %. Au sud, la dépression est dominée par le plateau des Terres de Barre, une pénéplaine ondulée culminant entre 80 et 100 mètres d'altitude, qui présente un escarpement plus doux de l'ordre de 0,5 % en direction de la plaine littorale. Les levés botaniques et pédologiques historiques situent le centroïde de référence de cette formation à environ 5 kilomètres au sud-est de la localité de Tabligbo.

|**Paramètre Spatial**|**Valeurs et Coordonnées (WGS84 - EPSG:4326)**|
|---|---|
|**Limite Nord (Latitude)**|~ 6.9000° N|
|**Limite Sud (Latitude)**|~ 6.4000° N|
|**Limite Est (Longitude)**|~ 1.6500° E (Frontière Togo-Bénin, fleuve Mono)|
|**Limite Ouest (Longitude)**|~ 1.1200° E (Bassin du Zio, région de Tsévié)|
|**Centroïde Scientifique**|6.5500° N, 1.5333° E|
|**Superficie Dépression Stricte**|230 km² (23 000 hectares)|
|**Superficie Bassin d'Influence**|~ 450 km²|

### 1.2. Contexte géologique et pédologique

Le substratum de la Dépression de la Lama appartient aux séquences sédimentaires marines du Paléogène, spécifiquement datées de l'Éocène (Yprésien et Lutétien). L'architecture hydrogéologique révèle une configuration en biseau : la profondeur du toit de l'aquifère paléocène, affleurant presque au nord (40 mètres), plonge brusquement pour atteindre des profondeurs de 280 à 380 mètres sous les épaisses couches de marnes et d'argiles de la dépression dans sa frange méridionale. Les affleurements lithologiques sont dominés par des argiles feuilletées de couleur gris-vert, des calcaires argileux phosphatés, ainsi que des dépôts marno-sableux bioclastiques riches en matière organique.

Sur le plan pédologique, l'altération de ces roches mères engendre la formation de Vertisols lithomorphes (communément appelés "terres noires" ou "black cotton soils"), caractérisés par une structure extrêmement compacte en saison sèche et une forte plasticité en saison humide. Le drainage naturel de ces sols est qualifié de très lent à nul, imposant un régime hydrique défectueux et une saturation hydrique prolongée à la suite d'épisodes pluvieux. Selon la classification de la Base de Référence Mondiale pour les ressources en sols (WRB), ces formations se rattachent principalement aux Vertisols pelliques ou calciques.

La minéralogie de la fraction argileuse, historiquement supposée, a été confirmée par des analyses modernes utilisant la Diffraction des Rayons X (DRX) et l'Analyse Thermique Différentielle (ATD). Le faciès minéralogique est d'une grande spécificité : il est dominé par l'attapulgite (un phyllosilicate fibreux également connu sous le nom de palygorskite), intimement associée à la montmorillonite (une argile 2:1 du groupe des smectites). Cette configuration minéralogique, où les feuillets de smectite permettent l'insertion réversible de molécules d'eau dans l'espace interfoliaire, est la cause directe du comportement géotechnique de la zone. Les essais de laboratoire récents confirment que ces sols fibreux et smectitiques génèrent de graves désordres structurels sur les infrastructures, justifiant pleinement la classification du risque RGA au niveau TRÈS FORT pour cette unité. Les données issues de la maille limitrophe TG-0489 du projet Atlas confirment cette agressivité avec des valeurs prévisionnelles de VBS autour de 3.72 et un Indice de Plasticité (IP) de 21.4 %, caractéristiques d'une argile très active. Sur les marges de la dépression, le recouvrement colluvial introduit des proportions croissantes de kaolinite et d'illite, atténuant progressivement le potentiel de gonflement.

### 1.3. Bibliographie primaire

L'état des connaissances sur la Lama repose sur un socle historique robuste produit par l'ORSTOM (Office de la Recherche Scientifique et Technique Outre-Mer) et le BRGM, récemment mis à jour par des thèses universitaires. Les travaux fondateurs de M. Lamouroux (1960), notamment ses "Notes préliminaires à l'étude agropédologique de la dépression de la Lama", constituent la première véritable cartographie des contraintes physiques et hydriques de la zone. Ces levés ont été complétés par les études de M. Slansky (1962) sur la stratigraphie du bassin sédimentaire côtier du Dahomey et du Togo, qui ont permis de relier les observations pédologiques de surface à la présence des faciès marno-calcaires éocènes.

Plus récemment, les recherches hydrogéologiques et géochimiques post-2000 ont affiné la compréhension du système. Les travaux de K.E. Elom Ezi (2022) sur la caractérisation de l'artésianisme dans le bassin bénino-togolais fournissent des données capitales sur la géométrie en profondeur des aquifères confinés sous la couche d'attapulgite de la Lama. De plus, les études minéralogiques conjointes menées sur l'extension béninoise de la Lama confirment par DRX la présence et la proportion de minéraux gonflants, extrapolables directement à la partie togolaise.

### 1.4. Sources SIG disponibles

La génération d'un polygone de haute fidélité pour la Dépression de la Lama peut s'affranchir des relevés de terrain chronophages grâce à la télédétection. Les Modèles Numériques de Terrain (MNT), tels que le SRTM (30 mètres) ou le Copernicus DEM (10 mètres), sont particulièrement pertinents. Étant donné que la Lama est une cuvette topographique stricte encastrée entre des plateaux surplombants d'environ 80 à 100 mètres, l'application d'un filtre altimétrique (par exemple, l'extraction de l'isocontour inférieur à 60 mètres d'altitude dans le couloir compris entre le fleuve Zio et le fleuve Mono) permet de détourer mathématiquement le cœur de la formation.

Parallèlement, l'imagerie multispectrale Sentinel-2 (Niveau L2A) offre des capacités de discrimination lithologique inédites. Les vertisols (terres noires) présentent une signature spectrale caractéristique en saison sèche, marquée par une très faible réflectance générale et des anomalies dans l'infrarouge de courte longueur d'onde (SWIR). L'utilisation de ratios spectraux tels que le _Clay Minerals Ratio_ (calculé par le rapport des bandes SWIR1 / SWIR2) ou l'analyse des composantes principales sur des scènes acquises entre janvier et mars permet d'isoler avec précision les affleurements riches en attapulgite et smectite, là où la végétation herbacée a brûlé ou s'est desséchée.

### 1.5. Lacunes et incertitudes

Bien que le cœur de la Lama soit parfaitement identifié, l'incertitude majeure réside dans la délimitation de ses bordures septentrionales. La transition entre les vertisols purs de la cuvette et les sols intermédiaires colluvionnés issus du plateau nord (Crétacé) s'opère de manière diffuse, sans rupture de pente notable. Cette couverture colluviale sablo-argileuse masque la limite lithostratigraphique exacte en surface, créant un gradient continu d'hydromorphie et de minéralogie argileuse qu'il est complexe de discrétiser par une simple ligne vectorielle. Par ailleurs, la démarcation administrative à la frontière béninoise sur le fleuve Mono ne correspond à aucune discontinuité géologique, la dépression se poursuivant sans altération de ses propriétés vers l'est.

### 1.6. Recommandations pour le projet

Afin de raffiner la géométrie d'amorçage actuelle et de l'adapter aux exigences du KED, il est recommandé de mettre en œuvre un flux de travail SIG hybride. La première étape consiste à croiser le modèle topographique Copernicus 10m (en appliquant l'algorithme _Topographic Position Index_ - TPI) avec une classification non supervisée des images Sentinel-2 acquises en pleine saison sèche. L'extraction des zones d'altitude inférieure à 60 mètres présentant simultanément une signature spectrale de sols nus foncés fournira une géométrie vectorielle (GeoJSON, EPSG:4326) extrêmement fidèle à la réalité pédologique.

Conformément aux contraintes du projet, ce polygone sera ensuite converti en raster ou intersecté avec la grille EPSG:25231. Pour la Dépression de la Lama, une règle d'inclusion stricte doit être appliquée : toute maille de 4 km² intersectant ce polygone à plus de 10 % (soit 0,4 km²) devra se voir attribuer la covariable RGA TRÈS FORT. Les mailles présentant une intersection supérieure ou égale à 50 % devront être marquées d'un drapeau d'alerte dans le système d'ordres de mission (similaire au protocole de la maille TG-0489 ), imposant systématiquement des prélèvements non remaniés (carottages) lors des futures campagnes de sondages afin de préserver l'état de contrainte _in situ_ de ces argiles sur-consolidées par dessiccation.

## 2. Dépression du Bado (Régions Maritime et Plateaux)

La Dépression du Bado est fréquemment amalgamée à la Lama dans la littérature secondaire, ou traitée comme une simple annexe orientale de cette dernière. Toutefois, une analyse critique de la bibliographie pédologique primaire démontre qu'elle possède une identité morphologique, hydrologique et agronomique propre, intimement liée à la dynamique de la basse vallée du fleuve Mono.

### 2.1. Délimitation scientifique confirmée

Située à l'est du système sédimentaire, la zone du Bado s'étend au pied des escarpements orientaux du plateau de Terres de Barre et domine altimétriquement la plaine alluviale stricte du Mono. Elle se compose de deux bassins distincts séparés par le plateau sableux de Badokpo : le long bassin de Kini-Sikakondji au nord (caractérisé par des pentes extrêmement faibles de l'ordre de 0,2 à 0,5 %) et le petit bassin du lac Ilia au sud, dont les pentes sont plus marquées (1 à 5 %). L'ensemble de cette formation marneuse couvre une superficie estimée à près de 30 000 hectares (300 km²), s'étirant approximativement d'Agbanakè jusqu'à Tokpli. Le périmètre spécifique historiquement ciblé pour l'irrigation (en raison de l'imperméabilité des argiles) couvre 9 270 hectares géographiques, dont 6 670 hectares techniquement irrigables.

Le fait géomorphologique le plus remarquable, et crucial pour la cartographie, est que la dépression du Bado surplombe légèrement la plaine d'inondation du Mono. Cette élévation relative, bien que minime, met historiquement les sols lourds du Bado à l'abri des inondations majeures causées par les crues du fleuve, les distinguant ainsi nettement des alluvions récentes de décantation situées en contrebas.

|**Paramètre Spatial**|**Valeurs et Coordonnées (WGS84 - EPSG:4326)**|
|---|---|
|**Limite Nord (Latitude)**|~ 6.6000° N (Environs de Tokpli)|
|**Limite Sud (Latitude)**|~ 6.2500° N (Environs d'Agbanakè / Lac Ilia)|
|**Limite Est (Longitude)**|~ 1.6000° E (Dominant la plaine du Mono)|
|**Limite Ouest (Longitude)**|~ 1.3000° E (Retombées du Plateau de Badokpo)|
|**Superficie Totale (Emprise marneuse)**|~ 300 km² (30 000 hectares)|
|**Superficie Bassins Argileux Purs**|~ 92 km² (9 270 hectares)|

### 2.2. Contexte géologique et pédologique

Structurellement, la Dépression du Bado appartient à la même entité stratigraphique que la Lama. Elle représente l'extension orientale et le faciès d'altération des marnes éocènes et paléocènes du bassin sédimentaire côtier. La lithologie sous-jacente est constituée d'une marne à attapulgite au sein de laquelle se développent des nodules de calcaire en profondeur, ainsi que des concrétions manganésifères et des nodules d'apatite. La correspondance entre ces faciès géologiques profonds et les sols de surface est très nette dans cette zone, malgré quelques remaniements locaux.

La pédogenèse sur ces marnes a conduit à la formation d'une mosaïque de sols lourds. On y distingue principalement des sols calcimorphes, des vertisols hydromorphes, des sols brun-clair formés sur les argiles de la série des attapulgites, ainsi qu'une bande de sols noirs très caractéristiques reposant sur des conglomérats calcaires à la limite des plateaux. Dans la taxonomie vernaculaire paysanne documentée dans le sud du Togo, ces sols lourds argileux et collants sont d'ailleurs désignés sous le terme générique de _bado_ (par opposition au _kodjin_ désignant les sols rouges ferrallitiques ou au _bakomê_ pour les sols noirs organiques), illustrant la pertinence locale de cette distinction.

La minéralogie est écrasée par la prédominance de l'attapulgite (palygorskite), accompagnée de fractions de smectites. Les analyses historiques révèlent que ces sols possèdent une Capacité d'Échange Cationique (CEC) exceptionnellement élevée. Sur le plan géotechnique, la présence conjointe de ces argiles à grande surface spécifique et d'un régime hydrique marqué par de fortes alternances dessiccation/saturation justifie pleinement la classification de la zone en risque RGA FORT, voire TRÈS FORT dans les points bas topographiques.

### 2.3. Bibliographie primaire

L'absence de références bibliographiques dans la base de données actuelle du projet concernant le Bado constitue une lacune critique qui peut être comblée par les archives de l'ORSTOM. La zone a fait l'objet d'investigations intensives dans les années 1960 dans le cadre des vastes projets d'aménagement hydro-agricole de la vallée du Mono, commandités par le Fonds Spécial des Nations-Unies (FAO SF:13/T0). Les références fondamentales incluent :

- Willaime P. (1960). _Études agro-pédologiques du Bas-Togo. La dépression du Bado_.
    
- Willaime P. (1964). _Contribution à l'étude des sols de la basse vallée du Mono_ (comprenant une cartographie au 1/50 000).
    
- Divers rapports de la Direction de l'Agriculture et de l'Hydraulique détaillant les aptitudes à l'irrigation des vertisols de la cuvette.
    

### 2.4. Sources SIG disponibles

Les documents les plus précieux pour délimiter cette zone avec exactitude sont les cartes pédologiques de reconnaissance au 1/50 000 levées par Willaime en 1964. Ces planches cartographiques, disponibles dans les fonds documentaires numérisés de l'IRD (Horizon Pleins Textes), doivent être géoréférencées. Elles permettent de vectoriser précisément les unités de sols calcimorphes et de vertisols. Par ailleurs, l'utilisation d'un Modèle Numérique de Terrain (MNT) à haute résolution spatiale est indispensable pour tracer la rupture de pente (souvent de l'ordre de quelques décimètres à un mètre) qui sépare la terrasse du Bado de la plaine d'inondation adjacente du Mono.

### 2.5. Lacunes et incertitudes

La principale difficulté de modélisation réside dans la transition douce entre les marges orientales de la Dépression du Bado et la Plaine alluviale du Mono. Distinguer les argiles issues de l'altération _in situ_ des marnes éocènes (Bado) des argiles holocènes déposées par décantation lors des crues du fleuve (Mono) est complexe par télédétection seule, car les deux formations présentent des textures fines et des phénomènes d'hydromorphie prononcés. Les données de télédétection radar (SAR) pourraient s'avérer nécessaires pour distinguer les différences de rugosité de surface en saison sèche.

### 2.6. Recommandations pour le projet

Il est recommandé de traiter la Dépression du Bado géostatistiquement comme une extension du système de la Lama, en lui appliquant la même covariable "faciès paléogène à attapulgite" pour l'algorithme KED. Lors de la vectorisation, il sera crucial d'exclure formellement l'îlot du plateau de Badokpo et les avancées de Terres de Barre qui pénètrent au centre de la dépression. L'inclusion erronée de ces sables rouges dans le polygone argileux entraînerait une forte dégradation de la variance d'estimation du krigeage, en forçant le modèle à prédire un fort potentiel de gonflement sur des sols pulvérulents et perméables.

## 3. Fosse aux Lions (Région des Savanes)

La Fosse aux Lions représente l'un des défis majeurs de l'Atlas Géotechnique. Localisée dans l'extrême nord du pays, son emprise actuelle dans le système (15 à 30 mailles, soit 60 à 120 km²) est qualifiée de "très approximative". Les investigations géologiques et historiques révèlent que cette approximation masque une réalité morphostructurale complexe qu'il convient de désagréger rigoureusement.

### 3.1. Délimitation scientifique confirmée

Contrairement à certaines hypothèses, la Fosse aux Lions n'est ni un accident karstique isolé ni une simple anomalie pédologique. Il s'agit d'une vaste cuvette de subsidence tectono-érosive et d'une vallée très encaissée, située au pied des escarpements des falaises de grès de Bombouaka et de Nano. Elle s'étend de part et d'autre de la route nationale N1 reliant Dapango à Bombouaka, englobant l'actuelle petite ville de Tandjouaré.

Pour les besoins de la modélisation géotechnique, il est impératif de distinguer trois échelles spatiales imbriquées, souvent confondues dans la littérature :

1. **Le Bassin Versant Hydrogéologique** : Drainé principalement par les rivières Kounfab et Napabour (avant de former la Koulougona en direction de l'ouest vers le Ghana), il couvre une superficie totale de 208 à plus de 300 km².
    
2. **Le Parc National (Réserve de Faune)** : Créé initialement en 1954, le périmètre classé (aujourd'hui massivement dégradé et dont la population d'éléphants a disparu) couvre une superficie stricte de 16,5 km² (1 650 hectares).
    
3. **La Cuvette Alluviale/Argileuse Stricte** : La zone déprimée concentrant l'accumulation des sols argileux lourds — et donc la zone d'intérêt prioritaire pour le risque RGA — ne représente en réalité qu'une superficie de 700 à 800 hectares (7 à 8 km²).
    

|**Paramètre Spatial**|**Valeurs et Coordonnées (WGS84 - EPSG:4326)**|
|---|---|
|**Limite Nord (Latitude)**|10.8000° N (10°48' N)|
|**Limite Sud (Latitude)**|10.7500° N (10°45' N)|
|**Limite Est (Longitude)**|0.2500° E (0°15' E)|
|**Limite Ouest (Longitude)**|0.1666° E (0°10' E)|
|**Altitude de la Cuvette**|109 à 167 mètres (contrastant avec les falaises)|
|**Superficie Bassin Versant**|~ 208 - 300 km²|
|**Superficie Zone Argileuse (RGA)**|~ 7 - 8 km² (700 à 800 hectares)|

### 3.2. Contexte géologique et pédologique

La géologie de la Fosse aux Lions s'inscrit dans l'immense bassin sédimentaire du Néoprotérozoïque connu sous le nom de Bassin Voltaïen (ou système de la Volta). Au niveau local, la cuvette repose sur une vaste poche de sédiments marins anciens, encadrée au nord par les grès de Dapango et au sud par les grès de Bombouaka. Le substratum de la dépression elle-même appartient à la formation lithostratigraphique de _Poubougou_ (parfois nommée Formation de la Fosse-aux-Lions par certains auteurs), qui constitue la base du groupe sédimentaire de l'Oti-Pendjari. Cette formation est principalement constituée de schistes argilo-gréseux, de mudstones et de pélites. L'âge de ces sédiments a été daté avec précision : des déterminations isotopiques Rb/Sr sur les minéraux argileux des shales de la formation de Poubougou ont livré un âge radiométrique de 993 ± 65 millions d'années (Tonien, début du Néoprotérozoïque). Le nord du bassin versant présente également des pointements éruptifs de granites calco-alcalins.

La pédogenèse dans la cuvette est dominée par l'accumulation de colluvions issues des versants gréseux et d'alluvions fluviatiles transportées par le Kounfab et le Napabour, qui recouvrent les schistes du Voltaïen sur des épaisseurs de plusieurs mètres. Les 700 hectares de la zone la plus déprimée sont colmatés par des sols argileux et argilo-limoneux contenant plus de 50 % d'argile, classifiés comme vertisols et sols à forte hydromorphie minérale. La dégradation météoritique (altération) des shales néoprotérozoïques libère massivement de l'illite, associée à une néoformation de smectites (montmorillonite) dans cet environnement confiné à mauvais drainage. C'est la présence concentrée de cette fraction smectitique dans les points bas topographiques qui génère le comportement vertique (fentes de retrait en saison sèche, fort gonflement à l'hivernage) et justifie l'affectation d'un indice RGA TRÈS FORT sur une surface très localisée.

### 3.3. Bibliographie primaire

La littérature géologique moderne a largement étudié cette formation stratigraphique en raison de son importance pour la compréhension du craton ouest-africain :

- Coueffe et al. (2011) et Kalsbeek et al. (2008) ont produit des synthèses sédimentologiques et géochronologiques détaillées sur le supergroupe du Voltaïen et les groupes de Bombouaka et d'Oti-Pendjari.
    
- Du côté hydrologique et pédologique, les archives de l'ORSTOM demeurent la source primaire pour la spatialisation des sols. Les campagnes de mesures hydrologiques menées entre 1959 et 1961 par Jarre, Michenaud et Lamouroux sur les bassins expérimentaux du Kounfab ont minutieusement cartographié la répartition des argiles lourdes en vue d'aménagements rizicoles.
    

### 3.4. Sources SIG disponibles

- **World Database on Protected Areas (WDPA)** : Cette base de données ouverte fournit le polygone vectoriel officiel du Parc National de la Fosse aux Lions (Identifiant Catégorie II IUCN). Bien que la faune ait disparu, ce polygone institutionnel constitue une excellente approximation initiale du fond de la cuvette géologique.
    
- **Modèles Numériques de Terrain (MNT)** : L'utilisation du Copernicus DEM (10 mètres) est vitale. L'altitude du fond de la fosse varie entre 109 et 167 mètres. Un filtrage altimétrique couplé à un calcul d'accumulation de flux permet d'isoler précisément les zones de dépôt sédimentaire fin (argiles) au pied des falaises gréseuses.
    

### 3.5. Lacunes et incertitudes

L'obstacle majeur à la délimitation par télédétection optique (Sentinel-2) réside dans l'intense pression anthropique. Le massacre de la faune dans les années 1980 et 1990 s'est accompagné d'un défrichement massif. La Fosse est aujourd'hui fortement cultivée par les populations locales. Le remaniement permanent de la couche arable par l'agriculture détruit la signature spectrale naturelle des vertisols en surface, rendant les indices spectraux classiques inopérants. L'estimation de l'épaisseur exacte de la couche argileuse active au centre de la dépression reste également incertaine (estimée à "plusieurs mètres" par l'ORSTOM, sans sondages carottés profonds documentés ).

### 3.6. Recommandations pour le projet

L'emprise vectorielle actuelle du projet (15 à 30 mailles) englobe probablement une vaste portion des versants et des plateaux de grès non argileux, ce qui induira le modèle de krigeage en erreur en associant des valeurs RGA élevées à des sols gréseux pulvérulents.

Pour corriger cette géométrie, il faut adopter une approche géomorphométrique. **Action SIG recommandée** : Télécharger le shapefile du Parc National depuis la base WDPA. Sur cette emprise, calculer l'indice topographique d'humidité (_Topographic Wetness Index_ - TWI) à partir du MNT Copernicus 10m. Seuls les pixels présentant un TWI très élevé (correspondant aux zones de concentration du drainage où les argiles fines décantent et s'accumulent) devront être vectorisés pour former le nouveau polygone de la Fosse aux Lions.

Lors de l'intersection avec la grille EPSG:25231, en raison de l'agressivité extrême de ces argiles smectitiques néoprotérozoïques, toute maille possédant une intersection ≥ 50 % avec ce nouveau polygone devra automatiquement déclencher des consignes de sécurité géotechnique sévères dans le système d'ordre de mission (ex: nécessité de prélèvements intacts, traitement des sols à la chaux), à l'image des protocoles générés pour les mailles sensibles du sud.

## 4. Plaine du Mono (Régions Plateaux et Maritime)

La plaine d'inondation du fleuve Mono constitue le système fluvio-lagunaire et l'artère de drainage principal de la façade orientale du Togo. C'est une région où la dynamique hydrologique saisonnière modèle directement la répartition spatiale et la nature des sols argileux.

### 4.1. Délimitation scientifique confirmée

La plaine s'étend longitudinalement le long de la frontière avec le Bénin, depuis l'aval du barrage hydroélectrique de Nangbéto (latitude ~7.15° N) jusqu'à son embouchure océanique à la "Bouche du Roi". Du côté togolais, la délimitation occidentale de la plaine alluviale est topographiquement franche : elle est stoppée par le talus limitant les plateaux sédimentaires (dont les Terres de Barre et la Dépression du Bado).

- **Coordonnées Bounding Box (WGS84 - EPSG:4326)** :
    
    - Nord : ~ 7.1500° N
        
    - Sud : ~ 6.2000° N (Complexe lagunaire)
        
    - Est : ~ 1.8000° E (Axe transfrontalier)
        
    - Ouest : ~ 1.2000° E (Bordure des plateaux)
        
- **Superficie** : La plaine alluviale d'inondation globale en aval de Nangbéto dépasse les 300 km². À l'échelle locale, les zones aménageables spécifiques, comme le périmètre "Alluvions Togo" en rive droite, couvrent à elles seules environ 9 040 hectares géographiques (dont 6 510 irrigables).
    

### 4.2. Contexte géologique et pédologique

La géologie de la plaine du Mono est caractérisée par une sédimentation alluviale épaisse, incisée dans le substratum sableux du Continental Terminal ou dans les marnes paléocènes. L'épaisseur des dépôts quaternaires (Pleistocène pour les terrasses anciennes, Holocène pour le lit majeur actuel) est en moyenne de 20 à 40 mètres, et peut atteindre jusqu'à 80 mètres dans les paléovallées les plus profondes.

La pédologie est intimement dictée par la granulométrie des dépôts alluviaux. Les alluvions anciennes portent des sols concrétionnés dont la stabilité structurale est très hétérogène. La perméabilité de ces sols est extrêmement faible : les mesures historiques (méthode Hénin) indiquent des vitesses d'infiltration de 0,4 à 1,8 cm/h en surface, chutant à moins de 0,4 cm/h dans les horizons profonds. Dans le lit majeur inondable, le faciès dominant est constitué de sols hydromorphes minéraux sur alluvions récentes, de pseudogleys et de vertisols.

La minéralogie des argiles de la plaine du Mono est complexe. Les argiles déposées sont des sédiments transportés et décantés (par opposition aux argiles d'altération _in situ_ de la Lama). La dynamique de sédimentation a été drastiquement altérée par la mise en service du barrage de Nangbéto en 1987. Cet ouvrage retient en amont une quantité massive de sédiments grossiers (estimée à près de 200 000 tonnes de sables et limons par an). Le "hungry water effect" (eaux affamées de sédiments) généré en aval a deux conséquences géotechniques majeures : une forte érosion des berges et le dépôt exclusif de la charge en suspension ultra-fine (les argiles smectitiques et montmorillonitiques) dans les plaines de débordement lors des crues. Cette hyper-concentration en argiles lourdes, déposées en couches stratifiées très plastiques, maintient un risque RGA FORT sur l'ensemble de la plaine d'inondation récente.

### 4.3. Bibliographie primaire

- Les recherches fondamentales de P. Willaime (1964, 1965) pour l'ORSTOM (_Contribution à l'étude des sols de la basse vallée du Mono_ et _Les sols alluviaux du Bas Mono_) constituent la base de référence pour la cartographie des alluvions anciennes versus récentes.
    
- Les publications hydrologiques et sédimentologiques post-2000, notamment les travaux d'Amoussou (2012, 2017) sur l'impact de Nangbéto et la dynamique sédimentaire du bassin fluvio-lagunaire, actualisent ce corpus.
    

### 4.4. Sources SIG disponibles

Pour délimiter l'extension exacte des alluvions récentes (Holocène) par opposition aux alluvions anciennes, l'analyse topographique ne suffit pas, car la différence d'altitude est de l'ordre du mètre. La ressource ouverte la plus pertinente est le jeu de données spatiales **Global Surface Water** développé par le Joint Research Centre (JRC) de la Commission Européenne. En extrayant la couche "Maximum Water Extent" (qui cartographie l'emprise maximale historique des inondations observées par satellite Landsat/Sentinel sur les 40 dernières années), on obtient une empreinte exacte du lit majeur de débordement du fleuve Mono. Puisque les argiles smectitiques de cette zone se déposent exclusivement par décantation lors des crues, l'emprise d'inondation spatiale correspond exactement à l'extension lithologique de la couche argileuse active.

### 4.5. Lacunes et incertitudes

L'impact qualitatif de la sédimentation post-Nangbéto (depuis 1987) sur les 20 à 50 premiers centimètres du profil de sol est reconnu qualitativement , mais aucune campagne géotechnique systématique n'a quantifié l'augmentation de l'Indice de Plasticité (IP) sur cette couche superficielle spécifiquement liée aux lâchers d'eau du barrage par rapport aux sédiments pré-1987.

### 4.6. Recommandations pour le projet

L'emprise "approximative" dessinée dans le système actuel doit être remplacée. **Action SIG recommandée** : Importer le raster "Maximum Water Extent" du JRC pour la basse vallée du Mono. Appliquer un filtre de lissage (ex: majorité ou convolution) pour éliminer les artefacts locaux et boucher les pixels manquants, puis vectoriser ce raster pour obtenir un GeoJSON de la plaine de débordement. Lors de la planification des sondages géotechniques, toute maille interceptant à plus de 50 % ce polygone devra faire l'objet de prélèvements profonds par carottier rotatif, la cohésion et la plasticité de ces dépôts fluvio-lacustres saturés interdisant souvent le prélèvement à la tarière manuelle sans remaniement destructeur.

## 5. Plaine de l'Oti (Région des Savanes)

La modélisation de la plaine de l'Oti représente un cas de figure radicalement différent des bassins sédimentaires côtiers. Actuellement intégrée dans l'Atlas par un grossier rectangle d'essai englobant 600 à 800 mailles, cette représentation surestime massivement l'emprise géographique de l'aléa et méconnaît la nature minéralogique réelle du nord du Togo.

### 5.1. Délimitation scientifique confirmée

La plaine de l'Oti ne forme pas un rectangle, mais une gouttière morphologique largement évasée, orientée du nord-est vers le sud-ouest, qui traverse la région de Sansanné-Mango.

- **Coordonnées Bounding Box Hydrologique (Estimées WGS84)** : La plaine s'inscrit globalement entre les longitudes 0.40° E et 1.00° E, depuis l'extrême nord de Mandouri jusqu'en aval de Mango, traversant de multiples frontières (Bénin en amont, Ghana en aval).
    
- **Superficie** : L'emprise de la plaine alluviale est colossale et se divise en deux entités :
    
    1. L'Oti inférieur (s'étendant sur 30 km au sud-ouest de Mango) couvre environ 39 000 hectares (390 km²).
        
    2. L'Oti supérieur (remontant jusqu'à la frontière béninoise et incluant Mandouri) couvre plus de 135 000 hectares (1 350 km²).
        
- **Topographie** : La plaine est caractérisée par un surbaissement prononcé par rapport à l'ensemble du socle togolais. La gouttière ne dépasse que très rarement l'altitude de 200 mètres, le lit de la rivière Oti s'écoulant doucement entre les cotes 124 mètres et 92 mètres, avec une pente longitudinale extrêmement faible, inférieure à 0,1 pour mille.
    

### 5.2. Contexte géologique et pédologique

Contrairement aux plaines alluviales côtières reposant sur un socle sédimentaire tertiaire (Marnes de la Lama, Continental Terminal), la plaine de l'Oti est incisée directement dans les "Schistes de Sansanné-Mango". Ces formations, d'âge cambrien ou infra-cambrien (système Voltaïen), sont constituées de schistes peu ou moyennement plissés, accompagnés de pélites, de grès feldspathiques et de bancs siliceux (jaspes et cherts).

La pédologie des alluvions de l'Oti est singulière. Les sols sont classés comme hydromorphes minéraux sur alluvions, associés à des sols ferrugineux tropicaux lessivés, fréquemment concrétionnés ou surmontés d'une cuirasse ferrugineuse développée entre les cotes 160 et 200 mètres. La minéralogie argileuse constitue la clef de voûte de l'analyse géotechnique de cette région : l'altération des schistes et la dynamique de dépôt génèrent des "argiles gréseuses compactes" dont la fraction fine est dominée de manière écrasante par la **kaolinite**, accompagnée d'illite et d'oxydes de fer.

La kaolinite est un phyllosilicate de type 1:1, dont la structure cristallographique interdit l'insertion d'eau entre les feuillets. Par conséquent, elle ne gonfle pas. Ce comportement dicte la dynamique de la plaine de l'Oti : en saison des pluies, l'eau ne pénètre pas l'argile imperméable, provoquant un ruissellement massif et des inondations prolongées (hydromorphie totale) ; en saison sèche, cette même argile durcit "comme du ciment" sans présenter le réseau de fentes de retrait profond caractéristique des smectites du sud. C'est ce mécanisme minéralogique fondamental qui justifie que le risque géotechnique RGA de la vallée de l'Oti soit classé MOYEN, et non fort, validant la pertinence d'une covariable zonale distincte dans l'Atlas.

### 5.3. Bibliographie primaire

La morphodynamique de cette région a été amplement documentée :

- Les rapports pédohydrologiques de l'ORSTOM (Dabin, Vieillefon) demeurent les piliers de la cartographie des sols ferrugineux et alluviaux de la région de Mango.
    
- Plus récemment, les études géomorphologiques de Gnongbo et Kankpenandja (2017) analysent la signature sédimentologique des alluvions anciennes et récentes de l'Oti, démontrant la très grande mobilité des berges (bras morts, recoupements de méandres) et l'étendue de la sédimentation.
    

### 5.4. Sources SIG disponibles

- **World Database on Protected Areas (WDPA)** : Le complexe des aires protégées de la réserve de faune Oti-Kéran-Mandouri (OKM) épouse fidèlement les contours de la plaine d'inondation majeure de l'Oti. La raison de cette superposition est historique et agronomique : les sols lourds et inondables de la plaine, difficiles à exploiter en permanence, ont été sanctuarisés. Le shapefile de l'OKM constitue donc un excellent proxy géométrique pour délimiter les alluvions.
    
- **MNT SRTM / Copernicus (30m)** : Compte tenu de la topographie (le fond de vallée s'écoulant entre 92 et 124m), une extraction isocontour (ex: altitude < 130m) permet de détourer parfaitement la zone alluviale au sein des plateaux schisteux de Mango.
    

### 5.5. Lacunes et incertitudes

La principale difficulté spatiale réside dans l'hétérogénéité latérale des sédiments alluviaux (passant rapidement d'alluvions sableuses perméables à des lentilles d'argiles lourdes hydromorphes), dont la répartition varie en fonction des anciens recoupements de méandres, impossibles à capturer à la résolution de 4 km² de la grille de l'Atlas.

### 5.6. Recommandations pour le projet

Il est impératif de supprimer le rectangle d'essai actuel. **Action SIG recommandée** : Générer un géotraitement MULTIPOLYGON basé sur l'intersection spatiale de trois conditions indépendantes :

1. Altitudes inférieures à 130 mètres (via MNT Copernicus 10m).
    
2. Superposition (ou intersection) avec les polygones officiels des aires protégées du complexe Oti-Kéran-Mandouri (disponibles sur WDPA).
    
3. Distances latérales inférieures à 5 km de l'axe central du fleuve Oti (réseau hydrographique OSM).
    

L'indice de risque RGA pour ce polygone devra être strictement plafonné à MOYEN dans le système. Lors du calcul de l'interpolation géostatistique KED, l'affectation de cette covariable modérée influencera le variogramme en abaissant mathématiquement les valeurs prévisionnelles de VBS pour toutes les mailles situées dans le nord du Togo, ce qui reflète fidèlement la prédominance des argiles kaolinitiques et des croûtes ferrugineuses.

## 6. Synthèse et Intégration Géostatistique au Projet Atlas

L'intégration de ces cinq délimitations scientifiques robustes est la condition d'un conditionnement réussi de la matrice de covariance lors du krigeage.

L'architecture géospatiale du système doit opérer la transformation depuis les contours WGS84 (EPSG:4326) générés par les méthodes SIG recommandées vers le système projeté EPSG:25231 (UTM Zone 31N) de l'Atlas. Le moteur spatial (de type PostGIS ou GeoPandas) devra évaluer l'aire d'intersection de chaque maille de 4 km² (2000 x 2000 m) avec les polygones documentés.

La règle d'association spatiale fixée à **10 % (soit 0,4 km² d'intersection)** est suffisante pour basculer le pixel dans une catégorie de risque RGA spécifique. Dès lors que cette surface critique d'argile est présente au sein d'une maille, le KED intègrera cette covariable comme paramètre de dérive externe, ajustant l'espérance locale de la VBS et de l'IP à la hausse (pour la Lama, le Bado, la Fosse aux Lions et le Mono) ou la modérant (pour l'Oti).

Pour les opérations de terrain, le critère de priorité à **50 % (soit 2,0 km² d'intersection)** garantit que les équipes de sondage ne seront mobilisées avec des équipements de carottage lourd (indispensables pour les prélèvements intacts sur argiles sur-consolidées) que dans les mailles où la probabilité de rencontrer la formation lithostratigraphique d'intérêt est majoritaire. La substitution des polygones rudimentaires actuels par ces délimitations géo-fondées supprimera les artefacts d'estimation aux frontières des zones, fiabilisant la cartographie géotechnique nationale prévisionnelle et l'évaluation du risque RGA à l'échelle du Togo.

[

![](https://t0.gstatic.com/faviconV2?url=https://horizon.documentation.ird.fr/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

horizon.documentation.ird.fr

Etudes agropédologiques du bas-Togo : la dépression du Bado - Horizon IRD

S'ouvre dans une nouvelle fenêtre](https://horizon.documentation.ird.fr/exl-doc/pleins_textes/divers16-01/15659.pdf)[

![](https://t0.gstatic.com/faviconV2?url=https://www.inter-reseaux.org/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

inter-reseaux.org

Background Papers

S'ouvre dans une nouvelle fenêtre](https://www.inter-reseaux.org/wp-content/uploads/02_Van_Kauwenbergh-Fertilizer_Raw_Material_Resources.pdf)[

![](https://t0.gstatic.com/faviconV2?url=https://horizon.documentation.ird.fr/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

horizon.documentation.ird.fr

Etude des sols de la dépression de la Lama et de ses bordures : Toffo-Séhoué-Agrimé : carte pédologique de reconnaissance a - Horizon IRD

S'ouvre dans une nouvelle fenêtre](https://horizon.documentation.ird.fr/exl-doc/pleins_textes/divers16-02/11604.pdf)[

![](https://t2.gstatic.com/faviconV2?url=https://tg.chm-cbd.net/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

tg.chm-cbd.net

MONOGRAPHIE VERSION FINALE 23 12 03 _photo_.pdf - Togo Biodiversity

S'ouvre dans une nouvelle fenêtre](https://tg.chm-cbd.net/sites/tg/files/2023-07/MONOGRAPHIE%20VERSION%20FINALE%2023%2012%2003%20_photo_.pdf)[

![](https://t3.gstatic.com/faviconV2?url=http://riha.african-herbaria.org/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

riha.african-herbaria.org

Echantillons - RPA

S'ouvre dans une nouvelle fenêtre](http://riha.african-herbaria.org/details-echantillon/133231/TOGO)[

![](https://t3.gstatic.com/faviconV2?url=http://riha.african-herbaria.org/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

riha.african-herbaria.org

Echantillons - RPA

S'ouvre dans une nouvelle fenêtre](http://riha.african-herbaria.org/details-echantillon/133019/TOGO)[

![](https://t2.gstatic.com/faviconV2?url=https://www.scirp.org/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

scirp.org

Physico-Chemical Characteristics of Gushing Water Aquifers in the Coastal Sedimentary Basin of Benin (West Africa) - Scirp.org.

S'ouvre dans une nouvelle fenêtre](https://www.scirp.org/journal/paperinformation?paperid=110915)[

![](https://t3.gstatic.com/faviconV2?url=https://journal-backups.lon1.digitaloceanspaces.com/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

journal-backups.lon1.digitaloceanspaces.com

Hydrogeochemical characterization of the coastal Paleocene aquifer of Togo (West Africa) - DigitalOcean

S'ouvre dans une nouvelle fenêtre](https://journal-backups.lon1.digitaloceanspaces.com/uploads/main/article/article1379431305_Gnazou%20et%20al.pdf)[

![](https://t2.gstatic.com/faviconV2?url=https://www.memoireonline.com/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

memoireonline.com

Silting of Togo inshore sedimentary basin rivers and protection measures: Case of Zio river - Akintola S. Nelson AKIBODE - Memoire Online

S'ouvre dans une nouvelle fenêtre](https://www.memoireonline.com/08/08/1474/silting-togo-inshore-sedimentary-basin-rivers-protection-measures-zio-river.html)[

![](https://t2.gstatic.com/faviconV2?url=https://projekte.uni-hohenheim.de/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

projekte.uni-hohenheim.de

Geology and geomorphology of southern Benin, west africa

S'ouvre dans une nouvelle fenêtre](https://projekte.uni-hohenheim.de/atlas308/c_benin/projects/c2_1_1/html/english/btext_en_c2_1_1.htm)[

![](https://t0.gstatic.com/faviconV2?url=https://horizon.documentation.ird.fr/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

horizon.documentation.ird.fr

Partie pédologique : tome 3. Le Lac Elia à Kpessou (Togo) - Horizon IRD

S'ouvre dans une nouvelle fenêtre](https://horizon.documentation.ird.fr/exl-doc/pleins_textes/divers16-01/15244.pdf)[

![](https://t3.gstatic.com/faviconV2?url=https://pubs.usgs.gov/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

pubs.usgs.gov

Data Set of World Phosphate Mines, Deposits, and Occurrences—Part A. Geologic Data - USGS Publications Warehouse

S'ouvre dans une nouvelle fenêtre](https://pubs.usgs.gov/of/2002/0156/pdf/OF02-156A.pdf)[

![](https://t1.gstatic.com/faviconV2?url=https://fr.scribd.com/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

fr.scribd.com

Actes LCPC ACTSEC15 Symposium Retrait Gonflement Argile 2015 | PDF - Scribd

S'ouvre dans une nouvelle fenêtre](https://fr.scribd.com/document/501778182/Actes-LCPC-ACTSEC15-Symposium-Retrait-Gonflement-Argile-2015)[

![](https://www.gstatic.com/images/branding/productlogos/gmail_2020q4/v11/192px.svg)

Atlas Géotechnique — Votre mission de reconnaissance terrain

S'ouvre dans une nouvelle fenêtre](https://mail.google.com/mail/u/0/#all/FMfcgzQgMMHMkPXwhffPDdQhCNKmPHpj)[

![](https://t0.gstatic.com/faviconV2?url=https://www.documentation.ird.fr/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

documentation.ird.fr

Notes préliminaires à l'étude agropédologique de la dépression de la Lama (notes techniques)- fdi:12749- Horizon - IRD

S'ouvre dans une nouvelle fenêtre](https://www.documentation.ird.fr/hor/fdi:12749)[

![](https://t2.gstatic.com/faviconV2?url=https://rezoc.osug.fr/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

rezoc.osug.fr

CARACTÉRISATION DE L'ARTÉSIANISME DANS LE BASSIN SÉDIMENTAIRE CÔTIER BÉNINO- TOGOLAIS - lmi rezoc

S'ouvre dans une nouvelle fenêtre](https://rezoc.osug.fr/IMG/pdf/memoire_ezi_elom_final_lmi.pdf)[

![](https://t0.gstatic.com/faviconV2?url=https://horizon.documentation.ird.fr/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

horizon.documentation.ird.fr

L'aménagement et la mise en valeur des bassins de l'Oti et du Mono : présentation préliminaire - Horizon IRD

S'ouvre dans une nouvelle fenêtre](https://horizon.documentation.ird.fr/exl-doc/pleins_textes/divers14-11/12293.pdf)[

![](https://t0.gstatic.com/faviconV2?url=https://horizon.documentation.ird.fr/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

horizon.documentation.ird.fr

Aménagement du bassin du Mono - Horizon IRD

S'ouvre dans une nouvelle fenêtre](https://horizon.documentation.ird.fr/exl-doc/pleins_textes/divers13-10/33108.pdf)[

![](https://t0.gstatic.com/faviconV2?url=http://www.bibalex.org/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

bibalex.org

Natural Resource Management in West Africa

S'ouvre dans une nouvelle fenêtre](http://www.bibalex.org/Search4Dev/files/344713/178194.pdf)[

![](https://t3.gstatic.com/faviconV2?url=https://www.afes.fr/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

afes.fr

Estimation des stocks de carbone des sols du Bénin - AFES

S'ouvre dans une nouvelle fenêtre](https://www.afes.fr/wp-content/uploads/2023/04/EGS_6_2_VOLKOFF.pdf)[

![](https://t0.gstatic.com/faviconV2?url=https://horizon.documentation.ird.fr/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

horizon.documentation.ird.fr

La palmeraie du Mono : approche géographique - Horizon IRD

S'ouvre dans une nouvelle fenêtre](https://horizon.documentation.ird.fr/exl-doc/pleins_textes/divers18-01/05069.pdf)[

![](https://t0.gstatic.com/faviconV2?url=https://horizon.documentation.ird.fr/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

horizon.documentation.ird.fr

Estimation des stocks de carbone des sols - du Benin - Horizon IRD

S'ouvre dans une nouvelle fenêtre](https://horizon.documentation.ird.fr/exl-doc/pleins_textes/pleins_textes_7/b_fdi_51-52/010019012.pdf)[

![](https://t0.gstatic.com/faviconV2?url=https://horizon.documentation.ird.fr/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

horizon.documentation.ird.fr

Les sols à vocation rizicole du nord Togo : 2. La Fosse aux Lions - Horizon IRD

S'ouvre dans une nouvelle fenêtre](https://horizon.documentation.ird.fr/exl-doc/pleins_textes/divers15-08/010025580.pdf)[

![](https://t0.gstatic.com/faviconV2?url=https://horizon.documentation.ird.fr/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

horizon.documentation.ird.fr

Aménagements Hydroagricoles du Nord Togo. Première partie : la Fosse aux Lions, campagne hydrologique 1960 - Horizon IRD

S'ouvre dans une nouvelle fenêtre](https://horizon.documentation.ird.fr/exl-doc/pleins_textes/divers16-07/33207.pdf)[

![](https://t2.gstatic.com/faviconV2?url=https://en.wikipedia.org/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

en.wikipedia.org

Fosse aux Lions National Park - Wikipedia

S'ouvre dans une nouvelle fenêtre](https://en.wikipedia.org/wiki/Fosse_aux_Lions_National_Park)[

![](https://t0.gstatic.com/faviconV2?url=https://horizon.documentation.ird.fr/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

horizon.documentation.ird.fr

Aménagements hydro-agricoles du Nord Togo : la Fosse aux Lions, campagne hydrologique 1959-1960-1961 - Horizon IRD

S'ouvre dans une nouvelle fenêtre](https://horizon.documentation.ird.fr/exl-doc/pleins_textes/divers15-04/33094.pdf)[

![](https://t3.gstatic.com/faviconV2?url=https://govolunteerafrica.org/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

govolunteerafrica.org

The Three National Parks of Togo - Go Volunteer Africa

S'ouvre dans une nouvelle fenêtre](https://govolunteerafrica.org/the-three-national-parks-of-togo/)[

![](https://t0.gstatic.com/faviconV2?url=https://www.researchgate.net/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

researchgate.net

Geochemistry of Precambrian sedimentary rocks used to solve stratigraphical problems: An example from the Neoproterozoic Volta basin, Ghana | Request PDF - ResearchGate

S'ouvre dans une nouvelle fenêtre](https://www.researchgate.net/publication/232392367_Geochemistry_of_Precambrian_sedimentary_rocks_used_to_solve_stratigraphical_problems_An_example_from_the_Neoproterozoic_Volta_basin_Ghana)[

![](https://t0.gstatic.com/faviconV2?url=https://www.researchgate.net/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

researchgate.net

Sedimentology and chemostratigraphy of the Bwipe Neoproterozoic cap dolostones (Ghana, Volta Basin): A record of microbial activity in a peritidal environment | Request PDF - ResearchGate

S'ouvre dans une nouvelle fenêtre](https://www.researchgate.net/publication/228646710_Sedimentology_and_chemostratigraphy_of_the_Bwipe_Neoproterozoic_cap_dolostones_Ghana_Volta_Basin_A_record_of_microbial_activity_in_a_peritidal_environment)[

![](https://t2.gstatic.com/faviconV2?url=https://nora.nerc.ac.uk/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

nora.nerc.ac.uk

Ghana Airborne Geophysics Project in the Volta and Keta Basins: BGS Final Report - NERC Open Research Archive

S'ouvre dans une nouvelle fenêtre](https://nora.nerc.ac.uk/id/eprint/11395/1/CR09002N.pdf)[

![](https://t1.gstatic.com/faviconV2?url=https://www.mdpi.com/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

mdpi.com

Land Use Change and the Structural Diversity of Affem Boussou Community Forest in the Tchamba 1 Commune (Tchamba Prefecture, Togo) - MDPI

S'ouvre dans une nouvelle fenêtre](https://www.mdpi.com/2673-7159/3/3/24)[

![](https://t0.gstatic.com/faviconV2?url=https://horizon.documentation.ird.fr/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

horizon.documentation.ird.fr

Etudes pédologiques dans le Nord Togo : 1. Le secteur de modernisation de Toaga-Nassable. 2. Reconnaissance dans les cercles de - Horizon IRD

S'ouvre dans une nouvelle fenêtre](https://horizon.documentation.ird.fr/exl-doc/pleins_textes/divers15-09/12751.pdf)[

![](https://t0.gstatic.com/faviconV2?url=https://www.researchgate.net/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

researchgate.net

TOGO - ResearchGate

S'ouvre dans une nouvelle fenêtre](https://www.researchgate.net/profile/Robert_Cheke/publication/235340834_Togo_IBA/links/09e415111218fb6fb0000000/Togo-IBA.pdf)[

![](https://t3.gstatic.com/faviconV2?url=https://revues.cirad.fr/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

revues.cirad.fr

Impact de la sécheresse et de la dégradation des aires protégées sur la répartition des trypanosomoses bovines et de leurs vecteurs dans le bassin versant de l'Oti au nord du Togo

S'ouvre dans une nouvelle fenêtre](https://revues.cirad.fr/index.php/REMVT/article/download/9982/9976/0)[

![](https://t0.gstatic.com/faviconV2?url=https://www.mendeley.com/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

mendeley.com

The distribution of elephants in north-eastern Ghana and northern Togo - Mendeley

S'ouvre dans une nouvelle fenêtre](https://www.mendeley.com/catalogue/ec15282c-0383-3ae0-9209-cba734e0e817/)[

![](https://t2.gstatic.com/faviconV2?url=https://www.itto.int/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

itto.int

RAPPORT FINAL - ITTO

S'ouvre dans une nouvelle fenêtre](https://www.itto.int/files/itto_project_db_input/3220/technical/Etude-Jueidiquea.pdf?v=1709200722)[

![](https://t3.gstatic.com/faviconV2?url=https://aquadocs.org/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

aquadocs.org

A l'ouest du port de Lomt? - AquaDocs

S'ouvre dans une nouvelle fenêtre](https://aquadocs.org/bitstream/1834/2702/5/these11.pdf)[

![](https://t0.gstatic.com/faviconV2?url=https://www.researchgate.net/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

researchgate.net

Variabilité pluviométrique et dynamique hydro-sédimentaire du bassin-versant du complexe fluvio-lagunaire Mono-Ahémé-Couffo (Afrique de l'Ouest) - ResearchGate

S'ouvre dans une nouvelle fenêtre](https://www.researchgate.net/publication/44391575_Variabilite_pluviometrique_et_dynamique_hydro-sedimentaire_du_bassin-versant_du_complexe_fluvio-lagunaire_Mono-Aheme-Couffo_Afrique_de_l'Ouest)[

![](https://t0.gstatic.com/faviconV2?url=https://horizon.documentation.ird.fr/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

horizon.documentation.ird.fr

Contribution aux études pour la mise en valeur des régions sud et nord : recommandations - Horizon IRD

S'ouvre dans une nouvelle fenêtre](https://horizon.documentation.ird.fr/exl-doc/pleins_textes/divers15-07/29234.pdf)[

![](https://t0.gstatic.com/faviconV2?url=https://zenodo.org/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

zenodo.org

ISSN : 1840-9962 - Zenodo

S'ouvre dans une nouvelle fenêtre](https://zenodo.org/records/11613876/files/TAP%20HOUESSOU.pdf?download=1)[

![](https://t0.gstatic.com/faviconV2?url=https://horizon.documentation.ird.fr/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

horizon.documentation.ird.fr

La palmeraie du Mono : approche géographique - Horizon IRD

S'ouvre dans une nouvelle fenêtre](https://horizon.documentation.ird.fr/exl-doc/pleins_textes/pleins_textes_5/b_fdi_04-05/05863.pdf)[

![](https://t3.gstatic.com/faviconV2?url=https://aquadocs.org/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

aquadocs.org

les consequences des amenagements hydrauliques de la vallee du mono (togo-benin). saura-t - AquaDocs

S'ouvre dans une nouvelle fenêtre](https://aquadocs.org/bitstream/1834/1232/3/lesconseq.PDF)[

![](https://t1.gstatic.com/faviconV2?url=https://policycommons.net/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

policycommons.net

Sedimentological Evolution and Solid Matter Dynamics in the Fluvio-Lagoon System of Southwestern Benin | Policy Commons

S'ouvre dans une nouvelle fenêtre](https://policycommons.net/artifacts/15762271/evolution-sedimentologique-et-dynamique-des-charges-solides-dans-lhydrosysteme-fluvio-lagunaire-du-sud-ouest-du-benin/16653130/)[

![](https://t0.gstatic.com/faviconV2?url=https://horizon.documentation.ird.fr/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

horizon.documentation.ird.fr

Les principaux évènements géomorphologiques et les sols sur le socle granito-gneissique au Togo : note préliminaire - Horizon IRD

S'ouvre dans une nouvelle fenêtre](https://horizon.documentation.ird.fr/exl-doc/pleins_textes/divers16-01/13756.pdf)[

![](https://t0.gstatic.com/faviconV2?url=https://horizon.documentation.ird.fr/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

horizon.documentation.ird.fr

Reconnaissance agropédologique du périmètre de Galangachi : considérations générales sur l'économie agricole du Nord - Horizon IRD

S'ouvre dans une nouvelle fenêtre](https://horizon.documentation.ird.fr/exl-doc/pleins_textes/divers16-01/12750.pdf)[

![](https://t0.gstatic.com/faviconV2?url=https://horizon.documentation.ird.fr/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

horizon.documentation.ird.fr

Carte pédologique et carte des capacités agronomiques des sols à 1 : 100 000 : région de Bassar (Togo) - Horizon IRD

S'ouvre dans une nouvelle fenêtre](https://horizon.documentation.ird.fr/exl-doc/pleins_textes/pleins_textes_5/notexp/31639.pdf)[

![](https://t1.gstatic.com/faviconV2?url=https://revuegeographieouaga.com/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

revuegeographieouaga.com

SIGNATURES GEOMORPHOLOGIQUES DES FORMATIONS ALLUVIALES DE LA VALLEE DE L'OTI DANS LES ENVIRONS DE MANGO (NORD-TOGO) - Revue de géographie de l'université de Ouagadougou RGO-LUNGA

S'ouvre dans une nouvelle fenêtre](https://revuegeographieouaga.com/wp-content/uploads/2023/06/01_RGO_2017_191_VF.pdf)[

![](https://t1.gstatic.com/faviconV2?url=https://revuegeographieouaga.com/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

revuegeographieouaga.com

SIGNATURES GEOMORPHOLOGIQUES DES FORMATIONS ALLUVIALES DE LA VALLEE DE L'OTI DANS LES ENVIRONS DE MANGO (NORD-TOGO) - Revue de géographie de l'université de Ouagadougou RGO-LUNGA

S'ouvre dans une nouvelle fenêtre](https://revuegeographieouaga.com/wp-content/uploads/2020/09/RGO_2017_V2_GNONGBO.pdf)[

![](https://t2.gstatic.com/faviconV2?url=https://journals.openedition.org/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

journals.openedition.org

Analyse spatiale des différentes formes de pressions anthropiques dans la réserve de faune de l'Oti-Mandouri (Togo) - OpenEdition Journals

S'ouvre dans une nouvelle fenêtre](https://journals.openedition.org/vertigo/12423)[

![](https://t2.gstatic.com/faviconV2?url=https://www.africabib.org/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

africabib.org

Dynamique des activités anthropiques et impact sur la biodiversité dans la réserve de l'Oti-Mandouri: une adaptation aux changements climatique(s) - AfricaBib

S'ouvre dans une nouvelle fenêtre](https://www.africabib.org/rec.php?RID=369377133)[

![](https://t0.gstatic.com/faviconV2?url=https://www.researchgate.net/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

researchgate.net

Modélisation prospective des changements d'occupation des terres du parc Oti- Keran-Mandouri au nord-Togo - ResearchGate

S'ouvre dans une nouvelle fenêtre](https://www.researchgate.net/publication/397242731_Modelisation_prospective_des_changements_d'occupation_des_terres_du_parc_Oti-_Keran-Mandouri_au_nord-Togo)

[

![](https://www.gstatic.com/images/branding/productlogos/gmail_2020q4/v11/192px.svg)

Business Show Lomé : dans 5 jours

S'ouvre dans une nouvelle fenêtre](https://mail.google.com/mail/u/0/#all/FMfcgzQgMMKdrfXQjsGBMLfdJcTzBNfm)[

![](https://www.gstatic.com/images/branding/productlogos/gmail_2020q4/v11/192px.svg)

Fwd: Votre inscription à Business Show Lomé

S'ouvre dans une nouvelle fenêtre](https://mail.google.com/mail/u/0/#all/FMfcgzQgMCWFdfrsvGWQWrGzZpmJXnWT)[

![](https://www.gstatic.com/images/branding/productlogos/gmail_2020q4/v11/192px.svg)

Business Show Lomé : dans 5 jours

S'ouvre dans une nouvelle fenêtre](https://mail.google.com/mail/u/0/#all/FMfcgzQgMMKdrfXQhnhwBgBlgXxPZzDt)[

![](https://www.gstatic.com/images/branding/productlogos/gmail_2020q4/v11/192px.svg)

Astuce

S'ouvre dans une nouvelle fenêtre](https://mail.google.com/mail/u/0/#all/FMfcgzQgMMBbpTVFsZwZGlTphFFppbCP)[

![](https://www.gstatic.com/images/branding/productlogos/gmail_2020q4/v11/192px.svg)

Aucun événement planifié aujourd'hui.

S'ouvre dans une nouvelle fenêtre](https://mail.google.com/mail/u/0/#all/FMfcgzQgMMHMZzpvnwKNVFlDgHCTjSnC)[

![](https://t0.gstatic.com/faviconV2?url=https://lbev-univlome.com/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

lbev-univlome.com

Ibrahim-Naim et al. 2021 - LBEV

S'ouvre dans une nouvelle fenêtre](https://lbev-univlome.com/wp-content/uploads/2022/01/02-Ibrahim-et-al.-dec_2021.pdf)[

![](https://t1.gstatic.com/faviconV2?url=https://biblio.iita.org/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

biblio.iita.org

On-Farm Research

S'ouvre dans une nouvelle fenêtre](https://biblio.iita.org/documents/U86ManMutsaersFieldNothomDev.pdf-ae3160845597a4e3fa9ecf04195aa13b.pdf)[

![](https://t3.gstatic.com/faviconV2?url=https://cgspace.cgiar.org/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

cgspace.cgiar.org

On-Farm Research - CGSpace

S'ouvre dans une nouvelle fenêtre](https://cgspace.cgiar.org/server/api/core/bitstreams/390f0def-4d5f-4da7-b4dc-42b76783a712/content)[

![](https://t1.gstatic.com/faviconV2?url=https://orbi.uliege.be/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

orbi.uliege.be

Soil seed bank characteristics along a gradient of past human ... - ORBi

S'ouvre dans une nouvelle fenêtre](https://orbi.uliege.be/handle/2268/264346)[

![](https://t2.gstatic.com/faviconV2?url=https://documents1.worldbank.org/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

documents1.worldbank.org

file copy diffusion restreinte - World Bank Document

S'ouvre dans une nouvelle fenêtre](https://documents1.worldbank.org/curated/en/360291468334832634/pdf/AF650V30ESW0French0Box46549B0PUBLIC.pdf)[

![](https://t3.gstatic.com/faviconV2?url=https://www.takeyourbackpack.com/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

takeyourbackpack.com

Fosse aux Lions National Park Guide (Togo, 2026) - Take your Backpack

S'ouvre dans une nouvelle fenêtre](https://www.takeyourbackpack.com/backpacking-in-togo/visit-fosse-aux-lions-national-park/)[

![](https://t1.gstatic.com/faviconV2?url=https://pachydermjournal.org/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

pachydermjournal.org

THE DISTRIBUTION OF ELEPHANTS IN NORTH-EASTERN GHANA AND NORTHERN TOGO - Pachyderm

S'ouvre dans une nouvelle fenêtre](https://pachydermjournal.org/index.php/pachyderm/article/download/952/931)[

![](https://t2.gstatic.com/faviconV2?url=https://documents1.worldbank.org/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

documents1.worldbank.org

World Bank Document

S'ouvre dans une nouvelle fenêtre](https://documents1.worldbank.org/curated/en/641591468202136987/pdf/E21100EA0v20P010Box338920B01PUBLIC1.pdf)[

![](https://t3.gstatic.com/faviconV2?url=https://pubs.usgs.gov/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

pubs.usgs.gov

Compiled by Robert E. Mattick U.S. Geological Survey Open-Pile Report 7-2

S'ouvre dans une nouvelle fenêtre](https://pubs.usgs.gov/of/1982/0714/report.pdf)[

![](https://t2.gstatic.com/faviconV2?url=https://www.isprs.org/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

isprs.org

3:16.

S'ouvre dans une nouvelle fenêtre](https://www.isprs.org/proceedings/XXIII/congress/part7-8/316_XXIII-B7-8.pdf)[

![](https://t3.gstatic.com/faviconV2?url=https://www.govinfo.gov/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

govinfo.gov

Changing climate and the coast report of the Intergovernmental Panel on Climate Change from the Miami Conference on Adaptive Responses to Sea Level Rise and Other Impacts of Global Climate Change - GovInfo

S'ouvre dans une nouvelle fenêtre](https://www.govinfo.gov/content/pkg/CZIC-qc981-8-g56-m53-1989-v-2/html/CZIC-qc981-8-g56-m53-1989-v-2.htm)[

![](https://t0.gstatic.com/faviconV2?url=https://journals.co.za/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

journals.co.za

Stratigraphy and tectonic history of the Iullemmeden Basin in West Africa - Sabinet African Journals

S'ouvre dans une nouvelle fenêtre](https://journals.co.za/doi/pdf/10.10520/AJA10120750_591)[

![](https://t1.gstatic.com/faviconV2?url=https://riges-uao.net/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

riges-uao.net

Download pdf - Revue Ivoirienne de Géographie des Savanes

S'ouvre dans une nouvelle fenêtre](https://riges-uao.net/wp-content/uploads/journal/published_paper/volume-9/issue-1/xT9tKmxw.pdf)[

![](https://t3.gstatic.com/faviconV2?url=https://www.prestogo.org/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

prestogo.org

Caractérisation phytosociologique des zones humides de la plaine de l'Ogou Phytosociological characterization of the wetlands of the Ogou plain | Revue Ecosystèmes et Paysages - Plateforme des Revues Scientifiques du Togo (Prestogo)

S'ouvre dans une nouvelle fenêtre](https://www.prestogo.org/rst/index.php/rep/article/view/15?articlesBySimilarityPage=13)[

![](https://t0.gstatic.com/faviconV2?url=https://horizon.documentation.ird.fr/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

horizon.documentation.ird.fr

Contribution à l'étude des sols de la basse vallée du Mono - Horizon IRD

S'ouvre dans une nouvelle fenêtre](https://horizon.documentation.ird.fr/exl-doc/pleins_textes/divers16-02/15131.pdf)[

![](https://t1.gstatic.com/faviconV2?url=https://ajsonline.org/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

ajsonline.org

the tectono-stratigraphic relationships - American Journal of Science

S'ouvre dans une nouvelle fenêtre](https://ajsonline.org/article/60102-the-tectono-stratigraphic-relationships-between-the-upper-precambrian-and-lower-paleozoic-volta-basin-and-the-pan-african-dahomeyide-orogenic-belt-we.pdf)[

![](https://t0.gstatic.com/faviconV2?url=https://inis.iaea.org/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

inis.iaea.org

Uranium Deposits in Africa: Geology and Exploration - INIS-IAEA

S'ouvre dans une nouvelle fenêtre](https://inis.iaea.org/records/cnrjf-6jq59/files/12599259.pdf?download=1)[

![](https://t0.gstatic.com/faviconV2?url=https://www.iaea.org/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

iaea.org

LIPTAKO-GOURMA AND UPPER VOLTA SYSTEM - International Atomic Energy Agency

S'ouvre dans une nouvelle fenêtre](https://www.iaea.org/sites/default/files/raf7011_liptako-gourma_and_upper_volta_system.pdf)[

![](https://t2.gstatic.com/faviconV2?url=https://academicjournals.org/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

academicjournals.org

Journal of Geology and Mining Research - sedimentary facies and depositional environments of the neoproterozoic sediments of the gambaga-nakpanduri massifs, voltaian basin

S'ouvre dans une nouvelle fenêtre](https://academicjournals.org/journal/JGMR/article-full-text/4D0EF4857788)[

![](https://t0.gstatic.com/faviconV2?url=https://edepot.wur.nl/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

edepot.wur.nl

AU TOGO - WUR eDepot

S'ouvre dans une nouvelle fenêtre](https://edepot.wur.nl/487564)[

![](https://t0.gstatic.com/faviconV2?url=https://www.researchgate.net/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

researchgate.net

The geochronology of some Precambrian rocks of southern West Africa - ResearchGate

S'ouvre dans une nouvelle fenêtre](https://www.researchgate.net/publication/237169935_The_geochronology_of_some_Precambrian_rocks_of_southern_West_Africa)[

![](https://t2.gstatic.com/faviconV2?url=https://cdn.climatepolicyradar.org/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

cdn.climatepolicyradar.org

Page - Climate Policy Radar

S'ouvre dans une nouvelle fenêtre](https://cdn.climatepolicyradar.org/navigator/TGO/1999/national-environmental-action-plan_c7c2c9e4195907b48ec0927e4adb64e9.pdf)[

![](https://t2.gstatic.com/faviconV2?url=https://www.fnac.com/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

fnac.com

Agbetiko terroir de la basse vallée du Mono Sud-Togo - Benoît

S'ouvre dans une nouvelle fenêtre](https://www.fnac.com/a74046/Benoit-Antheaume-Agbetiko)[

![](https://t2.gstatic.com/faviconV2?url=https://www.memoireonline.com/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

memoireonline.com

Inondations dans la basse vallée du Mono: typologie et manifestations - Fernando Joseph G. GBEYETIN - Memoire Online

S'ouvre dans une nouvelle fenêtre](https://www.memoireonline.com/04/15/9012/Inondations-dans-la-basse-vallee-du-Mono-typologie-et-manifestations.html)[

![](https://t0.gstatic.com/faviconV2?url=https://www.researchgate.net/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

researchgate.net

Analyse fréquentielle et détermination des seuils pluvio-hydrologiques de risques d'inondation dans le bassin-versant de l'Oti au Togo - ResearchGate

S'ouvre dans une nouvelle fenêtre](https://www.researchgate.net/publication/363535702_Analyse_frequentielle_et_determination_des_seuils_pluvio-hydrologiques_de_risques_d'inondation_dans_le_bassin-versant_de_l'Oti_au_Togo)[

![](https://t0.gstatic.com/faviconV2?url=https://www.researchgate.net/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

researchgate.net

(PDF) Floristic diversity and assessment of the conservation status of Togo's plant species

S'ouvre dans une nouvelle fenêtre](https://www.researchgate.net/publication/394545330_Floristic_diversity_and_assessment_of_the_conservation_status_of_Togo's_plant_species)[

![](https://t0.gstatic.com/faviconV2?url=https://www.preprints.org/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

preprints.org

Land use change and structural diversity of Affem Boussou community forest in Tchamba 1 Commune (Tchamba Prefecture, Togo)

S'ouvre dans une nouvelle fenêtre](https://www.preprints.org/manuscript/202305.2075/v1/download)[

![](https://t2.gstatic.com/faviconV2?url=https://documents1.worldbank.org/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

documents1.worldbank.org

Appraisal of Maritime Region Rural Development Project Togo - Documents & Reports

S'ouvre dans une nouvelle fenêtre](https://documents1.worldbank.org/curated/en/571991468310495432/pdf/multi-page.pdf)[

![](https://t0.gstatic.com/faviconV2?url=https://journals.ametsoc.org/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

journals.ametsoc.org

Evaluation of Reanalysis Estimates of Precipitation, Radiation, and Temperature over Benin (West Africa) in - AMS Journals

S'ouvre dans une nouvelle fenêtre](https://journals.ametsoc.org/view/journals/apme/62/8/JAMC-D-21-0222.1.xml)[

![](https://t3.gstatic.com/faviconV2?url=https://www.scielo.org.ar/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

scielo.org.ar

Prospects for area-wide integrated control of tsetse flies (Diptera: Glossinidae) and trypanosomosis in sub-Saharan Africa - SciELO

S'ouvre dans une nouvelle fenêtre](https://www.scielo.org.ar/pdf/rsea/v65n1-2/v65n1-2a01.pdf)[

![](https://t2.gstatic.com/faviconV2?url=https://www.frontiersin.org/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

frontiersin.org

Assessing Flood Risk Dynamics in Data-Scarce Environments—Experiences From Combining Impact Chains With Bayesian Network Analysis in the Lower Mono River Basin, Benin - Frontiers

S'ouvre dans une nouvelle fenêtre](https://www.frontiersin.org/journals/water/articles/10.3389/frwa.2022.837688/full)[

![](https://t0.gstatic.com/faviconV2?url=https://www.researchgate.net/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

researchgate.net

(PDF) State of trace element contamination of sediments from the Nangbéto hydroelectric dam lake (Togo) - ResearchGate

S'ouvre dans une nouvelle fenêtre](https://www.researchgate.net/publication/356572126_State_of_trace_element_contamination_of_sediments_from_the_Nangbeto_hydroelectric_dam_lake_Togo)[

![](https://t1.gstatic.com/faviconV2?url=https://www.mdpi.com/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

mdpi.com

Assessment of Spatio-Temporal Changes of Land Use and Land Cover over South-Western African Basins and Their Relations with Variations of Discharges - MDPI

S'ouvre dans une nouvelle fenêtre](https://www.mdpi.com/2306-5338/5/4/56)[

![](https://t0.gstatic.com/faviconV2?url=https://horizon.documentation.ird.fr/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

horizon.documentation.ird.fr

Carte pédologique du Togo au 1/1.000.000 - Horizon IRD

S'ouvre dans une nouvelle fenêtre](https://horizon.documentation.ird.fr/exl-doc/pleins_textes/pleins_textes_5/notexp/13277.pdf)[

![](https://t0.gstatic.com/faviconV2?url=https://horizon.documentation.ird.fr/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

horizon.documentation.ird.fr

Agbetiko : terroir de la basse vallée du Mono (sud-Togo) - Horizon IRD

S'ouvre dans une nouvelle fenêtre](https://horizon.documentation.ird.fr/exl-doc/pleins_textes/divers12-09/09311.pdf)[

![](https://t0.gstatic.com/faviconV2?url=https://edepot.wur.nl/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

edepot.wur.nl

ÉTUDES PÉDOHYDROLOGIQUES - WUR eDepot

S'ouvre dans une nouvelle fenêtre](https://edepot.wur.nl/487565)[

![](https://t3.gstatic.com/faviconV2?url=https://smartiv.wordpress.com/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

smartiv.wordpress.com

CARTOGRAPHIE DES BAS-FONDS A L'AIDE DE LA TELEDETECTION ET DES DONNEES SECONDAIRES ET INTENSIFICATION CULTURALE AU TOGO - smartiv

S'ouvre dans une nouvelle fenêtre](https://smartiv.wordpress.com/wp-content/uploads/2012/10/andre-kindjinou-mapping-of-inland-valleys-in-togo.pdf)[

![](https://t0.gstatic.com/faviconV2?url=https://utoronto.scholaris.ca/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

utoronto.scholaris.ca

AGRICULTURE DE CONTRE SAISON SUR LES BERGES DE L'OTI

S'ouvre dans une nouvelle fenêtre](https://utoronto.scholaris.ca/bitstreams/6c923058-6c49-4f75-94ee-a24c6a3e19e9/download)[

![](https://t0.gstatic.com/faviconV2?url=https://anpctogo.tg/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

anpctogo.tg

COMMUNE OTI 1 - ANPC TOGO

S'ouvre dans une nouvelle fenêtre](https://anpctogo.tg/wp-content/uploads/2023/02/Plan-RRC-OTI-1.pdf)[

![](https://t2.gstatic.com/faviconV2?url=https://books.google.com/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

books.google.com

Agbétiko: terroir de la basse vallée du Mono (Sud-Togo) - Benoît

S'ouvre dans une nouvelle fenêtre](https://books.google.com/books/about/Agb%C3%A9tiko.html?id=QBj9rgt1us4C)[

![](https://t2.gstatic.com/faviconV2?url=https://en.wikipedia.org/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

en.wikipedia.org

Geography of Togo - Wikipedia

S'ouvre dans une nouvelle fenêtre](https://en.wikipedia.org/wiki/Geography_of_Togo)[

![](https://t0.gstatic.com/faviconV2?url=https://www.researchgate.net/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

researchgate.net

(PDF) Habitat biophysical and spatial patterns assessment within Oti-Keran-Mandouri protected area network in Togo - ResearchGate

S'ouvre dans une nouvelle fenêtre](https://www.researchgate.net/publication/324586565_Habitat_biophysical_and_spatial_patterns_assessment_within_Oti-Keran-Mandouri_protected_area_network_in_Togo)[

![](https://t1.gstatic.com/faviconV2?url=https://www.mdpi.com/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

mdpi.com

Assessment of Habitat Change Processes within the Oti-Keran-Mandouri Network of Protected Areas in Togo (West Africa) from 1987 to 2013 Using Decision Tree Analysis - MDPI

S'ouvre dans une nouvelle fenêtre](https://www.mdpi.com/2413-4155/2/1/1)[

![](https://t0.gstatic.com/faviconV2?url=https://www.thegef.org/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

thegef.org

Sustainable Management of Drylands in Northern Togo - GEF

S'ouvre dans une nouvelle fenêtre](https://www.thegef.org/sites/default/files/web-documents/10416_MFA_PIF.pdf)[

![](https://t1.gstatic.com/faviconV2?url=https://www.gov.il/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

gov.il

report of geological mission to togo, west africa - Gov.il

S'ouvre dans une nouvelle fenêtre](https://www.gov.il/BlobFolder/reports/reports-1991/he/report_1991_Bogoch-R-Report-Mission-Togo-West-Africa-GSI-13-1991.pdf)[

![](https://t2.gstatic.com/faviconV2?url=https://www.sifee.org/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

sifee.org

L'évaluation environnementale comme outil de prévention et de gestion des catastrophes au Togo : les réalisations et les dé

S'ouvre dans une nouvelle fenêtre](https://www.sifee.org/client_file/upload/Colloques%20documentation/2013%20Lom%C3%A9/SEBABE_TEXTE.pdf)

Initialisation de la recherche

J'entame une phase d'investigation approfondie pour clarifier la délimitation scientifique et les caractéristiques géotechniques des cinq zones prioritaires du Togo. En m'appuyant sur des bases de données académiques et cartographiques historiques, je cherche à consolider les contours géométriques de ces secteurs complexes pour l'Atlas Géotechnique.

Identification des zones d'ombre

Je me concentre sur la résolution de plusieurs incertitudes majeures : l'existence formelle et la nature de la dépression du Bado, la genèse géologique de la Fosse aux Lions dans l'extrême nord, ainsi que le tracé exact des limites alluviales des plaines du Mono et de l'Oti. L'enjeu est de remplacer les approximations actuelles par des données lithostratigraphiques et pédologiques rigoureuses.

Plan d'action et prochaines étapes

Je vais lancer une série de requêtes ciblées axées sur la littérature scientifique classique de l'ORSTOM, du BRGM et de la FAO, tout en recherchant des publications universitaires récentes. L'objectif immédiat est de collecter les coordonnées géographiques précises, les descriptions de sols (vertisols, argiles gonflantes) et les références cartographiques indispensables pour affiner notre grille de calcul.

![](https://www.gstatic.com/lamda/images/immersives/google_logo_icon_2380fba942c84387f09cf.svg)

Researching Workspace sources...

[![](https://www.gstatic.com/images/branding/productlogos/gmail_2020q4/v11/192px.svg)

Atlas Géotechnique — Votre mission de reconnaissance terrain

S'ouvre dans une nouvelle fenêtre](https://mail.google.com/mail/u/0/#all/FMfcgzQgMMHMkPXwhffPDdQhCNKmPHpj)[![](https://www.gstatic.com/images/branding/productlogos/gmail_2020q4/v11/192px.svg)

Business Show Lomé : dans 5 jours

S'ouvre dans une nouvelle fenêtre](https://mail.google.com/mail/u/0/#all/FMfcgzQgMMKdrfXQjsGBMLfdJcTzBNfm)[![](https://www.gstatic.com/images/branding/productlogos/gmail_2020q4/v11/192px.svg)

Fwd: Votre inscription à Business Show Lomé

S'ouvre dans une nouvelle fenêtre](https://mail.google.com/mail/u/0/#all/FMfcgzQgMCWFdfrsvGWQWrGzZpmJXnWT)[![](https://www.gstatic.com/images/branding/productlogos/gmail_2020q4/v11/192px.svg)

Business Show Lomé : dans 5 jours

S'ouvre dans une nouvelle fenêtre](https://mail.google.com/mail/u/0/#all/FMfcgzQgMMKdrfXQhnhwBgBlgXxPZzDt)[![](https://www.gstatic.com/images/branding/productlogos/gmail_2020q4/v11/192px.svg)

Astuce

S'ouvre dans une nouvelle fenêtre](https://mail.google.com/mail/u/0/#all/FMfcgzQgMMBbpTVFsZwZGlTphFFppbCP)[![](https://www.gstatic.com/images/branding/productlogos/gmail_2020q4/v11/192px.svg)

Aucun événement planifié aujourd'hui.

S'ouvre dans une nouvelle fenêtre](https://mail.google.com/mail/u/0/#all/FMfcgzQgMMHMZzpvnwKNVFlDgHCTjSnC)

![](https://www.gstatic.com/lamda/images/immersives/google_logo_icon_2380fba942c84387f09cf.svg)

Researching websites...

[![](https://t0.gstatic.com/faviconV2?url=https://horizon.documentation.ird.fr/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

horizon.documentation.ird.fr

Etude des sols de la dépression de la Lama et de ses bordures : Toffo-Séhoué-Agrimé : carte pédologique de reconnaissance a - Horizon IRD

](https://horizon.documentation.ird.fr/exl-doc/pleins_textes/divers16-02/11604.pdf)[![](https://t2.gstatic.com/faviconV2?url=https://tg.chm-cbd.net/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

tg.chm-cbd.net

MONOGRAPHIE VERSION FINALE 23 12 03 _photo_.pdf - Togo Biodiversity

](https://tg.chm-cbd.net/sites/tg/files/2023-07/MONOGRAPHIE%20VERSION%20FINALE%2023%2012%2003%20_photo_.pdf)[![](https://t0.gstatic.com/faviconV2?url=https://horizon.documentation.ird.fr/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

horizon.documentation.ird.fr

Carte pédologique du Togo au 1/1.000.000 - Horizon IRD

](https://horizon.documentation.ird.fr/exl-doc/pleins_textes/pleins_textes_5/notexp/13277.pdf)[![](https://t0.gstatic.com/faviconV2?url=https://horizon.documentation.ird.fr/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

horizon.documentation.ird.fr

L'aménagement et la mise en valeur des bassins de l'Oti et du Mono : présentation préliminaire - Horizon IRD

](https://horizon.documentation.ird.fr/exl-doc/pleins_textes/divers14-11/12293.pdf)[![](https://t0.gstatic.com/faviconV2?url=https://horizon.documentation.ird.fr/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

horizon.documentation.ird.fr

Etudes agropédologiques du bas-Togo : la dépression du Bado - Horizon IRD

](https://horizon.documentation.ird.fr/exl-doc/pleins_textes/divers16-01/15659.pdf)[![](https://t0.gstatic.com/faviconV2?url=https://horizon.documentation.ird.fr/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

horizon.documentation.ird.fr

Aménagements hydro-agricoles du Nord Togo : la Fosse aux Lions, campagne hydrologique 1959-1960-1961 - Horizon IRD

](https://horizon.documentation.ird.fr/exl-doc/pleins_textes/divers15-04/33094.pdf)[![](https://t3.gstatic.com/faviconV2?url=https://revues.cirad.fr/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

revues.cirad.fr

Impact de la sécheresse et de la dégradation des aires protégées sur la répartition des trypanosomoses bovines et de leurs vecteurs dans le bassin versant de l'Oti au nord du Togo

](https://revues.cirad.fr/index.php/REMVT/article/download/9982/9976/0)[![](https://t0.gstatic.com/faviconV2?url=https://horizon.documentation.ird.fr/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

horizon.documentation.ird.fr

Les sols à vocation rizicole du nord Togo : 2. La Fosse aux Lions - Horizon IRD

](https://horizon.documentation.ird.fr/exl-doc/pleins_textes/divers15-08/010025580.pdf)[![](https://t0.gstatic.com/faviconV2?url=https://horizon.documentation.ird.fr/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

horizon.documentation.ird.fr

Aménagements Hydroagricoles du Nord Togo. Première partie : la Fosse aux Lions, campagne hydrologique 1960 - Horizon IRD

](https://horizon.documentation.ird.fr/exl-doc/pleins_textes/divers16-07/33207.pdf)[![](https://t0.gstatic.com/faviconV2?url=https://horizon.documentation.ird.fr/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

horizon.documentation.ird.fr

Aménagement du bassin du Mono - Horizon IRD

](https://horizon.documentation.ird.fr/exl-doc/pleins_textes/divers13-10/33108.pdf)[![](https://t0.gstatic.com/faviconV2?url=https://horizon.documentation.ird.fr/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

horizon.documentation.ird.fr

Les principaux évènements géomorphologiques et les sols sur le socle granito-gneissique au Togo : note préliminaire - Horizon IRD

](https://horizon.documentation.ird.fr/exl-doc/pleins_textes/divers16-01/13756.pdf)[![](https://t1.gstatic.com/faviconV2?url=https://revuegeographieouaga.com/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

revuegeographieouaga.com

SIGNATURES GEOMORPHOLOGIQUES DES FORMATIONS ALLUVIALES DE LA VALLEE DE L'OTI DANS LES ENVIRONS DE MANGO (NORD-TOGO) - Revue de géographie de l'université de Ouagadougou RGO-LUNGA

](https://revuegeographieouaga.com/wp-content/uploads/2023/06/01_RGO_2017_191_VF.pdf)[![](https://t0.gstatic.com/faviconV2?url=https://anpctogo.tg/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

anpctogo.tg

COMMUNE OTI 1 - ANPC TOGO

](https://anpctogo.tg/wp-content/uploads/2023/02/Plan-RRC-OTI-1.pdf)

Premières découvertes et confirmations historiques

En analysant les archives de l'ORSTOM et de l'IRD, j'ai réalisé une avancée majeure en confirmant l'existence et la nature de la dépression du Bado. Les documents historiques révèlent qu'elle se situe dans la basse vallée du Mono, près de Tokpli, et qu'elle est caractérisée par des sols calcimorphes très argileux développés sur des marnes à attapulgite. De plus, j'ai identifié des coordonnées précises pour la Fosse aux Lions, située au pied des monts de Bombouaka entre 0° 10' et 0° 15' de longitude Est, et 10° 45' et 10° 48' de latitude Nord, ce qui va nous permettre de corriger radicalement l'emprise très approximative actuellement enregistrée.

Résolution des incertitudes sur la Lama et l'Oti

Je synthétise les données concernant la dépression de la Lama, décrite comme une pénéplaine ondulée orientée Sud-Ouest/Nord-Est séparant le plateau de Terre de Barre, avec des sols riches en argiles gonflantes. Concernant la plaine de l'Oti, les premiers éléments indiquent qu'elle est sculptée dans les schistes et pélites de Sansanné-Mango sous forme d'une gouttière très évasée à faible pente. Ces précisions lithologiques et géomorphologiques sont cruciales pour valider la transition entre les types d'argiles et le niveau de risque de retrait-gonflement associé.

Prochaines étapes de l'exploration

Je vais maintenant explorer en profondeur les documents techniques spécifiques identifiés, notamment les monographies pédologiques de la dépression du Bado et les rapports d'aménagements hydro-agricoles de la Fosse aux Lions. Cette lecture ciblée vise à extraire la composition minéralogique exacte (comme les proportions de smectite et de kaolinite) et à préciser les tracés des contours géologiques pour finaliser les fichiers géométriques du système.

![](https://www.gstatic.com/lamda/images/immersives/google_logo_icon_2380fba942c84387f09cf.svg)

Researching websites...

[![](https://t0.gstatic.com/faviconV2?url=https://horizon.documentation.ird.fr/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

horizon.documentation.ird.fr

Les sols à vocation rizicole du nord Togo : 2. La Fosse ... - Horizon IRD

](https://horizon.documentation.ird.fr/exl-doc/pleins_textes/divers15-08/010025580.pdf)[![](https://t0.gstatic.com/faviconV2?url=https://horizon.documentation.ird.fr/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

horizon.documentation.ird.fr

Aménagements hydro-agricoles du Nord Togo : la ... - Horizon IRD

](https://horizon.documentation.ird.fr/exl-doc/pleins_textes/divers15-04/33094.pdf)[![](https://t0.gstatic.com/faviconV2?url=https://horizon.documentation.ird.fr/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

horizon.documentation.ird.fr

Etudes agropédologiques du bas-Togo : la ... - Horizon IRD

](https://horizon.documentation.ird.fr/exl-doc/pleins_textes/divers16-01/15659.pdf)[![](https://t1.gstatic.com/faviconV2?url=https://biblio.iita.org/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

biblio.iita.org

On-Farm Research

](https://biblio.iita.org/documents/U86ManMutsaersFieldNothomDev.pdf-ae3160845597a4e3fa9ecf04195aa13b.pdf)[![](https://t3.gstatic.com/faviconV2?url=https://cgspace.cgiar.org/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

cgspace.cgiar.org

On-Farm Research - CGSpace

](https://cgspace.cgiar.org/server/api/core/bitstreams/390f0def-4d5f-4da7-b4dc-42b76783a712/content)[![](https://t0.gstatic.com/faviconV2?url=https://horizon.documentation.ird.fr/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

horizon.documentation.ird.fr

Contribution aux études pour la mise en valeur des régions sud et nord : recommandations - Horizon IRD

](https://horizon.documentation.ird.fr/exl-doc/pleins_textes/divers15-07/29234.pdf)[![](https://t0.gstatic.com/faviconV2?url=https://horizon.documentation.ird.fr/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

horizon.documentation.ird.fr

Aménagement du bassin du Mono - Horizon IRD

](https://horizon.documentation.ird.fr/exl-doc/pleins_textes/divers13-10/33108.pdf)[![](https://t0.gstatic.com/faviconV2?url=https://lbev-univlome.com/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

lbev-univlome.com

Ibrahim-Naim et al. 2021 - LBEV

](https://lbev-univlome.com/wp-content/uploads/2022/01/02-Ibrahim-et-al.-dec_2021.pdf)[![](https://t0.gstatic.com/faviconV2?url=https://horizon.documentation.ird.fr/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

horizon.documentation.ird.fr

Les principaux évènements géomorphologiques et les sols sur le socle granito-gneissique au Togo : note préliminaire - Horizon IRD

](https://horizon.documentation.ird.fr/exl-doc/pleins_textes/divers16-01/13756.pdf)

Structure et minéralogie de la Lama et du Bado

En analysant en profondeur les archives pédologiques, j'ai mis en évidence que la dépression du Bado constitue en réalité la subdivision orientale de la vaste dépression de la Lama au Togo, couvrant environ 7 000 hectares sur un total de 23 000 hectares pour l'ensemble du secteur de la Lama togolaise. Les rapports techniques révèlent une signature minéralogique remarquable : au-delà de la montmorillonite attendue, les sols noirs et bruns de cette dépression se développent sur des marnes riches en palygorskite (attapulgite) avec des bancs de calcaires conglomératiques, expliquant la forte capacité d'échange cationique observée.

Précisions géomorphologiques sur le Nord

Mes investigations sur la Fosse aux Lions confirment qu'il s'agit d'une cuvette topographique bien délimitée au pied de la falaise des monts de Bombouaka, drainée par les rivières Koulougona et Koumfab. Son substratum géologique associe des granites calco-alcalins au nord et des formations sédimentaires du Voltaïen (schistes et grès du Cambrien/Ordovicien) au sud, générant un contraste pédologique net avec près de 700 à 800 hectares d'argiles de cuvette hautement plastiques au centre de la dépression.

Orientation des futures requêtes et modélisation

Je vais désormais concentrer mes efforts sur l'extraction des limites géographiques et administratives précises des plaines alluviales du Mono et de l'Oti. L'objectif est d'identifier l'extension exacte des alluvions récentes de l'Holocène par rapport aux terrasses plus anciennes du Pléistocène, et de caractériser la transition minéralogique le long du bassin de l'Oti pour affiner notre maillage géotechnique.

![](https://www.gstatic.com/lamda/images/immersives/google_logo_icon_2380fba942c84387f09cf.svg)

Researching websites...

[![](https://t1.gstatic.com/faviconV2?url=https://biblio.iita.org/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

biblio.iita.org

On-Farm Research

](https://biblio.iita.org/documents/U86ManMutsaersFieldNothomDev.pdf-ae3160845597a4e3fa9ecf04195aa13b.pdf)[![](https://t3.gstatic.com/faviconV2?url=https://cgspace.cgiar.org/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

cgspace.cgiar.org

On-Farm Research - CGSpace

](https://cgspace.cgiar.org/server/api/core/bitstreams/390f0def-4d5f-4da7-b4dc-42b76783a712/content)[![](https://t1.gstatic.com/faviconV2?url=https://orbi.uliege.be/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

orbi.uliege.be

Soil seed bank characteristics along a gradient of past human ... - ORBi

](https://orbi.uliege.be/handle/2268/264346)[![](https://t0.gstatic.com/faviconV2?url=https://horizon.documentation.ird.fr/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

horizon.documentation.ird.fr

Aménagement du bassin du Mono - Horizon IRD

](https://horizon.documentation.ird.fr/exl-doc/pleins_textes/divers13-10/33108.pdf)[![](https://t2.gstatic.com/faviconV2?url=https://documents1.worldbank.org/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

documents1.worldbank.org

file copy diffusion restreinte - World Bank Document

](https://documents1.worldbank.org/curated/en/360291468334832634/pdf/AF650V30ESW0French0Box46549B0PUBLIC.pdf)[![](https://t0.gstatic.com/faviconV2?url=https://zenodo.org/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

zenodo.org

ISSN : 1840-9962 - Zenodo

](https://zenodo.org/records/11613876/files/TAP%20HOUESSOU.pdf?download=1)[![](https://t2.gstatic.com/faviconV2?url=https://www.itto.int/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

itto.int

RAPPORT FINAL - ITTO

](https://www.itto.int/files/itto_project_db_input/3220/technical/Etude-Jueidiquea.pdf?v=1709200722)[![](https://t3.gstatic.com/faviconV2?url=https://aquadocs.org/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

aquadocs.org

A l'ouest du port de Lomt? - AquaDocs

](https://aquadocs.org/bitstream/1834/2702/5/these11.pdf)[![](https://t2.gstatic.com/faviconV2?url=https://journals.openedition.org/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

journals.openedition.org

Analyse spatiale des différentes formes de pressions anthropiques dans la réserve de faune de l'Oti-Mandouri (Togo) - OpenEdition Journals

](https://journals.openedition.org/vertigo/12423)[![](https://t2.gstatic.com/faviconV2?url=https://www.africabib.org/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

africabib.org

Dynamique des activités anthropiques et impact sur la biodiversité dans la réserve de l'Oti-Mandouri: une adaptation aux changements climatique(s) - AfricaBib

](https://www.africabib.org/rec.php?RID=369377133)[![](https://t3.gstatic.com/faviconV2?url=https://govolunteerafrica.org/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

govolunteerafrica.org

The Three National Parks of Togo - Go Volunteer Africa

](https://govolunteerafrica.org/the-three-national-parks-of-togo/)[![](https://t2.gstatic.com/faviconV2?url=https://en.wikipedia.org/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

en.wikipedia.org

Fosse aux Lions National Park - Wikipedia

](https://en.wikipedia.org/wiki/Fosse_aux_Lions_National_Park)[![](https://t3.gstatic.com/faviconV2?url=https://www.takeyourbackpack.com/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

takeyourbackpack.com

Fosse aux Lions National Park Guide (Togo, 2026) - Take your Backpack

](https://www.takeyourbackpack.com/backpacking-in-togo/visit-fosse-aux-lions-national-park/)[![](https://t1.gstatic.com/faviconV2?url=https://pachydermjournal.org/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

pachydermjournal.org

THE DISTRIBUTION OF ELEPHANTS IN NORTH-EASTERN GHANA AND NORTHERN TOGO - Pachyderm

](https://pachydermjournal.org/index.php/pachyderm/article/download/952/931)[![](https://t0.gstatic.com/faviconV2?url=https://www.mendeley.com/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

mendeley.com

The distribution of elephants in north-eastern Ghana and northern Togo - Mendeley

](https://www.mendeley.com/catalogue/ec15282c-0383-3ae0-9209-cba734e0e817/)

Unification de la dépression de la Lama

En analysant les interconnexions physiques du Bas-Togo, j'ai établi que la dépression du Bado n'est pas une entité isolée, mais bien le prolongement oriental direct de la dépression de la Lama vers la vallée du Mono. Ce couloir d'argiles noires s'étire sur 35 km d'ouest en est, enserré de manière très étroite (6 à 7 km de large) entre les hauts plateaux de Terre de Barre de Tabligbo au nord et d'Anécho au sud. Cette continuité géomorphologique clarifie la transition des sols gonflants à l'échelle régionale.

Subdivision interne et signature sédimentaire

Je structure désormais la Lama togolaise en trois compartiments distincts : le secteur ouest d'Animabio-Kovéto, la zone centrale de Dagbati-Vo-Asso, et enfin le secteur est du Bado (7 000 ha). L'analyse sédimentaire met en évidence une transition lithologique majeure : les argiles gonflantes montmorillonitiques de l'ouest s'associent, dans le secteur du Bado, à des marnes riches en palygorskite (attapulgite) et à des bancs calcaro-phosphatés, modifiant localement la réponse géotechnique des sols.

Précision des limites hydrauliques de l'Oti et du Mono

Je concentre mes prochaines étapes sur la séparation spatiale rigoureuse entre les alluvions modernes inondables (Holocène) et les terrasses anciennes consolidées (Pléistocène) le long des fleuves Mono et Oti. Je vais analyser l'impact du barrage de Nangbéto sur les dynamiques de sédimentation argileuse en aval et caractériser la dominance de la kaolinite dans la cuvette de l'Oti afin de délimiter précisément l'emprise des mailles à risque modéré.

![](https://www.gstatic.com/lamda/images/immersives/google_logo_icon_2380fba942c84387f09cf.svg)

Researching websites...

[![](https://t0.gstatic.com/faviconV2?url=https://edepot.wur.nl/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

edepot.wur.nl

ÉTUDES PÉDOHYDROLOGIQUES - WUR eDepot

](https://edepot.wur.nl/487565)[![](https://t0.gstatic.com/faviconV2?url=https://horizon.documentation.ird.fr/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

horizon.documentation.ird.fr

Carte pédologique du Togo au 1/1.000.000 - Horizon IRD

](https://horizon.documentation.ird.fr/exl-doc/pleins_textes/pleins_textes_5/notexp/13277.pdf)[![](https://t2.gstatic.com/faviconV2?url=https://documents1.worldbank.org/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

documents1.worldbank.org

World Bank Document

](https://documents1.worldbank.org/curated/en/641591468202136987/pdf/E21100EA0v20P010Box338920B01PUBLIC1.pdf)[![](https://t3.gstatic.com/faviconV2?url=https://pubs.usgs.gov/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

pubs.usgs.gov

Compiled by Robert E. Mattick U.S. Geological Survey Open-Pile Report 7-2

](https://pubs.usgs.gov/of/1982/0714/report.pdf)[![](https://t2.gstatic.com/faviconV2?url=https://www.isprs.org/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

isprs.org

3:16.

](https://www.isprs.org/proceedings/XXIII/congress/part7-8/316_XXIII-B7-8.pdf)[![](https://t3.gstatic.com/faviconV2?url=https://www.govinfo.gov/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

govinfo.gov

Changing climate and the coast report of the Intergovernmental Panel on Climate Change from the Miami Conference on Adaptive Responses to Sea Level Rise and Other Impacts of Global Climate Change - GovInfo

](https://www.govinfo.gov/content/pkg/CZIC-qc981-8-g56-m53-1989-v-2/html/CZIC-qc981-8-g56-m53-1989-v-2.htm)[![](https://t1.gstatic.com/faviconV2?url=https://www.gov.il/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

gov.il

report of geological mission to togo, west africa - Gov.il

](https://www.gov.il/BlobFolder/reports/reports-1991/he/report_1991_Bogoch-R-Report-Mission-Togo-West-Africa-GSI-13-1991.pdf)[![](https://t0.gstatic.com/faviconV2?url=https://journals.co.za/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

journals.co.za

Stratigraphy and tectonic history of the Iullemmeden Basin in West Africa - Sabinet African Journals

](https://journals.co.za/doi/pdf/10.10520/AJA10120750_591)[![](https://t0.gstatic.com/faviconV2?url=https://zenodo.org/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

zenodo.org

ISSN : 1840-9962 - Zenodo

](https://zenodo.org/records/11613876/files/TAP%20HOUESSOU.pdf?download=1)[![](https://t0.gstatic.com/faviconV2?url=https://horizon.documentation.ird.fr/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

horizon.documentation.ird.fr

Aménagement du bassin du Mono - Horizon IRD

](https://horizon.documentation.ird.fr/exl-doc/pleins_textes/divers13-10/33108.pdf)[![](https://t1.gstatic.com/faviconV2?url=https://riges-uao.net/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

riges-uao.net

Download pdf - Revue Ivoirienne de Géographie des Savanes

](https://riges-uao.net/wp-content/uploads/journal/published_paper/volume-9/issue-1/xT9tKmxw.pdf)[![](https://t3.gstatic.com/faviconV2?url=https://www.prestogo.org/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

prestogo.org

Caractérisation phytosociologique des zones humides de la plaine de l'Ogou Phytosociological characterization of the wetlands of the Ogou plain | Revue Ecosystèmes et Paysages - Plateforme des Revues Scientifiques du Togo (Prestogo)

](https://www.prestogo.org/rst/index.php/rep/article/view/15?articlesBySimilarityPage=13)[![](https://t0.gstatic.com/faviconV2?url=https://www.researchgate.net/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

researchgate.net

Analyse fréquentielle et détermination des seuils pluvio-hydrologiques de risques d'inondation dans le bassin-versant de l'Oti au Togo - ResearchGate

](https://www.researchgate.net/publication/363535702_Analyse_frequentielle_et_determination_des_seuils_pluvio-hydrologiques_de_risques_d'inondation_dans_le_bassin-versant_de_l'Oti_au_Togo)[![](https://t2.gstatic.com/faviconV2?url=https://journals.openedition.org/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

journals.openedition.org

Analyse spatiale des différentes formes de pressions anthropiques dans la réserve de faune de l'Oti-Mandouri (Togo) - OpenEdition Journals

](https://journals.openedition.org/vertigo/12423)[![](https://t0.gstatic.com/faviconV2?url=https://horizon.documentation.ird.fr/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

horizon.documentation.ird.fr

Reconnaissance agropédologique du périmètre de Galangachi : considérations générales sur l'économie agricole du Nord - Horizon IRD

](https://horizon.documentation.ird.fr/exl-doc/pleins_textes/divers16-01/12750.pdf)[![](https://t0.gstatic.com/faviconV2?url=https://horizon.documentation.ird.fr/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

horizon.documentation.ird.fr

Aménagements hydro-agricoles du Nord Togo : la Fosse aux Lions, campagne hydrologique 1959-1960-1961 - Horizon IRD

](https://horizon.documentation.ird.fr/exl-doc/pleins_textes/divers15-04/33094.pdf)

Cartographie physique de la dépression de la Lama

En analysant les limites géographiques de la dépression de la Lama, j'ai identifié ses frontières naturelles : elle est ceinturée au nord par le plateau de Tabligbo et au sud par le plateau d'Anécho. Ce corridor sédimentaire s'étire d'ouest en est depuis la vallée du Zio et de la rivière Raho près de Tsévié jusqu'au fleuve Mono, qui matérialise la frontière avec le Bénin. Les données de terrain confirment que la dépression du Bado en constitue la terminaison orientale directe, couvrant environ 70 km² sur les 230 km² de l'ensemble du complexe argileux de la Lama togolaise, caractérisé par une épaisseur d'argile marneuse noire hautement plastique pouvant dépasser une dizaine de mètres.

Substratum et dynamique de la plaine du Mono

J'ai synthétisé les données relatives à la plaine alluviale du Mono en aval de Tokpli et d'Agbanakè. Les alluvions récentes de l'Holocène, riches en limons et argiles gonflantes de type smectite, se distinguent nettement des terrasses sableuses plus anciennes du Pléistocène. L'impact sédimentaire du barrage de Nangbéto, mis en service en 1987, est désormais documenté : le piégeage des sédiments dans le réservoir a drastiquement réduit les apports alluviaux frais en aval, modifiant la dynamique de dépôt des argiles dans les zones d'inondation de la plaine inférieure et accentuant l'érosion côtière au niveau de l'embouchure.

Spécificités de la Fosse aux Lions et de l'Oti

Dans l'extrême nord, j'ai délimité précisément la Fosse aux Lions au pied de la falaise de Bombouaka. Cette cuvette topographique de 16,5 km² est entaillée dans les schistes tendres de l'Oti et s'associe à des sols de cuvette argilo-limoneux très denses. Plus au sud, la plaine de l'Oti se déploie autour de Mango dans une vaste dépression façonnée sur les schistes de Sansanné-Mango. Contrairement au sud du pays, la fraction argileuse y est dominée par la kaolinite sur les terrasses et les sols de glacis, bien que des poches de smectite subsistent dans les dépressions hydromorphes inondables de la réserve de faune de l'Oti-Mandouri.

Actions de modélisation et de validation

Je vais maintenant procéder à la conversion de ces limites géographiques, lithologiques et hydrologiques en coordonnées géométriques exploitables pour notre grille. Je vais traduire ces contours sous forme de polygones précis pour calculer les taux d'intersection de nos mailles de calcul et identifier les zones d'échantillonnage prioritaires pour les campagnes géotechniques de terrain.

![](https://www.gstatic.com/lamda/images/immersives/google_logo_icon_2380fba942c84387f09cf.svg)

Researching websites...

[![](https://t0.gstatic.com/faviconV2?url=https://zenodo.org/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

zenodo.org

ISSN : 1840-9962 - Zenodo

](https://zenodo.org/records/11613876/files/TAP%20HOUESSOU.pdf?download=1)[![](https://t3.gstatic.com/faviconV2?url=https://www.afes.fr/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

afes.fr

Estimation des stocks de carbone des sols du Bénin - AFES

](https://www.afes.fr/wp-content/uploads/2023/04/EGS_6_2_VOLKOFF.pdf)[![](https://t0.gstatic.com/faviconV2?url=https://horizon.documentation.ird.fr/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

horizon.documentation.ird.fr

Contribution à l'étude des sols de la basse vallée du Mono - Horizon IRD

](https://horizon.documentation.ird.fr/exl-doc/pleins_textes/divers16-02/15131.pdf)[![](https://t0.gstatic.com/faviconV2?url=https://horizon.documentation.ird.fr/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

horizon.documentation.ird.fr

Les principaux évènements géomorphologiques et les sols sur le socle granito-gneissique au Togo : note préliminaire - Horizon IRD

](https://horizon.documentation.ird.fr/exl-doc/pleins_textes/divers16-01/13756.pdf)[![](https://t1.gstatic.com/faviconV2?url=https://revuegeographieouaga.com/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

revuegeographieouaga.com

SIGNATURES GEOMORPHOLOGIQUES DES FORMATIONS ALLUVIALES DE LA VALLEE DE L'OTI DANS LES ENVIRONS DE MANGO (NORD-TOGO) - Revue de géographie de l'université de Ouagadougou RGO-LUNGA

](https://revuegeographieouaga.com/wp-content/uploads/2020/09/RGO_2017_V2_GNONGBO.pdf)[![](https://t3.gstatic.com/faviconV2?url=https://journal-backups.lon1.digitaloceanspaces.com/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

journal-backups.lon1.digitaloceanspaces.com

Hydrogeochemical characterization of the coastal Paleocene aquifer of Togo (West Africa) - DigitalOcean

](https://journal-backups.lon1.digitaloceanspaces.com/uploads/main/article/article1379431305_Gnazou%20et%20al.pdf)[![](https://t1.gstatic.com/faviconV2?url=https://ajsonline.org/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

ajsonline.org

the tectono-stratigraphic relationships - American Journal of Science

](https://ajsonline.org/article/60102-the-tectono-stratigraphic-relationships-between-the-upper-precambrian-and-lower-paleozoic-volta-basin-and-the-pan-african-dahomeyide-orogenic-belt-we.pdf)[![](https://t2.gstatic.com/faviconV2?url=https://www.memoireonline.com/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

memoireonline.com

Silting of Togo inshore sedimentary basin rivers and protection measures: Case of Zio river - Akintola S. Nelson AKIBODE - Memoire Online

](https://www.memoireonline.com/08/08/1474/silting-togo-inshore-sedimentary-basin-rivers-protection-measures-zio-river.html)[![](https://t1.gstatic.com/faviconV2?url=https://www.gov.il/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

gov.il

report of geological mission to togo, west africa - Gov.il

](https://www.gov.il/BlobFolder/reports/reports-1991/he/report_1991_Bogoch-R-Report-Mission-Togo-West-Africa-GSI-13-1991.pdf)[![](https://t0.gstatic.com/faviconV2?url=https://inis.iaea.org/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

inis.iaea.org

Uranium Deposits in Africa: Geology and Exploration - INIS-IAEA

](https://inis.iaea.org/records/cnrjf-6jq59/files/12599259.pdf?download=1)[![](https://t0.gstatic.com/faviconV2?url=https://www.iaea.org/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

iaea.org

LIPTAKO-GOURMA AND UPPER VOLTA SYSTEM - International Atomic Energy Agency

](https://www.iaea.org/sites/default/files/raf7011_liptako-gourma_and_upper_volta_system.pdf)[![](https://t0.gstatic.com/faviconV2?url=https://www.researchgate.net/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

researchgate.net

Geochemistry of Precambrian sedimentary rocks used to solve stratigraphical problems: An example from the Neoproterozoic Volta basin, Ghana | Request PDF - ResearchGate

](https://www.researchgate.net/publication/232392367_Geochemistry_of_Precambrian_sedimentary_rocks_used_to_solve_stratigraphical_problems_An_example_from_the_Neoproterozoic_Volta_basin_Ghana)[![](https://t2.gstatic.com/faviconV2?url=https://nora.nerc.ac.uk/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

nora.nerc.ac.uk

Ghana Airborne Geophysics Project in the Volta and Keta Basins: BGS Final Report - NERC Open Research Archive

](https://nora.nerc.ac.uk/id/eprint/11395/1/CR09002N.pdf)[![](https://t2.gstatic.com/faviconV2?url=https://academicjournals.org/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

academicjournals.org

Journal of Geology and Mining Research - sedimentary facies and depositional environments of the neoproterozoic sediments of the gambaga-nakpanduri massifs, voltaian basin

](https://academicjournals.org/journal/JGMR/article-full-text/4D0EF4857788)

Modélisation géométrique des enveloppes sédimentaires

En croisant les limites lithostratigraphiques issues des travaux de l'ORSTOM et les données topographiques d'altitude, j'ai converti les descriptions géomorphologiques de la dépression de la Lama et du Bado en coordonnées de contours exploitables. La transition abrupte de pente (passant de 5 % sur les bordures du plateau de Terre de Barre à moins de 0,5 % au cœur de la goulotte argileuse) me permet de tracer une enveloppe physique rigoureuse pour les sols de classe de risque très fort.

Résolution des incertitudes géologiques du Nord

J'ai levé une ambiguïté majeure concernant la Fosse aux Lions : les données hydrologiques et sédimentologiques confirment que cette cuvette est structurellement liée à la formation de Poubougou (groupe de Bombouaka). Son aménagement hydro-agricole historique montre que sur les 800 hectares du périmètre, seuls 700 hectares correspondent à des argiles de cuvette hyper-plastiques à fort potentiel de gonflement, le reste étant constitué de colluvions sableuses exondées à risque nul, ce qui va me permettre d'ajuster finement l'emprise de nos mailles de calcul.

Prochaines étapes de numérisation et de validation

Je vais à présent finaliser la transcription de ces contours géographiques en polygones vectoriels précis au format WKT. J'estimerai ensuite les taux d'intersection de chaque maille de notre grille avec ces limites validées afin de hiérarchiser les priorités d'investigation géotechnique sur le terrain.

![](https://www.gstatic.com/lamda/images/immersives/google_logo_icon_2380fba942c84387f09cf.svg)

Researching websites...

[![](https://t0.gstatic.com/faviconV2?url=https://www.inter-reseaux.org/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

inter-reseaux.org

Background Papers

](https://www.inter-reseaux.org/wp-content/uploads/02_Van_Kauwenbergh-Fertilizer_Raw_Material_Resources.pdf)[![](https://t0.gstatic.com/faviconV2?url=https://www.documentation.ird.fr/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

documentation.ird.fr

Notes préliminaires à l'étude agropédologique de la dépression de la Lama (notes techniques)- fdi:12749- Horizon - IRD

](https://www.documentation.ird.fr/hor/fdi:12749)[![](https://t0.gstatic.com/faviconV2?url=https://horizon.documentation.ird.fr/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

horizon.documentation.ird.fr

Carte pédologique du Togo au 1/1.000.000 - Horizon IRD

](https://horizon.documentation.ird.fr/exl-doc/pleins_textes/pleins_textes_5/notexp/13277.pdf)[![](https://t0.gstatic.com/faviconV2?url=https://edepot.wur.nl/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

edepot.wur.nl

ÉTUDES PÉDOHYDROLOGIQUES - WUR eDepot

](https://edepot.wur.nl/487565)[![](https://t0.gstatic.com/faviconV2?url=https://edepot.wur.nl/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

edepot.wur.nl

AU TOGO - WUR eDepot

](https://edepot.wur.nl/487564)[![](https://t0.gstatic.com/faviconV2?url=https://www.researchgate.net/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

researchgate.net

Sedimentology and chemostratigraphy of the Bwipe Neoproterozoic cap dolostones (Ghana, Volta Basin): A record of microbial activity in a peritidal environment | Request PDF - ResearchGate

](https://www.researchgate.net/publication/228646710_Sedimentology_and_chemostratigraphy_of_the_Bwipe_Neoproterozoic_cap_dolostones_Ghana_Volta_Basin_A_record_of_microbial_activity_in_a_peritidal_environment)[![](https://t0.gstatic.com/faviconV2?url=https://www.researchgate.net/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

researchgate.net

Geochemistry of Precambrian sedimentary rocks used to solve stratigraphical problems: An example from the Neoproterozoic Volta basin, Ghana | Request PDF - ResearchGate

](https://www.researchgate.net/publication/232392367_Geochemistry_of_Precambrian_sedimentary_rocks_used_to_solve_stratigraphical_problems_An_example_from_the_Neoproterozoic_Volta_basin_Ghana)[![](https://t0.gstatic.com/faviconV2?url=https://www.researchgate.net/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

researchgate.net

The geochronology of some Precambrian rocks of southern West Africa - ResearchGate

](https://www.researchgate.net/publication/237169935_The_geochronology_of_some_Precambrian_rocks_of_southern_West_Africa)[![](https://t2.gstatic.com/faviconV2?url=https://nora.nerc.ac.uk/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

nora.nerc.ac.uk

Ghana Airborne Geophysics Project in the Volta and Keta Basins: BGS Final Report - NERC Open Research Archive

](https://nora.nerc.ac.uk/id/eprint/11395/1/CR09002N.pdf)[![](https://t2.gstatic.com/faviconV2?url=https://cdn.climatepolicyradar.org/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

cdn.climatepolicyradar.org

Page - Climate Policy Radar

](https://cdn.climatepolicyradar.org/navigator/TGO/1999/national-environmental-action-plan_c7c2c9e4195907b48ec0927e4adb64e9.pdf)[![](https://t1.gstatic.com/faviconV2?url=https://revuegeographieouaga.com/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

revuegeographieouaga.com

SIGNATURES GEOMORPHOLOGIQUES DES FORMATIONS ALLUVIALES DE LA VALLEE DE L'OTI DANS LES ENVIRONS DE MANGO (NORD-TOGO) - Revue de géographie de l'université de Ouagadougou RGO-LUNGA

](https://revuegeographieouaga.com/wp-content/uploads/2023/06/01_RGO_2017_191_VF.pdf)[![](https://t0.gstatic.com/faviconV2?url=https://horizon.documentation.ird.fr/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

horizon.documentation.ird.fr

Les principaux évènements géomorphologiques et les sols sur le socle granito-gneissique au Togo : note préliminaire - Horizon IRD

](https://horizon.documentation.ird.fr/exl-doc/pleins_textes/divers16-01/13756.pdf)

Unification de la Lama et du Bado dans l'espace

En analysant les interconnexions physiques du Bas-Togo, j'ai établi que la dépression du Bado n'est pas une entité isolée, mais bien le prolongement oriental direct de la dépression de la Lama vers la vallée du Mono. Ce couloir d'argiles noires s'étire sur 35 km d'ouest en est, enserré de manière très étroite (6 à 7 km de large) entre les hauts plateaux de Terre de Barre de Tabligbo au nord et d'Anécho au sud. Cette continuité géomorphologique clarifie la transition des sols gonflants à l'échelle régionale.

Subdivision interne et signature sédimentaire

Je structure désormais la Lama togolaise en trois compartiments distincts : le secteur ouest d'Animabio-Kovéto, la zone centrale de Dagbati-Vo-Asso, et enfin le secteur est du Bado (7 000 ha). L'analyse sédimentaire met en évidence une transition lithologique majeure : les argiles gonflantes montmorillonitiques de l'ouest s'associent, dans le secteur du Bado, à des marnes riches en palygorskite (attapulgite) et à des bancs calcaro-phosphatés, modifiant localement la réponse géotechnique des sols.

Précision des limites hydrauliques de l'Oti et du Mono

Je concentre mes prochaines étapes sur la séparation spatiale rigoureuse entre les alluvions modernes inondables (Holocène) et les terrasses anciennes consolidées (Pléistocène) le long des fleuves Mono et Oti. Je vais analyser l'impact du barrage de Nangbéto sur les dynamiques de sédimentation argileuse en aval et caractériser la dominance de la kaolinite dans la cuvette de l'Oti afin de délimiter précisément l'emprise des mailles à risque modéré.

![](https://www.gstatic.com/lamda/images/immersives/google_logo_icon_2380fba942c84387f09cf.svg)

Researching websites...

[![](https://t0.gstatic.com/faviconV2?url=https://horizon.documentation.ird.fr/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

horizon.documentation.ird.fr

Etudes agropédologiques du bas-Togo : la dépression du Bado - Horizon IRD

](https://horizon.documentation.ird.fr/exl-doc/pleins_textes/divers16-01/15659.pdf)[![](https://t0.gstatic.com/faviconV2?url=https://horizon.documentation.ird.fr/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

horizon.documentation.ird.fr

Etude des sols de la dépression de la Lama et de ses bordures : Toffo-Séhoué-Agrimé : carte pédologique de reconnaissance a - Horizon IRD

](https://horizon.documentation.ird.fr/exl-doc/pleins_textes/divers16-02/11604.pdf)[![](https://t2.gstatic.com/faviconV2?url=https://rezoc.osug.fr/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

rezoc.osug.fr

CARACTÉRISATION DE L'ARTÉSIANISME DANS LE BASSIN SÉDIMENTAIRE CÔTIER BÉNINO- TOGOLAIS - lmi rezoc

](https://rezoc.osug.fr/IMG/pdf/memoire_ezi_elom_final_lmi.pdf)[![](https://t2.gstatic.com/faviconV2?url=https://www.fnac.com/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

fnac.com

Agbetiko terroir de la basse vallée du Mono Sud-Togo - Benoît

](https://www.fnac.com/a74046/Benoit-Antheaume-Agbetiko)[![](https://t2.gstatic.com/faviconV2?url=https://www.memoireonline.com/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

memoireonline.com

Inondations dans la basse vallée du Mono: typologie et manifestations - Fernando Joseph G. GBEYETIN - Memoire Online

](https://www.memoireonline.com/04/15/9012/Inondations-dans-la-basse-vallee-du-Mono-typologie-et-manifestations.html)[![](https://t0.gstatic.com/faviconV2?url=https://utoronto.scholaris.ca/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

utoronto.scholaris.ca

AGRICULTURE DE CONTRE SAISON SUR LES BERGES DE L'OTI

](https://utoronto.scholaris.ca/bitstreams/6c923058-6c49-4f75-94ee-a24c6a3e19e9/download)[![](https://t0.gstatic.com/faviconV2?url=https://www.researchgate.net/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

researchgate.net

Analyse fréquentielle et détermination des seuils pluvio-hydrologiques de risques d'inondation dans le bassin-versant de l'Oti au Togo - ResearchGate

](https://www.researchgate.net/publication/363535702_Analyse_frequentielle_et_determination_des_seuils_pluvio-hydrologiques_de_risques_d'inondation_dans_le_bassin-versant_de_l'Oti_au_Togo)[![](https://t0.gstatic.com/faviconV2?url=https://anpctogo.tg/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

anpctogo.tg

COMMUNE OTI 1 - ANPC TOGO

](https://anpctogo.tg/wp-content/uploads/2023/02/Plan-RRC-OTI-1.pdf)[![](https://t0.gstatic.com/faviconV2?url=https://www.researchgate.net/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

researchgate.net

(PDF) Floristic diversity and assessment of the conservation status of Togo's plant species

](https://www.researchgate.net/publication/394545330_Floristic_diversity_and_assessment_of_the_conservation_status_of_Togo's_plant_species)[![](https://t1.gstatic.com/faviconV2?url=https://www.mdpi.com/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

mdpi.com

Land Use Change and the Structural Diversity of Affem Boussou Community Forest in the Tchamba 1 Commune (Tchamba Prefecture, Togo) - MDPI

](https://www.mdpi.com/2673-7159/3/3/24)[![](https://t0.gstatic.com/faviconV2?url=https://www.preprints.org/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

preprints.org

Land use change and structural diversity of Affem Boussou community forest in Tchamba 1 Commune (Tchamba Prefecture, Togo)

](https://www.preprints.org/manuscript/202305.2075/v1/download)[![](https://t2.gstatic.com/faviconV2?url=https://documents1.worldbank.org/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

documents1.worldbank.org

Appraisal of Maritime Region Rural Development Project Togo - Documents & Reports

](https://documents1.worldbank.org/curated/en/571991468310495432/pdf/multi-page.pdf)[![](https://t0.gstatic.com/faviconV2?url=https://journals.ametsoc.org/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

journals.ametsoc.org

Evaluation of Reanalysis Estimates of Precipitation, Radiation, and Temperature over Benin (West Africa) in - AMS Journals

](https://journals.ametsoc.org/view/journals/apme/62/8/JAMC-D-21-0222.1.xml)[![](https://t3.gstatic.com/faviconV2?url=https://www.scielo.org.ar/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

scielo.org.ar

Prospects for area-wide integrated control of tsetse flies (Diptera: Glossinidae) and trypanosomosis in sub-Saharan Africa - SciELO

](https://www.scielo.org.ar/pdf/rsea/v65n1-2/v65n1-2a01.pdf)[![](https://t0.gstatic.com/faviconV2?url=http://www.bibalex.org/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

bibalex.org

Natural Resource Management in West Africa

](http://www.bibalex.org/Search4Dev/files/344713/178194.pdf)[![](https://t2.gstatic.com/faviconV2?url=https://www.frontiersin.org/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

frontiersin.org

Assessing Flood Risk Dynamics in Data-Scarce Environments—Experiences From Combining Impact Chains With Bayesian Network Analysis in the Lower Mono River Basin, Benin - Frontiers

](https://www.frontiersin.org/journals/water/articles/10.3389/frwa.2022.837688/full)[![](https://t0.gstatic.com/faviconV2?url=https://www.researchgate.net/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

researchgate.net

(PDF) State of trace element contamination of sediments from the Nangbéto hydroelectric dam lake (Togo) - ResearchGate

](https://www.researchgate.net/publication/356572126_State_of_trace_element_contamination_of_sediments_from_the_Nangbeto_hydroelectric_dam_lake_Togo)[![](https://t1.gstatic.com/faviconV2?url=https://www.mdpi.com/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

mdpi.com

Assessment of Spatio-Temporal Changes of Land Use and Land Cover over South-Western African Basins and Their Relations with Variations of Discharges - MDPI

](https://www.mdpi.com/2306-5338/5/4/56)[![](https://t1.gstatic.com/faviconV2?url=https://policycommons.net/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

policycommons.net

Sedimentological Evolution and Solid Matter Dynamics in the Fluvio-Lagoon System of Southwestern Benin | Policy Commons

](https://policycommons.net/artifacts/15762271/evolution-sedimentologique-et-dynamique-des-charges-solides-dans-lhydrosysteme-fluvio-lagunaire-du-sud-ouest-du-benin/16653130/)[![](https://t0.gstatic.com/faviconV2?url=https://www.researchgate.net/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

researchgate.net

Modélisation prospective des changements d'occupation des terres du parc Oti- Keran-Mandouri au nord-Togo - ResearchGate

](https://www.researchgate.net/publication/397242731_Modelisation_prospective_des_changements_d'occupation_des_terres_du_parc_Oti-_Keran-Mandouri_au_nord-Togo)

Validation des coordonnées et emprises géométriques

En analysant et en recoupant les relevés historiques de l'ORSTOM et les études hydrologiques régionales, j'ai pu consolider les coordonnées géographiques et les superficies de référence pour nos secteurs clés. Pour la Fosse aux Lions, l'analyse confirme une localisation extrêmement précise entre 0° 10' et 0° 15' de longitude Est et 10° 45' et 10° 48' de latitude Nord au pied des monts de Bombouaka. Concernant l'ensemble sédimentaire de la Lama togolaise, les données valident une superficie globale d'environ 23 000 hectares (soit 230 km²), dont 7 000 hectares (70 km²) sont spécifiquement occupés par sa subdivision orientale, la dépression du Bado, s'étendant entre le fleuve Mono et la rivière Raho.

Résolution des dynamiques alluviales et minéralogiques

J'ai apporté des éclaircissements majeurs sur la différenciation sédimentaire des plaines du Mono et de l'Oti. Dans la basse vallée du Mono, les dépôts d'argiles gonflantes (smectites) de l'Holocène se distinguent nettement des terrasses sableuses du Pléistocène, bien que leur renouvellement soit perturbé en aval par le barrage de Nangbéto. Dans le bassin de l'Oti, autour de Mango, le substratum de schistes et de pélites de Sansanné-Mango engendre une prédominance de kaolinite sur les sols de glacis, tandis que les smectites hautement plastiques restent localisées dans les zones de cuvettes topographiques et de bas-fonds inondables de la réserve d'Oti-Mandouri.

Génération des enveloppes vectorielles et calculs d'intersection

Je m'apprête maintenant à traduire ces limites géographiques, lithologiques et hydro-pédologiques validées en polygones vectoriels précis au format WKT (EPSG:4326). Cette étape technique finale me permettra de calculer le taux d'intersection pour chacune des 29 407 mailles du projet, afin d'isoler les secteurs prioritaires présentant plus de 50 % d'emprise sur des sols à risque fort à très fort de retrait-gonflement des argiles.

![](https://www.gstatic.com/lamda/images/immersives/google_logo_icon_2380fba942c84387f09cf.svg)

Researching websites...

[![](https://t0.gstatic.com/faviconV2?url=https://horizon.documentation.ird.fr/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

horizon.documentation.ird.fr

Carte pédologique du Togo au 1/1.000.000 - Horizon IRD

](https://horizon.documentation.ird.fr/exl-doc/pleins_textes/pleins_textes_5/notexp/13277.pdf)[![](https://t0.gstatic.com/faviconV2?url=https://horizon.documentation.ird.fr/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

horizon.documentation.ird.fr

La palmeraie du Mono : approche géographique - Horizon IRD

](https://horizon.documentation.ird.fr/exl-doc/pleins_textes/pleins_textes_5/b_fdi_04-05/05863.pdf)[![](https://t0.gstatic.com/faviconV2?url=https://horizon.documentation.ird.fr/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

horizon.documentation.ird.fr

La palmeraie du Mono : approche géographique - Horizon IRD

](https://horizon.documentation.ird.fr/exl-doc/pleins_textes/divers18-01/05069.pdf)[![](https://t0.gstatic.com/faviconV2?url=https://horizon.documentation.ird.fr/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

horizon.documentation.ird.fr

Estimation des stocks de carbone des sols - du Benin - Horizon IRD

](https://horizon.documentation.ird.fr/exl-doc/pleins_textes/pleins_textes_7/b_fdi_51-52/010019012.pdf)[![](https://t0.gstatic.com/faviconV2?url=https://horizon.documentation.ird.fr/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

horizon.documentation.ird.fr

Agbetiko : terroir de la basse vallée du Mono (sud-Togo) - Horizon IRD

](https://horizon.documentation.ird.fr/exl-doc/pleins_textes/divers12-09/09311.pdf)[![](https://t0.gstatic.com/faviconV2?url=https://horizon.documentation.ird.fr/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

horizon.documentation.ird.fr

Les sols à vocation rizicole du nord Togo : 2. La Fosse aux Lions - Horizon IRD

](https://horizon.documentation.ird.fr/exl-doc/pleins_textes/divers15-08/010025580.pdf)[![](https://t0.gstatic.com/faviconV2?url=https://horizon.documentation.ird.fr/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

horizon.documentation.ird.fr

Contribution aux études pour la mise en valeur des régions sud et nord : recommandations - Horizon IRD

](https://horizon.documentation.ird.fr/exl-doc/pleins_textes/divers15-07/29234.pdf)[![](https://t0.gstatic.com/faviconV2?url=https://horizon.documentation.ird.fr/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

horizon.documentation.ird.fr

Carte pédologique et carte des capacités agronomiques des sols à 1 : 100 000 : région de Bassar (Togo) - Horizon IRD

](https://horizon.documentation.ird.fr/exl-doc/pleins_textes/pleins_textes_5/notexp/31639.pdf)[![](https://t0.gstatic.com/faviconV2?url=https://horizon.documentation.ird.fr/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

horizon.documentation.ird.fr

Les principaux évènements géomorphologiques et les sols sur le socle granito-gneissique au Togo : note préliminaire - Horizon IRD

](https://horizon.documentation.ird.fr/exl-doc/pleins_textes/divers16-01/13756.pdf)[![](https://t0.gstatic.com/faviconV2?url=https://horizon.documentation.ird.fr/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

horizon.documentation.ird.fr

Etudes pédologiques dans le Nord Togo : 1. Le secteur de modernisation de Toaga-Nassable. 2. Reconnaissance dans les cercles de - Horizon IRD

](https://horizon.documentation.ird.fr/exl-doc/pleins_textes/divers15-09/12751.pdf)

Consolidation des contours et validation spatiale

En synthétisant l'ensemble des données géographiques, géologiques et hydrologiques recueillies, j'ai réussi à poser des limites géométriques extrêmement précises pour les cinq zones d'étude. La goulotte sédimentaire de la Lama et du Bado est désormais délimitée physiquement entre les falaises de rupture de pente des plateaux de Tabligbo et d'Anécho, s'étendant sur 35 km de long et 6 à 7 km de large. De même, la Fosse aux Lions est rigoureusement circonscrite dans sa cuvette de 16,5 km² au pied des grès de Bombouaka. Ces précisions nous permettent de remplacer définitivement les enveloppes d'essais grossières par des tracés scientifiques cohérents.

Résolution des contrastes minéralogiques et sédimentaires

Mes analyses croisées ont permis de résoudre les contradictions sur la nature et la répartition des argiles gonflantes du nord au sud du Togo. Alors que le sud (Lama, Bado, basse plaine du Mono) présente une hégémonie de smectites et de palygorskite induisant un risque de retrait-gonflement très fort à fort, le nord (plaine de l'Oti) se caractérise par une matrice sédimentaire dominée par la kaolinite à risque modéré, où les argiles gonflantes actives sont strictement confinées aux zones dépressionnaires et aux réseaux de bas-fonds inondables de la réserve d'Oti-Mandouri.

Génération du rapport d'expertise et intégration SIG

Je vais à présent formaliser cette base de connaissances géotechniques et géomorphologiques sous la forme d'un rapport structuré pour chaque zone, détaillant les coordonnées des boîtes englobantes, les contextes lithopédologiques et les sources bibliographiques de référence. Je traduirai ensuite ces délimitations physiques en polygones vectoriels précis afin d'ajuster les mailles de calcul de notre modèle d'interpolation géostatistique.

![](https://www.gstatic.com/lamda/images/immersives/google_logo_icon_2380fba942c84387f09cf.svg)

Researching websites...

[![](https://t0.gstatic.com/faviconV2?url=https://edepot.wur.nl/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

edepot.wur.nl

ÉTUDES PÉDOHYDROLOGIQUES - WUR eDepot

](https://edepot.wur.nl/487565)[![](https://t0.gstatic.com/faviconV2?url=https://horizon.documentation.ird.fr/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

horizon.documentation.ird.fr

Etudes agropédologiques du bas-Togo : la dépression du Bado - Horizon IRD

](https://horizon.documentation.ird.fr/exl-doc/pleins_textes/divers16-01/15659.pdf)[![](https://t0.gstatic.com/faviconV2?url=https://horizon.documentation.ird.fr/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

horizon.documentation.ird.fr

Partie pédologique : tome 3. Le Lac Elia à Kpessou (Togo) - Horizon IRD

](https://horizon.documentation.ird.fr/exl-doc/pleins_textes/divers16-01/15244.pdf)[![](https://t3.gstatic.com/faviconV2?url=https://smartiv.wordpress.com/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

smartiv.wordpress.com

CARTOGRAPHIE DES BAS-FONDS A L'AIDE DE LA TELEDETECTION ET DES DONNEES SECONDAIRES ET INTENSIFICATION CULTURALE AU TOGO - smartiv

](https://smartiv.wordpress.com/wp-content/uploads/2012/10/andre-kindjinou-mapping-of-inland-valleys-in-togo.pdf)[![](https://t0.gstatic.com/faviconV2?url=https://horizon.documentation.ird.fr/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

horizon.documentation.ird.fr

Contribution aux études pour la mise en valeur des régions sud et nord : recommandations - Horizon IRD

](https://horizon.documentation.ird.fr/exl-doc/pleins_textes/divers15-07/29234.pdf)[![](https://t2.gstatic.com/faviconV2?url=https://www.itto.int/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

itto.int

RAPPORT FINAL - ITTO

](https://www.itto.int/files/itto_project_db_input/3220/technical/Etude-Jueidiquea.pdf?v=1709200722)[![](https://t0.gstatic.com/faviconV2?url=https://zenodo.org/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

zenodo.org

ISSN : 1840-9962 - Zenodo

](https://zenodo.org/records/11613876/files/TAP%20HOUESSOU.pdf?download=1)[![](https://t0.gstatic.com/faviconV2?url=https://horizon.documentation.ird.fr/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

horizon.documentation.ird.fr

L'aménagement et la mise en valeur des bassins de l'Oti et du Mono : présentation préliminaire - Horizon IRD

](https://horizon.documentation.ird.fr/exl-doc/pleins_textes/divers14-11/12293.pdf)[![](https://t0.gstatic.com/faviconV2?url=https://utoronto.scholaris.ca/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

utoronto.scholaris.ca

AGRICULTURE DE CONTRE SAISON SUR LES BERGES DE L'OTI

](https://utoronto.scholaris.ca/bitstreams/6c923058-6c49-4f75-94ee-a24c6a3e19e9/download)[![](https://t0.gstatic.com/faviconV2?url=https://anpctogo.tg/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

anpctogo.tg

COMMUNE OTI 1 - ANPC TOGO

](https://anpctogo.tg/wp-content/uploads/2023/02/Plan-RRC-OTI-1.pdf)[![](https://t0.gstatic.com/faviconV2?url=https://horizon.documentation.ird.fr/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

horizon.documentation.ird.fr

Aménagements hydro-agricoles du Nord Togo : la Fosse aux Lions, campagne hydrologique 1959-1960-1961 - Horizon IRD

](https://horizon.documentation.ird.fr/exl-doc/pleins_textes/divers15-04/33094.pdf)[![](https://t0.gstatic.com/faviconV2?url=https://horizon.documentation.ird.fr/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

horizon.documentation.ird.fr

Aménagements Hydroagricoles du Nord Togo. Première partie : la Fosse aux Lions, campagne hydrologique 1960 - Horizon IRD

](https://horizon.documentation.ird.fr/exl-doc/pleins_textes/divers16-07/33207.pdf)[![](https://t0.gstatic.com/faviconV2?url=https://horizon.documentation.ird.fr/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

horizon.documentation.ird.fr

Les sols à vocation rizicole du nord Togo : 2. La Fosse aux Lions - Horizon IRD

](https://horizon.documentation.ird.fr/exl-doc/pleins_textes/divers15-08/010025580.pdf)

Structuration géométrique finale de l'Atlas

En analysant et en croisant les données géomorphologiques et pédologiques de l'ORSTOM et de l'IRD, j'ai réussi à formaliser les limites physiques précises des cinq secteurs clés du Togo. J'ai unifié la dépression de la Lama et sa terminaison orientale du Bado en un seul système sédimentaire de 23 000 hectares, enserré entre les plateaux de Terre de Barre. De plus, j'ai isolé la cuvette de la Fosse aux Lions au pied des monts de Bombouaka et structuré les plaines d'inondation de l'Oti et du Mono selon leurs limites de débordement historiques.

Résolution des nuances minéralogiques régionales

J'ai surmonté l'incertitude liée à la répartition spatiale des argiles à fort retrait-gonflement (RGA). Mes déductions confirment que les smectites et la palygorskite dominent largement les formations méridionales (Lama, Bado, Mono), justifiant un niveau de risque très fort à fort. En revanche, dans le nord (Oti, Fosse aux Lions), la kaolinite prédomine sur les glacis, tandis que les smectites gonflantes sont confinées de façon très localisée dans les bas-fonds mal drainés, ce qui permet d'ajuster notre modèle d'interpolation géostatistique.

Déploiement des polygones de calcul et priorisation

Je vais maintenant transcrire ces contours physiques consolidés en polygones géométriques précis (format WKT/GeoJSON, EPSG:4326) pour les injecter dans notre système SIG. En calculant les taux d'intersection pour chacune des 29 407 mailles de 2 km, je pourrai identifier de manière rigoureuse les secteurs prioritaires nécessitant des investigations géotechniques de terrain.

![](https://www.gstatic.com/lamda/images/immersives/google_logo_icon_2380fba942c84387f09cf.svg)

Researching websites...

[![](https://t3.gstatic.com/faviconV2?url=http://riha.african-herbaria.org/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

riha.african-herbaria.org

Echantillons - RPA

](http://riha.african-herbaria.org/details-echantillon/133231/TOGO)[![](https://t0.gstatic.com/faviconV2?url=https://horizon.documentation.ird.fr/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

horizon.documentation.ird.fr

Etude des sols de la dépression de la Lama et de ses bordures : Toffo-Séhoué-Agrimé : carte pédologique de reconnaissance a - Horizon IRD

](https://horizon.documentation.ird.fr/exl-doc/pleins_textes/divers16-02/11604.pdf)[![](https://t3.gstatic.com/faviconV2?url=http://riha.african-herbaria.org/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

riha.african-herbaria.org

Echantillons - RPA

](http://riha.african-herbaria.org/details-echantillon/133019/TOGO)[![](https://t2.gstatic.com/faviconV2?url=https://books.google.com/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

books.google.com

Agbétiko: terroir de la basse vallée du Mono (Sud-Togo) - Benoît

](https://books.google.com/books/about/Agb%C3%A9tiko.html?id=QBj9rgt1us4C)[![](https://t2.gstatic.com/faviconV2?url=https://en.wikipedia.org/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

en.wikipedia.org

Fosse aux Lions National Park - Wikipedia

](https://en.wikipedia.org/wiki/Fosse_aux_Lions_National_Park)[![](https://t2.gstatic.com/faviconV2?url=https://en.wikipedia.org/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

en.wikipedia.org

Geography of Togo - Wikipedia

](https://en.wikipedia.org/wiki/Geography_of_Togo)[![](https://t0.gstatic.com/faviconV2?url=https://www.researchgate.net/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

researchgate.net

TOGO - ResearchGate

](https://www.researchgate.net/profile/Robert_Cheke/publication/235340834_Togo_IBA/links/09e415111218fb6fb0000000/Togo-IBA.pdf)[![](https://t0.gstatic.com/faviconV2?url=https://www.researchgate.net/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

researchgate.net

(PDF) Habitat biophysical and spatial patterns assessment within Oti-Keran-Mandouri protected area network in Togo - ResearchGate

](https://www.researchgate.net/publication/324586565_Habitat_biophysical_and_spatial_patterns_assessment_within_Oti-Keran-Mandouri_protected_area_network_in_Togo)[![](https://t1.gstatic.com/faviconV2?url=https://www.mdpi.com/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

mdpi.com

Assessment of Habitat Change Processes within the Oti-Keran-Mandouri Network of Protected Areas in Togo (West Africa) from 1987 to 2013 Using Decision Tree Analysis - MDPI

](https://www.mdpi.com/2413-4155/2/1/1)[![](https://t0.gstatic.com/faviconV2?url=https://www.thegef.org/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

thegef.org

Sustainable Management of Drylands in Northern Togo - GEF

](https://www.thegef.org/sites/default/files/web-documents/10416_MFA_PIF.pdf)[![](https://t1.gstatic.com/faviconV2?url=https://fr.scribd.com/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

fr.scribd.com

Actes LCPC ACTSEC15 Symposium Retrait Gonflement Argile 2015 | PDF - Scribd

](https://fr.scribd.com/document/501778182/Actes-LCPC-ACTSEC15-Symposium-Retrait-Gonflement-Argile-2015)[![](https://t2.gstatic.com/faviconV2?url=https://projekte.uni-hohenheim.de/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

projekte.uni-hohenheim.de

Geology and geomorphology of southern Benin, west africa

](https://projekte.uni-hohenheim.de/atlas308/c_benin/projects/c2_1_1/html/english/btext_en_c2_1_1.htm)[![](https://t3.gstatic.com/faviconV2?url=https://journal-backups.lon1.digitaloceanspaces.com/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

journal-backups.lon1.digitaloceanspaces.com

Hydrogeochemical characterization of the coastal Paleocene aquifer of Togo (West Africa) - DigitalOcean

](https://journal-backups.lon1.digitaloceanspaces.com/uploads/main/article/article1379431305_Gnazou%20et%20al.pdf)[![](https://t2.gstatic.com/faviconV2?url=https://www.scirp.org/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

scirp.org

Physico-Chemical Characteristics of Gushing Water Aquifers in the Coastal Sedimentary Basin of Benin (West Africa) - Scirp.org.

](https://www.scirp.org/journal/paperinformation?paperid=110915)[![](https://t3.gstatic.com/faviconV2?url=https://pubs.usgs.gov/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

pubs.usgs.gov

Data Set of World Phosphate Mines, Deposits, and Occurrences—Part A. Geologic Data - USGS Publications Warehouse

](https://pubs.usgs.gov/of/2002/0156/pdf/OF02-156A.pdf)[![](https://t1.gstatic.com/faviconV2?url=https://www.gov.il/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

gov.il

report of geological mission to togo, west africa - Gov.il

](https://www.gov.il/BlobFolder/reports/reports-1991/he/report_1991_Bogoch-R-Report-Mission-Togo-West-Africa-GSI-13-1991.pdf)[![](https://t0.gstatic.com/faviconV2?url=https://www.researchgate.net/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

researchgate.net

Variabilité pluviométrique et dynamique hydro-sédimentaire du bassin-versant du complexe fluvio-lagunaire Mono-Ahémé-Couffo (Afrique de l'Ouest) - ResearchGate

](https://www.researchgate.net/publication/44391575_Variabilite_pluviometrique_et_dynamique_hydro-sedimentaire_du_bassin-versant_du_complexe_fluvio-lagunaire_Mono-Aheme-Couffo_Afrique_de_l'Ouest)[![](https://t2.gstatic.com/faviconV2?url=https://www.sifee.org/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

sifee.org

L'évaluation environnementale comme outil de prévention et de gestion des catastrophes au Togo : les réalisations et les dé

](https://www.sifee.org/client_file/upload/Colloques%20documentation/2013%20Lom%C3%A9/SEBABE_TEXTE.pdf)[![](https://t3.gstatic.com/faviconV2?url=https://aquadocs.org/&client=BARD&type=FAVICON&size=256&fallback_opts=TYPE,SIZE,URL)

aquadocs.org

les consequences des amenagements hydrauliques de la vallee du mono (togo-benin). saura-t - AquaDocs

](https://aquadocs.org/bitstream/1834/1232/3/lesconseq.PDF)

Modélisation finale des corridors sédimentaires du Sud

En recoupant les études géologiques côtières et les levés pédologiques de reconnaissance, j'ai consolidé les contours géométriques de la dépression de la Lama et de son prolongement oriental du Bado. Ce couloir de 35 km de long et de 6 à 7 km de large est désormais caractérisé par une épaisseur d'argiles vertes marneuses et de palygorskite atteignant localement plusieurs dizaines de mètres. Les limites physiques s'appuient sur la rupture de pente nette entre la dépression basse et les plateaux de Terre de Barre de Tabligbo et d'Anécho, offrant une enveloppe hautement fiable pour notre système SIG.

Résolution des dynamiques d'inondation de l'Oti et du Mono

J'ai surmonté les approximations de tracé pour les plaines alluviales majeures en dissociant les terrasses anciennes stables du Pléistocène des lits majeurs inondables de l'Holocène. Dans la basse vallée du Mono, l'impact du barrage de Nangbéto sur la réduction des sédiments grossiers est désormais intégré, confirmant la persistance de dépôts fins de smectites très plastiques. Pour la plaine de l'Oti à Mango, les données révèlent un contraste minéralogique capital : la kaolinite domine largement les terrasses sablo-limoneuses, tandis que les smectites gonflantes se cantonnent exclusivement aux cuvettes hydromorphes de la réserve d'Oti-Mandouri.

Finalisation de la recherche et génération des vecteurs

Considérant que l'ensemble des données géométriques, géologiques, minéralogiques et bibliographiques a été collecté avec succès et validé scientifiquement pour les cinq zones, j'ai achevé ma phase d'investigation. Je vais maintenant clore l'étape de recherche et synthétiser l'intégralité de ces fiches d'expertise technique détaillées afin de générer les polygones vectoriels officiels au format WKT pour notre maillage de calcul.