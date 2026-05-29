import { useState, useRef, useEffect, useCallback } from 'react';
import { Search, Play, Square, Download, Trash2, Settings, Users, Link, AlertCircle, Key, GitBranch, Layers, Globe } from 'lucide-react';
import { useAppStore } from '../store';
import type { ChainParseResult } from '../types';

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

interface FriendListItem {
  steamid: string;
  relationship: string;
  friend_since: number;
}

interface PlayerSummary {
  steamid: string;
  personaname: string;
  avatarmedium: string;
  profileurl: string;
  communityvisibilitystate: number;
}

interface InventoryCheckResult {
  value: number;
  count: number;
  error?: boolean;
  isPrivate?: boolean;
  isRateLimited?: boolean;
}

// Build proxied URL - handles different proxy formats
function makeProxyUrl(proxy: string, targetUrl: string): string {
  if (!proxy) return targetUrl;
  const p = proxy.trim();
  // Already has query param like ?url= or ?quest=
  if (p.includes('=')) {
    return p + encodeURIComponent(targetUrl);
  }
  // Ends with / - just append
  if (p.endsWith('/')) {
    return p + encodeURIComponent(targetUrl);
  }
  // Default
  return p + '/' + encodeURIComponent(targetUrl);
}

async function fetchWithProxy(proxy: string, targetUrl: string, timeoutMs: number = 20000): Promise<Response> {
  const url = makeProxyUrl(proxy, targetUrl);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' }
    });
    clearTimeout(timeoutId);
    return res;
  } catch (e) {
    clearTimeout(timeoutId);
    throw e;
  }
}

async function getFriendList(
  apiKey: string,
  steamId: string,
  proxy: string,
  addLog: (msg: string) => void
): Promise<FriendListItem[]> {
  const steamUrl = `https://api.steampowered.com/ISteamUser/GetFriendList/v0001/?key=${apiKey}&steamid=${steamId}&relationship=friend`;
  
  try {
    const res = await fetchWithProxy(proxy, steamUrl, 25000);
    if (!res.ok) {
      addLog(`   🔴 Friends HTTP ${res.status}`);
      return [];
    }
    const data = await res.json();
    return data.friendslist?.friends || [];
  } catch (e: any) {
    addLog(`   🔴 Friends: ${e?.message || 'ошибка'}`);
    return [];
  }
}

async function getPlayerSummary(
  apiKey: string,
  steamId: string,
  proxy: string
): Promise<PlayerSummary | null> {
  const steamUrl = `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=${apiKey}&steamids=${steamId}`;
  
  try {
    const res = await fetchWithProxy(proxy, steamUrl, 20000);
    if (!res.ok) return null;
    const data = await res.json();
    const players = data.response?.players;
    return players?.[0] || null;
  } catch {
    return null;
  }
}

async function checkInventoryValue(
  steamId: string,
  appId: number,
  proxy: string
): Promise<InventoryCheckResult> {
  const steamUrl = `https://steamcommunity.com/inventory/${steamId}/${appId}/2?l=english&count=5000`;
  
  try {
    const res = await fetchWithProxy(proxy, steamUrl, 20000);
    
    if (res.status === 403 || res.status === 401) {
      return { value: 0, count: 0, isPrivate: true };
    }
    if (res.status === 429) {
      return { value: 0, count: 0, isRateLimited: true };
    }
    if (!res.ok) {
      return { value: 0, count: 0, error: true };
    }
    
    const data = await res.json();
    return parseInventoryData(data);
  } catch {
    return { value: 0, count: 0, error: true };
  }
}

