import { useState, useEffect } from 'react';
import { KeyRound, Copy, CheckCircle } from 'lucide-react';
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
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const guardAccounts = accounts.filter(a => a.guardEnabled && a.maFile?.shared_secret);

  useEffect(() => {
    const fetchCodes = async () => {
      for (const acc of guardAccounts) {
        if (!acc.maFile?.shared_secret) continue;
        const result = await steamApi.getGuardCode(acc.maFile.shared_secret);
        if (result && result.code) {
          setCodes(prev => ({
            ...prev,
            [acc.id]: { code: result.code, timeLeft: result.timeLeft || 30 }
          }));
        }
      }
    };

    fetchCodes();
    const interval = setInterval(fetchCodes, 5000);
    return () => clearInterval(interval);
  }, [guardAccounts.length]);

  // Countdown timer
  useEffect(() => {
    const interval = setInterval(() => {
      setCodes(prev => {
        const next = { ...prev };
        for (const key in next) {
          next[key] = { ...next[key], timeLeft: Math.max(0, next[key].timeLeft - 1) };
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const copyCode = (id: string, code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in overflow-y-auto max-h-[calc(100vh-52px)]">
      <div>
        <h1 className="text-2xl font-semibold text-white flex items-center gap-2">
          <KeyRound size={24} />
          SDA / Guard коды
        </h1>
        <p className="text-sm text-white/40 mt-1">Steam Guard TOTP коды для аккаунтов с maFile</p>
      </div>

      {guardAccounts.length === 0 ? (
        <div className="glass-card rounded-2xl p-12 text-center">
          <KeyRound size={48} className="mx-auto mb-4 text-white/10" />
          <div className="text-lg text-white/30">Нет аккаунтов с Guard</div>
          <div className="text-sm text-white/20 mt-1">Загрузите maFile при импорте аккаунтов</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {guardAccounts.map(acc => {
            const codeData = codes[acc.id];
            const progress = codeData ? (codeData.timeLeft / 30) * 100 : 0;
            
            return (
              <div key={acc.id} className="glass-card rounded-2xl p-4 space-y-3">
                <div className="flex items-center gap-3">
                  {acc.avatarUrl ? (
                    <img src={acc.avatarUrl} alt="" className="w-10 h-10 rounded-full" />
                  ) : (
                    <span className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-lg">
                      {acc.avatar}
                    </span>
                  )}
                  <div className="min-w-0">
                    <div className="text-sm text-white font-medium truncate">{acc.login}</div>
                    <div className="text-[10px] text-white/30">{acc.steamId || 'Не подключен'}</div>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div
                    className="text-2xl font-mono font-bold tracking-widest text-indigo-400 cursor-pointer hover:text-indigo-300"
                    onClick={() => codeData && copyCode(acc.id, codeData.code)}
                  >
                    {codeData?.code || '-----'}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative w-8 h-8">
                      <svg className="w-8 h-8 -rotate-90" viewBox="0 0 36 36">
                        <circle cx="18" cy="18" r="16" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="3" />
                        <circle
                          cx="18" cy="18" r="16" fill="none"
                          stroke={progress > 30 ? '#818cf8' : '#ef4444'}
                          strokeWidth="3"
                          strokeDasharray={`${progress} 100`}
                          strokeLinecap="round"
                        />
                      </svg>
                      <span className="absolute inset-0 flex items-center justify-center text-[9px] text-white/40">
                        {codeData?.timeLeft || 0}с
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => codeData && copyCode(acc.id, codeData.code)}
                  className="w-full flex items-center justify-center gap-1 py-1.5 rounded-lg bg-white/5 text-white/40 text-xs hover:bg-white/10 transition-colors"
                >
                  {copiedId === acc.id ? (
                    <>
                      <CheckCircle size={12} className="text-green-400" />
                      <span className="text-green-400">Скопировано</span>
                    </>
                  ) : (
                    <>
                      <Copy size={12} />
                      Копировать
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
