import fs from 'fs';
import path from 'path';

const ROOT = 'https://ureuzkxyyozzzluzawwr.supabase.co/storage/v1/object/public/images';
const OUT = path.resolve('public/images');

const legends = [
  'bangalore', 'fuse', 'ash', 'mad maggie', 'ballistic', 'pathfinder', 'wraith', 'octane', 'revenant', 'horizon', 'alter', 'axle',
  'bloodhound', 'crypto', 'valkyrie', 'seer', 'vantage', 'sparrow', 'gibraltar', 'lifeline', 'mirage', 'loba', 'newcastle',
  'conduit', 'caustic', 'wattson', 'rampart', 'catalyst', 'unknown',
];
const ranks = ['rookie', 'bronze', 'silver', 'gold', 'platinum', 'diamond', 'master', 'predator', 'unranked'];
const events = ['events/kill.png', 'events/death1.png', 'events/knockdown.png', 'events/respawn.png', 'events/revive.png'];
const maps = [
  'worlds_edge_s30.png', 'worlds_edge_s29.png', 'olympus.png', 'storm_point.png', 'kings_canyon.png', 'broken_moon.png', 'e_district.png',
  'thumbnail-worlds_edge.png', 'thumbnail-kings_canyon.png', 'thumbnail-olympus.png', 'thumbnail-storm_point.png', 'thumbnail-broken_moon.png', 'thumbnail-e-district.png',
];

function walk(dir, acc) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, acc);
    else if (/\.(ts|tsx)$/.test(entry.name)) acc.push(full);
  }
}

const files = new Set([...maps, ...events, ...legends.map((name) => `${name}.png`), ...ranks.map((name) => `${name}.png`)]);
const sources = [];
walk('src', sources);
for (const file of sources) {
  const text = fs.readFileSync(file, 'utf8');
  for (const match of text.matchAll(/\/images\/([^"'`\s)]+?\.png)/g)) {
    files.add(decodeURIComponent(match[1]));
  }
}
for (const file of [...files]) {
  if (
    file.startsWith('events/')
    || file.startsWith('thumbnail-')
    || maps.includes(file)
    || file.endsWith('_silhouette.png')
  ) continue;
  if (legends.some((name) => file === `${name}.png`) || ranks.some((name) => file === `${name}.png`)) continue;
  const stem = file.replace(/\.png$/i, '');
  files.add(`${stem}_silhouette.png`);
}

async function download(file) {
  const dest = path.join(OUT, file);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  if (fs.existsSync(dest) && fs.statSync(dest).size > 0) return 'skip';
  const remote = `${ROOT}/${file.split('/').map(encodeURIComponent).join('/')}`;
  const res = await fetch(remote);
  if (!res.ok) return `miss ${res.status}`;
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(dest, buf);
  return `ok ${Math.round(buf.length / 1024)}KB`;
}

let ok = 0;
let miss = 0;
const queue = [...files];
console.log('files', queue.length);
const workers = Array.from({ length: 4 }, async () => {
  while (queue.length) {
    const file = queue.shift();
    const result = await download(file);
    if (result.startsWith('miss')) {
      miss += 1;
      console.log(result, file);
    } else if (result !== 'skip') {
      ok += 1;
      if (result.includes('KB') && Number(result.split(' ')[1].replace('KB', '')) > 500) console.log(result, file);
    }
  }
});
await Promise.all(workers);
console.log('downloaded', ok, 'missing', miss);
