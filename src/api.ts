import type { ParserConfig, ParserJob } from './types';

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

  async addFriend(accountId: string, targetSteamId: string): Promise<any> {
    try {
      const res = await fetch(`${API_BASE}/add-friend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId, targetSteamId }),
      });
      return await res.json();
    } catch {
      return { success: false, error: 'Network error' };
    }
  },

  async getFriendsOfFriend(accountId: string, friendSteamId: string): Promise<FriendData[]> {
    try {
      const res = await fetch(`${API_BASE}/friends-of-friend/${accountId}/${friendSteamId}`);
      const data = await res.json();
      return data.friends || [];
    } catch {
      return [];
    }
  },

  async updateProfile(accountId: string, data: { name?: string; country?: string; bio?: string; avatarUrl?: string }): Promise<any> {
    try {
      const res = await fetch(`${API_BASE}/update-profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId, ...data }),
      });
      return await res.json();
    } catch {
      return { success: false, error: 'Network error' };
    }
  },

  async spamFriends(accountId: string, message: string): Promise<any> {
    try {
      const res = await fetch(`${API_BASE}/spam-friends`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId, message }),
      });
      return await res.json();
    } catch {
      return { success: false, sent: 0, errors: 0, logs: [] };
    }
  },
};

export const parserApi = {
  async startParser(config: ParserConfig): Promise<any> {
    try {
      const res = await fetch('/api/parser/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      return await res.json();
    } catch {
      return { success: false, error: 'Network error' };
    }
  },

  async stopParser(jobId: string): Promise<any> {
    try {
      const res = await fetch(`/api/parser/stop/${jobId}`, { method: 'POST' });
      return await res.json();
    } catch {
      return { success: false, error: 'Network error' };
    }
  },

  async pauseParser(jobId: string): Promise<any> {
    try {
      const res = await fetch(`/api/parser/pause/${jobId}`, { method: 'POST' });
      return await res.json();
    } catch {
      return { success: false, error: 'Network error' };
    }
  },

  async resumeParser(jobId: string): Promise<any> {
    try {
      const res = await fetch(`/api/parser/resume/${jobId}`, { method: 'POST' });
      return await res.json();
    } catch {
      return { success: false, error: 'Network error' };
    }
  },

  async getParserStatus(jobId: string): Promise<ParserJob | null> {
    try {
      const res = await fetch(`/api/parser/status/${jobId}`);
      const data = await res.json();
      return data.job || null;
    } catch {
      return null;
    }
  },

  async getActiveJobs(): Promise<ParserJob[]> {
    try {
      const res = await fetch('/api/parser/jobs');
      const data = await res.json();
      return data.jobs || [];
    } catch {
      return [];
    }
  },

  async getParserResults(jobId: string): Promise<any> {
    try {
      const res = await fetch(`/api/parser/results/${jobId}`);
      return await res.json();
    } catch {
      return { results: [], total: 0 };
    }
  },

  async exportResults(jobId: string, format: 'txt' | 'json' | 'csv'): Promise<Blob | null> {
    try {
      const res = await fetch(`/api/parser/export/${jobId}?format=${format}`);
      return await res.blob();
    } catch {
      return null;
    }
  },

  async clearResults(jobId: string): Promise<any> {
    try {
      const res = await fetch(`/api/parser/clear/${jobId}`, { method: 'DELETE' });
      return await res.json();
    } catch {
      return { success: false };
    }
  },
};
