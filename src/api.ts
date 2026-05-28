// Steam API client
const API_BASE = '/api/steam';

export interface LoginResponse {
  success?: boolean;
  status?: string;
  steamId?: string;
  error?: string;
  message?: string;
}

export interface FriendData {
  steamId: string;
  name: string;
  avatar: string;
  personaState: number;
  gameId?: string;
  gameName?: string;
}

export interface MessageData {
  id: string;
  accountId: string;
  accountLogin: string;
  friendId: string;
  friendName: string;
  friendAvatar: string;
  text: string;
  timestamp: string;
  isOutgoing: boolean;
}

export const steamApi = {
  // Login to Steam
  async login(accountId: string, login: string, password: string, sharedSecret?: string, identitySecret?: string): Promise<LoginResponse> {
    try {
      const res = await fetch(`${API_BASE}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId, login, password, sharedSecret, identitySecret }),
      });
      return await res.json();
    } catch (err) {
      return { error: 'Сервер недоступен' };
    }
  },

  // Logout from Steam
  async logout(accountId: string): Promise<void> {
    try {
      await fetch(`${API_BASE}/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId }),
      });
    } catch {}
  },

  // Get account status
  async getStatus(accountId: string): Promise<any> {
    try {
      const res = await fetch(`${API_BASE}/status/${accountId}`);
      return await res.json();
    } catch {
      return { status: 'offline' };
    }
  },

  // Get all accounts status
  async getAllStatuses(): Promise<Record<string, any>> {
    try {
      const res = await fetch(`${API_BASE}/status-all`);
      return await res.json();
    } catch {
      return {};
    }
  },

  // Get friends list
  async getFriends(accountId: string): Promise<FriendData[]> {
    try {
      const res = await fetch(`${API_BASE}/friends/${accountId}`);
      const data = await res.json();
      return data.friends || [];
    } catch {
      return [];
    }
  },

  // Send message
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

  // Get new messages
  async getMessages(): Promise<MessageData[]> {
    try {
      const res = await fetch(`${API_BASE}/messages`);
      const data = await res.json();
      return data.messages || [];
    } catch {
      return [];
    }
  },

  // Generate Guard code
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

  // Open browser session for account
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

  // Navigate browser
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

  // Get browser screenshot
  async getBrowserScreenshot(accountId: string): Promise<string | null> {
    try {
      const res = await fetch(`${API_BASE}/browser/screenshot/${accountId}`);
      const data = await res.json();
      return data.screenshot || null;
    } catch {
      return null;
    }
  },

  // Close browser
  async closeBrowser(accountId: string): Promise<void> {
    try {
      await fetch(`${API_BASE}/browser/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId }),
      });
    } catch {}
  },

  // VPS info
  async getVpsInfo(): Promise<any> {
    try {
      const res = await fetch('/api/vps/info');
      return await res.json();
    } catch {
      return null;
    }
  },

  // VPS actions
  async vpsAction(action: string): Promise<any> {
    try {
      const res = await fetch('/api/vps/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      return await res.json();
    } catch {
      return { error: 'Network error' };
    }
  },

  // Domain management
  async getDomains(): Promise<any[]> {
    try {
      const res = await fetch('/api/domains');
      const data = await res.json();
      return data.domains || [];
    } catch {
      return [];
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
      const res = await fetch(`/api/domains/${domainId}`, {
        method: 'DELETE',
      });
      return await res.json();
    } catch {
      return { error: 'Network error' };
    }
  },

  async renewSsl(domainId: string): Promise<any> {
    try {
      const res = await fetch(`/api/domains/${domainId}/renew-ssl`, {
        method: 'POST',
      });
      return await res.json();
    } catch {
      return { error: 'Network error' };
    }
  },
};
