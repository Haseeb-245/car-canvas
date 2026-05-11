import React, { Suspense, lazy } from 'react';
import './index.css';
import Hero from './components/Hero';

// Lazy load heavy sections to improve initial TTI
const TransformerSection = lazy(() => import('./components/TransformerSection'));
const CarSelection = lazy(() => import('./components/CarSelection'));

const GlobalLoader = () => (
  <div className="global-fallback">
    <div className="loading-spinner">
      <div className="spinner-ring" />
      <span className="loading-text">LOADING ASSETS</span>
    </div>
  </div>
);

function App() {
  return (
    <main>
      {/* Hero is the LCP, so it remains synchronous for immediate rendering */}
      <Hero />
      
      {/* Heavy 3D sections are lazy-loaded with a sophisticated fallback */}
      <Suspense fallback={<GlobalLoader />}>
        <TransformerSection />
      </Suspense>
      
      <Suspense fallback={<GlobalLoader />}>
        <CarSelection />
      </Suspense>
    </main>
  );
}

export default App;
