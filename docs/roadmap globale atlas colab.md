Je pars direct sur la version **corrigée / enrichie** de la roadmap 1→8, en tenant compte :

* de tes remarques sur les phases 1, 3, 5, 7, 8
* de l’analyse du module **RBAC – Permissions**
* des quatre mémoires “néré” (stabilisation locale + synthèse nationale)

Je te réponds en trois blocs :

1. Amélioration de la **navigation terrain (Phase 3 / PWA)**
2. Synthèse rapide des **mémoires** (pour orienter stabilisation vs synthèse)
3. **Roadmap globale Phases 1→8** version corrigée

---

## 1. Navigation terrain – amélioration de ta Phase 3 (PWA)

Tu proposes déjà :

* carte qui occupe ~90 % de l’écran,
* mailles de l’étudiant bien mises en évidence,
* demande d’accès GPS,
* chargement automatique des tuiles dans un rayon ~5 km,
* indication visuelle quand l’opérateur **entre / sort** de la maille.

C’est excellent pour l’usage réel sur le terrain. Je garderais tout ça, et j’ajouterais :

### a) Aides visuelles supplémentaires

* **Indicateur “vous êtes ici”** avec un cercle de précision (comme dans Google Maps) pour que l’étudiant voit l’incertitude de sa position.
* **Bordure dynamique de la maille** :

  * couleur A quand il est **hors maille**,
  * couleur B + léger “glow” quand il **entre** dans la maille cible.
* **Bannière d’état** en haut de la carte :

  * “En dehors de la maille – distance au centre : 320 m”
  * “Dans la maille TGO-XXX-YYY – OK pour sondage”.

### b) Outils de navigation pratiques

* **Bouton “Recentrer sur moi”** (comme dans QGIS mobile)
  → recadre la carte sur la position GPS avec zoom prédéfini adapté au terrain.
* **Bouton “Recentrer sur la maille”**
  → recadre sur la maille assignée (utile quand le GPS décroche).
* **Trace du parcours** (optionnelle v1.1)
  → polyline discrète de ce qu’il a déjà parcouru dans la journée.

### c) Aides à la mission

En plus de *Mes missions* / *Détail mission* / *Nouveau sondage* :

* **Checklist rapide** dans l’écran *Nouveau sondage* :

  * “Photos prises ? (surface, fouille, voisinage)”
  * “Profondeur max atteinte ?”
  * “Coordonnées vérifiées ?”
* **Badge de complétion de maille** :

  * par ex. “Maille couverte : 2/3 sondages prévus”.
* **Mode hors-ligne simple v1** :

  * mise en cache de la maille + tuiles 5 km autour,
  * stockage local des sondages créés,
  * bouton “Synchroniser maintenant” dès que le réseau revient.

Tout ça reste simple à coder, mais rend l’app **vraiment utilisable** sur le terrain.

---

## 2. Ce que racontent les mémoires (pour guider stabilisation & synthèse)

En très résumé :

### a) Travaux “stabilisation locale”

* **SOWOU (Tsévié N’dagni)** – stabilisation des sols gonflants avec jus de **feuilles et graines** de néré, essais granulométrie, bleu de méthylène, limites d’Atterberg (eau vs jus), gonflement par immersion. On voit une baisse des indices de plasticité et des indices de gonflement avec les jus.
* **TAGBA (Alinka – Togblékopé)** – même logique, mais en étudiant **l’effet du taux de concentration** du jus de graine (0–75 %). Les tableaux et graphes montrent une baisse nette des **pressions de gonflement** quand le dosage en jus augmente (ex. de 61,6 kPa à 10,5 kPa à 1 m).
* **NAKPAN (Komah & Kadambara)** – amélioration des sols gonflants avec jus de **graine et d’écorce**, mêmes familles d’essais (granulo, bleu, Atterberg, gonflement libre / immersion, etc.).

👉 Pour Atlas, ça donne la famille **“Stabilisation”** : tests complets *sur un site donné* pour voir comment le jus de néré (ou autre stabilisant) modifie IP, indice de gonflement, pression de gonflement, etc.

### b) Travail “synthèse nationale”

* **KPEGLI – Synthèse des résultats** : reprend plusieurs localités (Alinka1, Alinka2, Tsévié1, Tsévié2, Nyamassila) à 1–1,5–2 m, et compare :

  * Atterberg,
  * bleu de méthylène,
  * gonflement par immersion,
  * gonflement / compressibilité à l’œdomètre,
  * etc.

Conclusion générale : le jus de graine de néré **réduit de façon significative** les IP, pressions et indices de gonflement, mais l’effet dépend de la profondeur et de la localité.

👉 Ça, c’est ta famille **“Synthèse”** : comparer / agréger **plusieurs sites**, plusieurs mémoires, et produire des cartes & graphes nationaux.

### Sur les calculs / graphes

Les formules et types de résultats utilisés sont standards :

* IP = WL – WP,
* indices de gonflement en %,
* pressions de gonflement à l’œdomètre en kPa,
* synthèses sous forme de tableaux récapitulatifs et courbes “IP vs dosage”, “pression vs dosage”, “gonflement vs temps”, etc.

