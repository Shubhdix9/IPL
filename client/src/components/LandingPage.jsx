import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';

export default function LandingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleRoleClick = (path) => {
    navigate(path);
  };

  return (
    <div style={{
      minHeight: 'calc(100vh - 60px)',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      padding: '2rem 1.5rem 8rem 1.5rem',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Precision Grid Background Accent */}
      <div style={{
        position: 'absolute',
        top: '10%',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '900px',
        height: '350px',
        background: 'radial-gradient(ellipse, rgba(212, 175, 55, 0.05) 0%, transparent 70%)',
        zIndex: 0,
        pointerEvents: 'none'
      }}></div>

      <div style={{ zIndex: 1, maxWidth: '1100px', margin: '0 auto', width: '100%' }}>
        
        {/* Executive Header */}
        <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.6rem',
            marginBottom: '1.25rem',
            padding: '0.4rem 1.25rem',
            background: 'var(--gold-surface)',
            borderRadius: '4px',
            border: '1px solid var(--gold-border)',
            color: 'var(--gold-bright)',
            fontSize: '0.75rem',
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            fontFamily: 'JetBrains Mono, monospace'
          }}>
            <span className="live-pulse-dot" style={{ width: '6px', height: '6px' }}></span>
            OFFICIAL AUCTION COMMAND SYSTEM
          </div>

          <h1 style={{ 
            fontSize: 'clamp(2.5rem, 5vw, 4.5rem)', 
            fontWeight: '900',
            letterSpacing: '-0.03em',
            lineHeight: 1.08,
            marginBottom: '1.25rem',
            color: '#ffffff'
          }}>
            BBW
          </h1>

          <p style={{ 
            fontSize: '1.1rem', 
            color: 'var(--text-secondary)', 
            maxWidth: '650px', 
            margin: '0 auto', 
            lineHeight: 1.6,
            fontWeight: '400'
          }}>
            Real-time financial telemetry, atomic bid processing, and multi-venue synchronization engineered for high-stakes cricket player acquisitions.
          </p>
        </div>

        {/* Action Decks (The Three Main Entry Panels) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem', maxWidth: '900px', margin: '0 auto' }}>
          
          {/* Panel C — Live Auction Arena (Main Public Display) */}
          <div 
            onClick={() => handleRoleClick('/viewer')}
            style={{ 
              cursor: 'pointer', 
              padding: '2.25rem 2.5rem',
              background: 'linear-gradient(145deg, rgba(20, 27, 37, 0.95), rgba(12, 16, 22, 0.98))',
              border: '1px solid rgba(212, 175, 55, 0.4)',
              borderRadius: '10px',
              boxShadow: '0 20px 45px -10px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(212, 175, 55, 0.12) inset',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
              transition: 'all 0.25s ease'
            }}
            onMouseOver={(e) => { 
              e.currentTarget.style.borderColor = 'var(--gold-bright)';
              e.currentTarget.style.transform = 'translateY(-3px)';
              e.currentTarget.style.boxShadow = '0 25px 55px -10px rgba(0, 0, 0, 0.9), 0 0 20px rgba(212, 175, 55, 0.2)';
            }}
            onMouseOut={(e) => { 
              e.currentTarget.style.borderColor = 'rgba(212, 175, 55, 0.4)';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 20px 45px -10px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(212, 175, 55, 0.12) inset';
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <span className="live-pulse-dot"></span>
                <span style={{ 
                  fontFamily: 'JetBrains Mono, monospace', 
                  fontSize: '0.75rem', 
                  letterSpacing: '0.15em', 
                  color: 'var(--emerald-live)', 
                  fontWeight: '600' 
                }}>
                  PUBLIC LIVE FEED
                </span>
              </div>
              <span className="badge badge-gold">NO LOGIN REQUIRED</span>
            </div>

            <div>
              <h2 style={{ fontSize: '1.95rem', color: '#ffffff', marginBottom: '0.4rem', fontWeight: '800' }}>
                Panel C — Live Auction Arena
              </h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: 1.5 }}>
                Watch the auction, live bids, team competition, and player sales unfold in real time. Read-only global telecast optimized for arena projectors, desktops, and mobile devices.
              </p>
            </div>

            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between', 
              paddingTop: '0.75rem',
              borderTop: '1px solid rgba(255, 255, 255, 0.06)'
            }}>
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                GLOBAL AUTHORITATIVE FEED &bull; 10 FRANCHISES &bull; 211 PLAYERS
              </span>
              <span style={{ 
                fontFamily: 'Outfit, sans-serif',
                fontSize: '0.85rem', 
                color: 'var(--gold-bright)', 
                fontWeight: '700',
                letterSpacing: '0.08em',
                textTransform: 'uppercase'
              }}>
                WATCH LIVE FEED &rarr;
              </span>
            </div>
          </div>

          {/* Sub Cards: Panel A & Panel B */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '1.5rem' }}>
            
            {/* Panel B — Franchise War Room */}
            <div 
              style={{ 
                padding: '2rem',
                background: 'rgba(16, 21, 29, 0.9)',
                border: '1px solid rgba(59, 130, 246, 0.35)',
                borderRadius: '8px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                transition: 'all 0.2s ease'
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <span className="badge" style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#93c5fd', borderColor: 'rgba(59, 130, 246, 0.3)' }}>
                    FRANCHISE SECURITY CLEARANCE
                  </span>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.7rem', color: 'var(--text-dim)' }}>
                    10 TEAMS
                  </span>
                </div>

                <h3 style={{ fontSize: '1.4rem', color: '#ffffff', marginBottom: '0.4rem', fontWeight: '800' }}>
                  Panel B — Franchise War Room
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: 1.5, marginBottom: '1.25rem' }}>
                  Authorized team managers enter their own workspace. Participate in live lot bidding, manage available purse, and monitor squad composition quotas.
                </p>

                {/* Quick 10-Franchise Selector Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.4rem', marginBottom: '1.25rem' }}>
                  {[
                    { code: 'CSK', color: '#f9cd05' },
                    { code: 'MI', color: '#004ba0' },
                    { code: 'RCB', color: '#d32f2f' },
                    { code: 'DC', color: '#2563eb' },
                    { code: 'KKR', color: '#3a225d' },
                    { code: 'PBKS', color: '#ed1b24' },
                    { code: 'RR', color: '#eb178b' },
                    { code: 'SRH', color: '#ff6200' },
                    { code: 'LSG', color: '#00a3e0' },
                    { code: 'GT', color: '#1b2133' }
                  ].map((team) => (
                    <button
                      key={team.code}
                      onClick={() => navigate('/login?team=' + team.code.toLowerCase())}
                      style={{
                        padding: '0.4rem 0.2rem',
                        background: 'rgba(255, 255, 255, 0.04)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '4px',
                        color: '#ffffff',
                        fontSize: '0.75rem',
                        fontWeight: '700',
                        cursor: 'pointer',
                        fontFamily: 'JetBrains Mono, monospace',
                        textAlign: 'center',
                        transition: 'all 0.15s ease'
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.borderColor = team.color;
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
                      }}
                    >
                      {team.code}
                    </button>
                  ))}
                </div>
              </div>

              <div 
                onClick={() => handleRoleClick('/login')}
                style={{ 
                  marginTop: '0.5rem', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between',
                  paddingTop: '0.75rem',
                  borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                  cursor: 'pointer'
                }}
              >
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                  TEAM PASSKEY AUTH
                </span>
                <span style={{ fontSize: '0.8rem', fontWeight: '700', color: '#93c5fd', letterSpacing: '0.05em' }}>
                  ENTER WAR ROOM &rarr;
                </span>
              </div>
            </div>

            {/* Panel A — Operations Command */}
            <div 
              style={{ 
                padding: '2rem',
                background: 'rgba(16, 21, 29, 0.9)',
                border: '1px solid var(--gold-border)',
                borderRadius: '8px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                transition: 'all 0.2s ease'
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <span className="badge badge-gold">
                    CONTROL ROOM ACCESS
                  </span>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.7rem', color: 'var(--text-dim)' }}>
                    RESTRICTED
                  </span>
                </div>

                <h3 style={{ fontSize: '1.4rem', color: '#ffffff', marginBottom: '0.4rem', fontWeight: '800' }}>
                  Panel A — Operations Command
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: 1.5, marginBottom: '1.25rem' }}>
                  Authorized auction operators can initialize an authenticated session and control the entire auction: gavel, timer countdowns, player queues, emergency pauses, and financial settlements.
                </p>

                <div style={{
                  padding: '0.75rem 1rem',
                  background: 'rgba(212, 175, 55, 0.04)',
                  border: '1px dashed rgba(212, 175, 55, 0.25)',
                  borderRadius: '4px',
                  marginBottom: '1.25rem'
                }}>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.72rem', color: 'var(--gold-bright)' }}>
                    ROLE: AUCTIONEER &bull; DIRECTOR
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                    Authoritative server timer &bull; Single global live player &bull; Audit trail
                  </div>
                </div>
              </div>

              <div 
                onClick={() => handleRoleClick('/management')}
                style={{ 
                  marginTop: '0.5rem', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between',
                  paddingTop: '0.75rem',
                  borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                  cursor: 'pointer'
                }}
              >
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                  DIRECTOR CREDENTIALS
                </span>
                <span style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--gold-bright)', letterSpacing: '0.05em' }}>
                  AUTHENTICATE OPERATOR &rarr;
                </span>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Official Broadcast Footer */}
      <footer style={{ 
        position: 'absolute', 
        bottom: 0, 
        left: 0, 
        right: 0, 
        padding: '1.25rem 2.5rem', 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        borderTop: '1px solid rgba(255, 255, 255, 0.05)',
        background: 'rgba(6, 8, 11, 0.95)',
        zIndex: 10
      }}>
        <div style={{ color: 'var(--text-dim)', fontSize: '0.75rem', fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.05em' }}>
          &copy; {new Date().getFullYear()} OFFICIAL PLATFORM BY <strong style={{ color: 'var(--text-secondary)' }}>THE LEAGUE ROOM</strong>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <img 
            src="/aarambh_logo.png" 
            alt="Aarambh'26 Logo" 
            style={{ 
              height: '42px', 
              objectFit: 'contain',
              opacity: 0.85
            }} 
            onError={(e) => {
              e.target.style.display = 'none';
            }}
          />
        </div>
      </footer>
    </div>
  );
}
