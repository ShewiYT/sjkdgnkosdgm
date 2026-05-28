import { Users, Wifi, Gamepad2, Wallet, Package, UserPlus, ArrowRightLeft, Shield, CheckCircle, XCircle, AlertTriangle, Lock } from 'lucide-react';
import type { SteamAccount, TradeOffer } from '../types';

interface DashboardProps {
  accounts: SteamAccount[];
  offers: TradeOffer[];
}

export default function Dashboard({ accounts, offers }: DashboardProps) {
  const onlineCount = accounts.filter(a => a.status === 'online').length;
  const inGameCount = accounts.filter(a => a.status === 'in-game').length;
  const totalBalance = accounts.reduce((sum, a) => sum + a.balance, 0);
  const totalInvValue = accounts.reduce((sum, a) => sum + a.inventoryValue, 0);
  const totalFriends = accounts.reduce((sum, a) => sum + a.friendsCount, 0);
  const pendingOffers = offers.filter(o => o.status === 'pending').length;

  const stats = [
    { label: 'Аккаунты', value: accounts.length, icon: <Users size={20} />, color: 'from-blue-500/20 to-blue-600/10' },
    { label: 'Онлайн', value: onlineCount, icon: <Wifi size={20} />, color: 'from-green-500/20 to-green-600/10' },
    { label: 'В игре', value: inGameCount, icon: <Gamepad2 size={20} />, color: 'from-purple-500/20 to-purple-600/10' },
    { label: 'Баланс', value: `₽${totalBalance.toFixed(0)}`, icon: <Wallet size={20} />, color: 'from-emerald-500/20 to-emerald-600/10' },
    { label: 'Инвентарь', value: `₽${totalInvValue.toFixed(0)}`, icon: <Package size={20} />, color: 'from-violet-500/20 to-violet-600/10' },
    { label: 'Друзей', value: totalFriends, icon: <UserPlus size={20} />, color: 'from-orange-500/20 to-orange-600/10' },
    { label: 'Офферы', value: pendingOffers, icon: <ArrowRightLeft size={20} />, color: 'from-yellow-500/20 to-yellow-600/10' },
    { label: 'Guard', value: accounts.filter(a => a.guardEnabled).length, icon: <Shield size={20} />, color: 'from-cyan-500/20 to-cyan-600/10' },
  ];

  return (
    <div className="p-6 space-y-6 animate-fade-in overflow-y-auto max-h-[calc(100vh-52px)]">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-white">Дашборд</h1>
        <p className="text-sm text-white/40 mt-1">Общая статистика Suka Team</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((s, i) => (
          <div key={i} className={`glass-card rounded-2xl p-4 bg-gradient-to-br ${s.color}`}>
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 rounded-xl bg-white/5">
                {s.icon}
              </div>
            </div>
            <div className="text-2xl font-bold text-white">{s.value}</div>
            <div className="text-xs text-white/50">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Accounts Table */}
      {accounts.length > 0 && (
        <div className="glass-card rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Аккаунты</h3>
            <span className="text-xs text-white/40">{accounts.length} аккаунтов</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-[10px] text-white/40 border-b border-white/5">
                  <th className="text-left py-2 px-4">Аккаунт</th>
                  <th className="text-left py-2 px-4">Статус</th>
                  <th className="text-left py-2 px-4">Уровень</th>
                  <th className="text-left py-2 px-4">Баланс</th>
                  <th className="text-left py-2 px-4">Сервер</th>
                  <th className="text-left py-2 px-4">Guard</th>
                  <th className="text-left py-2 px-4">Состояние</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map(acc => (
                  <tr key={acc.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="py-2.5 px-4">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{acc.avatar}</span>
                        <span className="text-sm text-white">{acc.login}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-4">
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        acc.status === 'online' ? 'bg-green-500/20 text-green-400' :
                        acc.status === 'in-game' ? 'bg-purple-500/20 text-purple-400' :
                        acc.status === 'connecting' ? 'bg-yellow-500/20 text-yellow-400' :
                        acc.status === 'error' ? 'bg-red-500/20 text-red-400' :
                        'bg-gray-500/20 text-gray-400'
                      }`}>
                        {acc.status === 'online' ? 'Онлайн' :
                         acc.status === 'in-game' ? acc.game || 'В игре' :
                         acc.status === 'connecting' ? 'Подключение...' :
                         acc.status === 'error' ? 'Ошибка' :
                         'Оффлайн'}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-sm text-white/70">{acc.level}</td>
                    <td className="py-2.5 px-4 text-sm text-white/70">₽{acc.balance.toFixed(2)}</td>
                    <td className="py-2.5 px-4">
                      <span className="text-xs px-2 py-1 rounded bg-blue-500/10 text-blue-400">
                        {acc.server}
                      </span>
                    </td>
                    <td className="py-2.5 px-4">
                      {acc.guardEnabled ? (
                        <CheckCircle size={16} className="text-green-400" />
                      ) : (
                        <XCircle size={16} className="text-red-400" />
                      )}
                    </td>
                    <td className="py-2.5 px-4">
                      <div className="flex gap-1">
                        {acc.tradeBan && <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400">Trade Ban</span>}
                        {acc.vacBan && <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400">VAC</span>}
                        {acc.limited && <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-400">Limited</span>}
                        {!acc.tradeBan && !acc.vacBan && !acc.limited && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/20 text-green-400">Clean</span>
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent offers */}
        <div className="glass-card rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3 text-sm font-semibold text-white">
            <ArrowRightLeft size={16} />
            Последние офферы
          </div>
          {offers.length > 0 ? (
            <div className="space-y-2">
              {offers.slice(0, 4).map(o => (
                <div key={o.id} className="flex items-center justify-between p-2 rounded-lg glass-light">
                  <div className="flex items-center gap-2">
                    <span>{o.partnerAvatar}</span>
                    <div>
                      <div className="text-xs text-white">{o.partnerName}</div>
                      <div className="text-[10px] text-white/40">
                        {o.itemsGive.length} → {o.itemsReceive.length} предметов
                      </div>
                    </div>
                  </div>
                  <span className={`text-[10px] px-2 py-1 rounded-full ${
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
            <div className="text-center py-4 text-white/30 text-xs">Нет офферов</div>
          )}
        </div>

        {/* Warnings */}
        <div className="glass-card rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3 text-sm font-semibold text-white">
            <AlertTriangle size={16} />
            Предупреждения
          </div>
          <div className="space-y-2">
            {accounts.filter(a => a.tradeBan || a.vacBan || a.limited || a.status === 'error').length > 0 ? (
              accounts.filter(a => a.tradeBan || a.vacBan || a.limited || a.status === 'error').map(a => (
                <div key={a.id} className="flex items-center gap-2 p-2 rounded-lg glass-light">
                  <span>{a.avatar}</span>
                  <div>
                    <div className="text-xs text-white">{a.login}</div>
                    <div className="text-[10px] text-red-400">
                      {a.errorMessage || [a.tradeBan && 'Trade Ban', a.vacBan && 'VAC Ban', a.limited && 'Limited'].filter(Boolean).join(', ')}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-2 text-green-400/60 text-xs">Все аккаунты в порядке ✨</div>
            )}
            {accounts.filter(a => !a.guardEnabled).length > 0 && (
              <div className="flex items-center gap-2 p-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                <Lock size={14} className="text-yellow-400" />
                <span className="text-xs text-yellow-400">
                  {accounts.filter(a => !a.guardEnabled).length} аккаунтов без Guard
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
