import { useState } from 'react';
import { Globe, ArrowLeft, ArrowRight, RotateCw, ExternalLink } from 'lucide-react';
import type { SteamAccount } from '../types';

interface BrowserViewProps {
  accounts: SteamAccount[];
  selectedAccount: SteamAccount | null;
}

const quickLinks = [
  { label: 'Steam Store', url: 'https://store.steampowered.com' },
  { label: 'Inventory', url: 'https://steamcommunity.com/my/inventory/' },
  { label: 'Trade Offers', url: 'https://steamcommunity.com/my/tradeoffers/' },
  { label: 'Market', url: 'https://steamcommunity.com/market/' },
  { label: 'CS2 Market', url: 'https://steamcommunity.com/market/search?appid=730' },
];

export default function BrowserView({ accounts, selectedAccount }: BrowserViewProps) {
  const [url, setUrl] = useState('https://store.steampowered.com');
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const account = selectedAccount || accounts.find(a => a.status === 'online');

  const openBrowser = async () => {
    if (!account) return;
    setLoading(true);
    setIsOpen(true);
    setLoading(false);
  };

  const navigate = async (newUrl: string) => {
    setUrl(newUrl);
    setLoading(true);
    setTimeout(() => setLoading(false), 500);
  };

  return (
    <div className="p-6 space-y-4 h-full flex flex-col">
      <div>
        <h2 className="text-lg font-bold flex items-center gap-2 text-white">
          <Globe className="w-5 h-5 text-blue-400" />
          Steam Браузер
        </h2>
        <p className="text-white/40 text-sm">Встроенный браузер с авторизацией Steam</p>
      </div>

      <div className="flex items-center gap-2">
        <button className="p-2 rounded-lg bg-white/5 text-white/40 hover:text-white/60">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <button className="p-2 rounded-lg bg-white/5 text-white/40 hover:text-white/60">
          <ArrowRight className="w-4 h-4" />
        </button>
        <button className="p-2 rounded-lg bg-white/5 text-white/40 hover:text-white/60">
          <RotateCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>

        <div className="flex-1 relative">
          <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input
            type="text"
            value={url}
            onChange={e => setUrl(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                if (isOpen) navigate(url);
                else openBrowser();
              }
            }}
            placeholder="https://store.steampowered.com"
            className="w-full glass-input text-sm text-white pl-9 pr-4 py-2 rounded-xl outline-none"
          />
        </div>

        {!isOpen ? (
          <button
            onClick={openBrowser}
            disabled={!account}
            className="glass-btn px-4 py-2 rounded-xl text-sm flex items-center gap-2 disabled:opacity-30"
          >
            <ExternalLink className="w-4 h-4" />
            Открыть
          </button>
        ) : (
          <button
            onClick={() => setIsOpen(false)}
            className="px-4 py-2 rounded-xl bg-red-500/20 text-red-400 text-sm"
          >
            Закрыть
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {quickLinks.map(link => (
          <button
            key={link.url}
            onClick={() => navigate(link.url)}
            className="px-3 py-1.5 rounded-lg bg-white/5 text-white/50 text-xs hover:bg-white/10 hover:text-white/70"
          >
            {link.label}
          </button>
        ))}
      </div>

      <div className="flex-1 glass-card rounded-xl overflow-hidden flex items-center justify-center">
        {!account ? (
          <div className="text-center text-white/30">
            <Globe className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <div>Подключите аккаунт для использования браузера</div>
          </div>
        ) : !isOpen ? (
          <div className="text-center text-white/30">
            <Globe className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <div>Нажмите "Открыть" для запуска браузера</div>
            <div className="text-xs mt-1">Аккаунт: {account.login}</div>
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-black/20">
            <div className="text-center">
              <div className="animate-spin w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full mx-auto mb-3" />
              <div className="text-white/40 text-sm">Загрузка браузера...</div>
              <div className="text-white/20 text-xs mt-1">{url}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
