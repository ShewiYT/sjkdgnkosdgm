import { useState } from 'react';
import { Search, Play, Square, Download, Trash2 } from 'lucide-react';
import { useAppStore } from '../store';

interface ParseResult {
  steamId: string;
  inventoryValue: number;
  itemsCount: number;
  country: string;
  profileName: string;
  foundAt: string;
}

interface ParseStats {
  checked: number;
  inventoryChecked: number;
  foundValuable: number;
  skippedPrivate: number;
  errors: number;
}

export default function SteamParser() {
  const { steamMarketApiKey } = useAppStore();

  const [startIds, setStartIds] = useState('');
  const [minPrice, setMinPrice] = useState(500);
  const [maxPrice, setMaxPrice] = useState(1000);
  const [maxDepth, setMaxDepth] = useState(3);
  const [maxFriends, setMaxFriends] = useState(20);
  const [apiKey, setApiKey] = useState(steamMarketApiKey || '5E2360739CA18D2898E957F7936DA9AE');
  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [results, setResults] = useState<ParseResult[]>([]);
  const [stats, setStats] = useState<ParseStats>({
    checked: 0,
    inventoryChecked: 0,
    foundValuable: 0,
    skippedPrivate: 0,
    errors: 0,
  });

  const addLog = (msg: string) => {
    setLogs(prev => [...prev.slice(-200), `[${new Date().toLocaleTimeString('ru')}] ${msg}`]);
  };

  const parsedStartIds = startIds
    .split(/[\n,\s]+/)
    .filter(id => id.trim() && /^[0-9]+$/.test(id.trim()));

  const handleStart = async () => {
    if (parsedStartIds.length === 0) {
      addLog('⚠️ Укажите хотя бы один начальный Steam ID');
      return;
    }
    setRunning(true);
    setLogs([]);
    setResults([]);
    setStats({ checked: 0, inventoryChecked: 0, foundValuable: 0, skippedPrivate: 0, errors: 0 });

    addLog(`Запуск парсера. Стартовые ID: ${parsedStartIds.length}, глубина: ${maxDepth}`);
    addLog(`Диапазон цен: $${minPrice} - $${maxPrice}`);

    // Simulated BFS traversal using Steam API
    const visited = new Set<string>();
    let queue = [...parsedStartIds];
    parsedStartIds.forEach(id => visited.add(id));

    for (let depth = 1; depth <= maxDepth && running; depth++) {
      addLog(`=== Уровень ${depth}: ${queue.length} профилей ===`);
      const nextQueue: string[] = [];

      for (const steamId of queue) {
        if (!running) break;

        setStats(prev => ({ ...prev, checked: prev.checked + 1 }));

        try {
          // Get user info
          const userRes = await fetch(
            `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${apiKey}&steamids=${steamId}`
          );
          if (!userRes.ok) {
            setStats(prev => ({ ...prev, errors: prev.errors + 1 }));
            continue;
          }
          const userData = await userRes.json();
          const player = userData?.response?.players?.[0];
          if (!player) continue;

          if (player.communityvisibilitystate !== 3) {
            setStats(prev => ({ ...prev, skippedPrivate: prev.skippedPrivate + 1 }));
            addLog(`⛔ ${player.personaname || steamId} — приватный профиль`);
            continue;
          }

          // Get friends
          if (depth < maxDepth) {
            try {
              const friendsRes = await fetch(
                `https://api.steampowered.com/ISteamUser/GetFriendList/v1/?key=${apiKey}&steamid=${steamId}`
              );
              if (friendsRes.ok) {
                const friendsData = await friendsRes.json();
                const friends = friendsData?.friendslist?.friends || [];
                const newFriends = friends
                  .map((f: { steamid: string }) => f.steamid)
                  .filter((id: string) => !visited.has(id))
                  .slice(0, maxFriends);
                newFriends.forEach((id: string) => visited.add(id));
                nextQueue.push(...newFriends);
              }
            } catch { /* ignore */ }
          }

          // Check inventory
          setStats(prev => ({ ...prev, inventoryChecked: prev.inventoryChecked + 1 }));
          addLog(`🔍 Проверяем инвентарь ${player.personaname || steamId}...`);

          const invRes = await fetch(
            `https://steamcommunity.com/inventory/${steamId}/730/2?l=english&count=500`
          );
          if (!invRes.ok) continue;
          const invData = await invRes.json();
          if (!invData.success || !invData.assets?.length) continue;

          const assets = invData.assets;
          const descriptions = invData.descriptions || [];
          const descMap: Record<string, string> = {};
          for (const d of descriptions) {
            if (d.marketable) descMap[`${d.classid}_${d.instanceid}`] = d.market_hash_name;
          }

          // Sample prices
          const sample = assets.slice(0, 10);
          let total = 0;
          let priced = 0;

          for (const asset of sample) {
            const hashName = descMap[`${asset.classid}_${asset.instanceid}`];
            if (!hashName) continue;
            try {
              const priceRes = await fetch(
                `https://steamcommunity.com/market/priceoverview/?appid=730&currency=1&market_hash_name=${encodeURIComponent(hashName)}`
              );
              if (!priceRes.ok) continue;
              const priceData = await priceRes.json();
              if (priceData.success && priceData.lowest_price) {
                const price = parseFloat(priceData.lowest_price.replace(/[$,]/g, ''));
                if (!isNaN(price)) {
                  total += price;
                  priced++;
                }
              }
              await new Promise(r => setTimeout(r, 400));
            } catch { /* ignore */ }
          }

          if (priced === 0) continue;
          const estimated = (total / priced) * assets.length;

          if (estimated >= minPrice && estimated <= maxPrice) {
            addLog(`⭐ НАЙДЕН ${player.personaname}: $${estimated.toFixed(2)} (${assets.length} предметов)`);
            setStats(prev => ({ ...prev, foundValuable: prev.foundValuable + 1 }));
            const result: ParseResult = {
              steamId,
              inventoryValue: estimated,
              itemsCount: assets.length,
              country: player.loccountrycode || '?',
              profileName: player.personaname || steamId,
              foundAt: new Date().toISOString(),
            };
            setResults(prev => [...prev, result]);
          } else {
            addLog(
              `  ${player.personaname}: $${estimated.toFixed(2)} — вне диапазона`
            );
          }

          await new Promise(r => setTimeout(r, 1500));
        } catch (e) {
          setStats(prev => ({ ...prev, errors: prev.errors + 1 }));
          addLog(`❌ Ошибка: ${steamId}`);
        }
      }

      queue = nextQueue;
      if (queue.length === 0) break;
      addLog(`Уровень ${depth + 1}: ${queue.length} новых профилей`);
    }

    addLog('✅ Парсинг завершён!');
    setRunning(false);
  };

  const handleStop = () => {
    setRunning(false);
    addLog('⛔ Остановлено пользователем');
  };

  const downloadResults = () => {
    const text = results.map(r => r.steamId).join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `steam_ids_${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in overflow-y-auto max-h-[calc(100vh-52px)]">
      <div>
        <h1 className="text-2xl font-semibold text-white flex items-center gap-2">
          <Search size={24} />
          Парсер Steam ID
        </h1>
        <p className="text-sm text-white/40 mt-1">
          Обход сети друзей и поиск ценных инвентарей CS2
        </p>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <div className="glass-card rounded-xl p-3 text-center">
          <div className="text-lg font-bold text-white">{stats.checked}</div>
          <div className="text-[10px] text-white/40">Проверено</div>
        </div>
        <div className="glass-card rounded-xl p-3 text-center">
          <div className="text-lg font-bold text-blue-400">{stats.inventoryChecked}</div>
          <div className="text-[10px] text-white/40">Инвентарей</div>
        </div>
        <div className="glass-card rounded-xl p-3 text-center">
          <div className="text-lg font-bold text-green-400">{stats.foundValuable}</div>
          <div className="text-[10px] text-white/40">Найдено</div>
        </div>
        <div className="glass-card rounded-xl p-3 text-center">
          <div className="text-lg font-bold text-red-400">{stats.errors}</div>
          <div className="text-[10px] text-white/40">Ошибки</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Config */}
        <div className="glass-card rounded-2xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-white">Конфигурация</h3>

          <div>
            <label className="text-xs text-white/50 mb-1 block">
              Начальные Steam ID (или случайные)
            </label>
            {startIds && (
              <span className="text-[10px] text-indigo-400">
                {parsedStartIds.length} ID
              </span>
            )}
            <textarea
              value={startIds}
              onChange={e => setStartIds(e.target.value)}
              disabled={running}
              placeholder={"76561199762976549\n76561198307592024\n..."}
              className="w-full glass-input text-xs text-white p-3 rounded-xl outline-none h-24 resize-none font-mono mt-1"
            />
          </div>

          <div>
            <label className="text-xs text-white/50 mb-1 block">Steam API Key</label>
            <input
              type="text"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              disabled={running}
              placeholder="5E2360739CA18D2898E957F7936DA9AE"
              className="w-full glass-input text-xs text-white px-3 py-2 rounded-xl outline-none font-mono"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-white/50 mb-1 block">Мин. цена ($)</label>
              <input
                type="number"
                value={minPrice}
                onChange={e => setMinPrice(parseInt(e.target.value) || 0)}
                disabled={running}
                className="w-full glass-input text-sm text-white px-3 py-2 rounded-xl outline-none"
              />
            </div>
            <div>
              <label className="text-xs text-white/50 mb-1 block">Макс. цена ($)</label>
              <input
                type="number"
                value={maxPrice}
                onChange={e => setMaxPrice(parseInt(e.target.value) || 1000)}
                disabled={running}
                className="w-full glass-input text-sm text-white px-3 py-2 rounded-xl outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-white/50 mb-1 block">Глубина обхода</label>
              <input
                type="number"
                value={maxDepth}
                min={1}
                max={5}
                onChange={e => setMaxDepth(Math.min(5, Math.max(1, parseInt(e.target.value) || 3)))}
                disabled={running}
                className="w-full glass-input text-sm text-white px-3 py-2 rounded-xl outline-none"
              />
            </div>
            <div>
              <label className="text-xs text-white/50 mb-1 block">Друзей на уровень</label>
              <input
                type="number"
                value={maxFriends}
                min={5}
                max={100}
                onChange={e => setMaxFriends(Math.min(100, Math.max(5, parseInt(e.target.value) || 20)))}
                disabled={running}
                className="w-full glass-input text-sm text-white px-3 py-2 rounded-xl outline-none"
              />
            </div>
          </div>

          <div className="flex gap-2">
            {!running ? (
              <button
                onClick={handleStart}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-green-500/20 text-green-400 text-sm hover:bg-green-500/30 transition-colors"
              >
                <Play size={16} /> Запустить
              </button>
            ) : (
              <button
                onClick={handleStop}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-red-500/20 text-red-400 text-sm hover:bg-red-500/30 transition-colors"
              >
                <Square size={16} /> Остановить
              </button>
            )}
            {results.length > 0 && (
              <>
                <button
                  onClick={downloadResults}
                  className="flex items-center gap-2 px-4 py-3 rounded-xl bg-indigo-500/20 text-indigo-400 text-sm hover:bg-indigo-500/30 transition-colors"
                >
                  <Download size={16} /> Скачать ({results.length})
                </button>
                <button
                  onClick={() => setResults([])}
                  className="flex items-center gap-2 px-4 py-3 rounded-xl bg-white/5 text-white/40 text-sm hover:bg-white/10 transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Results & logs */}
        <div className="space-y-4">
          {results.length > 0 && (
            <div className="glass-card rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">
                  Найдено ({results.length})
                </h3>
              </div>
              <div className="max-h-40 overflow-y-auto divide-y divide-white/5">
                {results.map(r => (
                  <div key={r.steamId} className="px-3 py-2 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-white truncate">{r.profileName}</div>
                      <div className="text-[10px] text-white/30 font-mono">{r.steamId}</div>
                    </div>
                    <div className="text-xs text-green-400 shrink-0">
                      ${r.inventoryValue.toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="glass-card rounded-2xl overflow-hidden flex-1">
            <div className="px-4 py-3 border-b border-white/5">
              <h3 className="text-sm font-semibold text-white">Логи парсера</h3>
            </div>
            <div className="h-64 overflow-y-auto p-3 space-y-0.5 font-mono">
              {logs.length === 0 ? (
                <div className="text-center text-xs text-white/20 mt-8">
                  Нет логов. Запустите парсер.
                </div>
              ) : (
                logs.map((log, i) => (
                  <div key={i} className="text-[10px] text-white/50 leading-relaxed">
                    {log}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
