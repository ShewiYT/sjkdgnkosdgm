import { useState } from 'react';
import { UserCog, Save, Loader2 } from 'lucide-react';
import type { SteamAccount } from '../types';
import { steamApi } from '../api';

interface AccountManagerProps { accounts: SteamAccount[]; selectedAccount: SteamAccount | null; }

export default function AccountManager({ accounts, selectedAccount }: AccountManagerProps) {
  const onlineAccounts = accounts.filter(a => a.status === 'online' || a.status === 'in-game');
  const targetAccounts = selectedAccount ? [selectedAccount].filter(a => a.status === 'online' || a.status === 'in-game') : onlineAccounts;

  const [newName, setNewName] = useState('');
  const [newAvatarUrl, setNewAvatarUrl] = useState('');
  const [newCountry, setNewCountry] = useState('');
  const [newBio, setNewBio] = useState('');
  const [applyName, setApplyName] = useState(false);
  const [applyAvatar, setApplyAvatar] = useState(false);
  const [applyCountry, setApplyCountry] = useState(false);
  const [applyBio, setApplyBio] = useState(false);
  const [applying, setApplying] = useState(false);
  const [result, setResult] = useState('');

  const handleApply = async () => {
    setApplying(true);
    setResult('');
    let success = 0;
    let errors = 0;
    for (const acc of targetAccounts) {
      const data: Record<string, string> = {};
      if (applyName && newName) data.name = newName;
      if (applyAvatar && newAvatarUrl) data.avatarUrl = newAvatarUrl;
      if (applyCountry && newCountry) data.country = newCountry;
      if (applyBio) data.bio = newBio;
      if (Object.keys(data).length === 0) continue;
      try {
        const res = await steamApi.updateProfile(acc.id, data);
        if (res.success) success++; else errors++;
      } catch { errors++; }
      await new Promise(r => setTimeout(r, 1000));
    }
    setResult(`Готово: ${success} успешно, ${errors} ошибок`);
    setApplying(false);
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in overflow-y-auto max-h-[calc(100vh-52px)]">
      <div><h1 className="text-2xl font-semibold text-white flex items-center gap-2"><UserCog size={24} /> Менеджер аккаунтов</h1><p className="text-sm text-white/40 mt-1">Массовое изменение профилей Steam</p></div>
      <div className="max-w-2xl glass-card rounded-2xl p-5 space-y-4">
        <h3 className="text-sm font-semibold text-white">Изменить профиль</h3>
        <p className="text-xs text-white/40">Применить к: {selectedAccount ? selectedAccount.login : `${targetAccounts.length} онлайн аккаунтам`}</p>
        {[
          { checked: applyName, setChecked: setApplyName, label: 'Имя профиля', value: newName, setValue: setNewName, placeholder: 'Новое имя' },
          { checked: applyAvatar, setChecked: setApplyAvatar, label: 'Аватарка (URL)', value: newAvatarUrl, setValue: setNewAvatarUrl, placeholder: 'https://...' },
          { checked: applyCountry, setChecked: setApplyCountry, label: 'Страна', value: newCountry, setValue: setNewCountry, placeholder: 'RU, US, DE...' },
        ].map(item => (
          <div key={item.label} className="space-y-1">
            <label className="flex items-center gap-2 text-xs text-white/50"><input type="checkbox" checked={item.checked} onChange={e => item.setChecked(e.target.checked)} className="w-4 h-4 rounded" />{item.label}</label>
            <input value={item.value} onChange={e => item.setValue(e.target.value)} disabled={!item.checked || applying} placeholder={item.placeholder} className="w-full glass-input text-sm text-white px-3 py-2 rounded-xl outline-none disabled:opacity-30" />
          </div>
        ))}
        <div className="space-y-1">
          <label className="flex items-center gap-2 text-xs text-white/50"><input type="checkbox" checked={applyBio} onChange={e => setApplyBio(e.target.checked)} className="w-4 h-4 rounded" />Описание</label>
          <textarea value={newBio} onChange={e => setNewBio(e.target.value)} disabled={!applyBio || applying} placeholder="Описание профиля..." className="w-full glass-input text-sm text-white px-3 py-2 rounded-xl outline-none h-20 resize-none disabled:opacity-30" />
        </div>
        <button onClick={handleApply} disabled={applying || targetAccounts.length === 0} className="flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-500/20 text-indigo-400 text-sm hover:bg-indigo-500/30 disabled:opacity-30">
          {applying ? <><Loader2 size={16} className="animate-spin" /> Применяю...</> : <><Save size={16} /> Применить</>}
        </button>
        {result && <div className="text-xs text-green-400/60">{result}</div>}
      </div>
    </div>
  );
}
