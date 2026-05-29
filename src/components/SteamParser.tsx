import { useState, useEffect, useRef } from 'react';
import { 
  Search, Play, Square, Pause, Download, Trash2,
  Settings, Package, AlertTriangle, CheckCircle, Copy,
  ChevronDown, ChevronUp
} from 'lucide-react';
import { parserApi } from '../api';
import type { ParserJob, ParserResult, ParserConfig } from '../types';

export default function SteamParser() {
  // Config state
  const [apiKey, setApiKey] = useState('');
  const [startIds, setStartIds] = useState('');
  const [minPrice, setMinPrice] = useState(500);
  const [maxPrice, setMaxPrice] = useState(1000);
  const [maxDepth, setMaxDepth] = useState(3);
  const [maxFriends, setMaxFriends] = useState(20);
  const [threads, setThreads] = useState(3);
  
  // Job state
  const [currentJob, setCurrentJob] = useState<ParserJob | null>(null);
  const [jobs, setJobs] = useState<ParserJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Load saved API key
  useEffect(() => {
    const savedKey = localStorage.getItem('steam_api_key');
    if (savedKey) setApiKey(savedKey);
  }, []);

  // Save API key
  useEffect(() => {
    if (apiKey) localStorage.setItem('steam_api_key', apiKey);
  }, [apiKey]);

  // Poll for job status
  useEffect(() => {
    const pollStatus = async () => {
      // Get active jobs
      const activeJobs = await parserApi.getActiveJobs();
      setJobs(activeJobs);
      
      // If we have a current job, update its status
      if (currentJob?.id) {
        const job = await parserApi.getParserStatus(currentJob.id);
        if (job) {
          setCurrentJob(job);
        }
      } else if (activeJobs.length > 0 && activeJobs[0].status === 'running') {
        // Auto-select running job
        setCurrentJob(activeJobs[0]);
      }
    };

    pollStatus();
    const interval = setInterval(pollStatus, 2000);
    return () => clearInterval(interval);
  }, [currentJob?.id]);

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentJob?.logs]);

  const handleStart = async () => {
    if (!apiKey.trim()) {
      alert('Введите Steam API ключ');
      return;
    }

    const ids = startIds
      .split(/[\n,\s]+/)
      .map(id => id.trim())
      .filter(id => id.length > 0 && /^[0-9]+$/.test(id));

    if (ids.length === 0) {
      alert('Введите хотя бы один Steam ID');
      return;
    }

    setLoading(true);
    
    const config: ParserConfig = {
      apiKey,
      startIds: ids,
      minPrice,
      maxPrice,
      maxDepth,
      maxFriendsPerLevel: maxFriends,
      threads,
    };

    const result = await parserApi.startParser(config);
    
    if (result.success && result.jobId) {
      const job = await parserApi.getParserStatus(result.jobId);
      if (job) setCurrentJob(job);
    } else {
      alert(result.error || 'Ошибка запуска парсера');
    }
    
    setLoading(false);
  };

  const handleStop = async () => {
    if (!currentJob?.id) return;
    await parserApi.stopParser(currentJob.id);
  };

  const handlePause = async () => {
    if (!currentJob?.id) return;
    if (currentJob.status === 'paused') {
      await parserApi.resumeParser(currentJob.id);
    } else {
      await parserApi.pauseParser(currentJob.id);
    }
  };

  const handleExport = async (format: 'txt' | 'json' | 'csv') => {
    if (!currentJob?.id) return;
    
    const blob = await parserApi.exportResults(currentJob.id, format);
    if (!blob) return;

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `steam_ids_${new Date().toISOString().split('T')[0]}.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleClear = async () => {
    if (!currentJob?.id) return;
    if (!confirm('Очистить результаты?')) return;
    await parserApi.clearResults(currentJob.id);
    setCurrentJob(null);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(text);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const copyAllResults = () => {
    if (!currentJob?.results) return;
    const text = currentJob.results.map(r => r.steamId).join('\n');
    navigator.clipboard.writeText(text);
    setCopiedId('all');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const isRunning = currentJob?.status === 'running';
  const isPaused = currentJob?.status === 'paused';

  return (
    <div className="p-6 space-y-6 animate-fade-in overflow-y-auto max-h-[calc(100vh-52px)]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white flex items-center gap-2">
            <Search size={24} />
            Steam Парсер
          </h1>
          <p className="text-sm text-white/40 mt-1">
            Поиск Steam ID по стоимости инвентаря
          </p>
        </div>
        
        {jobs.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-white/40">Активных задач:</span>
            <span className="text-xs px-2 py-1 rounded-full bg-indigo-500/20 text-indigo-400">
              {jobs.filter(j => j.status === 'running').length}
            </span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Settings panel */}
        <div className="space-y-4">
          <div className="glass-card rounded-2xl overflow-hidden">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Settings size={16} className="text-indigo-400" />
                <span className="text-sm font-semibold text-white">Настройки парсера</span>
              </div>
              {showSettings ? <ChevronUp size={16} className="text-white/40" /> : <ChevronDown size={16} className="text-white/40" />}
            </button>

            {showSettings && (
              <div className="p-4 border-t border-white/5 space-y-4">
                {/* API Key */}
                <div>
                  <label className="text-xs text-white/50 mb-1 block">Steam API Key</label>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={e => setApiKey(e.target.value)}
                    disabled={isRunning}
                    placeholder="Ваш Steam API ключ"
                    className="w-full glass-input text-sm text-white px-3 py-2 rounded-xl outline-none font-mono disabled:opacity-50"
                  />
                  <div className="text-[10px] text-white/20 mt-1">
                    Получить: <a href="https://steamcommunity.com/dev/apikey" target="_blank" className="text-indigo-400 hover:underline">steamcommunity.com/dev/apikey</a>
                  </div>
                </div>

                {/* Start IDs */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs text-white/50">Начальные Steam ID</label>
                    {startIds && (
                      <span className="text-xs text-indigo-400">
                        {startIds.split(/[\n,\s]+/).filter(id => id.trim() && /^[0-9]+$/.test(id.trim())).length} ID
                      </span>
                    )}
                  </div>
                  <textarea
                    value={startIds}
                    onChange={e => setStartIds(e.target.value)}
                    disabled={isRunning}
                    placeholder={"76561198123456789\n76561198987654321\n..."}
                    className="w-full glass-input text-xs text-white p-3 rounded-xl outline-none h-24 resize-none font-mono disabled:opacity-50"
                  />
                </div>

                {/* Price range */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-white/50 mb-1 block">Мин. цена ($)</label>
                    <input
                      type="number"
                      value={minPrice}
                      onChange={e => setMinPrice(Number(e.target.value))}
                      disabled={isRunning}
                      min={0}
                      className="w-full glass-input text-sm text-white px-3 py-2 rounded-xl outline-none disabled:opacity-50"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-white/50 mb-1 block">Макс. цена ($)</label>
                    <input
                      type="number"
                      value={maxPrice}
                      onChange={e => setMaxPrice(Number(e.target.value))}
                      disabled={isRunning}
                      min={0}
                      className="w-full glass-input text-sm text-white px-3 py-2 rounded-xl outline-none disabled:opacity-50"
                    />
                  </div>
                </div>

                {/* Depth and friends */}
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-white/50 mb-1 block">Глубина</label>
                    <input
                      type="number"
                      value={maxDepth}
                      onChange={e => setMaxDepth(Math.max(1, Math.min(5, Number(e.target.value))))}
                      disabled={isRunning}
                      min={1}
                      max={5}
                      className="w-full glass-input text-sm text-white px-3 py-2 rounded-xl outline-none disabled:opacity-50"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-white/50 mb-1 block">Друзей/ур.</label>
                    <input
                      type="number"
                      value={maxFriends}
                      onChange={e => setMaxFriends(Math.max(1, Math.min(100, Number(e.target.value))))}
                      disabled={isRunning}
                      min={1}
                      max={100}
                      className="w-full glass-input text-sm text-white px-3 py-2 rounded-xl outline-none disabled:opacity-50"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-white/50 mb-1 block">Потоков</label>
                    <input
                      type="number"
                      value={threads}
                      onChange={e => setThreads(Math.max(1, Math.min(10, Number(e.target.value))))}
                      disabled={isRunning}
                      min={1}
                      max={10}
                      className="w-full glass-input text-sm text-white px-3 py-2 rounded-xl outline-none disabled:opacity-50"
                    />
                  </div>
                </div>

                {/* Info */}
                <div className="text-[10px] text-white/30 space-y-1">
                  <div>• Исключаются страны СНГ (RU, UA, BY, KZ и др.)</div>
                  <div>• Парсер работает на сервере (не остановится при закрытии вкладки)</div>
                  <div>• Результаты сохраняются в базу данных</div>
                </div>
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2">
            {!isRunning && !isPaused ? (
              <button
                onClick={handleStart}
                disabled={loading || !apiKey.trim()}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-green-500/20 text-green-400 text-sm hover:bg-green-500/30 transition-colors disabled:opacity-30"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-green-400/30 border-t-green-400 rounded-full animate-spin" />
                ) : (
                  <Play size={16} />
                )}
                Запустить
              </button>
            ) : (
              <>
                <button
                  onClick={handlePause}
                  className="flex items-center gap-2 px-4 py-3 rounded-xl bg-yellow-500/20 text-yellow-400 text-sm hover:bg-yellow-500/30 transition-colors"
                >
                  {isPaused ? <Play size={16} /> : <Pause size={16} />}
                  {isPaused ? 'Продолжить' : 'Пауза'}
                </button>
                <button
                  onClick={handleStop}
                  className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/20 text-red-400 text-sm hover:bg-red-500/30 transition-colors"
                >
                  <Square size={16} />
                  Стоп
                </button>
              </>
            )}
          </div>

          {/* Stats */}
          {currentJob && (
            <div className="glass-card rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">Статистика</h3>
                <span className={`text-xs px-2 py-1 rounded-full ${
                  currentJob.status === 'running' ? 'bg-green-500/20 text-green-400' :
                  currentJob.status === 'paused' ? 'bg-yellow-500/20 text-yellow-400' :
                  currentJob.status === 'completed' ? 'bg-blue-500/20 text-blue-400' :
                  'bg-white/10 text-white/50'
                }`}>
                  {currentJob.status === 'running' ? '🟢 Работает' :
                   currentJob.status === 'paused' ? '🟡 Пауза' :
                   currentJob.status === 'completed' ? '🔵 Завершён' :
                   currentJob.status}
                </span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="text-center">
                  <div className="text-lg font-bold text-white">{currentJob.stats.checked}</div>
                  <div className="text-[10px] text-white/40">Проверено</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-green-400">{currentJob.results.length}</div>
                  <div className="text-[10px] text-white/40">Найдено</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-white">{currentJob.stats.inventoryChecked}</div>
                  <div className="text-[10px] text-white/40">Инвентарей</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-red-400">{currentJob.stats.errors}</div>
                  <div className="text-[10px] text-white/40">Ошибок</div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 text-[10px]">
                <div className="flex justify-between">
                  <span className="text-white/40">СНГ пропущено:</span>
                  <span className="text-white/60">{currentJob.stats.skippedCis}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/40">Приватных:</span>
                  <span className="text-white/60">{currentJob.stats.skippedPrivate}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/40">Уровень:</span>
                  <span className="text-white/60">{currentJob.stats.currentLevel}</span>
                </div>
              </div>

              {currentJob.stats.queueSize > 0 && (
                <div className="text-[10px] text-white/30">
                  В очереди: {currentJob.stats.queueSize} пользователей
                </div>
              )}
            </div>
          )}

          {/* Logs */}
          {currentJob?.logs && currentJob.logs.length > 0 && (
            <div className="glass-card rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-white/5">
                <h3 className="text-sm font-semibold text-white">Логи</h3>
              </div>
              <div className="max-h-48 overflow-y-auto p-3 font-mono text-[10px] space-y-0.5">
                {currentJob.logs.slice(-100).map((log, i) => (
                  <div key={i} className={`${
                    log.includes('НАЙДЕН') || log.includes('★') ? 'text-green-400' :
                    log.includes('Ошибка') || log.includes('Error') ? 'text-red-400' :
                    log.includes('Пропуск') ? 'text-yellow-400' :
                    'text-white/50'
                  }`}>
                    {log}
                  </div>
                ))}
                <div ref={logsEndRef} />
              </div>
            </div>
          )}
        </div>

        {/* Results panel */}
        <div className="space-y-4">
          <div className="glass-card rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package size={16} className="text-green-400" />
                <h3 className="text-sm font-semibold text-white">
                  Результаты ({currentJob?.results.length || 0})
                </h3>
              </div>
              
              {currentJob?.results && currentJob.results.length > 0 && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={copyAllResults}
                    className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white/70"
                    title="Копировать все ID"
                  >
                    {copiedId === 'all' ? <CheckCircle size={14} className="text-green-400" /> : <Copy size={14} />}
                  </button>
                  <button
                    onClick={() => handleExport('txt')}
                    className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white/70"
                    title="Скачать TXT"
                  >
                    <Download size={14} />
                  </button>
                  <button
                    onClick={handleClear}
                    className="p-1.5 rounded-lg hover:bg-red-500/20 text-red-400/40 hover:text-red-400"
                    title="Очистить"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )}
            </div>

            <div className="max-h-[500px] overflow-y-auto divide-y divide-white/5">
              {!currentJob?.results || currentJob.results.length === 0 ? (
                <div className="p-12 text-center">
                  <Search size={48} className="mx-auto mb-4 text-white/10" />
                  <div className="text-sm text-white/30">Нет результатов</div>
                  <div className="text-xs text-white/20 mt-1">Запустите парсер для поиска</div>
                </div>
              ) : (
                currentJob.results.map((result: ParserResult, i: number) => (
                  <div key={result.steamId} className="px-4 py-3 hover:bg-white/5 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-white/30 w-6">#{i + 1}</span>
                        <div>
                          <div className="text-sm text-white font-mono">
                            {result.steamId}
                          </div>
                          {result.profileName && (
                            <div className="text-[10px] text-white/40">{result.profileName}</div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className="text-sm font-bold text-green-400">${result.inventoryValue.toFixed(2)}</div>
                          <div className="text-[10px] text-white/30">{result.itemsCount} предметов</div>
                        </div>
                        <button
                          onClick={() => copyToClipboard(result.steamId)}
                          className="p-1.5 rounded-lg hover:bg-white/10 text-white/30 hover:text-white/60"
                        >
                          {copiedId === result.steamId ? (
                            <CheckCircle size={14} className="text-green-400" />
                          ) : (
                            <Copy size={14} />
                          )}
                        </button>
                      </div>
                    </div>
                    {result.country && (
                      <div className="mt-1 text-[10px] text-white/20">
                        🌍 {result.country} • {new Date(result.foundAt).toLocaleTimeString('ru')}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Export buttons */}
          {currentJob?.results && currentJob.results.length > 0 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleExport('txt')}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 text-white/60 text-xs hover:bg-white/10 transition-colors"
              >
                <Download size={14} />
                Скачать TXT
              </button>
              <button
                onClick={() => handleExport('json')}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 text-white/60 text-xs hover:bg-white/10 transition-colors"
              >
                <Download size={14} />
                Скачать JSON
              </button>
              <button
                onClick={() => handleExport('csv')}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 text-white/60 text-xs hover:bg-white/10 transition-colors"
              >
                <Download size={14} />
                Скачать CSV
              </button>
            </div>
          )}

          {/* Info */}
          <div className="glass-card rounded-xl p-3 text-[10px] text-white/30 space-y-1">
            <div className="flex items-center gap-1">
              <AlertTriangle size={12} className="text-yellow-400" />
              <span>Парсер работает на сервере в фоновом режиме</span>
            </div>
            <div>• Можно закрыть вкладку - парсер продолжит работу</div>
            <div>• Результаты сохраняются в SQLite базу данных</div>
            <div>• Многопоточность: до {threads} потоков параллельно</div>
          </div>
        </div>
      </div>
    </div>
  );
}
