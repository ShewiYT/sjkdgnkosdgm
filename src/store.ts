import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { steamApi } from './api';
import { sendNotification, NotificationTemplates, DiscordTemplates } from './notifications';
import type {
  SteamAccount, ChatMessage, TradeOffer, Worker, MaFile, User,
  DomainConfig, NotificationSettings, FriendRequestLog, SpammerLog,
} from './types';

interface AppStore {
  currentUser: User | null;
  users: User[];
  workers: Worker[];
  serverConnected: boolean;
  steamAvailable: boolean;
  checkServerConnection: () => Promise<void>;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  addWorker: (data: { username: string; password: string; assignedAccounts: string[] }) => void;
  updateWorker: (id: string, data: Partial<Worker>) => void;
  removeWorker: (id: string) => void;
  loadWorkers: () => void;
  accounts: SteamAccount[];
  addAccount: (login: string, password: string, maFile?: MaFile) => void;
  addAccounts: (accountsData: { login: string; password: string; maFile?: MaFile }[]) => { added: number; skipped: number };
  removeAccount: (id: string) => void;
  updateAccount: (id: string, data: Partial<SteamAccount>) => void;
  clearAccounts: () => void;
  getVisibleAccounts: () => SteamAccount[];
  connectAccount: (id: string) => Promise<void>;
  disconnectAccount: (id: string) => Promise<void>;
  connectAll: () => Promise<void>;
  disconnectAll: () => Promise<void>;
  refreshStatuses: () => Promise<void>;
  loadAccountsFromServer: () => Promise<void>;
  saveAccountsToServer: () => Promise<void>;
  messages: ChatMessage[];
  addMessage: (message: ChatMessage) => void;
  fetchNewMessages: () => Promise<void>;
  sendMessage: (accountId: string, friendSteamId: string, friendName: string, text: string) => Promise<boolean>;
  tradeOffers: TradeOffer[];
  domains: DomainConfig[];
  addDomain: (domain: string, target: 'panel' | 'api') => void;
  removeDomain: (id: string) => void;
  updateDomain: (id: string, data: Partial<DomainConfig>) => void;
  notificationSettings: NotificationSettings;
  updateNotificationSettings: (settings: Partial<NotificationSettings>) => void;
  notify: (tgMsg: string, discordMsg: string) => Promise<void>;
  steamIdsToAdd: string;
  setSteamIdsToAdd: (ids: string) => void;
  friendNetworkSteamIds: string;
  setFriendNetworkSteamIds: (ids: string) => void;
  friendRequestLogs: FriendRequestLog[];
  friendRequestRunning: boolean;
  startFriendRequests: (steamIds: string[], requestsPerAccount: number, delaySeconds: number) => Promise<void>;
  stopFriendRequests: () => void;
  addFriendRequestLog: (log: FriendRequestLog) => void;
  friendCrawlerRunning: boolean;
  friendCrawlerLogs: FriendRequestLog[];
  startFriendNetworkCrawler: (targetSteamIds: string[], maxDepth: number) => Promise<void>;
  stopFriendNetworkCrawler: () => void;
  spammerRunning: boolean;
  spammerMessage: string;
  spammerDelay: number;
  spammerLogs: SpammerLog[];
  setSpammerMessage: (msg: string) => void;
  setSpammerDelay: (delay: number) => void;
  startSpammer: () => Promise<void>;
  stopSpammer: () => void;
  steamMarketApiKey: string;
  setSteamMarketApiKey: (key: string) => void;
  fetchInventoryValues: () => Promise<void>;
  proxyUrl: string;
  setProxyUrl: (url: string) => void;
}

const generateId = () => Math.random().toString(36).substring(2, 15);
const avatarEmojis = ['🎮', '👾', '🕹️', '🎯', '🔫', '⚔️', '🛡️', '💀', '🤖', '👽', '🐉', '🦊', '🐺', '🦅', '🦈'];
const servers = ['EU-1', 'EU-2', 'EU-3', 'RU-1', 'RU-2', 'US-1', 'US-2'];

const DEFAULT_ADMIN: User = {
  id: 'admin',
  username: 'admin',
  role: 'admin',
  assignedAccounts: [],
  createdAt: new Date().toISOString(),
};
const DEFAULT_ADMIN_PASSWORD = 'admin123';

