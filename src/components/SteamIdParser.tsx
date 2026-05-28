import { useState, useRef, useEffect } from 'react';
import { Search, Play, Square, Download, Trash2, Settings, Loader2, AlertTriangle } from 'lucide-react';

interface ParseResult {
  steamId: string;
  inventoryValue: number;
  itemsCount: number;
  country?: string;
}

// Generate a random valid-ish Steam ID64
// Real Steam IDs: 76561197960265728 + account_id (0 ~ 1,500,000,000)
function randomSteamId(): string {
  const base = 76561197960265728n;
  const offset = BigInt(Math.floor(Math.random() * 1_500_000_000));
  return (base + offset).toString();
}

export default function SteamIdParser() {
  const [minValue, setMinValue] = useState(10);
  const [maxValue, setMaxValue] = useState(5000);
  const [targetCount, setTargetCount] = useState(50);
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<ParseResult[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [checked, setChecked] = useState(0);
  const [ratePerSec, setRatePerSec] = useState(1);
  const stopRef = useRef(false);
  const logsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logsRef.current?.scrollTo({ top: logsRef.current.scrollHeight, behavior: 'smooth' });
  }, [logs]);

  const addLog = (msg: string) => setLogs(prev => [...prev.slice(-200), msg]);

  // Fetch inventory value for a steam ID
  // Tries our server proxy first, then direct Steam API
  async function checkInventory(steamId: string): Promise<{ value: number; count: number } | null> {
    // 1) Try server-side proxy (handles CORS)
    try {
      const res = await fetch(`/api/inventory/${steamId}`, { signal: AbortSignal.timeout(8000) });
      if (res.ok) {
        const data = await res.json();
        if (data.totalValue !== undefined) {
          return { value: data.totalValue, count: data.itemsCount || 0 };
        }
      }
    } catch { /* try next */ }

    // 2) Try direct Steam Community (works if no CORS issue / same-origin)
    try {
      const res = await fetch(
        `https://steamcommunity.com/inventory/${steamId}/730/2?l=english&count=1`,
        { signal: AbortSignal.timeout(8000) }
      );
      if (res.status === 403 || res.status === 401) {
        // Private inventory
        return null;
      }
      if (res.ok) {
        const data = await res.json();
        const count = data.total_inventory_count || 0;
        // We can't easily get price from this endpoint, just item count
        // Return count > 0 with value = 0 so caller knows inventory exists
        return { value: 0, count };
      }
    } catch { /* ignore CORS errors */ }

    return null;
  }

  const startParsing = async () => {
    stopRef.current = false;
    setIsRunning(true);
    setResults([]);
    setChecked(0);
    setLogs([]);

    addLog(`🚀 Парсер запущен. Цель: ${targetCount} ID, диапазон: $${minValue}–$${maxValue}`);
    addLog(`⏱ Скорость: ~${ratePerSec} запрос/сек`);

    const found: ParseResult[] = [];
    let totalChecked = 0;

    while (found.length < targetCount && !stopRef.current) {
      const steamId = randomSteamId();
      totalChecked++;
      setChecked(totalChecked);

      try {
        const result = await checkInventory(steamId);

        if (result === null) {
          // Private or error — skip silently
          if (totalChecked % 10 === 0) {
            addLog(`🔍 Проверено ${totalChecked}... (найдено: ${found.length})`);
          }
        } else if (result.value >= minValue && result.value <= maxValue) {
          // Match!
          const entry: ParseResult = {
            steamId,
            inventoryValue: result.value,
            itemsCount: result.count,
          };
          found.push(entry);
          setResults([...found]);
          addLog(`✅ #${found.length} Найден: ${steamId} — $${result.value.toFixed(2)} (${result.count} предметов)`);
        } else if (result.value > 0) {
          addLog(`⬚ ${steamId} — $${result.value.toFixed(2)} (вне диапазона)`);
        } else if (result.count > 0) {
          // Has items but we couldn't get price — still log
          if (totalChecked % 5 === 0) {
            addLog(`🔍 Проверено ${totalChecked}... (найдено: ${found.length})`);
          }
        }
      } catch {
        if (totalChecked % 20 === 0) {
          addLog(`⚠️ Проверено ${totalChecked}, ошибки подключения...`);
        }
      }

      // Rate limit
      const delayMs = Math.floor(1000 / ratePerSec);
      await new Promise(r => setTimeout(r, delayMs));
    }

    setIsRunning(false);

    if (stopRef.current) {
      addLog(`⏹️ Парсер остановлен. Найдено: ${found.length} из ${targetCount}`);
    } else {
      addLog(`🎉 Готово! Найдено: ${found.length} Steam ID`);
    }
  };

  const stopParsing = () => {
    stopRef.current = true;
    addLog('⏳ Останавливаем...');
  };

  const downloadResults = () => {
    if (results.length === 0) return;
    const text = results.map(r => r.steamId).join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `steam_ids_$${minValue}-$${maxValue}_${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadCsv = () => {
    if (results.length === 0) return;
    const header = 'SteamID,Value,Items\n';
    const rows = results.map(r => `${r.steamId},${r.inventoryValue.toFixed(2)},${r.itemsCount}`).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `steam_ids_$${minValue}-$${maxValue}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const clearResults = () => {
    setResults([]);
    setLogs([]);
    setChecked(0);
  };

  const progress = targetCount > 0 ? (results.length / targetCount) * 100 : 0;

  return (
    <div className="p-6 space-y-6 animate-fade-in overflow-y-auto max-h-[calc(100vh-52px)]">
      <div>
        <h1 className="text-2xl font-semibold text-white flex items-center gap-2">
          <Search size={24} />
          Парсер Steam ID
        </h1>
        <p className="text-sm text-white/40 mt-1">Поиск Steam ID с инвентарём CS2 в заданном диапазоне стоимости</p>
      </div>

      <div className="glass-card rounded-xl p-3 flex items-start gap-2 text-xs text-yellow-400/80">
        <AlertTriangle size={14} className="shrink-0 mt-0.5" />
        <div>
          Парсер генерирует случайные Steam ID и проверяет стоимость инвентаря CS2.
          Приватные инвентари пропускаются. Steam ограничивает ~1-2 запроса/сек.
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Settings */}
        <div className="space-y-4">
          <div className="glass-card rounded-2xl p-4 space-y-4">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Settings size={16} />
              Настройки
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-white/50 mb-1 block">Мин. стоимость ($)</label>
                <input
                  type="number"
                  value={minValue}
                  onChange={e => setMinValue(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full glass-input text-sm text-white px-3 py-2 rounded-xl outline-none"
                  disabled={isRunning}
                />
              </div>
              <div>
                <label className="text-xs text-white/50 mb-1 block">Макс. стоимость ($)</label>
                <input
                  type="number"
                  value={maxValue}
                  onChange={e => setMaxValue(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full glass-input text-sm text-white px-3 py-2 rounded-xl outline-none"
                  disabled={isRunning}
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-white/50 mb-1 block">Сколько найти</label>
              <input
                type="number"
                value={targetCount}
                onChange={e => setTargetCount(Math.min(50000, Math.max(1, parseInt(e.target.value) || 1)))}
                className="w-full glass-input text-sm text-white px-3 py-2 rounded-xl outline-none"
                disabled={isRunning}
              />
              <div className="text-[10px] text-white/20 mt-0.5">Макс: 50,000</div>
            </div>

            <div>
              <label className="text-xs text-white/50 mb-1 block">Скорость (запросов/сек)</label>
              <input
                type="number"
                value={ratePerSec}
                onChange={e => setRatePerSec(Math.min(5, Math.max(0.5, parseFloat(e.target.value) || 1)))}
                step={0.5}
                min={0.5}
                max={5}
                className="w-full glass-input text-sm text-white px-3 py-2 rounded-xl outline-none"
                disabled={isRunning}
              />
              <div className="text-[10px] text-white/20 mt-0.5">Рекомендуется: 1–2</div>
            </div>

            <div className="flex gap-2">
              {!isRunning ? (
                <button
                  onClick={startParsing}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-medium text-sm hover:opacity-90 transition-opacity"
                >
                  <Play size={14} />
                  Запустить
                </button>
              ) : (
                <button
                  onClick={stopParsing}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-500/20 text-red-400 font-medium text-sm hover:bg-red-500/30 transition-colors"
                >
                  <Square size={14} />
                  Остановить
                </button>
              )}
            </div>
          </div>

          {/* Progress */}
          <div className="glass-card rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-white/50">Найдено</span>
              <span className="text-white font-medium">{results.length} / {targetCount}</span>
            </div>
            <div className="w-full h-2 rounded-full bg-white/5">
              <div
                className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-500"
                style={{ width: `${Math.min(100, progress)}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-white/30">
              <span>Проверено: {checked}</span>
              <span className={isRunning ? 'text-green-400' : results.length > 0 ? 'text-blue-400' : 'text-white/20'}>
                {isRunning ? '🔄 Работает' : results.length > 0 ? '✓ Завершено' : 'Ожидание'}
              </span>
            </div>
          </div>

          {/* Logs */}
          <div className="glass-card rounded-2xl p-4">
            <h4 className="text-xs text-white/50 mb-2">Лог</h4>
            <div ref={logsRef} className="h-40 overflow-y-auto space-y-0.5 font-mono text-[10px]">
              {logs.length === 0 ? (
                <div className="text-white/20">Нажмите «Запустить»...</div>
              ) : (
                logs.map((log, i) => (
                  <div key={i} className="text-white/50">{log}</div>
                ))
              )}
              {isRunning && (
                <div className="flex items-center gap-1 text-indigo-400">
                  <Loader2 size={10} className="animate-spin" />
                  Парсинг...
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="lg:col-span-2">
          <div className="glass-card rounded-2xl p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white">
                Результаты ({results.length})
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={downloadResults}
                  disabled={results.length === 0}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-green-500/20 text-green-400 text-xs hover:bg-green-500/30 disabled:opacity-30 transition-colors"
                >
                  <Download size={12} />
                  .txt
                </button>
                <button
                  onClick={downloadCsv}
                  disabled={results.length === 0}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-500/20 text-blue-400 text-xs hover:bg-blue-500/30 disabled:opacity-30 transition-colors"
                >
                  <Download size={12} />
                  .csv
                </button>
                <button
                  onClick={clearResults}
                  disabled={results.length === 0 || isRunning}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 text-xs hover:bg-red-500/30 disabled:opacity-30 transition-colors"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>

            {results.length === 0 ? (
              <div className="text-center py-16 text-white/20">
                <Search size={48} className="mx-auto mb-4 opacity-30" />
                <div className="text-sm">Результаты появятся здесь</div>
                <div className="text-xs text-white/10 mt-1">Запустите парсер для поиска Steam ID</div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-[10px] text-white/40 border-b border-white/5">
                      <th className="text-left py-2 px-3">#</th>
                      <th className="text-left py-2 px-3">Steam ID</th>
                      <th className="text-left py-2 px-3">Стоимость</th>
                      <th className="text-left py-2 px-3">Предметов</th>
                      <th className="text-left py-2 px-3">Ссылка</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((r, i) => (
                      <tr key={r.steamId} className="border-b border-white/5 hover:bg-white/5">
                        <td className="py-2 px-3 text-xs text-white/30">{i + 1}</td>
                        <td className="py-2 px-3 text-xs text-white font-mono">{r.steamId}</td>
                        <td className="py-2 px-3 text-xs text-emerald-400">${r.inventoryValue.toFixed(2)}</td>
                        <td className="py-2 px-3 text-xs text-white/50">{r.itemsCount}</td>
                        <td className="py-2 px-3">
                          <a
                            href={`https://steamcommunity.com/profiles/${r.steamId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] text-indigo-400 hover:text-indigo-300"
                          >
                            Профиль ↗
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
