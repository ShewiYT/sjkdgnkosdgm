import { useAppStore } from '../store';
import { Monitor, DollarSign, Users, Shield } from 'lucide-react';

export default function Dashboard() {
  const accounts = useAppStore(s => s.getVisibleAccounts());
  const onlineCount = accounts.filter(a => a.status === 'online' || a.status === 'in-game').length;
  const totalBalance = accounts.reduce((s, a) => s + a.balance, 0);
  const totalInventory = accounts.reduce((s, a) => s + a.inventoryValue, 0);
  const totalFriends = accounts.reduce((s, a) => s + a.friendsCount, 0);

  const stats = [
    { icon: <Monitor className="w-5 h-5" />, label: 'Онлайн', value: `${onlineCount}/${accounts.length}`, color: 'text-green-400' },
    { icon: <DollarSign className="w-5 h-5" />, label: 'Баланс', value: `$${totalBalance.toFixed(2)}`, color: 'text-yellow-400' },
    { icon: <Shield className="w-5 h-5" />, label: 'Инвентарь', value: `$${totalInventory.toFixed(2)}`, color: 'text-blue-400' },
    { icon: <Users className="w-5 h-5" />, label: 'Друзья', value: totalFriends.toString(), color: 'text-purple-400' },
  ];

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full">
      <div>
        <h2 className="text-lg font-bold flex items-center gap-2">📊 Дашборд</h2>
        <p className="text-white/40 text-sm">Обзор всех аккаунтов</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((s, i) => (
          <div key={i} className="glass-card rounded-xl p-4 space-y-2">
            <div className={`${s.color}`}>{s.icon}</div>
            <div className="text-xl font-bold">{s.value}</div>
            <div className="text-xs text-white/40">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="glass-card rounded-xl overflow-hidden">
        <div className="p-4 border-b border-white/5">
          <h3 className="text-sm font-semibold">Аккаунты</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-white/30 border-b border-white/5">
                <th className="text-left p-3">Логин</th>
                <th className="text-left p-3">Статус</th>
                <th className="text-left p-3">Уровень</th>
                <th className="text-left p-3">Баланс</th>
                <th className="text-left p-3">Инвентарь</th>
                <th className="text-left p-3">Друзья</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map(acc => (
                <tr key={acc.id} className="border-b border-white/5 hover:bg-white/5">
                  <td className="p-3">{acc.displayName || acc.login}</td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] ${
                      acc.status === 'online' ? 'bg-green-500/20 text-green-400' :
                      acc.status === 'error' ? 'bg-red-500/20 text-red-400' :
                      'bg-white/10 text-white/40'
                    }`}>
                      {acc.status}
                    </span>
                  </td>
                  <td className="p-3">{acc.level}</td>
                  <td className="p-3">${acc.balance.toFixed(2)}</td>
                  <td className="p-3">${acc.inventoryValue.toFixed(2)}</td>
                  <td className="p-3">{acc.friendsCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
