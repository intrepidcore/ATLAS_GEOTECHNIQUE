# Système `.atlaspack` — paquets opérateur hors-ligne

Workflow serverless pour le terrain : **Atlas Colab → paquet opérateur signé/chiffré → app mobile 100% hors-ligne → export terrain → réimport Atlas Colab**, sans dépendance réseau obligatoire à aucune étape du terrain.

Contexte : pivot décidé le 2026-08-31 suite à l'échec du mode "API en ligne via Tailscale" (tunnel/appareil hors-ligne imprévisibles sur le terrain).

## 1. Vue d'ensemble

```
Atlas Colab (staff)                     Téléphone opérateur (terrain)              Atlas Colab (staff)
────────────────────                    ──────────────────────────────             ────────────────────
Mission créée/assignée
  │  (hook automatique)
  ▼
Job de génération .atlaspack
  │  (worker DB-backed)
  ▼
Paquet signé + chiffré ──────────USB/WhatsApp/Bluetooth──────►  Import + vérification
  (Colab Studio, onglet                                          (signature, empreintes,
   "Paquets terrain")                                             expiration, version)
                                                                          │
                                                                  Connexion hors-ligne
                                                                  (email + mot de passe)
                                                                          │
                                                                  Missions, carte hors-ligne,
                                                                  sondages, essais labo,
                                                                  pièces jointes, journal d'audit
                                                                          │
                                                                  Export .atlasreturn signé
                                                                          │
                                                            ◄──USB/WhatsApp/Bluetooth──
                                                                          ▼
                                                          Réimport (Colab Studio, "Paquets
                                                          terrain" → Réimporter un retour)
                                                          Vérification intégrité + idempotent
```

## 2. Format `.atlaspack`

Archive ZIP contenant :

| Fichier | Contenu | Protection |
|---|---|---|
| `manifest.json` | Métadonnées (version, expiration, missions, sel/paramètres Argon2id, empreintes des autres fichiers) | Signé (voir ci-dessous) |
| `manifest.sig` | Signature Ed25519 détachée de `manifest.json` (64 octets bruts) | — |
| `data.bin` | Identité opérateur + missions + points + carte, en JSON | Chiffré ChaCha20-Poly1305 |
| `maps/offline.mbtiles` | Tuiles raster hors-ligne (spec MBTiles 1.3) | Empreinte SHA-256 dans le manifeste |

### Chiffrement et authentification hors-ligne

Le mot de passe de l'opérateur n'est **jamais** transmis ni stocké en clair, y compris dans le paquet. Le mécanisme repose entièrement sur Argon2id, déjà utilisé pour `atlas.users.password_hash` :

