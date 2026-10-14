import { BrowserRouter as Router, Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import './index.css';
import ManagerDashboard from './components/ManagerDashboard';
import TeamLeaderDashboard from './components/TeamLeaderDashboard';
import AuctioneerDashboard from './components/AuctioneerDashboard';
import ViewerDashboard from './components/ViewerDashboard';
import Login from './components/Login';
import LandingPage from './components/LandingPage';
import { useAuth } from './AuthContext';

const ProtectedRoute = ({ children, requiredRole }) => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" />;
  if (requiredRole && user.role !== requiredRole) return <Navigate to="/" />;
  return children;
};

const NavigationBar = () => {
  const { user, logout } = useAuth();
  const location = useLocation();

  // Hide the navbar on public pages (Landing, Login, and Viewer)
  // It will only show on protected dashboards (Manager, Auctioneer, Team Leader)
  if (['/', '/login', '/viewer'].includes(location.pathname)) {
    return null;
  }

  return (
    <nav className="navbar glass-panel">
      <Link to="/" style={{ textDecoration: 'none' }}><div className="nav-brand">IPL Auction Pro</div></Link>
      <div className="nav-links">
        <Link to="/" className="nav-link" style={{ marginRight: '1rem', background: 'rgba(255,255,255,0.1)', padding: '0.25rem 1rem', borderRadius: '4px' }}>🏠 Home</Link>
        {!user ? (
          <Link to="/login" className="nav-link" style={{ marginLeft: 'auto', background: 'var(--primary)', color: 'white', padding: '0.25rem 1rem', borderRadius: '4px' }}>Login</Link>
        ) : (
          <button onClick={logout} className="btn" style={{ marginLeft: 'auto', padding: '0.25rem 1rem' }}>Logout ({user.username})</button>
        )}
      </div>
    </nav>
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
            <Route path="/login" element={<Login portalName="Franchise Portal Login" />} />
            <Route path="/management" element={<Login portalName="Management Secure Login" />} />
            <Route path="/manager" element={
              <ProtectedRoute requiredRole="ADMIN"><ManagerDashboard /></ProtectedRoute>
            } />
            <Route path="/auctioneer" element={
              <ProtectedRoute requiredRole="AUCTIONEER"><AuctioneerDashboard /></ProtectedRoute>
            } />
            <Route path="/team-leader" element={
              <ProtectedRoute requiredRole="TEAM_LEADER"><TeamLeaderDashboard /></ProtectedRoute>
            } />
            <Route path="/viewer" element={<ViewerDashboard />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
