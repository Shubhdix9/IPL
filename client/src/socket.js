import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  collection,
  query,
  where,
  onSnapshot,
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'demo-api-key',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'demo-project.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'demo-project',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'demo-project.appspot.com',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '1234567890',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:1234567890:web:abcdef',
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(app);

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

class FirestoreAuctionRealtimeBridge {
  constructor() {
    this.listeners = new Map();
    this.activeUnsubscribers = [];
    this.currentLocationId = null;
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
        await fetch(`${API_BASE}/api/auction/break`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
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
      }
    } catch (error) {
      console.error(`[FirestoreRealtime] Failed to dispatch ${event}:`, error);
    }
  }

  subscribeToLocation(locationId) {
    const locIdStr = String(locationId);
    if (this.currentLocationId === locIdStr) return;

    // Unsubscribe previous listeners
    this.activeUnsubscribers.forEach((unsub) => unsub());
    this.activeUnsubscribers = [];
    this.currentLocationId = locIdStr;

    // 1. Listen to Location document for breaks, leaderboard, active player
    const locDocRef = doc(db, 'locations', locIdStr);
    const unsubLoc = onSnapshot(
      locDocRef,
      (docSnap) => {
        if (!docSnap.exists()) return;
        const locData = docSnap.data();

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
        }
        this.previousLocationState = locData;
      },
      (error) => console.warn('[Firestore] Location snapshot warning:', error)
    );
    this.activeUnsubscribers.push(unsubLoc);

    // 2. Listen to Players collection for real-time live player, bids, and sales
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
              this.emitLocal('playerSold', player);
            }

            // Player unsold
            if (player.status === 'UNSOLD' && (!prev || prev.status !== 'UNSOLD')) {
              this.emitLocal('playerUnsold', player);
            }

            // Player reopened
            if (
              player.status === 'LIVE' &&
              prev &&
              (prev.status === 'SOLD' || prev.status === 'UNSOLD')
            ) {
              this.emitLocal('playerReopened', player);
            }
          }

          this.previousPlayerStates.set(player.id, player);
        });
      },
      (error) => console.warn('[Firestore] Players snapshot warning:', error)
    );
    this.activeUnsubscribers.push(unsubPlayers);

    // 3. Listen to Teams for penalties and budget changes
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

    // 4. SSE Real-time Stream Bridge (Guarantees immediate zero-config synchronization)
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
