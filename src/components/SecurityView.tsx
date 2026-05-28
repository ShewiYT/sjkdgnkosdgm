import { Shield, AlertTriangle, CheckCircle, XCircle, RefreshCw, Eye, Lock } from 'lucide-react';
import type { SteamAccount } from '../types';

interface SecurityViewProps {
  accounts: SteamAccount[];
}

export default function SecurityView({ accounts }: SecurityViewProps) {
  const cleanAccounts = accounts.filter(a => !a.tradeBan && !a.vacBan && !a.limited);
  const problemAccounts = accounts.filter(a => a.tradeBan || a.vacBan || a.limited);

  return (
    <div className="p-6 space-y-6 animate-fade-in overflow-y-auto max-h-[calc(100vh-52px)]">
      <div>
        <h1 className="text-2xl font-semibold text-white flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl glass-accent flex items-center justify-center">
            <Shield size={20} />
          </div>
          Безопасность
        </h1>
        <p className="text-sm text-white/50 mt-1">Мониторинг банов, ограничений и безопасности аккаунтов</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Чистые', value: cleanAccounts.length, color: 'text-green-400', bg: 'bg-green-500/10', icon: <CheckCircle size={20} /> },
          { label: 'Trade Ban', value: accounts.filter(a => a.tradeBan).length, color: 'text-red-400', bg: 'bg-red-500/10', icon: <XCircle size={20} /> },
          { label: 'VAC Ban', value: accounts.filter(a => a.vacBan).length, color: 'text-red-400', bg: 'bg-red-400/10', icon: <AlertTriangle size={20} /> },
          { label: 'Guard Off', value: accounts.filter(a => !a.guardEnabled).length, color: 'text-orange-400', bg: 'bg-orange-500/10', icon: <Shield size={20} /> },
        ].map((s, i) => (
          <div key={i} className={`${s.bg} rounded-xl p-4 neon-border`}>
            <div className={`${s.color} mb-2`}>{s.icon}</div>
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-white/50">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Account security status */}
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">🔍 Статус безопасности аккаунтов</h3>
          <button className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors">
            <RefreshCw size={12} /> Проверить все
          </button>
        </div>
        <div className="divide-y divide-white/5">
          {accounts.map(acc => (
            <div key={acc.id} className="px-4 py-3 flex items-center gap-4 hover:bg-white/5 transition-colors">
              <span className="text-2xl">{acc.avatar}</span>
              <div className="flex-1">
                <div className="text-sm text-white font-medium">{acc.login}</div>
                <div className="text-[10px] text-white/40">Lvl {acc.level} • {acc.server}</div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] px-2 py-1 rounded-full flex items-center gap-1 ${
                  acc.tradeBan ? 'bg-red-500/20 text-red-400' : 'bg-green-500/10 text-green-400'
                }`}>
                  {acc.tradeBan ? <XCircle size={10} /> : <CheckCircle size={10} />} Trade
                </span>
                <span className={`text-[10px] px-2 py-1 rounded-full flex items-center gap-1 ${
                  acc.vacBan ? 'bg-red-500/20 text-red-400' : 'bg-green-500/10 text-green-400'
                }`}>
                  {acc.vacBan ? <XCircle size={10} /> : <CheckCircle size={10} />} VAC
                </span>
                <span className={`text-[10px] px-2 py-1 rounded-full flex items-center gap-1 ${
                  acc.limited ? 'bg-orange-500/20 text-orange-400' : 'bg-green-500/10 text-green-400'
                }`}>
                  {acc.limited ? <AlertTriangle size={10} /> : <CheckCircle size={10} />} Limited
                </span>
                <span className={`text-[10px] px-2 py-1 rounded-full flex items-center gap-1 ${
                  acc.guardEnabled ? 'bg-green-500/10 text-green-400' : 'bg-orange-500/20 text-orange-400'
                }`}>
                  {acc.guardEnabled ? <Lock size={10} /> : <AlertTriangle size={10} />} Guard
                </span>
              </div>
              <button className="p-1.5 rounded bg-white/5 text-white/40 hover:text-white transition-colors">
                <Eye size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Problem accounts */}
      {problemAccounts.length > 0 && (
        <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-red-400 mb-3 flex items-center gap-2">
            <AlertTriangle size={16} /> Проблемные аккаунты
          </h3>
          <div className="space-y-2">
            {problemAccounts.map(acc => (
              <div key={acc.id} className="flex items-center gap-3 p-3 rounded-lg glass-light">
                <span className="text-xl">{acc.avatar}</span>
                <div className="flex-1">
                  <div className="text-sm text-white">{acc.login}</div>
                  <div className="text-[10px] text-red-400">
                    {[acc.tradeBan && 'Trade Ban', acc.vacBan && 'VAC Ban', acc.limited && 'Limited Account'].filter(Boolean).join(' • ')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
