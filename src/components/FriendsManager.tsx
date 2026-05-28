import { useState, useRef, useCallback } from 'react';
import { UserPlus, Play, Square, Users, AlertCircle } from 'lucide-react';
import { useAppStore } from '../store';

export default function FriendsManager() {
  const { accounts } = useAppStore();
  const [steamIds, setSteamIds] = useState('');
  const [limitPerAccount, setLimitPerAccount] = useState(10);
  const [progress, setProgress] = useState({ current: 0, total: 0, currentAccount: '' });
  const [results, setResults] = useState<{ success: number; failed: number; errors: string[] }>({ success: 0, failed: 0, errors: [] });

  // Use ref to track running state so the async loop can read it
  const isRunningRef = useRef(false);
  const [isRunning, setIsRunning] = useState(false);

  const onlineAccounts = accounts.filter(a => a.status === 'online');
  
  // Parse Steam IDs from input — accepts ID64, profile URLs, vanity URLs, raw text
  const parseSteamIds = useCallback((text: string): string[] => {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const ids: string[] = [];
    
    for (const line of lines) {
      // Steam ID64 (17 digits)
      const id64Match = line.match(/(\d{17})/);
      if (id64Match) {
        ids.push(id64Match[1]);
        continue;
      }
      // Vanity URL: steamcommunity.com/id/something
      const vanityMatch = line.match(/steamcommunity\.com\/id\/([^\s\/]+)/);
      if (vanityMatch) {
        ids.push(`vanity:${vanityMatch[1]}`);
        continue;
      }
      // Just a raw line — treat as vanity name or ID
      if (line.length > 0 && !line.startsWith('#') && !line.startsWith('//')) {
        // If it looks numeric and long enough, treat as Steam ID
        if (/^\d+$/.test(line) && line.length >= 10) {
          ids.push(line);
        } else {
          // Treat as vanity name
          ids.push(`vanity:${line}`);
        }
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
      // Check if stopped
      if (!isRunningRef.current) break;
      
      // Switch to next account if limit reached
      if (addedByCurrentAccount >= limitPerAccount) {
        accountIdx++;
        addedByCurrentAccount = 0;
        
        if (accountIdx >= onlineAccounts.length) {
          setResults(prev => ({
            ...prev,
            errors: [...prev.errors, `Закончились аккаунты. Добавлено ${i} из ${ids.length}`]
          }));
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
          setResults(prev => ({ 
            ...prev, 
            failed: prev.failed + 1,
            errors: [...prev.errors.slice(-10), `${ids[i]}: ${data.error}`]
          }));
        }
      } catch {
        setResults(prev => ({ ...prev, failed: prev.failed + 1 }));
      }

      addedByCurrentAccount++;

      // Random delay between requests (5-40 seconds) - system enforced, cannot be changed
      const randomDelay = Math.floor(Math.random() * 35000) + 5000; // 5000-40000ms
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
    <div className="p-6 space-y-6 animate-fade-in">
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
        {/* Input */}
        <div className="lg:col-span-2 space-y-4">
          <div className="glass-card rounded-2xl p-5 space-y-4">
            <h3 className="text-sm font-medium text-white">Steam ID / Ссылки на профили</h3>
            <p className="text-xs text-white/40">По одному на строку. Поддерживается: Steam ID64, ссылки на профиль, vanity имена</p>
            <textarea
              value={steamIds}
              onChange={e => setSteamIds(e.target.value)}
              placeholder={"76561198012345678\nhttps://steamcommunity.com/id/username\nhttps://steamcommunity.com/profiles/76561198012345678\nvanityname123"}
              rows={12}
              className="w-full glass-input text-sm text-white px-4 py-3 rounded-xl outline-none resize-none font-mono placeholder:text-white/20"
              disabled={isRunning}
            />
            <div className="flex items-center justify-between text-xs text-white/50">
              <span>{totalIds} ID для добавления</span>
              <span>Потребуется ~{requiredAccounts} аккаунтов (есть {onlineAccounts.length} онлайн)</span>
            </div>
          </div>

          {/* Progress */}
          {(isRunning || results.success > 0 || results.failed > 0) && (
            <div className="glass-card rounded-2xl p-5 space-y-3 animate-fade-in">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-white">Прогресс</h3>
                <span className="text-xs text-white/50">
                  {progress.current}/{progress.total}
                </span>
              </div>
              
              <div className="w-full h-2 rounded-full glass overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300"
                  style={{ width: `${(progress.current / Math.max(progress.total, 1)) * 100}%` }}
                />
              </div>

              {progress.currentAccount && (
                <div className="text-xs text-white/50">
                  Текущий аккаунт: <span className="text-blue-400">{progress.currentAccount}</span>
                </div>
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

        {/* Settings */}
        <div className="space-y-4">
          <div className="glass-card rounded-2xl p-5 space-y-4">
            <h3 className="text-sm font-medium text-white">Настройки</h3>
            
            <div>
              <label className="text-xs text-white/50 block mb-2">
                Лимит на аккаунт: <span className="text-white font-medium text-sm">{limitPerAccount}</span>
              </label>
              <input
                type="range"
                min={1}
                max={23}
                step={1}
                value={limitPerAccount}
                onChange={e => setLimitPerAccount(Number(e.target.value))}
                className="w-full accent-blue-500"
                disabled={isRunning}
              />
              <div className="flex justify-between text-[10px] text-white/30 mt-1">
                <span>1</span>
                <span>23</span>
              </div>
            </div>

            <div className="pt-3 border-t border-white/5">
              <div className="text-xs text-white/50 mb-2">Онлайн аккаунты ({onlineAccounts.length}):</div>
              {onlineAccounts.length === 0 ? (
                <div className="text-xs text-white/30 text-center py-2">Нет онлайн аккаунтов</div>
              ) : (
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {onlineAccounts.map((acc, i) => {
                    const startIdx = i * limitPerAccount;
                    const endIdx = Math.min(startIdx + limitPerAccount, totalIds);
                    const willHandle = startIdx < totalIds;
                    return (
                      <div key={acc.id} className={`flex items-center gap-2 text-xs p-2 rounded-lg glass-light ${!willHandle ? 'opacity-30' : ''}`}>
                        <span className="text-white/30 w-5 text-center">#{i + 1}</span>
                        <span className="text-white flex-1">{acc.login}</span>
                        {willHandle && (
                          <span className="text-blue-400 text-[10px]">
                            ID {startIdx + 1}–{endIdx}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <button
              onClick={isRunning ? stopAdding : startAdding}
              disabled={!isRunning && (totalIds === 0 || onlineAccounts.length === 0)}
              className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-all ${
                isRunning 
                  ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' 
                  : 'glass-accent text-white disabled:opacity-40 disabled:cursor-not-allowed'
              }`}
            >
              {isRunning ? (
                <>
                  <Square size={16} /> Остановить
                </>
              ) : (
                <>
                  <Play size={16} /> Начать добавление
                </>
              )}
            </button>
          </div>

          {/* Stats */}
          <div className="glass-card rounded-2xl p-5">
            <h3 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
              <Users size={16} className="text-white/50" />
              Статистика
            </h3>
            <div className="space-y-2">
              {accounts.map(acc => (
                <div key={acc.id} className="flex items-center gap-2 text-xs">
                  <div className={`status-dot status-${acc.status === 'in-game' ? 'ingame' : acc.status}`} />
                  <span className="text-white/70 flex-1">{acc.login}</span>
                  <span className="text-blue-400">{acc.friendsCount}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
