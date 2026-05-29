import { Settings, Download, Trash2, Database } from 'lucide-react';
import { useAppStore } from '../store';

export default function SettingsView() {
  const { accounts, clearAccounts } = useAppStore();

  const exportData = () => {
    const data = {
      accounts: accounts.map(a => ({
        login: a.login,
        password: a.password,
        steamId: a.steamId,
        level: a.level,
        balance: a.balance,
        inventoryValue: a.inventoryValue,
        guardEnabled: a.guardEnabled,
      })),
      exportDate: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sukacombine_export_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportAccounts = () => {
    const text = accounts.map(a => `${a.login}:${a.password}`).join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `accounts_${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
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
        <div className="glass-card rounded-2xl p-4 space-y-3">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Database size={16} />
            Данные
          </h3>

          <div className="flex gap-2">
            <button
              onClick={exportData}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 text-white/60 text-xs hover:bg-white/10 transition-colors"
            >
              <Download size={14} /> Экспорт JSON
            </button>
            <button
              onClick={exportAccounts}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 text-white/60 text-xs hover:bg-white/10 transition-colors"
            >
              <Download size={14} /> Экспорт login:pass
            </button>
          </div>
        </div>

        <div className="glass-card rounded-2xl p-4 space-y-3">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Database size={16} className="text-green-400" />
            База данных SQLite
          </h3>
          <div className="text-xs text-white/40 space-y-1">
            <div>📁 Файл: <code className="text-indigo-400">./data/sukacombine.db</code></div>
            <div>📊 Таблицы: users, workers, accounts, messages, trade_offers, parser_keys, parse_jobs, settings</div>
            <div>⚡ WAL mode для лучшей производительности</div>
            <div>🔄 Автосохранение при каждом изменении</div>
          </div>
          <div className="text-[10px] text-white/20">
            Бэкап: <code>cp ./data/sukacombine.db ./data/backup_$(date +%Y%m%d).db</code>
          </div>
        </div>

        <div className="glass-card rounded-2xl p-4 space-y-3 border border-red-500/10">
          <h3 className="text-sm font-semibold text-red-400">Опасная зона</h3>
          <button
            onClick={() => {
              if (confirm('Удалить все аккаунты? Это действие нельзя отменить.')) {
                clearAccounts();
              }
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/10 text-red-400 text-xs hover:bg-red-500/20 transition-colors"
          >
            <Trash2 size={14} /> Очистить все аккаунты
          </button>
        </div>

        <div className="glass-card rounded-2xl p-4">
          <div className="text-sm text-white font-medium mb-1">SukaCombine v3.0</div>
          <div className="text-xs text-white/30">Steam Panel • SQLite DB • Suka Team</div>
          <div className="text-[10px] text-white/20 mt-2">
            Аккаунтов: {accounts.length} •
            Онлайн: {accounts.filter(a => a.status === 'online' || a.status === 'in-game').length}
          </div>
        </div>
      </div>
    </div>
  );
}
