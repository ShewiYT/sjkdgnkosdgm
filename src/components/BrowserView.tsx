import { useState, useEffect, useCallback } from 'react';
import { Globe, ArrowLeft, ArrowRight, RotateCw, Monitor, X, Loader2 } from 'lucide-react';
import { steamApi } from '../api';
import type { SteamAccount } from '../types';

interface BrowserViewProps {
  accounts: SteamAccount[];
  selectedAccount: SteamAccount | null;
}

export default function BrowserView({ accounts, selectedAccount }: BrowserViewProps) {
  const [url, setUrl] = useState('https://store.steampowered.com');
  const [currentUrl, setCurrentUrl] = useState('');
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState('');
  const [selectedAccId, setSelectedAccId] = useState(selectedAccount?.id || '');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [pageContent, setPageContent] = useState<string | null>(null);

  const onlineAccounts = accounts.filter(a => a.status === 'online' || a.status === 'in-game');
  const activeAccount = accounts.find(a => a.id === selectedAccId);

  // Auto refresh screenshot
  useEffect(() => {
    if (!autoRefresh || !isOpen || !selectedAccId) return;
    const interval = setInterval(() => refreshScreenshot(), 3000);
    return () => clearInterval(interval);
  }, [autoRefresh, isOpen, selectedAccId]);

  const refreshScreenshot = useCallback(async () => {
    if (!selectedAccId) return;
    try {
      const ss = await steamApi.getBrowserScreenshot(selectedAccId);
      if (ss) setScreenshot(ss);
      // Also try to get page content
      const page = await steamApi.getBrowserPage(selectedAccId);
      if (page && page.html) {
        setPageContent(page.html);
      }
      if (page && page.url) {
        setCurrentUrl(page.url);
      }
    } catch { /* ignore */ }
  }, [selectedAccId]);

  const openBrowser = async () => {
    if (!selectedAccId || !url.trim()) return;
    setLoading(true);
    setError('');
    setPageContent(null);

    try {
      const result = await steamApi.openBrowser(selectedAccId, url);
      if (result.error) {
        setError(result.error);
      } else {
        setIsOpen(true);
        setCurrentUrl(url);
        // Get initial screenshot
        setTimeout(refreshScreenshot, 2000);
      }
    } catch {
      setError('Ошибка открытия браузера');
    }

    setLoading(false);
  };

  const navigate = async (newUrl: string) => {
    if (!selectedAccId) return;
    setLoading(true);

    try {
      const result = await steamApi.navigateBrowser(selectedAccId, newUrl);
      if (result.error) {
        setError(result.error);
      } else {
        setCurrentUrl(newUrl);
        setUrl(newUrl);
        setTimeout(refreshScreenshot, 2000);
      }
    } catch {
      setError('Ошибка навигации');
    }

    setLoading(false);
  };

  const closeBrowser = async () => {
    if (!selectedAccId) return;
    await steamApi.closeBrowser(selectedAccId);
    setIsOpen(false);
    setScreenshot(null);
    setPageContent(null);
    setCurrentUrl('');
  };

  // Predefined quick links
  const quickLinks = [
    { label: 'Steam Store', url: 'https://store.steampowered.com' },
    { label: 'Inventory', url: 'https://steamcommunity.com/my/inventory/' },
    { label: 'Profile', url: 'https://steamcommunity.com/my/' },
    { label: 'Market', url: 'https://steamcommunity.com/market/' },
    { label: 'Trade Offers', url: 'https://steamcommunity.com/my/tradeoffers/' },
    { label: 'Friends', url: 'https://steamcommunity.com/my/friends/' },
  ];

  return (
    <div className="p-6 space-y-4 animate-fade-in overflow-y-auto max-h-[calc(100vh-52px)]">
      <div>
        <h1 className="text-2xl font-semibold text-white flex items-center gap-2">
          <Globe size={24} />
          Браузер
        </h1>
        <p className="text-sm text-white/40 mt-1">Просмотр Steam страниц от имени аккаунта</p>
      </div>

      {/* Account selector */}
      <div className="glass-card rounded-2xl p-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <label className="text-xs text-white/50 mb-1 block">Аккаунт</label>
            <select
              value={selectedAccId}
              onChange={e => { setSelectedAccId(e.target.value); setIsOpen(false); setScreenshot(null); setPageContent(null); }}
              className="w-full glass-input text-sm text-white px-3 py-2 rounded-xl outline-none bg-transparent"
            >
              <option value="" className="bg-gray-900">Выберите аккаунт</option>
              {onlineAccounts.map(acc => (
                <option key={acc.id} value={acc.id} className="bg-gray-900">
                  {acc.login} ({acc.steamId || 'no steamid'})
                </option>
              ))}
            </select>
          </div>
          {activeAccount && (
            <div className="text-right text-xs text-white/40">
              <div>{activeAccount.displayName}</div>
              <div className="text-[10px] text-green-400">{activeAccount.status}</div>
            </div>
          )}
        </div>
      </div>

      {/* URL Bar */}
      <div className="glass-card rounded-2xl p-3">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <button onClick={() => navigate(currentUrl)} className="p-2 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/5" disabled={!isOpen}>
              <ArrowLeft size={14} />
            </button>
            <button onClick={() => navigate(currentUrl)} className="p-2 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/5" disabled={!isOpen}>
              <ArrowRight size={14} />
            </button>
            <button onClick={refreshScreenshot} className={`p-2 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/5 ${loading ? 'animate-spin' : ''}`} disabled={!isOpen}>
              <RotateCw size={14} />
            </button>
          </div>

          <div className="flex-1 relative">
            <Globe size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
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
              disabled={!selectedAccId || loading}
              className="flex items-center gap-1 px-4 py-2 rounded-xl bg-indigo-500/20 text-indigo-400 text-sm hover:bg-indigo-500/30 disabled:opacity-30 transition-colors"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Monitor size={14} />}
              Открыть
            </button>
          ) : (
            <button
              onClick={closeBrowser}
              className="flex items-center gap-1 px-4 py-2 rounded-xl bg-red-500/20 text-red-400 text-sm hover:bg-red-500/30 transition-colors"
            >
              <X size={14} />
              Закрыть
            </button>
          )}
        </div>

        {/* Quick links */}
        <div className="flex flex-wrap gap-1 mt-2">
          {quickLinks.map(link => (
            <button
              key={link.url}
              onClick={() => {
                setUrl(link.url);
                if (isOpen) navigate(link.url);
              }}
              className="px-2 py-1 rounded-lg bg-white/5 text-[10px] text-white/50 hover:text-white/80 hover:bg-white/10 transition-colors"
            >
              {link.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="glass-card rounded-xl p-3 text-xs text-red-400 bg-red-500/10">
          {error}
        </div>
      )}

      {/* Browser content area */}
      <div className="glass-card rounded-2xl overflow-hidden">
        {isOpen ? (
          <div className="relative">
            {/* Status bar */}
            <div className="px-3 py-1.5 border-b border-white/5 flex items-center justify-between">
              <span className="text-[10px] text-white/30 truncate flex-1">{currentUrl || url}</span>
              <div className="flex items-center gap-2 shrink-0">
                <label className="flex items-center gap-1 text-[10px] text-white/30 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoRefresh}
                    onChange={e => setAutoRefresh(e.target.checked)}
                    className="w-3 h-3"
                  />
                  Автообновление
                </label>
                <button
                  onClick={refreshScreenshot}
                  className="text-[10px] text-indigo-400 hover:text-indigo-300"
                >
                  Обновить
                </button>
              </div>
            </div>

            {/* Content */}
            {loading ? (
              <div className="flex items-center justify-center h-[500px] text-white/20">
                <div className="text-center">
                  <Loader2 size={32} className="animate-spin mx-auto mb-2" />
                  <div className="text-sm">Загрузка страницы...</div>
                </div>
              </div>
            ) : screenshot ? (
              <div className="relative">
                <img
                  src={`data:image/png;base64,${screenshot}`}
                  alt="Browser screenshot"
                  className="w-full"
                  onClick={() => {
                    // Allow clicking on screenshot to navigate
                  }}
                />
              </div>
            ) : pageContent ? (
              <div className="h-[500px] overflow-auto">
                <iframe
                  srcDoc={pageContent}
                  className="w-full h-full border-0"
                  sandbox="allow-same-origin"
                  title="Browser content"
                />
              </div>
            ) : (
              <div className="flex items-center justify-center h-[500px] text-white/20">
                <div className="text-center">
                  <Monitor size={48} className="mx-auto mb-4 opacity-30" />
                  <div className="text-sm">Страница загружается...</div>
                  <button
                    onClick={refreshScreenshot}
                    className="mt-3 px-4 py-2 rounded-xl bg-indigo-500/20 text-indigo-400 text-xs hover:bg-indigo-500/30"
                  >
                    Обновить скриншот
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center h-[400px] text-white/20">
            <div className="text-center">
              <Globe size={48} className="mx-auto mb-4 opacity-30" />
              <div className="text-lg font-medium">Steam Браузер</div>
              <div className="text-sm mt-1">Выберите аккаунт и введите URL для начала</div>
              {!selectedAccId && (
                <div className="text-xs text-yellow-400/50 mt-3">
                  ⚠️ Выберите онлайн аккаунт для использования браузера
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
