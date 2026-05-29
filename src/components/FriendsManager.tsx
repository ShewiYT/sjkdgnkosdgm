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

export default function FriendsManager({ accounts, selectedAccount }: FriendsManagerProps) {
  const {
    steamIdsToAdd,
    setSteamIdsToAdd,
    friendRequestLogs,
    friendRequestRunning,
    startFriendRequests,
    stopFriendRequests,
    // ── NEW: network crawler ──
    friendNetworkSteamIds,
    setFriendNetworkSteamIds,
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
  const [crawlerDepth, setCrawlerDepth] = useState(3);
  const [activeTab, setActiveTab] = useState<'manual' | 'network'>('manual');

  const onlineAccounts = accounts.filter(a => a.status === 'online' || a.status === 'in-game');
  const activeAccount = selectedAccount || onlineAccounts[0];

  useEffect(() => {
    if (!activeAccount || activeAccount.status === 'offline') return;
    setLoading(true);
    steamApi.getFriends(activeAccount.id).then(f => {
      setFriends(f);
      setLoading(false);
    });
  }, [activeAccount?.id]);

  const filteredFriends = friends.filter(
    f =>
      (f.name || '').toLowerCase().includes(search.toLowerCase()) ||
      f.steamId.includes(search)
  );

  const parsedIds = steamIdsToAdd
    .split(/[\n,\s]+/)
    .filter(id => id.trim() && /^[0-9]+$/.test(id.trim()));

  const parsedNetworkIds = friendNetworkSteamIds
    .split(/[\n,\s]+/)
    .filter(id => id.trim() && /^[0-9]+$/.test(id.trim()));

  const sentCount = friendRequestLogs.filter(l => l.status === 'sent' && l.targetSteamId).length;
  const errorCount = friendRequestLogs.filter(l => l.status === 'error' && l.targetSteamId).length;

  const crawlerSent = friendCrawlerLogs.filter(l => l.status === 'sent' && l.targetSteamId).length;
  const crawlerErrors = friendCrawlerLogs.filter(l => l.status === 'error' && l.targetSteamId).length;

  const handleStart = () => {
    if (parsedIds.length === 0 || onlineAccounts.length === 0) return;
    startFriendRequests(parsedIds, requestsPerAccount, delaySeconds);
  };

  const handleCrawlerStart = () => {
    if (parsedNetworkIds.length === 0 || onlineAccounts.length === 0) return;
    startFriendNetworkCrawler(parsedNetworkIds, crawlerDepth);
  };

  const getStatusText = (state: number) => {
    switch (state) {
      case 1: return 'Онлайн';
      case 2: return 'Занят';
      case 3: return 'Отошёл';
      case 4: return 'Спит';
      case 5: return 'Готов к обмену';
      case 6: return 'Хочет играть';
      default: return 'Оффлайн';
    }
  };

  return (
    <div className="flex h-[calc(100vh-52px)]">
      {/* Friends list */}
      <div className="w-72 border-r border-white/5 flex flex-col">
        <div className="p-3 border-b border-white/5 space-y-2">
          <div className="flex items-center gap-2">
            <Users size={16} className="text-purple-400" />
            <span className="text-sm font-semibold text-white">Список друзей</span>
          </div>
          {activeAccount && (
            <div className="text-[10px] text-white/30">Аккаунт: {activeAccount.login}</div>
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

        <div className="text-[10px] text-white/30 px-3 py-1">{filteredFriends.length} друзей</div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="text-center p-8 text-xs text-white/30">Загрузка...</div>
          ) : filteredFriends.length === 0 ? (
            <div className="text-center p-8 text-xs text-white/30">
              <Users size={24} className="mx-auto mb-2 opacity-30" />
              Нет друзей
            </div>
          ) : (
            filteredFriends.map(friend => (
              <div
                key={friend.steamId}
                className="flex items-center gap-2 px-3 py-2 hover:bg-white/5 transition-colors"
              >
                <div className="relative">
                  {friend.avatarUrl && friend.avatarUrl.includes('http') ? (
                    <img src={friend.avatarUrl} alt="" className="w-8 h-8 rounded-full" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-sm">
                      👤
                    </div>
                  )}
                  <div
                    className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-dark-800 ${
                      friend.personaState > 0 ? 'bg-green-400' : 'bg-gray-500'
                    }`}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs text-white truncate">{friend.name}</div>
                  <div className="text-[10px] text-white/30">{getStatusText(friend.personaState)}</div>
                </div>
                <div className="text-[9px] text-white/20">{friend.steamId.slice(-8)}</div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 p-6 overflow-y-auto space-y-6">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Users size={20} className="text-purple-400" />
            Управление друзьями
          </h2>
          <p className="text-xs text-white/40 mt-1">
            Добавление в друзья через список или сеть друзей-друзей
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('manual')}
            className={`px-4 py-2 rounded-xl text-sm transition-colors ${
              activeTab === 'manual'
                ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                : 'bg-white/5 text-white/40 hover:bg-white/10'
            }`}
          >
            <Users size={14} className="inline mr-2" />
            Ручное добавление
          </button>
          <button
            onClick={() => setActiveTab('network')}
            className={`px-4 py-2 rounded-xl text-sm transition-colors ${
              activeTab === 'network'
                ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                : 'bg-white/5 text-white/40 hover:bg-white/10'
            }`}
          >
            <Network size={14} className="inline mr-2" />
            Сеть друзей
          </button>
        </div>

        {/* MANUAL TAB */}
        {activeTab === 'manual' && (
          <div className="space-y-6">
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-white/50 mb-1 block">Steam ID для добавления</label>
                  <textarea
                    value={steamIdsToAdd}
                    onChange={e => setSteamIdsToAdd(e.target.value)}
                    disabled={friendRequestRunning}
                    placeholder={"76561198000000000\n76561198000000001\n..."}
                    className="w-full glass-input text-xs text-white p-3 rounded-xl outline-none h-40 resize-none font-mono"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-white/50 mb-1 block">Запросов на аккаунт</label>
                    <input
                      type="number"
                      value={requestsPerAccount}
                      onChange={e => setRequestsPerAccount(parseInt(e.target.value) || 10)}
                      disabled={friendRequestRunning}
                      className="w-full glass-input text-sm text-white px-3 py-2 rounded-xl outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-white/50 mb-1 block">Задержка (сек)</label>
                    <input
                      type="number"
                      value={delaySeconds}
                      onChange={e => setDelaySeconds(parseInt(e.target.value) || 5)}
                      disabled={friendRequestRunning}
                      className="w-full glass-input text-sm text-white px-3 py-2 rounded-xl outline-none"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  {!friendRequestRunning ? (
                    <button
                      onClick={handleStart}
                      disabled={parsedIds.length === 0 || onlineAccounts.length === 0}
                      className="flex items-center gap-2 px-6 py-3 rounded-xl bg-green-500/20 text-green-400 text-sm hover:bg-green-500/30 disabled:opacity-30 transition-colors"
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
              </div>

              {/* Logs */}
              <div className="glass-card rounded-2xl overflow-hidden">
                <div className="px-4 py-3 border-b border-white/5">
                  <h3 className="text-sm font-semibold text-white">Логи</h3>
                </div>
                <div className="max-h-64 overflow-y-auto divide-y divide-white/5">
                  {friendRequestLogs.length === 0 ? (
                    <div className="p-8 text-center text-xs text-white/30">Нет логов</div>
                  ) : (
                    [...friendRequestLogs].reverse().map(log => (
                      <div key={log.id} className="px-3 py-2 flex items-start gap-2">
                        {log.status === 'sent' ? (
                          <CheckCircle size={12} className="text-green-400 shrink-0 mt-0.5" />
                        ) : (
                          <XCircle size={12} className="text-red-400 shrink-0 mt-0.5" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-white/60 truncate">
                            {log.accountLogin} → {log.targetSteamId || '—'}
                          </div>
                          {log.error && (
                            <div className="text-[10px] text-white/30">{log.error}</div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* NETWORK TAB */}
        {activeTab === 'network' && (
          <div className="space-y-6">
            <div className="flex items-start gap-3 p-4 rounded-xl bg-purple-500/10 border border-purple-500/20">
              <Network size={16} className="text-purple-400 mt-0.5 shrink-0" />
              <div className="text-xs text-purple-300/80">
                <strong>Сеть друзей:</strong> Введите целевые Steam ID. Каждый подключённый аккаунт
                будет отправлять запросы этим профилям, их друзьям, друзьям друзей и т.д.
                Это увеличивает количество друзей на всех аккаунтах через расширение сети.
              </div>
            </div>

            <div className="grid grid-cols-4 gap-3">
              <div className="glass-card rounded-xl p-3 text-center">
                <div className="text-lg font-bold text-indigo-400">{onlineAccounts.length}</div>
                <div className="text-[10px] text-white/40">Онлайн аккаунтов</div>
              </div>
              <div className="glass-card rounded-xl p-3 text-center">
                <div className="text-lg font-bold text-purple-400">{parsedNetworkIds.length}</div>
                <div className="text-[10px] text-white/40">Цел. Steam ID</div>
              </div>
              <div className="glass-card rounded-xl p-3 text-center">
                <div className="text-lg font-bold text-green-400">{crawlerSent}</div>
                <div className="text-[10px] text-white/40">Отправлено</div>
              </div>
              <div className="glass-card rounded-xl p-3 text-center">
                <div className="text-lg font-bold text-red-400">{crawlerErrors}</div>
                <div className="text-[10px] text-white/40">Ошибки</div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-white/50 mb-1 block">
                    Целевые Steam ID (начальные точки сети)
                  </label>
                  <textarea
                    value={friendNetworkSteamIds}
                    onChange={e => setFriendNetworkSteamIds(e.target.value)}
                    disabled={friendCrawlerRunning}
                    placeholder={"76561198000000000\n76561198000000001\n..."}
                    className="w-full glass-input text-xs text-white p-3 rounded-xl outline-none h-40 resize-none font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs text-white/50 mb-1 block">
                    Глубина обхода (1 = только указанные, 2 = + их друзья, 3 = + друзья друзей)
                  </label>
                  <input
                    type="number"
                    value={crawlerDepth}
                    min={1}
                    max={5}
                    onChange={e => setCrawlerDepth(Math.min(5, Math.max(1, parseInt(e.target.value) || 2)))}
                    disabled={friendCrawlerRunning}
                    className="w-full glass-input text-sm text-white px-3 py-2 rounded-xl outline-none"
                  />
                </div>
                <div className="flex gap-2">
                  {!friendCrawlerRunning ? (
                    <button
                      onClick={handleCrawlerStart}
                      disabled={parsedNetworkIds.length === 0 || onlineAccounts.length === 0}
                      className="flex items-center gap-2 px-6 py-3 rounded-xl bg-purple-500/20 text-purple-400 text-sm hover:bg-purple-500/30 disabled:opacity-30 transition-colors"
                    >
                      <Play size={16} /> Запустить краулер
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
              </div>

              {/* Crawler logs */}
              <div className="glass-card rounded-2xl overflow-hidden">
                <div className="px-4 py-3 border-b border-white/5">
                  <h3 className="text-sm font-semibold text-white">Логи краулера</h3>
                </div>
                <div className="max-h-64 overflow-y-auto divide-y divide-white/5">
                  {friendCrawlerLogs.length === 0 ? (
                    <div className="p-8 text-center text-xs text-white/30">Нет логов</div>
                  ) : (
                    [...friendCrawlerLogs].reverse().map(log => (
                      <div key={log.id} className="px-3 py-2 flex items-start gap-2">
                        {log.status === 'sent' ? (
                          <CheckCircle size={12} className="text-green-400 shrink-0 mt-0.5" />
                        ) : (
                          <XCircle size={12} className="text-red-400 shrink-0 mt-0.5" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-white/60 truncate">
                            {log.accountLogin} → {log.targetSteamId || '—'}
                          </div>
                          {log.error && (
                            <div className="text-[10px] text-white/30">{log.error}</div>
                          )}
                        </div>
                        <div className="text-[9px] text-white/20 shrink-0">
                          {new Date(log.timestamp).toLocaleTimeString('ru', {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
