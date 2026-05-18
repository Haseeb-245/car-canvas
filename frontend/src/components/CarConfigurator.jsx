import './CarConfigurator.css';
import React, { useState, useRef, useEffect, useMemo, Suspense } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGLTF, useFBX, Environment, ContactShadows, OrbitControls, Center, useTexture, MeshReflectorMaterial } from '@react-three/drei';
import { motion, AnimatePresence } from 'framer-motion';
import * as THREE from 'three';

// Helper to darken/lighten a hex color for procedural digital camo pattern
function adjustColor(hex, percent) {
  const num = parseInt(hex.replace("#",""), 16),
        amt = Math.round(2.55 * percent),
        R = (num >> 16) + amt,
        G = (num >> 8 & 0x00FF) + amt,
        B = (num & 0x0000FF) + amt;
  return "#" + (0x1000000 + (R<255?R<0?0:R:255)*0x10000 + (G<255?G<0?0:G:255)*0x100 + (B<255?B<0?0:B:255)).toString(16).slice(1);
}

// Procedural digital camo texture generator matching the paint color
function createCamoTexture(baseColorHex) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  // Base color
  ctx.fillStyle = baseColorHex;
  ctx.fillRect(0, 0, 512, 512);

  // Camo palette
  const colors = [
    baseColorHex,
    adjustColor(baseColorHex, -35), // Darker
    adjustColor(baseColorHex, 35),  // Lighter
    '#151515'                       // Carbon Accent
  ];

  const blockSize = 16;
  for (let x = 0; x < 512; x += blockSize) {
    for (let y = 0; y < 512; y += blockSize) {
      if (Math.random() < 0.45) {
        ctx.fillStyle = colors[Math.floor(Math.random() * colors.length)];
        const w = blockSize * (1 + Math.floor(Math.random() * 3));
        const h = blockSize * (1 + Math.floor(Math.random() * 3));
        ctx.fillRect(x, y, w, h);
      }
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 4);
  return texture;
}

// Check if a mesh or part belongs to the wheel assembly
function isWheelPart(o) {
  if (!o) return false;
  const meshName = (o.name || '').toLowerCase();
  const matName = o.material ? (Array.isArray(o.material) ? o.material[0].name || '' : o.material.name || '').toLowerCase() : '';
  const parentName = o.parent && o.parent.name ? o.parent.name.toLowerCase() : '';

  return (
    meshName.includes('wheel') || 
    meshName.includes('rim') || 
    meshName.includes('tire') || 
    meshName.includes('tyre') || 
    meshName.includes('brake') || 
    meshName.includes('caliper') || 
    meshName.includes('hub') ||
    meshName.includes('disc') ||
    matName.includes('wheel') ||
    matName.includes('rim') ||
    matName.includes('tire') ||
    matName.includes('tyre') ||
    matName.includes('brake') ||
    matName.includes('caliper') ||
    matName.includes('alloy') ||
    matName.includes('rubber') ||
    parentName.includes('wheel') ||
    parentName.includes('rim') ||
    parentName.includes('tire') ||
    parentName.includes('tyre')
  );
}

const DRACO_PATH = '/draco/';

/* ─── Car data (mirrors CarSelection) ─── */
const CAR_DATA = [
  { id: 1, name: '911 GT3 RS', brand: 'PORSCHE', model: '/source/porsche_draco.glb', accentColor: '#66aaff', goldTint: '#c5a059', specs: { power: '518 HP', speed: '296 km/h', accel: '3.2s', engine: 'Flat-6 4.0L' } },
  { id: 2, name: 'AMG GT4', brand: 'MERCEDES', model: '/merc/source/merc_draco.glb', accentColor: '#88cc66', goldTint: '#8fad5a', modelScale: 0.82, specs: { power: '730 HP', speed: '315 km/h', accel: '2.9s', engine: 'V8 4.0L Biturbo' } },
  { id: 3, name: 'Supra A80', brand: 'TOYOTA', model: '/supra/source/supra_draco.glb', accentColor: '#ff6622', goldTint: '#c5a059', specs: { power: '320 HP', speed: '285 km/h', accel: '4.6s', engine: 'Inline-6 3.0L' } },
  { id: 4, name: 'Skyline GT-R R34', brand: 'NISSAN', model: '/r34/source/r34_custom_draco.glb', accentColor: '#ff3344', goldTint: '#cc3344', specs: { power: '276 HP', speed: '250 km/h', accel: '4.0s', engine: 'RB26DETT' } },
  { id: 5, name: 'AMG E63 S', brand: 'MERCEDES', model: '/e%2063/source/e63_draco.glb', accentColor: '#ffaa00', goldTint: '#c5a059', specs: { power: '612 HP', speed: '300 km/h', accel: '3.4s', engine: 'V8 4.0L Biturbo' } },
  { id: 6, name: 'Supra MkIV', brand: 'TOYOTA', model: '/supra/source/supra_draco.glb', accentColor: '#cc44ff', goldTint: '#9955cc', specs: { power: '280 HP', speed: '270 km/h', accel: '5.1s', engine: 'Inline-6 2JZ-GTE' } },
];

// Preload models for configurator
CAR_DATA.forEach(car => useGLTF.preload(car.model, DRACO_PATH));

/* ─── Configurator options ─── */
const BODY_COLORS = [
  { label: 'Obsidian Black', hex: '#0a0a0a', metalness: 0.95, roughness: 0.08 },
  { label: 'Pearl White', hex: '#f0f0ee', metalness: 0.6, roughness: 0.1 },
  { label: 'Midnight Blue', hex: '#0d1f3c', metalness: 0.9, roughness: 0.07 },
  { label: 'Racing Red', hex: '#c0152a', metalness: 0.7, roughness: 0.12 },
  { label: 'Carbon Stealth', hex: '#1a1a1a', metalness: 1.0, roughness: 0.04 },
  { label: 'Sunset Orange', hex: '#c45200', metalness: 0.75, roughness: 0.1 },
  { label: 'British Racing', hex: '#004225', metalness: 0.8, roughness: 0.09 },
  { label: 'Gold Chrome', hex: '#c5a040', metalness: 1.0, roughness: 0.03 },
  { label: 'Matte Gray', hex: '#4a4a4a', metalness: 0.3, roughness: 0.8 },
  { label: 'Deep Purple', hex: '#2d0045', metalness: 0.85, roughness: 0.08 },
];

const RIM_STYLES = [
  { label: 'Stock', icon: '◎' },
  { label: 'Mesh Spoke', icon: '✦' },
  { label: 'Deep Dish', icon: '◉' },
  { label: 'Split 5-Spoke', icon: '✺' },
  { label: 'Turbine', icon: '⦿' },
  { label: 'Forged Mono', icon: '◈' },
];

const RIM_COLORS = [
  { label: 'Gloss Black', hex: '#111111' },
  { label: 'Brushed Silver', hex: '#c0c0c0' },
  { label: 'Gold', hex: '#c5a040' },
  { label: 'Gunmetal', hex: '#3a3f45' },
  { label: 'Candy Red', hex: '#cc1122' },
  { label: 'Ceramic White', hex: '#f5f5f5' },
];

const WRAP_OPTIONS = [
  { label: 'None', class: 'wrap-none' },
  { label: 'Carbon Fiber', class: 'wrap-carbon' },
  { label: 'Brushed Steel', class: 'wrap-steel' },
  { label: 'Matte Satin', class: 'wrap-satin' },
  { label: 'Holographic', class: 'wrap-holo' },
  { label: 'Digital Camo', class: 'wrap-camo' },
];

