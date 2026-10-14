import { useEffect, useState } from 'react';
import socket from '../socket';
import { useAuth } from '../AuthContext';

export default function TeamLeaderDashboard() {
  const { user } = useAuth();
  const selectedTeam = user?.teamId;
  const [teams, setTeams] = useState([]);
  const [teamData, setTeamData] = useState(null);
  
  const [isBreakMode, setIsBreakMode] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [feedLog, setFeedLog] = useState([]);
  const [showSquad, setShowSquad] = useState(false);
  const [livePlayer, setLivePlayer] = useState(null);

  useEffect(() => {
    fetch(import.meta.env.VITE_API_URL + '/api/teams')
      .then(res => res.json())
      .then(data => setTeams(data))
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (selectedTeam) {
      const fetchTeamData = () => {
        fetch(import.meta.env.VITE_API_URL + '/api/teams')
          .then(res => res.json())
          .then(data => {
            const myTeam = data.find(t => t.id === parseInt(selectedTeam));
            setTeamData(myTeam);
            setTeams(data);
            if (myTeam && myTeam.locationId) {
              socket.emit('joinLocation', myTeam.locationId);
              fetch(`${import.meta.env.VITE_API_URL}/api/players?locationId=${myTeam.locationId}`)
                .then(r => r.json())
                .then(players => {
                  const currentLive = players.find(p => p.status === 'LIVE');
                  setLivePlayer(currentLive || null);
                }).catch(console.error);
            }
          });
      };
      
      fetchTeamData();

      socket.on('playerSold', (player) => {
        const audio = document.getElementById('gavelSound');
        if (audio) {
          audio.currentTime = 0;
          audio.play().catch(e => console.log('Audio error:', e));
        }
        setLivePlayer(player);
        if (player.teamId === parseInt(selectedTeam)) {
          fetchTeamData();
        }
        setFeedLog(prev => [{ id: Date.now(), msg: `${player.name} SOLD for ₹${player.soldPrice / 10000000} Cr`, type: 'sold' }, ...prev].slice(0, 50));
      });

      socket.on('penaltyIssued', (data) => {
        fetchTeamData();
        setFeedLog(prev => [{ id: Date.now(), msg: `A team received a penalty!`, type: 'penalty' }, ...prev].slice(0, 50));
      });

      socket.on('newBid', (data) => {
        setFeedLog(prev => [{ id: Date.now(), msg: `New bid placed: ₹${data.amount / 10000000} Cr`, type: 'bid' }, ...prev].slice(0, 50));
      });

      socket.on('livePlayerUpdated', (player) => {
        setLivePlayer(player);
      });

      socket.on('playerUnsold', (player) => {
        setLivePlayer(player);
      });

      socket.on('auctionBreakToggled', (data) => {
        setIsBreakMode(data.show);
      });

      socket.on('leaderboardToggled', (show) => {
        setShowLeaderboard(show);
      });

      return () => {
        socket.off('playerSold');
        socket.off('penaltyIssued');
        socket.off('newBid');
        socket.off('auctionBreakToggled');
        socket.off('leaderboardToggled');
        socket.off('livePlayerUpdated');
        socket.off('playerUnsold');
      };
    }
  }, [selectedTeam]);

  if (!selectedTeam) return <div>Error: No team assigned to this owner.</div>;
  if (!teamData) return <div>Loading...</div>;

  const totalPoints = teamData.players.reduce((acc, p) => acc + p.points, 0);
  const batsmenCount = teamData.players.filter(p => p.category === 'BATSMAN').length;
  const bowlerCount = teamData.players.filter(p => p.category === 'BOWLER').length;
  const allRounderCount = teamData.players.filter(p => p.category === 'ALL_ROUNDER').length;
  const wkCount = teamData.players.filter(p => p.category === 'WICKET_KEEPER').length;

  const getAvatar = (name, url) => url || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=1e293b&color=fff&size=128`;

  if (showLeaderboard) {
    const sortedTeams = [...teams].sort((a, b) => {
      const aPoints = a.players.reduce((sum, p) => sum + p.points, 0);
      const bPoints = b.players.reduce((sum, p) => sum + p.points, 0);
      return bPoints - aPoints;
    });

    return (
      <div className="glass-panel" style={{ padding: '3rem', margin: '2rem auto', maxWidth: '1000px', textAlign: 'center' }}>
        <h1 style={{ fontSize: '3rem', color: 'var(--primary)', marginBottom: '2rem' }}>Live Standings 🏆</h1>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--glass-border)' }}>
              <th style={{ padding: '1rem', fontSize: '1.2rem', textAlign: 'left' }}>Rank</th>
              <th style={{ padding: '1rem', fontSize: '1.2rem', textAlign: 'left' }}>Franchise</th>
              <th style={{ padding: '1rem', fontSize: '1.2rem' }}>Players</th>
              <th style={{ padding: '1rem', fontSize: '1.2rem' }}>Budget Left</th>
              <th style={{ padding: '1rem', fontSize: '1.5rem', color: 'var(--success)' }}>Total Points</th>
            </tr>
          </thead>
          <tbody>
            {sortedTeams.map((t, index) => {
              const pts = t.players.reduce((sum, p) => sum + p.points, 0);
              return (
                <tr key={t.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: t.id === teamData.id ? 'rgba(59,130,246,0.1)' : 'transparent' }}>
                  <td style={{ padding: '1rem', fontSize: '1.2rem', fontWeight: 'bold' }}>#{index + 1}</td>
                  <td style={{ padding: '1rem', fontSize: '1.2rem', fontWeight: 'bold', textAlign: 'left' }}>{t.name}</td>
                  <td style={{ padding: '1rem' }}>{t.players.length}/15</td>
                  <td style={{ padding: '1rem', color: 'var(--accent)' }}>₹{t.budget / 10000000} Cr</td>
                  <td style={{ padding: '1rem', fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--success)' }}>{pts}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <>
      {isBreakMode && (
        <div style={{ background: 'var(--warning)', color: 'black', textAlign: 'center', padding: '1rem', fontWeight: 'bold', fontSize: '1.5rem', textTransform: 'uppercase', letterSpacing: '2px', position: 'absolute', top: 0, left: 0, right: 0, zIndex: 1000 }}>
          ☕ AUCTION IS ON A SHORT BREAK
        </div>
      )}
      <div className="dashboard-grid" style={{ paddingTop: isBreakMode ? '60px' : '0', height: '100vh', transition: 'padding 0.3s' }}>
      <div className="dashboard-sidebar glass-panel" style={{ display: 'flex', flexDirection: 'column', padding: '1.5rem' }}>
        <h2 style={{ fontSize: '1.6rem', marginBottom: '1.5rem', borderBottom: '2px solid rgba(255,255,255,0.05)', paddingBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'bold' }}>
           📋 Squad Overview
        </h2>
        
        {teamData.isDisqualified ? (
          <div style={{ background: 'linear-gradient(135deg, rgba(239,68,68,0.3), rgba(239,68,68,0.1))', border: '1px solid rgba(239,68,68,0.5)', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem', color: '#fca5a5', fontWeight: 'bold', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '2px', boxShadow: '0 4px 15px rgba(239,68,68,0.2)' }}>
            Disqualified
          </div>
        ) : (
          <div style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.15), rgba(245,158,11,0.05))', border: '1px solid rgba(245,158,11,0.3)', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem', color: '#fcd34d', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 4px 10px rgba(0,0,0,0.1)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>⚠️ Warnings</span>
            <span style={{ background: 'rgba(245,158,11,0.2)', padding: '0.2rem 0.75rem', borderRadius: '12px', fontSize: '0.9rem' }}>{teamData.mistakes || 0} / 3</span>
          </div>
        )}

        <div style={{ flex: 1, overflowY: 'auto', paddingRight: '0.5rem' }}>
          <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '1rem', marginBottom: '1.5rem', border: '1px solid var(--glass-border)' }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.75rem', fontWeight: 'bold' }}>Squad Balance Tracker</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: batsmenCount >= 3 ? 'var(--success)' : 'white' }}>
                <span>BAT:</span> <span>{batsmenCount}/3 {batsmenCount >= 3 ? '✅' : ''}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: bowlerCount >= 3 ? 'var(--success)' : 'white' }}>
                <span>BOWL:</span> <span>{bowlerCount}/3 {bowlerCount >= 3 ? '✅' : ''}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: allRounderCount >= 2 ? 'var(--success)' : 'white' }}>
                <span>AR:</span> <span>{allRounderCount}/2 {allRounderCount >= 2 ? '✅' : ''}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: wkCount >= 1 ? 'var(--success)' : 'white' }}>
                <span>WK:</span> <span>{wkCount}/1 {wkCount >= 1 ? '✅' : ''}</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <span style={{ fontSize: '1rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>Total Players</span>
            <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--text-light)' }}>{teamData.players.length} <span style={{fontSize: '0.9rem', color: 'var(--text-muted)'}}>/ 15</span></span>
          </div>
          
          <button className="btn" style={{ width: '100%', marginBottom: '1.5rem', padding: '0.8rem', background: 'linear-gradient(135deg, var(--primary), var(--secondary))', border: 'none', borderRadius: '8px', boxShadow: '0 4px 15px rgba(59, 130, 246, 0.3)', fontWeight: 'bold', letterSpacing: '0.5px' }} onClick={() => setShowSquad(true)}>
            View Full Squad
          </button>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {teamData.players.map(p => (
              <div key={p.id} className="glass-panel" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.75rem', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '10px', transition: 'all 0.2s ease' }}>
                <div style={{ width: '45px', height: '45px', borderRadius: '8px', overflow: 'hidden', background: 'linear-gradient(to bottom, rgba(59,130,246,0.2), rgba(0,0,0,0.3))', display: 'flex', justifyContent: 'center', alignItems: 'flex-end', border: '1px solid rgba(255,255,255,0.05)' }}>
                   <img src={getAvatar(p.name, p.imageUrl)} alt={p.name} style={{ height: '90%', width: 'auto', objectFit: 'contain', filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.5))' }} />
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <div style={{ fontWeight: 'bold', fontSize: '0.95rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '110px' }}>{p.name} {p.country !== 'IND' && p.country !== 'India' ? '✈️' : ''}</div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginTop: '3px', letterSpacing: '0.5px' }}>{p.category.replace('_', ' ')}</div>
                </div>
                <div style={{ fontWeight: 'bold', color: 'var(--accent)', fontSize: '0.95rem' }}>₹{p.soldPrice / 10000000} Cr</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="dashboard-main">
        {showSquad ? (
          <div className="glass-panel" style={{ padding: '2rem', height: '100%', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
              <h1 style={{ color: 'var(--primary)', fontSize: '2.5rem' }}>Full Squad</h1>
              <button className="btn" onClick={() => setShowSquad(false)}>Back to Dashboard</button>
            </div>
            {['BATSMAN', 'BOWLER', 'ALL_ROUNDER', 'WICKET_KEEPER'].map(cat => {
              const playersInCat = teamData.players.filter(p => p.category === cat);
              if (playersInCat.length === 0) return null;
              return (
                <div key={cat} style={{ marginBottom: '2rem' }}>
                  <h2 style={{ borderBottom: '2px solid var(--glass-border)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>{cat.replace('_', ' ')} ({playersInCat.length})</h2>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1.5rem' }}>
                    {playersInCat.map(p => (
                      <div key={p.id} className="card glass-panel" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '0', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
                        <div style={{ width: '100%', height: '160px', background: 'linear-gradient(to bottom, rgba(59,130,246,0.3), rgba(0,0,0,0.1))', display: 'flex', justifyContent: 'center', alignItems: 'flex-end', paddingTop: '1rem', position: 'relative' }}>
                          <img src={getAvatar(p.name, p.imageUrl)} style={{ height: '90%', width: 'auto', maxWidth: '100%', objectFit: 'contain', filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.5))' }} />
                          <span className={`badge badge-${p.category.toLowerCase()}`} style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', fontSize: '0.6rem' }}>{p.category}</span>
                        </div>
                        <div style={{ padding: '1.25rem', width: '100%', display: 'flex', flexDirection: 'column', flex: 1 }}>
                          <h3 style={{ fontSize: '1.1rem', marginBottom: '0.25rem', fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name} {p.country !== 'IND' && p.country !== 'India' ? '✈️' : ''}</h3>
                          <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '1px' }}>{p.country}</div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Price</span>
                              <span style={{ fontWeight: 'bold', color: 'var(--accent)', fontSize: '1.1rem' }}>₹{p.soldPrice / 10000000} Cr</span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'right' }}>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Points</span>
                              <span style={{ fontWeight: 'bold', color: 'var(--success)', fontSize: '1.1rem' }}>{p.points}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <>
            <div className="glass-panel" style={{ padding: '2rem' }}>
              <h1 style={{ color: 'var(--primary)', fontSize: '3rem' }}>{teamData.name} Headquarters</h1>

              {livePlayer && (
                <div className="glass-panel" style={{ marginTop: '2rem', padding: '1.5rem', border: '2px solid var(--accent)', background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(0,0,0,0.4))', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', top: 0, right: 0, background: livePlayer.status === 'LIVE' ? 'var(--danger)' : (livePlayer.status === 'SOLD' ? 'var(--success)' : 'var(--text-muted)'), color: 'white', padding: '0.5rem 1rem', borderBottomLeftRadius: '12px', fontWeight: 'bold', letterSpacing: '1px' }}>
                    {livePlayer.status === 'LIVE' ? '🔴 LIVE NOW' : livePlayer.status}
                  </div>
                  <h2 style={{ color: 'var(--accent)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '1.5rem', textTransform: 'uppercase', letterSpacing: '1px' }}>
                    CURRENT PLAYER ON AUCTION
                  </h2>
                  <div style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
                    <div style={{ width: '150px', height: '150px', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', display: 'flex', justifyContent: 'center', alignItems: 'flex-end', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
                      <img src={getAvatar(livePlayer.name, livePlayer.imageUrl)} alt={livePlayer.name} style={{ height: '90%', objectFit: 'contain', filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.5))' }} onError={(e) => { e.target.style.display = 'none'; }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <h1 style={{ fontSize: '2.5rem', margin: '0 0 0.5rem 0', color: 'var(--text-light)', lineHeight: 1.2 }}>{livePlayer.name} {livePlayer.country !== 'IND' && livePlayer.country !== 'India' ? '✈️' : ''}</h1>
                      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                        <span className={`badge badge-${livePlayer.category.toLowerCase()}`} style={{ fontSize: '1rem', padding: '0.5rem 1rem' }}>{livePlayer.category.replace('_', ' ')}</span>
                        <span style={{ background: 'rgba(255,255,255,0.1)', padding: '0.5rem 1rem', borderRadius: '20px', fontSize: '1rem', fontWeight: 'bold', color: 'var(--text-light)' }}>{livePlayer.country}</span>
                      </div>
                      <div style={{ display: 'flex', gap: '2rem' }}>
                        <div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.25rem' }}>Base Price</div>
                          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--text-light)' }}>₹{livePlayer.basePrice / 10000000} Cr</div>
                        </div>
                        {livePlayer.soldPrice && (
                          <div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.25rem' }}>Sold For</div>
                            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--success)' }}>₹{livePlayer.soldPrice / 10000000} Cr</div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginTop: '2rem' }}>
                <div className="card glass-panel" style={{ textAlign: 'center' }}>
                  <h3 style={{ color: 'var(--text-muted)' }}>Purse Remaining</h3>
                  <h1 style={{ fontSize: '3.5rem', color: 'var(--accent)' }}>₹{teamData.budget / 10000000} Cr</h1>
                  <p>Out of 90 Cr total budget</p>
                </div>
                
                <div className="card glass-panel" style={{ textAlign: 'center' }}>
                  <h3 style={{ color: 'var(--text-muted)' }}>Squad Rating (Points)</h3>
                  <h1 style={{ fontSize: '3.5rem', color: 'var(--success)' }}>{totalPoints}</h1>
                  <p>Based on player points gained</p>
                </div>
              </div>

              {teamData.players.length > 0 && (
                <div style={{ marginTop: '3rem' }}>
                  <h2 style={{ marginBottom: '1.5rem', borderBottom: '2px solid var(--glass-border)', paddingBottom: '0.5rem', color: 'var(--text-light)' }}>Your Bought Players</h2>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1.5rem' }}>
                    {teamData.players.map(p => (
                      <div key={p.id} className="card glass-panel" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '0', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
                        <div style={{ width: '100%', height: '160px', background: 'linear-gradient(to bottom, rgba(59,130,246,0.3), rgba(0,0,0,0.1))', display: 'flex', justifyContent: 'center', alignItems: 'flex-end', paddingTop: '1rem', position: 'relative' }}>
                          <img src={getAvatar(p.name, p.imageUrl)} style={{ height: '90%', width: 'auto', maxWidth: '100%', objectFit: 'contain', filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.5))' }} />
                          <span className={`badge badge-${p.category.toLowerCase()}`} style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', fontSize: '0.6rem' }}>{p.category}</span>
                        </div>
                        <div style={{ padding: '1.25rem', width: '100%', display: 'flex', flexDirection: 'column', flex: 1 }}>
                          <h3 style={{ fontSize: '1.1rem', marginBottom: '0.25rem', fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name} {p.country !== 'IND' && p.country !== 'India' ? '✈️' : ''}</h3>
                          <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '1px' }}>{p.country}</div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Price</span>
                              <span style={{ fontWeight: 'bold', color: 'var(--accent)', fontSize: '1.1rem' }}>₹{p.soldPrice / 10000000} Cr</span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'right' }}>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Points</span>
                              <span style={{ fontWeight: 'bold', color: 'var(--success)', fontSize: '1.1rem' }}>{p.points}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="glass-panel" style={{ marginTop: '2rem', padding: '1.5rem' }}>
              <h2 style={{ marginBottom: '1rem' }}>Live Auction Feed</h2>
              <div className="activity-feed">
                {feedLog.length === 0 ? <p className="text-muted">Waiting for auction to begin...</p> : null}
                {feedLog.map(log => (
                  <div key={log.id} className={`feed-item ${log.type}`}>
                    {log.msg}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
      <audio id="gavelSound" src="https://www.soundjay.com/misc/sounds/gavel-banging-1.mp3" preload="auto"></audio>
    </div>
    </>
  );
}
