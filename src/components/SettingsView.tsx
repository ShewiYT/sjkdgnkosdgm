import { useState } from 'react';
import { Settings, Save, Upload, Download, Server, Key, Bell, Palette } from 'lucide-react';

export default function SettingsView() {
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in overflow-y-auto max-h-[calc(100vh-52px)]">
      <div>
        <h1 className="text-2xl font-semibold text-white flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl glass-accent flex items-center justify-center">
            <Settings size={20} />
          </div>
          Настройки
        </h1>
        <p className="text-sm text-white/50 mt-1">Общие настройки SukaCombine</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Import/Export */}
        <div className="glass-card rounded-2xl p-4 space-y-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Upload size={16} /> Импорт / Экспорт
          </h3>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-white/50 block mb-1">Импорт аккаунтов (maFile / JSON)</label>
              <div className="border-2 border-dashed border-white/10 rounded-lg p-6 text-center hover:border-blue-500/30 transition-colors cursor-pointer">
                <Upload size={24} className="mx-auto mb-2 text-white/30" />
                <div className="text-xs text-white/50">Перетащите файлы сюда или нажмите</div>
                <div className="text-[10px] text-white/30 mt-1">Поддерживаемые форматы: .maFile, .json</div>
              </div>
            </div>
            <div className="flex gap-2">
              <button className="flex-1 flex items-center justify-center gap-2 py-2 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-colors text-xs">
                <Upload size={14} /> Импорт
              </button>
              <button className="flex-1 flex items-center justify-center gap-2 py-2 glass-button text-white/50 rounded-lg text-xs">
                <Download size={14} /> Экспорт
              </button>
            </div>
          </div>
        </div>

        {/* Server Settings */}
        <div className="glass-card rounded-2xl p-4 space-y-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Server size={16} /> Серверы
          </h3>
          <div className="space-y-2">
            {['EU-1', 'EU-2', 'EU-3', 'RU-1', 'RU-2', 'US-1', 'US-2'].map(srv => (
              <div key={srv} className="flex items-center justify-between p-2 rounded-lg glass-light">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-400" />
                  <span className="text-xs text-white">{srv}</span>
                </div>
                <div className="text-[10px] text-white/40">
                  {Math.floor(Math.random() * 5) + 1} аккаунтов • {Math.floor(Math.random() * 30 + 10)}ms
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* API Keys */}
        <div className="glass-card rounded-2xl p-4 space-y-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Key size={16} /> API ключи
          </h3>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-white/50 block mb-1">Steam Web API Key</label>
              <input
                type="password"
                defaultValue="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                className="w-full glass-input text-sm text-white px-3 py-2 rounded-lg outline-none"
              />
            </div>
            <div>
              <label className="text-xs text-white/50 block mb-1">Proxy (опционально)</label>
              <input
                type="text"
                placeholder="socks5://user:pass@host:port"
                className="w-full glass-input text-sm text-white px-3 py-2 rounded-lg outline-none"
              />
            </div>
          </div>
        </div>

        {/* Notifications */}
        <div className="glass-card rounded-2xl p-4 space-y-4">
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
              <label key={item} className="flex items-center justify-between text-xs text-white/50 hover:text-white transition-colors cursor-pointer">
                <span>{item}</span>
                <input type="checkbox" defaultChecked className="accent-blue-500" />
              </label>
            ))}
          </div>
        </div>

        {/* Theme */}
        <div className="glass-card rounded-2xl p-4 space-y-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Palette size={16} /> Тема
          </h3>
          <div className="grid grid-cols-4 gap-2">
            {[
              { name: 'Синяя', color: 'bg-blue-500' },
              { name: 'Фиолетовая', color: 'bg-purple-500' },
              { name: 'Зеленая', color: 'bg-green-500' },
              { name: 'Оранжевая', color: 'bg-orange-500' },
            ].map(theme => (
              <button key={theme.name} className="flex flex-col items-center gap-1 p-3 rounded-lg glass-light hover:bg-white/10 transition-colors">
                <span className={`w-6 h-6 rounded-full ${theme.color}`} />
                <span className="text-[10px] text-white/50">{theme.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* VPS Info */}
        <div className="glass-card rounded-2xl p-4 space-y-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Server size={16} /> VPS Информация
          </h3>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between text-white/50">
              <span>Версия:</span>
              <span className="text-white">SukaCombine v7.5</span>
            </div>
            <div className="flex justify-between text-white/50">
              <span>Node.js:</span>
              <span className="text-white">v20.11.0</span>
            </div>
            <div className="flex justify-between text-white/50">
              <span>Аптайм:</span>
              <span className="text-green-400">14д 6ч 32м</span>
            </div>
            <div className="flex justify-between text-white/50">
              <span>RAM:</span>
              <span className="text-white">1.2 GB / 4 GB</span>
            </div>
            <div className="flex justify-between text-white/50">
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
            ? 'bg-green-500/20 text-green-400'
            : 'glass-accent text-white hover:opacity-90'
        }`}
      >
        <Save size={16} />
        {saved ? '✅ Сохранено!' : 'Сохранить настройки'}
      </button>
    </div>
  );
}
