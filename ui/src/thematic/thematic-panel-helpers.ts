/**
 * Helper pour mettre à jour l'affichage du custom select palette
 */
export function updateCustomPaletteDisplay(paletteValue: string): void {
  const customContainer = document.querySelector('.palette-custom-select') as HTMLElement
  if (!customContainer) return
  
  const PALETTE_OPTIONS = [
    { value: 'Blues', label: 'Bleus', colors: ['#f7fbff', '#deebf7', '#c6dbef', '#9ecae1', '#6baed6', '#4292c6', '#2171b5', '#08519c', '#08306b'] },
    { value: 'Greens', label: 'Verts', colors: ['#f7fcf5', '#e5f5e0', '#c7e9c0', '#a1d99b', '#74c476', '#41ab5d', '#238b45', '#006d2c', '#00441b'] },
    { value: 'Reds', label: 'Rouges', colors: ['#fff5f0', '#fee0d2', '#fcbba1', '#fc9272', '#fb6a4a', '#ef3b2c', '#cb181d', '#a50f15', '#67000d'] },
    { value: 'Oranges', label: 'Oranges', colors: ['#fff5eb', '#fee6ce', '#fdd0a2', '#fdae6b', '#fd8d3c', '#f16913', '#d94801', '#a63603', '#7f2704'] },
    { value: 'Purples', label: 'Violets', colors: ['#fcfbfd', '#efedf5', '#dadaeb', '#bcbddc', '#9e9ac8', '#807dba', '#6a51a3', '#54278f', '#3f007d'] },
    { value: 'YlOrRd', label: 'Jaune-Orange-Rouge', colors: ['#ffffcc', '#ffeda0', '#fed976', '#feb24c', '#fd8d3c', '#fc4e2a', '#e31a1c', '#bd0026', '#800026'] },
    { value: 'YlGnBu', label: 'Jaune-Vert-Bleu', colors: ['#ffffd9', '#edf8b1', '#c7e9b4', '#7fcdbb', '#41b6c4', '#1d91c0', '#225ea8', '#253494', '#081d58'] },
    { value: 'RdYlGn', label: 'Rouge-Jaune-Vert', colors: ['#a50026', '#d73027', '#f46d43', '#fdae61', '#fee08b', '#d9ef8b', '#a6d96a', '#66bd63', '#1a9850'] },
    { value: 'Spectral', label: 'Spectral', colors: ['#9e0142', '#d53e4f', '#f46d43', '#fdae61', '#fee08b', '#e6f598', '#abdda4', '#66c2a5', '#3288bd'] },
    { value: 'Viridis', label: 'Viridis', colors: ['#440154', '#482878', '#3e4989', '#31688e', '#26828e', '#1f9e89', '#35b779', '#6ece58', '#b5de2b'] }
  ]
  
  const palette = PALETTE_OPTIONS.find(p => p.value === paletteValue)
  if (!palette) return
  
  const selectedEl = customContainer.querySelector('.palette-selected') as HTMLElement
  if (!selectedEl) return
  
  const gradientEl = selectedEl.querySelector('.palette-gradient') as HTMLElement
  const nameEl = selectedEl.querySelector('.palette-name') as HTMLElement
  
  if (gradientEl) {
    const gradient = `linear-gradient(to right, ${palette.colors.join(', ')})`
    gradientEl.style.background = gradient
  }
  if (nameEl) {
    nameEl.textContent = palette.label
  }
  
  // Mettre à jour la sélection visuelle dans le dropdown
  const dropdownEl = customContainer.querySelector('.palette-dropdown') as HTMLElement
  if (dropdownEl) {
    dropdownEl.querySelectorAll('.palette-option').forEach(opt => {
      const optValue = (opt as HTMLElement).dataset.value
      if (optValue === paletteValue) {
        opt.classList.add('selected')
      } else {
        opt.classList.remove('selected')
      }
    })
  }
}
