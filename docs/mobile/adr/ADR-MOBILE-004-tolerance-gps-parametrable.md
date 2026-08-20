# ADR-MOBILE-004 — Confirmation de point de prélèvement à tolérance GPS paramétrable
**Date : Août 2026**
**Statut : Accepté**
**Auteur : Serge TABE DJATO — intrepidcore**

---

## Contexte

À la création d'une mission, un superviseur peut déjà planifier des points de sondage (`CreateMissionRequest.sondage_points`, table `atlas.colab_mission_sondage_points`). Sur le terrain, l'étudiant doit pouvoir confirmer qu'il se trouve physiquement sur (ou suffisamment proche de) un point prévu avant que le sondage réel y soit rattaché — le rayon de tolérance acceptable doit être réglable par le porteur du produit, jamais figé dans le code.

Le endpoint mobile existant (`GET .../map-context`) n'exposait jusqu'ici que les sondages déjà réalisés (`existing_sondages`), pas les points prévisionnels ni de notion de tolérance — c'est un manque backend identifié en construisant l'écran carte mobile, comblé dans ce chantier (cf. Lot B de la roadmap).

## Décision

**La tolérance est une donnée métier stockée en base, avec une valeur par défaut système surchargeable par mission — jamais une constante compilée en dur, ni côté serveur ni côté app.**

- Colonne `atlas.colab_missions.sondage_tolerance_m` (`INTEGER`, nullable). `NULL` signifie "utiliser le défaut système".
- Défaut système lu depuis la variable d'environnement `ATLAS_DEFAULT_SONDAGE_TOLERANCE_M` du service `api-geo` (fallback ultime 15 m si la variable est absente, documenté dans `.env.example`) — donc réglable par déploiement sans recompilation.
- `MapContext` (endpoint `GET /colab/mobile/missions/:id/map-context`) renvoie `tolerance_m` résolu (mission ou défaut) et la liste `planned_points` (numero, label, lat, lon, `confirmed_sondage_id`).
- L'app affiche un cercle de tolérance autour de chaque point prévu sur la carte (MapLibre), calculé à partir de cette valeur — jamais une constante codée dans le composant.
- **Double validation** : le client vérifie côté UX (feedback immédiat, désactive le bouton de confirmation hors tolérance) mais le serveur revalide indépendamment la distance via PostGIS (`ST_Distance` sur géographie, donc en mètres réels, pas en degrés) dans le nouvel endpoint `POST /colab/mobile/missions/:id/sondage-points/:point_id/confirm` — un client modifié ou un mock GPS ne peut pas contourner la règle. C'est le serveur qui fait foi, jamais le client seul.

## Alternatives considérées

**Tolérance uniquement côté client (constante configurable dans les réglages app).** Rejeté : un opérateur pourrait trivialement mentir sur sa position (mock GPS, app modifiée) sans aucune barrière serveur — inacceptable pour une donnée qui doit rester scientifiquement fiable (position réelle du prélèvement).

**Tolérance globale unique pour toute la plateforme (variable d'env seule, pas de colonne par mission).** Rejeté : certaines missions (relief accidenté, maille en zone urbaine dense) ont légitimement besoin d'une tolérance différente d'une mission en zone dégagée ; le porteur du produit a explicitement demandé un paramètre réglable, pas une constante globale unique.

**Calcul de distance en SQL brut (Pythagore sur lat/lon).** Rejeté : imprécis à l'échelle de dizaines de mètres selon la latitude ; `ST_Distance` sur type `geography` PostGIS donne une distance orthodromique correcte, déjà l'outil standard utilisé ailleurs dans le schéma `atlas`.

## Conséquences

- Toute future fonctionnalité de géofencing dans l'app doit lire la tolérance depuis `MapContext`, jamais la coder en dur dans un composant ou un style.
- Un superviseur peut ajuster la tolérance d'une mission existante via l'endpoint générique `PUT /colab/missions/:id` (champ `sondage_tolerance_m` ajouté à `UpdateMissionRequest` / `CreateMissionRequest`), sans besoin d'un endpoint dédié.
- Le point prévisionnel confirmé (`confirmed_sondage_id` renseigné) devient visuellement distinct sur la carte (statut "confirmé" vs "en attente"), évitant les doubles confirmations accidentelles.

## Révision prévue

Si un besoin de tolérance asymétrique (ex. plus stricte en X, plus large en Y) ou dépendante du type de sol apparaît, réévaluer un modèle de tolérance plus riche qu'un simple rayon.
