/**
 * Expose Leaflet en global (`window.L`).
 *
 * Nécessaire pour les plugins de style UMD (leaflet.heat…) qui font
 * `L.xxx = ...` à l'évaluation en supposant que Leaflet est déjà global.
 * L'effet de bord doit vivre dans SON PROPRE module : les déclarations
 * `import` étant hoistées, une assignation placée dans le même fichier que
 * l'import du plugin s'exécuterait trop tard.
 */
import L from 'leaflet';

(globalThis as unknown as { L: typeof L }).L = L;

export default L;
