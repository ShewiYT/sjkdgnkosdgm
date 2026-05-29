import { useState } from 'react';
import { Bell, Send } from 'lucide-react';
import { useAppStore } from '../store';

export default function NotificationsView() {
  const { notificationSettings, updateNotificationSettings } = useAppStore();
  const [testStatus, setTestStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [testResult, setTestResult] = useState('');

  const testTelegram = async () => {
    setTestStatus('sending');
    try {
      const res = await fetch(
        `https://api.telegram.org/bot${notificationSettings.telegramBotToken}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: notificationSettings.telegramAdminId,
            text: '🔔 <b>Тест уведомлений SukaCombine</b>\n\nЕсли вы видите это сообщение - Telegram уведомления работают! ✅',
            parse_mode: 'HTML',
          }),
        }
      );
      const data = await res.json();
      if (data.ok) {
        setTestStatus('success');
        setTestResult('Telegram: сообщение отправлено ✅');
      } else {
        setTestStatus('error');
        setTestResult(`Telegram ошибка: ${data.description}`);
      }
    } catch {
      setTestStatus('error');
      setTestResult('Telegram: ошибка подключения');
    }
    setTimeout(() => setTestStatus('idle'), 5000);
  };

  const testDiscord = async () => {
    setTestStatus('sending');
    try {
      const res = await fetch(notificationSettings.discordWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content:
            '🔔 **Тест уведомлений SukaCombine**\n\nЕсли вы видите это сообщение - Discord уведомления работают! ✅',
          username: 'SukaCombine Bot',
        }),
      });
      if (res.ok || res.status === 204) {
        setTestStatus('success');
        setTestResult('Discord: сообщение отправлено ✅');
      } else {
        setTestStatus('error');
        setTestResult(`Discord ошибка: ${res.status}`);
      }
    } catch {
      setTestStatus('error');
      setTestResult('Discord: ошибка подключения');
    }
    setTimeout(() => setTestStatus('idle'), 5000);
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in overflow-y-auto max-h-[calc(100vh-52px)]">
      <div>
        <h1 className="text-2xl font-semibold text-white flex items-center gap-2">
          <Bell size={24} />
          Уведомления
        </h1>
        <p className="text-sm text-white/40 mt-1">Настройка Telegram и Discord</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl">
        <div className="glass-card rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">📱 Telegram</h3>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={notificationSettings.enableTelegram}
                onChange={e => updateNotificationSettings({ enableTelegram: e.target.checked })}
                className="w-4 h-4 rounded"
              />
              <span className="text-xs text-white/50">Включить</span>
            </label>
          </div>
          <div>
            <label className="text-xs text-white/50 mb-1 block">Bot Token</label>
            <input
              type="text"
              value={notificationSettings.telegramBotToken}
              onChange={e => updateNotificationSettings({ telegramBotToken: e.target.value })}
              placeholder="123456789:ABCdef..."
              className="w-full glass-input text-sm text-white px-3 py-2 rounded-xl outline-none font-mono"
            />
          </div>
          <div>
            <label className="text-xs text-white/50 mb-1 block">ID Админа</label>
            <input
              type="text"
              value={notificationSettings.telegramAdminId}
              onChange={e => updateNotificationSettings({ telegramAdminId: e.target.value })}
              placeholder="123456789"
              className="w-full glass-input text-sm text-white px-3 py-2 rounded-xl outline-none font-mono"
            />
          </div>
          <button
            onClick={testTelegram}
            disabled={
              !notificationSettings.telegramBotToken ||
              !notificationSettings.telegramAdminId ||
              testStatus === 'sending'
            }
            className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-blue-500/20 text-blue-400 text-xs hover:bg-blue-500/30 transition-colors disabled:opacity-30"
          >
            <Send size={12} /> {testStatus === 'sending' ? 'Отправка...' : 'Тест Telegram'}
          </button>
        </div>

        <div className="glass-card rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">💬 Discord</h3>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={notificationSettings.enableDiscord}
                onChange={e => updateNotificationSettings({ enableDiscord: e.target.checked })}
                className="w-4 h-4 rounded"
              />
              <span className="text-xs text-white/50">Включить</span>
            </label>
          </div>
          <div>
            <label className="text-xs text-white/50 mb-1 block">Webhook URL</label>
            <input
              type="text"
              value={notificationSettings.discordWebhookUrl}
              onChange={e => updateNotificationSettings({ discordWebhookUrl: e.target.value })}
              placeholder="https://discord.com/api/webhooks/..."
              className="w-full glass-input text-sm text-white px-3 py-2 rounded-xl outline-none font-mono"
            />
          </div>
          <button
            onClick={testDiscord}
            disabled={!notificationSettings.discordWebhookUrl || testStatus === 'sending'}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-purple-500/20 text-purple-400 text-xs hover:bg-purple-500/30 transition-colors disabled:opacity-30"
          >
            <Send size={12} /> {testStatus === 'sending' ? 'Отправка...' : 'Тест Discord'}
          </button>
        </div>
      </div>

      {testResult && (
        <div
          className={`glass-card rounded-xl p-3 text-xs max-w-4xl ${
            testStatus === 'success'
              ? 'text-green-400 bg-green-500/10'
              : testStatus === 'error'
              ? 'text-red-400 bg-red-500/10'
              : 'text-white/60'
          }`}
        >
          {testResult}
        </div>
      )}

      <div className="glass-card rounded-2xl p-5 space-y-4 max-w-2xl">
        <h3 className="text-sm font-semibold text-white">Какие уведомления отправлять</h3>
        <div className="space-y-2">
          {[
            { key: 'notifyAccountsLoaded' as const, label: 'Загрузка аккаунтов' },
            { key: 'notifyNewMessage' as const, label: 'Новые сообщения' },
            { key: 'notifyLogin' as const, label: 'Вход в аккаунт' },
            { key: 'notifyErrors' as const, label: 'Ошибки' },
          ].map(item => (
            <label key={item.key} className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={notificationSettings[item.key]}
                onChange={e => updateNotificationSettings({ [item.key]: e.target.checked })}
                className="w-4 h-4 rounded"
              />
              <span className="text-sm text-white/60">{item.label}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
