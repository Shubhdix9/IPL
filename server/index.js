const express = require('express');
const cors = require('cors');
let onRequest;
try {
  onRequest = require('firebase-functions/v2/https').onRequest;
} catch (e) {
  onRequest = null;
}
const { db, auth, admin } = require('./firestore-adapter');

const DEFAULT_PURSE = 900_000_000; // 90 Cr
const DEFAULT_FRANCHISES = ['CSK', 'MI', 'RCB', 'DC', 'KKR', 'PBKS', 'RR', 'SRH', 'LSG', 'GT'];

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10mb' }));

// Ensure seamless routing whether invoked directly as Cloud Function (/login) or via proxy (/api/login)
app.use((req, res, next) => {
  if (!req.url.startsWith('/api') && req.url !== '/' && !req.url.startsWith('/?')) {
    req.url = '/api' + req.url;
  }
  next();
});

// -----------------------------------------------------------------------------
// Real-time Event Broadcaster (SSE + Webhooks for multi-client synchrony)
// -----------------------------------------------------------------------------
const sseClients = new Map();

function broadcastEvent(locationId, eventType, data) {
  const locIdStr = String(locationId);
  const clients = sseClients.get(locIdStr);
  if (clients) {
    const payload = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
    clients.forEach((clientRes) => {
      try {
        clientRes.write(payload);
      } catch (err) {}
    });
  }

  // Also broadcast to global viewers
  const globalClients = sseClients.get('global');
  if (globalClients) {
    const payload = `event: ${eventType}\ndata: ${JSON.stringify({ ...data, locationId: locIdStr })}\n\n`;
    globalClients.forEach((clientRes) => {
      try {
        clientRes.write(payload);
      } catch (err) {}
    });
  }
}

// SSE stream endpoint
app.get('/api/events', (req, res) => {
  const locationId = String(req.query.locationId || 'global');
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });
  res.write('\n');

  if (!sseClients.has(locationId)) {
    sseClients.set(locationId, new Set());
  }
  sseClients.get(locationId).add(res);

  req.on('close', () => {
    const clients = sseClients.get(locationId);
    if (clients) {
      clients.delete(res);
      if (clients.size === 0) sseClients.delete(locationId);
    }
  });
});

