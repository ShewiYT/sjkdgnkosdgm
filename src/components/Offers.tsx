import { useState } from 'react';
import { CheckCircle, XCircle, Clock, ArrowRight, Filter, Send } from 'lucide-react';
import type { TradeOffer, SteamAccount } from '../types';

interface OffersProps {
  offers: TradeOffer[];
  accounts: SteamAccount[];
}

export default function Offers({ offers, accounts }: OffersProps) {
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterAccount, setFilterAccount] = useState<string>('all');

  const filtered = offers.filter(o => {
    if (filterStatus !== 'all' && o.status !== filterStatus) return false;
    if (filterAccount !== 'all' && o.accountId !== filterAccount) return false;
    return true;
  });

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return `${d.getDate().toString().padStart(2, '0')}.${(d.getMonth()+1).toString().padStart(2, '0')} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  return (
    <div className="p-6 space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Трейд Офферы</h1>
          <p className="text-sm text-white/50 mt-1">Управление трейдами</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 glass-accent rounded-xl text-white text-sm">
          <Send size={16} />
          Новый оффер
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 glass-card rounded-xl p-3">
        <Filter size={16} className="text-white/50" />
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="glass-input text-sm text-white px-3 py-1.5 rounded-lg outline-none"
        >
          <option value="all" className="bg-neutral-800">Все статусы</option>
          <option value="pending" className="bg-neutral-800">Ожидающие</option>
          <option value="accepted" className="bg-neutral-800">Принятые</option>
          <option value="declined" className="bg-neutral-800">Отклоненные</option>
        </select>
        <select
          value={filterAccount}
          onChange={e => setFilterAccount(e.target.value)}
          className="glass-input text-sm text-white px-3 py-1.5 rounded-lg outline-none"
        >
          <option value="all" className="bg-neutral-800">Все аккаунты</option>
          {accounts.map(a => (
            <option key={a.id} value={a.id} className="bg-neutral-800">{a.login}</option>
          ))}
        </select>
        <span className="text-xs text-white/40 ml-auto">{filtered.length} офферов</span>
      </div>

      {/* Offers list */}
      {filtered.length === 0 ? (
        <div className="glass-card rounded-2xl p-8 text-center">
          <Clock size={40} className="mx-auto mb-3 text-white/20" />
          <div className="text-sm text-white/60">Нет офферов</div>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(offer => {
            const acc = accounts.find(a => a.id === offer.accountId);
            return (
              <div key={offer.id} className="glass-card rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{offer.partnerAvatar}</span>
                    <div>
                      <div className="text-sm text-white font-medium">{offer.partnerName}</div>
                      <div className="text-[10px] text-white/40">
                        {acc && <span>через {acc.login} • </span>}
                        {formatTime(offer.timestamp)}
                      </div>
                    </div>
                  </div>
                  <span className={`text-xs px-3 py-1 rounded-full font-medium ${
                    offer.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                    offer.status === 'accepted' ? 'bg-green-500/20 text-green-400' :
                    'bg-red-500/20 text-red-400'
                  }`}>
                    {offer.status === 'pending' ? '⏳ Ожидает' :
                     offer.status === 'accepted' ? '✅ Принят' : '❌ Отклонен'}
                  </span>
                </div>

                <div className="flex items-center gap-4">
                  {/* Items Give */}
                  <div className="flex-1 glass-light rounded-xl p-3">
                    <div className="text-[10px] text-red-400 mb-2 font-medium">📤 Отдаём ({offer.itemsGive.length})</div>
                    <div className="flex flex-wrap gap-2">
                      {offer.itemsGive.map(item => (
                        <div key={item.id} className="glass rounded-lg px-2 py-1 text-[10px]">
                          <span className="mr-1">{item.icon}</span>
                          <span className="text-white">{item.name}</span>
                          <span className="text-green-400 ml-1">₽{item.price.toFixed(0)}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <ArrowRight size={20} className="text-white/30 shrink-0" />

                  {/* Items Receive */}
                  <div className="flex-1 glass-light rounded-xl p-3">
                    <div className="text-[10px] text-green-400 mb-2 font-medium">📥 Получаем ({offer.itemsReceive.length})</div>
                    <div className="flex flex-wrap gap-2">
                      {offer.itemsReceive.map(item => (
                        <div key={item.id} className="glass rounded-lg px-2 py-1 text-[10px]">
                          <span className="mr-1">{item.icon}</span>
                          <span className="text-white">{item.name}</span>
                          <span className="text-green-400 ml-1">₽{item.price.toFixed(0)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {offer.status === 'pending' && (
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/5">
                    <button className="flex items-center gap-1 px-3 py-1.5 bg-green-500/20 text-green-400 rounded-lg text-xs">
                      <CheckCircle size={14} /> Принять
                    </button>
                    <button className="flex items-center gap-1 px-3 py-1.5 bg-red-500/20 text-red-400 rounded-lg text-xs">
                      <XCircle size={14} /> Отклонить
                    </button>
                    <button className="flex items-center gap-1 px-3 py-1.5 glass-accent text-white rounded-lg text-xs ml-auto">
                      <Clock size={14} /> SDA
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
