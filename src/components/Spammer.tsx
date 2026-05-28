import { useState, useEffect } from 'react';
import { Megaphone, Play, Square, AlertTriangle, Users, MessageSquare, CheckCircle, XCircle } from 'lucide-react';
import { useAppStore } from '../store';
import { steamApi } from '../api';
import { NotificationTemplates, DiscordTemplates } from '../notifications';
import type { SteamAccount } from '../types';

interface SpammerProps {
  accounts: SteamAccount[];
}

interface SpamLog {
  friendId: string;
  friendName: string;
  status: 'sent' | 'error';
  error?: string;
  timestamp: string;
}

export default function Spammer({ accounts }: SpammerProps) {
  const { messages, notify, notificationSettings } = useAppStore();
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [messageText, setMessageText] = useState('');
  const [delay, setDelay] = useState(3);
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<SpamLog[]>([]);
  const [progress, setProgress] = useState({ sent: 0, failed: 0, total: 0 });
  const [friendsWithNoMessages, setFriendsWithNoMessages] = useState<{ steamId: string; name: string }[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(false);

  const onlineAccounts = accounts.filter(a => a.status === 'online' || a.status === 'in-game');
  const selectedAccount = accounts.find(a => a.id === selectedAccountId);

  // Load friends who have NO messages with us
  const loadFriendsWithNoMessages = async () => {
    if (!selectedAccountId) return;
    setLoadingFriends(true);

    try {
      const friends = await steamApi.getFriends(selectedAccountId);

      // Get all friend IDs that already have messages
      const friendsWithMessages = new Set(
        messages
          .filter(m => m.accountId === selectedAccountId)
          .map(m => m.friendId)
      );

      // Filter: only those with NO messages at all
      const noMsgFriends = friends
        .filter(f => !friendsWithMessages.has(f.steamId))
        .map(f => ({ steamId: f.steamId, name: f.name }));

      setFriendsWithNoMessages(noMsgFriends);
    } catch {
      setFriendsWithNoMessages([]);
    }

    setLoadingFriends(false);
  };

  useEffect(() => {
    if (selectedAccountId) {
      loadFriendsWithNoMessages();
    }
  }, [selectedAccountId]);

  const startSpam = async () => {
    if (!selectedAccountId || !messageText.trim() || friendsWithNoMessages.length === 0) return;

    setIsRunning(true);
    setLogs([]);
    const total = friendsWithNoMessages.length;
    setProgress({ sent: 0, failed: 0, total });

    // Notify start
    if (notificationSettings.notifyFriendsStart && selectedAccount) {
      notify(
        NotificationTemplates.spamStarted(selectedAccount.login, total),
        DiscordTemplates.spamStarted(selectedAccount.login, total)
      );
    }

    let sent = 0;
    let failed = 0;

    for (let i = 0; i < friendsWithNoMessages.length; i++) {
      if (!isRunning) break;

      const friend = friendsWithNoMessages[i];
      try {
        const success = await steamApi.sendMessage(selectedAccountId, friend.steamId, messageText);
        const log: SpamLog = {
          friendId: friend.steamId,
          friendName: friend.name,
          status: success ? 'sent' : 'error',
          error: success ? undefined : 'Не удалось отправить',
          timestamp: new Date().toISOString(),
        };
        setLogs(prev => [log, ...prev]);
        if (success) {
          sent++;
        } else {
          failed++;
        }
        setProgress({ sent, failed, total });
      } catch (err) {
        failed++;
        const log: SpamLog = {
          friendId: friend.steamId,
          friendName: friend.name,
          status: 'error',
          error: 'Ошибка сети',
          timestamp: new Date().toISOString(),
        };
        setLogs(prev => [log, ...prev]);
        setProgress({ sent, failed, total });
      }

      // Delay between messages
      if (i < friendsWithNoMessages.length - 1) {
        await new Promise(r => setTimeout(r, delay * 1000));
      }
    }

    setIsRunning(false);

    // Notify end
    if (selectedAccount) {
      notify(
        NotificationTemplates.spamFinished(selectedAccount.login, sent, failed),
        DiscordTemplates.spamFinished(selectedAccount.login, sent, failed)
      );
    }
  };

  const stopSpam = () => {
    setIsRunning(false);
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in overflow-y-auto max-h-[calc(100vh-52px)]">
      <div>
        <h1 className="text-2xl font-semibold text-white flex items-center gap-2">
          <Megaphone size={24} />
          Спамер
        </h1>
        <p className="text-sm text-white/40 mt-1">Рассылка сообщений друзьям без переписки</p>
      </div>

      <div className="glass-card rounded-2xl p-4 flex items-start gap-3">
        <AlertTriangle size={16} className="text-yellow-400 shrink-0 mt-0.5" />
        <div className="text-xs text-white/60">
          Спамер отправляет сообщения <b>только тем друзьям</b>, с которыми у вас <b>вообще нет переписки</b>.
          Используйте аккуратно — чрезмерная рассылка может привести к ограничениям Steam.
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Settings */}
        <div className="space-y-4">
          <div className="glass-card rounded-2xl p-4 space-y-4">
            <h3 className="text-sm font-semibold text-white">Настройки рассылки</h3>

            {/* Account selection */}
            <div>
              <label className="text-xs text-white/50 mb-1 block">Аккаунт-отправитель</label>
              <select
                value={selectedAccountId}
                onChange={e => setSelectedAccountId(e.target.value)}
                className="w-full glass-input text-sm text-white px-3 py-2 rounded-xl outline-none bg-transparent"
                disabled={isRunning}
              >
                <option value="" className="bg-gray-900">Выберите аккаунт</option>
                {onlineAccounts.map(acc => (
                  <option key={acc.id} value={acc.id} className="bg-gray-900">
                    {acc.login} ({acc.status})
                  </option>
                ))}
              </select>
            </div>

            {/* Message */}
            <div>
              <label className="text-xs text-white/50 mb-1 block">Сообщение</label>
              <textarea
                value={messageText}
                onChange={e => setMessageText(e.target.value)}
                placeholder="Введите сообщение для рассылки..."
                className="w-full glass-input text-sm text-white px-3 py-2 rounded-xl outline-none resize-none h-24"
                disabled={isRunning}
              />
            </div>

            {/* Delay */}
            <div>
              <label className="text-xs text-white/50 mb-1 block">Задержка между сообщениями (сек)</label>
              <input
                type="number"
                value={delay}
                onChange={e => setDelay(Math.max(1, parseInt(e.target.value) || 1))}
                min={1}
                max={60}
                className="w-full glass-input text-sm text-white px-3 py-2 rounded-xl outline-none"
                disabled={isRunning}
              />
            </div>

            {/* Friends with no messages info */}
            {selectedAccountId && (
              <div className="glass-card rounded-xl p-3">
                <div className="flex items-center gap-2 text-xs text-white/70 mb-2">
                  <Users size={14} />
                  Друзья без переписки
                </div>
                {loadingFriends ? (
                  <div className="text-xs text-white/30">Загрузка списка друзей...</div>
                ) : (
                  <div className="text-sm text-white font-medium">
                    {friendsWithNoMessages.length} человек
                  </div>
                )}
                <button
                  onClick={loadFriendsWithNoMessages}
                  className="mt-2 text-xs text-indigo-400 hover:text-indigo-300"
                  disabled={loadingFriends}
                >
                  Обновить список
                </button>
              </div>
            )}

            {/* Start/Stop buttons */}
            <div className="flex gap-2">
              {!isRunning ? (
                <button
                  onClick={startSpam}
                  disabled={!selectedAccountId || !messageText.trim() || friendsWithNoMessages.length === 0}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-30"
                >
                  <Play size={16} />
                  Начать рассылку
                </button>
              ) : (
                <button
                  onClick={stopSpam}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-red-500/20 text-red-400 font-medium text-sm hover:bg-red-500/30 transition-colors"
                >
                  <Square size={16} />
                  Остановить
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Progress & Logs */}
        <div className="space-y-4">
          {/* Progress */}
          {progress.total > 0 && (
            <div className="glass-card rounded-2xl p-4">
              <h3 className="text-sm font-semibold text-white mb-3">Прогресс</h3>
              <div className="w-full h-2 rounded-full bg-white/5 mb-3">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all"
                  style={{ width: `${((progress.sent + progress.failed) / progress.total) * 100}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-white/50">
                <span className="text-green-400">✅ Отправлено: {progress.sent}</span>
                <span className="text-red-400">❌ Ошибки: {progress.failed}</span>
                <span>Всего: {progress.total}</span>
              </div>
            </div>
          )}

          {/* Logs */}
          <div className="glass-card rounded-2xl p-4">
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <MessageSquare size={14} />
              Лог рассылки
            </h3>
            <div className="space-y-1 max-h-80 overflow-y-auto">
              {logs.length === 0 ? (
                <div className="text-xs text-white/30 text-center py-8">
                  Лог пуст. Начните рассылку.
                </div>
              ) : (
                logs.map((log, i) => (
                  <div key={i} className="flex items-center gap-2 py-1.5 text-xs border-b border-white/5 last:border-0">
                    {log.status === 'sent' ? (
                      <CheckCircle size={12} className="text-green-400 shrink-0" />
                    ) : (
                      <XCircle size={12} className="text-red-400 shrink-0" />
                    )}
                    <span className="text-white/70 truncate">{log.friendName}</span>
                    <span className="text-white/20 text-[10px] shrink-0">
                      {new Date(log.timestamp).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                    {log.error && <span className="text-red-400/50 text-[10px]">{log.error}</span>}
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
