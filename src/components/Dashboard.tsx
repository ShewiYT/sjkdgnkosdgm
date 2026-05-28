import { 
  Users, MessageSquare, ArrowRightLeft, Shield, 
  Activity, TrendingUp, Server, AlertTriangle,
  CheckCircle, XCircle, Clock, Wifi
} from 'lucide-react';
import type { SteamAccount, TradeOffer } from '../types';

interface DashboardProps {
  accounts: SteamAccount[];
  offers: TradeOffer[];
}

export default function Dashboard({ accounts, offers }: DashboardProps) {
  const onlineCount = accounts.filter(a => a.status === 'online' || a.status === 'in-game').length;
  const inGameCount = accounts.filter(a => a.status === 'in-game').length;
  const totalBalance = accounts.reduce((s, a) => s + a.balance, 0);
  const totalInvValue = accounts.reduce((s, a) => s + a.inventoryValue, 0);
  const totalFriends = accounts.reduce((s, a) => s + a.friendsCount, 0);
  const pendingOffers = offers.filter(o => o.status === 'pending').length;

  const stats = [
    { label: 'Аккаунтов', value: accounts.length, icon: <Users size={20} />, color: 'from-blue-500/20 to-blue-600/10' },
    { label: 'Онлайн', value: `${onlineCount}/${accounts.length}`, icon: <Wifi size={20} />, color: 'from-green-500/20 to-green-600/10' },
    { label: 'В игре', value: inGameCount, icon: <Activity size={20} />, color: 'from-purple-500/20 to-purple-600/10' },
    { label: 'Баланс', value: `₽${totalBalance.toFixed(0)}`, icon: <TrendingUp size={20} />, color: 'from-emerald-500/20 to-emerald-600/10' },
    { label: 'Инвентарь', value: `₽${totalInvValue.toFixed(0)}`, icon: <ArrowRightLeft size={20} />, color: 'from-violet-500/20 to-violet-600/10' },
    { label: 'Друзей', value: totalFriends, icon: <MessageSquare size={20} />, color: 'from-orange-500/20 to-orange-600/10' },
    { label: 'Офферы', value: pendingOffers, icon: <ArrowRightLeft size={20} />, color: 'from-yellow-500/20 to-yellow-600/10' },
    { label: 'Guard', value: accounts.filter(a => a.guardEnabled).length, icon: <Shield size={20} />, color: 'from-cyan-500/20 to-cyan-600/10' },
  ];

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-white">Дашборд</h1>
        <p className="text-sm text-white/40 mt-1">Общая статистика Suka Team</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((s, i) => (
          <div key={i} className={`glass-card rounded-2xl p-4 bg-gradient-to-br ${s.color}`}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl glass flex items-center justify-center text-white/70">
                {s.icon}
              </div>
            </div>
            <div className="text-2xl font-semibold text-white">{s.value}</div>
            <div className="text-xs text-white/40 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Accounts Table */}
      {accounts.length > 0 && (
        <div className="glass-card rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-white/5 flex items-center justify-between">
            <h2 className="text-sm font-medium text-white">Аккаунты</h2>
            <span className="text-xs text-white/40">{accounts.length} аккаунтов</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5 text-xs text-white/40">
                  <th className="text-left px-5 py-3">Аккаунт</th>
                  <th className="text-left px-5 py-3">Статус</th>
                  <th className="text-left px-5 py-3">Уровень</th>
                  <th className="text-left px-5 py-3">Баланс</th>
                  <th className="text-left px-5 py-3">Сервер</th>
                  <th className="text-left px-5 py-3">Guard</th>
                  <th className="text-left px-5 py-3">Состояние</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map(acc => (
                  <tr key={acc.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <span className="text-lg">{acc.avatar}</span>
                        <span className="text-white font-medium">{acc.login}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className={`status-dot status-${acc.status === 'in-game' ? 'ingame' : acc.status}`} />
                        <span className={`text-xs ${
                          acc.status === 'online' ? 'text-green-400' :
                          acc.status === 'in-game' ? 'text-purple-400' :
                          acc.status === 'connecting' ? 'text-yellow-400' :
                          acc.status === 'error' ? 'text-red-400' :
                          'text-white/40'
                        }`}>
                          {acc.status === 'online' ? 'Онлайн' :
                           acc.status === 'in-game' ? acc.game || 'В игре' :
                           acc.status === 'connecting' ? 'Подключение...' :
                           acc.status === 'error' ? 'Ошибка' :
                           'Оффлайн'}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-blue-400">{acc.level}</td>
                    <td className="px-5 py-3 text-green-400">₽{acc.balance.toFixed(2)}</td>
                    <td className="px-5 py-3">
                      <span className="text-xs px-2 py-1 rounded-lg glass text-white/60 flex items-center gap-1 w-fit">
                        <Server size={10} />{acc.server}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      {acc.guardEnabled ? (
                        <CheckCircle size={16} className="text-green-400" />
                      ) : (
                        <XCircle size={16} className="text-red-400" />
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex gap-1">
                        {acc.tradeBan && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400">Trade Ban</span>}
                        {acc.vacBan && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-300">VAC</span>}
                        {acc.limited && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400">Limited</span>}
                        {!acc.tradeBan && !acc.vacBan && !acc.limited && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-400">Clean</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Bottom row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Recent offers */}
        <div className="glass-card rounded-2xl p-4">
          <h3 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
            <Clock size={16} className="text-white/40" />
            Последние офферы
          </h3>
          {offers.length > 0 ? (
            <div className="space-y-2">
              {offers.slice(0, 4).map(o => (
                <div key={o.id} className="flex items-center gap-3 p-2 rounded-xl glass-light">
                  <span className="text-lg">{o.partnerAvatar}</span>
                  <div className="flex-1">
                    <div className="text-xs text-white">{o.partnerName}</div>
                    <div className="text-[10px] text-white/40">
                      {o.itemsGive.length} → {o.itemsReceive.length} предметов
                    </div>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                    o.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                    o.status === 'accepted' ? 'bg-green-500/20 text-green-400' :
                    'bg-red-500/20 text-red-400'
                  }`}>
                    {o.status === 'pending' ? 'Ожидает' : o.status === 'accepted' ? 'Принят' : 'Отклонен'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-xs text-white/30 text-center py-4">Нет офферов</div>
          )}
        </div>

        {/* Warnings */}
        <div className="glass-card rounded-2xl p-4">
          <h3 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
            <AlertTriangle size={16} className="text-yellow-400" />
            Предупреждения
          </h3>
          <div className="space-y-2">
            {accounts.filter(a => a.tradeBan || a.vacBan || a.limited || a.status === 'error').length > 0 ? (
              accounts.filter(a => a.tradeBan || a.vacBan || a.limited || a.status === 'error').map(a => (
                <div key={a.id} className="flex items-center gap-3 p-2 rounded-xl glass-light border border-red-500/20">
                  <span className="text-lg">{a.avatar}</span>
                  <div className="flex-1">
                    <div className="text-xs text-white">{a.login}</div>
                    <div className="text-[10px] text-red-400">
                      {a.errorMessage || [a.tradeBan && 'Trade Ban', a.vacBan && 'VAC Ban', a.limited && 'Limited'].filter(Boolean).join(', ')}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-xs text-white/30 text-center py-4">Все аккаунты в порядке ✨</div>
            )}
            {accounts.filter(a => !a.guardEnabled).length > 0 && (
              <div className="flex items-center gap-3 p-2 rounded-xl glass-light border border-yellow-500/20">
                <Shield size={16} className="text-yellow-400" />
                <div className="flex-1">
                  <div className="text-[10px] text-yellow-400">
                    {accounts.filter(a => !a.guardEnabled).length} аккаунтов без Guard
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
