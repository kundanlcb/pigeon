const sharp = require('sharp');

async function run() {
  const info = await sharp('app-icon.png').ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const data = info.data;
  let minX=info.info.width, maxX=0, minY=info.info.height, maxY=0;
  
  for(let y=0; y<info.info.height; y++) {
    for(let x=0; x<info.info.width; x++) {
      const idx = (y * info.info.width + x) * 4;
      if (data[idx+3] > 0) { // not fully transparent
        if(x < minX) minX = x;
        if(x > maxX) maxX = x;
        if(y < minY) minY = y;
        if(y > maxY) maxY = y;
      }
    }
  }
  
  console.log(`Bounds for app-icon.png: width=${maxX-minX}, height=${maxY-minY}, canvas=${info.info.width}x${info.info.height}`);
  
  // also check squircle.png
  const sqInfo = await sharp('squircle.png').ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const sqData = sqInfo.data;
  let sminX=sqInfo.info.width, smaxX=0, sminY=sqInfo.info.height, smaxY=0;
  for(let y=0; y<sqInfo.info.height; y++) {
    for(let x=0; x<sqInfo.info.width; x++) {
      const idx = (y * sqInfo.info.width + x) * 4;
      if (sqData[idx+3] > 0) {
        if(x < sminX) sminX = x;
        if(x > smaxX) smaxX = x;
        if(y < sminY) sminY = y;
        if(y > smaxY) smaxY = y;
      }
    }
  }
  console.log(`Bounds for squircle.png: width=${smaxX-sminX}, height=${smaxY-sminY}, canvas=${sqInfo.info.width}x${sqInfo.info.height}`);
}
run().catch(console.error);
