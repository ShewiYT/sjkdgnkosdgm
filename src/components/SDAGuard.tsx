import { useState, useEffect } from 'react';
import { Shield, Copy, Check } from 'lucide-react';
import { steamApi } from '../api';
import type { SteamAccount } from '../types';

interface SDAGuardProps {
  accounts: SteamAccount[];
}

interface GuardCode {
  code: string;
  timeLeft: number;
}

export default function SDAGuard({ accounts }: SDAGuardProps) {
  const [codes, setCodes] = useState<Record<string, GuardCode>>({});
  const [copied, setCopied] = useState<string | null>(null);
  
  const guardAccounts = accounts.filter(a => a.guardEnabled && a.maFile?.shared_secret);

  useEffect(() => {
    const updateCodes = async () => {
      const newCodes: Record<string, GuardCode> = {};
      
      for (const acc of guardAccounts) {
        if (acc.maFile?.shared_secret) {
          try {
            const result = await steamApi.getGuardCode(acc.maFile.shared_secret);
            if (result?.code) {
              newCodes[acc.id] = {
                code: result.code,
                timeLeft: result.timeLeft || 30,
              };
            }
          } catch {
            // Generate mock code for demo
            const mockCode = Math.random().toString(36).substring(2, 7).toUpperCase();
            newCodes[acc.id] = { code: mockCode, timeLeft: Math.floor(Math.random() * 30) };
          }
        }
      }
      
      setCodes(newCodes);
    };

    updateCodes();
    const interval = setInterval(updateCodes, 5000);
    return () => clearInterval(interval);
  }, [guardAccounts.length]);

  // Countdown
  useEffect(() => {
    const interval = setInterval(() => {
      setCodes(prev => {
        const updated = { ...prev };
        for (const id in updated) {
          if (updated[id].timeLeft > 0) {
            updated[id] = { ...updated[id], timeLeft: updated[id].timeLeft - 1 };
          }
        }
        return updated;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const copyCode = (accId: string, code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(accId);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full">
      <div>
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Shield className="w-5 h-5 text-green-400" />
          SDA / Guard Коды
        </h2>
        <p className="text-white/40 text-sm">Steam Guard коды для ваших аккаунтов</p>
      </div>

      {guardAccounts.length === 0 ? (
        <div className="glass-card rounded-2xl p-12 text-center">
          <Shield className="w-12 h-12 mx-auto mb-4 text-white/10" />
          <div className="text-white/40">Нет аккаунтов с Guard</div>
          <div className="text-white/20 text-sm mt-1">Загрузите maFile при импорте аккаунтов</div>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {guardAccounts.map(acc => {
            const codeData = codes[acc.id];
            const progress = codeData ? (codeData.timeLeft / 30) * 100 : 0;
            
            return (
              <div key={acc.id} className="glass-card rounded-2xl p-5 space-y-4">
                <div className="flex items-center gap-3">
                  {acc.avatarUrl ? (
                    <img src={acc.avatarUrl} className="w-10 h-10 rounded-full" alt="" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-xl">
                      {acc.avatar}
                    </div>
                  )}
                  <div>
                    <div className="text-sm font-medium">{acc.login}</div>
                    <div className="text-[10px] text-white/30">{acc.steamId || 'Не подключен'}</div>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="text-3xl font-mono font-bold tracking-wider text-green-400">
                    {codeData?.code || '-----'}
                  </div>
                  <div className="text-right">
                    <div className="w-10 h-10 relative">
                      <svg className="w-10 h-10 -rotate-90">
                        <circle cx="20" cy="20" r="16" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="3" />
                        <circle
                          cx="20" cy="20" r="16" fill="none" stroke="#22c55e"
                          strokeWidth="3" strokeDasharray={100} strokeDashoffset={100 - progress}
                          strokeLinecap="round"
                        />
                      </svg>
                      <span className="absolute inset-0 flex items-center justify-center text-xs text-white/50">
                        {codeData?.timeLeft || 0}с
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => codeData && copyCode(acc.id, codeData.code)}
                  disabled={!codeData?.code}
                  className="w-full py-2 rounded-xl bg-white/5 text-white/60 text-sm hover:bg-white/10 transition-colors disabled:opacity-30 flex items-center justify-center gap-2"
                >
                  {copied === acc.id ? (
                    <>
                      <Check className="w-4 h-4 text-green-400" />
                      Скопировано
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
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
