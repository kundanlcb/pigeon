const Jimp = require('jimp');

async function fixIcon() {
  console.log('Loading icon.png...');
  const image = await Jimp.read('src-tauri/icons/icon.png');
  
  console.log('Autocropping transparent padding...');
  // autocrop removes borders of the same color as the top-left pixel (which is transparent).
  image.autocrop(0.01, false);
  
  console.log('Resizing to full 1024x1024 square...');
  image.resize(1024, 1024);
  
  console.log('Saving as app-icon.png...');
  await image.writeAsync('app-icon.png');
  console.log('Done.');
}

fixIcon().catch(console.error);
