import { useState } from 'react';
import { Globe2, Plus, Trash2, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import { useAppStore } from '../store';

export default function DomainsView() {
  const { domains, addDomain, removeDomain } = useAppStore();
  const [newDomain, setNewDomain] = useState('');
  const [newTarget, setNewTarget] = useState<'panel' | 'api'>('panel');

  const handleAdd = () => {
    if (!newDomain.trim()) return;
    addDomain(newDomain.trim(), newTarget);
    setNewDomain('');
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in overflow-y-auto max-h-[calc(100vh-52px)]">
      <div>
        <h1 className="text-2xl font-semibold text-white flex items-center gap-2"><Globe2 size={24} /> Домены</h1>
        <p className="text-sm text-white/40 mt-1">Управление доменами и SSL</p>
      </div>

      <div className="glass-card rounded-2xl p-4 space-y-3">
        <h3 className="text-sm font-semibold text-white">Добавить домен</h3>
        <div className="flex gap-2">
          <input type="text" value={newDomain} onChange={e => setNewDomain(e.target.value)} placeholder="example.com" className="flex-1 glass-input text-sm text-white px-3 py-2 rounded-xl outline-none" />
          <select value={newTarget} onChange={e => setNewTarget(e.target.value as 'panel' | 'api')} className="glass-input text-sm text-white px-3 py-2 rounded-xl outline-none bg-transparent">
            <option value="panel" className="bg-gray-900">Панель</option>
            <option value="api" className="bg-gray-900">API</option>
          </select>
          <button onClick={handleAdd} className="flex items-center gap-1 px-4 py-2 rounded-xl bg-indigo-500/20 text-indigo-400 text-sm hover:bg-indigo-500/30"><Plus size={14} /> Добавить</button>
        </div>
      </div>

      <div className="space-y-3">
        {domains.length === 0 ? (
          <div className="glass-card rounded-2xl p-12 text-center"><Globe2 size={48} className="mx-auto mb-4 text-white/10" /><div className="text-sm text-white/30">Нет настроенных доменов</div></div>
        ) : domains.map(domain => (
          <div key={domain.id} className="glass-card rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {domain.status === 'active' ? <CheckCircle size={16} className="text-green-400" /> : domain.status === 'error' ? <AlertTriangle size={16} className="text-red-400" /> : <Clock size={16} className="text-yellow-400" />}
              <div>
                <div className="text-sm text-white font-medium">{domain.domain}</div>
                <div className="text-[10px] text-white/30">{domain.target === 'panel' ? 'Панель' : 'API'} • {domain.ssl ? 'SSL ✓' : 'Без SSL'}</div>
              </div>
            </div>
            <button onClick={() => removeDomain(domain.id)} className="p-2 rounded-lg text-red-400/50 hover:text-red-400 hover:bg-red-500/10"><Trash2 size={14} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}
