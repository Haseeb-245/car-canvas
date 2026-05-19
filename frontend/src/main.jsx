import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { initR3FOptimizations } from './utils/r3fOptimizer.js'

// ── Boot Three.js global performance optimizations ──
// (KTX2 transcoder cache, anisotropy defaults, texture cache)
initR3FOptimizations();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
