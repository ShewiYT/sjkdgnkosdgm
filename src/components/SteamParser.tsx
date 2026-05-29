import { useState, useEffect, useRef } from 'react';
import { Search, Play, Square, Download, RefreshCw, Trash2, AlertTriangle } from 'lucide-react';
import { parserApi } from '../api';
import type { ParserJob } from '../types';

export default function SteamParser() {
  const [jobs, setJobs] = useState<ParserJob[]>([]);
  const [startIds, setStartIds] = useState('');
  const [minPrice, setMinPrice] = useState(10);
  const [maxPrice, setMaxPrice] = useState(10000);
  const [maxDepth] = useState(3);
  const [threads] = useState(1);
  const [apiKey, setApiKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedJob, setSelectedJob] = useState<string | null>(null);
  const logsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadJobs();
    const interval = setInterval(loadJobs, 3000);
    return () => clearInterval(interval);
  }, []);

  // Auto-scroll logs
  useEffect(() => {
    if (logsRef.current) {
      logsRef.current.scrollTop = logsRef.current.scrollHeight;
    }
  }, [jobs, selectedJob]);

  const loadJobs = async () => {
    const activeJobs = await parserApi.getActiveJobs();
    setJobs(prev => {
      // Keep existing jobs that might not be returned anymore, merge with new
      if (activeJobs.length > 0) return activeJobs;
      return prev;
    });
  };

  const handleStart = async () => {
    const ids = startIds.split(/[\n,\s]+/).filter(id => id.trim() && /^[0-9]+$/.test(id.trim()));
    if (ids.length === 0) return;
    setLoading(true);
    const result = await parserApi.startParser({
      apiKey,
      startIds: ids,
      minPrice,
      maxPrice,
      maxDepth,
      maxFriendsPerLevel: 100,
      threads,
    });
    setLoading(false);
    if (result.success && result.jobId) {
      setSelectedJob(result.jobId);
    }
    // Wait a bit and reload
    setTimeout(loadJobs, 1000);
  };

  const handleStop = async (jobId: string) => {
    await parserApi.stopParser(jobId);
    setTimeout(loadJobs, 1000);
  };

  const handleExport = async (jobId: string) => {
    const blob = await parserApi.exportResults(jobId, 'txt');
    if (blob && blob.size > 0) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `parser_results_${jobId}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const handleClear = async (jobId: string) => {
    await parserApi.clearResults(jobId);
    setJobs(prev => prev.filter(j => j.id !== jobId));
    if (selectedJob === jobId) setSelectedJob(null);
  };

  const activeJob = selectedJob ? jobs.find(j => j.id === selectedJob) : jobs[0];
  const hasRunningJobs = jobs.some(j => j.status === 'running');

  return (
    <div className="p-6 space-y-6 animate-fade-in overflow-y-auto max-h-[calc(100vh-52px)]">
      <div>
        <h1 className="text-2xl font-semibold text-white flex items-center gap-2">
          <Search size={24} />
          Парсер Steam ID
        </h1>
        <p className="text-sm text-white/40 mt-1">
          Поиск аккаунтов с ценным инвентарём CS2
          {hasRunningJobs && (
            <span className="ml-2 inline-flex items-center gap-1 text-green-400">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              Парсинг идёт на сервере
            </span>
          )}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Settings */}
        <div className="glass-card rounded-2xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-white">Настройки парсера</h3>

          <div className="flex items-start gap-2 p-2 rounded-lg bg-yellow-500/5 border border-yellow-500/10">
            <AlertTriangle size={14} className="text-yellow-400 mt-0.5 shrink-0" />
            <div className="text-[10px] text-yellow-300/70">
              Парсер работает на сервере. Можно закрыть вкладку — парсинг продолжится. 
              Генерирует случайные Steam ID и проверяет инвентарь CS2.
            </div>
          </div>

          <div>
            <label className="text-xs text-white/50 mb-1 block">Steam API Key (опционально — для имён/стран)</label>
            <input type="text" value={apiKey} onChange={e => setApiKey(e.target.value)}
              placeholder="Ваш Steam API ключ" className="w-full glass-input text-sm text-white px-3 py-2 rounded-xl outline-none font-mono" />
            <div className="text-[10px] text-white/20 mt-1">
              Получить: <a href="https://steamcommunity.com/dev/apikey" target="_blank" className="text-indigo-400 hover:underline">steamcommunity.com/dev/apikey</a>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-white/50">Начальные Steam ID (или случайные)</label>
              {startIds && (
                <span className="text-[10px] text-indigo-400">
                  {startIds.split(/[\n,\s]+/).filter(id => id.trim() && /^[0-9]+$/.test(id.trim())).length} ID
                </span>
              )}
            </div>
            <textarea value={startIds} onChange={e => setStartIds(e.target.value)}
              placeholder={"76561198000000000\n76561198000000001\n...\n\nЕсли пусто — генерируются случайные ID"}
              className="w-full glass-input text-xs text-white p-3 rounded-xl outline-none h-28 resize-none font-mono" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-white/50 mb-1 block">Мин. стоимость ($)</label>
              <input type="number" value={minPrice} onChange={e => setMinPrice(parseInt(e.target.value) || 0)}
                className="w-full glass-input text-sm text-white px-3 py-2 rounded-xl outline-none" />
            </div>
            <div>
              <label className="text-xs text-white/50 mb-1 block">Макс. стоимость ($)</label>
              <input type="number" value={maxPrice} onChange={e => setMaxPrice(parseInt(e.target.value) || 10000)}
                className="w-full glass-input text-sm text-white px-3 py-2 rounded-xl outline-none" />
            </div>
          </div>

          <button onClick={handleStart} disabled={loading || hasRunningJobs}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-green-500/20 text-green-400 text-sm hover:bg-green-500/30 transition-colors disabled:opacity-30">
            {loading ? (
              <><RefreshCw size={16} className="animate-spin" /> Запуск...</>
            ) : hasRunningJobs ? (
              <><RefreshCw size={16} className="animate-spin" /> Парсер уже работает</>
            ) : (
              <><Play size={16} /> Запустить парсер</>
            )}
          </button>
        </div>

        {/* Active job */}
        <div className="space-y-4">
          {/* Job tabs */}
          {jobs.length > 1 && (
            <div className="flex gap-1 overflow-x-auto">
              {jobs.map(job => (
                <button key={job.id} onClick={() => setSelectedJob(job.id)}
                  className={`shrink-0 px-3 py-1.5 rounded-lg text-xs transition-colors ${
                    (selectedJob || jobs[0]?.id) === job.id
                      ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/60'
                  }`}>
                  <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 ${
                    job.status === 'running' ? 'bg-green-400 animate-pulse' :
                    job.status === 'completed' ? 'bg-blue-400' :
                    job.status === 'error' ? 'bg-red-400' : 'bg-gray-500'
                  }`} />
                  {job.id.slice(0, 8)}
                </button>
              ))}
            </div>
          )}

          {!activeJob ? (
            <div className="glass-card rounded-2xl p-12 text-center">
              <Search size={48} className="mx-auto mb-4 text-white/10" />
              <div className="text-sm text-white/30">Нет заданий</div>
              <div className="text-xs text-white/20 mt-1">Запустите парсер для начала поиска</div>
            </div>
          ) : (
            <div className="glass-card rounded-2xl p-4 space-y-4">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full flex items-center gap-1 ${
                    activeJob.status === 'running' ? 'bg-green-500/20 text-green-400' :
                    activeJob.status === 'completed' ? 'bg-blue-500/20 text-blue-400' :
                    activeJob.status === 'error' ? 'bg-red-500/20 text-red-400' :
                    'bg-yellow-500/20 text-yellow-400'
                  }`}>
                    {activeJob.status === 'running' && <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />}
                    {activeJob.status === 'running' ? 'Работает' :
                     activeJob.status === 'completed' ? 'Завершён' :
                     activeJob.status === 'error' ? 'Ошибка' : activeJob.status}
                  </span>
                  <span className="text-[10px] text-white/20 font-mono">{activeJob.id.slice(0, 12)}</span>
                </div>
                <div className="flex gap-1">
                  {activeJob.status === 'running' && (
                    <button onClick={() => handleStop(activeJob.id)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-red-400 bg-red-500/10 text-xs hover:bg-red-500/20">
                      <Square size={12} /> Стоп
                    </button>
                  )}
                  <button onClick={() => handleExport(activeJob.id)}
                    className="p-1.5 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/5" title="Скачать .txt">
                    <Download size={14} />
                  </button>
                  {activeJob.status !== 'running' && (
                    <button onClick={() => handleClear(activeJob.id)}
                      className="p-1.5 rounded-lg text-red-400/30 hover:text-red-400 hover:bg-red-500/10" title="Удалить">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-4 gap-2">
                <div className="text-center p-2 rounded-lg bg-white/3">
                  <div className="text-sm font-bold text-white">{activeJob.stats?.checked || 0}</div>
                  <div className="text-[9px] text-white/40">Проверено</div>
                </div>
                <div className="text-center p-2 rounded-lg bg-green-500/5">
                  <div className="text-sm font-bold text-green-400">{activeJob.stats?.foundValuable || 0}</div>
                  <div className="text-[9px] text-white/40">Найдено</div>
                </div>
                <div className="text-center p-2 rounded-lg bg-white/3">
                  <div className="text-sm font-bold text-white/60">{activeJob.stats?.skippedPrivate || 0}</div>
                  <div className="text-[9px] text-white/40">Приватных</div>
                </div>
                <div className="text-center p-2 rounded-lg bg-red-500/5">
                  <div className="text-sm font-bold text-red-400">{activeJob.stats?.errors || 0}</div>
                  <div className="text-[9px] text-white/40">Ошибки</div>
                </div>
              </div>

              {/* Results */}
              {activeJob.results && activeJob.results.length > 0 && (
                <div>
                  <div className="text-xs text-white/50 mb-2">
                    Результаты ({activeJob.results.length})
                  </div>
                  <div className="max-h-40 overflow-y-auto space-y-1 rounded-xl bg-black/20 p-2">
                    {[...activeJob.results].reverse().map((r, i) => (
                      <div key={i} className="flex items-center justify-between text-[11px] px-2 py-1 rounded-lg hover:bg-white/5">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-green-400">✓</span>
                          <a href={r.profileUrl} target="_blank" rel="noopener"
                            className="text-white/70 hover:text-indigo-400 truncate">
                            {r.profileName || r.steamId}
                          </a>
                          {r.country && r.country !== 'Unknown' && (
                            <span className="text-[9px] text-white/20">{r.country}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-[10px] text-white/30">{r.itemsCount} шт</span>
                          <span className="text-green-400 font-medium">${r.inventoryValue.toFixed(2)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Logs */}
              {activeJob.logs && activeJob.logs.length > 0 && (
                <div>
                  <div className="text-xs text-white/50 mb-2">Логи</div>
                  <div ref={logsRef} className="max-h-32 overflow-y-auto rounded-xl bg-black/30 p-2 font-mono">
                    {activeJob.logs.slice(-30).map((log, i) => (
                      <div key={i} className={`text-[10px] py-0.5 ${
                        log.includes('✅') || log.includes('Найден') ? 'text-green-400/80' :
                        log.includes('ОШИБКА') || log.includes('error') ? 'text-red-400/80' :
                        log.includes('Rate limit') ? 'text-yellow-400/80' :
                        'text-white/30'
                      }`}>
                        {log}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Error */}
              {activeJob.error && (
                <div className="text-xs text-red-400 bg-red-500/10 rounded-lg p-2">
                  Ошибка: {activeJob.error}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
