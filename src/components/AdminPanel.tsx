import { useState, useEffect } from 'react';
import { Shield, Eye, EyeOff, Save, Loader2, Plus, Trash2, Copy, CheckCircle } from 'lucide-react';

interface VpsServer { id: string; name: string; ip: string; ssh_user: string; ssh_port: number; }
interface ScreenTemplate { id: string; name: string; html_content: string; placeholder_url: string; }
interface WorkerNode { nodeId: string; name: string; isOnline: boolean; lastSeen: string; accountsCount: number; }

export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState<'settings' | 'vps' | 'domains' | 'templates' | 'nodes'>('settings');
  const [adminUsername, setAdminUsername] = useState('admin');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [adminDomain, setAdminDomain] = useState('');
  const [workerDomain, setWorkerDomain] = useState('');
  const [vpsServers, setVpsServers] = useState<VpsServer[]>([]);
  const [showAddVps, setShowAddVps] = useState(false);
  const [newVps, setNewVps] = useState({ name: '', ip: '', sshUser: 'root', sshPassword: '', sshPort: 22 });
  const [templates, setTemplates] = useState<ScreenTemplate[]>([]);
  const [showAddTemplate, setShowAddTemplate] = useState(false);
  const [newTemplate, setNewTemplate] = useState({ name: '', htmlContent: '', placeholderUrl: 'https://example.com' });
  const [workerNodes, setWorkerNodes] = useState<WorkerNode[]>([]);
  const [installCopied, setInstallCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  useEffect(() => { loadData(); }, []);
  useEffect(() => { if (activeTab === 'nodes') { loadNodes(); const iv = setInterval(loadNodes, 15000); return () => clearInterval(iv); } }, [activeTab]);
  useEffect(() => { if (success) { const t = setTimeout(() => setSuccess(''), 5000); return () => clearTimeout(t); } }, [success]);
  useEffect(() => { if (error) { const t = setTimeout(() => setError(''), 5000); return () => clearTimeout(t); } }, [error]);

  const loadNodes = async () => { try { const res = await fetch('/api/nodes'); const data = await res.json(); setWorkerNodes(data.nodes || []); } catch {} };
  const removeNode = async (nodeId: string) => { try { await fetch(`/api/nodes/${nodeId}`, { method: 'DELETE' }); setWorkerNodes(prev => prev.filter(n => n.nodeId !== nodeId)); } catch { setError('Ошибка удаления ноды'); } };
  const getInstallCommand = () => { const origin = window.location.origin; return `curl -sL ${origin}/install-worker.sh | bash -s -- --master ${origin} --name "Worker-$(date +%s)" --port 3001`; };
  const copyInstallCmd = () => { navigator.clipboard.writeText(getInstallCommand()); setInstallCopied(true); setTimeout(() => setInstallCopied(false), 3000); };

  const loadData = async () => {
    try {
      const [vpsRes, templatesRes, settingsRes] = await Promise.all([
        fetch('/api/vps').then(r => r.json()).catch(() => ({ servers: [] })),
        fetch('/api/screen-templates').then(r => r.json()).catch(() => ({ templates: [] })),
        fetch('/api/admin/settings').then(r => r.json()).catch(() => ({ settings: {} })),
      ]);
      setVpsServers(vpsRes.servers || []);
      setTemplates(templatesRes.templates || []);
      if (settingsRes.settings) { setAdminDomain(settingsRes.settings.adminDomain || ''); setWorkerDomain(settingsRes.settings.workerDomain || ''); }
    } catch {}
  };

  const handleChangePassword = async () => {
    setError(''); setSuccess('');
    if (newPassword !== confirmPassword) { setError('Пароли не совпадают'); return; }
    if (newPassword.length < 6) { setError('Пароль минимум 6 символов'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/change-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ currentPassword, newUsername: adminUsername, newPassword }) });
      const data = await res.json();
      if (data.success) { setSuccess('Данные авторизации обновлены!'); setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); }
      else { setError(data.error || 'Ошибка при смене пароля'); }
    } catch { setError('Ошибка сети'); }
    setLoading(false);
  };

  const handleSaveDomains = async () => {
    setLoading(true);
    try { await fetch('/api/admin/settings/bulk', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ settings: { adminDomain, workerDomain } }) }); setSuccess('Домены сохранены!'); }
    catch { setError('Ошибка сохранения'); }
    setLoading(false);
  };

  const handleAddVps = async () => {
    if (!newVps.name || !newVps.ip) { setError('Заполните все поля'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/vps', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newVps) });
      const data = await res.json();
      if (data.success) { setVpsServers([...vpsServers, data.server]); setNewVps({ name: '', ip: '', sshUser: 'root', sshPassword: '', sshPort: 22 }); setShowAddVps(false); setSuccess('VPS добавлен!'); }
    } catch { setError('Ошибка добавления'); }
    setLoading(false);
  };

  const handleDeleteVps = async (id: string) => { try { await fetch(`/api/vps/${id}`, { method: 'DELETE' }); setVpsServers(vpsServers.filter(v => v.id !== id)); } catch { setError('Ошибка удаления'); } };

  const handleAddTemplate = async () => {
    if (!newTemplate.name || !newTemplate.htmlContent) { setError('Заполните название и HTML'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/screen-templates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newTemplate) });
      const data = await res.json();
      if (data.success) { setTemplates([...templates, data.template]); setNewTemplate({ name: '', htmlContent: '', placeholderUrl: 'https://example.com' }); setShowAddTemplate(false); setSuccess('Шаблон добавлен!'); }
    } catch { setError('Ошибка добавления'); }
    setLoading(false);
  };

  const handleDeleteTemplate = async (id: string) => { try { await fetch(`/api/screen-templates/${id}`, { method: 'DELETE' }); setTemplates(templates.filter(t => t.id !== id)); } catch { setError('Ошибка удаления'); } };

  const tabs = [
    { id: 'settings' as const, label: 'Авторизация' },
    { id: 'domains' as const, label: 'Домены' },
    { id: 'vps' as const, label: 'VPS Серверы' },
    { id: 'templates' as const, label: 'Шаблоны скринов' },
    { id: 'nodes' as const, label: `Ноды (${workerNodes.filter(n => n.isOnline).length}/${workerNodes.length})` },
  ];

  return (
    <div className="p-6 space-y-6 animate-fade-in overflow-y-auto max-h-[calc(100vh-52px)]">
      <div><h1 className="text-2xl font-semibold text-white flex items-center gap-2"><Shield size={24} /> Админ-панель</h1><p className="text-sm text-white/40 mt-1">Настройки системы</p></div>

      <div className="flex gap-2 flex-wrap">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`px-4 py-2 rounded-xl text-xs transition-colors ${activeTab === tab.id ? 'bg-indigo-500/20 text-indigo-400' : 'bg-white/5 text-white/40 hover:bg-white/10'}`}>{tab.label}</button>
        ))}
      </div>

      {success && <div className="p-3 rounded-xl bg-green-500/10 text-green-400 text-xs flex items-center gap-2"><CheckCircle size={14} />{success}</div>}
      {error && <div className="p-3 rounded-xl bg-red-500/10 text-red-400 text-xs">{error}</div>}

      {activeTab === 'settings' && (
        <div className="max-w-lg glass-card rounded-2xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-white">Изменить авторизацию</h3>
          <div><label className="text-xs text-white/50 mb-1 block">Логин админа</label><input value={adminUsername} onChange={e => setAdminUsername(e.target.value)} className="w-full glass-input text-sm text-white px-3 py-2 rounded-xl outline-none" /></div>
          <div className="relative"><label className="text-xs text-white/50 mb-1 block">Текущий пароль</label><input type={showCurrentPass ? 'text' : 'password'} value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} className="w-full glass-input text-sm text-white px-3 py-2 pr-10 rounded-xl outline-none" /><button onClick={() => setShowCurrentPass(!showCurrentPass)} className="absolute right-3 top-8 text-white/30">{showCurrentPass ? <EyeOff size={14} /> : <Eye size={14} />}</button></div>
          <div className="relative"><label className="text-xs text-white/50 mb-1 block">Новый пароль</label><input type={showNewPass ? 'text' : 'password'} value={newPassword} onChange={e => setNewPassword(e.target.value)} className="w-full glass-input text-sm text-white px-3 py-2 pr-10 rounded-xl outline-none" /><button onClick={() => setShowNewPass(!showNewPass)} className="absolute right-3 top-8 text-white/30">{showNewPass ? <EyeOff size={14} /> : <Eye size={14} />}</button></div>
          <div><label className="text-xs text-white/50 mb-1 block">Подтвердить пароль</label><input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="w-full glass-input text-sm text-white px-3 py-2 rounded-xl outline-none" /></div>
          <button onClick={handleChangePassword} disabled={loading} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-500/20 text-indigo-400 text-xs disabled:opacity-30">{loading ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Сохранить</button>
        </div>
      )}

      {activeTab === 'domains' && (
        <div className="max-w-lg glass-card rounded-2xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-white">Домены</h3>
          <div><label className="text-xs text-white/50 mb-1 block">Домен админки</label><input value={adminDomain} onChange={e => setAdminDomain(e.target.value)} placeholder="admin.example.com" className="w-full glass-input text-sm text-white px-3 py-2 rounded-xl outline-none" /></div>
          <div><label className="text-xs text-white/50 mb-1 block">Домен воркеров</label><input value={workerDomain} onChange={e => setWorkerDomain(e.target.value)} placeholder="worker.example.com" className="w-full glass-input text-sm text-white px-3 py-2 rounded-xl outline-none" /></div>
          <button onClick={handleSaveDomains} disabled={loading} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-500/20 text-indigo-400 text-xs disabled:opacity-30"><Save size={14} /> Сохранить</button>
        </div>
      )}

      {activeTab === 'vps' && (
        <div className="space-y-4">
          <button onClick={() => setShowAddVps(!showAddVps)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-500/20 text-indigo-400 text-xs"><Plus size={14} /> Добавить VPS</button>
          {showAddVps && (
            <div className="glass-card rounded-2xl p-4 space-y-3 max-w-lg">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-white/50 mb-1 block">Имя</label><input value={newVps.name} onChange={e => setNewVps({...newVps, name: e.target.value})} className="w-full glass-input text-sm text-white px-3 py-2 rounded-xl outline-none" /></div>
                <div><label className="text-xs text-white/50 mb-1 block">IP</label><input value={newVps.ip} onChange={e => setNewVps({...newVps, ip: e.target.value})} className="w-full glass-input text-sm text-white px-3 py-2 rounded-xl outline-none" /></div>
              </div>
              <button onClick={handleAddVps} disabled={loading} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-green-500/20 text-green-400 text-xs"><Save size={14} /> Добавить</button>
            </div>
          )}
          {vpsServers.length === 0 ? <div className="glass-card rounded-2xl p-8 text-center text-xs text-white/30">Нет VPS серверов</div> :
           vpsServers.map(vps => (
            <div key={vps.id} className="glass-card rounded-2xl p-4 flex items-center justify-between">
              <div><div className="text-sm text-white">{vps.name}</div><div className="text-[10px] text-white/30">{vps.ip}</div></div>
              <button onClick={() => handleDeleteVps(vps.id)} className="p-2 text-red-400/50 hover:text-red-400"><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'templates' && (
        <div className="space-y-4">
          <button onClick={() => setShowAddTemplate(!showAddTemplate)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-500/20 text-indigo-400 text-xs"><Plus size={14} /> Добавить шаблон</button>
          {showAddTemplate && (
            <div className="glass-card rounded-2xl p-4 space-y-3 max-w-2xl">
              <div><label className="text-xs text-white/50 mb-1 block">Название</label><input value={newTemplate.name} onChange={e => setNewTemplate({...newTemplate, name: e.target.value})} className="w-full glass-input text-sm text-white px-3 py-2 rounded-xl outline-none" /></div>
              <div><label className="text-xs text-white/50 mb-1 block">HTML</label><textarea value={newTemplate.htmlContent} onChange={e => setNewTemplate({...newTemplate, htmlContent: e.target.value})} className="w-full glass-input text-xs text-white p-3 rounded-xl outline-none h-40 resize-none font-mono" /></div>
              <button onClick={handleAddTemplate} disabled={loading} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-green-500/20 text-green-400 text-xs"><Save size={14} /> Добавить</button>
            </div>
          )}
          {templates.length === 0 ? <div className="glass-card rounded-2xl p-8 text-center text-xs text-white/30">Нет шаблонов</div> :
           templates.map(tpl => (
            <div key={tpl.id} className="glass-card rounded-2xl p-4 flex items-center justify-between">
              <div className="text-sm text-white">{tpl.name}</div>
              <button onClick={() => handleDeleteTemplate(tpl.id)} className="p-2 text-red-400/50 hover:text-red-400"><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'nodes' && (
        <div className="space-y-4">
          <div className="glass-card rounded-2xl p-4 space-y-2">
            <h3 className="text-sm font-semibold text-white">Установка ноды</h3>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-[10px] text-white/50 bg-black/20 p-2 rounded-lg overflow-x-auto">{getInstallCommand()}</code>
              <button onClick={copyInstallCmd} className="p-2 rounded-lg bg-white/5 text-white/40 hover:text-white/60 shrink-0">
                {installCopied ? <CheckCircle size={14} className="text-green-400" /> : <Copy size={14} />}
              </button>
            </div>
          </div>
          {workerNodes.length === 0 ? <div className="glass-card rounded-2xl p-8 text-center text-xs text-white/30">Нет нод</div> :
           workerNodes.map(node => (
            <div key={node.nodeId} className="glass-card rounded-2xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className={`w-2.5 h-2.5 rounded-full ${node.isOnline ? 'bg-green-400' : 'bg-red-400'}`} />
                <div><div className="text-sm text-white">{node.name}</div><div className="text-[10px] text-white/30">{node.accountsCount} акк. • {new Date(node.lastSeen).toLocaleString('ru')}</div></div>
              </div>
              <button onClick={() => removeNode(node.nodeId)} className="p-2 text-red-400/50 hover:text-red-400"><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