À ce niveau, rien de choquant : les tendances sont cohérentes (diminution des IP et des pressions de gonflement avec le jus de néré, variation selon profondeur et localité). On utilisera ces tableaux + courbes comme **cas tests** quand on fera la roadmap du moteur de calcul.

---

## 3. Roadmap globale Atlas Colab (Phases 1 → 8) – Version corrigée

Je garde la structure 8 phases mais avec tes corrections.

### 🟦 Phase 1 – Socle commun & RBAC unifié (remplace “auth séparée”)

**Objectif :**
Un seul système **Users/Rôles/Permissions** pour *Atlas Géotechnique + Atlas Colab Web + PWA*.

1. **Backend (Rust / api-geo)**

   * Créer les tables `atlas.users`, `atlas.roles`, `atlas.user_roles`, `atlas.role_permissions` comme dans l’analyse RBAC (id, email, name, password_hash, rôle, permissions JSONB…).
   * Remplacer `extract_user_from_request` qui renvoie toujours un viewer par une vraie extraction via **JWT** ou session (par ex. header `Authorization: Bearer ...` → user + rôle).
   * Brancher les middlewares `require_read_permission`, `require_write_permission`, `require_admin_permission` sur :

     * gestion BDD (staging, diff, calculateur de champs, import/export, sauvegardes),
     * endpoints futurs d’Atlas Colab (missions, sondages, commentaires).

2. **Frontend Web (Atlas UI – onglet “RBAC – Permissions”)**

   * Connecter le composant **RBACManager** à de vraies API (`/rbac/users`, `/rbac/roles`, …) au lieu des mocks.
   * Ajouter une petite UI de **login** simple (email + mot de passe) → reçoit un JWT → stocke en mémoire et ajoute les headers aux requêtes.

3. **Atlas Colab**

   * Décider des **rôles** de base pour la collaboration :

     * `student`, `supervisor`, `lab_tech`, `admin`.
   * Mapper ces rôles sur les permissions fines déjà listées dans `AVAILABLE_PERMISSIONS` (accès aux missions, sondages, commentaires, calculs, tableau de bord).

> Résultat : quand tu ajoutes Atlas Colab, tu réutilises ce socle RBAC, pas un système d’auth séparé.

---

### 🟦 Phase 2 – Modèle de données Colab + Atlas Colab Web (base)

**Objectif :**
Poser toutes les tables pour la collaboration + premier écran Web “Atlas Colab”.

1. **Modèle de données (schéma `atlas`)**

   * `colab_students` (ou rattacher à `users` via rôle `student`).
   * `colab_supervisors`.
   * `colab_missions` : maille cible, zone, dates, responsable, nbre de sondages attendus, thème (stabilisation / synthèse).
   * `colab_mission_assignments` : mission ↔ étudiant.
   * `colab_field_logs` : journal de terrain.
   * `colab_documents` : dépôt des PDF / rapports intermédiaires (avec lien vers missions, sondages, essais).
   * **Lien avec Atlas existant :**

     * `mission_id` ↔ `maille_id` (grille nationale),
     * `mission_id` ↔ `sondages.id` (table sondages existante).

2. **Atlas Colab Web – “Catalogue d’outils”**

   Dans ton onglet **Outils** (capture écran), ajouter une carte :

   * **“Atlas Colab Studio”** (nom du catalogue)

     * Bouton “Ouvrir” → page dédiée `/colab`.

   Sur cette page :

   * liste des missions, filtres (promo, localité, thème, état),
   * lien vers gestion des étudiants / encadreurs (si rôle admin/supervisor),
   * bouton “Créer mission”.

---

### 🟦 Phase 3 – Atlas Colab PWA (terrain) & navigation GPS

**Objectif :**
Donner aux étudiants une app terrain **simple et robuste**.

1. **Écran “Mes missions”**

   * Liste des missions assignées (status, mailles, deadlines, % de sondages saisis).

2. **Écran “Détail mission”**

   * mini-carte de la maille,
   * check-list & résumé (nb sondages prévus / réalisés),
   * bouton “Ouvrir la carte terrain”
   * bouton “Nouveau sondage”.

3. **Écran “Carte terrain” (90 % écran)**

   * carte plein écran (Leaflet ou autre)
   * mailles concernées en surbrillance (contour épais, couleur selon état),
   * cercle 5 km chargé autour de la maille (tuiles en cache),
   * GPS activé + indicateur “vous êtes ici”,
   * changement visuel + bannière quand l’utilisateur **entre / sort** de la maille,
   * bouton “Recentrer sur moi” / “Recentrer sur la maille”,
   * option trace de parcours (v1.1).

4. **Formulaire “Nouveau sondage terrain”**

   * localisation (maille pré-remplie, coord approx. + info sur précision GPS),
   * description très simple du profil (nb couches, type, couleur),
   * profondeur atteinte,
   * photos (surface / fouille / fissures…),
   * notes rapides.

