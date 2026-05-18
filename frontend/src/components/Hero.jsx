import React, { Suspense, useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Canvas } from '@react-three/fiber';
import { Environment, ContactShadows, PresentationControls, useProgress, MeshReflectorMaterial, Sparkles } from '@react-three/drei';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, Play, Settings, Sun, DoorOpen, RotateCcw } from 'lucide-react';
import { EffectComposer, Bloom, Vignette, ToneMapping } from '@react-three/postprocessing';
import CarModel from './CarModel';
import * as THREE from 'three';

/* ── Loader ── */
function LoaderOverlay() {
  return (
    <>
      <motion.div className="shutter top-shutter" initial={{ y: 0 }} exit={{ y: '-100%' }} transition={{ duration: 1.8, ease: [0.77, 0, 0.18, 1] }} />
      <motion.div className="shutter bottom-shutter" initial={{ y: 0 }} exit={{ y: '100%' }} transition={{ duration: 1.8, ease: [0.77, 0, 0.18, 1] }} />

      <motion.div className="shutter-center" exit={{ opacity: 0 }} transition={{ duration: 0.6 }}>
        <motion.div
          className="shutter-brand"
          initial={{ opacity: 0, letterSpacing: '1em' }}
          animate={{ opacity: 1, letterSpacing: '0.5em' }}
          transition={{ duration: 1.5, delay: 0.2 }}
        >
          CAR<span>&nbsp;CANVAS</span>
        </motion.div>

        <div className="shutter-loading-text">Initializing Experience</div>
      </motion.div>
    </>
  );
}

/* ── Showroom Platform ── */
function ShowroomFloor() {
  return (
    <group position={[0, -0.9, 0]}>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[50, 50]} />
        <MeshReflectorMaterial
          blur={[300, 100]}
          resolution={2048}
          mixBlur={1}
          mixStrength={40}
          roughness={0.7}
          depthScale={1.2}
          minDepthThreshold={0.4}
          maxDepthThreshold={1.4}
          color="#f5f5f7"
          metalness={0.2}
        />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]}>
        <ringGeometry args={[5.8, 6, 128]} />
        <meshStandardMaterial color="#aaaaaa" metalness={1} roughness={0.02} emissive="#aaaaaa" emissiveIntensity={0.5} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]}>
        <ringGeometry args={[4.8, 4.94, 128]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.3} />
      </mesh>
    </group>
  );
}

