export interface User {
  id: string;
  username: string;
  role: 'admin' | 'worker';
  assignedAccounts: string[];
  createdAt: string;
}

export interface SteamAccount {
  id: string;
  login: string;
  password: string;
  maFile?: MaFile;
  avatar: string;
  avatarUrl?: string;
  displayName: string;
  steamId?: string;
  level: number;
  status: 'online' | 'offline' | 'in-game' | 'away' | 'connecting' | 'error';
  game?: string;
  balance: number;
  guardEnabled: boolean;
  server: string;
  tradeBan: boolean;
  vacBan: boolean;
  limited: boolean;
  friendsCount: number;
  inventoryValue: number;
  errorMessage?: string;
  ownerId?: string;
  steamApiKey?: string;
  customName?: string;
  customCountry?: string;
  customBio?: string;
  customAvatarUrl?: string;
}

export interface MaFile {
  shared_secret: string;
  serial_number: string;
  revocation_code: string;
  uri: string;
  server_time: number;
  account_name: string;
  token_gid: string;
  identity_secret: string;
  secret_1: string;
  status: number;
  device_id: string;
  fully_enrolled: boolean;
  Session: {
    SessionID: string;
    SteamLogin: string;
    SteamLoginSecure: string;
    WebCookie: string;
    OAuthToken: string;
    SteamID: string;
  };
}

export interface Friend {
  id: string;
  name: string;
  avatar: string;
  avatarUrl?: string;
  status: 'online' | 'offline' | 'in-game' | 'away';
  game?: string;
  lastOnline: string;
  isNew: boolean;
  tradeBan: boolean;
  vacBan: boolean;
  limited: boolean;
  country: string;
  registrationDate: string;
  profilePrivacy: 'public' | 'private' | 'friends';
  steamId: string;
  accountId: string;
}

export interface ChatMessage {
  id: string;
  accountId: string;
  accountLogin: string;
  friendId: string;
  friendName: string;
  friendAvatar: string;
  friendAvatarUrl?: string;
  text: string;
  translatedText?: string;
  timestamp: string;
  isOutgoing: boolean;
}

export interface InventoryItem {
  id: string;
  name: string;
  icon: string;
  game: string;
  price: number;
  tradable: boolean;
  holdUntil?: string;
  rarity: string;
  type: string;
}

export interface TradeOffer {
  id: string;
  partnerId: string;
  partnerName: string;
  partnerAvatar: string;
  itemsGive: InventoryItem[];
  itemsReceive: InventoryItem[];
  status: 'pending' | 'accepted' | 'declined' | 'countered';
  timestamp: string;
  accountId: string;
}

export interface Worker {
  id: string;
  username: string;
  password: string;
  assignedAccounts: string[];
  permissions: WorkerPermissions;
  lastActive: string;
  actionsLog: WorkerAction[];
}

export interface WorkerPermissions {
  chat: boolean;
  browser: boolean;
  offersSend: boolean;
  offersSendAll: boolean;
  offersConfirm: boolean;
  guard: boolean;
}

export interface WorkerAction {
  id: string;
  action: string;
  accountId: string;
  timestamp: string;
  details: string;
}

export interface DomainConfig {
  id: string;
  domain: string;
  target: 'panel' | 'api';
  ssl: boolean;
  sslExpiry?: string;
  status: 'active' | 'pending' | 'error';
  errorMessage?: string;
  createdAt: string;
}

export interface NotificationSettings {
  telegramBotToken: string;
  telegramAdminId: string;
  discordWebhookUrl: string;
  enableTelegram: boolean;
  enableDiscord: boolean;
  notifyAccountsLoaded: boolean;
  notifyNewMessage: boolean;
  notifyFriendsStart: boolean;
  notifyFriendsEnd: boolean;
  notifyErrors: boolean;
  notifyLogin: boolean;
}

export interface FriendRequestLog {
  id: string;
  accountId: string;
  accountLogin: string;
  targetSteamId: string;
  targetName: string;
  foundVia: string;
  status: 'sent' | 'accepted' | 'declined' | 'error';
  timestamp: string;
  error?: string;
}

export interface SpammerLog {
  id: string;
  accountLogin: string;
  friendName: string;
  friendSteamId: string;
  status: 'sent' | 'error' | 'skipped';
  timestamp: string;
  error?: string;
}

export interface ParserConfig {
  apiKey: string;
  startIds: string[];
  minPrice: number;
  maxPrice: number;
  maxDepth: number;
  maxFriendsPerLevel: number;
  threads: number;
}

export interface ParserResult {
  steamId: string;
  inventoryValue: number;
  itemsCount: number;
  country: string;
  profileName: string;
  profileUrl: string;
  foundAt: string;
}

export interface ParserStats {
  checked: number;
  skippedCis: number;
  skippedPrivate: number;
  emptyInventory: number;
  inventoryChecked: number;
  foundValuable: number;
  errors: number;
  currentLevel: number;
  queueSize: number;
}

export interface ParserJob {
  id: string;
  status: 'idle' | 'running' | 'paused' | 'completed' | 'error';
  config: ParserConfig;
  stats: ParserStats;
  results: ParserResult[];
  logs: string[];
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

export type ActiveView =
  | 'dashboard'
  | 'multichat'
  | 'browser'
  | 'offers'
  | 'spammer'
  | 'friends'
  | 'guard'
  | 'workers'
  | 'settings'
  | 'sda'
  | 'import'
  | 'domains'
  | 'notifications'
  | 'account-manager'
  | 'parser';
