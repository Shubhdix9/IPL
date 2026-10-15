import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';

export default function Login({ portalName }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, user } = useAuth();
  const navigate = useNavigate();

  // If already logged in, automatically redirect them to their dashboard
  useEffect(() => {
    if (user) {
      if (user.role === 'ADMIN') navigate('/manager');
      else if (user.role === 'AUCTIONEER') navigate('/auctioneer');
      else if (user.role === 'TEAM_LEADER') navigate('/team-leader');
      else navigate('/');
    }
  }, [user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      const user = await login(username, password);
      if (user.role === 'ADMIN') navigate('/manager');
      else if (user.role === 'AUCTIONEER') navigate('/auctioneer');
      else if (user.role === 'TEAM_LEADER') navigate('/team-leader');
      else navigate('/');
    } catch (err) {
      setError(err.message || 'Authentication failed. Check credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ 
      minHeight: '80vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      padding: '2rem 1.5rem',
      position: 'relative'
    }}>
      <div 
        style={{ 
          width: '100%',
          maxWidth: '440px', 
          padding: '2.5rem 2.25rem', 
          position: 'relative',
          borderRadius: '10px',
          background: 'linear-gradient(145deg, rgba(20, 27, 37, 0.95), rgba(12, 16, 22, 0.98))',
          border: '1px solid var(--gold-border)',
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.9), 0 0 0 1px rgba(212, 175, 55, 0.1) inset'
        }}
      >
        <button 
          onClick={() => navigate('/')}
          style={{ 
            position: 'absolute', 
            top: '1.25rem', 
            left: '1.25rem', 
            background: 'transparent', 
            border: '1px solid rgba(255, 255, 255, 0.1)', 
            color: 'var(--text-muted)', 
            cursor: 'pointer', 
            fontSize: '0.75rem', 
            fontFamily: 'JetBrains Mono, monospace',
            padding: '0.35rem 0.75rem',
            borderRadius: '4px',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            transition: 'all 0.2s ease'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.color = '#ffffff';
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.color = 'var(--text-muted)';
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
          }}
        >
          &larr; Overview
        </button>
        
        <div style={{ textAlign: 'center', marginBottom: '2.25rem', marginTop: '1.25rem' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            marginBottom: '0.75rem',
            padding: '0.25rem 0.75rem',
            background: 'var(--gold-surface)',
            border: '1px solid var(--gold-border)',
            borderRadius: '4px',
            color: 'var(--gold-bright)',
            fontSize: '0.7rem',
            fontFamily: 'JetBrains Mono, monospace',
            letterSpacing: '0.12em',
            textTransform: 'uppercase'
          }}>
            SECURITY CLEARANCE
          </div>

          <h2 style={{ 
            fontSize: '1.65rem', 
            fontWeight: '800', 
            color: '#ffffff',
            letterSpacing: '-0.02em'
          }}>
            {portalName || 'System Authentication'}
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.35rem' }}>
            Provide designated operator credentials to initialize session
          </p>
        </div>
        
        {error && (
          <div style={{ 
            background: 'var(--crimson-surface)', 
            borderLeft: '3px solid var(--crimson-danger)', 
            color: '#fca5a5', 
            padding: '0.75rem 1rem', 
            marginBottom: '1.5rem', 
            borderRadius: '0 4px 4px 0',
            fontSize: '0.82rem',
            fontFamily: 'JetBrains Mono, monospace'
          }}>
            [ERR] {error}
          </div>
        )}
        
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <label style={{ 
              display: 'block', 
              marginBottom: '0.4rem', 
              fontSize: '0.75rem', 
              color: 'var(--gold-primary)', 
              textTransform: 'uppercase', 
              letterSpacing: '0.08em',
              fontFamily: 'JetBrains Mono, monospace',
              fontWeight: '600'
            }}>
              Operator Identifier
            </label>
            <input 
              type="text" 
              value={username} 
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. csk_leader or auctioneer1"
              className="form-input"
              autoComplete="username"
              required
            />
          </div>
          
          <div>
            <label style={{ 
              display: 'block', 
              marginBottom: '0.4rem', 
              fontSize: '0.75rem', 
              color: 'var(--gold-primary)', 
              textTransform: 'uppercase', 
              letterSpacing: '0.08em',
              fontFamily: 'JetBrains Mono, monospace',
              fontWeight: '600'
            }}>
              Passkey / Secret
            </label>
            <input 
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="form-input"
              autoComplete="current-password"
              required
            />
          </div>
          
          <button 
            type="submit" 
            disabled={loading}
            className="btn btn-gold"
            style={{ 
              marginTop: '0.75rem', 
              padding: '0.9rem', 
              width: '100%',
              fontSize: '0.9rem',
              letterSpacing: '0.08em'
            }}
          >
            {loading ? 'AUTHENTICATING...' : 'AUTHORIZE ACCESS'}
          </button>
        </form>
        
      </div>
    </div>
  );
}
