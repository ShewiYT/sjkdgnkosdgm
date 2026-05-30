// ============================================================
// SukaCombine Server v3.2 — REAL Steam Connection + Worker Nodes + Proxy
// Uses steam-user + steam-totp for actual Steam login
// ============================================================
// INSTALL:
//   npm install express better-sqlite3 steam-user steam-totp https-proxy-agent socks-proxy-agent
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

// ============= PROXY SUPPORT =============
let HttpsProxyAgent, SocksProxyAgent;
let proxyAvailable = false;

try {
  const httpsProxyModule = await import('https-proxy-agent');
  HttpsProxyAgent = httpsProxyModule.HttpsProxyAgent;
  const socksProxyModule = await import('socks-proxy-agent');
  SocksProxyAgent = socksProxyModule.SocksProxyAgent;
  proxyAvailable = true;
  console.log('[Server] ✅ Proxy agents loaded (https-proxy-agent, socks-proxy-agent)');
} catch (err) {
  console.log('[Server] ⚠️ Proxy agents not installed. Run: npm install https-proxy-agent socks-proxy-agent');
}

// Global proxy setting (can be set via API)
let globalProxy = null;

// Parse proxy string into URL format
function parseProxyString(proxyStr) {
  if (!proxyStr || !proxyStr.trim()) return null;
  
  let proxy = proxyStr.trim();
  
  // Format: user:pass@host:port or host:port:user:pass or host:port
  // Convert to URL format
  
  // Already has protocol
  if (proxy.startsWith('http://') || proxy.startsWith('https://') || proxy.startsWith('socks://') || proxy.startsWith('socks5://') || proxy.startsWith('socks4://')) {
    return proxy;
  }
  
  // Format: user:pass@host:port
  if (proxy.includes('@')) {
    return `http://${proxy}`;
  }
  
  // Format: host:port:user:pass
  const parts = proxy.split(':');
  if (parts.length === 4) {
    const [host, port, user, pass] = parts;
    return `http://${user}:${pass}@${host}:${port}`;
  }
  
  // Format: host:port (no auth)
  if (parts.length === 2) {
    return `http://${proxy}`;
  }
  
  return null;
}

// Create proxy agent from URL
function createProxyAgent(proxyUrl) {
  if (!proxyAvailable || !proxyUrl) return null;
  
  try {
    if (proxyUrl.startsWith('socks://') || proxyUrl.startsWith('socks5://') || proxyUrl.startsWith('socks4://')) {
      return new SocksProxyAgent(proxyUrl);
    }
    return new HttpsProxyAgent(proxyUrl);
  } catch (err) {
    console.error('[Proxy] Failed to create agent:', err.message);
    return null;
  }
}

// ============= PROXY API =============
app.post('/api/proxy/set', (req, res) => {
  const { proxy } = req.body;
  const parsed = parseProxyString(proxy);
  
  if (proxy && !parsed) {
    return res.json({ success: false, error: 'Неверный формат прокси' });
  }
  
  globalProxy = parsed;
  console.log('[Proxy] Global proxy set:', globalProxy ? globalProxy.replace(/:[^:@]+@/, ':***@') : 'disabled');
  res.json({ success: true, proxy: globalProxy ? globalProxy.replace(/:[^:@]+@/, ':***@') : null });
});

app.get('/api/proxy/get', (req, res) => {
  res.json({ 
    proxy: globalProxy ? globalProxy.replace(/:[^:@]+@/, ':***@') : null,
    proxyAvailable 
  });
});

app.post('/api/proxy/check', async (req, res) => {
  const { proxy } = req.body;
  const proxyUrl = parseProxyString(proxy);
  
  if (!proxyUrl) {
    return res.json({ success: false, error: 'Неверный формат прокси' });
  }
  
  if (!proxyAvailable) {
    return res.json({ success: false, error: 'Proxy agents не установлены. npm install https-proxy-agent socks-proxy-agent' });
  }
  
  try {
    const agent = createProxyAgent(proxyUrl);
    if (!agent) {
      return res.json({ success: false, error: 'Не удалось создать proxy agent' });
    }
    
    // Test proxy by fetching a simple endpoint
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    
    const testRes = await fetch('https://api.ipify.org?format=json', {
      agent,
      signal: controller.signal,
    });
    clearTimeout(timeout);
    
    if (testRes.ok) {
      const data = await testRes.json();
      return res.json({ 
        success: true, 
        ip: data.ip,
        message: `Прокси работает! Внешний IP: ${data.ip}`
      });
    } else {
      return res.json({ success: false, error: `HTTP ${testRes.status}` });
    }
  } catch (err) {
    return res.json({ success: false, error: `Ошибка подключения: ${err.message}` });
  }
});

