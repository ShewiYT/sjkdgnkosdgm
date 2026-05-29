import { useState } from 'react';
import { Users, Plus, Trash2, Save, X } from 'lucide-react';
import { useAppStore } from '../store';
import type { SteamAccount } from '../types';

interface WorkersProps {
  accounts: SteamAccount[];
}

export default function Workers({ accounts }: WorkersProps) {
  const { workers, addWorker, removeWorker } = useAppStore();
  const [showCreate, setShowCreate] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);

  const handleCreate = () => {
    if (!newUsername.trim() || !newPassword.trim()) return;
    addWorker({ username: newUsername, password: newPassword, assignedAccounts: selectedAccounts });
    setNewUsername('');
    setNewPassword('');
    setSelectedAccounts([]);
    setShowCreate(false);
  };

  const toggleAccount = (accId: string) => {
    setSelectedAccounts(prev => prev.includes(accId) ? prev.filter(id => id !== accId) : [...prev, accId]);
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in overflow-y-auto max-h-[calc(100vh-52px)]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white flex items-center gap-2">
            <Users size={24} />
            Работники
          </h1>
          <p className="text-sm text-white/40 mt-1">Управление воркерами</p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-500/20 text-indigo-400 text-sm hover:bg-indigo-500/30 transition-colors"
        >
          <Plus size={16} /> Создать
        </button>
      </div>

      {showCreate && (
        <div className="glass-card rounded-2xl p-4 space-y-4">
          <h3 className="text-sm font-semibold text-white">Новый работник</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-white/50 mb-1 block">Логин</label>
              <input value={newUsername} onChange={e => setNewUsername(e.target.value)} className="w-full glass-input text-sm text-white px-3 py-2 rounded-xl outline-none" placeholder="worker1" />
            </div>
            <div>
              <label className="text-xs text-white/50 mb-1 block">Пароль</label>
              <input value={newPassword} onChange={e => setNewPassword(e.target.value)} className="w-full glass-input text-sm text-white px-3 py-2 rounded-xl outline-none" placeholder="••••••" />
            </div>
          </div>

          <div>
            <label className="text-xs text-white/50 mb-2 block">Назначенные аккаунты</label>
            <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
              {accounts.map(acc => (
                <button
                  key={acc.id}
                  onClick={() => toggleAccount(acc.id)}
                  className={`px-2 py-1 rounded-lg text-xs transition-colors ${
                    selectedAccounts.includes(acc.id) ? 'bg-indigo-500/20 text-indigo-400' : 'bg-white/5 text-white/40'
                  }`}
                >
                  {acc.login}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <button onClick={handleCreate} className="flex items-center gap-1 px-4 py-2 rounded-xl bg-green-500/20 text-green-400 text-xs hover:bg-green-500/30">
              <Save size={12} /> Создать
            </button>
            <button onClick={() => setShowCreate(false)} className="flex items-center gap-1 px-4 py-2 rounded-xl bg-white/5 text-white/50 text-xs hover:bg-white/10">
              <X size={12} /> Отмена
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {workers.length === 0 ? (
          <div className="glass-card rounded-2xl p-12 text-center">
            <Users size={48} className="mx-auto mb-4 text-white/10" />
            <div className="text-sm text-white/30">Нет работников</div>
          </div>
        ) : (
          workers.map(worker => (
            <div key={worker.id} className="glass-card rounded-2xl p-4">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <div className="text-sm text-white font-medium">{worker.username}</div>
                  <div className="text-[10px] text-white/30">
                    {worker.assignedAccounts.length} аккаунтов • Последняя активность: {new Date(worker.lastActive).toLocaleString('ru')}
                  </div>
                </div>
                <button onClick={() => removeWorker(worker.id)} className="p-1.5 rounded-lg text-red-400/50 hover:text-red-400 hover:bg-red-500/10">
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="flex flex-wrap gap-1">
                {worker.assignedAccounts.map(accId => {
                  const acc = accounts.find(a => a.id === accId);
                  return acc ? (
                    <span key={accId} className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-white/50">{acc.login}</span>
                  ) : null;
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
