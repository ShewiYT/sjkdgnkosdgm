import { useEffect, useState } from 'react';
import { Wifi, WifiOff, DollarSign, Users, ShieldCheck, AlertTriangle, Package, Star, RefreshCw } from 'lucide-react';
import type { SteamAccount } from '../types';
import { useAppStore } from '../store';

interface DashboardProps {
  accounts: SteamAccount[];
}

export default function Dashboard({ accounts }: DashboardProps) {
  const { messages, friendRequestLogs, refreshStatuses } = useAppStore();
  const [refreshing, setRefreshing] = useState(false);

  // Auto refresh stats every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      refreshStatuses();
    }, 30000);
    return () => clearInterval(interval);
  }, [refreshStatuses]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshStatuses();
    setRefreshing(false);
  };

  // Calculate REAL stats from actual account data
  const onlineCount = accounts.filter(a => a.status === 'online' || a.status === 'in-game').length;
  const offlineCount = accounts.filter(a => a.status === 'offline').length;
  const errorCount = accounts.filter(a => a.status === 'error').length;
  const connectingCount = accounts.filter(a => a.status === 'connecting').length;

  // Real financial data from accounts
  const totalBalance = accounts.reduce((sum, a) => sum + (a.balance || 0), 0);
  const totalInventory = accounts.reduce((sum, a) => sum + (a.inventoryValue || 0), 0);
  const totalFriends = accounts.reduce((sum, a) => sum + (a.friendsCount || 0), 0);
  const totalLevel = accounts.reduce((sum, a) => sum + (a.level || 0), 0);
  const avgLevel = accounts.length > 0 ? totalLevel / accounts.length : 0;

  // Security stats
  const guardedCount = accounts.filter(a => a.guardEnabled).length;
  const tradeBanCount = accounts.filter(a => a.tradeBan).length;
  const vacBanCount = accounts.filter(a => a.vacBan).length;
  const limitedCount = accounts.filter(a => a.limited).length;
  const cleanCount = accounts.filter(a => !a.tradeBan && !a.vacBan && !a.limited).length;

  // Message stats
  const totalMessages = messages.length;
  const incomingMessages = messages.filter(m => !m.isOutgoing).length;
  const outgoingMessages = messages.filter(m => m.isOutgoing).length;

  // Friend request stats
  const totalFriendRequests = friendRequestLogs.filter(l => l.accountId !== 'system').length;
  const sentRequests = friendRequestLogs.filter(l => l.status === 'sent' && l.accountId !== 'system').length;
  const errorRequests = friendRequestLogs.filter(l => l.status === 'error' && l.accountId !== 'system').length;

  return (
    <div className="p-6 space-y-6 animate-fade-in overflow-y-auto max-h-[calc(100vh-52px)]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Дашборд</h1>
          <p className="text-sm text-white/40 mt-1">Реальная статистика аккаунтов</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 text-white/60 text-sm hover:bg-white/10 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          Обновить
        </button>
      </div>

      {/* Status cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-card rounded-2xl p-4 bg-gradient-to-br from-green-500/10 to-green-600/5">
          <Wifi size={20} className="text-green-400 mb-2" />
          <div className="text-2xl font-bold text-white">{onlineCount}</div>
          <div className="text-xs text-white/50">Онлайн</div>
        </div>
        <div className="glass-card rounded-2xl p-4 bg-gradient-to-br from-gray-500/10 to-gray-600/5">
          <WifiOff size={20} className="text-gray-400 mb-2" />
          <div className="text-2xl font-bold text-white">{offlineCount}</div>
          <div className="text-xs text-white/50">Оффлайн</div>
        </div>
        <div className="glass-card rounded-2xl p-4 bg-gradient-to-br from-red-500/10 to-red-600/5">
          <AlertTriangle size={20} className="text-red-400 mb-2" />
          <div className="text-2xl font-bold text-white">{errorCount}</div>
          <div className="text-xs text-white/50">Ошибки</div>
        </div>
        <div className="glass-card rounded-2xl p-4 bg-gradient-to-br from-yellow-500/10 to-yellow-600/5">
          <ShieldCheck size={20} className="text-yellow-400 mb-2" />
          <div className="text-2xl font-bold text-white">{connectingCount}</div>
          <div className="text-xs text-white/50">Подключение</div>
        </div>
      </div>

      {/* Financial stats - REAL DATA */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-card rounded-2xl p-4">
          <DollarSign size={18} className="text-green-400 mb-2" />
          <div className="text-xl font-bold text-white">${totalBalance.toFixed(2)}</div>
          <div className="text-xs text-white/40">Общий баланс Steam</div>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <Package size={18} className="text-blue-400 mb-2" />
          <div className="text-xl font-bold text-white">${totalInventory.toFixed(2)}</div>
          <div className="text-xs text-white/40">Стоимость инвентарей</div>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <Users size={18} className="text-purple-400 mb-2" />
          <div className="text-xl font-bold text-white">{totalFriends}</div>
          <div className="text-xs text-white/40">Всего друзей</div>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <Star size={18} className="text-yellow-400 mb-2" />
          <div className="text-xl font-bold text-white">{avgLevel.toFixed(1)}</div>
          <div className="text-xs text-white/40">Средний уровень</div>
        </div>
      </div>

      {/* Detailed stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Security */}
        <div className="glass-card rounded-2xl p-4 space-y-3">
          <h3 className="text-sm font-semibold text-white">🛡️ Безопасность</h3>
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-white/50">Steam Guard</span>
              <span className="text-green-400">{guardedCount} / {accounts.length}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-white/50">Чистые аккаунты</span>
              <span className="text-green-400">{cleanCount}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-white/50">Trade Ban</span>
              <span className="text-red-400">{tradeBanCount}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-white/50">VAC Ban</span>
              <span className="text-red-400">{vacBanCount}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-white/50">Limited</span>
              <span className="text-yellow-400">{limitedCount}</span>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="glass-card rounded-2xl p-4 space-y-3">
          <h3 className="text-sm font-semibold text-white">💬 Сообщения</h3>
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-white/50">Всего сообщений</span>
              <span className="text-white">{totalMessages}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-white/50">Входящих</span>
              <span className="text-blue-400">{incomingMessages}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-white/50">Исходящих</span>
              <span className="text-green-400">{outgoingMessages}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-white/50">Диалогов</span>
              <span className="text-purple-400">{new Set(messages.map(m => `${m.accountId}_${m.friendId}`)).size}</span>
            </div>
          </div>
        </div>

        {/* Friend Requests */}
        <div className="glass-card rounded-2xl p-4 space-y-3">
          <h3 className="text-sm font-semibold text-white">👥 Запросы в друзья</h3>
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-white/50">Всего запросов</span>
              <span className="text-white">{totalFriendRequests}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-white/50">Отправлено</span>
              <span className="text-green-400">{sentRequests}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-white/50">Ошибки</span>
              <span className="text-red-400">{errorRequests}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Accounts table */}
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Все аккаунты ({accounts.length})</h3>
          <div className="text-[10px] text-white/30">
            Данные обновляются автоматически
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left px-4 py-2 text-white/30 font-medium">Аккаунт</th>
                <th className="text-left px-4 py-2 text-white/30 font-medium">SteamID</th>
                <th className="text-left px-4 py-2 text-white/30 font-medium">Статус</th>
                <th className="text-left px-4 py-2 text-white/30 font-medium">Уровень</th>
                <th className="text-left px-4 py-2 text-white/30 font-medium">Баланс</th>
                <th className="text-left px-4 py-2 text-white/30 font-medium">Инвентарь</th>
                <th className="text-left px-4 py-2 text-white/30 font-medium">Друзья</th>
                <th className="text-left px-4 py-2 text-white/30 font-medium">Guard</th>
              </tr>
            </thead>
            <tbody>
              {accounts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-white/30">
                    Нет аккаунтов. Импортируйте аккаунты.
                  </td>
                </tr>
              ) : (
                accounts.map(acc => (
                  <tr key={acc.id} className="border-b border-white/5 hover:bg-white/5">
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        {acc.avatarUrl ? (
                          <img src={acc.avatarUrl} alt="" className="w-5 h-5 rounded-full" />
                        ) : (
                          <span className="text-sm">{acc.avatar}</span>
                        )}
                        <span className="text-white">{acc.displayName || acc.login}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2 text-white/40 font-mono text-[10px]">
                      {acc.steamId || '-'}
                    </td>
                    <td className="px-4 py-2">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] ${
                        acc.status === 'online' ? 'bg-green-500/20 text-green-400' :
                        acc.status === 'in-game' ? 'bg-blue-500/20 text-blue-400' :
                        acc.status === 'error' ? 'bg-red-500/20 text-red-400' :
                        acc.status === 'connecting' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-white/10 text-white/40'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          acc.status === 'online' ? 'bg-green-400' :
                          acc.status === 'in-game' ? 'bg-blue-400' :
                          acc.status === 'error' ? 'bg-red-400' :
                          acc.status === 'connecting' ? 'bg-yellow-400 animate-pulse' :
                          'bg-gray-400'
                        }`} />
                        {acc.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-white/60">{acc.level}</td>
                    <td className="px-4 py-2 text-green-400">${acc.balance.toFixed(2)}</td>
                    <td className="px-4 py-2 text-blue-400">${acc.inventoryValue.toFixed(2)}</td>
                    <td className="px-4 py-2 text-white/60">{acc.friendsCount}</td>
                    <td className="px-4 py-2">
                      {acc.guardEnabled ? (
                        <span className="text-green-400">✓</span>
                      ) : (
                        <span className="text-red-400">✗</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