// ============= WORKER NODES API =============
// For distributed worker nodes that run steam-user connections
const workerNodes = new Map();

app.post('/api/nodes/register', (req, res) => {
  const { nodeId, name, ip, port, version, capabilities, systemInfo } = req.body;
  
  if (!nodeId) {
    return res.status(400).json({ success: false, error: 'nodeId is required' });
  }
  
  const node = {
    nodeId,
    name: name || 'unknown',
    ip: ip || 'unknown',
    port: port || 3001,
    version: version || '1.0.0',
    capabilities: capabilities || [],
    systemInfo: systemInfo || {},
    status: 'online',
    registeredAt: new Date().toISOString(),
    lastHeartbeat: new Date().toISOString(),
    tasksRunning: 0,
    tasksCompleted: 0,
    errors: 0,
  };
  
  workerNodes.set(nodeId, node);
  console.log(`[Master] ✅ Worker node registered: ${name} (${nodeId}) from ${ip}:${port}`);
  
  res.json({ success: true, node });
});

app.post('/api/nodes/heartbeat', (req, res) => {
  const { nodeId, tasksRunning, tasksCompleted, errors, systemInfo, load } = req.body;
  
  if (!nodeId) {
    return res.status(400).json({ success: false, error: 'nodeId is required' });
  }
  
  const node = workerNodes.get(nodeId);
  if (!node) {
    // Node not registered, tell it to re-register
    return res.status(404).json({ success: false, error: 'Node not registered. Please re-register.' });
  }
  
  node.lastHeartbeat = new Date().toISOString();
  node.status = 'online';
  if (tasksRunning !== undefined) node.tasksRunning = tasksRunning;
  if (tasksCompleted !== undefined) node.tasksCompleted = tasksCompleted;
  if (errors !== undefined) node.errors = errors;
  if (systemInfo) node.systemInfo = systemInfo;
  if (load) node.load = load;
  
  workerNodes.set(nodeId, node);
  
  res.json({ success: true });
});

app.get('/api/nodes', (req, res) => {
  const nodes = Array.from(workerNodes.values());
  
  // Mark nodes as offline if no heartbeat for 90 seconds
  const now = Date.now();
  for (const node of nodes) {
    const lastBeat = new Date(node.lastHeartbeat).getTime();
    if (now - lastBeat > 90000) {
      node.status = 'offline';
    }
  }
  
  res.json({ success: true, nodes });
});

app.delete('/api/nodes/:nodeId', (req, res) => {
  const { nodeId } = req.params;
  const node = workerNodes.get(nodeId);
  workerNodes.delete(nodeId);
  console.log(`[Master] Worker node removed: ${nodeId}`);
  res.json({ success: true });
});

app.post('/api/nodes/:nodeId/task', async (req, res) => {
  const { nodeId } = req.params;
  const node = workerNodes.get(nodeId);
  
  if (!node || node.status === 'offline') {
    return res.status(404).json({ success: false, error: 'Node not found or offline' });
  }
  
  try {
    const taskRes = await fetch(`http://${node.ip}:${node.port}/api/task`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
      signal: AbortSignal.timeout(30000),
    });
    const data = await taskRes.json();
    res.json(data);
  } catch (e) {
    res.status(502).json({ success: false, error: `Cannot reach worker node: ${e.message}` });
  }
});

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
    proxyAvailable,
    activeSessions: steamSessions.size,
    workerNodes: workerNodes.size,
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

