import { useEffect, useState, useRef } from 'react';
import socket from '../socket';
import { useAuth } from '../AuthContext';

const API_URL = import.meta.env.VITE_API_URL || '';

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
  const [animateBid, setAnimateBid] = useState(false);
  const [leaderboardActive, setLeaderboardActive] = useState(false);

  // Authoritative Server Timer State
  const [timerDeadline, setTimerDeadline] = useState(null);
  const [timerSecondsLeft, setTimerSecondsLeft] = useState(null);
  const [timerPaused, setTimerPaused] = useState(false);
  const [timerConfigDuration, setTimerConfigDuration] = useState(30);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetConfirmInput, setResetConfirmInput] = useState('');

  // Auto-Pilot & Slot Progression State
  const [autoPilotEnabled, setAutoPilotEnabled] = useState(true);
  const [autoAdvanceCountdown, setAutoAdvanceCountdown] = useState(null);
  const [slotCompletedNotice, setSlotCompletedNotice] = useState(false);
  const [playerHistory, setPlayerHistory] = useState([]);
  const [auctionStartingCountdown, setAuctionStartingCountdown] = useState(null);
  const isResolvingRef = useRef(false);

  // Synchronized 5-Second Global Countdown effect
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
        // Commence auction with the first player lot
        advanceNextPlayer();
      }, 700);
      return () => clearTimeout(timer);
    }
  }, [auctionStartingCountdown]);

  const triggerAuctionStart = () => {
    socket.emit('startAuctionCountdown', {
      locationId: selectedLocation || 'main_arena',
      seconds: 5
    });
  };

  // Local ticker derived from server deadline with automated resolution at zero
  useEffect(() => {
    if (!timerDeadline || timerPaused) return;

    const interval = setInterval(() => {
      const remainingMs = timerDeadline - Date.now();
      const sec = Math.max(0, Math.ceil(remainingMs / 1000));
      setTimerSecondsLeft(sec);
      if (remainingMs <= 0) {
        clearInterval(interval);
        // Automatically resolve current lot if active and not already resolving
        if (!isResolvingRef.current && livePlayer && livePlayer.status === 'LIVE') {
          isResolvingRef.current = true;
          autoResolveLot();
        }
      }
    }, 200);

    return () => clearInterval(interval);
  }, [timerDeadline, timerPaused, livePlayer, biddingTeam, currentBid, autoPilotEnabled, selectedLocation]);

  const controlTimer = async (action, extra = {}) => {
    if (!selectedLocation) return;

    // Immediate optimistic local state update so the pause/resume happens with 0 latency
    if (action === 'pause') {
      setTimerPaused(true);
      const remainingSec = timerSecondsLeft !== null ? timerSecondsLeft : 30;
      setTimerSecondsLeft(remainingSec);
      setTimerDeadline(null);
      socket.emitLocal('timerUpdated', {
        locationId: selectedLocation,
        deadlineMs: null,
        paused: true,
        remainingMs: remainingSec * 1000
      });
    } else if (action === 'resume') {
      setTimerPaused(false);
      const remainingSec = timerSecondsLeft !== null ? timerSecondsLeft : 30;
      const newDeadline = Date.now() + remainingSec * 1000;
      setTimerDeadline(newDeadline);
      setTimerSecondsLeft(remainingSec);
      socket.emitLocal('timerUpdated', {
        locationId: selectedLocation,
        deadlineMs: newDeadline,
        paused: false,
        remainingMs: remainingSec * 1000
      });
    } else if (action === 'extend') {
      const extraSec = extra.addSeconds || 10;
      const remainingSec = (timerSecondsLeft !== null ? timerSecondsLeft : 0) + extraSec;
      setTimerSecondsLeft(remainingSec);
      if (!timerPaused) {
        const currentEnd = timerDeadline ? Math.max(Date.now(), timerDeadline) : Date.now();
        const newDeadline = currentEnd + extraSec * 1000;
        setTimerDeadline(newDeadline);
        socket.emitLocal('timerUpdated', {
          locationId: selectedLocation,
          deadlineMs: newDeadline,
          paused: false,
          remainingMs: remainingSec * 1000
        });
      }
    }

    try {
      const res = await fetch(`${API_URL}/api/auction/timer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locationId: selectedLocation,
          action,
          durationSeconds: extra.durationSeconds || timerConfigDuration,
          addSeconds: extra.addSeconds || 10
        })
      });
      const data = await res.json();
      if (data && data.locationId) {
        socket.emitLocal('timerUpdated', data);
      }
    } catch (err) {
      console.error('Failed to control timer:', err);
    }
  };

  const handleResetAuction = async () => {
    if (resetConfirmInput !== 'RESET') {
      alert('Please type RESET exactly into the confirmation prompt.');
      return;
    }
    try {
      const res = await fetch(`${API_URL}/api/auction/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locationId: selectedLocation, confirmText: 'RESET' })
      });
      if (res.ok) {
        setShowResetModal(false);
        setResetConfirmInput('');
        setLivePlayer(null);
        setCurrentBid('');
        setBiddingTeam('');
        setBidHistory([]);
        setTimerDeadline(null);
        setTimerSecondsLeft(null);
        fetchTeams();
        alert('Auction reset completed successfully.');
      }
    } catch (err) {
      console.error('Failed to reset auction:', err);
    }
  };

  const getNextBidAmount = (current) => {
    if (current < 5000000) return current + 500000;
    if (current < 10000000) return current + 1000000;
    if (current < 50000000) return current + 5000000;
    if (current < 100000000) return current + 10000000;
    return current + 20000000;
  };

  const fetchTeams = () => {
    fetch(API_URL + '/api/teams')
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
    fetch(API_URL + '/api/locations')
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

  // Handle automated expiration: sells if bid exists, passes unsold if no bids
  const autoResolveLot = () => {
    if (!livePlayer || livePlayer.status !== 'LIVE') return;
    
    if (biddingTeam) {
      const amount = parseFloat(currentBid);
      socket.emit('sellPlayer', {
        locationId: selectedLocation,
        playerId: livePlayer.id,
        teamId: String(biddingTeam),
        amount
      });
      setLivePlayer(prev => prev ? { ...prev, status: 'SOLD', soldPrice: amount } : null);
    } else {
      socket.emit('unsoldPlayer', {
        locationId: selectedLocation,
        playerId: livePlayer.id
      });
      setLivePlayer(prev => prev ? { ...prev, status: 'UNSOLD' } : null);
    }

    if (autoPilotEnabled) {
      setAutoAdvanceCountdown(3);
    }
  };

  // Automated progression countdown to the next lot in the current category/slot
  useEffect(() => {
    if (autoAdvanceCountdown === null) return;
    if (autoAdvanceCountdown > 0) {
      const timerId = setTimeout(() => {
        setAutoAdvanceCountdown(prev => (prev !== null && prev > 0 ? prev - 1 : 0));
      }, 1000);
      return () => clearTimeout(timerId);
    } else if (autoAdvanceCountdown === 0) {
      setAutoAdvanceCountdown(null);
      isResolvingRef.current = false;
      
      // Look for next pending player in the filtered slot
      const remainingInSlot = players.filter(p => 
        (poolFilter === 'ALL' || p.pool === poolFilter) &&
        p.id !== livePlayer?.id &&
        p.status === 'UPCOMING'
      );

      if (remainingInSlot.length > 0) {
        advanceNextPlayer(remainingInSlot[0].id);
      } else {
        setSlotCompletedNotice(true);
      }
    }
  }, [autoAdvanceCountdown, players, poolFilter, livePlayer]);

  const advanceNextPlayer = async (targetId) => {
    if (!selectedLocation) return;
    try {
      // Record current live player into player history before advancing
      if (livePlayer && (!playerHistory.length || playerHistory[playerHistory.length - 1].id !== livePlayer.id)) {
        setPlayerHistory(prev => [...prev, livePlayer]);
      }

      const upcomingPool = players.filter(p => 
        (poolFilter === 'ALL' || p.pool === poolFilter) && 
        p.status === 'UPCOMING' &&
        p.id !== livePlayer?.id
      );

      const nextCandidate = targetId || upcomingPool[0]?.id || players.find(p => p.status === 'UPCOMING')?.id;

      if (!nextCandidate) {
        setSlotCompletedNotice(true);
        return;
      }

      const res = await fetch(`${API_URL}/api/auction/set-live`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          locationId: selectedLocation,
          playerId: nextCandidate,
          durationSeconds: timerConfigDuration
        })
      });
      const data = await res.json();
      if (data && data.id) {
        isResolvingRef.current = false;
        setAutoAdvanceCountdown(null);
        setSlotCompletedNotice(false);
        setLivePlayer(data);
        setCurrentBid(data.basePrice);
        setBiddingTeam('');
        setBidHistory([]);
        if (data.timerDeadlineMs) {
          setTimerDeadline(data.timerDeadlineMs);
          setTimerSecondsLeft(Math.max(0, Math.ceil((data.timerDeadlineMs - Date.now()) / 1000)));
          setTimerPaused(false);
        }
        setPlayers(prev => prev.filter(p => p.id !== data.id));
      } else if (data.error) {
        alert(data.error);
      }
    } catch (err) {
      console.error('Failed to advance next player:', err);
    }
  };

  const goToPreviousPlayer = async () => {
    if (!selectedLocation) return;
    if (playerHistory.length === 0) {
      alert('No previous player in session history.');
      return;
    }

    const prevPlayer = playerHistory[playerHistory.length - 1];
    setPlayerHistory(prev => prev.slice(0, -1));

    // Clear auto-advance countdown and resolution flags
    setAutoAdvanceCountdown(null);
    isResolvingRef.current = false;
    setSlotCompletedNotice(false);

    try {
      // Reopen previous player in backend (refunds franchise purse if was sold, sets status back to LIVE)
      const res = await fetch(`${API_URL}/api/auction/reopen`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locationId: selectedLocation,
          playerId: prevPlayer.id
        })
      });

      // Restart authoritative countdown for the reopened previous player
      await controlTimer('start', { durationSeconds: timerConfigDuration });

      const data = await res.json();
      const loadedPlayer = (data && data.id) ? data : prevPlayer;

      setLivePlayer({
        ...loadedPlayer,
        status: 'LIVE',
        soldPrice: null,
        teamId: null
      });
      setCurrentBid(loadedPlayer.basePrice || prevPlayer.basePrice);
      setBiddingTeam('');
      setBidHistory([]);
      fetchTeams();

      // Ensure previous player is in local player list if not already
      setPlayers(prev => {
        if (!prev.some(p => p.id === loadedPlayer.id)) {
          return [loadedPlayer, ...prev];
        }
        return prev;
      });
    } catch (err) {
      console.error('Failed to return to previous player:', err);
    }
  };

  useEffect(() => {
    if (selectedLocation) {
      socket.emit('joinLocation', selectedLocation);
      fetch(`${API_URL}/api/locations/${selectedLocation}/players`)
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
        fetchTeams();
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

      socket.on('auctionStarting', (data) => {
        const remaining = data.deadlineMs 
          ? Math.max(1, Math.ceil((data.deadlineMs - Date.now()) / 1000))
          : (data.seconds || 5);
        setAuctionStartingCountdown(remaining);
      });

      socket.on('auctionBreakToggled', (data) => {
        const breakActive = Boolean(data.show);
        setIsBreakMode(breakActive);
        if (breakActive) {
          setTimerPaused(true);
          setTimerDeadline(null);
        } else {
          setTimerPaused(false);
        }
      });

      return () => {
        socket.off('playerSold');
        socket.off('penaltyIssued');
        socket.off('playerReopened');
        socket.off('timerUpdated');
        socket.off('auctionStarting');
        socket.off('auctionBreakToggled');
      };
    }
  }, [selectedLocation]);

  const bringToLot = (player) => {
    if (livePlayer && livePlayer.id !== player.id) {
      setPlayerHistory(prev => [...prev.filter(p => p.id !== livePlayer.id), livePlayer]);
    }
    advanceNextPlayer(player.id);
  };

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
    setBiddingTeam(String(teamId));
    
    setAnimateBid(true);
    setTimeout(() => setAnimateBid(false), 400);

    socket.emit('placeBid', {
      locationId: selectedLocation,
      playerId: livePlayer.id,
      teamId: String(teamId),
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
    if (!biddingTeam) return alert('Select a winning franchise before confirming sale!');
    const amount = parseFloat(currentBid);
    socket.emit('sellPlayer', {
      locationId: selectedLocation,
      playerId: livePlayer.id,
      teamId: String(biddingTeam),
      amount
    });
    setLivePlayer({ ...livePlayer, status: 'SOLD', soldPrice: amount });
    if (autoPilotEnabled) {
      setAutoAdvanceCountdown(3);
    }
  };

  const markUnsold = () => {
    socket.emit('unsoldPlayer', {
      locationId: selectedLocation,
      playerId: livePlayer.id
    });
    setLivePlayer({ ...livePlayer, status: 'UNSOLD' });
    if (autoPilotEnabled) {
      setAutoAdvanceCountdown(3);
    }
  };

  const issuePenalty = (teamId) => {
    if (window.confirm("Confirm: Issue formal rule infraction penalty? 3 infractions triggers automated disqualification.")) {
      socket.emit('issuePenalty', { teamId, locationId: selectedLocation });
    }
  };

  const reversePenalty = (teamId) => {
    if (window.confirm("Confirm: Reverse last infraction penalty for this franchise?")) {
      socket.emit('reversePenalty', { teamId, locationId: selectedLocation });
    }
  };

  const reopenPlayer = () => {
    if (!window.confirm("Confirm: Reopen this player lot? Any recorded sale will be nullified.")) return;
    socket.emit('reopenPlayer', { locationId: selectedLocation, playerId: livePlayer.id });
  };

  const toggleBreak = () => {
    const newBreakMode = !isBreakMode;
    setIsBreakMode(newBreakMode);
    if (newBreakMode) {
      setTimerPaused(true);
      setTimerDeadline(null);
    } else {
      setTimerPaused(false);
    }
    socket.emit('toggleBreak', { locationId: selectedLocation, show: newBreakMode });
  };

  const getTeamEligibility = (team, nextBidAmount, player) => {
    if (team.isDisqualified) return { eligible: false, reason: 'DISQUALIFIED' };
    if (!player) return { eligible: true };
    
    if (team.budget < nextBidAmount) return { eligible: false, reason: 'INSUFFICIENT PURSE' };
    if (team.players?.length >= 15) return { eligible: false, reason: 'ROSTER FULL (15)' };

    const bowlers = team.players?.filter(p => p.category === 'BOWLER').length || 0;
    const batsmen = team.players?.filter(p => p.category === 'BATSMAN').length || 0;
    const allRounders = team.players?.filter(p => p.category === 'ALL_ROUNDER').length || 0;
    const wicketKeepers = team.players?.filter(p => p.category === 'WICKET_KEEPER').length || 0;
    
    const overseasCount = team.players?.filter(p => p.country && p.country.toUpperCase() !== 'IND' && p.country.toUpperCase() !== 'INDIA').length || 0;
    const indianCount = (team.players?.length || 0) - overseasCount;
    const isOverseas = player.country && player.country.toUpperCase() !== 'IND' && player.country.toUpperCase() !== 'INDIA';

    if (isOverseas && overseasCount >= 4) return { eligible: false, reason: 'MAX OVERSEAS (4)' };
    if (!isOverseas && indianCount >= 12) return { eligible: false, reason: 'OVERSEAS SLOT REQUIRED' };

    const reqBowlers = Math.max(0, 4 - (bowlers + (player.category === 'BOWLER' ? 1 : 0)));
    const reqBatsmen = Math.max(0, 4 - (batsmen + (player.category === 'BATSMAN' ? 1 : 0)));
    const reqWk = Math.max(0, 1 - (wicketKeepers + (player.category === 'WICKET_KEEPER' ? 1 : 0)));
    const reqAr = Math.max(0, 2 - (allRounders + (player.category === 'ALL_ROUNDER' ? 1 : 0)));
    
    const requiredSlots = reqBowlers + reqBatsmen + reqWk + reqAr;
    const remainingSlots = 15 - ((team.players?.length || 0) + 1);
    
    if (requiredSlots > remainingSlots) {
      return { eligible: false, reason: 'MINIMUM QUOTA VIOLATION' };
    }
    
    return { eligible: true };
  };

  const getAvatar = (name, url) => url || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=141b25&color=d4af37&size=128`;

  if (!selectedLocation) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--crimson-danger)', fontFamily: 'JetBrains Mono, monospace' }}>
        ERROR: NO VENUE ASSIGNED TO CURRENT OPERATOR.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {isBreakMode && (
        <div style={{
          background: 'linear-gradient(90deg, rgba(245, 158, 11, 0.25), rgba(245, 158, 11, 0.4), rgba(245, 158, 11, 0.25))',
          border: '1px solid var(--amber-border)',
          borderRadius: '8px',
          color: 'var(--amber-warning)',
          textAlign: 'center',
          padding: '0.75rem 1.25rem',
          fontWeight: '800',
          fontSize: '0.88rem',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          fontFamily: 'JetBrains Mono, monospace',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 0 20px rgba(245, 158, 11, 0.25)'
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span style={{ fontSize: '1.2rem' }}>⏸️</span>
            <span>OFFICIAL AUCTION RECESS IN EFFECT — BIDDING & TIMERS FROZEN</span>
          </span>
          <button
            onClick={toggleBreak}
            className="btn btn-amber"
            style={{ padding: '0.4rem 1.1rem', fontSize: '0.78rem', fontWeight: '800' }}
          >
            ▶ RESUME SESSION
          </button>
        </div>
      )}
      
      {/* Gavel Master Command Bar */}
      <div style={{ 
        padding: '0.85rem 1.5rem', 
        background: 'rgba(10, 13, 18, 0.95)',
        border: '1px solid var(--gold-border)',
        borderRadius: '8px',
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        flexWrap: 'wrap', 
        gap: '1rem' 
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem', color: 'var(--gold-primary)', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: '700' }}>
            AUTHORITATIVE ARENA:
          </span>
          <span className="badge badge-gold" style={{ fontSize: '0.8rem', padding: '0.35rem 0.85rem' }}>
            IPL MEGA AUCTION ARENA 2026
          </span>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          
          {/* Authoritative Server Countdown Bar */}
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '0.5rem', 
            padding: '0.35rem 0.75rem', 
            background: 'rgba(255, 255, 255, 0.04)', 
            border: '1px solid rgba(255, 255, 255, 0.1)', 
            borderRadius: '4px' 
          }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', fontFamily: 'JetBrains Mono, monospace' }}>TIMER:</span>
            <span style={{ 
              fontSize: '1.05rem', 
              fontWeight: '900', 
              fontFamily: 'JetBrains Mono, monospace',
              color: timerPaused 
                ? 'var(--amber-warning)' 
                : ((timerSecondsLeft !== null && timerSecondsLeft <= 5) ? 'var(--crimson-danger)' : 'var(--gold-bright)')
            }}>
              {timerSecondsLeft !== null ? `${timerSecondsLeft}s` : '--'}
            </span>
            {timerPaused && (
              <span className="badge" style={{ background: 'var(--amber-surface)', color: 'var(--amber-warning)', fontSize: '0.65rem' }}>
                PAUSED
              </span>
            )}
          </div>

          {/* Timer Preset Selector */}
          <select 
            value={timerConfigDuration}
            onChange={(e) => {
              const dur = Number(e.target.value);
              setTimerConfigDuration(dur);
              controlTimer('set_duration', { durationSeconds: dur });
            }}
            className="form-input"
            style={{ width: 'auto', padding: '0.4rem 0.6rem', fontSize: '0.75rem', fontFamily: 'JetBrains Mono, monospace' }}
          >
            <option value={15}>15 SEC PRESET</option>
            <option value={30}>30 SEC PRESET</option>
            <option value={45}>45 SEC PRESET</option>
            <option value={60}>60 SEC PRESET</option>
          </select>

          {/* Timer Action Buttons */}
          <button
            className={`btn ${timerPaused ? 'btn-amber' : 'btn-secondary'}`}
            onClick={() => controlTimer(timerPaused ? 'resume' : 'pause')}
            style={{ 
              padding: '0.45rem 0.85rem', 
              fontSize: '0.75rem',
              fontWeight: '700',
              border: timerPaused ? '1px solid var(--amber-border)' : '1px solid rgba(255, 255, 255, 0.12)'
            }}
          >
            {timerPaused ? '▶ RESUME TIMER' : '⏸ PAUSE TIMER'}
          </button>

          <button
            className="btn btn-secondary"
            onClick={() => controlTimer('extend', { addSeconds: 10 })}
            style={{ padding: '0.45rem 0.8rem', fontSize: '0.75rem', color: 'var(--gold-bright)' }}
          >
            +10s EXTEND
          </button>

          <button
            className={`btn ${autoPilotEnabled ? 'btn-gold' : 'btn-secondary'}`}
            onClick={() => {
              setAutoPilotEnabled(prev => !prev);
              if (autoPilotEnabled) setAutoAdvanceCountdown(null);
            }}
            style={{ 
              padding: '0.55rem 1rem', 
              fontSize: '0.8rem', 
              fontWeight: '800',
              boxShadow: autoPilotEnabled ? '0 0 12px rgba(212, 175, 55, 0.4)' : 'none'
            }}
            title="When active: automatically resolves sold/unsold when timer hits 0 and advances to next player in slot"
          >
            {autoPilotEnabled ? '⚡ AUTO-PILOT: ON' : '⏸️ AUTO-PILOT: OFF'}
          </button>

          <button
            className="btn btn-secondary"
            disabled={playerHistory.length === 0}
            onClick={goToPreviousPlayer}
            style={{ 
              padding: '0.55rem 1rem', 
              fontSize: '0.8rem',
              fontWeight: '700',
              opacity: playerHistory.length === 0 ? 0.45 : 1,
              cursor: playerHistory.length === 0 ? 'not-allowed' : 'pointer'
            }}
            title={playerHistory.length > 0 ? `Return to previous player: ${playerHistory[playerHistory.length - 1].name}` : 'No previous player in session history'}
          >
            ◀ PREVIOUS PLAYER
          </button>

          <button
            className="btn btn-gold"
            onClick={triggerAuctionStart}
            disabled={auctionStartingCountdown !== null}
            style={{ 
              padding: '0.55rem 1.35rem', 
              fontSize: '0.8rem', 
              fontWeight: '900',
              background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)',
              color: '#0b0f17',
              border: 'none',
              boxShadow: '0 0 16px rgba(255, 215, 0, 0.45)',
              cursor: auctionStartingCountdown !== null ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem'
            }}
            title="Broadcast 5-second countdown to team leaders and franchise war rooms, then start the auction"
          >
            {auctionStartingCountdown !== null ? `⏳ STARTING (${auctionStartingCountdown}s)` : '🚀 START AUCTION'}
          </button>

          <button
            className="btn btn-gold"
            onClick={() => advanceNextPlayer()}
            style={{ padding: '0.55rem 1.25rem', fontSize: '0.8rem', fontWeight: '800' }}
          >
            NEXT PLAYER ▶
          </button>
          
          <button
            className={`btn ${isBreakMode ? 'btn-amber' : 'btn-secondary'}`}
            onClick={toggleBreak}
            style={{ 
              padding: '0.55rem 1.25rem', 
              fontSize: '0.8rem',
              fontWeight: '800',
              border: isBreakMode ? '1px solid var(--amber-border)' : '1px solid rgba(255, 255, 255, 0.1)',
              boxShadow: isBreakMode ? '0 0 15px rgba(245, 158, 11, 0.4)' : 'none'
            }}
          >
            {isBreakMode ? '▶ RESUME SESSION' : '⏸ OFFICIAL RECESS'}
          </button>
          
          <button 
            className={`btn ${leaderboardActive ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '0.55rem 1rem', fontSize: '0.8rem' }}
            onClick={toggleLeaderboard}
          >
            {leaderboardActive ? 'HIDE STANDINGS' : 'BROADCAST STANDINGS'}
          </button>

          <button
            className="btn"
            onClick={() => setShowResetModal(true)}
            style={{ 
              padding: '0.45rem 0.75rem', 
              fontSize: '0.72rem', 
              background: 'var(--crimson-surface)', 
              color: 'var(--crimson-danger)', 
              border: '1px solid var(--crimson-border)' 
            }}
          >
            RESET AUCTION
          </button>
        </div>
      </div>

      {/* Emergency Reset Confirmation Modal */}
      {showResetModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.85)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1rem'
        }}>
          <div style={{
            background: 'var(--surface-primary)',
            border: '1px solid var(--crimson-border)',
            padding: '2rem',
            borderRadius: '8px',
            maxWidth: '460px',
            width: '100%',
            boxShadow: '0 25px 60px rgba(0,0,0,0.9)'
          }}>
            <h3 style={{ color: 'var(--crimson-danger)', fontSize: '1.25rem', marginBottom: '0.5rem', fontWeight: '800' }}>
              CRITICAL: RESET ENTIRE AUCTION
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.5, marginBottom: '1.25rem' }}>
              This action will reset all players back to UPCOMING, restore all 10 franchise budgets to ₹90.00 Cr, and clear active gavel lots for this session.
            </p>
            <p style={{ color: '#ffffff', fontSize: '0.8rem', fontFamily: 'JetBrains Mono, monospace', marginBottom: '0.5rem' }}>
              To confirm, please type <strong>RESET</strong> below:
            </p>
            <input
              type="text"
              value={resetConfirmInput}
              onChange={(e) => setResetConfirmInput(e.target.value)}
              className="form-input"
              placeholder="Type RESET"
              style={{ marginBottom: '1.25rem', textTransform: 'uppercase' }}
            />
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => { setShowResetModal(false); setResetConfirmInput(''); }}>
                CANCEL
              </button>
              <button className="btn btn-danger" onClick={handleResetAuction}>
                CONFIRM DESTRUCTIVE RESET
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3-Column Command Deck */}
      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr 320px', gap: '1.25rem' }}>
        
        {/* LEFT COLUMN: UPCOMING ROSTER QUEUE */}
        <div style={{ 
          background: 'rgba(10, 13, 18, 0.85)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '8px',
          padding: '1.25rem',
          display: 'flex',
          flexDirection: 'column',
          height: 'calc(100vh - 170px)',
          overflow: 'hidden'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div>
              <h3 style={{ fontSize: '0.95rem', fontWeight: '800', color: '#ffffff' }}>ROSTER QUEUE</h3>
              <span style={{ fontSize: '0.7rem', color: 'var(--gold-primary)', fontFamily: 'JetBrains Mono, monospace' }}>
                {players.length} PENDING LOTS
              </span>
            </div>
          </div>
          
          {players.some(p => p.pool) && (
            <select 
              value={poolFilter} 
              onChange={(e) => setPoolFilter(e.target.value)}
              className="form-input"
              style={{ padding: '0.45rem', fontSize: '0.8rem', marginBottom: '0.75rem' }}
            >
              <option value="ALL">ALL LOT CATEGORIES</option>
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

          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem', paddingRight: '0.25rem' }}>
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
              <div key={p.id} style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                padding: '0.65rem 0.75rem', 
                background: 'rgba(16, 21, 29, 0.7)', 
                borderRadius: '4px',
                border: '1px solid rgba(255, 255, 255, 0.04)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <img src={getAvatar(p.name, p.imageUrl)} style={{ width: '28px', height: '28px', borderRadius: '4px', objectFit: 'cover' }} alt="" />
                  <div>
                    <div style={{ fontSize: '0.85rem', fontWeight: '700', color: '#ffffff' }}>{p.name}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', fontFamily: 'JetBrains Mono, monospace' }}>
                      ₹{(p.basePrice / 10000000).toFixed(2)} Cr
                    </div>
                  </div>
                </div>
                <button 
                  className="btn btn-secondary" 
                  style={{ padding: '0.3rem 0.6rem', fontSize: '0.7rem' }} 
                  onClick={() => bringToLot(p)} 
                  disabled={livePlayer && livePlayer.status === 'LIVE'}
                >
                  LOAD
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* MIDDLE COLUMN: LIVE GAVEL CONSOLE */}
        <div style={{ 
          background: 'rgba(10, 13, 18, 0.95)',
          border: '1px solid var(--gold-border)',
          borderRadius: '8px',
          padding: '1.75rem',
          display: 'flex',
          flexDirection: 'column',
          height: 'calc(100vh - 170px)',
          overflowY: 'auto'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--gold-primary)', fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.15em' }}>
              OFFICIAL GAVEL DECK
            </span>
            {livePlayer && (
              <span className={`badge ${livePlayer.status === 'LIVE' ? 'badge-live' : livePlayer.status === 'SOLD' ? 'badge-sold' : 'badge-unsold'}`}>
                {livePlayer.status}
              </span>
            )}
          </div>

          {livePlayer ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
              <div style={{ 
                width: '90px', 
                height: '90px', 
                borderRadius: '8px', 
                background: 'rgba(20, 27, 37, 0.9)', 
                border: '1px solid var(--gold-border)', 
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '1rem'
              }}>
                <img src={getAvatar(livePlayer.name, livePlayer.imageUrl)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
              </div>

              <h1 style={{ fontSize: '2.4rem', fontWeight: '900', color: '#ffffff', marginBottom: '0.25rem' }}>
                {livePlayer.name}
              </h1>

              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
                <span className="badge badge-gold">{livePlayer.category.replace('_', ' ')}</span>
                <span className="badge" style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)' }}>
                  BASE: ₹{(livePlayer.basePrice / 10000000).toFixed(2)} Cr
                </span>
                <span className="badge" style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)' }}>
                  {livePlayer.country || 'DOMESTIC'}
                </span>
              </div>
              
              {livePlayer.status === 'LIVE' ? (
                <div style={{ width: '100%', background: 'rgba(16, 21, 29, 0.9)', padding: '1.5rem', borderRadius: '6px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--gold-bright)', letterSpacing: '0.12em', fontFamily: 'JetBrains Mono, monospace', marginBottom: '0.25rem' }}>
                    CURRENT VALUATION
                  </div>
                  <h2 className={animateBid ? 'animate-bid' : ''} style={{ fontSize: '3rem', fontWeight: '900', color: '#ffffff', fontFamily: 'JetBrains Mono, monospace', margin: 0 }}>
                    ₹{(parseFloat(currentBid) / 10000000).toFixed(2)} Cr
                  </h2>
                  
                  <div style={{ marginTop: '0.5rem', marginBottom: '1.25rem', fontSize: '1rem', color: 'var(--text-secondary)' }}>
                    LEADING FRANCHISE: <strong style={{ color: 'var(--gold-bright)' }}>{teams.find(t => String(t.id) === String(biddingTeam))?.name || 'AWAITING OPENING BID'}</strong>
                  </div>

                  {bidHistory.length > 0 && (
                    <button 
                      className="btn btn-amber" 
                      style={{ padding: '0.4rem 1rem', fontSize: '0.75rem', marginBottom: '1rem' }} 
                      onClick={reverseBid}
                    >
                      REVERSE LAST BID
                    </button>
                  )}

                  {/* 10-Franchise Bid Paddle Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.5rem', marginBottom: '1.25rem' }}>
                    {teams.map(t => {
                      const nextBidAmount = biddingTeam ? getNextBidAmount(parseFloat(currentBid)) : parseFloat(currentBid);
                      const eligibility = getTeamEligibility(t, nextBidAmount, livePlayer);
                      const isBidding = String(biddingTeam) === String(t.id);
                      
                      return (
                        <div key={t.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                          <button 
                            className="btn"
                            disabled={t.isDisqualified || isBreakMode}
                            style={{ 
                              background: isBidding 
                                ? 'linear-gradient(135deg, var(--gold-bright), var(--gold-primary))' 
                                : 'rgba(20, 27, 37, 0.9)', 
                              color: isBidding ? '#000000' : '#ffffff',
                              border: isBidding 
                                ? '1px solid #ffffff' 
                                : eligibility.eligible 
                                  ? '1px solid rgba(255, 255, 255, 0.1)' 
                                  : '1px solid var(--crimson-border)',
                              opacity: t.isDisqualified || isBreakMode ? 0.35 : 1,
                              cursor: t.isDisqualified || isBreakMode ? 'not-allowed' : 'pointer',
                              padding: '0.65rem 0.4rem',
                              fontSize: '0.78rem',
                              fontWeight: '700',
                              flexDirection: 'column',
                              gap: '0.15rem'
                            }}
                            onClick={() => !isBreakMode && incrementBid(t.id)}
                          >
                            <span>{t.name}</span>
                            <span style={{ fontSize: '0.65rem', opacity: 0.8, fontFamily: 'JetBrains Mono, monospace' }}>
                              ₹{(t.budget / 10000000).toFixed(1)}Cr
                            </span>
                          </button>
                          {!eligibility.eligible && !t.isDisqualified && (
                            <span style={{ color: 'var(--crimson-danger)', fontSize: '0.65rem', fontFamily: 'JetBrains Mono, monospace' }}>
                              {eligibility.reason}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  
                  {/* Final Gavel Actions */}
                  <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', paddingTop: '1rem', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
                    <button 
                      className="btn btn-success" 
                      onClick={sellPlayer} 
                      disabled={isBreakMode}
                      style={{ 
                        fontSize: '1rem', 
                        padding: '0.85rem 2.5rem', 
                        fontWeight: '800',
                        opacity: isBreakMode ? 0.4 : 1,
                        cursor: isBreakMode ? 'not-allowed' : 'pointer'
                      }}
                    >
                      CONFIRM SALE
                    </button>
                    {bidHistory.length === 0 && (
                      <button 
                        className="btn btn-danger" 
                        onClick={markUnsold} 
                        disabled={isBreakMode}
                        style={{ 
                          fontSize: '1rem', 
                          padding: '0.85rem 2.5rem', 
                          fontWeight: '800',
                          opacity: isBreakMode ? 0.4 : 1,
                          cursor: isBreakMode ? 'not-allowed' : 'pointer'
                        }}
                      >
                        PASS UNSOLD
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div style={{ marginTop: '1.5rem', width: '100%', padding: '1.5rem', background: 'rgba(16, 21, 29, 0.85)', borderRadius: '6px' }}>
                  <div style={{ 
                    color: livePlayer.status === 'SOLD' ? 'var(--emerald-live)' : 'var(--crimson-danger)', 
                    fontSize: '2rem', 
                    fontWeight: '800',
                    fontFamily: 'JetBrains Mono, monospace'
                  }}>
                    {livePlayer.status === 'SOLD' ? `SOLD FOR ₹${(parseFloat(currentBid) / 10000000).toFixed(2)} CR` : 'PASSED UNSOLD'}
                  </div>
                  {livePlayer.status === 'SOLD' && biddingTeam && (
                    <div style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', fontSize: '1.1rem' }}>
                      ACQUIRED BY: <strong style={{ color: '#ffffff' }}>{teams.find(t => String(t.id) === String(biddingTeam))?.name}</strong>
                    </div>
                  )}

                  {autoAdvanceCountdown !== null && (
                    <div style={{
                      marginTop: '1.25rem',
                      padding: '0.85rem 1.5rem',
                      background: 'rgba(212, 175, 55, 0.12)',
                      border: '1px solid var(--gold-border)',
                      borderRadius: '6px',
                      color: 'var(--gold-bright)',
                      fontSize: '0.95rem',
                      fontWeight: '800',
                      fontFamily: 'JetBrains Mono, monospace',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.75rem',
                      flexWrap: 'wrap'
                    }}>
                      <span>⏱️ AUTO-ADVANCING TO NEXT PLAYER IN {autoAdvanceCountdown}s</span>
                      <button 
                        onClick={() => setAutoAdvanceCountdown(null)} 
                        className="btn btn-secondary" 
                        style={{ padding: '0.25rem 0.65rem', fontSize: '0.72rem' }}
                      >
                        PAUSE
                      </button>
                      <button 
                        onClick={() => {
                          setAutoAdvanceCountdown(null);
                          advanceNextPlayer();
                        }} 
                        className="btn btn-gold" 
                        style={{ padding: '0.25rem 0.65rem', fontSize: '0.72rem', fontWeight: '800' }}
                      >
                        NEXT PLAYER ▶
                      </button>
                    </div>
                  )}

                  {slotCompletedNotice && (
                    <div style={{
                      marginTop: '1.25rem',
                      padding: '1.25rem',
                      background: 'rgba(212, 175, 55, 0.15)',
                      border: '1px solid var(--gold-border)',
                      borderRadius: '6px',
                      color: '#ffffff'
                    }}>
                      <div style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>🎉</div>
                      <div style={{ color: 'var(--gold-bright)', fontWeight: '800', fontSize: '1.1rem' }}>
                        {poolFilter === 'ALL' ? 'ALL LOTS COMPLETED' : `${poolFilter} SLOT COMPLETED`}
                      </div>
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                        All upcoming players in this category have been auctioned.
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', marginTop: '1.5rem', flexWrap: 'wrap' }}>
                    <button 
                      className="btn btn-secondary" 
                      disabled={playerHistory.length === 0}
                      onClick={goToPreviousPlayer}
                      style={{ 
                        opacity: playerHistory.length === 0 ? 0.45 : 1, 
                        cursor: playerHistory.length === 0 ? 'not-allowed' : 'pointer',
                        fontWeight: '700' 
                      }}
                      title={playerHistory.length > 0 ? `Return to: ${playerHistory[playerHistory.length - 1].name}` : 'No previous player in session history'}
                    >
                      ◀ PREVIOUS PLAYER
                    </button>
                    <button className="btn btn-gold" onClick={() => advanceNextPlayer()} style={{ fontWeight: '800' }}>
                      NEXT PLAYER ▶
                    </button>
                    <button className="btn btn-secondary" onClick={reopenPlayer}>
                      REOPEN CURRENT LOT
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1.25rem' }}>
              {slotCompletedNotice ? (
                <div style={{ textAlign: 'center', maxWidth: '420px', padding: '2rem', background: 'rgba(16, 21, 29, 0.95)', border: '1px solid var(--gold-border)', borderRadius: '8px' }}>
                  <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🎉</div>
                  <h2 style={{ color: 'var(--gold-bright)', fontSize: '1.5rem', fontWeight: '800', marginBottom: '0.5rem' }}>
                    {poolFilter === 'ALL' ? 'ALL AUCTION LOTS COMPLETED!' : `${poolFilter} SLOT COMPLETED!`}
                  </h2>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
                    All upcoming players in this slot have been auctioned. Choose another category or initiate recess.
                  </p>
                  <button 
                    className="btn btn-gold" 
                    onClick={() => {
                      setSlotCompletedNotice(false);
                      setPoolFilter('ALL');
                    }}
                  >
                    VIEW ALL REMAINING LOTS
                  </button>
                </div>
              ) : (
                <>
                  <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.4rem 1.2rem',
                    background: 'rgba(212, 175, 55, 0.1)',
                    border: '1px solid var(--gold-border)',
                    borderRadius: '50px',
                    color: 'var(--gold-bright)',
                    fontSize: '0.8rem',
                    fontFamily: 'JetBrains Mono, monospace',
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase'
                  }}>
                    ⚡ ARENA STATUS: READY TO COMMENCE
                  </div>

                  <h2 style={{ fontSize: '1.6rem', fontWeight: '800', color: '#ffffff', margin: 0 }}>
                    Gavel Stage Awaiting Session Start
                  </h2>

                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: '500px', textAlign: 'center', margin: 0, lineHeight: '1.5' }}>
                    Click <strong style={{ color: 'var(--gold-bright)' }}>START THE AUCTION</strong> to broadcast a synchronized 5-second countdown to the Team Leader war rooms and spectators before the first lot enters the stage.
                  </p>

                  <div style={{ display: 'flex', gap: '0.85rem', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', marginTop: '0.5rem' }}>
                    <button 
                      className="btn btn-gold" 
                      onClick={triggerAuctionStart}
                      disabled={auctionStartingCountdown !== null}
                      style={{ 
                        padding: '1rem 2.5rem', 
                        fontSize: '1.05rem', 
                        fontWeight: '900', 
                        letterSpacing: '0.04em',
                        background: 'linear-gradient(135deg, #FFD700 0%, #FF8C00 100%)',
                        color: '#0a0d14',
                        border: 'none',
                        boxShadow: '0 0 25px rgba(255, 215, 0, 0.45)',
                        cursor: auctionStartingCountdown !== null ? 'not-allowed' : 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                      }}
                    >
                      {auctionStartingCountdown !== null ? `⏳ STARTING IN ${auctionStartingCountdown}s...` : '🚀 START THE AUCTION (5s COUNTDOWN)'}
                    </button>

                    <button 
                      className="btn btn-secondary" 
                      onClick={() => advanceNextPlayer()} 
                      style={{ padding: '0.95rem 1.6rem', fontSize: '0.9rem', fontWeight: '700' }}
                    >
                      NEXT PLAYER ▶ (INSTANT)
                    </button>

                    {playerHistory.length > 0 && (
                      <button 
                        className="btn btn-secondary" 
                        onClick={goToPreviousPlayer} 
                        style={{ padding: '0.95rem 1.4rem', fontSize: '0.85rem', fontWeight: '700' }}
                      >
                        ◀ PREVIOUS PLAYER ({playerHistory[playerHistory.length - 1].name})
                      </button>
                    )}
                  </div>

                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '0.5rem' }}>
                    Active Slot: <strong style={{ color: 'var(--gold-bright)' }}>{poolFilter}</strong> ({players.filter(p => poolFilter === 'ALL' || p.pool === poolFilter).length} upcoming lots available)
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: PURSES & DISCIPLINE */}
        <div style={{ 
          background: 'rgba(10, 13, 18, 0.85)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '8px',
          padding: '1.25rem',
          display: 'flex',
          flexDirection: 'column',
          height: 'calc(100vh - 170px)',
          overflowY: 'auto'
        }}>
          <div style={{ marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: '800', color: '#ffffff' }}>FRANCHISE STATUS</h3>
            <span style={{ fontSize: '0.7rem', color: 'var(--gold-primary)', fontFamily: 'JetBrains Mono, monospace' }}>
              PURSES & PENALTY COUNTERS
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {teams.map(t => (
              <div key={t.id} style={{ 
                background: 'rgba(16, 21, 29, 0.85)', 
                padding: '0.75rem', 
                borderRadius: '6px',
                border: t.isDisqualified ? '1px solid var(--crimson-border)' : '1px solid rgba(255, 255, 255, 0.04)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: '700', fontSize: '0.85rem', color: '#ffffff', textDecoration: t.isDisqualified ? 'line-through' : 'none' }}>
                      {t.name}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>
                      Roster: {t.players?.length || 0}/15
                    </div>
                  </div>
                  <div style={{ color: 'var(--gold-bright)', fontWeight: '800', fontSize: '0.95rem', fontFamily: 'JetBrains Mono, monospace' }}>
                    ₹{(t.budget / 10000000).toFixed(2)} Cr
                  </div>
                </div>
                
                {/* Penalty Status & Controls */}
                <div style={{ marginTop: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '0.4rem' }}>
                  <span style={{ fontSize: '0.7rem', color: t.mistakes >= 3 ? 'var(--crimson-danger)' : t.mistakes > 0 ? 'var(--amber-warning)' : 'var(--text-dim)', fontWeight: '700', fontFamily: 'JetBrains Mono, monospace' }}>
                    INFRACTIONS: {t.mistakes || 0}/3 {t.isDisqualified ? '[LOCKED]' : ''}
                  </span>
                  <div style={{ display: 'flex', gap: '0.35rem' }}>
                    {t.mistakes > 0 && (
                      <button 
                        className="btn btn-secondary" 
                        style={{ padding: '0.2rem 0.5rem', fontSize: '0.65rem' }}
                        onClick={() => reversePenalty(t.id)}
                      >
                        - REDUCE
                      </button>
                    )}
                    {!t.isDisqualified && (
                      <button 
                        className="btn btn-danger" 
                        style={{ padding: '0.2rem 0.5rem', fontSize: '0.65rem' }}
                        onClick={() => issuePenalty(t.id)}
                      >
                        + PENALTY
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
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
            ⚡ BROADCASTING SYNCHRONIZED COUNTDOWN ⚡
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
              ? 'Broadcasting to Team Leader War Rooms — First Lot Loading...' 
              : 'Gavel stage live — Lot #1 entering now!'}
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
              color: '#ffffff',
              fontSize: '1.5rem',
              fontWeight: '900',
              letterSpacing: '0.1em',
              boxShadow: '0 0 40px rgba(16, 185, 129, 0.6)'
            }}>
              LOT 1 LIVE ON STAGE
            </div>
          )}
        </div>
      )}
    </div>
  );
}
