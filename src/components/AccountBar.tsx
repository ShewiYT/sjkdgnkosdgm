import { Power, PowerOff, AlertCircle } from 'lucide-react';
import type { SteamAccount } from '../types';
import { useAppStore } from '../store';

interface AccountBarProps {
  accounts: SteamAccount[];
  selectedAccount: SteamAccount | null;
  onSelectAccount: (acc: SteamAccount | null) => void;
  onConnectAll: () => void;
  onlineCount: number;
}

const statusDot: Record<string, string> = {
  online: 'bg-green-400',
  'in-game': 'bg-blue-400',
  away: 'bg-yellow-400',
  connecting: 'bg-yellow-400 animate-pulse',
  error: 'bg-red-400',
  offline: 'bg-gray-500',
};

export default function AccountBar({
  accounts,
  selectedAccount,
  onSelectAccount,
  onConnectAll,
  onlineCount,
}: AccountBarProps) {
  const allOnline = onlineCount === accounts.length && accounts.length > 0;
  const serverConnected = useAppStore(s => s.serverConnected);
  const steamAvailable = useAppStore(s => s.steamAvailable);

  return (
    <div className="flex items-center gap-2 px-4 h-[52px] border-b border-white/5 bg-dark-900/50 overflow-x-auto shrink-0">
      {/* Server status indicator */}
      <div className={`shrink-0 flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] ${
        serverConnected && steamAvailable
          ? 'bg-green-500/10 text-green-400/70'
          : serverConnected && !steamAvailable
          ? 'bg-yellow-500/10 text-yellow-400/70'
          : 'bg-red-500/10 text-red-400/70'
      }`}>
        {serverConnected && steamAvailable ? (
          <>
            <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
            Steam OK
          </>
        ) : serverConnected && !steamAvailable ? (
          <>
            <AlertCircle size={10} />
            Нет steam-user
          </>
        ) : (
          <>
            <AlertCircle size={10} />
            Сервер выкл
          </>
        )}
      </div>

      <div className="w-px h-6 bg-white/5 shrink-0" />

      <button
        onClick={() => onSelectAccount(null)}
        className={`shrink-0 px-3 py-1.5 rounded-lg text-xs transition-colors ${
          !selectedAccount ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/60'
        }`}
      >
        Все ({accounts.length})
      </button>

      {accounts.map(acc => (
        <button
          key={acc.id}
          onClick={() => onSelectAccount(acc)}
          title={acc.errorMessage || acc.status}
          className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors ${
            selectedAccount?.id === acc.id
              ? 'bg-white/10 text-white'
              : 'text-white/40 hover:text-white/60'
          }`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${statusDot[acc.status] || 'bg-gray-500'}`} />
          {acc.login}
        </button>
      ))}

      <div className="ml-auto shrink-0 flex items-center gap-3">
        <span className="text-xs text-white/30">
          {onlineCount}/{accounts.length} онлайн
        </span>
        <button
          onClick={onConnectAll}
          disabled={!serverConnected || !steamAvailable}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
            allOnline
              ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
              : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
          }`}
        >
          {allOnline ? <PowerOff size={12} /> : <Power size={12} />}
          {allOnline ? 'Откл. все' : 'Подкл. все'}
        </button>
      </div>
    </div>
  );
}
