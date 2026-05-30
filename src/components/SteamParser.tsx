import { useState, useEffect } from 'react';
import { Search, Play, Square, Pause, Download, Loader2 } from 'lucide-react';
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
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const interval = setInterval(async () => {
      if (activeJob && (activeJob.status === 'running' || activeJob.status === 'paused')) {
        const updated = await parserApi.getParserStatus(activeJob.id);
        if (updated) setActiveJob(updated);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [activeJob]);

  useEffect(() => { parserApi.getActiveJobs().then(jobs => { if (jobs.length > 0) setActiveJob(jobs[0]); }); }, []);

  const handleStart = async () => {
    setLoading(true);
    const ids = startIds.split('\n').filter(id => id.trim());
    const result = await parserApi.startParser({ apiKey, startIds: ids, minPrice, maxPrice, maxDepth, maxFriendsPerLevel: 50, threads });
    if (result.success && result.job) setActiveJob(result.job as ParserJob);
    setLoading(false);
  };

  const handleStop = async () => { if (activeJob) { await parserApi.stopParser(activeJob.id); const u = await parserApi.getParserStatus(activeJob.id); if (u) setActiveJob(u); } };
  const handlePause = async () => { if (activeJob) { if (activeJob.status === 'paused') await parserApi.resumeParser(activeJob.id); else await parserApi.pauseParser(activeJob.id); const u = await parserApi.getParserStatus(activeJob.id); if (u) setActiveJob(u); } };

  const handleExport = async (format: 'txt' | 'json' | 'csv') => {
    if (!activeJob) return;
    const blob = await parserApi.exportResults(activeJob.id, format);
    if (blob) { const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `parser_results.${format}`; a.click(); URL.revokeObjectURL(url); }
  };

  const isRunning = activeJob?.status === 'running';
  const isPaused = activeJob?.status === 'paused';

  return (
    <div className="p-6 space-y-6 animate-fade-in overflow-y-auto max-h-[calc(100vh-52px)]">
      <div><h1 className="text-2xl font-semibold text-white flex items-center gap-2"><Search size={24} /> Парсер Steam</h1><p className="text-sm text-white/40 mt-1">Поиск аккаунтов с ценным инвентарём</p></div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card rounded-2xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-white">Конфигурация</h3>
          <div><label className="text-xs text-white/50 mb-1 block">Steam API Key</label><input value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="API Key" className="w-full glass-input text-sm text-white px-3 py-2 rounded-xl outline-none font-mono" /></div>
          <div><label className="text-xs text-white/50 mb-1 block">Начальные Steam ID</label><textarea value={startIds} onChange={e => setStartIds(e.target.value)} placeholder={"76561198000000001\n76561198000000002"} className="w-full glass-input text-xs text-white p-3 rounded-xl outline-none h-24 resize-none font-mono" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-white/50 mb-1 block">Мин. цена ($)</label><input type="number" value={minPrice} onChange={e => setMinPrice(Number(e.target.value))} className="w-full glass-input text-sm text-white px-3 py-2 rounded-xl outline-none" /></div>
            <div><label className="text-xs text-white/50 mb-1 block">Макс. цена ($)</label><input type="number" value={maxPrice} onChange={e => setMaxPrice(Number(e.target.value))} className="w-full glass-input text-sm text-white px-3 py-2 rounded-xl outline-none" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-white/50 mb-1 block">Глубина</label><input type="number" value={maxDepth} onChange={e => setMaxDepth(Number(e.target.value))} className="w-full glass-input text-sm text-white px-3 py-2 rounded-xl outline-none" /></div>
            <div><label className="text-xs text-white/50 mb-1 block">Потоки</label><input type="number" value={threads} onChange={e => setThreads(Number(e.target.value))} className="w-full glass-input text-sm text-white px-3 py-2 rounded-xl outline-none" /></div>
          </div>
          <div className="flex gap-2">
            {!isRunning && !isPaused ? (<button onClick={handleStart} disabled={loading} className="flex items-center gap-2 px-6 py-3 rounded-xl bg-green-500/20 text-green-400 text-sm hover:bg-green-500/30 disabled:opacity-30">{loading ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />} Запустить</button>) :
             (<><button onClick={handlePause} className="flex items-center gap-2 px-4 py-3 rounded-xl bg-yellow-500/20 text-yellow-400 text-sm hover:bg-yellow-500/30"><Pause size={16} /> {isPaused ? 'Продолжить' : 'Пауза'}</button><button onClick={handleStop} className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/20 text-red-400 text-sm hover:bg-red-500/30"><Square size={16} /> Стоп</button></>)}
          </div>
        </div>
        <div className="space-y-4">
          {activeJob && (
            <>
              <div className="grid grid-cols-3 gap-3">
                <div className="glass-card rounded-xl p-3 text-center"><div className="text-lg font-bold text-blue-400">{activeJob.stats?.checked || 0}</div><div className="text-[10px] text-white/40">Проверено</div></div>
                <div className="glass-card rounded-xl p-3 text-center"><div className="text-lg font-bold text-green-400">{activeJob.stats?.foundValuable || 0}</div><div className="text-[10px] text-white/40">Найдено</div></div>
                <div className="glass-card rounded-xl p-3 text-center"><div className="text-lg font-bold text-red-400">{activeJob.stats?.errors || 0}</div><div className="text-[10px] text-white/40">Ошибки</div></div>
              </div>
              {(activeJob.results?.length || 0) > 0 && (
                <div className="flex gap-2">
                  <button onClick={() => handleExport('txt')} className="flex items-center gap-1 px-3 py-2 rounded-xl bg-white/5 text-white/60 text-xs hover:bg-white/10"><Download size={12} /> .txt</button>
                  <button onClick={() => handleExport('json')} className="flex items-center gap-1 px-3 py-2 rounded-xl bg-white/5 text-white/60 text-xs hover:bg-white/10"><Download size={12} /> .json</button>
                  <button onClick={() => handleExport('csv')} className="flex items-center gap-1 px-3 py-2 rounded-xl bg-white/5 text-white/60 text-xs hover:bg-white/10"><Download size={12} /> .csv</button>
                </div>
              )}
              <div className="glass-card rounded-2xl overflow-hidden">
                <div className="px-4 py-3 border-b border-white/5"><h3 className="text-sm font-semibold text-white">Результаты ({activeJob.results?.length || 0})</h3></div>
                <div className="max-h-60 overflow-y-auto divide-y divide-white/5">
                  {(activeJob.results || []).slice(0, 50).map((r, i) => (
                    <div key={i} className="px-4 py-2 flex items-center justify-between">
                      <div className="text-xs text-white truncate">{r.profileName || r.steamId}</div>
                      <span className="text-xs text-green-400">${r.inventoryValue.toFixed(2)}</span>
                    </div>
                  ))}
                  {(activeJob.results?.length || 0) === 0 && <div className="p-4 text-center text-xs text-white/30">Нет результатов</div>}
                </div>
              </div>
            </>
          )}
          {!activeJob && <div className="glass-card rounded-2xl p-12 text-center"><Search size={48} className="mx-auto mb-4 text-white/10" /><div className="text-sm text-white/30">Запустите парсер</div></div>}
        </div>
      </div>
    </div>
  );
}
