import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import socket from '../socket';
import { useAuth } from '../AuthContext';
import { teamThemes, getTeamTheme, resolveTeamKey, THEMED_FRANCHISE_KEYS } from '../config/teamThemes';
import styles from './ThemedTeamDashboard.module.css';

const API_URL = import.meta.env.VITE_API_URL || '';

// Shared Crown Glyph SVG used across the 5 themed franchise banners
const CrownGlyph = () => (
  <svg 
    className={styles.pbCrownIcon}
    viewBox="0 0 24 24" 
    width="26" 
    height="26" 
    fill="currentColor"
    aria-hidden="true"
  >
    <path d="M5 16L3 5L8.5 10L12 4L15.5 10L21 5L19 16H5ZM5 18C5 18.55 5.45 19 6 19H18C18.55 19 19 18.55 19 18V17H5V18Z" />
  </svg>
);

export default function TeamLeaderDashboard({ forcedTeamId }) {
  const { teamId: routeTeamId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [teams, setTeams] = useState([]);
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

  // Check if current user / franchise belongs to the 5 custom-themed franchises (DC, KKR, PBKS, RR, SRH)
  const themedKey = resolveTeamKey(user?.teamId) || 
                    resolveTeamKey(user?.username) || 
                    (teamData && (resolveTeamKey(teamData.shortName) || resolveTeamKey(teamData.name) || resolveTeamKey(teamData.id))) ||
                    resolveTeamKey(routeTeamId || forcedTeamId);

  const isThemedTeam = Boolean(themedKey && THEMED_FRANCHISE_KEYS.includes(themedKey));
  const theme = isThemedTeam ? getTeamTheme(themedKey) : null;

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

  // Fetch teams and match the authenticated user's exact team
  useEffect(() => {
    fetch(API_URL + '/api/teams')
      .then(res => {
        if (!res.ok) throw new Error(`HTTP error ${res.status}`);
        return res.json();
      })
      .then(data => {
        if (!Array.isArray(data)) return;
        setTeams(data);
        let myTeam = null;

        // 1. Match by user.teamId
        if (user?.teamId) {
          myTeam = data.find(t => String(t.id) === String(user.teamId));
        }

        // 2. Match by user.username (supports csk, owner_csk, mi, owner_mi, rr, owner_rr, etc.)
        if (!myTeam && user?.username) {
          const raw = user.username.toLowerCase();
          const clean = raw.replace(/^owner_/, '');
          myTeam = data.find(t => {
            const short = (t.shortName || t.franchiseCode || '').toLowerCase();
            const name = (t.name || '').toLowerCase();
            const id = (t.id || '').toLowerCase();
            return short === clean || name.includes(clean) || id.includes(clean) || id.includes(raw);
          });
        }

        // 3. Fallback to route or forced parameter (for preview routes like /team/:teamId)
        if (!myTeam && (routeTeamId || forcedTeamId)) {
          const param = (routeTeamId || forcedTeamId).toLowerCase();
          myTeam = data.find(t => {
            const short = (t.shortName || t.franchiseCode || '').toLowerCase();
            const name = (t.name || '').toLowerCase();
            const id = (t.id || '').toLowerCase();
            return short === param || name.includes(param) || id.includes(param);
          });
        }

        // 4. Default to first team if available
        if (!myTeam && data.length > 0) {
          myTeam = data[0];
        }

        if (myTeam) {
          setTeamData(myTeam);
        }
      })
      .catch((err) => {
        console.warn('API /teams note:', err.message);
      });
  }, [user, routeTeamId, forcedTeamId]);

  // Real-time socket events and location subscription
  useEffect(() => {
    if (!teamData) return;

    if (teamData.locationId) {
      socket.emit('joinLocation', teamData.locationId);
      fetch(`${API_URL}/api/players?locationId=${teamData.locationId}`)
        .then(r => r.ok ? r.json() : [])
        .then(players => {
          if (!Array.isArray(players)) return;
          const currentLive = players.find(p => p.status === 'LIVE');
          setLivePlayer(currentLive || null);
          if (currentLive?.timerDeadlineMs) {
            setTimerDeadline(currentLive.timerDeadlineMs);
            setTimerSecondsLeft(Math.max(0, Math.ceil((currentLive.timerDeadlineMs - Date.now()) / 1000)));
          }
        }).catch(console.warn);
    }

    const onPlayerSold = (player) => {
      const audio = document.getElementById('gavelSound');
      if (audio) {
        audio.currentTime = 0;
        audio.play().catch(e => console.log('Audio error:', e));
      }
      setLivePlayer(player);
      setTimerDeadline(null);
      setTimerSecondsLeft(null);
      if (player.teamId === parseInt(teamData.id) || String(player.teamId) === String(teamData.id)) {
        fetch(API_URL + '/api/teams')
          .then(r => r.ok ? r.json() : [])
          .then(data => {
            if (!Array.isArray(data)) return;
            const updated = data.find(t => String(t.id) === String(teamData.id));
            if (updated) setTeamData(updated);
          })
          .catch(console.warn);
      }
      setFeedLog(prev => [{ 
        id: Date.now() + Math.random(), 
        msg: `${player.name} SOLD for ₹${(player.soldPrice / 10000000).toFixed(2)} Cr`, 
        type: 'sold',
        time: new Date().toLocaleTimeString()
      }, ...prev].slice(0, 50));
    };

    const onPenaltyIssued = () => {
      fetch(API_URL + '/api/teams')
        .then(r => r.ok ? r.json() : [])
        .then(data => {
          if (!Array.isArray(data)) return;
          const updated = data.find(t => String(t.id) === String(teamData.id));
          if (updated) setTeamData(updated);
        })
        .catch(console.warn);
      setFeedLog(prev => [{ 
        id: Date.now() + Math.random(), 
        msg: `Penalty infraction recorded against franchise`, 
        type: 'penalty',
        time: new Date().toLocaleTimeString()
      }, ...prev].slice(0, 50));
    };

    const onNewBid = (data) => {
      setLivePlayer(prev => prev && prev.id === data.playerId ? { ...prev, currentBid: data.amount, currentBidTeamId: data.teamId } : prev);
      setFeedLog(prev => [{ 
        id: Date.now() + Math.random(), 
        msg: `New bid placed: ₹${(data.amount / 10000000).toFixed(2)} Cr`, 
        type: 'bid',
        time: new Date().toLocaleTimeString()
      }, ...prev].slice(0, 50));
    };

    const onLivePlayerUpdated = (player) => {
      setLivePlayer(player);
      if (player?.timerDeadlineMs) {
        setTimerDeadline(player.timerDeadlineMs);
        setTimerSecondsLeft(Math.max(0, Math.ceil((player.timerDeadlineMs - Date.now()) / 1000)));
        setTimerPaused(false);
      }
    };

    const onTimerUpdated = (data) => {
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
    };

    const onPlayerUnsold = (player) => {
      setLivePlayer(player);
      setTimerDeadline(null);
      setTimerSecondsLeft(null);
    };

    const onAuctionBreakToggled = (data) => {
      setIsBreakMode(Boolean(data.show));
      if (data.show) {
        setTimerPaused(true);
        setTimerDeadline(null);
        setFeedLog(prev => [{
          id: Date.now() + Math.random(),
          msg: `⏸️ OFFICIAL AUCTION RECESS IN EFFECT — BID MUTATIONS LOCKED`,
          type: 'alert',
          time: new Date().toLocaleTimeString()
        }, ...prev].slice(0, 50));
      } else {
        setTimerPaused(false);
        setFeedLog(prev => [{
          id: Date.now() + Math.random(),
          msg: `▶ AUCTION SESSION RESUMED — BIDDING PADDLES UNLOCKED`,
          type: 'alert',
          time: new Date().toLocaleTimeString()
        }, ...prev].slice(0, 50));
      }
    };

    const onLeaderboardToggled = (show) => {
      setShowLeaderboard(show);
    };

    const onAuctionStarting = (data) => {
      const remaining = data.seconds || 5;
      setAuctionStartingCountdown(remaining);
      setFeedLog(prev => [{ 
        id: Date.now() + Math.random(), 
        msg: `⚡ AUCTION STARTING in ${remaining}s — Gavel master initialized session!`, 
        type: 'alert',
        time: new Date().toLocaleTimeString()
      }, ...prev].slice(0, 50));
    };

    socket.on('playerSold', onPlayerSold);
    socket.on('penaltyIssued', onPenaltyIssued);
    socket.on('newBid', onNewBid);
    socket.on('livePlayerUpdated', onLivePlayerUpdated);
    socket.on('timerUpdated', onTimerUpdated);
    socket.on('playerUnsold', onPlayerUnsold);
    socket.on('auctionBreakToggled', onAuctionBreakToggled);
    socket.on('leaderboardToggled', onLeaderboardToggled);
    socket.on('auctionStarting', onAuctionStarting);

    return () => {
      socket.off('playerSold', onPlayerSold);
      socket.off('penaltyIssued', onPenaltyIssued);
      socket.off('newBid', onNewBid);
      socket.off('livePlayerUpdated', onLivePlayerUpdated);
      socket.off('timerUpdated', onTimerUpdated);
      socket.off('playerUnsold', onPlayerUnsold);
      socket.off('auctionBreakToggled', onAuctionBreakToggled);
      socket.off('leaderboardToggled', onLeaderboardToggled);
      socket.off('auctionStarting', onAuctionStarting);
    };
  }, [teamData]);

  if (!teamData) {
    return (
      <div style={{ padding: '4rem', textAlign: 'center', color: '#FAAE1A', fontFamily: 'JetBrains Mono, monospace' }}>
        INITIALIZING FRANCHISE WAR ROOM TELEMETRY...
      </div>
    );
  }

  // Derived telemetry data
  const players = teamData.players || [];
  const totalPoints = players.reduce((acc, p) => acc + (p.points || 0), 0);
  const batsmenCount = players.filter(p => p.category === 'BATSMAN').length;
  const bowlerCount = players.filter(p => p.category === 'BOWLER').length;
  const allRounderCount = players.filter(p => p.category === 'ALL_ROUNDER').length;
  const wkCount = players.filter(p => p.category === 'WICKET_KEEPER').length;
  const overseasCount = players.filter(p => p.country && p.country.toUpperCase() !== 'IND' && p.country.toUpperCase() !== 'INDIA').length;
  const budgetCr = (teamData.budget / 10000000).toFixed(2);
  const mistakes = teamData.mistakes || 0;

  const getAvatar = (name, url) => url || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=141b25&color=d4af37&size=128`;

  // Tournament Leaderboard modal view
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
                  <tr key={t.id} style={{ background: isMyTeam ? 'rgba(212, 175, 55, 0.15)' : 'transparent' }}>
                    <td style={{ fontWeight: '800', fontFamily: 'JetBrains Mono, monospace', color: index === 0 ? '#FAAE1A' : '#91A6BE' }}>
                      #{index + 1}
                    </td>
                    <td style={{ fontWeight: '700', color: isMyTeam ? '#FAAE1A' : '#ffffff' }}>
                      {t.name} {isMyTeam && <span className="badge badge-gold" style={{ marginLeft: '0.5rem', fontSize: '0.65rem' }}>YOUR TEAM</span>}
                    </td>
                    <td style={{ fontFamily: 'JetBrains Mono, monospace' }}>{(t.players || []).length} / 15</td>
                    <td style={{ color: '#FAAE1A', fontWeight: '700', fontFamily: 'JetBrains Mono, monospace' }}>
                      ₹{(t.budget / 10000000).toFixed(2)} Cr
                    </td>
                    <td style={{ fontWeight: '800', color: '#10B981', fontSize: '1.1rem', fontFamily: 'JetBrains Mono, monospace' }}>
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

  // Scoped CSS custom properties applied ONLY when one of the 5 custom themes is active
  const wrapperStyle = isThemedTeam && theme ? {
    '--team-primary': theme.colors.primary,
    '--team-secondary': theme.colors.secondary,
    '--team-tertiary': theme.colors.tertiary,
    '--accent-ui': theme.colors.accentUi,
    '--lifted-primary': theme.colors.liftedStrips.primary,
    '--lifted-secondary': theme.colors.liftedStrips.secondary,
  } : {};

  return (
    <>
      {/* Official Auction Recess Banner */}
      {isBreakMode && (
        <div style={{ 
          background: 'var(--amber-surface)', 
          borderBottom: '1px solid var(--amber-border)', 
          color: 'var(--amber-warning)', 
          textAlign: 'center', 
          padding: '0.65rem 1rem', 
          fontWeight: '800', 
          fontSize: '0.82rem', 
          letterSpacing: '0.14em', 
          textTransform: 'uppercase', 
          fontFamily: 'JetBrains Mono, monospace', 
          position: 'sticky', 
          top: '4.5rem', 
          zIndex: 90,
          backdropFilter: 'blur(8px)'
        }}>
          OFFICIAL AUCTION RECESS IN EFFECT — BID MUTATIONS CURRENTLY LOCKED
        </div>
      )}

      {/* =========================================================================
          BRANCH A: THEMED FRANCHISE DASHBOARD (For DC, KKR, PBKS, RR, SRH)
          ========================================================================= */}
      {isThemedTeam && theme ? (
        <div className={styles.pbDashboardWrapper} style={wrapperStyle}>

          {/* 1. HERO BANNER (~150px tall, multi-layer matching reference) */}
          <section className={styles.pbHeroBanner}>
            <div className={styles.pbHeroStripes} />

            <div className={styles.pbHeroPhotoWrap}>
              <img 
                className={styles.pbHeroPhotoImg}
                src={theme.assets.hero}
                style={{ objectPosition: theme.heroFocus }}
                alt={`${theme.name} Squad`}
              />
            </div>

            <div className={styles.pbHeroTint} />
            <div className={styles.pbHeroDarken} />

            <div className={styles.pbHeroContent}>
              <div className={styles.pbHeroLogoWrap}>
                <img 
                  className={styles.pbHeroLogo}
                  src={theme.assets.logoFull} 
                  alt={`${theme.name} Official Crest`}
                />
              </div>

              <div className={styles.pbHeroTitles}>
                <span className={styles.pbFranchiseLabel}>FRANCHISE</span>
                <h1 className={styles.pbTeamName}>{theme.name}</h1>
                <span className={styles.pbSloganSub}>{theme.slogan}</span>
              </div>

              <div className={styles.pbHeroSloganGraphic}>
                <CrownGlyph />
                {theme.sloganGraphic.map((line, idx) => (
                  <div key={idx} className={styles.pbSloganLine}>{line}</div>
                ))}
              </div>
            </div>
          </section>

          {/* 2. DASHBOARD BODY GRID (Full Screen Width) */}
          <div className={styles.pbDashboardGrid}>

            {/* LEFT SIDEBAR: FRANCHISE DESK & ROSTER PANEL */}
            <aside className={styles.pbSidebarCard}>
              <div className={styles.pbCardTopStrip}>
                <div className={styles.pbStripSeg1} />
                <div className={styles.pbStripSeg2} />
                <div className={styles.pbStripSeg3} />
              </div>

              <div className={styles.pbPanelHeaderStrip}>
                <svg className={styles.pbHeaderIcon} viewBox="0 0 24 24">
                  <path d="M12 2L15 8L21 9L17 14L18 20L12 17L6 20L7 14L3 9L9 8L12 2Z" />
                </svg>
                <span>{theme.code} TEAM PANEL</span>
              </div>

              <div className={styles.pbSidebarBody}>
                <div className={styles.pbFranchiseDeskWrap}>
                  <span className={styles.pbDeskSub}>
                    FRANCHISE DESK {user?.role !== 'TEAM_LEADER' && '(WAR ROOM MONITOR)'}
                  </span>
                  <h2 className={styles.pbDeskTitle}>{teamData.name}</h2>
                </div>

                {teamData.isDisqualified ? (
                  <div style={{ 
                    background: 'rgba(235, 87, 87, 0.15)', 
                    border: '1px solid rgba(235, 87, 87, 0.4)', 
                    padding: '0.85rem', 
                    borderRadius: '6px', 
                    marginBottom: '1rem', 
                    color: '#EB5757', 
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
                  <div className={styles.pbInfractionsRow}>
                    <span className={styles.pbInfractionsLabel}>
                      <span style={{ color: '#FFA502' }}>⚡</span> INFRACTIONS
                    </span>
                    <span className={`${styles.pbInfractionsVal} ${mistakes >= 2 ? styles.pbInfractionsValDanger : mistakes > 0 ? styles.pbInfractionsValWarning : ''}`}>
                      {mistakes} / 3
                    </span>
                  </div>
                )}

                <div className={styles.pbQuotaCard}>
                  <div className={styles.pbQuotaTitle}>MANDATORY QUOTA TRACKER</div>
                  <div className={styles.pbQuotaGrid}>
                    <div className={`${styles.pbQuotaItem} ${batsmenCount >= 3 ? styles.pbQuotaComplete : ''}`}>
                      <span>BAT:</span>
                      <span>{batsmenCount}/3</span>
                    </div>
                    <div className={`${styles.pbQuotaItem} ${bowlerCount >= 3 ? styles.pbQuotaComplete : ''}`}>
                      <span>BOWL:</span>
                      <span>{bowlerCount}/3</span>
                    </div>
                    <div className={`${styles.pbQuotaItem} ${allRounderCount >= 2 ? styles.pbQuotaComplete : ''}`}>
                      <span>AR:</span>
                      <span>{allRounderCount}/2</span>
                    </div>
                    <div className={`${styles.pbQuotaItem} ${wkCount >= 1 ? styles.pbQuotaComplete : ''}`}>
                      <span>WK:</span>
                      <span>{wkCount}/1</span>
                    </div>
                    <div className={`${styles.pbQuotaItem} ${styles.pbQuotaOverseas} ${overseasCount <= 4 ? '' : styles.pbInfractionsValDanger}`}>
                      <span>OVERSEAS:</span>
                      <span>{overseasCount}/4 MAX</span>
                    </div>
                  </div>
                </div>

                <div className={styles.pbRosterRow}>
                  <span className={styles.pbRosterLabel}>ROSTER OCCUPANCY</span>
                  <span className={styles.pbRosterVal}>
                    {players.length} <span className={styles.pbRosterMax}>/ 15</span>
                  </span>
                </div>

                <button 
                  type="button"
                  className={styles.pbCtaButton}
                  onClick={() => setShowSquad(true)}
                >
                  <span>👥</span> VIEW FULL SQUAD ROSTER
                </button>
              </div>

              <div className={styles.pbSidebarWatermark}>
                {theme.watermarkType === 'svg' ? (
                  <img 
                    className={styles.pbWatermarkSvg} 
                    src={theme.assets.emblemOutline} 
                    alt={`${theme.name} Watermark`}
                  />
                ) : (
                  <div 
                    className={styles.pbWatermarkFallback} 
                    style={{
                      WebkitMaskImage: `url(${theme.assets.emblemCrop})`,
                      maskImage: `url(${theme.assets.emblemCrop})`
                    }} 
                  />
                )}
              </div>
            </aside>

            {/* RIGHT COLUMN: WAR ROOM ACTION CENTER */}
            <main className={styles.pbMainColumn}>
              {/* Financial Telemetry Card */}
              <section className={styles.pbStatsCard}>
                <div className={styles.pbCardTopStrip}>
                  <div className={styles.pbStripSeg1} />
                  <div className={styles.pbStripSeg2} />
                  <div className={styles.pbStripSeg3} />
                </div>

                <div className={styles.pbStatsSweep} />

                <div className={styles.pbStatsGrid}>
                  <div className={`${styles.pbStatCol} ${styles.pbStatDivider}`}>
                    <span className={styles.pbStatLabel}>AVAILABLE PURSE</span>
                    <div className={styles.pbStatNumMonospace}>
                      ₹{budgetCr} Cr
                    </div>
                    <span className={styles.pbStatSubtext}>
                      Out of ₹90.00 Cr initial allocation
                    </span>
                  </div>

                  <div className={styles.pbStatCol}>
                    <span className={styles.pbStatLabel}>TOTAL SQUAD POINTS</span>
                    <div className={`${styles.pbStatNumMonospace} ${styles.pbStatPointsColor}`}>
                      {totalPoints}
                    </div>
                    <span className={styles.pbStatSubtext}>
                      Accumulated cricketer rating points
                    </span>
                  </div>
                </div>
              </section>

              {/* Current Live Lot & Bid Controls */}
              {livePlayer && (
                <section className={styles.pbLiveLotCard}>
                  <div className={styles.pbCardTopStrip}>
                    <div className={styles.pbStripSeg1} />
                    <div className={styles.pbStripSeg2} />
                    <div className={styles.pbStripSeg3} />
                  </div>

                  <div className={styles.pbLiveLotBody}>
                    <div className={styles.pbLiveLotHeader}>
                      <div className={styles.pbLiveLotTag}>
                        <span className={styles.pbLiveLotPulseDot} />
                        <span>ACTIVE LOT ON GAVEL STAGE</span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        {timerSecondsLeft !== null && (
                          <div className={`${styles.pbTimerBadge} ${timerPaused ? styles.pbTimerPaused : (timerSecondsLeft <= 5 ? styles.pbTimerWarning : '')}`}>
                            {timerPaused ? 'TIMER PAUSED' : `${timerSecondsLeft}s REMAINING`}
                          </div>
                        )}
                        <span className={`badge ${livePlayer.status === 'LIVE' ? 'badge-live' : livePlayer.status === 'SOLD' ? 'badge-sold' : 'badge-unsold'}`}>
                          {livePlayer.status}
                        </span>
                      </div>
                    </div>

                    <div className={styles.pbPlayerDetailGrid}>
                      <div className={styles.pbPlayerAvatarWrap}>
                        <img 
                          className={styles.pbPlayerAvatarImg}
                          src={getAvatar(livePlayer.name, livePlayer.imageUrl)} 
                          alt={livePlayer.name} 
                          onError={(e) => { e.target.style.display = 'none'; }} 
                        />
                      </div>

                      <div className={styles.pbPlayerInfoCol}>
                        <h2 className={styles.pbPlayerName}>{livePlayer.name}</h2>
                        
                        <div className={styles.pbPlayerPills}>
                          <span className={`${styles.pbPlayerPill} ${styles.pbPlayerPillAccent}`}>
                            {livePlayer.category ? livePlayer.category.replace('_', ' ') : 'CRICKETER'}
                          </span>
                          <span className={styles.pbPlayerPill}>
                            {livePlayer.country || 'DOMESTIC'}
                          </span>
                          <span className={styles.pbPlayerPill}>
                            POINTS: {livePlayer.points || 100}
                          </span>
                        </div>

                        <div className={styles.pbPlayerBidsRow}>
                          <div className={styles.pbBidCol}>
                            <span className={styles.pbBidLabel}>Base Price</span>
                            <span className={styles.pbBidValBase}>
                              ₹{(livePlayer.basePrice / 10000000).toFixed(2)} Cr
                            </span>
                          </div>
                          <div className={styles.pbBidCol}>
                            <span className={styles.pbBidLabel} style={{ color: 'var(--accent-ui)' }}>Highest Bid</span>
                            <span className={styles.pbBidValHigh}>
                              ₹{((livePlayer.currentBid || livePlayer.basePrice) / 10000000).toFixed(2)} Cr
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {livePlayer.status === 'LIVE' && livePlayer.currentBidTeamId && (
                      String(livePlayer.currentBidTeamId) === String(teamData.id) ? (
                        <div className={styles.pbWinningBanner}>
                          <span>[WINNING] YOUR FRANCHISE CURRENTLY HOLDS THE HIGHEST BID</span>
                          <span style={{ fontWeight: 900 }}>₹{((livePlayer.currentBid || livePlayer.basePrice) / 10000000).toFixed(2)} Cr</span>
                        </div>
                      ) : (
                        <div className={styles.pbOutbidBanner}>
                          <span>[OUTBID] LEADING BID: {teams.find(t => String(t.id) === String(livePlayer.currentBidTeamId))?.name || 'ANOTHER FRANCHISE'}</span>
                          <span style={{ fontWeight: 900 }}>₹{((livePlayer.currentBid || livePlayer.basePrice) / 10000000).toFixed(2)} Cr</span>
                        </div>
                      )
                    )}
                  </div>
                </section>
              )}

              {/* Arena Activity Stream */}
              <section className={styles.pbActivityCard}>
                <div className={styles.pbCardTopStrip}>
                  <div className={styles.pbStripSeg1} />
                  <div className={styles.pbStripSeg2} />
                  <div className={styles.pbStripSeg3} />
                </div>

                <div className={styles.pbActivityStripes} />
                <div className={styles.pbActivityGlow} />

                <div className={styles.pbActivityHeader}>
                  <span className={styles.pbBroadcastDot} />
                  <span>ARENA ACTIVITY STREAM</span>
                </div>

                <div className={styles.pbActivityContent}>
                  {feedLog.length === 0 ? (
                    <div className={styles.pbEmptyState}>
                      <span>📡</span> Waiting for arena actions...
                    </div>
                  ) : (
                    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {feedLog.map(item => (
                        <div 
                          key={item.id}
                          style={{
                            padding: '0.6rem 0.85rem',
                            background: 'rgba(16, 21, 29, 0.7)',
                            border: '1px solid rgba(255, 255, 255, 0.05)',
                            borderRadius: '4px',
                            fontSize: '0.82rem',
                            fontFamily: 'JetBrains Mono, monospace',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}
                        >
                          <span style={{ color: item.type === 'sold' ? '#10B981' : item.type === 'penalty' ? '#EB5757' : item.type === 'alert' ? '#FFA502' : '#FFFFFF' }}>
                            {item.msg}
                          </span>
                          <span style={{ color: '#91A6BE', fontSize: '0.72rem', marginLeft: '1rem', flexShrink: 0 }}>
                            {item.time || ''}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className={styles.pbActivityWatermark}>
                  {theme.watermarkType === 'svg' ? (
                    <img 
                      className={styles.pbWatermarkSvg} 
                      src={theme.assets.emblemOutline} 
                      alt="" 
                    />
                  ) : (
                    <div 
                      className={styles.pbWatermarkFallback} 
                      style={{
                        WebkitMaskImage: `url(${theme.assets.emblemCrop})`,
                        maskImage: `url(${theme.assets.emblemCrop})`
                      }} 
                    />
                  )}
                </div>
              </section>

            </main>
          </div>

          {/* Full Squad Modal for Themed View */}
          {showSquad && (
            <div className={styles.pbSquadModalOverlay} onClick={() => setShowSquad(false)}>
              <div className={styles.pbSquadModalBox} onClick={e => e.stopPropagation()}>
                <div className={styles.pbSquadModalHeader}>
                  <span className={styles.pbSquadModalTitle}>
                    {theme.name} Official Roster ({players.length}/15)
                  </span>
                  <button 
                    type="button"
                    onClick={() => setShowSquad(false)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#FFFFFF',
                      fontSize: '1.25rem',
                      cursor: 'pointer'
                    }}
                  >
                    ✕
                  </button>
                </div>

                <div className={styles.pbSquadModalBody}>
                  {players.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '2rem', color: '#91A6BE', fontFamily: 'JetBrains Mono, monospace' }}>
                      No players acquired yet in this auction session.
                    </div>
                  ) : (
                    players.map((p, i) => (
                      <div key={p.id || i} className={styles.pbPlayerRow}>
                        <div>
                          <div style={{ fontWeight: '800', color: '#FFFFFF', fontSize: '0.9rem' }}>{p.name}</div>
                          <div style={{ fontSize: '0.72rem', color: '#91A6BE', fontFamily: 'JetBrains Mono, monospace' }}>
                            {p.category ? p.category.replace('_', ' ') : 'CRICKETER'} | {p.country || 'IND'}
                          </div>
                        </div>
                        <div style={{ fontWeight: '800', color: 'var(--accent-ui)', fontFamily: 'JetBrains Mono, monospace' }}>
                          ₹{((p.soldPrice || 0) / 10000000).toFixed(2)} Cr
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

        </div>
      ) : (
        /* =========================================================================
           BRANCH B: DEFAULT THEME DASHBOARD (For CSK, MI, RCB, LSG, GT, etc.)
           Original clean Carbon & Champagne Gold war room layout from what we started.
           ========================================================================= */
        <div style={{ width: '100%', padding: '0 0 2rem 0' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '1.5rem', marginTop: '0.5rem', width: '100%' }}>
            
            {/* LEFT COLUMN: FRANCHISE ROSTER TRACKER */}
            <div style={{ 
              background: 'rgba(10, 13, 18, 0.85)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '8px',
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              minHeight: 'calc(100vh - 120px)',
              overflow: 'hidden'
            }}>
              
              <div style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '1rem', marginBottom: '1.25rem' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--gold-primary)', fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
                  FRANCHISE DESK {user?.role !== 'TEAM_LEADER' && '(WAR ROOM MONITOR)'}
                </span>
                <h2 style={{ fontSize: '1.4rem', color: '#ffffff', fontWeight: '800', margin: '0.2rem 0 0 0' }}>
                  {teamData.name}
                </h2>
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
                    color: mistakes > 0 ? 'var(--amber-warning)' : 'var(--text-secondary)', 
                    fontWeight: '700', 
                    fontSize: '0.85rem',
                    fontFamily: 'JetBrains Mono, monospace'
                  }}>
                    {mistakes} / 3
                  </span>
                </div>
              )}

              {/* Mandatory Quota Tracker */}
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
                    {players.length} <span style={{ color: 'var(--text-dim)', fontSize: '0.75rem' }}>/ 15</span>
                  </span>
                </div>
                
                <button 
                  type="button"
                  className="btn btn-secondary" 
                  style={{ width: '100%', marginBottom: '1.25rem', padding: '0.65rem', fontSize: '0.75rem' }} 
                  onClick={() => setShowSquad(!showSquad)}
                >
                  {showSquad ? 'HIDE SQUAD ROSTER' : 'VIEW FULL SQUAD ROSTER'}
                </button>

                {/* Squad List */}
                {showSquad && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
                    {players.length === 0 ? (
                      <div style={{ color: 'var(--text-dim)', fontSize: '0.78rem', fontStyle: 'italic', padding: '0.5rem 0' }}>
                        No players acquired yet.
                      </div>
                    ) : (
                      players.map(p => (
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
                              {p.category ? p.category.replace('_', ' ') : 'PLAYER'}
                            </div>
                          </div>
                          <div style={{ fontWeight: '700', color: 'var(--gold-bright)', fontSize: '0.88rem', fontFamily: 'JetBrains Mono, monospace' }}>
                            ₹{((p.soldPrice || 0) / 10000000).toFixed(2)} Cr
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
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
                    ₹{budgetCr} Cr
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
                        <span className="badge badge-gold">{livePlayer.category ? livePlayer.category.replace('_', ' ') : 'CRICKETER'}</span>
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
        </div>
      )}

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
            border: '1px solid #FAAE1A',
            borderRadius: '50px',
            color: '#FAAE1A',
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
            color: '#91A6BE',
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
              border: '4px solid #FAAE1A',
              boxShadow: '0 0 60px rgba(212, 175, 55, 0.5), inset 0 0 40px rgba(212, 175, 55, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '6rem',
              fontWeight: '900',
              color: '#FAAE1A',
              fontFamily: 'JetBrains Mono, monospace'
            }}>
              {auctionStartingCountdown}
            </div>
          ) : (
            <div style={{
              padding: '1.1rem 3.5rem',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #10B981, #059669)',
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
            color: '#91A6BE',
            fontFamily: 'JetBrains Mono, monospace'
          }}>
            FRANCHISE DESK: <strong style={{ color: '#ffffff' }}>{teamData?.name || 'INITIALIZING'}</strong> &bull; PURSE: ₹{budgetCr} CR
          </div>
        </div>
      )}

      <audio id="gavelSound" src="https://www.soundjay.com/misc/sounds/gavel-banging-1.mp3" preload="auto"></audio>
    </>
  );
}
