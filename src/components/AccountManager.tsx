import { useState } from 'react';
import { UserCog, Save, CheckSquare, Square, Image, Globe, FileText, User } from 'lucide-react';
import { useAppStore } from '../store';
import { steamApi } from '../api';
import type { SteamAccount } from '../types';

interface AccountManagerProps {
  accounts: SteamAccount[];
}

export default function AccountManager({ accounts }: AccountManagerProps) {
  const { updateAccount } = useAppStore();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);
  
  // Form fields
  const [newName, setNewName] = useState('');
  const [newCountry, setNewCountry] = useState('');
  const [newBio, setNewBio] = useState('');
  const [newAvatarUrl, setNewAvatarUrl] = useState('');
  
  // Apply flags
  const [applyName, setApplyName] = useState(false);
  const [applyCountry, setApplyCountry] = useState(false);
  const [applyBio, setApplyBio] = useState(false);
  const [applyAvatar, setApplyAvatar] = useState(false);
  
  const [applying, setApplying] = useState(false);
  const [logs, setLogs] = useState<{ id: string; account: string; status: string; error?: string }[]>([]);

  const onlineAccounts = accounts.filter(a => a.status === 'online' || a.status === 'in-game');

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const toggleSelectAll = () => {
    if (selectAll) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(onlineAccounts.map(a => a.id)));
    }
    setSelectAll(!selectAll);
  };

  const handleApply = async () => {
    const targetAccounts = onlineAccounts.filter(a => selectedIds.has(a.id));
    if (targetAccounts.length === 0) return;
    
    setApplying(true);
    setLogs([]);

    for (const acc of targetAccounts) {
      const data: { name?: string; country?: string; bio?: string; avatarUrl?: string } = {};
      if (applyName && newName.trim()) data.name = newName.trim();
      if (applyCountry && newCountry.trim()) data.country = newCountry.trim();
      if (applyBio) data.bio = newBio;
      if (applyAvatar && newAvatarUrl.trim()) data.avatarUrl = newAvatarUrl.trim();

      if (Object.keys(data).length === 0) continue;

      try {
        const result = await steamApi.updateProfile(acc.id, data);
        
        if (result.success) {
          // Update local state
          const updates: Partial<SteamAccount> = {};
          if (data.name) updates.customName = data.name;
          if (data.country) updates.customCountry = data.country;
          if (data.bio !== undefined) updates.customBio = data.bio;
          if (data.avatarUrl) updates.customAvatarUrl = data.avatarUrl;
          updateAccount(acc.id, updates);
        }

        setLogs(prev => [...prev, {
          id: acc.id,
          account: acc.login,
          status: result.success ? 'success' : 'error',
          error: result.error,
        }]);
      } catch {
        setLogs(prev => [...prev, {
          id: acc.id,
          account: acc.login,
          status: 'error',
          error: 'Ошибка подключения',
        }]);
      }

      // Delay between accounts
      await new Promise(r => setTimeout(r, 1500));
    }

    setApplying(false);
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in overflow-y-auto max-h-[calc(100vh-52px)]">
      <div>
        <h1 className="text-2xl font-semibold text-white flex items-center gap-2">
          <UserCog size={24} />
          Менеджер аккаунтов
        </h1>
        <p className="text-sm text-white/40 mt-1">
          Изменение имени, аватарки, страны, описания для выбранных аккаунтов
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Settings panel */}
        <div className="space-y-4">
          {/* Name */}
          <div className="glass-card rounded-2xl p-4 space-y-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={applyName}
                onChange={e => setApplyName(e.target.checked)}
                className="w-4 h-4 rounded"
              />
              <User size={14} className="text-indigo-400" />
              <span className="text-sm text-white font-medium">Имя профиля</span>
            </label>
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              disabled={!applyName || applying}
              placeholder="Новое имя профиля"
              className="w-full glass-input text-sm text-white px-3 py-2 rounded-xl outline-none disabled:opacity-30"
            />
          </div>

          {/* Avatar URL */}
          <div className="glass-card rounded-2xl p-4 space-y-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={applyAvatar}
                onChange={e => setApplyAvatar(e.target.checked)}
                className="w-4 h-4 rounded"
              />
              <Image size={14} className="text-purple-400" />
              <span className="text-sm text-white font-medium">Аватарка (URL)</span>
            </label>
            <input
              value={newAvatarUrl}
              onChange={e => setNewAvatarUrl(e.target.value)}
              disabled={!applyAvatar || applying}
              placeholder="https://example.com/avatar.jpg"
              className="w-full glass-input text-sm text-white px-3 py-2 rounded-xl outline-none font-mono disabled:opacity-30"
            />
            {newAvatarUrl && applyAvatar && (
              <div className="flex justify-center">
                <img src={newAvatarUrl} alt="preview" className="w-16 h-16 rounded-full object-cover border border-white/10" 
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              </div>
            )}
          </div>

          {/* Country */}
          <div className="glass-card rounded-2xl p-4 space-y-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={applyCountry}
                onChange={e => setApplyCountry(e.target.checked)}
                className="w-4 h-4 rounded"
              />
              <Globe size={14} className="text-green-400" />
              <span className="text-sm text-white font-medium">Страна</span>
            </label>
            <input
              value={newCountry}
              onChange={e => setNewCountry(e.target.value)}
              disabled={!applyCountry || applying}
              placeholder="RU, US, DE, UA..."
              className="w-full glass-input text-sm text-white px-3 py-2 rounded-xl outline-none disabled:opacity-30"
            />
          </div>

          {/* Bio */}
          <div className="glass-card rounded-2xl p-4 space-y-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={applyBio}
                onChange={e => setApplyBio(e.target.checked)}
                className="w-4 h-4 rounded"
              />
              <FileText size={14} className="text-yellow-400" />
              <span className="text-sm text-white font-medium">Описание профиля</span>
            </label>
            <textarea
              value={newBio}
              onChange={e => setNewBio(e.target.value)}
              disabled={!applyBio || applying}
              placeholder="Описание профиля..."
              className="w-full glass-input text-sm text-white px-3 py-2 rounded-xl outline-none h-20 resize-none disabled:opacity-30"
            />
          </div>

          {/* Apply button */}
          <button
            onClick={handleApply}
            disabled={applying || selectedIds.size === 0 || (!applyName && !applyCountry && !applyBio && !applyAvatar)}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-indigo-500/20 text-indigo-400 text-sm hover:bg-indigo-500/30 transition-colors disabled:opacity-30"
          >
            {applying ? (
              <>
                <div className="w-4 h-4 border-2 border-indigo-400/30 border-t-indigo-400 rounded-full animate-spin" />
                Применяем...
              </>
            ) : (
              <>
                <Save size={16} />
                Применить к {selectedIds.size} аккаунтам
              </>
            )}
          </button>
        </div>

        {/* Accounts selection & logs */}
        <div className="space-y-4">
          {/* Account selection */}
          <div className="glass-card rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Выберите аккаунты</h3>
              <button
                onClick={toggleSelectAll}
                className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300"
              >
                {selectAll ? <CheckSquare size={14} /> : <Square size={14} />}
                {selectAll ? 'Снять все' : 'Выбрать все'}
              </button>
            </div>
            <div className="max-h-60 overflow-y-auto divide-y divide-white/5">
              {onlineAccounts.length === 0 ? (
                <div className="p-8 text-center text-xs text-white/30">
                  Нет онлайн аккаунтов. Подключите аккаунты.
                </div>
              ) : (
                onlineAccounts.map(acc => (
                  <div
                    key={acc.id}
                    onClick={() => toggleSelect(acc.id)}
                    className={`px-4 py-2.5 flex items-center gap-3 cursor-pointer hover:bg-white/5 transition-colors ${
                      selectedIds.has(acc.id) ? 'bg-indigo-500/10' : ''
                    }`}
                  >
                    {selectedIds.has(acc.id) ? (
                      <CheckSquare size={14} className="text-indigo-400 shrink-0" />
                    ) : (
                      <Square size={14} className="text-white/20 shrink-0" />
                    )}
                    {acc.avatarUrl ? (
                      <img src={acc.avatarUrl} alt="" className="w-6 h-6 rounded-full" />
                    ) : (
                      <span className="text-sm">{acc.avatar}</span>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-white truncate">{acc.displayName || acc.login}</div>
                      <div className="text-[10px] text-white/30">{acc.steamId || acc.login}</div>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">
                      online
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Offline accounts */}
          {accounts.filter(a => a.status === 'offline' || a.status === 'error').length > 0 && (
            <div className="glass-card rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-white/5">
                <h3 className="text-xs text-white/30">
                  Оффлайн аккаунты ({accounts.filter(a => a.status === 'offline' || a.status === 'error').length})
                </h3>
              </div>
              <div className="max-h-32 overflow-y-auto divide-y divide-white/5">
                {accounts.filter(a => a.status === 'offline' || a.status === 'error').map(acc => (
                  <div key={acc.id} className="px-4 py-2 flex items-center gap-3 opacity-40">
                    <Square size={14} className="text-white/10 shrink-0" />
                    <span className="text-xs text-white/40 truncate">{acc.login}</span>
                    <span className="text-[10px] text-white/20 ml-auto">offline</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Logs */}
          {logs.length > 0 && (
            <div className="glass-card rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-white/5">
                <h3 className="text-sm font-semibold text-white">Результаты</h3>
              </div>
              <div className="max-h-48 overflow-y-auto divide-y divide-white/5">
                {logs.map((log, i) => (
                  <div key={i} className="px-4 py-2 flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${log.status === 'success' ? 'bg-green-400' : 'bg-red-400'}`} />
                    <span className="text-xs text-white">{log.account}</span>
                    <span className={`text-[10px] ml-auto ${log.status === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                      {log.status === 'success' ? 'Применено' : log.error || 'Ошибка'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
