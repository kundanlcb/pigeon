const sharp = require('sharp');
async function run() {
  await sharp('app-icon.png')
    .composite([{
      input: 'squircle.png',
      blend: 'dest-in'
    }])
    .toFile('final_icon.png');
  console.log('Fixed');
}
run();
