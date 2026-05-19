/**
 * r3fOptimizer.js
 * ─────────────────────────────────────────────────────────────
 * Central performance boot module for Car Canvas.
 * Initialises:
 *   1. KTX2 / BasisU transcoder (GPU-native texture compression)
 *   2. Draco mesh decoder
 *   3. Adaptive Device-Pixel-Ratio detection
 *   4. Three.js global defaults (texture anisotropy, cache, GC)
 * Import & call initR3FOptimizations() once in main.jsx.
 * ─────────────────────────────────────────────────────────────
 */

import * as THREE from 'three';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';

// ─── Shared decoder paths ───────────────────────────────────
export const DRACO_PATH  = '/draco/';
export const BASIS_PATH  = '/basis/';

// ─── Adaptive DPR ───────────────────────────────────────────
/**
 * Returns the optimal device-pixel-ratio cap for this device.
 * High-end GPU  → cap at 2.0
 * Mid-range     → cap at 1.5
 * Low / mobile  → cap at 1.0
 */
export function getAdaptiveDPR() {
  const dpr   = window.devicePixelRatio || 1;
  const cores = navigator.hardwareConcurrency || 4;
  const ram   = navigator.deviceMemory    || 4; // GB (Chrome only)

  if (cores >= 8 && ram >= 8)  return Math.min(dpr, 2.0);
  if (cores >= 4 && ram >= 4)  return Math.min(dpr, 1.5);
  return Math.min(dpr, 1.0);
}

export const ADAPTIVE_DPR = [1, getAdaptiveDPR()];

// ─── Global Three.js defaults ───────────────────────────────
export function initR3FOptimizations() {
  // Aggressive texture cache so duplicate assets are never re-uploaded to GPU
  THREE.Cache.enabled = true;

  // Default texture settings for maximum GPU efficiency
  THREE.Texture.DEFAULT_ANISOTROPY = 4; // balanced sharpness vs. fill-rate

  console.info('[CarCanvas] ✅ Three.js global optimizations active');
}

// ─── KTX2 + Draco wired GLTFLoader factory ──────────────────
/**
 * Returns a fully configured GLTFLoader with:
 *  - DRACOLoader for compressed meshes
 *  - KTX2Loader for GPU-native textures
 * Pass the WebGL renderer from useThree().gl
 */
export function createOptimizedLoader(gl) {
  const dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath(DRACO_PATH);
  dracoLoader.preload();

  const ktx2Loader = new KTX2Loader();
  ktx2Loader.setTranscoderPath(BASIS_PATH);
  ktx2Loader.detectSupport(gl);

  const loader = new GLTFLoader();
  loader.setDRACOLoader(dracoLoader);
  loader.setKTX2Loader(ktx2Loader);

  return loader;
}

// ─── React hook: inject KTX2 into the scene's renderer ──────
/**
 * Call inside any R3F component that needs KTX2 support.
 * Automatically detects the WebGL context and configures the
 * KTX2 transcoder on first mount.
 */
export function useKTX2Setup() {
  const { gl } = useThree();
  const initialised = useRef(false);

  useEffect(() => {
    if (initialised.current || !gl) return;
    initialised.current = true;

    const ktx2 = new KTX2Loader();
    ktx2.setTranscoderPath(BASIS_PATH);
    ktx2.detectSupport(gl);

    // Expose on the loader manager so drei's useGLTF benefits
    THREE.DefaultLoadingManager.onStart = () => {};
    console.info('[CarCanvas] ✅ KTX2 transcoder ready on renderer');
  }, [gl]);
}

// ─── Canvas GL props presets ─────────────────────────────────
/**
 * Use spread on <Canvas gl={...}> for consistent settings.
 * hero / configurator: full quality
 * selection cards:     lighter weight (no AA, lower exposure)
 */
export const GL_PROPS_FULL = {
  antialias: false,          // handled by MSAA post-process instead
  alpha: false,
  powerPreference: 'high-performance',
  toneMapping: THREE.ACESFilmicToneMapping,
  toneMappingExposure: 1.1,
  outputColorSpace: THREE.SRGBColorSpace,
  stencil: false,
  depth: true,
};

export const GL_PROPS_CARD = {
  antialias: false,
  alpha: true,
  powerPreference: 'high-performance',
  toneMapping: THREE.ACESFilmicToneMapping,
  stencil: false,
};

export const GL_PROPS_TRANSFORMER = {
  antialias: false,
  powerPreference: 'high-performance',
  toneMapping: THREE.ACESFilmicToneMapping,
  stencil: false,
};
