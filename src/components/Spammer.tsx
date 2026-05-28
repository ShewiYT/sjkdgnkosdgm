import { useState } from 'react';
import { Megaphone, Play, Square, Clock, Users, AlertTriangle } from 'lucide-react';
import type { SteamAccount } from '../types';

interface SpammerProps {
  accounts: SteamAccount[];
}

export default function Spammer({ accounts }: SpammerProps) {
  const [selectedAccounts, setSelectedAccounts] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState('');
  const [delay, setDelay] = useState(3);
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState({ sent: 0, total: 0 });

  const onlineAccounts = accounts.filter(a => a.status === 'online');

  const toggleAccount = (id: string) => {
    setSelectedAccounts(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const selectAll = () => {
    if (selectedAccounts.size === onlineAccounts.length) {
      setSelectedAccounts(new Set());
    } else {
      setSelectedAccounts(new Set(onlineAccounts.map(a => a.id)));
    }
  };

  const startSpam = () => {
    if (!message.trim() || selectedAccounts.size === 0) return;
    const total = selectedAccounts.size * 10;
    setIsRunning(true);
    setProgress({ sent: 0, total });
    
    let count = 0;
    const interval = setInterval(() => {
      count++;
      setProgress({ sent: count, total });
      if (count >= total) {
        clearInterval(interval);
        setIsRunning(false);
      }
    }, delay * 100);
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold text-white flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl glass-accent flex items-center justify-center">
            <Megaphone size={20} />
          </div>
          Спамер
        </h1>
        <p className="text-sm text-white/50 mt-1">Массовая рассылка сообщений</p>
      </div>

      <div className="glass-card rounded-2xl p-4 border border-yellow-500/20">
        <div className="flex items-center gap-2 text-yellow-400 text-xs">
          <AlertTriangle size={16} />
          Используйте аккуратно! Чрезмерная рассылка может привести к ограничениям.
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Message */}
        <div className="lg:col-span-2 space-y-4">
          <div className="glass-card rounded-2xl p-5 space-y-4">
            <h3 className="text-sm font-medium text-white">💬 Сообщение</h3>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Введите текст сообщения..."
              rows={5}
              className="w-full glass-input text-sm text-white px-4 py-3 rounded-xl outline-none resize-none placeholder:text-white/20"
            />
            
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Clock size={14} className="text-white/50" />
                <span className="text-xs text-white/50">Задержка:</span>
                <input
                  type="number"
                  value={delay}
                  onChange={e => setDelay(Number(e.target.value))}
                  min={1}
                  max={60}
                  className="w-16 glass-input text-sm text-white px-2 py-1 rounded-lg outline-none text-center"
                />
                <span className="text-xs text-white/50">сек</span>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={isRunning ? () => setIsRunning(false) : startSpam}
                disabled={!isRunning && (!message.trim() || selectedAccounts.size === 0)}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isRunning 
                    ? 'bg-red-500/20 text-red-400' 
                    : 'glass-accent text-white disabled:opacity-40'
                }`}
              >
                {isRunning ? <><Square size={16} /> Остановить</> : <><Play size={16} /> Запустить</>}
              </button>
              {isRunning && (
                <div className="flex items-center gap-2 text-xs text-white/50">
                  <div className="w-32 h-2 rounded-full glass overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-orange-500 to-red-500 h-full transition-all"
                      style={{ width: `${(progress.sent / progress.total) * 100}%` }}
                    />
                  </div>
                  {progress.sent}/{progress.total}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Account selection */}
        <div className="glass-card rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-white flex items-center gap-2">
              <Users size={16} className="text-white/50" /> Аккаунты
            </h3>
            <button
              onClick={selectAll}
              className="text-[10px] text-blue-400 hover:text-blue-300"
            >
              {selectedAccounts.size === onlineAccounts.length ? 'Снять' : 'Выбрать все'}
            </button>
          </div>
          <div className="space-y-1 max-h-60 overflow-y-auto">
            {accounts.map(acc => (
              <label
                key={acc.id}
                className={`flex items-center gap-2 p-2 rounded-xl cursor-pointer transition-colors ${
                  selectedAccounts.has(acc.id) ? 'glass-accent' : 'hover:bg-white/5'
                } ${acc.status !== 'online' ? 'opacity-40' : ''}`}
              >
                <input
                  type="checkbox"
                  checked={selectedAccounts.has(acc.id)}
                  onChange={() => toggleAccount(acc.id)}
                  disabled={acc.status !== 'online'}
                  className="accent-blue-500"
                />
                <span className="text-lg">{acc.avatar}</span>
                <div className="flex-1">
                  <div className="text-xs text-white">{acc.login}</div>
                  <div className="text-[10px] text-white/40">{acc.friendsCount} друзей</div>
                </div>
              </label>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t border-white/5 text-[10px] text-white/40 text-center">
            Выбрано: {selectedAccounts.size}
          </div>
        </div>
      </div>
    </div>
  );
}
