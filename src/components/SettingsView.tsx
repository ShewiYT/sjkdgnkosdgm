import { useState } from 'react';
import { Settings, Key, Trash2, Database, AlertTriangle } from 'lucide-react';
import { useAppStore } from '../store';
import type { SteamAccount } from '../types';

interface SettingsViewProps {
  accounts: SteamAccount[];
}

export default function SettingsView({ accounts }: SettingsViewProps) {
  const { steamMarketApiKey, setSteamMarketApiKey, clearAccounts, fetchInventoryValues } = useAppStore();
  const [clearing, setClearing] = useState(false);
  const [fetchingInventory, setFetchingInventory] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  const handleClear = async () => {
    if (!confirmClear) {
      setConfirmClear(true);
      setTimeout(() => setConfirmClear(false), 5000);
      return;
    }
    setClearing(true);
    clearAccounts();
    setClearing(false);
    setConfirmClear(false);
  };

  const handleFetchInventory = async () => {
    setFetchingInventory(true);
    await fetchInventoryValues();
    setFetchingInventory(false);
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in overflow-y-auto max-h-[calc(100vh-52px)]">
      <div>
        <h1 className="text-2xl font-semibold text-white flex items-center gap-2">
          <Settings size={24} />
          Настройки
        </h1>
        <p className="text-sm text-white/40 mt-1">Конфигурация панели</p>
      </div>

      <div className="space-y-4 max-w-2xl">
        {/* Steam Market API key */}
        <div className="glass-card rounded-2xl p-5 space-y-3">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Key size={16} />
            Steam Market API Key
          </h3>
          <p className="text-xs text-white/40">
            Используется для получения стоимости инвентаря в мультичате и дашборде.
          </p>
          <input
            value={steamMarketApiKey}
            onChange={e => setSteamMarketApiKey(e.target.value)}
            placeholder="5E2360739CA18D2898E957F7936DA9AE"
            className="w-full glass-input text-sm text-white px-3 py-2 rounded-xl outline-none font-mono"
          />
          <button
            onClick={handleFetchInventory}
            disabled={fetchingInventory || accounts.filter(a => a.status === 'online' || a.status === 'in-game').length === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-500/20 text-blue-400 text-xs hover:bg-blue-500/30 transition-colors disabled:opacity-30"
          >
            {fetchingInventory ? '⏳ Загрузка...' : '💰 Загрузить стоимость инвентарей'}
          </button>
        </div>

        {/* SQLite info */}
        <div className="glass-card rounded-2xl p-5 space-y-3">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Database size={16} />
            База данных SQLite
          </h3>
          <div className="space-y-1 text-xs text-white/40">
            <div>📁 Файл: ./data/sukacombine.db</div>
            <div>📊 Таблицы: users, workers, accounts, messages, trade_offers, parser_keys, parse_jobs, settings</div>
            <div>⚡ WAL mode для лучшей производительности</div>
            <div>🔄 Автосохранение при каждом изменении</div>
          </div>
          <div className="text-[10px] text-white/20 font-mono bg-white/5 px-3 py-2 rounded-xl">
            cp ./data/sukacombine.db ./data/backup_$(date +%Y%m%d).db
          </div>
        </div>

        {/* Danger zone */}
        <div className="glass-card rounded-2xl p-5 space-y-3 border border-red-500/20">
          <h3 className="text-sm font-semibold text-red-400 flex items-center gap-2">
            <AlertTriangle size={16} />
            Опасная зона
          </h3>
          <p className="text-xs text-white/40">
            Удаление всех видимых вам аккаунтов. Это действие необратимо.
          </p>
          <button
            onClick={handleClear}
            disabled={clearing || accounts.length === 0}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs transition-colors disabled:opacity-30 ${
              confirmClear
                ? 'bg-red-500/30 text-red-300 border border-red-500/50'
                : 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
            }`}
          >
            <Trash2 size={14} />
            {confirmClear ? '⚠️ Нажмите ещё раз для подтверждения' : 'Очистить все аккаунты'}
          </button>
        </div>

        {/* Version info */}
        <div className="glass-card rounded-2xl p-4 text-center space-y-1">
          <div className="text-sm font-semibold text-white">SukaCombine v3.0</div>
          <div className="text-xs text-white/30">Steam Panel • SQLite DB • Suka Team</div>
          <div className="text-xs text-white/20">
            Аккаунтов: {accounts.length} • Онлайн:{' '}
            {accounts.filter(a => a.status === 'online' || a.status === 'in-game').length}
          </div>
        </div>
      </div>
    </div>
  );
}
