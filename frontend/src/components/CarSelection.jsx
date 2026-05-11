import React, { useState, useRef, useEffect, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Canvas, useFrame } from '@react-three/fiber';
import { View, Preload, Environment, useGLTF, ContactShadows, Clone, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';

/* ─── CAR DATA ─── */
const CAR_DATA = [
  {
    id: 1, name: '911 GT3 RS', brand: 'PORSCHE',
    model: '/source/2024 Manthey Racing Porsche 911 GT3 RS.glb',
    accentColor: '#66aaff', goldTint: '#c5a059',
    specs: { power: '518 HP', speed: '296 km/h', accel: '3.2s', engine: 'Flat-6 4.0L' }
  },
  {
    id: 2, name: 'AMG GT4', brand: 'MERCEDES',
    model: '/merc/source/mercedes_amg_gt4.glb',
    accentColor: '#88cc66', goldTint: '#8fad5a',
    specs: { power: '730 HP', speed: '315 km/h', accel: '2.9s', engine: 'V8 4.0L Biturbo' }
  },
  {
    id: 3, name: '718 Cayman GT4', brand: 'PORSCHE',
    model: '/source/2024 Manthey Racing Porsche 911 GT3 RS.glb',
    accentColor: '#ff6666', goldTint: '#c5a059',
    specs: { power: '414 HP', speed: '304 km/h', accel: '3.9s', engine: 'Flat-6 4.0L' }
  },
  {
    id: 4, name: 'GT Black Series', brand: 'MERCEDES',
    model: '/merc/source/mercedes_amg_gt4.glb',
    accentColor: '#ff5555', goldTint: '#cc5555',
    specs: { power: '730 HP', speed: '325 km/h', accel: '3.2s', engine: 'V8 4.0L Biturbo' }
  },
  {
    id: 5, name: 'Huracán EVO', brand: 'LAMBORGHINI',
    model: '/merc/source/mercedes_amg_gt4.glb',
    accentColor: '#ffcc44', goldTint: '#c5a059',
    specs: { power: '640 HP', speed: '325 km/h', accel: '2.9s', engine: 'V10 5.2L' }
  },
  {
    id: 6, name: '911 Turbo S', brand: 'PORSCHE',
    model: '/source/2024 Manthey Racing Porsche 911 GT3 RS.glb',
    accentColor: '#5588cc', goldTint: '#5588bb',
    specs: { power: '640 HP', speed: '330 km/h', accel: '2.7s', engine: 'Flat-6 3.7L Biturbo' }
  }
];

/* ─── 3D CAR INSTANCE ─── */
const CarInstance = ({ modelPath, hovered }) => {
  const { scene } = useGLTF(modelPath);
  const groupRef = useRef();

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    
    // Smoothly animate Y position from deep in the bunker (-2.5) up to the surface (0)
    const targetY = hovered ? 0 : -2.5;
    groupRef.current.position.y = THREE.MathUtils.lerp(groupRef.current.position.y, targetY, 4 * delta);
    
    // Rotate car when hovered
    if (hovered) {
      groupRef.current.rotation.y += delta * 0.4;
    } else {
      groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, Math.PI / 8, 4 * delta);
    }
  });

  return (
    <group ref={groupRef} position={[0, -2.5, 0]}>
      <Clone object={scene} castShadow receiveShadow />
      {/* Contact shadow moves with the car */}
      <ContactShadows position={[0, -0.05, 0]} opacity={0.6} scale={10} blur={2} far={4} color="#000" />
    </group>
  );
};