const R34_BUMPER_OPTIONS = ['Factory Stock', 'Nismo Z-Tune Aero', 'C-West Track Spec'];
const R34_HOOD_OPTIONS = ['OEM Factory Hood', 'Nismo V-Spec Carbon', 'Z-Tune Vented Hood'];
const R34_SPOILER_OPTIONS = ['OEM Factory Wing', 'Nismo Carbon Spoiler', 'GT Wing Track Spec'];
const R34_RIM_STYLES = [
  { label: 'Factory Stock 18"', icon: '◎' },
  { label: 'Rays Volk TE37', icon: '✦' },
  { label: 'Nismo LMGT4', icon: '◈' }
];

const DEFAULT_BUMPER_OPTIONS = ['Stock', 'Aero Kit', 'Wide Body', 'Race Spec', 'Splitter'];
const DEFAULT_RIM_STYLES = [
  { label: 'Stock', icon: '◎' },
  { label: 'Mesh Spoke', icon: '✦' },
  { label: 'Deep Dish', icon: '◉' },
  { label: 'Split 5-Spoke', icon: '✺' },
  { label: 'Turbine', icon: '⦿' },
  { label: 'Forged Mono', icon: '◈' },
];

const TUNING_OPTIONS = [
  { label: 'Stage 1 ECU', hp: '+40 HP' },
  { label: 'Stage 2 Turbo', hp: '+90 HP' },
  { label: 'Stage 3 Full', hp: '+180 HP' },
  { label: 'Race Build', hp: '+260 HP' },
];
// Helper to identify R34 stock rims, tyres, and custom parts
function isR34StockRim(o) {
  if (!o) return false;
  const meshName = (o.name || '').toLowerCase();
  
  let matName = '';
  if (o.material) {
    if (Array.isArray(o.material)) {
      if (o.material[0] && o.material[0].name) matName = o.material[0].name.toLowerCase();
    } else if (o.material.name) {
      matName = o.material.name.toLowerCase();
    }
  }
  
  if (meshName.includes('rims_stock') || matName.includes('nismo_alloy') || meshName.includes('nismo_alloy')) {
    return true;
  }
  
  let p = o.parent;
  for (let i = 0; i < 3 && p; i++) {
    const pName = (p.name || '').toLowerCase();
    if (pName.includes('rims_stock')) return true;
    p = p.parent;
  }
  
  return false;
}

function isR34StockTyre(o) {
  if (!o) return false;
  const meshName = (o.name || '').toLowerCase();
  
  let matName = '';
  if (o.material) {
    if (Array.isArray(o.material)) {
      if (o.material[0] && o.material[0].name) matName = o.material[0].name.toLowerCase();
    } else if (o.material.name) {
      matName = o.material.name.toLowerCase();
    }
  }
  
  if (meshName.includes('tireblur') || meshName.includes('natireblur') || meshName.includes('tyre_stock') || matName.includes('tireblur') || matName.includes('natireblur')) {
    return true;
  }
  
  let p = o.parent;
  for (let i = 0; i < 3 && p; i++) {
    const pName = (p.name || '').toLowerCase();
    if (pName.includes('tyre_stock') || pName.includes('tireblur')) return true;
    p = p.parent;
  }
  
  return false;
}

function isR34CustomTyre(o) {
  if (!o) return false;
  const meshName = (o.name || '').toLowerCase();
  if (meshName.includes('highpolytire')) return true;
  
  let p = o.parent;
  for (let i = 0; i < 3 && p; i++) {
    const pName = (p.name || '').toLowerCase();
    if (pName.includes('highpolytire')) return true;
    p = p.parent;
  }
  
  return false;
}

// Helper to identify R34 custom rims (Vossen VFS4, Rays Volk TE37, Nismo LMGT4)
function getRimType(o) {
  if (!o) return null;
  
  // If it's a stock rim, tyre, or custom tyre, it is NOT an upgrade rim
  if (isR34StockRim(o) || isR34StockTyre(o) || isR34CustomTyre(o)) return null;

  const name = (o.name || '').toLowerCase();
  
  // Traverse up to 3 parent levels to check for group names
  let p = o.parent;
  for (let i = 0; i < 3 && p; i++) {
    const pName = (p.name || '').toLowerCase();
    if (pName.includes('vossen')) return 'vossen';
    if (pName.includes('wheel18') || pName.includes('te37')) return 'te37';
    if (pName.includes('nismo') || pName.includes('lmgt4') || pName.includes('alloy')) return 'lmgt4';
    p = p.parent;
  }

  if (name.includes('vossen')) return 'vossen';
  if (name.includes('wheel18') || name.includes('te37') || name.includes('modified_rims_1') || name === 'modified_rim_1') return 'te37';
  if (name.includes('nismo') || name.includes('lmgt4') || name.includes('alloy') || name.includes('modified_rim_2')) return 'lmgt4';

  return null;
}


/* ─── 3D Car Scene ─── */
function CarScene({ car, bodyColor, rimColor, height, rotate, bumper, rimStyle, hood, spoiler, wrap }) {
  const isFBX = car.model.endsWith('.fbx');
  return isFBX
    ? <FBXCarMesh car={car} bodyColor={bodyColor} rimColor={rimColor} height={height} rotate={rotate} bumper={bumper} rimStyle={rimStyle} hood={hood} spoiler={spoiler} wrap={wrap} />
    : <GLBCarMesh car={car} bodyColor={bodyColor} rimColor={rimColor} height={height} rotate={rotate} bumper={bumper} rimStyle={rimStyle} hood={hood} spoiler={spoiler} wrap={wrap} />;
}

function GLBCarMesh({ car, bodyColor, rimColor, height, rotate, bumper, rimStyle, hood, spoiler, wrap }) {
  const { scene } = useGLTF(car.model, DRACO_PATH);
  return <CarMeshCore scene={scene} car={car} bodyColor={bodyColor} rimColor={rimColor} height={height} rotate={rotate} bumper={bumper} rimStyle={rimStyle} hood={hood} spoiler={spoiler} wrap={wrap} />;
}

function FBXCarMesh({ car, bodyColor, rimColor, height, rotate, bumper, rimStyle, hood, spoiler, wrap }) {
  const scene = useFBX(car.model);
  return <CarMeshCore scene={scene} car={car} bodyColor={bodyColor} rimColor={rimColor} height={height} rotate={rotate} bumper={bumper} rimStyle={rimStyle} hood={hood} spoiler={spoiler} wrap={wrap} />;
}

