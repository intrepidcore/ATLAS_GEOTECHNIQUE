# Atlas Terrain (mobile)

App React Native (Expo) pour étudiants et superviseurs en mission de terrain. Remplace à terme le PWA `ui/src/pages/mobile/*`.

Documentation complète : [docs/mobile/](../docs/mobile/) — roadmap, ADR, SDD.

## Démarrer en développement

```bash
cd mobile
npm install
npm run start        # menu Expo (web / iOS simulator / Android emulator / device via Expo Go)
npm run typecheck
npm test
```

Configure `API_BASE_URL` dans `app.json` (`expo.extra.apiBaseUrl`) pour pointer vers ton backend `api-geo` local.

## Builder pour iOS / Android

Nécessite un compte Expo (gratuit) — voir [ADR-MOBILE-003](../docs/mobile/adr/ADR-MOBILE-003-strategie-build-eas.md).

```bash
npm install -g eas-cli
eas login
eas build --platform android --profile preview   # APK installable directement
eas build --platform ios --profile preview        # nécessite un compte Apple Developer
```
