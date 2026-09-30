const sharp = require('sharp');
const path = '/Users/kundan/.gemini/antigravity-ide/brain/7ab12fc6-1864-481d-a306-5259e3eda808/new_pigeon_logo_1790491303745.jpg';

async function run() {
  const { data, info } = await sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  
  let minX=info.width, maxX=0, minY=info.height, maxY=0;
  
  // Make pigeon brighter VS Code Blue (#0078D4), everything else transparent
  for(let y=0; y<info.height; y++) {
    for(let x=0; x<info.width; x++) {
      const idx = (y * info.width + x) * 4;
      const r = data[idx];
      if (r > 128) {
        data[idx] = 0;     // R
        data[idx+1] = 120; // G
        data[idx+2] = 212; // B
        data[idx+3] = 255; // A
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
    
  // Resize to 550x550 to add back some padding while keeping it bold
  const PIGEON_SIZE = 550;
  const pigeonScaled = await sharp(pigeonTight)
    .resize({ width: PIGEON_SIZE, height: PIGEON_SIZE, fit: 'inside' })
    .toBuffer();
    
  // Create a shadow for the pigeon
  // We'll turn it black, add some transparency, and blur it
  // Wait, sharp.modulate({ brightness: 0 }) might not work if we just want a shadow.
  // Instead, we can just extract the alpha channel and turn it into a black image with alpha.
  // A simpler way: we just apply a tint or use a composite.
  
  // Let's do the shadow manually by replacing all non-transparent pixels with black/gray
  const shadowInfo = await sharp(pigeonScaled).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const shadowData = shadowInfo.data;
  for(let i=0; i<shadowData.length; i+=4) {
    if (shadowData[i+3] > 0) {
      shadowData[i] = 0;   // R
      shadowData[i+1] = 0; // G
      shadowData[i+2] = 0; // B
      shadowData[i+3] = Math.min(255, shadowData[i+3] * 0.4); // Semi-transparent
    }
  }
  
  let pigeonShadow = await sharp(shadowData, { raw: { width: shadowInfo.info.width, height: shadowInfo.info.height, channels: 4 } }).png().toBuffer();
  pigeonShadow = await sharp(pigeonShadow).blur(8).toBuffer(); // Blur the shadow
  
  const shadowOffset = 18;
  // Calculate center offsets for a 1024x1024 canvas
  const bgSize = 1024;
  const left = Math.floor((bgSize - PIGEON_SIZE) / 2);
  const top = Math.floor((bgSize - PIGEON_SIZE) / 2);

  // Composite onto White background (255, 255, 255)
  await sharp({ create: { width: bgSize, height: bgSize, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } } })
    .composite([
      { input: pigeonShadow, left: left + shadowOffset, top: top + shadowOffset },
      { input: pigeonScaled, left, top },
      { input: 'squircle.png', blend: 'dest-in' }
    ])
    .toFile('final_icon_vscode.png');
    
  // Save full unmasked version for reference
  await sharp({ create: { width: bgSize, height: bgSize, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } } })
    .composite([
      { input: pigeonShadow, left: left + shadowOffset, top: top + shadowOffset },
      { input: pigeonScaled, left, top }
    ])
    .toFile('app-icon-vscode.png');
    
  console.log('VS Code style logo processed (Bolder, With Drop Shadow)');
}
run().catch(console.error);
