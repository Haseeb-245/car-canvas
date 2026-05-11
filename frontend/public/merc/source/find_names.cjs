const fs = require('fs');
const path = require('path');

function findNames(obj) {
    let names = [];
    if (obj.name) names.push(obj.name);
    if (obj.nodes) {
        obj.nodes.forEach(node => {
            names = names.concat(findNames(node));
        });
    }
    if (obj.meshes) {
        obj.meshes.forEach(mesh => {
            if (mesh.name) names.push(mesh.name);
            if (mesh.primitives) {
                mesh.primitives.forEach(p => {
                    // primitives don't usually have names but let's check
                });
            }
        });
    }
    return names;
}

const glbPath = path.join(__dirname, 'mercedes_amg_gt4.glb');
const data = fs.readFileSync(glbPath);
const content = data.toString('utf8');

// Simple regex to find names in a GLB/JSON
const names = content.match(/"name":"([^"]+)"/g);
if (names) {
    const uniqueNames = [...new Set(names.map(n => n.split('"')[3]))];
    console.log(uniqueNames.filter(n => n.length > 2).join('\n'));
} else {
    console.log("No names found via regex");
}
