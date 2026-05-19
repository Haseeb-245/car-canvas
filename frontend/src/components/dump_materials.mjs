import fs from 'fs';

function getGLTFJson(modelPath) {
  const fd = fs.openSync(modelPath, 'r');
  const headerBuf = Buffer.alloc(12);
  fs.readSync(fd, headerBuf, 0, 12, 0);

  const chunkHeaderBuf = Buffer.alloc(8);
  fs.readSync(fd, chunkHeaderBuf, 0, 8, 12);
  const chunkLength = chunkHeaderBuf.readUInt32LE(0);

  const jsonBuf = Buffer.alloc(chunkLength);
  fs.readSync(fd, jsonBuf, 0, chunkLength, 20);
  fs.closeSync(fd);

  return JSON.parse(jsonBuf.toString('utf8'));
}

const customPath = 'c:/Users/Haseeb Irfan/Desktop/car canvas/frontend/public/e 63/source/E63_custom.glb';

try {
  const gltf = getGLTFJson(customPath);
  console.log('=== MESHES AND MATERIALS ===');
  
  gltf.nodes.forEach((node, idx) => {
    if (node.mesh === undefined) return;
    const mesh = gltf.meshes[node.mesh];
    
    console.log(`Node #${idx} "${node.name}" | MeshName: "${mesh.name}"`);
    mesh.primitives.forEach((prim, primIdx) => {
      const matIdx = prim.material;
      if (matIdx !== undefined) {
        const mat = gltf.materials[matIdx];
        console.log(`  Primitive #${primIdx} | Material #${matIdx}: "${mat.name}"`);
        if (mat.pbrMetallicRoughness) {
          console.log(`    BaseColorFactor: ${JSON.stringify(mat.pbrMetallicRoughness.baseColorFactor)}`);
          console.log(`    MetallicFactor: ${mat.pbrMetallicRoughness.metallicFactor}`);
          console.log(`    RoughnessFactor: ${mat.pbrMetallicRoughness.roughnessFactor}`);
        }
      } else {
        console.log(`  Primitive #${primIdx} | No Material`);
      }
    });
  });

} catch (err) {
  console.error('Error:', err);
}
