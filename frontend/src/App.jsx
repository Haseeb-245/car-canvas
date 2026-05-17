import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './index.css';
import Hero from './components/Hero';
import CarConfigurator from './components/CarConfigurator';

// Lazy load heavy sections
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

// Main landing page
const Home = () => (
  <main>
    <Hero />
    <Suspense fallback={<GlobalLoader />}>
      <TransformerSection />
    </Suspense>
    <Suspense fallback={<GlobalLoader />}>
      <CarSelection />
    </Suspense>
  </main>
);

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/configure/:carId" element={
          <Suspense fallback={<GlobalLoader />}>
            <CarConfigurator />
          </Suspense>
        } />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
