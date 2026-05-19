import React, { useRef, useMemo, useState, useEffect } from 'react';
import { useGLTF, Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// 🔧 Local Draco decoder
const DRACO_PATH = '/draco/';

const CAR_MODEL_URL = '/source/Prosche_final-v6.glb';
useGLTF.preload(CAR_MODEL_URL, DRACO_PATH);

/* Premium Modern Palette - Aggressive & Powerful */
const BODY_COLOR = new THREE.Color('#0a0a0b');  // Satin Obsidian
const RIM_COLOR = new THREE.Color('#121212');  // Matte Black
const BRAKE_COLOR = new THREE.Color('#c5a059');  // Gold Calipers

export default function CarModel({
  doorsOpen = false,
  lightsOn = false,
  autoRotate = true,
  onToggleDoors,
  onToggleLights,
  ...props
}) {
  const { scene } = useGLTF(CAR_MODEL_URL, DRACO_PATH);
  const group = useRef();
  const doors = useRef([]);
  const [activeHotspot, setActiveHotspot] = useState(null);
  const [trailerIndex, setTrailerIndex] = useState(-1);
  const lights = useRef([]);

  const hotspots = [
    { id: 'perf', pos: [0, 0.4, 1.2], title: "POWER", value: "518 HP", sub: "4.0L FLAT-SIX" },
    { id: 'aero', pos: [0, 1.0, -1.6], title: "DRAG", value: "860 KG", sub: "DOWNFORCE" },
    { id: 'wheels', pos: [0.8, -0.4, 1.1], title: "WEIGHT", value: "FORGED", sub: "MAGNESIUM" },
    { id: 'cabin', pos: [0, 0.6, 0.2], title: "CHASSIS", value: "RS", sub: "WEISSACH" }
  ];

  // Auto-Trailer Logic
  useEffect(() => {
    const interval = setInterval(() => {
      setTrailerIndex((prev) => (prev + 1) % hotspots.length);
    }, 4500);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (trailerIndex !== -1) {
      setActiveHotspot(hotspots[trailerIndex].id);
    }
  }, [trailerIndex]);

  useMemo(() => {
    doors.current = [];
    lights.current = [];

    scene.traverse((child) => {
      if (!child.isMesh) return;
      child.castShadow = true;
      child.receiveShadow = true;

      const n = (child.material?.name || child.name || '').toLowerCase();

      // Robust identification for interactions
      if (n.includes('door') || child.name.toLowerCase().includes('door')) {
        child.userData.interactive = 'door';
        doors.current.push({
          mesh: child,
          baseRotation: child.rotation.clone(),
          isLeft: n.includes('left') || n.includes('l') || n.includes('_l'),
        });
      }

      if (n.includes('light') || n.includes('head') || n.includes('tail') || n.includes('emissive') || n.includes('lamp')) {
        child.userData.interactive = 'light';
        lights.current.push(child);
      }
    });
  }, [scene]);

  useFrame((state, delta) => {
    if (group.current && autoRotate) {
      group.current.rotation.y -= delta * 0.2;
    }

    // Animate lights
    const targetIntensity = lightsOn ? 10 : 0;
    lights.current.forEach(light => {
      if (light.material && light.material.emissiveIntensity !== undefined) {
        light.material.emissiveIntensity = THREE.MathUtils.lerp(
          light.material.emissiveIntensity,
          targetIntensity,
          0.1
        );
        if (lightsOn) {
          const isTail = light.name.toLowerCase().includes('tail') || light.name.toLowerCase().includes('back');
          light.material.emissive = isTail ? new THREE.Color('#ff0000') : new THREE.Color('#ffffff');
        }
      }
    });

    // Animate doors
    doors.current.forEach(door => {
      const targetAngle = doorsOpen ? (door.isLeft ? Math.PI / 4 : -Math.PI / 4) : 0;
      door.mesh.rotation.y = THREE.MathUtils.lerp(
        door.mesh.rotation.y,
        door.baseRotation.y + targetAngle,
        0.05
      );
    });
  });

  const handleClick = (e) => {
    e.stopPropagation();
    let current = e.object;
    let type = null;
    
    // Search up for interactive tag
    while (current && !type) {
      if (current.userData?.interactive) type = current.userData.interactive;
      current = current.parent;
    }

    if (type === 'door') onToggleDoors?.();
    if (type === 'light') onToggleLights?.();
  };

  const handlePointerOver = (e) => {
    let current = e.object;
    let interactive = false;
    while (current && !interactive) {
      if (current.userData?.interactive) interactive = true;
      current = current.parent;
    }
    if (interactive) document.body.style.cursor = 'pointer';
  };

  const handlePointerOut = () => {
    document.body.style.cursor = 'auto';
  };

  return (
    <group ref={group} {...props} dispose={null}>
      <primitive object={scene} scale={1.2} position={[0, 0, 0]} rotation={[0, Math.PI * 0.15, 0]} />
      
      {/* ── Spec Hotspots ── */}
      {hotspots.map((h) => (
        <group key={h.id} position={h.pos}>
          {activeHotspot === h.id && (
            <Html center distanceFactor={10}>
              <div className="game-spec-callout">
                <div className="spec-dot" />
                <div className="spec-line-horizontal" />
                <div className="spec-info-box">
                  <span className="spec-category">{h.title}</span>
                  <span className="spec-main-val">{h.value}</span>
                  <span className="spec-desc">{h.sub}</span>
                </div>
              </div>
            </Html>
          )}
        </group>
      ))}
    </group>
  );
}

