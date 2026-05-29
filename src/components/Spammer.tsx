import { useState } from 'react';
import { Send, AlertCircle, Play, Square } from 'lucide-react';
import type { SteamAccount } from '../types';

interface SpammerProps {
  accounts: SteamAccount[];
}

export default function Spammer({ accounts }: SpammerProps) {
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [message, setMessage] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [sent, setSent] = useState(0);
  const [total, setTotal] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);

  const onlineAccounts = accounts.filter(a => a.status === 'online' || a.status === 'in-game');
  const selectedAccount = accounts.find(a => a.id === selectedAccountId);

  const startSpam = async () => {
    if (!selectedAccountId || !message.trim()) return;
    setIsRunning(true);
    setSent(0);
    setTotal(0);
    setLogs([`Начинаем рассылку с аккаунта ${selectedAccount?.login}...`]);
    
    // Simulate spam process
    const fakeCount = Math.floor(Math.random() * 20) + 5;
    setTotal(fakeCount);
    
    for (let i = 0; i < fakeCount; i++) {
      if (!isRunning) break;
      await new Promise(r => setTimeout(r, 1000 + Math.random() * 2000));
      setSent(i + 1);
      setLogs(prev => [...prev, `[${i + 1}/${fakeCount}] Отправлено сообщение пользователю...`]);
    }
    
    setIsRunning(false);
    setLogs(prev => [...prev, `Рассылка завершена. Отправлено: ${fakeCount}`]);
  };

  const stopSpam = () => {
    setIsRunning(false);
    setLogs(prev => [...prev, 'Рассылка остановлена']);
  };

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full">
      <div>
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Send className="w-5 h-5 text-orange-400" />
          Спамер
        </h2>
        <p className="text-white/40 text-sm">Рассылка сообщений друзьям без переписки</p>
      </div>

      <div className="glass-card rounded-xl p-4 flex items-start gap-3 border-orange-500/20">
        <AlertCircle className="w-5 h-5 text-orange-400 shrink-0 mt-0.5" />
        <div className="text-xs text-white/50">
          Спамер отправляет сообщения только тем друзьям, с которыми у вас вообще нет переписки.
          Используйте аккуратно — чрезмерная рассылка может привести к ограничениям Steam.
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="glass-card rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold">Настройки рассылки</h3>

            <div>
              <label className="text-white/40 text-xs mb-1 block">Аккаунт-отправитель</label>
              <select
                value={selectedAccountId}
                onChange={e => setSelectedAccountId(e.target.value)}
                className="w-full glass-input text-sm text-white px-3 py-2 rounded-xl outline-none bg-transparent"
                disabled={isRunning}
              >
                <option value="" className="bg-dark-800">Выберите аккаунт</option>
                {onlineAccounts.map(acc => (
                  <option key={acc.id} value={acc.id} className="bg-dark-800">
                    {acc.login} ({acc.friendsCount} друзей)
                  </option>
                ))}
              </select>
              {onlineAccounts.length === 0 && (
                <p className="text-xs text-orange-400 mt-1">Нет онлайн аккаунтов</p>
              )}
            </div>

            <div>
              <label className="text-white/40 text-xs mb-1 block">Сообщение</label>
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                className="w-full glass-input text-sm text-white px-3 py-2 rounded-xl outline-none h-24 resize-none"
                placeholder="Введите текст сообщения..."
                disabled={isRunning}
              />
            </div>

            <div className="pt-2">
              {!isRunning ? (
                <button
                  onClick={startSpam}
                  disabled={!selectedAccountId || !message.trim()}
                  className="w-full glass-btn py-3 rounded-xl text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-30"
                >
                  <Play className="w-4 h-4" /> Начать рассылку
                </button>
              ) : (
                <button
                  onClick={stopSpam}
                  className="w-full py-3 rounded-xl text-sm font-medium flex items-center justify-center gap-2 bg-red-500/20 border border-red-500/30 text-red-400"
                >
                  <Square className="w-4 h-4" /> Остановить
                </button>
              )}
            </div>
          </div>

          {/* Progress */}
          {total > 0 && (
            <div className="glass-card rounded-xl p-5 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-white/50">Прогресс</span>
                <span className="text-white">{sent} / {total}</span>
              </div>
              <div className="w-full bg-white/5 rounded-full h-2">
                <div
                  className="bg-gradient-to-r from-orange-500 to-red-500 h-2 rounded-full transition-all"
                  style={{ width: `${(sent / total) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Logs */}
        <div className="glass-card rounded-xl p-5 space-y-3">
          <h3 className="text-sm font-semibold">Лог</h3>
          <div className="h-64 overflow-y-auto text-xs font-mono space-y-1 bg-black/20 rounded-lg p-3">
            {logs.length === 0 ? (
              <div className="text-white/20">Логи появятся здесь...</div>
            ) : (
              logs.map((log, i) => (
                <div key={i} className="text-white/50">{log}</div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
