import React, { useRef, useMemo, useEffect, useState } from 'react';
import { motion, useScroll, useTransform, useSpring } from 'framer-motion';
import { Canvas, useFrame } from '@react-three/fiber';
import {
  Environment,
  ContactShadows,
  PerspectiveCamera,
  useGLTF,
  useTexture,
  Text,
  Grid,
  Float
} from '@react-three/drei';
import * as THREE from 'three';
import { GL_PROPS_TRANSFORMER, ADAPTIVE_DPR } from '../utils/r3fOptimizer.js';

// 🔧 Local Draco decoder
const DRACO_PATH = '/draco/';

const INTRO_CAR_URL = '/merc/source/mercedes_amg_gt4_final-v1.glb';
const SNAP_SOUND = 'https://assets.mixkit.co/sfx/preview/mixkit-mechanical-clutter-snap-1002.mp3';

const BackgroundElements = () => {
  return (
    <group position={[0, 0, -5]}>
      <Text fontSize={10} color="#ffffff" fillOpacity={0.02} position={[0, 0, -2]}>GT4</Text>
      <Float speed={2} rotationIntensity={0.5} floatIntensity={0.5}>
        <mesh position={[-8, 4, 0]}>
          <planeGeometry args={[0.02, 10]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.1} />
        </mesh>
      </Float>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, -2.4, 0]}>
        <ringGeometry args={[6, 6.1, 64]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.1} />
      </mesh>
    </group>
  );
};

const BuildTypography = ({ word1Ref, word2Ref, word3Ref }) => {
  return (
    <group rotation={[0, 0, 0]}>
      <Text ref={word1Ref} fontSize={0.8} color="#ffffff" letterSpacing={0.5} fillOpacity={0} outlineWidth={0.02} outlineColor="#ffffff" position={[0, 1.2, 0]} anchorX="center" anchorY="middle" rotation={[0, 0, 0]}>VISUALIZE</Text>
      <Text ref={word2Ref} fontSize={0.6} color="#888888" letterSpacing={0.3} position={[0, 0.4, 0]} anchorX="center" anchorY="middle" rotation={[0, 0, 0]}>YOUR DREAM</Text>
      <Text ref={word3Ref} fontSize={1.5} color="#ffffff" fontWeight={900} letterSpacing={0.6} position={[0, -0.8, 0]} anchorX="center" anchorY="middle" rotation={[0, 0, 0]}>CAR</Text>
    </group>
  );
};

