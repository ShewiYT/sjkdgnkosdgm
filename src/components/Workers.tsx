import { useState } from 'react';
import { UserCog, Plus, Trash2, Clock, MessageSquare, Globe, ArrowRightLeft, Shield, Gamepad2, CheckCircle, ChevronDown, ChevronUp, Package } from 'lucide-react';
import { useAppStore } from '../store';
import type { SteamAccount } from '../types';

interface WorkersProps {
  accounts: SteamAccount[];
}

export default function Workers({ accounts }: WorkersProps) {
  const { workers, addWorker, updateWorker, removeWorker } = useAppStore();
  const [showAddModal, setShowAddModal] = useState(false);
  const [newWorker, setNewWorker] = useState({ username: '', password: '', assignedAccounts: [] as string[] });
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());

  const permLabels = [
    { key: 'chat' as const, icon: <MessageSquare size={10} />, label: 'Chat' },
    { key: 'browser' as const, icon: <Globe size={10} />, label: 'Browser' },
    { key: 'offersSend' as const, icon: <ArrowRightLeft size={10} />, label: 'Offers' },
    { key: 'offersSendAll' as const, icon: <Package size={10} />, label: 'Offers All' },
    { key: 'offersConfirm' as const, icon: <CheckCircle size={10} />, label: 'Confirm' },
    { key: 'guard' as const, icon: <Shield size={10} />, label: 'Guard' },
    { key: 'inGameMode' as const, icon: <Gamepad2 size={10} />, label: 'In-Game' },
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
    <div className="p-6 space-y-6 animate-fade-in overflow-y-auto max-h-[calc(100vh-52px)]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl glass-accent flex items-center justify-center">
              <UserCog size={20} />
            </div>
            Работники
          </h1>
          <p className="text-sm text-white/50 mt-1">Управление доступом к аккаунтам</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl glass-accent text-white text-sm"
        >
          <Plus size={16} />
          Добавить работника
        </button>
      </div>

      {/* Add Worker Modal */}
      {showAddModal && (
        <div className="glass-card rounded-2xl p-5 space-y-4 animate-fade-in">
          <h3 className="text-sm font-semibold text-white">➕ Новый работник</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-white/50 block mb-1">Логин</label>
              <input
                value={newWorker.username}
                onChange={e => setNewWorker(prev => ({ ...prev, username: e.target.value }))}
                placeholder="worker_name"
                className="w-full glass-input text-sm text-white px-3 py-2 rounded-xl outline-none"
              />
            </div>
            <div>
              <label className="text-xs text-white/50 block mb-1">Пароль</label>
              <input
                value={newWorker.password}
                onChange={e => setNewWorker(prev => ({ ...prev, password: e.target.value }))}
                placeholder="••••••••"
                className="w-full glass-input text-sm text-white px-3 py-2 rounded-xl outline-none"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-white/50 block mb-1">Назначить аккаунты</label>
            <div className="flex flex-wrap gap-1">
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
                  className={`px-2 py-1 rounded-lg text-[10px] ${
                    newWorker.assignedAccounts.includes(acc.id)
                      ? 'glass-accent text-white'
                      : 'glass-button text-white/50'
                  }`}
                >
                  {acc.avatar} {acc.login}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setShowAddModal(false)} className="flex-1 py-2 rounded-xl glass-button text-white/60 text-sm">
              Отмена
            </button>
            <button onClick={handleCreateWorker} className="flex-1 py-2 rounded-xl glass-accent text-white text-sm">
              Создать
            </button>
          </div>
        </div>
      )}

      {/* Workers list */}
      {workers.length === 0 ? (
        <div className="text-center py-16 text-white/30">
          <UserCog size={48} className="mx-auto mb-4 opacity-30" />
          <div className="text-sm">Нет работников</div>
          <div className="text-xs mt-1">Нажмите "Добавить работника"</div>
        </div>
      ) : (
        <div className="space-y-4">
          {workers.map(worker => (
            <div key={worker.id} className="glass-card rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl glass-accent flex items-center justify-center text-sm font-bold">
                    {worker.username[0]?.toUpperCase()}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-white">{worker.username}</div>
                    <div className="text-[10px] text-white/40 flex items-center gap-2">
                      <Clock size={10} />
                      Был {formatTime(worker.lastActive)}
                      •
                      {worker.assignedAccounts.length} аккаунтов
                    </div>
                  </div>
                </div>

                {/* Permissions badges */}
                <div className="flex gap-1">
                  {permLabels.map(p => (
                    <button
                      key={p.key}
                      onClick={() => {
                        updateWorker(worker.id, {
                          permissions: { ...worker.permissions, [p.key]: !worker.permissions[p.key] }
                        });
                      }}
                      className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] ${
                        worker.permissions[p.key]
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-white/5 text-white/30'
                      }`}
                    >
                      {p.icon} {p.label}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => removeWorker(worker.id)}
                  className="p-2 rounded-xl glass-button text-red-400/50 hover:text-red-400"
                >
                  <Trash2 size={14} />
                </button>
              </div>

              {/* Assigned accounts */}
              <div>
                <div className="text-xs text-white/50 mb-2">Назначенные аккаунты:</div>
                <div className="flex flex-wrap gap-1">
                  {accounts.map(acc => (
                    <button
                      key={acc.id}
                      onClick={() => toggleAccountAssignment(worker.id, acc.id, worker.assignedAccounts)}
                      className={`px-2 py-1 rounded-lg text-[10px] ${
                        worker.assignedAccounts.includes(acc.id)
                          ? 'glass-accent text-white'
                          : 'glass-button text-white/30'
                      }`}
                    >
                      {acc.avatar} {acc.login}
                    </button>
                  ))}
                </div>
              </div>

              {/* Action log toggle */}
              <button
                onClick={() => {
                  const newSet = new Set(expandedLogs);
                  if (newSet.has(worker.id)) newSet.delete(worker.id);
                  else newSet.add(worker.id);
                  setExpandedLogs(newSet);
                }}
                className="text-xs text-white/40 hover:text-white/60 flex items-center gap-1"
              >
                {expandedLogs.has(worker.id) ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                📋 Лог действий ({worker.actionsLog.length})
              </button>

              {expandedLogs.has(worker.id) && (
                <div className="glass-light rounded-xl p-3">
                  {worker.actionsLog.length === 0 ? (
                    <div className="text-xs text-white/30 text-center">Нет действий</div>
                  ) : (
                    <div className="space-y-1">
                      {worker.actionsLog.map(action => {
                        const actAcc = accounts.find(a => a.id === action.accountId);
                        return (
                          <div key={action.id} className="flex items-center gap-3 text-[10px] text-white/50">
                            <span>{formatTime(action.timestamp)}</span>
                            <span className="text-blue-400">{actAcc?.login}</span>
                            <span className="text-white/70">{action.action}</span>
                            <span>{action.details}</span>
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
