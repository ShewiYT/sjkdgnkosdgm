import { useState, useEffect, useCallback } from 'react';
import { Lock, Copy, RefreshCw } from 'lucide-react';
import { steamApi } from '../api';
import type { SteamAccount } from '../types';

interface SDAGuardProps {
  accounts: SteamAccount[];
}

interface CodeData {
  code: string;
  timeLeft: number;
}

export default function SDAGuard({ accounts }: SDAGuardProps) {
  const guardAccounts = accounts.filter(a => a.maFile?.shared_secret);
  const [codes, setCodes] = useState<Record<string, CodeData>>({});
  const [copied, setCopied] = useState<string | null>(null);

  const refreshCodes = useCallback(async () => {
    for (const acc of guardAccounts) {
      if (!acc.maFile?.shared_secret) continue;
      try {
        const result = await steamApi.getGuardCode(acc.maFile.shared_secret);
        if (result && result.code) {
          setCodes(prev => ({
            ...prev,
            [acc.id]: {
              code: result.code as string,
              timeLeft: (result.timeLeft as number) || 30,
            },
          }));
        }
      } catch { /* ignore */ }
    }
  }, [guardAccounts.length]);

  useEffect(() => {
    refreshCodes();
    const interval = setInterval(refreshCodes, 5000);
    return () => clearInterval(interval);
  }, [refreshCodes]);

  // Countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      setCodes(prev => {
        const next = { ...prev };
        for (const id in next) {
          if (next[id].timeLeft > 0) {
            next[id] = { ...next[id], timeLeft: next[id].timeLeft - 1 };
          }
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const copyCode = (id: string, code: string) => {
    navigator.clipboard.writeText(code).catch(() => {});
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in overflow-y-auto max-h-[calc(100vh-52px)]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white flex items-center gap-2">
            <Lock size={24} />
            SDA / Steam Guard
          </h1>
          <p className="text-sm text-white/40 mt-1">Коды двухфакторной аутентификации</p>
        </div>
        <button
          onClick={refreshCodes}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 text-white/60 text-sm hover:bg-white/10"
        >
          <RefreshCw size={14} />
          Обновить
        </button>
      </div>

      {guardAccounts.length === 0 ? (
        <div className="glass-card rounded-2xl p-12 text-center">
          <Lock size={48} className="mx-auto mb-4 text-white/10" />
          <div className="text-lg text-white/30">Нет аккаунтов с maFile</div>
          <div className="text-sm text-white/20 mt-1">
            Загрузите .maFile при импорте аккаунтов
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {guardAccounts.map(acc => {
            const codeData = codes[acc.id];
            const progress = codeData ? (codeData.timeLeft / 30) * 100 : 0;
            const isUrgent = codeData && codeData.timeLeft <= 10;

            return (
              <div key={acc.id} className="glass-card rounded-2xl p-4 space-y-3">
                <div className="flex items-center gap-3">
                  {acc.avatarUrl ? (
                    <img src={acc.avatarUrl} alt="" className="w-8 h-8 rounded-full" />
                  ) : (
                    <span className="text-xl">{acc.avatar}</span>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-white font-medium truncate">{acc.login}</div>
                    <div className="text-[10px] text-white/30 truncate">
                      {acc.steamId || 'Не подключен'}
                    </div>
                  </div>

                  {/* Progress circle */}
                  <div className="relative w-10 h-10 shrink-0">
                    <svg className="w-10 h-10 -rotate-90" viewBox="0 0 36 36">
                      <circle
                        cx="18" cy="18" r="15"
                        fill="none"
                        stroke="rgba(255,255,255,0.05)"
                        strokeWidth="3"
                      />
                      <circle
                        cx="18" cy="18" r="15"
                        fill="none"
                        stroke={isUrgent ? '#ef4444' : '#818cf8'}
                        strokeWidth="3"
                        strokeDasharray={`${progress * 0.942} 100`}
                        strokeLinecap="round"
                      />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-[9px] text-white/60">
                      {codeData?.timeLeft || 0}с
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div
                    className={`flex-1 text-center py-2 rounded-xl font-mono font-bold text-lg tracking-widest ${
                      isUrgent ? 'text-red-400 bg-red-500/10' : 'text-indigo-400 bg-indigo-500/10'
                    }`}
                  >
                    {codeData?.code || '·····'}
                  </div>
                  <button
                    onClick={() => codeData && copyCode(acc.id, codeData.code)}
                    disabled={!codeData?.code}
                    className="p-2 rounded-xl bg-white/5 text-white/40 hover:text-white/70 hover:bg-white/10 transition-colors disabled:opacity-30"
                    title="Скопировать"
                  >
                    {copied === acc.id ? (
                      <span className="text-green-400 text-xs">✓</span>
                    ) : (
                      <Copy size={14} />
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
