// data/ 内の写真を走査して manifest.js を生成する。写真を追加・変更したら実行する:
//   node scripts/build-manifest.js
const fs = require('fs');
const path = require('path');
const { parsePhotoName } = require('../quiz.js');

const root = path.join(__dirname, '..');
const photos = fs
  .readdirSync(path.join(root, 'data'))
  .sort()
  .map(parsePhotoName)
  .filter(Boolean);

const out = 'window.PHOTOS = ' + JSON.stringify(photos, null, 2) + ';\n';
fs.writeFileSync(path.join(root, 'manifest.js'), out, 'utf8');

const people = new Set(photos.map((p) => p.person));
console.log(`manifest.js を生成しました: ${photos.length} 枚 / ${people.size} 人`);
