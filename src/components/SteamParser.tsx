import { useState, useEffect, useRef } from 'react';
import { Search, Play, Square, Download, Trash2 } from 'lucide-react';
import { parserApi } from '../api';
import type { ParserJob, ParserResult } from '../types';

export default function SteamParser() {
  const [minPrice, setMinPrice] = useState(100);
  const [maxPrice, setMaxPrice] = useState(10000);
  const [maxResults, setMaxResults] = useState(100);
  const [startIds, setStartIds] = useState('');
  const [activeJob, setActiveJob] = useState<ParserJob | null>(null);
  const [results, setResults] = useState<ParserResult[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const parsedStartIds = startIds
    .split('\n')
    .map(s => s.trim())
    .filter(Boolean);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const startPolling = (jobId: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      const job = await parserApi.getParserStatus(jobId);
      if (job) {
        setActiveJob(job);
        setLogs(job.logs || []);
        if (job.status === 'completed' || job.status === 'error') {
          if (pollRef.current) clearInterval(pollRef.current);
          const res = await parserApi.getParserResults(jobId);
          setResults(res.results || []);
        }
      }
    }, 2000);
  };

  const handleStart = async () => {
    const result = await parserApi.startParser({
      apiKey: '',
      startIds: parsedStartIds,
      minPrice,
      maxPrice,
      maxDepth: 3,
      maxFriendsPerLevel: maxResults,
      threads: 1,
    });
    if (result.jobId) {
      const job = await parserApi.getParserStatus(result.jobId as string);
      if (job) {
        setActiveJob(job);
        startPolling(result.jobId as string);
      }
    }
  };

  const handleStop = async () => {
    if (!activeJob) return;
    await parserApi.stopParser(activeJob.id);
    if (pollRef.current) clearInterval(pollRef.current);
    setActiveJob(prev => prev ? { ...prev, status: 'completed' } : null);
  };

  const handleExport = async () => {
    if (!activeJob) return;
    const blob = await parserApi.exportResults(activeJob.id, 'txt');
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `parser_results_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleClear = async () => {
    if (!activeJob) return;
    await parserApi.clearResults(activeJob.id);
    setResults([]);
    setActiveJob(null);
    setLogs([]);
  };

  const isRunning = activeJob?.status === 'running';
  const stats = activeJob?.stats;

  return (
    <div className="p-6 space-y-6 animate-fade-in overflow-y-auto max-h-[calc(100vh-52px)]">
      <div>
        <h1 className="text-2xl font-semibold text-white flex items-center gap-2">
          <Search size={24} />
          Парсер Steam ID
        </h1>
        <p className="text-sm text-white/40 mt-1">
          Поиск Steam аккаунтов по стоимости инвентаря
        </p>
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
              <span className="text-[10px] text-indigo-400 ml-2">{parsedStartIds.length} ID</span>
            )}
            <textarea
              value={startIds}
              onChange={e => setStartIds(e.target.value)}
              disabled={isRunning}
              placeholder="76561198000000000&#10;76561198000000001&#10;(пусто = случайные)"
              className="w-full glass-input text-xs text-white p-3 rounded-xl outline-none h-24 resize-none font-mono mt-1"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-white/50 mb-1 block">Мин. стоимость ($)</label>
              <input
                type="number"
                value={minPrice}
                onChange={e => setMinPrice(parseInt(e.target.value) || 0)}
                disabled={isRunning}
                min={0}
                className="w-full glass-input text-sm text-white px-3 py-2 rounded-xl outline-none"
              />
            </div>
            <div>
              <label className="text-xs text-white/50 mb-1 block">Макс. стоимость ($)</label>
              <input
                type="number"
                value={maxPrice}
                onChange={e => setMaxPrice(parseInt(e.target.value) || 0)}
                disabled={isRunning}
                min={0}
                className="w-full glass-input text-sm text-white px-3 py-2 rounded-xl outline-none"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-white/50 mb-1 block">Макс. результатов</label>
            <input
              type="number"
              value={maxResults}
              onChange={e => setMaxResults(parseInt(e.target.value) || 100)}
              disabled={isRunning}
              min={1}
              max={50000}
              className="w-full glass-input text-sm text-white px-3 py-2 rounded-xl outline-none"
            />
          </div>

          <div className="flex gap-2">
            {!isRunning ? (
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
                  onClick={handleExport}
                  className="flex items-center gap-2 px-4 py-3 rounded-xl bg-blue-500/20 text-blue-400 text-sm hover:bg-blue-500/30 transition-colors"
                >
                  <Download size={16} /> Скачать
                </button>
                <button
                  onClick={handleClear}
                  className="flex items-center gap-2 px-4 py-3 rounded-xl bg-white/5 text-white/40 text-sm hover:bg-white/10 transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="space-y-4">
          {stats && (
            <div className="glass-card rounded-2xl p-4">
              <h3 className="text-sm font-semibold text-white mb-3">Статистика</h3>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Проверено', value: stats.checked, color: 'text-white' },
                  { label: 'Найдено', value: stats.foundValuable, color: 'text-green-400' },
                  { label: 'Ошибок', value: stats.errors, color: 'text-red-400' },
                  { label: 'Приватных', value: stats.skippedPrivate, color: 'text-yellow-400' },
                  { label: 'Пустых', value: stats.emptyInventory, color: 'text-gray-400' },
                  { label: 'Очередь', value: stats.queueSize, color: 'text-blue-400' },
                ].map(item => (
                  <div key={item.label} className="bg-white/5 rounded-xl p-2 text-center">
                    <div className={`text-base font-bold ${item.color}`}>{item.value}</div>
                    <div className="text-[10px] text-white/30">{item.label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Logs */}
          <div className="glass-card rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-white/5">
              <h3 className="text-sm font-semibold text-white">Логи</h3>
            </div>
            <div className="max-h-48 overflow-y-auto p-3 space-y-1">
              {logs.length === 0 ? (
                <div className="text-xs text-white/20 text-center py-4">Нет логов</div>
              ) : (
                logs.map((log, i) => (
                  <div key={i} className="text-[10px] text-white/50 font-mono">
                    {log}
                  </div>
                ))
              )}
              <div ref={logsEndRef} />
            </div>
          </div>
        </div>
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div className="glass-card rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">
              Результаты ({results.length})
            </h3>
          </div>
          <div className="max-h-96 overflow-y-auto divide-y divide-white/5">
            {results.map((result, i) => (
              <div key={i} className="px-4 py-3 flex items-center gap-3">
                <div className="text-[10px] text-white/20 font-mono w-6">{i + 1}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-white font-medium truncate">
                    {result.profileName || result.steamId}
                  </div>
                  <div className="text-[10px] text-white/30 font-mono">{result.steamId}</div>
                </div>
                <div className="text-sm font-bold text-green-400">
                  ${result.inventoryValue.toFixed(2)}
                </div>
                <div className="text-xs text-white/30">{result.country}</div>
                <a
                  href={result.profileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] px-2 py-1 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20"
                >
                  Открыть
                </a>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
