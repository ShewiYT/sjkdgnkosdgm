import { Megaphone, Play, Square, AlertTriangle, CheckCircle, XCircle, Clock } from 'lucide-react';
import { useAppStore } from '../store';
import type { SteamAccount } from '../types';

interface SpammerProps {
  accounts: SteamAccount[];
}

export default function Spammer({ accounts }: SpammerProps) {
  const { spammerRunning, spammerMessage, spammerDelay, spammerLogs, setSpammerMessage, setSpammerDelay, startSpammer, stopSpammer } = useAppStore();
  const onlineAccounts = accounts.filter(a => a.status === 'online' || a.status === 'in-game');
  const sentCount = spammerLogs.filter(l => l.status === 'sent').length;
  const errorCount = spammerLogs.filter(l => l.status === 'error').length;

  return (
    <div className="p-6 space-y-6 animate-fade-in overflow-y-auto max-h-[calc(100vh-52px)]">
      <div>
        <h1 className="text-2xl font-semibold text-white flex items-center gap-2"><Megaphone size={24} /> Спамер</h1>
        <p className="text-sm text-white/40 mt-1">Рассылка сообщений друзьям без переписки</p>
      </div>

      <div className="flex items-start gap-2 p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
        <AlertTriangle size={16} className="text-yellow-400 mt-0.5 shrink-0" />
        <div className="text-xs text-yellow-300/80">Спамер отправляет сообщения только тем друзьям, с которыми нет переписки.</div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="glass-card rounded-2xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-white">Настройки рассылки</h3>
          <div>
            <label className="text-xs text-white/50 mb-1 block">Аккаунты-отправители ({onlineAccounts.length} онлайн)</label>
            <div className="glass-input rounded-xl p-3 text-xs text-white/60 max-h-24 overflow-y-auto">
              {onlineAccounts.length === 0 ? <span className="text-white/30">Нет онлайн аккаунтов</span> : (
                <div className="flex flex-wrap gap-1">
                  {onlineAccounts.map(acc => (
                    <span key={acc.id} className="px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 text-[10px]">{acc.login}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div>
            <label className="text-xs text-white/50 mb-1 block">Сообщение</label>
            <textarea value={spammerMessage} onChange={e => setSpammerMessage(e.target.value)} disabled={spammerRunning}
              placeholder="Введите текст сообщения..." className="w-full glass-input text-sm text-white px-3 py-2 rounded-xl outline-none h-32 resize-none" />
          </div>
          <div>
            <label className="text-xs text-white/50 mb-1 block">Задержка (сек)</label>
            <input type="number" value={spammerDelay} onChange={e => setSpammerDelay(Math.max(1, Math.min(60, parseInt(e.target.value) || 3)))}
              disabled={spammerRunning} min={1} max={60} className="w-full glass-input text-sm text-white px-3 py-2 rounded-xl outline-none" />
          </div>
          <div className="flex gap-2">
            {!spammerRunning ? (
              <button onClick={startSpammer} disabled={onlineAccounts.length === 0 || !spammerMessage.trim()}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-green-500/20 text-green-400 text-sm hover:bg-green-500/30 disabled:opacity-30">
                <Play size={16} /> Запустить
              </button>
            ) : (
              <button onClick={stopSpammer} className="flex items-center gap-2 px-6 py-3 rounded-xl bg-red-500/20 text-red-400 text-sm hover:bg-red-500/30">
                <Square size={16} /> Остановить
              </button>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="glass-card rounded-xl p-3 text-center"><div className="text-lg font-bold text-green-400">{sentCount}</div><div className="text-[10px] text-white/40">Отправлено</div></div>
            <div className="glass-card rounded-xl p-3 text-center"><div className="text-lg font-bold text-red-400">{errorCount}</div><div className="text-[10px] text-white/40">Ошибки</div></div>
            <div className="glass-card rounded-xl p-3 text-center"><div className="text-lg font-bold text-white">{spammerLogs.length}</div><div className="text-[10px] text-white/40">Всего</div></div>
          </div>
          <div className="glass-card rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-white/5"><h3 className="text-sm font-semibold text-white">Логи рассылки</h3></div>
            <div className="max-h-80 overflow-y-auto divide-y divide-white/5">
              {spammerLogs.length === 0 ? (
                <div className="p-8 text-center text-xs text-white/30">Нет логов</div>
              ) : (
                [...spammerLogs].reverse().map(log => (
                  <div key={log.id} className="px-4 py-2 flex items-center gap-2">
                    {log.status === 'sent' ? <CheckCircle size={12} className="text-green-400 shrink-0" /> :
                     log.status === 'error' ? <XCircle size={12} className="text-red-400 shrink-0" /> :
                     <Clock size={12} className="text-yellow-400 shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-white truncate"><span className="text-white/50">{log.accountLogin}</span> → <span>{log.friendName}</span></div>
                      {log.error && <div className="text-[10px] text-red-400">{log.error}</div>}
                    </div>
                    <div className="text-[9px] text-white/20 shrink-0">
                      {new Date(log.timestamp).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
