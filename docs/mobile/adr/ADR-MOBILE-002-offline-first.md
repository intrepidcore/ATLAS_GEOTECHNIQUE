# ADR-MOBILE-002 — Stratégie offline-first (SQLite embarqué + file de synchronisation)
**Date : Août 2026**
**Statut : Accepté**
**Auteur : Serge TABE DJATO — intrepidcore**

---

## Contexte

Les opérateurs terrain (étudiants) travaillent en zones sans couverture data pendant des heures. L'app doit rester pleinement utilisable sans réseau : consulter la mission, voir la carte et les points prévus, confirmer un prélèvement, remplir une fiche de sondage — puis synchroniser dès que le réseau revient, ou sur rappel programmé.

Le PWA existant a déjà posé ce principe via IndexedDB (`offlineStorage` dans `colab-mobile-api.ts`) : missions en cache, `pendingActions` en file d'attente rejouée à la reconnexion. C'est le bon design, à porter sur mobile natif avec un stockage plus robuste et un déclenchement de sync plus fiable qu'un simple `navigator.onLine`.

## Décision

**Base de vérité locale en SQLite embarqué (`expo-sqlite`), écrans qui ne lisent/écrivent jamais directement le réseau.**

Architecture :
- Toute lecture d'écran passe par le repository local (SQLite), jamais par un appel réseau direct dans un composant.
- À chaque ouverture d'écran avec réseau disponible, un rafraîchissement en arrière-plan met à jour le cache local (pattern "stale-while-revalidate"), sans bloquer l'affichage.
- Toute écriture (nouveau sondage, confirmation de point, note de journal) est d'abord persistée en local avec un `client_id` (UUID généré côté app) et un statut `pending`, puis empilée dans une table `sync_queue`.
- Un service de synchronisation (`SyncService`) consomme `sync_queue` par lots vers `POST /colab/mobile/sync` (déjà existant côté backend, réutilisé tel quel), avec back-off exponentiel sur échec, et bascule sur écoute réseau (`@react-native-community/netinfo`) pour se déclencher automatiquement à la reconnexion — pas seulement au lancement de l'app.
- Idempotence garantie côté serveur par `client_id` : un rejeu de synchronisation ne duplique pas les données (le endpoint `/colab/mobile/sync` existant applique déjà ce principe via `SyncActionResult.client_id`).

Tables locales SQLite : `missions`, `mission_planned_points`, `sondages_draft`, `sync_queue`, `field_logs_draft`, `app_settings` (tolérance, dernière sync, etc.).

## Alternatives considérées

**WatermelonDB.** Solution de synchronisation offline-first très aboutie côté React Native, avec moteur de résolution de conflits intégré. Écartée pour V0.1 : complexité d'intégration disproportionnée par rapport au volume de données réel (un étudiant gère quelques dizaines de sondages par mission, pas des milliers d'enregistrements avec conflits concurrents fréquents). `expo-sqlite` + repository maison couvre le besoin avec une surface de code et de dette bien plus faible. À reconsidérer si le volume ou la collaboration multi-device simultanée grandit.

**AsyncStorage seul (clé/valeur).** Écarté : pas de requêtage structuré, migration de schéma pénible, non adapté à des relations mission → points → sondages.

**Remplacer le sync par un GraphQL avec cache normalisé (Apollo/Relay).** Écarté : sur-ingénierie, le backend est REST, pas de raison de faire porter au client un changement de protocole pour ce périmètre.

## Conséquences

- Toute nouvelle fonctionnalité mobile doit respecter le flux "écran lit le local → service écrit le local → sync_queue pousse au serveur", jamais d'appel réseau synchrone bloquant dans un écran.
- Le endpoint `POST /colab/mobile/sync` du backend, déjà conçu pour ce pattern, est réutilisé sans modification de contrat — seul le transport côté client change (SQLite au lieu d'IndexedDB).
- Une migration de schéma SQLite locale devra être gérée si la structure des tables évolue (versionnée via `PRAGMA user_version`).

## Révision prévue

Si le volume de sondages par mission dépasse quelques centaines, ou si plusieurs opérateurs doivent éditer la même fiche en concurrence hors-ligne, réévaluer WatermelonDB pour la résolution de conflits.
