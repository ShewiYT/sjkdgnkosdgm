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
  async login(
    accountId: string,
    login: string,
    password: string,
    sharedSecret?: string,
    identitySecret?: string,
    proxyUrl?: string
  ): Promise<LoginResponse> {
    try {
      const body: Record<string, unknown> = { accountId, login, password, sharedSecret, identitySecret };
      if (proxyUrl) {
        body.proxyUrl = proxyUrl;
      }
      const res = await fetch(`${API_BASE}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      return await res.json();
    } catch {
      return { error: 'Сервер недоступен. Убедитесь что server.js запущен с steam-user.' };
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

  async getStatus(accountId: string): Promise<Record<string, unknown>> {
    try {
      const res = await fetch(`${API_BASE}/status/${accountId}`);
      return await res.json();
    } catch {
      return { status: 'offline' };
    }
  },

  async getAllStatuses(): Promise<Record<string, unknown>> {
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

  async getGuardCode(sharedSecret: string): Promise<Record<string, unknown> | null> {
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

  async addDomain(domain: string, target: 'panel' | 'api'): Promise<Record<string, unknown>> {
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

  async removeDomain(domainId: string): Promise<Record<string, unknown>> {
    try {
      const res = await fetch(`/api/domains/${domainId}`, { method: 'DELETE' });
      return await res.json();
    } catch {
      return { error: 'Network error' };
    }
  },

  async addFriend(accountId: string, targetSteamId: string): Promise<Record<string, unknown>> {
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

  async updateProfile(
    accountId: string,
    data: { name?: string; country?: string; bio?: string; avatarUrl?: string }
  ): Promise<Record<string, unknown>> {
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

  async spamFriends(accountId: string, message: string): Promise<Record<string, unknown>> {
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

  async getInventoryValue(steamId: string, game: 'cs2' | 'dota' | 'tf2' | 'rust' = 'cs2'): Promise<{
    totalValue: number;
    itemCount: number;
    pricedItems: number;
    unpricedItems: number;
    pricingComplete: boolean;
    items: { name: string; price: number | null }[];
    error?: string;
    source?: string;
  }> {
    try {
      // Try Loot.Farm evaluation first (cached prices)
      const res = await fetch(`/api/inventory/evaluate/${steamId}?game=${game}`);
      if (res.ok) {
        const data = await res.json();
        if (!data.error || data.totalValue > 0) {
          return {
            totalValue: data.totalValue || 0,
            itemCount: data.itemCount || 0,
            pricedItems: data.pricedItems || 0,
            unpricedItems: data.unpricedItems || 0,
            pricingComplete: true,
            items: data.items || [],
            error: data.error || undefined,
            source: data.source || 'Loot.Farm',
          };
        }
      }
      
      // Fallback to legacy inventory endpoint
      const fallback = await fetch(`/api/inventory/${steamId}`);
      if (!fallback.ok) {
        return { totalValue: 0, itemCount: 0, pricedItems: 0, unpricedItems: 0, pricingComplete: true, items: [], error: `HTTP ${fallback.status}` };
      }
      const data = await fallback.json();
      return {
        totalValue: data.totalValue || 0,
        itemCount: data.itemCount || 0,
        pricedItems: data.pricedItems || 0,
        unpricedItems: data.unpricedItems || 0,
        pricingComplete: data.pricingComplete ?? true,
        items: data.items || [],
        error: data.error || undefined,
        source: data.priceSource || 'csgotrader',
      };
    } catch {
      return { totalValue: 0, itemCount: 0, pricedItems: 0, unpricedItems: 0, pricingComplete: true, items: [], error: 'Сервер недоступен' };
    }
  },

  // Templates API - server-side storage
  async getTemplates(): Promise<string[]> {
    try {
      const res = await fetch('/api/chat-templates');
      const data = await res.json();
      return data.templates || [];
    } catch {
      return [];
    }
  },

  async saveTemplates(templates: string[]): Promise<boolean> {
    try {
      const res = await fetch('/api/chat-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templates }),
      });
      const data = await res.json();
      return data.success || false;
    } catch {
      return false;
    }
  },

  // Mark messages as read
  async markMessagesRead(accountId: string, friendId: string): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE}/messages/read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId, friendId }),
      });
      const data = await res.json();
      return data.success || false;
    } catch {
      return false;
    }
  },
};

export const parserApi = {
  async startParser(config: ParserConfig): Promise<Record<string, unknown>> {
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

  async stopParser(jobId: string): Promise<Record<string, unknown>> {
    try {
      const res = await fetch(`/api/parser/stop/${jobId}`, { method: 'POST' });
      return await res.json();
    } catch {
      return { success: false, error: 'Network error' };
    }
  },

  async pauseParser(jobId: string): Promise<Record<string, unknown>> {
    try {
      const res = await fetch(`/api/parser/pause/${jobId}`, { method: 'POST' });
      return await res.json();
    } catch {
      return { success: false, error: 'Network error' };
    }
  },

  async resumeParser(jobId: string): Promise<Record<string, unknown>> {
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

  async getParserResults(jobId: string): Promise<Record<string, unknown>> {
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

  async clearResults(jobId: string): Promise<Record<string, unknown>> {
    try {
      const res = await fetch(`/api/parser/clear/${jobId}`, { method: 'DELETE' });
      return await res.json();
    } catch {
      return { success: false };
    }
  },
};
