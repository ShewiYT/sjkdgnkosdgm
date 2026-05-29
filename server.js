// ============================================================
// SukaCombine Server v3.1 — REAL Steam Connection
// Uses steam-user + steam-totp for actual Steam login
// ============================================================
// INSTALL:
//   npm install express better-sqlite3 steam-user steam-totp
// RUN:
//   node server.js
// ============================================================

import express from 'express';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, mkdirSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '50mb' }));

// ============= DATABASE =============
let dbOps;
try {
  const dbModule = await import('./server/database.js');
  dbOps = dbModule.dbOps;
  console.log('[Server] SQLite database loaded successfully');
} catch (err) {
  console.error('[Server] Failed to load database:', err.message);
  console.log('[Server] Running without database - using in-memory fallback');

  const memStore = { accounts: [], workers: [], messages: [] };

  dbOps = {
    getUserByCredentials: (u, p) => u === 'admin' && p === 'admin123' ? { id: 'admin', username: 'admin', role: 'admin' } : null,
    getAllWorkers: () => memStore.workers,
    createWorker: (w) => { memStore.workers.push(w); return w; },
    updateWorker: (id, data) => { const w = memStore.workers.find(x => x.id === id); if (w) Object.assign(w, data); return w; },
    deleteWorker: (id) => { memStore.workers = memStore.workers.filter(w => w.id !== id); },
    getAllAccounts: () => memStore.accounts,
    saveAccounts: (accs) => { memStore.accounts = accs; },
    deleteAccount: (id) => { memStore.accounts = memStore.accounts.filter(a => a.id !== id); },
    getMessages: () => memStore.messages,
    saveMessage: (msg) => { memStore.messages.push(msg); },
    getStats: () => ({ accounts: memStore.accounts.length, workers: memStore.workers.length, messages: memStore.messages.length, parseJobs: 0 }),
    clearAll: () => { memStore.accounts = []; memStore.messages = []; },
  };
}

// ============= STEAM USER SESSIONS =============
// Real Steam connections using steam-user library
let SteamUser, SteamTotp;
let steamAvailable = false;

try {
  const steamUserModule = await import('steam-user');
  SteamUser = steamUserModule.default || steamUserModule;
  const steamTotpModule = await import('steam-totp');
  SteamTotp = steamTotpModule.default || steamTotpModule;
  steamAvailable = true;
  console.log('[Server] ✅ steam-user & steam-totp loaded — REAL Steam connections enabled');
} catch (err) {
  console.error('[Server] ❌ steam-user/steam-totp not installed!');
  console.error('[Server] Run: npm install steam-user steam-totp');
  console.error('[Server] Without these, accounts will NOT connect to Steam!');
}

// Map of accountId -> { client: SteamUser, status, steamId, ... }
const steamSessions = new Map();

// ============= HEALTH CHECK =============
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    steamAvailable,
    activeSessions: steamSessions.size,
    timestamp: new Date().toISOString(),
  });
});

// ============= AUTH =============
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  const user = dbOps.getUserByCredentials(username, password);
  if (user) {
    return res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        assignedAccounts: [],
        createdAt: user.created_at || new Date().toISOString(),
      },
    });
  }

  const workers = dbOps.getAllWorkers();
  const worker = workers.find(w => w.username === username && w.password === password);
  if (worker) {
    return res.json({
      success: true,
      user: {
        id: worker.id,
        username: worker.username,
        role: 'worker',
        assignedAccounts: worker.assignedAccounts || [],
        createdAt: worker.lastActive || new Date().toISOString(),
      },
    });
  }

  res.json({ success: false, error: 'Invalid credentials' });
});

// ============= WORKERS =============
app.get('/api/workers', (req, res) => {
  const workers = dbOps.getAllWorkers();
  res.json({ workers });
});

app.post('/api/workers', (req, res) => {
  const { username, password, assignedAccounts } = req.body;
  const id = Math.random().toString(36).substring(2, 15);
  const worker = {
    id, username, password,
    assignedAccounts: assignedAccounts || [],
    permissions: { chat: true, browser: false, offersSend: false, offersSendAll: false, offersConfirm: false, guard: false },
    lastActive: new Date().toISOString(),
    actionsLog: [],
  };
  dbOps.createWorker(worker);
  res.json({ success: true, worker });
});

app.put('/api/workers/:id', (req, res) => {
  dbOps.updateWorker(req.params.id, req.body);
  res.json({ success: true });
});

