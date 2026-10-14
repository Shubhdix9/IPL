import { useEffect, useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import socket from '../socket';
import playerImageMap from '../playerImageMap.json';
import AuctioneerDashboard from './AuctioneerDashboard';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export default function ManagerDashboard() {
  const [activeTab, setActiveTab] = useState('LIVE_AUCTION');
  
  const [teams, setTeams] = useState([]);
  const [locations, setLocations] = useState([]);
  const [users, setUsers] = useState([]);
  const [playersCount, setPlayersCount] = useState(0);
  const [globalPlayers, setGlobalPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  
  // Feed for global events
  const [feedLog, setFeedLog] = useState([]);

  // Form States
  const [newLocation, setNewLocation] = useState('');
  
  // Nested Venue State
  const [selectedLocation, setSelectedLocation] = useState(null);

  // Drag & drop state
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchData();

    socket.on('playerSold', (player) => {
      setFeedLog(prev => [{ id: Date.now() + Math.random(), msg: `[Global] ${player.name} SOLD to Team ${player.teamId} for ₹${player.soldPrice / 10000000} Cr`, type: 'sold' }, ...prev].slice(0, 50));
      fetchData();
    });

    socket.on('penaltyIssued', (data) => {
      setFeedLog(prev => [{ id: Date.now() + Math.random(), msg: `[Global] A penalty was issued!`, type: 'penalty' }, ...prev].slice(0, 50));
      fetchData();
    });

    socket.on('newBid', (data) => {
      setFeedLog(prev => [{ id: Date.now() + Math.random(), msg: `[Global] New bid placed: ₹${data.amount / 10000000} Cr`, type: 'bid' }, ...prev].slice(0, 50));
    });

    return () => {
      socket.off('playerSold');
      socket.off('penaltyIssued');
      socket.off('newBid');
    };
  }, []);

  const fetchData = async () => {
    try {
      const [teamsRes, locsRes, usersRes] = await Promise.all([
        fetch(API_URL + '/api/teams'),
        fetch(API_URL + '/api/locations'),
        fetch(API_URL + '/api/users')
      ]);
      const teamsData = await teamsRes.json();
      setTeams(teamsData);
      
      const locationsData = await locsRes.json();
      setLocations(locationsData);
      
      const usersData = await usersRes.json();
      setUsers(usersData);
      
      const count = teamsData.reduce((acc, t) => acc + (t.players ? t.players.length : 0), 0);
      setPlayersCount(count);
      
      if (selectedLocation) {
        const updated = locationsData.find(l => l.id === selectedLocation.id);
        setSelectedLocation(updated || null);
      }
      
      if (locationsData.length > 0) {
        const playersRes = await fetch(`${API_URL}/api/locations/${locationsData[0].id}/players`);
        if (playersRes.ok) {
           const playersData = await playersRes.json();
           const uniquePlayers = Array.from(new Map(playersData.map(p => [p.name, p])).values());
           
           // Sort by Pool number then by Name
           const getPoolNumber = (poolStr) => {
             if (!poolStr) return 999;
             const match = poolStr.match(/POOL\s*[-]?\s*(\d+)/i);
             return match ? parseInt(match[1], 10) : 999;
           };

           uniquePlayers.sort((a, b) => {
             const poolNumA = getPoolNumber(a.pool);
             const poolNumB = getPoolNumber(b.pool);
             if (poolNumA !== poolNumB) return poolNumA - poolNumB;
             return a.name.localeCompare(b.name);
           });
           
           setGlobalPlayers(uniquePlayers);
           if (uniquePlayers.length > 0) {
             setPreviewPlayers(uniquePlayers);
             setUploadSuccess(true);
           }
        }
      } else {
        setGlobalPlayers([]);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateLocation = async (e) => {
    e.preventDefault();
    if (!newLocation) return;
    try {
      const res = await fetch(API_URL + '/api/locations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newLocation })
      });
      if (res.ok) {
        setNewLocation('');
        fetchData();
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleDeleteLocation = async (id) => {
    if (!window.confirm('Are you sure you want to delete this venue? This will permanently delete all franchises, players, and data associated with it!')) return;
    try {
      const res = await fetch(`${API_URL}/api/locations/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setSelectedLocation(null);
        fetchData();
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleResetPlayers = async () => {
    if (!window.confirm('DANGER! This will delete ALL PLAYERS globally, clear all bids, and reset all team budgets to 90Cr. Venues and Franchises will remain. Are you 100% sure?')) return;
    try {
      const res = await fetch(`${API_URL}/api/players`, { method: 'DELETE' });
      if (res.ok) {
        alert("Player database has been wiped clean.");
        fetchData();
      }
    } catch (error) {
      console.error(error);
    }
  };

  // User Management
  const [newUserUsername, setNewUserUsername] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState('AUCTIONEER');
  const [newUserTeamId, setNewUserTeamId] = useState('');
  const [searchUser, setSearchUser] = useState('');

  const generatePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
    let pass = '';
    for (let i = 0; i < 8; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewUserPassword(pass);
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    // Could add a toast notification here
  };
  
  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!newUserUsername || !newUserPassword) return alert("Provide username and password.");
    if (newUserRole === 'TEAM_LEADER' && !newUserTeamId) return alert("Please select a team for this Team Leader.");
    try {
      const res = await fetch(API_URL + '/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: newUserUsername,
          password: newUserPassword,
          role: newUserRole,
          teamId: newUserRole === 'TEAM_LEADER' ? newUserTeamId : null,
          locationId: selectedLocation.id
        })
      });
      if (res.ok) {
        setNewUserUsername('');
        setNewUserPassword('');
        setNewUserTeamId('');
        fetchData();
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleDeleteUser = async (userId) => {
    if(!window.confirm('Are you sure you want to delete this user?')) return;
    try {
      await fetch(`${API_URL}/api/users/${userId}`, { method: 'DELETE' });
      fetchData();
    } catch (error) {
      console.error(error);
    }
  };

  const [editingPasswordFor, setEditingPasswordFor] = useState(null);
  const [newPasswordValue, setNewPasswordValue] = useState('');

  const handleUpdatePassword = async (userId) => {
    if (!newPasswordValue) return;
    try {
      const res = await fetch(`${API_URL}/api/users/${userId}/password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: newPasswordValue })
      });
      if(res.ok) {
        setEditingPasswordFor(null);
        setNewPasswordValue('');
        fetchData();
      } else {
        alert('Failed to update password.');
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleToggleDisqualify = async (teamId, currentStatus) => {
    const action = currentStatus ? "un-disqualify (forgive)" : "disqualify";
    if (!window.confirm(`Are you sure you want to ${action} this franchise?`)) return;
    try {
      const res = await fetch(`${API_URL}/api/teams/${teamId}/disqualify`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isDisqualified: !currentStatus })
      });
      if(res.ok) fetchData();
    } catch (error) {
      console.error(error);
    }
  };

  const handleDownloadCSV = () => {
    if (!selectedLocation) return;
    const localUsers = users.filter(u => u.locationId === selectedLocation.id);
    let csvContent = "data:text/csv;charset=utf-8,Role,Username,Password,Associated Team\n";
    
    localUsers.forEach(u => {
      let teamName = "N/A";
      if (u.teamId) {
        const team = teams.find(t => t.id === u.teamId);
        if (team) teamName = team.name;
      }
      csvContent += `${u.role},${u.username},${u.password},${teamName}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${selectedLocation.name}_credentials.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const [previewPlayers, setPreviewPlayers] = useState(null);
  const [searchPreview, setSearchPreview] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState(false);

  const parseBasePrice = (priceStr) => {
    if (!priceStr) return 0;
    const cleanStr = String(priceStr).toUpperCase().trim();
    if (cleanStr.includes('CR')) {
      const num = parseFloat(cleanStr.replace('CR', '').trim());
      return num * 10000000;
    }
    if (cleanStr.includes('L') || cleanStr.includes('LAKH')) {
      const num = parseFloat(cleanStr.replace(/LAKH|L/g, '').trim());
      return num * 100000;
    }
    return parseFloat(cleanStr) || 0;
  };

  const processFile = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const bstr = evt.target.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

      let currentCategory = 'BATSMAN';
      let currentPool = null;
      const parsedPlayers = [];

      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        if (!row || row.length === 0) continue;

        const firstCell = String(row[0] || '').toUpperCase();
        const secondCell = String(row[1] || '').toUpperCase();
        const rowString = row.join(' ').toUpperCase();

        const colD = String(row[3] || '').trim();
        const colDContainsPool = colD.toUpperCase().includes('POOL');
        const isColDNumber = !isNaN(colD) && colD !== '';
        
        if (rowString.includes('POOL') && (!colD || colDContainsPool || colD.toLowerCase() === 'player name' || isColDNumber)) {
          const rawRowString = row.join(' ');
          const regex = /(POOL[-\s]*\d+(?:\s+[A-Z\s-]*?(?:ALL\s*ROUNDERS?|ALLROUNDERS?|BATSM[AE]N|BATTERS?|BOWLERS?|WICKET\s*KEEPERS?|WICKETKEEPERS?|WK))?)/i;
          const poolMatch = rawRowString.match(regex);
          
          if (poolMatch) {
            currentPool = poolMatch[1].trim().replace(/\s+/g, ' ').toUpperCase().replace(/\s*-\s*/g, '-');
          } else {
            currentPool = rawRowString.trim().replace(/\s+/g, ' ').toUpperCase().replace(/\s*-\s*/g, '-').replace(/[^a-zA-Z0-9]+$/, '');
          }

          if (rowString.includes('BATSMAN') || rowString.includes('BATSMEN') || rowString.includes('BATTER')) currentCategory = 'BATSMAN';
          else if (rowString.includes('BOWLER') || rowString.includes('SPIN') || rowString.includes('PACE') || rowString.includes('FAST')) currentCategory = 'BOWLER';
          else if (rowString.includes('ALL ROUNDER') || rowString.includes('ALL-ROUNDER') || rowString.includes('ALLROUNDER')) currentCategory = 'ALL_ROUNDER';
          else if (rowString.includes('WICKET KEEPER') || rowString.includes('WICKET-KEEPER') || rowString.includes('WK') || rowString.includes('KEEPER')) currentCategory = 'WICKET_KEEPER';
          
          continue; 
        }

        if (firstCell.includes('SNO') || secondCell.includes('PLAYER CODE')) continue;

        if (row.length >= 4 && row[3]) {
          const playerName = String(row[3]).trim();
          if (!playerName || playerName.toLowerCase() === 'player name') continue; 

          const points = parseInt(row[2]) || 0;
          const country = String(row[4] || '').trim();
          const basePriceRaw = row[5];
          const basePriceParsed = parseBasePrice(basePriceRaw);
          
          let debutYear = null;
          let imageUrl = null;
          const col6 = String(row[6] || '').trim();
          if (col6) {
            // If it's a 4 digit number, it's likely the debut year
            if (col6.length === 4 && !isNaN(col6)) {
              debutYear = parseInt(col6);
            }
          }

          const nameKey = playerName.toLowerCase().replace(/[^a-z]/g, '');
          imageUrl = playerImageMap[nameKey] || null;

          parsedPlayers.push({
            name: playerName,
            category: currentCategory,
            pool: currentPool,
            basePrice: basePriceParsed,
            points: points,
            country: country,
            debutYear: debutYear,
            imageUrl: imageUrl,
            status: 'UPCOMING'
          });
        } else if (parseInt(row[0]) > 0 || parseInt(row[2]) > 0) {
          // Row has SNO or POINTS, but no player name in column D!
          parsedPlayers.push({
            name: `MISSING NAME (Check Excel Row ${i + 1})`,
            category: currentCategory,
            pool: currentPool,
            basePrice: 0,
            points: parseInt(row[2]) || 0,
            country: 'UNKNOWN',
            debutYear: null,
            imageUrl: null,
            status: 'UPCOMING'
          });
        }
      }

      // Deduplicate parsedPlayers based on name (case-insensitive)
      const uniqueParsedPlayers = [];
      const seenNames = new Set();
      for (const p of parsedPlayers) {
        const lowerName = p.name.toLowerCase().trim();
        if (!seenNames.has(lowerName)) {
          seenNames.add(lowerName);
          uniqueParsedPlayers.push(p);
        }
      }

      if (uniqueParsedPlayers.length === 0) {
        alert("No valid players found in the sheet. Please ensure it matches the format.");
        return;
      }
      
      // Sort by Pool number then by Name
      const getPoolNumber = (poolStr) => {
        if (!poolStr) return 999;
        const match = poolStr.match(/POOL\s*[-]?\s*(\d+)/i);
        return match ? parseInt(match[1], 10) : 999;
      };

      uniqueParsedPlayers.sort((a, b) => {
        const poolNumA = getPoolNumber(a.pool);
        const poolNumB = getPoolNumber(b.pool);
        if (poolNumA !== poolNumB) return poolNumA - poolNumB;
        return a.name.localeCompare(b.name);
      });
      
      setPreviewPlayers(uniqueParsedPlayers);
      setUploadSuccess(false);
    };
    reader.readAsBinaryString(file);
  };

  const handleFileUpload = (e) => {
    processFile(e.target.files[0]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
      e.dataTransfer.clearData();
    }
  };

  const handleConfirmUpload = async () => {
    if (!previewPlayers || previewPlayers.length === 0) return;
    try {
      const res = await fetch(API_URL + '/api/players/bulk-global', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ players: previewPlayers })
      });
      const data = await res.json();
      if (data.success) {
        alert('Players successfully added globally!');
        setUploadSuccess(true);
        if (fileInputRef.current) fileInputRef.current.value = '';
        fetchData();
      } else {
        alert(data.error);
      }
    } catch (error) {
      alert(error.message);
    }
  };

  if (loading) return <div>Loading Analytics & Data...</div>;

  const renderLocationLeaderboard = (location) => {
    const analyzedTeamsForLocation = teams.filter(t => t.locationId === location.id).map(team => {
      const localPlayers = team.players.filter(p => p.locationId === location.id);
      const localPoints = localPlayers.reduce((acc, p) => acc + p.points, 0);
      const localMoneySpent = localPlayers.reduce((acc, p) => acc + (p.soldPrice || 0), 0);
      const categories = { BATSMAN: 0, BOWLER: 0, ALL_ROUNDER: 0, WICKET_KEEPER: 0 };
      localPlayers.forEach(p => categories[p.category]++);
      
      let balanceScore = 0;
      if (categories.BATSMAN >= 3) balanceScore += 25;
      if (categories.BOWLER >= 3) balanceScore += 25;
      if (categories.ALL_ROUNDER >= 2) balanceScore += 25;
      if (categories.WICKET_KEEPER >= 1) balanceScore += 25;

      const remainingPurse = team.budget - localMoneySpent;
      const purseInCrores = remainingPurse / 10000000;

      return {
        ...team, localPlayers, localPoints, localMoneySpent, remainingPurse, balanceScore, overallScore: localPoints + purseInCrores + balanceScore
      };
    }).sort((a, b) => b.overallScore - a.overallScore);

    return (
      <div key={location.id} style={{ marginBottom: '3rem' }}>
        <h2 style={{ color: 'var(--primary)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          📍 {location.name} Results
        </h2>
        <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', background: 'rgba(0,0,0,0.2)' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.05)', textAlign: 'left' }}>
                <th style={{ padding: '1rem' }}>Rank</th>
                <th style={{ padding: '1rem' }}>Franchise</th>
                <th style={{ padding: '1rem' }}>Bought Here</th>
                <th style={{ padding: '1rem' }}>Money Spent</th>
                <th style={{ padding: '1rem' }}>Rem. Purse</th>
                <th style={{ padding: '1rem' }}>Points</th>
                <th style={{ padding: '1rem' }}>Overall Score</th>
              </tr>
            </thead>
            <tbody>
              {analyzedTeamsForLocation.map((team, index) => (
                <tr key={team.id} style={{ borderBottom: '1px solid var(--glass-border)' }}>
                  <td style={{ padding: '1rem' }}>
                    {index === 0 ? '🏆 1st' : index === 1 ? '🥈 2nd' : index === 2 ? '🥉 3rd' : `${index + 1}th`}
                  </td>
                  <td style={{ padding: '1rem', fontWeight: 'bold', color: 'var(--primary)' }}>{team.name}</td>
                  <td style={{ padding: '1rem' }}>{team.localPlayers.length}</td>
                  <td style={{ padding: '1rem', color: 'var(--danger)' }}>₹{(team.localMoneySpent / 10000000).toFixed(2)} Cr</td>
                  <td style={{ padding: '1rem', color: 'var(--success)' }}>₹{(team.remainingPurse / 10000000).toFixed(2)} Cr</td>
                  <td style={{ padding: '1rem' }}>{team.localPoints}</td>
                  <td style={{ padding: '1rem', fontWeight: 'bold' }}>{team.overallScore.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="dashboard-grid">
      {/* SIDEBAR NAVIGATION */}
      <div className="dashboard-sidebar glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <h2 style={{ marginBottom: '1rem', textAlign: 'center', color: 'var(--primary)' }}>Manager Menu</h2>
        <button 
          onClick={() => { setActiveTab('LIVE_AUCTION'); }}
          className="btn"
          style={{ background: activeTab === 'LIVE_AUCTION' ? 'var(--primary)' : 'rgba(255,255,255,0.05)', color: activeTab === 'LIVE_AUCTION' ? '#000' : 'white', textAlign: 'left', fontWeight: 'bold' }}
        >
          🔨 Live Auction Room
        </button>
        <button 
          onClick={() => { setActiveTab('DASHBOARD'); setSelectedLocation(null); }}
          className="btn"
          style={{ background: activeTab === 'DASHBOARD' ? 'var(--primary)' : 'rgba(255,255,255,0.05)', color: activeTab === 'DASHBOARD' ? '#000' : 'white', textAlign: 'left' }}
        >
          📊 Overview
        </button>
        <button 
          onClick={() => { setActiveTab('LEADERBOARDS'); setSelectedLocation(null); }}
          className="btn"
          style={{ background: activeTab === 'LEADERBOARDS' ? 'var(--primary)' : 'rgba(255,255,255,0.05)', color: activeTab === 'LEADERBOARDS' ? '#000' : 'white', textAlign: 'left' }}
        >
          🏆 Leaderboards
        </button>
        <button 
          onClick={() => { setActiveTab('VENUES'); setSelectedLocation(null); }}
          className="btn"
          style={{ background: activeTab === 'VENUES' ? 'var(--primary)' : 'rgba(255,255,255,0.05)', color: activeTab === 'VENUES' ? '#000' : 'white', textAlign: 'left' }}
        >
          📍 Venues & Users
        </button>
        <button 
          onClick={() => { setActiveTab('CONFIG'); setSelectedLocation(null); }}
          className="btn"
          style={{ background: activeTab === 'CONFIG' ? 'var(--primary)' : 'rgba(255,255,255,0.05)', color: activeTab === 'CONFIG' ? '#000' : 'white', textAlign: 'left' }}
        >
          ⚙️ System Config
        </button>
        <div style={{ flex: 1 }}></div>
        <button 
          onClick={() => { setActiveTab('DANGER'); setSelectedLocation(null); }}
          className="btn"
          style={{ background: activeTab === 'DANGER' ? 'var(--danger)' : 'rgba(220,53,69,0.1)', color: activeTab === 'DANGER' ? 'white' : 'var(--danger)', textAlign: 'left', border: '1px solid var(--danger)' }}
        >
          ⚠️ Danger Zone
        </button>
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="dashboard-main" style={{ overflowY: 'auto' }}>
        
        {/* LIVE AUCTION TAB */}
        {activeTab === 'LIVE_AUCTION' && (
          <div style={{ width: '100%' }}>
            <AuctioneerDashboard locationIdOverride={selectedLocation?.id} />
          </div>
        )}

        {/* DASHBOARD TAB */}
        {activeTab === 'DASHBOARD' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <div className="glass-panel" style={{ padding: '2rem' }}>
              <h1 style={{ color: 'var(--primary)', marginBottom: '2rem' }}>Global Analytics</h1>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
                <div className="card glass-panel" style={{ textAlign: 'center' }}>
                  <h3 style={{ color: 'var(--text-muted)' }}>Total Venues</h3>
                  <h1 style={{ fontSize: '3rem', color: 'var(--primary)' }}>{locations.length}</h1>
                </div>
                <div className="card glass-panel" style={{ textAlign: 'center' }}>
                  <h3 style={{ color: 'var(--text-muted)' }}>Franchises</h3>
                  <h1 style={{ fontSize: '3rem', color: 'var(--accent)' }}>{teams.length}</h1>
                </div>
                <div className="card glass-panel" style={{ textAlign: 'center' }}>
                  <h3 style={{ color: 'var(--text-muted)' }}>Sold Players</h3>
                  <h1 style={{ fontSize: '3rem', color: 'var(--success)' }}>{playersCount}</h1>
                </div>
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '2rem' }}>
              <h2 style={{ marginBottom: '1rem', color: 'var(--primary)' }}>Global Activity Feed</h2>
              <div className="activity-feed" style={{ maxHeight: '300px' }}>
                {feedLog.length === 0 ? <p className="text-muted">No recent global activity.</p> : null}
                {feedLog.map(log => (
                  <div key={log.id} className={`feed-item ${log.type}`}>
                    {log.msg}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* LEADERBOARDS TAB */}
        {activeTab === 'LEADERBOARDS' && (
          <div className="glass-panel" style={{ padding: '2rem' }}>
            <h1 style={{ marginBottom: '2rem', color: 'var(--primary)' }}>Venue-Wise Results</h1>
            {locations.length > 0 ? (
              locations.map(loc => renderLocationLeaderboard(loc))
            ) : (
              <p>No venues found.</p>
            )}
          </div>
        )}

        {/* VENUES & USERS TAB */}
        {activeTab === 'VENUES' && (
          <div className="glass-panel" style={{ padding: '2rem' }}>
            {!selectedLocation ? (
              <>
                <h1 style={{ color: 'var(--primary)', marginBottom: '2rem' }}>📍 Manage Venues</h1>
                <form onSubmit={handleCreateLocation} style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
                  <input 
                    type="text" 
                    value={newLocation}
                    onChange={e => setNewLocation(e.target.value)}
                    placeholder="Create a new venue (e.g. Kolkata Venue)" 
                    className="form-input" 
                    style={{ flex: 1 }}
                    required
                  />
                  <button type="submit" className="btn" style={{ background: 'var(--primary)' }}>Add Venue</button>
                </form>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
                  {locations.map(loc => (
                    <div key={loc.id} style={{ background: 'rgba(255,255,255,0.05)', padding: '1.5rem', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
                      <h3 style={{ marginBottom: '1rem' }}>{loc.name}</h3>
                      <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
                        {loc.teams?.length || 0} Franchises Registered
                      </p>
                      <button 
                        onClick={() => setSelectedLocation(loc)}
                        className="btn" 
                        style={{ width: '100%', background: 'var(--primary)' }}
                      >
                        Manage Venue Users
                      </button>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <button 
                      onClick={() => setSelectedLocation(null)}
                      className="btn"
                      style={{ background: 'rgba(255,255,255,0.1)' }}
                    >
                      ⬅️ Back
                    </button>
                    <h2 style={{ color: 'var(--primary)', margin: 0 }}>{selectedLocation.name} Hub</h2>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <button onClick={handleDownloadCSV} className="btn" style={{ background: 'var(--accent)', color: '#000' }}>
                      ⬇️ Export Passwords (CSV)
                    </button>
                    <button 
                      onClick={() => handleDeleteLocation(selectedLocation.id)}
                      className="btn"
                      style={{ background: 'var(--danger)' }}
                    >
                      🗑️ Delete Venue
                    </button>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem' }}>
                  
                  {/* FRANCHISE ROSTER OVERVIEW */}
                  <div>
                    <h3 style={{ marginBottom: '1rem', color: 'var(--text-muted)' }}>1. Fixed Franchises Overview</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
                      {selectedLocation.teams && selectedLocation.teams.length > 0 ? (
                        selectedLocation.teams.map(team => {
                          const localPlayers = team.players ? team.players.filter(p => p.locationId === selectedLocation.id) : [];
                          return (
                            <div key={team.id} className="card glass-panel" style={{ padding: '1rem' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                                <h3 style={{ margin: 0, color: team.isDisqualified ? 'var(--danger)' : 'white' }}>
                                  {team.name}
                                </h3>
                                {team.isDisqualified ? (
                                  <span className="badge badge-danger">DISQUALIFIED</span>
                                ) : team.mistakes >= 3 ? (
                                  <span className="badge badge-danger">3/3 Mistakes</span>
                                ) : team.mistakes > 0 ? (
                                  <span className="badge badge-warning">{team.mistakes}/3 Mistakes</span>
                                ) : (
                                  <span className="badge badge-success">Clean</span>
                                )}
                              </div>
                              <p style={{ margin: '0.2rem 0', color: 'var(--text-muted)' }}>
                                Budget: <strong style={{ color: 'var(--success)' }}>₹{(team.budget / 10000000).toFixed(2)} Cr</strong>
                              </p>
                              <p style={{ margin: '0 0 1rem 0', color: 'var(--text-muted)' }}>
                                Roster: <strong>{localPlayers.length} Players</strong>
                              </p>
                              <button 
                                onClick={() => handleToggleDisqualify(team.id, team.isDisqualified)}
                                className="btn" 
                                style={{ width: '100%', padding: '0.4rem', fontSize: '0.9rem', background: team.isDisqualified ? 'var(--success)' : 'var(--danger)', color: team.isDisqualified ? '#000' : 'white' }}
                              >
                                {team.isDisqualified ? 'Forgive (Un-disqualify)' : 'Manual Disqualify'}
                              </button>
                            </div>
                          )
                        })
                      ) : (
                        <p className="text-muted">No franchises found.</p>
                      )}
                    </div>
                  </div>

                  {/* USER MANAGEMENT SECTION */}
                  <div className="glass-panel" style={{ padding: '2rem' }}>
                    <h3 style={{ marginBottom: '1.5rem', color: 'var(--primary)' }}>2. Venue User Accounts</h3>
                    
                    {/* Create User Form */}
                    <form onSubmit={handleCreateUser} style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem', background: 'rgba(0,0,0,0.2)', padding: '1.5rem', borderRadius: '8px' }}>
                      <div style={{ flex: 1, minWidth: '150px' }}>
                        <label className="text-muted" style={{ display: 'block', marginBottom: '0.5rem' }}>Username</label>
                        <input type="text" className="form-input" placeholder="e.g. auctioneer_pune" value={newUserUsername} onChange={e => setNewUserUsername(e.target.value)} required />
                      </div>
                      <div style={{ flex: 1, minWidth: '150px' }}>
                        <label className="text-muted" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                          <span>Password</span>
                          <button type="button" onClick={generatePassword} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.8rem' }}>Generate</button>
                        </label>
                        <input type="text" className="form-input" placeholder="password" value={newUserPassword} onChange={e => setNewUserPassword(e.target.value)} required />
                      </div>
                      <div style={{ flex: 1, minWidth: '150px' }}>
                        <label className="text-muted" style={{ display: 'block', marginBottom: '0.5rem' }}>Role</label>
                        <select className="form-input" value={newUserRole} onChange={e => setNewUserRole(e.target.value)} required style={{ background: 'var(--bg-color)', color: 'white' }}>
                          <option value="AUCTIONEER">Auctioneer</option>
                          <option value="TEAM_LEADER">Team Leader</option>
                          <option value="ADMIN">Admin</option>
                        </select>
                      </div>
                      {newUserRole === 'TEAM_LEADER' && (
                        <div style={{ flex: 1, minWidth: '150px' }}>
                          <label className="text-muted" style={{ display: 'block', marginBottom: '0.5rem' }}>Linked Team</label>
                          <select className="form-input" value={newUserTeamId} onChange={e => setNewUserTeamId(e.target.value)} required style={{ background: 'var(--bg-color)', color: 'white' }}>
                            <option value="">-- Select Team --</option>
                            {selectedLocation.teams && selectedLocation.teams.map(team => (
                              <option key={team.id} value={team.id}>{team.name}</option>
                            ))}
                          </select>
                        </div>
                      )}
                      <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                        <button type="submit" className="btn" style={{ background: 'var(--primary)', height: '42px' }}>➕ Create Account</button>
                      </div>
                    </form>

                    {/* Users Table */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                      <input 
                        type="text" 
                        placeholder="Search users..." 
                        className="form-input"
                        value={searchUser}
                        onChange={(e) => setSearchUser(e.target.value)}
                        style={{ maxWidth: '300px' }}
                      />
                    </div>
                    <div className="table-container" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                      <table className="glass-table">
                        <thead style={{ position: 'sticky', top: 0, zIndex: 1, background: 'var(--bg-color)' }}>
                          <tr>
                            <th>Role</th>
                            <th>Username</th>
                            <th>Password</th>
                            <th>Linked Team</th>
                            <th style={{ textAlign: 'right' }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {users
                            .filter(u => u.locationId === selectedLocation.id && u.username.toLowerCase().includes(searchUser.toLowerCase()))
                            .map(user => {
                            const linkedTeam = user.teamId ? teams.find(t => t.id === user.teamId) : null;
                            return (
                              <tr key={user.id}>
                                <td>
                                  <span className={`badge ${user.role === 'AUCTIONEER' ? 'badge-primary' : user.role === 'ADMIN' ? 'badge-danger' : 'badge-success'}`}>
                                    {user.role}
                                  </span>
                                </td>
                                <td style={{ fontWeight: 'bold' }}>{user.username}</td>
                                <td>
                                  {editingPasswordFor === user.id ? (
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                      <input 
                                        type="text" 
                                        className="form-input" 
                                        style={{ padding: '0.3rem', fontSize: '0.9rem', width: '120px' }}
                                        value={newPasswordValue}
                                        onChange={e => setNewPasswordValue(e.target.value)}
                                        autoFocus
                                      />
                                      <button onClick={() => handleUpdatePassword(user.id)} className="btn" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem', background: 'var(--success)' }}>Save</button>
                                      <button onClick={() => setEditingPasswordFor(null)} className="btn" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem', background: 'rgba(255,255,255,0.1)' }}>Cancel</button>
                                    </div>
                                  ) : (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                      <span style={{ color: 'var(--text-muted)' }}>{user.password}</span>
                                      <button 
                                        onClick={() => { setEditingPasswordFor(user.id); setNewPasswordValue(''); }} 
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.5 }}
                                        title="Edit Password"
                                      >
                                        ✏️
                                      </button>
                                      <button 
                                        onClick={() => copyToClipboard(user.password)} 
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.5 }}
                                        title="Copy Password"
                                      >
                                        📋
                                      </button>
                                    </div>
                                  )}
                                </td>
                                <td>{linkedTeam ? linkedTeam.name : <span className="text-muted">None</span>}</td>
                                <td style={{ textAlign: 'right' }}>
                                  <button 
                                    onClick={() => handleDeleteUser(user.id)} 
                                    className="btn" 
                                    style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', background: 'rgba(220,53,69,0.2)', color: 'var(--danger)', border: '1px solid var(--danger)' }}
                                  >
                                    Delete User
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      {users.filter(u => u.locationId === selectedLocation.id).length === 0 && (
                        <p className="text-muted" style={{ textAlign: 'center', padding: '1rem' }}>No users found for this venue.</p>
                      )}
                    </div>
                  </div>

                </div>
              </>
            )}
          </div>
        )}

        {/* CONFIG TAB */}
        {activeTab === 'CONFIG' && (
          <div className="glass-panel" style={{ padding: '2rem', border: '2px solid rgba(0,255,127,0.4)' }}>
            <h1 style={{ color: 'var(--success)', marginBottom: '1rem' }}>Global Excel Upload</h1>
            
            {!previewPlayers ? (
                <div 
                className={`dropzone ${isDragging ? 'dragging' : ''}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current.click()}
                style={{ 
                  border: `3px dashed ${isDragging ? 'var(--success)' : 'var(--glass-border)'}`, 
                  borderRadius: '12px', 
                  padding: '4rem 2rem', 
                  textAlign: 'center', 
                  background: isDragging ? 'rgba(0,255,127,0.1)' : 'rgba(0,0,0,0.2)',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease'
                }}
              >
                <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>📄</div>
                <h2>Drag & Drop your Excel file here</h2>
                <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>or click to browse from your computer</p>
                <input 
                  type="file" 
                  accept=".xlsx, .xls, .csv" 
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  style={{ display: 'none' }}
                />
              </div>
            ) : (
              <div>
                {(() => {
                  const poolCounts = previewPlayers.reduce((acc, p) => {
                    const poolName = p.pool || 'Unassigned';
                    acc[poolName] = (acc[poolName] || 0) + 1;
                    return acc;
                  }, {});
                  
                  const playersWithPhotos = previewPlayers.filter(p => p.imageUrl).length;
                  
                  return (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
                      <div style={{ flex: 1, paddingRight: '2rem' }}>
                        
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                          <div style={{ 
                            background: uploadSuccess ? 'rgba(16, 185, 129, 0.1)' : 'rgba(59, 130, 246, 0.1)', 
                            border: `1px solid ${uploadSuccess ? 'rgba(16, 185, 129, 0.3)' : 'rgba(59, 130, 246, 0.3)'}`,
                            padding: '1rem 1.5rem', 
                            borderRadius: '12px',
                            display: 'flex',
                            flexDirection: 'column',
                            minWidth: '200px'
                          }}>
                            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.25rem' }}>
                              Database Status
                            </span>
                            <span style={{ fontSize: '1.5rem', fontWeight: 'bold', color: uploadSuccess ? 'var(--success)' : 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              {uploadSuccess ? '✅ ' : '📊 '}{previewPlayers.length} Players
                            </span>
                          </div>

                          <div style={{ 
                            background: playersWithPhotos === previewPlayers.length ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)', 
                            border: `1px solid ${playersWithPhotos === previewPlayers.length ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
                            padding: '1rem 1.5rem', 
                            borderRadius: '12px',
                            display: 'flex',
                            flexDirection: 'column',
                            minWidth: '200px'
                          }}>
                            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.25rem' }}>
                              Photos Matched
                            </span>
                            <span style={{ fontSize: '1.5rem', fontWeight: 'bold', color: playersWithPhotos === previewPlayers.length ? 'var(--success)' : '#fbbf24', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              📸 {playersWithPhotos} / {previewPlayers.length}
                            </span>
                          </div>
                        </div>

                        <div style={{ marginBottom: '1.5rem' }}>
                          <h4 style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Pool Distribution</h4>
                          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', maxHeight: '120px', overflowY: 'auto', paddingRight: '0.5rem' }}>
                            {Object.entries(poolCounts).map(([pool, count]) => (
                              <div key={pool} style={{ 
                                background: 'rgba(255,255,255,0.05)', 
                                padding: '0.4rem 0.8rem', 
                                borderRadius: '8px', 
                                border: '1px solid var(--glass-border)',
                                fontSize: '0.85rem',
                                color: 'var(--text)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem'
                              }}>
                                {pool}
                                <div style={{ background: uploadSuccess ? 'var(--success)' : 'var(--primary)', color: '#000', padding: '0.1rem 0.4rem', borderRadius: '12px', fontWeight: 'bold', fontSize: '0.75rem' }}>
                                  {count}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {playersWithPhotos < previewPlayers.length && (
                          <div style={{ 
                            marginTop: '1.5rem', 
                            background: 'linear-gradient(to right, rgba(239, 68, 68, 0.1), rgba(239, 68, 68, 0.02))', 
                            padding: '1.25rem', 
                            borderRadius: '12px', 
                            borderLeft: '4px solid var(--danger)',
                            borderTop: '1px solid rgba(239, 68, 68, 0.2)',
                            borderRight: '1px solid rgba(239, 68, 68, 0.2)',
                            borderBottom: '1px solid rgba(239, 68, 68, 0.2)',
                          }}>
                            <h3 style={{ color: 'var(--danger)', marginBottom: '1rem', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <span style={{ fontSize: '1.2rem' }}>⚠️</span> Action Required: Missing Photos ({previewPlayers.length - playersWithPhotos})
                            </h3>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', maxHeight: '160px', overflowY: 'auto', paddingRight: '0.5rem' }}>
                              {previewPlayers.filter(p => !p.imageUrl).map((p, idx) => (
                                <span key={idx} style={{ 
                                  background: 'rgba(239, 68, 68, 0.15)', 
                                  padding: '0.3rem 0.75rem', 
                                  borderRadius: '20px', 
                                  fontSize: '0.8rem', 
                                  color: '#fca5a5', 
                                  border: '1px solid rgba(239, 68, 68, 0.3)',
                                  fontWeight: '500',
                                  letterSpacing: '0.5px'
                                }}>
                                  {p.name}
                                </span>
                              ))}
                            </div>
                            <p style={{ fontSize: '0.8rem', color: '#fca5a5', marginTop: '1rem', opacity: 0.8, fontStyle: 'italic' }}>
                              * Download photos for these players, format their names strictly as "firstname_lastname.png", and place them in the public folder.
                            </p>
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                        {uploadSuccess ? (
                          <button onClick={() => { setPreviewPlayers(null); setUploadSuccess(false); }} className="btn" style={{ background: 'var(--primary)', color: '#000' }}>Upload Another File</button>
                        ) : (
                          <>
                            <button onClick={() => { setPreviewPlayers(null); setUploadSuccess(false); }} className="btn" style={{ background: 'rgba(255,255,255,0.1)' }}>Cancel</button>
                            <button onClick={handleConfirmUpload} className="btn" style={{ background: 'var(--success)', color: '#000' }}>Confirm & Upload</button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })()}
                
                <input 
                  type="text" 
                  placeholder="Search preview..." 
                  className="form-input"
                  value={searchPreview}
                  onChange={(e) => setSearchPreview(e.target.value)}
                  style={{ marginBottom: '1rem', width: '100%', maxWidth: '400px' }}
                />

                <div className="table-container" style={{ maxHeight: '600px', overflowY: 'auto' }}>
                  <table className="glass-table" style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--bg-dark)', boxShadow: '0 2px 5px rgba(0,0,0,0.2)' }}>Name</th>
                        <th style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--bg-dark)', boxShadow: '0 2px 5px rgba(0,0,0,0.2)' }}>Category</th>
                        <th style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--bg-dark)', boxShadow: '0 2px 5px rgba(0,0,0,0.2)' }}>Pool</th>
                        <th style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--bg-dark)', boxShadow: '0 2px 5px rgba(0,0,0,0.2)' }}>Country</th>
                        <th style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--bg-dark)', boxShadow: '0 2px 5px rgba(0,0,0,0.2)' }}>Points</th>
                        <th style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--bg-dark)', boxShadow: '0 2px 5px rgba(0,0,0,0.2)' }}>Base Price</th>
                        <th style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--bg-dark)', boxShadow: '0 2px 5px rgba(0,0,0,0.2)' }}>Photo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewPlayers
                        .filter(p => 
                          p.name.toLowerCase().includes(searchPreview.toLowerCase()) || 
                          p.category.toLowerCase().includes(searchPreview.toLowerCase()) ||
                          p.country.toLowerCase().includes(searchPreview.toLowerCase()) ||
                          (p.pool && p.pool.toLowerCase().includes(searchPreview.toLowerCase()))
                        )
                        .map((p, idx) => (
                        <tr key={idx}>
                          <td>{p.name}</td>
                          <td><span className={`badge badge-${p.category.toLowerCase()}`}>{p.category}</span></td>
                          <td>{p.pool || <span className="text-muted">None</span>}</td>
                          <td>{p.country}</td>
                          <td>{p.points}</td>
                          <td>₹{(p.basePrice / 10000000).toFixed(2)} Cr</td>
                          <td>
                            {p.imageUrl ? (
                              <img 
                                src={p.imageUrl} 
                                alt={p.name} 
                                style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px', cursor: 'pointer', transition: 'transform 0.2s' }} 
                                onClick={() => setSelectedPhoto(p.imageUrl)}
                                onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
                                onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
                              />
                            ) : (
                              <span className="text-muted">No Image</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* DANGER ZONE TAB */}
        {activeTab === 'DANGER' && (
          <div className="glass-panel" style={{ padding: '3rem', border: '2px solid var(--danger)', textAlign: 'center' }}>
            <div style={{ fontSize: '5rem', marginBottom: '1rem' }}>⚠️</div>
            <h1 style={{ color: 'var(--danger)', marginBottom: '1rem', fontSize: '3rem' }}>Danger Zone</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '1.2rem', maxWidth: '600px', margin: '0 auto 2rem auto' }}>
              This action will completely wipe the player database, erase all bids, and reset all franchise budgets back to 90 Crore. 
              <strong> Venues, Teams, and Passwords will remain intact.</strong> Use this to prepare for a brand new auction.
            </p>
            <button onClick={handleResetPlayers} className="btn" style={{ background: 'var(--danger)', fontSize: '1.5rem', padding: '1rem 3rem' }}>
              Reset Player Database
            </button>
          </div>
        )}

      </div>

      {/* PHOTO PREVIEW MODAL */}
      {selectedPhoto && (
        <div 
          onClick={() => setSelectedPhoto(null)}
          style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.85)',
            zIndex: 9999,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            cursor: 'zoom-out',
            backdropFilter: 'blur(5px)'
          }}
        >
          <div style={{ position: 'relative' }} onClick={(e) => e.stopPropagation()}>
            <button 
              onClick={() => setSelectedPhoto(null)}
              style={{
                position: 'absolute',
                top: '-40px',
                right: '0px',
                background: 'transparent',
                border: 'none',
                color: 'white',
                fontSize: '2rem',
                cursor: 'pointer'
              }}
            >
              &times;
            </button>
            <img 
              src={selectedPhoto} 
              alt="Player Preview" 
              style={{ 
                maxWidth: '90vw', 
                maxHeight: '85vh', 
                objectFit: 'contain',
                borderRadius: '8px',
                boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                border: '1px solid var(--glass-border)'
              }} 
            />
          </div>
        </div>
      )}
    </div>
  );
}
