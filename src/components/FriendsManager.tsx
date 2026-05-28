import { useState, useRef, useCallback } from 'react';
import { UserPlus, Play, Square, AlertCircle } from 'lucide-react';
import { useAppStore } from '../store';

export default function FriendsManager() {
  const { accounts } = useAppStore();
  const [steamIds, setSteamIds] = useState('');
  const [limitPerAccount, setLimitPerAccount] = useState(10);
  const [progress, setProgress] = useState({ current: 0, total: 0, currentAccount: '' });
  const [results, setResults] = useState<{ success: number; failed: number; errors: string[] }>({ success: 0, failed: 0, errors: [] });
  const isRunningRef = useRef(false);
  const [isRunning, setIsRunning] = useState(false);

  const onlineAccounts = accounts.filter(a => a.status === 'online');

  const parseSteamIds = useCallback((text: string): string[] => {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const ids: string[] = [];
    for (const line of lines) {
      const id64Match = line.match(/(\d{17})/);
      if (id64Match) { ids.push(id64Match[1]); continue; }
      const vanityMatch = line.match(/steamcommunity\.com\/id\/([^\s\/]+)/);
      if (vanityMatch) { ids.push(`vanity:${vanityMatch[1]}`); continue; }
      if (line.length > 0 && !line.startsWith('#')) {
        if (/^\d+$/.test(line) && line.length >= 10) ids.push(line);
        else ids.push(`vanity:${line}`);
      }
    }
    return ids;
  }, []);

  const startAdding = useCallback(async () => {
    const ids = parseSteamIds(steamIds);
    if (ids.length === 0 || onlineAccounts.length === 0) return;
    isRunningRef.current = true;
    setIsRunning(true);
    setResults({ success: 0, failed: 0, errors: [] });
    setProgress({ current: 0, total: ids.length, currentAccount: '' });

    let addedByCurrentAccount = 0;
    let accountIdx = 0;

    for (let i = 0; i < ids.length; i++) {
      if (!isRunningRef.current) break;
      if (addedByCurrentAccount >= limitPerAccount) {
        accountIdx++;
        addedByCurrentAccount = 0;
        if (accountIdx >= onlineAccounts.length) {
          setResults(prev => ({ ...prev, errors: [...prev.errors, `Закончились аккаунты`] }));
          break;
        }
      }

      const account = onlineAccounts[accountIdx];
      setProgress({ current: i + 1, total: ids.length, currentAccount: account.login });

      try {
        const res = await fetch('/api/steam/add-friend', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accountId: account.id, steamId: ids[i] }),
        });
        const data = await res.json();
        if (data.success) {
          setResults(prev => ({ ...prev, success: prev.success + 1 }));
        } else {
          setResults(prev => ({ ...prev, failed: prev.failed + 1, errors: [...prev.errors.slice(-10), `${ids[i]}: ${data.error}`] }));
        }
      } catch {
        setResults(prev => ({ ...prev, failed: prev.failed + 1 }));
      }

      addedByCurrentAccount++;
      const randomDelay = Math.floor(Math.random() * 35000) + 5000;
      await new Promise(r => setTimeout(r, randomDelay));
    }

    isRunningRef.current = false;
    setIsRunning(false);
  }, [steamIds, limitPerAccount, onlineAccounts, parseSteamIds]);

  const stopAdding = useCallback(() => {
    isRunningRef.current = false;
    setIsRunning(false);
  }, []);

  const totalIds = parseSteamIds(steamIds).length;
  const requiredAccounts = Math.ceil(totalIds / Math.max(limitPerAccount, 1));

  return (
    <div className="p-6 space-y-6 animate-fade-in overflow-y-auto max-h-[calc(100vh-52px)]">
      <div>
        <h1 className="text-2xl font-semibold text-white flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl glass-accent flex items-center justify-center">
            <UserPlus size={20} />
          </div>
          Добавление друзей
        </h1>
        <p className="text-sm text-white/50 mt-1">Автоматическое добавление с распределением по аккаунтам</p>
      </div>

      {onlineAccounts.length === 0 && (
        <div className="glass-card rounded-2xl p-4 border border-yellow-500/30">
          <div className="flex items-center gap-3 text-yellow-400">
            <AlertCircle size={20} />
            <span className="text-sm">Нет онлайн аккаунтов. Подключите аккаунты в разделе "Импорт"</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="glass-card rounded-2xl p-5 space-y-4">
            <h3 className="text-sm font-medium text-white">Steam ID / Ссылки на профили</h3>
            <p className="text-xs text-white/40">По одному на строку</p>
            <textarea
              value={steamIds}
              onChange={e => setSteamIds(e.target.value)}
              placeholder={"76561198012345678\nhttps://steamcommunity.com/id/username"}
              rows={12}
              className="w-full glass-input text-sm text-white px-4 py-3 rounded-xl outline-none resize-none font-mono placeholder:text-white/20"
              disabled={isRunning}
            />
            <div className="flex items-center justify-between text-xs text-white/50">
              <span>{totalIds} ID для добавления</span>
              <span>Потребуется ~{requiredAccounts} аккаунтов (есть {onlineAccounts.length} онлайн)</span>
            </div>
          </div>

          {(isRunning || results.success > 0 || results.failed > 0) && (
            <div className="glass-card rounded-2xl p-5 space-y-3 animate-fade-in">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-white">Прогресс</h3>
                <span className="text-xs text-white/50">{progress.current}/{progress.total}</span>
              </div>
              <div className="w-full h-2 rounded-full glass overflow-hidden">
                <div className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300"
                  style={{ width: `${(progress.current / Math.max(progress.total, 1)) * 100}%` }} />
              </div>
              {progress.currentAccount && (
                <div className="text-xs text-white/50">Текущий аккаунт: <span className="text-blue-400">{progress.currentAccount}</span></div>
              )}
              <div className="flex gap-4 text-xs">
                <span className="text-green-400">✓ {results.success} добавлено</span>
                <span className="text-red-400">✗ {results.failed} ошибок</span>
              </div>
              {results.errors.length > 0 && (
                <div className="text-[10px] text-red-400/70 space-y-0.5 max-h-24 overflow-y-auto">
                  {results.errors.map((e, i) => <div key={i}>• {e}</div>)}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="glass-card rounded-2xl p-5 space-y-4">
            <h3 className="text-sm font-medium text-white">Настройки</h3>
            <div>
              <label className="text-xs text-white/50 block mb-1">Лимит на аккаунт</label>
              <input type="number" value={limitPerAccount} onChange={e => setLimitPerAccount(Number(e.target.value))}
                min={1} max={100}
                className="w-full glass-input text-sm text-white px-4 py-3 rounded-xl outline-none" disabled={isRunning} />
            </div>
            <div className="glass-light rounded-xl p-3 text-[10px] text-white/40 space-y-1">
              <div>⏱️ Задержка: 5-40 сек (случайная)</div>
              <div>🔄 Автоматическая смена аккаунта</div>
              <div>📊 {onlineAccounts.length} аккаунтов доступно</div>
            </div>
          </div>

          <div className="flex gap-3">
            {isRunning ? (
              <button onClick={stopAdding}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-red-500/20 text-red-400 hover:bg-red-500/30 text-sm">
                <Square size={16} /> Остановить
              </button>
            ) : (
              <button onClick={startAdding}
                disabled={totalIds === 0 || onlineAccounts.length === 0}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl glass-accent text-white disabled:opacity-40 text-sm">
                <Play size={16} /> Начать
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
