import { useState, useEffect } from 'react';
import { Shield, Copy, Clock } from 'lucide-react';
import { steamApi } from '../api';
import type { SteamAccount } from '../types';

interface SDAGuardProps {
  accounts: SteamAccount[];
}

export default function SDAGuard({ accounts }: SDAGuardProps) {
  const [codes, setCodes] = useState<Record<string, { code: string; timeLeft: number }>>({});
  const [copied, setCopied] = useState<string | null>(null);

  const guardAccounts = accounts.filter(a => a.guardEnabled && a.maFile);

  useEffect(() => {
    const generateCodes = async () => {
      for (const acc of guardAccounts) {
        if (acc.maFile?.shared_secret) {
          const result = await steamApi.getGuardCode(acc.maFile.shared_secret);
          if (result?.code) {
            setCodes(prev => ({ ...prev, [acc.id]: { code: result.code, timeLeft: result.timeLeft || 30 } }));
          } else {
            // Generate locally using time-based calculation
            const time = Math.floor(Date.now() / 1000);
            const timeLeft = 30 - (time % 30);
            setCodes(prev => ({ ...prev, [acc.id]: { code: '-----', timeLeft } }));
          }
        }
      }
    };

    generateCodes();
    const interval = setInterval(generateCodes, 30000);
    return () => clearInterval(interval);
  }, [guardAccounts.length]);

  // Timer countdown
  useEffect(() => {
    const interval = setInterval(() => {
      setCodes(prev => {
        const updated = { ...prev };
        for (const key in updated) {
          updated[key] = { ...updated[key], timeLeft: Math.max(0, updated[key].timeLeft - 1) };
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
    <div className="p-6 space-y-6 animate-fade-in overflow-y-auto max-h-[calc(100vh-52px)]">
      <div>
        <h1 className="text-2xl font-semibold text-white flex items-center gap-2">
          <Shield size={24} />
          SDA / Guard Коды
        </h1>
        <p className="text-sm text-white/40 mt-1">Steam Guard коды для ваших аккаунтов</p>
      </div>

      {guardAccounts.length === 0 ? (
        <div className="glass-card rounded-2xl p-12 text-center">
          <Shield size={48} className="mx-auto mb-4 text-white/10" />
          <div className="text-lg text-white/30">Нет аккаунтов с Guard</div>
          <div className="text-sm text-white/20 mt-1">Загрузите maFile при импорте аккаунтов</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {guardAccounts.map(acc => {
            const codeData = codes[acc.id];
            return (
              <div key={acc.id} className="glass-card rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  {acc.avatarUrl ? (
                    <img src={acc.avatarUrl} alt="" className="w-8 h-8 rounded-full" />
                  ) : (
                    <span className="text-xl">{acc.avatar}</span>
                  )}
                  <div>
                    <div className="text-sm text-white font-medium">{acc.login}</div>
                    <div className="text-[10px] text-white/30">{acc.steamId || 'Не подключен'}</div>
                  </div>
                </div>

                <div className="bg-white/5 rounded-xl p-3 text-center">
                  <div className="text-3xl font-mono font-bold text-white tracking-wider mb-2">
                    {codeData?.code || '-----'}
                  </div>
                  <div className="flex items-center justify-center gap-2 text-xs text-white/30">
                    <Clock size={12} />
                    <div className="w-full max-w-[100px] h-1 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className="h-full bg-indigo-500 transition-all duration-1000"
                        style={{ width: `${((codeData?.timeLeft || 0) / 30) * 100}%` }}
                      />
                    </div>
                    <span>{codeData?.timeLeft || 0}с</span>
                  </div>
                </div>

                <button
                  onClick={() => codeData && copyCode(acc.id, codeData.code)}
                  className="w-full mt-3 flex items-center justify-center gap-2 py-2 rounded-xl bg-white/5 text-xs text-white/60 hover:bg-white/10 transition-colors"
                >
                  {copied === acc.id ? (
                    <span className="text-green-400">✓ Скопировано</span>
                  ) : (
                    <>
                      <Copy size={12} />
                      Копировать код
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
