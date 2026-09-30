const sharp = require('sharp');
const fs = require('fs');

const path = '/Users/kundan/.gemini/antigravity-ide/brain/7ab12fc6-1864-481d-a306-5259e3eda808/new_pigeon_logo_1790491303745.jpg';

async function run() {
  const { data, info } = await sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  
  let minX=info.width, maxX=0, minY=info.height, maxY=0;
  
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
  
  const fullIsolated = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
  
  const pigeonTight = await sharp(fullIsolated)
    .extract({ left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 })
    .toBuffer();
    
  const PIGEON_SIZE = 550;
  const pigeonWhite = await sharp(pigeonTight)
    .resize({ width: PIGEON_SIZE, height: PIGEON_SIZE, fit: 'inside' })
    .toBuffer();
    
  const shadowInfo = await sharp(pigeonWhite).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const shadowData = shadowInfo.data;
  for(let i=0; i<shadowData.length; i+=4) {
    if (shadowData[i+3] > 0) {
      shadowData[i] = 0;
      shadowData[i+1] = 0;
      shadowData[i+2] = 0;
      shadowData[i+3] = Math.min(255, shadowData[i+3] * 0.4);
    }
  }
  let pigeonShadow = await sharp(shadowData, { raw: { width: shadowInfo.info.width, height: shadowInfo.info.height, channels: 4 } }).png().toBuffer();
  pigeonShadow = await sharp(pigeonShadow).blur(8).toBuffer();
  
  const shadowOffset = 18;
  const bgSize = 1024;
  const left = Math.floor((bgSize - PIGEON_SIZE) / 2);
  const top = Math.floor((bgSize - PIGEON_SIZE) / 2);

  const bgGradSvg = Buffer.from(`
    <svg width="${bgSize}" height="${bgSize}">
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#F43F5E" />
        <stop offset="100%" stop-color="#F97316" />
      </linearGradient>
      <rect width="${bgSize}" height="${bgSize}" fill="url(#bg)" />
    </svg>`);

  const bgSquircle = await sharp(bgGradSvg)
    .composite([{ input: '/Users/kundan/Documents/codebase/pigeon/squircle.png', blend: 'dest-in' }])
    .png()
    .toBuffer();

  const outFile = 'final_icon_coral_inverted.png';
  
  await sharp({ create: { width: bgSize, height: bgSize, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([
      { input: bgSquircle },
      { input: pigeonShadow, left: left + shadowOffset, top: top + shadowOffset },
      { input: pigeonWhite, left, top }
    ])
    .toFile(outFile);
    
  console.log(`Generated ${outFile}`);
}
run().catch(console.error);
