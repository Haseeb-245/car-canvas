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
const dracoPath = 'c:/Users/Haseeb Irfan/Desktop/car canvas/frontend/public/e 63/source/e63_custom_draco.glb';

try {
  console.log('Parsing E63_custom.glb (Uncompressed)...');
  const gltfCustom = getGLTFJson(customPath);

  console.log('Parsing e63_custom_draco.glb (Draco)...');
  const gltfDraco = getGLTFJson(dracoPath);

  console.log('\n=========================================');
  console.log('COMPARING TYRE MESH VERTEX COUNTS');
  console.log('=========================================');

  const tyreNodeNames = [
    'Meshesblack00151',
    'Meshesblack00231',
    'Meshesblack00321',
    'Meshesblack101',
    'Meshesblack111',
    'Meshesblack121',
    'Meshesblack91',
    'Stock_rims'
  ];

  function inspectFile(gltf, label) {
    console.log(`\n--- FILE: ${label} ---`);
    if (!gltf.nodes) {
      console.log('No nodes found.');
      return;
    }

    tyreNodeNames.forEach(nodeName => {
      const node = gltf.nodes.find(n => n.name === nodeName);
      if (!node) {
        console.log(`Node "${nodeName}": NOT FOUND`);
        return;
      }

      if (node.mesh === undefined) {
        console.log(`Node "${nodeName}": No mesh property`);
        return;
      }

      const mesh = gltf.meshes[node.mesh];
      if (!mesh) {
        console.log(`Node "${nodeName}": Mesh index ${node.mesh} not in meshes array`);
        return;
      }

      console.log(`Node "${nodeName}" -> Mesh #${node.mesh}: "${mesh.name}"`);
      if (mesh.primitives) {
        mesh.primitives.forEach((prim, pIdx) => {
          const matName = prim.material !== undefined ? gltf.materials[prim.material]?.name : 'None';
          
          // Check for standard POSITION attribute
          const posAccessorIdx = prim.attributes?.['POSITION'];
          let vertexCount = 'N/A';
          if (posAccessorIdx !== undefined) {
            const accessor = gltf.accessors[posAccessorIdx];
            vertexCount = accessor ? accessor.count : 'Unknown';
          }

          // Check if Draco compression extension is present
          const draco = prim.extensions?.['KHR_draco_mesh_compression'];
          if (draco) {
            // Under Draco, the attributes mapping lists position accessor index in the main accessor array
            const dracoPosAccessorIdx = draco.attributes?.['POSITION'];
            let dracoVertexCount = 'N/A';
            if (dracoPosAccessorIdx !== undefined) {
              // Note: draco.attributes maps attribute name to its local attribute ID in draco buffer, 
              // but the prim.attributes still contains accessor indices!
              const accessorIdx = prim.attributes?.['POSITION'];
              if (accessorIdx !== undefined) {
                const accessor = gltf.accessors[accessorIdx];
                dracoVertexCount = accessor ? accessor.count : 'Unknown';
              }
            }
            console.log(`   Prim #${pIdx} (Draco): Mat="${matName}" | Vertices=${dracoVertexCount} | AccessorIdx=${prim.attributes?.['POSITION']}`);
          } else {
            console.log(`   Prim #${pIdx} (Standard): Mat="${matName}" | Vertices=${vertexCount} | AccessorIdx=${posAccessorIdx}`);
          }
        });
      }
    });
  }

  inspectFile(gltfCustom, 'E63_custom.glb (Uncompressed)');
  inspectFile(gltfDraco, 'e63_custom_draco.glb (Draco)');

} catch (err) {
  console.error('Error inspecting files:', err);
}
