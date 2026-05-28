import { Shield, AlertTriangle, CheckCircle, XCircle, RefreshCw, Eye, Lock } from 'lucide-react';
import type { SteamAccount } from '../types';

interface SecurityViewProps {
  accounts: SteamAccount[];
}

export default function SecurityView({ accounts }: SecurityViewProps) {
  const cleanAccounts = accounts.filter(a => !a.tradeBan && !a.vacBan && !a.limited);
  const problemAccounts = accounts.filter(a => a.tradeBan || a.vacBan || a.limited);

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Shield size={24} /> Безопасность
        </h1>
        <p className="text-sm text-steam-text mt-1">Мониторинг банов, ограничений и безопасности аккаунтов</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Чистые', value: cleanAccounts.length, color: 'text-neon-green', bg: 'bg-neon-green/10', icon: <CheckCircle size={20} /> },
          { label: 'Trade Ban', value: accounts.filter(a => a.tradeBan).length, color: 'text-neon-red', bg: 'bg-neon-red/10', icon: <XCircle size={20} /> },
          { label: 'VAC Ban', value: accounts.filter(a => a.vacBan).length, color: 'text-red-400', bg: 'bg-red-400/10', icon: <AlertTriangle size={20} /> },
          { label: 'Guard Off', value: accounts.filter(a => !a.guardEnabled).length, color: 'text-neon-orange', bg: 'bg-neon-orange/10', icon: <Shield size={20} /> },
        ].map((s, i) => (
          <div key={i} className={`${s.bg} rounded-xl p-4 neon-border`}>
            <div className={`${s.color} mb-2`}>{s.icon}</div>
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-steam-text">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Account security status */}
      <div className="bg-steam-card rounded-xl neon-border overflow-hidden">
        <div className="px-4 py-3 border-b border-steam-border flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">🔍 Статус безопасности аккаунтов</h3>
          <button className="flex items-center gap-1 text-xs text-neon-blue hover:text-neon-blue/80 transition-colors">
            <RefreshCw size={12} /> Проверить все
          </button>
        </div>
        <div className="divide-y divide-steam-border/50">
          {accounts.map(acc => (
            <div key={acc.id} className="px-4 py-3 flex items-center gap-4 hover:bg-steam-hover/20 transition-colors">
              <span className="text-2xl">{acc.avatar}</span>
              <div className="flex-1">
                <div className="text-sm text-white font-medium">{acc.login}</div>
                <div className="text-[10px] text-steam-text">Lvl {acc.level} • {acc.server}</div>
              </div>

              {/* Status badges */}
              <div className="flex items-center gap-2">
                <span className={`text-[10px] px-2 py-1 rounded-full flex items-center gap-1 ${
                  acc.tradeBan ? 'bg-neon-red/20 text-neon-red' : 'bg-neon-green/10 text-neon-green'
                }`}>
                  {acc.tradeBan ? <XCircle size={10} /> : <CheckCircle size={10} />}
                  Trade
                </span>
                <span className={`text-[10px] px-2 py-1 rounded-full flex items-center gap-1 ${
                  acc.vacBan ? 'bg-red-500/20 text-red-400' : 'bg-neon-green/10 text-neon-green'
                }`}>
                  {acc.vacBan ? <XCircle size={10} /> : <CheckCircle size={10} />}
                  VAC
                </span>
                <span className={`text-[10px] px-2 py-1 rounded-full flex items-center gap-1 ${
                  acc.limited ? 'bg-neon-orange/20 text-neon-orange' : 'bg-neon-green/10 text-neon-green'
                }`}>
                  {acc.limited ? <AlertTriangle size={10} /> : <CheckCircle size={10} />}
                  Limited
                </span>
                <span className={`text-[10px] px-2 py-1 rounded-full flex items-center gap-1 ${
                  acc.guardEnabled ? 'bg-neon-green/10 text-neon-green' : 'bg-neon-orange/20 text-neon-orange'
                }`}>
                  {acc.guardEnabled ? <Lock size={10} /> : <AlertTriangle size={10} />}
                  Guard
                </span>
              </div>

              <button className="p-1.5 rounded bg-steam-dark text-steam-text hover:text-white transition-colors">
                <Eye size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Problem accounts */}
      {problemAccounts.length > 0 && (
        <div className="bg-neon-red/5 border border-neon-red/20 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-neon-red mb-3 flex items-center gap-2">
            <AlertTriangle size={16} /> Проблемные аккаунты
          </h3>
          <div className="space-y-2">
            {problemAccounts.map(acc => (
              <div key={acc.id} className="flex items-center gap-3 p-3 rounded-lg bg-steam-dark/50">
                <span className="text-xl">{acc.avatar}</span>
                <div className="flex-1">
                  <div className="text-sm text-white">{acc.login}</div>
                  <div className="text-[10px] text-neon-red">
                    {[
                      acc.tradeBan && 'Trade Ban',
                      acc.vacBan && 'VAC Ban',
                      acc.limited && 'Limited Account'
                    ].filter(Boolean).join(' • ')}
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
