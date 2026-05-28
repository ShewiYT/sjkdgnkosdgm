import { useState } from 'react';
import { Settings, Save, Upload, Download, Server, Key, Bell, Palette } from 'lucide-react';

export default function SettingsView() {
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Settings size={24} /> Настройки
        </h1>
        <p className="text-sm text-steam-text mt-1">Общие настройки SukaCombine</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Import/Export */}
        <div className="bg-steam-card rounded-xl neon-border p-4 space-y-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Upload size={16} /> Импорт / Экспорт
          </h3>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-steam-text block mb-1">Импорт аккаунтов (maFile / JSON)</label>
              <div className="border-2 border-dashed border-steam-border rounded-lg p-6 text-center hover:border-neon-blue/50 transition-colors cursor-pointer">
                <Upload size={24} className="mx-auto mb-2 text-steam-text" />
                <div className="text-xs text-steam-text">Перетащите файлы сюда или нажмите</div>
                <div className="text-[10px] text-steam-text/50 mt-1">Поддерживаемые форматы: .maFile, .json</div>
              </div>
            </div>
            <div className="flex gap-2">
              <button className="flex-1 flex items-center justify-center gap-2 py-2 bg-neon-blue/20 text-neon-blue rounded-lg hover:bg-neon-blue/30 transition-colors text-xs">
                <Upload size={14} /> Импорт
              </button>
              <button className="flex-1 flex items-center justify-center gap-2 py-2 bg-steam-dark text-steam-text hover:text-white rounded-lg transition-colors text-xs">
                <Download size={14} /> Экспорт
              </button>
            </div>
          </div>
        </div>

        {/* Server Settings */}
        <div className="bg-steam-card rounded-xl neon-border p-4 space-y-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Server size={16} /> Серверы
          </h3>
          <div className="space-y-3">
            {['EU-1', 'EU-2', 'EU-3', 'RU-1', 'RU-2', 'US-1', 'US-2'].map(srv => (
              <div key={srv} className="flex items-center justify-between p-2 rounded-lg bg-steam-dark/50">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-neon-green" />
                  <span className="text-xs text-white">{srv}</span>
                </div>
                <div className="text-[10px] text-steam-text">
                  {Math.floor(Math.random() * 5) + 1} аккаунтов • {Math.floor(Math.random() * 30 + 10)}ms
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* API Keys */}
        <div className="bg-steam-card rounded-xl neon-border p-4 space-y-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Key size={16} /> API ключи
          </h3>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-steam-text block mb-1">Steam Web API Key</label>
              <input
                type="password"
                defaultValue="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                className="w-full bg-steam-input text-sm text-white px-3 py-2 rounded-lg border border-steam-border outline-none"
              />
            </div>
            <div>
              <label className="text-xs text-steam-text block mb-1">Proxy (опционально)</label>
              <input
                type="text"
                placeholder="socks5://user:pass@host:port"
                className="w-full bg-steam-input text-sm text-white px-3 py-2 rounded-lg border border-steam-border outline-none"
              />
            </div>
          </div>
        </div>

        {/* Notifications */}
        <div className="bg-steam-card rounded-xl neon-border p-4 space-y-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Bell size={16} /> Уведомления
          </h3>
          <div className="space-y-2">
            {[
              'Новое сообщение в чате',
              'Входящий трейд оффер',
              'Изменение статуса друга',
              'Trade Ban / VAC Ban',
              'Ошибка подключения',
              'Успешный Level Up',
            ].map(item => (
              <label key={item} className="flex items-center justify-between text-xs text-steam-text hover:text-white transition-colors cursor-pointer">
                <span>{item}</span>
                <input type="checkbox" defaultChecked className="accent-neon-blue" />
              </label>
            ))}
          </div>
        </div>

        {/* Theme */}
        <div className="bg-steam-card rounded-xl neon-border p-4 space-y-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Palette size={16} /> Тема
          </h3>
          <div className="grid grid-cols-4 gap-2">
            {[
              { name: 'Синяя', color: 'bg-neon-blue' },
              { name: 'Фиолетовая', color: 'bg-neon-purple' },
              { name: 'Зеленая', color: 'bg-neon-green' },
              { name: 'Оранжевая', color: 'bg-neon-orange' },
            ].map(theme => (
              <button key={theme.name} className="flex flex-col items-center gap-1 p-3 rounded-lg bg-steam-dark hover:bg-steam-hover transition-colors">
                <span className={`w-6 h-6 rounded-full ${theme.color}`} />
                <span className="text-[10px] text-steam-text">{theme.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* VPS Info */}
        <div className="bg-steam-card rounded-xl neon-border p-4 space-y-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Server size={16} /> VPS Информация
          </h3>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between text-steam-text">
              <span>Версия:</span>
              <span className="text-white">SukaCombine v7.4</span>
            </div>
            <div className="flex justify-between text-steam-text">
              <span>Node.js:</span>
              <span className="text-white">v18.17.0</span>
            </div>
            <div className="flex justify-between text-steam-text">
              <span>Аптайм:</span>
              <span className="text-neon-green">14д 6ч 32м</span>
            </div>
            <div className="flex justify-between text-steam-text">
              <span>RAM:</span>
              <span className="text-white">1.2 GB / 4 GB</span>
            </div>
            <div className="flex justify-between text-steam-text">
              <span>CPU:</span>
              <span className="text-white">23%</span>
            </div>
          </div>
        </div>
      </div>

      <button
        onClick={handleSave}
        className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium transition-all ${
          saved
            ? 'bg-neon-green/20 text-neon-green'
            : 'bg-gradient-to-r from-neon-blue to-neon-purple text-white hover:opacity-90'
        }`}
      >
        <Save size={16} />
        {saved ? '✅ Сохранено!' : 'Сохранить настройки'}
      </button>
    </div>
  );
}
