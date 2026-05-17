import './CarConfigurator.css';
import React, { useState, useRef, useEffect, useMemo, Suspense } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF, useFBX, Environment, ContactShadows, OrbitControls, Center } from '@react-three/drei';
import { motion, AnimatePresence } from 'framer-motion';
import * as THREE from 'three';

const DRACO_PATH = '/draco/';

/* ─── Car data (mirrors CarSelection) ─── */
const CAR_DATA = [
  { id: 1, name: '911 GT3 RS', brand: 'PORSCHE', model: '/source/porsche_draco.glb', accentColor: '#66aaff', goldTint: '#c5a059', specs: { power: '518 HP', speed: '296 km/h', accel: '3.2s', engine: 'Flat-6 4.0L' } },
  { id: 2, name: 'AMG GT4', brand: 'MERCEDES', model: '/merc/source/merc_draco.glb', accentColor: '#88cc66', goldTint: '#8fad5a', modelScale: 0.82, specs: { power: '730 HP', speed: '315 km/h', accel: '2.9s', engine: 'V8 4.0L Biturbo' } },
  { id: 3, name: 'Supra A80', brand: 'TOYOTA', model: '/supra/source/supra_draco.glb', accentColor: '#ff6622', goldTint: '#c5a059', specs: { power: '320 HP', speed: '285 km/h', accel: '4.6s', engine: 'Inline-6 3.0L' } },
  { id: 4, name: 'Skyline GT-R R34', brand: 'NISSAN', model: '/r34/source/r34_draco.glb', accentColor: '#ff3344', goldTint: '#cc3344', specs: { power: '276 HP', speed: '250 km/h', accel: '4.0s', engine: 'RB26DETT' } },
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

const BUMPER_OPTIONS = ['Stock', 'Aero Kit', 'Wide Body', 'Race Spec', 'Splitter'];
const TUNING_OPTIONS = [
  { label: 'Stage 1 ECU', hp: '+40 HP' },
  { label: 'Stage 2 Turbo', hp: '+90 HP' },
  { label: 'Stage 3 Full', hp: '+180 HP' },
  { label: 'Race Build', hp: '+260 HP' },
];

/* ─── 3D Car Scene ─── */
function CarScene({ car, bodyColor, rimColor, height, rotate }) {
  const isFBX = car.model.endsWith('.fbx');
  return isFBX
    ? <FBXCarMesh car={car} bodyColor={bodyColor} rimColor={rimColor} height={height} rotate={rotate} />
    : <GLBCarMesh car={car} bodyColor={bodyColor} rimColor={rimColor} height={height} rotate={rotate} />;
}

function GLBCarMesh({ car, bodyColor, rimColor, height, rotate }) {
  const { scene } = useGLTF(car.model, DRACO_PATH);
  return <CarMeshCore scene={scene} car={car} bodyColor={bodyColor} rimColor={rimColor} height={height} rotate={rotate} />;
}

function FBXCarMesh({ car, bodyColor, rimColor, height, rotate }) {
  const scene = useFBX(car.model);
  return <CarMeshCore scene={scene} car={car} bodyColor={bodyColor} rimColor={rimColor} height={height} rotate={rotate} />;
}

function CarMeshCore({ scene, car, bodyColor, rimColor, height, rotate }) {
  const groupRef = useRef();
  const timeRef = useRef(0);

  const carClone = useMemo(() => {
    const c = scene.clone(true);
    c.traverse(o => {
      if (o.isMesh) {
        o.visible = true;
        if (o.geometry && !o.geometry.attributes.normal) o.geometry.computeVertexNormals();
      }
    });
    // Auto-scale to ~1.1 unit height
    c.updateWorldMatrix(true, true);
    const box = new THREE.Box3().setFromObject(c);
    const size = box.getSize(new THREE.Vector3());
    const h = size.y > 0.01 ? size.y : Math.max(size.x, size.y, size.z);
    const scale = car.modelScale || (1.1 / h);
    c.scale.setScalar(scale);
    // Center
    c.updateWorldMatrix(true, true);
    const box2 = new THREE.Box3().setFromObject(c);
    const ctr = box2.getCenter(new THREE.Vector3());
    c.position.x -= ctr.x;
    c.position.y -= box2.min.y;
    c.position.z -= ctr.z;
    return c;
  }, [scene, car]);

  // Apply body color paint
  useEffect(() => {
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(bodyColor.hex),
      metalness: bodyColor.metalness,
      roughness: bodyColor.roughness,
      envMapIntensity: 2.5,
    });
    carClone.traverse(o => {
      if (!o.isMesh) return;
      const m = Array.isArray(o.material) ? o.material[0] : o.material;
      if (!m || !m.map) o.material = mat.clone();
    });
  }, [carClone, bodyColor]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    timeRef.current += delta;
    if (rotate) groupRef.current.rotation.y += delta * 0.3;
    // Gentle float
    groupRef.current.position.y = height + Math.sin(timeRef.current * 0.8) * 0.015;
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
export default function CarConfigurator() {
  const { carId } = useParams();
  const navigate = useNavigate();
  // Ensure string id from URL matches numeric id in data
  const car = CAR_DATA.find(c => String(c.id) === carId) || CAR_DATA[0];

  const [bodyColor, setBodyColor] = useState(BODY_COLORS[0]);
  const [rimStyle, setRimStyle] = useState(0);
  const [rimColor, setRimColor] = useState(RIM_COLORS[0]);
  const [wrap, setWrap] = useState(0);
  const [bumper, setBumper] = useState(0);
  const [carHeight, setCarHeight] = useState(0);
  const [tuning, setTuning] = useState(null);
  const [autoRotate, setAutoRotate] = useState(false);

  const totalHp = tuning != null ? parseInt(TUNING_OPTIONS[tuning].hp) : 0;

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
          <button className="cfg-save-btn">SAVE BUILD</button>
        </div>
      </header>

      <div className="configurator-layout">
        {/* ── 3D VIEWPORT ── */}
        <div className="cfg-viewport">
          {/* Accent corner decorations */}
          <div className="cfg-corner tl" /><div className="cfg-corner tr" />
          <div className="cfg-corner bl" /><div className="cfg-corner br" />

          {/* OPTIMIZED: frameloop={autoRotate ? "always" : "demand"} */}
          <Canvas
            frameloop={autoRotate ? "always" : "demand"}
            camera={{ position: [3.5, 1.2, 3.5], fov: 42 }}
            gl={{ antialias: true, alpha: true, toneMapping: THREE.ACESFilmicToneMapping }}
            dpr={[1, 2]}
          >
            <color attach="background" args={['#060810']} />
            <ambientLight intensity={0.4} />
            <directionalLight position={[5, 8, 5]} intensity={1.2} castShadow />
            <directionalLight position={[-5, 3, -5]} intensity={0.4} color="#4488ff" />
            <pointLight position={[0, 4, 0]} color={car.accentColor} intensity={1.5} distance={8} />
            <Suspense fallback={null}>
              <CarScene
                car={car}
                bodyColor={bodyColor}
                rimColor={rimColor}
                height={carHeight}
                rotate={autoRotate}
              />
              <Environment preset="city" />
            </Suspense>
            <OrbitControls
              enableZoom={true}
              enablePan={false}
              minDistance={2}
              maxDistance={8}
              minPolarAngle={Math.PI * 0.15}
              maxPolarAngle={Math.PI * 0.55}
              autoRotate={false}
            />
            {/* Ground grid */}
            <gridHelper args={[20, 40, '#1a1a2e', '#0d0d1a']} position={[0, -0.002, 0]} />
          </Canvas>

          {/* Live stats overlay */}
          <div className="cfg-hud">
            <div className="cfg-hud-item">
              <span className="hud-label">PAINT</span>
              <span className="hud-val">{bodyColor.label}</span>
            </div>
            <div className="cfg-hud-item">
              <span className="hud-label">RIMS</span>
              <span className="hud-val">{RIM_STYLES[rimStyle].label}</span>
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
                {RIM_STYLES.map((r, i) => (
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
                {BUMPER_OPTIONS.map((b, i) => (
                  <button key={i}
                    className={`bumper-btn ${bumper === i ? 'active' : ''}`}
                    onClick={() => setBumper(i)}
                  >
                    {b}
                  </button>
                ))}
              </div>
            </ConfigSection>

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

          </div>

          {/* Summary footer */}
          <div className="cfg-summary">
            <div className="summary-row">
              <span>Build Summary</span>
              <span className="summary-tag">{car.brand} {car.name}</span>
            </div>
            <div className="summary-mods">
              {[bodyColor.label, RIM_STYLES[rimStyle].label, BUMPER_OPTIONS[bumper], WRAP_OPTIONS[wrap].label].filter(Boolean).join(' · ')}
              {tuning != null ? ` · ${TUNING_OPTIONS[tuning].label}` : ''}
            </div>
            <button className="cfg-cta">REQUEST THIS BUILD →</button>
          </div>
        </aside>
      </div>
    </div>
  );
}