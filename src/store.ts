import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { steamApi } from './api';
import type { SteamAccount, ChatMessage, TradeOffer, Worker, MaFile, User } from './types';

interface AppStore {
  // Auth
  currentUser: User | null;
  users: User[];
  workers: Worker[];
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  addWorker: (data: { username: string; password: string; assignedAccounts: string[] }) => void;
  updateWorker: (id: string, data: Partial<Worker>) => void;
  removeWorker: (id: string) => void;

  // Accounts
  accounts: SteamAccount[];
  addAccount: (login: string, password: string, maFile?: MaFile) => void;
  addAccounts: (accountsData: { login: string; password: string; maFile?: MaFile }[]) => void;
  removeAccount: (id: string) => void;
  updateAccount: (id: string, data: Partial<SteamAccount>) => void;
  clearAccounts: () => void;

  // Get accounts for current user (worker sees only assigned, admin sees all)
  getVisibleAccounts: () => SteamAccount[];

  // Connection
  connectAccount: (id: string) => Promise<void>;
  disconnectAccount: (id: string) => Promise<void>;
  connectAll: () => Promise<void>;
  disconnectAll: () => Promise<void>;
  refreshStatuses: () => Promise<void>;

  // Messages
  messages: ChatMessage[];
  addMessage: (message: ChatMessage) => void;
  fetchNewMessages: () => Promise<void>;
  sendMessage: (accountId: string, friendSteamId: string, friendName: string, text: string) => Promise<boolean>;
  
  // Trade offers
  tradeOffers: TradeOffer[];

  // Polling
  startPolling: () => void;
  stopPolling: () => void;
}

const generateId = () => Math.random().toString(36).substring(2, 15);

const avatarEmojis = ['🎮', '👾', '🕹️', '🎯', '🔫', '⚔️', '🛡️', '💀', '🤖', '👽', '🐉', '🦊', '🐺', '🦅', '🦈'];
const servers = ['EU-1', 'EU-2', 'EU-3', 'RU-1', 'RU-2', 'US-1', 'US-2'];

// Default admin credentials
const DEFAULT_ADMIN: User = {
  id: 'admin',
  username: 'admin',
  role: 'admin',
  assignedAccounts: [],
  createdAt: new Date().toISOString(),
};

