import { useEffect, useState } from 'react';
import { Wifi, WifiOff, DollarSign, Users, ShieldCheck, AlertTriangle, Package, Star, RefreshCw, Database, ServerOff, CheckCircle } from 'lucide-react';
import type { SteamAccount } from '../types';
import { useAppStore } from '../store';

interface DashboardProps { accounts: SteamAccount[]; }

export default function Dashboard({ accounts }: DashboardProps) {
  const { messages, refreshStatuses, serverConnected, steamAvailable, checkServerConnection } = useAppStore();
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    checkServerConnection();
    const interval = setInterval(() => { refreshStatuses(); }, 30000);
    return () => clearInterval(interval);
  }, [refreshStatuses, checkServerConnection]);

  const handleRefresh = async () => { setRefreshing(true); await checkServerConnection(); await refreshStatuses(); setRefreshing(false); };

  const onlineCount = accounts.filter(a => a.status === 'online' || a.status === 'in-game').length;
  const offlineCount = accounts.filter(a => a.status === 'offline').length;
  const errorCount = accounts.filter(a => a.status === 'error').length;
  const connectingCount = accounts.filter(a => a.status === 'connecting').length;
  const totalBalance = accounts.reduce((sum, a) => sum + (a.balance || 0), 0);
  const totalInventory = accounts.reduce((sum, a) => sum + (a.inventoryValue || 0), 0);
  const totalFriends = accounts.reduce((sum, a) => sum + (a.friendsCount || 0), 0);
  const totalLevel = accounts.reduce((sum, a) => sum + (a.level || 0), 0);
  const avgLevel = accounts.length > 0 ? totalLevel / accounts.length : 0;
  const guardedCount = accounts.filter(a => a.guardEnabled).length;
  const tradeBanCount = accounts.filter(a => a.tradeBan).length;
  const vacBanCount = accounts.filter(a => a.vacBan).length;
  const limitedCount = accounts.filter(a => a.limited).length;
  const totalMessages = messages.length;

  return (
    <div className="p-6 space-y-6 animate-fade-in overflow-y-auto max-h-[calc(100vh-52px)]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Дашборд</h1>
          <p className="text-sm text-white/40 mt-1 flex items-center gap-2">Реальная статистика аккаунтов<span className="flex items-center gap-1 text-green-400/60 text-[10px]"><Database size={10} /> SQLite</span></p>
        </div>
        <button onClick={handleRefresh} disabled={refreshing} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 text-white/60 text-sm hover:bg-white/10 disabled:opacity-50">
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} /> Обновить
        </button>
      </div>

      {!serverConnected && (
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-red-500/10 border border-red-500/20">
          <ServerOff size={20} className="text-red-400 mt-0.5 shrink-0" />
          <div><div className="text-sm font-medium text-red-400">⛔ Сервер не подключен</div>
            <div className="text-xs text-red-300/60 mt-1"><p>Бэкенд сервер (server.js) не запущен или недоступен.</p>
              <code className="block bg-white/5 px-3 py-2 rounded-lg text-white/60 mt-2">npm install steam-user steam-totp{'\n'}node server.js</code>
            </div>
          </div>
        </div>
      )}
      {serverConnected && !steamAvailable && (
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-yellow-500/10 border border-yellow-500/20">
          <AlertTriangle size={20} className="text-yellow-400 mt-0.5 shrink-0" />
          <div><div className="text-sm font-medium text-yellow-400">⚠️ steam-user НЕ установлен</div></div>
        </div>
      )}
      {serverConnected && steamAvailable && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-green-500/10 border border-green-500/20">
          <CheckCircle size={16} className="text-green-400" />
          <div className="text-xs text-green-400/80">✅ Сервер подключен + steam-user установлен</div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-card rounded-2xl p-4 bg-gradient-to-br from-green-500/10 to-green-600/5"><Wifi size={20} className="text-green-400 mb-2" /><div className="text-2xl font-bold text-white">{onlineCount}</div><div className="text-xs text-white/50">Онлайн</div></div>
        <div className="glass-card rounded-2xl p-4 bg-gradient-to-br from-gray-500/10 to-gray-600/5"><WifiOff size={20} className="text-gray-400 mb-2" /><div className="text-2xl font-bold text-white">{offlineCount}</div><div className="text-xs text-white/50">Оффлайн</div></div>
        <div className="glass-card rounded-2xl p-4 bg-gradient-to-br from-red-500/10 to-red-600/5"><AlertTriangle size={20} className="text-red-400 mb-2" /><div className="text-2xl font-bold text-white">{errorCount}</div><div className="text-xs text-white/50">Ошибки</div></div>
        <div className="glass-card rounded-2xl p-4 bg-gradient-to-br from-yellow-500/10 to-yellow-600/5"><ShieldCheck size={20} className="text-yellow-400 mb-2" /><div className="text-2xl font-bold text-white">{connectingCount}</div><div className="text-xs text-white/50">Подключение</div></div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-card rounded-2xl p-4"><DollarSign size={18} className="text-green-400 mb-2" /><div className="text-xl font-bold text-white">${totalBalance.toFixed(2)}</div><div className="text-xs text-white/40">Общий баланс</div></div>
        <div className="glass-card rounded-2xl p-4"><Package size={18} className="text-blue-400 mb-2" /><div className="text-xl font-bold text-white">${totalInventory.toFixed(2)}</div><div className="text-xs text-white/40">Инвентари</div></div>
        <div className="glass-card rounded-2xl p-4"><Users size={18} className="text-purple-400 mb-2" /><div className="text-xl font-bold text-white">{totalFriends}</div><div className="text-xs text-white/40">Друзей</div></div>
        <div className="glass-card rounded-2xl p-4"><Star size={18} className="text-yellow-400 mb-2" /><div className="text-xl font-bold text-white">{avgLevel.toFixed(1)}</div><div className="text-xs text-white/40">Ср. уровень</div></div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-card rounded-2xl p-4"><div className="text-lg font-bold text-green-400">{guardedCount}</div><div className="text-xs text-white/40">Guard</div></div>
        <div className="glass-card rounded-2xl p-4"><div className="text-lg font-bold text-red-400">{tradeBanCount + vacBanCount}</div><div className="text-xs text-white/40">Баны</div></div>
        <div className="glass-card rounded-2xl p-4"><div className="text-lg font-bold text-yellow-400">{limitedCount}</div><div className="text-xs text-white/40">Limited</div></div>
        <div className="glass-card rounded-2xl p-4"><div className="text-lg font-bold text-blue-400">{totalMessages}</div><div className="text-xs text-white/40">Сообщений</div></div>
      </div>
    </div>
  );
}
