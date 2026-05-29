import express from 'express';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '50mb' }));

// Import database
let dbOps;
try {
  const dbModule = await import('./server/database.js');
  dbOps = dbModule.dbOps;
  console.log('[Server] SQLite database loaded successfully');
} catch (err) {
  console.error('[Server] Failed to load database:', err.message);
  console.log('[Server] Running without database - using in-memory fallback');

  // In-memory fallback
  const memStore = {
    accounts: [],
    workers: [],
    messages: [],
  };

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

// Steam session management (in-memory)
const steamSessions = new Map();

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

  // Check workers
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
    id,
    username,
    password,
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
  // Merge with live session data
  const enriched = accounts.map(acc => {
    const session = steamSessions.get(acc.id);
    if (session) {
      return { ...acc, ...session };
    }
    return acc;
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
  dbOps.deleteAccount(req.params.id);
  steamSessions.delete(req.params.id);
  res.json({ success: true });
});

// ============= STEAM API (placeholder) =============
app.post('/api/steam/login', (req, res) => {
  const { accountId, login } = req.body;
  // In production, this would use steam-user library
  steamSessions.set(accountId, {
    status: 'online',
    steamId: null,
    displayName: login,
  });
  res.json({
    success: true,
    status: 'online',
    displayName: login,
    message: 'Connected (server mode)',
  });
});

app.post('/api/steam/logout', (req, res) => {
  const { accountId } = req.body;
  steamSessions.delete(accountId);
  res.json({ success: true });
});

app.get('/api/steam/status/:accountId', (req, res) => {
  const session = steamSessions.get(req.params.accountId);
  res.json(session || { status: 'offline' });
});

app.get('/api/steam/status-all', (req, res) => {
  const statuses = {};
  for (const [id, session] of steamSessions) {
    statuses[id] = session;
  }
  res.json(statuses);
});

app.get('/api/steam/friends/:accountId', (req, res) => {
  res.json({ friends: [] });
});

app.post('/api/steam/message', (req, res) => {
  const { accountId, friendSteamId, message } = req.body;
  const msg = {
    id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    accountId,
    accountLogin: 'unknown',
    friendId: friendSteamId,
    friendName: friendSteamId,
    friendAvatar: '👤',
    text: message,
    timestamp: new Date().toISOString(),
    isOutgoing: true,
  };
  dbOps.saveMessage(msg);
  res.json({ success: true });
});

app.get('/api/steam/messages', (req, res) => {
  const messages = dbOps.getMessages();
  res.json({ messages });
});

app.post('/api/steam/guard-code', (req, res) => {
  // In production, would compute TOTP from shared_secret
  res.json({ code: '-----', timeLeft: 30 });
});

app.post('/api/steam/add-friend', (req, res) => {
  res.json({ success: true, name: req.body.targetSteamId });
});

app.get('/api/steam/friends-of-friend/:accountId/:friendSteamId', (req, res) => {
  res.json({ friends: [] });
});

app.post('/api/steam/update-profile', (req, res) => {
  res.json({ success: true });
});

app.post('/api/steam/spam-friends', (req, res) => {
  res.json({ success: true, sent: 0, errors: 0, logs: [] });
});

// ============= PARSER =============
let parserModule;
try {
  parserModule = await import('./server/steamParser.js');
  console.log('[Server] Steam parser module loaded');
} catch (err) {
  console.error('[Server] Failed to load parser:', err.message);
  parserModule = null;
}

app.post('/api/parser/start', (req, res) => {
  if (!parserModule) {
    return res.json({ success: false, error: 'Parser module not available' });
  }
  try {
    const config = req.body;
    const jobId = parserModule.startParseJob(config);
    console.log(`[Server] Parser job started: ${jobId}`);
    res.json({ success: true, jobId });
  } catch (err) {
    console.error('[Server] Parser start error:', err);
    res.json({ success: false, error: err.message });
  }
});

app.get('/api/parser/jobs', (req, res) => {
  try {
    const allJobs = dbOps.getAllParseJobs ? dbOps.getAllParseJobs() : [];
    // Mark active jobs
    const activeIds = parserModule ? parserModule.getActiveJobIds() : [];
    const jobs = allJobs.map(job => ({
      ...job,
      status: activeIds.includes(job.id) ? 'running' : job.status,
    }));
    res.json({ jobs });
  } catch (err) {
    console.error('[Server] Parser jobs error:', err);
    res.json({ jobs: [] });
  }
});

app.get('/api/parser/status/:jobId', (req, res) => {
  try {
    const job = dbOps.getParseJob ? dbOps.getParseJob(req.params.jobId) : null;
    if (job && parserModule && parserModule.isJobRunning(req.params.jobId)) {
      job.status = 'running';
    }
    res.json({ job });
  } catch (err) {
    res.json({ job: null });
  }
});

app.post('/api/parser/stop/:jobId', (req, res) => {
  if (parserModule) {
    parserModule.cancelParseJob(req.params.jobId);
  }
  res.json({ success: true });
});

app.post('/api/parser/pause/:jobId', (req, res) => {
  if (parserModule) {
    parserModule.cancelParseJob(req.params.jobId);
  }
  res.json({ success: true });
});

app.post('/api/parser/resume/:jobId', (req, res) => {
  // Re-start with same config
  if (parserModule && dbOps.getParseJob) {
    const job = dbOps.getParseJob(req.params.jobId);
    if (job && job.config) {
      parserModule.startParseJob(job.config);
    }
  }
  res.json({ success: true });
});

app.get('/api/parser/results/:jobId', (req, res) => {
  try {
    const job = dbOps.getParseJob ? dbOps.getParseJob(req.params.jobId) : null;
    if (job) {
      res.json({ results: job.results, total: job.results.length });
    } else {
      res.json({ results: [], total: 0 });
    }
  } catch (err) {
    res.json({ results: [], total: 0 });
  }
});

app.get('/api/parser/export/:jobId', (req, res) => {
  try {
    const job = dbOps.getParseJob ? dbOps.getParseJob(req.params.jobId) : null;
    if (!job || !job.results) {
      return res.status(404).send('Job not found');
    }
    const format = req.query.format || 'txt';
    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename=parser_${req.params.jobId}.json`);
      return res.send(JSON.stringify(job.results, null, 2));
    }
    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=parser_${req.params.jobId}.csv`);
      const header = 'steamId,inventoryValue,itemsCount,country,profileName,profileUrl,foundAt\n';
      const rows = job.results.map(r =>
        `${r.steamId},${r.inventoryValue},${r.itemsCount},${r.country},"${r.profileName}",${r.profileUrl},${r.foundAt}`
      ).join('\n');
      return res.send(header + rows);
    }
    // txt
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', `attachment; filename=parser_${req.params.jobId}.txt`);
    const lines = job.results.map(r =>
      `${r.steamId} | $${r.inventoryValue.toFixed(2)} | ${r.itemsCount} items | ${r.country} | ${r.profileName}`
    ).join('\n');
    res.send(lines || 'No results');
  } catch (err) {
    res.status(500).send('Error');
  }
});