function CarMeshCore({ scene, car, bodyColor, rimColor, height, rotate, bumper, rimStyle, hood, spoiler, wrap }) {
  const groupRef = useRef();
  const timeRef = useRef(0);

  const { invalidate } = useThree();

  const carbonNormal = useTexture('/textures/carbon_n.png');
  useEffect(() => {
    if (carbonNormal) {
      carbonNormal.wrapS = THREE.RepeatWrapping;
      carbonNormal.wrapT = THREE.RepeatWrapping;
      carbonNormal.repeat.set(25, 25);
    }
  }, [carbonNormal]);

  const carClone = useMemo(() => {
    const c = scene.clone(true);
    
    // Helper to normalize the model scale exactly like the fleet showcase page
    const autoNorm = (obj, targetSize) => {
      obj.updateWorldMatrix(true, true);
      const meshData = [];
      obj.traverse(child => {
        if (!child.isMesh || !child.visible) return;
        const b = new THREE.Box3().setFromObject(child);
        if (b.isEmpty()) return;
        const s = b.getSize(new THREE.Vector3());
        const d = Math.max(s.x, s.y, s.z);
        const center = b.getCenter(new THREE.Vector3());
        if (d > 0) meshData.push({ b, d, center });
      });
      if (!meshData.length) return obj;
      meshData.sort((a, b) => a.d - b.d);
      const ref = meshData[Math.min(Math.floor(meshData.length * 0.8), meshData.length - 1)].d;
      const sizeFiltered = meshData.filter(m => m.d <= ref * 10);
      const pool = sizeFiltered.length ? sizeFiltered : meshData;
      pool.sort((a, b) => a.center.length() - b.center.length());
      const medianCenter = pool[Math.floor(pool.length / 2)].center.clone();
      const distCutoff = ref * 50;
      const proximityFiltered = pool.filter(m => m.center.distanceTo(medianCenter) <= distCutoff);
      const final = proximityFiltered.length ? proximityFiltered : pool;
      const box = new THREE.Box3();
      final.forEach(m => box.union(m.b));
      const size = box.getSize(new THREE.Vector3());
      const normDim = size.y > 0.01 ? size.y : Math.max(size.x, size.y, size.z);
      if (normDim > 0) obj.scale.setScalar(targetSize / normDim);
      return obj;
    };

    // Helper to center and perfectly ground tires exactly like the fleet showcase page
    const centerMeshOnly = (obj) => {
      obj.updateWorldMatrix(true, true);
      const md = [];
      obj.traverse(child => {
        if (!child.isMesh || !child.visible) return;
        const b = new THREE.Box3().setFromObject(child);
        if (b.isEmpty()) return;
        const s = b.getSize(new THREE.Vector3());
        md.push({ b, d: Math.max(s.x, s.y, s.z), center: b.getCenter(new THREE.Vector3()) });
      });
      if (!md.length) return;
      md.sort((a, b) => a.d - b.d);
      const ref = md[Math.min(Math.floor(md.length * 0.8), md.length - 1)].d;
      const sorted = [...md].sort((a, b) => a.center.length() - b.center.length());
      const mc = sorted[Math.floor(sorted.length / 2)].center;
      const pool = md.filter(m => m.d <= ref * 10 && m.center.distanceTo(mc) <= ref * 30);
      const box = new THREE.Box3();
      (pool.length ? pool : md).forEach(m => box.union(m.b));
      if (box.isEmpty()) return;
      const c2 = box.getCenter(new THREE.Vector3());
      obj.position.x -= c2.x;
      obj.position.y -= box.min.y;
      obj.position.z -= c2.z;
    };

    // 1. Remove immediate root-level stray duplicate nodes far from origin (only for Skyline R34!)
    const isR34 = car.id === 4 || car.id === '4';
    if (isR34) {
      const toRemove = [];
      c.children.forEach(o => {
        if (o.position.length() > 5) {
          o.visible = false;
          toRemove.push(o);
        }
      });
      toRemove.forEach(o => o.removeFromParent());
    }

    // 2. Set frustum culling and unique material cloning on active sub-elements
    c.traverse(o => {
      if (o.isMesh) {
        o.frustumCulled = false;
        if (o.geometry) {
          if (!o.geometry.attributes.normal) o.geometry.computeVertexNormals();
          o.geometry.computeBoundingBox();
        }
        if (o.material) {
          o.material = Array.isArray(o.material)
            ? o.material.map(m => m.clone())
            : o.material.clone();
        }
      }
    });

    // 3. Normalize scale and center using precise calculations
    let scale = 1.0;
    if (car.modelScale) {
      scale = car.modelScale;
      c.scale.setScalar(scale);
    } else {
      autoNorm(c, 1.1);
      scale = c.scale.x;
    }
    centerMeshOnly(c);
    c.userData.modelScale = scale; // Cache for counter-shifts!

    // Discover the wheel assemblies (brakes, rims, tyres) dynamically for suspension offset in useFrame
    const wheelNodes = new Set();
    c.traverse(o => {
      if (o.isMesh && isWheelPart(o)) {
        let highest = o;
        let p = o.parent;
        while (p && p !== c) {
          const pName = (p.name || '').toLowerCase();
          if (
            pName.includes('wheel') || 
            pName.includes('rim') || 
            pName.includes('tire') || 
            pName.includes('tyre') ||
            pName.includes('brake') ||
            pName.includes('caliper') ||
            pName.includes('hub') ||
            pName.includes('disc') ||
            pName.includes('sus')
          ) {
            highest = p;
          }
          p = p.parent;
        }
        if (highest && highest.position) {
          if (highest.userData.originalY === undefined) {
            highest.userData.originalY = highest.position.y;
          }
          wheelNodes.add(highest);
        }
      }
    });
    c.userData.wheelNodes = Array.from(wheelNodes);

    return c;
  }, [scene, car]);

  // Apply body color paint & toggle custom parts realistically
  useEffect(() => {
    carClone.traverse(o => {
      if (!o.isMesh) return;

      const m = Array.isArray(o.material) ? o.material[0] : o.material;
      if (!m) return;

      const matName = (m.name || '').toLowerCase();
      const meshName = (o.name || '').toLowerCase();
      const parentName = o.parent && o.parent.name ? o.parent.name.toLowerCase() : '';

      // Template parts classification
      const isTemplatePart = 
        meshName.includes('modified_rim_1') || 
        meshName.includes('vossen_gns-1') ||
        parentName.includes('modified_rim_1') ||
        parentName.includes('vossen_gns-1');

      if (isTemplatePart) {
        o.visible = false;
        return;
      }

      // Rims classification
      const rimType = getRimType(o);
      const isStockRimMesh = 
        (meshName.includes('tnrrims') || matName.includes('tnrrims') || meshName.includes('natireblur') || matName.includes('natireblur')) &&
        !meshName.includes('brake') && !matName.includes('brake') &&
        !meshName.includes('tyre_stock');

      // Paint logic
      // Broadened to catch more material names, including the original R34 body paint materials
      const isPaint = matName.includes('paint') || matName.includes('body') || matName.includes('color') || meshName.includes('paint') || matName.includes('exterior') || matName.includes('base');
      const isRim = rimType !== null || isStockRimMesh || isR34StockRim(o) || matName.includes('rim') || matName.includes('alloy') || (meshName.includes('wheel') && !matName.includes('tire') && !matName.includes('wheel18'));


      if (isPaint && !matName.includes('glass') && !matName.includes('interior') && !matName.includes('black') && !matName.includes('grille')) {
        // Upgrade to MeshPhysicalMaterial for outstanding high-fidelity automotive clearcoat and iridescence look
        let activeMaterial = o.material;
        if (!(activeMaterial instanceof THREE.MeshPhysicalMaterial)) {
          const oldMat = activeMaterial;
          activeMaterial = new THREE.MeshPhysicalMaterial({
            color: oldMat.color,
            map: oldMat.map,
            normalMap: oldMat.normalMap,
            normalScale: oldMat.normalScale,
            roughness: oldMat.roughness,
            metalness: oldMat.metalness,
            aoMap: oldMat.aoMap,
            aoMapIntensity: oldMat.aoMapIntensity,
            roughnessMap: oldMat.roughnessMap,
            metalnessMap: oldMat.metalnessMap,
            envMap: oldMat.envMap,
            envMapIntensity: oldMat.envMapIntensity,
            emissive: oldMat.emissive,
            emissiveMap: oldMat.emissiveMap,
            emissiveIntensity: oldMat.emissiveIntensity,
            transparent: oldMat.transparent,
            opacity: oldMat.opacity,
            alphaMap: oldMat.alphaMap,
            side: oldMat.side
          });
          o.material = activeMaterial;
        }

        // Reset custom wrap mappings and values first
        activeMaterial.map = null;
        activeMaterial.normalMap = o.userData.originalNormalMap || activeMaterial.normalMap || null;
        if (!o.userData.originalNormalMap && activeMaterial.normalMap) {
          o.userData.originalNormalMap = activeMaterial.normalMap;
        }

        activeMaterial.color.set(bodyColor.hex);
        activeMaterial.metalness = bodyColor.metalness;
        activeMaterial.roughness = bodyColor.roughness;
        activeMaterial.clearcoat = 1.0;
        activeMaterial.clearcoatRoughness = 0.05;
        activeMaterial.iridescence = 0.0;
        activeMaterial.roughnessMap = null;
        activeMaterial.metalnessMap = null;

        // Apply PPF & Wrap-specific properties
        if (wrap === 1) {
          // Carbon Fiber wrap
          activeMaterial.color.set('#1c1c1c');
          activeMaterial.metalness = 0.8;
          activeMaterial.roughness = 0.2;
          activeMaterial.clearcoat = 1.0;
          activeMaterial.clearcoatRoughness = 0.04;
          activeMaterial.normalMap = carbonNormal;
        } else if (wrap === 2) {
          // Brushed Steel wrap
          activeMaterial.color.set('#8a8e95');
          activeMaterial.metalness = 1.0;
          activeMaterial.roughness = 0.38;
          activeMaterial.clearcoat = 0.25;
        } else if (wrap === 3) {
          // Matte Satin wrap
          activeMaterial.metalness = 0.25;
          activeMaterial.roughness = 0.7;
          activeMaterial.clearcoat = 0.0;
        } else if (wrap === 4) {
          // Holographic wrap (Pearlescent color shifting)
          activeMaterial.color.set(bodyColor.hex);
          activeMaterial.metalness = 0.15;
          activeMaterial.roughness = 0.1;
          activeMaterial.clearcoat = 1.0;
          activeMaterial.clearcoatRoughness = 0.05;
          activeMaterial.iridescence = 1.0;
          activeMaterial.iridescenceIOR = 1.8;
          activeMaterial.iridescenceThicknessRange = [100, 400];
        } else if (wrap === 5) {
          // Digital Camo wrap (Procedural canvas-based pattern!)
          if (!o.userData.camoTextures) o.userData.camoTextures = {};
          if (!o.userData.camoTextures[bodyColor.hex]) {
            o.userData.camoTextures[bodyColor.hex] = createCamoTexture(bodyColor.hex);
          }
          activeMaterial.map = o.userData.camoTextures[bodyColor.hex];
          activeMaterial.color.set('#ffffff'); // show canvas texture colors perfectly
          activeMaterial.metalness = 0.2;
          activeMaterial.roughness = 0.55;
          activeMaterial.clearcoat = 0.0;
        }

        activeMaterial.needsUpdate = true;
      }

      if (isRim && !matName.includes('tire') && !matName.includes('rubber') && !meshName.includes('tire')) {
        m.color.set(rimColor.hex);
        // Add a bit of gloss to rims
        m.metalness = 0.8;
        m.roughness = 0.2;
      }

      // R34 Custom Toggles
      if (car.id === 4 || car.id === '4') {
        // Toggle Front Bumpers & Diffusers (Front ONLY changes, Rear stays Stock!)
        if (meshName.includes('bumper') || meshName.includes('diffuser')) {
          const isFrontStock = meshName.includes('bumper_f_stock');
          const isFront1 = meshName.includes('modify_bumper_1');
          const isFront2 = meshName.includes('modified_bumper_front_2');
          const isRearStock = meshName.includes('diffuser');

          if (isFrontStock || isFront1 || isFront2) {
            if (bumper === 0) o.visible = isFrontStock;
            else if (bumper === 1) o.visible = isFront1;
            else o.visible = isFront2;
          } else if (isRearStock) {
            o.visible = true; // Rear bumper/diffuser ALWAYS remains stock!
          }
        }

        // Hide custom body kits affecting the rear/side so rear remains stock
        if (meshName.includes('kit1') && !meshName.includes('wing') && !meshName.includes('hood')) {
          o.visible = false; // Keep rear and side stock!
        }

        // Toggle Wings / Spoiler using separate spoiler state
        if (meshName.includes('wing') || meshName.includes('spoiler')) {
          const isStock = meshName.includes('stock');
          const isWing1 = meshName.includes('wing1a') || meshName.includes('wing1');
          const isWing2 = meshName.includes('wing2a') || meshName.includes('wing2');

          if (isStock || isWing1 || isWing2) {
            if (spoiler === 0) o.visible = isStock;
            else if (spoiler === 1) o.visible = isWing1;
            else o.visible = isWing2;
          }
        }

        // Toggle Hood
        if (meshName.includes('hood') && !meshName.includes('catch') && !meshName.includes('pin')) {
          const isStock = meshName.includes('stock');
          const isHood1 = meshName.includes('hood1b') || meshName.includes('hood1');
          const isHood2 = meshName.includes('hood2a') || meshName.includes('modified_hood_2');

          if (isStock || isHood1 || isHood2) {
            // Use independent hood state if provided, fallback to bumper
            const activeTier = hood !== undefined ? hood : bumper;
            if (activeTier === 0) o.visible = isStock;
            else if (activeTier === 1) o.visible = isHood1;
            else o.visible = isHood2;
          }
        }

        // ── R34 wheel/rim/tyre toggles ──
        if (isR34StockTyre(o)) {
          o.visible = (rimStyle === 0);
        } else if (isR34StockRim(o)) {
          // Stock rims (Nismo alloy) are shown when Stock (0) OR Nismo LMGT4 (2) is selected
          o.visible = (rimStyle === 0 || rimStyle === 2);
        } else if (isR34CustomTyre(o)) {
          // Custom high poly tyres are shown when TE37 (1) or LMGT4 (2) custom wheels are selected
          o.visible = (rimStyle === 1 || rimStyle === 2);
        } else if (rimType) {
          // Custom upgrade rims (TE37) are shown when TE37 (1) is selected
          if (rimStyle === 1) o.visible = (rimType === 'te37');
          else if (rimStyle === 2) o.visible = (rimType === 'lmgt4');
          else o.visible = false;
        }
      }
    });

    // Invalidate the frame loop to force immediate React Three Fiber frame redraw in "demand" loop
    invalidate();
  }, [carClone, bodyColor, rimColor, bumper, rimStyle, hood, spoiler, car.id, invalidate, wrap]);

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    timeRef.current += delta;
    if (rotate) groupRef.current.rotation.y += delta * 0.3;
    
    // Gentle float
    const floatVal = Math.sin(timeRef.current * 0.8) * 0.015;
    groupRef.current.position.y = height + floatVal;

    // Shift wheels down by suspension height + floatVal (divided by model scale!) so they stay perfectly glued to the floor in world space
    const modelScale = carClone.userData.modelScale || 1;
    if (carClone.userData.wheelNodes) {
      carClone.userData.wheelNodes.forEach(node => {
        node.position.y = node.userData.originalY - (height + floatVal) / modelScale;
      });
    }
  });

  return (
    <group ref={groupRef}>
      <primitive object={carClone} />
      {/* OPTIMIZED: resolution={256} frames={1} */}
      <ContactShadows position={[0, -0.001, 0]} opacity={0.55} scale={10} blur={3} far={1.5} color="#000" resolution={256} frames={1} />
    </group>
  );
}

