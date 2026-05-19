import { NodeIO } from '@gltf-transform/core';
import fs from 'fs';

const customPath = 'c:/Users/Haseeb Irfan/Desktop/car canvas/frontend/public/e 63/source/E63_custom.glb';
const outputPath = 'c:/Users/Haseeb Irfan/Desktop/car canvas/frontend/src/components/all_meshes_dump.txt';

async function main() {
  try {
    const io = new NodeIO();
    console.log('Loading E63_custom.glb...');
    const document = await io.read(customPath);
    const root = document.getRoot();
    const meshes = root.listMeshes();

    let output = '';
    output += '=========================================\n';
    output += 'ALL MESHES IN E63_custom.glb\n';
    output += '=========================================\n';

    meshes.forEach((m, idx) => {
      const name = m.getName();
      let primInfo = [];
      let totalVertices = 0;
      
      m.listPrimitives().forEach((prim, pIdx) => {
        const positionAttr = prim.getAttribute('POSITION');
        const mat = prim.getMaterial();
        const matName = mat ? mat.getName() : 'None';
        let count = 0;
        let minStr = '';
        let maxStr = '';
        if (positionAttr) {
          count = positionAttr.getCount();
          totalVertices += count;
          minStr = JSON.stringify(positionAttr.getMin([]).map(v => parseFloat(v.toFixed(3))));
          maxStr = JSON.stringify(positionAttr.getMax([]).map(v => parseFloat(v.toFixed(3))));
        }
        primInfo.push(`Prim #${pIdx}: Mat="${matName}" | Verts=${count} | Min=${minStr} | Max=${maxStr}`);
      });

      output += `\nMesh #${idx}: "${name}" (Total Verts: ${totalVertices})\n`;
      primInfo.forEach(info => {
        output += `  ${info}\n`;
      });
    });

    fs.writeFileSync(outputPath, output, 'utf8');
    console.log('Successfully wrote mesh dump to all_meshes_dump.txt');

  } catch (err) {
    console.error('Error running mesh dump:', err);
  }
}

main();
