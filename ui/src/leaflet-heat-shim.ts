/**
 * Point d'entrée unique pour `leaflet.heat`.
 *
 * Le plugin n'a aucun import : rien n'imposait à Rollup de l'évaluer après
 * Leaflet, d'où `ReferenceError: L is not defined` et une page blanche
 * (le chunk entier échouait, React ne montait jamais).
 *
 * L'ordre des déclarations d'import ci-dessous impose l'ordre d'évaluation :
 * `leaflet-global` (qui publie window.L) d'abord, le plugin ensuite.
 * Importer CE module, jamais `leaflet.heat` directement.
 */
import L from './leaflet-global';
import 'leaflet.heat';

export default L;
