import { NodeIO } from '@gltf-transform/core';

const customPath = 'c:/Users/Haseeb Irfan/Desktop/car canvas/frontend/public/e 63/source/E63_custom.glb';

async function main() {
  try {
    const io = new NodeIO();
    console.log('Loading E63_custom.glb...');
    const document = await io.read(customPath);
    const root = document.getRoot();
    const meshes = root.listMeshes();

    console.log('\n=========================================');
    console.log('MESH POSITION MIN/MAX RANGES');
    console.log('=========================================');

    meshes.forEach(m => {
      const name = m.getName();
      const lower = name.toLowerCase();
      if (lower.includes('black') || lower.includes('wheel') || lower.includes('rim')) {
        console.log(`\nMesh: "${name}"`);
        m.listPrimitives().forEach((prim, pIdx) => {
          const positionAttr = prim.getAttribute('POSITION');
          if (positionAttr) {
            const min = positionAttr.getMin([]);
            const max = positionAttr.getMax([]);
            console.log(`  Primitive #${pIdx}:`);
            console.log(`    Min: [${min.map(v => v.toFixed(3)).join(', ')}]`);
            console.log(`    Max: [${max.map(v => v.toFixed(3)).join(', ')}]`);
          }
        });
      }
    });

  } catch (err) {
    console.error('Error running gltf-transform inspection:', err);
  }
}

main();
