import Dexie, { type Table } from 'dexie';
import type { 
  SteamAccount, 
  Worker, 
  User, 
  ChatMessage, 
  TradeOffer, 
  ParserKey, 
  ParseJob,
  Friend
} from '../types';

// Database schema
export interface DbSteamAccount extends Omit<SteamAccount, 'status'> {
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface DbWorker extends Worker {
  createdAt: string;
  updatedAt: string;
}

export interface DbUser extends User {
  passwordHash?: string;
  updatedAt: string;
}

export interface DbChatMessage extends ChatMessage {
  createdAt: string;
  read: boolean;
}

export interface DbTradeOffer extends TradeOffer {
  createdAt: string;
  updatedAt: string;
}

export interface DbParserKey extends ParserKey {
  updatedAt: string;
}

export interface DbParseJob extends ParseJob {
  updatedAt: string;
}

export interface DbFriend extends Friend {
  createdAt: string;
  updatedAt: string;
}

export interface DbSetting {
  key: string;
  value: any;
  updatedAt: string;
}

export interface DbInventoryCache {
  steamId: string;
  value: number;
  updatedAt: string;
}

export interface DbSession {
  id: string;
  oderId: string;
  token: string;
  expiresAt: string;
  createdAt: string;
}

// Dexie Database Class
class SukaCombineDB extends Dexie {
  accounts!: Table<DbSteamAccount, string>;
  workers!: Table<DbWorker, string>;
  users!: Table<DbUser, string>;
  messages!: Table<DbChatMessage, string>;
  tradeOffers!: Table<DbTradeOffer, string>;
  parserKeys!: Table<DbParserKey, string>;
  parseJobs!: Table<DbParseJob, string>;
  friends!: Table<DbFriend, string>;
  settings!: Table<DbSetting, string>;
  inventoryCache!: Table<DbInventoryCache, string>;
  sessions!: Table<DbSession, string>;

