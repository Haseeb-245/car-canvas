import React, { useState, useRef, useEffect, useMemo, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Canvas, useFrame } from '@react-three/fiber';
import { Environment, useGLTF, ContactShadows, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';

// 🔧 Local Draco decoder (files copied to /public/draco/)
const DRACO_PATH = '/draco/';

const CAR_DATA = [
  { id: 4, name: 'Skyline GT-R R34', brand: 'NISSAN',  model: '/r34/source/r34_custom_draco.glb',      accentColor: '#ff3344', goldTint: '#cc3344', specs: { power: '276 HP',  speed: '250 km/h', accel: '4.0s', engine: 'RB26DETT' } },
  { id: 5, name: 'AMG E63 S',      brand: 'MERCEDES',  model: '/e%2063/source/e63_draco.glb',   accentColor: '#ffaa00', goldTint: '#c5a059', specs: { power: '612 HP',  speed: '300 km/h', accel: '3.4s', engine: 'V8 4.0L Biturbo' } },
  { id: 6, name: 'Supra MkIV',     brand: 'TOYOTA',    model: '/supra/source/supra_draco.glb',  accentColor: '#cc44ff', goldTint: '#9955cc', specs: { power: '280 HP',  speed: '270 km/h', accel: '5.1s', engine: 'Inline-6 2JZ-GTE' } },
];

// 🔧 Preload with local Draco path deleted to accelerate initial load time
const BEAM_H = 2.4;
const HOLO_Y  = 2.4;
const IRIS_R  = 1.8;

/* ─────────────────────── Hologram shader ─────────────────────── */
const hologramShader = {
  vertexShader: `
    varying vec3 vWorldPos;
    varying vec3 vNormal;
    varying vec2 vUv;
    void main() {
      vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
      vNormal = normalize(normalMatrix * normal);
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform float uTime;
    uniform vec3  uColor;
    uniform float uOpacity;
    uniform float uGlowIntensity;
    uniform float uFlicker;
    varying vec3 vWorldPos;
    varying vec3 vNormal;
    varying vec2 vUv;
    void main() {
      vec3 normal = normalize(vNormal);
      float scanline = sin(vWorldPos.y * 180.0 - uTime * 10.0) * 0.15 + 0.85;
      float gridX = sin(vWorldPos.x * 60.0) * 0.5 + 0.5;
      float gridZ = sin(vWorldPos.z * 60.0) * 0.5 + 0.5;
      float grid  = pow(gridX * gridZ, 0.1) * 0.2 + 0.8;
      // Improved fresnel using view direction (approximate toward camera)
      float fresnel = pow(1.0 - max(dot(normal, vec3(0.0,0.0,1.0)), 0.0), 3.0);
      float r   = sin(uTime * 20.0 + vWorldPos.y * 100.0) * 0.02;
      vec3  col = uColor;
      col.r    += r;
      float pulse = 0.8 + 0.2 * sin(uTime * 4.0 + vWorldPos.y * 2.0);
      float alpha = uOpacity * scanline * grid * uFlicker * pulse * (fresnel + 0.3);
      gl_FragColor = vec4(col * (1.0 + fresnel * uGlowIntensity), alpha);
    }
  `
};

/* ─────────────────────── Scene core (inside each Canvas) ─────────────────────── */
const PlatformSceneCore = ({ scene, hovered, accentColor, modelScale }) => {

  /* ── helpers ── */
  const autoNorm = (obj, targetSize) => {
    obj.updateWorldMatrix(true, true);
    const meshData = [];
    obj.traverse(c => {
      if (!c.isMesh || !c.visible) return;
      const b = new THREE.Box3().setFromObject(c);
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

  const centerMeshOnly = (obj) => {
    obj.updateWorldMatrix(true, true);
    const md = [];
    obj.traverse(c => {
      if (!c.isMesh || !c.visible) return;
      const b = new THREE.Box3().setFromObject(c);
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

  const prepClone = (c) => {
    // Detect if this is the Skyline R34 model
    let isR34Model = false;
    c.traverse(o => {
      const objName = (o.name || '').toLowerCase();
      if (objName.includes('r34') || objName.includes('skyline') || objName.includes('nismo') || objName.includes('te37') || objName.includes('lmgt4') || objName.includes('rims_stock')) {
        isR34Model = true;
      }
    });

    if (isR34Model) {
      // 1. Remove immediate root-level stray duplicate nodes far from origin (only for R34!)
      const toRemove = [];
      c.children.forEach(o => {
        if (o.position.length() > 5) {
          o.visible = false;
          toRemove.push(o);
        }
      });
      toRemove.forEach(o => o.removeFromParent());
    }

    // 2. Hide all R34 custom upgrade rims/bumpers/wings/hoods and template nodes on the stock showroom view!
    c.traverse(o => {
      const objName = (o.name || '').toLowerCase();
      const parentName = o.parent && o.parent.name ? o.parent.name.toLowerCase() : '';
      
      const isCustomUpgradePart = 
        objName.includes('vossen') ||
        objName.includes('te37') ||
        objName.includes('lmgt4') ||
        objName.includes('modified_rim') ||
        parentName.includes('vossen') ||
        parentName.includes('modified_rim') ||
        objName.includes('modify_bumper_1') ||
        objName.includes('modified_bumper_front_2') ||
        (objName.includes('kit1') && !objName.includes('wing') && !objName.includes('hood')) ||
        objName.includes('wing1a') ||
        objName.includes('wing2a') ||
        objName.includes('hood1b') ||
        objName.includes('modified_hood_2');

      const isTemplatePart = 
        objName.includes('modified_rim_1') || 
        objName.includes('vossen_gns-1') ||
        parentName.includes('modified_rim_1') ||
        parentName.includes('vossen_gns-1');

      if (isCustomUpgradePart || isTemplatePart) {
        o.visible = false;
      } else {
        if (o.isMesh) {
          o.frustumCulled = false;
          if (o.geometry) {
            if (!o.geometry.attributes.normal) o.geometry.computeVertexNormals();
            o.geometry.computeBoundingBox();
          }
        }
      }
    });
    return c;
  };

  /* ── clones ── */
  const fillClone = useMemo(() => {
    const c = prepClone(scene.clone(true));
    if (modelScale) { c.scale.setScalar(modelScale * 0.82); } else { autoNorm(c, 0.9); }
    centerMeshOnly(c);
    return c;
  }, [scene, modelScale]);

  const wireClone = useMemo(() => {
    const c = prepClone(scene.clone(true));
    if (modelScale) { c.scale.setScalar(modelScale * 0.82); } else { autoNorm(c, 0.9); }
    centerMeshOnly(c);
    return c;
  }, [scene, modelScale]);

  const carClone = useMemo(() => {
    const c = prepClone(scene.clone(true));
    if (modelScale) { c.scale.setScalar(modelScale); } else { autoNorm(c, 1.1); }
    centerMeshOnly(c);
    c.traverse(o => {
      if (!o.isMesh) return;
      const mat = Array.isArray(o.material) ? o.material[0] : o.material;
      if (!mat || !mat.map) {
        o.material = new THREE.MeshStandardMaterial({
          color: '#0a0a0c', metalness: 1.0, roughness: 0.08, envMapIntensity: 4,
        });
      }
    });
    return c;
  }, [scene, modelScale]);

  /* ── shader materials ── */
  const fillMats = useRef([]);
  const wireMats = useRef([]);

  useEffect(() => {
    const fm = [], wm = [];
    fillClone.traverse(o => {
      if (!o.isMesh) return;
      const m = new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 }, uColor: { value: new THREE.Color(accentColor) },
          uOpacity: { value: 0 }, uFlicker: { value: 1.0 }, uGlowIntensity: { value: 0.6 }
        },
        vertexShader: hologramShader.vertexShader,
        fragmentShader: hologramShader.fragmentShader,
        transparent: true, depthWrite: false, side: THREE.DoubleSide
      });
      o.material = m; fm.push(m);
    });
    wireClone.traverse(o => {
      if (!o.isMesh) return;
      const m = new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 }, uColor: { value: new THREE.Color(accentColor).addScalar(0.2) },
          uOpacity: { value: 0 }, uFlicker: { value: 1.0 }, uGlowIntensity: { value: 0.8 }
        },
        vertexShader: hologramShader.vertexShader,
        fragmentShader: hologramShader.fragmentShader,
        transparent: true, depthWrite: false, wireframe: true, side: THREE.DoubleSide
      });
      o.material = m; wm.push(m);
    });
    fillMats.current = fm;
    wireMats.current = wm;
    return () => { fm.forEach(m => m.dispose()); wm.forEach(m => m.dispose()); };
  }, [fillClone, wireClone, accentColor]);

  /* ── refs ── */
  const holoRef     = useRef();
  const carRef      = useRef();
  const carLt       = useRef();
  const beamOp      = useRef(0);
  const doorLeftRef  = useRef();
  const doorRightRef = useRef();
  const irisRimRef  = useRef();
  const holeLightRef = useRef();
  const pitGlowRef  = useRef();
  const pitRingRef  = useRef();
  const carRevealY  = useRef(HOLO_Y - 6); // starts MUCH lower to stay hidden

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    const a = Math.min(1, 1 - Math.exp(-6 * delta));
    const flicker = 0.7 + Math.sin(t * 18) * 0.1 + Math.sin(t * 33) * 0.05 + Math.sin(t * 7) * 0.03;

    // ── Hologram: VISIBLE by default, fades OUT on hover ──
    const holoTargetOp = hovered ? 0 : 0.72;
    beamOp.current += (holoTargetOp - beamOp.current) * a;
    const hologramOp = beamOp.current * flicker;

    fillMats.current.forEach(m => {
      if (m.uniforms) { m.uniforms.uTime.value = t; m.uniforms.uOpacity.value = hologramOp; m.uniforms.uFlicker.value = flicker; m.uniforms.uGlowIntensity.value = 1.2; }
    });
    wireMats.current.forEach(m => {
      if (m.uniforms) { m.uniforms.uTime.value = t; m.uniforms.uOpacity.value = hologramOp * 0.85; m.uniforms.uFlicker.value = flicker; m.uniforms.uGlowIntensity.value = 1.5; }
    });

    // Hologram always floats gently
    if (holoRef.current) {
      holoRef.current.rotation.y += delta * 0.4;
      holoRef.current.rotation.x = Math.sin(t * 0.7) * 0.05;
      holoRef.current.position.y = HOLO_Y + Math.sin(t * 1.2) * 0.06;
    }

    // Iris doors open on hover
    if (doorRightRef.current) { const tg = hovered ? -Math.PI * 0.65 : 0; doorRightRef.current.rotation.z += (tg - doorRightRef.current.rotation.z) * a; }
    if (doorLeftRef.current)  { const tg = hovered ?  Math.PI * 0.65 : 0; doorLeftRef.current.rotation.z  += (tg - doorLeftRef.current.rotation.z)  * a; }

    // Platform glow on hover
    if (pitGlowRef.current)   pitGlowRef.current.material.opacity  += ((hovered ? 0.65 : 0)    - pitGlowRef.current.material.opacity)  * a;
    if (pitRingRef.current)   pitRingRef.current.material.opacity  += ((hovered ? 0.9  : 0)    - pitRingRef.current.material.opacity)  * a;
    if (holeLightRef.current) holeLightRef.current.intensity       += ((hovered ? 30   : 0)    - holeLightRef.current.intensity)       * a;
    if (irisRimRef.current)   irisRimRef.current.material.opacity  += ((hovered ? 0.95 : 0.45) - irisRimRef.current.material.opacity)  * a;

    // ── Real car: HIDDEN below platform by default, RISES on hover ──
    if (carRef.current) {
      const targetY = hovered ? HOLO_Y : HOLO_Y - 6;
      carRevealY.current += (targetY - carRevealY.current) * (a * 0.85);
      carRef.current.position.y = carRevealY.current;
      carRef.current.rotation.y += delta * 0.35;
      
      // Completely hide the car object if it's below a safe threshold
      // This prevents any part of it from clipping through the floor before hover
      carRef.current.visible = (hovered || carRevealY.current > HOLO_Y - 2.5);
      carRef.current.position.y = carRevealY.current;

      if (carLt.current) carLt.current.intensity = THREE.MathUtils.lerp(carLt.current.intensity, hovered ? 8 : 0, a);
    }
  });

  return (
    <>
      <ambientLight intensity={0.08} />
      <spotLight position={[3, 8, 4]}   intensity={1200} penumbra={0.85} angle={0.4} color="#fff" />
      <spotLight position={[-3, 5, -2]} intensity={400}  penumbra={0.9}  color={accentColor} />
      <Environment preset="city" background={false} />

      <group rotation={[0.32, 0, 0]} position={[0, -0.15, 0]}>
        {/* Platform ring */}
        <mesh position={[0, -0.09, 0]}>
          <cylinderGeometry args={[IRIS_R + 0.14, IRIS_R + 0.22, 0.18, 32, 1, false]} />
          <meshStandardMaterial color="#08090f" metalness={0.96} roughness={0.05} envMapIntensity={3} />
        </mesh>
        <mesh position={[0, 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[IRIS_R, IRIS_R + 0.14, 32]} />
          <meshStandardMaterial color="#0d0f1e" metalness={0.97} roughness={0.04} envMapIntensity={4} />
        </mesh>
        <mesh ref={irisRimRef} position={[0, 0.003, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[IRIS_R + 0.02, IRIS_R + 0.08, 32]} />
          <meshBasicMaterial color={accentColor} transparent opacity={0.75} blending={THREE.AdditiveBlending} />
        </mesh>
        <mesh position={[0, -0.01, 0]}>
          <cylinderGeometry args={[IRIS_R + 0.15, IRIS_R + 0.15, 0.03, 32, 1, true]} />
          <meshBasicMaterial color={accentColor} transparent opacity={0.35} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} />
        </mesh>

        <pointLight ref={holeLightRef} position={[0, -0.2, 0]} color={accentColor} intensity={0} distance={4} decay={1.0} />
        <mesh ref={pitGlowRef} position={[0, 0.006, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[IRIS_R * 0.88, 32]} />
          <meshBasicMaterial color={accentColor} transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
        <mesh ref={pitRingRef} position={[0, 0.007, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[IRIS_R * 0.82, IRIS_R * 0.9, 32]} />
          <meshBasicMaterial color={accentColor} transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>

        {/* Iris doors */}
        <group ref={doorRightRef} position={[0, 0.014, 0]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[IRIS_R, 32, -Math.PI / 2, Math.PI]} />
            <meshStandardMaterial color="#08090f" metalness={0.97} roughness={0.04} envMapIntensity={3} />
          </mesh>
        </group>
        <group ref={doorLeftRef} position={[0, 0.014, 0]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[IRIS_R, 32, Math.PI / 2, Math.PI]} />
            <meshStandardMaterial color="#08090f" metalness={0.97} roughness={0.04} envMapIntensity={3} />
          </mesh>
        </group>

        {/* Hologram group */}
        <group ref={holoRef} position={[0, HOLO_Y, 0]}>
          <primitive object={fillClone} />
          <primitive object={wireClone} />
          <pointLight position={[0, 0.5, 0]} color={0x55ccff} intensity={2} distance={3} decay={2} />
        </group>

        {/* Physical car */}
        <group ref={carRef} position={[0, HOLO_Y, 0]}>
          <primitive object={carClone} castShadow receiveShadow />
          <ContactShadows position={[0, 0.001, 0]} opacity={0.7} scale={8} blur={2.5} far={1} color="#000" resolution={256} frames={1} />
          <pointLight ref={carLt} position={[0, 1.2, 0]} color={accentColor} intensity={0} distance={7} decay={2} />
        </group>
      </group>
    </>
  );
};

/* ─── Loader wrapper: passes local /draco/ path explicitly ─── */
const PlatformScene = ({ modelPath, hovered, accentColor, modelScale }) => {
  const { scene } = useGLTF(modelPath, DRACO_PATH);
  return <PlatformSceneCore scene={scene} hovered={hovered} accentColor={accentColor} modelScale={modelScale} />;
};

/* ─── Loading placeholder shown while model decodes ─── */
const CardLoadingPlaceholder = ({ accentColor }) => (
  <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 2.4, 0]}>
    <ringGeometry args={[0.3, 0.5, 32]} />
    <meshBasicMaterial color={accentColor} transparent opacity={0.6} blending={THREE.AdditiveBlending} />
  </mesh>
);