const DEFAULT_ADMIN_PASSWORD = 'admin123'; // Change this!

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

      // Auth
      login: async (username, password) => {
        // Check admin
        if (username === 'admin' && password === DEFAULT_ADMIN_PASSWORD) {
          set({ currentUser: DEFAULT_ADMIN });
          return true;
        }

        // Check workers
        const worker = get().workers.find(w => w.username === username && w.password === password);
        if (worker) {
          const user: User = {
            id: worker.id,
            username: worker.username,
            role: 'worker',
            assignedAccounts: worker.assignedAccounts,
            createdAt: worker.lastActive,
          };
          set({ currentUser: user });
          
          // Update last active
          set(state => ({
            workers: state.workers.map(w => 
              w.id === worker.id ? { ...w, lastActive: new Date().toISOString() } : w
            )
          }));
          
          return true;
        }

        return false;
      },

      logout: () => {
        set({ currentUser: null });
      },

      addWorker: (data) => {
        const newWorker: Worker = {
          id: generateId(),
          username: data.username,
          password: data.password,
          assignedAccounts: data.assignedAccounts,
          permissions: {
            chat: true,
            browser: false,
            offersSend: false,
            offersSendAll: false,
            offersConfirm: false,
            guard: false,
            inGameMode: false,
          },
          lastActive: new Date().toISOString(),
          actionsLog: [],
        };
        set(state => ({ workers: [...state.workers, newWorker] }));
      },

      updateWorker: (id, data) => {
        set(state => ({
          workers: state.workers.map(w => w.id === id ? { ...w, ...data } : w)
        }));
      },

      removeWorker: (id) => {
        set(state => ({ workers: state.workers.filter(w => w.id !== id) }));
      },

      // Accounts
      addAccount: (login, password, maFile) => {
        const currentUser = get().currentUser;
        const newAccount: SteamAccount = {
          id: generateId(),
          login,
          password,
          maFile,
          avatar: avatarEmojis[Math.floor(Math.random() * avatarEmojis.length)],
          displayName: login,
          level: 0,
          status: 'offline',
          balance: 0,
          guardEnabled: !!maFile,
          server: servers[Math.floor(Math.random() * servers.length)],
          tradeBan: false,
          vacBan: false,
          limited: false,
          friendsCount: 0,
          inventoryValue: 0,
          ownerId: currentUser?.id,
        };
        set(state => ({ accounts: [...state.accounts, newAccount] }));
      },

      addAccounts: (accountsData) => {
        const currentUser = get().currentUser;
        const newAccounts: SteamAccount[] = accountsData.map(({ login, password, maFile }) => ({
          id: generateId(),
          login,
          password,
          maFile,
          avatar: avatarEmojis[Math.floor(Math.random() * avatarEmojis.length)],
          displayName: login,
          level: 0,
          status: 'offline' as const,
          balance: 0,
          guardEnabled: !!maFile,
          server: servers[Math.floor(Math.random() * servers.length)],
          tradeBan: false,
          vacBan: false,
          limited: false,
          friendsCount: 0,
          inventoryValue: 0,
          ownerId: currentUser?.id,
        }));
        set(state => ({ accounts: [...state.accounts, ...newAccounts] }));
      },

      removeAccount: (id) => {
        const acc = get().accounts.find(a => a.id === id);
        if (acc && acc.status !== 'offline') {
          steamApi.logout(id);
        }
        set(state => ({ accounts: state.accounts.filter(a => a.id !== id) }));
      },

      updateAccount: (id, data) => {
        set(state => ({
          accounts: state.accounts.map(a => a.id === id ? { ...a, ...data } : a)
        }));
      },

      clearAccounts: () => {
        const visibleAccounts = get().getVisibleAccounts();
        visibleAccounts.forEach(acc => {
          if (acc.status !== 'offline') {
            steamApi.logout(acc.id);
          }
        });
        const visibleIds = new Set(visibleAccounts.map(a => a.id));
        set(state => ({ 
          accounts: state.accounts.filter(a => !visibleIds.has(a.id)),
          messages: [] 
        }));
      },

      getVisibleAccounts: () => {
        const { currentUser, accounts, workers } = get();
        if (!currentUser) return [];
        
        if (currentUser.role === 'admin') {
          return accounts;
        }
        
        // Worker sees only assigned accounts
        const worker = workers.find(w => w.id === currentUser.id);
        if (!worker) return [];
        
        return accounts.filter(a => worker.assignedAccounts.includes(a.id));
      },

      // Connection methods
      connectAccount: async (id) => {
        const acc = get().accounts.find(a => a.id === id);
        if (!acc) return;

        set(state => ({
          accounts: state.accounts.map(a => 
            a.id === id ? { ...a, status: 'connecting' as const, errorMessage: undefined } : a
          )
        }));

        const result = await steamApi.login(
          id,
          acc.login,
          acc.password,
          acc.maFile?.shared_secret,
          acc.maFile?.identity_secret
        );

        if (result.success || result.status === 'online') {
          set(state => ({
            accounts: state.accounts.map(a => 
              a.id === id ? { 
                ...a, 
                status: 'online' as const, 
                steamId: result.steamId,
                errorMessage: undefined 
              } : a
            )
          }));
        } else {
          set(state => ({
            accounts: state.accounts.map(a => 
              a.id === id ? { 
                ...a, 
                status: 'error' as const, 
                errorMessage: result.error 
              } : a
            )
          }));
        }
      },

      disconnectAccount: async (id) => {
        await steamApi.logout(id);
        set(state => ({
          accounts: state.accounts.map(a => 
            a.id === id ? { ...a, status: 'offline' as const } : a
          )
        }));
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
        for (const acc of accounts) {
          await get().disconnectAccount(acc.id);
        }
      },

      refreshStatuses: async () => {
        const statuses = await steamApi.getAllStatuses();
        set(state => ({
          accounts: state.accounts.map(a => {
            const status = statuses[a.id];
            if (status) {
              return {
                ...a,
                status: status.status as SteamAccount['status'],
                steamId: status.steamId,
                friendsCount: status.friendsCount || a.friendsCount,
              };
            }
            return a;
          })
        }));
      },

      // Messages
      addMessage: (message) => {
        set(state => ({ messages: [...state.messages, message].slice(-500) }));
      },

      fetchNewMessages: async () => {
        const newMessages = await steamApi.getMessages();
        if (newMessages.length > 0) {
          set(state => ({
            messages: [...state.messages, ...newMessages].slice(-500)
          }));
        }
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

      // Polling
      startPolling: () => {
        if (pollingInterval) return;
        
        pollingInterval = setInterval(async () => {
          await get().fetchNewMessages();
          await get().refreshStatuses();
        }, 3000);
      },

      stopPolling: () => {
        if (pollingInterval) {
          clearInterval(pollingInterval);
          pollingInterval = null;
        }
      },
    }),
    {
      name: 'sukacombine-storage',
      partialize: (state) => ({ 
        accounts: state.accounts.map(a => ({
          ...a,
          status: 'offline' as const,
          errorMessage: undefined,
        })),
        workers: state.workers,
        users: state.users,
      }),
    }
  )
);
