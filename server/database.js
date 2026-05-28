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

  -- Admin settings
  CREATE TABLE IF NOT EXISTS admin_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  -- VPS servers for load distribution
  CREATE TABLE IF NOT EXISTS vps_servers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    ip TEXT NOT NULL,
    ssh_user TEXT NOT NULL,
    ssh_password TEXT,
    ssh_key TEXT,
    ssh_port INTEGER DEFAULT 22,
    status TEXT DEFAULT 'pending',
    last_heartbeat TEXT,
    tasks_count INTEGER DEFAULT 0,
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
    proxies TEXT DEFAULT '{"list":[],"accountsPerProxy":1}',
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
    proxy TEXT,
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
    country TEXT NOT NULL,
    min_inventory_value REAL DEFAULT 0,
    max_inventory_value REAL DEFAULT 10000,
    target_count INTEGER NOT NULL,
    parsed_count INTEGER DEFAULT 0,
    scanned_count INTEGER DEFAULT 0,
    results TEXT DEFAULT '[]',
    error TEXT,
    vps_id TEXT,
    created_at TEXT NOT NULL,
    completed_at TEXT,
    updated_at TEXT NOT NULL
  );

  -- Screen link templates (HTML files for screenshot generation)
  CREATE TABLE IF NOT EXISTS screen_templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    html_content TEXT NOT NULL,
    placeholder_url TEXT DEFAULT 'https://example.com',
    created_at TEXT NOT NULL,
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
  CREATE INDEX IF NOT EXISTS idx_vps_status ON vps_servers(status);
