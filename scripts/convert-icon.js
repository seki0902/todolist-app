/**
 * Convert the new app logo (PNG) into all required icon formats.
 * Usage: node scripts/convert-icon.js
 */
const sharp = require('sharp');
const toIco = require('to-ico');
const fs = require('fs');
const path = require('path');

const SOURCE = path.resolve('C:/Users/EDY/Downloads/应用logo.png');
const DEST_DIR = path.resolve('build-resources');

// ICO sizes Windows uses
const ICO_SIZES = [16, 32, 48, 64, 128, 256];
// PNG size for electron-builder (recommended 1024x1024)
const PNG_SIZE = 1024;

async function main() {
  const srcBuffer = fs.readFileSync(SOURCE);
  const src = sharp(srcBuffer);

  // 1. Generate icon.png at 1024x1024 (already done, but redo for safety)
  console.log(`Generating icon.png (${PNG_SIZE}x${PNG_SIZE})...`);
  await src
    .resize(PNG_SIZE, PNG_SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(path.join(DEST_DIR, 'icon.png'));
  console.log('  ✓ icon.png');

  // 2. Generate multi-resolution icon.ico using to-ico
  console.log(`Generating icon.ico with sizes: ${ICO_SIZES.join(', ')}...`);
  const pngBuffers = await Promise.all(
    ICO_SIZES.map(size =>
      sharp(srcBuffer)
        .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer()
    )
  );

  const icoBuffer = await toIco(pngBuffers);
  fs.writeFileSync(path.join(DEST_DIR, 'icon.ico'), icoBuffer);
  console.log('  ✓ icon.ico');

  // 3. Remove old SVG since the new source is PNG
  const svgPath = path.join(DEST_DIR, 'icon.svg');
  if (fs.existsSync(svgPath)) {
    fs.unlinkSync(svgPath);
    console.log('  ✓ Removed old icon.svg (source is now PNG)');
  }

  console.log('\n✅ All icon formats generated successfully!');
}

main().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