const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  telegramBotToken: '',
  telegramAdminId: '',
  discordWebhookUrl: '',
  enableTelegram: false,
  enableDiscord: false,
  notifyAccountsLoaded: true,
  notifyNewMessage: true,
  notifyFriendsStart: true,
  notifyFriendsEnd: true,
  notifyErrors: true,
  notifyLogin: true,
};

let _spammerAbort = false;
let _friendRequestAbort = false;
let _friendCrawlerAbort = false;

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      currentUser: null,
      users: [DEFAULT_ADMIN],
      workers: [],
      accounts: [],
      messages: [],
      tradeOffers: [],
      domains: [],
      notificationSettings: DEFAULT_NOTIFICATION_SETTINGS,
      steamIdsToAdd: '',
      friendNetworkSteamIds: '',
      friendRequestLogs: [],
      friendRequestRunning: false,
      friendCrawlerRunning: false,
      friendCrawlerLogs: [],
      spammerRunning: false,
      spammerMessage: '',
      spammerDelay: 3,
      spammerLogs: [],
      steamMarketApiKey: '',
      proxyUrl: '',
      serverConnected: false,
      steamAvailable: false,

      checkServerConnection: async () => {
        try {
          const res = await fetch('/api/health', { signal: AbortSignal.timeout(3000) });
          if (res.ok) {
            const data = await res.json();
            set({ serverConnected: true, steamAvailable: !!data.steamAvailable });
          } else {
            set({ serverConnected: false, steamAvailable: false });
          }
        } catch {
          set({ serverConnected: false, steamAvailable: false });
        }
      },

      login: async (username, password) => {
        try {
          const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
          });
          const data = await res.json();
          if (data.success && data.user) {
            set({ currentUser: data.user as User });
            await get().loadAccountsFromServer();
            get().loadWorkers();
            get().checkServerConnection();
            return true;
          }
        } catch {
          if (username === 'admin' && password === DEFAULT_ADMIN_PASSWORD) {
            set({ currentUser: DEFAULT_ADMIN });
            await get().loadAccountsFromServer();
            get().checkServerConnection();
            return true;
          }
          const worker = get().workers.find(w => w.username === username && w.password === password);
          if (worker) {
            set({
              currentUser: {
                id: worker.id,
                username: worker.username,
                role: 'worker',
                assignedAccounts: worker.assignedAccounts,
                createdAt: worker.lastActive,
              } as User,
            });
            await get().loadAccountsFromServer();
            return true;
          }
        }
        return false;
      },

      logout: () => set({ currentUser: null }),

      loadAccountsFromServer: async () => {
        try {
          const res = await fetch('/api/accounts');
          const data = await res.json();
          if (data.accounts && Array.isArray(data.accounts)) {
            const accountsWithCorrectStatus = data.accounts.map((acc: SteamAccount) => ({
              ...acc,
              status: 'offline' as const,
              errorMessage: undefined,
            }));
            set({ accounts: accountsWithCorrectStatus });
          }
        } catch { /* Use local storage as fallback */ }
      },

      saveAccountsToServer: async () => {
        try {
          await fetch('/api/accounts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ accounts: get().accounts }),
          });
        } catch { /* Ignore */ }
      },

      addWorker: (data) => {
        fetch('/api/workers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        })
          .then(res => res.json())
          .then(result => {
            if (result.success && result.worker) {
              set(state => ({ workers: [...state.workers, result.worker] }));
            }
          })
          .catch(() => {
            const newWorker: Worker = {
              id: generateId(),
              username: data.username,
              password: data.password,
              assignedAccounts: data.assignedAccounts,
              permissions: { chat: true, browser: false, offersSend: false, offersSendAll: false, offersConfirm: false, guard: false },
              lastActive: new Date().toISOString(),
              actionsLog: [],
            };
            set(state => ({ workers: [...state.workers, newWorker] }));
          });
      },

      updateWorker: (id, data) => {
        set(state => ({ workers: state.workers.map(w => (w.id === id ? { ...w, ...data } : w)) }));
        fetch(`/api/workers/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).catch(() => {});
      },

      removeWorker: (id) => {
        set(state => ({ workers: state.workers.filter(w => w.id !== id) }));
        fetch(`/api/workers/${id}`, { method: 'DELETE' }).catch(() => {});
      },

      loadWorkers: () => {
        fetch('/api/workers').then(res => res.json()).then(data => {
          if (data.workers) set({ workers: data.workers });
        }).catch(() => {});
      },

      addAccount: (login, password, maFile) => {
        const currentUser = get().currentUser;
        const existingLogins = new Set(get().accounts.map(a => a.login.toLowerCase()));
        if (existingLogins.has(login.toLowerCase())) return;
        const newAccount: SteamAccount = {
          id: generateId(), login, password, maFile,
          avatar: avatarEmojis[Math.floor(Math.random() * avatarEmojis.length)],
          displayName: login, level: 0, status: 'offline', balance: 0,
          guardEnabled: !!maFile, server: servers[Math.floor(Math.random() * servers.length)],
          tradeBan: false, vacBan: false, limited: false, friendsCount: 0, inventoryValue: 0,
          ownerId: currentUser?.id,
        };
        set(state => ({ accounts: [...state.accounts, newAccount] }));
        get().saveAccountsToServer();
      },

      addAccounts: (accountsData) => {
        const currentUser = get().currentUser;
        const existingLogins = new Set(get().accounts.map(a => a.login.toLowerCase()));
        const newAccounts: SteamAccount[] = [];
        let skippedCount = 0;
        for (const { login, password, maFile } of accountsData) {
          if (existingLogins.has(login.toLowerCase())) { skippedCount++; continue; }
          existingLogins.add(login.toLowerCase());
          newAccounts.push({
            id: generateId(), login, password, maFile,
            avatar: avatarEmojis[Math.floor(Math.random() * avatarEmojis.length)],
            displayName: login, level: 0, status: 'offline' as const, balance: 0,
            guardEnabled: !!maFile, server: servers[Math.floor(Math.random() * servers.length)],
            tradeBan: false, vacBan: false, limited: false, friendsCount: 0, inventoryValue: 0,
            ownerId: currentUser?.id,
          });
        }
        if (newAccounts.length > 0) {
          set(state => ({ accounts: [...state.accounts, ...newAccounts] }));
          get().saveAccountsToServer();
          const ns = get().notificationSettings;
          if (ns.notifyAccountsLoaded) {
            get().notify(NotificationTemplates.accountsLoaded(newAccounts.length), DiscordTemplates.accountsLoaded(newAccounts.length));
          }
        }
        return { added: newAccounts.length, skipped: skippedCount };
      },

      removeAccount: (id) => {
        const acc = get().accounts.find(a => a.id === id);
        if (acc && acc.status !== 'offline') steamApi.logout(id);
        set(state => ({ accounts: state.accounts.filter(a => a.id !== id) }));
        get().saveAccountsToServer();
      },

      updateAccount: (id, data) => {
        set(state => ({ accounts: state.accounts.map(a => (a.id === id ? { ...a, ...data } : a)) }));
        get().saveAccountsToServer();
      },

      clearAccounts: () => {
        const visibleAccounts = get().getVisibleAccounts();
        visibleAccounts.forEach(acc => { if (acc.status !== 'offline') steamApi.logout(acc.id); });
        const visibleIds = new Set(visibleAccounts.map(a => a.id));
        set(state => ({ accounts: state.accounts.filter(a => !visibleIds.has(a.id)), messages: [] }));
        get().saveAccountsToServer();
      },

      getVisibleAccounts: () => {
        const { currentUser, accounts, workers } = get();
        if (!currentUser) return [];
        if (currentUser.role === 'admin') return accounts;
        const worker = workers.find(w => w.id === currentUser.id);
        if (!worker) return [];
        return accounts.filter(a => worker.assignedAccounts.includes(a.id));
      },

      connectAccount: async (id) => {
        const acc = get().accounts.find(a => a.id === id);
        if (!acc) return;
        await get().checkServerConnection();
        const serverAvailable = get().serverConnected;
        const steamReady = get().steamAvailable;
        set(state => ({ accounts: state.accounts.map(a => a.id === id ? { ...a, status: 'connecting' as const, errorMessage: undefined } : a) }));
        if (!serverAvailable) {
          set(state => ({ accounts: state.accounts.map(a => a.id === id ? { ...a, status: 'error' as const, errorMessage: '❌ Сервер недоступен. Запустите: node server.js' } : a) }));
          return;
        }
        if (!steamReady) {
          set(state => ({ accounts: state.accounts.map(a => a.id === id ? { ...a, status: 'error' as const, errorMessage: '❌ steam-user не установлен на сервере!' } : a) }));
          return;
        }

        const handleLoginSuccess = (result: Record<string, unknown>, usedProxy: boolean) => {
          set(state => ({
            accounts: state.accounts.map(a => a.id === id ? {
              ...a, status: 'online' as const,
              steamId: (result.steamId as string) || a.steamId,
              level: (result.level as number) ?? a.level,
              balance: (result.balance as number) ?? a.balance,
              inventoryValue: (result.inventoryValue as number) ?? a.inventoryValue,
              friendsCount: (result.friendsCount as number) ?? a.friendsCount,
              avatarUrl: (result.avatarUrl as string) || a.avatarUrl,
              displayName: (result.displayName as string) || a.displayName,
              tradeBan: (result.tradeBan as boolean) ?? a.tradeBan,
              vacBan: (result.vacBan as boolean) ?? a.vacBan,
              limited: (result.limited as boolean) ?? a.limited,
              errorMessage: undefined,
            } : a),
          }));
          const ns = get().notificationSettings;
          if (ns.notifyLogin) {
            const suffix = usedProxy ? ' (через прокси)' : '';
            get().notify(
              NotificationTemplates.accountLogin(acc.login + suffix, 'online'),
              DiscordTemplates.accountLogin(acc.login + suffix, 'online')
            );
          }
        };

        try {
          // 1) First attempt — without proxy (VDS IP)
          const result = await steamApi.login(id, acc.login, acc.password, acc.maFile?.shared_secret, acc.maFile?.identity_secret);

          if (result.success || result.status === 'online') {
            handleLoginSuccess(result as Record<string, unknown>, false);
            return;
          }

          const errMsg = (result.error || result.message || '') as string;
          const isRateLimit = errMsg.toLowerCase().includes('ratelimit') || errMsg.includes('RateLimitExceeded');

          // 2) If RateLimitExceeded and proxy is set — retry with proxy
          const proxy = get().proxyUrl.trim();
          if (isRateLimit && proxy) {
            console.log(`[Connect] RateLimit for ${acc.login}, retrying with proxy...`);
            set(state => ({ accounts: state.accounts.map(a => a.id === id ? { ...a, errorMessage: '⏳ RateLimit — повтор через прокси...' } : a) }));

            // Small delay before retry
            await new Promise(r => setTimeout(r, 3000));

            const proxyResult = await steamApi.login(id, acc.login, acc.password, acc.maFile?.shared_secret, acc.maFile?.identity_secret, proxy);

            if (proxyResult.success || proxyResult.status === 'online') {
              handleLoginSuccess(proxyResult as Record<string, unknown>, true);
              return;
            }

            // Proxy attempt also failed
            const proxyErr = proxyResult.error || proxyResult.message || 'Ошибка подключения через прокси';
            set(state => ({ accounts: state.accounts.map(a => a.id === id ? { ...a, status: 'error' as const, errorMessage: `❌ ${proxyErr}` } : a) }));
            const ns = get().notificationSettings;
            if (ns.notifyErrors) {
              get().notify(
                NotificationTemplates.accountError(acc.login, proxyErr as string),
                DiscordTemplates.accountError(acc.login, proxyErr as string)
              );
            }
            return;
          }

          // Not rate limit or no proxy — show error
          set(state => ({ accounts: state.accounts.map(a => a.id === id ? { ...a, status: 'error' as const, errorMessage: errMsg || 'Ошибка подключения' } : a) }));
          const ns = get().notificationSettings;
          if (ns.notifyErrors && errMsg) {
            get().notify(
              NotificationTemplates.accountError(acc.login, errMsg),
              DiscordTemplates.accountError(acc.login, errMsg)
            );
          }
        } catch {
          set(state => ({ accounts: state.accounts.map(a => a.id === id ? { ...a, status: 'error' as const, errorMessage: 'Сервер недоступен' } : a) }));
        }
      },

      disconnectAccount: async (id) => {
        await steamApi.logout(id);
        set(state => ({ accounts: state.accounts.map(a => a.id === id ? { ...a, status: 'offline' as const } : a) }));
      },

      // CHANGED: delay between accounts from 2000ms to 10000ms (10 seconds)
      connectAll: async () => {
        const accounts = get().getVisibleAccounts().filter(a => a.status === 'offline' || a.status === 'error');
        for (const acc of accounts) {
          await get().connectAccount(acc.id);
          await new Promise(r => setTimeout(r, 10000)); // 10 seconds delay
        }
      },

      disconnectAll: async () => {
        const accounts = get().getVisibleAccounts().filter(a => a.status !== 'offline');
        for (const acc of accounts) { await get().disconnectAccount(acc.id); }
      },

      refreshStatuses: async () => {
        await get().checkServerConnection();
        if (!get().serverConnected) {
          set(state => ({
            accounts: state.accounts.map(a =>
              a.status === 'online' || a.status === 'in-game' || a.status === 'connecting'
                ? { ...a, status: 'offline' as const, errorMessage: undefined } : a
            ),
          }));
          return;
        }
        try {
          const statuses = await steamApi.getAllStatuses();
          if (!statuses || Object.keys(statuses).length === 0) {
            set(state => ({
              accounts: state.accounts.map(a =>
                a.status === 'online' || a.status === 'in-game' ? { ...a, status: 'offline' as const } : a
              ),
            }));
            return;
          }
          set(state => ({
            accounts: state.accounts.map(a => {
              const status = statuses[a.id] as Record<string, unknown> | undefined;
              if (status) {
                return {
                  ...a, status: status.status as SteamAccount['status'],
                  steamId: (status.steamId as string) || a.steamId,
                  friendsCount: (status.friendsCount as number) ?? a.friendsCount,
                  level: (status.level as number) ?? a.level,
                  balance: (status.balance as number) ?? a.balance,
                  inventoryValue: (status.inventoryValue as number) ?? a.inventoryValue,
                  avatarUrl: (status.avatarUrl as string) || a.avatarUrl,
                  displayName: (status.displayName as string) || a.displayName,
                  tradeBan: (status.tradeBan as boolean) ?? a.tradeBan,
                  vacBan: (status.vacBan as boolean) ?? a.vacBan,
                  limited: (status.limited as boolean) ?? a.limited,
                };
              }
              if (a.status === 'online' || a.status === 'in-game') return { ...a, status: 'offline' as const };
              return a;
            }),
          }));
        } catch { /* ignore */ }
      },

      addMessage: (message) => { set(state => ({ messages: [...state.messages, message].slice(-500) })); },

      fetchNewMessages: async () => {
        try {
          const newMessages = await steamApi.getMessages();
          if (newMessages.length > 0) {
            set(state => {
              const existingIds = new Set(state.messages.map(m => m.id));
              const uniqueNew = newMessages.filter(m => !existingIds.has(m.id));
              if (uniqueNew.length === 0) return state;
              return { messages: [...state.messages, ...uniqueNew].slice(-500) };
            });
          }
        } catch { /* ignore */ }
      },

      sendMessage: async (accountId, friendSteamId, friendName, text) => {
        const acc = get().accounts.find(a => a.id === accountId);
        if (!acc) return false;
        const success = await steamApi.sendMessage(accountId, friendSteamId, text);
        if (success) {
          const msg: ChatMessage = {
            id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            accountId, accountLogin: acc.login, friendId: friendSteamId,
            friendName, friendAvatar: '👤', text, timestamp: new Date().toISOString(), isOutgoing: true,
          };
          get().addMessage(msg);
        }
        return success;
      },

      addDomain: (domain, target) => {
        if (get().domains.some(d => d.domain === domain)) return;
        const newDomain: DomainConfig = { id: generateId(), domain, target, ssl: false, status: 'pending', createdAt: new Date().toISOString() };
        set(state => ({ domains: [...state.domains, newDomain] }));
        steamApi.addDomain(domain, target).then(result => {
          if (result.success) {
            set(state => ({ domains: state.domains.map(d => d.domain === domain ? { ...d, status: 'active' as const, ssl: true, sslExpiry: result.sslExpiry as string | undefined } : d) }));
          }
        }).catch(() => {});
      },

      removeDomain: (id) => {
        const domain = get().domains.find(d => d.id === id);
        if (domain) steamApi.removeDomain(id).catch(() => {});
        set(state => ({ domains: state.domains.filter(d => d.id !== id) }));
      },

      updateDomain: (id, data) => { set(state => ({ domains: state.domains.map(d => (d.id === id ? { ...d, ...data } : d)) })); },

      updateNotificationSettings: (settings) => { set(state => ({ notificationSettings: { ...state.notificationSettings, ...settings } })); },

      notify: async (tgMsg, discordMsg) => {
        const ns = get().notificationSettings;
        await sendNotification(ns, tgMsg, discordMsg);
      },

      setSteamIdsToAdd: (ids) => set({ steamIdsToAdd: ids }),
      setFriendNetworkSteamIds: (ids) => set({ friendNetworkSteamIds: ids }),

      addFriendRequestLog: (log) => { set(state => ({ friendRequestLogs: [...state.friendRequestLogs, log].slice(-1000) })); },

      startFriendRequests: async (steamIds, requestsPerAccount, delaySeconds) => {
        _friendRequestAbort = false;
        set({ friendRequestRunning: true, friendRequestLogs: [] });
        const accounts = get().getVisibleAccounts().filter(a => a.status === 'online' || a.status === 'in-game');
        if (accounts.length === 0 || steamIds.length === 0) { set({ friendRequestRunning: false }); return; }
        get().addFriendRequestLog({
          id: generateId(), accountId: 'system', accountLogin: 'СИСТЕМА',
          targetSteamId: '', targetName: '', foundVia: '', status: 'sent',
          timestamp: new Date().toISOString(),
          error: `Запуск: ${accounts.length} аккаунтов, ${steamIds.length} целей, по ${requestsPerAccount} на аккаунт`,
        });
        let steamIdIndex = 0;
        for (const acc of accounts) {
          if (_friendRequestAbort) break;
          let sentForThisAccount = 0;
          while (sentForThisAccount < requestsPerAccount && steamIdIndex < steamIds.length) {
            if (_friendRequestAbort) break;
            const targetId = steamIds[steamIdIndex++];
            try {
              const result = await steamApi.addFriend(acc.id, targetId);
              set(state => ({
                friendRequestLogs: [...state.friendRequestLogs, {
                  id: generateId(), accountId: acc.id, accountLogin: acc.login,
                  targetSteamId: targetId, targetName: targetId, foundVia: 'manual',
                  status: (result.success ? 'sent' : 'error') as 'sent' | 'error',
                  timestamp: new Date().toISOString(),
                  error: result.success ? undefined : (result.error as string | undefined),
                }].slice(-1000),
              }));
              sentForThisAccount++;
            } catch { /* ignore */ }
            await new Promise(r => setTimeout(r, delaySeconds * 1000));
          }
          await new Promise(r => setTimeout(r, 1000));
        }
        set({ friendRequestRunning: false });
      },

      stopFriendRequests: () => { _friendRequestAbort = true; set({ friendRequestRunning: false }); },

      startFriendNetworkCrawler: async (targetSteamIds, maxDepth) => {
        _friendCrawlerAbort = false;
        set({ friendCrawlerRunning: true, friendCrawlerLogs: [] });
        const accounts = get().getVisibleAccounts().filter(a => a.status === 'online' || a.status === 'in-game');
        if (accounts.length === 0 || targetSteamIds.length === 0) { set({ friendCrawlerRunning: false }); return; }
        const visited = new Set<string>();
        let currentLevel = [...targetSteamIds];
        targetSteamIds.forEach(id => visited.add(id));
        for (let depth = 1; depth <= maxDepth && !_friendCrawlerAbort; depth++) {
          const nextLevel: string[] = [];
          for (const targetId of currentLevel) {
            if (_friendCrawlerAbort) break;
            const acc = accounts[Math.floor(Math.random() * accounts.length)];
            try {
              const result = await steamApi.addFriend(acc.id, targetId);
              set(state => ({
                friendCrawlerLogs: [...state.friendCrawlerLogs, {
                  id: generateId(), accountId: acc.id, accountLogin: acc.login,
                  targetSteamId: targetId, targetName: targetId, foundVia: `depth-${depth}`,
                  status: (result.success ? 'sent' : 'error') as 'sent' | 'error',
                  timestamp: new Date().toISOString(),
                  error: result.success ? `Запрос отправлен (глубина ${depth})` : (result.error as string | undefined),
                }].slice(-500),
              }));
            } catch { /* ignore */ }
            await new Promise(r => setTimeout(r, 2000));
            if (depth < maxDepth) {
              try {
                const friends = await steamApi.getFriendsOfFriend(acc.id, targetId);
                for (const f of friends) {
                  if (!visited.has(f.steamId)) { visited.add(f.steamId); nextLevel.push(f.steamId); }
                }
              } catch { /* ignore */ }
            }
            await new Promise(r => setTimeout(r, 1000));
          }
          currentLevel = nextLevel;
        }
        set({ friendCrawlerRunning: false });
      },

      stopFriendNetworkCrawler: () => { _friendCrawlerAbort = true; set({ friendCrawlerRunning: false }); },

      setSpammerMessage: (msg) => set({ spammerMessage: msg }),
      setSpammerDelay: (delay) => set({ spammerDelay: delay }),

      startSpammer: async () => {
        _spammerAbort = false;
        set({ spammerRunning: true, spammerLogs: [] });
        const message = get().spammerMessage;
        const delay = get().spammerDelay;
        if (!message.trim()) { set({ spammerRunning: false }); return; }
        const accounts = get().getVisibleAccounts().filter(a => a.status === 'online' || a.status === 'in-game');
        for (const acc of accounts) {
          if (_spammerAbort) break;
          const friends = await steamApi.getFriends(acc.id);
          const existingConversations = new Set(get().messages.filter(m => m.accountId === acc.id).map(m => m.friendId));
          const targetsToSpam = friends.filter(f => !existingConversations.has(f.steamId));
          for (const friend of targetsToSpam) {
            if (_spammerAbort) break;
            const success = await steamApi.sendMessage(acc.id, friend.steamId, message);
            const log: SpammerLog = {
              id: generateId(), accountLogin: acc.login, friendName: friend.name || friend.steamId,
              friendSteamId: friend.steamId, status: success ? 'sent' : 'error',
              timestamp: new Date().toISOString(), error: success ? undefined : 'Не удалось отправить',
            };
            set(state => ({ spammerLogs: [...state.spammerLogs, log] }));
            await new Promise(r => setTimeout(r, delay * 1000));
          }
          await new Promise(r => setTimeout(r, 2000));
        }
        set({ spammerRunning: false });
      },

      stopSpammer: () => { _spammerAbort = true; set({ spammerRunning: false }); },

      setSteamMarketApiKey: (key) => set({ steamMarketApiKey: key }),
      setProxyUrl: (url) => set({ proxyUrl: url }),

      fetchInventoryValues: async () => {
        const { accounts } = get();
        const onlineAccounts = accounts.filter(a => (a.status === 'online' || a.status === 'in-game') && a.steamId);
        for (const acc of onlineAccounts) {
          if (!acc.steamId) continue;
          try {
            const result = await steamApi.getInventoryValue(acc.steamId);
            if (result.totalValue > 0) { get().updateAccount(acc.id, { inventoryValue: result.totalValue }); }
          } catch { /* ignore */ }
          await new Promise(r => setTimeout(r, 2000));
        }
      },
    }),
    {
      name: 'sukacombine-storage',
      partialize: (state) => ({
        accounts: state.accounts.map(a => ({ ...a, status: 'offline' as const, errorMessage: undefined })),
        workers: state.workers,
        users: state.users,
        domains: state.domains,
        notificationSettings: state.notificationSettings,
        steamIdsToAdd: state.steamIdsToAdd,
        friendNetworkSteamIds: state.friendNetworkSteamIds,
        friendRequestLogs: state.friendRequestLogs.slice(-200),
        spammerMessage: state.spammerMessage,
        spammerDelay: state.spammerDelay,
        steamMarketApiKey: state.steamMarketApiKey,
        proxyUrl: state.proxyUrl,
      }),
    }
  )
);
