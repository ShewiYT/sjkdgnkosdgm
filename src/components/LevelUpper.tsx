import { useState } from 'react';
import { TrendingUp, Play, Loader2, DollarSign, Package, Star } from 'lucide-react';
import type { SteamAccount } from '../types';

interface LevelUpperProps {
  accounts: SteamAccount[];
}

const cheapestGames = [
  { name: 'Payday 2', setPrice: 2.5, icon: '🎭' },
  { name: 'Counter-Strike 2', setPrice: 3.0, icon: '🔫' },
  { name: 'Steam Awards', setPrice: 1.5, icon: '⭐' },
  { name: 'Dota 2', setPrice: 2.0, icon: '⚔️' },
  { name: 'Team Fortress 2', setPrice: 1.8, icon: '🎮' },
];

export default function LevelUpper({ accounts }: LevelUpperProps) {
  const [selectedAccount, setSelectedAccount] = useState(accounts[0]?.id || '');
  const [mode, setMode] = useState<'level' | 'balance' | 'sets'>('level');
  const [targetLevel, setTargetLevel] = useState(50);
  const [targetBalance, setTargetBalance] = useState(100);
  const [targetSets, setTargetSets] = useState(10);
  const [isRunning, setIsRunning] = useState(false);

  const acc = accounts.find(a => a.id === selectedAccount);

  const estimatePrice = () => {
    const cheapest = cheapestGames[0].setPrice;
    if (mode === 'level') {
      const levelsNeeded = targetLevel - (acc?.level || 0);
      const setsNeeded = Math.ceil(levelsNeeded * 1.5);
      return setsNeeded * cheapest;
    }
    if (mode === 'balance') return targetBalance;
    return targetSets * cheapest;
  };

  const handleStart = async () => {
    if (!acc) return;
    setIsRunning(true);
    // Call server API
    try {
      await fetch('/api/steam/level-up', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId: acc.id, mode, targetLevel, targetBalance, targetSets }),
      });
    } catch {}
    setTimeout(() => setIsRunning(false), 3000);
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in overflow-y-auto max-h-[calc(100vh-52px)]">
      <div>
        <h1 className="text-2xl font-semibold text-white flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl glass-accent flex items-center justify-center">
            <TrendingUp size={20} />
          </div>
          Level Upper
        </h1>
        <p className="text-sm text-white/50 mt-1">Прокачка уровня Steam через покупку наборов карточек</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cheapest sets */}
        <div className="glass-card rounded-2xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-white">💰 Дешевые наборы карточек</h3>
          <div className="space-y-2">
            {cheapestGames.map((game, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-xl glass-light">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{game.icon}</span>
                  <span className="text-sm text-white">{game.name}</span>
                </div>
                <span className="text-sm text-green-400">₽{game.setPrice.toFixed(2)} / сет</span>
              </div>
            ))}
          </div>
        </div>

        {/* Settings */}
        <div className="glass-card rounded-2xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-white">⚙️ Настройки</h3>

          <div>
            <label className="text-xs text-white/50 block mb-2">Аккаунт</label>
            <select
              value={selectedAccount}
              onChange={e => setSelectedAccount(e.target.value)}
              className="w-full glass-input text-sm text-white px-3 py-2 rounded-xl outline-none"
            >
              {accounts.map(a => (
                <option key={a.id} value={a.id} className="bg-neutral-800">
                  {a.avatar} {a.login} (Lvl {a.level})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-white/50 block mb-2">Режим</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { m: 'level' as const, icon: <Star size={14} />, label: 'По уровню' },
                { m: 'balance' as const, icon: <DollarSign size={14} />, label: 'По балансу' },
                { m: 'sets' as const, icon: <Package size={14} />, label: 'По сетам' },
              ].map(({ m, icon, label }) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`flex items-center justify-center gap-1 px-2 py-2 rounded-xl text-xs ${
                    mode === m ? 'glass-accent text-white' : 'glass-button text-white/50'
                  }`}
                >
                  {icon} {label}
                </button>
              ))}
            </div>
          </div>

          {mode === 'level' && (
            <div>
              <label className="text-xs text-white/50 block mb-1">Целевой уровень</label>
              <input
                type="number"
                value={targetLevel}
                onChange={e => setTargetLevel(Number(e.target.value))}
                min={(acc?.level || 0) + 1}
                className="w-full glass-input text-sm text-white px-3 py-2 rounded-xl outline-none"
              />
              <div className="text-[10px] text-white/30 mt-1">
                {acc?.level} → {targetLevel} (+{targetLevel - (acc?.level || 0)} уровней)
              </div>
            </div>
          )}
          {mode === 'balance' && (
            <div>
              <label className="text-xs text-white/50 block mb-1">Потратить (₽)</label>
              <input
                type="number"
                value={targetBalance}
                onChange={e => setTargetBalance(Number(e.target.value))}
                className="w-full glass-input text-sm text-white px-3 py-2 rounded-xl outline-none"
              />
              <div className="text-[10px] text-white/30 mt-1">Баланс: ₽{acc?.balance.toFixed(2)}</div>
            </div>
          )}
          {mode === 'sets' && (
            <div>
              <label className="text-xs text-white/50 block mb-1">Количество сетов</label>
              <input
                type="number"
                value={targetSets}
                onChange={e => setTargetSets(Number(e.target.value))}
                className="w-full glass-input text-sm text-white px-3 py-2 rounded-xl outline-none"
              />
            </div>
          )}

          <div className="glass-light rounded-xl p-3 text-xs text-white/50 space-y-1">
            <div className="flex justify-between">
              <span>Примерная стоимость:</span>
              <span className="text-green-400">₽{estimatePrice().toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Самый дешевый сет:</span>
              <span className="text-white">{cheapestGames[0].name}</span>
            </div>
            <div className="flex justify-between">
              <span>Цена сета:</span>
              <span className="text-white">₽{cheapestGames[0].setPrice}</span>
            </div>
          </div>

          <button
            onClick={handleStart}
            disabled={isRunning || !acc}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl glass-accent text-white disabled:opacity-40"
          >
            {isRunning ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Прокачка...
              </>
            ) : (
              <>
                <Play size={16} />
                Начать прокачку
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
