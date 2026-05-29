import { useState, useEffect } from 'react';
import { Search, Play, Square, Download, Pause } from 'lucide-react';
import { parserApi } from '../api';
import type { ParserJob } from '../types';

export default function SteamParser() {
  const [apiKey, setApiKey] = useState('');
  const [startIds, setStartIds] = useState('');
  const [minPrice, setMinPrice] = useState(10);
  const [maxPrice, setMaxPrice] = useState(10000);
  const [maxDepth, setMaxDepth] = useState(3);
  const [threads, setThreads] = useState(1);
  const [activeJob, setActiveJob] = useState<ParserJob | null>(null);
  const [statusInterval, setStatusInterval] = useState<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    parserApi.getActiveJobs().then(jobs => {
      if (jobs.length > 0) setActiveJob(jobs[0]);
    });
    return () => { if (statusInterval) clearInterval(statusInterval); };
  }, []);

  const startParser = async () => {
    const parsedStartIds = startIds.split('\n').map(s => s.trim()).filter(Boolean);
    const result = await parserApi.startParser({
      apiKey, startIds: parsedStartIds, minPrice, maxPrice, maxDepth, maxFriendsPerLevel: 50, threads,
    });
    if (result.success && result.jobId) {
      const job = await parserApi.getParserStatus(result.jobId as string);
      if (job) setActiveJob(job);
      const interval = setInterval(async () => {
        const updated = await parserApi.getParserStatus(result.jobId as string);
        if (updated) {
          setActiveJob(updated);
          if (updated.status === 'completed' || updated.status === 'error') clearInterval(interval);
        }
      }, 3000);
      setStatusInterval(interval);
    }
  };

  const stopParser = async () => {
    if (!activeJob) return;
    await parserApi.stopParser(activeJob.id);
    if (statusInterval) clearInterval(statusInterval);
    setActiveJob(prev => prev ? { ...prev, status: 'completed' } : null);
  };

  const exportResults = async (format: 'txt' | 'json' | 'csv') => {
    if (!activeJob) return;
    const blob = await parserApi.exportResults(activeJob.id, format);
    if (blob) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `results.${format}`; a.click();
      URL.revokeObjectURL(url);
    }
  };

  const isRunning = activeJob?.status === 'running';

  return (
    <div className="p-6 space-y-6 animate-fade-in overflow-y-auto max-h-[calc(100vh-52px)]">
      <div>
        <h1 className="text-2xl font-semibold text-white flex items-center gap-2"><Search size={24} /> Парсер Steam ID</h1>
        <p className="text-sm text-white/40 mt-1">Поиск аккаунтов с ценным инвентарём</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="glass-card rounded-2xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-white">Конфигурация</h3>
          <div>
            <label className="text-xs text-white/50 mb-1 block">Steam API Key</label>
            <input value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="API Key" className="w-full glass-input text-sm text-white px-3 py-2 rounded-xl outline-none font-mono" />
          </div>
          <div>
            <label className="text-xs text-white/50 mb-1 block">Начальные Steam ID</label>
            <textarea value={startIds} onChange={e => setStartIds(e.target.value)} placeholder="76561198..." className="w-full glass-input text-xs text-white p-3 rounded-xl outline-none h-24 resize-none font-mono" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-white/50 mb-1 block">Мин. цена ($)</label><input type="number" value={minPrice} onChange={e => setMinPrice(parseInt(e.target.value) || 0)} className="w-full glass-input text-sm text-white px-3 py-2 rounded-xl outline-none" /></div>
            <div><label className="text-xs text-white/50 mb-1 block">Макс. цена ($)</label><input type="number" value={maxPrice} onChange={e => setMaxPrice(parseInt(e.target.value) || 0)} className="w-full glass-input text-sm text-white px-3 py-2 rounded-xl outline-none" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-white/50 mb-1 block">Глубина</label><input type="number" value={maxDepth} onChange={e => setMaxDepth(parseInt(e.target.value) || 1)} min={1} max={10} className="w-full glass-input text-sm text-white px-3 py-2 rounded-xl outline-none" /></div>
            <div><label className="text-xs text-white/50 mb-1 block">Потоки</label><input type="number" value={threads} onChange={e => setThreads(parseInt(e.target.value) || 1)} min={1} max={5} className="w-full glass-input text-sm text-white px-3 py-2 rounded-xl outline-none" /></div>
          </div>
          <div className="flex gap-2">
            {!isRunning ? (
              <button onClick={startParser} className="flex items-center gap-2 px-6 py-3 rounded-xl bg-green-500/20 text-green-400 text-sm hover:bg-green-500/30"><Play size={16} /> Запустить</button>
            ) : (
              <>
                <button onClick={stopParser} className="flex items-center gap-2 px-6 py-3 rounded-xl bg-red-500/20 text-red-400 text-sm hover:bg-red-500/30"><Square size={16} /> Стоп</button>
                <button onClick={() => activeJob && parserApi.pauseParser(activeJob.id)} className="flex items-center gap-2 px-4 py-3 rounded-xl bg-yellow-500/20 text-yellow-400 text-sm"><Pause size={16} /> Пауза</button>
              </>
            )}
          </div>
        </div>

        <div className="space-y-4">
          {activeJob && (
            <>
              <div className="grid grid-cols-3 gap-3">
                <div className="glass-card rounded-xl p-3 text-center"><div className="text-lg font-bold text-white">{activeJob.stats?.checked || 0}</div><div className="text-[10px] text-white/40">Проверено</div></div>
                <div className="glass-card rounded-xl p-3 text-center"><div className="text-lg font-bold text-green-400">{activeJob.stats?.foundValuable || 0}</div><div className="text-[10px] text-white/40">Найдено</div></div>
                <div className="glass-card rounded-xl p-3 text-center"><div className="text-lg font-bold text-red-400">{activeJob.stats?.errors || 0}</div><div className="text-[10px] text-white/40">Ошибки</div></div>
              </div>

              <div className="glass-card rounded-2xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white">Результаты ({activeJob.results?.length || 0})</h3>
                  <div className="flex gap-1">
                    {['txt', 'json', 'csv'].map(fmt => (
                      <button key={fmt} onClick={() => exportResults(fmt as 'txt' | 'json' | 'csv')}
                        className="flex items-center gap-1 px-2 py-1 rounded bg-white/5 text-white/40 text-[10px] hover:bg-white/10">
                        <Download size={10} /> .{fmt}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="max-h-60 overflow-y-auto space-y-1">
                  {(activeJob.results || []).slice(0, 50).map((r, i) => (
                    <div key={i} className="text-xs text-white/60 flex items-center justify-between p-2 bg-white/3 rounded-lg">
                      <span className="font-mono">{r.steamId}</span>
                      <span className="text-green-400">${r.inventoryValue?.toFixed(2)}</span>
                    </div>
                  ))}
                  {(!activeJob.results || activeJob.results.length === 0) && <div className="text-xs text-white/30 text-center py-4">Пока нет результатов</div>}
                </div>
              </div>
            </>
          )}

          {!activeJob && (
            <div className="glass-card rounded-2xl p-12 text-center">
              <Search size={48} className="mx-auto mb-4 text-white/10" />
              <div className="text-sm text-white/30">Настройте и запустите парсер</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