5. **Synchronisation**

   * v1 : synchro en ligne (POST direct vers API).
   * gestion des erreurs réseau claire + bouton “Réessayer”.
   * stockage temporaire local pour rejouer les envois.

---

### 🟦 Phase 4 – Collaboration structurée (Web + PWA)

**Objectif :**
Encadrer la collaboration autour des missions/sondages.

* **Commentaires par entité** :

  * mission, sondage, essai → fil de discussion (type GitHub issue).
* **Mentions & notifications** :

  * `@encadrant`, `@etudiant` dans les commentaires.
* **Journal de mission** :

  * résumé automatique des activités (sondages créés, mises à jour, docs importés).
* **Workflow de validation** :

  * statut sondage : *brouillon terrain* → *à valider labo* → *validé* → *intégré Atlas*.
* **PWA** :

  * vue simple des commentaires récents sur les missions de l’étudiant.

---

### 🟦 Phase 5 – Dimension “réseau social” & base de connaissances

**Objectif :**
Que les questions / réponses de chacun profitent à tous.

* **Espace “Questions Atlas Colab”** (Web & PWA) :

  * questions classées par thèmes : stabilisation néré, fondations superficielles, terrassements, etc.
  * tags : `sol gonflant`, `Atterberg`, `bleu de méthylène`, `Proctor`, …
* **Lien avec les missions** :

  * une question peut être rattachée à un sondage, une maille ou un essai précis.
* **Recherche globale** :

  * par mot-clé, site (Tsévié, Alinka, Komah…), profondeur, type d’essai.
* **Gamification légère** :

  * “meilleure réponse” choisie par les encadreurs,
  * badges pour participation (optionnel v1.1).

---

### 🟦 Phase 6 – Intégration du moteur de calcul (stabilisation & synthèse)

*(La roadmap détaillée du **moteur de calcul** viendra à ta prochaine demande, comme tu as prévu ; là je place juste la brique dans le film général.)*

**Objectif :**
Standardiser les calculs issus des essais (Atterberg, bleu de méthylène, gonflement, œdomètre, etc.) pour :

* **Stabilisation** : analyser un site donné (comme SOWOU, TAGBA, NAKPAN)
* **Synthèse** : comparer plusieurs sites / mémoires à la manière de KPEGLI.

Livrables de cette phase :

* Lib “Atlas Lab” (Rust ou Python) exposée via API :

  * calcul IP, indices de gonflement, pressions, courbes dosage→propriétés, etc.
* Gabarits de saisie pour essai labo (compatibles avec les protocoles des mémoires).
* Premières pages Web :

  * “Analyse stabilisation” (pour une mission),
  * “Synthèse multi-sites” (croiser plusieurs missions / mémoires).

---

### 🟦 Phase 7 – Tableau de bord “Atlas Colab studio” (intégré à l’onglet Outils)

**Objectif :**
Suivi global des missions, des étudiants et de la couverture du territoire.

* **Intégration UI** :

  * Dans l’onglet **Outils** (à côté de Calculatrice de champs, Import/Export, Comparateur, RBAC, Monitoring), ajouter une tuile :

    * **“Atlas Colab studio”** → bouton “Ouvrir” → nouvelle page.

* **Contenu du Board** (Web) :

  * Carte du Togo avec mailles colorées par :

    * présence de sondages,
    * missions en cours,
    * thèmes travaillés (stabilisation / synthèse).
  * Indicateurs :

    * nb missions par promo, par encadrant,
    * nb sondages validés / en attente,
    * couverture % des mailles par préfecture.
  * Filtres :

    * année, promotion, thème, localité, étudiant.

* **Lien avec moteur de calcul (Phase 6)** :

  * widgets “techniques” :

    * moyenne des IP par zone,
    * évolution de la pression de gonflement avant / après stabilisation pour un site, etc.

---

### 🟦 Phase 8 – Industrialisation, déploiement & durcissement

**Objectif :**
Rendre l’écosystème Colab + Atlas Geo **fiable**, déployable partout (local, SaaS, disque dur, etc.).

* **Packaging** :

  * Docker compose avec services : `atlas-db`, `atlas-api-geo`, `atlas-colab-api` , `atlas-ui` (web), `atlas-colab-pwa` (build séparé).

* **Modes de déploiement** :

  * mode **local université** (serveur interne + PWA pour les étudiants),
  * mode **disque externe / mini-serveur** (comme tu l’as évoqué),
  * futur mode **SaaS** si tu veux.

* **Qualité / Tests** :

  * suites de tests unitaires pour le moteur de calcul en se basant sur les tables des mémoires (on vérifie qu’on retrouve les IP, pressions, indices de gonflement publiés).
  * tests end-to-end sur les workflows missions → terrain → labo → synthèse.

* **Observabilité & sécurité** :

  * réutiliser Prometheus / Grafana (déjà présent) pour suivre l’usage d’Atlas Colab,
  * durcir RBAC (log d’audit pour opérations sensibles sur données d’essais, missions, résultats calculés).

---

