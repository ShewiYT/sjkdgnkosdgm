import Database from 'better-sqlite3';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync, existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Ensure data directory exists
const dataDir = join(__dirname, '..', 'data');
if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true });
}

const dbPath = join(dataDir, 'sukacombine.db');
const db = new Database(dbPath);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');

// Initialize database schema
db.exec(`
  -- Users table (admin)
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'admin',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  -- Workers table
  CREATE TABLE IF NOT EXISTS workers (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    assigned_accounts TEXT DEFAULT '[]',
    permissions TEXT DEFAULT '{}',
    last_active TEXT,
    actions_log TEXT DEFAULT '[]',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  -- Accounts table
  CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    login TEXT NOT NULL,
    password TEXT NOT NULL,
    ma_file TEXT,
    avatar TEXT,
    display_name TEXT,
    steam_id TEXT,
    level INTEGER DEFAULT 0,
    status TEXT DEFAULT 'offline',
    game TEXT,
    balance REAL DEFAULT 0,
    guard_enabled INTEGER DEFAULT 0,
    server TEXT,
    trade_ban INTEGER DEFAULT 0,
    vac_ban INTEGER DEFAULT 0,
    limited INTEGER DEFAULT 0,
    friends_count INTEGER DEFAULT 0,
    inventory_value REAL DEFAULT 0,
    error_message TEXT,
    owner_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  -- Messages table
  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    account_login TEXT NOT NULL,
    friend_id TEXT NOT NULL,
    friend_name TEXT NOT NULL,
    friend_avatar TEXT,
    text TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    is_outgoing INTEGER DEFAULT 0,
    is_read INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
  );

  -- Trade offers table
  CREATE TABLE IF NOT EXISTS trade_offers (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    partner_id TEXT NOT NULL,
    partner_name TEXT NOT NULL,
    partner_avatar TEXT,
    items_give TEXT DEFAULT '[]',
    items_receive TEXT DEFAULT '[]',
    status TEXT DEFAULT 'pending',
    timestamp TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
  );

  -- Parser keys table
  CREATE TABLE IF NOT EXISTS parser_keys (
    id TEXT PRIMARY KEY,
    key TEXT UNIQUE NOT NULL,
    is_active INTEGER DEFAULT 1,
    used_at TEXT,
    used_by TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  -- Parse jobs table
  CREATE TABLE IF NOT EXISTS parse_jobs (
    id TEXT PRIMARY KEY,
    status TEXT DEFAULT 'pending',
    config TEXT DEFAULT '{}',
    stats TEXT DEFAULT '{}',
    results TEXT DEFAULT '[]',
    logs TEXT DEFAULT '[]',
    error TEXT,
    created_at TEXT NOT NULL,
    completed_at TEXT,
    updated_at TEXT NOT NULL
  );

  -- Inventory cache table
  CREATE TABLE IF NOT EXISTS inventory_cache (
    steam_id TEXT PRIMARY KEY,
    value REAL NOT NULL,
    updated_at TEXT NOT NULL
  );

  -- Settings table
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  -- Create indexes
  CREATE INDEX IF NOT EXISTS idx_accounts_owner ON accounts(owner_id);
  CREATE INDEX IF NOT EXISTS idx_accounts_status ON accounts(status);
  CREATE INDEX IF NOT EXISTS idx_messages_account ON messages(account_id);
  CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);
  CREATE INDEX IF NOT EXISTS idx_parser_keys_key ON parser_keys(key);
  CREATE INDEX IF NOT EXISTS idx_parse_jobs_status ON parse_jobs(status);
`);

// ============= MIGRATION =============
// Fix parse_jobs table if it was created with old schema
try {
  const cols = db.prepare("PRAGMA table_info(parse_jobs)").all();
  const colNames = cols.map(c => c.name);
  
  if (!colNames.includes('config')) {
    console.log('[DB] Migrating parse_jobs table to new schema...');
    db.exec('DROP TABLE IF EXISTS parse_jobs');
    db.exec(`
      CREATE TABLE parse_jobs (
        id TEXT PRIMARY KEY,
        status TEXT DEFAULT 'pending',
        config TEXT DEFAULT '{}',
        stats TEXT DEFAULT '{}',
        results TEXT DEFAULT '[]',
        logs TEXT DEFAULT '[]',
        error TEXT,
        created_at TEXT NOT NULL,
        completed_at TEXT,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_parse_jobs_status ON parse_jobs(status);
    `);
    console.log('[DB] parse_jobs table migrated successfully');
  }
} catch (err) {
  console.error('[DB] Migration error:', err.message);
}

