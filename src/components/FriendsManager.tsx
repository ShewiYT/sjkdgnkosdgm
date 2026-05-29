import { useState, useEffect } from 'react';
import { Users, Search, Play, Square, CheckCircle, XCircle, UserPlus, Trash2 } from 'lucide-react';
import { useAppStore } from '../store';
import { steamApi, type FriendData } from '../api';
import type { SteamAccount } from '../types';

interface FriendsManagerProps {
  accounts: SteamAccount[];
  selectedAccount: SteamAccount | null;
}

export default function FriendsManager({ accounts, selectedAccount }: FriendsManagerProps) {
  const {
    friendRequestRunning, friendRequestLogs,
    startFriendRequests, stopFriendRequests,
    steamIdsToAdd, setSteamIdsToAdd
  } = useAppStore();

  const [friends, setFriends] = useState<FriendData[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [requestsPerAccount, setRequestsPerAccount] = useState(20);
  const [delaySeconds, setDelaySeconds] = useState(3);

  const onlineAccounts = accounts.filter(a => a.status === 'online' || a.status === 'in-game');
  const activeAccount = selectedAccount || onlineAccounts[0];

  // Load friends for selected account
  useEffect(() => {
    if (!activeAccount || activeAccount.status === 'offline') {
      setFriends([]);
      return;
    }
    setLoading(true);
    steamApi.getFriends(activeAccount.id).then(data => {
      setFriends(data);
      setLoading(false);
    });
  }, [activeAccount?.id]);

  const filteredFriends = friends.filter(f =>
    !search || f.name?.toLowerCase().includes(search.toLowerCase()) || f.steamId.includes(search)
  );

  const getStatusText = (state: number) => {
    switch (state) {
      case 1: return 'Онлайн';
      case 2: return 'Не беспокоить';
      case 3: return 'Отошёл';
      case 4: return 'Уснул';
      case 5: return 'Хочет торговать';
      case 6: return 'Хочет играть';
      default: return 'Оффлайн';
    }
  };

  // Parse Steam IDs from text
  const parsedIds = steamIdsToAdd
    .split(/[\n,\s]+/)
    .map(id => id.trim())
    .filter(id => id.length > 0 && /^[0-9]+$/.test(id));

  const recentLogs = [...friendRequestLogs].reverse().slice(0, 100);
  const sentCount = friendRequestLogs.filter(l => l.status === 'sent' && l.targetSteamId).length;
  const errorCount = friendRequestLogs.filter(l => l.status === 'error' && l.targetSteamId).length;

  const handleStart = () => {
    if (parsedIds.length === 0 || onlineAccounts.length === 0) return;
    startFriendRequests(parsedIds, requestsPerAccount, delaySeconds);
  };

  return (
    <div className="flex h-[calc(100vh-52px)]">
      {/* Friends list */}
      <div className="w-80 border-r border-white/5 flex flex-col bg-dark-800/30">
        <div className="p-3 border-b border-white/5 space-y-2">
          <div className="flex items-center gap-2">
            <Users size={16} className="text-indigo-400" />
            <span className="text-sm font-semibold">Список друзей</span>
          </div>
          {activeAccount && (
            <div className="text-[10px] text-white/30">Аккаунт: {activeAccount.login}</div>
          )}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-white/30" />
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
            <div className="p-4 text-center text-xs text-white/30">Загрузка...</div>
          ) : filteredFriends.length === 0 ? (
            <div className="p-4 text-center">
              <Users size={32} className="mx-auto mb-2 text-white/10" />
              <div className="text-xs text-white/30">Нет друзей</div>
            </div>
          ) : (
            filteredFriends.map(friend => (
              <div key={friend.steamId} className="px-3 py-2 flex items-center gap-2 hover:bg-white/5 border-b border-white/5">
                <div className="relative shrink-0">
                  {friend.avatarUrl && friend.avatarUrl.includes('http') ? (
                    <img src={friend.avatarUrl} alt="" className="w-8 h-8 rounded-full bg-white/10" />
                  ) : (
                    <span className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs">👤</span>
                  )}
                  <span className={`absolute bottom-0 right-0 w-2 h-2 rounded-full border border-dark-800 ${
                    friend.personaState > 0 ? 'bg-green-400' : 'bg-gray-500'
                  }`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-white truncate">{friend.name}</div>
                  <div className="text-[10px] text-white/30">{getStatusText(friend.personaState)}</div>
                  {friend.gameName && (
                    <div className="text-[10px] text-green-400 truncate">🎮 {friend.gameName}</div>
                  )}
                </div>
                <div className="text-[9px] text-white/20 font-mono">{friend.steamId.slice(-8)}</div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Add friends panel */}
      <div className="flex-1 p-6 overflow-y-auto space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <UserPlus size={20} />
            Массовое добавление в друзья
          </h2>
          <p className="text-sm text-white/40 mt-1">
            Загрузите список Steam ID и аккаунты отправят им запросы в друзья
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="glass-card rounded-xl p-3 text-center">
            <div className="text-lg font-bold text-white">{onlineAccounts.length}</div>
            <div className="text-[10px] text-white/40">Онлайн аккаунтов</div>
          </div>
          <div className="glass-card rounded-xl p-3 text-center">
            <div className="text-lg font-bold text-indigo-400">{parsedIds.length}</div>
            <div className="text-[10px] text-white/40">Steam ID в списке</div>
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Steam IDs input */}
          <div className="glass-card rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Steam ID для добавления</h3>
              {parsedIds.length > 0 && (
                <span className="text-xs text-indigo-400">{parsedIds.length} ID</span>
              )}
            </div>
            <textarea
              value={steamIdsToAdd}
              onChange={e => setSteamIdsToAdd(e.target.value)}
              disabled={friendRequestRunning}
              placeholder={"76561198123456789\n76561198987654321\n76561198111222333\n..."}
              className="w-full glass-input text-xs text-white p-3 rounded-xl outline-none h-48 resize-none font-mono disabled:opacity-50"
            />
            <div className="flex items-center justify-between">
              <div className="text-[10px] text-white/30">
                Один Steam ID на строку (64-bit SteamID)
              </div>
              <button
                onClick={() => setSteamIdsToAdd('')}
                disabled={friendRequestRunning || !steamIdsToAdd}
                className="text-xs text-red-400/60 hover:text-red-400 disabled:opacity-30"
              >
                <Trash2 size={12} />
              </button>
            </div>
          </div>

          {/* Settings */}
          <div className="space-y-4">
            <div className="glass-card rounded-2xl p-4 space-y-3">
              <h3 className="text-sm font-semibold text-white">Настройки</h3>
              
              <div>
                <label className="text-xs text-white/50 mb-1 block">
                  Запросов на 1 аккаунт (макс)
                </label>
                <input
                  type="number"
                  value={requestsPerAccount}
                  onChange={e => setRequestsPerAccount(Math.max(1, Math.min(50, parseInt(e.target.value) || 20)))}
                  disabled={friendRequestRunning}
                  min={1}
                  max={50}
                  className="w-full glass-input text-sm text-white px-3 py-2 rounded-xl outline-none disabled:opacity-50"
                />
              </div>

              <div>
                <label className="text-xs text-white/50 mb-1 block">
                  Задержка между запросами (сек)
                </label>
                <input
                  type="number"
                  value={delaySeconds}
                  onChange={e => setDelaySeconds(Math.max(1, Math.min(30, parseInt(e.target.value) || 3)))}
                  disabled={friendRequestRunning}
                  min={1}
                  max={30}
                  className="w-full glass-input text-sm text-white px-3 py-2 rounded-xl outline-none disabled:opacity-50"
                />
              </div>

              <div className="text-[10px] text-white/30 space-y-1">
                <div>• Всего запросов: {Math.min(parsedIds.length, onlineAccounts.length * requestsPerAccount)}</div>
                <div>• Примерное время: ~{Math.ceil((Math.min(parsedIds.length, onlineAccounts.length * requestsPerAccount) * delaySeconds) / 60)} мин</div>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-4">
              {!friendRequestRunning ? (
                <button
                  onClick={handleStart}
                  disabled={onlineAccounts.length === 0 || parsedIds.length === 0}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl bg-green-500/20 text-green-400 text-sm hover:bg-green-500/30 transition-colors disabled:opacity-30"
                >
                  <Play size={16} />
                  Запустить добавление
                </button>
              ) : (
                <button
                  onClick={stopFriendRequests}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl bg-red-500/20 text-red-400 text-sm hover:bg-red-500/30 transition-colors"
                >
                  <Square size={16} />
                  Остановить
                </button>
              )}

              {friendRequestRunning && (
                <div className="flex items-center gap-2 text-xs text-yellow-400">
                  <div className="w-3 h-3 border-2 border-yellow-400/30 border-t-yellow-400 rounded-full animate-spin" />
                  Отправка запросов...
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Logs */}
        <div className="glass-card rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Логи ({friendRequestLogs.length})</h3>
            {friendRequestLogs.length > 0 && (
              <div className="text-[10px] text-white/30">
                ✓ {sentCount} отправлено • ✗ {errorCount} ошибок
              </div>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto divide-y divide-white/5">
            {recentLogs.length === 0 ? (
              <div className="p-8 text-center text-xs text-white/30">
                Нет логов. Добавьте Steam ID и запустите добавление.
              </div>
            ) : (
              recentLogs.map(log => (
                <div key={log.id} className="px-4 py-2 flex items-center gap-2">
                  {log.status === 'sent' ? (
                    <CheckCircle size={12} className="text-green-400 shrink-0" />
                  ) : (
                    <XCircle size={12} className="text-red-400 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-white truncate">
                      <span className="text-white/50">{log.accountLogin}</span>
                      {log.targetSteamId && (
                        <>
                          {' → '}
                          <span className="font-mono">{log.targetSteamId}</span>
                        </>
                      )}
                    </div>
                    {log.error && <div className="text-[10px] text-red-400/80">{log.error}</div>}
                  </div>
                  <div className="text-[9px] text-white/20 shrink-0">
                    {new Date(log.timestamp).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
