import { useState } from 'react';
import { UserCog, Save, Trash2 } from 'lucide-react';
import { useAppStore } from '../store';
import { steamApi } from '../api';
import type { SteamAccount } from '../types';

interface AccountManagerProps {
  accounts: SteamAccount[];
  selectedAccount: SteamAccount | null;
}

export default function AccountManager({ accounts, selectedAccount }: AccountManagerProps) {
  const { updateAccount, removeAccount } = useAppStore();
  const [newName, setNewName] = useState('');
  const [newCountry, setNewCountry] = useState('');
  const [newBio, setNewBio] = useState('');
  const [newAvatarUrl, setNewAvatarUrl] = useState('');
  const [applyName, setApplyName] = useState(false);
  const [applyCountry, setApplyCountry] = useState(false);
  const [applyBio, setApplyBio] = useState(false);
  const [applyAvatar, setApplyAvatar] = useState(false);
  const [applying, setApplying] = useState(false);

  const targetAccounts = selectedAccount ? [selectedAccount] : accounts.filter(a => a.status === 'online' || a.status === 'in-game');

  const handleApply = async () => {
    if (targetAccounts.length === 0) return;
    setApplying(true);
    for (const acc of targetAccounts) {
      const data: Record<string, string> = {};
      if (applyName && newName) data.name = newName;
      if (applyCountry && newCountry) data.country = newCountry;
      if (applyBio && newBio) data.bio = newBio;
      if (applyAvatar && newAvatarUrl) data.avatarUrl = newAvatarUrl;
      if (Object.keys(data).length > 0) {
        await steamApi.updateProfile(acc.id, data);
        updateAccount(acc.id, {
          customName: data.name || acc.customName,
          customCountry: data.country || acc.customCountry,
          customBio: data.bio || acc.customBio,
          customAvatarUrl: data.avatarUrl || acc.customAvatarUrl,
        });
      }
    }
    setApplying(false);
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in overflow-y-auto max-h-[calc(100vh-52px)]">
      <div>
        <h1 className="text-2xl font-semibold text-white flex items-center gap-2"><UserCog size={24} /> Менеджер аккаунтов</h1>
        <p className="text-sm text-white/40 mt-1">Массовое изменение профилей</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl">
        <div className="glass-card rounded-2xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-white">Изменить профиль</h3>
          <p className="text-xs text-white/30">Применить к: {selectedAccount ? selectedAccount.login : `${targetAccounts.length} онлайн аккаунтам`}</p>

          {[
            { checked: applyName, setChecked: setApplyName, label: 'Имя профиля', value: newName, setValue: setNewName, placeholder: 'Новое имя' },
            { checked: applyAvatar, setChecked: setApplyAvatar, label: 'Аватарка (URL)', value: newAvatarUrl, setValue: setNewAvatarUrl, placeholder: 'https://...' },
            { checked: applyCountry, setChecked: setApplyCountry, label: 'Страна', value: newCountry, setValue: setNewCountry, placeholder: 'RU, US, DE...' },
          ].map(item => (
            <div key={item.label}>
              <label className="flex items-center gap-2 mb-1">
                <input type="checkbox" checked={item.checked} onChange={e => item.setChecked(e.target.checked)} className="w-4 h-4 rounded" />
                <span className="text-xs text-white/50">{item.label}</span>
              </label>
              <input value={item.value} onChange={e => item.setValue(e.target.value)} disabled={!item.checked || applying}
                placeholder={item.placeholder} className="w-full glass-input text-sm text-white px-3 py-2 rounded-xl outline-none disabled:opacity-30" />
            </div>
          ))}

          <div>
            <label className="flex items-center gap-2 mb-1">
              <input type="checkbox" checked={applyBio} onChange={e => setApplyBio(e.target.checked)} className="w-4 h-4 rounded" />
              <span className="text-xs text-white/50">Описание</span>
            </label>
            <textarea value={newBio} onChange={e => setNewBio(e.target.value)} disabled={!applyBio || applying}
              placeholder="Описание профиля..." className="w-full glass-input text-sm text-white px-3 py-2 rounded-xl outline-none h-20 resize-none disabled:opacity-30" />
          </div>

          <button onClick={handleApply} disabled={applying || targetAccounts.length === 0}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-500/20 text-indigo-400 text-sm hover:bg-indigo-500/30 disabled:opacity-30">
            <Save size={16} /> {applying ? 'Применяем...' : 'Применить'}
          </button>
        </div>

        <div className="glass-card rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-white/5"><h3 className="text-sm font-semibold text-white">Аккаунты ({accounts.length})</h3></div>
          <div className="max-h-[500px] overflow-y-auto divide-y divide-white/5">
            {accounts.map(acc => (
              <div key={acc.id} className="px-4 py-3 flex items-center gap-3">
                {acc.avatarUrl ? <img src={acc.avatarUrl} alt="" className="w-8 h-8 rounded-full" /> : <span className="text-lg">{acc.avatar}</span>}
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-white truncate">{acc.displayName}</div>
                  <div className="text-[10px] text-white/30">{acc.login} • Lvl {acc.level}</div>
                </div>
                <span className={`w-2 h-2 rounded-full ${acc.status === 'online' ? 'bg-green-400' : acc.status === 'error' ? 'bg-red-400' : 'bg-gray-500'}`} />
                <button onClick={() => removeAccount(acc.id)} className="p-1 rounded text-red-400/30 hover:text-red-400"><Trash2 size={12} /></button>
              </div>
            ))}
            {accounts.length === 0 && <div className="p-8 text-center text-xs text-white/30">Нет аккаунтов</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
