import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../AuthContext';

export default function LandingPage({ initialSection }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  // Active navigation tab highlight: 'auction' | 'teams' | 'how-to-play'
  const [activeTab, setActiveTab] = useState(() => {
    if (initialSection === 'teams' || location.pathname === '/teams') return 'teams';
    if (initialSection === 'how-to-play' || location.pathname === '/how-to-play') return 'how-to-play';
    return 'auction';
  });

  // Modals for deep-linked routes
  const [modalOpen, setModalOpen] = useState(() => {
    if (initialSection === 'teams' || location.pathname === '/teams') return 'teams';
    if (initialSection === 'how-to-play' || location.pathname === '/how-to-play') return 'how-to-play';
    return null;
  });

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (location.pathname === '/teams' || initialSection === 'teams') {
      setActiveTab('teams');
      setModalOpen('teams');
    } else if (location.pathname === '/how-to-play' || initialSection === 'how-to-play') {
      setActiveTab('how-to-play');
      setModalOpen('how-to-play');
    } else {
      setActiveTab('auction');
      setModalOpen(null);
    }
  }, [location.pathname, initialSection]);

  const handleNavClick = (tab) => {
    setActiveTab(tab);
    setMobileMenuOpen(false);
    if (tab === 'auction') {
      setModalOpen(null);
      navigate('/');
    } else if (tab === 'teams') {
      setModalOpen('teams');
      navigate('/teams');
    } else if (tab === 'how-to-play') {
      setModalOpen('how-to-play');
      navigate('/how-to-play');
    }
  };

  const closeModal = () => {
    setModalOpen(null);
    setActiveTab('auction');
    navigate('/');
  };

  // 10 Official Franchises Metadata
  const franchiseList = [
    { code: 'CSK', name: 'Chennai Super Kings', city: 'Chennai', color: '#f9cd05', venue: 'M. A. Chidambaram Stadium' },
    { code: 'MI', name: 'Mumbai Indians', city: 'Mumbai', color: '#004ba0', venue: 'Wankhede Stadium' },
    { code: 'RCB', name: 'Royal Challengers Bengaluru', city: 'Bengaluru', color: '#d32f2f', venue: 'M. Chinnaswamy Stadium' },
    { code: 'DC', name: 'Delhi Capitals', city: 'Delhi', color: '#2563eb', venue: 'Arun Jaitley Stadium' },
    { code: 'KKR', name: 'Kolkata Knight Riders', city: 'Kolkata', color: '#3a225d', venue: 'Eden Gardens' },
    { code: 'PBKS', name: 'Punjab Kings', city: 'Mohali', color: '#ed1b24', venue: 'PCA Stadium Mullanpur' },
    { code: 'RR', name: 'Rajasthan Royals', city: 'Jaipur', color: '#eb178b', venue: 'Sawai Mansingh Stadium' },
    { code: 'SRH', name: 'Sunrisers Hyderabad', city: 'Hyderabad', color: '#ff6200', venue: 'Rajiv Gandhi Intl Stadium' },
    { code: 'LSG', name: 'Lucknow Super Giants', city: 'Lucknow', color: '#00a3e0', venue: 'BRSABV Ekana Stadium' },
    { code: 'GT', name: 'Gujarat Titans', city: 'Ahmedabad', color: '#1b2133', venue: 'Narendra Modi Stadium' }
  ];

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: 'var(--navy-midnight, #03101F)',
      color: 'var(--white-main, #F5F7FA)',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      position: 'relative',
      overflowX: 'hidden'
    }}>

      {/* =====================================================================
          2. TOP NAVIGATION BAR (SLIM, FULL-WIDTH, DEEP NAVY, AUTHENTIC IPL LOGO)
          ===================================================================== */}
      <nav style={{
        width: '100%',
        backgroundColor: '#03101F',
        borderBottom: '1px solid rgba(0, 168, 255, 0.2)',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        boxShadow: '0 4px 25px rgba(0, 0, 0, 0.5)'
      }}>
        <div style={{
          maxWidth: '1240px',
          margin: '0 auto',
          padding: '0 1.25rem',
          height: '62px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1.5rem'
        }}>

          {/* Left: Real IPL Logo Asset */}
          <div 
            onClick={() => handleNavClick('auction')}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              cursor: 'pointer',
              userSelect: 'none'
            }}
          >
            <img 
              src="/ipl_logo.svg" 
              alt="Indian Premier League Official Logo"
              style={{
                height: '42px',
                width: 'auto',
                maxWidth: '92px',
                objectFit: 'contain',
                display: 'block'
              }}
              onError={(e) => {
                // Fallback graceful logo badge
                e.currentTarget.style.display = 'none';
              }}
            />
            <span style={{
              marginLeft: '0.85rem',
              paddingLeft: '0.85rem',
              borderLeft: '1px solid rgba(255, 255, 255, 0.15)',
              fontFamily: "'Outfit', sans-serif",
              fontSize: '0.78rem',
              fontWeight: '800',
              letterSpacing: '0.14em',
              color: '#FFC928',
              textTransform: 'uppercase'
            }}>
              AUCTION PRO
            </span>
          </div>

          {/* Middle Navigation Links (AUCTION, TEAM, HOW TO PLAY) */}
          <div className="desktop-nav-links" style={{
            display: 'flex',
            alignItems: 'center',
            gap: '2.5rem',
            height: '100%'
          }}>
            {[
              { id: 'auction', label: 'AUCTION' },
              { id: 'teams', label: 'TEAM' },
              { id: 'how-to-play', label: 'HOW TO PLAY' }
            ].map((link) => {
              const isActive = activeTab === link.id;
              return (
                <button
                  key={link.id}
                  onClick={() => handleNavClick(link.id)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    fontFamily: "'Outfit', sans-serif",
                    fontSize: '0.86rem',
                    fontWeight: isActive ? '800' : '600',
                    color: isActive ? '#FFFFFF' : '#91A6BE',
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                    position: 'relative',
                    transition: 'color 0.2s ease',
                    padding: '0 0.25rem'
                  }}
                  onMouseOver={(e) => { if (!isActive) e.currentTarget.style.color = '#FFFFFF'; }}
                  onMouseOut={(e) => { if (!isActive) e.currentTarget.style.color = '#91A6BE'; }}
                >
                  {link.label}
                  {isActive && (
                    <span style={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      height: '3px',
                      backgroundColor: '#FFC928',
                      boxShadow: '0 -1px 8px rgba(255, 201, 40, 0.6)'
                    }}></span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Right Side: LIVE AUCTIONS & LOGIN */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            
            {/* LIVE AUCTIONS Button with Red Indicator */}
            <button
              onClick={() => navigate('/viewer')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.55rem',
                padding: '0.5rem 1rem',
                backgroundColor: 'rgba(6, 24, 39, 0.8)',
                border: '1px solid rgba(255, 59, 48, 0.45)',
                borderRadius: '5px',
                color: '#F5F7FA',
                fontFamily: "'Outfit', sans-serif",
                fontSize: '0.78rem',
                fontWeight: '700',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: '0 0 12px rgba(255, 59, 48, 0.15)'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.borderColor = '#FF3B30';
                e.currentTarget.style.backgroundColor = 'rgba(255, 59, 48, 0.12)';
                e.currentTarget.style.boxShadow = '0 0 16px rgba(255, 59, 48, 0.35)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.borderColor = 'rgba(255, 59, 48, 0.45)';
                e.currentTarget.style.backgroundColor = 'rgba(6, 24, 39, 0.8)';
                e.currentTarget.style.boxShadow = '0 0 12px rgba(255, 59, 48, 0.15)';
              }}
            >
              <span className="live-dot-red"></span>
              <span>LIVE AUCTIONS</span>
            </button>

            {/* User Profile or LOGIN Button */}
            {user ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button
                  onClick={() => {
                    if (user.role === 'ADMIN') navigate('/manager');
                    else if (user.role === 'AUCTIONEER') navigate('/auctioneer');
                    else if (user.role === 'TEAM_LEADER') navigate('/team-leader');
                    else navigate('/viewer');
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    padding: '0.5rem 0.95rem',
                    backgroundColor: 'rgba(255, 201, 40, 0.12)',
                    border: '1px solid #FFC928',
                    borderRadius: '5px',
                    color: '#FFC928',
                    fontFamily: "'Outfit', sans-serif",
                    fontSize: '0.78rem',
                    fontWeight: '700',
                    letterSpacing: '0.06em',
                    cursor: 'pointer'
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                  </svg>
                  <span>{user.username.toUpperCase()}</span>
                </button>
                <button
                  onClick={logout}
                  title="Sign Out"
                  style={{
                    padding: '0.5rem 0.65rem',
                    backgroundColor: 'transparent',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: '5px',
                    color: '#91A6BE',
                    cursor: 'pointer',
                    fontSize: '0.75rem'
                  }}
                >
                  ✕
                </button>
              </div>
            ) : (
              <button
                onClick={() => navigate('/login')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  padding: '0.5rem 1.15rem',
                  backgroundColor: 'rgba(0, 168, 255, 0.1)',
                  border: '1px solid rgba(0, 168, 255, 0.4)',
                  borderRadius: '5px',
                  color: '#FFFFFF',
                  fontFamily: "'Outfit', sans-serif",
                  fontSize: '0.78rem',
                  fontWeight: '700',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.borderColor = '#00A8FF';
                  e.currentTarget.style.backgroundColor = 'rgba(0, 168, 255, 0.22)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(0, 168, 255, 0.4)';
                  e.currentTarget.style.backgroundColor = 'rgba(0, 168, 255, 0.1)';
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                  <circle cx="12" cy="7" r="4"></circle>
                </svg>
                <span>LOGIN</span>
              </button>
            )}

            {/* Mobile hamburger button */}
            <button
              className="mobile-menu-btn"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              style={{
                display: 'none',
                background: 'transparent',
                border: 'none',
                color: '#FFFFFF',
                padding: '0.4rem',
                cursor: 'pointer'
              }}
              aria-label="Toggle Navigation Menu"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="12" x2="21" y2="12"></line>
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <line x1="3" y1="18" x2="21" y2="18"></line>
              </svg>
            </button>
          </div>

        </div>

        {/* Mobile Dropdown Nav Menu */}
        {mobileMenuOpen && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            padding: '1rem 1.5rem',
            backgroundColor: '#061827',
            borderTop: '1px solid rgba(0, 168, 255, 0.2)'
          }}>
            {[
              { id: 'auction', label: 'AUCTION' },
              { id: 'teams', label: 'TEAM' },
              { id: 'how-to-play', label: 'HOW TO PLAY' }
            ].map(link => (
              <button
                key={link.id}
                onClick={() => handleNavClick(link.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  textAlign: 'left',
                  padding: '0.75rem 0',
                  color: activeTab === link.id ? '#FFC928' : '#F5F7FA',
                  fontFamily: "'Outfit', sans-serif",
                  fontSize: '0.95rem',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}
              >
                {link.label}
              </button>
            ))}
          </div>
        )}
      </nav>

      {/* =====================================================================
          3. MAIN CINEMATIC HERO SECTION (~360–390px tall, Wankhede night photo)
          ===================================================================== */}
      <section style={{
        position: 'relative',
        width: '100%',
        minHeight: '460px',
        height: 'clamp(460px, 40vw, 620px)',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        backgroundColor: '#03101F'
      }}>
        {/* Genuine Stadium & Auction Stage Background Photo */}
        <img 
          src="/image.png" 
          alt="IPL Auction Arena Stage in Stadium"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'center center',
            zIndex: 1
          }}
        />

        {/* Subtle, Smooth Gradient Overlay (keeps stadium, stage, and flags visible) */}
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(90deg, rgba(3, 16, 31, 0.62) 0%, rgba(3, 16, 31, 0.44) 24%, rgba(3, 16, 31, 0.18) 48%, rgba(3, 16, 31, 0.04) 72%, transparent 100%)',
          zIndex: 2,
          pointerEvents: 'none'
        }}></div>

        {/* Hero Content (Vertically centered, grouped on left half) */}
        <div style={{
          position: 'relative',
          zIndex: 4,
          maxWidth: '1240px',
          width: '100%',
          margin: '0 auto',
          padding: '2.5rem 1.5rem',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center'
        }}>
          <div style={{ maxWidth: '560px' }}>
            
            {/* Small Gold Eyebrow */}
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              color: '#FFC928',
              fontFamily: "'Outfit', sans-serif",
              fontSize: '0.76rem',
              fontWeight: '800',
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              marginBottom: '0.85rem',
              textShadow: '0 2px 8px rgba(0, 0, 0, 0.9)'
            }}>
              <span style={{ width: '16px', height: '2px', backgroundColor: '#FFC928', boxShadow: '0 0 6px rgba(255, 201, 40, 0.6)' }}></span>
              THE ULTIMATE CRICKET AUCTION EXPERIENCE
            </div>

            {/* Main Heading (White + Gold sports condensed typography) */}
            <h1 style={{
              fontFamily: "'Outfit', sans-serif",
              fontSize: 'clamp(2.4rem, 4.5vw, 3.8rem)',
              fontWeight: '900',
              lineHeight: 1.04,
              letterSpacing: '-0.02em',
              textTransform: 'uppercase',
              margin: '0 0 1rem 0'
            }}>
              <span style={{ 
                color: '#F5F7FA', 
                display: 'block',
                textShadow: '0 3px 12px rgba(0, 0, 0, 0.95), 0 1px 3px rgba(0, 0, 0, 0.9)'
              }}>
                BUILD YOUR
              </span>
              <span style={{ 
                color: '#FFC928', 
                display: 'block',
                textShadow: '0 3px 14px rgba(0, 0, 0, 0.95), 0 0 24px rgba(255, 201, 40, 0.35)'
              }}>
                DREAM SQUAD.
              </span>
            </h1>

            {/* Sports Description */}
            <p style={{
              color: '#E2E8F0',
              fontSize: 'clamp(0.92rem, 1.15vw, 1.05rem)',
              lineHeight: 1.55,
              fontWeight: '400',
              marginBottom: '1.75rem',
              textShadow: '0 2px 8px rgba(0, 0, 0, 0.9)'
            }}>
              Strategic bidding. Real-time auctions. Ten franchises.<br />
              One winning squad.
            </p>

            {/* Hero Action Buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              
              {/* Primary: ENTER AUCTION */}
              <button
                onClick={() => navigate('/viewer')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.65rem',
                  padding: '0.75rem 1.6rem',
                  backgroundColor: '#FFC928',
                  color: '#03101F',
                  fontFamily: "'Outfit', sans-serif",
                  fontSize: '0.88rem',
                  fontWeight: '800',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  boxShadow: '0 8px 24px rgba(255, 201, 40, 0.35)',
                  transition: 'all 0.2s ease'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = '#FFE072';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 12px 28px rgba(255, 201, 40, 0.5)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = '#FFC928';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 8px 24px rgba(255, 201, 40, 0.35)';
                }}
              >
                {/* Gavel icon */}
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m14 13-7.5 7.5a2.12 2.12 0 1 1-3-3L11 10"></path>
                  <path d="m16 16 6-6"></path>
                  <path d="m8 8 6-6"></path>
                  <path d="m9 7 8 8"></path>
                  <path d="m21 11-8-8"></path>
                </svg>
                <span>ENTER AUCTION &rarr;</span>
              </button>

              {/* Secondary: WATCH LIVE AUCTIONS */}
              <button
                onClick={() => navigate('/viewer')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.65rem',
                  padding: '0.72rem 1.45rem',
                  backgroundColor: 'rgba(3, 16, 31, 0.75)',
                  color: '#F5F7FA',
                  fontFamily: "'Outfit', sans-serif",
                  fontSize: '0.88rem',
                  fontWeight: '700',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  border: '1.5px solid #00A8FF',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  backdropFilter: 'blur(6px)',
                  transition: 'all 0.2s ease'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(0, 168, 255, 0.18)';
                  e.currentTarget.style.borderColor = '#38bdf8';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(3, 16, 31, 0.75)';
                  e.currentTarget.style.borderColor = '#00A8FF';
                }}
              >
                {/* Play icon */}
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="5 3 19 12 5 21 5 3"></polygon>
                </svg>
                <span>WATCH LIVE AUCTIONS</span>
              </button>

            </div>

          </div>
        </div>
      </section>

      {/* =====================================================================
          MAIN BODY CONTAINER: PANEL C + PANEL B & PANEL A
          ===================================================================== */}
      <main style={{
        maxWidth: '1240px',
        width: '100%',
        margin: '0 auto',
        padding: '2rem 1.25rem 4rem 1.25rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.75rem',
        flexGrow: 1
      }}>

        {/* ===================================================================
            5. PANEL C — LIVE AUCTION ARENA (WIDE FULL-WIDTH FEATURE PANEL)
            =================================================================== */}
        <div
          onClick={() => navigate('/viewer')}
          style={{
            cursor: 'pointer',
            backgroundColor: '#061827',
            border: '1px solid rgba(255, 201, 40, 0.35)',
            borderRadius: '8px',
            overflow: 'hidden',
            display: 'grid',
            gridTemplateColumns: '320px 1fr',
            boxShadow: '0 16px 36px rgba(0, 0, 0, 0.7), inset 0 0 0 1px rgba(255, 201, 40, 0.08)',
            transition: 'all 0.25s ease'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.borderColor = '#FFC928';
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 20px 48px rgba(0, 0, 0, 0.85), 0 0 20px rgba(255, 201, 40, 0.2)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.borderColor = 'rgba(255, 201, 40, 0.35)';
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 16px 36px rgba(0, 0, 0, 0.7), inset 0 0 0 1px rgba(255, 201, 40, 0.08)';
          }}
        >
          {/* Left: Panoramic Gavel Image */}
          <div style={{ position: 'relative', minHeight: '210px', height: '100%' }}>
            <img 
              src="/gavel.jpg" 
              alt="Official Auction Gavel Setting"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: 'block'
              }}
            />
            {/* Blending overlay gradient to dark navy on right */}
            <div style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(90deg, rgba(3, 16, 31, 0.1) 0%, rgba(6, 24, 39, 0.85) 85%, #061827 100%)'
            }}></div>
          </div>

          {/* Right: Content details */}
          <div style={{
            padding: '1.75rem 2.25rem',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '1rem'
          }}>
            <div>
              {/* Header row: Live indicator & NO LOGIN REQUIRED badge */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '0.65rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <span className="live-dot-green"></span>
                  <span style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: '0.74rem',
                    letterSpacing: '0.14em',
                    color: '#00E6A0',
                    fontWeight: '700',
                    textTransform: 'uppercase'
                  }}>
                    PUBLIC LIVE FEED
                  </span>
                </div>

                <span style={{
                  padding: '0.25rem 0.65rem',
                  backgroundColor: 'rgba(255, 201, 40, 0.08)',
                  border: '1px solid rgba(255, 201, 40, 0.3)',
                  borderRadius: '3px',
                  color: '#FFC928',
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '0.68rem',
                  fontWeight: '700',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase'
                }}>
                  NO LOGIN REQUIRED
                </span>
              </div>

              {/* Panel C Heading */}
              <h2 style={{
                fontFamily: "'Outfit', sans-serif",
                fontSize: '1.85rem',
                fontWeight: '800',
                color: '#F5F7FA',
                letterSpacing: '-0.02em',
                margin: '0 0 0.5rem 0'
              }}>
                Panel C — Live Auction Arena
              </h2>

              {/* Description */}
              <p style={{
                color: '#91A6BE',
                fontSize: '0.94rem',
                lineHeight: 1.55,
                margin: 0,
                maxWidth: '750px'
              }}>
                Watch the auction, live bids, team competition, and player sales unfold in real time. Read-only global telecast optimized for arena projectors, desktops, and mobile devices.
              </p>
            </div>

            {/* Bottom metadata & CTA */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingTop: '0.85rem',
              borderTop: '1px solid rgba(255, 255, 255, 0.08)',
              flexWrap: 'wrap',
              gap: '0.75rem'
            }}>
              <span style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '0.76rem',
                color: '#91A6BE',
                letterSpacing: '0.06em'
              }}>
                GLOBAL FEED &bull; 10 FRANCHISES &bull; 211 PLAYERS
              </span>

              <span style={{
                fontFamily: "'Outfit', sans-serif",
                fontSize: '0.86rem',
                color: '#FFC928',
                fontWeight: '800',
                letterSpacing: '0.08em',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem'
              }}>
                WATCH LIVE FEED &rarr;
              </span>
            </div>

          </div>
        </div>

        {/* ===================================================================
            6. TWO SUPPORTING PANELS BENEATH (PANEL B & PANEL A)
            =================================================================== */}
        <div className="supporting-panels-grid" style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '1.75rem'
        }}>

          {/* -----------------------------------------------------------------
              LEFT PANEL: PANEL B — FRANCHISE WAR ROOM
              ----------------------------------------------------------------- */}
          <div style={{
            backgroundColor: '#061827',
            border: '1px solid rgba(0, 168, 255, 0.35)',
            borderRadius: '8px',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxShadow: '0 14px 32px rgba(0, 0, 0, 0.65)',
            position: 'relative'
          }}>
            {/* Integrated Stadium Graphic Element Header */}
            <div style={{
              position: 'relative',
              height: '110px',
              overflow: 'hidden',
              backgroundColor: '#03101F'
            }}>
              <img 
                src="/war_room_stadium.jpg" 
                alt="IPL Stadium Night Atmosphere"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  opacity: 0.38
                }}
              />
              <div style={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(180deg, rgba(6, 24, 39, 0.2) 0%, #061827 95%)'
              }}></div>
              
              <div style={{
                position: 'absolute',
                top: '1rem',
                left: '1.5rem',
                right: '1.5rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <span style={{
                  padding: '0.22rem 0.6rem',
                  backgroundColor: 'rgba(0, 168, 255, 0.15)',
                  border: '1px solid rgba(0, 168, 255, 0.45)',
                  borderRadius: '3px',
                  color: '#00A8FF',
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '0.68rem',
                  fontWeight: '700',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase'
                }}>
                  FRANCHISE SECURITY CLEARANCE
                </span>

                <span style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '0.72rem',
                  color: '#91A6BE'
                }}>
                  10 TEAMS
                </span>
              </div>
            </div>

            {/* Panel B Content */}
            <div style={{ padding: '0 1.75rem 1.5rem 1.75rem', flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{
                  fontFamily: "'Outfit', sans-serif",
                  fontSize: '1.45rem',
                  fontWeight: '800',
                  color: '#F5F7FA',
                  margin: '0 0 0.5rem 0'
                }}>
                  Panel B — Franchise War Room
                </h3>

                <p style={{
                  color: '#91A6BE',
                  fontSize: '0.86rem',
                  lineHeight: 1.5,
                  margin: '0 0 1.25rem 0'
                }}>
                  Authorized team managers enter their own workspace to participate in live bidding, manage available purse, and monitor squad composition.
                </p>

                {/* Grid of 10 Franchise Logos (CSK, MI, RCB, DC, KKR, PBKS, RR, SRH, LSG, GT) */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(5, 1fr)',
                  gap: '0.55rem',
                  marginBottom: '1.25rem'
                }}>
                  {franchiseList.map((team) => (
                    <button
                      key={team.code}
                      onClick={() => navigate('/login?team=' + team.code.toLowerCase())}
                      title={`${team.name} — Click to enter War Room`}
                      style={{
                        padding: '0.55rem 0.35rem',
                        backgroundColor: 'rgba(3, 16, 31, 0.85)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '5px',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.35rem',
                        transition: 'all 0.2s ease',
                        outline: 'none'
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.borderColor = team.color;
                        e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
                        e.currentTarget.style.transform = 'translateY(-2px)';
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                        e.currentTarget.style.backgroundColor = 'rgba(3, 16, 31, 0.85)';
                        e.currentTarget.style.transform = 'translateY(0)';
                      }}
                    >
                      <img 
                        src={`/teams/${team.code.toLowerCase()}.svg`} 
                        alt={`${team.code} logo`}
                        style={{
                          height: '28px',
                          width: '28px',
                          objectFit: 'contain'
                        }}
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                      <span style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: '0.74rem',
                        fontWeight: '700',
                        color: '#F5F7FA'
                      }}>
                        {team.code}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Bottom Action */}
              <div 
                onClick={() => navigate('/login')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingTop: '0.85rem',
                  borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                  cursor: 'pointer'
                }}
              >
                <span style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '0.72rem',
                  color: '#91A6BE',
                  letterSpacing: '0.06em'
                }}>
                  TEAM PASSKEY AUTH
                </span>
                <span style={{
                  fontFamily: "'Outfit', sans-serif",
                  fontSize: '0.82rem',
                  fontWeight: '700',
                  color: '#00A8FF',
                  letterSpacing: '0.06em'
                }}>
                  ENTER WAR ROOM &rarr;
                </span>
              </div>

            </div>
          </div>

          {/* -----------------------------------------------------------------
              RIGHT PANEL: PANEL A — OPERATIONS COMMAND
              ----------------------------------------------------------------- */}
          <div style={{
            backgroundColor: '#061827',
            border: '1px solid rgba(255, 201, 40, 0.35)',
            borderRadius: '8px',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxShadow: '0 14px 32px rgba(0, 0, 0, 0.65)',
            position: 'relative'
          }}>
            {/* Integrated Control Room Graphic Header */}
            <div style={{
              position: 'relative',
              height: '110px',
              overflow: 'hidden',
              backgroundColor: '#03101F'
            }}>
              <img 
                src="/control_room.jpg" 
                alt="Command Control Center Monitors"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  opacity: 0.38
                }}
              />
              <div style={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(180deg, rgba(6, 24, 39, 0.2) 0%, #061827 95%)'
              }}></div>
              
              <div style={{
                position: 'absolute',
                top: '1rem',
                left: '1.5rem',
                right: '1.5rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <span style={{
                  padding: '0.22rem 0.6rem',
                  backgroundColor: 'rgba(255, 201, 40, 0.12)',
                  border: '1px solid rgba(255, 201, 40, 0.4)',
                  borderRadius: '3px',
                  color: '#FFC928',
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '0.68rem',
                  fontWeight: '700',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase'
                }}>
                  CONTROL ROOM ACCESS
                </span>

                <span style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '0.72rem',
                  color: '#FFC928'
                }}>
                  RESTRICTED
                </span>
              </div>
            </div>

            {/* Panel A Content */}
            <div style={{ padding: '0 1.75rem 1.5rem 1.75rem', flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{
                  fontFamily: "'Outfit', sans-serif",
                  fontSize: '1.45rem',
                  fontWeight: '800',
                  color: '#F5F7FA',
                  margin: '0 0 0.5rem 0'
                }}>
                  Panel A — Operations Command
                </h3>

                <p style={{
                  color: '#91A6BE',
                  fontSize: '0.86rem',
                  lineHeight: 1.5,
                  margin: '0 0 1.25rem 0'
                }}>
                  Authorized auction operators can initialize an authenticated session and control the entire auction: global timer, countdowns, player queues, emergency pauses, and financial settlements.
                </p>

                {/* Restrained Outlined Information Area */}
                <div style={{
                  padding: '0.85rem 1rem',
                  backgroundColor: 'rgba(255, 201, 40, 0.04)',
                  border: '1px dashed rgba(255, 201, 40, 0.3)',
                  borderRadius: '5px',
                  marginBottom: '1.25rem'
                }}>
                  <div style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: '0.75rem',
                    color: '#FFC928',
                    fontWeight: '700',
                    letterSpacing: '0.08em'
                  }}>
                    ROLE: AUCTIONEER &bull; DIRECTOR
                  </div>
                  <div style={{
                    fontSize: '0.76rem',
                    color: '#91A6BE',
                    marginTop: '0.35rem',
                    lineHeight: 1.4
                  }}>
                    Authoritative server timer &bull; Single global live player &bull; Audit trail
                  </div>
                </div>
              </div>

              {/* Bottom Action */}
              <div 
                onClick={() => navigate('/management')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingTop: '0.85rem',
                  borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                  cursor: 'pointer'
                }}
              >
                <span style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '0.72rem',
                  color: '#91A6BE',
                  letterSpacing: '0.06em'
                }}>
                  DIRECTOR CREDENTIALS
                </span>
                <span style={{
                  fontFamily: "'Outfit', sans-serif",
                  fontSize: '0.82rem',
                  fontWeight: '700',
                  color: '#FFC928',
                  letterSpacing: '0.06em'
                }}>
                  AUTHENTICATE OPERATOR &rarr;
                </span>
              </div>

            </div>
          </div>

        </div>

      </main>

      {/* =====================================================================
          AUTHENTIC MODAL: TEAM FRANCHISE DIRECTORY (/teams)
          ===================================================================== */}
      {modalOpen === 'teams' && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(3, 16, 31, 0.88)',
          backdropFilter: 'blur(8px)',
          zIndex: 200,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1.5rem'
        }}>
          <div style={{
            maxWidth: '900px',
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto',
            backgroundColor: '#061827',
            border: '1px solid #FFC928',
            borderRadius: '10px',
            padding: '2rem',
            position: 'relative',
            boxShadow: '0 24px 60px rgba(0, 0, 0, 0.9)'
          }}>
            <button
              onClick={closeModal}
              style={{
                position: 'absolute',
                top: '1.25rem',
                right: '1.25rem',
                background: 'transparent',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                color: '#F5F7FA',
                cursor: 'pointer',
                fontSize: '1rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              ✕
            </button>

            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '0.75rem',
                color: '#00A8FF',
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                marginBottom: '0.35rem'
              }}>
                IPL 2026 OFFICIAL FRANCHISES
              </div>
              <h2 style={{
                fontFamily: "'Outfit', sans-serif",
                fontSize: '1.8rem',
                fontWeight: '900',
                color: '#F5F7FA',
                margin: 0
              }}>
                Ten Franchises. One Trophy.
              </h2>
              <p style={{ color: '#91A6BE', fontSize: '0.9rem', marginTop: '0.35rem' }}>
                Select your franchise to authenticate your war room credentials and monitor squad quotas.
              </p>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
              gap: '1rem'
            }}>
              {franchiseList.map(team => (
                <div
                  key={team.code}
                  onClick={() => {
                    closeModal();
                    navigate('/login?team=' + team.code.toLowerCase());
                  }}
                  style={{
                    backgroundColor: 'rgba(3, 16, 31, 0.85)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '6px',
                    padding: '1.25rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.borderColor = team.color;
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                    e.currentTarget.style.backgroundColor = 'rgba(3, 16, 31, 0.85)';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  <img 
                    src={`/teams/${team.code.toLowerCase()}.svg`} 
                    alt={team.name}
                    style={{ width: '42px', height: '42px', objectFit: 'contain' }}
                  />
                  <div style={{ flexGrow: 1 }}>
                    <div style={{ fontWeight: '800', fontSize: '0.95rem', color: '#FFFFFF' }}>{team.name}</div>
                    <div style={{ fontSize: '0.78rem', color: '#91A6BE', marginTop: '0.2rem' }}>{team.venue}</div>
                    <div style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: '0.72rem',
                      color: '#FFC928',
                      marginTop: '0.4rem',
                      fontWeight: '700'
                    }}>
                      PURSE: ₹90.00 Cr
                    </div>
                  </div>
                </div>
              ))}
            </div>

          </div>
        </div>
      )}

      {/* =====================================================================
          AUTHENTIC MODAL: HOW TO PLAY / AUCTION RULEBOOK (/how-to-play)
          ===================================================================== */}
      {modalOpen === 'how-to-play' && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(3, 16, 31, 0.88)',
          backdropFilter: 'blur(8px)',
          zIndex: 200,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1.5rem'
        }}>
          <div style={{
            maxWidth: '860px',
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto',
            backgroundColor: '#061827',
            border: '1px solid #00A8FF',
            borderRadius: '10px',
            padding: '2.25rem',
            position: 'relative',
            boxShadow: '0 24px 60px rgba(0, 0, 0, 0.9)'
          }}>
            <button
              onClick={closeModal}
              style={{
                position: 'absolute',
                top: '1.25rem',
                right: '1.25rem',
                background: 'transparent',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                color: '#F5F7FA',
                cursor: 'pointer',
                fontSize: '1rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              ✕
            </button>

            <div style={{ marginBottom: '1.75rem' }}>
              <div style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '0.75rem',
                color: '#FFC928',
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                marginBottom: '0.35rem'
              }}>
                OFFICIAL AUCTION OPERATING MANUAL
              </div>
              <h2 style={{
                fontFamily: "'Outfit', sans-serif",
                fontSize: '1.9rem',
                fontWeight: '900',
                color: '#F5F7FA',
                margin: 0
              }}>
                How To Play — IPL Auction Pro
              </h2>
              <p style={{ color: '#91A6BE', fontSize: '0.92rem', marginTop: '0.4rem' }}>
                Master the rules of the authoritative cricket player bidding arena before stepping into the war room.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

              {/* Rule 1 */}
              <div style={{
                padding: '1.25rem',
                backgroundColor: 'rgba(3, 16, 31, 0.7)',
                borderLeft: '4px solid #FFC928',
                borderRadius: '0 6px 6px 0'
              }}>
                <h4 style={{ fontFamily: "'Outfit', sans-serif", fontSize: '1.05rem', fontWeight: '800', color: '#FFC928', margin: '0 0 0.4rem 0' }}>
                  1. Franchise Budget &amp; Purse (₹90 Crore)
                </h4>
                <p style={{ color: '#F5F7FA', fontSize: '0.86rem', lineHeight: 1.5, margin: 0 }}>
                  Each team leader is endowed with an authoritative purse of ₹90 Crore (₹900,000,000). The auction engine enforces real-time atomic balance checks to prevent overspending. Any bid exceeding available purse is automatically blocked by the server. Your purse can change during the auction through the Budget Boost Power (see Section 7).
                </p>
              </div>

              {/* Rule 2 */}
              <div style={{
                padding: '1.25rem',
                backgroundColor: 'rgba(3, 16, 31, 0.7)',
                borderLeft: '4px solid #00A8FF',
                borderRadius: '0 6px 6px 0'
              }}>
                <h4 style={{ fontFamily: "'Outfit', sans-serif", fontSize: '1.05rem', fontWeight: '800', color: '#00A8FF', margin: '0 0 0.4rem 0' }}>
                  2. Squad Quotas &amp; Foreign Player Caps
                </h4>
                <p style={{ color: '#F5F7FA', fontSize: '0.86rem', lineHeight: 1.5, margin: 0 }}>
                  Franchises must assemble a squad of minimum 18 players and maximum 25 players. A strict limit of at most 8 overseas (international) players is enforced. Teams must ensure sufficient remaining funds to fill all unfilled required slots. Every squad must also meet these minimum composition requirements:
                </p>
                <ul style={{ color: '#F5F7FA', fontSize: '0.86rem', lineHeight: 1.5, margin: '0.5rem 0 0 0', paddingLeft: '1.25rem' }}>
                  <li>Batsmen: minimum 4</li>
                  <li>Bowlers: minimum 4</li>
                  <li>Wicketkeeper: minimum 1</li>
                  <li>All-rounders: minimum 3</li>
                </ul>
              </div>

              {/* Rule 3 */}
              <div style={{
                padding: '1.25rem',
                backgroundColor: 'rgba(3, 16, 31, 0.7)',
                borderLeft: '4px solid #00E6A0',
                borderRadius: '0 6px 6px 0'
              }}>
                <h4 style={{ fontFamily: "'Outfit', sans-serif", fontSize: '1.05rem', fontWeight: '800', color: '#00E6A0', margin: '0 0 0.4rem 0' }}>
                  3. Synchronized Server Timer &amp; Gavel Countdown
                </h4>
                <p style={{ color: '#F5F7FA', fontSize: '0.86rem', lineHeight: 1.5, margin: 0 }}>
                  Every lot has an authoritative 30-second server countdown clock. Whenever a valid bid is recorded, the timer resets, giving opposing franchises an opportunity to counter-bid. If the timer expires with no new bids, the auctioneer hits the gavel and awards the player.
                </p>
              </div>

              {/* Rule 4 */}
              <div style={{
                padding: '1.25rem',
                backgroundColor: 'rgba(3, 16, 31, 0.7)',
                borderLeft: '4px solid #FF3B30',
                borderRadius: '0 6px 6px 0'
              }}>
                <h4 style={{ fontFamily: "'Outfit', sans-serif", fontSize: '1.05rem', fontWeight: '800', color: '#FF3B30', margin: '0 0 0.4rem 0' }}>
                  4. Penalties &amp; Disqualification Safeguards
                </h4>
                <p style={{ color: '#F5F7FA', fontSize: '0.86rem', lineHeight: 1.5, margin: 0 }}>
                  Operators retain emergency controls to pause the timer, retract erroneous bids, or penalize unruly franchise desks. Repeated infractions incur automatic bidding lockouts to guarantee fair competition. Any form of misconduct, unfair practice, or disruption may result in penalties or disqualification. The decisions of the organizers and the auction committee are final and binding in all matters related to the event.
                </p>
              </div>

              {/* Rule 5 */}
              <div style={{
                padding: '1.25rem',
                backgroundColor: 'rgba(3, 16, 31, 0.7)',
                borderLeft: '4px solid #FFC928',
                borderRadius: '0 6px 6px 0'
              }}>
                <h4 style={{ fontFamily: "'Outfit', sans-serif", fontSize: '1.05rem', fontWeight: '800', color: '#FFC928', margin: '0 0 0.4rem 0' }}>
                  5. Team Ratings &amp; Rankings
                </h4>
                <ul style={{ color: '#F5F7FA', fontSize: '0.86rem', lineHeight: 1.5, margin: 0, paddingLeft: '1.25rem' }}>
                  <li>Teams are evaluated based on their overall team rating.</li>
                  <li>If two or more teams have identical ratings, this tie-breaker applies: the team with the higher remaining budget after team selection is ranked above the other.</li>
                  <li>If a tie still persists, the decision of the organizing committee is final and binding.</li>
                </ul>
              </div>


              {/* Rule 6 */}
              <div style={{
                padding: '1.25rem',
                backgroundColor: 'rgba(3, 16, 31, 0.7)',
                borderLeft: '4px solid #00E6A0',
                borderRadius: '0 6px 6px 0'
              }}>
                <h4 style={{ fontFamily: "'Outfit', sans-serif", fontSize: '1.05rem', fontWeight: '800', color: '#00E6A0', margin: '0 0 0.4rem 0' }}>
                  6. Special Power: Jump Bidding
                </h4>
                <p style={{ color: '#F5F7FA', fontSize: '0.86rem', lineHeight: 1.5, margin: '0 0 0.5rem 0' }}>
                  To make the auction more strategic and exciting, each team has access to two special powers. Each can be used only once.
                </p>
                <ul style={{ color: '#F5F7FA', fontSize: '0.86rem', lineHeight: 1.5, margin: '0 0 0.5rem 0', paddingLeft: '1.25rem' }}>
                  <li>Each team may use the Jump Bidding Power only once during the entire auction.</li>
                  <li>This power allows a team to bypass the standard bidding increments and directly place any higher bid above the current amount.</li>
                </ul>
                <p style={{ color: '#00E6A0', fontSize: '0.86rem', fontWeight: '700', margin: '0.75rem 0 0.35rem 0' }}>Important Conditions</p>
                <ul style={{ color: '#F5F7FA', fontSize: '0.86rem', lineHeight: 1.5, margin: 0, paddingLeft: '1.25rem' }}>
                  <li>A team may directly quote any amount higher than the current bid.</li>
                  <li>If no other team places a bid after the jump bid, the initiating team is compulsorily required to purchase the player at the quoted amount.</li>
                  <li>The Jump Bidding Power may only be used once by each team.</li>
                  <li>Once used, it cannot be revoked, transferred, or reused.</li>
                </ul>
              </div>

              {/* Rule 7 */}
              <div style={{
                padding: '1.25rem',
                backgroundColor: 'rgba(3, 16, 31, 0.7)',
                borderLeft: '4px solid #FF3B30',
                borderRadius: '0 6px 6px 0'
              }}>
                <h4 style={{ fontFamily: "'Outfit', sans-serif", fontSize: '1.05rem', fontWeight: '800', color: '#FF3B30', margin: '0 0 0.4rem 0' }}>
                  7. Special Power: Budget Boost
                </h4>
                <p style={{ color: '#F5F7FA', fontSize: '0.86rem', lineHeight: 1.5, margin: '0 0 0.5rem 0' }}>
                  A high-risk, high-reward power that each team may activate only once during the entire auction.
                </p>
                <ul style={{ color: '#F5F7FA', fontSize: '0.86rem', lineHeight: 1.5, margin: '0 0 0.5rem 0', paddingLeft: '1.25rem' }}>
                  <li>A 5-minute break is provided after every round, during which teams may choose to activate this power.</li>
                </ul>
                <p style={{ color: '#FF3B30', fontSize: '0.86rem', fontWeight: '700', margin: '0.75rem 0 0.35rem 0' }}>How It Works</p>
                <ul style={{ color: '#F5F7FA', fontSize: '0.86rem', lineHeight: 1.5, margin: '0 0 0.5rem 0', paddingLeft: '1.25rem' }}>
                  <li>The team is asked one bonus question related to Cricket or General Knowledge.</li>
                  <li>If the answer is correct, the team receives a ₹2 Crore increase in its remaining budget.</li>
                  <li>If the answer is incorrect, ₹3 Crore is deducted from its remaining budget.</li>
                </ul>
                <p style={{ color: '#FF3B30', fontSize: '0.86rem', fontWeight: '700', margin: '0.75rem 0 0.35rem 0' }}>Important Conditions</p>
                <ul style={{ color: '#F5F7FA', fontSize: '0.86rem', lineHeight: 1.5, margin: 0, paddingLeft: '1.25rem' }}>
                  <li>Teams are advised to use it strategically and only when confident.</li>
                  <li>Once a team uses the Budget Boost Power, it cannot be used again under any circumstance.</li>
                </ul>
              </div>

              {/* Rule 8 */}
              <div style={{
                padding: '1.25rem',
                backgroundColor: 'rgba(3, 16, 31, 0.7)',
                borderLeft: '4px solid #FFC928',
                borderRadius: '0 6px 6px 0'
              }}>
                <h4 style={{ fontFamily: "'Outfit', sans-serif", fontSize: '1.05rem', fontWeight: '800', color: '#FFC928', margin: '0 0 0.4rem 0' }}>
                  8. General Guidelines
                </h4>
                <ol style={{ color: '#F5F7FA', fontSize: '0.86rem', lineHeight: 1.5, margin: 0, paddingLeft: '1.25rem' }}>
                  <li>All participating teams must report to the venue at least half an hour before the scheduled start of the event.</li>
                  <li>Registration is compulsory for all participants.</li>
                  <li>Only registered participants are allowed to enter the auction and quiz areas.</li>
                  <li>Teams must maintain discipline and sportsmanship throughout the event.</li>
                  <li>Any form of misconduct, unfair practice, or disruption may result in penalties or disqualification.</li>
                  <li>The decisions of the organizers and auction committee are final and binding in all matters related to the event.</li>
                  <li>Teams are responsible for managing their budgets and player selections throughout the auction.</li>
                  <li>Any rule not explicitly covered in this document is interpreted and decided by the organizing committee.</li>
                </ol>
              </div>

            </div>

            <div style={{ marginTop: '1.75rem', textAlign: 'center' }}>
              <button
                onClick={() => {
                  closeModal();
                  navigate('/viewer');
                }}
                style={{
                  padding: '0.75rem 2rem',
                  backgroundColor: '#FFC928',
                  color: '#03101F',
                  fontFamily: "'Outfit', sans-serif",
                  fontSize: '0.88rem',
                  fontWeight: '800',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: 'pointer'
                }}
              >
                ENTER LIVE AUCTION &rarr;
              </button>
            </div>

          </div>
        </div>
      )}

      {/* =====================================================================
          FOOTER (AUTHENTIC DISCLAIMER & BROADCAST SPONSOR)
          ===================================================================== */}
      <footer style={{
        backgroundColor: '#03101F',
        borderTop: '1px solid rgba(255, 255, 255, 0.08)',
        padding: '1.75rem 2rem',
        marginTop: 'auto'
      }}>
        <div style={{
          maxWidth: '1240px',
          margin: '0 auto',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          <div>
            <div style={{
              fontFamily: "'Outfit', sans-serif",
              fontSize: '0.86rem',
              fontWeight: '800',
              color: '#F5F7FA',
              letterSpacing: '0.06em'
            }}>
              IPL AUCTION PRO &bull; INDEPENDENT AUCTION SIMULATOR
            </div>
            <div style={{
              color: '#91A6BE',
              fontSize: '0.74rem',
              marginTop: '0.35rem',
              lineHeight: 1.4,
              maxWidth: '680px'
            }}>
              This application is an independent cricket auction simulator engineered for esports and academic tournaments. Not affiliated with, endorsed by, or sponsored by the Board of Control for Cricket in India (BCCI) or the Indian Premier League. All team trademarks belong to their respective owners.
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <img 
              src="/sabrang_logo.png" 
              alt="Sabrang"
              title="Sabrang"
              style={{
                height: '42px',
                width: 'auto',
                maxWidth: '160px',
                objectFit: 'contain',
                opacity: 0.95,
                transition: 'opacity 0.2s ease, transform 0.2s ease'
              }}
              onError={(e) => { 
                e.currentTarget.src = '/aarambh_logo.png';
              }}
            />
          </div>
        </div>
      </footer>

      {/* Responsive adjustments style block */}
      <style>{`
        @media (max-width: 900px) {
          .desktop-nav-links {
            display: none !important;
          }
          .mobile-menu-btn {
            display: block !important;
          }
          div[style*="gridTemplateColumns: '320px 1fr'"],
          div[style*="grid-template-columns: 320px 1fr"] {
            grid-template-columns: 1fr !important;
          }
          .supporting-panels-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>

    </div>
  );
}
