import { useState } from 'react';
import { Gamepad2, Square, Server } from 'lucide-react';
import type { SteamAccount } from '../types';

interface InGameProps {
  accounts: SteamAccount[];
}

const gamesList = [
  { id: '730', name: 'Counter-Strike 2', icon: '🔫' },
  { id: '570', name: 'Dota 2', icon: '⚔️' },
  { id: '578080', name: 'PUBG: BATTLEGROUNDS', icon: '🎯' },
  { id: '252490', name: 'Rust', icon: '🏗️' },
  { id: '440', name: 'Team Fortress 2', icon: '🎮' },
  { id: '295110', name: 'Just Survive', icon: '🧟' },
  { id: '304930', name: 'Unturned', icon: '🧱' },
  { id: '1172470', name: 'Apex Legends', icon: '🦊' },
  { id: '271590', name: 'GTA V', icon: '🚗' },
  { id: '1599340', name: 'Lost Ark', icon: '⚡' },
];

export default function InGame({ accounts }: InGameProps) {
  const [activeGames, setActiveGames] = useState<Record<string, string>>({});

  const toggleGame = (accId: string, gameId: string) => {
    setActiveGames(prev => {
      if (prev[accId] === gameId) {
        const n = { ...prev };
        delete n[accId];
        return n;
      }
      return { ...prev, [accId]: gameId };
    });
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Gamepad2 size={24} /> In-Game Mode
        </h1>
        <p className="text-sm text-steam-text mt-1">Установка статуса "в игре" для аккаунтов</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {accounts.map(acc => (
          <div key={acc.id} className="bg-steam-card rounded-xl neon-border p-4">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-2xl">{acc.avatar}</span>
              <div className="flex-1">
                <div className="text-sm font-semibold text-white">{acc.login}</div>
                <div className="text-[10px] text-steam-text flex items-center gap-1">
                  <Server size={10} /> {acc.server} • Lvl {acc.level}
                </div>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full ${
                activeGames[acc.id]
                  ? 'bg-[#90ba3c]/20 text-[#90ba3c]'
                  : 'bg-gray-500/20 text-gray-400'
              }`}>
                {activeGames[acc.id] 
                  ? `🎮 ${gamesList.find(g => g.id === activeGames[acc.id])?.name || 'В игре'}`
                  : 'Не в игре'
                }
              </span>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              {gamesList.map(game => (
                <button
                  key={game.id}
                  onClick={() => toggleGame(acc.id, game.id)}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-all ${
                    activeGames[acc.id] === game.id
                      ? 'bg-[#90ba3c]/20 text-[#90ba3c] border border-[#90ba3c]/30'
                      : 'bg-steam-dark text-steam-text hover:text-white hover:bg-steam-hover'
                  }`}
                >
                  <span>{game.icon}</span>
                  <span className="truncate">{game.name}</span>
                  {activeGames[acc.id] === game.id && <Square size={10} className="ml-auto shrink-0" />}
                </button>
              ))}
            </div>

            {activeGames[acc.id] && (
              <button
                onClick={() => {
                  const n = { ...activeGames };
                  delete n[acc.id];
                  setActiveGames(n);
                }}
                className="w-full mt-3 flex items-center justify-center gap-2 py-2 bg-neon-red/20 text-neon-red rounded-lg hover:bg-neon-red/30 transition-colors text-xs"
              >
                <Square size={14} /> Остановить
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
