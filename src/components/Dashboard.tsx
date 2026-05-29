import { useEffect, useState } from 'react';
import {
  Wifi, WifiOff, DollarSign, Users, ShieldCheck,
  AlertTriangle, Package, Star, RefreshCw, Database,
  ServerOff, CheckCircle,
} from 'lucide-react';
import type { SteamAccount } from '../types';
import { useAppStore } from '../store';

interface DashboardProps {
  accounts: SteamAccount[];
}

export default function Dashboard({ accounts }: DashboardProps) {
  const { messages, friendRequestLogs, refreshStatuses, serverConnected, steamAvailable, checkServerConnection } = useAppStore();
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    checkServerConnection();
    const interval = setInterval(() => {
      refreshStatuses();
    }, 30000);
    return () => clearInterval(interval);
  }, [refreshStatuses, checkServerConnection]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await checkServerConnection();
    await refreshStatuses();
    setRefreshing(false);
  };

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
  const cleanCount = accounts.filter(a => !a.tradeBan && !a.vacBan && !a.limited).length;

  const totalMessages = messages.length;
  const incomingMessages = messages.filter(m => !m.isOutgoing).length;
  const outgoingMessages = messages.filter(m => m.isOutgoing).length;

  const totalFriendRequests = friendRequestLogs.filter(l => l.accountId !== 'system').length;
  const sentRequests = friendRequestLogs.filter(l => l.status === 'sent' && l.accountId !== 'system').length;
  const errorRequests = friendRequestLogs.filter(l => l.status === 'error' && l.accountId !== 'system').length;

  return (
    <div className="p-6 space-y-6 animate-fade-in overflow-y-auto max-h-[calc(100vh-52px)]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Дашборд</h1>
          <p className="text-sm text-white/40 mt-1 flex items-center gap-2">
            Реальная статистика аккаунтов
            <span className="flex items-center gap-1 text-green-400/60 text-[10px]">
              <Database size={10} /> SQLite
            </span>
          </p>
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

      {/* Server Status Banner */}
      {!serverConnected && (
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-red-500/10 border border-red-500/20">
          <ServerOff size={20} className="text-red-400 mt-0.5 shrink-0" />
          <div>
            <div className="text-sm font-medium text-red-400">⛔ Сервер не подключен</div>
            <div className="text-xs text-red-300/60 mt-1 space-y-1">
              <p>Бэкенд сервер (server.js) не запущен или недоступен.</p>
              <p className="mt-2 text-yellow-400/80">
                ⚡ Запустите:
              </p>
              <code className="block bg-white/5 px-3 py-2 rounded-lg text-white/60 mt-1">
                npm install steam-user steam-totp{'\n'}
                node server.js
              </code>
            </div>
          </div>
        </div>
      )}

      {serverConnected && !steamAvailable && (
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-yellow-500/10 border border-yellow-500/20">
          <AlertTriangle size={20} className="text-yellow-400 mt-0.5 shrink-0" />
          <div>
            <div className="text-sm font-medium text-yellow-400">⚠️ Сервер запущен, но steam-user НЕ установлен</div>
            <div className="text-xs text-yellow-300/60 mt-1 space-y-1">
              <p>Без steam-user аккаунты <strong className="text-yellow-400">НЕ</strong> подключаются к Steam реально.</p>
              <p>Статусы будут фейковые — в Steam аккаунт будет оффлайн.</p>
              <code className="block bg-white/5 px-3 py-2 rounded-lg text-white/60 mt-2">
                npm install steam-user steam-totp{'\n'}
                # Перезапустите server.js
              </code>
            </div>
          </div>
        </div>
      )}

      {serverConnected && steamAvailable && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-green-500/10 border border-green-500/20">
          <CheckCircle size={16} className="text-green-400" />
          <div className="text-xs text-green-400/80">
            ✅ Сервер подключен + steam-user установлен — аккаунты входят в Steam <strong>реально</strong>
          </div>
        </div>
      )}

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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
              <span className="text-purple-400">{outgoingMessages}</span>
            </div>
          </div>
        </div>

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

      {/* Error accounts */}
      {errorCount > 0 && (
        <div className="glass-card rounded-2xl p-4 space-y-3">
          <h3 className="text-sm font-semibold text-red-400 flex items-center gap-2">
            <AlertTriangle size={14} />
            Аккаунты с ошибками
          </h3>
          <div className="space-y-2">
            {accounts.filter(a => a.status === 'error').map(acc => (
              <div key={acc.id} className="flex items-center gap-3 p-2 rounded-xl bg-red-500/5">
                <span className="w-2 h-2 rounded-full bg-red-400" />
                <span className="text-xs text-white/60">{acc.login}</span>
                <span className="text-[10px] text-red-400/80 ml-auto">{acc.errorMessage || 'Неизвестная ошибка'}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
