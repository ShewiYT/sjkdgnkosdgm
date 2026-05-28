import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { steamApi } from './api';
import { sendNotification, NotificationTemplates, DiscordTemplates } from './notifications';
import type { SteamAccount, ChatMessage, TradeOffer, Worker, MaFile, User, DomainConfig, NotificationSettings } from './types';

interface AppStore {
  currentUser: User | null;
  users: User[];
  workers: Worker[];
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  addWorker: (data: { username: string; password: string; assignedAccounts: string[] }) => void;
  updateWorker: (id: string, data: Partial<Worker>) => void;
  removeWorker: (id: string) => void;
  loadWorkers: () => void;

  accounts: SteamAccount[];
  addAccount: (login: string, password: string, maFile?: MaFile) => void;
  addAccounts: (accountsData: { login: string; password: string; maFile?: MaFile }[]) => void;
  removeAccount: (id: string) => void;
  updateAccount: (id: string, data: Partial<SteamAccount>) => void;
  clearAccounts: () => void;
  getVisibleAccounts: () => SteamAccount[];

  connectAccount: (id: string) => Promise<void>;
  disconnectAccount: (id: string) => Promise<void>;
  connectAll: () => Promise<void>;
  disconnectAll: () => Promise<void>;
  refreshStatuses: () => Promise<void>;

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