// ============= REAL STEAM LOGIN (with proxy fallback) =============
async function attemptSteamLogin(accountId, login, password, sharedSecret, identitySecret, useProxy = false) {
  const proxyUrl = useProxy ? globalProxy : null;
  
  // Create SteamUser options
  const clientOptions = {
    promptSteamGuardCode: false,
    autoRelogin: true,
    enablePicsCache: false,
  };
  
  // Add proxy if specified
  if (proxyUrl && proxyAvailable) {
    const agent = createProxyAgent(proxyUrl);
    if (agent) {
      clientOptions.httpProxy = proxyUrl;
      console.log(`[Steam] 🌐 Using proxy for ${login}: ${proxyUrl.replace(/:[^:@]+@/, ':***@')}`);
    }
  }
  
  const client = new SteamUser(clientOptions);

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
    usingProxy: !!proxyUrl,
  });

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      resolve({
        success: false,
        error: 'Таймаут подключения к Steam (30 сек)',
        isRateLimit: false,
      });
    }, 30000);

    client.on('loggedOn', (details) => {
      clearTimeout(timeout);
      console.log(`[Steam] ✅ ${login} logged in as ${client.steamID.getSteamID64()}${proxyUrl ? ' (via proxy)' : ''}`);
      
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
        usedProxy: !!proxyUrl,
      });
    });

    client.on('error', (err) => {
      clearTimeout(timeout);
      console.error(`[Steam] ❌ ${login} login error:`, err.message, err.eresult);
      
      const session = steamSessions.get(accountId);
      if (session) {
        session.status = 'error';
      }
      
      steamSessions.delete(accountId);

      let errorMsg = err.message;
      let isRateLimit = false;
      
      if (err.eresult === 5) errorMsg = 'Неверный пароль (InvalidPassword)';
      else if (err.eresult === 6) errorMsg = 'Аккаунт заблокирован (LoggedInElsewhere)';
      else if (err.eresult === 15) errorMsg = 'Требуется Steam Guard код';
      else if (err.eresult === 63) errorMsg = 'Неверный код Steam Guard (InvalidLoginAuthCode)';
      else if (err.eresult === 84) {
        errorMsg = 'Слишком много попыток (RateLimitExceeded)';
        isRateLimit = true;
      }
      else if (err.eresult === 65) errorMsg = 'Неверный код двухфакторной аутентификации';

      resolve({ success: false, error: errorMsg, isRateLimit });
    });

    client.on('steamGuard', (domain, callback, lastCodeWrong) => {
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
        resolve({ success: false, error: `Требуется код Steam Guard с email (${domain}). Загрузите maFile.`, isRateLimit: false });
      } else {
        resolve({ success: false, error: 'Требуется код Steam Guard из приложения. Загрузите maFile.', isRateLimit: false });
      }
    });

    client.on('accountInfo', (name, country) => {
      const session = steamSessions.get(accountId);
      if (session) {
        session.displayName = name || login;
      }
    });

    client.on('wallet', (hasWallet, currency, balance) => {
      const session = steamSessions.get(accountId);
      if (session) {
        session.balance = balance / 100;
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

    client.on('disconnected', (eresult, msg) => {
      console.log(`[Steam] 🔌 ${login} disconnected: ${msg || eresult}`);
      const session = steamSessions.get(accountId);
      if (session) {
        session.status = 'offline';
      }
    });

    client.on('friendMessage', (senderID, message) => {
      const friendSteamId = senderID.getSteamID64();
      console.log(`[Steam] 💬 ${login} got message from ${friendSteamId}: ${message}`);
      
      // Получаем имя друга из кэша пользователей
      let friendName = friendSteamId;
      let friendAvatar = '👤';
      if (client.users && client.users[friendSteamId]) {
        const user = client.users[friendSteamId];
        friendName = user.player_name || friendSteamId;
        friendAvatar = user.avatar_url_medium || '👤';
      }
      
      const msgId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const msgData = {
        id: msgId,
        accountId,
        accountLogin: login,
        friendId: friendSteamId,
        friendName,
        friendAvatar,
        text: message,
        timestamp: new Date().toISOString(),
        isOutgoing: false,
        isRead: false,
      };
      
      // Сохраняем в базу данных (ВАЖНО!)
      try { 
        dbOps.saveMessage(msgData); 
        console.log(`[Steam] 💾 Message saved to DB: ${msgId}`);
      } catch (err) {
        console.error('[Steam] Failed to save message:', err.message);
      }
    });

    // Actually log on
    try {
      client.logOn(logOnOptions);
    } catch (err) {
      clearTimeout(timeout);
      steamSessions.delete(accountId);
      resolve({ success: false, error: `Ошибка при подключении: ${err.message}`, isRateLimit: false });
    }
  });
}

app.post('/api/steam/login', async (req, res) => {
  const { accountId, login, password, sharedSecret, identitySecret, proxy } = req.body;

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

  // Set proxy if provided in request
  if (proxy) {
    const parsed = parseProxyString(proxy);
    if (parsed) {
      globalProxy = parsed;
      console.log(`[Steam] Proxy set from request: ${parsed.replace(/:[^:@]+@/, ':***@')}`);
    }
  }

  // Try without proxy first
  console.log(`[Steam] 🔄 Attempting login for ${login} (direct)...`);
  let result = await attemptSteamLogin(accountId, login, password, sharedSecret, identitySecret, false);
  
  // If rate limited and we have a proxy, retry with proxy
  if (!result.success && result.isRateLimit && globalProxy && proxyAvailable) {
    console.log(`[Steam] ⚠️ Rate limited! Retrying ${login} via proxy...`);
    result = await attemptSteamLogin(accountId, login, password, sharedSecret, identitySecret, true);
    
    if (result.success) {
      result.usedProxy = true;
      result.message = '✅ Подключено через прокси (обход RateLimit)';
    }
  }
  
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
    let realStatus = session.status;
    if (session.client && session.status === 'online') {
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
      usingProxy: session.usingProxy,
    });
  } else {
    res.json({ status: 'offline' });
  }
});

