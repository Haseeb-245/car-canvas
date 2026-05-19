import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Key, User, Mail, Gauge, Flame, UserCheck, Eye, EyeOff } from 'lucide-react';
import './AuthModal.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const AuthModal = ({ isOpen, onClose, onSignIn }) => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [revLevel, setRevLevel] = useState(0); // 0 to 100 for interactive speedometer rev-up!
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  if (!isOpen) return null;

  const handleFocus = () => {
    // Rev the engine dial up when user interacts with inputs!
    setRevLevel(65);
  };

  const handleInput = (e) => {
    const length = e.target.value.length;
    setRevLevel(Math.min(100, 30 + length * 5));
  };

  const handleBlur = () => {
    setRevLevel(0);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setRevLevel(100);
    setErrorMsg('');
    setSuccessMsg('');

    const payload = isSignUp ? { username, email, password } : { username, password };
    const endpoint = isSignUp ? `${API_URL}/api/auth/register` : `${API_URL}/api/auth/login`;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Authentication transmission failed.');
      }

      setSuccessMsg(isSignUp ? 'Telemetry Saved! Sign In Now.' : 'Access key matches! Ignition...');
      
      setTimeout(() => {
        if (isSignUp) {
          setIsSignUp(false); // Switch to login state so they can log in!
          setSuccessMsg('');
          setUsername('');
          setPassword('');
          setEmail('');
        } else {
          onSignIn(data.user);
          onClose();
        }
      }, 1500);

    } catch (err) {
      console.error(err);
      setErrorMsg(err.message);
      setRevLevel(20); // Muted RPM on failure
    }
  };

  return (
    <AnimatePresence>
      <div className="auth-overlay">
        <motion.div 
          className="auth-modal-card"
          initial={{ opacity: 0, scale: 0.9, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 30 }}
          transition={{ type: 'spring', damping: 25, stiffness: 180 }}
        >
          {/* Carbon Fiber Background Accent */}
          <div className="carbon-grid-layer" />

          {/* Close button with mechanical cross-hair */}
          <button className="auth-close-btn" onClick={onClose}>
            <X size={18} />
          </button>

          {/* Left panel: Tactile Dashboard Gauge */}
          <div className="auth-dashboard-panel">
            <div className="gauge-housing">
              {/* Radial speedo dial arch */}
              <svg className="speedo-svg" viewBox="0 0 100 100">
                <circle 
                  className="speedo-bg-track" 
                  cx="50" cy="50" r="40" 
                  strokeDasharray="188 251" 
                  strokeLinecap="round"
                />
                <circle 
                  className="speedo-active-track" 
                  cx="50" cy="50" r="40" 
                  strokeDasharray={`${(revLevel / 100) * 188} 251`}
                  strokeLinecap="round"
                  style={{ stroke: revLevel > 80 ? '#ff3344' : '#00ffcc' }}
                />
              </svg>
              {/* Speedometer Needle */}
              <div 
                className="speedo-needle" 
                style={{ transform: `rotate(${-120 + (revLevel / 100) * 240}deg)` }} 
              />
              {/* Digital Readout */}
              <div className="speedo-digital">
                <span className="digit-val">{Math.round(revLevel * 80)}</span>
                <span className="digit-lbl">RPM</span>
              </div>
            </div>

            {/* Quote of the day */}
            <div className="dashboard-quote" style={{ marginTop: 'auto' }}>
              "IGNITE YOUR PASSION, DESIGN THE INCREDIBLE."
            </div>
          </div>

          {/* Right panel: Premium Input Fields */}
          <div className="auth-form-panel">
            <div className="auth-header">
              <span className="auth-eyebrow">CAR CANVAS GARAGE</span>
              <h2 className="auth-title">{isSignUp ? 'REGISTER PROFILE' : 'DRIVER SIGN IN'}</h2>
            </div>

            {/* Toggle dashboard switches between Sign In and Sign Up */}
            <div className="dashboard-switch-container">
              <button 
                type="button" 
                className={`switch-tab ${!isSignUp ? 'active' : ''}`}
                onClick={() => setIsSignUp(false)}
              >
                SIGN IN
              </button>
              <button 
                type="button" 
                className={`switch-tab ${isSignUp ? 'active' : ''}`}
                onClick={() => setIsSignUp(true)}
              >
                CREATE PROFILE
              </button>
              <div className={`switch-slider-pill ${isSignUp ? 'right' : 'left'}`} />
            </div>

            <form onSubmit={handleSubmit} className="auth-form">
              {errorMsg && (
                <div className="auth-alert-message error" style={{ background: 'rgba(255, 51, 68, 0.1)', border: '1px solid #ff3344', color: '#ff3344', padding: '10px 14px', borderRadius: '10px', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '15px' }}>
                  ⚠️ SYSTEM ALERT: {errorMsg}
                </div>
              )}
              {successMsg && (
                <div className="auth-alert-message success" style={{ background: 'rgba(0, 255, 204, 0.1)', border: '1px solid #00ffcc', color: '#00ffcc', padding: '10px 14px', borderRadius: '10px', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '15px' }}>
                  ⚙️ STATUS: {successMsg}
                </div>
              )}
              {isSignUp && (
                <div className="auth-input-group">
                  <label className="auth-input-label">DRIVER SIGNATURE (EMAIL)</label>
                  <div className="auth-input-wrapper">
                    <Mail size={16} className="input-icon" />
                    <input 
                      type="email" 
                      placeholder="driver@carcanvas.com" 
                      value={email}
                      onChange={(e) => { setEmail(e.target.value); handleInput(e); }}
                      onFocus={handleFocus}
                      onBlur={handleBlur}
                      required
                    />
                  </div>
                </div>
              )}

              <div className="auth-input-group">
                <label className="auth-input-label">RACER TAG (USERNAME)</label>
                <div className="auth-input-wrapper">
                  <User size={16} className="input-icon" />
                  <input 
                    type="text" 
                    placeholder="Enter Username" 
                    value={username}
                    onChange={(e) => { setUsername(e.target.value); handleInput(e); }}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                    required
                  />
                </div>
              </div>

              <div className="auth-input-group">
                <label className="auth-input-label">ACCESS KEY (PASSWORD)</label>
                <div className="auth-input-wrapper">
                  <Key size={16} className="input-icon" />
                  <input 
                    type={showPassword ? 'text' : 'password'} 
                    placeholder="••••••••" 
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); handleInput(e); }}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                    required
                  />
                  <button 
                    type="button" 
                    className="password-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Action Button: Tactile mechanical launch switch */}
              <button 
                type="submit" 
                className="engine-ignition-btn"
                onMouseEnter={() => setRevLevel(90)}
                onMouseLeave={() => setRevLevel(0)}
              >
                <div className="btn-carbon-overlay" />
                <span className="btn-content">
                  <Flame size={16} className="btn-glow-icon" />
                  {isSignUp ? 'LAUNCH ACCOUNT' : 'IGNITE ENGINE'}
                </span>
              </button>
            </form>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default AuthModal;
