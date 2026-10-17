import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  collection,
  query,
  where,
  onSnapshot,
  getDoc,
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'iplauction-5c41c.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'iplauction-5c41c',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'iplauction-5c41c.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(app);

const API_BASE = import.meta.env.VITE_API_URL || '';

class FirestoreAuctionRealtimeBridge {
  constructor() {
    this.listeners = new Map();
    this.activeUnsubscribers = [];
    this.currentLocationId = null;
    this.currentActivePlayerId = null;
    this.previousPlayerStates = new Map();
    this.previousTeamStates = new Map();
    this.previousLocationState = null;
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
    return this;
  }

  off(event, callback) {
    if (this.listeners.has(event)) {
      if (callback) {
        this.listeners.get(event).delete(callback);
      } else {
        this.listeners.delete(event);
      }
    }
    return this;
  }

  emitLocal(event, data) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach((cb) => {
        try {
          cb(data);
        } catch (err) {
          console.error(`[FirestoreRealtime] Error in ${event} listener:`, err);
        }
      });
    }
  }

  async emit(event, data) {
    try {
      if (event === 'joinLocation') {
        this.subscribeToLocation(data);
        return;
      }

      // Map auctioneer/team actions to atomic Next.js Route Handlers
      if (event === 'setLivePlayer') {
        await fetch(`${API_BASE}/api/auction/set-live`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
      } else if (event === 'placeBid') {
        await fetch(`${API_BASE}/api/bids`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
      } else if (event === 'reverseBid') {
        await fetch(`${API_BASE}/api/auction/reverse-bid`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
      } else if (event === 'sellPlayer') {
        await fetch(`${API_BASE}/api/auction/sell`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
      } else if (event === 'unsoldPlayer') {
        await fetch(`${API_BASE}/api/auction/unsold`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
      } else if (event === 'reopenPlayer') {
        await fetch(`${API_BASE}/api/auction/reopen`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
      } else if (event === 'toggleBreak') {
        this.emitLocal('auctionBreakToggled', {
          locationId: data.locationId,
          show: Boolean(data.show),
        });
        const res = await fetch(`${API_BASE}/api/auction/break`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        const resData = await res.json();
        if (resData && resData.paused !== undefined) {
          this.emitLocal('timerUpdated', resData);
        }
      } else if (event === 'toggleLeaderboard') {
        await fetch(`${API_BASE}/api/auction/leaderboard`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
      } else if (event === 'issuePenalty') {
        await fetch(`${API_BASE}/api/penalties`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
      } else if (event === 'reversePenalty') {
        await fetch(`${API_BASE}/api/penalties?teamId=${data.teamId}`, {
          method: 'DELETE',
        });
      } else if (event === 'startAuctionCountdown') {
        this.emitLocal('auctionStarting', {
          locationId: data.locationId,
          seconds: data.seconds || 5,
          deadlineMs: Date.now() + (data.seconds || 5) * 1000,
        });
        await fetch(`${API_BASE}/api/auction/start-countdown`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
      }
    } catch (error) {
      console.error(`[FirestoreRealtime] Failed to dispatch ${event}:`, error);
    }
  }

  subscribeToLocation(locationId) {
    const locIdStr = String(locationId);
    if (this.currentLocationId === locIdStr) return;

    // Unsubscribe previous listeners and intervals
    this.activeUnsubscribers.forEach((unsub) => {
      try {
        unsub();
      } catch (e) {}
    });
    this.activeUnsubscribers = [];
    this.currentLocationId = locIdStr;

    // 1. Authoritative Venue Document Listener (locations/{locationId})
    const locDocRef = doc(db, 'locations', locIdStr);
    const unsubLoc = onSnapshot(
      locDocRef,
      async (docSnap) => {
        if (!docSnap.exists()) return;
        const locData = docSnap.data();

        // Immediate Active Player synchronization directly from venue stage
        if (locData.activePlayerId && locData.activePlayerId !== this.currentActivePlayerId) {
          this.currentActivePlayerId = locData.activePlayerId;
          try {
            const pSnap = await getDoc(doc(db, 'players', locData.activePlayerId));
            if (pSnap.exists()) {
              const livePlayerData = {
                id: pSnap.id,
                ...pSnap.data(),
                timerDeadlineMs: locData.timerDeadlineMs,
              };
              this.emitLocal('livePlayerUpdated', livePlayerData);
            }
          } catch (err) {
            console.warn('[Firestore] Error fetching active player doc:', err);
          }
        } else if (!locData.activePlayerId && this.currentActivePlayerId) {
          this.currentActivePlayerId = null;
          this.emitLocal('livePlayerUpdated', null);
        }

        if (this.previousLocationState) {
          if (locData.isOnBreak !== this.previousLocationState.isOnBreak) {
            this.emitLocal('auctionBreakToggled', {
              locationId: locIdStr,
              show: locData.isOnBreak,
            });
          }
          if (locData.leaderboardVisible !== this.previousLocationState.leaderboardVisible) {
            this.emitLocal('leaderboardToggled', locData.leaderboardVisible);
          }
          if (
            locData.timerPaused !== this.previousLocationState.timerPaused ||
            locData.timerDeadlineMs !== this.previousLocationState.timerDeadlineMs ||
            locData.timerRemainingMs !== this.previousLocationState.timerRemainingMs
          ) {
            this.emitLocal('timerUpdated', {
              locationId: locIdStr,
              deadlineMs: locData.timerDeadlineMs,
              paused: Boolean(locData.timerPaused),
              remainingMs: locData.timerRemainingMs,
              durationSeconds: locData.timerDurationSeconds,
            });
          }
        }
        this.previousLocationState = locData;
      },
      (error) => console.warn('[Firestore] Location snapshot warning:', error)
    );
    this.activeUnsubscribers.push(unsubLoc);

    // 2. Direct Real-Time Listener for LIVE players (Ultra fast <50ms query)
    try {
      const livePlayersQuery = query(
        collection(db, 'players'),
        where('status', '==', 'LIVE')
      );
      const unsubLive = onSnapshot(
        livePlayersQuery,
        (snapshot) => {
          snapshot.docChanges().forEach((change) => {
            if (change.type === 'added' || change.type === 'modified') {
              const player = { id: change.doc.id, ...change.doc.data() };
              this.currentActivePlayerId = player.id;
              this.emitLocal('livePlayerUpdated', player);
            }
          });
        },
        (error) => console.warn('[Firestore] Live player query warning:', error)
      );
      this.activeUnsubscribers.push(unsubLive);
    } catch (err) {
      console.warn('[Firestore] Live query setup warning:', err);
    }

    // 3. Listen to Players collection for real-time bids, sales, unsold
    const playersQuery = query(
      collection(db, 'players'),
      where('locationId', '==', locIdStr)
    );
    const unsubPlayers = onSnapshot(
      playersQuery,
      (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          const player = { id: change.doc.id, ...change.doc.data() };
          const prev = this.previousPlayerStates.get(player.id);

          if (change.type === 'added' || change.type === 'modified') {
            // Live player transition
            if (player.status === 'LIVE' && (!prev || prev.status !== 'LIVE')) {
              this.currentActivePlayerId = player.id;
              this.emitLocal('livePlayerUpdated', player);
            }

            // New bid placed
            if (
              player.currentBid &&
              (!prev || prev.currentBid !== player.currentBid || prev.currentBidTeamId !== player.currentBidTeamId)
            ) {
              this.emitLocal('newBid', {
                playerId: player.id,
                teamId: player.currentBidTeamId,
                amount: player.currentBid,
                locationId: locIdStr,
              });
            }

            // Player sold
            if (player.status === 'SOLD' && (!prev || prev.status !== 'SOLD')) {
              if (this.currentActivePlayerId === player.id) {
                this.currentActivePlayerId = null;
              }
              this.emitLocal('playerSold', player);
            }

            // Player unsold
            if (player.status === 'UNSOLD' && (!prev || prev.status !== 'UNSOLD')) {
              if (this.currentActivePlayerId === player.id) {
                this.currentActivePlayerId = null;
              }
              this.emitLocal('playerUnsold', player);
            }

            // Player reopened
            if (
              player.status === 'LIVE' &&
              prev &&
              (prev.status === 'SOLD' || prev.status === 'UNSOLD')
            ) {
              this.currentActivePlayerId = player.id;
              this.emitLocal('playerReopened', player);
            }
          }

          this.previousPlayerStates.set(player.id, player);
        });
      },
      (error) => console.warn('[Firestore] Players snapshot warning:', error)
    );
    this.activeUnsubscribers.push(unsubPlayers);

    // 4. Listen to Teams for penalties and budget changes
    const teamsQuery = query(
      collection(db, 'teams'),
      where('locationId', '==', locIdStr)
    );
    const unsubTeams = onSnapshot(
      teamsQuery,
      (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          const team = { id: change.doc.id, ...change.doc.data() };
          const prev = this.previousTeamStates.get(team.id);

          if (
            prev &&
            (team.mistakes !== prev.mistakes || team.isDisqualified !== prev.isDisqualified)
          ) {
            this.emitLocal('penaltyIssued', {
              teamId: team.id,
              mistakes: team.mistakes || 0,
              isDisqualified: Boolean(team.isDisqualified),
            });
          }

          this.previousTeamStates.set(team.id, team);
        });
      },
      (error) => console.warn('[Firestore] Teams snapshot warning:', error)
    );
    this.activeUnsubscribers.push(unsubTeams);

    // 5. Zero-Lag Fast-Heartbeat Poller (guarantees update within 1.2s across dropped packets or mobile sleep)
    const poller = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE}/api/players?locationId=${locIdStr}`);
        if (!res.ok) return;
        const all = await res.json();
        const active = all.find((p) => p.status === 'LIVE');
        if (active && active.id !== this.currentActivePlayerId) {
          this.currentActivePlayerId = active.id;
          this.emitLocal('livePlayerUpdated', active);
        } else if (!active && this.currentActivePlayerId) {
          this.currentActivePlayerId = null;
        }
      } catch (e) {}
    }, 1200);
    this.activeUnsubscribers.push(() => clearInterval(poller));

    // 6. SSE Real-time Stream Bridge (Guarantees immediate zero-config synchronization)
    try {
      if (typeof window !== 'undefined' && window.EventSource) {
        const es = new EventSource(`${API_BASE}/api/events?locationId=${locIdStr}`);
        
        const eventNames = [
          'livePlayerUpdated',
          'newBid',
          'playerSold',
          'playerUnsold',
          'playerReopened',
          'bidReversed',
          'auctionBreakToggled',
          'leaderboardToggled',
          'penaltyIssued',
          'auctionStarting',
          'timerUpdated',
        ];

        eventNames.forEach((evName) => {
          es.addEventListener(evName, (e) => {
            try {
              const data = JSON.parse(e.data);
              this.emitLocal(evName, data);
            } catch (err) {
              console.warn('[SSE] Event parse warning:', err);
            }
          });
        });

        this.activeUnsubscribers.push(() => es.close());
      }
    } catch (err) {
      console.warn('[SSE] EventSource warning:', err);
    }
  }
}

const socket = new FirestoreAuctionRealtimeBridge();
export default socket;
