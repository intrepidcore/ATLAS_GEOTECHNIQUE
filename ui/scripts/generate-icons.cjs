/**
 * Script pour générer les icônes PWA
 * 
 * Utilise un SVG de base pour créer des PNG de différentes tailles
 * Nécessite: npm install sharp
 */

const fs = require('fs');
const path = require('path');

// SVG de base pour l'icône Atlas Colab
const baseSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1e40af"/>
      <stop offset="100%" style="stop-color:#3b82f6"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="80" fill="url(#bg)"/>
  <g fill="white">
    <!-- Map pin icon -->
    <path d="M256 80c-66.3 0-120 53.7-120 120 0 90 120 200 120 200s120-110 120-200c0-66.3-53.7-120-120-120zm0 160c-22.1 0-40-17.9-40-40s17.9-40 40-40 40 17.9 40 40-17.9 40-40 40z"/>
    <!-- A letter for Atlas -->
    <text x="256" y="450" font-family="Arial, sans-serif" font-size="120" font-weight="bold" text-anchor="middle" fill="white" opacity="0.9">A</text>
  </g>
</svg>
`;

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
const outputDir = path.join(__dirname, '../public/icons');

// Créer le dossier s'il n'existe pas
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Sauvegarder le SVG de base
fs.writeFileSync(path.join(outputDir, 'icon.svg'), baseSvg.trim());
console.log('✅ icon.svg créé');

// Essayer d'utiliser sharp si disponible
async function generatePNGs() {
  try {
    const sharp = require('sharp');
    
    for (const size of sizes) {
      const outputPath = path.join(outputDir, `icon-${size}x${size}.png`);
      await sharp(Buffer.from(baseSvg))
        .resize(size, size)
        .png()
        .toFile(outputPath);
      console.log(`✅ icon-${size}x${size}.png créé`);
    }
    
    console.log('\n🎉 Toutes les icônes ont été générées!');
  } catch (err) {
    console.log('\n⚠️  sharp non disponible, création de placeholders SVG...');
    
    // Créer des fichiers SVG redimensionnés comme fallback
    for (const size of sizes) {
      const scaledSvg = baseSvg.replace('viewBox="0 0 512 512"', `viewBox="0 0 512 512" width="${size}" height="${size}"`);
      const outputPath = path.join(outputDir, `icon-${size}x${size}.svg`);
      fs.writeFileSync(outputPath, scaledSvg.trim());
      console.log(`✅ icon-${size}x${size}.svg créé (placeholder)`);
    }
    
    console.log('\n📝 Pour générer les PNG, installez sharp: npm install sharp');
    console.log('   Puis relancez: node scripts/generate-icons.js');
  }
}

generatePNGs();