// Helper function to log audit events
async function logAuditEvent(eventType, details, locationId) {
  try {
    await db.collection('audit_logs').add({
      eventType,
      details,
      locationId: locationId || null,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (err) {
    console.warn('[AuditLog] Warning:', err.message);
  }
}

// -----------------------------------------------------------------------------
// 1. Authentication
// -----------------------------------------------------------------------------
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const cleanUsername = username.trim().toLowerCase();
    const snap = await db.collection('users').where('username', '==', cleanUsername).limit(1).get();

    if (snap.empty) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const userDoc = snap.docs[0];
    const userData = userDoc.data();

    const expectedPassword = userData.passwordFallback || 'password';
    if (password !== expectedPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    let customToken = '';
    try {
      customToken = await auth.createCustomToken(userDoc.id, {
        role: userData.role,
        locationId: userData.locationId || null,
        teamId: userData.teamId || null,
      });
    } catch (e) {
      console.warn('[login] Token note:', e.message);
    }

    res.json({
      id: userDoc.id,
      uid: userDoc.id,
      username: userData.username,
      email: userData.email,
      role: userData.role,
      locationId: userData.locationId || null,
      teamId: userData.teamId || null,
      token: customToken,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -----------------------------------------------------------------------------
// 2. Teams
// -----------------------------------------------------------------------------
app.get('/api/teams', async (req, res) => {
  try {
    const [teamsSnap, playersSnap] = await Promise.all([
      db.collection('teams').get(),
      db.collection('players').where('status', '==', 'SOLD').get(),
    ]);

    const soldByTeam = new Map();
    playersSnap.forEach((pDoc) => {
      const p = { id: pDoc.id, ...pDoc.data() };
      if (p.teamId) {
        const list = soldByTeam.get(String(p.teamId)) || [];
        list.push(p);
        soldByTeam.set(String(p.teamId), list);
      }
    });

    const teams = teamsSnap.docs.map((tDoc) => ({
      id: tDoc.id,
      ...tDoc.data(),
      players: soldByTeam.get(tDoc.id) || [],
    }));

    res.json(teams);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/teams/:id/disqualify', async (req, res) => {
  try {
    const { isDisqualified } = req.body;
    const teamRef = db.collection('teams').doc(req.params.id);
    await teamRef.update({
      isDisqualified: Boolean(isDisqualified),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const updated = await teamRef.get();
    res.json({ id: updated.id, ...updated.data() });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// -----------------------------------------------------------------------------
// 3. Locations
// -----------------------------------------------------------------------------
app.get('/api/locations', async (req, res) => {
  try {
    const [locationsSnap, teamsSnap, usersSnap] = await Promise.all([
      db.collection('locations').orderBy('name', 'asc').get(),
      db.collection('teams').get(),
      db.collection('users').get(),
    ]);

    const teamsByLoc = new Map();
    teamsSnap.forEach((t) => {
      const data = { id: t.id, ...t.data() };
      const list = teamsByLoc.get(data.locationId) || [];
      list.push(data);
      teamsByLoc.set(data.locationId, list);
    });

    const usersByLoc = new Map();
    usersSnap.forEach((u) => {
      const data = { id: u.id, ...u.data() };
      const list = usersByLoc.get(data.locationId) || [];
      list.push(data);
      usersByLoc.set(data.locationId, list);
    });

    const locations = locationsSnap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      teams: teamsByLoc.get(doc.id) || [],
      users: usersByLoc.get(doc.id) || [],
    }));

    res.json(locations);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/locations', async (req, res) => {
  try {
    const { name, city } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });

    const normalizedName = name.trim();
    const locationRef = db.collection('locations').doc();
    const now = admin.firestore.FieldValue.serverTimestamp();

    await locationRef.set({
      name: normalizedName,
      city: city || normalizedName,
      isOnBreak: false,
      leaderboardVisible: false,
      activePlayerId: null,
      auctionStatus: 'UPCOMING',
      createdAt: now,
      updatedAt: now,
    });

    // Auto-create 10 franchise teams
    const batch = db.batch();
    for (const teamName of DEFAULT_FRANCHISES) {
      const teamRef = db.collection('teams').doc();
      batch.set(teamRef, {
        name: teamName,
        shortName: teamName,
        locationId: locationRef.id,
        budget: DEFAULT_PURSE,
        initialBudget: DEFAULT_PURSE,
        mistakes: 0,
        isDisqualified: false,
        createdAt: now,
        updatedAt: now,
      });

      const userRef = db.collection('users').doc();
      const cleanVenue = normalizedName.toLowerCase().replace(/[^a-z0-9]/g, '');
      const cleanTeam = teamName.toLowerCase().replace(/[^a-z0-9]/g, '');
      const username = `owner_${cleanTeam}_${cleanVenue}`;

      batch.set(userRef, {
        uid: userRef.id,
        username,
        email: `${username}@iplauction.local`,
        role: 'TEAM_LEADER',
        teamId: teamRef.id,
        locationId: locationRef.id,
        isActive: true,
        passwordFallback: 'password',
        createdAt: now,
        updatedAt: now,
      });
    }

    await batch.commit();
    res.json({ id: locationRef.id, name: normalizedName });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/locations/:id', async (req, res) => {
  try {
    const locationId = req.params.id;
    const batch = db.batch();

    const teamsSnap = await db.collection('teams').where('locationId', '==', locationId).get();
    teamsSnap.forEach((doc) => batch.delete(doc.ref));

    const playersSnap = await db.collection('players').where('locationId', '==', locationId).get();
    playersSnap.forEach((doc) => batch.delete(doc.ref));

    const bidsSnap = await db.collection('bids').where('locationId', '==', locationId).get();
    bidsSnap.forEach((doc) => batch.delete(doc.ref));

    batch.delete(db.collection('locations').doc(locationId));
    await batch.commit();

    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/locations/:locationId/players', async (req, res) => {
  try {
    const locationId = req.params.locationId;
    const [playersSnap, teamsSnap] = await Promise.all([
      db.collection('players').where('locationId', '==', locationId).get(),
      db.collection('teams').where('locationId', '==', locationId).get(),
    ]);

    const teamsMap = new Map();
    teamsSnap.forEach((t) => teamsMap.set(t.id, { id: t.id, ...t.data() }));

    const players = playersSnap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        team: data.teamId ? teamsMap.get(String(data.teamId)) || null : null,
      };
    });

    res.json(players);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/players', async (req, res) => {
  try {
    const locationId = req.query.locationId || 'main_arena';
    const [playersSnap, teamsSnap] = await Promise.all([
      db.collection('players').where('locationId', '==', locationId).get(),
      db.collection('teams').where('locationId', '==', locationId).get(),
    ]);

    const teamsMap = new Map();
    teamsSnap.forEach((t) => teamsMap.set(t.id, { id: t.id, ...t.data() }));

    const players = playersSnap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        team: data.teamId ? teamsMap.get(String(data.teamId)) || null : null,
      };
    });

    res.json(players);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// -----------------------------------------------------------------------------
// 4. Players
// -----------------------------------------------------------------------------
app.post('/api/players/bulk-global', async (req, res) => {
  try {
    const { players } = req.body;
    if (!Array.isArray(players) || !players.length) {
      return res.status(400).json({ error: 'Players array required' });
    }

    const locationsSnap = await db.collection('locations').get();
    if (locationsSnap.empty) {
      return res.status(400).json({ error: 'No venues found. Please create a venue first.' });
    }

    const now = admin.firestore.FieldValue.serverTimestamp();
    let count = 0;
    let batch = db.batch();
    let ops = 0;

    for (const locDoc of locationsSnap.docs) {
      for (const p of players) {
        const playerRef = db.collection('players').doc();
        batch.set(playerRef, {
          name: p.name.trim(),
          category: p.category || 'ALL_ROUNDER',
          basePrice: Number(p.basePrice) || 20_000_000,
          points: Number(p.points) || 0,
          pool: p.pool || null,
          country: p.country || 'IND',
          imageUrl: p.imageUrl || null,
          locationId: locDoc.id,
          status: 'UPCOMING',
          currentBid: null,
          currentBidTeamId: null,
          currentBidId: null,
          soldPrice: null,
          teamId: null,
          createdAt: now,
          updatedAt: now,
        });

        count++;
        ops++;
        if (ops >= 450) {
          await batch.commit();
          batch = db.batch();
          ops = 0;
        }
      }
    }

    if (ops > 0) {
      await batch.commit();
    }

    res.json({ success: true, count, locationsCount: locationsSnap.size });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/players', async (req, res) => {
  try {
    const [playersSnap, bidsSnap, teamsSnap] = await Promise.all([
      db.collection('players').get(),
      db.collection('bids').get(),
      db.collection('teams').get(),
    ]);

    let batch = db.batch();
    let ops = 0;

    for (const doc of playersSnap.docs) {
      batch.delete(doc.ref);
      ops++;
      if (ops >= 450) {
        await batch.commit();
        batch = db.batch();
        ops = 0;
      }
    }
    for (const doc of bidsSnap.docs) {
      batch.delete(doc.ref);
      ops++;
      if (ops >= 450) {
        await batch.commit();
        batch = db.batch();
        ops = 0;
      }
    }
    if (ops > 0) await batch.commit();

    const teamBatch = db.batch();
    teamsSnap.forEach((t) => {
      teamBatch.update(t.ref, {
        budget: DEFAULT_PURSE,
        mistakes: 0,
        isDisqualified: false,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });
    await teamBatch.commit();

    res.json({ success: true, message: 'All players deleted and team budgets reset.' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// -----------------------------------------------------------------------------
// 5. Users
// -----------------------------------------------------------------------------
app.get('/api/users', async (req, res) => {
  try {
    const [usersSnap, teamsSnap, locationsSnap] = await Promise.all([
      db.collection('users').get(),
      db.collection('teams').get(),
      db.collection('locations').get(),
    ]);

    const teamsMap = new Map();
    teamsSnap.forEach((t) => teamsMap.set(t.id, { id: t.id, ...t.data() }));

    const locationsMap = new Map();
    locationsSnap.forEach((l) => locationsMap.set(l.id, { id: l.id, ...l.data() }));

    const users = usersSnap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        uid: doc.id,
        username: data.username,
        email: data.email,
        role: data.role,
        locationId: data.locationId || null,
        teamId: data.teamId || null,
        password: data.passwordFallback || 'password',
        isActive: data.isActive !== false,
        team: data.teamId ? teamsMap.get(String(data.teamId)) || null : null,
        location: data.locationId ? locationsMap.get(String(data.locationId)) || null : null,
      };
    });

    res.json(users);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/users', async (req, res) => {
  try {
    const { username, password, role, teamId, locationId } = req.body;
    if (!username || !role) return res.status(400).json({ error: 'Username and role required' });

    const cleanUsername = username.trim().toLowerCase();
    const userRef = db.collection('users').doc();
    const now = admin.firestore.FieldValue.serverTimestamp();

    await userRef.set({
      uid: userRef.id,
      username: cleanUsername,
      email: `${cleanUsername}@iplauction.local`,
      role,
      teamId: teamId || null,
      locationId: locationId || null,
      isActive: true,
      passwordFallback: password || 'password',
      createdAt: now,
      updatedAt: now,
    });

    res.json({ id: userRef.id, username: cleanUsername, role });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/users/:id/password', async (req, res) => {
  try {
    const { password } = req.body;
    await db.collection('users').doc(req.params.id).update({
      passwordFallback: password,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/users/:id', async (req, res) => {
  try {
    await db.collection('users').doc(req.params.id).delete();
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// -----------------------------------------------------------------------------
// 6. Real-Time Auction Operations (Transaction-Safe)
// -----------------------------------------------------------------------------

// Bring next or selected player to the live block
app.post('/api/auction/set-live', async (req, res) => {
  try {
    const { locationId, playerId, durationSeconds } = req.body;
    if (!locationId) return res.status(400).json({ error: 'locationId required' });

    let targetPlayerId = playerId;

    // If no playerId provided, select the next UPCOMING player
    if (!targetPlayerId) {
      const nextSnap = await db
        .collection('players')
        .where('locationId', '==', locationId)
        .where('status', '==', 'UPCOMING')
        .limit(1)
        .get();

      if (nextSnap.empty) {
        return res.status(400).json({ error: 'No upcoming players in the queue' });
      }
      targetPlayerId = nextSnap.docs[0].id;
    }

    const duration = Number(durationSeconds) || 30;
    const nowMs = Date.now();
    const deadlineMs = nowMs + duration * 1000;

    const playerRef = db.collection('players').doc(targetPlayerId);
    const locationRef = db.collection('locations').doc(locationId);
    const now = admin.firestore.FieldValue.serverTimestamp();

    // Demote any previously LIVE player
    const existingLiveSnap = await db
      .collection('players')
      .where('locationId', '==', locationId)
      .where('status', '==', 'LIVE')
      .get();

    const batch = db.batch();
    existingLiveSnap.docs.forEach((d) => {
      if (d.id !== targetPlayerId) {
        batch.update(d.ref, {
          status: 'UNSOLD',
          updatedAt: now,
        });
      }
    });

    batch.update(playerRef, {
      status: 'LIVE',
      currentBid: null,
      currentBidTeamId: null,
      currentBidId: null,
      updatedAt: now,
    });

    batch.update(locationRef, {
      activePlayerId: targetPlayerId,
      auctionStatus: 'LIVE',
      timerDeadlineMs: deadlineMs,
      timerDurationSeconds: duration,
      timerPaused: false,
      timerRemainingMs: duration * 1000,
      updatedAt: now,
    });

    await batch.commit();

    const updated = await playerRef.get();
    const livePlayerData = { 
      id: updated.id, 
      ...updated.data(), 
      timerDeadlineMs: deadlineMs,
      timerDurationSeconds: duration 
    };
    await logAuditEvent('ADVANCE_PLAYER', { playerId: targetPlayerId, durationSeconds: duration }, locationId);
    broadcastEvent(locationId, 'livePlayerUpdated', livePlayerData);
    broadcastEvent(locationId, 'timerUpdated', { 
      locationId, 
      deadlineMs, 
      durationSeconds: duration, 
      paused: false,
      remainingMs: duration * 1000 
    });

    res.json(livePlayerData);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Start Global Auction Countdown (e.g. 5 seconds synced across all dashboards)
app.post('/api/auction/start-countdown', async (req, res) => {
  try {
    const { locationId, seconds = 5 } = req.body;
    const locId = locationId || 'main_arena';
    const duration = Math.max(1, Number(seconds) || 5);
    const deadlineMs = Date.now() + duration * 1000;

    const locRef = db.collection('locations').doc(locId);
    try {
      await locRef.update({
        startingCountdownDeadlineMs: deadlineMs,
        auctionStatus: 'STARTING',
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    } catch (e) {}

    const payload = {
      locationId: locId,
      deadlineMs,
      seconds: duration
    };

    broadcastEvent(locId, 'auctionStarting', payload);
    res.json({ success: true, ...payload });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Authoritative Timer Control: Start, Pause, Resume, Extend
app.post('/api/auction/timer', async (req, res) => {
  try {
    const { locationId, action, durationSeconds, addSeconds } = req.body;
    if (!locationId) return res.status(400).json({ error: 'locationId required' });

    const locationRef = db.collection('locations').doc(locationId);
    const nowMs = Date.now();

    const result = await db.runTransaction(async (t) => {
      const locDoc = await t.get(locationRef);
      if (!locDoc.exists) throw new Error('Location not found');
      const locData = locDoc.data();

      let newDeadlineMs = locData.timerDeadlineMs;
      let newPaused = Boolean(locData.timerPaused);
      let newRemainingMs = locData.timerRemainingMs;
      let newDuration = Number(durationSeconds) || Number(locData.timerDurationSeconds) || 30;

      if (action === 'start') {
        newPaused = false;
        newDeadlineMs = nowMs + newDuration * 1000;
        newRemainingMs = newDuration * 1000;
      } else if (action === 'pause') {
        if (!newPaused) {
          newRemainingMs = newDeadlineMs ? Math.max(0, newDeadlineMs - nowMs) : (Number(newRemainingMs) || (newDuration * 1000));
          newPaused = true;
          newDeadlineMs = null;
        }
      } else if (action === 'resume') {
        if (newPaused || !newDeadlineMs) {
          const rem = Number(newRemainingMs) || (newDuration * 1000);
          newDeadlineMs = nowMs + rem;
          newPaused = false;
        }
      } else if (action === 'extend') {
        const extraSec = Number(addSeconds) || 10;
        if (newPaused) {
          newRemainingMs = (Number(newRemainingMs) || 0) + extraSec * 1000;
        } else {
          const currentEnd = newDeadlineMs ? Math.max(nowMs, newDeadlineMs) : nowMs;
          newDeadlineMs = currentEnd + extraSec * 1000;
          newRemainingMs = Math.max(0, newDeadlineMs - nowMs);
        }
      } else if (action === 'set_duration') {
        newDuration = Number(durationSeconds) || 30;
        if (!newPaused) {
          newDeadlineMs = nowMs + newDuration * 1000;
          newRemainingMs = newDuration * 1000;
        }
      }

      const updatePayload = {
        timerDeadlineMs: newDeadlineMs,
        timerPaused: newPaused,
        timerRemainingMs: newRemainingMs,
        timerDurationSeconds: newDuration,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      t.update(locationRef, updatePayload);
      return { locationId, deadlineMs: newDeadlineMs, paused: newPaused, remainingMs: newRemainingMs, durationSeconds: newDuration };
    });

    // Also update any current live player in this arena
    try {
      const livePlayersSnap = await db.collection('players')
        .where('locationId', '==', String(locationId))
        .where('status', '==', 'LIVE')
        .limit(1)
        .get();
      if (!livePlayersSnap.empty) {
        await livePlayersSnap.docs[0].ref.update({
          timerDeadlineMs: result.deadlineMs,
          timerPaused: result.paused,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }
    } catch (e) {}

    broadcastEvent(locationId, 'timerUpdated', result);
    await logAuditEvent('TIMER_CONTROL', { action, ...result }, locationId);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Full Auction Reset (Emergency or Fresh Start)
app.post('/api/auction/reset', async (req, res) => {
  try {
    const { locationId, confirmText } = req.body;
    if (confirmText !== 'RESET') {
      return res.status(400).json({ error: 'Please confirm reset by providing confirmText: "RESET"' });
    }
    const locId = locationId || 'main_arena';

    // 1. Reset all players in this location to UPCOMING
    const playersSnap = await db.collection('players').where('locationId', '==', locId).get();
    const batch = db.batch();
    playersSnap.forEach((doc) => {
      batch.update(doc.ref, {
        status: 'UPCOMING',
        currentBid: null,
        currentBidTeamId: null,
        currentBidId: null,
        soldPrice: null,
        teamId: null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    });

    // 2. Reset all team budgets
    const teamsSnap = await db.collection('teams').where('locationId', '==', locId).get();
    teamsSnap.forEach((doc) => {
      batch.update(doc.ref, {
        budget: DEFAULT_PURSE,
        mistakes: 0,
        isDisqualified: false,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    });

    // 3. Reset location state
    const locRef = db.collection('locations').doc(locId);
    batch.update(locRef, {
      activePlayerId: null,
      auctionStatus: 'UPCOMING',
      timerDeadlineMs: null,
      timerPaused: false,
      timerRemainingMs: null,
      isOnBreak: false,
      leaderboardVisible: false,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    await batch.commit();

    broadcastEvent(locId, 'auctionReset', { locationId: locId });
    await logAuditEvent('AUCTION_RESET', { locationId: locId }, locId);
    res.json({ success: true, message: 'Auction reset successfully for location: ' + locId });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Place an authoritative bid
app.post('/api/bids', async (req, res) => {
  try {
    const { locationId, playerId, teamId, amount, autoExtendSeconds = 10 } = req.body;
    if (!locationId || !playerId || !teamId || !amount) {
      return res.status(400).json({ error: 'locationId, playerId, teamId, and amount are required' });
    }

    const numAmount = Math.round(Number(amount));
    const playerRef = db.collection('players').doc(playerId);
    const teamRef = db.collection('teams').doc(teamId);
    const locationRef = db.collection('locations').doc(locationId);

    const nowMs = Date.now();

    const result = await db.runTransaction(async (transaction) => {
      const [playerDoc, teamDoc, locationDoc] = await Promise.all([
        transaction.get(playerRef),
        transaction.get(teamRef),
        transaction.get(locationRef)
      ]);

      if (!playerDoc.exists) throw new Error('Player not found');
      if (!teamDoc.exists) throw new Error('Team not found');

      const playerData = playerDoc.data();
      const teamData = teamDoc.data();
      const locationData = locationDoc.exists ? locationDoc.data() : {};

      // 1. Authoritative Timer Deadline Validation
      if (locationData.timerPaused) {
        throw new Error('Auction bidding is currently paused by the auctioneer');
      }
      if (locationData.timerDeadlineMs && nowMs > locationData.timerDeadlineMs) {
        throw new Error('Bidding deadline has expired. Bid rejected.');
      }

      // 2. Player Status Validation
      if (playerData.status !== 'LIVE') {
        throw new Error(`Cannot bid: player status is ${playerData.status}, must be LIVE`);
      }
      if (teamData.isDisqualified) {
        throw new Error(`Cannot bid: team ${teamData.name} is disqualified`);
      }

      // 3. Budget Validation
      const teamBudget = Number(teamData.budget || 0);
      if (numAmount > teamBudget) {
        throw new Error(`Insufficient budget: ₹${(numAmount / 10_000_000).toFixed(2)} Cr exceeds remaining ₹${(teamBudget / 10_000_000).toFixed(2)} Cr`);
      }

      // 4. Increment and Current Price Validation
      const currentPrice = Number(playerData.currentBid || playerData.basePrice || 0);
      if (numAmount <= currentPrice) {
        throw new Error(`Bid must exceed current price of ₹${(currentPrice / 10_000_000).toFixed(2)} Cr`);
      }

      // Prevent a franchise from bidding against itself as current highest bidder
      if (playerData.currentBidTeamId && String(playerData.currentBidTeamId) === String(teamId)) {
        throw new Error('Your franchise currently holds the highest bid!');
      }

      const bidRef = db.collection('bids').doc();
      const now = admin.firestore.FieldValue.serverTimestamp();

      transaction.set(bidRef, {
        locationId,
        playerId,
        teamId,
        teamName: teamData.name || teamData.shortName,
        amount: numAmount,
        status: 'ACTIVE',
        createdAt: now,
      });

      transaction.update(playerRef, {
        currentBid: numAmount,
        currentBidTeamId: teamId,
        currentBidTeamName: teamData.name || teamData.shortName,
        currentBidId: bidRef.id,
        updatedAt: now,
      });

      // 5. Timer Extension on Final Seconds (e.g. if under 10 seconds remaining, extend)
      let updatedDeadline = locationData.timerDeadlineMs;
      if (locationData.timerDeadlineMs) {
        const remainingSeconds = Math.max(0, (locationData.timerDeadlineMs - nowMs) / 1000);
        if (remainingSeconds < 10) {
          updatedDeadline = nowMs + (Number(autoExtendSeconds) || 10) * 1000;
          transaction.update(locationRef, {
            timerDeadlineMs: updatedDeadline,
            timerRemainingMs: updatedDeadline - nowMs,
            updatedAt: now,
          });
        }
      }

      return {
        bidId: bidRef.id,
        playerId,
        teamId,
        teamName: teamData.name || teamData.shortName,
        amount: numAmount,
        locationId,
        updatedDeadlineMs: updatedDeadline
      };
    });

    await logAuditEvent('NEW_BID', result, locationId);
    broadcastEvent(locationId, 'newBid', result);
    if (result.updatedDeadlineMs) {
      broadcastEvent(locationId, 'timerUpdated', {
        locationId,
        deadlineMs: result.updatedDeadlineMs,
        paused: false,
        remainingMs: Math.max(0, result.updatedDeadlineMs - Date.now())
      });
    }
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Finalize sale (SOLD)
app.post('/api/auction/sell', async (req, res) => {
  try {
    const { locationId, playerId, teamId, amount } = req.body;
    if (!locationId || !playerId || !teamId || !amount) {
      return res.status(400).json({ error: 'locationId, playerId, teamId, and amount are required' });
    }

    const saleAmount = Math.round(Number(amount));
    const playerRef = db.collection('players').doc(playerId);
    const teamRef = db.collection('teams').doc(teamId);
    const locationRef = db.collection('locations').doc(locationId);

    const result = await db.runTransaction(async (transaction) => {
      const [pDoc, tDoc] = await Promise.all([
        transaction.get(playerRef),
        transaction.get(teamRef),
      ]);

      if (!pDoc.exists) throw new Error('Player not found');
      if (!tDoc.exists) throw new Error('Team not found');

      const pData = pDoc.data();
      const tData = tDoc.data();

      // Idempotency check
      if (pData.status === 'SOLD' && String(pData.teamId) === String(teamId) && Number(pData.soldPrice) === saleAmount) {
        return { success: true, player: { id: pDoc.id, ...pData } };
      }

      if (pData.status !== 'LIVE') {
        throw new Error(`Player is not LIVE (status: ${pData.status})`);
      }

      const currentBudget = Number(tData.budget || 0);
      if (currentBudget < saleAmount) {
        throw new Error(`Team budget insufficient: ₹${currentBudget / 10_000_000} Cr < ₹${saleAmount / 10_000_000} Cr`);
      }

      const newBudget = currentBudget - saleAmount;
      const now = admin.firestore.FieldValue.serverTimestamp();

      transaction.update(playerRef, {
        status: 'SOLD',
        soldPrice: saleAmount,
        teamId,
        updatedAt: now,
      });

      transaction.update(teamRef, {
        budget: newBudget,
        updatedAt: now,
      });

      transaction.update(locationRef, {
        activePlayerId: null,
        updatedAt: now,
      });

      if (pData.currentBidId) {
        transaction.update(db.collection('bids').doc(String(pData.currentBidId)), { status: 'WINNING' });
      }

      return {
        success: true,
        player: { id: pDoc.id, ...pData, status: 'SOLD', soldPrice: saleAmount, teamId },
        team: { id: tDoc.id, ...tData, budget: newBudget },
      };
    });

    await logAuditEvent('PLAYER_SOLD', { playerId, teamId, amount: saleAmount }, locationId);
    broadcastEvent(locationId, 'playerSold', result.player);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Mark UNSOLD
app.post('/api/auction/unsold', async (req, res) => {
  try {
    const { locationId, playerId } = req.body;
    const playerRef = db.collection('players').doc(playerId);
    const locationRef = db.collection('locations').doc(locationId);
    const now = admin.firestore.FieldValue.serverTimestamp();

    await db.runTransaction(async (transaction) => {
      transaction.update(playerRef, {
        status: 'UNSOLD',
        currentBid: null,
        currentBidTeamId: null,
        updatedAt: now,
      });

      transaction.update(locationRef, {
        activePlayerId: null,
        updatedAt: now,
      });
    });

    const updated = await playerRef.get();
    const unsoldPlayer = { id: updated.id, ...updated.data() };
    await logAuditEvent('PLAYER_UNSOLD', { playerId }, locationId);
    broadcastEvent(locationId, 'playerUnsold', unsoldPlayer);
    res.json(unsoldPlayer);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Reopen last sale and refund purse
app.post('/api/auction/reopen', async (req, res) => {
  try {
    const { locationId, playerId } = req.body;
    const playerRef = db.collection('players').doc(playerId);
    const locationRef = db.collection('locations').doc(locationId);

    const result = await db.runTransaction(async (transaction) => {
      const pDoc = await transaction.get(playerRef);
      if (!pDoc.exists) throw new Error('Player not found');

      const pData = pDoc.data();
      const now = admin.firestore.FieldValue.serverTimestamp();

      // If player was sold, refund the team
      if (pData.status === 'SOLD' && pData.teamId && pData.soldPrice) {
        const teamRef = db.collection('teams').doc(String(pData.teamId));
        const tDoc = await transaction.get(teamRef);
        if (tDoc.exists) {
          const tBudget = Number(tDoc.data().budget || 0);
          transaction.update(teamRef, {
            budget: tBudget + Number(pData.soldPrice),
            updatedAt: now,
          });
        }
      }

      transaction.update(playerRef, {
        status: 'LIVE',
        soldPrice: null,
        teamId: null,
        updatedAt: now,
      });

      transaction.update(locationRef, {
        activePlayerId: playerId,
        updatedAt: now,
      });

      return {
        success: true,
        player: { id: pDoc.id, ...pData, status: 'LIVE', soldPrice: null, teamId: null },
      };
    });

    await logAuditEvent('PLAYER_REOPENED', { playerId }, locationId);
    broadcastEvent(locationId, 'playerReopened', result.player);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Reverse latest bid
app.post('/api/auction/reverse-bid', async (req, res) => {
  try {
    const { locationId, playerId } = req.body;
    const playerRef = db.collection('players').doc(playerId);

    const result = await db.runTransaction(async (transaction) => {
      const pDoc = await transaction.get(playerRef);
      if (!pDoc.exists) throw new Error('Player not found');

      const pData = pDoc.data();
      const bidsSnap = await transaction.get(
        db.collection('bids')
          .where('playerId', '==', playerId)
          .where('status', '==', 'ACTIVE')
          .orderBy('createdAt', 'desc')
          .limit(2)
      );

      if (bidsSnap.empty) throw new Error('No active bids to reverse');

      const latestDoc = bidsSnap.docs[0];
      transaction.update(latestDoc.ref, {
        status: 'REVERSED',
        reversedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      let prevAmount = null;
      let prevTeamId = null;
      let prevBidId = null;

      if (bidsSnap.docs.length > 1) {
        const prior = bidsSnap.docs[1].data();
        prevAmount = prior.amount;
        prevTeamId = prior.teamId;
        prevBidId = bidsSnap.docs[1].id;
      }

      const now = admin.firestore.FieldValue.serverTimestamp();
      transaction.update(playerRef, {
        currentBid: prevAmount,
        currentBidTeamId: prevTeamId,
        currentBidId: prevBidId,
        updatedAt: now,
      });

      return {
        success: true,
        playerId,
        previousAmount: prevAmount,
        previousTeamId: prevTeamId,
        locationId,
      };
    });

    await logAuditEvent('REVERSE_BID', result, locationId);
    broadcastEvent(locationId, 'bidReversed', result);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Breaks & Leaderboard
app.post('/api/auction/break', async (req, res) => {
  try {
    const { locationId, show } = req.body;
    const locId = String(locationId || 'main_arena');
    const isBreak = Boolean(show);
    const locRef = db.collection('locations').doc(locId);
    const nowMs = Date.now();

    const result = await db.runTransaction(async (t) => {
      const locDoc = await t.get(locRef);
      if (!locDoc.exists) throw new Error('Location not found');
      const locData = locDoc.data();

      let newDeadlineMs = locData.timerDeadlineMs;
      let newPaused = Boolean(locData.timerPaused);
      let newRemainingMs = locData.timerRemainingMs;
      const duration = Number(locData.timerDurationSeconds) || 30;

      if (isBreak) {
        // Stop/freeze the timer and entire auction during official recess
        if (!newPaused && newDeadlineMs) {
          newRemainingMs = Math.max(0, newDeadlineMs - nowMs);
        } else if (!newRemainingMs) {
          newRemainingMs = duration * 1000;
        }
        newPaused = true;
        newDeadlineMs = null;
      } else {
        // Resume session: unpause and restart countdown from remaining time
        newPaused = false;
        const rem = Number(newRemainingMs) || (duration * 1000);
        newDeadlineMs = nowMs + rem;
      }

      const updatePayload = {
        isOnBreak: isBreak,
        timerPaused: newPaused,
        timerDeadlineMs: newDeadlineMs,
        timerRemainingMs: newRemainingMs,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      t.update(locRef, updatePayload);
      return {
        locationId: locId,
        isOnBreak: isBreak,
        deadlineMs: newDeadlineMs,
        paused: newPaused,
        remainingMs: newRemainingMs,
        durationSeconds: duration
      };
    });

    // Also sync current live player's timer state
    try {
      const livePlayersSnap = await db.collection('players')
        .where('locationId', '==', locId)
        .where('status', '==', 'LIVE')
        .limit(1)
        .get();
      if (!livePlayersSnap.empty) {
        await livePlayersSnap.docs[0].ref.update({
          timerDeadlineMs: result.deadlineMs,
          timerPaused: result.paused,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }
    } catch (e) {}

    broadcastEvent(locId, 'auctionBreakToggled', { locationId: locId, show: isBreak });
    broadcastEvent(locId, 'timerUpdated', {
      locationId: locId,
      deadlineMs: result.deadlineMs,
      paused: result.paused,
      remainingMs: result.remainingMs,
      durationSeconds: result.durationSeconds
    });

    await logAuditEvent('BREAK_TOGGLED', { show: isBreak, ...result }, locId);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/auction/leaderboard', async (req, res) => {
  try {
    const { locationId, show } = req.body;
    await db.collection('locations').doc(locationId).update({
      leaderboardVisible: Boolean(show),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    broadcastEvent(locationId, 'leaderboardToggled', Boolean(show));
    res.json({ success: true, locationId, leaderboardVisible: Boolean(show) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Penalties
app.post('/api/penalties', async (req, res) => {
  try {
    const { teamId } = req.body;
    const teamRef = db.collection('teams').doc(teamId);

    const result = await db.runTransaction(async (transaction) => {
      const tDoc = await transaction.get(teamRef);
      if (!tDoc.exists) throw new Error('Team not found');

      const mistakes = (tDoc.data().mistakes || 0) + 1;
      const isDisqualified = mistakes >= 3;

      transaction.update(teamRef, {
        mistakes,
        isDisqualified,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return { teamId, mistakes, isDisqualified, locationId: tDoc.data().locationId };
    });

    if (result.locationId) {
      broadcastEvent(result.locationId, 'penaltyIssued', result);
    }
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/penalties', async (req, res) => {
  try {
    const teamId = req.query.teamId;
    const teamRef = db.collection('teams').doc(teamId);

    const result = await db.runTransaction(async (transaction) => {
      const tDoc = await transaction.get(teamRef);
      if (!tDoc.exists) throw new Error('Team not found');

      const current = tDoc.data().mistakes || 0;
      const mistakes = Math.max(0, current - 1);
      const isDisqualified = mistakes >= 3;

      transaction.update(teamRef, {
        mistakes,
        isDisqualified,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return { teamId, mistakes, isDisqualified, locationId: tDoc.data().locationId };
    });

    if (result.locationId) {
      broadcastEvent(result.locationId, 'penaltyIssued', result);
    }
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Export 2nd Generation Cloud Function (if deployed to Firebase)
if (onRequest) {
  exports.api = onRequest({ cors: true, memory: '512MiB', timeoutSeconds: 60 }, app);
}

// Run local server when called directly
const PORT = process.env.PORT || 3001;
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`[IPL Auction Backend] Firebase Express server running on port ${PORT}`);
  });
}

module.exports = app;
