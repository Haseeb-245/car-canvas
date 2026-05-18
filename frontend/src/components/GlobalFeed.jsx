import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import './GlobalFeed.css';

// Mock Instagram-style Stories
const MOCK_STORIES = [
  { id: 1, username: 'StanceGod', avatar: '🚗', label: 'GT3 TOURING', img: 'https://images.unsplash.com/photo-1614162692292-7ac56d7f7f1e?w=600&q=80', spec: 'Stage 2 ECU · -40mm stance · matte gray bodywrap' },
  { id: 2, username: 'BoostAddict', avatar: '🏎️', label: 'V8 BI-TURBO', img: 'https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?w=600&q=80', spec: '900 HP · carbon active wing · satin black wrap' },
  { id: 3, username: 'TrackMonster', avatar: '🏁', label: 'R34 ATTACK', img: 'https://images.unsplash.com/photo-1616422285623-13ff0162193c?w=600&q=80', spec: 'HKS sequential transmission · midnight chrome wrap' },
  { id: 4, username: 'JDM_Drifter', avatar: '🔰', label: 'SUPRA MONSTER', img: 'https://images.unsplash.com/photo-1605559424843-9e4c228bf1c2?w=600&q=80', spec: '1200 HP · single turbo swap · active lift stance' },
  { id: 5, username: 'CarbonKing', avatar: '💎', label: '911 CUSTOM', img: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=600&q=80', spec: 'Full dry carbon panel set · custom intake manifolds' }
];

export default function GlobalFeed({ user, handleSignOut, onOpenAuth }) {
  const [feedData, setFeedData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('All');
  const [sortBy, setSortBy] = useState('latest'); 
  const [expandedComments, setExpandedComments] = useState({}); 
  const [commentInputs, setCommentInputs] = useState({}); 
  
  // Instagram / Facebook Style Social States
  const [following, setFollowing] = useState({}); // username -> bool
  const [activeStory, setActiveStory] = useState(null); // Story object or null
  const [activeHeartFlash, setActiveHeartFlash] = useState({}); // postId -> bool
  const [toast, setToast] = useState('');
  const [savedPosts, setSavedPosts] = useState({}); // postId -> bool

  const fetchFeed = () => {
    fetch('http://localhost:5000/api/feed')
      .then(res => res.json())
      .then(data => {
        setFeedData(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load global feed', err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchFeed();
  }, []);

  const handleLike = async (postId) => {
    try {
      const response = await fetch(`http://localhost:5000/api/feed/like/${postId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user?.username })
      });
      if (response.ok) {
        const result = await response.json();
        setFeedData(prev => prev.map(post => {
          if (post._id === postId) {
            return { ...post, likes: result.likes, likedBy: result.likedBy };
          }
          return post;
        }));
      }
    } catch (err) {
      console.error('Failed to process like', err);
    }
  };

  // Double tap to like (Instagram style)
  const handleDoubleTapLike = (postId) => {
    handleLike(postId);
    setActiveHeartFlash(prev => ({ ...prev, [postId]: true }));
    setTimeout(() => {
      setActiveHeartFlash(prev => ({ ...prev, [postId]: false }));
    }, 800);
  };

  const handleAddComment = async (postId) => {
    const text = commentInputs[postId]?.trim();
    if (!text) return;

    if (!user) {
      if (onOpenAuth) onOpenAuth();
      return;
    }

    try {
      const response = await fetch(`http://localhost:5000/api/feed/comment/${postId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user.username, text })
      });
      if (response.ok) {
        const updatedComments = await response.json();
        setFeedData(prev => prev.map(post => {
          if (post._id === postId) {
            return { ...post, comments: updatedComments };
          }
          return post;
        }));
        setCommentInputs(prev => ({ ...prev, [postId]: '' }));
      }
    } catch (err) {
      console.error('Failed to add comment', err);
    }
  };

  const toggleComments = (postId) => {
    setExpandedComments(prev => ({ ...prev, [postId]: !prev[postId] }));
  };

  const handleCommentInputChange = (postId, value) => {
    setCommentInputs(prev => ({ ...prev, [postId]: value }));
  };

  const toggleFollow = (username) => {
    setFollowing(prev => ({ ...prev, [username]: !prev[username] }));
  };

  const toggleSave = (postId) => {
    setSavedPosts(prev => ({ ...prev, [postId]: !prev[postId] }));
    if (!savedPosts[postId]) {
      triggerToast('DESIGN SAVED TO RADAR COMPLIANCE');
    }
  };

  const triggerToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const handleShare = (post) => {
    const shareText = `Check out @${post.username}'s custom ${post.carName} on Car Canvas! Paint: ${post.paintColor}, Tuning: ${post.tuning}.`;
    navigator.clipboard.writeText(shareText);
    triggerToast('TELEMETRY COPIED TO INTEL PORTAL');
  };

  // Filter and sort the posts
  const filteredPosts = feedData
    .filter(post => {
      if (activeFilter === 'All') return true;
      return post.carName.toLowerCase().includes(activeFilter.toLowerCase());
    })
    .sort((a, b) => {
      if (sortBy === 'likes') {
        return b.likes - a.likes;
      }
      return new Date(b.publishedAt) - new Date(a.publishedAt);
    });

  const uniqueCarTypes = ['All', 'Skyline', 'AMG', 'Supra'];

  // Diagnostic Hologram Wireframe fallback for seeded posts
  const renderSeededWireframe = (carId, carName) => {
    const isSkyline = carId === 4;
    const isAMG = carId === 2;
    const neonColor = isSkyline ? '#00ffcc' : isAMG ? '#ff007f' : '#ffea00';
    const glowShadow = `0 0 15px ${neonColor}`;
    
    return (
      <div className="gf-neon-wireframe">
        <div className="gf-grid-lines" />
        <div className="gf-scanner-line" style={{ '--scan-color': neonColor }} />

        <div className="gf-wf-top">
          <span className="gf-wf-pill" style={{ color: neonColor, borderColor: neonColor, textShadow: glowShadow, boxShadow: `inset 0 0 5px ${neonColor}` }}>
            DIAGNOSTIC STREAM // ACTIVE
          </span>
          <span className="gf-wf-rate">CHASSIS_ID: 0{carId}</span>
        </div>

        <div className="gf-wf-body">
          <div className="gf-wf-emoji" style={{ filter: `drop-shadow(${glowShadow})` }}>
            {isSkyline ? '🏎️' : isAMG ? '⚡' : '🔥'}
          </div>
          <div className="gf-wf-carname" style={{ color: neonColor, textShadow: glowShadow }}>
            {carName.toUpperCase()} WIREFRAME SCAN
          </div>
          <div className="gf-wf-sub">COORD_Z // 894.22.E7</div>
        </div>

        <div className="gf-wf-bottom">
          <span>STRUCTURAL PASS: 100%</span>
          <span>TELEMETRY ONLINE</span>
        </div>
      </div>
    );
  };

  return (
    <div className="gf-page-wrapper">
      {/* Alert Notification Toast */}
      {toast && <div className="gf-toast-banner">{toast}</div>}

      {/* Dynamic Background Effects */}
      <div className="gf-background-glow"></div>

      {/* Feed Standalone Navbar */}
      <nav className="gf-navbar">
        <Link to="/" className="gf-back-btn">
          <span>←</span> Back to Configurator
        </Link>
        <div className="gf-nav-logo">
          <span className="gf-logo-dot" />
          DRIVERS CLUB SHOWROOM
        </div>
        <div className="gf-nav-auth">
          {user ? (
            <div className="gf-user-profile">
              <span className="gf-avatar-badge">🏎️ {user.username.toUpperCase()}</span>
              <button onClick={handleSignOut} className="gf-signout-btn">SIGN OUT</button>
            </div>
          ) : (
            <button onClick={onOpenAuth} className="gf-signin-btn">SIGN IN TO INTERACT</button>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <header className="gf-page-hero">
        <div className="gf-hero-overlay"></div>
        <div className="gf-hero-content">
          <span className="gf-badge">TELEMETRY DECK</span>
          <h1 className="gf-main-title">THE FEED</h1>
          <p className="gf-main-subtitle">
            Explore active high-performance custom vehicle configurations, telemetry reports, and build diaries published by real drivers.
          </p>
        </div>
      </header>

      {/* Instagram Style Stories Bar */}
      <div className="gf-stories-bar-container">
        <div className="gf-stories-header">
          <span>LIVE TRACK BULLETINS</span>
          <span className="gf-live-indicator"><span className="live-dot" /> LIVE</span>
        </div>
        <div className="gf-stories-bar">
          {MOCK_STORIES.map(story => (
            <button key={story.id} className="gf-story-bubble-btn" onClick={() => setActiveStory(story)}>
              <div className="gf-story-ring">
                <div className="gf-story-avatar">{story.avatar}</div>
              </div>
              <span className="gf-story-username">{story.username}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Dashboard Controls (Filter / Sort) */}
      <div className="gf-dashboard-controls">
        <div className="gf-filters-group">
          {uniqueCarTypes.map(type => (
            <button
              key={type}
              className={`gf-filter-tab ${activeFilter === type ? 'active' : ''}`}
              onClick={() => setActiveFilter(type)}
            >
              {type === 'All' ? 'ALL BUILDS' : type.toUpperCase()}
            </button>
          ))}
        </div>
        <div className="gf-sort-group">
          <span className="gf-sort-label">ORDER BY</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="gf-sort-select"
          >
            <option value="latest">LATEST CONFIGURATIONS</option>
            <option value="likes">MOST ADORED (TRENDING)</option>
          </select>
        </div>
      </div>

      {/* Cards Grid */}
      <main className="gf-page-main">
        {loading ? (
          <div className="gf-loading-state">
            <div className="gf-loading-spinner"></div>
            <p>ACCESSING COMMUNITY TELEMETRY...</p>
          </div>
        ) : filteredPosts.length === 0 ? (
          <div className="gf-empty-dashboard">
            <span className="gf-empty-icon">🏆</span>
            <h3>No Builds Match Search Filters</h3>
            <p>Be the first driver to construct and publish this model's signature tuning design!</p>
            <Link to="/" className="gf-cta-btn">SPARK IGNITION</Link>
          </div>
        ) : (
          <div className="gf-feed-grid">
            {filteredPosts.map(post => {
              const isLikedByUser = user && post.likedBy && post.likedBy.includes(user.username);
              const isSaved = savedPosts[post._id];
              const isFollowing = following[post.username];
              const hasHeartFlash = activeHeartFlash[post._id];

              return (
                <div key={post._id} className="gf-feed-card">
                  
                  {/* Insta-style Header */}
                  <div className="gf-card-profile-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div className="gf-avatar-round">🏎️</div>
                      <div>
                        <div className="gf-profile-username">@{post.username}</div>
                        <div className="gf-profile-location">TOKYO METROPOLITAN EXPWY</div>
                      </div>
                    </div>
                    {(!user || user.username !== post.username) && (
                      <button
                        className={`gf-profile-follow-btn ${isFollowing ? 'following' : ''}`}
                        onClick={() => toggleFollow(post.username)}
                      >
                        {isFollowing ? 'FOLLOWING' : 'FOLLOW'}
                      </button>
                    )}
                  </div>

                  {/* Photo Canvas (Double Tap to Like) */}
                  <div className="gf-card-viewport" onDoubleClick={() => handleDoubleTapLike(post._id)}>
                    {post.snapshot ? (
                      <img src={post.snapshot} alt={post.carName} className="gf-card-img" />
                    ) : (
                      renderSeededWireframe(post.carId, post.carName)
                    )}
                    <div className="gf-card-tint"></div>
                    
                    {/* Double click heart animation pop */}
                    {hasHeartFlash && (
                      <div className="gf-doubletap-heart-overlay">
                        <span className="pop-heart">❤️</span>
                      </div>
                    )}
                  </div>

                  {/* Instagram Style Action Bar */}
                  <div className="gf-card-action-bar">
                    <div style={{ display: 'flex', gap: '18px' }}>
                      <button
                        className={`gf-action-icon-btn ${isLikedByUser ? 'active-like' : ''}`}
                        onClick={() => handleLike(post._id)}
                        title="Like Build"
                      >
                        {isLikedByUser ? '❤️' : '🤍'}
                      </button>
                      <button
                        className="gf-action-icon-btn"
                        onClick={() => toggleComments(post._id)}
                        title="Comments"
                      >
                        💬
                      </button>
                      <button
                        className="gf-action-icon-btn"
                        onClick={() => handleShare(post)}
                        title="Share Intel"
                      >
                        📤
                      </button>
                    </div>
                    <button
                      className={`gf-action-icon-btn ${isSaved ? 'active-save' : ''}`}
                      onClick={() => toggleSave(post._id)}
                      title="Save Bookmark"
                    >
                      {isSaved ? '🔖' : '📁'}
                    </button>
                  </div>

                  {/* Core Meta Details */}
                  <div className="gf-card-details">
                    <div className="gf-likes-counter-row">
                      <span>{post.likes || 0} telemetry approvals</span>
                    </div>

                    <div className="gf-card-header">
                      <h3 className="gf-card-carname">{post.carName}</h3>
                    </div>

                    <div className="gf-spec-row">
                      <div className="gf-spec-pill">
                        <span className="gf-color-preview" style={{ background: post.paintColor || '#555' }} />
                        <span>PAINT</span>
                      </div>
                      <div className="gf-spec-pill accent">
                        <span>⚡ {post.tuning || 'Stock'}</span>
                      </div>
                    </div>

                    {post.story ? (
                      <blockquote className="gf-card-story">
                        <p>
                          "{post.story}"
                        </p>
                      </blockquote>
                    ) : (
                      <p className="gf-card-nostory">No telemetry log registered for this chassis.</p>
                    )}

                    {/* Social Expand Section (Instagram-like preview) */}
                    <div className="gf-card-social-actions">
                      <button
                        className={`gf-comment-toggle-btn ${expandedComments[post._id] ? 'active' : ''}`}
                        onClick={() => toggleComments(post._id)}
                      >
                        {post.comments && post.comments.length > 0 ? (
                          `View all ${post.comments.length} comments`
                        ) : (
                          'Write a comment...'
                        )}
                      </button>
                      <span className="gf-card-date">
                        {new Date(post.publishedAt).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric'
                        })}
                      </span>
                    </div>

                    {/* Expandable Comments Drawer */}
                    {expandedComments[post._id] && (
                      <div className="gf-comments-drawer">
                        <div className="gf-comments-list">
                          {post.comments && post.comments.length > 0 ? (
                            post.comments.map((comment, idx) => (
                              <div key={idx} className="gf-comment-bubble">
                                <div className="gf-comment-header">
                                  <span className="gf-comment-user">@{comment.username}</span>
                                  <span className="gf-comment-time">
                                    {new Date(comment.createdAt).toLocaleDateString(undefined, {
                                      month: 'short',
                                      day: 'numeric'
                                    })}
                                  </span>
                                </div>
                                <p className="gf-comment-text">{comment.text}</p>
                              </div>
                            ))
                          ) : (
                            <p className="gf-no-comments">No transmission comments received yet.</p>
                          )}
                        </div>

                        {/* Comment Input form */}
                        <div className="gf-comment-form">
                          <input
                            type="text"
                            placeholder={user ? "Type community response..." : "Sign in to join telemetry conversation..."}
                            value={commentInputs[post._id] || ''}
                            onChange={(e) => handleCommentInputChange(post._id, e.target.value)}
                            disabled={!user}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleAddComment(post._id);
                            }}
                            className="gf-comment-input"
                          />
                          <button
                            onClick={() => handleAddComment(post._id)}
                            disabled={!user || !commentInputs[post._id]?.trim()}
                            className="gf-comment-submit-btn"
                          >
                            SEND
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Stories full screen viewer Modal popup */}
      {activeStory && (
        <div className="gf-story-modal-overlay" onClick={() => setActiveStory(null)}>
          <div className="gf-story-modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="gf-story-modal-close" onClick={() => setActiveStory(null)}>×</button>
            <div className="gf-story-modal-header">
              <span className="avatar">{activeStory.avatar}</span>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span className="username">@{activeStory.username}</span>
                <span className="live">LIVE BULLETIN // ACTIVE</span>
              </div>
            </div>
            <div className="gf-story-modal-viewport">
              <img src={activeStory.img} alt={activeStory.label} className="story-img" />
              <div className="gf-story-modal-caption">
                <h3>{activeStory.label}</h3>
                <p className="spec">{activeStory.spec}</p>
                <p className="tags" style={{ color: '#00ffcc', fontWeight: 700, fontSize: '0.8rem', marginTop: '6px' }}>{activeStory.tag}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
