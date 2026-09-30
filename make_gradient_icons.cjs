const sharp = require('sharp');
const fs = require('fs');

const path = '/Users/kundan/.gemini/antigravity-ide/brain/7ab12fc6-1864-481d-a306-5259e3eda808/new_pigeon_logo_1790491303745.jpg';

const gradients = [
  { name: 'cyan_blue', c1: '#06B6D4', c2: '#3B82F6' },
  { name: 'indigo_purple', c1: '#4F46E5', c2: '#9333EA' },
  { name: 'sunset_coral', c1: '#F43F5E', c2: '#F97316' }
];

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
      shadowData[i] = 0;   // R
      shadowData[i+1] = 0; // G
      shadowData[i+2] = 0; // B
      shadowData[i+3] = Math.min(255, shadowData[i+3] * 0.4);
    }
  }
  let pigeonShadow = await sharp(shadowData, { raw: { width: shadowInfo.info.width, height: shadowInfo.info.height, channels: 4 } }).png().toBuffer();
  pigeonShadow = await sharp(pigeonShadow).blur(8).toBuffer();
  
  const shadowOffset = 18;
  const bgSize = 1024;
  const left = Math.floor((bgSize - PIGEON_SIZE) / 2);
  const top = Math.floor((bgSize - PIGEON_SIZE) / 2);

  const outDir = '/Users/kundan/.gemini/antigravity-ide/brain/20481c94-b549-4ab6-8c55-45ad9f0a1367/scratch';
  if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
  }

  for (const grad of gradients) {
    const svgGrad = Buffer.from(`
    <svg width="${PIGEON_SIZE}" height="${PIGEON_SIZE}">
      <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${grad.c1}" />
        <stop offset="100%" stop-color="${grad.c2}" />
      </linearGradient>
      <rect width="${PIGEON_SIZE}" height="${PIGEON_SIZE}" fill="url(#g)" />
    </svg>`);
    
    const pigeonColored = await sharp(svgGrad)
      .composite([{ input: pigeonWhite, blend: 'dest-in' }])
      .png()
      .toBuffer();

    const outFile = `${outDir}/${grad.name}.png`;
      
    await sharp({ create: { width: bgSize, height: bgSize, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } } })
      .composite([
        { input: pigeonShadow, left: left + shadowOffset, top: top + shadowOffset },
        { input: pigeonColored, left, top },
        { input: '/Users/kundan/Documents/codebase/pigeon/squircle.png', blend: 'dest-in' }
      ])
      .toFile(outFile);
      
    console.log(`Generated ${outFile}`);
  }
}
run().catch(console.error);