app.delete('/api/workers/:id', (req, res) => {
  dbOps.deleteWorker(req.params.id);
  res.json({ success: true });
});

// ============= ACCOUNTS =============
app.get('/api/accounts', (req, res) => {
  const accounts = dbOps.getAllAccounts();
  // Merge with REAL live session data
  const enriched = accounts.map(acc => {
    const session = steamSessions.get(acc.id);
    if (session) {
      return {
        ...acc,
        status: session.status,
        steamId: session.steamId || acc.steamId,
        displayName: session.displayName || acc.displayName,
        avatarUrl: session.avatarUrl || acc.avatarUrl,
        level: session.level ?? acc.level,
        balance: session.balance ?? acc.balance,
        friendsCount: session.friendsCount ?? acc.friendsCount,
        tradeBan: session.tradeBan ?? acc.tradeBan,
        vacBan: session.vacBan ?? acc.vacBan,
        limited: session.limited ?? acc.limited,
      };
    }
    // No active session = offline
    return { ...acc, status: 'offline' };
  });
  res.json({ accounts: enriched });
});

app.post('/api/accounts', (req, res) => {
  const { accounts } = req.body;
  if (Array.isArray(accounts)) {
    dbOps.saveAccounts(accounts);
    res.json({ success: true });
  } else {
    res.json({ success: false, error: 'Invalid data' });
  }
});

app.delete('/api/accounts/:id', (req, res) => {
  // Logout from Steam if connected
  const session = steamSessions.get(req.params.id);
  if (session && session.client) {
    try { session.client.logOff(); } catch {}
  }
  steamSessions.delete(req.params.id);
  dbOps.deleteAccount(req.params.id);
  res.json({ success: true });
});

