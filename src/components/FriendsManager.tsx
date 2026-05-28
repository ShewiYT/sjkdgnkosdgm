import { useState, useEffect, useRef } from 'react';
import { Users, UserPlus, Search, RefreshCw, Play, Square, Loader2 } from 'lucide-react';
import { steamApi } from '../api';
import { useAppStore } from '../store';
import { NotificationTemplates, DiscordTemplates } from '../notifications';
import type { SteamAccount } from '../types';
import type { FriendData } from '../api';

interface FriendsManagerProps {
  accounts: SteamAccount[];
}

interface AddLog {
  accountLogin: string;
  steamId: string;
  status: 'sent' | 'error' | 'info';
  error?: string;
  timestamp: string;
}

export default function FriendsManager({ accounts }: FriendsManagerProps) {
  const { notify, notificationSettings } = useAppStore();

  // --- Friends list (left) ---
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [friends, setFriends] = useState<FriendData[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  // --- Mass add friends (right) ---
  const [steamIdsToAdd, setSteamIdsToAdd] = useState('');
  const [perAccount, setPerAccount] = useState(10);
  const [delayBetween, setDelayBetween] = useState(3);
  const [addingFriends, setAddingFriends] = useState(false);
  const [addLogs, setAddLogs] = useState<AddLog[]>([]);
  const [totalProgress, setTotalProgress] = useState({ sent: 0, failed: 0, total: 0, currentAcc: '' });
  const stopRef = useRef(false);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const onlineAccounts = accounts.filter(a => a.status === 'online' || a.status === 'in-game');

  // --- Friends list logic ---
  const loadFriends = async () => {
    if (!selectedAccountId) return;
    setLoading(true);
    const data = await steamApi.getFriends(selectedAccountId);
    setFriends(data);
    setLoading(false);
  };

  useEffect(() => {
    if (selectedAccountId) loadFriends();
  }, [selectedAccountId]);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [addLogs]);

  const filteredFriends = search
    ? friends.filter(f => f.name.toLowerCase().includes(search.toLowerCase()) || f.steamId.includes(search))
    : friends;

  const getStatusColor = (state: number) => {
    switch (state) {
      case 1: return 'bg-green-400';
      case 2: return 'bg-red-400';
      case 3: return 'bg-yellow-400';
      case 5: return 'bg-purple-400';
      case 6: return 'bg-blue-400';
      default: return 'bg-gray-500';
    }
  };

  const getStatusText = (state: number) => {
    switch (state) {
      case 1: return 'Онлайн';
      case 2: return 'Занят';
      case 3: return 'Отошёл';
      case 5: return 'Хочет обмен';
      case 6: return 'Хочет играть';
      default: return 'Оффлайн';
    }
  };

  // ========== MASS ADD FRIENDS ==========
  const startAddingFriends = async () => {
    const ids = steamIdsToAdd.trim().split(/[\n,\s]+/).filter(id => id.trim());
    if (ids.length === 0 || onlineAccounts.length === 0) return;

    stopRef.current = false;
    setAddingFriends(true);
    setAddLogs([]);
    setTotalProgress({ sent: 0, failed: 0, total: ids.length, currentAcc: '' });

    const log = (l: AddLog) => setAddLogs(prev => [...prev, l]);
    const now = () => new Date().toISOString();

    // Notify start
    if (notificationSettings.notifyFriendsStart) {
      notify(
        NotificationTemplates.friendsProcessStart(`${onlineAccounts.length} аккаунтов`, ids.length),
        DiscordTemplates.friendsProcessStart(`${onlineAccounts.length} аккаунтов`, ids.length)
      );
    }

    log({ accountLogin: 'СИСТЕМА', steamId: '', status: 'info',
      error: `Старт: ${ids.length} ID → ${onlineAccounts.length} аккаунтов, по ${perAccount} на аккаунт`,
      timestamp: now() });

    let sent = 0;
    let failed = 0;
    let idIndex = 0;

    // Iterate over accounts, each takes its chunk
    for (let accIdx = 0; accIdx < onlineAccounts.length && idIndex < ids.length; accIdx++) {
      if (stopRef.current) break;

      const acc = onlineAccounts[accIdx];
      const chunkStart = idIndex;
      const chunkEnd = Math.min(idIndex + perAccount, ids.length);
      const chunk = ids.slice(chunkStart, chunkEnd);

      log({ accountLogin: acc.login, steamId: '', status: 'info',
        error: `Аккаунт берёт ID #${chunkStart + 1}–#${chunkEnd} (${chunk.length} шт.)`,
        timestamp: now() });

      setTotalProgress(p => ({ ...p, currentAcc: acc.login }));

      for (let i = 0; i < chunk.length; i++) {
        if (stopRef.current) break;

        const steamId = chunk[i].trim();

        try {
          const res = await fetch('/api/steam/friends/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ accountId: acc.id, targetSteamId: steamId }),
          });
          const data = await res.json();

          if (data.success) {
            sent++;
            log({ accountLogin: acc.login, steamId, status: 'sent', timestamp: now() });
          } else {
            failed++;
            log({ accountLogin: acc.login, steamId, status: 'error', error: data.error || 'Ошибка', timestamp: now() });
          }
        } catch {
          failed++;
          log({ accountLogin: acc.login, steamId, status: 'error', error: 'Сеть', timestamp: now() });
        }

        setTotalProgress(p => ({ ...p, sent, failed }));

        // Delay
        if (i < chunk.length - 1 || (accIdx < onlineAccounts.length - 1 && idIndex + i + 1 < ids.length)) {
          await new Promise(r => setTimeout(r, delayBetween * 1000));
        }
      }

      idIndex = chunkEnd;
    }

    // If there are leftover IDs (more IDs than accounts * perAccount), wrap around
    if (idIndex < ids.length && !stopRef.current) {
      log({ accountLogin: 'СИСТЕМА', steamId: '', status: 'info',
        error: `Оставшиеся ID: ${ids.length - idIndex}. Распределяю по второму кругу...`,
        timestamp: now() });

      let accIdx2 = 0;
      while (idIndex < ids.length && !stopRef.current) {
        const acc = onlineAccounts[accIdx2 % onlineAccounts.length];
        const chunkStart = idIndex;
        const chunkEnd = Math.min(idIndex + perAccount, ids.length);
        const chunk = ids.slice(chunkStart, chunkEnd);

        log({ accountLogin: acc.login, steamId: '', status: 'info',
          error: `Доп. раунд: ID #${chunkStart + 1}–#${chunkEnd}`,
          timestamp: now() });

        setTotalProgress(p => ({ ...p, currentAcc: acc.login }));

        for (let i = 0; i < chunk.length; i++) {
          if (stopRef.current) break;
          const steamId = chunk[i].trim();

          try {
            const res = await fetch('/api/steam/friends/add', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ accountId: acc.id, targetSteamId: steamId }),
            });
            const data = await res.json();
            if (data.success) {
              sent++;
              log({ accountLogin: acc.login, steamId, status: 'sent', timestamp: now() });
            } else {
              failed++;
              log({ accountLogin: acc.login, steamId, status: 'error', error: data.error || 'Ошибка', timestamp: now() });
            }
          } catch {
            failed++;
            log({ accountLogin: acc.login, steamId, status: 'error', error: 'Сеть', timestamp: now() });
          }

          setTotalProgress(p => ({ ...p, sent, failed }));
          if (i < chunk.length - 1) {
            await new Promise(r => setTimeout(r, delayBetween * 1000));
          }
        }

        idIndex = chunkEnd;
        accIdx2++;
      }
    }

    setAddingFriends(false);
    setTotalProgress(p => ({ ...p, currentAcc: '' }));

    log({ accountLogin: 'СИСТЕМА', steamId: '', status: 'info',
      error: `Готово! Отправлено: ${sent}, ошибок: ${failed}`,
      timestamp: now() });

    // Notify end
    if (notificationSettings.notifyFriendsEnd) {
      notify(
        NotificationTemplates.friendsProcessEnd(`${onlineAccounts.length} акк.`, sent, 0),
        DiscordTemplates.friendsProcessEnd(`${onlineAccounts.length} акк.`, sent, 0)
      );
    }
  };

  const stopAdding = () => {
    stopRef.current = true;
  };

  // Calculate distribution preview
  const getDistributionPreview = () => {
    const ids = steamIdsToAdd.trim().split(/[\n,\s]+/).filter(id => id.trim());
    if (ids.length === 0 || onlineAccounts.length === 0) return null;

    const preview: { login: string; from: number; to: number; count: number }[] = [];
    let idx = 0;
    let round = 0;

    while (idx < ids.length) {
      for (let a = 0; a < onlineAccounts.length && idx < ids.length; a++) {
        const start = idx + 1;
        const count = Math.min(perAccount, ids.length - idx);
        const end = idx + count;
        preview.push({ login: onlineAccounts[a].login, from: start, to: end, count });
        idx += count;
      }
      round++;
      if (round > 20) break; // safety
    }

    return preview;
  };

  const distributionPreview = getDistributionPreview();

  return (
    <div className="p-6 space-y-6 animate-fade-in overflow-y-auto max-h-[calc(100vh-52px)]">
      <div>
        <h1 className="text-2xl font-semibold text-white flex items-center gap-2">
          <Users size={24} />
          Друзья
        </h1>
        <p className="text-sm text-white/40 mt-1">Просмотр друзей и массовое добавление со всех аккаунтов</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* ===== LEFT: Friends list (2 cols) ===== */}
        <div className="lg:col-span-2 space-y-4">
          <div className="glass-card rounded-2xl p-4 space-y-3">
            <h3 className="text-sm font-semibold text-white">Список друзей</h3>
            <div className="flex items-center gap-3">
              <select
                value={selectedAccountId}
                onChange={e => setSelectedAccountId(e.target.value)}
                className="flex-1 glass-input text-sm text-white px-3 py-2 rounded-xl outline-none bg-transparent"
              >
                <option value="" className="bg-gray-900">Выберите аккаунт</option>
                {onlineAccounts.map(acc => (
                  <option key={acc.id} value={acc.id} className="bg-gray-900">{acc.login}</option>
                ))}
              </select>
              <button onClick={loadFriends} disabled={!selectedAccountId || loading} className="p-2 rounded-xl bg-white/5 text-white/50 hover:text-white disabled:opacity-30">
                <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              </button>
            </div>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
              <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Поиск друзей..."
                className="w-full glass-input text-xs text-white pl-9 pr-3 py-2 rounded-xl outline-none" />
            </div>
          </div>

          <div className="text-xs text-white/30">{filteredFriends.length} друзей</div>

          <div className="space-y-1.5 max-h-[500px] overflow-y-auto pr-1">
            {filteredFriends.map(friend => (
              <div key={friend.steamId} className="glass-card rounded-xl p-2.5 flex items-center gap-2.5">
                <div className="relative shrink-0">
                  {friend.avatarUrl || friend.avatar ? (
                    <img src={friend.avatarUrl || friend.avatar} alt={friend.name}
                      className="w-9 h-9 rounded-full object-cover"
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white/40 text-sm">👤</div>
                  )}
                  <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#12121a] ${getStatusColor(friend.personaState)}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-white font-medium truncate">{friend.name}</div>
                  <div className="text-[10px] text-white/30">{getStatusText(friend.personaState)}</div>
                  {friend.gameName && <div className="text-[10px] text-purple-400/70 truncate">🎮 {friend.gameName}</div>}
                </div>
                <div className="text-[10px] text-white/15 font-mono" title={friend.steamId}>{friend.steamId.slice(-6)}</div>
              </div>
            ))}
            {friends.length === 0 && selectedAccountId && !loading && (
              <div className="text-center py-8 text-white/20 text-xs">
                <UserPlus size={32} className="mx-auto mb-2 opacity-30" />
                Нет друзей или не загружено
              </div>
            )}
          </div>
        </div>

        {/* ===== RIGHT: Mass add friends (3 cols) ===== */}
        <div className="lg:col-span-3 space-y-4">

          {/* Settings card */}
          <div className="glass-card rounded-2xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <UserPlus size={16} />
              Массовое добавление в друзья
            </h3>
            <p className="text-xs text-white/30">
              Steam ID автоматически распределяются по <b>всем онлайн аккаунтам</b>.
              Каждый аккаунт берёт свою порцию.
            </p>

            {/* Online accounts badge */}
            <div className="glass-card rounded-xl p-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center text-green-400 text-sm font-bold">
                {onlineAccounts.length}
              </div>
              <div>
                <div className="text-xs text-white">Онлайн аккаунтов</div>
                <div className="text-[10px] text-white/30 truncate max-w-[300px]">
                  {onlineAccounts.map(a => a.login).join(', ') || 'Нет онлайн аккаунтов'}
                </div>
              </div>
            </div>

            {/* Per account & delay */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-white/50 mb-1 block">Запросов на 1 аккаунт</label>
                <input type="number" value={perAccount}
                  onChange={e => setPerAccount(Math.max(1, Math.min(50, parseInt(e.target.value) || 1)))}
                  min={1} max={50}
                  className="w-full glass-input text-sm text-white px-3 py-2 rounded-xl outline-none"
                  disabled={addingFriends} />
                <div className="text-[10px] text-white/20 mt-0.5">от 1 до 50</div>
              </div>
              <div>
                <label className="text-xs text-white/50 mb-1 block">Задержка (сек)</label>
                <input type="number" value={delayBetween}
                  onChange={e => setDelayBetween(Math.max(1, Math.min(30, parseInt(e.target.value) || 1)))}
                  min={1} max={30}
                  className="w-full glass-input text-sm text-white px-3 py-2 rounded-xl outline-none"
                  disabled={addingFriends} />
                <div className="text-[10px] text-white/20 mt-0.5">между запросами</div>
              </div>
            </div>

            {/* Steam IDs textarea */}
            <div>
              <label className="text-xs text-white/50 mb-1 block">
                Steam ID для добавления
                {steamIdsToAdd.trim() && (
                  <span className="text-white/30 ml-2">
                    ({steamIdsToAdd.trim().split(/[\n,\s]+/).filter(id => id.trim()).length} шт.)
                  </span>
                )}
              </label>
              <textarea
                value={steamIdsToAdd}
                onChange={e => setSteamIdsToAdd(e.target.value)}
                placeholder={"76561198012345678\n76561198012345679\n76561198012345680\n..."}
                className="w-full glass-input text-xs text-white px-3 py-2 rounded-xl outline-none resize-none h-28 font-mono"
                disabled={addingFriends}
              />
            </div>

            {/* Distribution preview */}
            {distributionPreview && distributionPreview.length > 0 && !addingFriends && (
              <div className="glass-card rounded-xl p-3 space-y-1.5">
                <div className="text-[10px] text-white/40 font-medium">Распределение:</div>
                {distributionPreview.map((d, i) => (
                  <div key={i} className="flex items-center gap-2 text-[10px]">
                    <span className="text-indigo-400 font-medium w-24 truncate">{d.login}</span>
                    <span className="text-white/30">→</span>
                    <span className="text-white/50">ID #{d.from}–#{d.to}</span>
                    <span className="text-white/20">({d.count} шт.)</span>
                  </div>
                ))}
              </div>
            )}

            {/* Buttons */}
            <div className="flex gap-2">
              {!addingFriends ? (
                <button
                  onClick={startAddingFriends}
                  disabled={!steamIdsToAdd.trim() || onlineAccounts.length === 0}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-30"
                >
                  <Play size={14} />
                  Запустить ({onlineAccounts.length} акк.)
                </button>
              ) : (
                <button
                  onClick={stopAdding}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-red-500/20 text-red-400 font-medium text-sm hover:bg-red-500/30 transition-colors"
                >
                  <Square size={14} />
                  Остановить
                </button>
              )}
            </div>
          </div>

          {/* Progress */}
          {totalProgress.total > 0 && (
            <div className="glass-card rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs text-white/50">Прогресс</h4>
                {totalProgress.currentAcc && (
                  <span className="text-[10px] text-indigo-400 flex items-center gap-1">
                    <Loader2 size={10} className="animate-spin" />
                    {totalProgress.currentAcc}
                  </span>
                )}
              </div>
              <div className="w-full h-2 rounded-full bg-white/5">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-500"
                  style={{ width: `${((totalProgress.sent + totalProgress.failed) / totalProgress.total) * 100}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px]">
                <span className="text-green-400">✓ Отправлено: {totalProgress.sent}</span>
                <span className="text-red-400">✗ Ошибок: {totalProgress.failed}</span>
                <span className="text-white/30">Всего: {totalProgress.total}</span>
              </div>
            </div>
          )}

          {/* Logs */}
          {addLogs.length > 0 && (
            <div className="glass-card rounded-2xl p-4">
              <h4 className="text-xs text-white/50 mb-2">Лог ({addLogs.length})</h4>
              <div className="max-h-56 overflow-y-auto space-y-0.5 font-mono">
                {addLogs.map((log, i) => (
                  <div key={i} className={`flex items-start gap-2 text-[10px] py-0.5 ${
                    log.status === 'info' ? 'text-blue-400/70' :
                    log.status === 'sent' ? 'text-white/50' : 'text-red-400/70'
                  }`}>
                    <span className="shrink-0 w-1.5 h-1.5 rounded-full mt-1 ${
                      log.status === 'info' ? 'bg-blue-400' :
                      log.status === 'sent' ? 'bg-green-400' : 'bg-red-400'
                    }" style={{
                      backgroundColor: log.status === 'info' ? '#60a5fa' : log.status === 'sent' ? '#4ade80' : '#f87171'
                    }} />
                    <span className="text-indigo-400/70 shrink-0 w-20 truncate">{log.accountLogin}</span>
                    {log.steamId && <span className="text-white/20 shrink-0">{log.steamId.slice(-8)}</span>}
                    {log.status === 'sent' && <span className="text-green-400">✓</span>}
                    {log.error && <span className="text-white/30">{log.error}</span>}
                  </div>
                ))}
                <div ref={logsEndRef} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
