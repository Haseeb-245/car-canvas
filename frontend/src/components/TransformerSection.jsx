import React, { useRef, useEffect, useState } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import {
  Environment,
  ContactShadows,
  PerspectiveCamera,
  useGLTF,
  Text,
  Grid,
} from '@react-three/drei';
import * as THREE from 'three';
import { GL_PROPS_TRANSFORMER, ADAPTIVE_DPR } from '../utils/r3fOptimizer.js';

// 🔧 Local Draco decoder
const DRACO_PATH = '/draco/';

const INTRO_CAR_URL = '/merc/source/mercedes_amg_gt4_final-v1.glb';

// Preload so the model is ready by the time the section is visible
useGLTF.preload(INTRO_CAR_URL, DRACO_PATH);

// Simple static background (no Float animation loop)
const BackgroundElements = () => {
  return (
    <group position={[0, 0, -5]}>
      <Text fontSize={10} color="#ffffff" fillOpacity={0.02} position={[0, 0, -2]}>GT4</Text>
      {/* Removed <Float> — it runs its own useFrame loop */}
      <mesh position={[-8, 4, 0]}>
        <planeGeometry args={[0.02, 10]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.1} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, -2.4, 0]}>
        <ringGeometry args={[6, 6.1, 64]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.1} />
      </mesh>
    </group>
  );
};

const BuildTypography = ({ word1Ref, word2Ref, word3Ref }) => {
  return (
    <group>
      <Text ref={word1Ref} fontSize={0.8} color="#ffffff" letterSpacing={0.5} fillOpacity={0} outlineWidth={0.02} outlineColor="#ffffff" position={[0, 1.2, 0]} anchorX="center" anchorY="middle">VISUALIZE</Text>
      <Text ref={word2Ref} fontSize={0.6} color="#888888" letterSpacing={0.3} position={[0, 0.4, 0]} anchorX="center" anchorY="middle">YOUR DREAM</Text>
      <Text ref={word3Ref} fontSize={1.5} color="#ffffff" fontWeight={900} letterSpacing={0.6} position={[0, -0.8, 0]} anchorX="center" anchorY="middle">CAR</Text>
    </group>
  );
};

// Separate inner component so we can call useThree
const AnimatedScene = ({ scrollYProgress }) => {
  const carGroup = useRef();
  const word1 = useRef();
  const word2 = useRef();
  const word3 = useRef();
  const meshesRef = useRef([]);
  const smoothP = useRef(0);

  const { invalidate } = useThree();

  // Subscribe to scroll changes and trigger re-renders on the demand canvas
  useEffect(() => {
    const unsub = scrollYProgress.on('change', () => invalidate());
    return unsub;
  }, [scrollYProgress, invalidate]);

  const { scene } = useGLTF(INTRO_CAR_URL, DRACO_PATH);

  // Set up meshes once on mount — NO texture re-application to every mesh
  useEffect(() => {
    if (!scene) return;
    const meshes = [];
    scene.traverse((child) => {
      if (child.isMesh) {
        meshes.push(child);
        child.visible = false;
        child.castShadow = true;
        child.receiveShadow = false; // saves shadow map pass per mesh
        if (child.material) {
          child.material.envMapIntensity = 1.2;
          child.material.needsUpdate = true;
        }
      }
    });
    meshesRef.current = meshes;
    // Trigger a frame after setup
    invalidate();
  }, [scene, invalidate]);

  // Drive animation from scroll — lerp for smooth catch-up, no useSpring overhead
  useFrame(() => {
    const target = scrollYProgress.get();
    // Fast lerp: closes 20% of gap per frame (~12ms @ 60fps)
    smoothP.current += (target - smoothP.current) * 0.12;
    const p = smoothP.current;

    if (!carGroup.current || !word1.current || !word2.current || !word3.current) return;

    if (p < 0.15) {
      word1.current.visible = true;
      word2.current.visible = true;
      word3.current.visible = true;
      word1.current.fillOpacity = 0;
      word2.current.fillOpacity = 1;
      word3.current.fillOpacity = 1;
      word1.current.strokeOpacity = 1;
      word2.current.strokeOpacity = 1;
      word3.current.strokeOpacity = 1;
      word1.current.position.set(0, 1.2, 0);
      word2.current.position.set(0, 0.4, 0);
      word3.current.position.set(0, -0.8, 0);
      carGroup.current.visible = false;
    } else if (p < 0.95) {
      const localP = (p - 0.15) / 0.8;
      word1.current.position.y = 1.2 + localP * 4;
      word1.current.position.z = localP * 2;
      word2.current.position.x = -localP * 6;
      word2.current.position.z = -localP * 2;
      word3.current.position.y = -0.8 - localP * 4;
      word3.current.position.z = localP * 2;
      const fade = 1 - localP;
      word1.current.fillOpacity = fade;
      word1.current.strokeOpacity = fade;
      word2.current.fillOpacity = fade;
      word2.current.strokeOpacity = fade;
      word3.current.fillOpacity = fade;
      word3.current.strokeOpacity = fade;

      carGroup.current.visible = true;
      carGroup.current.rotation.y = -localP * Math.PI * 0.2;

      const meshes = meshesRef.current;
      const len = meshes.length;
      for (let i = 0; i < len; i++) {
        const threshold = i / len;
        if (localP > threshold) {
          meshes[i].visible = true;
          const offset = Math.max(0, (threshold + 0.1 - localP) * 6);
          meshes[i].position.y = (i % 2 === 0 ? 1 : -1) * offset;
        } else {
          meshes[i].visible = false;
        }
      }
    } else {
      word1.current.visible = false;
      word2.current.visible = false;
      word3.current.visible = false;
      carGroup.current.visible = true;
      const meshes = meshesRef.current;
      for (let i = 0; i < meshes.length; i++) {
        meshes[i].visible = true;
        meshes[i].position.y = 0;
      }
      carGroup.current.rotation.y -= 0.005;
    }

    // Keep rendering while animation hasn't fully settled
    if (Math.abs(target - smoothP.current) > 0.0005) {
      invalidate();
    }
  });

  return (
    <>
      <BackgroundElements />
      <BuildTypography word1Ref={word1} word2Ref={word2} word3Ref={word3} />
      <group position={[0, -2.5, 0]}>
        <Grid infiniteGrid fadeDistance={30} fadeStrength={5} cellSize={1} sectionSize={5} sectionThickness={1.5} sectionColor="#333333" cellColor="#111111" />
      </group>
      <group ref={carGroup} scale={2.5} position={[0, -1.2, 0]}>
        <primitive object={scene} />
      </group>
    </>
  );
};

