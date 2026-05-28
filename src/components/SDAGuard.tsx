import { useState, useEffect } from 'react';
import { Smartphone, Copy, RefreshCw, Shield, CheckCircle, Clock } from 'lucide-react';
import type { SteamAccount } from '../types';

interface SDAGuardProps {
  accounts: SteamAccount[];
}

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 5; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export default function SDAGuard({ accounts }: SDAGuardProps) {
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [timeLeft, setTimeLeft] = useState(30);
  const [copiedId, setCopiedId] = useState<string | null>(null);

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
    <div className="p-6 space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Smartphone size={24} /> SDA / Guard
        </h1>
        <p className="text-sm text-steam-text mt-1">Steam Desktop Authenticator — Коды и подтверждения</p>
      </div>

      {/* Timer */}
      <div className="bg-steam-card rounded-xl neon-border p-4 flex items-center gap-4">
        <div className="relative w-16 h-16">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
            <path
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              fill="none"
              stroke="#2a475e"
              strokeWidth="2"
            />
            <path
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              fill="none"
              stroke="#1a9fff"
              strokeWidth="2"
              strokeDasharray={`${(timeLeft / 30) * 100}, 100`}
              className="transition-all duration-1000"
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-lg font-bold text-white">{timeLeft}</span>
        </div>
        <div>
          <div className="text-sm text-white">Обновление через {timeLeft} сек</div>
          <div className="text-xs text-steam-text">Коды обновляются каждые 30 секунд</div>
        </div>
        <button
          onClick={() => {
            const newCodes: Record<string, string> = {};
            accounts.forEach(a => { newCodes[a.id] = generateCode(); });
            setCodes(newCodes);
            setTimeLeft(30);
          }}
          className="ml-auto p-2 rounded-lg bg-steam-dark text-steam-text hover:text-white transition-colors"
        >
          <RefreshCw size={18} />
        </button>
      </div>

      {/* Guard Codes */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {accounts.map(acc => (
          <div key={acc.id} className="bg-steam-card rounded-xl neon-border p-4 hover:bg-steam-hover/30 transition-colors">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xl">{acc.avatar}</span>
              <div className="flex-1">
                <div className="text-xs text-white font-medium">{acc.login}</div>
                <div className="text-[10px] text-steam-text">{acc.server}</div>
              </div>
              {acc.guardEnabled ? (
                <Shield size={14} className="text-neon-green" />
              ) : (
                <Shield size={14} className="text-neon-red" />
              )}
            </div>

            {acc.guardEnabled ? (
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-steam-dark rounded-lg px-3 py-2 text-center">
                  <span className="text-xl font-mono font-bold tracking-[0.3em] text-neon-blue">
                    {codes[acc.id] || '-----'}
                  </span>
                </div>
                <button
                  onClick={() => copyCode(acc.id)}
                  className={`p-2 rounded-lg transition-colors ${
                    copiedId === acc.id ? 'bg-neon-green/20 text-neon-green' : 'bg-steam-dark text-steam-text hover:text-white'
                  }`}
                >
                  {copiedId === acc.id ? <CheckCircle size={16} /> : <Copy size={16} />}
                </button>
              </div>
            ) : (
              <div className="text-xs text-neon-red text-center py-2 bg-neon-red/5 rounded-lg">
                Guard не подключен
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Pending Confirmations */}
      <div className="bg-steam-card rounded-xl neon-border overflow-hidden">
        <div className="px-4 py-3 border-b border-steam-border flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Clock size={16} /> Ожидающие подтверждения
          </h3>
          <span className="text-xs bg-neon-yellow/20 text-neon-yellow px-2 py-0.5 rounded-full">
            {pendingConfirmations.length}
          </span>
        </div>
        <div className="divide-y divide-steam-border/50">
          {pendingConfirmations.map(c => (
            <div key={c.id} className="px-4 py-3 flex items-center gap-4 hover:bg-steam-hover/20 transition-colors">
              <div className="flex-1">
                <div className="text-xs text-white">{c.type}: {c.partner}</div>
                <div className="text-[10px] text-steam-text">{c.account} • {c.time}</div>
              </div>
              <button className="px-3 py-1 bg-neon-green/20 text-neon-green rounded text-xs hover:bg-neon-green/30 transition-colors">
                ✅ Принять
              </button>
              <button className="px-3 py-1 bg-neon-red/20 text-neon-red rounded text-xs hover:bg-neon-red/30 transition-colors">
                ❌ Отклонить
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
