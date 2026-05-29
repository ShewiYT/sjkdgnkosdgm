import { useState, useEffect, useCallback } from 'react';
import { Key, Copy, CheckCircle } from 'lucide-react';
import type { SteamAccount } from '../types';
import { steamApi } from '../api';

interface SDAGuardProps {
  accounts: SteamAccount[];
}

export default function SDAGuard({ accounts }: SDAGuardProps) {
  const guardAccounts = accounts.filter(a => a.maFile?.shared_secret);
  const [codes, setCodes] = useState<Record<string, { code: string; timeLeft: number }>>({});
  const [copied, setCopied] = useState<string | null>(null);

  const refreshCodes = useCallback(async () => {
    for (const acc of guardAccounts) {
      if (!acc.maFile?.shared_secret) continue;
      try {
        const result = await steamApi.getGuardCode(acc.maFile.shared_secret);
        if (result?.code) {
          setCodes(prev => ({
            ...prev,
            [acc.id]: { code: result.code as string, timeLeft: (result.timeLeft as number) || 30 },
          }));
        } else {
          // Local TOTP fallback
          const time = Math.floor(Date.now() / 1000);
          const timeLeft = 30 - (time % 30);
          setCodes(prev => ({
            ...prev,
            [acc.id]: { code: '·····', timeLeft },
          }));
        }
      } catch {
        const time = Math.floor(Date.now() / 1000);
        const timeLeft = 30 - (time % 30);
        setCodes(prev => ({
          ...prev,
          [acc.id]: { code: '·····', timeLeft },
        }));
      }
    }
  }, [guardAccounts]);

  useEffect(() => {
    refreshCodes();
    const interval = setInterval(refreshCodes, 5000);
    return () => clearInterval(interval);
  }, [refreshCodes]);

  const copyCode = (accId: string, code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(accId);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in overflow-y-auto max-h-[calc(100vh-52px)]">
      <div>
        <h1 className="text-2xl font-semibold text-white flex items-center gap-2"><Key size={24} /> SDA / Steam Guard</h1>
        <p className="text-sm text-white/40 mt-1">Коды двухфакторной аутентификации</p>
      </div>

      {guardAccounts.length === 0 ? (
        <div className="glass-card rounded-2xl p-12 text-center">
          <Key size={48} className="mx-auto mb-4 text-white/10" />
          <div className="text-lg text-white/30">Нет аккаунтов с maFile</div>
          <div className="text-sm text-white/20 mt-1">Загрузите .maFile при импорте аккаунтов</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {guardAccounts.map(acc => {
            const codeData = codes[acc.id];
            const progress = codeData ? (codeData.timeLeft / 30) * 100 : 0;
            return (
              <div key={acc.id} className="glass-card rounded-2xl p-4">
                <div className="flex items-center gap-3 mb-3">
                  {acc.avatarUrl ? <img src={acc.avatarUrl} alt="" className="w-8 h-8 rounded-full" /> : <span className="text-lg">{acc.avatar}</span>}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-white truncate">{acc.login}</div>
                    <div className="text-[10px] text-white/30 truncate">{acc.steamId || 'Не подключен'}</div>
                  </div>
                  <div className="relative w-10 h-10">
                    <svg className="w-10 h-10 -rotate-90" viewBox="0 0 36 36">
                      <circle cx="18" cy="18" r="14" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="3" />
                      <circle cx="18" cy="18" r="14" fill="none" stroke={codeData && codeData.timeLeft <= 10 ? '#ef4444' : '#6366f1'}
                        strokeWidth="3" strokeDasharray={`${progress * 0.88} 88`} strokeLinecap="round" />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-[9px] text-white/50">{codeData?.timeLeft || 0}с</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xl font-mono font-bold text-white tracking-widest flex-1">{codeData?.code || '·····'}</span>
                  <button onClick={() => codeData && copyCode(acc.id, codeData.code)}
                    className="p-2 rounded-lg bg-white/5 text-white/40 hover:text-white/60">
                    {copied === acc.id ? <CheckCircle size={14} className="text-green-400" /> : <Copy size={14} />}
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
