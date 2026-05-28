// Steam API client
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

  async openBrowser(accountId: string, url: string): Promise<any> {
    try {
      const res = await fetch(`${API_BASE}/browser/open`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId, url }),
      });
      return await res.json();
    } catch {
      return { error: 'Network error' };
    }
  },

  async navigateBrowser(accountId: string, url: string): Promise<any> {
    try {
      const res = await fetch(`${API_BASE}/browser/navigate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId, url }),
      });
      return await res.json();
    } catch {
      return { error: 'Network error' };
    }
  },

  async getBrowserScreenshot(accountId: string): Promise<string | null> {
    try {
      const res = await fetch(`${API_BASE}/browser/screenshot/${accountId}`);
      const data = await res.json();
      return data.screenshot || null;
    } catch {
      return null;
    }
  },

  async getBrowserPage(accountId: string): Promise<any> {
    try {
      const res = await fetch(`${API_BASE}/browser/page/${accountId}`);
      return await res.json();
    } catch {
      return { error: 'Network error' };
    }
  },

  async closeBrowser(accountId: string): Promise<void> {
    try {
      await fetch(`${API_BASE}/browser/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId }),
      });
    } catch { /* ignore */ }
  },

  async getVpsInfo(): Promise<any> {
    try {
      const res = await fetch('/api/vps/info');
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

  // Spam to users with no messages
  async spamNoMessages(accountId: string, message: string): Promise<any> {
    try {
      const res = await fetch(`${API_BASE}/spam-no-messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId, message }),
      });
      return await res.json();
    } catch {
      return { error: 'Network error' };
    }
  },

  // Translate text
  async translate(text: string, targetLang: string): Promise<string> {
    try {
      const res = await fetch(`/api/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, targetLang }),
      });
      const data = await res.json();
      return data.translatedText || text;
    } catch {
      return text;
    }
  },
};
