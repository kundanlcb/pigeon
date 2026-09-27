const sharp = require('sharp');
const path = '/Users/kundan/.gemini/antigravity-ide/brain/7ab12fc6-1864-481d-a306-5259e3eda808/new_pigeon_logo_1790491303745.jpg';

async function run() {
  const { data, info } = await sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  
  let minX=info.width, maxX=0, minY=info.height, maxY=0;
  
  // Make background transparent, pigeon white
  for(let y=0; y<info.height; y++) {
    for(let x=0; x<info.width; x++) {
      const idx = (y * info.width + x) * 4;
      const r = data[idx];
      if (r > 128) {
        data[idx] = 255;
        data[idx+1] = 255;
        data[idx+2] = 255;
        data[idx+3] = 255;
        if(x < minX) minX = x;
        if(x > maxX) maxX = x;
        if(y < minY) minY = y;
        if(y > maxY) maxY = y;
      } else {
        data[idx] = 0;
        data[idx+1] = 0;
        data[idx+2] = 0;
        data[idx+3] = 0;
      }
    }
  }
  
  // Create an image from the raw buffer
  const fullIsolated = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
  
  // Extract tight bounding box
  const pigeonTight = await sharp(fullIsolated)
    .extract({ left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 })
    .toBuffer();
    
  // Resize to 450x450 for much more padding
  const pigeonScaled = await sharp(pigeonTight)
    .resize({ width: 450, height: 450, fit: 'inside' })
    .toBuffer();
    
  // Composite onto dark background
  await sharp({ create: { width: 1024, height: 1024, channels: 4, background: { r: 37, g: 41, b: 45, alpha: 1 } } })
    .composite([
      { input: pigeonScaled },
      { input: 'squircle.png', blend: 'dest-in' }
    ])
    .toFile('final_icon.png');
    
  // Save full unmasked version for reference
  await sharp({ create: { width: 1024, height: 1024, channels: 4, background: { r: 37, g: 41, b: 45, alpha: 1 } } })
    .composite([
      { input: pigeonScaled }
    ])
    .toFile('app-icon.png');
    
  console.log('Logo processed');
}
run().catch(console.error);