// Create default admin if not exists
const adminExists = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
if (!adminExists) {
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO users (id, username, password_hash, role, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run('admin', 'admin', 'admin123', 'admin', now, now);
  console.log('[DB] Default admin created');
}

console.log(`[DB] Database initialized at ${dbPath}`);

// Database operations
export const dbOps = {
  // ============= USERS / AUTH =============
  getUserByCredentials(username, password) {
    return db.prepare(`
      SELECT * FROM users WHERE username = ? AND password_hash = ?
    `).get(username, password);
  },

  updateAdminCredentials(username, password) {
    const now = new Date().toISOString();
    db.prepare(`
      UPDATE users SET username = ?, password_hash = ?, updated_at = ? WHERE role = 'admin'
    `).run(username, password, now);
  },

  // ============= WORKERS =============
  getAllWorkers() {
    const rows = db.prepare('SELECT * FROM workers ORDER BY created_at DESC').all();
    return rows.map(r => ({
      id: r.id,
      username: r.username,
      password: r.password,
      assignedAccounts: JSON.parse(r.assigned_accounts || '[]'),
      permissions: JSON.parse(r.permissions || '{}'),
      lastActive: r.last_active || r.created_at,
      actionsLog: JSON.parse(r.actions_log || '[]'),
    }));
  },

  createWorker(worker) {
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO workers (id, username, password, assigned_accounts, permissions, last_active, actions_log, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      worker.id,
      worker.username,
      worker.password,
      JSON.stringify(worker.assignedAccounts || []),
      JSON.stringify(worker.permissions || {}),
      now, '[]', now, now
    );
    return worker;
  },

  updateWorker(id, data) {
    const now = new Date().toISOString();
    const existing = db.prepare('SELECT * FROM workers WHERE id = ?').get(id);
    if (!existing) return null;

    if (data.assignedAccounts) {
      db.prepare('UPDATE workers SET assigned_accounts = ?, updated_at = ? WHERE id = ?')
        .run(JSON.stringify(data.assignedAccounts), now, id);
    }
    if (data.permissions) {
      db.prepare('UPDATE workers SET permissions = ?, updated_at = ? WHERE id = ?')
        .run(JSON.stringify(data.permissions), now, id);
    }
    if (data.username) {
      db.prepare('UPDATE workers SET username = ?, updated_at = ? WHERE id = ?')
        .run(data.username, now, id);
    }
    if (data.password) {
      db.prepare('UPDATE workers SET password = ?, updated_at = ? WHERE id = ?')
        .run(data.password, now, id);
    }
    return { id, ...data };
  },

  deleteWorker(id) {
    db.prepare('DELETE FROM workers WHERE id = ?').run(id);
  },

  // ============= ACCOUNTS =============
  getAllAccounts() {
    const rows = db.prepare('SELECT * FROM accounts ORDER BY created_at DESC').all();
    return rows.map(r => ({
      id: r.id,
      login: r.login,
      password: r.password,
      maFile: r.ma_file ? JSON.parse(r.ma_file) : undefined,
      avatar: r.avatar || '🎮',
      avatarUrl: undefined,
      displayName: r.display_name || r.login,
      steamId: r.steam_id,
      level: r.level || 0,
      status: 'offline',
      game: r.game,
      balance: r.balance || 0,
      guardEnabled: !!r.guard_enabled,
      server: r.server || 'EU-1',
      tradeBan: !!r.trade_ban,
      vacBan: !!r.vac_ban,
      limited: !!r.limited,
      friendsCount: r.friends_count || 0,
      inventoryValue: r.inventory_value || 0,
      errorMessage: r.error_message,
      ownerId: r.owner_id,
    }));
  },

  saveAccounts(accounts) {
    const now = new Date().toISOString();
    const insertOrUpdate = db.prepare(`
      INSERT OR REPLACE INTO accounts (
        id, login, password, ma_file, avatar, display_name, steam_id,
        level, status, game, balance, guard_enabled, server,
        trade_ban, vac_ban, limited, friends_count, inventory_value,
        error_message, owner_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const saveMany = db.transaction((accs) => {
      // Get existing IDs
      const existingIds = new Set(
        db.prepare('SELECT id FROM accounts').all().map(r => r.id)
      );

      const newIds = new Set(accs.map(a => a.id));

      // Delete accounts not in the new list
      for (const existingId of existingIds) {
        if (!newIds.has(existingId)) {
          db.prepare('DELETE FROM accounts WHERE id = ?').run(existingId);
        }
      }

      // Insert/update accounts
      for (const a of accs) {
        insertOrUpdate.run(
          a.id, a.login, a.password,
          a.maFile ? JSON.stringify(a.maFile) : null,
          a.avatar, a.displayName || a.login, a.steamId || null,
          a.level || 0, a.status || 'offline', a.game || null,
          a.balance || 0, a.guardEnabled ? 1 : 0, a.server || 'EU-1',
          a.tradeBan ? 1 : 0, a.vacBan ? 1 : 0, a.limited ? 1 : 0,
          a.friendsCount || 0, a.inventoryValue || 0,
          a.errorMessage || null, a.ownerId || null,
          now, now
        );
      }
    });

    saveMany(accounts);
  },

  deleteAccount(id) {
    db.prepare('DELETE FROM accounts WHERE id = ?').run(id);
  },

  // ============= MESSAGES =============
  getMessages(limit = 500) {
    const rows = db.prepare(
      'SELECT * FROM messages ORDER BY timestamp DESC LIMIT ?'
    ).all(limit);
    return rows.reverse().map(r => ({
      id: r.id,
      accountId: r.account_id,
      accountLogin: r.account_login,
      friendId: r.friend_id,
      friendName: r.friend_name,
      friendAvatar: r.friend_avatar || '👤',
      text: r.text,
      timestamp: r.timestamp,
      isOutgoing: !!r.is_outgoing,
    }));
  },

  saveMessage(msg) {
    const now = new Date().toISOString();
    db.prepare(`
      INSERT OR IGNORE INTO messages (
        id, account_id, account_login, friend_id, friend_name,
        friend_avatar, text, timestamp, is_outgoing, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      msg.id, msg.accountId, msg.accountLogin, msg.friendId,
      msg.friendName, msg.friendAvatar || '👤', msg.text,
      msg.timestamp, msg.isOutgoing ? 1 : 0, now
    );
  },

  // ============= STATS =============
  getStats() {
    const accounts = db.prepare('SELECT COUNT(*) as count FROM accounts').get();
    const workers = db.prepare('SELECT COUNT(*) as count FROM workers').get();
    const messages = db.prepare('SELECT COUNT(*) as count FROM messages').get();
    const parseJobs = db.prepare('SELECT COUNT(*) as count FROM parse_jobs').get();
    return {
      accounts: accounts.count,
      workers: workers.count,
      messages: messages.count,
      parseJobs: parseJobs.count,
    };
  },

  // ============= SETTINGS =============
  getSetting(key) {
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
    return row ? JSON.parse(row.value) : null;
  },

  setSetting(key, value) {
    const now = new Date().toISOString();
    db.prepare(`
      INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)
    `).run(key, JSON.stringify(value), now);
  },

  // ============= PARSE JOBS =============
  createParseJob(job) {
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO parse_jobs (id, status, config, stats, results, logs, error, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      job.id,
      job.status || 'running',
      JSON.stringify(job.config || {}),
      JSON.stringify(job.stats || {}),
      JSON.stringify(job.results || []),
      JSON.stringify(job.logs || []),
      job.error || null,
      now, now
    );
    return job;
  },

  updateParseJob(id, data) {
    const now = new Date().toISOString();
    const existing = db.prepare('SELECT * FROM parse_jobs WHERE id = ?').get(id);
    if (!existing) return null;

    const updates = [];
    const params = [];

    if (data.status !== undefined) { updates.push('status = ?'); params.push(data.status); }
    if (data.stats !== undefined) { updates.push('stats = ?'); params.push(JSON.stringify(data.stats)); }
    if (data.results !== undefined) { updates.push('results = ?'); params.push(JSON.stringify(data.results)); }
    if (data.logs !== undefined) { updates.push('logs = ?'); params.push(JSON.stringify(data.logs)); }
    if (data.error !== undefined) { updates.push('error = ?'); params.push(data.error); }
    if (data.completedAt !== undefined) { updates.push('completed_at = ?'); params.push(data.completedAt); }

    updates.push('updated_at = ?');
    params.push(now);
    params.push(id);

    db.prepare(`UPDATE parse_jobs SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  },

  getParseJob(id) {
    const row = db.prepare('SELECT * FROM parse_jobs WHERE id = ?').get(id);
    if (!row) return null;
    return {
      id: row.id,
      status: row.status,
      config: JSON.parse(row.config || '{}'),
      stats: JSON.parse(row.stats || '{}'),
      results: JSON.parse(row.results || '[]'),
      logs: JSON.parse(row.logs || '[]'),
      error: row.error,
      startedAt: row.created_at,
      completedAt: row.completed_at,
    };
  },

  getAllParseJobs() {
    const rows = db.prepare('SELECT * FROM parse_jobs ORDER BY created_at DESC LIMIT 50').all();
    return rows.map(row => ({
      id: row.id,
      status: row.status,
      config: JSON.parse(row.config || '{}'),
      stats: JSON.parse(row.stats || '{}'),
      results: JSON.parse(row.results || '[]'),
      logs: JSON.parse(row.logs || '[]'),
      error: row.error,
      startedAt: row.created_at,
      completedAt: row.completed_at,
    }));
  },

  // ============= INVENTORY CACHE =============
  setInventoryValue(steamId, value) {
    const now = new Date().toISOString();
    db.prepare(`
      INSERT OR REPLACE INTO inventory_cache (steam_id, value, updated_at) VALUES (?, ?, ?)
    `).run(steamId, value, now);
  },

  getInventoryValue(steamId) {
    const row = db.prepare('SELECT value FROM inventory_cache WHERE steam_id = ?').get(steamId);
    return row ? row.value : null;
  },

  // ============= CLEANUP =============
  clearAll() {
    db.exec('DELETE FROM accounts');
    db.exec('DELETE FROM messages');
    db.exec('DELETE FROM trade_offers');
    db.exec('DELETE FROM parse_jobs');
    db.exec('DELETE FROM inventory_cache');
  },
};

export default db;
