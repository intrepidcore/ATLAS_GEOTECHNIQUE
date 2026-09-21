// Mock Jest pour react-native-argon2 (module natif, indisponible sous Jest).
// Convention Jest : un fichier ici sous ce nom mocke automatiquement le
// module pour TOUS les tests, sans jest.mock() explicite par fichier.
// Ne fait AUCUN calcul Argon2id réel — seulement de quoi laisser les écrans
// qui importent la chaîne unlock.ts/argon2.ts se charger sous Jest.
// La compatibilité cryptographique réelle est vérifiée hors Jest
// (cf. docs/mobile/ATLASPACK_SERVERLESS.md, vérification croisée node-argon2).
module.exports = async function argon2Mock(_password, _salt, _options) {
  return { rawHash: '00'.repeat(32), encodedHash: '$argon2id$v=19$m=1,t=1,p=1$AA$AA' };
};
