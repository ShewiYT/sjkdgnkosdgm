import type { SteamAccount, Friend, InventoryItem, ChatMessage, TradeOffer, Worker, MultiChatSettings } from './types';

const avatars = [
  '🎮', '👾', '🕹️', '🎯', '🔫', '⚔️', '🛡️', '💀', '🤖', '👽',
  '🐉', '🦊', '🐺', '🦅', '🦈', '🐍', '🦂', '🕷️', '🦇', '🐙'
];

const names = [
  'xXDarkLordXx', 'ProGamer2024', 'SniperElite', 'CyberPunk77', 'NoobSlayer',
  'ToxicAvenger', 'ShadowHunter', 'IceBreaker', 'StormRider', 'NightWolf',
  'BlazeMaster', 'PhantomKing', 'VenomStrike', 'ThunderBolt', 'IronFist',
  'GhostRider', 'DragonBorn', 'WolfPack', 'EagleEye', 'CobaltSnake'
];

const games = ['Counter-Strike 2', 'Dota 2', 'PUBG', 'Rust', 'Team Fortress 2', 'H1Z1'];
const countries = ['🇷🇺 RU', '🇺🇦 UA', '🇰🇿 KZ', '🇧🇾 BY', '🇺🇸 US', '🇩🇪 DE', '🇵🇱 PL'];
const servers = ['EU-1', 'EU-2', 'EU-3', 'RU-1', 'RU-2', 'US-1', 'US-2'];

export const mockAccounts: SteamAccount[] = Array.from({ length: 8 }, (_, i) => ({
  id: `acc_${i}`,
  username: `suka_team_${i + 1}`,
  avatar: avatars[i],
  level: Math.floor(Math.random() * 50) + 5,
  status: (['online', 'online', 'in-game', 'offline', 'away'] as const)[Math.floor(Math.random() * 5)],
  game: Math.random() > 0.5 ? games[Math.floor(Math.random() * games.length)] : undefined,
  balance: Math.round(Math.random() * 5000 * 100) / 100,
  guardEnabled: Math.random() > 0.2,
  server: servers[Math.floor(Math.random() * servers.length)],
  tradeBan: Math.random() > 0.9,
  vacBan: Math.random() > 0.95,
  limited: Math.random() > 0.85,
  friendsCount: Math.floor(Math.random() * 200) + 10,
  inventoryValue: Math.round(Math.random() * 10000 * 100) / 100,
}));

export const mockFriends: Friend[] = Array.from({ length: 40 }, (_, i) => {
  const accIdx = Math.floor(Math.random() * mockAccounts.length);
  return {
    id: `friend_${i}`,
    name: names[i % names.length] + (i >= names.length ? `_${i}` : ''),
    avatar: avatars[(i + 3) % avatars.length],
    status: (['online', 'offline', 'in-game', 'away'] as const)[Math.floor(Math.random() * 4)],
    game: Math.random() > 0.5 ? games[Math.floor(Math.random() * games.length)] : undefined,
    lastOnline: new Date(Date.now() - Math.random() * 86400000 * 7).toISOString(),
    isNew: i < 3,
    tradeBan: Math.random() > 0.9,
    vacBan: Math.random() > 0.92,
    limited: Math.random() > 0.88,
    country: countries[Math.floor(Math.random() * countries.length)],
    registrationDate: `${2012 + Math.floor(Math.random() * 12)}`,
    profilePrivacy: (['public', 'private', 'friends'] as const)[Math.floor(Math.random() * 3)],
    unreadMessages: Math.random() > 0.7 ? Math.floor(Math.random() * 10) + 1 : 0,
    pinned: i < 2,
    deleted: false,
    accountId: mockAccounts[accIdx].id,
  };
});

const itemNames = [
  'AK-47 | Redline', 'AWP | Dragon Lore', 'M4A4 | Howl', 'Knife | Karambit Fade',
  'Glock-18 | Fade', 'USP-S | Kill Confirmed', 'Desert Eagle | Blaze',
  'AK-47 | Fire Serpent', 'M4A1-S | Hyper Beast', 'AWP | Asiimov',
  'Arcana | Phantom Assassin', 'Arcana | Juggernaut', 'Hook | Pudge',
  'Trenchcoat (Black)', 'Military Vest', 'Assault Rifle',
  'AK-47 | Vulcan', 'AWP | Lightning Strike', 'P250 | See Ya Later',
  'SSG 08 | Blood in the Water'
];

const rarities = ['Consumer Grade', 'Industrial Grade', 'Mil-Spec', 'Restricted', 'Classified', 'Covert', 'Contraband'];
const itemTypes = ['Rifle', 'Sniper', 'Pistol', 'Knife', 'Arcana', 'Clothing', 'SMG'];

