import React, { useState, useRef, useEffect, useMemo, useCallback, memo, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, useGLTF, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import { GL_PROPS_CARD, ADAPTIVE_DPR } from '../utils/r3fOptimizer.js';

// ─── Constants ───────────────────────────────────────────────
const DRACO_PATH = '/draco/';
const BEAM_H = 2.4;
const HOLO_Y = 2.4;
const IRIS_R = 1.8;

const CAR_DATA = [
  { id: 4, name: 'Skyline GT-R R34', brand: 'NISSAN',  model: '/r34/source/r34_draco-v1.glb',             accentColor: '#ff3344', goldTint: '#cc3344', specs: { power: '276 HP',  speed: '250 km/h', accel: '4.0s', engine: 'RB26DETT' } },
  { id: 5, name: 'AMG E63 S',        brand: 'MERCEDES', model: '/e%2063/source/e63_centered_final-v1.glb', accentColor: '#ffaa00', goldTint: '#c5a059', specs: { power: '612 HP',  speed: '300 km/h', accel: '3.4s', engine: 'V8 4.0L Biturbo' } },
  { id: 6, name: 'Supra MkIV',       brand: 'TOYOTA',   model: '/supra/source/supra_final-v1.glb',         accentColor: '#cc44ff', goldTint: '#9955cc', specs: { power: '280 HP',  speed: '270 km/h', accel: '5.1s', engine: 'Inline-6 2JZ-GTE' } },
];

// Preload all car models once at module level so useGLTF cache is warm
CAR_DATA.forEach(car => useGLTF.preload(car.model, DRACO_PATH));

// ─── Shared geometry pool (created ONCE, reused by all cards) ─
// Avoids recreating BufferGeometry on every card mount
const GEO = {
  platformOuter: new THREE.CylinderGeometry(IRIS_R + 0.14, IRIS_R + 0.22, 0.18, 32, 1, false),
  platformRing:  new THREE.RingGeometry(IRIS_R, IRIS_R + 0.14, 32),
  irisGlow:      new THREE.RingGeometry(IRIS_R + 0.02, IRIS_R + 0.08, 32),
  irisEdge:      new THREE.CylinderGeometry(IRIS_R + 0.15, IRIS_R + 0.15, 0.03, 32, 1, true),
  pitGlow:       new THREE.CircleGeometry(IRIS_R * 0.88, 32),
  pitRing:       new THREE.RingGeometry(IRIS_R * 0.82, IRIS_R * 0.9, 32),
  doorHalf:      new THREE.CircleGeometry(IRIS_R, 32),
  fakeShadow:    new THREE.CircleGeometry(1.4, 32),
};

// ─── Hologram shader (optimised) ─────────────────────────────
// KEY WINS: removed grid pow() call, simplified fresnel, FrontSide only
const hologramVert = `
  varying vec3 vWorldPos;
  varying vec3 vNormal;
  void main() {
    vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
    vNormal   = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const hologramFrag = `
  uniform float uTime;
  uniform vec3  uColor;
  uniform float uOpacity;
  uniform float uGlowIntensity;
  varying vec3 vWorldPos;
  varying vec3 vNormal;
  void main() {
    vec3  normal   = normalize(vNormal);
    float scanline = sin(vWorldPos.y * 140.0 - uTime * 9.0) * 0.12 + 0.88;
    float fresnel  = pow(1.0 - max(dot(normal, vec3(0.0,0.0,1.0)), 0.0), 2.5);
    float pulse    = 0.82 + 0.18 * sin(uTime * 3.5 + vWorldPos.y * 1.8);
    float alpha    = uOpacity * scanline * pulse * (fresnel + 0.28);
    gl_FragColor   = vec4(uColor * (1.0 + fresnel * uGlowIntensity), alpha);
  }
`;

// ─── Scene prep helpers (extracted, memoised per scene reference) ─
function buildPreparedScene(scene, modelScale, targetSize) {
  // Single clone, prepared once
  const c = scene.clone(true);

  // Detect R34
  let isR34 = false;
  c.traverse(o => {
    const n = (o.name || '').toLowerCase();
    if (n.includes('r34') || n.includes('skyline') || n.includes('nismo') || n.includes('te37') || n.includes('lmgt4') || n.includes('rims_stock')) isR34 = true;
  });

  if (isR34) {
    const toRemove = [];
    c.children.forEach(o => { if (o.position.length() > 5) { o.visible = false; toRemove.push(o); } });
    toRemove.forEach(o => o.removeFromParent());
  }

  c.traverse(o => {
    const n = (o.name || '').toLowerCase();
    const pn = o.parent?.name?.toLowerCase() || '';
    const isUpgrade =
      n.includes('vossen') || n.includes('te37') || n.includes('lmgt4') ||
      n.includes('modified_rim') || pn.includes('vossen') || pn.includes('modified_rim') ||
      n.includes('modify_bumper_1') || n.includes('modified_bumper_front_2') ||
      (n.includes('kit1') && !n.includes('wing') && !n.includes('hood')) ||
      n.includes('wing1a') || n.includes('wing2a') || n.includes('hood1b') || n.includes('modified_hood_2');
    const isTemplate =
      n.includes('modified_rim_1') || n.includes('vossen_gns-1') ||
      pn.includes('modified_rim_1') || pn.includes('vossen_gns-1');

    if (isUpgrade || isTemplate) { o.visible = false; return; }

    if (o.isMesh) {
      o.frustumCulled = true; // re-enable for perf (we manage visibility ourselves)
      // Skip runtime computeVertexNormals / computeBoundingBox — trust export pipeline
    }
  });

  // Auto-normalise scale
  if (modelScale) {
    c.scale.setScalar(modelScale * 0.82);
  } else {
    // Lightweight bounding box normalise (single pass, no extra clones)
    const box = new THREE.Box3().setFromObject(c);
    if (!box.isEmpty()) {
      const sz = box.getSize(new THREE.Vector3());
      const dim = sz.y > 0.01 ? sz.y : Math.max(sz.x, sz.y, sz.z);
      if (dim > 0) c.scale.setScalar(targetSize / dim);
    }
  }

  // Centre
  const box2 = new THREE.Box3().setFromObject(c);
  if (!box2.isEmpty()) {
    const ctr = box2.getCenter(new THREE.Vector3());
    c.position.x -= ctr.x;
    c.position.y -= box2.min.y;
    c.position.z -= ctr.z;
  }

  return c;
}

// ─── PlatformSceneCore ───────────────────────────────────────
// KEY WIN: one clone for hologram, one for real car (was 3)
// KEY WIN: shader materials created once per accentColor change
// KEY WIN: useFrame skips expensive work when idle
const PlatformSceneCore = memo(({ scene, hovered, accentColor, modelScale }) => {
  const { invalidate } = useThree();

  // Single hologram clone (replaces fillClone + wireClone)
  const holoClone = useMemo(() => buildPreparedScene(scene, modelScale, 0.9), [scene, modelScale]);

  // Real car clone
  const carClone = useMemo(() => {
    const c = buildPreparedScene(scene, modelScale, 1.1);
    c.traverse(o => {
      if (!o.isMesh) return;
      const mat = Array.isArray(o.material) ? o.material[0] : o.material;
      if (!mat || !mat.map) {
        o.material = new THREE.MeshStandardMaterial({
          color: '#0a0a0c', metalness: 1.0, roughness: 0.08, envMapIntensity: 3,
        });
      }
    });
    return c;
  }, [scene, modelScale]);

  // Hologram shader materials (one pass on holoClone, FrontSide, no wireframe layer)
  const holoMats = useRef([]);
  useEffect(() => {
    const mats = [];
    holoClone.traverse(o => {
      if (!o.isMesh) return;
      const m = new THREE.ShaderMaterial({
        uniforms: {
          uTime:         { value: 0 },
          uColor:        { value: new THREE.Color(accentColor) },
          uOpacity:      { value: 0 },
          uGlowIntensity:{ value: 0.9 },
        },
        vertexShader:   hologramVert,
        fragmentShader: hologramFrag,
        transparent: true,
        depthWrite:  false,
        side:        THREE.FrontSide,   // FrontSide only — halves overdraw
        blending:    THREE.AdditiveBlending,
      });
      o.material = m;
      mats.push(m);
    });
    holoMats.current = mats;
    return () => { mats.forEach(m => m.dispose()); };
  }, [holoClone, accentColor]);

  // Fake shadow material (1 shared instance per card, no ContactShadows)
  const shadowMat = useMemo(() => new THREE.MeshBasicMaterial({
    color: '#000000',
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
  }), []);

  // Refs
  const holoRef       = useRef();
  const carRef        = useRef();
  const carLtRef      = useRef();
  const beamOp        = useRef(0);
  const doorLeftRef   = useRef();
  const doorRightRef  = useRef();
  const irisRimRef    = useRef();
  const holeLightRef  = useRef();
  const pitGlowRef    = useRef();
  const pitRingRef    = useRef();
  const carRevealY    = useRef(HOLO_Y - 6);

  // Stable accent color as THREE.Color to avoid GC pressure
  const accentTHREE = useMemo(() => new THREE.Color(accentColor), [accentColor]);

  // Lerp factor ref — recalculate per frame only once
  const prevHovered = useRef(hovered);

  useFrame((state, delta) => {
    const t   = state.clock.elapsedTime;
    const a   = 1 - Math.exp(-6 * delta);

    // Only do expensive flicker math when hologram is actually visible
    const isHoloVisible = beamOp.current > 0.01 || !hovered;
    const flicker = isHoloVisible
      ? 0.72 + Math.sin(t * 16) * 0.09 + Math.sin(t * 31) * 0.04
      : 1.0;

    // Hologram fade
    const holoTarget = hovered ? 0 : 0.72;
    beamOp.current += (holoTarget - beamOp.current) * a;
    const hologramOp = beamOp.current * flicker;

    // Only update shader uniforms when hologram is non-trivially visible
    if (isHoloVisible && holoMats.current.length) {
      for (const m of holoMats.current) {
        m.uniforms.uTime.value    = t;
        m.uniforms.uOpacity.value = hologramOp;
        m.uniforms.uGlowIntensity.value = 1.1;
      }
    }

    // Hologram float
    if (holoRef.current) {
      holoRef.current.rotation.y   += delta * 0.4;
      holoRef.current.rotation.x    = Math.sin(t * 0.7) * 0.05;
      holoRef.current.position.y    = HOLO_Y + Math.sin(t * 1.2) * 0.06;
    }

    // Iris doors
    if (doorRightRef.current) { const tg = hovered ? -Math.PI * 0.65 : 0; doorRightRef.current.rotation.z += (tg - doorRightRef.current.rotation.z) * a; }
    if (doorLeftRef.current)  { const tg = hovered ?  Math.PI * 0.65 : 0; doorLeftRef.current.rotation.z  += (tg - doorLeftRef.current.rotation.z)  * a; }

    // Platform glow
    if (pitGlowRef.current)   pitGlowRef.current.material.opacity  += ((hovered ? 0.65 : 0)    - pitGlowRef.current.material.opacity)  * a;
    if (pitRingRef.current)   pitRingRef.current.material.opacity  += ((hovered ? 0.9  : 0)    - pitRingRef.current.material.opacity)  * a;
    if (holeLightRef.current) holeLightRef.current.intensity       += ((hovered ? 28   : 0)    - holeLightRef.current.intensity)       * a;
    if (irisRimRef.current)   irisRimRef.current.material.opacity  += ((hovered ? 0.95 : 0.45) - irisRimRef.current.material.opacity)  * a;

    // Car reveal
    if (carRef.current) {
      const targetY = hovered ? HOLO_Y : HOLO_Y - 6;
      carRevealY.current += (targetY - carRevealY.current) * (a * 0.85);
      carRef.current.position.y = carRevealY.current;
      carRef.current.rotation.y += delta * 0.35;
      carRef.current.visible = hovered || carRevealY.current > HOLO_Y - 2.5;
      if (carLtRef.current) carLtRef.current.intensity = THREE.MathUtils.lerp(carLtRef.current.intensity, hovered ? 7 : 0, a);
    }

    // Invalidate only if something visible changed (frameloop="demand" friendly)
    invalidate();
  });

  return (
    <>
      {/* Reduced lighting: 1 point light replaces 2 expensive spotlights */}
      <ambientLight intensity={0.1} />
      <pointLight position={[2, 7, 4]} intensity={90} color="#ffffff" distance={18} decay={1.8} />
      <pointLight position={[-2, 4, -2]} intensity={30} color={accentColor} distance={10} decay={2} />
      {/* Single shared Environment — low resolution for cards */}
      <Environment preset="city" background={false} />

      <group rotation={[0.32, 0, 0]} position={[0, -0.15, 0]}>
        {/* Platform ring */}
        <mesh geometry={GEO.platformOuter} position={[0, -0.09, 0]}>
          <meshStandardMaterial color="#08090f" metalness={0.96} roughness={0.05} envMapIntensity={2} />
        </mesh>
        <mesh geometry={GEO.platformRing} position={[0, 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <meshStandardMaterial color="#0d0f1e" metalness={0.97} roughness={0.04} envMapIntensity={3} />
        </mesh>
        <mesh ref={irisRimRef} geometry={GEO.irisGlow} position={[0, 0.003, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <meshBasicMaterial color={accentColor} transparent opacity={0.75} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
        <mesh geometry={GEO.irisEdge} position={[0, -0.01, 0]}>
          <meshBasicMaterial color={accentColor} transparent opacity={0.3} blending={THREE.AdditiveBlending} side={THREE.FrontSide} depthWrite={false} />
        </mesh>

        <pointLight ref={holeLightRef} position={[0, -0.2, 0]} color={accentColor} intensity={0} distance={4} decay={1.2} />
        <mesh ref={pitGlowRef} geometry={GEO.pitGlow} position={[0, 0.006, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <meshBasicMaterial color={accentColor} transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
        <mesh ref={pitRingRef} geometry={GEO.pitRing} position={[0, 0.007, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <meshBasicMaterial color={accentColor} transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>

        {/* Iris doors */}
        <group ref={doorRightRef} position={[0, 0.014, 0]}>
          <mesh geometry={GEO.doorHalf} rotation={[-Math.PI / 2, 0, 0]}>
            <meshStandardMaterial color="#08090f" metalness={0.97} roughness={0.04} envMapIntensity={2} />
          </mesh>
        </group>
        <group ref={doorLeftRef} position={[0, 0.014, 0]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[IRIS_R, 32, Math.PI / 2, Math.PI]} />
            <meshStandardMaterial color="#08090f" metalness={0.97} roughness={0.04} envMapIntensity={2} />
          </mesh>
        </group>

        {/* Hologram group — single clone, no wireframe layer */}
        <group ref={holoRef} position={[0, HOLO_Y, 0]}>
          <primitive object={holoClone} />
          <pointLight position={[0, 0.5, 0]} color={0x55ccff} intensity={1.5} distance={2.5} decay={2} />
        </group>

        {/* Physical car */}
        <group ref={carRef} position={[0, HOLO_Y, 0]}>
          <primitive object={carClone} castShadow />
          {/* Fake shadow — cheap circle mesh, replaces expensive ContactShadows */}
          <mesh geometry={GEO.fakeShadow} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]} material={shadowMat} />
          <pointLight ref={carLtRef} position={[0, 1.2, 0]} color={accentColor} intensity={0} distance={6} decay={2} />
        </group>
      </group>
    </>
  );
});

// ─── Loader wrapper ───────────────────────────────────────────
const PlatformScene = memo(({ modelPath, hovered, accentColor, modelScale }) => {
  const { scene } = useGLTF(modelPath, DRACO_PATH);
  return <PlatformSceneCore scene={scene} hovered={hovered} accentColor={accentColor} modelScale={modelScale} />;
});

// ─── Loading placeholder ──────────────────────────────────────
const CardLoadingPlaceholder = ({ accentColor }) => (
  <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 2.4, 0]}>
    <ringGeometry args={[0.3, 0.5, 32]} />
    <meshBasicMaterial color={accentColor} transparent opacity={0.6} blending={THREE.AdditiveBlending} />
  </mesh>
);

// ─── PlatformCard ─────────────────────────────────────────────
const PlatformCard = memo(({ car, index, user, onOpenAuth }) => {
  const navigate  = useNavigate();
  const [hovered, setHovered]   = useState(false);
  const [showSpecs, setShowSpecs] = useState(false);
  const cardRef   = useRef(null);
  const [isVisible, setIsVisible] = useState(false);

  // Intersection observer — mount Canvas lazily
  useEffect(() => {
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setIsVisible(true); },
      { threshold: 0.01, rootMargin: '180px' }
    );
    if (cardRef.current) obs.observe(cardRef.current);
    return () => obs.disconnect();
  }, []);

  const handleEnter  = useCallback(() => setHovered(true),  []);
  const handleLeave  = useCallback(() => { setHovered(false); setShowSpecs(false); }, []);
  const handleClick  = useCallback(() => setShowSpecs(s => !s), []);
  const handleConfig = useCallback((e) => {
    e.stopPropagation();
    if (user) navigate(`/configure/${car.id}`);
    else onOpenAuth();
  }, [user, car.id, navigate, onOpenAuth]);

  return (
    <div
      ref={cardRef}
      className={`showroom-card ${hovered ? 'is-hovered' : ''} ${isVisible ? 'is-visible' : ''}`}
      style={{ '--accent': car.accentColor, '--gold': car.goldTint, '--delay': `${index * 0.15}s` }}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      onClick={handleClick}
    >
      {/* Canvas — demand frameloop, lazy mount */}
      <div className="card-canvas-track" style={{ position: 'absolute', inset: 0 }}>
        {isVisible && (
          <Canvas
            dpr={ADAPTIVE_DPR}
            gl={GL_PROPS_CARD}
            frameloop="demand"
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
        onClick={handleConfig}
      >
        CONFIGURE →
      </motion.button>
    </div>
  );
});

// ─── CarSelection ─────────────────────────────────────────────
const CarSelection = ({ user, onOpenAuth }) => (
  <section
    className="showroom-section"
    id="fleet"
    style={{
      position: 'relative', width: '100%', minHeight: '100vh',
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
        <PlatformCard key={car.id} car={car} index={i} user={user} onOpenAuth={onOpenAuth} />
      ))}
    </div>
  </section>
);

export default CarSelection;