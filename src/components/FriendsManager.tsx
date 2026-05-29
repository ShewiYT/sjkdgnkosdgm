import { useState, useEffect } from 'react';
import { Users, Search, UserPlus, Play, Square } from 'lucide-react';
import { steamApi } from '../api';
import type { SteamAccount } from '../types';

interface FriendsManagerProps {
  accounts: SteamAccount[];
}

interface FriendData {
  steamId: string;
  name: string;
  avatarUrl?: string;
  avatar?: string;
  personaState: number;
  gameName?: string;
}

export default function FriendsManager({ accounts }: FriendsManagerProps) {
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [friends, setFriends] = useState<FriendData[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  
  // Mass add
  const [steamIdsToAdd, setSteamIdsToAdd] = useState('');
  const [perAccount, setPerAccount] = useState(10);
  const [delayBetween, setDelayBetween] = useState(5);
  const [addingFriends, setAddingFriends] = useState(false);
  const [addLogs, setAddLogs] = useState<string[]>([]);

  const onlineAccounts = accounts.filter(a => a.status === 'online' || a.status === 'in-game');

  useEffect(() => {
    if (selectedAccountId) {
      loadFriends();
    }
  }, [selectedAccountId]);

  const loadFriends = async () => {
    if (!selectedAccountId) return;
    setLoading(true);
    const data = await steamApi.getFriends(selectedAccountId);
    setFriends(data);
    setLoading(false);
  };

  const filteredFriends = search
    ? friends.filter(f => f.name.toLowerCase().includes(search.toLowerCase()))
    : friends;

  const getStatusText = (state: number) => {
    switch (state) {
      case 1: return 'Онлайн';
      case 2: return 'Занят';
      case 3: return 'Отошёл';
      case 4: return 'Спит';
      case 5: return 'В игре';
      case 6: return 'Хочет играть';
      default: return 'Оффлайн';
    }
  };

  const startMassAdd = async () => {
    const ids = steamIdsToAdd.split(/[\n,\s]+/).filter(id => /^\d{17}$/.test(id.trim()));
    if (ids.length === 0) {
      setAddLogs(['Нет валидных Steam ID']);
      return;
    }
    
    setAddingFriends(true);
    setAddLogs([`Начинаем добавление ${ids.length} друзей...`]);
    setAddLogs(prev => [...prev, `Онлайн аккаунтов: ${onlineAccounts.length}`]);
    
    // Simulate
    for (let i = 0; i < Math.min(ids.length, onlineAccounts.length * perAccount); i++) {
      await new Promise(r => setTimeout(r, delayBetween * 1000));
      const acc = onlineAccounts[i % onlineAccounts.length];
      setAddLogs(prev => [...prev, `[${acc.login}] Добавлен ${ids[i]}`]);
    }
    
    setAddingFriends(false);
    setAddLogs(prev => [...prev, 'Готово!']);
  };

  return (
    <div className="p-6 h-full flex gap-6">
      {/* Friends list */}
      <div className="w-1/2 flex flex-col">
        <div className="mb-4">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-400" />
            Список друзей
          </h2>
          
          <select
            value={selectedAccountId}
            onChange={e => setSelectedAccountId(e.target.value)}
            className="mt-2 w-full glass-input text-sm text-white px-3 py-2 rounded-xl outline-none bg-transparent"
          >
            <option value="" className="bg-dark-800">Выберите аккаунт</option>
            {onlineAccounts.map(acc => (
              <option key={acc.id} value={acc.id} className="bg-dark-800">
                {acc.login} ({acc.friendsCount} друзей)
              </option>
            ))}
          </select>

          <div className="relative mt-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Поиск друзей..."
              className="w-full glass-input text-xs text-white pl-9 pr-3 py-2 rounded-xl outline-none"
            />
          </div>
        </div>

        <div className="text-xs text-white/30 mb-2">{filteredFriends.length} друзей</div>

        <div className="flex-1 overflow-y-auto space-y-1">
          {loading ? (
            <div className="text-center py-8 text-white/30">Загрузка...</div>
          ) : filteredFriends.length === 0 ? (
            <div className="text-center py-8">
              <Users className="w-8 h-8 mx-auto mb-2 text-white/10" />
              <div className="text-xs text-white/30">Нет друзей</div>
            </div>
          ) : (
            filteredFriends.map(friend => (
              <div key={friend.steamId} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5">
                <div className="relative">
                  {friend.avatarUrl ? (
                    <img src={friend.avatarUrl} className="w-8 h-8 rounded-full" alt="" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-sm">👤</div>
                  )}
                  <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-dark-800 ${
                    friend.personaState > 0 ? 'bg-green-400' : 'bg-gray-500'
                  }`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-white truncate">{friend.name}</div>
                  <div className="text-[10px] text-white/30">{getStatusText(friend.personaState)}</div>
                  {friend.gameName && (
                    <div className="text-[10px] text-green-400/70">🎮 {friend.gameName}</div>
                  )}
                </div>
                <div className="text-[10px] text-white/20">{friend.steamId.slice(-6)}</div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Mass add */}
      <div className="w-1/2 space-y-4">
        <div className="glass-card rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-green-400" />
            Массовое добавление
          </h3>

          <div className="flex items-center gap-3 p-3 rounded-lg bg-white/5">
            <div className="text-lg font-bold text-green-400">{onlineAccounts.length}</div>
            <div className="text-xs text-white/50">
              <div>Онлайн аккаунтов</div>
              <div className="text-white/30 truncate">{onlineAccounts.map(a => a.login).join(', ') || 'Нет'}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-white/40 text-xs mb-1 block">На 1 аккаунт</label>
              <input
                type="number"
                value={perAccount}
                onChange={e => setPerAccount(Math.max(1, Math.min(50, parseInt(e.target.value) || 1)))}
                min={1} max={50}
                className="w-full glass-input text-sm text-white px-3 py-2 rounded-xl outline-none"
                disabled={addingFriends}
              />
            </div>
            <div>
              <label className="text-white/40 text-xs mb-1 block">Задержка (сек)</label>
              <input
                type="number"
                value={delayBetween}
                onChange={e => setDelayBetween(Math.max(1, Math.min(30, parseInt(e.target.value) || 1)))}
                min={1} max={30}
                className="w-full glass-input text-sm text-white px-3 py-2 rounded-xl outline-none"
                disabled={addingFriends}
              />
            </div>
          </div>

          <div>
            <label className="text-white/40 text-xs mb-1 block">
              Steam ID для добавления
              {steamIdsToAdd.trim() && (
                <span className="text-white/30 ml-2">
                  ({steamIdsToAdd.split(/[\n,\s]+/).filter(id => id.trim()).length} шт)
                </span>
              )}
            </label>
            <textarea
              value={steamIdsToAdd}
              onChange={e => setSteamIdsToAdd(e.target.value)}
              className="w-full glass-input text-xs text-white p-3 rounded-xl outline-none h-24 resize-none font-mono"
              placeholder="76561198012345678&#10;76561198087654321&#10;..."
              disabled={addingFriends}
            />
          </div>

          <div>
            {!addingFriends ? (
              <button
                onClick={startMassAdd}
                disabled={onlineAccounts.length === 0 || !steamIdsToAdd.trim()}
                className="w-full glass-btn py-2.5 rounded-xl text-sm flex items-center justify-center gap-2 disabled:opacity-30"
              >
                <Play className="w-4 h-4" /> Начать добавление
              </button>
            ) : (
              <button
                onClick={() => setAddingFriends(false)}
                className="w-full py-2.5 rounded-xl text-sm flex items-center justify-center gap-2 bg-red-500/20 text-red-400"
              >
                <Square className="w-4 h-4" /> Остановить
              </button>
            )}
          </div>
        </div>

        {/* Logs */}
        <div className="glass-card rounded-xl p-5 space-y-2">
          <h3 className="text-sm font-semibold">Лог</h3>
          <div className="h-40 overflow-y-auto text-xs font-mono space-y-1 bg-black/20 rounded-lg p-3">
            {addLogs.length === 0 ? (
              <div className="text-white/20">Логи появятся здесь...</div>
            ) : (
              addLogs.map((log, i) => (
                <div key={i} className="text-white/50">{log}</div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