const TransformerSection = () => {
  const containerRef = useRef(null);
  const { scrollYProgress } = useScroll({ target: containerRef, offset: ['start start', 'end end'] });
  const progressWidth = useTransform(scrollYProgress, [0, 1], ['0%', '100%']);
  const [audioEnabled, setAudioEnabled] = useState(false);
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
    <div ref={containerRef} id="transformer" className="transformer-container" style={{ height: '500vh', background: '#050506' }}>
      <div className="sticky-wrapper" style={{ position: 'sticky', top: 0, height: '100vh', width: '100%', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at center, #1a1a1c 0%, #050506 100%)', zIndex: 0 }} />
        <div style={{ position: 'absolute', inset: 0, zIndex: 5 }}>
          {isCanvasVisible && (
            <Canvas
              frameloop="demand"
              gl={GL_PROPS_TRANSFORMER}
              dpr={ADAPTIVE_DPR}
            >
              <PerspectiveCamera makeDefault position={[0, 0, 12]} fov={38} />
              <ambientLight intensity={0.6} />
              <spotLight
                position={[20, 30, 20]}
                intensity={1200}
                angle={0.4}
                penumbra={1}
                castShadow={false}
                color="#ffffff"
              />
              <pointLight position={[0, 5, 5]} intensity={600} color="#ffffff" />
              <React.Suspense fallback={null}>
                <AnimatedScene scrollYProgress={scrollYProgress} />
                {/* Reduced quality — frames=1 means single bake, not re-rendered each frame */}
                <ContactShadows position={[0, -2.4, 0]} opacity={0.4} scale={18} blur={2} far={8} color="#000000" frames={1} />
                <Environment preset="city" />
              </React.Suspense>
            </Canvas>
          )}
        </div>
        <div
          onClick={() => setAudioEnabled(!audioEnabled)}
          style={{ position: 'absolute', top: '100px', right: '40px', zIndex: 100, cursor: 'pointer', color: audioEnabled ? '#fff' : '#444', fontSize: '0.6rem', letterSpacing: '0.2em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.05)', padding: '10px 20px', borderRadius: '40px', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)' }}
        >
          {audioEnabled ? 'Audio On' : 'Enable Audio'}
        </div>
        <div style={{ position: 'absolute', bottom: '40px', left: '40px', right: '40px', height: '1px', background: 'rgba(255,255,255,0.1)', zIndex: 20 }}>
          <motion.div style={{ height: '100%', background: '#ffffff', width: progressWidth }} />
        </div>
      </div>
    </div>
  );
};

export default TransformerSection;