/* ─────────────────────── PlatformCard ─────────────────────── */
const PlatformCard = ({ car, index, user, onOpenAuth }) => {
  const navigate = useNavigate();
  const [hovered, setHovered]   = useState(false);
  const [showSpecs, setShowSpecs] = useState(false);
  const cardRef = useRef(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setIsVisible(true); },
      { threshold: 0.01, rootMargin: '150px' }
    );
    if (cardRef.current) obs.observe(cardRef.current);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={cardRef}
      className={`showroom-card ${hovered ? 'is-hovered' : ''} ${isVisible ? 'is-visible' : ''}`}
      style={{ '--accent': car.accentColor, '--gold': car.goldTint, '--delay': `${index * 0.15}s` }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setShowSpecs(false); }}
      onClick={() => setShowSpecs(!showSpecs)}
    >
      {/* ── Per-card Canvas (most reliable with Draco) ── */}
      <div className="card-canvas-track" style={{ position: 'absolute', inset: 0 }}>
        {isVisible && (
          <Canvas
            dpr={[1, 1.5]}
            gl={{
              antialias: true,
              alpha: true,
              toneMapping: THREE.ACESFilmicToneMapping,
              powerPreference: 'high-performance',
            }}
            style={{ width: '100%', height: '100%' }}
          >
            <PerspectiveCamera makeDefault position={[0, 0.2, 9]} fov={46} />
            <Suspense fallback={<CardLoadingPlaceholder accentColor={car.accentColor} />}>
              <PlatformScene
                modelPath={car.model}
                hovered={hovered}
                accentColor={car.accentColor}
                modelScale={car.modelScale}
              />
            </Suspense>
          </Canvas>
        )}
      </div>

      <div className="car-label">
        <span className="car-brand-label">{car.brand}</span>
        <h3 className="car-name-label">{car.name}</h3>
      </div>

      <AnimatePresence>
        {showSpecs && (
          <motion.div className="spec-overlay"
            initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }} transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="spec-header-tag">{car.brand} — SPECIFICATIONS</div>
            <div className="spec-items">
              {[['power','POWER OUTPUT'],['speed','TOP SPEED'],['accel','0–100 KM/H'],['engine','ENGINE']].map(([k, l]) => (
                <div className="spec-entry" key={k}>
                  <span className="spec-value">{car.specs[k]}</span>
                  <span className="spec-label">{l}</span>
                </div>
              ))}
            </div>
            <div className="spec-dismiss">TAP AGAIN TO CLOSE</div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="corner-accent tl" /><div className="corner-accent tr" />
      <div className="corner-accent bl" /><div className="corner-accent br" />

      <motion.button
        className="card-configure-btn"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: hovered ? 1 : 0, y: hovered ? 0 : 8 }}
        transition={{ duration: 0.25 }}
        onClick={e => { 
          e.stopPropagation(); 
          if (user) {
            navigate(`/configure/${car.id}`); 
          } else {
            onOpenAuth();
          }
        }}
      >
        CONFIGURE →
      </motion.button>
    </div>
  );
};

/* ─────────────────────── CarSelection ─────────────────────── */
const CarSelection = ({ user, onOpenAuth }) => (
  <section
    className="showroom-section"
    id="fleet"
    style={{
      position: 'relative',
      width: '100%',
      minHeight: '100vh',
      background: 'radial-gradient(circle at 50% -20%, #172033 0%, #060810 80%)',
      overflow: 'hidden',
    }}
  >
    <div className="showroom-ambient" />
    <div className="showroom-aurora" />
    <div className="showroom-particles" />
    <div className="showroom-pillars" />

    <motion.div
      className="showroom-header"
      initial={{ opacity: 0, y: 50 }} whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }} transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="header-line" />
      <span className="header-eyebrow">EXCLUSIVE COLLECTION</span>
      <h2 className="showroom-title">THE <span>FLEET</span></h2>
      <p className="showroom-subtitle">Select a masterpiece to begin your journey</p>
    </motion.div>

    <div className="showroom-grid">
      {CAR_DATA.map((car, i) => (
        <PlatformCard 
          key={car.id} 
          car={car} 
          index={i} 
          user={user} 
          onOpenAuth={onOpenAuth} 
        />
      ))}
    </div>
  </section>
);

export default CarSelection;