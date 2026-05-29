import { Shield, AlertTriangle, CheckCircle, XCircle, Lock } from 'lucide-react';
import type { SteamAccount } from '../types';

interface SecurityViewProps { accounts: SteamAccount[]; }

export default function SecurityView({ accounts }: SecurityViewProps) {
  const guardedCount = accounts.filter(a => a.guardEnabled).length;
  const bannedCount = accounts.filter(a => a.tradeBan || a.vacBan).length;
  const limitedCount = accounts.filter(a => a.limited).length;
  const cleanCount = accounts.filter(a => !a.tradeBan && !a.vacBan && !a.limited).length;

  return (
    <div className="p-6 space-y-6 animate-fade-in overflow-y-auto max-h-[calc(100vh-52px)]">
      <div><h1 className="text-2xl font-semibold text-white flex items-center gap-2"><Shield size={24} /> Безопасность</h1><p className="text-sm text-white/40 mt-1">Обзор безопасности аккаунтов</p></div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-card rounded-2xl p-4 bg-gradient-to-br from-green-500/10 to-green-600/5"><CheckCircle size={20} className="text-green-400 mb-2" /><div className="text-2xl font-bold text-white">{guardedCount}</div><div className="text-xs text-white/50">Guard включен</div></div>
        <div className="glass-card rounded-2xl p-4 bg-gradient-to-br from-blue-500/10 to-blue-600/5"><Lock size={20} className="text-blue-400 mb-2" /><div className="text-2xl font-bold text-white">{cleanCount}</div><div className="text-xs text-white/50">Чистых</div></div>
        <div className="glass-card rounded-2xl p-4 bg-gradient-to-br from-red-500/10 to-red-600/5"><XCircle size={20} className="text-red-400 mb-2" /><div className="text-2xl font-bold text-white">{bannedCount}</div><div className="text-xs text-white/50">С банами</div></div>
        <div className="glass-card rounded-2xl p-4 bg-gradient-to-br from-yellow-500/10 to-yellow-600/5"><AlertTriangle size={20} className="text-yellow-400 mb-2" /><div className="text-2xl font-bold text-white">{limitedCount}</div><div className="text-xs text-white/50">Limited</div></div>
      </div>
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-white/5"><h3 className="text-sm font-semibold text-white">Детали</h3></div>
        <div className="divide-y divide-white/5">
          {accounts.map(acc => (
            <div key={acc.id} className="px-4 py-3 flex items-center gap-3">
              <div className="flex items-center gap-2 flex-1 min-w-0">{acc.avatarUrl ? <img src={acc.avatarUrl} alt="" className="w-6 h-6 rounded-full" /> : <span className="text-lg">{acc.avatar}</span>}<span className="text-sm text-white truncate">{acc.login}</span></div>
              <div className="flex items-center gap-2 flex-wrap">
                {acc.guardEnabled ? <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">Guard ✓</span> : <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-400">No Guard</span>}
                {acc.tradeBan && <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-400">Trade Ban</span>}
                {acc.vacBan && <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-400">VAC</span>}
                {acc.limited && <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400">Limited</span>}
                {!acc.tradeBan && !acc.vacBan && !acc.limited && <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">Clean</span>}
              </div>
            </div>
          ))}
          {accounts.length === 0 && <div className="px-4 py-8 text-center text-xs text-white/30">Нет аккаунтов</div>}
        </div>
      </div>
    </div>
  );
}