  constructor() {
    super('SukaCombineDB');
    
    this.version(1).stores({
      accounts: 'id, login, ownerId, status, createdAt, updatedAt',
      workers: 'id, username, createdAt, updatedAt',
      users: 'id, username, role, createdAt, updatedAt',
      messages: 'id, accountId, friendId, timestamp, createdAt, [accountId+friendId]',
      tradeOffers: 'id, accountId, status, timestamp, createdAt',
      parserKeys: 'id, key, isActive, createdAt',
      parseJobs: 'id, status, createdAt',
      friends: 'id, accountId, steamId, createdAt, [accountId+steamId]',
      settings: 'key, updatedAt',
      inventoryCache: 'steamId, updatedAt',
      sessions: 'id, oderId, expiresAt',
    });
  }
}

export const db = new SukaCombineDB();

// Database operations
export const dbOperations = {
  // ============= ACCOUNTS =============
  async getAllAccounts(): Promise<DbSteamAccount[]> {
    return await db.accounts.toArray();
  },

  async getAccountsByOwner(ownerId: string): Promise<DbSteamAccount[]> {
    return await db.accounts.where('ownerId').equals(ownerId).toArray();
  },

  async getAccountById(id: string): Promise<DbSteamAccount | undefined> {
    return await db.accounts.get(id);
  },

  async addAccount(account: DbSteamAccount): Promise<string> {
    const now = new Date().toISOString();
    return await db.accounts.add({
      ...account,
      createdAt: now,
      updatedAt: now,
    });
  },

  async addAccounts(accounts: DbSteamAccount[]): Promise<void> {
    const now = new Date().toISOString();
    await db.accounts.bulkAdd(
      accounts.map(acc => ({
        ...acc,
        createdAt: now,
        updatedAt: now,
      }))
    );
  },

  async updateAccount(id: string, data: Partial<DbSteamAccount>): Promise<void> {
    await db.accounts.update(id, {
      ...data,
      updatedAt: new Date().toISOString(),
    });
  },

  async deleteAccount(id: string): Promise<void> {
    await db.accounts.delete(id);
  },

  async deleteAccountsByOwner(ownerId: string): Promise<void> {
    await db.accounts.where('ownerId').equals(ownerId).delete();
  },

  async clearAllAccounts(): Promise<void> {
    await db.accounts.clear();
  },

  // ============= WORKERS =============
  async getAllWorkers(): Promise<DbWorker[]> {
    return await db.workers.toArray();
  },

  async getWorkerById(id: string): Promise<DbWorker | undefined> {
    return await db.workers.get(id);
  },

  async getWorkerByUsername(username: string): Promise<DbWorker | undefined> {
    return await db.workers.where('username').equals(username).first();
  },

  async addWorker(worker: DbWorker): Promise<string> {
    const now = new Date().toISOString();
    return await db.workers.add({
      ...worker,
      createdAt: now,
      updatedAt: now,
    });
  },

  async updateWorker(id: string, data: Partial<DbWorker>): Promise<void> {
    await db.workers.update(id, {
      ...data,
      updatedAt: new Date().toISOString(),
    });
  },

  async deleteWorker(id: string): Promise<void> {
    await db.workers.delete(id);
  },

  // ============= USERS =============
  async getAllUsers(): Promise<DbUser[]> {
    return await db.users.toArray();
  },

  async getUserById(id: string): Promise<DbUser | undefined> {
    return await db.users.get(id);
  },

  async getUserByUsername(username: string): Promise<DbUser | undefined> {
    return await db.users.where('username').equals(username).first();
  },

  async addUser(user: DbUser): Promise<string> {
    const now = new Date().toISOString();
    return await db.users.add({
      ...user,
      updatedAt: now,
    });
  },

  async updateUser(id: string, data: Partial<DbUser>): Promise<void> {
    await db.users.update(id, {
      ...data,
      updatedAt: new Date().toISOString(),
    });
  },

  // ============= MESSAGES =============
  async getAllMessages(): Promise<DbChatMessage[]> {
    return await db.messages.orderBy('timestamp').toArray();
  },

  async getMessagesByAccount(accountId: string): Promise<DbChatMessage[]> {
    return await db.messages.where('accountId').equals(accountId).toArray();
  },

  async getMessagesByConversation(accountId: string, friendId: string): Promise<DbChatMessage[]> {
    return await db.messages
      .where('[accountId+friendId]')
      .equals([accountId, friendId])
      .toArray();
  },

  async getRecentMessages(limit: number = 500): Promise<DbChatMessage[]> {
    return await db.messages.orderBy('timestamp').reverse().limit(limit).toArray();
  },

  async addMessage(message: DbChatMessage): Promise<string> {
    return await db.messages.add({
      ...message,
      createdAt: new Date().toISOString(),
      read: false,
    });
  },

  async addMessages(messages: DbChatMessage[]): Promise<void> {
    const now = new Date().toISOString();
    await db.messages.bulkAdd(
      messages.map(msg => ({
        ...msg,
        createdAt: now,
        read: false,
      }))
    );
  },

  async markMessageAsRead(id: string): Promise<void> {
    await db.messages.update(id, { read: true });
  },

  async deleteMessagesByAccount(accountId: string): Promise<void> {
    await db.messages.where('accountId').equals(accountId).delete();
  },

  async clearOldMessages(keepCount: number = 500): Promise<void> {
    const count = await db.messages.count();
    if (count > keepCount) {
      const toDelete = await db.messages
        .orderBy('timestamp')
        .limit(count - keepCount)
        .primaryKeys();
      await db.messages.bulkDelete(toDelete);
    }
  },

  // ============= TRADE OFFERS =============
  async getAllTradeOffers(): Promise<DbTradeOffer[]> {
    return await db.tradeOffers.toArray();
  },

  async getTradeOffersByAccount(accountId: string): Promise<DbTradeOffer[]> {
    return await db.tradeOffers.where('accountId').equals(accountId).toArray();
  },

  async addTradeOffer(offer: DbTradeOffer): Promise<string> {
    const now = new Date().toISOString();
    return await db.tradeOffers.add({
      ...offer,
      createdAt: now,
      updatedAt: now,
    });
  },

  async updateTradeOffer(id: string, data: Partial<DbTradeOffer>): Promise<void> {
    await db.tradeOffers.update(id, {
      ...data,
      updatedAt: new Date().toISOString(),
    });
  },

  // ============= PARSER KEYS =============
  async getAllParserKeys(): Promise<DbParserKey[]> {
    return await db.parserKeys.toArray();
  },

  async getActiveParserKeys(): Promise<DbParserKey[]> {
    return await db.parserKeys.where('isActive').equals(1).toArray();
  },

  async getParserKeyByKey(key: string): Promise<DbParserKey | undefined> {
    return await db.parserKeys.where('key').equals(key).first();
  },

  async addParserKey(parserKey: DbParserKey): Promise<string> {
    const now = new Date().toISOString();
    return await db.parserKeys.add({
      ...parserKey,
      updatedAt: now,
    });
  },

  async updateParserKey(id: string, data: Partial<DbParserKey>): Promise<void> {
    await db.parserKeys.update(id, {
      ...data,
      updatedAt: new Date().toISOString(),
    });
  },

  async revokeParserKey(id: string): Promise<void> {
    await db.parserKeys.update(id, {
      isActive: false,
      updatedAt: new Date().toISOString(),
    });
  },

  // ============= PARSE JOBS =============
  async getAllParseJobs(): Promise<DbParseJob[]> {
    return await db.parseJobs.toArray();
  },

  async getParseJobById(id: string): Promise<DbParseJob | undefined> {
    return await db.parseJobs.get(id);
  },

  async addParseJob(job: DbParseJob): Promise<string> {
    const now = new Date().toISOString();
    return await db.parseJobs.add({
      ...job,
      updatedAt: now,
    });
  },

  async updateParseJob(id: string, data: Partial<DbParseJob>): Promise<void> {
    await db.parseJobs.update(id, {
      ...data,
      updatedAt: new Date().toISOString(),
    });
  },

  // ============= FRIENDS =============
  async getFriendsByAccount(accountId: string): Promise<DbFriend[]> {
    return await db.friends.where('accountId').equals(accountId).toArray();
  },

  async addFriend(friend: DbFriend): Promise<string> {
    const now = new Date().toISOString();
    return await db.friends.add({
      ...friend,
      createdAt: now,
      updatedAt: now,
    });
  },

  async updateFriend(id: string, data: Partial<DbFriend>): Promise<void> {
    await db.friends.update(id, {
      ...data,
      updatedAt: new Date().toISOString(),
    });
  },

  // ============= SETTINGS =============
  async getSetting(key: string): Promise<any> {
    const setting = await db.settings.get(key);
    return setting?.value;
  },

  async setSetting(key: string, value: any): Promise<void> {
    await db.settings.put({
      key,
      value,
      updatedAt: new Date().toISOString(),
    });
  },

  async getAllSettings(): Promise<Record<string, any>> {
    const settings = await db.settings.toArray();
    return settings.reduce((acc, s) => ({ ...acc, [s.key]: s.value }), {});
  },

  // ============= INVENTORY CACHE =============
  async getInventoryValue(steamId: string): Promise<number | undefined> {
    const cached = await db.inventoryCache.get(steamId);
    if (!cached) return undefined;
    
    // Check if cache is older than 1 hour
    const cacheAge = Date.now() - new Date(cached.updatedAt).getTime();
    if (cacheAge > 60 * 60 * 1000) {
      return undefined; // Cache expired
    }
    
    return cached.value;
  },

  async setInventoryValue(steamId: string, value: number): Promise<void> {
    await db.inventoryCache.put({
      steamId,
      value,
      updatedAt: new Date().toISOString(),
    });
  },

  async getAllInventoryCache(): Promise<Record<string, number>> {
    const cache = await db.inventoryCache.toArray();
    return cache.reduce((acc, c) => ({ ...acc, [c.steamId]: c.value }), {});
  },

  // ============= SESSIONS =============
  async createSession(userId: string): Promise<string> {
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days
    
    await db.sessions.add({
      id: token,
      oderId: userId,
      token,
      expiresAt,
      createdAt: new Date().toISOString(),
    });
    
    return token;
  },

  async validateSession(token: string): Promise<string | null> {
    const session = await db.sessions.get(token);
    if (!session) return null;
    
    if (new Date(session.expiresAt) < new Date()) {
      await db.sessions.delete(token);
      return null;
    }
    
    return session.oderId;
  },

  async deleteSession(token: string): Promise<void> {
    await db.sessions.delete(token);
  },

  // ============= EXPORT / IMPORT =============
  async exportAllData(): Promise<object> {
    return {
      accounts: await db.accounts.toArray(),
      workers: await db.workers.toArray(),
      users: await db.users.toArray(),
      messages: await db.messages.toArray(),
      tradeOffers: await db.tradeOffers.toArray(),
      parserKeys: await db.parserKeys.toArray(),
      parseJobs: await db.parseJobs.toArray(),
      friends: await db.friends.toArray(),
      settings: await db.settings.toArray(),
      inventoryCache: await db.inventoryCache.toArray(),
      exportedAt: new Date().toISOString(),
      version: 1,
    };
  },

  async importAllData(data: any): Promise<void> {
    await db.transaction('rw', 
      [db.accounts, db.workers, db.users, db.messages, db.tradeOffers, 
       db.parserKeys, db.parseJobs, db.friends, db.settings, db.inventoryCache],
      async () => {
        // Clear existing data
        await db.accounts.clear();
        await db.workers.clear();
        await db.users.clear();
        await db.messages.clear();
        await db.tradeOffers.clear();
        await db.parserKeys.clear();
        await db.parseJobs.clear();
        await db.friends.clear();
        await db.settings.clear();
        await db.inventoryCache.clear();

        // Import new data
        if (data.accounts?.length) await db.accounts.bulkAdd(data.accounts);
        if (data.workers?.length) await db.workers.bulkAdd(data.workers);
        if (data.users?.length) await db.users.bulkAdd(data.users);
        if (data.messages?.length) await db.messages.bulkAdd(data.messages);
        if (data.tradeOffers?.length) await db.tradeOffers.bulkAdd(data.tradeOffers);
        if (data.parserKeys?.length) await db.parserKeys.bulkAdd(data.parserKeys);
        if (data.parseJobs?.length) await db.parseJobs.bulkAdd(data.parseJobs);
        if (data.friends?.length) await db.friends.bulkAdd(data.friends);
        if (data.settings?.length) await db.settings.bulkAdd(data.settings);
        if (data.inventoryCache?.length) await db.inventoryCache.bulkAdd(data.inventoryCache);
      }
    );
  },

  async clearAllData(): Promise<void> {
    await db.transaction('rw', 
      [db.accounts, db.workers, db.messages, db.tradeOffers, 
       db.parserKeys, db.parseJobs, db.friends, db.settings, db.inventoryCache],
      async () => {
        await db.accounts.clear();
        await db.workers.clear();
        await db.messages.clear();
        await db.tradeOffers.clear();
        await db.parserKeys.clear();
        await db.parseJobs.clear();
        await db.friends.clear();
        await db.settings.clear();
        await db.inventoryCache.clear();
      }
    );
  },

  // ============= DATABASE INFO =============
  async getDatabaseStats(): Promise<object> {
    return {
      accounts: await db.accounts.count(),
      workers: await db.workers.count(),
      users: await db.users.count(),
      messages: await db.messages.count(),
      tradeOffers: await db.tradeOffers.count(),
      parserKeys: await db.parserKeys.count(),
      parseJobs: await db.parseJobs.count(),
      friends: await db.friends.count(),
    };
  },
};

export default db;
