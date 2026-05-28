import { useState } from 'react';
import { ArrowRightLeft, Check, X } from 'lucide-react';
import type { SteamAccount, TradeOffer } from '../types';

interface OffersProps {
  accounts: SteamAccount[];
  offers: TradeOffer[];
}

export default function Offers({ accounts, offers }: OffersProps) {
  const [filter, setFilter] = useState<'all' | 'pending' | 'accepted' | 'declined'>('all');
  const [searchAccount] = useState('');

  const filtered = offers.filter(o => {
    if (filter !== 'all' && o.status !== filter) return false;
    if (searchAccount && !accounts.find(a => a.id === o.accountId && a.login.includes(searchAccount))) return false;
    return true;
  });

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString('ru', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in overflow-y-auto max-h-[calc(100vh-52px)]">
      <div>
        <h1 className="text-2xl font-semibold text-white flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl glass-accent flex items-center justify-center">
            <ArrowRightLeft size={20} />
          </div>
          Трейд Офферы
        </h1>
        <p className="text-sm text-white/50 mt-1">Управление трейдами</p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        {(['all', 'pending', 'accepted', 'declined'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-xl text-xs ${
              filter === f ? 'glass-accent text-white' : 'glass-button text-white/50'
            }`}
          >
            {f === 'all' ? 'Все' : f === 'pending' ? '⏳ Ожидает' : f === 'accepted' ? '✅ Принят' : '❌ Отклонен'}
          </button>
        ))}
        <span className="text-xs text-white/30 ml-auto">{filtered.length} офферов</span>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-white/30">
          <ArrowRightLeft size={48} className="mx-auto mb-4 opacity-30" />
          <div className="text-sm">Нет офферов</div>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(offer => {
            const acc = accounts.find(a => a.id === offer.accountId);
            return (
              <div key={offer.id} className="glass-card rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{offer.partnerAvatar}</span>
                    <div>
                      <div className="text-sm font-medium text-white">{offer.partnerName}</div>
                      <div className="text-[10px] text-white/40">
                        {acc && <span>через {acc.login} • </span>}
                        {formatTime(offer.timestamp)}
                      </div>
                    </div>
                  </div>
                  <span className={`text-xs px-3 py-1 rounded-full ${
                    offer.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                    offer.status === 'accepted' ? 'bg-green-500/20 text-green-400' :
                    'bg-red-500/20 text-red-400'
                  }`}>
                    {offer.status === 'pending' ? '⏳ Ожидает' :
                     offer.status === 'accepted' ? '✅ Принят' : '❌ Отклонен'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="glass-light rounded-xl p-3">
                    <div className="text-xs text-red-400/80 mb-2">📤 Отдаём ({offer.itemsGive.length})</div>
                    <div className="space-y-1">
                      {offer.itemsGive.map(item => (
                        <div key={item.id} className="flex items-center gap-2 text-xs">
                          <span>{item.icon}</span>
                          <span className="text-white truncate flex-1">{item.name}</span>
                          <span className="text-white/40">₽{item.price.toFixed(0)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="glass-light rounded-xl p-3">
                    <div className="text-xs text-green-400/80 mb-2">📥 Получаем ({offer.itemsReceive.length})</div>
                    <div className="space-y-1">
                      {offer.itemsReceive.map(item => (
                        <div key={item.id} className="flex items-center gap-2 text-xs">
                          <span>{item.icon}</span>
                          <span className="text-white truncate flex-1">{item.name}</span>
                          <span className="text-white/40">₽{item.price.toFixed(0)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {offer.status === 'pending' && (
                  <div className="flex gap-2">
                    <button className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl bg-green-500/20 text-green-400 hover:bg-green-500/30 text-xs">
                      <Check size={14} /> Принять
                    </button>
                    <button className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl bg-red-500/20 text-red-400 hover:bg-red-500/30 text-xs">
                      <X size={14} /> Отклонить
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
