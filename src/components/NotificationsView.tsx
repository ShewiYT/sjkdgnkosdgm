import { useState } from 'react';
import { Bell, Send, Save } from 'lucide-react';
import { useAppStore } from '../store';
import { NotificationTemplates } from '../notifications';

export default function NotificationsView() {
  const { notificationSettings, updateNotificationSettings } = useAppStore();
  const [testStatus, setTestStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [testResult, setTestResult] = useState('');

  const handleSave = () => {
    // Settings are auto-saved via zustand persist
    setTestResult('Настройки сохранены!');
    setTimeout(() => setTestResult(''), 3000);
  };

  const testTelegram = async () => {
    setTestStatus('sending');
    try {
      const res = await fetch(`https://api.telegram.org/bot${notificationSettings.telegramBotToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: notificationSettings.telegramAdminId,
          text: '🔔 <b>Тест уведомлений SukaCombine</b>\n\nЕсли вы видите это сообщение - Telegram уведомления работают! ✅',
          parse_mode: 'HTML',
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setTestStatus('success');
        setTestResult('Telegram: сообщение отправлено ✅');
      } else {
        setTestStatus('error');
        setTestResult(`Telegram ошибка: ${data.description}`);
      }
    } catch (e) {
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
          content: '🔔 **Тест уведомлений SukaCombine**\n\nЕсли вы видите это сообщение - Discord уведомления работают! ✅',
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
        <p className="text-sm text-white/40 mt-1">Настройка Telegram и Discord уведомлений</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl">
        {/* Telegram */}
        <div className="glass-card rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <span className="text-lg">📱</span>
              Telegram
            </h3>
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
            <div className="text-[10px] text-white/20 mt-1">
              Получите токен у @BotFather в Telegram
            </div>
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
            <div className="text-[10px] text-white/20 mt-1">
              Узнайте свой ID у @userinfobot
            </div>
          </div>

          <button
            onClick={testTelegram}
            disabled={!notificationSettings.telegramBotToken || !notificationSettings.telegramAdminId || testStatus === 'sending'}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-blue-500/20 text-blue-400 text-xs hover:bg-blue-500/30 transition-colors disabled:opacity-30"
          >
            <Send size={12} />
            {testStatus === 'sending' ? 'Отправка...' : 'Тест Telegram'}
          </button>
        </div>

        {/* Discord */}
        <div className="glass-card rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <span className="text-lg">💬</span>
              Discord
            </h3>
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
            <div className="text-[10px] text-white/20 mt-1">
              Настройки канала → Интеграции → Вебхуки → Создать Вебхук
            </div>
          </div>

          <button
            onClick={testDiscord}
            disabled={!notificationSettings.discordWebhookUrl || testStatus === 'sending'}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-purple-500/20 text-purple-400 text-xs hover:bg-purple-500/30 transition-colors disabled:opacity-30"
          >
            <Send size={12} />
            {testStatus === 'sending' ? 'Отправка...' : 'Тест Discord'}
          </button>
        </div>
      </div>

      {/* Test result */}
      {testResult && (
        <div className={`glass-card rounded-xl p-3 text-xs ${
          testStatus === 'success' ? 'text-green-400 bg-green-500/10' :
          testStatus === 'error' ? 'text-red-400 bg-red-500/10' :
          'text-white/60'
        }`}>
          {testResult}
        </div>
      )}

      {/* Notification types */}
      <div className="glass-card rounded-2xl p-5 space-y-4 max-w-2xl">
        <h3 className="text-sm font-semibold text-white">Какие уведомления отправлять</h3>

        <div className="space-y-3">
          {[
            { key: 'notifyAccountsLoaded' as const, label: 'Загрузка аккаунтов', desc: 'Загружены аккаунты в кол-ве: N штук', emoji: '🔄' },
            { key: 'notifyNewMessage' as const, label: 'Новое сообщение', desc: 'У вас новое сообщение от пользователя (имя)', emoji: '💬' },
            { key: 'notifyFriendsStart' as const, label: 'Начало добавления в друзья', desc: 'Процесс добавления в друзья начат', emoji: '👥' },
            { key: 'notifyFriendsEnd' as const, label: 'Конец добавления в друзья', desc: 'Отправлено запросов: N, приняли: N', emoji: '✅' },
            { key: 'notifyLogin' as const, label: 'Вход в аккаунт', desc: 'Аккаунт залогинился / ошибка входа', emoji: '🔑' },
            { key: 'notifyErrors' as const, label: 'Ошибки аккаунтов', desc: 'Ошибки подключения, баны и т.д.', emoji: '⚠️' },
          ].map(item => (
            <label key={item.key} className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={notificationSettings[item.key]}
                onChange={e => updateNotificationSettings({ [item.key]: e.target.checked })}
                className="w-4 h-4 rounded mt-0.5 shrink-0"
              />
              <div>
                <div className="text-xs text-white group-hover:text-white/80 flex items-center gap-1">
                  <span>{item.emoji}</span>
                  {item.label}
                </div>
                <div className="text-[10px] text-white/30">{item.desc}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Example templates */}
      <div className="glass-card rounded-2xl p-5 space-y-3 max-w-2xl">
        <h3 className="text-sm font-semibold text-white">Примеры уведомлений</h3>
        <div className="space-y-2">
          {[
            { label: 'Загрузка аккаунтов', msg: NotificationTemplates.accountsLoaded(15) },
            { label: 'Новое сообщение', msg: NotificationTemplates.newMessage('PlayerOne', '76561198012345678', 'Привет, давай обмен?') },
            { label: 'Начало добавления в друзья', msg: NotificationTemplates.friendsProcessStart('my_account', 50) },
            { label: 'Конец добавления в друзья', msg: NotificationTemplates.friendsProcessEnd('my_account', 50, 23) },
            { label: 'Вход в аккаунт', msg: NotificationTemplates.accountLogin('my_account', 'online') },
            { label: 'Ошибка аккаунта', msg: NotificationTemplates.accountError('my_account', 'Invalid credentials') },
          ].map((ex, i) => (
            <div key={i} className="bg-white/3 rounded-xl p-3">
              <div className="text-[10px] text-white/40 mb-1">{ex.label}:</div>
              <div className="text-xs text-white/70 whitespace-pre-line" dangerouslySetInnerHTML={{ __html: ex.msg }} />
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={handleSave}
        className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-medium text-sm hover:opacity-90 transition-opacity"
      >
        <Save size={16} />
        Сохранить настройки
      </button>
    </div>
  );
}
