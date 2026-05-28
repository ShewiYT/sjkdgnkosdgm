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
  text: string;
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
  inGameMode: boolean;
}

export interface WorkerAction {
  id: string;
  action: string;
  accountId: string;
  timestamp: string;
  details: string;
}

export interface MultiChatSettings {
  autoParseInventory: boolean;
  parsGames: string[];
  autoParsesBans: boolean;
  collapseFriendsOnLoad: boolean;
  clearChatsOnLoad: boolean;
  categoryByGame: boolean;
  compactList: boolean;
  soundNewMessage: boolean;
  soundOnline: boolean;
  soundInGame: boolean;
  loadMode: 'multi' | 'sequential';
  loadInterval: number;
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

export type ActiveView = 'dashboard' | 'multichat' | 'browser' | 'offers' | 'spammer' | 'friends' | 'guard' | 'ingame' | 'levelup' | 'workers' | 'settings' | 'sda' | 'import' | 'domains';
