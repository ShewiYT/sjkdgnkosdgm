const API_BASE = '/api/steam';

export interface LoginResponse {
  success?: boolean;
  status?: string;
  steamId?: string;
  error?: string;
  message?: string;
  level?: number;
  balance?: number;
  inventoryValue?: number;
  friendsCount?: number;
  avatarUrl?: string;
  displayName?: string;
  tradeBan?: boolean;
  vacBan?: boolean;
  limited?: boolean;
}

export interface FriendData {
  steamId: string;
  name: string;
  avatar: string;
  avatarUrl?: string;
  personaState: number;
  gameId?: string;
  gameName?: string;
  inventoryValue?: number;
  hasMessages?: boolean;
}

export interface MessageData {
  id: string;
  accountId: string;
  accountLogin: string;
  friendId: string;
  friendName: string;
  friendAvatar: string;
  friendAvatarUrl?: string;
  text: string;
  timestamp: string;
  isOutgoing: boolean;
}

export const steamApi = {
  async login(accountId: string, login: string, password: string, sharedSecret?: string, identitySecret?: string): Promise<LoginResponse> {
    try {
      const res = await fetch(`${API_BASE}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId, login, password, sharedSecret, identitySecret }),
      });
      return await res.json();
    } catch {
      return { error: 'Сервер недоступен' };
    }
  },

  async logout(accountId: string): Promise<void> {
    try {
      await fetch(`${API_BASE}/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId }),
      });
    } catch { /* ignore */ }
  },

  async getStatus(accountId: string): Promise<any> {
    try {
      const res = await fetch(`${API_BASE}/status/${accountId}`);
      return await res.json();
    } catch {
      return { status: 'offline' };
    }
  },

  async getAllStatuses(): Promise<Record<string, any>> {
    try {
      const res = await fetch(`${API_BASE}/status-all`);
      return await res.json();
    } catch {
      return {};
    }
  },

  async getFriends(accountId: string): Promise<FriendData[]> {
    try {
      const res = await fetch(`${API_BASE}/friends/${accountId}`);
      const data = await res.json();
      return data.friends || [];
    } catch {
      return [];
    }
  },

  async sendMessage(accountId: string, friendSteamId: string, message: string): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId, friendSteamId, message }),
      });
      const data = await res.json();
      return data.success;
    } catch {
      return false;
    }
  },

  async getMessages(): Promise<MessageData[]> {
    try {
      const res = await fetch(`${API_BASE}/messages`);
      const data = await res.json();
      return data.messages || [];
    } catch {
      return [];
    }
  },

  async getGuardCode(sharedSecret: string): Promise<any> {
    try {
      const res = await fetch(`${API_BASE}/guard-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sharedSecret }),
      });
      return await res.json();
    } catch {
      return null;
    }
  },

  async addDomain(domain: string, target: 'panel' | 'api'): Promise<any> {
    try {
      const res = await fetch('/api/domains', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain, target }),
      });
      return await res.json();
    } catch {
      return { error: 'Network error' };
    }
  },

  async removeDomain(domainId: string): Promise<any> {
    try {
      const res = await fetch(`/api/domains/${domainId}`, { method: 'DELETE' });
      return await res.json();
    } catch {
      return { error: 'Network error' };
    }
  },

  // Chain parser API
  async startChainParse(params: {
    seedIds: string[];
    apiKey: string;
    minValue: number;
    maxValue: number;
    maxDepth: number;
    targetCount: number;
    appId: number;
  }): Promise<any> {
    try {
      const res = await fetch('/api/parser/chain/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      return await res.json();
    } catch {
      return { error: 'Network error' };
    }
  },

  async getChainParseStatus(jobId: string): Promise<any> {
    try {
      const res = await fetch(`/api/parser/chain/status/${jobId}`);
      return await res.json();
    } catch {
      return { error: 'Network error' };
    }
  },

  async cancelChainParse(jobId: string): Promise<any> {
    try {
      const res = await fetch(`/api/parser/chain/cancel/${jobId}`, { method: 'POST' });
      return await res.json();
    } catch {
      return { error: 'Network error' };
    }
  },
};