app.delete('/api/parser/clear/:jobId', (req, res) => {
  if (parserModule) {
    parserModule.cancelParseJob(req.params.jobId);
  }
  if (dbOps.updateParseJob) {
    dbOps.updateParseJob(req.params.jobId, { results: [], stats: {} });
  }
  res.json({ success: true });
});

// ============= DOMAINS =============
app.post('/api/domains', (req, res) => {
  res.json({ success: true });
});

app.delete('/api/domains/:id', (req, res) => {
  res.json({ success: true });
});

// ============= STATS =============
app.get('/api/stats', (req, res) => {
  const stats = dbOps.getStats();
  res.json(stats);
});

// ============= EXPORT =============
app.get('/api/export', (req, res) => {
  const accounts = dbOps.getAllAccounts();
  const workers = dbOps.getAllWorkers();
  const messages = dbOps.getMessages();
  res.json({ accounts, workers, messages, exportDate: new Date().toISOString() });
});

// ============= CLEAR =============
app.post('/api/clear', (req, res) => {
  dbOps.clearAll();
  steamSessions.clear();
  res.json({ success: true });
});

// ============= SERVE STATIC =============
const distPath = join(__dirname, 'dist');
if (existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('/{*path}', (req, res) => {
    res.sendFile(join(distPath, 'index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.send(`
      <html>
        <body style="background:#0a0a0f;color:white;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;">
          <div style="text-align:center">
            <h1>SukaCombine</h1>
            <p>Выполните: npm run build</p>
          </div>
        </body>
      </html>
    `);
  });
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Server] SukaCombine v3.0 running on http://0.0.0.0:${PORT}`);
  console.log(`[Server] Database: SQLite (./data/sukacombine.db)`);
  console.log(`[Server] Default login: admin / admin123`);
});
