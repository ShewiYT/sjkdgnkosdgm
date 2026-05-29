import { useState } from 'react';
import { Settings, Database, AlertTriangle, Key, Shield, CheckCircle, XCircle } from 'lucide-react';
import { useAppStore } from '../store';
import type { SteamAccount } from '../types';

interface SettingsViewProps { accounts: SteamAccount[]; }

export default function SettingsView({ accounts }: SettingsViewProps) {
  const { clearAccounts, steamMarketApiKey, setSteamMarketApiKey, serverConnected, steamAvailable, proxyUrl, setProxyUrl } = useAppStore();
  const [proxyTestStatus, setProxyTestStatus] = useState<'idle' | 'testing' | 'ok' | 'error'>('idle');
  const [proxyTestMsg, setProxyTestMsg] = useState('');

  const testProxy = async () => {
    if (!proxyUrl.trim()) return;
    setProxyTestStatus('testing');
    setProxyTestMsg('');
    try {
      // Validate format first
      const testUrl = proxyUrl.trim().startsWith('http') || proxyUrl.trim().startsWith('socks')
        ? proxyUrl.trim()
        : `http://${proxyUrl.trim()}`;
      try {
        new URL(testUrl);
      } catch {
        setProxyTestStatus('error');
        setProxyTestMsg('❌ Неверный формат URL прокси');
        return;
      }

      const res = await fetch('/api/steam/test-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proxyUrl: proxyUrl.trim() }),
        signal: AbortSignal.timeout(15000),
      });
      const data = await res.json();
      if (data.success) {
        setProxyTestStatus('ok');
        setProxyTestMsg(data.ip ? `✅ Работает! IP: ${data.ip}` : '✅ Прокси работает');
      } else {
        setProxyTestStatus('error');
        setProxyTestMsg(`❌ ${data.error || 'Не удалось подключиться'}`);
      }
    } catch {
      // Server endpoint not available — validate format only
      try {
        const testUrl = proxyUrl.trim().startsWith('http') || proxyUrl.trim().startsWith('socks')
          ? proxyUrl.trim()
          : `http://${proxyUrl.trim()}`;
        const parsed = new URL(testUrl);
        if (parsed.hostname && parsed.port) {
          setProxyTestStatus('ok');
          setProxyTestMsg(`✅ Формат корректный: ${parsed.hostname}:${parsed.port} (серверная проверка недоступна — добавьте setupProxyRoutes(app) в server.js)`);
        } else {
          setProxyTestStatus('error');
          setProxyTestMsg('❌ Не указан хост или порт');
        }
      } catch {
        setProxyTestStatus('error');
        setProxyTestMsg('❌ Неверный формат URL');
      }
    }
    setTimeout(() => setProxyTestStatus('idle'), 15000);
  };

  // Parse proxy for display
  const proxyParsed = (() => {
    try {
      if (!proxyUrl.trim()) return null;
      const url = new URL(proxyUrl.trim().startsWith('http') ? proxyUrl.trim() : `http://${proxyUrl.trim()}`);
      return {
        host: url.hostname,
        port: url.port,
        user: url.username || null,
        hasAuth: !!url.username,
      };
    } catch {
      return null;
    }
  })();

  return (
    <div className="p-6 space-y-6 animate-fade-in overflow-y-auto max-h-[calc(100vh-52px)]">
      <div>
        <h1 className="text-2xl font-semibold text-white flex items-center gap-2">
          <Settings size={24} /> Настройки
        </h1>
        <p className="text-sm text-white/40 mt-1">Конфигурация панели</p>
      </div>

      <div className="max-w-2xl space-y-6">

        {/* Server status */}
        <div className="glass-card rounded-2xl p-5 space-y-3">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Database size={16} className="text-indigo-400" /> Статус сервера
          </h3>
          <div className="space-y-2">
            <div className={`flex items-center gap-2 text-sm ${serverConnected ? 'text-green-400' : 'text-red-400'}`}>
              <span className={`w-2 h-2 rounded-full ${serverConnected ? 'bg-green-400' : 'bg-red-400'}`} />
              {serverConnected ? 'Сервер подключен' : 'Сервер не подключен'}
            </div>
            {serverConnected && (
              <div className={`flex items-center gap-2 text-sm ${steamAvailable ? 'text-green-400' : 'text-yellow-400'}`}>
                <span className={`w-2 h-2 rounded-full ${steamAvailable ? 'bg-green-400' : 'bg-yellow-400'}`} />
                {steamAvailable ? 'steam-user установлен' : 'steam-user НЕ установлен'}
              </div>
            )}
          </div>
        </div>

        {/* Proxy settings */}
        <div className="glass-card rounded-2xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Shield size={16} className="text-orange-400" /> Прокси для обхода RateLimit
          </h3>
          <p className="text-xs text-white/40">
            При подключении аккаунтов сначала используется IP вашего сервера (VDS). 
            Если Steam отвечает <span className="text-red-400">RateLimitExceeded</span>, 
            попытка автоматически повторяется через указанный прокси.
          </p>

          <div>
            <label className="text-xs text-white/50 mb-1.5 block">Прокси (HTTP/HTTPS/SOCKS)</label>
            <input
              value={proxyUrl}
              onChange={e => setProxyUrl(e.target.value)}
              placeholder="http://user:pass@ip:port"
              className="w-full glass-input text-sm text-white px-3 py-2.5 rounded-xl outline-none font-mono"
            />
          </div>

          {proxyParsed && (
            <div className="flex flex-wrap gap-2 text-[10px]">
              <span className="px-2 py-0.5 rounded-full bg-white/5 text-white/40">
                🌐 {proxyParsed.host}:{proxyParsed.port}
              </span>
              {proxyParsed.hasAuth && (
                <span className="px-2 py-0.5 rounded-full bg-green-500/10 text-green-400/60">
                  🔑 С авторизацией
                </span>
              )}
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              onClick={testProxy}
              disabled={!proxyUrl.trim() || proxyTestStatus === 'testing'}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500/15 text-orange-400 text-xs hover:bg-orange-500/25 disabled:opacity-30 transition-colors"
            >
              {proxyTestStatus === 'testing' ? (
                <>
                  <div className="animate-spin w-3 h-3 border border-orange-400/30 border-t-orange-400 rounded-full" />
                  Проверка...
                </>
              ) : (
                <>🔍 Проверить прокси</>
              )}
            </button>

            {proxyUrl.trim() && (
              <button
                onClick={() => { setProxyUrl(''); setProxyTestMsg(''); setProxyTestStatus('idle'); }}
                className="px-3 py-2 rounded-xl bg-white/5 text-white/40 text-xs hover:bg-white/10 hover:text-white/60"
              >
                Очистить
              </button>
            )}
          </div>

          {proxyTestMsg && (
            <div className={`flex items-center gap-2 text-xs p-2.5 rounded-xl ${
              proxyTestStatus === 'ok' ? 'bg-green-500/10 text-green-400' : 
              proxyTestStatus === 'error' ? 'bg-red-500/10 text-red-400' : 'text-white/50'
            }`}>
              {proxyTestStatus === 'ok' ? <CheckCircle size={12} /> : proxyTestStatus === 'error' ? <XCircle size={12} /> : null}
              {proxyTestMsg}
            </div>
          )}

          <div className="text-[10px] text-white/20 p-3 rounded-xl bg-white/3 space-y-1">
            <div>📋 Формат: <code className="text-white/40">http://user:pass@ip:port</code></div>
            <div>📋 Формат: <code className="text-white/40">socks5://user:pass@ip:port</code></div>
            <div>📋 Без авторизации: <code className="text-white/40">http://ip:port</code></div>
            <div className="mt-1.5 text-white/30">
              ⚡ Логика: VDS IP → если RateLimit → автоповтор через прокси
            </div>
          </div>
        </div>

        {/* Steam API Key */}
        <div className="glass-card rounded-2xl p-5 space-y-3">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Key size={16} className="text-white/30" /> Steam API Key (опц.)
          </h3>
          <input
            value={steamMarketApiKey}
            onChange={e => setSteamMarketApiKey(e.target.value)}
            placeholder="Steam Web API Key"
            className="w-full glass-input text-sm text-white px-3 py-2 rounded-xl outline-none font-mono"
          />
        </div>

        {/* Danger zone */}
        <div className="glass-card rounded-2xl p-5 space-y-3 border-red-500/20">
          <h3 className="text-sm font-semibold text-red-400 flex items-center gap-2">
            <AlertTriangle size={16} /> Опасная зона
          </h3>
          <p className="text-xs text-white/40">Удаление всех видимых вам аккаунтов.</p>
          <button
            onClick={clearAccounts}
            className="px-4 py-2 rounded-xl bg-red-500/20 text-red-400 text-xs hover:bg-red-500/30"
          >
            🗑️ Удалить все аккаунты
          </button>
        </div>

        {/* Version */}
        <div className="text-center py-4 space-y-1">
          <div className="text-xs text-white/20">SukaCombine v3.1</div>
          <div className="text-[10px] text-white/10">
            Аккаунтов: {accounts.length} • Онлайн: {accounts.filter(a => a.status === 'online' || a.status === 'in-game').length}
            {proxyUrl.trim() && ' • 🛡️ Прокси настроен'}
          </div>
        </div>
      </div>
    </div>
  );
}
