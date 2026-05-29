import { ArrowRightLeft, Check, X, Clock } from 'lucide-react';
import type { SteamAccount, TradeOffer } from '../types';

interface OffersProps {
  accounts: SteamAccount[];
  offers: TradeOffer[];
}

export default function Offers({ accounts, offers }: OffersProps) {
  return (
    <div className="p-6 space-y-6 animate-fade-in overflow-y-auto max-h-[calc(100vh-52px)]">
      <div>
        <h1 className="text-2xl font-semibold text-white flex items-center gap-2">
          <ArrowRightLeft size={24} />
          Трейд Офферы
        </h1>
        <p className="text-sm text-white/40 mt-1">Управление входящими и исходящими трейдами</p>
      </div>

      {offers.length === 0 ? (
        <div className="glass-card rounded-2xl p-12 text-center">
          <ArrowRightLeft size={48} className="mx-auto mb-4 text-white/10" />
          <div className="text-lg text-white/30">Нет активных офферов</div>
          <div className="text-sm text-white/20 mt-1">Офферы появятся когда аккаунты будут онлайн</div>
        </div>
      ) : (
        <div className="space-y-3">
          {offers.map(offer => {
            const acc = accounts.find(a => a.id === offer.accountId);
            return (
              <div key={offer.id} className="glass-card rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{offer.partnerAvatar}</span>
                    <div>
                      <div className="text-sm text-white font-medium">{offer.partnerName}</div>
                      <div className="text-[10px] text-white/30">
                        {acc ? `через ${acc.login}` : ''} • {new Date(offer.timestamp).toLocaleString('ru')}
                      </div>
                    </div>
                  </div>
                  <span className={`text-xs px-3 py-1 rounded-full ${
                    offer.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                    offer.status === 'accepted' ? 'bg-green-500/20 text-green-400' :
                    'bg-red-500/20 text-red-400'
                  }`}>
                    <span className="flex items-center gap-1">
                      {offer.status === 'pending' ? <Clock size={10} /> : offer.status === 'accepted' ? <Check size={10} /> : <X size={10} />}
                      {offer.status === 'pending' ? 'Ожидает' : offer.status === 'accepted' ? 'Принят' : 'Отклонен'}
                    </span>
                  </span>
                </div>

                {offer.status === 'pending' && (
                  <div className="flex gap-2 mt-3 pt-3 border-t border-white/5">
                    <button className="flex items-center gap-1 px-4 py-2 rounded-xl bg-green-500/20 text-green-400 text-xs hover:bg-green-500/30"><Check size={12} /> Принять</button>
                    <button className="flex items-center gap-1 px-4 py-2 rounded-xl bg-red-500/20 text-red-400 text-xs hover:bg-red-500/30"><X size={12} /> Отклонить</button>
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
