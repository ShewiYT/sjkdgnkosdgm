import { useState } from 'react';
import { Users, Play, Square, CheckCircle, XCircle } from 'lucide-react';
import { useAppStore } from '../store';
import type { SteamAccount } from '../types';

interface FriendsManagerProps {
  accounts: SteamAccount[];
}

export default function FriendsManager({ accounts }: FriendsManagerProps) {
  const {
    steamIdsToAdd, setSteamIdsToAdd,
    friendRequestRunning, friendRequestLogs,
    startFriendRequests, stopFriendRequests,
  } = useAppStore();
  const [requestsPerAccount, setRequestsPerAccount] = useState(5);
  const [delaySeconds, setDelaySeconds] = useState(3);

  const onlineAccounts = accounts.filter(a => a.status === 'online' || a.status === 'in-game');
  const parsedIds = steamIdsToAdd.split('\n').filter(id => id.trim());
  const sentCount = friendRequestLogs.filter(l => l.status === 'sent' && l.accountId !== 'system').length;
  const errorCount = friendRequestLogs.filter(l => l.status === 'error' && l.accountId !== 'system').length;

  const handleStart = () => {
    startFriendRequests(parsedIds, requestsPerAccount, delaySeconds);
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in overflow-y-auto max-h-[calc(100vh-52px)]">
      <div>
        <h1 className="text-2xl font-semibold text-white flex items-center gap-2"><Users size={24} /> Друзья</h1>
        <p className="text-sm text-white/40 mt-1">Массовое добавление в друзья</p>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <div className="glass-card rounded-xl p-3 text-center"><div className="text-lg font-bold text-green-400">{onlineAccounts.length}</div><div className="text-[10px] text-white/40">Онлайн аккаунтов</div></div>
        <div className="glass-card rounded-xl p-3 text-center"><div className="text-lg font-bold text-blue-400">{parsedIds.length}</div><div className="text-[10px] text-white/40">Steam ID</div></div>
        <div className="glass-card rounded-xl p-3 text-center"><div className="text-lg font-bold text-green-400">{sentCount}</div><div className="text-[10px] text-white/40">Отправлено</div></div>
        <div className="glass-card rounded-xl p-3 text-center"><div className="text-lg font-bold text-red-400">{errorCount}</div><div className="text-[10px] text-white/40">Ошибки</div></div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="glass-card rounded-2xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-white">Steam ID для добавления</h3>
          <textarea
            value={steamIdsToAdd} onChange={e => setSteamIdsToAdd(e.target.value)}
            disabled={friendRequestRunning}
            placeholder={"76561198000000001\n76561198000000002\n..."}
            className="w-full glass-input text-xs text-white p-3 rounded-xl outline-none h-40 resize-none font-mono"
          />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-white/50 mb-1 block">Запросов на аккаунт</label>
              <input type="number" value={requestsPerAccount} onChange={e => setRequestsPerAccount(Math.max(1, parseInt(e.target.value) || 5))}
                disabled={friendRequestRunning} className="w-full glass-input text-sm text-white px-3 py-2 rounded-xl outline-none" />
            </div>
            <div>
              <label className="text-xs text-white/50 mb-1 block">Задержка (сек)</label>
              <input type="number" value={delaySeconds} onChange={e => setDelaySeconds(Math.max(1, parseInt(e.target.value) || 3))}
                disabled={friendRequestRunning} className="w-full glass-input text-sm text-white px-3 py-2 rounded-xl outline-none" />
            </div>
          </div>
          <div className="flex gap-2">
            {!friendRequestRunning ? (
              <button onClick={handleStart} disabled={parsedIds.length === 0 || onlineAccounts.length === 0}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-green-500/20 text-green-400 text-sm hover:bg-green-500/30 disabled:opacity-30">
                <Play size={16} /> Запустить
              </button>
            ) : (
              <button onClick={stopFriendRequests} className="flex items-center gap-2 px-6 py-3 rounded-xl bg-red-500/20 text-red-400 text-sm hover:bg-red-500/30">
                <Square size={16} /> Остановить
              </button>
            )}
          </div>
        </div>

        <div className="glass-card rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-white/5"><h3 className="text-sm font-semibold text-white">Логи</h3></div>
          <div className="max-h-96 overflow-y-auto divide-y divide-white/5">
            {friendRequestLogs.length === 0 ? (
              <div className="p-8 text-center text-xs text-white/30">Нет логов</div>
            ) : (
              [...friendRequestLogs].reverse().map(log => (
                <div key={log.id} className="px-4 py-2 flex items-center gap-2">
                  {log.status === 'sent' ? <CheckCircle size={12} className="text-green-400 shrink-0" /> : <XCircle size={12} className="text-red-400 shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-white truncate"><span className="text-white/50">{log.accountLogin}</span> → {log.targetSteamId}</div>
                    {log.error && <div className="text-[10px] text-red-400/80">{log.error}</div>}
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