  startPolling: () => void;
  stopPolling: () => void;
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

let pollingInterval: ReturnType<typeof setInterval> | null = null;

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
            get().loadWorkers();
            return true;
          }
        } catch {
          if (username === 'admin' && password === DEFAULT_ADMIN_PASSWORD) {
            set({ currentUser: DEFAULT_ADMIN });
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
                createdAt: worker.lastActive
              } as User
            });
            return true;
          }
        }
        return false;
      },

      logout: () => set({ currentUser: null }),

      addWorker: (data) => {
        fetch('/api/workers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        }).then(res => res.json()).then(result => {
          if (result.success && result.worker) {
            set(state => ({ workers: [...state.workers, result.worker] }));
          }
        }).catch(() => {
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
        set(state => ({ workers: state.workers.map(w => w.id === id ? { ...w, ...data } : w) }));
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
        const newAccount: SteamAccount = {
          id: generateId(),
          login, password, maFile,
          avatar: avatarEmojis[Math.floor(Math.random() * avatarEmojis.length)],
          displayName: login,
          level: 0,
          status: 'offline',
          balance: 0,
          guardEnabled: !!maFile,
          server: servers[Math.floor(Math.random() * servers.length)],
          tradeBan: false, vacBan: false, limited: false,
          friendsCount: 0, inventoryValue: 0,
          ownerId: currentUser?.id,
        };
        set(state => ({ accounts: [...state.accounts, newAccount] }));
      },

      addAccounts: (accountsData) => {
        const currentUser = get().currentUser;
        const newAccounts: SteamAccount[] = accountsData.map(({ login, password, maFile }) => ({
          id: generateId(),
          login, password, maFile,
          avatar: avatarEmojis[Math.floor(Math.random() * avatarEmojis.length)],
          displayName: login,
          level: 0,
          status: 'offline' as const,
          balance: 0,
          guardEnabled: !!maFile,
          server: servers[Math.floor(Math.random() * servers.length)],
          tradeBan: false, vacBan: false, limited: false,
          friendsCount: 0, inventoryValue: 0,
          ownerId: currentUser?.id,
        }));
        set(state => ({ accounts: [...state.accounts, ...newAccounts] }));

        // Notify
        const ns = get().notificationSettings;
        if (ns.notifyAccountsLoaded) {
          get().notify(
            NotificationTemplates.accountsLoaded(newAccounts.length),
            DiscordTemplates.accountsLoaded(newAccounts.length)
          );
        }
      },

      removeAccount: (id) => {
        const acc = get().accounts.find(a => a.id === id);
        if (acc && acc.status !== 'offline') steamApi.logout(id);
        set(state => ({ accounts: state.accounts.filter(a => a.id !== id) }));
      },

      updateAccount: (id, data) => {
        set(state => ({ accounts: state.accounts.map(a => a.id === id ? { ...a, ...data } : a) }));
      },

      clearAccounts: () => {
        const visibleAccounts = get().getVisibleAccounts();
        visibleAccounts.forEach(acc => { if (acc.status !== 'offline') steamApi.logout(acc.id); });
        const visibleIds = new Set(visibleAccounts.map(a => a.id));
        set(state => ({ accounts: state.accounts.filter(a => !visibleIds.has(a.id)), messages: [] }));
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
        set(state => ({
          accounts: state.accounts.map(a => a.id === id ? { ...a, status: 'connecting' as const, errorMessage: undefined } : a)
        }));
        try {
          const result = await steamApi.login(id, acc.login, acc.password, acc.maFile?.shared_secret, acc.maFile?.identity_secret);
          if (result.success || result.status === 'online') {
            set(state => ({
              accounts: state.accounts.map(a => a.id === id ? {
                ...a,
                status: 'online' as const,
                steamId: result.steamId || a.steamId,
                level: result.level ?? a.level,
                balance: result.balance ?? a.balance,
                inventoryValue: result.inventoryValue ?? a.inventoryValue,
                friendsCount: result.friendsCount ?? a.friendsCount,
                avatarUrl: result.avatarUrl || a.avatarUrl,
                displayName: result.displayName || a.displayName,
                tradeBan: result.tradeBan ?? a.tradeBan,
                vacBan: result.vacBan ?? a.vacBan,
                limited: result.limited ?? a.limited,
                errorMessage: undefined,
              } : a)
            }));
            const ns = get().notificationSettings;
            if (ns.notifyLogin) {
              get().notify(
                NotificationTemplates.accountLogin(acc.login, 'online'),
                DiscordTemplates.accountLogin(acc.login, 'online')
              );
            }
          } else {
            const errMsg = result.error || result.message || 'Ошибка подключения';
            set(state => ({
              accounts: state.accounts.map(a => a.id === id ? { ...a, status: 'error' as const, errorMessage: errMsg } : a)
            }));
            const ns = get().notificationSettings;
            if (ns.notifyErrors) {
              get().notify(
                NotificationTemplates.accountError(acc.login, errMsg),
                DiscordTemplates.accountError(acc.login, errMsg)
              );
            }
          }
        } catch {
          set(state => ({
            accounts: state.accounts.map(a => a.id === id ? { ...a, status: 'error' as const, errorMessage: 'Сервер недоступен' } : a)
          }));
        }
      },

      disconnectAccount: async (id) => {
        await steamApi.logout(id);
        set(state => ({ accounts: state.accounts.map(a => a.id === id ? { ...a, status: 'offline' as const } : a) }));
      },

      connectAll: async () => {
        const accounts = get().getVisibleAccounts().filter(a => a.status === 'offline' || a.status === 'error');
        for (const acc of accounts) {
          await get().connectAccount(acc.id);
          await new Promise(r => setTimeout(r, 2000));
        }
      },

      disconnectAll: async () => {
        const accounts = get().getVisibleAccounts().filter(a => a.status !== 'offline');
        for (const acc of accounts) { await get().disconnectAccount(acc.id); }
      },

      refreshStatuses: async () => {
        try {
          const statuses = await steamApi.getAllStatuses();
          set(state => ({
            accounts: state.accounts.map(a => {
              const status = statuses[a.id];
              if (status) {
                return {
                  ...a,
                  status: status.status as SteamAccount['status'],
                  steamId: status.steamId || a.steamId,
                  friendsCount: status.friendsCount ?? a.friendsCount,
                  level: status.level ?? a.level,
                  balance: status.balance ?? a.balance,
                  inventoryValue: status.inventoryValue ?? a.inventoryValue,
                  avatarUrl: status.avatarUrl || a.avatarUrl,
                  displayName: status.displayName || a.displayName,
                  tradeBan: status.tradeBan ?? a.tradeBan,
                  vacBan: status.vacBan ?? a.vacBan,
                  limited: status.limited ?? a.limited,
                };
              }
              return a;
            })
          }));
        } catch { /* ignore */ }
      },

      addMessage: (message) => {
        set(state => ({ messages: [...state.messages, message].slice(-500) }));
      },

      fetchNewMessages: async () => {
        try {
          const newMessages = await steamApi.getMessages();
          if (newMessages.length > 0) {
            set(state => ({ messages: [...state.messages, ...newMessages].slice(-500) }));
            // Notify about new incoming messages
            const ns = get().notificationSettings;
            if (ns.notifyNewMessage) {
              const incoming = newMessages.filter(m => !m.isOutgoing);
              for (const msg of incoming) {
                get().notify(
                  NotificationTemplates.newMessage(msg.friendName, msg.friendId, msg.text),
                  DiscordTemplates.newMessage(msg.friendName, msg.friendId, msg.text)
                );
              }
            }
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
            accountId,
            accountLogin: acc.login,
            friendId: friendSteamId,
            friendName,
            friendAvatar: '👤',
            text,
            timestamp: new Date().toISOString(),
            isOutgoing: true,
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
            set(state => ({ domains: state.domains.map(d => d.domain === domain ? { ...d, status: 'active' as const, ssl: true, sslExpiry: result.sslExpiry } : d) }));
          }
        }).catch(() => {});
      },

      removeDomain: (id) => {
        const domain = get().domains.find(d => d.id === id);
        if (domain) steamApi.removeDomain(id).catch(() => {});
        set(state => ({ domains: state.domains.filter(d => d.id !== id) }));
      },

      updateDomain: (id, data) => {
        set(state => ({ domains: state.domains.map(d => d.id === id ? { ...d, ...data } : d) }));
      },

      updateNotificationSettings: (settings) => {
        set(state => ({ notificationSettings: { ...state.notificationSettings, ...settings } }));
      },

      notify: async (tgMsg, discordMsg) => {
        const ns = get().notificationSettings;
        await sendNotification(ns, tgMsg, discordMsg);
      },

      startPolling: () => {
        if (pollingInterval) return;
        pollingInterval = setInterval(async () => {
          await get().fetchNewMessages();
          await get().refreshStatuses();
        }, 3000);
      },

      stopPolling: () => {
        if (pollingInterval) { clearInterval(pollingInterval); pollingInterval = null; }
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
      }),
    }
  )
);
