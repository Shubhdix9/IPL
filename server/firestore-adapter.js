const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

// Check if live Firebase or Emulator credentials are provided
const hasLiveCredentials = Boolean(
  (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) ||
  process.env.GOOGLE_APPLICATION_CREDENTIALS ||
  process.env.FIRESTORE_EMULATOR_HOST
);

let dbInstance = null;
let authInstance = null;

if (hasLiveCredentials) {
  if (!admin.apps.length) {
    const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'demo-project';
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY
      ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
      : undefined;

    if (clientEmail && privateKey) {
      admin.initializeApp({
        credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      });
    } else {
      admin.initializeApp({
        projectId,
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      });
    }
  }

  dbInstance = admin.firestore();
  authInstance = admin.auth();
  try {
    dbInstance.settings({ ignoreUndefinedProperties: true });
  } catch (e) {}
} else {
  // In-process resilient Firestore implementation for zero-dependency local runtime
  const dataDir = path.join(__dirname, 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  const storeFilePath = path.join(dataDir, 'firestore-store.json');

  let store = {
    locations: {},
    teams: {},
    players: {},
    bids: {},
    users: {},
    audit_logs: {},
  };

  const loadStore = () => {
    try {
      if (fs.existsSync(storeFilePath)) {
        const raw = fs.readFileSync(storeFilePath, 'utf8');
        store = JSON.parse(raw);
      }
    } catch (e) {
      console.warn('[FirestoreAdapter] Notice loading local store:', e.message);
    }
  };

  const saveStore = () => {
    try {
      fs.writeFileSync(storeFilePath, JSON.stringify(store, null, 2), 'utf8');
    } catch (e) {
      console.warn('[FirestoreAdapter] Notice saving local store:', e.message);
    }
  };

  loadStore();

  // Auto-seed default store if empty
  const defaultVenues = ['Mumbai', 'Delhi', 'Bangalore', 'Chennai'];
  const defaultTeams = ['CSK', 'MI', 'RCB', 'DC', 'KKR', 'PBKS', 'RR', 'SRH', 'LSG', 'GT'];

  if (Object.keys(store.locations).length === 0) {
    console.log('[FirestoreAdapter] Initializing local database with standard IPL seed data...');
    let teamCounter = 1;
    let userCounter = 1;

    // Admin user
    store.users['admin'] = {
      username: 'admin',
      email: 'admin@iplauction.com',
      role: 'ADMIN',
      passwordFallback: 'password',
      locationId: null,
      teamId: null,
      isActive: true,
      createdAt: new Date().toISOString(),
    };

    defaultVenues.forEach((vName, vIdx) => {
      const locId = String(vIdx + 1);
      store.locations[locId] = {
        name: vName,
        activePlayerId: null,
        isOnBreak: false,
        leaderboardVisible: false,
        createdAt: new Date().toISOString(),
      };

      // Auctioneer user
      const aucUsername = `auctioneer_${vName.toLowerCase()}`;
      store.users[aucUsername] = {
        username: aucUsername,
        email: `${aucUsername}@iplauction.com`,
        role: 'AUCTIONEER',
        passwordFallback: 'password',
        locationId: locId,
        teamId: null,
        isActive: true,
        createdAt: new Date().toISOString(),
      };

      defaultTeams.forEach((tName) => {
        const teamId = String(teamCounter++);
        store.teams[teamId] = {
          name: tName,
          budget: 900_000_000,
          locationId: locId,
          mistakes: 0,
          isDisqualified: false,
          createdAt: new Date().toISOString(),
        };

        // Team Leader user
        const tlUsername = `owner_${tName.toLowerCase()}_${vName.toLowerCase()}`;
        store.users[tlUsername] = {
          username: tlUsername,
          email: `${tlUsername}@iplauction.com`,
          role: 'TEAM_LEADER',
          passwordFallback: 'password',
          locationId: locId,
          teamId,
          isActive: true,
          createdAt: new Date().toISOString(),
        };
      });
    });

    // Populate Marquee Players from playerImageMap.json
    try {
      const imgMapPath = path.join(__dirname, '..', 'client', 'src', 'playerImageMap.json');
      if (fs.existsSync(imgMapPath)) {
        const rawMap = JSON.parse(fs.readFileSync(imgMapPath, 'utf8'));
        const playerNames = Object.keys(rawMap);
        let pCounter = 1;

        defaultVenues.forEach((_, vIdx) => {
          const locId = String(vIdx + 1);
          playerNames.forEach((name, idx) => {
            const pId = `p_${locId}_${pCounter++}`;
            const basePrice = idx < 5 ? 20_000_000 : idx < 15 ? 15_000_000 : 10_000_000;
            const category = idx % 4 === 0 ? 'BATSMAN' : idx % 4 === 1 ? 'BOWLER' : idx % 4 === 2 ? 'ALL_ROUNDER' : 'WICKET_KEEPER';
            const country = ['Virat Kohli', 'Rohit Sharma', 'MS Dhoni', 'Jasprit Bumrah', 'Hardik Pandya', 'Rishabh Pant'].includes(name) ? 'India' : 'Overseas';
            const pool = `POOL-${Math.floor(idx / 5) + 1}`;

            store.players[pId] = {
              name,
              category,
              basePrice,
              currentBid: null,
              currentBidTeamId: null,
              currentBidId: null,
              soldPrice: null,
              teamId: null,
              status: 'UPCOMING',
              pool,
              country,
              photo: rawMap[name] || null,
              locationId: locId,
              createdAt: new Date().toISOString(),
            };
          });
        });
      }
    } catch (err) {
      console.warn('[FirestoreAdapter] Warning seeding players:', err.message);
    }

    saveStore();
  }

  // Local Query & Document Reference Mock
  class LocalDocSnapshot {
    constructor(id, data, ref = null) {
      this.id = id;
      this._data = data ? JSON.parse(JSON.stringify(data)) : null;
      this.exists = Boolean(data);
      this.ref = ref;
    }
    data() {
      return this._data ? JSON.parse(JSON.stringify(this._data)) : undefined;
    }
  }

  class LocalQuerySnapshot {
    constructor(docs) {
      this.docs = docs;
      this.empty = docs.length === 0;
      this.size = docs.length;
    }
    forEach(callback) {
      this.docs.forEach(callback);
    }
  }

  class LocalDocRef {
    constructor(colName, id) {
      this.colName = colName;
      this.id = id;
    }

    async get() {
      loadStore();
      const col = store[this.colName] || {};
      const data = col[this.id];
      return new LocalDocSnapshot(this.id, data, this);
    }

    async set(data, options = {}) {
      loadStore();
      if (!store[this.colName]) store[this.colName] = {};
      const existing = store[this.colName][this.id] || {};
      store[this.colName][this.id] = options.merge
        ? { ...existing, ...data }
        : { ...data };
      saveStore();
    }

    async update(data) {
      loadStore();
      if (!store[this.colName] || !store[this.colName][this.id]) {
        throw new Error(`Document ${this.colName}/${this.id} does not exist`);
      }
      store[this.colName][this.id] = {
        ...store[this.colName][this.id],
        ...data,
      };
      saveStore();
    }

    async delete() {
      loadStore();
      if (store[this.colName]) {
        delete store[this.colName][this.id];
        saveStore();
      }
    }
  }

  class LocalQuery {
    constructor(colName, filters = [], limitCount = null, orderBys = []) {
      this.colName = colName;
      this.filters = filters;
      this.limitCount = limitCount;
      this.orderBys = orderBys;
    }

    where(field, op, value) {
      return new LocalQuery(
        this.colName,
        [...this.filters, { field, op, value: String(value) }],
        this.limitCount,
        this.orderBys
      );
    }

    limit(n) {
      return new LocalQuery(this.colName, this.filters, n, this.orderBys);
    }

    orderBy(field, direction = 'asc') {
      return new LocalQuery(this.colName, this.filters, this.limitCount, [
        ...this.orderBys,
        { field, direction },
      ]);
    }

    async get() {
      loadStore();
      const col = store[this.colName] || {};
      let items = Object.entries(col).map(([id, data]) => ({ id, ...data }));

      // Apply filters
      for (const f of this.filters) {
        items = items.filter((item) => {
          const val = item[f.field];
          if (f.op === '==') return String(val) === f.value;
          if (f.op === '!=') return String(val) !== f.value;
          if (f.op === '>') return val > f.value;
          if (f.op === '>=') return val >= f.value;
          if (f.op === '<') return val < f.value;
          if (f.op === '<=') return val <= f.value;
          return true;
        });
      }

      // Apply ordering
      for (const o of this.orderBys) {
        items.sort((a, b) => {
          const valA = a[o.field] || '';
          const valB = b[o.field] || '';
          if (valA < valB) return o.direction === 'desc' ? 1 : -1;
          if (valA > valB) return o.direction === 'desc' ? -1 : 1;
          return 0;
        });
      }

      // Apply limit
      if (this.limitCount !== null) {
        items = items.slice(0, this.limitCount);
      }

      const snapshots = items.map((item) => new LocalDocSnapshot(item.id, item, new LocalDocRef(this.colName, item.id)));
      return new LocalQuerySnapshot(snapshots);
    }
  }

  class LocalCollectionRef extends LocalQuery {
    constructor(colName) {
      super(colName);
    }

    doc(id) {
      const docId = id || `id_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      return new LocalDocRef(this.colName, String(docId));
    }

    async add(data) {
      const docId = `id_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      const docRef = this.doc(docId);
      await docRef.set(data);
      return docRef;
    }
  }

  class LocalBatch {
    constructor() {
      this.ops = [];
    }
    set(docRef, data, options) {
      this.ops.push(() => docRef.set(data, options));
      return this;
    }
    update(docRef, data) {
      this.ops.push(() => docRef.update(data));
      return this;
    }
    delete(docRef) {
      this.ops.push(() => docRef.delete());
      return this;
    }
    async commit() {
      for (const op of this.ops) {
        await op();
      }
    }
  }

  class LocalTransaction {
    async get(ref) {
      return ref.get();
    }
    set(ref, data, options) {
      return ref.set(data, options);
    }
    update(ref, data) {
      return ref.update(data);
    }
    delete(ref) {
      return ref.delete();
    }
  }

  dbInstance = {
    collection(name) {
      return new LocalCollectionRef(name);
    },
    doc(pathStr) {
      const [colName, docId] = pathStr.split('/');
      return new LocalDocRef(colName, docId);
    },
    batch() {
      return new LocalBatch();
    },
    async runTransaction(updateFn) {
      const transaction = new LocalTransaction();
      return await updateFn(transaction);
    },
  };

  authInstance = {
    async createCustomToken(uid, claims) {
      return `local_token_${uid}_${Buffer.from(JSON.stringify(claims || {})).toString('base64')}`;
    },
  };
}

module.exports = {
  db: dbInstance,
  auth: authInstance,
  admin,
  hasLiveCredentials,
};