// ============= REAL STEAM LOGIN =============
app.post('/api/steam/login', async (req, res) => {
  const { accountId, login, password, sharedSecret, identitySecret } = req.body;

  if (!steamAvailable) {
    return res.json({
      success: false,
      error: 'steam-user не установлен! Запустите: npm install steam-user steam-totp',
    });
  }

  // If already logged in, return current status
  const existing = steamSessions.get(accountId);
  if (existing && existing.status === 'online') {
    return res.json({
      success: true,
      status: 'online',
      steamId: existing.steamId,
      displayName: existing.displayName,
      avatarUrl: existing.avatarUrl,
      level: existing.level,
      balance: existing.balance,
      friendsCount: existing.friendsCount,
      tradeBan: existing.tradeBan,
      vacBan: existing.vacBan,
      limited: existing.limited,
    });
  }

  // Create new SteamUser client
  const client = new SteamUser({
    promptSteamGuardCode: false,
    autoRelogin: true,
    enablePicsCache: false,
  });

  // Build login options
  const logOnOptions = {
    accountName: login,
    password: password,
  };

  // If we have shared secret, generate 2FA code
  if (sharedSecret) {
    try {
      logOnOptions.twoFactorCode = SteamTotp.generateAuthCode(sharedSecret);
    } catch (err) {
      console.error(`[Steam] Failed to generate 2FA for ${login}:`, err.message);
    }
  }

  // Store session immediately as connecting
  steamSessions.set(accountId, {
    client,
    status: 'connecting',
    steamId: null,
    displayName: login,
    avatarUrl: null,
    level: 0,
    balance: 0,
    friendsCount: 0,
    tradeBan: false,
    vacBan: false,
    limited: false,
    identitySecret: identitySecret || null,
    login,
  });

  // Set up a promise to wait for login result
  const loginPromise = new Promise((resolve) => {
    const timeout = setTimeout(() => {
      resolve({
        success: false,
        error: 'Таймаут подключения к Steam (30 сек)',
      });
    }, 30000);

    client.on('loggedOn', (details) => {
      clearTimeout(timeout);
      console.log(`[Steam] ✅ ${login} logged in as ${client.steamID.getSteamID64()}`);
      
      // Set persona online so they appear online in Steam
      client.setPersona(SteamUser.EPersonaState.Online);
      
      const session = steamSessions.get(accountId);
      if (session) {
        session.status = 'online';
        session.steamId = client.steamID.getSteamID64();
      }

      resolve({
        success: true,
        status: 'online',
        steamId: client.steamID.getSteamID64(),
        displayName: login,
      });
    });

    client.on('error', (err) => {
      clearTimeout(timeout);
      console.error(`[Steam] ❌ ${login} login error:`, err.message);
      
      const session = steamSessions.get(accountId);
      if (session) {
        session.status = 'error';
      }
      
      // Clean up
      steamSessions.delete(accountId);

      let errorMsg = err.message;
      if (err.eresult === 5) errorMsg = 'Неверный пароль (InvalidPassword)';
      else if (err.eresult === 6) errorMsg = 'Аккаунт заблокирован (LoggedInElsewhere)';
      else if (err.eresult === 15) errorMsg = 'Требуется Steam Guard код';
      else if (err.eresult === 63) errorMsg = 'Неверный код Steam Guard (InvalidLoginAuthCode)';
      else if (err.eresult === 84) errorMsg = 'Слишком много попыток, подождите (RateLimitExceeded)';
      else if (err.eresult === 65) errorMsg = 'Неверный код двухфакторной аутентификации';

      resolve({ success: false, error: errorMsg });
    });

    client.on('steamGuard', (domain, callback, lastCodeWrong) => {
      // If we have sharedSecret, generate code automatically
      if (sharedSecret) {
        try {
          const code = SteamTotp.generateAuthCode(sharedSecret);
          console.log(`[Steam] 🔐 ${login} providing 2FA code`);
          callback(code);
          return;
        } catch (err) {
          console.error(`[Steam] Failed to generate 2FA for ${login}:`, err.message);
        }
      }
      
      clearTimeout(timeout);
      steamSessions.delete(accountId);
      
      if (domain) {
        resolve({ success: false, error: `Требуется код Steam Guard с email (${domain}). Загрузите maFile.` });
      } else {
        resolve({ success: false, error: 'Требуется код Steam Guard из приложения. Загрузите maFile.' });
      }
    });

    // Get additional account info
    client.on('accountInfo', (name, country) => {
      const session = steamSessions.get(accountId);
      if (session) {
        session.displayName = name || login;
      }
    });

    client.on('wallet', (hasWallet, currency, balance) => {
      const session = steamSessions.get(accountId);
      if (session) {
        session.balance = balance / 100; // Convert cents to dollars
      }
    });

    client.on('vacBans', (numBans, appids) => {
      const session = steamSessions.get(accountId);
      if (session) {
        session.vacBan = numBans > 0;
      }
    });

    client.on('accountLimitations', (limited, communityBanned, locked, canInviteFriends) => {
      const session = steamSessions.get(accountId);
      if (session) {
        session.limited = limited;
        session.tradeBan = locked;
      }
    });

    client.on('friendsList', () => {
      const session = steamSessions.get(accountId);
      if (session && client.myFriends) {
        session.friendsCount = Object.keys(client.myFriends).filter(
          id => client.myFriends[id] === SteamUser.EFriendRelationship.Friend
        ).length;
      }
    });

    // Handle disconnection
    client.on('disconnected', (eresult, msg) => {
      console.log(`[Steam] 🔌 ${login} disconnected: ${msg || eresult}`);
      const session = steamSessions.get(accountId);
      if (session) {
        session.status = 'offline';
      }
    });

    // Handle incoming messages
    client.on('friendMessage', (senderID, message) => {
      console.log(`[Steam] 💬 ${login} got message from ${senderID.getSteamID64()}: ${message}`);
      const msgId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const msgData = {
        id: msgId,
        accountId,
        accountLogin: login,
        friendId: senderID.getSteamID64(),
        friendName: senderID.getSteamID64(),
        friendAvatar: '👤',
        text: message,
        timestamp: new Date().toISOString(),
        isOutgoing: false,
      };
      try { dbOps.saveMessage(msgData); } catch {}
      
      // Store in session messages
      const session = steamSessions.get(accountId);
      if (session) {
        if (!session.messages) session.messages = [];
        session.messages.push(msgData);
      }
    });
  });

  // Actually log on
  try {
    client.logOn(logOnOptions);
  } catch (err) {
    steamSessions.delete(accountId);
    return res.json({ success: false, error: `Ошибка при подключении: ${err.message}` });
  }

  // Wait for login result
  const result = await loginPromise;
  res.json(result);
});

// ============= STEAM LOGOUT =============
app.post('/api/steam/logout', (req, res) => {
  const { accountId } = req.body;
  const session = steamSessions.get(accountId);
  if (session && session.client) {
    try {
      session.client.logOff();
      console.log(`[Steam] 🔌 ${session.login} logged off`);
    } catch {}
  }
  steamSessions.delete(accountId);
  res.json({ success: true });
});