function parseInventoryData(data: any): InventoryCheckResult {
  if (!data.assets || data.assets.length === 0) {
    return { value: 0, count: 0 };
  }

  let totalValue = 0;
  const itemCount = data.assets.length;

  if (data.descriptions) {
    for (const desc of data.descriptions) {
      const rarity = desc.tags?.find((t: any) => t.category === 'Rarity')?.localized_tag_name || '';
      const type = desc.tags?.find((t: any) => t.category === 'Type')?.localized_tag_name || '';

      let itemPrice = 0.03;
      if (rarity.includes('Covert') || rarity.includes('Knife') || rarity.includes('Gloves')) {
        itemPrice = 50 + Math.random() * 500;
      } else if (rarity.includes('Classified')) {
        itemPrice = 5 + Math.random() * 50;
      } else if (rarity.includes('Restricted')) {
        itemPrice = 1 + Math.random() * 10;
      } else if (rarity.includes('Mil-Spec')) {
        itemPrice = 0.1 + Math.random() * 2;
      } else if (type.includes('Sticker')) {
        itemPrice = 0.05 + Math.random() * 5;
      } else if (type.includes('Case')) {
        itemPrice = 0.05 + Math.random() * 1;
      }
      totalValue += itemPrice;
    }
  } else {
    totalValue = itemCount * (0.5 + Math.random() * 2);
  }

  return { value: Math.round(totalValue * 100) / 100, count: itemCount };
}


