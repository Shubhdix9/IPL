import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';

export default function LandingPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleRoleClick = (path) => {
    navigate(path);
  };

  return (
    <div style={{
      minHeight: 'calc(100vh - 80px)',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      padding: '4rem 2rem 10rem 2rem', // Increased bottom padding to 10rem
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Dynamic Background Decor */}
      <div style={{
        position: 'absolute',
        top: '-10%',
        left: '10%',
        width: '60vw',
        height: '60vw',
        background: 'radial-gradient(circle, rgba(59, 130, 246, 0.15) 0%, rgba(0, 0, 0, 0) 60%)',
        zIndex: 0,
        pointerEvents: 'none'
      }}></div>
      <div style={{
        position: 'absolute',
        bottom: '-10%',
        right: '10%',
        width: '50vw',
        height: '50vw',
        background: 'radial-gradient(circle, rgba(16, 185, 129, 0.1) 0%, rgba(0, 0, 0, 0) 60%)',
        zIndex: 0,
        pointerEvents: 'none'
      }}></div>

      <div style={{ zIndex: 1, maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
        {/* Hero Section */}
        <div style={{ textAlign: 'center', marginBottom: '5rem', position: 'relative' }}>
          <div style={{ display: 'inline-block', marginBottom: '1.5rem', padding: '0.5rem 1.5rem', background: 'rgba(255,255,255,0.05)', borderRadius: '30px', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-muted)', fontSize: '0.9rem', letterSpacing: '1px', textTransform: 'uppercase' }}>
            Next-Gen Bidding Platform
          </div>
          <h1 style={{ 
            fontSize: 'clamp(3rem, 6vw, 5.5rem)', 
            fontWeight: '900',
            background: 'linear-gradient(135deg, #ffffff 0%, #a5b4fc 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            marginBottom: '1.5rem',
            lineHeight: 1.1,
            letterSpacing: '-1.5px',
            textShadow: '0 10px 30px rgba(165, 180, 252, 0.2)'
          }}>
            The Ultimate IPL<br />Auction Experience
          </h1>
          <p style={{ fontSize: '1.25rem', color: '#94a3b8', maxWidth: '700px', margin: '0 auto', lineHeight: 1.6 }}>
            A comprehensive, real-time platform designed to seamlessly manage high-stakes physical auctions. Track purses, execute bids, and watch the action unfold.
          </p>
        </div>

        {/* Action Cards */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3rem' }}>
          
          {/* Primary Action: Live Viewer */}
          <div 
            onClick={() => handleRoleClick('/viewer')}
            style={{ 
              cursor: 'pointer', 
              transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)', 
              padding: '3rem 4rem', 
              textAlign: 'center', 
              width: '100%', 
              maxWidth: '800px',
              background: 'linear-gradient(145deg, rgba(30, 41, 59, 0.6), rgba(15, 23, 42, 0.8))',
              backdropFilter: 'blur(24px)',
              borderRadius: '24px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255,255,255,0.05) inset',
              position: 'relative',
              overflow: 'hidden'
            }}
            onMouseOver={(e) => { 
              e.currentTarget.style.transform = 'translateY(-8px) scale(1.02)'; 
              e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.4)'; 
              e.currentTarget.style.boxShadow = '0 30px 60px -12px rgba(16, 185, 129, 0.2), 0 0 0 1px rgba(16, 185, 129, 0.2) inset'; 
            }}
            onMouseOut={(e) => { 
              e.currentTarget.style.transform = 'translateY(0) scale(1)'; 
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)'; 
              e.currentTarget.style.boxShadow = '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255,255,255,0.05) inset'; 
            }}
          >
            {/* Soft inner glow */}
            <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: '60%', height: '100%', background: 'radial-gradient(circle, rgba(16,185,129,0.1) 0%, transparent 70%)', pointerEvents: 'none' }}></div>
            
            <div style={{ fontSize: '4rem', marginBottom: '1.5rem', filter: 'drop-shadow(0 10px 15px rgba(0,0,0,0.3))' }}>📺</div>
            <h2 style={{ marginBottom: '1rem', color: 'white', fontSize: '2.5rem', fontWeight: '800', letterSpacing: '-0.5px' }}>Enter Live Viewer</h2>
            <p style={{ color: '#94a3b8', fontSize: '1.1rem', lineHeight: 1.6, maxWidth: '500px', margin: '0 auto' }}>Join the global audience. Watch the high-stakes bidding action unfold live across all venues without needing an account.</p>
            <div style={{ 
              marginTop: '2.5rem', 
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.75rem',
              background: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              padding: '0.75rem 2rem',
              borderRadius: '30px',
              color: '#34d399', 
              fontWeight: 'bold',
              letterSpacing: '0.5px',
              transition: 'all 0.3s'
            }}>
              Public Access <span style={{ fontSize: '1.2rem' }}>→</span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', justifyContent: 'center', width: '100%', maxWidth: '800px' }}>
            {/* Franchise Login */}
            <div 
              onClick={() => handleRoleClick('/login')}
              style={{ 
                flex: '1',
                minWidth: '280px',
                cursor: 'pointer', 
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', 
                padding: '2rem', 
                textAlign: 'left', 
                background: 'linear-gradient(145deg, rgba(30, 41, 59, 0.4), rgba(15, 23, 42, 0.6))',
                backdropFilter: 'blur(12px)',
                borderRadius: '20px',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between'
              }}
              onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-5px)'; e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.4)'; e.currentTarget.style.background = 'linear-gradient(145deg, rgba(30, 41, 59, 0.6), rgba(15, 23, 42, 0.8))'; }}
              onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.05)'; e.currentTarget.style.background = 'linear-gradient(145deg, rgba(30, 41, 59, 0.4), rgba(15, 23, 42, 0.6))'; }}
            >
              <div>
                <div style={{ fontSize: '2.5rem', marginBottom: '1.5rem' }}>🏏</div>
                <h2 style={{ marginBottom: '0', color: 'white', fontSize: '1.5rem', fontWeight: '700' }}>Franchise Portal</h2>
              </div>
              <div style={{ marginTop: '2rem', fontSize: '0.9rem', color: '#60a5fa', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                Login <span style={{ fontSize: '1.2rem' }}>→</span>
              </div>
            </div>

            {/* System Management */}
            <div 
              onClick={() => handleRoleClick('/management')}
              style={{ 
                flex: '1',
                minWidth: '280px',
                cursor: 'pointer', 
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', 
                padding: '2rem', 
                textAlign: 'left', 
                background: 'linear-gradient(145deg, rgba(30, 41, 59, 0.4), rgba(15, 23, 42, 0.6))',
                backdropFilter: 'blur(12px)',
                borderRadius: '20px',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between'
              }}
              onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-5px)'; e.currentTarget.style.borderColor = 'rgba(168, 85, 247, 0.4)'; e.currentTarget.style.background = 'linear-gradient(145deg, rgba(30, 41, 59, 0.6), rgba(15, 23, 42, 0.8))'; }}
              onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.05)'; e.currentTarget.style.background = 'linear-gradient(145deg, rgba(30, 41, 59, 0.4), rgba(15, 23, 42, 0.6))'; }}
            >
              <div>
                <div style={{ fontSize: '2.5rem', marginBottom: '1.5rem', filter: 'grayscale(1) brightness(2)' }}>⚙️</div>
                <h2 style={{ marginBottom: '0', color: 'white', fontSize: '1.5rem', fontWeight: '700' }}>System Admin</h2>
              </div>
              <div style={{ marginTop: '2rem', fontSize: '0.9rem', color: '#c084fc', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                Secure Access <span style={{ fontSize: '1.2rem' }}>→</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Professional Footer */}
      <footer style={{ 
        position: 'absolute', 
        bottom: 0, 
        left: 0, 
        right: 0, 
        padding: '1.5rem 3rem', 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        zIndex: 10
      }}>
        <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', letterSpacing: '0.5px' }}>
          &copy; {new Date().getFullYear()} All rights reserved to <strong style={{ color: 'white' }}>Team The League Room</strong>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <img 
            src="/aarambh_logo.png" 
            alt="Aarambh'26 Logo" 
            style={{ 
              height: '80px', 
              objectFit: 'contain',
              filter: 'drop-shadow(0 0 10px rgba(255,255,255,0.2))'
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
