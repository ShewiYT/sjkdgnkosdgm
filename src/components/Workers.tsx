import { useState } from 'react';
import { 
  Users, UserPlus, Shield, MessageSquare, Globe, 
  ArrowRightLeft, Gamepad2, Smartphone, Clock, Eye, Trash2
} from 'lucide-react';
import { useAppStore } from '../store';
import type { Worker } from '../types';

export default function Workers() {
  const { accounts, workers, addWorker, updateWorker, removeWorker } = useAppStore();
  const [showAddModal, setShowAddModal] = useState(false);
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());
  const [newWorker, setNewWorker] = useState({ username: '', password: '', assignedAccounts: [] as string[] });
  

  const toggleLogs = (wId: string) => {
    setExpandedLogs(prev => {
      const n = new Set(prev);
      n.has(wId) ? n.delete(wId) : n.add(wId);
      return n;
    });
  };

  const permLabels: { key: keyof Worker['permissions']; icon: React.ReactNode; label: string }[] = [
    { key: 'chat', icon: <MessageSquare size={14} />, label: 'Chat' },
    { key: 'browser', icon: <Globe size={14} />, label: 'Browser' },
    { key: 'offersSend', icon: <ArrowRightLeft size={14} />, label: 'Offers' },
    { key: 'offersSendAll', icon: <ArrowRightLeft size={14} />, label: 'Offers All' },
    { key: 'offersConfirm', icon: <Shield size={14} />, label: 'Confirm' },
    { key: 'guard', icon: <Smartphone size={14} />, label: 'Guard' },
    { key: 'inGameMode', icon: <Gamepad2 size={14} />, label: 'In-Game' },
  ];

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    const now = Date.now();
    const diff = Math.floor((now - d.getTime()) / 60000);
    if (diff < 1) return 'только что';
    if (diff < 60) return `${diff} мин назад`;
    return `${Math.floor(diff / 60)} ч назад`;
  };

  const handleCreateWorker = () => {
    if (!newWorker.username || !newWorker.password) return;
    
    addWorker({
      username: newWorker.username,
      password: newWorker.password,
      assignedAccounts: newWorker.assignedAccounts,
    });
    
    setNewWorker({ username: '', password: '', assignedAccounts: [] });
    setShowAddModal(false);
  };

  const toggleAccountAssignment = (workerId: string, accountId: string, currentAssigned: string[]) => {
    const newAssigned = currentAssigned.includes(accountId)
      ? currentAssigned.filter(id => id !== accountId)
      : [...currentAssigned, accountId];
    
    updateWorker(workerId, { assignedAccounts: newAssigned });
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl glass-accent flex items-center justify-center">
              <Users size={20} />
            </div>
            Работники
          </h1>
          <p className="text-sm text-white/50 mt-1">Управление доступом к аккаунтам</p>
        </div>
        <button
          onClick={() => setShowAddModal(!showAddModal)}
          className="flex items-center gap-2 px-4 py-2 glass-accent rounded-xl text-white text-sm"
        >
          <UserPlus size={16} />
          Добавить работника
        </button>
      </div>

      {/* Add Worker Modal */}
      {showAddModal && (
        <div className="glass-card rounded-2xl p-5 space-y-4 animate-fade-in">
          <h3 className="text-sm font-medium text-white">➕ Новый работник</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-white/50 block mb-1">Логин</label>
              <input
                type="text"
                value={newWorker.username}
                onChange={e => setNewWorker(prev => ({ ...prev, username: e.target.value }))}
                placeholder="worker_name"
                className="w-full glass-input text-sm text-white px-3 py-2 rounded-xl outline-none"
              />
            </div>
            <div>
              <label className="text-xs text-white/50 block mb-1">Пароль</label>
              <input
                type="password"
                value={newWorker.password}
                onChange={e => setNewWorker(prev => ({ ...prev, password: e.target.value }))}
                placeholder="••••••••"
                className="w-full glass-input text-sm text-white px-3 py-2 rounded-xl outline-none"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-white/50 block mb-2">Назначить аккаунты</label>
            <div className="flex flex-wrap gap-2">
              {accounts.map(acc => (
                <button
                  key={acc.id}
                  onClick={() => {
                    setNewWorker(prev => ({
                      ...prev,
                      assignedAccounts: prev.assignedAccounts.includes(acc.id)
                        ? prev.assignedAccounts.filter(id => id !== acc.id)
                        : [...prev.assignedAccounts, acc.id]
                    }));
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${
                    newWorker.assignedAccounts.includes(acc.id)
                      ? 'glass-accent text-white'
                      : 'glass-button text-white/60'
                  }`}
                >
                  {acc.avatar} {acc.login}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={handleCreateWorker}
              className="px-4 py-2 glass-accent rounded-xl text-white text-xs"
            >
              Создать
            </button>
            <button
              onClick={() => setShowAddModal(false)}
              className="px-4 py-2 glass-button rounded-xl text-white/60 text-xs"
            >
              Отмена
            </button>
          </div>
        </div>
      )}

      {/* Workers list */}
      {workers.length === 0 ? (
        <div className="glass-card rounded-2xl p-8 text-center">
          <Users size={40} className="mx-auto mb-3 text-white/20" />
          <div className="text-sm text-white/60">Нет работников</div>
          <div className="text-xs text-white/30 mt-1">Нажмите "Добавить работника"</div>
        </div>
      ) : (
        <div className="space-y-4">
          {workers.map(worker => (
            <div key={worker.id} className="glass-card rounded-2xl overflow-hidden">
              <div className="p-4 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/50 to-purple-600/50 flex items-center justify-center text-xl text-white font-bold">
                  {worker.username[0]?.toUpperCase()}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-white">{worker.username}</div>
                  <div className="text-[10px] text-white/40 flex items-center gap-1">
                    <Clock size={10} />
                    Был {formatTime(worker.lastActive)}
                    <span className="mx-1">•</span>
                    {worker.assignedAccounts.length} аккаунтов
                  </div>
                </div>

                {/* Permissions badges */}
                <div className="flex flex-wrap gap-1">
                  {permLabels.map(p => (
                    <span
                      key={p.key}
                      className={`text-[9px] px-2 py-0.5 rounded-full flex items-center gap-0.5 ${
                        worker.permissions[p.key]
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-white/5 text-white/30'
                      }`}
                    >
                      {p.icon}
                      {p.label}
                    </span>
                  ))}
                </div>

                <button
                  onClick={() => toggleLogs(worker.id)}
                  className="p-2 rounded-xl glass-button text-white/50 hover:text-white"
                >
                  <Eye size={16} />
                </button>

                <button
                  onClick={() => {
                    if (confirm(`Удалить работника ${worker.username}?`)) {
                      removeWorker(worker.id);
                    }
                  }}
                  className="p-2 rounded-xl glass-button text-white/50 hover:text-red-400"
                >
                  <Trash2 size={16} />
                </button>
              </div>

              {/* Assigned accounts */}
              <div className="px-4 pb-3 border-t border-white/5 pt-3">
                <div className="text-[10px] text-white/40 mb-2">Назначенные аккаунты:</div>
                <div className="flex flex-wrap gap-2">
                  {accounts.map(acc => (
                    <button
                      key={acc.id}
                      onClick={() => toggleAccountAssignment(worker.id, acc.id, worker.assignedAccounts)}
                      className={`text-[10px] px-2 py-1 rounded-lg transition-colors ${
                        worker.assignedAccounts.includes(acc.id)
                          ? 'glass-accent text-white'
                          : 'glass-button text-white/40'
                      }`}
                    >
                      {acc.avatar} {acc.login}
                    </button>
                  ))}
                </div>
              </div>

              {/* Action log */}
              {expandedLogs.has(worker.id) && (
                <div className="border-t border-white/5 p-4 animate-fade-in">
                  <h4 className="text-xs font-medium text-white mb-2">📋 Лог действий</h4>
                  {worker.actionsLog.length === 0 ? (
                    <div className="text-xs text-white/30 text-center py-4">Нет действий</div>
                  ) : (
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {worker.actionsLog.map(action => {
                        const acc = accounts.find(a => a.id === action.accountId);
                        return (
                          <div key={action.id} className="flex items-center gap-3 p-2 rounded-lg glass-light text-[11px]">
                            <span className="text-white/40 shrink-0">{formatTime(action.timestamp)}</span>
                            <span className="text-blue-400 shrink-0">{acc?.login}</span>
                            <span className="text-white/80">{action.action}</span>
                            <span className="text-white/40 ml-auto">{action.details}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
