import { useEffect, useState, useRef } from 'react';
import socket from '../socket';
import playerImageMap from '../playerImageMap.json';

const API_URL = import.meta.env.VITE_API_URL || '';

export default function ViewerDashboard() {
  const [locations, setLocations] = useState([]);
  const [livePlayers, setLivePlayers] = useState({});
  const [currentBids, setCurrentBids] = useState({});
  const [teams, setTeams] = useState([]);
  const [venueStats, setVenueStats] = useState({});
  const [breakModes, setBreakModes] = useState({});
  const [selectedLocationId, setSelectedLocationId] = useState(null);
  const [showStatsDrawer, setShowStatsDrawer] = useState(false);
  const [poolAnimation, setPoolAnimation] = useState(null);
  const [activityFeed, setActivityFeed] = useState([]);
  const [timers, setTimers] = useState({}); // { [locationId]: { deadlineMs, remainingSec, paused } }
  const currentPoolsRef = useRef({});
  const lastAudioPlayRef = useRef(0);

  // Interval ticker for real-time second updates derived from server deadline
  useEffect(() => {
    const interval = setInterval(() => {
      setTimers(prev => {
        let changed = false;
        const next = { ...prev };
        Object.keys(next).forEach(locId => {
          const t = next[locId];
          if (t && t.deadlineMs && !t.paused) {
            const sec = Math.max(0, Math.ceil((t.deadlineMs - Date.now()) / 1000));
            if (sec !== t.remainingSec) {
              next[locId] = { ...t, remainingSec: sec };
              changed = true;
            }
          }
        });
        return changed ? next : prev;
      });
    }, 250);

    return () => clearInterval(interval);
  }, []);

  const addActivity = (activity) => {
    setActivityFeed(prev => {
      const newFeed = [activity, ...prev];
      return newFeed.slice(0, 50);
    });
  };

  const playBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      oscillator.type = 'sine';
      oscillator.frequency.value = 880;
      gainNode.gain.setValueAtTime(0.08, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
      oscillator.start(audioCtx.currentTime);
      oscillator.stop(audioCtx.currentTime + 0.1);
    } catch (e) {
      console.log('Audio autoplay blocked', e);
    }
  };

  const playTransitionSound = () => {
    try {
      const now = Date.now();
      if (now - lastAudioPlayRef.current < 3000) return;
      lastAudioPlayRef.current = now;

      const audio = new Audio('/transition.mp3');
      audio.volume = 0.8;
      audio.play().catch(e => console.log('Audio autoplay blocked', e));
    } catch (e) {
      console.log('Audio play error', e);
    }
  };

  useEffect(() => {
    fetch(API_URL + '/api/teams')
      .then(res => res.json())
      .then(data => setTeams(data))
      .catch(console.error);

    fetch(API_URL + '/api/locations')
      .then(res => res.json())
      .then(fetchedLocs => {
        setLocations(fetchedLocs);
        if (fetchedLocs.length > 0) {
          setSelectedLocationId(fetchedLocs[0].id);
        }

        fetchedLocs.forEach(loc => {
          socket.emit('joinLocation', loc.id);

          fetch(`${API_URL}/api/locations/${loc.id}/players`)
            .then(res => res.json())
            .then(data => {
              const soldPlayers = data.filter(p => p.status === 'SOLD');
              const lastSold = soldPlayers.length > 0 ? soldPlayers[soldPlayers.length - 1] : null;
              const topBuys = [...soldPlayers].sort((a, b) => b.soldPrice - a.soldPrice).slice(0, 4);
              const totalSpent = soldPlayers.reduce((sum, p) => sum + (p.soldPrice || 0), 0);
              const playersSold = soldPlayers.length;
              
              setVenueStats(prev => ({
                ...prev,
                [loc.id]: { lastSold, topBuys, totalSpent, playersSold }
              }));
              
              const livePlayer = data.find(p => p.status === 'LIVE');
              if (livePlayer) {
                setLivePlayers(prev => ({ ...prev, [loc.id]: livePlayer }));
              }
            })
            .catch(console.error);
        });
      })
      .catch(console.error);

    socket.on('livePlayerUpdated', (player) => {
      setLivePlayers(prev => ({ ...prev, [player.locationId]: player }));
      if (player?.timerDeadlineMs) {
        setTimers(prev => ({
          ...prev,
          [player.locationId]: {
            deadlineMs: player.timerDeadlineMs,
            remainingSec: Math.max(0, Math.ceil((player.timerDeadlineMs - Date.now()) / 1000)),
            paused: false
          }
        }));
      }
    });

    socket.on('timerUpdated', (data) => {
      setTimers(prev => ({
        ...prev,
        [data.locationId]: {
          deadlineMs: data.deadlineMs,
          remainingSec: data.deadlineMs 
            ? Math.max(0, Math.ceil((data.deadlineMs - Date.now()) / 1000))
            : (data.remainingMs ? Math.max(0, Math.ceil(data.remainingMs / 1000)) : 0),
          paused: Boolean(data.paused)
        }
      }));
    });

    socket.on('newBid', (data) => {
      playBeep();
      setCurrentBids(prev => ({ ...prev, [data.locationId]: data }));
      addActivity({
        type: 'BID',
        teamId: data.teamId,
        amount: data.amount,
        playerId: data.playerId,
        locationId: data.locationId,
        timestamp: Date.now()
      });
    });

    socket.on('playerSold', (player) => {
      setLivePlayers(prev => ({ ...prev, [player.locationId]: player }));
      setCurrentBids(prev => {
        const next = { ...prev };
        delete next[player.locationId];
        return next;
      });

      addActivity({
        type: 'SOLD',
        player,
        teamId: player.teamId,
        amount: player.soldPrice,
        locationId: player.locationId,
        timestamp: Date.now()
      });

      // Update venue stats
      setVenueStats(prev => {
        const current = prev[player.locationId] || { topBuys: [], totalSpent: 0, playersSold: 0 };
        const newBuys = [...current.topBuys, player].sort((a, b) => b.soldPrice - a.soldPrice).slice(0, 4);
        return {
          ...prev,
          [player.locationId]: {
            lastSold: player,
            topBuys: newBuys,
            totalSpent: current.totalSpent + (player.soldPrice || 0),
            playersSold: current.playersSold + 1
          }
        };
      });
    });

    socket.on('playerUnsold', (player) => {
      setLivePlayers(prev => ({ ...prev, [player.locationId]: player }));
      setCurrentBids(prev => {
        const next = { ...prev };
        delete next[player.locationId];
        return next;
      });

      addActivity({
        type: 'UNSOLD',
        player,
        locationId: player.locationId,
        timestamp: Date.now()
      });
    });

    socket.on('auctionBreakToggled', (data) => {
      setBreakModes(prev => ({ ...prev, [data.locationId]: data.show }));
    });

    return () => {
      socket.off('livePlayerUpdated');
      socket.off('newBid');
      socket.off('playerSold');
      socket.off('playerUnsold');
      socket.off('auctionBreakToggled');
    };
  }, []);

  useEffect(() => {
    if (selectedLocationId && livePlayers[selectedLocationId]) {
      const currentPlayer = livePlayers[selectedLocationId];
      if (currentPlayer.status === 'LIVE' && currentPlayer.pool) {
        const currentPool = currentPoolsRef.current[selectedLocationId];
        if (currentPool !== currentPlayer.pool) {
          playTransitionSound();
          setPoolAnimation(currentPlayer.pool);
          setTimeout(() => setPoolAnimation(null), 3500);
          currentPoolsRef.current[selectedLocationId] = currentPlayer.pool;
        }
      }
    }
  }, [livePlayers, selectedLocationId]);

  const getTeamName = (teamId) => {
    const team = teams.find(t => t.id === teamId);
    return team ? team.name : 'Unknown Franchise';
  };

  const getCategoryClass = (category) => {
    switch (category) {
      case 'BATSMAN': return 'badge-batsman';
      case 'BOWLER': return 'badge-bowler';
      case 'ALL_ROUNDER': return 'badge-all_rounder';
      case 'WICKET_KEEPER': return 'badge-wicket_keeper';
      default: return 'badge-gold';
    }
  };

  const renderGlobalView = () => (
    <div style={{ padding: '0.5rem 0', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: '800', color: '#ffffff' }}>Global Arena Multiview</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Real-time telemetry across all sanctioned auction venues</p>
        </div>
        <span className="badge badge-gold">
          {locations.length} ACTIVE VENUES
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.5rem' }}>
        {locations.map(loc => {
          const livePlayer = livePlayers[loc.id];
          const isLive = livePlayer && livePlayer.status === 'LIVE';
          const stats = venueStats[loc.id] || { totalSpent: 0, playersSold: 0 };
          const activeBid = currentBids[loc.id];
          const isBreak = breakModes[loc.id];
          
          return (
            <div 
              key={loc.id} 
              style={{ 
                cursor: 'pointer', 
                transition: 'all 0.25s ease',
                padding: '1.75rem',
                borderRadius: '8px',
                border: isLive ? '1px solid var(--gold-border)' : '1px solid rgba(255, 255, 255, 0.08)',
                background: isLive 
                  ? 'linear-gradient(145deg, rgba(20, 27, 37, 0.95), rgba(12, 16, 22, 0.98))' 
                  : 'rgba(16, 21, 29, 0.85)',
                position: 'relative',
                overflow: 'hidden',
                boxShadow: isLive ? '0 15px 35px rgba(0,0,0,0.7), 0 0 15px rgba(212, 175, 55, 0.15)' : 'none'
              }}
              onClick={() => setSelectedLocationId(loc.id)}
              onMouseOver={(e) => { 
                e.currentTarget.style.transform = 'translateY(-3px)'; 
                e.currentTarget.style.borderColor = isLive ? 'var(--gold-bright)' : 'rgba(255,255,255,0.2)'; 
              }}
              onMouseOut={(e) => { 
                e.currentTarget.style.transform = 'translateY(0)'; 
                e.currentTarget.style.borderColor = isLive ? 'var(--gold-border)' : 'rgba(255, 255, 255, 0.08)'; 
              }}
            >
              {isBreak && (
                <div style={{ 
                  position: 'absolute', 
                  top: 0, 
                  left: 0, 
                  width: '100%', 
                  height: '100%', 
                  background: 'rgba(6, 8, 11, 0.92)', 
                  zIndex: 10, 
                  display: 'flex', 
                  flexDirection: 'column',
                  alignItems: 'center', 
                  justifyContent: 'center',
                  backdropFilter: 'blur(8px)'
                }}>
                  <span className="badge badge-gold" style={{ fontSize: '0.85rem', padding: '0.4rem 1rem' }}>
                    OFFICIAL RECESS
                  </span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                    Auction session paused
                  </span>
                </div>
              )}
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <h3 style={{ fontSize: '1.35rem', color: '#ffffff', margin: 0, fontWeight: '700' }}>{loc.name}</h3>
                {isLive ? (
                  <span className="badge badge-live">
                    <span className="live-pulse-dot" style={{ width: '6px', height: '6px', marginRight: '6px' }}></span>
                    LIVE LOT
                  </span>
                ) : (
                  <span className="badge badge-idle">STANDBY</span>
                )}
              </div>

              {isLive ? (
                <div style={{ 
                  display: 'flex', 
                  gap: '1.25rem', 
                  alignItems: 'center', 
                  background: 'rgba(10, 13, 18, 0.8)', 
                  padding: '1.1rem', 
                  borderRadius: '6px', 
                  border: '1px solid rgba(212, 175, 55, 0.2)' 
                }}>
                  <div style={{ 
                    width: '56px', 
                    height: '56px', 
                    borderRadius: '6px', 
                    background: 'rgba(20, 27, 37, 0.9)', 
                    overflow: 'hidden', 
                    flexShrink: 0, 
                    display: 'flex', 
                    justifyContent: 'center', 
                    alignItems: 'center', 
                    border: '1px solid rgba(255,255,255,0.1)' 
                  }}>
                    <img 
                      src={playerImageMap[livePlayer.name.toLowerCase().replace(/[^a-z]/g, '')] || `/players/${livePlayer.name.toLowerCase().replace(/ /g, '_')}.png`} 
                      alt={livePlayer.name} 
                      style={{ height: '90%', width: 'auto', objectFit: 'contain' }} 
                      onError={(e) => { e.target.style.display = 'none'; }} 
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: '700', fontSize: '1.1rem', color: '#ffffff', marginBottom: '0.2rem' }}>{livePlayer.name}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontFamily: 'JetBrains Mono, monospace' }}>
                      BASE: ₹{(livePlayer.basePrice / 10000000).toFixed(2)} Cr
                    </div>
                  </div>
                  {activeBid && (
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.7rem', color: 'var(--gold-bright)', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'JetBrains Mono, monospace' }}>
                        HIGH BID
                      </div>
                      <div style={{ fontSize: '1.25rem', fontWeight: '800', color: '#ffffff', fontFamily: 'JetBrains Mono, monospace' }}>
                        ₹{(activeBid.amount / 10000000).toFixed(2)} Cr
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  padding: '1.1rem', 
                  background: 'rgba(10, 13, 18, 0.6)', 
                  borderRadius: '6px', 
                  border: '1px solid rgba(255,255,255,0.04)' 
                }}>
                  <div style={{ textAlign: 'center', flex: 1 }}>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.25rem', fontFamily: 'JetBrains Mono, monospace' }}>
                      Players Sold
                    </div>
                    <div style={{ fontSize: '1.25rem', fontWeight: '800', color: '#ffffff', fontFamily: 'JetBrains Mono, monospace' }}>
                      {stats.playersSold || 0}
                    </div>
                  </div>
                  <div style={{ width: '1px', background: 'rgba(255,255,255,0.06)' }}></div>
                  <div style={{ textAlign: 'center', flex: 1 }}>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.25rem', fontFamily: 'JetBrains Mono, monospace' }}>
                      Total Volume
                    </div>
                    <div style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--gold-bright)', fontFamily: 'JetBrains Mono, monospace' }}>
                      ₹{((stats.totalSpent || 0) / 10000000).toFixed(2)} Cr
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderDetailedView = () => {
    const loc = locations.find(l => l.id === selectedLocationId);
    if (!loc) return null;

    const player = livePlayers[loc.id];
    const activeBid = currentBids[loc.id];
    const stats = venueStats[loc.id] || { lastSold: null, topBuys: [] };

    return (
      <div style={{ height: 'calc(100vh - 110px)', display: 'flex', flexDirection: 'column', position: 'relative' }}>
        
        {/* Recess Overlay */}
        {breakModes[loc.id] && (
          <div style={{ 
            position: 'absolute', 
            top: 0, 
            left: 0, 
            width: '100%', 
            height: '100%', 
            background: 'rgba(6, 8, 11, 0.96)', 
            zIndex: 100, 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center',
            backdropFilter: 'blur(12px)',
            borderRadius: '10px'
          }}>
            <span className="badge badge-gold" style={{ fontSize: '1rem', padding: '0.5rem 1.5rem', marginBottom: '1.5rem', letterSpacing: '0.2em' }}>
              OFFICIAL RECESS
            </span>
            <h1 style={{ fontSize: '3.5rem', color: '#ffffff', letterSpacing: '-0.02em', textAlign: 'center', fontWeight: '900', margin: 0 }}>
              AUCTION SESSION PAUSED
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem', marginTop: '0.75rem', fontFamily: 'JetBrains Mono, monospace' }}>
              PROCEEDINGS WILL RESUME MOMENTARILY
            </p>
          </div>
        )}

        {/* Live Arena Stage */}
        <div style={{ flex: 1, display: 'flex', position: 'relative', overflow: 'hidden' }}>
          {player && player.status === 'LIVE' ? (
            <div style={{ 
              flex: 1, 
              display: 'flex', 
              flexDirection: 'column', 
              padding: '2.5rem 3rem',
              background: 'linear-gradient(135deg, rgba(20, 27, 37, 0.98) 0%, rgba(10, 13, 18, 0.99) 100%)',
              border: '1px solid var(--gold-border)',
              borderRadius: '10px',
              position: 'relative',
              overflow: 'hidden'
            }}>
              
              {/* Telemetry Corner Accents */}
              <div style={{ position: 'absolute', top: '1.5rem', left: '1.5rem', width: '20px', height: '20px', borderTop: '2px solid var(--gold-primary)', borderLeft: '2px solid var(--gold-primary)' }}></div>
              <div style={{ position: 'absolute', bottom: '1.5rem', right: '1.5rem', width: '20px', height: '20px', borderBottom: '2px solid var(--gold-primary)', borderRight: '2px solid var(--gold-primary)' }}></div>

              {/* Player Data Column */}
              <div style={{ zIndex: 20, width: '60%', display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '100%' }}>
                
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span className="live-pulse-dot"></span>
                    <span style={{ color: 'var(--gold-bright)', fontSize: '0.8rem', fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.2em', textTransform: 'uppercase', fontWeight: '600' }}>
                      CURRENT LOT // {loc.name}
                    </span>
                  </div>

                  {timers[loc.id] && (
                    <div style={{
                      padding: '0.35rem 0.85rem',
                      background: timers[loc.id].paused 
                        ? 'var(--amber-surface)' 
                        : (timers[loc.id].remainingSec <= 5 ? 'var(--crimson-surface)' : 'rgba(212, 175, 55, 0.08)'),
                      border: `1px solid ${timers[loc.id].paused 
                        ? 'var(--amber-border)' 
                        : (timers[loc.id].remainingSec <= 5 ? 'var(--crimson-border)' : 'var(--gold-border)')}`,
                      borderRadius: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      fontFamily: 'JetBrains Mono, monospace'
                    }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>DEADLINE:</span>
                      <span style={{
                        fontSize: '1.15rem',
                        fontWeight: '900',
                        color: timers[loc.id].paused 
                          ? 'var(--amber-warning)' 
                          : (timers[loc.id].remainingSec <= 5 ? 'var(--crimson-danger)' : 'var(--gold-bright)')
                      }}>
                        {timers[loc.id].paused ? 'PAUSED' : `${timers[loc.id].remainingSec}s`}
                      </span>
                    </div>
                  )}
                </div>
                
                <h1 style={{ 
                  fontSize: player.name.length > 16 ? '3rem' : '4rem', 
                  lineHeight: '1.05', 
                  textTransform: 'uppercase', 
                  marginBottom: '1.5rem', 
                  fontWeight: '900',
                  color: '#ffffff'
                }}>
                  {player.name}
                </h1>
                
                {/* Badges Row */}
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '2rem' }}>
                  <span className={`badge ${getCategoryClass(player.category)}`} style={{ fontSize: '0.82rem', padding: '0.35rem 0.85rem' }}>
                    {player.category.replace('_', ' ')}
                  </span>
                  <span className="badge badge-gold" style={{ fontSize: '0.82rem', padding: '0.35rem 0.85rem' }}>
                    {player.country || 'DOMESTIC'}
                  </span>
                  <span className="badge" style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)', border: '1px solid rgba(255,255,255,0.1)', fontSize: '0.82rem', padding: '0.35rem 0.85rem' }}>
                    POINTS: {player.points || 100}
                  </span>
                  {player.pool && (
                    <span className="badge" style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)', border: '1px solid rgba(255,255,255,0.1)', fontSize: '0.82rem', padding: '0.35rem 0.85rem' }}>
                      {player.pool}
                    </span>
                  )}
                </div>

                {/* Base vs High Bid Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '1.5rem', maxWidth: '80%' }}>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', letterSpacing: '0.12em', marginBottom: '0.3rem', textTransform: 'uppercase', fontFamily: 'JetBrains Mono, monospace' }}>
                      Base Valuation
                    </div>
                    <div style={{ fontSize: '2rem', fontWeight: '800', color: 'var(--text-secondary)', fontFamily: 'JetBrains Mono, monospace' }}>
                      ₹{(player.basePrice / 10000000).toFixed(2)} Cr
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--gold-bright)', letterSpacing: '0.12em', marginBottom: '0.3rem', textTransform: 'uppercase', fontFamily: 'JetBrains Mono, monospace' }}>
                      Highest Bid
                    </div>
                    <div style={{ fontSize: '2.4rem', fontWeight: '900', color: 'var(--gold-bright)', fontFamily: 'JetBrains Mono, monospace' }}>
                      {activeBid ? `₹${(activeBid.amount / 10000000).toFixed(2)} Cr` : '₹0.00 Cr'}
                    </div>
                  </div>
                </div>
                
                {/* Active Bidder Callout */}
                <div style={{ 
                  background: activeBid ? 'var(--gold-surface)' : 'rgba(10, 13, 18, 0.6)', 
                  padding: '1rem 1.5rem', 
                  borderRadius: '6px', 
                  border: activeBid ? '1px solid var(--gold-border)' : '1px solid rgba(255,255,255,0.06)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  maxWidth: '80%'
                }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace', textTransform: 'uppercase' }}>
                    HOLDING FRANCHISE
                  </span>
                  <span style={{ fontSize: '1.1rem', fontWeight: '800', color: '#ffffff', letterSpacing: '0.04em' }}>
                    {activeBid ? getTeamName(activeBid.teamId) : 'OPEN FOR OFFERS'}
                  </span>
                </div>
              </div>

              {/* Player Image Render */}
              <img 
                src={playerImageMap[player.name.toLowerCase().replace(/[^a-z]/g, '')] || `/players/${player.name.toLowerCase().replace(/ /g, '_')}.png`} 
                alt={player.name} 
                style={{ 
                  position: 'absolute',
                  bottom: 0,
                  right: '5%',
                  height: '92%',
                  objectFit: 'contain',
                  zIndex: 10,
                  filter: 'drop-shadow(0 15px 30px rgba(0, 0, 0, 0.8))'
                }}
                onError={(e) => {
                  e.target.style.display = 'none';
                }}
              />
            </div>
          ) : player && player.status === 'SOLD' ? (
            <div style={{ 
              flex: 1, 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              justifyContent: 'center', 
              borderRadius: '10px', 
              background: 'linear-gradient(145deg, rgba(20, 27, 37, 0.95), rgba(12, 16, 22, 0.98))',
              border: '1px solid var(--emerald-border)',
              padding: '2rem'
            }}>
              <span className="badge badge-sold" style={{ fontSize: '1rem', padding: '0.5rem 1.5rem', marginBottom: '1.5rem', letterSpacing: '0.15em' }}>
                CONFIRMED SALE
              </span>
              <h1 style={{ color: '#ffffff', fontSize: '3rem', marginBottom: '0.5rem', fontWeight: '800' }}>{player.name}</h1>
              <div style={{ color: 'var(--emerald-live)', fontWeight: '900', fontSize: '3.5rem', fontFamily: 'JetBrains Mono, monospace' }}>
                ₹{(player.soldPrice / 10000000).toFixed(2)} Cr
              </div>
              <div style={{ fontSize: '1.5rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                ACQUIRED BY: <strong style={{ color: '#ffffff' }}>{player.team?.name || getTeamName(player.teamId)}</strong>
              </div>
            </div>
          ) : player && player.status === 'UNSOLD' ? (
            <div style={{ 
              flex: 1, 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              justifyContent: 'center', 
              borderRadius: '10px', 
              background: 'linear-gradient(145deg, rgba(20, 27, 37, 0.95), rgba(12, 16, 22, 0.98))',
              border: '1px solid var(--crimson-border)',
              padding: '2rem'
            }}>
              <span className="badge badge-unsold" style={{ fontSize: '1rem', padding: '0.5rem 1.5rem', marginBottom: '1.5rem', letterSpacing: '0.15em' }}>
                PASSED UNSOLD
              </span>
              <h1 style={{ color: '#ffffff', fontSize: '3rem', marginBottom: '0.5rem', fontWeight: '800' }}>{player.name}</h1>
              <p style={{ color: 'var(--text-muted)', fontSize: '1.2rem', fontFamily: 'JetBrains Mono, monospace' }}>
                LOT REMAINS IN RE-AUCTION REPOSITORY
              </p>
            </div>
          ) : (
            <div style={{ 
              flex: 1, 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              borderRadius: '10px', 
              border: '1px solid rgba(255, 255, 255, 0.08)',
              background: 'rgba(16, 21, 29, 0.85)',
              color: 'var(--text-muted)',
              fontSize: '1.1rem',
              fontFamily: 'JetBrains Mono, monospace'
            }}>
              WAITING FOR AUCTIONEER TO COMMENCE NEXT LOT...
            </div>
          )}
        </div>

        {/* Off-canvas Stats Drawer Toggle */}
        {!showStatsDrawer && (
          <button
            onClick={() => setShowStatsDrawer(true)}
            style={{
              position: 'fixed',
              top: '50%',
              right: 0,
              transform: 'translateY(-50%)',
              background: 'var(--bg-card)',
              color: 'var(--gold-bright)',
              border: '1px solid var(--gold-border)',
              borderRight: 'none',
              padding: '1.25rem 0.6rem',
              borderTopLeftRadius: '6px',
              borderBottomLeftRadius: '6px',
              cursor: 'pointer',
              zIndex: 999,
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '0.75rem',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              boxShadow: '-5px 0 20px rgba(0,0,0,0.7)'
            }}
          >
            &laquo; STATS
          </button>
        )}

        {/* Off-canvas Stats Drawer */}
        <div style={{
          position: 'fixed',
          top: 0,
          right: showStatsDrawer ? 0 : '-460px',
          width: '440px',
          height: '100vh',
          background: 'rgba(10, 13, 18, 0.98)',
          backdropFilter: 'blur(16px)',
          borderLeft: '1px solid var(--gold-border)',
          transition: 'right 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          zIndex: 1000,
          padding: '2rem',
          overflowY: 'auto',
          boxShadow: '-15px 0 40px rgba(0,0,0,0.8)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '1rem' }}>
            <div>
              <h2 style={{ fontSize: '1.35rem', color: '#ffffff', margin: 0, fontWeight: '800' }}>Venue Telemetry</h2>
              <span style={{ fontSize: '0.75rem', color: 'var(--gold-primary)', fontFamily: 'JetBrains Mono, monospace' }}>
                {loc.name}
              </span>
            </div>
            <button 
              onClick={() => setShowStatsDrawer(false)}
              className="btn btn-secondary"
              style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}
            >
              CLOSE
            </button>
          </div>

          {/* Last Sold Player */}
          <div style={{ marginBottom: '2rem' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--gold-primary)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.75rem', fontFamily: 'JetBrains Mono, monospace' }}>
              MOST RECENT TRANSACTION
            </div>
            {stats.lastSold ? (
              <div style={{ background: 'rgba(20, 27, 37, 0.85)', padding: '1.25rem', borderRadius: '6px', border: '1px solid var(--emerald-border)' }}>
                <div style={{ fontWeight: '700', fontSize: '1.2rem', color: '#ffffff', marginBottom: '0.25rem' }}>{stats.lastSold.name}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{stats.lastSold.team?.name || getTeamName(stats.lastSold.teamId)}</span>
                  <span style={{ color: 'var(--emerald-live)', fontWeight: '800', fontSize: '1.25rem', fontFamily: 'JetBrains Mono, monospace' }}>
                    ₹{(stats.lastSold.soldPrice / 10000000).toFixed(2)} Cr
                  </span>
                </div>
              </div>
            ) : (
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '6px', textAlign: 'center' }}>
                No completed sales in this session.
              </div>
            )}
          </div>

          {/* Top Buys */}
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--gold-primary)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.75rem', fontFamily: 'JetBrains Mono, monospace' }}>
              HIGHEST VALUATION PURCHASES
            </div>
            {stats.topBuys && stats.topBuys.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {stats.topBuys.map((buy, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(16, 21, 29, 0.7)', padding: '0.85rem 1rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.04)' }}>
                    <div>
                      <div style={{ fontWeight: '700', fontSize: '0.95rem', color: '#ffffff' }}>{buy.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{buy.team?.name || getTeamName(buy.teamId)}</div>
                    </div>
                    <div style={{ color: 'var(--gold-bright)', fontWeight: '800', fontSize: '1rem', fontFamily: 'JetBrains Mono, monospace' }}>
                      ₹{(buy.soldPrice / 10000000).toFixed(2)} Cr
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '6px', textAlign: 'center' }}>
                No recorded acquisitions.
              </div>
            )}
          </div>
        </div>

      </div>
    );
  };

  const renderSidebar = () => {
    return (
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        height: 'calc(100vh - 110px)', 
        background: 'rgba(10, 13, 18, 0.85)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '8px',
        padding: '1.25rem',
        overflow: 'hidden'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: '800', color: '#ffffff', letterSpacing: '0.04em' }}>LIVE FEED</h3>
            <span style={{ fontSize: '0.7rem', color: 'var(--gold-primary)', fontFamily: 'JetBrains Mono, monospace' }}>STREAM TELEMETRY</span>
          </div>
          <span className="live-pulse-dot"></span>
        </div>
        
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          {activityFeed.length === 0 ? (
            <div style={{ color: 'var(--text-dim)', fontSize: '0.8rem', fontStyle: 'italic', textAlign: 'center', marginTop: '2rem', fontFamily: 'JetBrains Mono, monospace' }}>
              LISTENING FOR LIVE ACTIONS...
            </div>
          ) : (
            activityFeed.map((activity, idx) => (
              <div key={idx} style={{ 
                background: 'rgba(16, 21, 29, 0.85)', 
                padding: '0.75rem', 
                borderRadius: '4px', 
                borderLeft: activity.type === 'BID' 
                  ? '3px solid var(--gold-primary)' 
                  : activity.type === 'SOLD' 
                    ? '3px solid var(--emerald-live)' 
                    : '3px solid var(--crimson-danger)',
                borderTop: '1px solid rgba(255,255,255,0.03)',
                borderRight: '1px solid rgba(255,255,255,0.03)',
                borderBottom: '1px solid rgba(255,255,255,0.03)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem', fontSize: '0.7rem', color: 'var(--text-dim)', fontFamily: 'JetBrains Mono, monospace' }}>
                  <span>{new Date(activity.timestamp).toLocaleTimeString()}</span>
                  <span>{locations.find(l => l.id === activity.locationId)?.name}</span>
                </div>
                {activity.type === 'BID' && (
                  <div style={{ fontSize: '0.85rem' }}>
                    <strong style={{ color: '#ffffff' }}>{getTeamName(activity.teamId)}</strong> bid <span style={{ color: 'var(--gold-bright)', fontWeight: '700', fontFamily: 'JetBrains Mono, monospace' }}>₹{(activity.amount / 10000000).toFixed(2)} Cr</span>
                  </div>
                )}
                {activity.type === 'SOLD' && (
                  <div style={{ fontSize: '0.85rem' }}>
                    <strong style={{ color: '#ffffff' }}>{activity.player?.name}</strong> SOLD to <strong style={{ color: 'var(--emerald-live)' }}>{getTeamName(activity.teamId)}</strong> for ₹{(activity.amount / 10000000).toFixed(2)} Cr
                  </div>
                )}
                {activity.type === 'UNSOLD' && (
                  <div style={{ fontSize: '0.85rem' }}>
                    <strong style={{ color: '#ffffff' }}>{activity.player?.name}</strong> went <span style={{ color: 'var(--crimson-danger)', fontWeight: '700' }}>UNSOLD</span>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    );
  };

  const isCinematic = selectedLocationId && livePlayers[selectedLocationId] && ['LIVE', 'SOLD', 'UNSOLD'].includes(livePlayers[selectedLocationId].status);

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.log(`Fullscreen error: ${err.message}`);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  return (
    <div style={{ position: 'relative' }}>
      {/* Floating Header Controls */}
      <div style={{ position: 'absolute', top: '-0.5rem', right: '0.5rem', display: 'flex', gap: '0.75rem', zIndex: 1000 }}>
        {selectedLocationId && (
          <button 
            onClick={() => setSelectedLocationId(null)}
            className="btn btn-secondary"
            style={{ padding: '0.4rem 0.85rem', fontSize: '0.75rem' }}
          >
            &larr; Multiview
          </button>
        )}
        <button 
          onClick={toggleFullScreen}
          className="btn btn-secondary"
          style={{ padding: '0.4rem 0.85rem', fontSize: '0.75rem' }}
        >
          Fullscreen
        </button>
        <button 
          onClick={() => window.location.href = '/'}
          className="btn btn-secondary"
          style={{ padding: '0.4rem 0.85rem', fontSize: '0.75rem' }}
        >
          Overview
        </button>
      </div>

      <div style={{ 
        display: isCinematic ? 'block' : 'grid', 
        gridTemplateColumns: isCinematic ? '1fr' : '300px 1fr', 
        gap: '1.5rem',
        marginTop: '2.5rem'
      }}>
        {!isCinematic && renderSidebar()}
        {selectedLocationId ? renderDetailedView() : renderGlobalView()}
      </div>

      {/* Pool Transition Notification */}
      {poolAnimation && isCinematic && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(6, 8, 11, 0.95)',
          backdropFilter: 'blur(16px)',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <span style={{ fontSize: '1rem', color: 'var(--gold-primary)', letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: '0.75rem', fontFamily: 'JetBrains Mono, monospace' }}>
            LOT CATEGORY TRANSITION
          </span>
          <h1 style={{ fontSize: '5rem', color: '#ffffff', fontWeight: '900', textTransform: 'uppercase', margin: 0, letterSpacing: '-0.02em' }}>
            {poolAnimation}
          </h1>
          <div style={{ width: '120px', height: '3px', background: 'var(--gold-primary)', marginTop: '1.5rem' }}></div>
        </div>
      )}
    </div>
  );
}
