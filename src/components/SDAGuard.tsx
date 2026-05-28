import { useState, useEffect } from 'react';
import { ShieldCheck, Copy, CheckCircle, Clock, Shield } from 'lucide-react';
import type { SteamAccount } from '../types';

interface SDAGuardProps {
  accounts: SteamAccount[];
}

export default function SDAGuard({ accounts }: SDAGuardProps) {
  const [timeLeft, setTimeLeft] = useState(30);
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const generateCode = () => {
    const chars = '23456789BCDFGHJKMNPQRTVWXY';
    let code = '';
    for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
  };

  useEffect(() => {
    const newCodes: Record<string, string> = {};
    accounts.forEach(a => { newCodes[a.id] = generateCode(); });
    setCodes(newCodes);
  }, [accounts]);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          const newCodes: Record<string, string> = {};
          accounts.forEach(a => { newCodes[a.id] = generateCode(); });
          setCodes(newCodes);
          return 30;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [accounts]);

  const copyCode = (accId: string) => {
    const code = codes[accId];
    if (code) {
      navigator.clipboard.writeText(code).catch(() => {});
      setCopiedId(accId);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const pendingConfirmations = [
    { id: 'c1', type: 'Trade Offer', partner: 'xXDarkLordXx', account: accounts[0]?.login, time: '2 мин назад' },
    { id: 'c2', type: 'Market Listing', partner: 'AK-47 | Redline', account: accounts[1]?.login, time: '5 мин назад' },
    { id: 'c3', type: 'Trade Offer', partner: 'ProGamer2024', account: accounts[0]?.login, time: '12 мин назад' },
  ];

  return (
    <div className="p-6 space-y-6 animate-fade-in overflow-y-auto max-h-[calc(100vh-52px)]">
      <div>
        <h1 className="text-2xl font-semibold text-white flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl glass-accent flex items-center justify-center">
            <ShieldCheck size={20} />
          </div>
          SDA / Guard
        </h1>
        <p className="text-sm text-white/50 mt-1">Steam Desktop Authenticator — Коды и подтверждения</p>
      </div>

      {/* Timer */}
      <div className="glass-card rounded-2xl p-4 flex items-center gap-4">
        <div className="relative w-14 h-14">
          <svg className="w-14 h-14 -rotate-90" viewBox="0 0 56 56">
            <circle cx="28" cy="28" r="24" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="4" />
            <circle cx="28" cy="28" r="24" fill="none" stroke="#0a84ff"
              strokeWidth="4" strokeLinecap="round"
              strokeDasharray={`${(timeLeft / 30) * 150.8} 150.8`} />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-white">
            {timeLeft}
          </span>
        </div>
        <div>
          <div className="text-sm text-white">Обновление через {timeLeft} сек</div>
          <div className="text-xs text-white/40">Коды обновляются каждые 30 секунд</div>
        </div>
      </div>

      {/* Guard Codes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {accounts.map(acc => (
          <div key={acc.id} className="glass-card rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">{acc.avatar}</span>
                <div>
                  <div className="text-sm font-medium text-white">{acc.login}</div>
                  <div className="text-[10px] text-white/40">{acc.server}</div>
                </div>
              </div>
              {acc.guardEnabled ? (
                <Shield size={16} className="text-green-400" />
              ) : (
                <Shield size={16} className="text-red-400/50" />
              )}
            </div>

            {acc.guardEnabled ? (
              <div className="flex items-center gap-3">
                <div className="flex-1 text-center py-3 rounded-xl glass-light">
                  <span className="text-2xl font-mono font-bold tracking-[0.3em] text-white">
                    {codes[acc.id] || '-----'}
                  </span>
                </div>
                <button
                  onClick={() => copyCode(acc.id)}
                  className="p-3 rounded-xl glass-button text-white/50 hover:text-white"
                >
                  {copiedId === acc.id ? <CheckCircle size={16} className="text-green-400" /> : <Copy size={16} />}
                </button>
              </div>
            ) : (
              <div className="text-center py-3 text-xs text-white/30">
                Guard не подключен
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Pending Confirmations */}
      <div className="glass-card rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Clock size={16} /> Ожидающие подтверждения
          </h3>
          <span className="text-xs text-white/30 px-2 py-1 rounded-full glass-light">
            {pendingConfirmations.length}
          </span>
        </div>
        <div className="space-y-2">
          {pendingConfirmations.map(c => (
            <div key={c.id} className="flex items-center justify-between p-3 rounded-xl glass-light">
              <div>
                <div className="text-xs text-white">{c.type}: {c.partner}</div>
                <div className="text-[10px] text-white/40">{c.account} • {c.time}</div>
              </div>
              <div className="flex gap-1">
                <button className="px-3 py-1 rounded-lg bg-green-500/20 text-green-400 text-[10px] hover:bg-green-500/30">
                  ✓ Подтвердить
                </button>
                <button className="px-3 py-1 rounded-lg bg-red-500/20 text-red-400 text-[10px] hover:bg-red-500/30">
                  ✗ Отклонить
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
