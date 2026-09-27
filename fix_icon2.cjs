const sharp = require('sharp');
async function run() {
  await sharp('app-icon.png')
    .resize(768, 768)
    .extend({
      top: 128,
      bottom: 128,
      left: 128,
      right: 128,
      background: { r: 37, g: 41, b: 45, alpha: 1 }
    })
    .composite([{
      input: 'squircle.png',
      blend: 'dest-in'
    }])
    .toFile('final_icon.png');
  console.log('Fixed exactly');
}
run();