export const mockInventory: InventoryItem[] = Array.from({ length: 30 }, (_, i) => ({
  id: `item_${i}`,
  name: itemNames[i % itemNames.length],
  icon: ['🔫', '🗡️', '🎯', '💣', '🛡️', '⚔️'][Math.floor(Math.random() * 6)],
  game: games[Math.floor(Math.random() * games.length)],
  price: Math.round((Math.random() * 500 + 0.5) * 100) / 100,
  tradable: Math.random() > 0.3,
  holdUntil: Math.random() > 0.5 ? new Date(Date.now() + Math.random() * 604800000).toISOString() : undefined,
  rarity: rarities[Math.floor(Math.random() * rarities.length)],
  type: itemTypes[Math.floor(Math.random() * itemTypes.length)],
}));

export const mockMessages: ChatMessage[] = [
  { id: 'm1', senderId: 'friend_0', senderName: 'xXDarkLordXx', text: 'Привет, есть скины на обмен?', timestamp: new Date(Date.now() - 3600000).toISOString(), isOwn: false },
  { id: 'm2', senderId: 'me', senderName: 'suka_team_1', text: 'Да, смотри инвентарь', timestamp: new Date(Date.now() - 3500000).toISOString(), isOwn: true },
  { id: 'm3', senderId: 'friend_0', senderName: 'xXDarkLordXx', text: 'АК Редлайн за сколько отдашь?', timestamp: new Date(Date.now() - 3400000).toISOString(), isOwn: false },
  { id: 'm4', senderId: 'me', senderName: 'suka_team_1', text: 'Кидай оффер, посмотрю', timestamp: new Date(Date.now() - 3300000).toISOString(), isOwn: true },
  { id: 'm5', senderId: 'friend_0', senderName: 'xXDarkLordXx', text: 'Кинул, глянь', timestamp: new Date(Date.now() - 3200000).toISOString(), isOwn: false },
  { id: 'm6', senderId: 'me', senderName: 'suka_team_1', text: 'Принял, спасибо!', timestamp: new Date(Date.now() - 3100000).toISOString(), isOwn: true },
];

export const mockTradeOffers: TradeOffer[] = Array.from({ length: 5 }, (_, i) => ({
  id: `offer_${i}`,
  partnerId: `friend_${i}`,
  partnerName: names[i],
  partnerAvatar: avatars[i + 3],
  itemsGive: mockInventory.slice(i * 2, i * 2 + 2),
  itemsReceive: mockInventory.slice(i * 2 + 10, i * 2 + 12),
  status: (['pending', 'accepted', 'declined', 'pending'] as const)[i % 4],
  timestamp: new Date(Date.now() - i * 3600000).toISOString(),
  accountId: mockAccounts[i % mockAccounts.length].id,
}));

export const mockWorkers: Worker[] = [
  {
    id: 'w1',
    name: 'Worker_Dmitry',
    permissions: { chat: true, browser: false, offersSend: true, offersSendAll: false, offersConfirm: false, guard: false, inGameMode: true },
    lastActive: new Date(Date.now() - 600000).toISOString(),
    accountsAssigned: ['acc_0', 'acc_1'],
    actionsLog: [
      { id: 'a1', action: 'Отправлено сообщение', accountId: 'acc_0', timestamp: new Date(Date.now() - 600000).toISOString(), details: 'Сообщение для friend_0' },
      { id: 'a2', action: 'Отправлен оффер', accountId: 'acc_1', timestamp: new Date(Date.now() - 1200000).toISOString(), details: 'Оффер #12345' },
    ],
  },
  {
    id: 'w2',
    name: 'Worker_Alexey',
    permissions: { chat: true, browser: true, offersSend: true, offersSendAll: true, offersConfirm: true, guard: true, inGameMode: true },
    lastActive: new Date(Date.now() - 300000).toISOString(),
    accountsAssigned: ['acc_2', 'acc_3', 'acc_4'],
    actionsLog: [
      { id: 'a3', action: 'Подтверждение оффера', accountId: 'acc_2', timestamp: new Date(Date.now() - 300000).toISOString(), details: 'Оффер #12346 подтвержден' },
    ],
  },
];

export const defaultSettings: MultiChatSettings = {
  autoParseInventory: true,
  parsGames: ['CS', 'Dota', 'TF', 'RUST'],
  autoParsesBans: true,
  collapseFriendsOnLoad: false,
  clearChatsOnLoad: false,
  categoryByGame: true,
  compactList: false,
  soundNewMessage: true,
  soundOnline: false,
  soundInGame: false,
  loadMode: 'multi',
  loadInterval: 1,
};
