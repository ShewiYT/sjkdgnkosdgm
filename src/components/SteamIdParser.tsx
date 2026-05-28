import { useState, useEffect } from 'react';
import { 
  Database, 
  Key, 
  Download, 
  Play, 
  Loader2, 
  Copy, 
  Check,
  AlertCircle,
  Globe,
  DollarSign,
  Hash,
  Trash2,
  RefreshCw,
  Search,
  StopCircle
} from 'lucide-react';
import { useAppStore } from '../store';
import type { ParseJob } from '../types';

const COUNTRIES = [
  { code: 'RU', name: 'Россия', flag: '🇷🇺' },
  { code: 'UA', name: 'Украина', flag: '🇺🇦' },
  { code: 'BY', name: 'Беларусь', flag: '🇧🇾' },
  { code: 'KZ', name: 'Казахстан', flag: '🇰🇿' },
  { code: 'US', name: 'США', flag: '🇺🇸' },
  { code: 'DE', name: 'Германия', flag: '🇩🇪' },
  { code: 'FR', name: 'Франция', flag: '🇫🇷' },
  { code: 'GB', name: 'Великобритания', flag: '🇬🇧' },
  { code: 'PL', name: 'Польша', flag: '🇵🇱' },
  { code: 'TR', name: 'Турция', flag: '🇹🇷' },
  { code: 'BR', name: 'Бразилия', flag: '🇧🇷' },
  { code: 'CN', name: 'Китай', flag: '🇨🇳' },
  { code: 'ALL', name: 'Все страны', flag: '🌍' },
];

interface SteamIdParserProps {
  parserKey?: string;
}

