import { useEffect, useState } from 'react';
import socket from '../socket';
import { useAuth } from '../AuthContext';

const API_URL = import.meta.env.VITE_API_URL || '';

export default function TeamLeaderDashboard() {
  const { user } = useAuth();
  const [selectedTeamOverride, setSelectedTeamOverride] = useState(null);
  const [teams, setTeams] = useState([]);
  const selectedTeam = user?.teamId || selectedTeamOverride || (teams[0]?.id || null);
  const [teamData, setTeamData] = useState(null);
  
  const [isBreakMode, setIsBreakMode] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [feedLog, setFeedLog] = useState([]);
  const [showSquad, setShowSquad] = useState(false);
  const [livePlayer, setLivePlayer] = useState(null);

  // Authoritative Server Timer State
  const [timerDeadline, setTimerDeadline] = useState(null);
  const [timerSecondsLeft, setTimerSecondsLeft] = useState(null);
  const [timerPaused, setTimerPaused] = useState(false);

  // 5-Second Global Auction Starting Countdown State
  const [auctionStartingCountdown, setAuctionStartingCountdown] = useState(null);

  // Countdown effect for the 5-second countdown
  useEffect(() => {
    if (auctionStartingCountdown === null) return;
    if (auctionStartingCountdown > 0) {
      const timer = setTimeout(() => {
        setAuctionStartingCountdown(prev => (prev > 0 ? prev - 1 : 0));
      }, 1000);
      return () => clearTimeout(timer);
    } else if (auctionStartingCountdown === 0) {
      const timer = setTimeout(() => {
        setAuctionStartingCountdown(null);
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [auctionStartingCountdown]);

  // Local ticker derived from server deadline
  useEffect(() => {
    if (!timerDeadline || timerPaused) return;

    const interval = setInterval(() => {
      const remainingMs = timerDeadline - Date.now();
      const sec = Math.max(0, Math.ceil(remainingMs / 1000));
      setTimerSecondsLeft(sec);
      if (remainingMs <= 0) {
        clearInterval(interval);
      }
    }, 200);

    return () => clearInterval(interval);
  }, [timerDeadline, timerPaused]);

  useEffect(() => {
    fetch(API_URL + '/api/teams')
      .then(res => res.json())
      .then(data => {
        setTeams(data);
        if (!user?.teamId && data.length > 0 && !selectedTeamOverride) {
          setSelectedTeamOverride(data[0].id);
        }
      })
      .catch(console.error);
  }, [user]);

  useEffect(() => {
    if (selectedTeam) {
      const fetchTeamData = () => {
        fetch(API_URL + '/api/teams')
          .then(res => res.json())
          .then(data => {
            const myTeam = data.find(t => t.id === parseInt(selectedTeam) || String(t.id) === String(selectedTeam));
            setTeamData(myTeam);
            setTeams(data);
            if (myTeam && myTeam.locationId) {
              socket.emit('joinLocation', myTeam.locationId);
              fetch(`${API_URL}/api/players?locationId=${myTeam.locationId}`)
                .then(r => r.json())
                .then(players => {
                  const currentLive = players.find(p => p.status === 'LIVE');
                  setLivePlayer(currentLive || null);
                  if (currentLive?.timerDeadlineMs) {
                    setTimerDeadline(currentLive.timerDeadlineMs);
                    setTimerSecondsLeft(Math.max(0, Math.ceil((currentLive.timerDeadlineMs - Date.now()) / 1000)));
                  }
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
        setTimerDeadline(null);
        setTimerSecondsLeft(null);
        if (player.teamId === parseInt(selectedTeam) || String(player.teamId) === String(selectedTeam)) {
          fetchTeamData();
        }
        setFeedLog(prev => [{ 
          id: Date.now(), 
          msg: `${player.name} SOLD for ₹${(player.soldPrice / 10000000).toFixed(2)} Cr`, 
          type: 'sold' 
        }, ...prev].slice(0, 50));
      });

      socket.on('penaltyIssued', (data) => {
        fetchTeamData();
        setFeedLog(prev => [{ 
          id: Date.now(), 
          msg: `Penalty infraction recorded against franchise`, 
          type: 'penalty' 
        }, ...prev].slice(0, 50));
      });

      socket.on('newBid', (data) => {
        setLivePlayer(prev => prev && prev.id === data.playerId ? { ...prev, currentBid: data.amount, currentBidTeamId: data.teamId } : prev);
        setFeedLog(prev => [{ 
          id: Date.now(), 
          msg: `New bid placed: ₹${(data.amount / 10000000).toFixed(2)} Cr`, 
          type: 'bid' 
        }, ...prev].slice(0, 50));
      });

      socket.on('livePlayerUpdated', (player) => {
        setLivePlayer(player);
        if (player?.timerDeadlineMs) {
          setTimerDeadline(player.timerDeadlineMs);
          setTimerSecondsLeft(Math.max(0, Math.ceil((player.timerDeadlineMs - Date.now()) / 1000)));
          setTimerPaused(false);
        }
      });

      socket.on('timerUpdated', (data) => {
        if (data.deadlineMs) {
          setTimerDeadline(data.deadlineMs);
          setTimerSecondsLeft(Math.max(0, Math.ceil((data.deadlineMs - Date.now()) / 1000)));
        } else if (data.paused) {
          setTimerDeadline(null);
        }
        setTimerPaused(Boolean(data.paused));
        if (data.paused && data.remainingMs !== undefined) {
          setTimerSecondsLeft(Math.max(0, Math.ceil(data.remainingMs / 1000)));
        }
      });

      socket.on('playerUnsold', (player) => {
        setLivePlayer(player);
        setTimerDeadline(null);
        setTimerSecondsLeft(null);
      });

      socket.on('auctionBreakToggled', (data) => {
        setIsBreakMode(Boolean(data.show));
        if (data.show) {
          setTimerPaused(true);
          setTimerDeadline(null);
          setFeedLog(prev => [{
            id: Date.now(),
            msg: `⏸️ OFFICIAL AUCTION RECESS IN EFFECT — BID MUTATIONS LOCKED`,
            type: 'alert'
          }, ...prev].slice(0, 50));
        } else {
          setTimerPaused(false);
          setFeedLog(prev => [{
            id: Date.now(),
            msg: `▶ AUCTION SESSION RESUMED — BIDDING PADDLES UNLOCKED`,
            type: 'alert'
          }, ...prev].slice(0, 50));
        }
      });

      socket.on('leaderboardToggled', (show) => {
        setShowLeaderboard(show);
      });

      socket.on('auctionStarting', (data) => {
        const remaining = data.seconds || 5;
        setAuctionStartingCountdown(remaining);
        setFeedLog(prev => [{ 
          id: Date.now(), 
          msg: `⚡ AUCTION STARTING in ${remaining}s — Gavel master initialized session!`, 
          type: 'alert' 
        }, ...prev].slice(0, 50));
      });

      return () => {
        socket.off('playerSold');
        socket.off('penaltyIssued');
        socket.off('newBid');
        socket.off('auctionBreakToggled');
        socket.off('leaderboardToggled');
        socket.off('livePlayerUpdated');
        socket.off('timerUpdated');
        socket.off('playerUnsold');
        socket.off('auctionStarting');
      };
    }
  }, [selectedTeam]);

  if (!selectedTeam) return (
    <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--crimson-danger)', fontFamily: 'JetBrains Mono, monospace' }}>
      ERROR: NO FRANCHISE ASSIGNED TO CURRENT CREDENTIALS.
    </div>
  );
  
  if (!teamData) return (
    <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--gold-primary)', fontFamily: 'JetBrains Mono, monospace' }}>
      INITIALIZING FRANCHISE WAR ROOM TELEMETRY...
    </div>
  );

  const totalPoints = teamData.players.reduce((acc, p) => acc + p.points, 0);
  const batsmenCount = teamData.players.filter(p => p.category === 'BATSMAN').length;
  const bowlerCount = teamData.players.filter(p => p.category === 'BOWLER').length;
  const allRounderCount = teamData.players.filter(p => p.category === 'ALL_ROUNDER').length;
  const wkCount = teamData.players.filter(p => p.category === 'WICKET_KEEPER').length;
  const overseasCount = teamData.players.filter(p => p.country && p.country.toUpperCase() !== 'IND' && p.country.toUpperCase() !== 'INDIA').length;

  const getAvatar = (name, url) => url || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=141b25&color=d4af37&size=128`;

  if (showLeaderboard) {
    const sortedTeams = [...teams].sort((a, b) => {
      const aPoints = (a.players || []).reduce((sum, p) => sum + p.points, 0);
      const bPoints = (b.players || []).reduce((sum, p) => sum + p.points, 0);
      return bPoints - aPoints;
    });

    return (
      <div style={{ padding: '2rem', maxWidth: '1000px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--gold-primary)', fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.15em' }}>
              OFFICIAL ARENA STANDINGS
            </span>
            <h1 style={{ fontSize: '2rem', color: '#ffffff', fontWeight: '800', margin: 0 }}>Tournament Leaderboard</h1>
          </div>
          <button className="btn btn-secondary" onClick={() => setShowLeaderboard(false)}>
            CLOSE STANDINGS
          </button>
        </div>

        <div className="table-container">
          <table className="glass-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Franchise</th>
                <th>Roster Slots</th>
                <th>Purse Remaining</th>
                <th style={{ color: 'var(--emerald-live)' }}>Squad Points</th>
              </tr>
            </thead>
            <tbody>
              {sortedTeams.map((t, index) => {
                const pts = (t.players || []).reduce((sum, p) => sum + p.points, 0);
                const isMyTeam = t.id === teamData.id;
                return (
                  <tr key={t.id} style={{ background: isMyTeam ? 'var(--gold-surface)' : 'transparent' }}>
                    <td style={{ fontWeight: '800', fontFamily: 'JetBrains Mono, monospace', color: index === 0 ? 'var(--gold-bright)' : 'var(--text-secondary)' }}>
                      #{index + 1}
                    </td>
                    <td style={{ fontWeight: '700', color: isMyTeam ? 'var(--gold-bright)' : '#ffffff' }}>
                      {t.name} {isMyTeam && <span className="badge badge-gold" style={{ marginLeft: '0.5rem', fontSize: '0.65rem' }}>YOUR TEAM</span>}
                    </td>
                    <td style={{ fontFamily: 'JetBrains Mono, monospace' }}>{(t.players || []).length} / 15</td>
                    <td style={{ color: 'var(--gold-bright)', fontWeight: '700', fontFamily: 'JetBrains Mono, monospace' }}>
                      ₹{(t.budget / 10000000).toFixed(2)} Cr
                    </td>
                    <td style={{ fontWeight: '800', color: 'var(--emerald-live)', fontSize: '1.1rem', fontFamily: 'JetBrains Mono, monospace' }}>
                      {pts}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <>
      {isBreakMode && (
        <div style={{ 
          background: 'var(--amber-surface)', 
          borderBottom: '1px solid var(--amber-border)', 
          color: 'var(--amber-warning)', 
          textAlign: 'center', 
          padding: '0.6rem', 
          fontWeight: '700', 
          fontSize: '0.85rem', 
          letterSpacing: '0.15em', 
          textTransform: 'uppercase',
          fontFamily: 'JetBrains Mono, monospace',
          position: 'sticky', 
          top: '4.5rem', 
          zIndex: 90 
        }}>
          OFFICIAL AUCTION RECESS IN EFFECT — BID MUTATIONS CURRENTLY LOCKED
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '1.5rem', marginTop: '0.5rem' }}>
        
        {/* LEFT COLUMN: FRANCHISE ROSTER TRACKER */}
        <div style={{ 
          background: 'rgba(10, 13, 18, 0.85)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '8px',
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          height: 'calc(100vh - 120px)',
          overflow: 'hidden'
        }}>
          
          <div style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '1rem', marginBottom: '1.25rem' }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--gold-primary)', fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
              FRANCHISE DESK {user?.role !== 'TEAM_LEADER' && '(WAR ROOM MONITOR)'}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginTop: '0.2rem' }}>
              <h2 style={{ fontSize: '1.4rem', color: '#ffffff', fontWeight: '800', margin: 0 }}>
                {teamData.name}
              </h2>
              {user?.role !== 'TEAM_LEADER' && teams.length > 1 && (
                <select
                  value={selectedTeam}
                  onChange={(e) => setSelectedTeamOverride(e.target.value)}
                  style={{
                    background: '#0d1117',
                    color: 'var(--gold-bright)',
                    border: '1px solid var(--gold-border)',
                    borderRadius: '4px',
                    padding: '0.25rem 0.5rem',
                    fontSize: '0.75rem',
                    fontFamily: 'JetBrains Mono, monospace'
                  }}
                  title="Switch franchise war room view"
                >
                  {teams.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              )}
            </div>
          </div>
          
          {teamData.isDisqualified ? (
            <div style={{ 
              background: 'var(--crimson-surface)', 
              border: '1px solid var(--crimson-border)', 
              padding: '0.85rem', 
              borderRadius: '6px', 
              marginBottom: '1rem', 
              color: 'var(--crimson-danger)', 
              fontWeight: '800', 
              textAlign: 'center', 
              textTransform: 'uppercase', 
              letterSpacing: '0.1em',
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '0.8rem'
            }}>
              DISQUALIFIED (3 INFRACTIONS)
            </div>
          ) : (
            <div style={{ 
              background: 'rgba(16, 21, 29, 0.8)', 
              border: '1px solid rgba(255, 255, 255, 0.06)', 
              padding: '0.75rem 1rem', 
              borderRadius: '6px', 
              marginBottom: '1.25rem', 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center' 
            }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'JetBrains Mono, monospace' }}>
                INFRACTIONS
              </span>
              <span style={{ 
                color: teamData.mistakes > 0 ? 'var(--amber-warning)' : 'var(--text-secondary)', 
                fontWeight: '700', 
                fontSize: '0.85rem',
                fontFamily: 'JetBrains Mono, monospace'
              }}>
                {teamData.mistakes || 0} / 3
              </span>
            </div>
          )}

          {/* Squad Quota Tracker */}
          <div style={{ flex: 1, overflowY: 'auto', paddingRight: '0.25rem' }}>
            <div style={{ 
              background: 'rgba(16, 21, 29, 0.8)', 
              borderRadius: '6px', 
              padding: '1rem', 
              marginBottom: '1.25rem', 
              border: '1px solid rgba(255, 255, 255, 0.04)' 
            }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--gold-primary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.75rem', fontFamily: 'JetBrains Mono, monospace', fontWeight: '700' }}>
                MANDATORY QUOTA TRACKER
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.8rem', fontFamily: 'JetBrains Mono, monospace' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: batsmenCount >= 3 ? 'var(--emerald-live)' : 'var(--text-secondary)' }}>
                  <span>BAT:</span> <span>{batsmenCount}/3</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: bowlerCount >= 3 ? 'var(--emerald-live)' : 'var(--text-secondary)' }}>
                  <span>BOWL:</span> <span>{bowlerCount}/3</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: allRounderCount >= 2 ? 'var(--emerald-live)' : 'var(--text-secondary)' }}>
                  <span>AR:</span> <span>{allRounderCount}/2</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: wkCount >= 1 ? 'var(--emerald-live)' : 'var(--text-secondary)' }}>
                  <span>WK:</span> <span>{wkCount}/1</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gridColumn: 'span 2', color: overseasCount <= 4 ? 'var(--text-secondary)' : 'var(--crimson-danger)', borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '0.4rem', marginTop: '0.2rem' }}>
                  <span>OVERSEAS:</span> <span>{overseasCount}/4 MAX</span>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'JetBrains Mono, monospace' }}>
                ROSTER OCCUPANCY
              </span>
              <span style={{ fontSize: '0.9rem', fontWeight: '800', color: '#ffffff', fontFamily: 'JetBrains Mono, monospace' }}>
                {teamData.players.length} <span style={{ color: 'var(--text-dim)', fontSize: '0.75rem' }}>/ 15</span>
              </span>
            </div>
            
            <button 
              className="btn btn-secondary" 
              style={{ width: '100%', marginBottom: '1.25rem', padding: '0.65rem', fontSize: '0.75rem' }} 
              onClick={() => setShowSquad(!showSquad)}
            >
              {showSquad ? 'HIDE SQUAD ROSTER' : 'VIEW FULL SQUAD ROSTER'}
            </button>
            
            {/* Squad List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {teamData.players.map(p => (
                <div key={p.id} style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between', 
                  padding: '0.65rem 0.75rem', 
                  background: 'rgba(16, 21, 29, 0.7)', 
                  border: '1px solid rgba(255, 255, 255, 0.04)', 
                  borderRadius: '4px' 
                }}>
                  <div>
                    <div style={{ fontWeight: '700', fontSize: '0.85rem', color: '#ffffff' }}>
                      {p.name}
                    </div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontFamily: 'JetBrains Mono, monospace' }}>
                      {p.category.replace('_', ' ')}
                    </div>
                  </div>
                  <div style={{ fontWeight: '700', color: 'var(--gold-bright)', fontSize: '0.88rem', fontFamily: 'JetBrains Mono, monospace' }}>
                    ₹{(p.soldPrice / 10000000).toFixed(2)} Cr
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: WAR ROOM ACTION CENTER */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* Financial Telemetry Bar */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
            <div style={{ 
              background: 'linear-gradient(145deg, rgba(20, 27, 37, 0.95), rgba(12, 16, 22, 0.98))', 
              padding: '1.5rem', 
              borderRadius: '8px', 
              border: '1px solid var(--gold-border)' 
            }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--gold-primary)', textTransform: 'uppercase', letterSpacing: '0.12em', fontFamily: 'JetBrains Mono, monospace' }}>
                AVAILABLE PURSE
              </span>
              <div style={{ fontSize: '2.5rem', fontWeight: '900', color: '#ffffff', fontFamily: 'JetBrains Mono, monospace', marginTop: '0.2rem' }}>
                ₹{(teamData.budget / 10000000).toFixed(2)} Cr
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                Out of ₹90.00 Cr initial allocation
              </span>
            </div>
            
            <div style={{ 
              background: 'rgba(10, 13, 18, 0.85)', 
              padding: '1.5rem', 
              borderRadius: '8px', 
              border: '1px solid rgba(255, 255, 255, 0.08)' 
            }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--emerald-live)', textTransform: 'uppercase', letterSpacing: '0.12em', fontFamily: 'JetBrains Mono, monospace' }}>
                TOTAL SQUAD POINTS
              </span>
              <div style={{ fontSize: '2.5rem', fontWeight: '900', color: 'var(--emerald-live)', fontFamily: 'JetBrains Mono, monospace', marginTop: '0.2rem' }}>
                {totalPoints}
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                Accumulated cricketer rating points
              </span>
            </div>
          </div>

          {/* Current Live Lot & Bid Controls */}
          {livePlayer && (
            <div style={{ 
              background: 'rgba(10, 13, 18, 0.95)', 
              borderRadius: '8px', 
              border: '1px solid var(--gold-border)',
              padding: '1.75rem',
              position: 'relative'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <span className="live-pulse-dot"></span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--gold-bright)', letterSpacing: '0.12em', fontFamily: 'JetBrains Mono, monospace', textTransform: 'uppercase' }}>
                    ACTIVE LOT ON GAVEL STAGE
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  {timerSecondsLeft !== null && (
                    <div style={{
                      padding: '0.25rem 0.65rem',
                      background: timerPaused ? 'var(--amber-surface)' : (timerSecondsLeft <= 5 ? 'var(--crimson-surface)' : 'rgba(255,255,255,0.06)'),
                      border: `1px solid ${timerPaused ? 'var(--amber-border)' : (timerSecondsLeft <= 5 ? 'var(--crimson-border)' : 'rgba(255,255,255,0.1)')}`,
                      borderRadius: '4px',
                      fontFamily: 'JetBrains Mono, monospace',
                      fontSize: '0.8rem',
                      fontWeight: '800',
                      color: timerPaused ? 'var(--amber-warning)' : (timerSecondsLeft <= 5 ? 'var(--crimson-danger)' : 'var(--gold-bright)')
                    }}>
                      {timerPaused ? 'TIMER PAUSED' : `${timerSecondsLeft}s REMAINING`}
                    </div>
                  )}
                  <span className={`badge ${livePlayer.status === 'LIVE' ? 'badge-live' : livePlayer.status === 'SOLD' ? 'badge-sold' : 'badge-unsold'}`}>
                    {livePlayer.status}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '1.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ 
                  width: '110px', 
                  height: '110px', 
                  background: 'rgba(20, 27, 37, 0.9)', 
                  borderRadius: '6px', 
                  display: 'flex', 
                  justifyContent: 'center', 
                  alignItems: 'center', 
                  overflow: 'hidden', 
                  border: '1px solid var(--gold-border)',
                  flexShrink: 0
                }}>
                  <img 
                    src={getAvatar(livePlayer.name, livePlayer.imageUrl)} 
                    alt={livePlayer.name} 
                    style={{ height: '90%', objectFit: 'contain' }} 
                    onError={(e) => { e.target.style.display = 'none'; }} 
                  />
                </div>

                <div style={{ flex: 1, minWidth: '260px' }}>
                  <h2 style={{ fontSize: '2rem', fontWeight: '900', color: '#ffffff', margin: 0, textTransform: 'uppercase' }}>
                    {livePlayer.name}
                  </h2>
                  <div style={{ display: 'flex', gap: '0.5rem', margin: '0.5rem 0 1rem 0' }}>
                    <span className="badge badge-gold">{livePlayer.category.replace('_', ' ')}</span>
                    <span className="badge" style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)' }}>
                      {livePlayer.country || 'DOMESTIC'}
                    </span>
                    <span className="badge" style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)' }}>
                      POINTS: {livePlayer.points || 100}
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontFamily: 'JetBrains Mono, monospace' }}>
                        Base Price
                      </div>
                      <div style={{ fontSize: '1.35rem', fontWeight: '800', color: 'var(--text-secondary)', fontFamily: 'JetBrains Mono, monospace' }}>
                        ₹{(livePlayer.basePrice / 10000000).toFixed(2)} Cr
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--gold-bright)', textTransform: 'uppercase', fontFamily: 'JetBrains Mono, monospace' }}>
                        Highest Bid
                      </div>
                      <div style={{ fontSize: '1.5rem', fontWeight: '900', color: 'var(--gold-bright)', fontFamily: 'JetBrains Mono, monospace' }}>
                        ₹{((livePlayer.currentBid || livePlayer.basePrice) / 10000000).toFixed(2)} Cr
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Live Auction Bid Status Banner */}
              {livePlayer.status === 'LIVE' && livePlayer.currentBidTeamId && (
                <div style={{ marginTop: '1.25rem' }}>
                  {String(livePlayer.currentBidTeamId) === String(teamData.id) ? (
                    <div style={{ 
                      background: 'var(--emerald-surface)', 
                      border: '1px solid var(--emerald-border)', 
                      color: 'var(--emerald-live)', 
                      padding: '0.85rem 1.25rem', 
                      borderRadius: '6px', 
                      fontWeight: '700', 
                      fontSize: '0.85rem', 
                      fontFamily: 'JetBrains Mono, monospace', 
                      letterSpacing: '0.05em',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}>
                      <span>[WINNING] YOUR FRANCHISE CURRENTLY HOLDS THE HIGHEST BID</span>
                      <span style={{ fontWeight: '900' }}>₹{((livePlayer.currentBid || livePlayer.basePrice) / 10000000).toFixed(2)} Cr</span>
                    </div>
                  ) : (
                    <div style={{ 
                      background: 'var(--amber-surface)', 
                      border: '1px solid var(--amber-border)', 
                      color: 'var(--amber-warning)', 
                      padding: '0.85rem 1.25rem', 
                      borderRadius: '6px', 
                      fontWeight: '700', 
                      fontSize: '0.85rem', 
                      fontFamily: 'JetBrains Mono, monospace', 
                      letterSpacing: '0.05em',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}>
                      <span>[OUTBID] LEADING BID: {teams.find(t => String(t.id) === String(livePlayer.currentBidTeamId))?.name || 'ANOTHER FRANCHISE'}</span>
                      <span style={{ fontWeight: '900' }}>₹{((livePlayer.currentBid || livePlayer.basePrice) / 10000000).toFixed(2)} Cr</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Activity Stream */}
          <div style={{ 
            background: 'rgba(10, 13, 18, 0.85)', 
            border: '1px solid rgba(255, 255, 255, 0.08)', 
            borderRadius: '8px', 
            padding: '1.25rem' 
          }}>
            <h3 style={{ fontSize: '0.85rem', color: '#ffffff', fontWeight: '800', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
              ARENA ACTIVITY STREAM
            </h3>
            <div className="activity-feed">
              {feedLog.length === 0 ? (
                <div style={{ color: 'var(--text-dim)', fontSize: '0.8rem', fontStyle: 'italic', fontFamily: 'JetBrains Mono, monospace' }}>
                  Waiting for arena actions...
                </div>
              ) : null}
              {feedLog.map(log => (
                <div key={log.id} className={`feed-item ${log.type}`}>
                  {log.msg}
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>
      {/* 5-Second Global Auction Commencing Overlay */}
      {auctionStartingCountdown !== null && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'radial-gradient(circle at center, rgba(16, 21, 29, 0.98), rgba(6, 9, 13, 0.99))',
          zIndex: 99999,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backdropFilter: 'blur(16px)',
          padding: '2rem'
        }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.6rem',
            padding: '0.45rem 1.4rem',
            background: 'rgba(212, 175, 55, 0.15)',
            border: '1px solid var(--gold-border)',
            borderRadius: '50px',
            color: 'var(--gold-bright)',
            fontSize: '0.85rem',
            fontFamily: 'JetBrains Mono, monospace',
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            marginBottom: '1.75rem',
            boxShadow: '0 0 25px rgba(212, 175, 55, 0.25)'
          }}>
            ⚡ GAVEL MASTER COMMAND RECEIVED ⚡
          </div>

          <h1 style={{
            fontSize: '2.8rem',
            fontWeight: '900',
            color: '#ffffff',
            letterSpacing: '-0.02em',
            textAlign: 'center',
            marginBottom: '0.75rem',
            textTransform: 'uppercase'
          }}>
            {auctionStartingCountdown > 0 ? 'AUCTION COMMENCING' : '🔥 AUCTION IS LIVE! 🔥'}
          </h1>

          <p style={{
            color: 'var(--text-secondary)',
            fontSize: '1.15rem',
            fontFamily: 'JetBrains Mono, monospace',
            marginBottom: '2.5rem',
            textAlign: 'center'
          }}>
            {auctionStartingCountdown > 0 
              ? 'All Franchise War Rooms: Stand by for the First Lot' 
              : 'First lot entering the arena now — Bidding paddles unlocked!'}
          </p>

          {auctionStartingCountdown > 0 ? (
            <div style={{
              width: '180px',
              height: '180px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(212, 175, 55, 0.25), rgba(12, 16, 22, 0.95))',
              border: '4px solid var(--gold-border)',
              boxShadow: '0 0 60px rgba(212, 175, 55, 0.5), inset 0 0 40px rgba(212, 175, 55, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '6rem',
              fontWeight: '900',
              color: 'var(--gold-bright)',
              fontFamily: 'JetBrains Mono, monospace'
            }}>
              {auctionStartingCountdown}
            </div>
          ) : (
            <div style={{
              padding: '1.1rem 3.5rem',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, var(--emerald-live), #059669)',
              color: '#000000',
              fontSize: '2rem',
              fontWeight: '900',
              fontFamily: 'JetBrains Mono, monospace',
              letterSpacing: '0.1em',
              boxShadow: '0 0 50px rgba(16, 185, 129, 0.6)'
            }}>
              LET THE BIDDING BEGIN
            </div>
          )}

          <div style={{
            marginTop: '3rem',
            fontSize: '0.9rem',
            color: 'var(--text-dim)',
            fontFamily: 'JetBrains Mono, monospace'
          }}>
            FRANCHISE DESK: <strong style={{ color: '#ffffff' }}>{teamData?.name || 'INITIALIZING'}</strong> &bull; PURSE: ₹{((teamData?.budget || 900000000) / 10000000).toFixed(2)} CR
          </div>
        </div>
      )}

      <audio id="gavelSound" src="https://www.soundjay.com/misc/sounds/gavel-banging-1.mp3" preload="auto"></audio>
    </>
  );
}
