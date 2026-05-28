import { useState } from 'react';
import { Globe, ArrowLeft, ArrowRight, RefreshCw, Home, Lock, ExternalLink } from 'lucide-react';
import type { SteamAccount } from '../types';

interface BrowserViewProps {
  accounts: SteamAccount[];
}

export default function BrowserView({ accounts }: BrowserViewProps) {
  const [selectedAccount, setSelectedAccount] = useState(accounts[0]?.id || '');
  const [url, setUrl] = useState('https://store.steampowered.com');
  const [isLoading, setIsLoading] = useState(false);

  const quickLinks = [
    { name: 'Store', url: 'https://store.steampowered.com', icon: '🏪' },
    { name: 'Community', url: 'https://steamcommunity.com', icon: '👥' },
    { name: 'Market', url: 'https://steamcommunity.com/market', icon: '💰' },
    { name: 'Inventory', url: 'https://steamcommunity.com/my/inventory', icon: '📦' },
    { name: 'Profile', url: 'https://steamcommunity.com/my', icon: '👤' },
    { name: 'Trades', url: 'https://steamcommunity.com/my/tradeoffers', icon: '🔄' },
  ];

  const acc = accounts.find(a => a.id === selectedAccount);

  return (
    <div className="flex flex-col h-[calc(100vh-52px)] animate-fade-in">
      {/* Browser toolbar */}
      <div className="glass border-b border-white/5 p-3 space-y-2">
        <div className="flex items-center gap-2">
          {/* Account selector */}
          <select
            value={selectedAccount}
            onChange={e => setSelectedAccount(e.target.value)}
            className="glass-input text-xs text-white px-3 py-2 rounded-xl outline-none w-40"
          >
            {accounts.map(a => (
              <option key={a.id} value={a.id} className="bg-neutral-800">{a.avatar} {a.login}</option>
            ))}
          </select>

          {/* Navigation */}
          <button className="p-2 rounded-xl glass-button text-white/50 hover:text-white">
            <ArrowLeft size={14} />
          </button>
          <button className="p-2 rounded-xl glass-button text-white/50 hover:text-white">
            <ArrowRight size={14} />
          </button>
          <button
            onClick={() => { setIsLoading(true); setTimeout(() => setIsLoading(false), 1000); }}
            className="p-2 rounded-xl glass-button text-white/50 hover:text-white"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          </button>
          <button className="p-2 rounded-xl glass-button text-white/50 hover:text-white">
            <Home size={14} />
          </button>

          {/* URL bar */}
          <div className="flex-1 flex items-center glass-input rounded-xl px-3 py-2">
            <Lock size={12} className="text-green-400 mr-2" />
            <input
              type="text"
              value={url}
              onChange={e => setUrl(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { setIsLoading(true); setTimeout(() => setIsLoading(false), 1000); } }}
              className="flex-1 bg-transparent text-sm text-white outline-none"
            />
          </div>

          <button className="p-2 rounded-xl glass-button text-white/50 hover:text-white">
            <ExternalLink size={14} />
          </button>
        </div>

        {/* Quick links */}
        <div className="flex gap-1">
          {quickLinks.map(link => (
            <button
              key={link.name}
              onClick={() => { setUrl(link.url); setIsLoading(true); setTimeout(() => setIsLoading(false), 800); }}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] text-white/60 hover:text-white glass-button"
            >
              <span>{link.icon}</span>
              {link.name}
            </button>
          ))}
        </div>
      </div>

      {/* Browser content */}
      <div className="flex-1 flex items-center justify-center">
        {isLoading ? (
          <div className="text-center animate-fade-in">
            <RefreshCw size={32} className="animate-spin text-blue-400 mx-auto mb-3" />
            <div className="text-sm text-white/60">Загрузка...</div>
            <div className="text-xs text-white/30 mt-1">Сессия: {acc?.login} • {acc?.server}</div>
          </div>
        ) : (
          <div className="text-center max-w-lg glass-card rounded-3xl p-8">
            <Globe size={48} className="mx-auto mb-4 text-white/20" />
            <div className="text-lg font-medium text-white mb-2">Браузер Steam</div>
            <div className="text-sm text-white/50 mb-4">
              Аккаунт: <span className="text-blue-400">{acc?.login}</span>
            </div>
            <div className="text-xs text-white/30 mb-6">
              Каждый аккаунт работает через отдельный IP
            </div>
            <div className="glass-light rounded-2xl p-4 text-left space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-white/50">Аккаунт:</span>
                <span className="text-white">{acc?.login}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/50">Сервер:</span>
                <span className="text-blue-400">{acc?.server}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/50">Guard:</span>
                <span className={acc?.guardEnabled ? 'text-green-400' : 'text-red-400'}>
                  {acc?.guardEnabled ? 'Активен' : 'Не активен'}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
