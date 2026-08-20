# ADR-MOBILE-003 — Stratégie de build sans macOS local (EAS Build)
**Date : Août 2026**
**Statut : Accepté**
**Auteur : Serge TABE DJATO — intrepidcore**

---

## Contexte

Compiler une app iOS nécessite Xcode, donc macOS. Le poste de développement utilisé pour ce chantier est Windows, sans accès à une machine macOS. Compiler une app Android nécessite le SDK Android (Java/Gradle) ; ce poste n'a ni JDK ni Android SDK installés (vérifié : `java` absent, `ANDROID_HOME` non défini).

Livrer "les deux versions iOS et Android" sans aucune de ces dépendances locales impose de déporter la compilation.

## Décision

**Utiliser Expo Application Services (EAS Build) comme unique mécanisme de compilation, pour les deux plateformes, déclenché en CI (GitHub Actions) et documenté pour déclenchement manuel par l'utilisateur.**

- `eas.json` définit trois profils : `development` (client de dev, debug), `preview` (APK Android installable directement + build iOS ad-hoc/simulateur), `production` (AAB Android signé Play Store + IPA iOS signé App Store).
- Le workflow `.github/workflows/mobile-eas-build.yml` lance `eas build --platform all --profile preview --non-interactive` sur push vers `main` touchant `mobile/**`, authentifié via le secret de dépôt `EXPO_TOKEN`.
- Pour Android, `preview` produit un APK installable par simple téléchargement — aucun compte Google Play requis, sideload direct sur l'appareil des testeurs.
- Pour iOS, un compte Apple Developer Program (99 USD/an) reste une dépendance externe incompressible dès qu'on veut installer sur un iPhone physique (même hors App Store, l'app doit être signée par un compte Apple). Ce chantier configure tout ce qui ne requiert pas ce compte ; la première exécution EAS pour iOS demandera à l'utilisateur de fournir ses identifiants Apple (EAS peut gérer la génération de certificats automatiquement une fois connecté).

Ce que cette session a pu vérifier sans compte Expo/Apple : compilation TypeScript (`tsc --noEmit`), lint, tests unitaires, rendu des écrans en preview web Expo (`expo start --web`, dans le navigateur intégré). Ce qu'elle n'a pas pu vérifier : build binaire réel iOS/Android, comportement GPS/carte sur device physique — actions listées comme cases non cochées dans la roadmap, pas dissimulées.

## Alternatives considérées

**Attendre un accès macOS avant de livrer.** Rejeté : bloquerait tout le chantier sur une ressource externe alors que 100% du code, des tests et du pipeline peuvent être produits et vérifiés sans elle.

**Fastlane + machine CI macOS auto-hébergée.** Rejeté pour V0.1 : complexité d'infrastructure (runner macOS à payer/maintenir) disproportionnée face à EAS Build qui résout exactement ce problème en service géré, pour un coût nul en usage occasionnel (palier gratuit EAS suffisant pour du build preview).

**Ne livrer qu'Android dans un premier temps.** Rejeté : le porteur du produit a explicitement demandé les deux plateformes dès V0.1 ; le coût marginal de préparer aussi la configuration iOS est faible (c'est de la configuration, pas du code spécifique), seul le déclenchement réel dépend d'un compte tiers.

## Conséquences

- **Action utilisateur requise, hors périmètre exécutable par cette session** : créer un compte Expo (gratuit), générer un `EXPO_TOKEN`, l'ajouter comme secret GitHub du dépôt (`Settings → Secrets → Actions → EXPO_TOKEN`) ; pour iOS, un compte Apple Developer Program payant, connecté via `eas credentials` au premier build.
- Une fois ce secret posé, le pipeline construit les deux plateformes automatiquement à chaque merge sur `main` sans intervention supplémentaire.
- Le choix EAS lie l'app à l'écosystème Expo managed workflow (pas d'éjection vers du RN "bare" sans reconsidérer cette ADR).

## Révision prévue

Si le volume de builds dépasse le palier gratuit EAS, ou si un besoin de module natif hors-Expo-SDK apparaît (nécessitant un "custom dev client" ou un bare workflow), réévaluer l'infrastructure de build.