export default function SteamIdParser({ parserKey }: SteamIdParserProps) {
  const { 
    currentUser,
    parserKeys, 
    parseJobs,
    generateParserKey, 
    revokeParserKey,
    validateParserKey,
    startParseJob,
    getParseJob,
    refreshParseJob,
    loadParseJobs
  } = useAppStore();

  const isAdmin = currentUser?.role === 'admin';

  // Parse form state
  const [accessKey, setAccessKey] = useState(parserKey || '');
  const [country, setCountry] = useState('RU');
  const [minValue, setMinValue] = useState(100);
  const [maxValue, setMaxValue] = useState(10000);
  const [targetCount, setTargetCount] = useState(1000);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Poll active job status
  useEffect(() => {
    if (!activeJobId) return;
    
    const interval = setInterval(async () => {
      await refreshParseJob(activeJobId);
      const job = getParseJob(activeJobId);
      if (job && (job.status === 'completed' || job.status === 'error' || job.status === 'cancelled')) {
        // Job finished, stop polling this specific job
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [activeJobId, refreshParseJob, getParseJob]);

  // Load jobs on mount
  useEffect(() => {
    loadParseJobs();
  }, [loadParseJobs]);

  const handleStartParse = async () => {
    setError('');
    setSuccess('');

    // Validate key for non-admins
    if (!isAdmin) {
      const isValid = await validateParserKey(accessKey);
      if (!isValid) {
        setError('Недействительный ключ доступа');
        return;
      }
    }

    // Validate inputs
    if (minValue >= maxValue) {
      setError('Минимальная сумма должна быть меньше максимальной');
      return;
    }

    if (targetCount < 1 || targetCount > 50000) {
      setError('Количество должно быть от 1 до 50000');
      return;
    }

    setIsStarting(true);

    try {
      const jobId = await startParseJob(
        isAdmin ? 'admin' : accessKey,
        country,
        minValue,
        maxValue,
        targetCount
      );

      if (jobId) {
        setActiveJobId(jobId);
        setSuccess('Парсинг запущен! Сканируем Steam профили...');
      } else {
        setError('Ошибка при запуске парсинга');
      }
    } catch (e) {
      setError('Ошибка при запуске парсинга');
    }

    setIsStarting(false);
  };

  const handleGenerateKey = async () => {
    const key = await generateParserKey();
    if (key) {
      setSuccess(`Ключ создан: ${key}`);
      setTimeout(() => setSuccess(''), 5000);
    }
  };

  const copyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const downloadResults = (job: ParseJob) => {
    const content = job.results.map(r => r.steamId).join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `steam_ids_${job.country}_${job.minInventoryValue}-${job.maxInventoryValue}_${new Date(job.createdAt).toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadResultsDetailed = (job: ParseJob) => {
    const content = job.results.map(r => 
      `${r.steamId}\t$${r.inventoryValue.toFixed(2)}\t${r.country}`
    ).join('\n');
    const header = 'Steam ID\tInventory Value\tCountry\n';
    const blob = new Blob([header + content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `steam_ids_detailed_${job.country}_${new Date(job.createdAt).toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const activeJob = activeJobId ? getParseJob(activeJobId) : null;
  const runningJobs = parseJobs.filter(j => j.status === 'running');

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white flex items-center gap-3">
          <Database size={24} />
          Парсер Steam ID
        </h1>
        <p className="text-white/50 text-sm mt-1">
          Поиск Steam ID по стране и стоимости инвентаря (CS2)
        </p>
      </div>

      {/* Admin: Key Management */}
      {isAdmin && (
        <div className="glass-card rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-white font-medium flex items-center gap-2">
              <Key size={18} />
              Управление ключами доступа
            </h2>
            <button
              onClick={handleGenerateKey}
              className="flex items-center gap-2 px-4 py-2 glass-accent rounded-xl text-white text-sm"
            >
              <Key size={16} />
              Создать ключ
            </button>
          </div>

          {parserKeys.length === 0 ? (
            <div className="text-center py-6 text-white/30">
              <Key size={32} className="mx-auto mb-2" />
              <p className="text-sm">Нет созданных ключей</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {parserKeys.map(k => (
                <div
                  key={k.id}
                  className={`flex items-center gap-3 p-3 glass rounded-xl ${
                    !k.isActive ? 'opacity-50' : ''
                  }`}
                >
                  <div className="flex-1">
                    <div className="font-mono text-sm text-white flex items-center gap-2">
                      {k.key}
                      <button
                        onClick={() => copyKey(k.key)}
                        className="p-1 text-white/30 hover:text-white/70"
                      >
                        {copiedKey === k.key ? <Check size={14} /> : <Copy size={14} />}
                      </button>
                    </div>
                    <div className="text-xs text-white/40 mt-0.5">
                      Создан: {new Date(k.createdAt).toLocaleString('ru-RU')}
                      {k.usedAt && (
                        <span className="ml-2">
                          • Использован: {new Date(k.usedAt).toLocaleString('ru-RU')}
                          {k.usedBy && ` (${k.usedBy})`}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-xs ${
                    k.isActive ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                  }`}>
                    {k.isActive ? 'Активен' : 'Отозван'}
                  </span>
                  {k.isActive && (
                    <button
                      onClick={() => revokeParserKey(k.id)}
                      className="p-2 text-white/30 hover:text-red-400"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Running Jobs Indicator */}
      {runningJobs.length > 0 && (
        <div className="glass-card rounded-2xl p-4 border border-yellow-500/30">
          <div className="flex items-center gap-2 text-yellow-400">
            <Loader2 size={18} className="animate-spin" />
            <span className="font-medium">{runningJobs.length} активных парсингов</span>
          </div>
        </div>
      )}

      {/* Parse Form */}
      <div className="glass-card rounded-2xl p-5 space-y-5">
        <h2 className="text-white font-medium flex items-center gap-2">
          <Search size={18} />
          Запуск парсинга
        </h2>

        {/* Access key (for non-admins) */}
        {!isAdmin && (
          <div>
            <label className="text-xs text-white/50 block mb-2 flex items-center gap-1">
              <Key size={12} />
              Ключ доступа
            </label>
            <input
              type="text"
              value={accessKey}
              onChange={e => setAccessKey(e.target.value)}
              placeholder="PK-xxxxx-xxxxx"
              className="w-full glass-input text-sm text-white px-4 py-3 rounded-xl outline-none font-mono"
            />
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Country */}
          <div>
            <label className="text-xs text-white/50 block mb-2 flex items-center gap-1">
              <Globe size={12} />
              Страна парсинга
            </label>
            <select
              value={country}
              onChange={e => setCountry(e.target.value)}
              className="w-full glass-input text-sm text-white px-4 py-3 rounded-xl outline-none appearance-none cursor-pointer"
            >
              {COUNTRIES.map(c => (
                <option key={c.code} value={c.code} className="bg-gray-900">
                  {c.flag} {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Target count */}
          <div>
            <label className="text-xs text-white/50 block mb-2 flex items-center gap-1">
              <Hash size={12} />
              Количество Steam ID
            </label>
            <input
              type="number"
              min={1}
              max={50000}
              value={targetCount}
              onChange={e => setTargetCount(parseInt(e.target.value) || 1000)}
              className="w-full glass-input text-sm text-white px-4 py-3 rounded-xl outline-none"
            />
            <p className="text-xs text-white/30 mt-1">Парсер будет сканировать пока не найдёт {targetCount} совпадений</p>
          </div>

          {/* Min value */}
          <div>
            <label className="text-xs text-white/50 block mb-2 flex items-center gap-1">
              <DollarSign size={12} />
              Мин. стоимость инвентаря ($)
            </label>
            <input
              type="number"
              min={0}
              value={minValue}
              onChange={e => setMinValue(parseInt(e.target.value) || 0)}
              className="w-full glass-input text-sm text-white px-4 py-3 rounded-xl outline-none"
            />
          </div>

          {/* Max value */}
          <div>
            <label className="text-xs text-white/50 block mb-2 flex items-center gap-1">
              <DollarSign size={12} />
              Макс. стоимость инвентаря ($)
            </label>
            <input
              type="number"
              min={0}
              value={maxValue}
              onChange={e => setMaxValue(parseInt(e.target.value) || 10000)}
              className="w-full glass-input text-sm text-white px-4 py-3 rounded-xl outline-none"
            />
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-red-400 text-xs p-3 rounded-xl glass border border-red-500/30">
            <AlertCircle size={14} />
            {error}
          </div>
        )}

        {success && (
          <div className="flex items-center gap-2 text-green-400 text-xs p-3 rounded-xl glass border border-green-500/30">
            <Check size={14} />
            {success}
          </div>
        )}

        <button
          onClick={handleStartParse}
          disabled={isStarting || (!isAdmin && !accessKey)}
          className="w-full py-3 glass-accent rounded-xl text-white font-medium flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {isStarting ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              Запуск...
            </>
          ) : (
            <>
              <Play size={18} />
              Запустить парсинг
            </>
          )}
        </button>
      </div>

      {/* Active Job Status */}
      {activeJob && (
        <div className="glass-card rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-white font-medium flex items-center gap-2">
              {activeJob.status === 'running' ? (
                <RefreshCw size={18} className="animate-spin" />
              ) : activeJob.status === 'completed' ? (
                <Check size={18} className="text-green-400" />
              ) : (
                <AlertCircle size={18} className="text-red-400" />
              )}
              {activeJob.status === 'running' ? 'Парсинг в процессе...' :
               activeJob.status === 'completed' ? 'Парсинг завершен!' :
               activeJob.status === 'cancelled' ? 'Парсинг отменён' :
               'Ошибка парсинга'}
            </h2>
            <span className={`px-3 py-1 rounded-full text-xs ${
              activeJob.status === 'running' ? 'bg-yellow-500/20 text-yellow-400' :
              activeJob.status === 'completed' ? 'bg-green-500/20 text-green-400' :
              'bg-red-500/20 text-red-400'
            }`}>
              Найдено: {activeJob.parsedCount} / {activeJob.targetCount}
            </span>
          </div>

          {/* Progress info */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="glass rounded-xl p-3">
              <div className="text-white/40 text-xs">Просканировано профилей</div>
              <div className="text-white text-xl font-semibold">{activeJob.scannedCount || 0}</div>
            </div>
            <div className="glass rounded-xl p-3">
              <div className="text-white/40 text-xs">Найдено совпадений</div>
              <div className="text-green-400 text-xl font-semibold">{activeJob.parsedCount}</div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-white/40">
              <span>Прогресс</span>
              <span>{Math.round((activeJob.parsedCount / activeJob.targetCount) * 100)}%</span>
            </div>
            <div className="w-full h-2 glass rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300"
                style={{ width: `${Math.min(100, (activeJob.parsedCount / activeJob.targetCount) * 100)}%` }}
              />
            </div>
          </div>

          {/* Job details */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="glass rounded-xl p-3">
              <div className="text-white/40 text-xs">Страна</div>
              <div className="text-white">
                {COUNTRIES.find(c => c.code === activeJob.country)?.flag} {activeJob.country}
              </div>
            </div>
            <div className="glass rounded-xl p-3">
              <div className="text-white/40 text-xs">Диапазон $</div>
              <div className="text-white">${activeJob.minInventoryValue} - ${activeJob.maxInventoryValue}</div>
            </div>
            <div className="glass rounded-xl p-3">
              <div className="text-white/40 text-xs">Цель</div>
              <div className="text-white">{activeJob.targetCount}</div>
            </div>
            <div className="glass rounded-xl p-3">
              <div className="text-white/40 text-xs">Статус</div>
              <div className="text-white capitalize">{activeJob.status}</div>
            </div>
          </div>

          {/* Cancel button for running jobs */}
          {activeJob.status === 'running' && (
            <button
              onClick={async () => {
                try {
                  await fetch(`/api/parse-jobs/${activeJob.id}/cancel`, { method: 'POST' });
                  await refreshParseJob(activeJob.id);
                } catch (e) {
                  console.error('Failed to cancel job:', e);
                }
              }}
              className="w-full py-3 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded-xl text-red-400 font-medium flex items-center justify-center gap-2"
            >
              <StopCircle size={18} />
              Остановить парсинг
            </button>
          )}

          {/* Download buttons */}
          {(activeJob.status === 'completed' || activeJob.status === 'cancelled') && activeJob.results.length > 0 && (
            <div className="flex gap-3">
              <button
                onClick={() => downloadResults(activeJob)}
                className="flex-1 py-3 glass-button rounded-xl text-white flex items-center justify-center gap-2"
              >
                <Download size={18} />
                Скачать Steam ID ({activeJob.results.length})
              </button>
              <button
                onClick={() => downloadResultsDetailed(activeJob)}
                className="flex-1 py-3 glass-button rounded-xl text-white flex items-center justify-center gap-2"
              >
                <Download size={18} />
                С ценами
              </button>
            </div>
          )}

          {activeJob.error && (
            <div className="text-red-400 text-sm p-3 glass rounded-xl border border-red-500/30">
              {activeJob.error}
            </div>
          )}
        </div>
      )}

      {/* Previous Jobs */}
      {parseJobs.length > 0 && (
        <div className="glass-card rounded-2xl p-5 space-y-4">
          <h2 className="text-white font-medium">История парсинга</h2>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {parseJobs.slice().reverse().map(job => (
              <div
                key={job.id}
                className={`flex items-center gap-3 p-3 glass rounded-xl cursor-pointer hover:bg-white/5 ${
                  activeJobId === job.id ? 'border border-blue-500/30' : ''
                }`}
                onClick={() => setActiveJobId(job.id)}
              >
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  job.status === 'completed' ? 'bg-green-400' :
                  job.status === 'running' ? 'bg-yellow-400 animate-pulse' :
                  job.status === 'cancelled' ? 'bg-gray-400' :
                  'bg-red-400'
                }`} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-white flex items-center gap-2">
                    {COUNTRIES.find(c => c.code === job.country)?.flag} {job.country}
                    <span className="text-white/40">•</span>
                    ${job.minInventoryValue}-${job.maxInventoryValue}
                  </div>
                  <div className="text-xs text-white/40">
                    {new Date(job.createdAt).toLocaleString('ru-RU')}
                    <span className="mx-1">•</span>
                    Просканировано: {job.scannedCount || 0}
                    <span className="mx-1">•</span>
                    Найдено: {job.parsedCount}/{job.targetCount}
                  </div>
                </div>
                {job.status === 'completed' && job.results.length > 0 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); downloadResults(job); }}
                    className="p-2 text-white/30 hover:text-white/70"
                  >
                    <Download size={16} />
                  </button>
                )}
                {job.status === 'running' && (
                  <Loader2 size={16} className="animate-spin text-yellow-400" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
