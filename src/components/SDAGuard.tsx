import { useState, useEffect, useCallback } from 'react';
import { ShieldCheck, RefreshCw, Copy } from 'lucide-react';
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
  const [codes, setCodes] = useState<Record<string, CodeData>>({});
  const [copied, setCopied] = useState<string | null>(null);

  const guardAccounts = accounts.filter(a => a.maFile?.shared_secret);

  const fetchCodes = useCallback(async () => {
    for (const acc of guardAccounts) {
      if (!acc.maFile?.shared_secret) continue;
      try {
        const result = await steamApi.getGuardCode(acc.maFile.shared_secret);
        if (result) {
          setCodes(prev => ({
            ...prev,
            [acc.id]: {
              code: (result.code as string) || '?????',
              timeLeft: (result.timeLeft as number) ?? 30,
            },
          }));
        }
      } catch { /* ignore */ }
    }
  }, [guardAccounts.map(a => a.id).join(',')]);

  useEffect(() => {
    fetchCodes();
    const interval = setInterval(fetchCodes, 5000);
    return () => clearInterval(interval);
  }, [fetchCodes]);

  // Countdown
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
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in overflow-y-auto max-h-[calc(100vh-52px)]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white flex items-center gap-2">
            <ShieldCheck size={24} />
            SDA / Steam Guard
          </h1>
          <p className="text-sm text-white/40 mt-1">Коды двухфакторной аутентификации</p>
        </div>
        <button
          onClick={fetchCodes}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 text-white/60 text-sm hover:bg-white/10 transition-colors"
        >
          <RefreshCw size={14} />
          Обновить
        </button>
      </div>

      {guardAccounts.length === 0 ? (
        <div className="glass-card rounded-2xl p-12 text-center">
          <ShieldCheck size={48} className="mx-auto mb-4 text-white/10" />
          <div className="text-sm text-white/30">Нет аккаунтов с maFile</div>
          <div className="text-xs text-white/20 mt-1">Загрузите .maFile при импорте аккаунтов</div>
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
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-white font-medium truncate">{acc.login}</div>
                    <div className="text-[10px] text-white/30">{acc.steamId || 'Не подключен'}</div>
                  </div>

                  {/* Progress circle */}
                  <div className="relative w-10 h-10 shrink-0">
                    <svg className="w-10 h-10 -rotate-90" viewBox="0 0 36 36">
                      <circle cx="18" cy="18" r="15.9" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="3" />
                      <circle
                        cx="18"
                        cy="18"
                        r="15.9"
                        fill="none"
                        stroke={isUrgent ? '#ef4444' : '#818cf8'}
                        strokeWidth="3"
                        strokeDasharray={`${progress} 100`}
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center text-[10px] text-white/60">
                      {codeData?.timeLeft || 0}с
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div
                    className={`flex-1 text-center text-2xl font-mono font-bold tracking-widest rounded-xl py-2 ${
                      isUrgent ? 'text-red-400' : 'text-indigo-400'
                    } bg-white/5`}
                  >
                    {codeData?.code || '·····'}
                  </div>
                  <button
                    onClick={() => copyCode(acc.id, codeData?.code || '')}
                    disabled={!codeData?.code}
                    className="p-2 rounded-xl bg-white/5 text-white/40 hover:text-white/70 hover:bg-white/10 transition-colors disabled:opacity-30"
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