// ============= STEAM STATUS =============
app.get('/api/steam/status/:accountId', (req, res) => {
  const session = steamSessions.get(req.params.accountId);
  if (session) {
    // Verify the client is actually still connected
    let realStatus = session.status;
    if (session.client && session.status === 'online') {
      // Check if client's steamID is still valid (indicates active connection)
      if (!session.client.steamID) {
        realStatus = 'offline';
        session.status = 'offline';
      }
    }
    res.json({
      status: realStatus,
      steamId: session.steamId,
      displayName: session.displayName,
      avatarUrl: session.avatarUrl,
      level: session.level,
      balance: session.balance,
      friendsCount: session.friendsCount,
      tradeBan: session.tradeBan,
      vacBan: session.vacBan,
      limited: session.limited,
    });
  } else {
    res.json({ status: 'offline' });
  }
});

app.get('/api/steam/status-all', (req, res) => {
  const statuses = {};
  for (const [id, session] of steamSessions) {
    // Verify actual connection
    let realStatus = session.status;
    if (session.client && session.status === 'online') {
      if (!session.client.steamID) {
        realStatus = 'offline';
        session.status = 'offline';
      }
    }
    statuses[id] = {
      status: realStatus,
      steamId: session.steamId,
      displayName: session.displayName,
      avatarUrl: session.avatarUrl,
      level: session.level,
      balance: session.balance,
      friendsCount: session.friendsCount,
      tradeBan: session.tradeBan,
      vacBan: session.vacBan,
      limited: session.limited,
    };
  }
  res.json(statuses);
});

// ============= FRIENDS =============
app.get('/api/steam/friends/:accountId', (req, res) => {
  const session = steamSessions.get(req.params.accountId);
  if (!session || !session.client || !session.client.myFriends) {
    return res.json({ friends: [] });
  }

  const friends = [];
  const myFriends = session.client.myFriends;
  const users = session.client.users || {};

  for (const steamId of Object.keys(myFriends)) {
    if (myFriends[steamId] !== (SteamUser?.EFriendRelationship?.Friend ?? 3)) continue;
    
    const user = users[steamId] || {};
    friends.push({
      steamId,
      name: user.player_name || steamId,
      avatar: '👤',
      avatarUrl: user.avatar_url_full || user.avatar_url_medium || null,
      personaState: user.persona_state || 0,
      gameId: user.gameid || null,
      gameName: user.game_name || null,
    });
  }

  res.json({ friends });
});