/* ─── SINGLE PLATFORM CARD ─── */
const PlatformCard = ({ car, index }) => {
  const [hovered, setHovered] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [showSpecs, setShowSpecs] = useState(false);
  const cardRef = useRef(null);
  const viewRef = useRef(null);
  const [isVisible, setIsVisible] = useState(false);

  // Intersection Observer for fade-in
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setIsVisible(true); },
      { threshold: 0.2 }
    );
    if (cardRef.current) observer.observe(cardRef.current);
    return () => observer.disconnect();
  }, []);

  // Manage VRAM by only keeping the 3D context active when hovered + 1s delay for exit animation
  useEffect(() => {
    let timeout;
    if (hovered) {
      setIsActive(true);
    } else {
      timeout = setTimeout(() => setIsActive(false), 800);
    }
    return () => clearTimeout(timeout);
  }, [hovered]);

  return (
    <div
      ref={cardRef}
      className={`showroom-card ${hovered ? 'is-hovered' : ''} ${isVisible ? 'is-visible' : ''}`}
      style={{
        '--accent': car.accentColor,
        '--gold': car.goldTint,
        '--delay': `${index * 0.15}s`
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setShowSpecs(false); }}
      onClick={() => setShowSpecs(!showSpecs)}
    >
      {/* Bunker Structure */}
      <div className="bunker-assembly">
        {/* The hole where the car rises from */}
        <div className="bunker-hole">
          {/* Tracking element for the 3D View */}
          <div ref={viewRef} className="car-view-tracker" />
          
          {/* Bunker inner walls to overlay the corners of the rectangular WebGL scissor */}
          <div className="bunker-inner-shadow" />
        </div>
        
        {/* Bunker Hatch Doors */}
        <div className={`bunker-door bunker-door-left ${hovered ? 'open' : ''}`} />
        <div className={`bunker-door bunker-door-right ${hovered ? 'open' : ''}`} />

        {/* Realistic metallic rim of the bunker */}
        <div className="bunker-rim" />
      </div>

      {/* 3D View Port - Only rendered when active to save GPU memory! */}
      {isActive && (
        <View track={viewRef} className="view-port-3d">
          <PerspectiveCamera makeDefault position={[0, 1.5, 6]} fov={30} />
          <ambientLight intensity={0.4} />
          <spotLight position={[5, 10, 5]} intensity={800} penumbra={1} color="#ffffff" />
          <spotLight position={[-5, 10, -5]} intensity={400} penumbra={1} color={car.accentColor} />
          <Suspense fallback={null}>
            <CarInstance modelPath={car.model} hovered={hovered} />
          </Suspense>
        </View>
      )}

      {/* Car label */}
      <div className="car-label">
        <span className="car-brand-label">{car.brand}</span>
        <h3 className="car-name-label">{car.name}</h3>
      </div>

      {/* Spec sheet overlay */}
      <AnimatePresence>
        {showSpecs && (
          <motion.div
            className="spec-overlay"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="spec-header-tag">{car.brand} — SPECIFICATIONS</div>
            <div className="spec-items">
              <div className="spec-entry">
                <span className="spec-value">{car.specs.power}</span>
                <span className="spec-key">POWER OUTPUT</span>
              </div>
              <div className="spec-entry">
                <span className="spec-value">{car.specs.speed}</span>
                <span className="spec-key">TOP SPEED</span>
              </div>
              <div className="spec-entry">
                <span className="spec-value">{car.specs.accel}</span>
                <span className="spec-key">0-100 KM/H</span>
              </div>
              <div className="spec-entry">
                <span className="spec-value">{car.specs.engine}</span>
                <span className="spec-key">ENGINE</span>
              </div>
            </div>
            <div className="spec-dismiss">TAP AGAIN TO CLOSE</div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="corner-accent tl" />
      <div className="corner-accent tr" />
      <div className="corner-accent bl" />
      <div className="corner-accent br" />
    </div>
  );
};

/* ─── MAIN SECTION ─── */
const CarSelection = () => {
  const containerRef = useRef();
  const [isCanvasVisible, setIsCanvasVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsCanvasVisible(entry.isIntersecting);
      },
      { threshold: 0.0, rootMargin: '400px' }
    );
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section ref={containerRef} className="showroom-section" id="fleet">
      <div className="showroom-ambient">
        <div className="ambient-orb orb-1" />
        <div className="ambient-orb orb-2" />
        <div className="ambient-orb orb-3" />
      </div>

      <motion.div
        className="showroom-header"
        initial={{ opacity: 0, y: 50 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="header-line" />
        <span className="header-eyebrow">EXCLUSIVE COLLECTION</span>
        <h2 className="showroom-title">
          THE <span>FLEET</span>
        </h2>
        <p className="showroom-subtitle">Select a masterpiece to begin your journey</p>
      </motion.div>

      <div className="showroom-grid">
        {CAR_DATA.slice(0, 3).map((car, i) => (
          <PlatformCard key={car.id} car={car} index={i} />
        ))}
      </div>

      <div className="showroom-grid">
        {CAR_DATA.slice(3, 6).map((car, i) => (
          <PlatformCard key={car.id} car={car} index={i + 3} />
        ))}
      </div>

      {/* SINGLE SHARED CANVAS FOR ALL 3D VIEWS */}
      {isCanvasVisible && (
        <Canvas
          eventSource={containerRef}
          className="shared-canvas-fleet"
          shadows
          gl={{ antialias: true, alpha: true, toneMapping: THREE.ACESFilmicToneMapping }}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            pointerEvents: 'none',
            zIndex: 10
          }}
        >
          <View.Port />
          <Environment preset="studio" />
        </Canvas>
      )}
    </section>
  );
};

export default CarSelection;
