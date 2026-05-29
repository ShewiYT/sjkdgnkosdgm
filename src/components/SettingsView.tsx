import { Settings, Database, AlertTriangle, Key } from 'lucide-react';
import { useAppStore } from '../store';
import type { SteamAccount } from '../types';

interface SettingsViewProps { accounts: SteamAccount[]; }

export default function SettingsView({ accounts }: SettingsViewProps) {
  const { clearAccounts, steamMarketApiKey, setSteamMarketApiKey, serverConnected, steamAvailable } = useAppStore();

  return (
    <div className="p-6 space-y-6 animate-fade-in overflow-y-auto max-h-[calc(100vh-52px)]">
      <div>
        <h1 className="text-2xl font-semibold text-white flex items-center gap-2"><Settings size={24} /> Настройки</h1>
        <p className="text-sm text-white/40 mt-1">Конфигурация панели</p>
      </div>

      <div className="max-w-2xl space-y-6">
        {/* Server status */}
        <div className="glass-card rounded-2xl p-5 space-y-3">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Database size={16} className="text-indigo-400" /> Статус сервера
          </h3>
          <div className="space-y-2">
            <div className={`flex items-center gap-2 text-sm ${serverConnected ? 'text-green-400' : 'text-red-400'}`}>
              <span className={`w-2 h-2 rounded-full ${serverConnected ? 'bg-green-400' : 'bg-red-400'}`} />
              {serverConnected ? 'Сервер подключен' : 'Сервер не подключен'}
            </div>
            {serverConnected && (
              <div className={`flex items-center gap-2 text-sm ${steamAvailable ? 'text-green-400' : 'text-yellow-400'}`}>
                <span className={`w-2 h-2 rounded-full ${steamAvailable ? 'bg-green-400' : 'bg-yellow-400'}`} />
                {steamAvailable ? 'steam-user установлен — реальное подключение к Steam' : 'steam-user НЕ установлен — аккаунты не войдут в Steam реально'}
              </div>
            )}
          </div>
          {(!serverConnected || !steamAvailable) && (
            <div className="text-xs text-white/40 p-3 bg-yellow-500/5 rounded-xl border border-yellow-500/10">
              <p className="text-yellow-400/80 mb-1">⚠️ Для реального подключения к Steam:</p>
              <code className="block bg-white/5 px-3 py-2 rounded-lg text-white/50 mt-1 whitespace-pre">npm install steam-user steam-totp{'\n'}node server.js</code>
            </div>
          )}
        </div>

        {/* Inventory pricing */}
        <div className="glass-card rounded-2xl p-5 space-y-3">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Key size={16} className="text-green-400" /> 💰 Цены инвентаря — Self-hosted
          </h3>
          <p className="text-xs text-white/40">
            Стоимость инвентаря считается полностью на вашем сервере.
            Цены берутся напрямую со <strong className="text-white/60">Steam Community Market</strong> — бесплатно, без API ключей.
          </p>
          <div className="text-xs text-white/30 p-3 bg-white/3 rounded-xl space-y-1">
            <div>✅ Каждый предмет оценивается отдельно (не экстраполяция)</div>
            <div>✅ Цены кэшируются на 30 мин для скорости</div>
            <div>✅ Полностью self-hosted — никаких внешних API</div>
            <div>⏱️ Первый запрос ~3 сек/предмет (Steam rate limit), далее из кэша мгновенно</div>
          </div>
        </div>

        {/* Steam API key */}
        <div className="glass-card rounded-2xl p-5 space-y-3">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2"><Key size={16} className="text-white/30" /> Steam API Key (опционально)</h3>
          <p className="text-xs text-white/30">Для парсера и доп. информации о профилях.</p>
          <input
            value={steamMarketApiKey} onChange={e => setSteamMarketApiKey(e.target.value)}
            placeholder="Steam Web API Key" className="w-full glass-input text-sm text-white px-3 py-2 rounded-xl outline-none font-mono"
          />
        </div>

        {/* SQLite info */}
        <div className="glass-card rounded-2xl p-5 space-y-3">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2"><Database size={16} className="text-blue-400" /> База данных SQLite</h3>
          <div className="text-xs text-white/40 space-y-1">
            <div>📁 Файл: ./data/sukacombine.db</div>
            <div>📊 Таблицы: users, workers, accounts, messages, trade_offers</div>
            <div>⚡ WAL mode для лучшей производительности</div>
          </div>
        </div>

        {/* Danger zone */}
        <div className="glass-card rounded-2xl p-5 space-y-3 border-red-500/20">
          <h3 className="text-sm font-semibold text-red-400 flex items-center gap-2"><AlertTriangle size={16} /> Опасная зона</h3>
          <p className="text-xs text-white/40">Удаление всех видимых вам аккаунтов. Это действие необратимо.</p>
          <button onClick={clearAccounts} className="px-4 py-2 rounded-xl bg-red-500/20 text-red-400 text-xs hover:bg-red-500/30">
            🗑️ Удалить все аккаунты
          </button>
        </div>

        {/* Version */}
        <div className="text-center py-4 space-y-1">
          <div className="text-xs text-white/20">SukaCombine v3.1</div>
          <div className="text-[10px] text-white/10">Steam Panel • Real Steam Connection • Suka Team</div>
          <div className="text-[10px] text-white/10">
            Аккаунтов: {accounts.length} • Онлайн: {accounts.filter(a => a.status === 'online' || a.status === 'in-game').length}
          </div>
        </div>
      </div>
    </div>
  );
}