app.get('/api/steam/status-all', (req, res) => {
  const statuses = {};
  for (const [id, session] of steamSessions) {
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
      usingProxy: session.usingProxy,
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
  const { accountId, friendSteamId, message, friendName, friendAvatar } = req.body;
  const session = steamSessions.get(accountId);
  if (!session || !session.client || session.status !== 'online') {
    return res.json({ success: false, error: 'Account not online' });
  }

  try {
    session.client.chatMessage(friendSteamId, message);
    console.log(`[Steam] 📤 ${session.login} -> ${friendSteamId}: ${message.substring(0, 50)}`);
    
    // Сохраняем исходящее сообщение в БД
    const msgId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const msgData = {
      id: msgId,
      accountId,
      accountLogin: session.login,
      friendId: friendSteamId,
      friendName: friendName || friendSteamId,
      friendAvatar: friendAvatar || '👤',
      text: message,
      timestamp: new Date().toISOString(),
      isOutgoing: true,
      isRead: true,
    };
    
    try {
      dbOps.saveMessage(msgData);
      console.log(`[Steam] 💾 Outgoing message saved: ${msgId}`);
    } catch (err) {
      console.error('[Steam] Failed to save outgoing message:', err.message);
    }
    
    res.json({ success: true, messageId: msgId });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// ============= GET MESSAGES =============
app.get('/api/steam/messages', (req, res) => {
  const { accountId, friendId, limit } = req.query;
  
  try {
    let messages;
    if (accountId && friendId) {
      // Сообщения конкретного чата
      messages = dbOps.getMessagesByChat(accountId, friendId, parseInt(limit) || 100);
    } else if (accountId) {
      // Все сообщения аккаунта
      messages = dbOps.getMessagesByAccount(accountId, parseInt(limit) || 200);
    } else {
      // Все сообщения
      messages = dbOps.getMessages(parseInt(limit) || 500);
    }
    res.json({ messages });
  } catch (err) {
    console.error('[Messages] Error:', err.message);
    res.json({ messages: [] });
  }
});

// ============= GET CHATS LIST =============
app.get('/api/steam/chats', (req, res) => {
  const { accountId } = req.query;
  try {
    const chats = dbOps.getChats(accountId || null);
    const unreadCount = dbOps.getUnreadCount(accountId || null);
    res.json({ chats, unreadCount });
  } catch (err) {
    console.error('[Chats] Error:', err.message);
    res.json({ chats: [], unreadCount: 0 });
  }
});

// ============= MARK MESSAGES AS READ =============
app.post('/api/steam/messages/read', (req, res) => {
  const { accountId, friendId } = req.body;
  if (!accountId || !friendId) {
    return res.json({ success: false, error: 'accountId and friendId required' });
  }
  try {
    dbOps.markMessagesAsRead(accountId, friendId);
    res.json({ success: true });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// ============= DELETE CHAT =============
app.delete('/api/steam/chat/:accountId/:friendId', (req, res) => {
  const { accountId, friendId } = req.params;
  try {
    dbOps.deleteChat(accountId, friendId);
    res.json({ success: true });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
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

// ============= INVENTORY PRICES =============
const priceDb = new Map();
let priceDbLoaded = false;
let priceDbLastUpdate = 0;
const PRICE_DB_TTL = 2 * 60 * 60 * 1000;

const STEAM_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json',
};

const PRICES_FILE = join(__dirname, 'data', 'cs2_prices.json');

async function loadPriceDatabase() {
  console.log('[Prices] 📥 Loading CS2 price database...');

  try {
    if (existsSync(PRICES_FILE)) {
      const { readFileSync } = await import('fs');
      const text = readFileSync(PRICES_FILE, 'utf-8');
      const data = JSON.parse(text);
      let count = 0;
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

  if (!priceDbLoaded) {
    console.log('[Prices] ⚠️  No data/cs2_prices.json found.');
    console.log('[Prices]    Run on your local PC: node update-prices.js');
  }
}

setTimeout(loadPriceDatabase, 1000);

async function fetchInventory(steamId) {
  const errors = [];

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

  try {
    console.log(`[Inventory] Trying mobile UA for ${steamId}...`);
    const invRes = await fetch(
      `https://steamcommunity.com/inventory/${steamId}/730/2?l=english&count=2000`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
          'Accept': 'application/json',
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

  return { assets: [], descriptions: [], method: 'failed', errors };
}

app.get('/api/inventory/:steamId', async (req, res) => {
  const { steamId } = req.params;

  if (!/^\d{17}$/.test(steamId)) {
    return res.json({ totalValue: 0, itemCount: 0, items: [], error: `Неверный SteamID64: ${steamId}` });
  }

  try {
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

app.get('/api/inventory-test/:steamId', async (req, res) => {
  const { steamId } = req.params;
  res.setHeader('Content-Type', 'text/html');

  let html = `<html><head><title>Inventory Debug: ${steamId}</title>
    <style>body{background:#111;color:#eee;font-family:monospace;padding:20px}
    .ok{color:#4f4}.err{color:#f44}.warn{color:#fa0}pre{background:#222;padding:10px;border-radius:8px;overflow-x:auto}</style></head><body>`;
  html += `<h2>🔍 Inventory Debug: ${steamId}</h2>`;

  try {
    html += `<h3>1. Direct Steam Community API</h3>`;
    const t0 = Date.now();
    const r = await fetch(
      `https://steamcommunity.com/inventory/${steamId}/730/2?l=english&count=100`,
      { headers: STEAM_HEADERS, signal: AbortSignal.timeout(15000) }
    );
    const ms = Date.now() - t0;
    html += `<div>Status: <b class="${r.ok ? 'ok' : 'err'}">${r.status} ${r.statusText}</b> (${ms}ms)</div>`;
    const text = await r.text();
    html += `<div>Body length: ${text.length}</div>`;
    try {
      const json = JSON.parse(text);
      html += `<div class="ok">✅ Valid JSON. success=${json.success}, assets=${json.assets?.length || 0}</div>`;
    } catch {
      html += `<div class="err">❌ Not JSON. First 500 chars:</div><pre>${text.substring(0, 500).replace(/</g,'&lt;')}</pre>`;
    }
  } catch (err) {
    html += `<div class="err">❌ Error: ${err.message}</div>`;
  }

  html += `<h3>2. Price Database</h3>`;
  html += `<div>Loaded: <b class="${priceDbLoaded ? 'ok' : 'err'}">${priceDbLoaded ? 'YES' : 'NO'}</b></div>`;
  html += `<div>Total items: <b>${priceDb.size}</b></div>`;

  html += `<br><a href="/api/inventory/${steamId}" style="color:#66f">→ Full inventory JSON</a>`;
  html += `</body></html>`;
  res.send(html);
});

// ============= TRANSLATION =============
app.post('/api/translate', async (req, res) => {
  const { text, from, to } = req.body;
  if (!text || !to) return res.json({ error: 'Missing text or target language' });

  const sourceLang = from || 'auto';
  const targetLang = to || 'en';

  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
    const r = await fetch(url, {
      headers: { 'User-Agent': STEAM_HEADERS['User-Agent'] },
      signal: AbortSignal.timeout(10000),
    });
    if (r.ok) {
      const data = await r.json();
      if (data && data[0]) {
        const translated = data[0].map(s => s[0]).join('');
        const detectedLang = data[2] || sourceLang;
        return res.json({ success: true, translated, from: detectedLang, to: targetLang });
      }
    }
  } catch {}

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
    proxyAvailable,
    proxySet: !!globalProxy,
    activeSteamSessions: steamSessions.size,
    onlineAccounts: Array.from(steamSessions.values()).filter(s => s.status === 'online').length,
    workerNodes: workerNodes.size,
    onlineNodes: Array.from(workerNodes.values()).filter(n => n.status === 'online').length,
  });
});

// ============= PARSER ROUTES =============
try {
  const parserModule = await import('./server/parserRoutes.js');
  if (parserModule.default) parserModule.default(app);
  else if (parserModule.setupRoutes) parserModule.setupRoutes(app);
  console.log('[Server] Parser routes loaded');
} catch {
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
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║           SukaCombine Steam Panel v3.2                   ║');
  console.log('╠══════════════════════════════════════════════════════════╣');
  console.log(`║  🌐 URL: http://localhost:${PORT}                            ║`);
  console.log(`║  🔑 Admin: admin / admin123                              ║`);
  console.log(`║  🎮 Steam: ${steamAvailable ? '✅ REAL connections' : '❌ NOT available'}                      ║`);
  console.log(`║  🌐 Proxy: ${proxyAvailable ? '✅ Available' : '❌ npm install https-proxy-agent'}              ║`);
  console.log(`║  🖥️  Nodes: Worker nodes API enabled                      ║`);
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log('');
});