1. Le serveur copie le sel et les paramètres Argon2id (`m`, `t`, `p`, longueur) du hash déjà stocké de l'opérateur — en clair dans `manifest.json` (le sel n'est pas secret).
2. Le serveur dérive `data_key = HKDF-SHA256(argon2_raw_output, salt=package_id, info="atlas-pack-data-v1")` — `argon2_raw_output` étant les octets bruts déjà présents dans le hash PHC stocké (aucun recalcul, le mot de passe en clair n'est jamais requis côté serveur).
3. `data.bin = ChaCha20-Poly1305(data_key, payload)`.
4. Hors-ligne, le mobile recalcule `Argon2id(mot_de_passe_saisi, sel, m, t, p)` (bibliothèque native `react-native-argon2`, implémentation de référence — **vérifié bit-à-bit identique** à la sortie du crate Rust `argon2` via une vérification croisée avec `node-argon2`, cf. §5), dérive la même `data_key`, et tente le déchiffrement.
5. Le succès du déchiffrement (tag Poly1305 valide) **est** la preuve que le mot de passe est correct — pas de comparaison de hash séparée.

Ce mécanisme évite toute primitive maison : Argon2id (RFC 9106), HKDF-SHA256 (RFC 5869), ChaCha20-Poly1305 (RFC 8439) — implémentations RustCrypto côté serveur, `@noble/hashes`/`@noble/ciphers` (pur JS, audité, sans WASM — Hermes ne l'exécute pas) côté mobile.

### Signature

`manifest.json` est signé avec Ed25519 (clé privée serveur uniquement, jamais distribuée). Le mobile embarque uniquement la clé **publique** à la compilation (`app.json` → `extra.atlasPackPublicKeyB64`) et vérifie la signature sur les octets bruts du fichier tel que stocké dans l'archive — jamais une re-sérialisation locale, pour éviter tout risque de divergence de format JSON entre client et serveur.

Génération de la paire de clés : `cargo run --manifest-path services/api-geo/Cargo.toml --bin generate_atlaspack_keys`.

### Vérifications à l'import (exigence #1 et #6)

Dans l'ordre, échec = rejet complet, rien n'est persisté :

1. Signature Ed25519 de `manifest.json`.
2. Version de format (`format_version`) compatible avec l'application.
3. Non expiré (`expires_at`).
4. Empreinte SHA-256 + taille de `data.bin` conformes au manifeste.
5. Empreinte/taille de `maps/offline.mbtiles` si présent.

## 3. Cycle de vie du paquet côté Colab

Table `atlas.atlaspack_packages`, un paquet "courant" par opérateur (index unique partiel sur `not_prepared/preparing/ready`) :

```
not_prepared ──► preparing ──► ready ──► stale (mission/affectation modifiée)
                     │                       │
                     └──► failed             └──► (nouveau not_prepared généré, superseded_by)
```

Déclenché automatiquement (`atlaspack::jobs::enqueue_or_refresh_package_for_student`) :
- création de mission avec `assigned_student_ids`,
- affectation/désaffectation d'un étudiant,
- réattribution de mission,
- **toute modification de mission déjà assignée** (ex: passage `draft` → `planned`).

File de génération DB-backed (`atlas.atlaspack_generation_jobs`, pattern `SELECT ... FOR UPDATE SKIP LOCKED` — identique à `colab::email_worker`, pas de nouveau système).

## 4. Cartographie hors-ligne

Le périmètre est calculé à partir des missions **actives** (statut `planned`/`in_progress`) de l'opérateur, bbox de chaque maille + marge configurable (`ATLASPACK_MAP_MARGIN_M`, défaut 800 m), zoom `ATLASPACK_TILE_ZOOM_MIN`..`ATLASPACK_TILE_ZOOM_MAX` (défaut 12–17). Un garde-fou (`ATLASPACK_TILE_MAX_COUNT`, défaut 15000) réduit automatiquement le zoom max si dépassé — jamais silencieux : `manifest.map_coverage.truncated` + `truncation_reason` tracent la décision.

Côté mobile, `maps/offline.mbtiles` est décomposé une fois en arborescence `{z}/{x}/{y}.png` sous le stockage local (`services/atlaspack/offlineTiles.ts`), chargée par Leaflet via `file://` dans la WebView (`allowFileAccess`/`allowUniversalAccessFromFileURLs`). Le fond "Hors-ligne (paquet)" devient le fond par défaut quand disponible ; les fonds distants (OSM, Carto, Esri...) restent sélectionnables si le réseau revient.

**Limite résiduelle connue** : l'explosion MBTiles → fichiers via `expo-sqlite` n'a pu être vérifiée que par lecture de code (types `Uint8Array` pour les colonnes BLOB), pas par exécution réelle sur un appareil — aucun émulateur/device disponible dans cet environnement de développement. À vérifier lors du premier test réel sur le téléphone.

## 5. Vérification croisée de compatibilité cryptographique

Effectuée pendant l'implémentation (2026-08-31), avec un vecteur réel généré par le vrai backend (opérateur `protazertyuiop@gmail.com`, `package_id=0b3ca9a7-b534-49ae-91ea-a95670b3bf69`) :

- **Argon2id** : `argon2` (Rust, RustCrypto) vs `node-argon2` (binding natif, implémentation de référence — même famille que `react-native-argon2` sur Android/iOS) → sortie brute strictement identique (mêmes mot de passe/sel/m=65536/t=3/p=4/longueur=32) : `f1fdb1f75cbf741438ea34d14706d78062c79dc10d3b435cfbff977c7fc2ed26`.
- **Ed25519** : signature générée par `ed25519-dalek` (Rust) vérifiée avec succès par `@noble/curves` (JS, la bibliothèque réellement embarquée dans l'app mobile) sur le manifeste réel — `SIGNATURE_VALID=true`, rejet confirmé sur contenu modifié.
- **Déchiffrement bout-en-bout** : Argon2id (node-argon2) → HKDF-SHA256 (`@noble/hashes`) → ChaCha20-Poly1305 (`@noble/ciphers`) appliqué au `data.bin` réel du paquet ci-dessus, avec le vrai mot de passe de test → déchiffrement réussi, contenu JSON cohérent (email opérateur, missions).

Ces trois vérifications utilisent les bibliothèques **réellement embarquées côté mobile** (pas des équivalents supposés compatibles), donnant une garantie directe que le mécanisme fonctionnera sur le téléphone.

## 6. Journal d'audit (exigence #5)

Table locale `audit_log` (mobile) + `atlas.atlaspack_audit_events` (serveur, alimentée au réimport d'un `.atlasreturn`). Écrit automatiquement par les services (pas par les écrans directement) : connexion, ouverture de mission, capture GPS, point alternatif, export, import de paquet, sauvegarde. Consultable dans l'app via Profil → Journal d'audit.

## 7. États de collecte (exigence #9)

- **Non exporté** : aucune ligne dans `exports_log` (mobile) référençant la mission.
- **Exporté** : ligne `exports_log.state = 'exported'` après un export `.atlasreturn` réussi.
- **Importé par le bureau** : `exports_log.state = 'imported_hq'`, mis à jour uniquement après confirmation serveur (`GET /colab/atlaspack/returns/:id/status`) — **opportuniste, jamais requis** : le workflow V1 reste 100% fonctionnel sans qu'un téléphone ne repasse jamais en ligne.

## 8. Sauvegarde locale (exigence #8)

`services/atlaspack/backup.ts` — export JSON horodaté et hashé (SHA-256) de toutes les tables locales de collecte (hors tuiles, régénérables depuis un nouveau paquet), restaurable indépendamment de la présence antérieure de l'app. Écran Profil → Sauvegarde locale.

## 9. Limites connues et hors-périmètre V1

- Le contrôle d'intégrité HMAC d'un `.atlasreturn` échoue si le mot de passe de l'opérateur a changé entre l'émission du paquet et le réimport (dérivation de clé différente) — rejet explicite, pas de contournement automatique.
- Décomposition MBTiles non testée sur device réel (cf. §4).
- Pas de gestion multi-clé de signature en rotation active (la table `atlas.atlaspack_signing_keys` le permet, mais aucune UI de rotation n'a été construite).
- Notifications push distantes toujours hors-périmètre (nécessitent Firebase FCM + un vrai projet EAS, indépendant de ce chantier).
- Limite de taille de paquet non explicitement plafonnée (seul `ATLASPACK_TILE_MAX_COUNT` borne la partie cartographique) — à surveiller si une mission couvre une zone inhabituellement grande.
