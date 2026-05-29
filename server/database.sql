-- SQLite Database Schema for SukaCombine

-- Users table
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
    avatar_url TEXT,
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
    friend_avatar_url TEXT,
    text TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    is_outgoing INTEGER DEFAULT 0,
    is_read INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
);

-- Parser Jobs table
CREATE TABLE IF NOT EXISTS parser_jobs (
    id TEXT PRIMARY KEY,
    status TEXT DEFAULT 'idle',
    config TEXT NOT NULL,
    stats TEXT DEFAULT '{}',
    started_at TEXT,
    completed_at TEXT,
    error TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Parser Results table
CREATE TABLE IF NOT EXISTS parser_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id TEXT NOT NULL,
    steam_id TEXT NOT NULL,
    inventory_value REAL NOT NULL,
    items_count INTEGER DEFAULT 0,
    country TEXT,
    profile_name TEXT,
    profile_url TEXT,
    found_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (job_id) REFERENCES parser_jobs(id) ON DELETE CASCADE
);

-- Parser Logs table
CREATE TABLE IF NOT EXISTS parser_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id TEXT NOT NULL,
    message TEXT NOT NULL,
    level TEXT DEFAULT 'info',
    created_at TEXT NOT NULL,
    FOREIGN KEY (job_id) REFERENCES parser_jobs(id) ON DELETE CASCADE
);

-- Parser Visited IDs (to avoid re-checking)
CREATE TABLE IF NOT EXISTS parser_visited (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id TEXT NOT NULL,
    steam_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE(job_id, steam_id),
    FOREIGN KEY (job_id) REFERENCES parser_jobs(id) ON DELETE CASCADE
);

-- Friend Requests table
CREATE TABLE IF NOT EXISTS friend_requests (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    account_login TEXT NOT NULL,
    target_steam_id TEXT NOT NULL,
    target_name TEXT,
    status TEXT DEFAULT 'sent',
    error TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
);

-- Spammer Logs table
CREATE TABLE IF NOT EXISTS spammer_logs (
    id TEXT PRIMARY KEY,
    account_login TEXT NOT NULL,
    friend_name TEXT,
    friend_steam_id TEXT NOT NULL,
    status TEXT DEFAULT 'sent',
    error TEXT,
    created_at TEXT NOT NULL
);

-- Settings table
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_accounts_owner ON accounts(owner_id);
CREATE INDEX IF NOT EXISTS idx_accounts_status ON accounts(status);
CREATE INDEX IF NOT EXISTS idx_messages_account ON messages(account_id);
CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);
CREATE INDEX IF NOT EXISTS idx_parser_results_job ON parser_results(job_id);
CREATE INDEX IF NOT EXISTS idx_parser_results_steam ON parser_results(steam_id);
CREATE INDEX IF NOT EXISTS idx_parser_logs_job ON parser_logs(job_id);
CREATE INDEX IF NOT EXISTS idx_parser_visited_job ON parser_visited(job_id);
CREATE INDEX IF NOT EXISTS idx_parser_visited_steam ON parser_visited(steam_id);

-- Insert default admin user
INSERT OR IGNORE INTO users (id, username, password_hash, role, created_at, updated_at)
VALUES ('admin', 'admin', 'admin123', 'admin', datetime('now'), datetime('now'));
