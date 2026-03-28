/**
 * Icônes vectorielles minimalistes (style Lucide : viewBox 24×24, stroke 2, round caps).
 * Usage : innerHTML ou template strings dans le panneau vanilla.
 */
const svgWrap = (path: string, attrs = '') =>
  `<svg class="btn-icon-svg" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${attrs}>${path}</svg>`

export const icons = {
  map: () =>
    svgWrap(
      '<path d="M14.106 5.553a2 2 0 0 0-1.788 0l-7.447 3.724a1 1 0 0 0-.553.894v6.758a1 1 0 0 0 .553.894l7.447 3.724a2 2 0 0 0 1.788 0l7.447-3.724a1 1 0 0 0 .553-.894V10.17a1 1 0 0 0-.553-.894z"/><path d="M15 6.51l-6-3"/><path d="M3.51 9.5 12 13.5l8.49-4"/>'
    ),
  refreshCw: () =>
    svgWrap(
      '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>'
    ),
  flaskConical: () =>
    svgWrap(
      '<path d="M10 2v7.527a2 2 0 0 1-.211.896L4.72 20.55a1 1 0 0 0 .9 1.45h12.76a1 1 0 0 0 .9-1.45l-5.07-10.127A2 2 0 0 1 14 9.527V2"/><path d="M8.5 2h7"/><path d="M7 16h10"/>'
    ),
  /** Réseau / IA (équivalent visuel « cerveau » minimal) */
  brain: () =>
    svgWrap(
      '<circle cx="5" cy="12" r="2"/><circle cx="12" cy="5" r="2"/><circle cx="12" cy="19" r="2"/><circle cx="19" cy="12" r="2"/><path d="M7 12h3M14 12h3M12 7v3M12 14v3"/>'
    ),
  check: () => svgWrap('<path d="M20 6 9 17l-5-5"/>'),
  crosshair: () =>
    svgWrap(
      '<circle cx="12" cy="12" r="10"/><path d="M22 12h-4"/><path d="M6 12H2"/><path d="M12 6V2"/><path d="M12 22v-4"/>'
    ),
  rotateCcw: () =>
    svgWrap(
      '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>'
    ),
  upload: () =>
    svgWrap(
      '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/>'
    ),
  bookOpen: () =>
    svgWrap(
      '<path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-5a4 4 0 0 1-4-4 4 4 0 0 1-4 4z"/>'
    ),
  image: () =>
    svgWrap(
      '<rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>'
    ),
  layers: () =>
    svgWrap(
      '<path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>'
    ),
  fileJson: () =>
    svgWrap(
      '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 12.004a1.5 1.5 0 1 1-1.499 1.5"/><path d="M14 12.004a1.5 1.5 0 1 1-1.499 1.5"/><path d="M10 16.004h4"/>'
    ),
  save: () =>
    svgWrap(
      '<path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7"/><path d="M7 3v4a1 1 0 0 0 1 1h7"/>'
    ),
  panelRight: () =>
    svgWrap(
      '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M15 3v18"/><path d="M10 15l-3-3 3-3"/>'
    ),
}
