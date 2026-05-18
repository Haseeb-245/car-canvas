import React, { Suspense, lazy, useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './index.css';
import Hero from './components/Hero';
import CarConfigurator from './components/CarConfigurator';
import AuthModal from './components/AuthModal';

// Lazy load heavy sections
const TransformerSection = lazy(() => import('./components/TransformerSection'));
const CarSelection = lazy(() => import('./components/CarSelection'));
const GlobalFeed = lazy(() => import('./components/GlobalFeed'));

const GlobalLoader = () => (
  <div className="global-fallback">
    <div className="loading-spinner">
      <div className="spinner-ring" />
      <span className="loading-text">LOADING ASSETS</span>
    </div>
  </div>
);

// Main landing page
const Home = ({ user, handleSignOut, setShowAuthModal }) => {
  return (
    <main>
      <Hero user={user} onSignOut={handleSignOut} onOpenAuth={() => setShowAuthModal(true)} />
      <Suspense fallback={<GlobalLoader />}>
        <TransformerSection />
      </Suspense>
      <Suspense fallback={<GlobalLoader />}>
        <CarSelection user={user} onOpenAuth={() => setShowAuthModal(true)} />
      </Suspense>
    </main>
  );
};

function App() {
  const [user, setUser] = useState(() => {
    try {
      const u = localStorage.getItem('cc_user');
      return u ? JSON.parse(u) : null;
    } catch {
      return null;
    }
  });
  const [showAuthModal, setShowAuthModal] = useState(false);

  const handleSignOut = () => {
    localStorage.removeItem('cc_user');
    setUser(null);
  };

  const handleSignIn = (usr) => {
    localStorage.setItem('cc_user', JSON.stringify(usr));
    setUser(usr);
  };

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home user={user} handleSignOut={handleSignOut} setShowAuthModal={setShowAuthModal} />} />
        <Route path="/configure/:carId" element={
          <Suspense fallback={<GlobalLoader />}>
            <CarConfigurator user={user} onOpenAuth={() => setShowAuthModal(true)} />
          </Suspense>
        } />
        <Route path="/feed" element={
          <Suspense fallback={<GlobalLoader />}>
            <GlobalFeed user={user} handleSignOut={handleSignOut} onOpenAuth={() => setShowAuthModal(true)} />
          </Suspense>
        } />
      </Routes>
      <AuthModal 
        isOpen={showAuthModal} 
        onClose={() => setShowAuthModal(false)} 
        onSignIn={handleSignIn} 
      />
    </BrowserRouter>
  );
}

export default App;
