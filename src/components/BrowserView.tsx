import { useState, useCallback } from 'react';
import { ArrowLeft, ArrowRight, RefreshCw, Home, Lock, Play, Square, AlertCircle, Monitor, Loader2, ExternalLink } from 'lucide-react';
import type { SteamAccount } from '../types';

interface BrowserViewProps {
  accounts: SteamAccount[];
}

interface BrowserSession {
  accountId: string;
  url: string;
  isActive: boolean;
  isLoading: boolean;
  error: string | null;
  title: string | null;
  history: string[];
  historyIndex: number;
}

export default function BrowserView({ accounts }: BrowserViewProps) {
  const [selectedAccount, setSelectedAccount] = useState(accounts[0]?.id || '');
  const [url, setUrl] = useState('https://steamcommunity.com/my');
  const [sessions, setSessions] = useState<Record<string, BrowserSession>>({});

  const acc = accounts.find(a => a.id === selectedAccount);
  const session = sessions[selectedAccount];

  const quickLinks = [
    { name: 'Профиль', url: 'https://steamcommunity.com/my', icon: '👤' },
    { name: 'Магазин', url: 'https://store.steampowered.com', icon: '🏪' },
    { name: 'Сообщество', url: 'https://steamcommunity.com', icon: '👥' },
    { name: 'Маркет', url: 'https://steamcommunity.com/market', icon: '💰' },
    { name: 'Инвентарь', url: 'https://steamcommunity.com/my/inventory', icon: '📦' },
    { name: 'Трейды', url: 'https://steamcommunity.com/my/tradeoffers', icon: '🔄' },
    { name: 'Друзья', url: 'https://steamcommunity.com/my/friends', icon: '👫' },
    { name: 'Значки', url: 'https://steamcommunity.com/my/badges', icon: '🏅' },
  ];

  const isOnline = acc?.status === 'online' || acc?.status === 'in-game';

  // Open browser session
  const openSession = useCallback(async (targetUrl: string) => {
    if (!acc || !isOnline) {
      setSessions(prev => ({
        ...prev,
        [selectedAccount]: {
          accountId: selectedAccount,
          url: targetUrl,
          isActive: false,
          isLoading: false,
          error: 'Аккаунт должен быть онлайн',
          title: null,
          history: [targetUrl],
          historyIndex: 0,
        }
      }));
      return;
    }

    setSessions(prev => ({
      ...prev,
      [selectedAccount]: {
        accountId: selectedAccount,
        url: targetUrl,
        isActive: false,
        isLoading: true,
        error: null,
        title: null,
        history: prev[selectedAccount]?.history 
          ? [...prev[selectedAccount].history.slice(0, (prev[selectedAccount].historyIndex || 0) + 1), targetUrl]
          : [targetUrl],
        historyIndex: prev[selectedAccount]?.history
          ? Math.min((prev[selectedAccount].historyIndex || 0) + 1, prev[selectedAccount].history.length)
          : 0,
      }
    }));

    try {
      const res = await fetch('/api/steam/browser/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId: selectedAccount, url: targetUrl }),
      });
      const data = await res.json();

      if (data.error) {
        setSessions(prev => ({
          ...prev,
          [selectedAccount]: { ...prev[selectedAccount], isLoading: false, error: data.error }
        }));
      } else {
        setSessions(prev => ({
          ...prev,
          [selectedAccount]: { 
            ...prev[selectedAccount], 
            isLoading: false, 
            isActive: true, 
            error: null,
            title: data.title || null,
            url: targetUrl,
          }
        }));
      }
    } catch {
      setSessions(prev => ({
        ...prev,
        [selectedAccount]: { ...prev[selectedAccount], isLoading: false, error: 'Сервер недоступен' }
      }));
    }
  }, [selectedAccount, acc, isOnline]);

  // Navigate
  const navigate = useCallback(async (targetUrl: string) => {
    setUrl(targetUrl);
    
    setSessions(prev => ({
      ...prev,
      [selectedAccount]: { ...prev[selectedAccount], isLoading: true, url: targetUrl }
    }));

    try {
      await fetch('/api/steam/browser/navigate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId: selectedAccount, url: targetUrl }),
      });

      setSessions(prev => ({
        ...prev,
        [selectedAccount]: { ...prev[selectedAccount], isLoading: false, url: targetUrl }
      }));
    } catch {
      setSessions(prev => ({
        ...prev,
        [selectedAccount]: { ...prev[selectedAccount], isLoading: false }
      }));
    }
  }, [selectedAccount]);

  // Close session
  const closeSession = useCallback(async () => {
    try {
      await fetch('/api/steam/browser/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId: selectedAccount }),
      });
    } catch {}

    setSessions(prev => {
      const newSessions = { ...prev };
      delete newSessions[selectedAccount];
      return newSessions;
    });
  }, [selectedAccount]);

  // Go back/forward
  const goBack = useCallback(() => {
    if (!session || session.historyIndex <= 0) return;
    const prevUrl = session.history[session.historyIndex - 1];
    setSessions(prev => ({
      ...prev,
      [selectedAccount]: { ...prev[selectedAccount], historyIndex: prev[selectedAccount].historyIndex - 1 }
    }));
    navigate(prevUrl);
  }, [session, selectedAccount, navigate]);

  const goForward = useCallback(() => {
    if (!session || session.historyIndex >= session.history.length - 1) return;
    const nextUrl = session.history[session.historyIndex + 1];
    setSessions(prev => ({
      ...prev,
      [selectedAccount]: { ...prev[selectedAccount], historyIndex: prev[selectedAccount].historyIndex + 1 }
    }));
    navigate(nextUrl);
  }, [session, selectedAccount, navigate]);

  // Build profile URL from steamId
  const getProfileUrl = () => {
    if (acc?.steamId) return `https://steamcommunity.com/profiles/${acc.steamId}`;
    return 'https://steamcommunity.com/my';
  };

  return (
    <div className="flex flex-col h-[calc(100vh-52px)] animate-fade-in">
      {/* Browser toolbar */}
      <div className="glass border-b border-white/5 p-3 space-y-2">
        <div className="flex items-center gap-2">
          {/* Account selector */}
          <select
            value={selectedAccount}
            onChange={e => setSelectedAccount(e.target.value)}
            className="glass-input text-xs text-white px-3 py-2 rounded-xl outline-none w-44"
          >
            {accounts.map(a => (
              <option key={a.id} value={a.id} className="bg-neutral-800">
                {a.avatar} {a.login} {a.status === 'online' ? '🟢' : a.status === 'in-game' ? '🟣' : '⚫'}
              </option>
            ))}
          </select>

          {/* Navigation */}
          <button onClick={goBack} disabled={!session || session.historyIndex <= 0}
            className="p-2 rounded-xl glass-button text-white/50 hover:text-white disabled:opacity-30">
            <ArrowLeft size={14} />
          </button>
          <button onClick={goForward} disabled={!session || session.historyIndex >= (session?.history?.length || 1) - 1}
            className="p-2 rounded-xl glass-button text-white/50 hover:text-white disabled:opacity-30">
            <ArrowRight size={14} />
          </button>
          <button onClick={() => session?.isActive ? navigate(session.url) : undefined}
            className="p-2 rounded-xl glass-button text-white/50 hover:text-white">
            <RefreshCw size={14} className={session?.isLoading ? 'animate-spin' : ''} />
          </button>
          <button onClick={() => { setUrl(getProfileUrl()); navigate(getProfileUrl()); }}
            className="p-2 rounded-xl glass-button text-white/50 hover:text-white">
            <Home size={14} />
          </button>

          {/* URL bar */}
          <div className="flex-1 flex items-center glass-input rounded-xl px-3 py-2">
            <Lock size={12} className="text-green-400 mr-2" />
            <input
              type="text"
              value={url}
              onChange={e => setUrl(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  if (session?.isActive) navigate(url);
                  else openSession(url);
                }
              }}
              className="flex-1 bg-transparent text-sm text-white outline-none"
              placeholder="Введите URL..."
            />
          </div>

          {/* Open in new tab */}
          {session?.isActive && (
            <a href={session.url} target="_blank" rel="noopener noreferrer"
              className="p-2 rounded-xl glass-button text-white/50 hover:text-white">
              <ExternalLink size={14} />
            </a>
          )}

          {/* Open/Close */}
          {session?.isActive ? (
            <button onClick={closeSession}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl glass-button text-red-400 hover:text-red-300 text-xs">
              <Square size={12} /> Закрыть
            </button>
          ) : (
            <button onClick={() => openSession(url)} disabled={!isOnline}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl glass-accent text-white text-xs disabled:opacity-40">
              <Play size={12} /> Открыть
            </button>
          )}
        </div>

        {/* Quick links */}
        <div className="flex gap-1 flex-wrap">
          {quickLinks.map(link => (
            <button
              key={link.name}
              onClick={() => {
                setUrl(link.url);
                if (session?.isActive) navigate(link.url);
                else openSession(link.url);
              }}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] text-white/60 hover:text-white glass-button"
            >
              <span>{link.icon}</span>
              {link.name}
            </button>
          ))}
        </div>
      </div>

      {/* Browser content */}
      <div className="flex-1 flex items-center justify-center overflow-auto relative bg-black/20">
        {session?.isLoading ? (
          <div className="text-center animate-fade-in">
            <Loader2 size={40} className="animate-spin text-blue-400 mx-auto mb-4" />
            <div className="text-sm text-white/60">Загрузка страницы...</div>
            <div className="text-xs text-white/30 mt-1">
              Аккаунт: {acc?.login} • {session.url}
            </div>
          </div>
        ) : session?.error ? (
          <div className="text-center max-w-md glass-card rounded-3xl p-8 animate-fade-in">
            <AlertCircle size={48} className="mx-auto mb-4 text-red-400/60" />
            <div className="text-lg font-medium text-white mb-2">Ошибка</div>
            <div className="text-sm text-red-400/80 mb-6">{session.error}</div>
            <button onClick={() => openSession(url)}
              className="px-6 py-2 rounded-xl glass-accent text-white text-sm">
              Попробовать снова
            </button>
          </div>
        ) : session?.isActive ? (
          <div className="w-full h-full flex flex-col">
            {/* Active session view */}
            <div className="flex-1 flex items-center justify-center p-6">
              <div className="max-w-2xl w-full space-y-6">
                {/* Session info card */}
                <div className="glass-card rounded-3xl p-8 text-center">
                  <div className="text-4xl mb-4">{acc?.avatar}</div>
                  <div className="text-xl font-semibold text-white mb-1">{acc?.login}</div>
                  {acc?.steamId && (
                    <div className="text-xs text-white/40 font-mono mb-4">{acc.steamId}</div>
                  )}
                  
                  <div className="flex items-center justify-center gap-2 mb-6">
                    <span className="w-2 h-2 rounded-full bg-green-400" />
                    <span className="text-sm text-green-400">Сессия активна</span>
                  </div>

                  <div className="glass-light rounded-2xl p-4 text-left space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-white/50">Текущий URL:</span>
                      <span className="text-blue-400 truncate ml-4 max-w-xs">{session.url}</span>
                    </div>
                    {session.title && (
                      <div className="flex justify-between">
                        <span className="text-white/50">Страница:</span>
                        <span className="text-white">{session.title}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-white/50">Сервер:</span>
                      <span className="text-white">{acc?.server}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/50">Guard:</span>
                      <span className={acc?.guardEnabled ? 'text-green-400' : 'text-red-400'}>
                        {acc?.guardEnabled ? 'Активен' : 'Не активен'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Quick actions */}
                <div className="grid grid-cols-4 gap-3">
                  {[
                    { label: 'Профиль', url: getProfileUrl(), icon: '👤' },
                    { label: 'Инвентарь', url: 'https://steamcommunity.com/my/inventory', icon: '📦' },
                    { label: 'Трейды', url: 'https://steamcommunity.com/my/tradeoffers', icon: '🔄' },
                    { label: 'Маркет', url: 'https://steamcommunity.com/market', icon: '💰' },
                  ].map(link => (
                    <button
                      key={link.label}
                      onClick={() => { setUrl(link.url); navigate(link.url); }}
                      className="glass-card rounded-2xl p-4 text-center hover:bg-white/10 transition-colors"
                    >
                      <div className="text-2xl mb-2">{link.icon}</div>
                      <div className="text-xs text-white/60">{link.label}</div>
                    </button>
                  ))}
                </div>

                {/* Open in browser hint */}
                <div className="text-center">
                  <a 
                    href={session.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl glass-button text-sm text-blue-400 hover:text-blue-300"
                  >
                    <ExternalLink size={14} />
                    Открыть в браузере
                  </a>
                  <div className="text-[10px] text-white/20 mt-2">
                    Сессия авторизована через Steam cookies аккаунта
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom bar */}
            <div className="glass border-t border-white/5 px-4 py-2 flex items-center justify-between text-xs text-white/40">
              <span>🔗 {session.url}</span>
              <span>Steam Web Session • {acc?.login}</span>
            </div>
          </div>
        ) : (
          /* No session - welcome screen */
          <div className="text-center max-w-lg glass-card rounded-3xl p-8">
            <Monitor size={48} className="mx-auto mb-4 text-white/20" />
            <div className="text-lg font-medium text-white mb-2">Браузер Steam</div>
            <div className="text-sm text-white/50 mb-2">
              Аккаунт: <span className="text-blue-400">{acc?.login || 'не выбран'}</span>
              {acc && (
                <span className={`ml-2 ${isOnline ? 'text-green-400' : 'text-red-400'}`}>
                  ({isOnline ? 'Онлайн' : 'Оффлайн'})
                </span>
              )}
            </div>
            <div className="text-xs text-white/30 mb-6">
              Откройте сессию для работы с профилем Steam через авторизованные cookies
            </div>

            <div className="glass-light rounded-2xl p-4 text-left space-y-2 text-xs mb-6">
              <div className="flex justify-between">
                <span className="text-white/50">Аккаунт:</span>
                <span className="text-white">{acc?.login || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/50">Сервер:</span>
                <span className="text-blue-400">{acc?.server || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/50">Статус:</span>
                <span className={isOnline ? 'text-green-400' : 'text-red-400'}>
                  {isOnline ? 'Готов к работе' : 'Необходимо подключение'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/50">Guard:</span>
                <span className={acc?.guardEnabled ? 'text-green-400' : 'text-red-400'}>
                  {acc?.guardEnabled ? 'Активен' : 'Не активен'}
                </span>
              </div>
            </div>

            {isOnline ? (
              <button onClick={() => openSession(url)}
                className="px-8 py-3 rounded-xl glass-accent text-white font-medium flex items-center justify-center gap-2 mx-auto">
                <Play size={16} /> Открыть сессию
              </button>
            ) : (
              <div className="text-xs text-yellow-400/60 flex items-center justify-center gap-2">
                <AlertCircle size={14} />
                Подключите аккаунт для использования браузера
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
