import { useState, useEffect } from 'react';
import { Users, Search, Play, Square, CheckCircle, XCircle, Network } from 'lucide-react';
import { useAppStore } from '../store';
import { steamApi } from '../api';
import type { SteamAccount } from '../types';
import type { FriendData } from '../api';

interface FriendsManagerProps {
  accounts: SteamAccount[];
  selectedAccount: SteamAccount | null;
}

type Tab = 'manual' | 'network';

function getStatusText(personaState: number) {
  switch (personaState) {
    case 1: return 'Онлайн';
    case 2: return 'Занят';
    case 3: return 'Нет дома';
    case 4: return 'Снит';
    case 5: return 'Хочет играть';
    case 6: return 'Играет';
    default: return 'Оффлайн';
  }
}

export default function FriendsManager({ accounts, selectedAccount }: FriendsManagerProps) {
  const {
    steamIdsToAdd,
    setSteamIdsToAdd,
    friendNetworkSteamIds,
    setFriendNetworkSteamIds,
    friendRequestLogs,
    friendRequestRunning,
    startFriendRequests,
    stopFriendRequests,
    friendCrawlerRunning,
    friendCrawlerLogs,
    startFriendNetworkCrawler,
    stopFriendNetworkCrawler,
  } = useAppStore();

  const [friends, setFriends] = useState<FriendData[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [requestsPerAccount, setRequestsPerAccount] = useState(10);
  const [delaySeconds, setDelaySeconds] = useState(5);
  const [maxDepth, setMaxDepth] = useState(2);
  const [activeTab, setActiveTab] = useState<Tab>('manual');

  const onlineAccounts = accounts.filter(a => a.status === 'online' || a.status === 'in-game');
  const activeAccount = selectedAccount || onlineAccounts[0];

  useEffect(() => {
    if (!activeAccount) return;
    setLoading(true);
    steamApi.getFriends(activeAccount.id).then(f => {
      setFriends(f);
      setLoading(false);
    });
  }, [activeAccount?.id]);

  const filteredFriends = friends.filter(
    f => (f.name || f.steamId).toLowerCase().includes(search.toLowerCase())
  );

  const parsedIds = steamIdsToAdd
    .split('\n')
    .map(s => s.trim())
    .filter(Boolean);

  const parsedNetworkIds = friendNetworkSteamIds
    .split('\n')
    .map(s => s.trim())
    .filter(Boolean);

  const sentCount = friendRequestLogs.filter(
    l => l.status === 'sent' && l.targetSteamId
  ).length;
  const errorCount = friendRequestLogs.filter(
    l => l.status === 'error' && l.targetSteamId
  ).length;

  return (
    <div className="flex h-full overflow-hidden">
      {/* Friends list */}
      <div className="w-56 flex flex-col border-r border-white/5 shrink-0">
        <div className="p-3 border-b border-white/5 space-y-2">
          <div className="flex items-center gap-2">
            <Users size={14} className="text-white/40" />
            <span className="text-sm font-semibold text-white">Список друзей</span>
          </div>
          {activeAccount && (
            <div className="text-[10px] text-indigo-400">Аккаунт: {activeAccount.login}</div>
          )}
          <div className="relative">
            <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Поиск друзей..."
              className="w-full glass-input text-xs text-white pl-9 pr-3 py-2 rounded-xl outline-none"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-white/5">
          {loading ? (
            <div className="p-4 text-center text-xs text-white/30">Загрузка...</div>
          ) : filteredFriends.length === 0 ? (
            <div className="p-8 text-center">
              <Users size={32} className="mx-auto mb-2 text-white/10" />
              <div className="text-xs text-white/30">Нет друзей</div>
            </div>
          ) : (
            filteredFriends.map(friend => (
              <div key={friend.steamId} className="flex items-center gap-2 px-3 py-2">
                <div className="relative shrink-0">
                  {friend.avatarUrl && friend.avatarUrl.includes('http') ? (
                    <img src={friend.avatarUrl} alt="" className="w-7 h-7 rounded-full" />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center text-sm">
                      👤
                    </div>
                  )}
                  <span
                    className={`absolute bottom-0 right-0 w-2 h-2 rounded-full border border-dark-800 ${
                      friend.personaState > 0 ? 'bg-green-400' : 'bg-gray-500'
                    }`}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-white truncate">{friend.name}</div>
                  <div className="text-[10px] text-white/30">{getStatusText(friend.personaState)}</div>
                </div>
                <div className="text-[9px] text-white/20">{friend.steamId.slice(-6)}</div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Management panel */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-white/5">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <Users size={16} />
            Управление друзьями
          </h2>
          <p className="text-xs text-white/30 mt-1">
            Добавление в друзья через список или сеть друзей-друзей
          </p>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/5">
          <button
            onClick={() => setActiveTab('manual')}
            className={`px-4 py-2 text-xs transition-colors ${
              activeTab === 'manual'
                ? 'text-indigo-400 border-b-2 border-indigo-400'
                : 'text-white/40 hover:text-white/60'
            }`}
          >
            Ручное добавление
          </button>
          <button
            onClick={() => setActiveTab('network')}
            className={`px-4 py-2 text-xs transition-colors ${
              activeTab === 'network'
                ? 'text-indigo-400 border-b-2 border-indigo-400'
                : 'text-white/40 hover:text-white/60'
            }`}
          >
            <span className="flex items-center gap-1">
              <Network size={12} /> Сеть друзей
            </span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* MANUAL TAB */}
          {activeTab === 'manual' && (
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-3">
                <div className="glass-card rounded-xl p-3 text-center">
                  <div className="text-lg font-bold text-indigo-400">{onlineAccounts.length}</div>
                  <div className="text-[10px] text-white/40">Онлайн аккаунтов</div>
                </div>
                <div className="glass-card rounded-xl p-3 text-center">
                  <div className="text-lg font-bold text-white">{parsedIds.length}</div>
                  <div className="text-[10px] text-white/40">Steam ID</div>
                </div>
                <div className="glass-card rounded-xl p-3 text-center">
                  <div className="text-lg font-bold text-green-400">{sentCount}</div>
                  <div className="text-[10px] text-white/40">Отправлено</div>
                </div>
                <div className="glass-card rounded-xl p-3 text-center">
                  <div className="text-lg font-bold text-red-400">{errorCount}</div>
                  <div className="text-[10px] text-white/40">Ошибки</div>
                </div>
              </div>

              <div>
                <label className="text-xs text-white/50 mb-1 block">Steam ID для добавления</label>
                <textarea
                  value={steamIdsToAdd}
                  onChange={e => setSteamIdsToAdd(e.target.value)}
                  placeholder="76561198000000000&#10;76561198000000001&#10;..."
                  className="w-full glass-input text-xs text-white p-3 rounded-xl outline-none h-32 resize-none font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-white/50 mb-1 block">Запросов на аккаунт</label>
                  <input
                    type="number"
                    value={requestsPerAccount}
                    onChange={e => setRequestsPerAccount(Math.max(1, parseInt(e.target.value) || 10))}
                    min={1}
                    className="w-full glass-input text-sm text-white px-3 py-2 rounded-xl outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-white/50 mb-1 block">Задержка (сек)</label>
                  <input
                    type="number"
                    value={delaySeconds}
                    onChange={e => setDelaySeconds(Math.max(1, parseInt(e.target.value) || 5))}
                    min={1}
                    className="w-full glass-input text-sm text-white px-3 py-2 rounded-xl outline-none"
                  />
                </div>
              </div>

              <div className="flex gap-2">
                {!friendRequestRunning ? (
                  <button
                    onClick={() => startFriendRequests(parsedIds, requestsPerAccount, delaySeconds)}
                    disabled={onlineAccounts.length === 0 || parsedIds.length === 0}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl bg-green-500/20 text-green-400 text-sm hover:bg-green-500/30 transition-colors disabled:opacity-30"
                  >
                    <Play size={16} /> Запустить
                  </button>
                ) : (
                  <button
                    onClick={stopFriendRequests}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl bg-red-500/20 text-red-400 text-sm hover:bg-red-500/30 transition-colors"
                  >
                    <Square size={16} /> Остановить
                  </button>
                )}
              </div>

              {friendRequestLogs.length > 0 && (
                <div className="glass-card rounded-2xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-white/5">
                    <h3 className="text-sm font-semibold text-white">Логи</h3>
                  </div>
                  <div className="max-h-48 overflow-y-auto divide-y divide-white/5">
                    {[...friendRequestLogs].reverse().map(log => (
                      <div key={log.id} className="px-4 py-2 flex items-center gap-2">
                        {log.status === 'sent' ? (
                          <CheckCircle size={12} className="text-green-400 shrink-0" />
                        ) : (
                          <XCircle size={12} className="text-red-400 shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-white/60 truncate">
                            <span className="text-white/40">{log.accountLogin}</span>
                            {log.targetSteamId && ` → ${log.targetSteamId}`}
                            {log.error && ` — ${log.error}`}
                          </div>
                        </div>
                        <div className="text-[9px] text-white/20">
                          {new Date(log.timestamp).toLocaleTimeString('ru', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* NETWORK TAB */}
          {activeTab === 'network' && (
            <div className="space-y-4">
              <div>
                <label className="text-xs text-white/50 mb-1 block">
                  Целевые Steam ID (отправная точка)
                </label>
                <textarea
                  value={friendNetworkSteamIds}
                  onChange={e => setFriendNetworkSteamIds(e.target.value)}
                  placeholder="76561198000000000&#10;..."
                  className="w-full glass-input text-xs text-white p-3 rounded-xl outline-none h-24 resize-none font-mono"
                />
              </div>

              <div>
                <label className="text-xs text-white/50 mb-1 block">Глубина обхода</label>
                <input
                  type="number"
                  value={maxDepth}
                  onChange={e => setMaxDepth(Math.max(1, Math.min(5, parseInt(e.target.value) || 2)))}
                  min={1}
                  max={5}
                  className="w-full glass-input text-sm text-white px-3 py-2 rounded-xl outline-none"
                />
              </div>

              <div className="flex gap-2">
                {!friendCrawlerRunning ? (
                  <button
                    onClick={() => startFriendNetworkCrawler(parsedNetworkIds, maxDepth)}
                    disabled={onlineAccounts.length === 0 || parsedNetworkIds.length === 0}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl bg-purple-500/20 text-purple-400 text-sm hover:bg-purple-500/30 transition-colors disabled:opacity-30"
                  >
                    <Network size={16} /> Запустить краулер
                  </button>
                ) : (
                  <button
                    onClick={stopFriendNetworkCrawler}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl bg-red-500/20 text-red-400 text-sm hover:bg-red-500/30 transition-colors"
                  >
                    <Square size={16} /> Остановить
                  </button>
                )}
              </div>

              {friendCrawlerLogs.length > 0 && (
                <div className="glass-card rounded-2xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-white/5">
                    <h3 className="text-sm font-semibold text-white">Логи краулера</h3>
                  </div>
                  <div className="max-h-48 overflow-y-auto divide-y divide-white/5">
                    {[...friendCrawlerLogs].reverse().map(log => (
                      <div key={log.id} className="px-4 py-2 flex items-center gap-2">
                        {log.status === 'sent' ? (
                          <CheckCircle size={12} className="text-green-400 shrink-0" />
                        ) : (
                          <XCircle size={12} className="text-red-400 shrink-0" />
                        )}
                        <div className="flex-1 min-w-0 text-xs text-white/60 truncate">
                          {log.error || `${log.accountLogin} → ${log.targetSteamId}`}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
