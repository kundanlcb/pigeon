const sharp = require('sharp');
async function run() {
  await sharp('app-icon.png')
    .resize(800, 800) // Scale the logo down so it fits nicely inside the squircle
    .extend({
      top: 112,
      bottom: 112,
      left: 112,
      right: 112,
      background: { r: 37, g: 41, b: 45, alpha: 1 } // Fill the new padding with the exact same background color
    })
    .composite([{
      input: 'squircle.png', // This will mask the edges with the perfect squircle shape and transparent corners
      blend: 'dest-in'
    }])
    .toFile('final_icon.png');
  console.log('Fixed');
}
run();
