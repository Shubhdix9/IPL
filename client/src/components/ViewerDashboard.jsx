import { useEffect, useState, useRef } from 'react';
import socket from '../socket';
import playerImageMap from '../playerImageMap.json';

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
  const currentPoolsRef = useRef({});
  const lastAudioPlayRef = useRef(0);

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
      oscillator.frequency.value = 800;
      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
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
      if (now - lastAudioPlayRef.current < 3000) return; // Prevent double-playing within 3 seconds
      lastAudioPlayRef.current = now;

      const audio = new Audio('/transition.mp3');
      audio.volume = 0.8;
      audio.play().catch(e => console.log('Audio autoplay blocked', e));
    } catch (e) {
      console.log('Audio play error', e);
    }
  };

  useEffect(() => {
    fetch(import.meta.env.VITE_API_URL + '/api/teams')
      .then(res => res.json())
      .then(data => setTeams(data))
      .catch(console.error);

    fetch(import.meta.env.VITE_API_URL + '/api/locations')
      .then(res => res.json())
      .then(fetchedLocs => {
        setLocations(fetchedLocs);

        fetchedLocs.forEach(loc => {
          socket.emit('joinLocation', loc.id);

          // Fetch historical players for venue stats
          fetch(`${import.meta.env.VITE_API_URL}/api/locations/${loc.id}/players`)
            .then(res => res.json())
            .then(data => {
              const soldPlayers = data.filter(p => p.status === 'SOLD');
              const lastSold = soldPlayers.length > 0 ? soldPlayers[soldPlayers.length - 1] : null;
              const topBuys = [...soldPlayers].sort((a, b) => b.soldPrice - a.soldPrice).slice(0, 3);
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
    });

    socket.on('newBid', (bidInfo) => {
      // Parse teamId to number to fix 'Unknown Team' issue on reverse, as reverse passes a string
      const parsedTeamId = bidInfo.teamId ? parseInt(bidInfo.teamId) : null;
      
      if (!parsedTeamId) {
        // If there's no team, the bid was reversed all the way back to the start.
        // We should clear the active bid so it goes back to 'Waiting for bids...'
        setCurrentBids(prev => {
          const next = { ...prev };
          delete next[bidInfo.locationId];
          return next;
        });
        
        addActivity({
          type: 'BID_REVERSED',
          timestamp: Date.now(),
          locationId: bidInfo.locationId,
          amount: bidInfo.amount
        });
      } else {
        const updatedBidInfo = { ...bidInfo, teamId: parsedTeamId };
        setCurrentBids(prev => ({ ...prev, [bidInfo.locationId]: updatedBidInfo }));
        
        addActivity({
          type: 'BID',
          timestamp: Date.now(),
          locationId: bidInfo.locationId,
          teamId: parsedTeamId,
          amount: bidInfo.amount
        });
      }
      playBeep();
    });

    const updateVenueStats = (player) => {
      setVenueStats(prev => {
        const currentStats = prev[player.locationId] || { topBuys: [] };
        
        // Remove the newly sold player if they were somehow already in topBuys
        const filteredBuys = currentStats.topBuys.filter(p => p.id !== player.id);
        const newTopBuys = [...filteredBuys, player].sort((a, b) => b.soldPrice - a.soldPrice).slice(0, 3);
        const newTotalSpent = (currentStats.totalSpent || 0) + (player.soldPrice || 0);
        const newPlayersSold = (currentStats.playersSold || 0) + 1;
        
        return {
          ...prev,
          [player.locationId]: {
            lastSold: player,
            topBuys: newTopBuys,
            totalSpent: newTotalSpent,
            playersSold: newPlayersSold
          }
        };
      });
    };

    socket.on('playerSold', (player) => {
      const audio = document.getElementById('gavelSound');
      if (audio) {
        audio.currentTime = 0;
        audio.play().catch(e => console.log('Audio error:', e));
      }
      setLivePlayers(prev => ({ ...prev, [player.locationId]: player }));
      setCurrentBids(prev => {
        const next = { ...prev };
        delete next[player.locationId];
        return next;
      });
      updateVenueStats(player);
      addActivity({
        type: 'SOLD',
        timestamp: Date.now(),
        locationId: player.locationId,
        teamId: player.teamId || player.team?.id,
        amount: player.soldPrice,
        player: player
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
        timestamp: Date.now(),
        locationId: player.locationId,
        player: player
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
          setTimeout(() => setPoolAnimation(null), 4000);
          currentPoolsRef.current[selectedLocationId] = currentPlayer.pool;
        }
      }
    }
  }, [livePlayers, selectedLocationId]);

  const getTeamName = (teamId) => {
    const team = teams.find(t => t.id === teamId);
    return team ? team.name : 'Unknown Team';
  };

  const renderGlobalView = () => (
    <div className="dashboard-main glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
      <audio id="gavelSound" src="/gavel.mp3" />
      <h2 style={{ paddingLeft: '0.5rem', marginBottom: '2rem' }}>Global Auction View</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '2rem' }}>
        {locations.map(loc => {
          const livePlayer = livePlayers[loc.id];
          const isLive = livePlayer && livePlayer.status === 'LIVE';
          const stats = venueStats[loc.id] || { totalSpent: 0, playersSold: 0 };
          const activeBid = currentBids[loc.id];
          const isBreak = breakModes[loc.id];
          
          return (
            <div 
              key={loc.id} 
              className="card glass-panel location-card" 
              style={{ 
                cursor: 'pointer', 
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                padding: '2rem',
                border: isLive ? '1px solid rgba(59, 130, 246, 0.5)' : '1px solid var(--glass-border)',
                background: isLive ? 'linear-gradient(145deg, rgba(30, 41, 59, 0.7), rgba(15, 23, 42, 0.9))' : 'rgba(15, 23, 42, 0.5)',
                position: 'relative',
                overflow: 'hidden'
              }}
              onClick={() => setSelectedLocationId(loc.id)}
              onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-5px)'; if (!isLive) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; }}
              onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; if (!isLive) e.currentTarget.style.borderColor = 'var(--glass-border)'; }}
            >
              {isBreak && (
                <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.85)', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '12px' }}>
                  <h2 style={{ color: 'var(--warning)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '2rem' }}>
                    ☕ ON BREAK
                  </h2>
                </div>
              )}
              {isLive && (
                <div style={{ position: 'absolute', top: 0, right: 0, width: '150px', height: '150px', background: 'radial-gradient(circle, rgba(59,130,246,0.2) 0%, transparent 70%)', transform: 'translate(30%, -30%)' }}></div>
              )}
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
                <h2 style={{ fontSize: '1.8rem', margin: 0 }}>{loc.name}</h2>
                {isLive ? (
                  <span style={{ 
                    background: 'rgba(239, 68, 68, 0.1)', 
                    color: '#ef4444', 
                    padding: '0.4rem 1rem', 
                    borderRadius: '20px', 
                    fontWeight: 'bold', 
                    fontSize: '0.9rem',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    animation: 'pulse 2s infinite'
                  }}>
                    <span style={{ width: '8px', height: '8px', background: '#ef4444', borderRadius: '50%' }}></span>
                    LIVE NOW
                  </span>
                ) : (
                  <span style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)', padding: '0.4rem 1rem', borderRadius: '20px', fontSize: '0.9rem' }}>
                    Idle
                  </span>
                )}
              </div>

              {isLive ? (
                <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'linear-gradient(to bottom, rgba(59,130,246,0.2), rgba(0,0,0,0.3))', overflow: 'hidden', flexShrink: 0, display: 'flex', justifyContent: 'center', alignItems: 'flex-end', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <img src={playerImageMap[livePlayer.name.toLowerCase().replace(/[^a-z]/g, '')] || `/players/${livePlayer.name.toLowerCase().replace(/ /g, '_')}.png`} alt={livePlayer.name} style={{ height: '90%', width: 'auto', objectFit: 'contain' }} onError={(e) => { e.target.style.display = 'none'; }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 'bold', fontSize: '1.2rem', color: 'white', marginBottom: '0.2rem' }}>{livePlayer.name}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Base: ₹{livePlayer.basePrice / 10000000} Cr</div>
                  </div>
                  {activeBid && (
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.8rem', color: '#4ade80', textTransform: 'uppercase', letterSpacing: '1px' }}>Highest</div>
                      <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: 'white' }}>₹{activeBid.amount / 10000000} Cr</div>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '1.5rem', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px dashed rgba(255,255,255,0.1)' }}>
                  <div style={{ textAlign: 'center', flex: 1 }}>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.5rem' }}>Players Sold</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'white' }}>{stats.playersSold || 0}</div>
                  </div>
                  <div style={{ width: '1px', background: 'rgba(255,255,255,0.1)' }}></div>
                  <div style={{ textAlign: 'center', flex: 1 }}>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.5rem' }}>Total Spent</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'white' }}>₹{((stats.totalSpent || 0) / 10000000).toFixed(2)} Cr</div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <style>{`
        @keyframes pulse {
          0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
          70% { box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); }
          100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
        }
      `}</style>
    </div>
  );

  const renderDetailedView = () => {
    const loc = locations.find(l => l.id === selectedLocationId);
    if (!loc) return null;

    const player = livePlayers[loc.id];
    const activeBid = currentBids[loc.id];
    const stats = venueStats[loc.id] || { lastSold: null, topBuys: [] };

    return (
      <div className="dashboard-main glass-panel" style={{ padding: isCinematic ? '0' : '1.5rem', height: isCinematic ? 'calc(100vh - 100px)' : 'calc(100vh - 120px)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        
        {!isCinematic && (
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h2 style={{ margin: 0 }}>{loc.name} Venue Details</h2>
          </div>
        )}

        <div className={isCinematic ? "" : "card glass-panel"} style={{ display: isCinematic ? 'flex' : 'grid', gridTemplateColumns: '1fr', gap: isCinematic ? '0' : '2rem', padding: isCinematic ? '0' : '2rem', flex: 1, overflow: 'hidden', position: 'relative' }}>
          
          {breakModes[loc.id] && (
            <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.9)', zIndex: 100, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ fontSize: '10rem', marginBottom: '2rem' }}>☕</div>
              <h1 style={{ fontSize: '4rem', color: 'var(--warning)', letterSpacing: '2px', textAlign: 'center' }}>AUCTION IS ON A BREAK</h1>
              <p style={{ color: 'var(--text-muted)', fontSize: '1.5rem', marginTop: '1rem' }}>We will resume shortly.</p>
            </div>
          )}

          {/* 1. Live Auction Cinematic View */}
          <div style={{ flex: 1, display: 'flex' }}>
            {player && player.status === 'LIVE' ? (
              <div className="cinematic-bg" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '3rem', margin: '0' }}>
                <div className="bracket-tl"></div>
                <div className="bracket-br"></div>
                
                {/* Text Content */}
                <div style={{ zIndex: 20, width: '65%', display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '100%', paddingLeft: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                    <div style={{ width: '6px', height: '24px', background: 'var(--primary)', borderRadius: '4px' }}></div>
                    <p style={{ color: 'var(--text-muted)', fontSize: '1.2rem', margin: 0, letterSpacing: '4px', fontWeight: '600', textTransform: 'uppercase' }}>Player Profile</p>
                  </div>
                  
                  <div style={{ 
                    fontSize: player.name.length > 16 ? '3.5rem' : player.name.length > 12 ? '4.5rem' : '5.5rem', 
                    lineHeight: '1.1', 
                    textTransform: 'uppercase', 
                    marginBottom: '2rem', 
                    wordWrap: 'break-word',
                    paddingRight: '2rem',
                    fontWeight: '900',
                    color: 'white',
                    textShadow: '2px 4px 15px rgba(0,0,0,0.6)'
                  }}>
                    {player.name}
                  </div>
                  
                  {/* Badges Row */}
                  <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '3rem' }}>
                    {/* Rating Badge */}
                    <div style={{ display: 'flex', alignItems: 'center', background: 'linear-gradient(135deg, rgba(255,255,255,0.05), rgba(0,0,0,0.4))', padding: '0.6rem 1.5rem', borderRadius: '30px', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 4px 15px rgba(0,0,0,0.2)' }}>
                      <span style={{ fontSize: '1.1rem', color: 'var(--text-muted)', marginRight: '0.8rem', letterSpacing: '1px' }}>RATING</span>
                      <span style={{ fontSize: '1.8rem', fontWeight: '900', color: 'white' }}>{player.points || 100}</span>
                    </div>

                    {/* Country Badge */}
                    <div style={{ display: 'flex', alignItems: 'center', background: 'linear-gradient(135deg, rgba(255,255,255,0.05), rgba(0,0,0,0.4))', padding: '0.6rem 1.5rem', borderRadius: '30px', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 4px 15px rgba(0,0,0,0.2)' }}>
                      <span style={{ fontSize: '1.1rem', color: 'var(--text-muted)', marginRight: '0.8rem', letterSpacing: '1px' }}>NATION</span>
                      <span style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'white', letterSpacing: '2px' }}>{player.country || 'INDIA'}</span>
                    </div>
                    
                    {/* Category Badge */}
                    <div style={{ display: 'flex', alignItems: 'center', background: 'linear-gradient(135deg, rgba(59,130,246,0.15), rgba(0,0,0,0.4))', padding: '0.6rem 1.5rem', borderRadius: '30px', border: '1px solid rgba(59,130,246,0.3)', boxShadow: '0 4px 15px rgba(0,0,0,0.2)' }}>
                      <span style={{ fontSize: '1.3rem', fontWeight: 'bold', color: '#93c5fd', letterSpacing: '1px' }}>
                        {(player.country && (player.country.toUpperCase() === 'IND' || player.country.toUpperCase() === 'INDIA')) ? 'INDIAN ' : 'OVERSEAS '}
                        {player.category.replace('_', ' ')}
                      </span>
                    </div>
                  </div>

                  {/* Stats Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem', maxWidth: '85%' }}>
                    <div>
                      <div style={{ fontSize: '1rem', color: 'var(--text-muted)', letterSpacing: '2px', marginBottom: '0.5rem', textTransform: 'uppercase', fontWeight: '600' }}>IPL Debut</div>
                      <div style={{ fontSize: '2.2rem', fontWeight: 'bold', color: 'white' }}>{player.debutYear || 'N/A'}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '1rem', color: 'var(--text-muted)', letterSpacing: '2px', marginBottom: '0.5rem', textTransform: 'uppercase', fontWeight: '600' }}>Base Price</div>
                      <div style={{ fontSize: '3rem', fontWeight: '900', color: '#ef4444', textShadow: '0 0 20px rgba(239, 68, 68, 0.4)', lineHeight: '1' }}>₹{player.basePrice / 10000000} CR</div>
                    </div>
                  </div>
                  
                  {/* Current Bid Overlay */}
                  <div style={{ 
                    marginTop: 'auto', 
                    background: activeBid ? 'linear-gradient(135deg, rgba(34,197,94,0.15), rgba(0,0,0,0.7))' : 'rgba(0,0,0,0.4)', 
                    padding: '1.5rem 2.5rem', 
                    borderRadius: '16px', 
                    display: 'inline-flex', 
                    flexDirection: 'column',
                    border: activeBid ? '1px solid rgba(34,197,94,0.4)' : '1px solid rgba(255,255,255,0.1)', 
                    alignSelf: 'flex-start',
                    boxShadow: activeBid ? '0 0 40px rgba(34,197,94,0.15)' : 'none',
                    backdropFilter: 'blur(10px)',
                    transition: 'all 0.3s ease'
                  }}>
                    <h3 style={{ color: activeBid ? '#4ade80' : 'var(--text-muted)', marginBottom: '0.8rem', fontSize: '1.1rem', letterSpacing: '2px', textTransform: 'uppercase' }}>
                      {activeBid ? '🔥 Current Highest Bid' : 'Current Bid'}
                    </h3>
                    {activeBid ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                        <span style={{ fontSize: '3.5rem', color: 'white', fontWeight: '900', textShadow: '0 2px 10px rgba(0,0,0,0.5)', lineHeight: '1' }}>₹{activeBid.amount / 10000000} Cr</span>
                        <span style={{ background: 'rgba(255,255,255,0.1)', padding: '0.5rem 1.2rem', borderRadius: '8px', color: 'white', fontSize: '1.4rem', fontWeight: 'bold', border: '1px solid rgba(255,255,255,0.05)' }}>{getTeamName(activeBid.teamId)}</span>
                      </div>
                    ) : (
                      <span style={{ fontSize: '1.6rem', color: 'white', fontStyle: 'italic', opacity: 0.5 }}>Waiting for opening bid...</span>
                    )}
                  </div>
                </div>

                {/* Player Photo */}
                <img 
                  src={playerImageMap[player.name.toLowerCase().replace(/[^a-z]/g, '')] || `/players/${player.name.toLowerCase().replace(/ /g, '_')}.png`} 
                  alt={player.name} 
                  className="player-photo-lg"
                  style={{ height: '95%' }}
                  onError={(e) => {
                    e.target.onerror = null; 
                    e.target.src = 'https://www.transparenttextures.com/patterns/stardust.png';
                    e.target.style.opacity = 0.2;
                  }}
                />
              </div>
            ) : player && player.status === 'SOLD' ? (
              <div style={{ background: 'var(--bg-darker)', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderRadius: '12px', textAlign: 'center', border: '2px solid var(--success)' }}>
                <h1 style={{ color: 'var(--text-main)', fontSize: '3rem', marginBottom: '1rem' }}>{player.name}</h1>
                <span style={{ color: 'var(--success)', fontWeight: 'bold', fontSize: '4rem', display: 'block' }}>SOLD for ₹{player.soldPrice / 10000000} Cr</span>
                <span style={{ fontSize: '2.5rem', color: 'var(--text-muted)' }}>to {player.team?.name || getTeamName(player.teamId)}</span>
              </div>
            ) : player && player.status === 'UNSOLD' ? (
              <div style={{ background: 'var(--bg-darker)', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderRadius: '12px', textAlign: 'center', border: '2px solid var(--danger)' }}>
                <h1 style={{ color: 'var(--text-main)', fontSize: '3rem', marginBottom: '1rem' }}>{player.name}</h1>
                <span style={{ color: 'var(--danger)', fontWeight: 'bold', fontSize: '4rem', display: 'block' }}>UNSOLD</span>
              </div>
            ) : (
              <div style={{ background: 'rgba(255,255,255,0.05)', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '12px', color: 'var(--text-muted)', textAlign: 'center', fontSize: '1.5rem' }}>
                No active bidding at the moment. Waiting for auctioneer to bring a player to the lot...
              </div>
            )}
          </div>

          {/* Toggle Stats Arrow Button */}
          {!showStatsDrawer && (
            <button
              onClick={() => setShowStatsDrawer(true)}
              style={{
                position: 'fixed',
                top: '50%',
                right: 0,
                transform: 'translateY(-50%)',
                background: 'var(--bg-darker)',
                color: 'var(--text-main)',
                border: '1px solid var(--glass-border)',
                borderRight: 'none',
                padding: '1.5rem 0.5rem',
                borderTopLeftRadius: '8px',
                borderBottomLeftRadius: '8px',
                cursor: 'pointer',
                zIndex: 999,
                boxShadow: '-5px 0 15px rgba(0,0,0,0.5)'
              }}
            >
              ◀ STATS
            </button>
          )}

          {/* Off-canvas Stats Drawer */}
          <div style={{
            position: 'fixed',
            top: 0,
            right: showStatsDrawer ? 0 : '-450px',
            width: '450px',
            height: '100vh',
            background: 'rgba(15, 23, 42, 0.98)',
            backdropFilter: 'blur(16px)',
            borderLeft: '1px solid var(--glass-border)',
            transition: 'right 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            zIndex: 1000,
            padding: '2rem',
            overflowY: 'auto',
            boxShadow: '-10px 0 30px rgba(0,0,0,0.8)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '1rem' }}>
              <h2 style={{ margin: 0 }}>Venue Stats</h2>
              <button 
                onClick={() => setShowStatsDrawer(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '1.5rem', cursor: 'pointer' }}
              >
                ✖
              </button>
            </div>

            {/* 2. Last Sold Player */}
            <div style={{ marginBottom: '2.5rem' }}>
              <h4 style={{ color: 'var(--text-muted)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', textTransform: 'uppercase', letterSpacing: '1px' }}>🔨 Last Player Sold</h4>
              {stats.lastSold ? (
                <div style={{ background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.15), rgba(0,0,0,0.3))', padding: '1.5rem', borderRadius: '12px', border: '1px solid rgba(34, 197, 94, 0.3)', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: '40%', background: `url(/players/${stats.lastSold.name.toLowerCase().replace(/ /g, '_')}.png)`, backgroundSize: 'cover', backgroundPosition: 'center top', opacity: 0.3, maskImage: 'linear-gradient(to left, rgba(0,0,0,1), rgba(0,0,0,0))' }}></div>
                  <div style={{ position: 'relative', zIndex: 2 }}>
                    <div style={{ fontWeight: 'bold', fontSize: '1.6rem', marginBottom: '0.5rem', color: 'white', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>{stats.lastSold.name}</div>
                    <div style={{ fontSize: '1.1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>{stats.lastSold.team?.name || getTeamName(stats.lastSold.teamId)}</span>
                      <span style={{ color: '#4ade80', fontWeight: 'bold', fontSize: '1.4rem' }}>₹{stats.lastSold.soldPrice / 10000000} Cr</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: '1.1rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.02)', padding: '1.5rem', borderRadius: '12px', textAlign: 'center', border: '1px dashed rgba(255,255,255,0.1)' }}>No players sold yet.</div>
              )}
            </div>

            {/* 3. Top Buyers */}
            <div>
              <h4 style={{ color: 'var(--text-muted)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', textTransform: 'uppercase', letterSpacing: '1px' }}>🏆 Top Venue Purchases</h4>
              {stats.topBuys.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {stats.topBuys.map((buy, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', transition: 'all 0.2s ease', cursor: 'default' }} onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }} onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}>
                      <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'linear-gradient(to bottom, rgba(59,130,246,0.2), rgba(0,0,0,0.3))', overflow: 'hidden', marginRight: '1rem', flexShrink: 0, display: 'flex', justifyContent: 'center', alignItems: 'flex-end', border: '1px solid rgba(255,255,255,0.1)' }}>
                        <img src={playerImageMap[buy.name.toLowerCase().replace(/[^a-z]/g, '')] || `/players/${buy.name.toLowerCase().replace(/ /g, '_')}.png`} alt={buy.name} style={{ height: '90%', width: 'auto', objectFit: 'contain' }} onError={(e) => { e.target.style.display = 'none'; }} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 'bold', fontSize: '1.1rem', color: 'white', marginBottom: '0.2rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '180px' }}>{buy.name}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{buy.team?.name || getTeamName(buy.teamId)}</div>
                      </div>
                      <div style={{ color: 'var(--accent)', fontWeight: 'bold', fontSize: '1.2rem' }}>₹{buy.soldPrice / 10000000} Cr</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: '1.1rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.02)', padding: '1.5rem', borderRadius: '12px', textAlign: 'center', border: '1px dashed rgba(255,255,255,0.1)' }}>No purchases recorded.</div>
              )}
            </div>
          </div>

        </div>
      </div>
    );
  };

  const renderSidebar = () => {
    return (
      <div className="dashboard-sidebar glass-panel" style={{ display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 4rem)', overflow: 'hidden' }}>
        <h2 style={{ marginBottom: '0.5rem' }}>Live Feed</h2>
        <p className="text-muted" style={{ marginBottom: '1.5rem', fontSize: '0.9rem' }}>Real-time auction activity...</p>
        
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem', paddingRight: '0.5rem' }} className="custom-scrollbar">
          {activityFeed.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontStyle: 'italic', textAlign: 'center', marginTop: '2rem' }}>Waiting for activity...</div>
          ) : (
            activityFeed.map((activity, idx) => (
              <div key={idx} style={{ 
                background: 'rgba(255,255,255,0.03)', 
                padding: '1rem', 
                borderRadius: '8px', 
                borderLeft: activity.type === 'BID' ? '4px solid #3b82f6' : activity.type === 'SOLD' ? '4px solid #22c55e' : '4px solid #ef4444',
                animation: 'slideInRight 0.3s ease-out'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  <span>{new Date(activity.timestamp).toLocaleTimeString()}</span>
                  <span>{locations.find(l => l.id === activity.locationId)?.name}</span>
                </div>
                {activity.type === 'BID' && (
                  <div><strong style={{ color: 'white' }}>{getTeamName(activity.teamId)}</strong> bid <span style={{ color: '#60a5fa', fontWeight: 'bold' }}>₹{activity.amount / 10000000} Cr</span></div>
                )}
                {activity.type === 'BID_REVERSED' && (
                  <div>Bid reversed to <span style={{ color: '#ef4444', fontWeight: 'bold' }}>₹{activity.amount / 10000000} Cr</span></div>
                )}
                {activity.type === 'SOLD' && (
                  <div><strong style={{ color: 'white' }}>{activity.player?.name}</strong> SOLD to <strong style={{ color: '#4ade80' }}>{getTeamName(activity.teamId)}</strong> for ₹{activity.amount / 10000000} Cr</div>
                )}
                {activity.type === 'UNSOLD' && (
                  <div><strong style={{ color: 'white' }}>{activity.player?.name}</strong> went <span style={{ color: '#ef4444', fontWeight: 'bold' }}>UNSOLD</span></div>
                )}
              </div>
            ))
          )}
        </div>
        
        <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--glass-border)', paddingTop: '1rem' }}>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>* Note: Sound will play on new bids if you have interacted with the page.</p>
        </div>
        <style>{`
          @keyframes slideInRight {
            from { transform: translateX(20px); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
          }
          .custom-scrollbar::-webkit-scrollbar { width: 6px; }
          .custom-scrollbar::-webkit-scrollbar-track { background: rgba(0,0,0,0.1); }
          .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
        `}</style>
      </div>
    );
  };

  const isCinematic = selectedLocationId && livePlayers[selectedLocationId] && ['LIVE', 'SOLD', 'UNSOLD'].includes(livePlayers[selectedLocationId].status);

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.log(`Error attempting to enable full-screen mode: ${err.message}`);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  return (
    <div className={isCinematic ? "" : "dashboard-grid"} style={{ position: 'relative' }}>
      {/* Floating Header Controls */}
      <div style={{ position: 'absolute', top: '1rem', right: '2rem', display: 'flex', gap: '1rem', zIndex: 1000 }}>
        {selectedLocationId && (
          <button 
            onClick={() => setSelectedLocationId(null)}
            style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid var(--glass-border)', color: 'white', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer', backdropFilter: 'blur(5px)' }}
          >
            ⬅️ Back
          </button>
        )}
        <button 
          onClick={toggleFullScreen}
          style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid var(--glass-border)', color: 'white', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer', backdropFilter: 'blur(5px)' }}
        >
          ⛶ Fullscreen
        </button>
        <button 
          onClick={() => window.location.href = '/'}
          style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid var(--glass-border)', color: 'white', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer', backdropFilter: 'blur(5px)' }}
        >
          🏠 Home
        </button>
      </div>

      {!isCinematic && renderSidebar()}
      {selectedLocationId ? renderDetailedView() : renderGlobalView()}

      {/* Pool Transition Animation Overlay */}
      {poolAnimation && isCinematic && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.95)',
          backdropFilter: 'blur(20px)',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          animation: 'fadeInOut 4s forwards',
        }}>
          <h2 style={{ fontSize: '2.5rem', color: 'var(--text-muted)', letterSpacing: '8px', textTransform: 'uppercase', marginBottom: '1rem', animation: 'slideDown 0.5s ease-out' }}>
            Up Next
          </h2>
          <h1 style={{ fontSize: '7rem', color: 'white', fontWeight: '900', textShadow: '0 0 40px rgba(59, 130, 246, 0.6)', textAlign: 'center', textTransform: 'uppercase', animation: 'zoomIn 0.5s ease-out 0.2s both', margin: 0 }}>
            {poolAnimation}
          </h1>
          <div style={{ width: '150px', height: '6px', background: 'var(--accent)', marginTop: '2.5rem', borderRadius: '3px', animation: 'expandWidth 1s ease-out 0.5s both', boxShadow: '0 0 20px rgba(59, 130, 246, 0.8)' }}></div>
          
          <style>{`
            @keyframes fadeInOut {
              0% { opacity: 0; }
              10% { opacity: 1; }
              85% { opacity: 1; }
              100% { opacity: 0; pointer-events: none; }
            }
            @keyframes slideDown {
              from { transform: translateY(-40px); opacity: 0; }
              to { transform: translateY(0); opacity: 1; }
            }
            @keyframes zoomIn {
              from { transform: scale(0.7); opacity: 0; }
              to { transform: scale(1); opacity: 1; }
            }
            @keyframes expandWidth {
              from { width: 0; opacity: 0; }
              to { width: 150px; opacity: 1; }
            }
          `}</style>
        </div>
      )}
      <audio id="gavelSound" src="https://www.soundjay.com/misc/sounds/gavel-banging-1.mp3" preload="auto"></audio>
    </div>
  );
}
