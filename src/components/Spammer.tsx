import { useState, useRef, useCallback } from 'react';
import { MessageCircle, Play, Square, AlertCircle } from 'lucide-react';
import { useAppStore } from '../store';

export default function Spammer() {
  const { accounts } = useAppStore();
  const [message, setMessage] = useState('');
  const [delay, setDelay] = useState(5);
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [steamIds, setSteamIds] = useState('');
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const isRunningRef = useRef(false);
  const [isRunning, setIsRunning] = useState(false);

  const onlineAccounts = accounts.filter(a => a.status === 'online');

  const toggleAccount = (id: string) => {
    setSelectedAccounts(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const startSpam = useCallback(async () => {
    const ids = steamIds.split('\n').map(l => l.trim()).filter(Boolean);
    if (ids.length === 0 || selectedAccounts.length === 0 || !message.trim()) return;

    isRunningRef.current = true;
    setIsRunning(true);
    setProgress({ current: 0, total: ids.length * selectedAccounts.length });

    let count = 0;
    for (const accountId of selectedAccounts) {
      for (const targetId of ids) {
        if (!isRunningRef.current) break;
        try {
          await fetch('/api/steam/message', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ accountId, friendSteamId: targetId, message }),
          });
        } catch {}
        count++;
        setProgress({ current: count, total: ids.length * selectedAccounts.length });
        await new Promise(r => setTimeout(r, delay * 1000));
      }
    }

    isRunningRef.current = false;
    setIsRunning(false);
  }, [steamIds, selectedAccounts, message, delay]);

  const stop = () => {
    isRunningRef.current = false;
    setIsRunning(false);
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in overflow-y-auto max-h-[calc(100vh-52px)]">
      <div>
        <h1 className="text-2xl font-semibold text-white flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl glass-accent flex items-center justify-center">
            <MessageCircle size={20} />
          </div>
          Спамер
        </h1>
        <p className="text-sm text-white/50 mt-1">Массовая рассылка сообщений</p>
      </div>

      <div className="glass-card rounded-2xl p-4 border border-yellow-500/20">
        <div className="flex items-center gap-3 text-yellow-400">
          <AlertCircle size={18} />
          <span className="text-xs">Используйте аккуратно! Чрезмерная рассылка может привести к ограничениям.</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="glass-card rounded-2xl p-5 space-y-4">
            <h3 className="text-sm font-medium text-white">Сообщение</h3>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Текст сообщения..."
              rows={4}
              className="w-full glass-input text-sm text-white px-4 py-3 rounded-xl outline-none resize-none"
              disabled={isRunning}
            />
          </div>

          <div className="glass-card rounded-2xl p-5 space-y-4">
            <h3 className="text-sm font-medium text-white">Steam ID получателей</h3>
            <textarea
              value={steamIds}
              onChange={e => setSteamIds(e.target.value)}
              placeholder={"76561198012345678\n76561198087654321"}
              rows={6}
              className="w-full glass-input text-sm text-white px-4 py-3 rounded-xl outline-none resize-none font-mono placeholder:text-white/20"
              disabled={isRunning}
            />
            <div className="text-xs text-white/30">
              {steamIds.split('\n').filter(l => l.trim()).length} получателей
            </div>
          </div>

          <div className="glass-card rounded-2xl p-5 space-y-3">
            <h3 className="text-sm font-medium text-white">Задержка (сек)</h3>
            <input
              type="number"
              value={delay}
              onChange={e => setDelay(Number(e.target.value))}
              min={1}
              max={60}
              className="w-full glass-input text-sm text-white px-4 py-3 rounded-xl outline-none"
              disabled={isRunning}
            />
          </div>
        </div>

        <div className="space-y-4">
          <div className="glass-card rounded-2xl p-5 space-y-3">
            <h3 className="text-sm font-medium text-white">Аккаунты ({onlineAccounts.length} онлайн)</h3>
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {onlineAccounts.map(acc => (
                <label
                  key={acc.id}
                  className={`flex items-center gap-3 p-2 rounded-xl cursor-pointer transition-colors ${
                    selectedAccounts.includes(acc.id) ? 'bg-blue-500/10 border border-blue-500/30' : 'hover:bg-white/5'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedAccounts.includes(acc.id)}
                    onChange={() => toggleAccount(acc.id)}
                    className="accent-blue-500"
                    disabled={isRunning}
                  />
                  <span className="text-lg">{acc.avatar}</span>
                  <span className="text-sm text-white">{acc.login}</span>
                </label>
              ))}
              {onlineAccounts.length === 0 && (
                <div className="text-xs text-white/30 text-center py-4">Нет онлайн аккаунтов</div>
              )}
            </div>
          </div>

          {/* Progress */}
          {(isRunning || progress.current > 0) && (
            <div className="glass-card rounded-2xl p-5 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-white">Прогресс</span>
                <span className="text-white/50">{progress.current}/{progress.total}</span>
              </div>
              <div className="w-full h-2 rounded-full bg-white/5 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all"
                  style={{ width: `${(progress.current / Math.max(progress.total, 1)) * 100}%` }}
                />
              </div>
            </div>
          )}

          <div className="flex gap-3">
            {isRunning ? (
              <button
                onClick={stop}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-red-500/20 text-red-400 hover:bg-red-500/30"
              >
                <Square size={16} /> Остановить
              </button>
            ) : (
              <button
                onClick={startSpam}
                disabled={!message.trim() || selectedAccounts.length === 0 || !steamIds.trim()}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl glass-accent text-white disabled:opacity-40"
              >
                <Play size={16} /> Начать рассылку
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