const AnimatedScene = ({ scrollYProgress, audioEnabled }) => {
  const carGroup = useRef();
  const word1 = useRef();
  const word2 = useRef();
  const word3 = useRef();
  const meshesRef = useRef([]);

  const { scene } = useGLTF(INTRO_CAR_URL, DRACO_PATH);
  const textures = useTexture({
    livery: '/merc/textures/livery.png',
    skin: '/merc/textures/ext_skin.png',
    altSkin: '/merc/textures/gltf_embedded_32.png',
    decalsNorm: '/merc/textures/ext_decals_nm.png'
  });

  useEffect(() => {
    if (!scene) return;
    const meshes = [];
    scene.traverse((child) => {
      if (child.isMesh) {
        meshes.push(child);
        child.visible = false;
        child.castShadow = true;
        child.receiveShadow = true;

        const name = child.name.toLowerCase();
        const matName = (child.material.name || '').toLowerCase();

        if (child.material) {
          if (name.includes('body') || matName.includes('body') || name.includes('paint') || name.includes('ext')) {
            child.material.map = textures.altSkin || textures.skin;
            child.material.color.set('#ffffff');
            child.material.metalness = 0.8;
            child.material.roughness = 0.2;
          }
          if (name.includes('decal') || matName.includes('decal') || name.includes('sticker')) {
            child.material.map = textures.livery;
            child.material.transparent = true;
            child.material.alphaTest = 0.5;
          }
          child.material.normalMap = textures.decalsNorm;
          child.material.envMapIntensity = 1.2;
          child.material.toneMapped = true;
          child.material.needsUpdate = true;
        }
      }
    });
    meshesRef.current = meshes;
  }, [scene, textures]);

  const smoothProgress = useSpring(scrollYProgress, { stiffness: 40, damping: 20 });

  useFrame((state) => {
    const p = smoothProgress.get();
    if (!carGroup.current || !word1.current || !word2.current || !word3.current) return;

    if (p < 0.15) {
      [word1, word2, word3].forEach((ref) => {
        ref.current.visible = true;
        ref.current.rotation.set(0, 0, 0);
        ref.current.fillOpacity = ref.current === word1.current ? 0 : 1;
        ref.current.position.y = (ref.current === word1.current ? 1.2 : ref.current === word2.current ? 0.4 : -0.8);
        ref.current.strokeOpacity = 1;
      });
      carGroup.current.visible = false;
    } else if (p < 0.95) {
      const localP = (p - 0.15) / 0.8;
      word1.current.position.y = 1.2 + localP * 4;
      word1.current.position.z = localP * 2;
      word2.current.position.x = -localP * 6;
      word2.current.position.z = -localP * 2;
      word3.current.position.y = -0.8 - localP * 4;
      word3.current.position.z = localP * 2;
      [word1, word2, word3].forEach(ref => {
        ref.current.rotation.set(0, 0, 0);
        ref.current.fillOpacity = 1 - localP;
        ref.current.strokeOpacity = 1 - localP;
      });
      carGroup.current.visible = true;
      carGroup.current.rotation.y = -localP * Math.PI * 0.2;
      
      const meshes = meshesRef.current;
      meshes.forEach((mesh, i) => {
        const threshold = i / meshes.length;
        if (localP > threshold) {
          mesh.visible = true;
          const offset = Math.max(0, (threshold + 0.1 - localP) * 6);
          mesh.position.y = (i % 2 === 0 ? 1 : -1) * offset;
        } else {
          mesh.visible = false;
        }
      });
    } else {
      [word1, word2, word3].forEach((ref) => { ref.current.visible = false; });
      carGroup.current.visible = true;
      meshesRef.current.forEach((mesh) => {
        mesh.visible = true;
        mesh.position.y = 0;
      });
      carGroup.current.rotation.y -= 0.005;
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
  const { scrollYProgress } = useScroll({ target: containerRef, offset: ["start start", "end end"] });
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [isCanvasVisible, setIsCanvasVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsCanvasVisible(true);
        }
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
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '100%', background: 'linear-gradient(to bottom, transparent, rgba(255,255,255,0.02) 50%, transparent)', zIndex: 1 }} />
        <div style={{ position: 'absolute', inset: 0, zIndex: 5 }}>
          {isCanvasVisible && (
            <Canvas 
              shadows 
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
                castShadow 
                color="#ffffff" 
                shadow-mapSize={[512, 512]}
              />
              <pointLight position={[0, 5, 5]} intensity={600} color="#ffffff" />
              <React.Suspense fallback={null}>
                <AnimatedScene scrollYProgress={scrollYProgress} audioEnabled={audioEnabled} />
                <ContactShadows position={[0, -2.4, 0]} opacity={0.5} scale={25} blur={3} far={10} color="#000000" />
                <Environment preset="warehouse" />
              </React.Suspense>
            </Canvas>
          )}
        </div>
        <div onClick={() => setAudioEnabled(!audioEnabled)} style={{ position: 'absolute', top: '100px', right: '40px', zIndex: 100, cursor: 'pointer', color: audioEnabled ? '#fff' : '#444', fontSize: '0.6rem', letterSpacing: '0.2em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.05)', padding: '10px 20px', borderRadius: '40px', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)' }}>
          {audioEnabled ? 'Audio On' : 'Enable Audio'}
        </div>
        <div style={{ position: 'absolute', bottom: '40px', left: '40px', right: '40px', height: '1px', background: 'rgba(255,255,255,0.1)', zIndex: 20 }}>
          <motion.div style={{ height: '100%', background: '#ffffff', width: useTransform(scrollYProgress, [0, 1], ['0%', '100%']) }} />
        </div>
      </div>
    </div>
  );
};

export default TransformerSection;