import { ChevronDown, RefreshCw, Server, Wifi, WifiOff } from 'lucide-react';
import { useState } from 'react';
import type { SteamAccount } from '../types';

interface AccountBarProps {
  accounts: SteamAccount[];
  selectedAccount: SteamAccount | null;
  onSelectAccount: (account: SteamAccount) => void;
  onConnectAll?: () => void;
}

const statusConfig: Record<string, { color: string; label: string }> = {
  online: { color: 'status-online', label: 'Онлайн' },
  'in-game': { color: 'status-ingame', label: 'В игре' },
  away: { color: 'status-away', label: 'Отошел' },
  offline: { color: 'status-offline', label: 'Оффлайн' },
  connecting: { color: 'status-connecting', label: 'Подключение...' },
  error: { color: 'status-error', label: 'Ошибка' },
};

export default function AccountBar({ accounts, selectedAccount, onSelectAccount, onConnectAll }: AccountBarProps) {
  const [showDropdown, setShowDropdown] = useState(false);

  const onlineCount = accounts.filter(a => a.status === 'online' || a.status === 'in-game').length;
  const connectingCount = accounts.filter(a => a.status === 'connecting').length;
  const totalBalance = accounts.reduce((sum, a) => sum + a.balance, 0);

  return (
    <div className="glass border-b border-white/5 px-4 py-2.5 flex items-center gap-4">
      {/* Account selector */}
      <div className="relative">
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className="flex items-center gap-3 glass-button px-3 py-2 rounded-xl"
        >
          {selectedAccount ? (
            <>
              <span className="text-xl">{selectedAccount.avatar}</span>
              <div className="text-left">
                <div className="text-sm text-white font-medium">{selectedAccount.login}</div>
                <div className="text-[10px] text-white/40">Lvl {selectedAccount.level} • {selectedAccount.server}</div>
              </div>
              <div className={`status-dot ${statusConfig[selectedAccount.status]?.color || 'status-offline'}`} />
            </>
          ) : (
            <span className="text-sm text-white/50">
              {accounts.length > 0 ? 'Выберите аккаунт' : 'Нет аккаунтов'}
            </span>
          )}
          <ChevronDown size={14} className="text-white/40" />
        </button>

        {showDropdown && accounts.length > 0 && (
          <div className="absolute top-full left-0 mt-2 w-80 glass-card rounded-2xl shadow-glass z-50 max-h-80 overflow-y-auto animate-fade-in">
            {accounts.map(acc => (
              <button
                key={acc.id}
                onClick={() => { onSelectAccount(acc); setShowDropdown(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3 transition-colors first:rounded-t-2xl last:rounded-b-2xl ${
                  selectedAccount?.id === acc.id ? 'bg-white/10' : 'hover:bg-white/5'
                }`}
              >
                <span className="text-xl">{acc.avatar}</span>
                <div className="flex-1 text-left">
                  <div className="text-sm text-white">{acc.login}</div>
                  <div className="text-[10px] text-white/40 flex items-center gap-2">
                    <span>Lvl {acc.level}</span>
                    <span>•</span>
                    <span>₽{acc.balance.toFixed(2)}</span>
                    <span>•</span>
                    <Server size={10} />
                    <span>{acc.server}</span>
                  </div>
                  {acc.errorMessage && (
                    <div className="text-[10px] text-red-400 mt-0.5">{acc.errorMessage}</div>
                  )}
                </div>
                <div className={`status-dot ${statusConfig[acc.status]?.color || 'status-offline'}`} />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Quick stats */}
      <div className="flex items-center gap-6 ml-4 text-xs text-white/50">
        <div className="flex items-center gap-2">
          <div className="status-dot status-online" />
          <span>{onlineCount}/{accounts.length}</span>
        </div>
        {connectingCount > 0 && (
          <div className="flex items-center gap-2">
            <div className="status-dot status-connecting" />
            <span>{connectingCount} подключается</span>
          </div>
        )}
        {accounts.length > 0 && (
          <>
            <div className="flex items-center gap-1">
              <span className="text-green-400">₽{totalBalance.toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-blue-400">{accounts.filter(a => a.guardEnabled).length}</span>
              <span>Guard</span>
            </div>
          </>
        )}
      </div>

      {/* Actions */}
      <div className="ml-auto flex items-center gap-2">
        {accounts.length > 0 && (
          <button 
            onClick={onConnectAll}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg glass-button text-xs text-white/70 hover:text-white"
          >
            {onlineCount === accounts.length ? <WifiOff size={14} /> : <Wifi size={14} />}
            {onlineCount === accounts.length ? 'Отключить' : 'Подключить все'}
          </button>
        )}
        <button className="p-2 rounded-lg glass-button text-white/50 hover:text-white" title="Обновить">
          <RefreshCw size={16} />
        </button>
      </div>
    </div>
  );
}