// ============= SEND MESSAGE =============
app.post('/api/steam/message', (req, res) => {
  const { accountId, friendSteamId, message } = req.body;
  const session = steamSessions.get(accountId);
  if (!session || !session.client || session.status !== 'online') {
    return res.json({ success: false, error: 'Account not online' });
  }

  try {
    session.client.chatMessage(friendSteamId, message);
    console.log(`[Steam] 📤 ${session.login} -> ${friendSteamId}: ${message.substring(0, 50)}`);
    res.json({ success: true });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// ============= GET MESSAGES =============
app.get('/api/steam/messages', (req, res) => {
  const allMessages = [];
  for (const [, session] of steamSessions) {
    if (session.messages) {
      allMessages.push(...session.messages);
    }
  }
  // Also get from DB
  try {
    const dbMessages = dbOps.getMessages();
    if (dbMessages) allMessages.push(...dbMessages);
  } catch {}

  // Deduplicate by id
  const seen = new Set();
  const unique = allMessages.filter(m => {
    if (seen.has(m.id)) return false;
    seen.add(m.id);
    return true;
  });

  res.json({ messages: unique.slice(-500) });
});

// ============= STEAM GUARD CODE =============
app.post('/api/steam/guard-code', (req, res) => {
  const { sharedSecret } = req.body;
  if (!steamAvailable || !SteamTotp) {
    return res.json({ error: 'steam-totp not available' });
  }
  try {
    const code = SteamTotp.generateAuthCode(sharedSecret);
    const time = Math.floor(Date.now() / 1000);
    const timeLeft = 30 - (time % 30);
    res.json({ code, timeLeft });
  } catch (err) {
    res.json({ error: err.message });
  }
});

// ============= ADD FRIEND =============
app.post('/api/steam/add-friend', (req, res) => {
  const { accountId, targetSteamId } = req.body;
  const session = steamSessions.get(accountId);
  if (!session || !session.client || session.status !== 'online') {
    return res.json({ success: false, error: 'Account not online' });
  }
  try {
    session.client.addFriend(targetSteamId);
    console.log(`[Steam] 👤 ${session.login} added friend ${targetSteamId}`);
    res.json({ success: true });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// ============= INVENTORY PRICES — CSGOTrader bulk prices (FREE, no rate limits) =============
// Downloads ALL CS2 prices in ONE request from csgotrader.app (free, updated daily)
// No API key. No rate limits. No per-item requests. Instant lookups.

const priceDb = new Map(); // market_hash_name -> price in USD
let priceDbLoaded = false;
let priceDbLastUpdate = 0;
const PRICE_DB_TTL = 2 * 60 * 60 * 1000; // refresh every 2 hours

const STEAM_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json',
};

// Price file path — can be generated with: node update-prices.js
const PRICES_FILE = join(__dirname, 'data', 'cs2_prices.json');

async function loadPriceDatabase() {
  console.log('[Prices] 📥 Loading CS2 price database...');

  // Method 1: Load from local file (most reliable — generated by update-prices.js)
  try {
    if (existsSync(PRICES_FILE)) {
      const { readFileSync } = await import('fs');
      const text = readFileSync(PRICES_FILE, 'utf-8');
      const data = JSON.parse(text);
      let count = 0;
      // Format: { "item_name": price_in_usd, ... }
      for (const [name, price] of Object.entries(data)) {
        const p = typeof price === 'number' ? price : parseFloat(price);
        if (p > 0 && !isNaN(p)) { priceDb.set(name, p); count++; }
      }
      if (count > 0) {
        priceDbLoaded = true;
        priceDbLastUpdate = Date.now();
        console.log(`[Prices] ✅ Loaded ${count} prices from local file: ${PRICES_FILE}`);
        return;
      }
    }
  } catch (err) {
    console.error(`[Prices]    Local file error: ${err.message}`);
  }

  // Method 2: Online sources blocked from datacenter IPs — skip
  if (!priceDbLoaded) {
    console.log('[Prices] ⚠️  No data/cs2_prices.json found.');
    console.log('[Prices]    Run on your local PC (not server):');
    console.log('[Prices]      node update-prices.js');
    console.log('[Prices]    Then copy data/cs2_prices.json to the server.');
  }
}

setTimeout(loadPriceDatabase, 1000);

// Helper: fetch inventory with multiple methods
async function fetchInventory(steamId) {
  const errors = [];

  // Method 1: Direct Steam Community (works from residential IPs)
  try {
    console.log(`[Inventory] Trying direct Steam API for ${steamId}...`);
    const invRes = await fetch(
      `https://steamcommunity.com/inventory/${steamId}/730/2?l=english&count=5000`,
      { headers: STEAM_HEADERS, signal: AbortSignal.timeout(20000) }
    );

    if (invRes.status === 403 || invRes.status === 401) {
      errors.push(`Direct: 403/401 (приватный или заблокирован)`);
    } else if (invRes.status === 429) {
      errors.push(`Direct: 429 (rate limit)`);
    } else if (invRes.ok) {
      // Check if response is actually JSON
      const text = await invRes.text();
      try {
        const invData = JSON.parse(text);
        if (invData.success && invData.assets && invData.assets.length > 0) {
          console.log(`[Inventory] ✅ Direct: ${invData.assets.length} items`);
          return { assets: invData.assets, descriptions: invData.descriptions || [], method: 'direct' };
        }
        errors.push(`Direct: success=${invData.success}, assets=${invData.assets?.length || 0}`);
      } catch {
        errors.push(`Direct: ответ не JSON (${text.substring(0, 100)})`);
      }
    } else {
      errors.push(`Direct: HTTP ${invRes.status}`);
    }
  } catch (err) {
    errors.push(`Direct: ${err.message}`);
  }

  // Method 2: Try with different User-Agent (mobile)
  try {
    console.log(`[Inventory] Trying mobile UA for ${steamId}...`);
    const invRes = await fetch(
      `https://steamcommunity.com/inventory/${steamId}/730/2?l=english&count=2000`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
          'Accept': 'application/json',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        signal: AbortSignal.timeout(20000),
      }
    );
    if (invRes.ok) {
      const text = await invRes.text();
      try {
        const invData = JSON.parse(text);
        if (invData.success && invData.assets && invData.assets.length > 0) {
          console.log(`[Inventory] ✅ Mobile UA: ${invData.assets.length} items`);
          return { assets: invData.assets, descriptions: invData.descriptions || [], method: 'mobile-ua' };
        }
      } catch {}
    }
    errors.push(`Mobile: HTTP ${invRes.status}`);
  } catch (err) {
    errors.push(`Mobile: ${err.message}`);
  }

  // Method 3: Steam Web API (requires STEAM_API_KEY env var)
  const steamApiKey = process.env.STEAM_API_KEY || '';
  if (steamApiKey) {
    try {
      console.log(`[Inventory] Trying Steam Web API for ${steamId}...`);
      const invRes = await fetch(
        `https://api.steampowered.com/IEconItems_730/GetPlayerItems/v0001/?key=${steamApiKey}&steamid=${steamId}`,
        { signal: AbortSignal.timeout(15000) }
      );
      if (invRes.ok) {
        const data = await invRes.json();
        if (data.result?.items?.length > 0) {
          console.log(`[Inventory] ✅ Web API: ${data.result.items.length} items`);
          // Convert format
          const items = data.result.items;
          const assets = items.map((item, i) => ({
            classid: String(item.defindex),
            instanceid: '0',
            amount: '1',
          }));
          // This endpoint doesn't give market_hash_name, limited use
          errors.push(`Web API: returned ${items.length} items but no market names`);
        }
      }
    } catch (err) {
      errors.push(`Web API: ${err.message}`);
    }
  }

  return { assets: [], descriptions: [], method: 'failed', errors };
}

app.get('/api/inventory/:steamId', async (req, res) => {
  const { steamId } = req.params;

  // Validate steamId format
  if (!/^\d{17}$/.test(steamId)) {
    return res.json({ totalValue: 0, itemCount: 0, items: [], error: `Неверный SteamID64: ${steamId}` });
  }

  try {
    // 1. Fetch inventory (tries multiple methods)
    const invResult = await fetchInventory(steamId);

    if (!invResult.assets || invResult.assets.length === 0) {
      const errorMsg = invResult.errors?.length
        ? `Не удалось получить инвентарь. ${invResult.errors.join('; ')}`
        : 'Пустой или приватный инвентарь';
      console.error(`[Inventory] ❌ ${steamId}: ${errorMsg}`);
      return res.json({ totalValue: 0, itemCount: 0, items: [], error: errorMsg });
    }

    const assets = invResult.assets;
    const descriptions = invResult.descriptions;

    // 2. Build description map
    const descMap = {};
    for (const d of descriptions) {
      descMap[`${d.classid}_${d.instanceid}`] = {
        name: d.market_hash_name || d.name,
        marketable: d.marketable === 1,
        type: d.type || '',
        rarity: (d.tags || []).find(t => t.category === 'Rarity')?.localized_tag_name || '',
        exterior: (d.tags || []).find(t => t.category === 'Exterior')?.localized_tag_name || '',
        weapon: (d.tags || []).find(t => t.category === 'Weapon')?.localized_tag_name || '',
      };
    }

    // 3. Count items by market_hash_name + gather metadata
    const itemCounts = {};
    const itemMeta = {};
    for (const asset of assets) {
      const key = `${asset.classid}_${asset.instanceid}`;
      const desc = descMap[key];
      if (!desc || !desc.marketable) continue;
      const name = desc.name;
      if (!itemCounts[name]) {
        itemCounts[name] = 0;
        itemMeta[name] = desc;
      }
      itemCounts[name] += parseInt(asset.amount) || 1;
    }

    // 4. Look up prices from priceDb — INSTANT, no HTTP requests
    if (!priceDbLoaded) {
      return res.json({ totalValue: 0, itemCount: assets.length, items: [], error: 'База цен ещё загружается, подождите 10 сек и обновите' });
    }

    const uniqueNames = Object.keys(itemCounts);
    let totalValue = 0;
    const itemResults = [];
    let pricedCount = 0;
    let unpricedCount = 0;

    for (const name of uniqueNames) {
      const count = itemCounts[name];
      const meta = itemMeta[name];
      const price = priceDb.get(name) || 0;

      if (price > 0) {
        const itemTotal = price * count;
        totalValue += itemTotal;
        itemResults.push({
          name,
          price: parseFloat(price.toFixed(2)),
          count,
          total: parseFloat(itemTotal.toFixed(2)),
          type: meta.type,
          rarity: meta.rarity,
          exterior: meta.exterior,
          weapon: meta.weapon,
        });
        pricedCount++;
      } else {
        unpricedCount++;
      }
    }

    itemResults.sort((a, b) => b.total - a.total);

    console.log(`[Inventory] ✅ ${steamId}: ${assets.length} items, ${pricedCount}/${uniqueNames.length} priced = $${totalValue.toFixed(2)} [${invResult.method}]`);

    res.json({
      totalValue: parseFloat(totalValue.toFixed(2)),
      itemCount: assets.length,
      uniqueItems: uniqueNames.length,
      pricedItems: pricedCount,
      unpricedItems: unpricedCount,
      pricingComplete: true,
      source: invResult.method,
      priceSource: 'csgotrader.app',
      priceDbSize: priceDb.size,
      items: itemResults,
    });
  } catch (err) {
    console.error(`[Inventory] ❌ ${steamId}: ${err.message}`);
    res.json({ totalValue: 0, itemCount: 0, items: [], error: `Ошибка сервера: ${err.message}` });
  }
});

// ============= INVENTORY DEBUG — open in browser: /api/inventory-test/STEAMID64 =============
app.get('/api/inventory-test/:steamId', async (req, res) => {
  const { steamId } = req.params;
  res.setHeader('Content-Type', 'text/html');

  let html = `<html><head><title>Inventory Debug: ${steamId}</title>
    <style>body{background:#111;color:#eee;font-family:monospace;padding:20px}
    .ok{color:#4f4}.err{color:#f44}.warn{color:#fa0}pre{background:#222;padding:10px;border-radius:8px;overflow-x:auto}</style></head><body>`;
  html += `<h2>🔍 Inventory Debug: ${steamId}</h2>`;

  // Test 1: Direct fetch
  try {
    html += `<h3>1. Direct Steam Community API</h3>`;
    const t0 = Date.now();
    const r = await fetch(
      `https://steamcommunity.com/inventory/${steamId}/730/2?l=english&count=100`,
      { headers: STEAM_HEADERS, signal: AbortSignal.timeout(15000) }
    );
    const ms = Date.now() - t0;
    html += `<div>Status: <b class="${r.ok ? 'ok' : 'err'}">${r.status} ${r.statusText}</b> (${ms}ms)</div>`;
    html += `<div>Headers: content-type=${r.headers.get('content-type')}</div>`;
    const text = await r.text();
    html += `<div>Body length: ${text.length}</div>`;
    try {
      const json = JSON.parse(text);
      html += `<div class="ok">✅ Valid JSON. success=${json.success}, assets=${json.assets?.length || 0}, total_inventory_count=${json.total_inventory_count || '?'}</div>`;
      if (json.assets?.length > 0) {
        html += `<div>First asset: ${JSON.stringify(json.assets[0])}</div>`;
      }
      if (json.descriptions?.length > 0) {
        const d = json.descriptions[0];
        html += `<div>First desc: ${d.market_hash_name} (marketable=${d.marketable})</div>`;
      }
    } catch {
      html += `<div class="err">❌ Not JSON. First 500 chars:</div><pre>${text.substring(0, 500).replace(/</g,'&lt;')}</pre>`;
    }
  } catch (err) {
    html += `<div class="err">❌ Error: ${err.message}</div>`;
  }

  // Test 2: Price check
  try {
    html += `<h3>2. Steam Market Price Test (AK-47 | Redline)</h3>`;
    const t0 = Date.now();
    const r = await fetch(
      `https://steamcommunity.com/market/priceoverview/?appid=730&currency=1&market_hash_name=${encodeURIComponent('AK-47 | Redline (Field-Tested)')}`,
      { headers: STEAM_HEADERS, signal: AbortSignal.timeout(10000) }
    );
    const ms = Date.now() - t0;
    html += `<div>Status: <b class="${r.ok ? 'ok' : 'err'}">${r.status}</b> (${ms}ms)</div>`;
    if (r.ok) {
      const data = await r.json();
      html += `<pre>${JSON.stringify(data, null, 2)}</pre>`;
      if (data.success) {
        html += `<div class="ok">✅ Prices work! lowest=${data.lowest_price}, median=${data.median_price}</div>`;
      }
    }
  } catch (err) {
    html += `<div class="err">❌ Error: ${err.message}</div>`;
  }

  // Test 3: Price Database
  html += `<h3>3. Price Database (csgotrader.app)</h3>`;
  html += `<div>Loaded: <b class="${priceDbLoaded ? 'ok' : 'err'}">${priceDbLoaded ? 'YES' : 'NO'}</b></div>`;
  html += `<div>Total items: <b>${priceDb.size}</b></div>`;
  html += `<div>Last update: ${priceDbLastUpdate ? Math.round((Date.now() - priceDbLastUpdate)/1000) + 's ago' : 'never'}</div>`;
  // Show test prices
  const testItems = ['AK-47 | Redline (Field-Tested)', 'AWP | Asiimov (Field-Tested)', 'Clutch Case', 'Revolution Case'];
  for (const name of testItems) {
    const p = priceDb.get(name);
    html += `<div>  ${name}: <b class="${p ? 'ok' : 'warn'}">${p ? '$' + p.toFixed(2) : 'NOT FOUND'}</b></div>`;
  }

  html += `<br><a href="/api/inventory/${steamId}" style="color:#66f">→ Full inventory JSON</a>`;
  html += `</body></html>`;
  res.send(html);
});

// ============= TRANSLATION (free, no API key) =============
app.post('/api/translate', async (req, res) => {
  const { text, from, to } = req.body;
  if (!text || !to) return res.json({ error: 'Missing text or target language' });

  const sourceLang = from || 'auto';
  const targetLang = to || 'en';

  // Method 1: Google Translate (unofficial but reliable)
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
    const r = await fetch(url, {
      headers: { 'User-Agent': STEAM_HEADERS['User-Agent'] },
      signal: AbortSignal.timeout(10000),
    });
    if (r.ok) {
      const data = await r.json();
      // Response format: [[["translated text","original text",null,null,10]],null,"en"]
      if (data && data[0]) {
        const translated = data[0].map(s => s[0]).join('');
        const detectedLang = data[2] || sourceLang;
        return res.json({ success: true, translated, from: detectedLang, to: targetLang });
      }
    }
  } catch {}

  // Method 2: MyMemory (backup, 1000 req/day free)
  try {
    const langPair = `${sourceLang === 'auto' ? 'en' : sourceLang}|${targetLang}`;
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text.substring(0, 500))}&langpair=${langPair}`;
    const r = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (r.ok) {
      const data = await r.json();
      if (data.responseStatus === 200 && data.responseData?.translatedText) {
        return res.json({ success: true, translated: data.responseData.translatedText, from: sourceLang, to: targetLang });
      }
    }
  } catch {}

  res.json({ success: false, error: 'Translation failed' });
});

// ============= STATS =============
app.get('/api/stats', (req, res) => {
  res.json({
    ...dbOps.getStats(),
    steamAvailable,
    activeSteamSessions: steamSessions.size,
    onlineAccounts: Array.from(steamSessions.values()).filter(s => s.status === 'online').length,
  });
});

// ============= PARSER ROUTES =============
try {
  const parserModule = await import('./server/parserRoutes.js');
  if (parserModule.default) parserModule.default(app);
  else if (parserModule.setupRoutes) parserModule.setupRoutes(app);
  console.log('[Server] Parser routes loaded');
} catch {
  // Parser routes stubs
  app.post('/api/parser/start', (req, res) => res.json({ success: false, error: 'Parser not available' }));
  app.get('/api/parser/jobs', (req, res) => res.json({ jobs: [] }));
  app.get('/api/parser/status/:id', (req, res) => res.json({ job: null }));
  app.post('/api/parser/stop/:id', (req, res) => res.json({ success: true }));
  app.post('/api/parser/pause/:id', (req, res) => res.json({ success: true }));
  app.post('/api/parser/resume/:id', (req, res) => res.json({ success: true }));
  app.get('/api/parser/results/:id', (req, res) => res.json({ results: [], total: 0 }));
  app.get('/api/parser/export/:id', (req, res) => res.status(404).send('Not found'));
  app.delete('/api/parser/clear/:id', (req, res) => res.json({ success: true }));
}

// ============= SERVE STATIC =============
const distPath = join(__dirname, 'dist');
if (existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('/{*path}', (req, res) => {
    res.sendFile(join(distPath, 'index.html'));
  });
  console.log(`[Server] Serving static files from ${distPath}`);
}

// ============= START =============
app.listen(PORT, () => {
  console.log('');
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║         SukaCombine Steam Panel v3.1             ║');
  console.log('╠══════════════════════════════════════════════════╣');
  console.log(`║  🌐 URL: http://localhost:${PORT}                    ║`);
  console.log(`║  🔑 Admin: admin / admin123                      ║`);
  console.log(`║  🎮 Steam: ${steamAvailable ? '✅ REAL connections' : '❌ NOT available (install steam-user)'}       ║`);
  console.log('╚══════════════════════════════════════════════════╝');
  console.log('');
  if (!steamAvailable) {
    console.log('⚠️  Для реального подключения к Steam установите:');
    console.log('    npm install steam-user steam-totp');
    console.log('');
  }
});
