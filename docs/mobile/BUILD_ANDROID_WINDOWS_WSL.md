---
status: active
type: runbook
project: atlas / atlas-mobile
created: 2026-08-27
---

# Compiler Atlas Mobile sur ce poste Windows avec WSL

Ce runbook décrit le build Android local utilisé sur le poste Windows Atlas. Il produit un APK interne ARM64 qui contacte `api-geo` par l'adresse Tailscale du poste.

## 1. Architecture du build

- Sources Windows : `D:\PROJET_ATLAS_MASTER\atlas_reclone\mobile`
- Distribution : `Ubuntu-22.04` sous WSL
- Copie de travail WSL : `/root/projects/atlas-mobile-build`
- Node.js : 20
- Java : OpenJDK 17
- Android SDK : `/root/Android/Sdk`
- Compile/Target SDK : Android 34
- Sortie : `mobile/atlas-terrain-tailscale-fixed.apk`

Le build ne doit pas être effectué directement sur `/mnt/d` : Gradle et Metro sont beaucoup plus fiables et rapides dans le système de fichiers Linux de WSL.

## 2. Préconditions réseau

Le téléphone et ce PC doivent être connectés au même réseau Tailscale. Sur ce poste :

```powershell
& "C:\Program Files\Tailscale\tailscale.exe" ip -4
```

La valeur doit correspondre à `expo.extra.apiBaseUrl` dans `mobile/app.json`. Au 27 août 2026 :

```text
http://100.122.10.70:8000/api
```

Vérifier l'API avant chaque build :

```powershell
Invoke-WebRequest http://100.122.10.70:8000/api/health -UseBasicParsing
docker ps --filter name=atlas-api-geo
```

Le conteneur `atlas-api-geo` doit être `healthy` et publier `0.0.0.0:8000->8000/tcp`.

## 3. Pourquoi une configuration Android spécifique est nécessaire

L'URL Tailscale utilisée ici est en HTTP. Le transport entre les appareils reste chiffré par Tailscale, mais Android 9 et versions suivantes bloquent par défaut le HTTP dans un APK release.

Le plugin Expo `mobile/plugins/withAtlasAndroidBuild.js` applique à chaque `expo prebuild` :

- `android:usesCleartextTraffic="true"` dans le manifeste principal release ;
- `reactNativeArchitectures=arm64-v8a` dans `android/gradle.properties` ;
- un filtre NDK `abiFilters "arm64-v8a"` dans le bloc `defaultConfig` de Gradle, indispensable pour empêcher certaines bibliothèques Expo d'embarquer également x86 et ARMv7.

Il ne faut plus éditer manuellement le fichier généré `android/app/build.gradle` : les modifications manuelles sont effacées par `expo prebuild`.

Cette autorisation HTTP est réservée au déploiement interne Tailscale. Un build de publication doit utiliser une URL HTTPS et remettre `allowCleartext` à `false`.

## 4. Commande de compilation

Depuis PowerShell :

```powershell
wsl -d Ubuntu-22.04 -- bash /mnt/d/PROJET_ATLAS_MASTER/atlas_reclone/mobile/scripts/build-android-wsl.sh
```

Le script effectue automatiquement :

1. la synchronisation des sources vers `/root/projects/atlas-mobile-build` ;
2. `npm ci` ;
3. `npx expo prebuild --platform android --no-install --clean` ;
4. la vérification du manifeste HTTP et de l'ABI ARM64 ;
5. `gradlew assembleRelease` avec ProGuard et la réduction des ressources ;
6. la copie de l'APK et l'affichage de son SHA-256.

Le build installe notamment `react-native-webview`, utilisé pour la carte Leaflet multi-fonds, et `expo-sharing`, utilisé pour exporter puis transmettre les fichiers JSON/CSV avec la feuille de partage Android. Le paquet natif MapLibre a été retiré après des arrêts Android reproductibles à l'ouverture de la carte. Ne pas réintroduire l'ancien patch `patches/@maplibre+maplibre-react-native+9.1.0.patch`.

## 5. Vérifications obligatoires de l'APK

```powershell
wsl -d Ubuntu-22.04 -- bash -lc "~/Android/Sdk/build-tools/34.0.0/aapt dump badging /mnt/d/PROJET_ATLAS_MASTER/atlas_reclone/mobile/atlas-terrain-tailscale-fixed.apk | head"

wsl -d Ubuntu-22.04 -- bash -lc "~/Android/Sdk/build-tools/34.0.0/aapt dump xmltree /mnt/d/PROJET_ATLAS_MASTER/atlas_reclone/mobile/atlas-terrain-tailscale-fixed.apk AndroidManifest.xml | grep usesCleartextTraffic"

wsl -d Ubuntu-22.04 -- bash -lc "unzip -Z1 /mnt/d/PROJET_ATLAS_MASTER/atlas_reclone/mobile/atlas-terrain-tailscale-fixed.apk | grep '^lib/' | cut -d/ -f2 | sort -u"

Get-FileHash -Algorithm SHA256 D:\PROJET_ATLAS_MASTER\atlas_reclone\mobile\atlas-terrain-tailscale-fixed.apk
```

