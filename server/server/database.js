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

  -- Messages table (ВАЖНО: хранит ВСЮ историю переписок)
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
    created_at TEXT NOT NULL
  );

  -- Chats table (для быстрого доступа к списку чатов)
  CREATE TABLE IF NOT EXISTS chats (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    account_login TEXT NOT NULL,
    friend_id TEXT NOT NULL,
    friend_name TEXT NOT NULL,
    friend_avatar TEXT,
    last_message TEXT,
    last_message_time TEXT,
    unread_count INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
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
    updated_at TEXT NOT NULL
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
    items TEXT DEFAULT '[]',
    updated_at TEXT NOT NULL
  );

  -- Settings table
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  -- Worker nodes table (для распределённых нод)
  CREATE TABLE IF NOT EXISTS worker_nodes (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    ip TEXT NOT NULL,
    port INTEGER DEFAULT 3001,
    status TEXT DEFAULT 'offline',
    capabilities TEXT DEFAULT '[]',
    system_info TEXT DEFAULT '{}',
    last_heartbeat TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  -- Create indexes
  CREATE INDEX IF NOT EXISTS idx_accounts_owner ON accounts(owner_id);
  CREATE INDEX IF NOT EXISTS idx_accounts_status ON accounts(status);
  CREATE INDEX IF NOT EXISTS idx_accounts_steam_id ON accounts(steam_id);
  CREATE INDEX IF NOT EXISTS idx_messages_account ON messages(account_id);
  CREATE INDEX IF NOT EXISTS idx_messages_friend ON messages(friend_id);
  CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);
  CREATE INDEX IF NOT EXISTS idx_messages_account_friend ON messages(account_id, friend_id);
  CREATE INDEX IF NOT EXISTS idx_chats_account ON chats(account_id);
  CREATE INDEX IF NOT EXISTS idx_chats_account_friend ON chats(account_id, friend_id);
  CREATE INDEX IF NOT EXISTS idx_parser_keys_key ON parser_keys(key);
  CREATE INDEX IF NOT EXISTS idx_parse_jobs_status ON parse_jobs(status);
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

    if (data.assignedAccounts !== undefined) {
      db.prepare('UPDATE workers SET assigned_accounts = ?, updated_at = ? WHERE id = ?')
        .run(JSON.stringify(data.assignedAccounts), now, id);
    }
    if (data.permissions !== undefined) {
      db.prepare('UPDATE workers SET permissions = ?, updated_at = ? WHERE id = ?')
        .run(JSON.stringify(data.permissions), now, id);
    }
    if (data.username !== undefined) {
      db.prepare('UPDATE workers SET username = ?, updated_at = ? WHERE id = ?')
        .run(data.username, now, id);
    }
    if (data.password !== undefined) {
      db.prepare('UPDATE workers SET password = ?, updated_at = ? WHERE id = ?')
        .run(data.password, now, id);
    }
    if (data.lastActive !== undefined) {
      db.prepare('UPDATE workers SET last_active = ?, updated_at = ? WHERE id = ?')
        .run(data.lastActive, now, id);
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
      maFile: r.ma_file ? JSON.parse(r.ma_file) : null,
      avatar: r.avatar,
      displayName: r.display_name || r.login,
      steamId: r.steam_id,
      level: r.level || 0,
      status: r.status || 'offline',
      game: r.game,
      balance: r.balance || 0,
      guardEnabled: r.guard_enabled === 1,
      server: r.server,
      tradeBan: r.trade_ban === 1,
      vacBan: r.vac_ban === 1,
      limited: r.limited === 1,
      friendsCount: r.friends_count || 0,
      inventoryValue: r.inventory_value || 0,
      errorMessage: r.error_message,
      ownerId: r.owner_id,
      createdAt: r.created_at,
    }));
  },

  getAccountById(id) {
    const r = db.prepare('SELECT * FROM accounts WHERE id = ?').get(id);
    if (!r) return null;
    return {
      id: r.id,
      login: r.login,
      password: r.password,
      maFile: r.ma_file ? JSON.parse(r.ma_file) : null,
      avatar: r.avatar,
      displayName: r.display_name || r.login,
      steamId: r.steam_id,
      level: r.level || 0,
      status: r.status || 'offline',
      balance: r.balance || 0,
      guardEnabled: r.guard_enabled === 1,
      tradeBan: r.trade_ban === 1,
      vacBan: r.vac_ban === 1,
      limited: r.limited === 1,
      friendsCount: r.friends_count || 0,
      inventoryValue: r.inventory_value || 0,
    };
  },

  saveAccounts(accounts) {
    const now = new Date().toISOString();
    const insert = db.prepare(`
      INSERT OR REPLACE INTO accounts 
      (id, login, password, ma_file, avatar, display_name, steam_id, level, status, game, balance, guard_enabled, server, trade_ban, vac_ban, limited, friends_count, inventory_value, error_message, owner_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMany = db.transaction((accs) => {
      for (const acc of accs) {
        insert.run(
          acc.id,
          acc.login,
          acc.password,
          acc.maFile ? JSON.stringify(acc.maFile) : null,
          acc.avatar || null,
          acc.displayName || acc.login,
          acc.steamId || null,
          acc.level || 0,
          acc.status || 'offline',
          acc.game || null,
          acc.balance || 0,
          acc.guardEnabled ? 1 : 0,
          acc.server || null,
          acc.tradeBan ? 1 : 0,
          acc.vacBan ? 1 : 0,
          acc.limited ? 1 : 0,
          acc.friendsCount || 0,
          acc.inventoryValue || 0,
          acc.errorMessage || null,
          acc.ownerId || null,
          acc.createdAt || now,
          now
        );
      }
    });

    insertMany(accounts);
  },

  updateAccount(id, data) {
    const now = new Date().toISOString();
    const fields = [];
    const values = [];

    if (data.steamId !== undefined) { fields.push('steam_id = ?'); values.push(data.steamId); }
    if (data.displayName !== undefined) { fields.push('display_name = ?'); values.push(data.displayName); }
    if (data.avatar !== undefined) { fields.push('avatar = ?'); values.push(data.avatar); }
    if (data.level !== undefined) { fields.push('level = ?'); values.push(data.level); }
    if (data.status !== undefined) { fields.push('status = ?'); values.push(data.status); }
    if (data.balance !== undefined) { fields.push('balance = ?'); values.push(data.balance); }
    if (data.friendsCount !== undefined) { fields.push('friends_count = ?'); values.push(data.friendsCount); }
    if (data.inventoryValue !== undefined) { fields.push('inventory_value = ?'); values.push(data.inventoryValue); }
    if (data.tradeBan !== undefined) { fields.push('trade_ban = ?'); values.push(data.tradeBan ? 1 : 0); }
    if (data.vacBan !== undefined) { fields.push('vac_ban = ?'); values.push(data.vacBan ? 1 : 0); }
    if (data.limited !== undefined) { fields.push('limited = ?'); values.push(data.limited ? 1 : 0); }
    if (data.errorMessage !== undefined) { fields.push('error_message = ?'); values.push(data.errorMessage); }

    if (fields.length > 0) {
      fields.push('updated_at = ?');
      values.push(now);
      values.push(id);
      db.prepare(`UPDATE accounts SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    }
  },

  deleteAccount(id) {
    db.prepare('DELETE FROM messages WHERE account_id = ?').run(id);
    db.prepare('DELETE FROM chats WHERE account_id = ?').run(id);
    db.prepare('DELETE FROM accounts WHERE id = ?').run(id);
  },

  // ============= MESSAGES (ВАЖНО: полное сохранение истории) =============
  
  // Сохранить одно сообщение
  saveMessage(msg) {
    const now = new Date().toISOString();
    
    // Вставляем сообщение
    db.prepare(`
      INSERT OR REPLACE INTO messages 
      (id, account_id, account_login, friend_id, friend_name, friend_avatar, text, timestamp, is_outgoing, is_read, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      msg.id,
      msg.accountId,
      msg.accountLogin || '',
      msg.friendId,
      msg.friendName || msg.friendId,
      msg.friendAvatar || '👤',
      msg.text,
      msg.timestamp || now,
      msg.isOutgoing ? 1 : 0,
      msg.isRead ? 1 : 0,
      now
    );

    // Обновляем или создаём чат
    const chatId = `${msg.accountId}_${msg.friendId}`;
    const existingChat = db.prepare('SELECT id FROM chats WHERE id = ?').get(chatId);
    
    if (existingChat) {
      db.prepare(`
        UPDATE chats SET 
          friend_name = ?, 
          friend_avatar = ?, 
          last_message = ?, 
          last_message_time = ?,
          unread_count = unread_count + ?,
          updated_at = ?
        WHERE id = ?
      `).run(
        msg.friendName || msg.friendId,
        msg.friendAvatar || '👤',
        msg.text.substring(0, 100),
        msg.timestamp || now,
        msg.isOutgoing ? 0 : 1,
        now,
        chatId
      );
    } else {
      db.prepare(`
        INSERT INTO chats (id, account_id, account_login, friend_id, friend_name, friend_avatar, last_message, last_message_time, unread_count, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        chatId,
        msg.accountId,
        msg.accountLogin || '',
        msg.friendId,
        msg.friendName || msg.friendId,
        msg.friendAvatar || '👤',
        msg.text.substring(0, 100),
        msg.timestamp || now,
        msg.isOutgoing ? 0 : 1,
        now,
        now
      );
    }

    return msg;
  },

  // Получить все сообщения (последние N)
  getMessages(limit = 500) {
    const rows = db.prepare(`
      SELECT * FROM messages ORDER BY timestamp DESC LIMIT ?
    `).all(limit);
    
    return rows.map(r => ({
      id: r.id,
      accountId: r.account_id,
      accountLogin: r.account_login,
      friendId: r.friend_id,
      friendName: r.friend_name,
      friendAvatar: r.friend_avatar,
      text: r.text,
      timestamp: r.timestamp,
      isOutgoing: r.is_outgoing === 1,
      isRead: r.is_read === 1,
    })).reverse(); // Oldest first
  },

  // Получить сообщения для конкретного чата
  getMessagesByChat(accountId, friendId, limit = 100) {
    const rows = db.prepare(`
      SELECT * FROM messages 
      WHERE account_id = ? AND friend_id = ?
      ORDER BY timestamp DESC LIMIT ?
    `).all(accountId, friendId, limit);
    
    return rows.map(r => ({
      id: r.id,
      accountId: r.account_id,
      accountLogin: r.account_login,
      friendId: r.friend_id,
      friendName: r.friend_name,
      friendAvatar: r.friend_avatar,
      text: r.text,
      timestamp: r.timestamp,
      isOutgoing: r.is_outgoing === 1,
      isRead: r.is_read === 1,
    })).reverse();
  },

  // Получить сообщения для аккаунта
  getMessagesByAccount(accountId, limit = 200) {
    const rows = db.prepare(`
      SELECT * FROM messages 
      WHERE account_id = ?
      ORDER BY timestamp DESC LIMIT ?
    `).all(accountId, limit);
    
    return rows.map(r => ({
      id: r.id,
      accountId: r.account_id,
      accountLogin: r.account_login,
      friendId: r.friend_id,
      friendName: r.friend_name,
      friendAvatar: r.friend_avatar,
      text: r.text,
      timestamp: r.timestamp,
      isOutgoing: r.is_outgoing === 1,
      isRead: r.is_read === 1,
    })).reverse();
  },

  // Получить список чатов
  getChats(accountId = null) {
    let rows;
    if (accountId) {
      rows = db.prepare(`
        SELECT * FROM chats WHERE account_id = ? ORDER BY last_message_time DESC
      `).all(accountId);
    } else {
      rows = db.prepare(`
        SELECT * FROM chats ORDER BY last_message_time DESC
      `).all();
    }
    
    return rows.map(r => ({
      id: r.id,
      accountId: r.account_id,
      accountLogin: r.account_login,
      friendId: r.friend_id,
      friendName: r.friend_name,
      friendAvatar: r.friend_avatar,
      lastMessage: r.last_message,
      lastMessageTime: r.last_message_time,
      unreadCount: r.unread_count,
    }));
  },

  // Пометить сообщения как прочитанные
  markMessagesAsRead(accountId, friendId) {
    const now = new Date().toISOString();
    db.prepare(`
      UPDATE messages SET is_read = 1 WHERE account_id = ? AND friend_id = ? AND is_read = 0
    `).run(accountId, friendId);
    
    db.prepare(`
      UPDATE chats SET unread_count = 0, updated_at = ? WHERE account_id = ? AND friend_id = ?
    `).run(now, accountId, friendId);
  },

  // Удалить сообщения чата
  deleteChat(accountId, friendId) {
    db.prepare('DELETE FROM messages WHERE account_id = ? AND friend_id = ?').run(accountId, friendId);
    db.prepare('DELETE FROM chats WHERE account_id = ? AND friend_id = ?').run(accountId, friendId);
  },

  // Количество непрочитанных сообщений
  getUnreadCount(accountId = null) {
    if (accountId) {
      const result = db.prepare('SELECT SUM(unread_count) as count FROM chats WHERE account_id = ?').get(accountId);
      return result?.count || 0;
    }
    const result = db.prepare('SELECT SUM(unread_count) as count FROM chats').get();
    return result?.count || 0;
  },

  // ============= INVENTORY CACHE =============
  getInventoryCache(steamId) {
    return db.prepare('SELECT * FROM inventory_cache WHERE steam_id = ?').get(steamId);
  },

  setInventoryCache(steamId, value, items = []) {
    const now = new Date().toISOString();
    db.prepare(`
      INSERT OR REPLACE INTO inventory_cache (steam_id, value, items, updated_at)
      VALUES (?, ?, ?, ?)
    `).run(steamId, value, JSON.stringify(items), now);
  },

  // ============= SETTINGS =============
  getSetting(key) {
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
    return row ? row.value : null;
  },

  setSetting(key, value) {
    const now = new Date().toISOString();
    db.prepare(`
      INSERT OR REPLACE INTO settings (key, value, updated_at)
      VALUES (?, ?, ?)
    `).run(key, value, now);
  },

  // ============= WORKER NODES =============
  getAllNodes() {
    return db.prepare('SELECT * FROM worker_nodes ORDER BY created_at DESC').all();
  },

  saveNode(node) {
    const now = new Date().toISOString();
    db.prepare(`
      INSERT OR REPLACE INTO worker_nodes 
      (id, name, ip, port, status, capabilities, system_info, last_heartbeat, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      node.nodeId || node.id,
      node.name,
      node.ip,
      node.port || 3001,
      node.status || 'online',
      JSON.stringify(node.capabilities || []),
      JSON.stringify(node.systemInfo || {}),
      now,
      now,
      now
    );
  },

  updateNodeHeartbeat(nodeId, data = {}) {
    const now = new Date().toISOString();
    db.prepare(`
      UPDATE worker_nodes SET status = 'online', last_heartbeat = ?, system_info = ?, updated_at = ? WHERE id = ?
    `).run(now, JSON.stringify(data.systemInfo || {}), now, nodeId);
  },

  deleteNode(nodeId) {
    db.prepare('DELETE FROM worker_nodes WHERE id = ?').run(nodeId);
  },

  // ============= STATS =============
  getStats() {
    const accounts = db.prepare('SELECT COUNT(*) as c FROM accounts').get().c;
    const workers = db.prepare('SELECT COUNT(*) as c FROM workers').get().c;
    const messages = db.prepare('SELECT COUNT(*) as c FROM messages').get().c;
    const chats = db.prepare('SELECT COUNT(*) as c FROM chats').get().c;
    const parseJobs = db.prepare('SELECT COUNT(*) as c FROM parse_jobs').get().c;
    const nodes = db.prepare('SELECT COUNT(*) as c FROM worker_nodes').get().c;
    const unread = this.getUnreadCount();
    
    return { accounts, workers, messages, chats, parseJobs, nodes, unreadMessages: unread };
  },

  // ============= CLEAR =============
  clearAll() {
    db.prepare('DELETE FROM messages').run();
    db.prepare('DELETE FROM chats').run();
    db.prepare('DELETE FROM accounts').run();
  },

  clearMessages() {
    db.prepare('DELETE FROM messages').run();
    db.prepare('DELETE FROM chats').run();
  },
};

export default db;
