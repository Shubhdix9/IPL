import { BrowserRouter as Router, Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import './index.css';
import ManagerDashboard from './components/ManagerDashboard';
import TeamLeaderDashboard from './components/TeamLeaderDashboard';
import AuctioneerDashboard from './components/AuctioneerDashboard';
import ViewerDashboard from './components/ViewerDashboard';
import Login from './components/Login';
import LandingPage from './components/LandingPage';
import ThemedTeamDashboard from './components/ThemedTeamDashboard';
import { useAuth } from './AuthContext';

const ProtectedRoute = ({ children, requiredRole }) => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" />;
  if (requiredRole && user.role !== requiredRole) {
    if (requiredRole === 'TEAM_LEADER' && (user.role === 'ADMIN' || user.role === 'AUCTIONEER')) {
      return children;
    }
    return <Navigate to="/" />;
  }
  return children;
};

const NavigationBar = () => {
  const { user, logout } = useAuth();
  const location = useLocation();

  // Hide the navbar on public landing, viewer, and public modal routes
  if (['/', '/room', '/teams', '/how-to-play', '/login', '/management', '/viewer'].includes(location.pathname)) {
    return null;
  }

  const getRoleBadge = (role) => {
    switch (role) {
      case 'ADMIN': return 'SYSTEM DIRECTOR';
      case 'AUCTIONEER': return 'GAVEL MASTER';
      case 'TEAM_LEADER': return 'FRANCHISE DESK';
      default: return 'OPERATOR';
    }
  };

  return (
    <header className="navbar">
      <Link to="/" className="nav-brand-wrap">
        <span className="nav-status-pill"></span>
        <span className="nav-brand">IPL AUCTION PRO</span>
        <span className="nav-subtext">OFFICIAL OPS</span>
      </Link>

      <div className="nav-links">
        <Link to="/" className="nav-link">Overview</Link>
        {user && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span className="badge badge-gold">
              {getRoleBadge(user.role)}: {user.username}
            </span>
            <button 
              onClick={logout} 
              className="btn btn-secondary" 
              style={{ padding: '0.4rem 0.9rem', fontSize: '0.75rem' }}
            >
              Disconnect
            </button>
          </div>
        )}
      </div>
    </header>
  );
};

function App() {
  return (
    <Router>
      <div className="app-container">
        <NavigationBar />
        
        <main className="main-content">
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/room" element={<ViewerDashboard />} />
            <Route path="/teams" element={<LandingPage initialSection="teams" />} />
            <Route path="/how-to-play" element={<LandingPage initialSection="how-to-play" />} />
            <Route path="/login" element={<Login portalName="Franchise War Room Access" />} />
            <Route path="/management" element={<Login portalName="Operations Command Authentication" />} />
            <Route path="/manager" element={
              <ProtectedRoute requiredRole="ADMIN"><ManagerDashboard /></ProtectedRoute>
            } />
            <Route path="/auctioneer" element={
              <ProtectedRoute requiredRole="AUCTIONEER"><AuctioneerDashboard /></ProtectedRoute>
            } />
            <Route path="/team-leader" element={
              <ProtectedRoute requiredRole="TEAM_LEADER"><TeamLeaderDashboard /></ProtectedRoute>
            } />
            <Route path="/team" element={<ThemedTeamDashboard forcedTeamId="dc" />} />
            <Route path="/team/:teamId" element={<ThemedTeamDashboard />} />
            <Route path="/viewer" element={<ViewerDashboard />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