const Hero = ({ user, onSignOut, onOpenAuth }) => {
  const { progress } = useProgress();
  const [ready, setReady] = useState(false);
  const [doorsOpen, setDoorsOpen] = useState(false);
  const [lightsOn, setLightsOn] = useState(false);
  const [autoRotate, setAutoRotate] = useState(true);
  const [isCanvasVisible, setIsCanvasVisible] = useState(true);
  const sectionRef = useRef(null);

  // Trigger ready state based on actual loading progress + minimal cinematic delay
  useEffect(() => {
    if (progress === 100) {
      const t = setTimeout(() => setReady(true), 1000);
      return () => clearTimeout(t);
    }
  }, [progress]);

  // Manage Canvas mounting based on visibility to save GPU memory
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsCanvasVisible(entry.isIntersecting);
      },
      { threshold: 0.0, rootMargin: '200px' }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  const fu = (delay = 0) => ({
    initial: { opacity: 0, y: 28 },
    animate: { opacity: ready ? 1 : 0, y: ready ? 0 : 28 },
    transition: { duration: 0.9, delay, ease: 'easeOut' },
  });

  return (
    <div className="hero-section" ref={sectionRef}>

      {/* Shutters */}
      <AnimatePresence>
        {!ready && (
          <motion.div className="shutters-container" exit={{ pointerEvents: 'none' }}>
            <LoaderOverlay />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Navbar */}
      <motion.nav className="navbar" initial={{ opacity: 0, y: -20 }} animate={{ opacity: ready ? 1 : 0, y: ready ? 0 : -20 }} transition={{ duration: 0.8, delay: 1.4 }}>
        <div className="logo">
          <span className="logo-diamond" />
          CAR CANVAS
        </div>
        <ul className="nav-links" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <li><a href="#fleet">Showroom</a></li>
          <li><a href="#fleet">Configure</a></li>
          <li>
            <Link to="/feed">
              Feed
            </Link>
          </li>
          {user ? (
            <li className="nav-profile-pill" style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div className="driver-avatar-circle" style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(0, 255, 204, 0.08)', border: '1px solid rgba(0, 255, 204, 0.3)', padding: '10px 22px', borderRadius: '30px', color: '#00ffcc', fontSize: '0.85rem', fontWeight: 800, letterSpacing: '0.12em', boxShadow: '0 0 15px rgba(0, 255, 204, 0.1)' }}>
                <span>🏎️</span>
                <span>{user.username.toUpperCase()}</span>
              </div>
              <button onClick={onSignOut} className="nav-signout-btn" style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem', fontWeight: 800, letterSpacing: '0.15em', cursor: 'pointer', textTransform: 'uppercase', transition: 'color 0.2s', padding: '8px 12px' }}>
                SIGN OUT
              </button>
            </li>
          ) : (
            <li>
              <button onClick={onOpenAuth} className="nav-cta" style={{ cursor: 'pointer', background: 'none', border: 'none', outline: 'none' }}>
                SIGN IN
              </button>
            </li>
          )}
        </ul>
      </motion.nav>

      {/* 3-D Canvas — full bleed */}
      <div className="canvas-container">
        {isCanvasVisible && (
          <Canvas
            shadows
            frameloop={autoRotate ? "always" : "demand"} /* OPTIMIZED: Render on demand if not rotating */
            camera={{ position: [-1.5, 1.5, 8.5], fov: 42 }}
            gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.1 }}
          >
            <color attach="background" args={['#0a0a0b']} />
            <fog attach="fog" args={['#0a0a0b', 5, 20]} />

            <Suspense fallback={null}>
              {/* Soft Ambient for Luxury feel */}
              <ambientLight intensity={0.5} color="#ffffff" />

              {/* Key Lighting - Premium Showroom setup */}
              <spotLight position={[0, 10, 0]} intensity={150} angle={0.6} penumbra={1} castShadow shadow-mapSize={[1024, 1024]} color="#ffffff" />
              <spotLight position={[10, 5, 10]} intensity={80} angle={0.5} penumbra={1} color="#ffffff" />
              <spotLight position={[-10, 5, -10]} intensity={80} angle={0.5} penumbra={1} color="#c5a059" />

              {/* High-end contact shadows */}
              {/* OPTIMIZED: resolution={256} frames={1} */}
              <ContactShadows position={[0, -0.89, 0]} opacity={0.7} scale={15} blur={3} far={2} color="#000000" resolution={256} frames={1} />

              <Environment preset="night" background={false} blur={1} />

              <PresentationControls speed={1.2} global zoom={0.9} polar={[0, Math.PI / 4]} azimuth={[-Infinity, Infinity]}>
                <group position={[0, -0.5, 0]}>
                  <CarModel
                    doorsOpen={doorsOpen}
                    lightsOn={lightsOn}
                    autoRotate={autoRotate}
                    onToggleDoors={() => setDoorsOpen(!doorsOpen)}
                    onToggleLights={() => setLightsOn(!lightsOn)}
                  />
                  <ShowroomFloor />
                </group>
              </PresentationControls>

              {/* OPTIMIZED: multisampling set to 0 to save GPU */}
              <EffectComposer disableNormalPass multisampling={0}>
                <Bloom luminanceThreshold={1.2} mipmapBlur intensity={0.4} />
                <ToneMapping mode={THREE.ACESFilmicToneMapping} exposure={1.0} />
                <Vignette eskil={false} offset={0.1} darkness={1.2} />
              </EffectComposer>
            </Suspense>
          </Canvas>
        )}
      </div>

      {/* Cinematic overlays */}
      <div className="left-fade" />
      <div className="bottom-fade" />
      <div className="vignette" />

      {/* Main overlay — flex-column keeps content & stats separated */}
      <div className="hero-overlay">

        {/* ── Left hero copy ── */}
        <div className="hero-content">
          <motion.div className="hero-eyebrow" {...fu(1.3)}>
            <div className="eyebrow-line" />
            <span className="eyebrow-text">2025 · Porsche 911 Carrera</span>
          </motion.div>

          <motion.h1 className="hero-title" {...fu(1.45)}>
            Timeless
            <span className="accent">Modern</span>
            <span className="outline">Precision</span>
          </motion.h1>

          <motion.p className="hero-sub" {...fu(1.6)}>
            The benchmark of sports car engineering. Pure, powerful, and redefined for the modern age of luxury performance.
          </motion.p>

          <motion.div className="cta-row" {...fu(1.75)}>
            <button 
              className="cta-primary"
              onClick={() => document.getElementById('fleet')?.scrollIntoView({ behavior: 'smooth' })}
            >
              ENTER SHOWROOM <ChevronRight size={15} />
            </button>
            <button 
              className="cta-ghost"
              onClick={() => document.getElementById('transformer')?.scrollIntoView({ behavior: 'smooth' })}
            >
              <Play size={13} /> EXPLORE SPECS
            </button>
          </motion.div>

          {/* Controls for Car */}
          <motion.div className="controls-row" {...fu(1.9)} style={{ display: 'flex', gap: '15px', marginTop: '30px' }}>
            <button className={`control-btn ${autoRotate ? 'active' : ''}`} onClick={() => setAutoRotate(!autoRotate)}>
              <RotateCcw size={16} /> Auto Spin
            </button>
          </motion.div>
        </div>

        {/* ── Stats bar ── */}
        <motion.div
          className="stats-bar"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: ready ? 1 : 0, y: ready ? 0 : 24 }}
          transition={{ duration: 0.9, delay: 2.1 }}
        >
          <div className="stat-block">
            <span className="stat-val">2.7s</span>
            <span className="stat-lbl">0 – 60 mph</span>
          </div>
          <div className="stat-sep" />
          <div className="stat-block">
            <span className="stat-val">640</span>
            <span className="stat-lbl">Horsepower</span>
          </div>
          <div className="stat-sep" />
          <div className="stat-block">
            <span className="stat-val">205</span>
            <span className="stat-lbl">Max Speed mph</span>
          </div>
          <div className="stat-sep" />
          <div className="stat-block">
            <span className="stat-val">GT3</span>
            <span className="stat-lbl">Track DNA</span>
          </div>

          <div className="car-badge">
            <span className="car-badge-name">Porsche AG</span>
            <span className="car-badge-sub">911 Turbo S</span>
          </div>
        </motion.div>


      </div>

      {/* Corner drag hint */}
      <motion.div
        className="corner-deco"
        initial={{ opacity: 0 }}
        animate={{ opacity: ready ? 1 : 0 }}
        transition={{ duration: 0.8, delay: 2.3 }}
      >
        <span>Drag to rotate</span>
        <div className="corner-deco-line" />
      </motion.div>

    </div>
  );
};

export default Hero;