/* ─── Config Panel Section ─── */
function ConfigSection({ title, icon, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`cfg-section ${open ? 'open' : ''}`}>
      <button className="cfg-section-header" onClick={() => setOpen(!open)}>
        <span className="cfg-icon">{icon}</span>
        <span className="cfg-title">{title}</span>
        <span className="cfg-chevron">{open ? '▲' : '▼'}</span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div className="cfg-section-body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Main Configurator Page ─── */
export default function CarConfigurator({ user, onOpenAuth }) {
  const { carId } = useParams();
  const navigate = useNavigate();
  // Ensure string id from URL matches numeric id in data
  const car = CAR_DATA.find(c => String(c.id) === carId) || CAR_DATA[0];

  const [bodyColor, setBodyColor] = useState(BODY_COLORS[0]);
  const [rimStyle, setRimStyle] = useState(0);
  const [rimColor, setRimColor] = useState(RIM_COLORS[0]);
  const [wrap, setWrap] = useState(0);
  const [bumper, setBumper] = useState(0);
  const [hood, setHood] = useState(0);
  const [spoiler, setSpoiler] = useState(1);
  const [carHeight, setCarHeight] = useState(0);
  const [tuning, setTuning] = useState(null);
  const [autoRotate, setAutoRotate] = useState(false);
  const [env, setEnv] = useState('showroom');
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishStatus, setPublishStatus] = useState('');
  const [story, setStory] = useState('');

  // Auto-restore saved garage configuration for this user and car
  useEffect(() => {
    if (user && car) {
      fetch(`http://localhost:5000/api/cars/saved/${user.username}`)
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data) && data.length > 0) {
            // Find the most recent saved configuration for the exact current car model
            const savedConfig = data.find(c => String(c.carId) === String(car.id));
            if (savedConfig) {
              // Restore Paint
              const matchedBodyColor = BODY_COLORS.find(c => c.hex === savedConfig.paintColor);
              if (matchedBodyColor) setBodyColor(matchedBodyColor);
              
              // Restore Wrap
              const matchedWrapIndex = WRAP_OPTIONS.findIndex(w => w.label === savedConfig.wrapType);
              if (matchedWrapIndex !== -1) setWrap(matchedWrapIndex);

              // Restore Rims
              const matchedRimColor = RIM_COLORS.find(c => c.hex === savedConfig.rimColor);
              if (matchedRimColor) setRimColor(matchedRimColor);
              if (savedConfig.rimStyle !== undefined) setRimStyle(savedConfig.rimStyle);

              // Restore Aero Kits
              if (savedConfig.bumper !== undefined) setBumper(savedConfig.bumper);
              if (savedConfig.hood !== undefined) setHood(savedConfig.hood);
              if (savedConfig.spoiler !== undefined) setSpoiler(savedConfig.spoiler);

              // Restore Stance & Tuning
              if (savedConfig.suspension !== undefined) setCarHeight(savedConfig.suspension);
              
              const matchedTuneIndex = TUNING_OPTIONS.findIndex(t => t.label === savedConfig.tuning);
              setTuning(matchedTuneIndex !== -1 ? matchedTuneIndex : null);
            }
          }
        })
        .catch(err => console.error('Failed to load garage setup:', err));
    }
  }, [user, car]);

  const handleSaveBuild = async () => {
    if (!user) {
      if (onOpenAuth) onOpenAuth();
      return;
    }
    
    setIsSaving(true);
    setSaveStatus('SAVING...');
    
    const payload = {
      username: user.username,
      carId: car.id,
      carName: car.name,
      paintColor: bodyColor.hex,
      paintType: bodyColor.metalness > 0.5 ? 'metallic' : 'glossy',
      wrapType: WRAP_OPTIONS[wrap].label,
      rimColor: rimColor.hex,
      rimSize: 19,
      rimStyle,
      bumper,
      hood,
      spoiler,
      suspension: carHeight,
      tuning: tuning != null ? TUNING_OPTIONS[tuning].label : 'Stock'
    };

    try {
      const response = await fetch('http://localhost:5000/api/cars/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (response.ok) {
        setSaveStatus('SAVED TO GARAGE!');
        setTimeout(() => setSaveStatus(''), 3000);
      } else {
        setSaveStatus('SAVE FAILED');
        setTimeout(() => setSaveStatus(''), 3000);
      }
    } catch (err) {
      console.error(err);
      setSaveStatus('NETWORK ERROR');
      setTimeout(() => setSaveStatus(''), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublishBuild = async () => {
    if (!user) {
      if (onOpenAuth) onOpenAuth();
      return;
    }
    
    setIsPublishing(true);
    setPublishStatus('PUBLISHING...');
    
    // Capture snapshot from the WebGL canvas
    const canvas = document.querySelector('.cfg-viewport canvas');
    let snapshot = '';
    if (canvas) {
      snapshot = canvas.toDataURL('image/jpeg', 0.85);
    } else {
      setPublishStatus('CANVAS ERROR');
      setIsPublishing(false);
      setTimeout(() => setPublishStatus(''), 3000);
      return;
    }

    const payload = {
      username: user.username,
      carId: car.id,
      carName: car.name,
      snapshot,
      paintColor: bodyColor.hex,
      tuning: tuning != null ? TUNING_OPTIONS[tuning].label : 'Stock',
      story
    };

    try {
      const response = await fetch('http://localhost:5000/api/feed/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (response.ok) {
        setPublishStatus('PUBLISHED!');
        setTimeout(() => setPublishStatus(''), 3000);
      } else {
        setPublishStatus('PUBLISH FAILED');
        setTimeout(() => setPublishStatus(''), 3000);
      }
    } catch (err) {
      console.error(err);
      setPublishStatus('NETWORK ERROR');
      setTimeout(() => setPublishStatus(''), 3000);
    } finally {
      setIsPublishing(false);
    }
  };

  const isR34 = car.id === 4 || car.id === '4';
  const activeBumperOptions = isR34 ? R34_BUMPER_OPTIONS : DEFAULT_BUMPER_OPTIONS;
  const activeRimStyles = isR34 ? R34_RIM_STYLES : DEFAULT_RIM_STYLES;
  const activeHoodOptions = isR34 ? R34_HOOD_OPTIONS : null;
  const activeSpoilerOptions = isR34 ? R34_SPOILER_OPTIONS : null;

  const totalHp = tuning != null ? parseInt(TUNING_OPTIONS[tuning].hp) : 0;

  // Reactively generate high-fidelity floor tile/road asphalt texture matching the active environment
  const floorTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    
    if (env === 'showroom') {
      // Luxury White Ceramic Showroom Floor Tiles
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 512, 512);
      
      // Clean modern light-grey grout borders
      ctx.strokeStyle = '#e2e8f0'; 
      ctx.lineWidth = 3;
      ctx.strokeRect(0, 0, 512, 512);
      
      // Faint inner reflection border
      ctx.strokeStyle = '#f1f5f9';
      ctx.lineWidth = 1;
      ctx.strokeRect(4, 4, 504, 504);
      
      // Ultra-soft marble vein accents
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.015)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, 100);
      ctx.bezierCurveTo(150, 200, 320, 40, 512, 360);
      ctx.stroke();
    } else if (env === 'studio') {
      // Grey Studio Land Tiles
      ctx.fillStyle = '#1c1e22';
      ctx.fillRect(0, 0, 512, 512);
      
      // Matte charcoal grout borders
      ctx.strokeStyle = '#272a30'; 
      ctx.lineWidth = 3;
      ctx.strokeRect(0, 0, 512, 512);
    } else {
      // Realistic Asphalt Road
      ctx.fillStyle = '#0a0b0d';
      ctx.fillRect(0, 0, 512, 512);
      
      // Densely randomized asphalt grain noise
      for (let i = 0; i < 5000; i++) {
        const x = Math.random() * 512;
        const y = Math.random() * 512;
        const sz = Math.random() * 1.5;
        const colorVal = Math.floor(Math.random() * 18) + 12; // low grey
        ctx.fillStyle = `rgb(${colorVal}, ${colorVal}, ${colorVal})`;
        ctx.fillRect(x, y, sz, sz);
      }
      // Asphalt seams
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.01)';
      ctx.lineWidth = 1;
      ctx.strokeRect(0, 0, 512, 512);
    }
    
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    
    // Set density repeat values: showroom = large grand tiles (6x6), studio = medium plates (12x12), road = granular grain (32x32)
    const repeatVal = env === 'showroom' ? 6 : env === 'studio' ? 12 : 32;
    tex.repeat.set(repeatVal, repeatVal);
    
  }, [env]);

  // Generates high-fidelity 'CAR CANVAS STUDIO' canvas texture to display on the studio backdrop wall
  const studioTextTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    
    // Transparent background
    ctx.clearRect(0, 0, 1024, 256);
    
    // Sleek white glowing typography
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 72px "Montserrat", "Outfit", "Inter", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Add text shadow for high-end soft lighting glow
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 12;
    
    ctx.fillText('CAR CANVAS STUDIO', 512, 128);
    
    const tex = new THREE.CanvasTexture(canvas);
    return tex;
  }, []);

  return (
    <div className="configurator-page">
      {/* ── TOP BAR ── */}
      <header className="cfg-topbar">
        <button className="cfg-back-btn" onClick={() => navigate('/')}>
          <span>←</span> FLEET
        </button>
        <div className="cfg-car-title">
          <span className="cfg-brand">{car.brand}</span>
          <h1 className="cfg-name">{car.name}</h1>
        </div>
        <div className="cfg-topbar-actions">
          <button className={`cfg-rotate-btn ${autoRotate ? 'active' : ''}`} onClick={() => setAutoRotate(v => !v)}>
            ⟳ AUTO
          </button>
          <button className="cfg-save-btn" onClick={handleSaveBuild} disabled={isSaving}>
            {saveStatus || (user ? 'SAVE BUILD' : 'SIGN IN TO SAVE')}
          </button>
          <button className="cfg-save-btn publish" style={{ background: '#cc1122', borderColor: '#ff3344', color: '#ffffff' }} onClick={handlePublishBuild} disabled={isPublishing}>
            {publishStatus || 'PUBLISH TO SHOWROOM'}
          </button>
        </div>
      </header>

      <div className="configurator-layout">
        {/* ── 3D VIEWPORT ── */}
        <div className="cfg-viewport">
          {/* Accent corner decorations */}
          <div className="cfg-corner tl" /><div className="cfg-corner tr" />
          <div className="cfg-corner bl" /><div className="cfg-corner br" />

          {/* Floating Location Environment Toggler */}
          <div className="cfg-env-toolbar">
            <button 
              className={`cfg-env-btn ${env === 'showroom' ? 'active' : ''}`}
              onClick={() => setEnv('showroom')}
            >
              🏛️ SHOWROOM
            </button>
            <button 
              className={`cfg-env-btn ${env === 'night' ? 'active' : ''}`}
              onClick={() => setEnv('night')}
            >
              🌃 NIGHT STREET
            </button>
            <button 
              className={`cfg-env-btn ${env === 'studio' ? 'active' : ''}`}
              onClick={() => setEnv('studio')}
            >
              📸 STUDIO
            </button>
          </div>

          {/* OPTIMIZED: frameloop={autoRotate ? "always" : "demand"} */}
          <Canvas
            frameloop={autoRotate ? "always" : "demand"}
            camera={{ position: [3.5, 1.2, 3.5], fov: 42 }}
            gl={{ antialias: true, alpha: true, toneMapping: THREE.ACESFilmicToneMapping, preserveDrawingBuffer: true }}
            dpr={[1, 1.5]}
          >
            <color 
              attach="background" 
              args={[
                env === 'showroom' ? '#f3f4f6' :
                env === 'night' ? '#020306' :
                '#151619'
              ]} 
            />
            
            {/* ─── SHOWROOM ENVIRONMENT: INDOOR ARCHITECTURE ─── */}
            {env === 'showroom' && (
              <group>
                {/* Back Wall */}
                <mesh position={[0, 4, -15]} receiveShadow castShadow>
                  <boxGeometry args={[30, 8, 0.2]} />
                  <meshStandardMaterial color="#ebebed" roughness={0.2} metalness={0.05} />
                </mesh>
                {/* Back Wall Branding Linear Gold Beam */}
                <mesh position={[0, 4.2, -14.85]}>
                  <boxGeometry args={[14, 0.06, 0.05]} />
                  <meshBasicMaterial color="#c5a059" />
                </mesh>
                {/* Corner Concrete Pillars */}
                <mesh position={[-15, 4, -15]} receiveShadow castShadow>
                  <boxGeometry args={[1.2, 8, 1.2]} />
                  <meshStandardMaterial color="#dadada" roughness={0.45} />
                </mesh>
                <mesh position={[15, 4, -15]} receiveShadow castShadow>
                  <boxGeometry args={[1.2, 8, 1.2]} />
                  <meshStandardMaterial color="#dadada" roughness={0.45} />
                </mesh>
                <mesh position={[-15, 4, 15]} receiveShadow castShadow>
                  <boxGeometry args={[1.2, 8, 1.2]} />
                  <meshStandardMaterial color="#dadada" roughness={0.45} />
                </mesh>
                <mesh position={[15, 4, 15]} receiveShadow castShadow>
                  <boxGeometry args={[1.2, 8, 1.2]} />
                  <meshStandardMaterial color="#dadada" roughness={0.45} />
                </mesh>
                
                {/* Left Glass Wall Pane (Windows showing daylight outside!) */}
                <group position={[-15, 4, 0]} rotation={[0, Math.PI / 2, 0]}>
                  <mesh position={[-10, 0, 0]}>
                    <boxGeometry args={[0.3, 8, 0.3]} />
                    <meshStandardMaterial color="#1a1c22" roughness={0.7} />
                  </mesh>
                  <mesh position={[0, 0, 0]}>
                    <boxGeometry args={[0.3, 8, 0.3]} />
                    <meshStandardMaterial color="#1a1c22" roughness={0.7} />
                  </mesh>
                  <mesh position={[10, 0, 0]}>
                    <boxGeometry args={[0.3, 8, 0.3]} />
                    <meshStandardMaterial color="#1a1c22" roughness={0.7} />
                  </mesh>
                  <mesh position={[-5, 0, -0.05]} castShadow>
                    <planeGeometry args={[9.6, 8]} />
                    <meshStandardMaterial color="#e0f2fe" transparent opacity={0.12} roughness={0.05} metalness={0.9} />
                  </mesh>
                  <mesh position={[5, 0, -0.05]} castShadow>
                    <planeGeometry args={[9.6, 8]} />
                    <meshStandardMaterial color="#e0f2fe" transparent opacity={0.12} roughness={0.05} metalness={0.9} />
                  </mesh>
                </group>
                
                {/* Right Glass Wall Pane */}
                <group position={[15, 4, 0]} rotation={[0, -Math.PI / 2, 0]}>
                  <mesh position={[-10, 0, 0]}>
                    <boxGeometry args={[0.3, 8, 0.3]} />
                    <meshStandardMaterial color="#1a1c22" roughness={0.7} />
                  </mesh>
                  <mesh position={[0, 0, 0]}>
                    <boxGeometry args={[0.3, 8, 0.3]} />
                    <meshStandardMaterial color="#1a1c22" roughness={0.7} />
                  </mesh>
                  <mesh position={[10, 0, 0]}>
                    <boxGeometry args={[0.3, 8, 0.3]} />
                    <meshStandardMaterial color="#1a1c22" roughness={0.7} />
                  </mesh>
                  <mesh position={[-5, 0, -0.05]} castShadow>
                    <planeGeometry args={[9.6, 8]} />
                    <meshStandardMaterial color="#e0f2fe" transparent opacity={0.12} roughness={0.05} metalness={0.9} />
                  </mesh>
                  <mesh position={[5, 0, -0.05]} castShadow>
                    <planeGeometry args={[9.6, 8]} />
                    <meshStandardMaterial color="#e0f2fe" transparent opacity={0.12} roughness={0.05} metalness={0.9} />
                  </mesh>
                </group>

                {/* Showroom Ceiling with Daylight Skylight */}
                <group position={[0, 8, 0]}>
                  <mesh position={[0, 0, -10]} receiveShadow castShadow>
                    <boxGeometry args={[30, 0.3, 10]} />
                    <meshStandardMaterial color="#2d2d34" roughness={0.65} />
                  </mesh>
                  <mesh position={[0, 0, 10]} receiveShadow castShadow>
                    <boxGeometry args={[30, 0.3, 10]} />
                    <meshStandardMaterial color="#2d2d34" roughness={0.65} />
                  </mesh>
                  <mesh position={[0, 0.1, 0]}>
                    <boxGeometry args={[30, 0.05, 10]} />
                    <meshStandardMaterial color="#141416" metalness={0.95} roughness={0.1} />
                  </mesh>
                </group>
              </group>
            )}

            {/* ─── NIGHT STREET ENVIRONMENT: CYBERPUNK LIGHT COLUMNS ─── */}
            {env === 'night' && (
              <group>
                {/* Neon Streetlamp Left */}
                <mesh position={[-7, 3.5, -6]} castShadow>
                  <cylinderGeometry args={[0.06, 0.06, 7]} />
                  <meshStandardMaterial color="#08090f" metalness={0.9} roughness={0.2} />
                </mesh>
                <mesh position={[-7, 7, -6]}>
                  <sphereGeometry args={[0.3]} />
                  <meshBasicMaterial color="#00ffff" toneMapped={false} />
                </mesh>
                
                {/* Neon Streetlamp Right */}
                <mesh position={[7, 3.5, 6]} castShadow>
                  <cylinderGeometry args={[0.06, 0.06, 7]} />
                  <meshStandardMaterial color="#08090f" metalness={0.9} roughness={0.2} />
                </mesh>
                <mesh position={[7, 7, 6]}>
                  <sphereGeometry args={[0.3]} />
                  <meshBasicMaterial color="#ff00cc" toneMapped={false} />
                </mesh>

                {/* Background vertical light tubes to represent city night reflections */}
                <mesh position={[-14, 4.5, -12]} rotation={[0, Math.PI / 4, 0]}>
                  <boxGeometry args={[0.15, 9, 0.15]} />
                  <meshBasicMaterial color="#00ffff" toneMapped={false} />
                </mesh>
                <mesh position={[14, 4.5, 12]} rotation={[0, -Math.PI / 4, 0]}>
                  <boxGeometry args={[0.15, 9, 0.15]} />
                  <meshBasicMaterial color="#ff00cc" toneMapped={false} />
                </mesh>
              </group>
            )}

            {/* ─── STUDIO ENVIRONMENT: PHYSICAL ROOF LAMP & CANVAS BRANDING ─── */}
            {env === 'studio' && (
              <group>
                {/* Dark photography infinity studio back wall */}
                <mesh position={[0, 4, -12]} receiveShadow>
                  <boxGeometry args={[30, 8, 0.2]} />
                  <meshStandardMaterial color="#111215" roughness={0.85} metalness={0.05} />
                </mesh>
                
                {/* Left side enclosing wall */}
                <mesh position={[-15, 4, 0]} rotation={[0, Math.PI / 2, 0]} receiveShadow>
                  <boxGeometry args={[30, 8, 0.2]} />
                  <meshStandardMaterial color="#111215" roughness={0.85} metalness={0.05} />
                </mesh>

                {/* Right side enclosing wall */}
                <mesh position={[15, 4, 0]} rotation={[0, -Math.PI / 2, 0]} receiveShadow>
                  <boxGeometry args={[30, 8, 0.2]} />
                  <meshStandardMaterial color="#111215" roughness={0.85} metalness={0.05} />
                </mesh>

                {/* Studio Ceiling/Roof */}
                <mesh position={[0, 8, 0]} rotation={[Math.PI / 2, 0, 0]} receiveShadow>
                  <planeGeometry args={[30, 30]} />
                  <meshStandardMaterial color="#131418" roughness={0.8} />
                </mesh>

                {/* "CAR CANVAS STUDIO" Back Wall Text Sign */}
                <mesh position={[0, 4.2, -11.85]}>
                  <planeGeometry args={[14, 3.5]} />
                  <meshBasicMaterial map={studioTextTexture} transparent opacity={0.88} toneMapped={false} />
                </mesh>

                {/* ─── Physical Roof Lamp (Overhead Softbox Panel) Hanging from Ceiling ─── */}
                {/* Left Steel Support Wire */}
                <mesh position={[-2, 6.8, 0]}>
                  <cylinderGeometry args={[0.012, 0.012, 2.4]} />
                  <meshStandardMaterial color="#2d2d30" metalness={0.9} roughness={0.1} />
                </mesh>
                {/* Right Steel Support Wire */}
                <mesh position={[2, 6.8, 0]}>
                  <cylinderGeometry args={[0.012, 0.012, 2.4]} />
                  <meshStandardMaterial color="#2d2d30" metalness={0.9} roughness={0.1} />
                </mesh>
                {/* Rectangular Studio Softbox Casing hanging at y = 5.6 */}
                <mesh position={[0, 5.6, 0]} castShadow>
                  <boxGeometry args={[4.5, 0.15, 2.2]} />
                  <meshStandardMaterial color="#0b0c0e" roughness={0.3} metalness={0.85} />
                </mesh>
                {/* Glowing light face pointing straight down */}
                <mesh position={[0, 5.51, 0]} rotation={[Math.PI / 2, 0, 0]}>
                  <planeGeometry args={[4.3, 2.0]} />
                  <meshBasicMaterial color="#ffffff" toneMapped={false} />
                </mesh>
              </group>
            )}
            
            {/* ─── LIGHTING SETUPS ─── */}
            <ambientLight 
              intensity={
                env === 'showroom' ? 0.78 :
                env === 'night' ? 0.15 :
                0.95
              } 
            />
            <directionalLight 
              position={
                env === 'showroom' ? [12, 14, 12] :
                env === 'studio' ? [0, 5.5, 0] : 
                [5, 8, 5]
              } 
              intensity={
                env === 'showroom' ? 2.8 :
                env === 'night' ? 0.35 :
                3.5
              } 
              color={env === 'showroom' ? '#fff9f0' : '#ffffff'}
              castShadow 
              shadow-mapSize={[512, 512]}
            />
            <directionalLight 
              position={
                env === 'showroom' ? [-12, 10, -12] :
                env === 'studio' ? [0, 12, 0] : 
                [5, 2, 5]
              } 
              intensity={
                env === 'showroom' ? 1.8 :
                env === 'night' ? 2.8 :
                2.2
              } 
              color={
                env === 'showroom' ? '#e0f2fe' :
                env === 'night' ? '#ff00cc' : 
                '#ffffff'
              } 
            />
            <directionalLight 
              position={[-5, 2, -5]} 
              intensity={
                env === 'showroom' ? 1.2 :
                env === 'night' ? 2.2 :
                1.5
              } 
              color={
                env === 'showroom' ? '#ffffff' :
                env === 'night' ? '#00ffff' : 
                '#ffffff'
              } 
            />
            <pointLight 
              position={[0, 4.5, 0]} 
              color={env === 'night' ? '#00ffff' : car.accentColor} 
              intensity={
                env === 'showroom' ? 1.6 :
                env === 'night' ? 2.6 :
                0
              } 
              distance={env === 'night' ? 10 : 8} 
            />
            
            {/* ─── 3D CAR INSTANCE ─── */}
            <Suspense fallback={null}>
              <CarScene
                car={car}
                bodyColor={bodyColor}
                rimColor={rimColor}
                height={carHeight}
                rotate={autoRotate}
                bumper={bumper}
                rimStyle={rimStyle}
                hood={hood}
                spoiler={spoiler}
                wrap={wrap}
              />
              <Environment 
                preset={
                  env === 'showroom' ? 'city' :
                  env === 'night' ? 'night' :
                  'studio'
                } 
                background
                blur={0}
              />
            </Suspense>
            <OrbitControls
              enableZoom={true}
              enablePan={false}
              minDistance={2}
              maxDistance={8}
              minPolarAngle={Math.PI * 0.15}
              maxPolarAngle={Math.PI * 0.55}
              autoRotate={autoRotate}
              enableDamping={true}
              dampingFactor={0.25}
            />
            
            {/* ─── REAL-TIME REFLECTIVE GROUND ─── */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.002, 0]} receiveShadow>
              <planeGeometry args={[80, 80]} />
              <MeshReflectorMaterial
                blur={[300, 50]}
                resolution={512}
                mixBlur={1}
                mixStrength={env === 'night' ? 2.5 : env === 'showroom' ? 0.95 : 0.8}
                roughness={env === 'night' ? 0.05 : env === 'showroom' ? 0.08 : 0.22}
                depthScale={1.2}
                minDepthThreshold={0.4}
                maxDepthThreshold={1.4}
                color="#ffffff"
                map={floorTexture}
                metalness={env === 'showroom' ? 0.7 : env === 'night' ? 0.85 : 0.1}
                mirror={0.88}
              />
            </mesh>
          </Canvas>

          {/* Live stats overlay */}
          <div className="cfg-hud">
            <div className="cfg-hud-item">
              <span className="hud-label">PAINT</span>
              <span className="hud-val">{bodyColor.label}</span>
            </div>
            <div className="cfg-hud-item">
              <span className="hud-label">RIMS</span>
              <span className="hud-val">{activeRimStyles[rimStyle]?.label || 'Stock'}</span>
            </div>
            <div className="cfg-hud-item">
              <span className="hud-label">STANCE</span>
              <span className="hud-val">{carHeight === 0 ? 'STOCK' : carHeight < 0 ? `${Math.abs(Math.round(carHeight * 100))}mm LOW` : `${Math.round(carHeight * 100)}mm LIFT`}</span>
            </div>
            {tuning != null && (
              <div className="cfg-hud-item accent">
                <span className="hud-label">TUNE</span>
                <span className="hud-val">+{totalHp} HP</span>
              </div>
            )}
          </div>
        </div>

        {/* ── PANEL ── */}
        <aside className="cfg-panel">
          <div className="cfg-panel-inner">

            <ConfigSection title="Body Color" icon="🎨" defaultOpen>
              <div className="color-swatches">
                {BODY_COLORS.map((c, i) => (
                  <button key={i}
                    className={`color-swatch ${bodyColor.hex === c.hex ? 'active' : ''}`}
                    style={{ '--swatch': c.hex, '--metal': c.metalness }}
                    onClick={() => setBodyColor(c)}
                    title={c.label}
                  >
                    <span className="swatch-dot" />
                    <span className="swatch-label">{c.label}</span>
                  </button>
                ))}
              </div>
            </ConfigSection>

            <ConfigSection title="Rims & Wheels" icon="⚙️">
              <p className="cfg-sub-label">Style</p>
              <div className="rim-grid">
                {activeRimStyles.map((r, i) => (
                  <button key={i}
                    className={`rim-btn ${rimStyle === i ? 'active' : ''}`}
                    onClick={() => setRimStyle(i)}
                  >
                    <span className="rim-icon">{r.icon}</span>
                    <span>{r.label}</span>
                  </button>
                ))}
              </div>
              <p className="cfg-sub-label" style={{ marginTop: '14px' }}>Finish</p>
              <div className="rim-colors">
                {RIM_COLORS.map((c, i) => (
                  <button key={i}
                    className={`rim-color-btn ${rimColor.hex === c.hex ? 'active' : ''}`}
                    style={{ '--rc': c.hex }}
                    onClick={() => setRimColor(c)}
                    title={c.label}
                  />
                ))}
              </div>
            </ConfigSection>

            <ConfigSection title="Bumper & Aero" icon="🏎️">
              <div className="bumper-list">
                {activeBumperOptions.map((b, i) => (
                  <button key={i}
                    className={`bumper-btn ${bumper === i ? 'active' : ''}`}
                    onClick={() => setBumper(i)}
                  >
                    {b}
                  </button>
                ))}
              </div>
            </ConfigSection>

            {activeHoodOptions && (
              <ConfigSection title="Hood Options" icon="🏁">
                <div className="bumper-list">
                  {activeHoodOptions.map((h, i) => (
                    <button key={i}
                      className={`bumper-btn ${hood === i ? 'active' : ''}`}
                      onClick={() => setHood(i)}
                    >
                      {h}
                    </button>
                  ))}
                </div>
              </ConfigSection>
            )}

            {activeSpoilerOptions && (
              <ConfigSection title="Spoiler Options" icon="✈️">
                <div className="bumper-list">
                  {activeSpoilerOptions.map((s, i) => (
                    <button key={i}
                      className={`bumper-btn ${spoiler === i ? 'active' : ''}`}
                      onClick={() => setSpoiler(i)}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </ConfigSection>
            )}

            <ConfigSection title="Ride Height" icon="↕️">
              <div className="height-control">
                <span className="height-label">LOW</span>
                <input type="range" min={-0.08} max={0.08} step={0.005}
                  value={carHeight}
                  onChange={e => setCarHeight(parseFloat(e.target.value))}
                  className="height-slider"
                />
                <span className="height-label">HIGH</span>
              </div>
              <p className="height-readout">
                {carHeight === 0 ? 'STOCK HEIGHT' :
                  carHeight < 0 ? `${Math.abs(Math.round(carHeight * 1000))}mm DROP` :
                    `${Math.round(carHeight * 1000)}mm LIFT`}
              </p>
            </ConfigSection>

            <ConfigSection title="PPF & Wraps" icon="✨">
              <div className="wrap-grid">
                {WRAP_OPTIONS.map((w, i) => (
                  <button key={i}
                    className={`wrap-btn ${wrap === i ? 'active' : ''} ${w.class}`}
                    onClick={() => setWrap(i)}
                  >
                    {w.label}
                  </button>
                ))}
              </div>
            </ConfigSection>

            <ConfigSection title="Performance Tuning" icon="⚡">
              <div className="tuning-list">
                {TUNING_OPTIONS.map((t, i) => (
                  <button key={i}
                    className={`tuning-btn ${tuning === i ? 'active' : ''}`}
                    onClick={() => setTuning(tuning === i ? null : i)}
                  >
                    <span className="tune-label">{t.label}</span>
                    <span className="tune-hp">{t.hp}</span>
                  </button>
                ))}
              </div>
              {tuning != null && (
                <div className="tune-bar-wrap">
                  <div className="tune-bar" style={{ width: `${Math.min(100, (totalHp / 260) * 100)}%` }} />
                </div>
              )}
            </ConfigSection>

            <ConfigSection title="Showroom Story & Experience" icon="✍️">
              <textarea
                value={story}
                onChange={e => setStory(e.target.value)}
                placeholder="Share your build experience, track day thoughts, or dynamic configuration history here..."
                style={{
                  width: '100%',
                  minHeight: '100px',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '6px',
                  padding: '10px',
                  fontSize: '0.8rem',
                  color: '#fff',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                  marginTop: '0.5rem',
                  lineHeight: '1.4'
                }}
              />
            </ConfigSection>

          </div>

          {/* Summary footer */}
          <div className="cfg-summary">
            <div className="summary-row">
              <span>Build Summary</span>
              <span className="summary-tag">{car.brand} {car.name}</span>
            </div>
            <div className="summary-mods">
              {[bodyColor.label, activeRimStyles[rimStyle]?.label, activeBumperOptions[bumper], WRAP_OPTIONS[wrap].label].filter(Boolean).join(' · ')}
              {tuning != null ? ` · ${TUNING_OPTIONS[tuning].label}` : ''}
            </div>
            <button className="cfg-cta" onClick={handleSaveBuild} disabled={isSaving}>
              {saveStatus || (user ? 'SAVE BUILD TO GARAGE →' : 'SIGN IN TO SAVE BUILD →')}
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}