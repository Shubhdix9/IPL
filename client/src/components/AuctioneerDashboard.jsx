import { useEffect, useState } from 'react';
import socket from '../socket';
import { useAuth } from '../AuthContext';

export default function AuctioneerDashboard({ locationIdOverride }) {
  const { user } = useAuth();
  const [locations, setLocations] = useState([]);
  const [adminSelectedLocation, setAdminSelectedLocation] = useState(null);
  const selectedLocation = locationIdOverride || adminSelectedLocation || user?.locationId || (locations[0]?.id || null);

  const [players, setPlayers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [livePlayer, setLivePlayer] = useState(null);
  const [currentBid, setCurrentBid] = useState('');
  const [biddingTeam, setBiddingTeam] = useState('');
  const [bidHistory, setBidHistory] = useState([]);
  const [poolFilter, setPoolFilter] = useState('ALL');
  const [lastSoldPlayer, setLastSoldPlayer] = useState(null);
  const [isBreakMode, setIsBreakMode] = useState(false);

  const getNextBidAmount = (current) => {
    if (current < 5000000) return current + 500000;
    if (current < 10000000) return current + 1000000;
    if (current < 50000000) return current + 5000000;
    if (current < 100000000) return current + 10000000;
    return current + 20000000;
  };

  const fetchTeams = () => {
    fetch((import.meta.env.VITE_API_URL || 'http://localhost:3001') + '/api/teams')
      .then(res => res.json())
      .then(data => {
        if (selectedLocation) {
          setTeams(data.filter(t => String(t.locationId) === String(selectedLocation)));
        } else {
          setTeams(data);
        }
      })
      .catch(console.error);
  };

  useEffect(() => {
    fetch((import.meta.env.VITE_API_URL || 'http://localhost:3001') + '/api/locations')
      .then(res => res.json())
      .then(data => {
        setLocations(data);
        if (!adminSelectedLocation && data.length > 0) {
          setAdminSelectedLocation(data[0].id);
        }
      })
      .catch(console.error);
    fetchTeams();
  }, []);

  const advanceNextPlayer = async () => {
    if (!selectedLocation) return;
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/auction/set-live`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locationId: selectedLocation })
      });
      const data = await res.json();
      if (data && data.id) {
        setLivePlayer(data);
        setCurrentBid(data.basePrice);
        setBiddingTeam('');
        setBidHistory([]);
        setPlayers(prev => prev.filter(p => p.id !== data.id));
      } else if (data.error) {
        alert(data.error);
      }
    } catch (err) {
      console.error('Failed to advance next player:', err);
    }
  };

  useEffect(() => {
    if (selectedLocation) {
      socket.emit('joinLocation', selectedLocation);
      fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/locations/${selectedLocation}/players`)
        .then(res => res.json())
        .then(data => setPlayers(data.filter(p => p.status === 'UPCOMING')))
        .catch(console.error);

      socket.on('playerSold', (player) => {
        setLastSoldPlayer(player);
        fetchTeams(); 
      });

      socket.on('penaltyIssued', (data) => {
        setTeams(prevTeams => prevTeams.map(t => 
          t.id === data.teamId 
            ? { ...t, mistakes: data.mistakes, isDisqualified: data.isDisqualified } 
            : t
        ));
      });

      socket.on('playerReopened', (player) => {
        setLivePlayer(prev => prev && prev.id === player.id ? { ...player, status: 'LIVE' } : prev);
        setBidHistory([]);
        setCurrentBid(player.basePrice);
        setBiddingTeam('');
        fetchTeams(); // Fetch teams to refresh budgets
      });

      return () => {
        socket.off('playerSold');
        socket.off('penaltyIssued');
        socket.off('playerReopened');
      }
    }
  }, [selectedLocation]);

  const bringToLot = (player) => {
    setLivePlayer({ ...player, status: 'LIVE' });
    setCurrentBid(player.basePrice);
    setBiddingTeam('');
    setBidHistory([]);
    socket.emit('setLivePlayer', { locationId: selectedLocation, playerId: player.id });
  };

  const [animateBid, setAnimateBid] = useState(false);
  const [leaderboardActive, setLeaderboardActive] = useState(false);

  const getAvatar = (name, url) => url || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=1e293b&color=fff&size=128`;


  const toggleLeaderboard = () => {
    const newState = !leaderboardActive;
    setLeaderboardActive(newState);
    socket.emit('toggleLeaderboard', { locationId: selectedLocation, show: newState });
  };

  const incrementBid = (teamId) => {
    const isFirstBid = !biddingTeam;
    const bidAmount = isFirstBid ? parseFloat(currentBid) : getNextBidAmount(parseFloat(currentBid));
    
    setBidHistory(prev => [...prev, { amount: currentBid, teamId: biddingTeam }]);
    
    setCurrentBid(bidAmount);
    setBiddingTeam(teamId);
    
    // Trigger animation
    setAnimateBid(true);
    setTimeout(() => setAnimateBid(false), 500);

    socket.emit('placeBid', {
      locationId: selectedLocation,
      playerId: livePlayer.id,
      teamId: parseInt(teamId),
      amount: bidAmount
    });
  };

  const reverseBid = () => {
    if (bidHistory.length === 0) return;
    const previousBid = bidHistory[bidHistory.length - 1];
    
    setCurrentBid(previousBid.amount);
    setBiddingTeam(previousBid.teamId);
    setBidHistory(prev => prev.slice(0, -1));

    socket.emit('reverseBid', {
      locationId: selectedLocation,
      playerId: livePlayer.id,
      previousAmount: previousBid.amount,
      previousTeamId: previousBid.teamId
    });
  };

  const sellPlayer = () => {
    if (!biddingTeam) return alert('Select a team!');
    const amount = parseFloat(currentBid);
    socket.emit('sellPlayer', {
      locationId: selectedLocation,
      playerId: livePlayer.id,
      teamId: parseInt(biddingTeam),
      amount
    });
    setLivePlayer({ ...livePlayer, status: 'SOLD', soldPrice: amount });
  };

  const markUnsold = () => {
    socket.emit('unsoldPlayer', {
      locationId: selectedLocation,
      playerId: livePlayer.id
    });
    setLivePlayer({ ...livePlayer, status: 'UNSOLD' });
  };

  const issuePenalty = (teamId) => {
    if (window.confirm("Are you sure you want to issue a penalty mistake to this team? 3 mistakes = Disqualified.")) {
      socket.emit('issuePenalty', { teamId, locationId: selectedLocation });
    }
  };

  const reversePenalty = (teamId) => {
    if (window.confirm("Are you sure you want to reverse a penalty mistake for this team?")) {
      socket.emit('reversePenalty', { teamId, locationId: selectedLocation });
    }
  };

  const reopenPlayer = () => {
    if (!window.confirm("Are you sure you want to re-open this player? The sale will be cancelled.")) return;
    socket.emit('reopenPlayer', { locationId: selectedLocation, playerId: livePlayer.id });
  };

  const toggleBreak = () => {
    const newBreakMode = !isBreakMode;
    setIsBreakMode(newBreakMode);
    socket.emit('toggleBreak', { locationId: selectedLocation, show: newBreakMode });
  };

  const getTeamEligibility = (team, nextBidAmount, player) => {
    if (team.isDisqualified) return { eligible: false, reason: 'Disqualified' };
    if (!player) return { eligible: true };
    
    // Check Budget
    if (team.budget < nextBidAmount) return { eligible: false, reason: 'Insufficient Budget' };

    // Squad size limit
    if (team.players?.length >= 15) return { eligible: false, reason: 'Max Squad Size (15)' };

    const bowlers = team.players?.filter(p => p.category === 'BOWLER').length || 0;
    const batsmen = team.players?.filter(p => p.category === 'BATSMAN').length || 0;
    const allRounders = team.players?.filter(p => p.category === 'ALL_ROUNDER').length || 0;
    const wicketKeepers = team.players?.filter(p => p.category === 'WICKET_KEEPER').length || 0;
    
    const overseasCount = team.players?.filter(p => p.country && p.country.toUpperCase() !== 'IND' && p.country.toUpperCase() !== 'INDIA').length || 0;
    const indianCount = (team.players?.length || 0) - overseasCount;
    const isOverseas = player.country && player.country.toUpperCase() !== 'IND' && player.country.toUpperCase() !== 'INDIA';

    if (isOverseas && overseasCount >= 4) return { eligible: false, reason: 'Max Overseas (4)' };
    if (!isOverseas && indianCount >= 12) return { eligible: false, reason: 'Must Pick Overseas' };

    const reqBowlers = Math.max(0, 4 - (bowlers + (player.category === 'BOWLER' ? 1 : 0)));
    const reqBatsmen = Math.max(0, 4 - (batsmen + (player.category === 'BATSMAN' ? 1 : 0)));
    const reqWk = Math.max(0, 1 - (wicketKeepers + (player.category === 'WICKET_KEEPER' ? 1 : 0)));
    const reqAr = Math.max(0, 2 - (allRounders + (player.category === 'ALL_ROUNDER' ? 1 : 0)));
    
    const requiredSlots = reqBowlers + reqBatsmen + reqWk + reqAr;
    const remainingSlots = 15 - ((team.players?.length || 0) + 1);
    
    if (requiredSlots > remainingSlots) {
      return { eligible: false, reason: 'Impossible to meet minimums' };
    }
    
    return { eligible: true };
  };

  if (!selectedLocation) {
    return <div>Error: No location assigned to this auctioneer.</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Fast Control Header Bar */}
      <div className="glass-panel" style={{ padding: '0.75rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ fontWeight: 'bold', color: 'var(--primary)', fontSize: '1.1rem' }}>📍 Auction Room:</span>
          {locations.length > 0 && (
            <select
              value={selectedLocation || ''}
              onChange={(e) => setAdminSelectedLocation(e.target.value)}
              style={{ padding: '0.5rem 1rem', background: 'var(--bg-dark)', color: 'white', border: '1px solid var(--primary)', borderRadius: '8px', fontWeight: 'bold' }}
            >
              {locations.map(l => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          )}
        </div>

        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <button
            className="btn"
            onClick={advanceNextPlayer}
            style={{
              background: 'linear-gradient(135deg, #10b981, #059669)',
              color: 'white',
              fontWeight: '800',
              fontSize: '1.1rem',
              padding: '0.6rem 1.5rem',
              borderRadius: '8px',
              boxShadow: '0 4px 15px rgba(16, 185, 129, 0.4)'
            }}
          >
            ▶ NEXT PLAYER
          </button>
          <button
            className="btn"
            onClick={toggleBreak}
            style={{
              background: isBreakMode ? 'var(--warning)' : 'rgba(255,255,255,0.1)',
              color: isBreakMode ? '#000' : 'white',
              fontWeight: 'bold',
              padding: '0.6rem 1.2rem',
              borderRadius: '8px'
            }}
          >
            {isBreakMode ? '☕ Resume Auction' : '☕ Pause (Break)'}
          </button>
        </div>
      </div>

      <div className="auctioneer-grid">
        {/* LEFT COLUMN: UPCOMING PLAYERS */}
        <div className="auctioneer-sidebar glass-panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2>Upcoming Players</h2>
          <button 
            className="btn" 
            style={{ padding: '0.5rem', background: leaderboardActive ? 'var(--primary)' : 'rgba(255,255,255,0.1)', fontSize: '0.8rem' }}
            onClick={toggleLeaderboard}
          >
            {leaderboardActive ? 'Hide Leaderboard' : 'Show Leaderboard'}
          </button>
        </div>
        
        {/* Dynamic Pool Filter */}
        {players.some(p => p.pool) && (
          <select 
            value={poolFilter} 
            onChange={(e) => setPoolFilter(e.target.value)}
            style={{ width: '100%', padding: '0.5rem', marginTop: '1rem', background: 'var(--bg-dark)', color: 'white', border: '1px solid var(--primary)', borderRadius: '4px' }}
          >
            <option value="ALL">All Sets / Pools</option>
            {[...new Set(players.filter(p => p.pool).map(p => p.pool))]
              .sort((a, b) => {
                const getPoolNumber = (poolStr) => {
                  if (!poolStr) return 999;
                  const match = poolStr.match(/POOL\s*[-]?\s*(\d+)/i);
                  return match ? parseInt(match[1], 10) : 999;
                };
                return getPoolNumber(a) - getPoolNumber(b);
              })
              .map(pool => (
              <option key={pool} value={pool}>{pool}</option>
            ))}
          </select>
        )}

        <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {players
            .filter(p => poolFilter === 'ALL' || p.pool === poolFilter)
            .sort((a, b) => {
              const getPoolNumber = (poolStr) => {
                if (!poolStr) return 999;
                const match = poolStr.match(/POOL\s*[-]?\s*(\d+)/i);
                return match ? parseInt(match[1], 10) : 999;
              };
              const poolNumA = getPoolNumber(a.pool);
              const poolNumB = getPoolNumber(b.pool);
              if (poolNumA !== poolNumB) return poolNumA - poolNumB;
              return a.name.localeCompare(b.name);
            })
            .map(p => (
            <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem', background: 'rgba(255,255,255,0.05)', borderRadius: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <img src={getAvatar(p.name, p.imageUrl)} style={{ width: '30px', height: '30px', borderRadius: '50%', objectFit: 'cover' }} />
                <span>{p.name}</span>
              </div>
              <button className="btn" style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }} onClick={() => bringToLot(p)} disabled={livePlayer && livePlayer.status === 'LIVE'}>Bring to Lot</button>
            </div>
          ))}
        </div>
      </div>

      {/* MIDDLE COLUMN: LIVE CONTROL PANEL */}
      <div className="dashboard-main glass-panel">
        <h2>Live Control Panel</h2>
        {livePlayer ? (
          <div className="card glass-panel" style={{ marginTop: '2rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <img src={getAvatar(livePlayer.name, livePlayer.imageUrl)} className="player-avatar-large" />
            <h1 style={{ fontSize: '3.5rem', color: 'var(--primary)' }}>{livePlayer.name} {livePlayer.country !== 'IND' && livePlayer.country !== 'India' ? '✈️' : ''}</h1>
            <span className={`badge badge-${livePlayer.category.toLowerCase()}`} style={{ marginTop: '0.5rem' }}>{livePlayer.category}</span>
            <p style={{ fontSize: '1.5rem', margin: '1rem 0' }}>Base Price: ₹{livePlayer.basePrice / 10000000} Cr</p>
            
            {livePlayer.status === 'LIVE' ? (
              <div style={{ marginTop: '1rem', background: 'var(--bg-darker)', padding: '1.5rem', borderRadius: '8px', width: '100%' }}>
                <h3 className={animateBid ? 'animate-bid' : ''} style={{ marginBottom: '0.5rem', fontSize: '2.5rem', transition: 'color 0.2s' }}>
                  Current Bid: ₹{currentBid / 10000000} Cr
                </h3>
                {biddingTeam && <p style={{ color: 'var(--primary)', fontWeight: 'bold', fontSize: '1.5rem', marginBottom: '0.5rem' }}>Highest Bidder: {teams.find(t => t.id === parseInt(biddingTeam))?.name}</p>}
                
                <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginBottom: '1rem' }}>

                  {bidHistory.length > 0 && (
                    <button className="btn" style={{ background: 'var(--warning)', color: 'black', fontWeight: 'bold' }} onClick={reverseBid}>
                      Reverse Last Bid ↩️
                    </button>
                  )}
                </div>

                <p style={{ marginBottom: '1rem', color: 'var(--text-muted)' }}>
                  {!biddingTeam 
                    ? `Click a team to start bidding at Base Price (₹${currentBid / 10000000} Cr)` 
                    : `Click a team to increment bid by +₹${(getNextBidAmount(parseFloat(currentBid)) - currentBid) / 100000} L`
                  }
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.75rem', marginBottom: '0.5rem' }}>
                  {teams.map(t => {
                    const nextBidAmount = biddingTeam ? getNextBidAmount(parseFloat(currentBid)) : parseFloat(currentBid);
                    const eligibility = getTeamEligibility(t, nextBidAmount, livePlayer);
                    const isBidding = parseInt(biddingTeam) === t.id;
                    return (
                      <div key={t.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <button 
                          className="btn"
                          disabled={t.isDisqualified}
                          style={{ 
                            background: isBidding ? 'var(--primary)' : 'rgba(255,255,255,0.1)', 
                            border: isBidding ? '2px solid white' : (eligibility.eligible ? '1px solid var(--glass-border)' : '1px solid var(--danger)'),
                            opacity: t.isDisqualified ? 0.5 : 1,
                            padding: '0.8rem 0.5rem',
                            fontSize: '0.9rem',
                            fontWeight: 'bold',
                            transition: 'all 0.2s',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '0.2rem'
                          }}
                          onClick={() => incrementBid(t.id)}
                        >
                          {t.name}
                          {t.isDisqualified && <span style={{fontSize: '0.8rem', color: 'var(--danger)'}}>(Disqualified)</span>}
                        </button>
                        {!eligibility.eligible && !t.isDisqualified && (
                          <div style={{ color: 'var(--danger)', fontSize: '0.85rem', fontWeight: 'bold' }}>
                            ⚠ {eligibility.reason}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                
                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '2rem', borderTop: '1px solid var(--glass-border)', paddingTop: '2rem' }}>
                  <button className="btn btn-success" onClick={sellPlayer} style={{ fontSize: '1.5rem', padding: '1rem 3rem' }}>SOLD!</button>
                  {bidHistory.length === 0 && (
                    <button className="btn btn-danger" onClick={markUnsold} style={{ fontSize: '1.5rem', padding: '1rem 3rem' }}>UNSOLD</button>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ marginTop: '2rem' }}>
                <h2 style={{ color: livePlayer.status === 'SOLD' ? 'var(--success)' : 'var(--danger)', fontSize: '2.5rem' }}>
                  {livePlayer.status === 'SOLD' ? `SOLD for ₹${currentBid / 10000000} Cr` : 'UNSOLD'}
                </h2>
                {livePlayer.status === 'SOLD' && biddingTeam && (
                  <h3 style={{ color: 'white', marginTop: '0.5rem', fontSize: '1.8rem' }}>
                    to {teams.find(t => t.id === parseInt(biddingTeam))?.name}
                  </h3>
                )}
              </div>
            )}
            
            {(livePlayer.status === 'SOLD' || livePlayer.status === 'UNSOLD') && (
              <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                <button className="btn" style={{ fontSize: '1.2rem', padding: '1rem 2rem', background: 'var(--primary)', color: '#000', fontWeight: 'bold' }} onClick={advanceNextPlayer}>
                  ▶ Next Player
                </button>
                <button className="btn" style={{ fontSize: '1.2rem', padding: '1rem 2rem', background: 'var(--warning)', color: 'black', fontWeight: 'bold' }} onClick={reopenPlayer}>
                  Re-Open Player
                </button>
              </div>
            )}
          </div>
        ) : (
          <div style={{ marginTop: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '1.2rem', textAlign: 'center' }}>No player currently on the auction block.</p>
            <button className="btn" style={{ fontSize: '1.3rem', padding: '1rem 2.5rem', background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white', fontWeight: 'bold', borderRadius: '10px', boxShadow: '0 4px 15px rgba(16, 185, 129, 0.4)' }} onClick={advanceNextPlayer}>
              ▶ Bring Next Player to Lot
            </button>
          </div>
        )}
      </div>

      {/* RIGHT COLUMN: AUCTION INFO */}
      <div className="auctioneer-sidebar glass-panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ margin: 0 }}>Auction Info</h2>
          <button className="btn" onClick={toggleBreak} style={{ background: isBreakMode ? 'var(--warning)' : 'rgba(255,255,255,0.1)', color: isBreakMode ? 'black' : 'white', fontWeight: 'bold', padding: '0.5rem 1rem' }}>
            ☕ {isBreakMode ? 'End Break' : 'Break Time'}
          </button>
        </div>
        
        {lastSoldPlayer && (
          <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'var(--bg-darker)', borderRadius: '8px', borderLeft: '4px solid var(--success)' }}>
            <h3 style={{ fontSize: '0.9rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.5rem' }}>Last Sold Player</h3>
            <p style={{ color: 'var(--text-main)', fontWeight: 'bold', fontSize: '1.5rem' }}>{lastSoldPlayer.name}</p>
            <p style={{ marginTop: '0.5rem' }}>Sold to: <span style={{ color: 'white', fontWeight: 'bold' }}>{teams.find(t => t.id === lastSoldPlayer.teamId)?.name}</span></p>
            <p>Price: <span style={{ color: 'var(--success)', fontWeight: 'bold', fontSize: '1.2rem' }}>₹{lastSoldPlayer.soldPrice / 10000000} Cr</span></p>
          </div>
        )}

        <div style={{ marginTop: '2rem' }}>
          <h3 style={{ borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>Franchise Purses</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {teams.map(t => (
              <div key={t.id} style={{ display: 'flex', flexDirection: 'column', background: 'rgba(255,255,255,0.05)', padding: '0.75rem', borderRadius: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 'bold', color: 'white', textDecoration: t.isDisqualified ? 'line-through' : 'none' }}>{t.name}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Squad: {t.players?.length || 0}/15</div>
                  </div>
                  <div style={{ color: 'var(--accent)', fontWeight: 'bold', fontSize: '1.1rem' }}>
                    ₹{t.budget / 10000000} Cr
                  </div>
                </div>
                
                {/* Penalty Controls */}
                <div style={{ marginTop: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '0.5rem' }}>
                  <span style={{ fontSize: '0.8rem', color: t.mistakes >= 3 ? 'var(--danger)' : 'var(--warning)', fontWeight: 'bold' }}>
                    Mistakes: {t.mistakes || 0}/3 {t.isDisqualified ? '(DISQUALIFIED)' : ''}
                  </span>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {t.mistakes > 0 && (
                      <button 
                        className="btn" 
                        style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', background: 'var(--warning)', color: 'black', fontWeight: 'bold' }}
                        onClick={() => reversePenalty(t.id)}
                      >
                        - Penalty
                      </button>
                    )}
                    {!t.isDisqualified && (
                      <button 
                        className="btn btn-danger" 
                        style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                        onClick={() => issuePenalty(t.id)}
                      >
                        + Penalty
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
    </div>
  );
}