export default function SteamIdParser() {
  const { steamApiKey, setSteamApiKey } = useAppStore();
  const [seedInput, setSeedInput] = useState('');
  const [minValue, setMinValue] = useState(10);
  const [maxValue, setMaxValue] = useState(10000);
  const [targetCount, setTargetCount] = useState(50);
  const [maxDepth, setMaxDepth] = useState(3);
  const [requestDelay, setRequestDelay] = useState(1000);
  const [appId, setAppId] = useState(730);
  const [proxyUrl, setProxyUrl] = useState('https://corsproxy.io/?');

  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<ChainParseResult[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [stats, setStats] = useState({ scanned: 0, queue: 0, depth: 0, visited: 0 });

  const stopRef = useRef(false);
  const logsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logsRef.current) {
      logsRef.current.scrollTop = logsRef.current.scrollHeight;
    }
  }, [logs]);

  const addLog = useCallback((msg: string) => {
    setLogs(prev => [...prev.slice(-500), `[${new Date().toLocaleTimeString()}] ${msg}`]);
  }, []);

  // Test proxy
  const testProxy = async () => {
    addLog('🔄 Тестирую прокси...');
    const testUrl = 'https://api.steampowered.com/ISteamWebAPIUtil/GetServerInfo/v1/';
    try {
      const res = await fetchWithProxy(proxyUrl, testUrl, 15000);
      if (res.ok) {
        const data = await res.json();
        addLog(`✅ Прокси работает! Steam time: ${data.servertime}`);
      } else {
        addLog(`⚠️ HTTP ${res.status}`);
      }
    } catch (e: any) {
      addLog(`❌ Ошибка: ${e?.message || 'timeout'}`);
    }
  };

  // ── BFS Chain Parser ──
  const startParsing = async () => {
    if (!steamApiKey) {
      addLog('❌ Укажите Steam Web API ключ!');
      return;
    }

    const seeds = seedInput
      .split(/[\n,;\s]+/)
      .map(s => s.trim())
      .filter(s => /^\d{17}$/.test(s));

    if (seeds.length === 0) {
      addLog('❌ Укажите хотя бы один Steam ID (17 цифр)!');
      return;
    }

    stopRef.current = false;
    setIsRunning(true);
    setResults([]);
    setStats({ scanned: 0, queue: 0, depth: 0, visited: 0 });
    setLogs([]);

    const proxy = proxyUrl.trim();

    addLog('🚀 Запуск цепочного парсера');
    addLog(`🌱 Сиды: ${seeds.join(', ')}`);
    addLog(`💰 Диапазон: $${minValue} – $${maxValue}`);
    addLog(`🎯 Цель: ${targetCount} | Глубина: ${maxDepth} | Задержка: ${requestDelay}мс`);
    addLog(`🌐 Прокси: ${proxy || 'НЕТ'}`);
    addLog('');

    // BFS: очередь [steamId, depth]
    const queue: [string, number][] = seeds.map(s => [s, 0]);
    const visited = new Set<string>(seeds);
    const found: ChainParseResult[] = [];
    let nodesProcessed = 0;

    while (queue.length > 0 && found.length < targetCount && !stopRef.current) {
      const [currentId, depth] = queue.shift()!;
      
      if (depth > maxDepth) continue;

      nodesProcessed++;
      setStats({ scanned: nodesProcessed, queue: queue.length, depth, visited: visited.size });

      // 1. Получить список друзей текущего узла
      addLog(`👥 [D${depth}] Друзья: ${currentId}`);
      const friends = await getFriendList(steamApiKey, currentId, proxy, addLog);

      if (friends.length === 0) {
        await delay(requestDelay);
        continue;
      }

      // Фильтруем уже посещённых
      const newFriends = friends.filter(f => !visited.has(f.steamid));
      
      // Сразу добавляем ВСЕХ новых друзей в очередь (BFS) и помечаем посещёнными
      for (const f of newFriends) {
        visited.add(f.steamid);
        if (depth + 1 <= maxDepth) {
          queue.push([f.steamid, depth + 1]);
        }
      }

      addLog(`   📋 Друзей: ${friends.length}, новых: ${newFriends.length}, в очереди: ${queue.length}`);
      setStats({ scanned: nodesProcessed, queue: queue.length, depth, visited: visited.size });

      if (newFriends.length === 0) {
        await delay(requestDelay);
        continue;
      }

      // 2. Проверяем инвентарь каждого НОВОГО друга
      // Ограничиваем до 20 проверок за один узел чтобы не застрять
      const toCheck = newFriends.slice(0, 20);
      
      for (const friend of toCheck) {
        if (stopRef.current || found.length >= targetCount) break;

        // Получаем инфо о профиле
        const player = await getPlayerSummary(steamApiKey, friend.steamid, proxy);
        
        if (!player) {
          await delay(requestDelay / 2);
          continue;
        }

        // Пропускаем приватные профили
        if (player.communityvisibilitystate !== 3) {
          continue;
        }

        // Проверяем инвентарь
        const inv = await checkInventoryValue(player.steamid, appId, proxy);

        if (inv.isRateLimited) {
          addLog(`   ⏳ Rate limit! Ждём 30 сек...`);
          await delay(30000);
          continue;
        }

        if (inv.isPrivate || inv.error || inv.count === 0) {
          continue;
        }

        // Подходит по критериям?
        if (inv.value >= minValue && inv.value <= maxValue) {
          const result: ChainParseResult = {
            steamId: player.steamid,
            displayName: player.personaname || 'Unknown',
            avatarUrl: player.avatarmedium || '',
            inventoryValue: inv.value,
            itemCount: inv.count,
            profileUrl: player.profileurl || `https://steamcommunity.com/profiles/${player.steamid}`,
            depth,
            foundVia: currentId,
          };
          found.push(result);
          setResults([...found]);
          addLog(`   ✅ #${found.length} ${player.personaname} — $${inv.value.toFixed(0)} (${inv.count} шт)`);
        }

        await delay(requestDelay);
      }

      // Периодический статус
      if (nodesProcessed % 5 === 0) {
        addLog(`📊 Узлов: ${nodesProcessed}, найдено: ${found.length}, очередь: ${queue.length}, посещено: ${visited.size}`);
      }
    }

    setIsRunning(false);

    if (stopRef.current) {
      addLog(`\n⏹️ Остановлено. Найдено: ${found.length}`);
    } else if (found.length >= targetCount) {
      addLog(`\n🎉 Цель достигнута! Найдено: ${found.length}`);
    } else {
      addLog(`\n📭 Очередь пуста. Найдено: ${found.length}/${targetCount}`);
      addLog(`   Посещено узлов: ${visited.size}`);
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
    a.download = `steam_ids_${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadCsv = () => {
    if (results.length === 0) return;
    const header = 'SteamID,Name,Value,Items,Depth,FoundVia,ProfileURL\n';
    const rows = results
      .map(r => `${r.steamId},"${r.displayName}",${r.inventoryValue.toFixed(2)},${r.itemCount},${r.depth},${r.foundVia},${r.profileUrl}`)
      .join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `steam_ids_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const clearAll = () => {
    setResults([]);
    setLogs([]);
    setStats({ scanned: 0, queue: 0, depth: 0, visited: 0 });
  };

  const progress = targetCount > 0 ? (results.length / targetCount) * 100 : 0;

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold flex items-center gap-2">
          <GitBranch className="w-5 h-5 text-indigo-400" />
          Цепочный парсер Steam ID
        </h2>
        <p className="text-white/40 text-sm">
          BFS обход: сид → друзья → друзья друзей → ...
        </p>
      </div>

      {/* Info */}
      <div className="glass-card rounded-xl p-3 flex items-start gap-3 text-xs text-white/50">
        <AlertCircle className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
        <div>
          <strong className="text-white/70">API ключ:</strong> <a href="https://steamcommunity.com/dev/apikey" target="_blank" className="text-indigo-400 underline">steamcommunity.com/dev/apikey</a>
          <span className="mx-2">|</span>
          <strong className="text-white/70">Прокси:</strong> нужен для обхода CORS
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Left: Settings */}
        <div className="space-y-4">
          {/* API Key + Proxy */}
          <div className="glass-card rounded-xl p-4 space-y-3">
            <div>
              <label className="text-white/40 text-[10px] flex items-center gap-1 mb-1">
                <Key className="w-3 h-3" /> Steam Web API Key
              </label>
              <input
                type="text"
                value={steamApiKey}
                onChange={e => setSteamApiKey(e.target.value)}
                className="w-full glass-input text-sm text-white px-3 py-2 rounded-lg outline-none font-mono"
                placeholder="Ваш API ключ..."
                disabled={isRunning}
              />
            </div>
            
            <div>
              <label className="text-white/40 text-[10px] flex items-center gap-1 mb-1">
                <Globe className="w-3 h-3" /> CORS Прокси
              </label>
              <input
                type="text"
                value={proxyUrl}
                onChange={e => setProxyUrl(e.target.value)}
                className="w-full glass-input text-sm text-white px-3 py-2 rounded-lg outline-none font-mono"
                placeholder="https://corsproxy.io/?"
                disabled={isRunning}
              />
              <div className="flex flex-wrap gap-1 mt-2">
                {[
                  ['corsproxy.io', 'https://corsproxy.io/?'],
                  ['allorigins', 'https://api.allorigins.win/raw?url='],
                  ['codetabs', 'https://api.codetabs.com/v1/proxy?quest='],
                ].map(([name, url]) => (
                  <button 
                    key={name}
                    onClick={() => setProxyUrl(url)}
                    disabled={isRunning}
                    className={`text-[10px] px-2 py-0.5 rounded ${proxyUrl === url ? 'bg-indigo-500/30 text-indigo-300' : 'bg-white/5 text-white/40 hover:bg-white/10'}`}
                  >
                    {name}
                  </button>
                ))}
                <button 
                  onClick={testProxy}
                  disabled={isRunning}
                  className="text-[10px] px-2 py-0.5 rounded bg-green-500/20 text-green-400 hover:bg-green-500/30"
                >
                  🔄 Тест
                </button>
              </div>
            </div>
          </div>

          {/* Seeds */}
          <div className="glass-card rounded-xl p-4 space-y-2">
            <label className="text-white/40 text-[10px] flex items-center gap-1">
              <Users className="w-3 h-3" /> Сид Steam ID (начальные точки)
            </label>
            <textarea
              value={seedInput}
              onChange={e => setSeedInput(e.target.value)}
              className="w-full glass-input text-xs text-white p-2 rounded-lg outline-none h-16 resize-none font-mono"
              placeholder={"76561198012345678\n76561198087654321"}
              disabled={isRunning}
            />
          </div>

          {/* Parameters */}
          <div className="glass-card rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-1 text-white/40 text-[10px]">
              <Settings className="w-3 h-3" /> Параметры
            </div>

            <div className="grid grid-cols-4 gap-2">
              <div>
                <label className="text-white/30 text-[9px] block">Мин $</label>
                <input
                  type="number"
                  value={minValue}
                  onChange={e => setMinValue(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full glass-input text-xs text-white px-2 py-1.5 rounded-lg outline-none"
                  disabled={isRunning}
                />
              </div>
              <div>
                <label className="text-white/30 text-[9px] block">Макс $</label>
                <input
                  type="number"
                  value={maxValue}
                  onChange={e => setMaxValue(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full glass-input text-xs text-white px-2 py-1.5 rounded-lg outline-none"
                  disabled={isRunning}
                />
              </div>
              <div>
                <label className="text-white/30 text-[9px] block">Найти</label>
                <input
                  type="number"
                  value={targetCount}
                  onChange={e => setTargetCount(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full glass-input text-xs text-white px-2 py-1.5 rounded-lg outline-none"
                  disabled={isRunning}
                />
              </div>
              <div>
                <label className="text-white/30 text-[9px] block">Глубина</label>
                <input
                  type="number"
                  value={maxDepth}
                  onChange={e => setMaxDepth(Math.min(15, Math.max(1, parseInt(e.target.value) || 1)))}
                  className="w-full glass-input text-xs text-white px-2 py-1.5 rounded-lg outline-none"
                  disabled={isRunning}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-white/30 text-[9px] block">Задержка мс</label>
                <input
                  type="number"
                  value={requestDelay}
                  onChange={e => setRequestDelay(Math.max(200, parseInt(e.target.value) || 1000))}
                  className="w-full glass-input text-xs text-white px-2 py-1.5 rounded-lg outline-none"
                  disabled={isRunning}
                />
              </div>
              <div>
                <label className="text-white/30 text-[9px] block">Игра</label>
                <select
                  value={appId}
                  onChange={e => setAppId(parseInt(e.target.value))}
                  className="w-full glass-input text-xs text-white px-2 py-1.5 rounded-lg outline-none bg-transparent"
                  disabled={isRunning}
                >
                  <option value={730} className="bg-dark-800">CS2</option>
                  <option value={570} className="bg-dark-800">Dota 2</option>
                  <option value={440} className="bg-dark-800">TF2</option>
                  <option value={252490} className="bg-dark-800">Rust</option>
                </select>
              </div>
            </div>

            <div className="pt-1">
              {!isRunning ? (
                <button
                  onClick={startParsing}
                  disabled={!steamApiKey}
                  className="w-full glass-btn py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-30"
                >
                  <Play className="w-4 h-4" /> Запустить
                </button>
              ) : (
                <button
                  onClick={stopParsing}
                  className="w-full py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-2 bg-red-500/20 border border-red-500/30 text-red-400"
                >
                  <Square className="w-4 h-4" /> Стоп
                </button>
              )}
            </div>
          </div>

          {/* Status */}
          <div className="glass-card rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-white/40 text-xs">Прогресс</span>
              <span className="text-base font-bold text-indigo-400">{results.length} / {targetCount}</span>
            </div>
            <div className="w-full bg-white/5 rounded-full h-1.5">
              <div
                className="bg-gradient-to-r from-indigo-500 to-purple-500 h-1.5 rounded-full transition-all"
                style={{ width: `${Math.min(100, progress)}%` }}
              />
            </div>
            <div className="grid grid-cols-4 gap-2 text-[10px] text-white/30 text-center">
              <div>
                <div className="text-white/60 font-medium">{stats.scanned}</div>
                <div>узлов</div>
              </div>
              <div>
                <div className="text-white/60 font-medium">{stats.queue}</div>
                <div>очередь</div>
              </div>
              <div>
                <div className="text-white/60 font-medium">{stats.depth}</div>
                <div>глубина</div>
              </div>
              <div>
                <div className="text-white/60 font-medium">{stats.visited}</div>
                <div>посещено</div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Logs & Results */}
        <div className="space-y-4">
          {/* Logs */}
          <div className="glass-card rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">📝 Лог</h3>
              <button onClick={() => setLogs([])} className="text-[10px] text-white/20 hover:text-white/40">
                Очистить
              </button>
            </div>
            <div
              ref={logsRef}
              className="h-56 overflow-y-auto text-[10px] font-mono space-y-0.5 bg-black/20 rounded-lg p-2"
            >
              {logs.length === 0 ? (
                <div className="text-white/20">Логи появятся здесь...</div>
              ) : (
                logs.map((log, i) => (
                  <div
                    key={i}
                    className={`${
                      log.includes('✅') ? 'text-green-400' :
                      log.includes('❌') || log.includes('🔴') ? 'text-red-400' :
                      log.includes('⚠️') || log.includes('⏳') ? 'text-orange-400' :
                      log.includes('🎉') ? 'text-yellow-400' :
                      log.includes('📊') ? 'text-blue-400' :
                      'text-white/40'
                    }`}
                  >
                    {log}
                  </div>
                ))
              )}
              {isRunning && (
                <div className="flex items-center gap-1 text-indigo-400 pt-1">
                  <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-pulse" />
                  Работает...
                </div>
              )}
            </div>
          </div>

          {/* Results */}
          <div className="glass-card rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Layers className="w-4 h-4" /> Найдено ({results.length})
              </h3>
              <div className="flex gap-1">
                {results.length > 0 && (
                  <>
                    <button onClick={downloadResults} className="text-[10px] glass-btn px-2 py-1 rounded flex items-center gap-1">
                      <Download className="w-3 h-3" /> TXT
                    </button>
                    <button onClick={downloadCsv} className="text-[10px] glass-btn px-2 py-1 rounded flex items-center gap-1">
                      <Download className="w-3 h-3" /> CSV
                    </button>
                    <button onClick={clearAll} className="text-[10px] px-2 py-1 rounded text-red-400/50 hover:text-red-400">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </>
                )}
              </div>
            </div>

            {results.length === 0 ? (
              <div className="text-center py-8">
                <Search className="w-6 h-6 text-white/10 mx-auto" />
                <p className="text-white/20 text-xs mt-2">Результаты появятся здесь</p>
              </div>
            ) : (
              <div className="max-h-[300px] overflow-y-auto">
                <table className="w-full text-[10px]">
                  <thead>
                    <tr className="text-white/30 border-b border-white/5">
                      <th className="text-left p-1.5">#</th>
                      <th className="text-left p-1.5">Профиль</th>
                      <th className="text-left p-1.5">$</th>
                      <th className="text-left p-1.5">Шт</th>
                      <th className="text-left p-1.5">D</th>
                      <th className="text-left p-1.5"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((r, i) => (
                      <tr key={r.steamId} className="border-b border-white/5 hover:bg-white/5">
                        <td className="p-1.5 text-white/30">{i + 1}</td>
                        <td className="p-1.5">
                          <div className="flex items-center gap-1.5">
                            {r.avatarUrl && <img src={r.avatarUrl} className="w-4 h-4 rounded" alt="" />}
                            <div>
                              <div className="text-white/80 truncate max-w-[90px]">{r.displayName}</div>
                              <div className="text-white/20 text-[8px] font-mono">{r.steamId}</div>
                            </div>
                          </div>
                        </td>
                        <td className="p-1.5 text-green-400">{r.inventoryValue.toFixed(0)}</td>
                        <td className="p-1.5 text-white/50">{r.itemCount}</td>
                        <td className="p-1.5">
                          <span className={`px-1 py-0.5 rounded text-[8px] ${
                            r.depth === 0 ? 'bg-yellow-500/20 text-yellow-400' :
                            r.depth === 1 ? 'bg-blue-500/20 text-blue-400' :
                            'bg-purple-500/20 text-purple-400'
                          }`}>
                            {r.depth}
                          </span>
                        </td>
                        <td className="p-1.5">
                          <a href={r.profileUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300">
                            <Link className="w-3 h-3" />
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