Résultats attendus :

- paquet `com.intrepidcore.atlasmobile` ;
- ABI unique `arm64-v8a` ;
- `usesCleartextTraffic=true` ;
- APK non vide avec un SHA-256 consigné lors de la livraison.

## 6. Diagnostic « aucune mission »

Ne pas conclure à une absence d'affectation uniquement depuis l'écran vide. Vérifier dans cet ordre :

1. le téléphone est connecté à Tailscale ;
2. l'API répond sur `100.122.10.70:8000` ;
3. l'APK contient la bonne `apiBaseUrl` ;
4. le manifeste release autorise bien le HTTP ;
5. `/api/colab/mobile/missions` renvoie les missions du compte authentifié ;
6. après installation d'un nouvel APK, se déconnecter puis se reconnecter afin de renouveler les tokens et le cache local.

L'écran Missions affiche désormais explicitement une erreur réseau et un bouton `Réessayer`. Il n'affiche « Aucune mission assignée » qu'après une réponse serveur réussie contenant réellement une liste vide.

Toutes les requêtes mobiles ont également un délai maximal de 15 secondes. Une IP Tailscale hors ligne produit donc le message « Délai réseau dépassé » au lieu de laisser l'indicateur de chargement tourner indéfiniment.

## 7. Limite de signature

Le profil Gradle actuel signe encore `assembleRelease` avec la clé Android debug. Cet APK convient aux essais internes, mais pas à Google Play. Pour une publication, créer une clé de production protégée, configurer les secrets de signature hors Git, augmenter `versionCode`, utiliser HTTPS et vérifier les signatures v2/v3.

## 8. Notifications

Le clic Colab Studio « Notifier » crée une notification liée au compte Atlas. Atlas Terrain la récupère au démarrage, au retour au premier plan et toutes les 30 secondes lorsqu'elle est active. Elle apparaît dans l'onglet Journal et déclenche une alerte locale Android.

Le push distant quand l'application est complètement arrêtée nécessite un vrai identifiant de projet EAS dans `expo.extra.eas.projectId`. Tant que `REPLACE_WITH_EAS_PROJECT_ID` est présent, l'application ignore volontairement l'enregistrement du token Expo : les notifications en compte et le polling restent fonctionnels, mais il ne faut pas annoncer un push FCM/APNs garanti.

## 9. Créer et récupérer l'identifiant de projet Expo EAS

Cette opération doit être faite par le propriétaire du compte Expo, depuis PowerShell et dans le dossier de l'application :

```powershell
cd D:\PROJET_ATLAS_MASTER\atlas_reclone\mobile
npm install --global eas-cli
eas login
eas whoami
eas init
```

Lors de `eas init`, choisir le compte ou l'organisation propriétaire puis confirmer la création du projet `atlas-terrain`. EAS lie le projet distant à l'application et remplace automatiquement `REPLACE_WITH_EAS_PROJECT_ID` dans `app.json` par un UUID sous `expo.extra.eas.projectId`. Ne pas inventer cet identifiant et ne pas copier celui d'une autre application.

Vérifier ensuite la valeur enregistrée :

```powershell
Select-String -Path app.json -Pattern 'projectId'
eas project:info
```

Le fichier `eas.json` existe déjà dans ce projet. Pour laisser EAS vérifier ou compléter la configuration Android :

```powershell
eas build:configure
eas build --platform android --profile preview
```

Le profil `preview` produit un APK de distribution interne. Le profil `production` doit utiliser HTTPS, une signature de production et une version incrémentée.

### Activation ultérieure du push Android quand l'application est arrêtée

Le `projectId` seul ne suffit pas. Il faut également :

1. créer ou choisir un projet Firebase associé au paquet `com.intrepidcore.atlasmobile` ;
2. télécharger `google-services.json`, le placer dans `mobile/` et déclarer `expo.android.googleServicesFile` dans `app.json` ;
3. générer une clé de compte de service Firebase pour FCM v1, la conserver hors Git et l'envoyer à EAS avec `eas credentials` ;
4. reconstruire puis réinstaller l'APK EAS ;
5. vérifier qu'Atlas Terrain obtient un `ExpoPushToken`, l'enregistre auprès de l'API et reçoit un essai sur appareil réel.

La clé privée FCM ne doit jamais être commitée. Jusqu'à la réussite de cet essai de bout en bout, seules les notifications de compte récupérées par polling et les alertes locales sont considérées comme fonctionnelles.

### Modules natifs ajoutés pour le système .atlaspack (2026-08-31)

`react-native-argon2` (Argon2id, dérivation de clé hors-ligne) et `react-native-zip-archive` (lecture/écriture des archives `.atlaspack`/`.atlasreturn`) s'autolinkent normalement via `expo prebuild` — aucune configuration manuelle requise. `@noble/curves`, `@noble/hashes`, `@noble/ciphers` sont du JS pur (pas de code natif). `expo-crypto`, `expo-document-picker`, `expo-image-picker` sont des modules Expo standards. Voir `docs/mobile/ATLASPACK_SERVERLESS.md` pour l'architecture complète.