`);

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

  // ============= ADMIN SETTINGS =============
  getAdminSetting(key) {
    const row = db.prepare('SELECT value FROM admin_settings WHERE key = ?').get(key);
    return row ? JSON.parse(row.value) : null;
  },

  setAdminSetting(key, value) {
    const now = new Date().toISOString();
    db.prepare(`
      INSERT OR REPLACE INTO admin_settings (key, value, updated_at)
      VALUES (?, ?, ?)
    `).run(key, JSON.stringify(value), now);
  },

  getAllAdminSettings() {
    const rows = db.prepare('SELECT * FROM admin_settings').all();
    const settings = {};
    for (const row of rows) {
      settings[row.key] = JSON.parse(row.value);
    }
    return settings;
  },

  // ============= VPS SERVERS =============
  getAllVpsServers() {
    return db.prepare('SELECT * FROM vps_servers ORDER BY created_at DESC').all();
  },

  getVpsServerById(id) {
    return db.prepare('SELECT * FROM vps_servers WHERE id = ?').get(id);
  },

  getAvailableVpsServer() {
    // Get VPS with status 'online' and least tasks
    return db.prepare(`
      SELECT * FROM vps_servers 
      WHERE status = 'online' 
      ORDER BY tasks_count ASC 
      LIMIT 1
    `).get();
  },

  createVpsServer(server) {
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO vps_servers (id, name, ip, ssh_user, ssh_password, ssh_key, ssh_port, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      server.id,
      server.name,
      server.ip,
      server.sshUser,
      server.sshPassword || null,
      server.sshKey || null,
      server.sshPort || 22,
      'pending',
      now,
      now
    );
    return server;
  },

  updateVpsServer(id, data) {
    const now = new Date().toISOString();
    const updates = [];
    const values = [];

    if (data.status !== undefined) {
      updates.push('status = ?');
      values.push(data.status);
    }
    if (data.lastHeartbeat !== undefined) {
      updates.push('last_heartbeat = ?');
      values.push(data.lastHeartbeat);
    }
    if (data.tasksCount !== undefined) {
      updates.push('tasks_count = ?');
      values.push(data.tasksCount);
    }
    if (data.name !== undefined) {
      updates.push('name = ?');
      values.push(data.name);
    }

    updates.push('updated_at = ?');
    values.push(now);
    values.push(id);

    db.prepare(`UPDATE vps_servers SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  },

  deleteVpsServer(id) {
    db.prepare('DELETE FROM vps_servers WHERE id = ?').run(id);
  },

  incrementVpsTasks(id) {
    db.prepare('UPDATE vps_servers SET tasks_count = tasks_count + 1 WHERE id = ?').run(id);
  },

  decrementVpsTasks(id) {
    db.prepare('UPDATE vps_servers SET tasks_count = MAX(0, tasks_count - 1) WHERE id = ?').run(id);
  },

  // ============= WORKERS =============
  getAllWorkers() {
    const rows = db.prepare('SELECT * FROM workers ORDER BY created_at DESC').all();
    return rows.map(row => ({
      ...row,
      assignedAccounts: JSON.parse(row.assigned_accounts || '[]'),
      permissions: JSON.parse(row.permissions || '{}'),
      proxies: JSON.parse(row.proxies || '{"list":[],"accountsPerProxy":1}'),
      actionsLog: JSON.parse(row.actions_log || '[]'),
    }));
  },

  getWorkerById(id) {
    const row = db.prepare('SELECT * FROM workers WHERE id = ?').get(id);
    if (!row) return null;
    return {
      ...row,
      assignedAccounts: JSON.parse(row.assigned_accounts || '[]'),
      permissions: JSON.parse(row.permissions || '{}'),
      proxies: JSON.parse(row.proxies || '{"list":[],"accountsPerProxy":1}'),
      actionsLog: JSON.parse(row.actions_log || '[]'),
    };
  },

  getWorkerByCredentials(username, password) {
    const row = db.prepare('SELECT * FROM workers WHERE username = ? AND password = ?').get(username, password);
    if (!row) return null;
    return {
      ...row,
      assignedAccounts: JSON.parse(row.assigned_accounts || '[]'),
      permissions: JSON.parse(row.permissions || '{}'),
      proxies: JSON.parse(row.proxies || '{"list":[],"accountsPerProxy":1}'),
      actionsLog: JSON.parse(row.actions_log || '[]'),
    };
  },

  createWorker(worker) {
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO workers (id, username, password, assigned_accounts, permissions, proxies, last_active, actions_log, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      worker.id,
      worker.username,
      worker.password,
      JSON.stringify(worker.assignedAccounts || []),
      JSON.stringify(worker.permissions || {}),
      JSON.stringify(worker.proxies || { list: [], accountsPerProxy: 1 }),
      now,
      JSON.stringify([]),
      now,
      now
    );
    return worker;
  },

  updateWorker(id, data) {
    const now = new Date().toISOString();
    const updates = [];
    const values = [];

    if (data.assignedAccounts !== undefined) {
      updates.push('assigned_accounts = ?');
      values.push(JSON.stringify(data.assignedAccounts));
    }
    if (data.permissions !== undefined) {
      updates.push('permissions = ?');
      values.push(JSON.stringify(data.permissions));
    }
    if (data.proxies !== undefined) {
      updates.push('proxies = ?');
      values.push(JSON.stringify(data.proxies));
    }
    if (data.lastActive !== undefined) {
      updates.push('last_active = ?');
      values.push(data.lastActive);
    }
    if (data.actionsLog !== undefined) {
      updates.push('actions_log = ?');
      values.push(JSON.stringify(data.actionsLog));
    }

    updates.push('updated_at = ?');
    values.push(now);
    values.push(id);

    db.prepare(`UPDATE workers SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  },

  deleteWorker(id) {
    db.prepare('DELETE FROM workers WHERE id = ?').run(id);
  },

  // ============= ACCOUNTS =============
  getAllAccounts() {
    const rows = db.prepare('SELECT * FROM accounts ORDER BY created_at DESC').all();
    return rows.map(row => ({
      id: row.id,
      login: row.login,
      password: row.password,
      maFile: row.ma_file ? JSON.parse(row.ma_file) : undefined,
      avatar: row.avatar,
      displayName: row.display_name,
      steamId: row.steam_id,
      level: row.level,
      status: row.status,
      game: row.game,
      balance: row.balance,
      guardEnabled: !!row.guard_enabled,
      server: row.server,
      tradeBan: !!row.trade_ban,
      vacBan: !!row.vac_ban,
      limited: !!row.limited,
      friendsCount: row.friends_count,
      inventoryValue: row.inventory_value,
      errorMessage: row.error_message,
      ownerId: row.owner_id,
      proxy: row.proxy,
    }));
  },

  getAccountsByOwner(ownerId) {
    const rows = db.prepare('SELECT * FROM accounts WHERE owner_id = ? ORDER BY created_at DESC').all(ownerId);
    return rows.map(row => ({
      id: row.id,
      login: row.login,
      password: row.password,
      maFile: row.ma_file ? JSON.parse(row.ma_file) : undefined,
      avatar: row.avatar,
      displayName: row.display_name,
      steamId: row.steam_id,
      level: row.level,
      status: row.status,
      game: row.game,
      balance: row.balance,
      guardEnabled: !!row.guard_enabled,
      server: row.server,
      tradeBan: !!row.trade_ban,
      vacBan: !!row.vac_ban,
      limited: !!row.limited,
      friendsCount: row.friends_count,
      inventoryValue: row.inventory_value,
      errorMessage: row.error_message,
      ownerId: row.owner_id,
      proxy: row.proxy,
    }));
  },

  createAccount(account) {
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO accounts (id, login, password, ma_file, avatar, display_name, steam_id, level, status, game, balance, guard_enabled, server, trade_ban, vac_ban, limited, friends_count, inventory_value, error_message, owner_id, proxy, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      account.id,
      account.login,
      account.password,
      account.maFile ? JSON.stringify(account.maFile) : null,
      account.avatar,
      account.displayName,
      account.steamId || null,
      account.level || 0,
      account.status || 'offline',
      account.game || null,
      account.balance || 0,
      account.guardEnabled ? 1 : 0,
      account.server,
      account.tradeBan ? 1 : 0,
      account.vacBan ? 1 : 0,
      account.limited ? 1 : 0,
      account.friendsCount || 0,
      account.inventoryValue || 0,
      account.errorMessage || null,
      account.ownerId || null,
      account.proxy || null,
      now,
      now
    );
    return account;
  },

  createAccounts(accounts) {
    const now = new Date().toISOString();
    const stmt = db.prepare(`
      INSERT INTO accounts (id, login, password, ma_file, avatar, display_name, steam_id, level, status, game, balance, guard_enabled, server, trade_ban, vac_ban, limited, friends_count, inventory_value, error_message, owner_id, proxy, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMany = db.transaction((accs) => {
      for (const account of accs) {
        stmt.run(
          account.id,
          account.login,
          account.password,
          account.maFile ? JSON.stringify(account.maFile) : null,
          account.avatar,
          account.displayName,
          account.steamId || null,
          account.level || 0,
          account.status || 'offline',
          account.game || null,
          account.balance || 0,
          account.guardEnabled ? 1 : 0,
          account.server,
          account.tradeBan ? 1 : 0,
          account.vacBan ? 1 : 0,
          account.limited ? 1 : 0,
          account.friendsCount || 0,
          account.inventoryValue || 0,
          account.errorMessage || null,
          account.ownerId || null,
          account.proxy || null,
          now,
          now
        );
      }
    });

    insertMany(accounts);
  },

  updateAccount(id, data) {
    const now = new Date().toISOString();
    const updates = [];
    const values = [];

    const fieldMap = {
      login: 'login',
      password: 'password',
      maFile: 'ma_file',
      avatar: 'avatar',
      displayName: 'display_name',
      steamId: 'steam_id',
      level: 'level',
      status: 'status',
      game: 'game',
      balance: 'balance',
      guardEnabled: 'guard_enabled',
      server: 'server',
      tradeBan: 'trade_ban',
      vacBan: 'vac_ban',
      limited: 'limited',
      friendsCount: 'friends_count',
      inventoryValue: 'inventory_value',
      errorMessage: 'error_message',
      ownerId: 'owner_id',
      proxy: 'proxy',
    };

    for (const [key, dbField] of Object.entries(fieldMap)) {
      if (data[key] !== undefined) {
        updates.push(`${dbField} = ?`);
        if (key === 'maFile') {
          values.push(data[key] ? JSON.stringify(data[key]) : null);
        } else if (['guardEnabled', 'tradeBan', 'vacBan', 'limited'].includes(key)) {
          values.push(data[key] ? 1 : 0);
        } else {
          values.push(data[key]);
        }
      }
    }

    updates.push('updated_at = ?');
    values.push(now);
    values.push(id);

    if (updates.length > 1) {
      db.prepare(`UPDATE accounts SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    }
  },

  deleteAccount(id) {
    db.prepare('DELETE FROM accounts WHERE id = ?').run(id);
  },

  deleteAccountsByOwner(ownerId) {
    db.prepare('DELETE FROM accounts WHERE owner_id = ?').run(ownerId);
  },

  // ============= MESSAGES =============
  getMessages(limit = 500) {
    const rows = db.prepare(`
      SELECT * FROM messages ORDER BY timestamp DESC LIMIT ?
    `).all(limit);
    return rows.map(row => ({
      id: row.id,
      accountId: row.account_id,
      accountLogin: row.account_login,
      friendId: row.friend_id,
      friendName: row.friend_name,
      friendAvatar: row.friend_avatar,
      text: row.text,
      timestamp: row.timestamp,
      isOutgoing: !!row.is_outgoing,
    })).reverse();
  },

  getMessagesByAccount(accountId, limit = 100) {
    const rows = db.prepare(`
      SELECT * FROM messages WHERE account_id = ? ORDER BY timestamp DESC LIMIT ?
    `).all(accountId, limit);
    return rows.map(row => ({
      id: row.id,
      accountId: row.account_id,
      accountLogin: row.account_login,
      friendId: row.friend_id,
      friendName: row.friend_name,
      friendAvatar: row.friend_avatar,
      text: row.text,
      timestamp: row.timestamp,
      isOutgoing: !!row.is_outgoing,
    })).reverse();
  },

  createMessage(message) {
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO messages (id, account_id, account_login, friend_id, friend_name, friend_avatar, text, timestamp, is_outgoing, is_read, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      message.id,
      message.accountId,
      message.accountLogin,
      message.friendId,
      message.friendName,
      message.friendAvatar || '👤',
      message.text,
      message.timestamp,
      message.isOutgoing ? 1 : 0,
      0,
      now
    );
    return message;
  },

  deleteMessagesByAccount(accountId) {
    db.prepare('DELETE FROM messages WHERE account_id = ?').run(accountId);
  },

  // ============= PARSER KEYS =============
  getAllParserKeys() {
    const rows = db.prepare('SELECT * FROM parser_keys ORDER BY created_at DESC').all();
    return rows.map(row => ({
      id: row.id,
      key: row.key,
      isActive: !!row.is_active,
      usedAt: row.used_at,
      usedBy: row.used_by,
      createdAt: row.created_at,
    }));
  },

  getParserKeyByKey(key) {
    const row = db.prepare('SELECT * FROM parser_keys WHERE key = ?').get(key);
    if (!row) return null;
    return {
      id: row.id,
      key: row.key,
      isActive: !!row.is_active,
      usedAt: row.used_at,
      usedBy: row.used_by,
      createdAt: row.created_at,
    };
  },

  createParserKey(parserKey) {
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO parser_keys (id, key, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(parserKey.id, parserKey.key, 1, now, now);
    return parserKey;
  },

  updateParserKey(id, data) {
    const now = new Date().toISOString();
    const updates = [];
    const values = [];

    if (data.isActive !== undefined) {
      updates.push('is_active = ?');
      values.push(data.isActive ? 1 : 0);
    }
    if (data.usedAt !== undefined) {
      updates.push('used_at = ?');
      values.push(data.usedAt);
    }
    if (data.usedBy !== undefined) {
      updates.push('used_by = ?');
      values.push(data.usedBy);
    }

    updates.push('updated_at = ?');
    values.push(now);
    values.push(id);

    db.prepare(`UPDATE parser_keys SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  },

  // ============= PARSE JOBS =============
  getAllParseJobs() {
    const rows = db.prepare('SELECT * FROM parse_jobs ORDER BY created_at DESC').all();
    return rows.map(row => ({
      id: row.id,
      status: row.status,
      country: row.country,
      minInventoryValue: row.min_inventory_value,
      maxInventoryValue: row.max_inventory_value,
      targetCount: row.target_count,
      parsedCount: row.parsed_count,
      scannedCount: row.scanned_count,
      results: JSON.parse(row.results || '[]'),
      error: row.error,
      vpsId: row.vps_id,
      createdAt: row.created_at,
      completedAt: row.completed_at,
    }));
  },

  getParseJobById(id) {
    const row = db.prepare('SELECT * FROM parse_jobs WHERE id = ?').get(id);
    if (!row) return null;
    return {
      id: row.id,
      status: row.status,
      country: row.country,
      minInventoryValue: row.min_inventory_value,
      maxInventoryValue: row.max_inventory_value,
      targetCount: row.target_count,
      parsedCount: row.parsed_count,
      scannedCount: row.scanned_count,
      results: JSON.parse(row.results || '[]'),
      error: row.error,
      vpsId: row.vps_id,
      createdAt: row.created_at,
      completedAt: row.completed_at,
    };
  },

  createParseJob(job) {
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO parse_jobs (id, status, country, min_inventory_value, max_inventory_value, target_count, parsed_count, scanned_count, results, vps_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      job.id,
      job.status || 'pending',
      job.country,
      job.minInventoryValue,
      job.maxInventoryValue,
      job.targetCount,
      0,
      0,
      '[]',
      job.vpsId || null,
      now,
      now
    );
    return job;
  },

  updateParseJob(id, data) {
    const now = new Date().toISOString();
    const updates = [];
    const values = [];

    if (data.status !== undefined) {
      updates.push('status = ?');
      values.push(data.status);
    }
    if (data.parsedCount !== undefined) {
      updates.push('parsed_count = ?');
      values.push(data.parsedCount);
    }
    if (data.scannedCount !== undefined) {
      updates.push('scanned_count = ?');
      values.push(data.scannedCount);
    }
    if (data.results !== undefined) {
      updates.push('results = ?');
      values.push(JSON.stringify(data.results));
    }
    if (data.error !== undefined) {
      updates.push('error = ?');
      values.push(data.error);
    }
    if (data.completedAt !== undefined) {
      updates.push('completed_at = ?');
      values.push(data.completedAt);
    }

    updates.push('updated_at = ?');
    values.push(now);
    values.push(id);

    db.prepare(`UPDATE parse_jobs SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  },

  // ============= SCREEN TEMPLATES =============
  getAllScreenTemplates() {
    return db.prepare('SELECT * FROM screen_templates ORDER BY created_at DESC').all();
  },

  getScreenTemplateById(id) {
    return db.prepare('SELECT * FROM screen_templates WHERE id = ?').get(id);
  },

  createScreenTemplate(template) {
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO screen_templates (id, name, html_content, placeholder_url, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(template.id, template.name, template.htmlContent, template.placeholderUrl || 'https://example.com', now, now);
    return template;
  },

  updateScreenTemplate(id, data) {
    const now = new Date().toISOString();
    const updates = [];
    const values = [];

    if (data.name !== undefined) {
      updates.push('name = ?');
      values.push(data.name);
    }
    if (data.htmlContent !== undefined) {
      updates.push('html_content = ?');
      values.push(data.htmlContent);
    }
    if (data.placeholderUrl !== undefined) {
      updates.push('placeholder_url = ?');
      values.push(data.placeholderUrl);
    }

    updates.push('updated_at = ?');
    values.push(now);
    values.push(id);

    db.prepare(`UPDATE screen_templates SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  },

  deleteScreenTemplate(id) {
    db.prepare('DELETE FROM screen_templates WHERE id = ?').run(id);
  },

  // ============= INVENTORY CACHE =============
  getInventoryValue(steamId) {
    const row = db.prepare('SELECT * FROM inventory_cache WHERE steam_id = ?').get(steamId);
    if (!row) return null;
    
    const cacheAge = Date.now() - new Date(row.updated_at).getTime();
    if (cacheAge > 60 * 60 * 1000) {
      return null;
    }
    
    return row.value;
  },

  setInventoryValue(steamId, value) {
    const now = new Date().toISOString();
    db.prepare(`
      INSERT OR REPLACE INTO inventory_cache (steam_id, value, updated_at)
      VALUES (?, ?, ?)
    `).run(steamId, value, now);
  },

  getAllInventoryCache() {
    const rows = db.prepare('SELECT * FROM inventory_cache').all();
    const cache = {};
    for (const row of rows) {
      cache[row.steam_id] = row.value;
    }
    return cache;
  },

  // ============= SETTINGS =============
  getSetting(key) {
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
    return row ? JSON.parse(row.value) : null;
  },

  setSetting(key, value) {
    const now = new Date().toISOString();
    db.prepare(`
      INSERT OR REPLACE INTO settings (key, value, updated_at)
      VALUES (?, ?, ?)
    `).run(key, JSON.stringify(value), now);
  },

  getAllSettings() {
    const rows = db.prepare('SELECT * FROM settings').all();
    const settings = {};
    for (const row of rows) {
      settings[row.key] = JSON.parse(row.value);
    }
    return settings;
  },

  // ============= STATS =============
  getStats() {
    return {
      accounts: db.prepare('SELECT COUNT(*) as count FROM accounts').get().count,
      workers: db.prepare('SELECT COUNT(*) as count FROM workers').get().count,
      messages: db.prepare('SELECT COUNT(*) as count FROM messages').get().count,
      parserKeys: db.prepare('SELECT COUNT(*) as count FROM parser_keys').get().count,
      parseJobs: db.prepare('SELECT COUNT(*) as count FROM parse_jobs').get().count,
      vpsServers: db.prepare('SELECT COUNT(*) as count FROM vps_servers').get().count,
      screenTemplates: db.prepare('SELECT COUNT(*) as count FROM screen_templates').get().count,
    };
  },

  // ============= EXPORT / IMPORT =============
  exportAll() {
    return {
      accounts: this.getAllAccounts(),
      workers: this.getAllWorkers(),
      messages: this.getMessages(10000),
      parserKeys: this.getAllParserKeys(),
      parseJobs: this.getAllParseJobs(),
      inventoryCache: this.getAllInventoryCache(),
      vpsServers: this.getAllVpsServers(),
      screenTemplates: this.getAllScreenTemplates(),
      adminSettings: this.getAllAdminSettings(),
      settings: this.getAllSettings(),
      exportedAt: new Date().toISOString(),
    };
  },

  clearAll() {
    db.exec(`
      DELETE FROM messages;
      DELETE FROM trade_offers;
      DELETE FROM accounts;
      DELETE FROM workers;
      DELETE FROM parser_keys;
      DELETE FROM parse_jobs;
      DELETE FROM inventory_cache;
      DELETE FROM settings;
    `);
  },
};

export default db;
