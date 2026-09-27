import { Jimp } from 'jimp';

async function fixIcon() {
  console.log('Loading icon.png...');
  const image = await Jimp.read('src-tauri/icons/icon.png');
  
  console.log('Autocropping...');
  image.autocrop({ tolerance: 0.05, cropOnlyFrames: false });
  
  console.log('Resizing to 1024x1024 (recommended for Tauri)...');
  image.resize({ w: 1024, h: 1024 });
  
  console.log('Saving as app-icon.png...');
  await image.write('app-icon.png');
  console.log('Done.');
}

fixIcon().catch(console.error);
