import { useState } from 'react';
import { TrendingUp, DollarSign, Layers, Target, Play, Loader2 } from 'lucide-react';
import type { SteamAccount } from '../types';

interface LevelUpperProps {
  accounts: SteamAccount[];
}

export default function LevelUpper({ accounts }: LevelUpperProps) {
  const [selectedAccount, setSelectedAccount] = useState<string>(accounts[0]?.id || '');
  const [mode, setMode] = useState<'level' | 'balance' | 'sets'>('level');
  const [targetLevel, setTargetLevel] = useState(20);
  const [targetBalance, setTargetBalance] = useState(100);
  const [targetSets, setTargetSets] = useState(10);
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [log, setLog] = useState<string[]>([]);

  const acc = accounts.find(a => a.id === selectedAccount);

  const cheapestGames = [
    { name: 'Sam & Dan: Floaty Flatmates', setPrice: 0.42, setsNeeded: 5 },
    { name: 'Particula', setPrice: 0.51, setsNeeded: 5 },
    { name: 'Absconding Zatwor', setPrice: 0.55, setsNeeded: 5 },
    { name: 'Why So Evil', setPrice: 0.58, setsNeeded: 5 },
    { name: 'Uriel\'s Chasm', setPrice: 0.62, setsNeeded: 5 },
    { name: 'Realms of the Haunting', setPrice: 0.64, setsNeeded: 4 },
    { name: 'Commander: Conquest', setPrice: 0.67, setsNeeded: 5 },
    { name: 'Dead Bits', setPrice: 0.71, setsNeeded: 5 },
  ];

  const estimatePrice = () => {
    if (!acc) return 0;
    let totalSets = 0;
    if (mode === 'level') {
      for (let l = acc.level; l < targetLevel; l++) {
        totalSets += Math.ceil((l + 1) / 10);
      }
    } else if (mode === 'sets') {
      totalSets = targetSets;
    } else {
      totalSets = Math.floor(targetBalance / cheapestGames[0].setPrice);
    }
    return totalSets * cheapestGames[0].setPrice;
  };

  const startLevelUp = () => {
    setIsRunning(true);
    setProgress(0);
    setLog(['🚀 Запуск Level Upper...', `📊 Аккаунт: ${acc?.login}`, `📈 Текущий уровень: ${acc?.level}`]);

    const steps = [
      '🔍 Поиск самых дешевых сетов на маркете...',
      `💰 Самый дешевый сет: ${cheapestGames[0].name} (₽${cheapestGames[0].setPrice})`,
      '🛒 Покупка карточек на торговой площадке...',
      '📦 Карточки куплены, начинаем крафт...',
      '🎴 Крафтим значок #1...',
      '✅ Значок скрафчен! +100 XP',
      '🎴 Крафтим значок #2...',
      '✅ Значок скрафчен! +100 XP',
      '🎴 Крафтим значок #3...',
      '✅ Значок скрафчен! +100 XP',
      `🎉 Уровень повышен! ${acc?.level} → ${(acc?.level || 0) + 1}`,
    ];

    steps.forEach((step, i) => {
      setTimeout(() => {
        setLog(prev => [...prev, step]);
        setProgress(Math.round(((i + 1) / steps.length) * 100));
        if (i === steps.length - 1) {
          setIsRunning(false);
        }
      }, (i + 1) * 800);
    });
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <TrendingUp size={24} /> Level Upper
          <span className="text-xs bg-neon-purple/20 text-neon-purple px-2 py-0.5 rounded-full">Market</span>
        </h1>
        <p className="text-sm text-steam-text mt-1">Автоматическое повышение уровня через покупку и крафт карточек</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Configuration */}
        <div className="space-y-4">
          <div className="bg-steam-card rounded-xl neon-border p-4 space-y-4">
            <h3 className="text-sm font-semibold text-white">⚙️ Настройки</h3>

            {/* Account */}
            <div>
              <label className="text-xs text-steam-text block mb-1">Аккаунт</label>
              <select
                value={selectedAccount}
                onChange={e => setSelectedAccount(e.target.value)}
                className="w-full bg-steam-input text-sm text-white px-3 py-2 rounded-lg border border-steam-border outline-none"
              >
                {accounts.map(a => (
                  <option key={a.id} value={a.id}>{a.login} (Lvl {a.level}, ₽{a.balance.toFixed(2)})</option>
                ))}
              </select>
            </div>

            {/* Mode */}
            <div>
              <label className="text-xs text-steam-text block mb-2">Режим</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { m: 'level' as const, icon: <Target size={16} />, label: 'По уровню' },
                  { m: 'balance' as const, icon: <DollarSign size={16} />, label: 'По балансу' },
                  { m: 'sets' as const, icon: <Layers size={16} />, label: 'По сетам' },
                ].map(({ m, icon, label }) => (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    className={`flex flex-col items-center gap-1 p-3 rounded-lg border transition-all ${
                      mode === m
                        ? 'border-neon-blue bg-neon-blue/10 text-neon-blue'
                        : 'border-steam-border bg-steam-dark text-steam-text hover:text-white'
                    }`}
                  >
                    {icon}
                    <span className="text-[10px]">{label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Target */}
            <div>
              {mode === 'level' && (
                <div>
                  <label className="text-xs text-steam-text block mb-1">Целевой уровень</label>
                  <input
                    type="number"
                    value={targetLevel}
                    onChange={e => setTargetLevel(Number(e.target.value))}
                    min={(acc?.level || 0) + 1}
                    className="w-full bg-steam-input text-sm text-white px-3 py-2 rounded-lg border border-steam-border outline-none"
                  />
                  <div className="text-[10px] text-steam-text mt-1">{acc?.level} → {targetLevel} (+{targetLevel - (acc?.level || 0)} уровней)</div>
                </div>
              )}
              {mode === 'balance' && (
                <div>
                  <label className="text-xs text-steam-text block mb-1">Потратить (₽)</label>
                  <input
                    type="number"
                    value={targetBalance}
                    onChange={e => setTargetBalance(Number(e.target.value))}
                    className="w-full bg-steam-input text-sm text-white px-3 py-2 rounded-lg border border-steam-border outline-none"
                  />
                  <div className="text-[10px] text-steam-text mt-1">Баланс: ₽{acc?.balance.toFixed(2)}</div>
                </div>
              )}
              {mode === 'sets' && (
                <div>
                  <label className="text-xs text-steam-text block mb-1">Количество сетов</label>
                  <input
                    type="number"
                    value={targetSets}
                    onChange={e => setTargetSets(Number(e.target.value))}
                    className="w-full bg-steam-input text-sm text-white px-3 py-2 rounded-lg border border-steam-border outline-none"
                  />
                </div>
              )}
            </div>

            {/* Estimate */}
            <div className="bg-steam-dark/50 rounded-lg p-3 space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-steam-text">Примерная стоимость:</span>
                <span className="text-neon-green font-medium">₽{estimatePrice().toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-steam-text">Самый дешевый сет:</span>
                <span className="text-white">{cheapestGames[0].name}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-steam-text">Цена сета:</span>
                <span className="text-neon-green">₽{cheapestGames[0].setPrice}</span>
              </div>
            </div>

            <button
              onClick={startLevelUp}
              disabled={isRunning}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-gradient-to-r from-neon-blue to-neon-purple text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {isRunning ? (
                <><Loader2 size={18} className="animate-spin" /> Выполняется...</>
              ) : (
                <><Play size={18} /> Запустить Level Upper</>
              )}
            </button>
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-4">
          {/* Progress */}
          {(isRunning || progress > 0) && (
            <div className="bg-steam-card rounded-xl neon-border p-4 animate-fade-in">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-white">📊 Прогресс</h3>
                <span className="text-xs text-neon-blue">{progress}%</span>
              </div>
              <div className="w-full bg-steam-dark rounded-full h-2 mb-3">
                <div
                  className="bg-gradient-to-r from-neon-blue to-neon-purple h-2 rounded-full transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="bg-steam-dark/50 rounded-lg p-3 max-h-52 overflow-y-auto font-mono text-[11px] space-y-1">
                {log.map((l, i) => (
                  <div key={i} className="text-steam-light">{l}</div>
                ))}
              </div>
            </div>
          )}

          {/* Cheapest games table */}
          <div className="bg-steam-card rounded-xl neon-border p-4">
            <h3 className="text-sm font-semibold text-white mb-3">💎 Самые дешевые сеты на маркете</h3>
            <div className="space-y-1">
              {cheapestGames.map((g, i) => (
                <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-steam-dark/50 hover:bg-steam-dark transition-colors">
                  <span className="text-xs text-steam-text w-5 text-center">#{i + 1}</span>
                  <span className="text-xs text-white flex-1">{g.name}</span>
                  <span className="text-[10px] text-steam-text">{g.setsNeeded} карт</span>
                  <span className="text-xs text-neon-green font-medium">₽{g.setPrice}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
