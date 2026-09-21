const { withAndroidManifest, withAppBuildGradle, withGradleProperties } = require('@expo/config-plugins');

/**
 * Configuration Android propre au déploiement terrain Atlas.
 *
 * Le backend de ce poste est joint par HTTP à travers le tunnel chiffré
 * Tailscale. Android 9+ bloque le HTTP par défaut dans un build release : la
 * permission doit donc être ajoutée au manifeste principal par prebuild, et
 * pas uniquement au manifeste debug généré par Expo.
 */
module.exports = function withAtlasAndroidBuild(config, options = {}) {
  const allowCleartext = options.allowCleartext === true;
  const architectures = options.architectures || 'arm64-v8a';

  config = withAndroidManifest(config, (androidConfig) => {
    const application = androidConfig.modResults.manifest.application?.[0];
    if (!application) {
      throw new Error('AndroidManifest.xml ne contient pas de noeud application');
    }

    application.$ = application.$ || {};
    application.$['android:usesCleartextTraffic'] = allowCleartext ? 'true' : 'false';
    return androidConfig;
  });

  config = withGradleProperties(config, (androidConfig) => {
    const properties = androidConfig.modResults;
    const existing = properties.find(
      (entry) => entry.type === 'property' && entry.key === 'reactNativeArchitectures'
    );

    if (existing) {
      existing.value = architectures;
    } else {
      properties.push({ type: 'property', key: 'reactNativeArchitectures', value: architectures });
    }
    return androidConfig;
  });

  // Certaines dépendances Expo embarquent leurs quatre ABI même lorsque
  // reactNativeArchitectures est défini. Le filtre NDK dans defaultConfig est
  // nécessaire pour obtenir réellement un APK ARM64 uniquement.
  config = withAppBuildGradle(config, (androidConfig) => {
    if (androidConfig.modResults.language !== 'groovy') {
      throw new Error('Le plugin Atlas attend un fichier app/build.gradle Groovy');
    }

    const marker = '// ATLAS_MOBILE_ABI_FILTER';
    if (!androidConfig.modResults.contents.includes(marker)) {
      const abiValues = architectures
        .split(',')
        .map((abi) => `"${abi.trim()}"`)
        .join(', ');
      const versionNameLine = /^\s+versionName\s+.*$/m;
      if (!versionNameLine.test(androidConfig.modResults.contents)) {
        throw new Error('Impossible de trouver versionName dans app/build.gradle');
      }
      androidConfig.modResults.contents = androidConfig.modResults.contents.replace(
        versionNameLine,
        (line) => `${line}\n        ${marker}\n        ndk { abiFilters ${abiValues} }`
      );
    }
    return androidConfig;
  });

  return config;
};
