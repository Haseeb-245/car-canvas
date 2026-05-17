import { NodeIO } from '@gltf-transform/core';
import { center, dedup, prune } from '@gltf-transform/functions';
import { KHRONOS_EXTENSIONS } from '@gltf-transform/extensions';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const io = new NodeIO().registerExtensions(KHRONOS_EXTENSIONS);

console.log('Reading E63 GLTF...');
const doc = await io.read(path.join(__dirname, 'e 63/source/Unity2Skfb.gltf'));

console.log('Centering model...');
await doc.transform(
  dedup(),
  prune(),
  center({ pivot: 'below' }),  // pivot='below' puts the bottom at Y=0
);

console.log('Writing centered GLB...');
await io.write(path.join(__dirname, 'e 63/source/e63_centered.glb'), doc);
console.log('Done! e63_centered.glb saved.');
