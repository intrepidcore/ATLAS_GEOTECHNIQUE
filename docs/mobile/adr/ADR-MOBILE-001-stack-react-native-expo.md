# ADR-MOBILE-001 — Choix de React Native (Expo) comme stack de l'app terrain
**Date : Août 2026**
**Statut : Accepté**
**Auteur : Serge TABE DJATO — intrepidcore**

---

## Contexte

Atlas dispose d'un PWA terrain (`ui/src/pages/mobile/*`, service `colab-mobile-api.ts`) pour les étudiants en mission : liste de missions, carte Leaflet avec géofencing (turf.js), formulaire de sondage offline via IndexedDB. Ce PWA a deux limites structurelles pour l'usage réel :

1. **Pas d'exécution en arrière-plan fiable.** Sur iOS Safari en particulier, un service worker est suspendu dès que l'app n'est plus au premier plan ; la Background Sync API n'existe quasiment pas sur iOS. Pour un opérateur qui pose son téléphone en poche pendant qu'il marche vers un point de sondage, l'app PWA arrête de suivre sa position.
2. **Zones sans réseau prolongées.** Les mailles terrain sont souvent hors couverture data. Un PWA mal préchargé n'affiche rien ; même bien préchargé, il reste dépendant du comportement erratique du service worker au retour en ligne.

Le porteur du produit demande une app "code once" pour iOS et Android, avec navigation carte, confirmation de point de prélèvement à tolérance GPS, fiches de sondage, synchronisation temps réel ou programmée.

Contrainte d'environnement : le développement s'est fait sans macOS ni Xcode local (poste Windows), et sans SDK Android/émulateur installé.

## Décision

**Adopter React Native avec Expo (managed workflow + EAS Build) comme stack de l'app mobile Atlas Terrain.**

Raisons déterminantes :

- **Réutilisation directe de l'existant.** Tout le reste du projet (`ui/`) est React + TypeScript. Les types de `colab-mobile-api.ts`, la logique de synchronisation, les conventions de nommage sont directement portables. Le coût de montée en compétence de l'équipe est quasi nul.
- **EAS Build lève la contrainte macOS.** Le build iOS peut être déclenché en cloud sans Xcode local — seul chemin réaliste depuis ce poste Windows (détail dans ADR-MOBILE-003).
- **Écosystème mature pour le besoin terrain.** `react-native-background-geolocation`-like patterns (ici : `expo-location` + `expo-task-manager` en mode "significant location change") et `@maplibre/maplibre-react-native` pour les cartes vectorielles offline sont éprouvés en production pour des cas d'usage identiques (crews terrain, géofencing).

## Alternatives considérées

**Flutter.** Rendu natif excellent, tuiles offline plus simples avec `flutter_map`. Rejeté : changement de langage (Dart) sans aucune réutilisation de code avec `ui/`, coût de contexte-switch pour une équipe 100% TypeScript, sans gain net sur le besoin réel (le rendu carte MapLibre RN est tout aussi capable en offline).

**Kotlin Multiplatform + Compose Multiplatform.** Rejeté : écosystème carte/géolocalisation background encore immature comparé à RN/Flutter en 2026, risque d'y perdre plus de temps qu'on en gagnerait sur le partage de logique.

**Continuer sur le PWA existant.** Rejeté explicitement : le blocage arrière-plan/offline sur iOS n'est pas un défaut d'implémentation contournable, c'est une limite de la plateforme web mobile — cf. section Contexte.

**Natif séparé (Swift + Kotlin).** Rejeté : double le coût de développement et de maintenance sans bénéfice proportionnel pour une équipe qui n'a pas de contrainte de performance extrême (pas de jeu vidéo, pas de traitement temps réel lourd sur device).

## Conséquences

- L'app mobile vit dans `mobile/` à la racine du dépôt `atlas_reclone`, projet Expo TypeScript indépendant du build Vite de `ui/`, partageant le même backend `api-geo`.
- Le PWA existant (`ui/src/pages/mobile/*`) est conservé tel quel (pas supprimé) le temps de la bascule ; il devient legacy et sera retiré dans une passe ultérieure une fois l'app native validée en usage réel (hors périmètre V0.1).
- Toute nouvelle fonctionnalité terrain doit être développée dans `mobile/`, pas dans le PWA.
- Dépendance à un compte Expo (gratuit) pour les builds EAS — impact opérationnel documenté en ADR-MOBILE-003.

## Révision prévue

À réviser après le premier déploiement terrain réel (V0.2), une fois le retour d'usage batterie/GPS disponible sur device physique — ce que cet environnement de développement ne permet pas de mesurer.
