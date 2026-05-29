import { useState, useEffect } from 'react';
import {
  Settings, Server, Key, Globe, Save, Plus, Trash2, Check, AlertCircle,
  Loader2, Lock, Eye, EyeOff, Cpu, Copy, CheckCircle, RefreshCw,
} from 'lucide-react';

interface VpsServer {
  id: string;
  name: string;
  ip: string;
  ssh_user: string;
  ssh_port: number;
  status: string;
  last_heartbeat: string;
  tasks_count: number;
}

interface ScreenTemplate {
  id: string;
  name: string;
  html_content: string;
  placeholder_url: string;
  created_at: string;
}

interface WorkerNode {
  nodeId: string;
  name: string;
  ip: string;
  port: number;
  status: string;
  version: string;
  capabilities: string[];
  systemInfo: Record<string, unknown>;
  lastHeartbeat: number;
  registeredAt: string;
  tasksCompleted: number;
  tasksRunning: number;
  errors: number;
  isOnline: boolean;
  lastSeen: number | null;
  load?: Record<string, unknown>;
}

export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState<'settings' | 'vps' | 'domains' | 'templates' | 'nodes'>('settings');

  // Settings state
  const [adminUsername, setAdminUsername] = useState('admin');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);

  // Domains
  const [adminDomain, setAdminDomain] = useState('');
  const [workerDomain, setWorkerDomain] = useState('');

  // VPS servers
  const [vpsServers, setVpsServers] = useState<VpsServer[]>([]);
  const [showAddVps, setShowAddVps] = useState(false);
  const [newVps, setNewVps] = useState({ name: '', ip: '', sshUser: 'root', sshPassword: '', sshPort: 22 });

  // Templates
  const [templates, setTemplates] = useState<ScreenTemplate[]>([]);
  const [showAddTemplate, setShowAddTemplate] = useState(false);
  const [newTemplate, setNewTemplate] = useState({ name: '', htmlContent: '', placeholderUrl: 'https://example.com' });
  const [editingTemplate, setEditingTemplate] = useState<string | null>(null);
  const [editHtml, setEditHtml] = useState('');

  // Worker nodes
  const [workerNodes, setWorkerNodes] = useState<WorkerNode[]>([]);
  const [installCopied, setInstallCopied] = useState(false);

  // UI state
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  useEffect(() => { loadData(); }, []);

  // Auto-refresh nodes every 15 sec when on nodes tab
  useEffect(() => {
    if (activeTab !== 'nodes') return;
    loadNodes();
    const iv = setInterval(loadNodes, 15000);
    return () => clearInterval(iv);
  }, [activeTab]);

  const loadNodes = async () => {
    try {
      const res = await fetch('/api/nodes');
      const data = await res.json();
      setWorkerNodes(data.nodes || []);
    } catch { /* ignore */ }
  };

  const removeNode = async (nodeId: string) => {
    try {
      await fetch(`/api/nodes/${nodeId}`, { method: 'DELETE' });
      setWorkerNodes(prev => prev.filter(n => n.nodeId !== nodeId));
    } catch { setError('Ошибка удаления ноды'); }
  };

  const getInstallCommand = () => {
    const origin = window.location.origin;
    return `curl -sL ${origin}/install-worker.sh | bash -s -- --master ${origin} --name "Worker-$(date +%s)" --port 3001`;
  };

  const copyInstallCmd = () => {
    navigator.clipboard.writeText(getInstallCommand());
    setInstallCopied(true);
    setTimeout(() => setInstallCopied(false), 3000);
  };

  useEffect(() => {
    if (success) { const t = setTimeout(() => setSuccess(''), 5000); return () => clearTimeout(t); }
  }, [success]);

  useEffect(() => {
    if (error) { const t = setTimeout(() => setError(''), 5000); return () => clearTimeout(t); }
  }, [error]);

  const loadData = async () => {
    try {
      const [vpsRes, templatesRes, settingsRes] = await Promise.all([
        fetch('/api/vps').then(r => r.json()).catch(() => ({ servers: [] })),
        fetch('/api/screen-templates').then(r => r.json()).catch(() => ({ templates: [] })),
        fetch('/api/admin/settings').then(r => r.json()).catch(() => ({ settings: {} })),
      ]);
      setVpsServers(vpsRes.servers || []);
      setTemplates(templatesRes.templates || []);
      if (settingsRes.settings) {
        setAdminDomain(settingsRes.settings.adminDomain || '');
        setWorkerDomain(settingsRes.settings.workerDomain || '');
      }
    } catch (e) {
      console.error('Failed to load admin data:', e);
    }
  };

  const handleChangePassword = async () => {
    setError(''); setSuccess('');
    if (newPassword !== confirmPassword) { setError('Пароли не совпадают'); return; }
    if (newPassword.length < 6) { setError('Пароль минимум 6 символов'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newUsername: adminUsername, newPassword }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccess('Данные авторизации обновлены!');
        setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
      } else { setError(data.error || 'Ошибка при смене пароля'); }
    } catch { setError('Ошибка сети'); }
    setLoading(false);
  };

  const handleSaveDomains = async () => {
    setLoading(true);
    try {
      await fetch('/api/admin/settings/bulk', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: { adminDomain, workerDomain } }),
      });
      setSuccess('Домены сохранены!');
    } catch { setError('Ошибка сохранения'); }
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

  const handleDeleteVps = async (id: string) => {
    try { await fetch(`/api/vps/${id}`, { method: 'DELETE' }); setVpsServers(vpsServers.filter(v => v.id !== id)); } catch { setError('Ошибка удаления'); }
  };

  const handleAddTemplate = async () => {
    if (!newTemplate.name || !newTemplate.htmlContent) { setError('Заполните название и HTML'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/screen-templates', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTemplate),
      });
      const data = await res.json();
      if (data.success) {
        setTemplates([...templates, data.template]);
        setNewTemplate({ name: '', htmlContent: '', placeholderUrl: 'https://example.com' });
        setShowAddTemplate(false);
        setSuccess('Шаблон добавлен!');
      }
    } catch { setError('Ошибка добавления'); }
    setLoading(false);
  };

  const handleDeleteTemplate = async (id: string) => {
    try { await fetch(`/api/screen-templates/${id}`, { method: 'DELETE' }); setTemplates(templates.filter(t => t.id !== id)); } catch { setError('Ошибка удаления'); }
  };

  const handleUpdateTemplate = async (id: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/screen-templates/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ htmlContent: editHtml }),
      });
      const data = await res.json();
      if (data.success) {
        setTemplates(templates.map(t => t.id === id ? { ...t, html_content: editHtml } : t));
        setEditingTemplate(null);
        setSuccess('Шаблон обновлён!');
      }
    } catch { setError('Ошибка обновления'); }
    setLoading(false);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6 animate-fade-in overflow-y-auto max-h-[calc(100vh-52px)]">
      <div>
        <h1 className="text-2xl font-semibold text-white flex items-center gap-3"><Settings size={24} />Админ-панель</h1>
        <p className="text-white/50 text-sm mt-1">Настройки системы</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {[
          { id: 'settings' as const, label: 'Авторизация', icon: <Lock size={16} /> },
          { id: 'domains' as const, label: 'Домены', icon: <Globe size={16} /> },
          { id: 'vps' as const, label: 'VPS Серверы', icon: <Server size={16} /> },
          { id: 'templates' as const, label: 'Шаблоны скринов', icon: <Key size={16} /> },
          { id: 'nodes' as const, label: `Ноды (${workerNodes.filter(n=>n.isOnline).length}/${workerNodes.length})`, icon: <Cpu size={16} /> },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm transition-all ${
              activeTab === tab.id ? 'glass-btn text-white' : 'bg-white/5 text-white/60 hover:bg-white/10'
            }`}>
            {tab.icon}{tab.label}
          </button>
        ))}
      </div>

      {/* Messages */}
      {success && (
        <div className="flex items-center gap-2 text-green-400 text-sm p-3 rounded-xl glass-card border border-green-500/30">
          <Check size={16} />{success}
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 text-red-400 text-sm p-3 rounded-xl glass-card border border-red-500/30">
          <AlertCircle size={16} />{error}
        </div>
      )}

      {/* Settings tab */}
      {activeTab === 'settings' && (
        <div className="glass-card rounded-2xl p-6 space-y-4 max-w-lg">
          <h3 className="text-sm font-semibold text-white">Изменить авторизацию</h3>
          <div>
            <label className="text-xs text-white/50 mb-1 block">Логин админа</label>
            <input value={adminUsername} onChange={e => setAdminUsername(e.target.value)}
              className="w-full glass-input text-sm text-white px-3 py-2 rounded-xl outline-none" />
          </div>
          <div>
            <label className="text-xs text-white/50 mb-1 block">Текущий пароль</label>
            <div className="relative">
              <input type={showCurrentPass ? 'text' : 'password'} value={currentPassword} onChange={e => setCurrentPassword(e.target.value)}
                className="w-full glass-input text-sm text-white px-3 py-2 pr-10 rounded-xl outline-none" />
              <button onClick={() => setShowCurrentPass(!showCurrentPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30">
                {showCurrentPass ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>
          <div>
            <label className="text-xs text-white/50 mb-1 block">Новый пароль</label>
            <div className="relative">
              <input type={showNewPass ? 'text' : 'password'} value={newPassword} onChange={e => setNewPassword(e.target.value)}
                className="w-full glass-input text-sm text-white px-3 py-2 pr-10 rounded-xl outline-none" />
              <button onClick={() => setShowNewPass(!showNewPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30">
                {showNewPass ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>
          <div>
            <label className="text-xs text-white/50 mb-1 block">Подтвердить пароль</label>
            <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
              className="w-full glass-input text-sm text-white px-3 py-2 rounded-xl outline-none" />
          </div>
          <button onClick={handleChangePassword} disabled={loading} className="flex items-center gap-2 px-6 py-2 rounded-xl glass-btn text-sm disabled:opacity-30">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Сохранить
          </button>
        </div>
      )}

      {/* Domains tab */}
      {activeTab === 'domains' && (
        <div className="glass-card rounded-2xl p-6 space-y-4 max-w-lg">
          <h3 className="text-sm font-semibold text-white">Домены</h3>
          <div>
            <label className="text-xs text-white/50 mb-1 block">Домен админки</label>
            <input value={adminDomain} onChange={e => setAdminDomain(e.target.value)} placeholder="admin.example.com"
              className="w-full glass-input text-sm text-white px-3 py-2 rounded-xl outline-none" />
          </div>
          <div>
            <label className="text-xs text-white/50 mb-1 block">Домен воркеров</label>
            <input value={workerDomain} onChange={e => setWorkerDomain(e.target.value)} placeholder="worker.example.com"
              className="w-full glass-input text-sm text-white px-3 py-2 rounded-xl outline-none" />
          </div>
          <button onClick={handleSaveDomains} disabled={loading} className="flex items-center gap-2 px-6 py-2 rounded-xl glass-btn text-sm disabled:opacity-30">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Сохранить
          </button>
        </div>
      )}

      {/* VPS tab */}
      {activeTab === 'vps' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => setShowAddVps(!showAddVps)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-500/20 text-indigo-400 text-sm hover:bg-indigo-500/30">
              <Plus size={16} /> Добавить VPS
            </button>
          </div>
          {showAddVps && (
            <div className="glass-card rounded-2xl p-5 space-y-3">
              <h3 className="text-sm font-semibold text-white">Новый VPS</h3>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-white/50 mb-1 block">Имя</label><input value={newVps.name} onChange={e => setNewVps({ ...newVps, name: e.target.value })} className="w-full glass-input text-sm text-white px-3 py-2 rounded-xl outline-none" placeholder="VPS-1" /></div>
                <div><label className="text-xs text-white/50 mb-1 block">IP</label><input value={newVps.ip} onChange={e => setNewVps({ ...newVps, ip: e.target.value })} className="w-full glass-input text-sm text-white px-3 py-2 rounded-xl outline-none" placeholder="1.2.3.4" /></div>
                <div><label className="text-xs text-white/50 mb-1 block">SSH User</label><input value={newVps.sshUser} onChange={e => setNewVps({ ...newVps, sshUser: e.target.value })} className="w-full glass-input text-sm text-white px-3 py-2 rounded-xl outline-none" /></div>
                <div><label className="text-xs text-white/50 mb-1 block">SSH Port</label><input type="number" value={newVps.sshPort} onChange={e => setNewVps({ ...newVps, sshPort: Number(e.target.value) })} className="w-full glass-input text-sm text-white px-3 py-2 rounded-xl outline-none" /></div>
              </div>
              <div><label className="text-xs text-white/50 mb-1 block">Пароль SSH</label><input type="password" value={newVps.sshPassword} onChange={e => setNewVps({ ...newVps, sshPassword: e.target.value })} className="w-full glass-input text-sm text-white px-3 py-2 rounded-xl outline-none" /></div>
              <button onClick={handleAddVps} disabled={loading} className="glass-btn px-6 py-2 rounded-xl text-sm">
                {loading ? <Loader2 size={14} className="animate-spin" /> : 'Добавить'}
              </button>
            </div>
          )}
          {vpsServers.length === 0 ? (
            <div className="glass-card rounded-2xl p-12 text-center"><Server size={48} className="mx-auto mb-4 text-white/10" /><div className="text-sm text-white/30">Нет VPS серверов</div></div>
          ) : vpsServers.map(vps => (
            <div key={vps.id} className="glass-card rounded-2xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-2.5 h-2.5 rounded-full ${vps.status === 'online' ? 'bg-green-400' : 'bg-red-400'}`} />
                <div>
                  <div className="text-sm text-white font-medium">{vps.name}</div>
                  <div className="text-[10px] text-white/30">{vps.ip} • {vps.ssh_user}:{vps.ssh_port}</div>
                </div>
              </div>
              <button onClick={() => handleDeleteVps(vps.id)} className="p-2 rounded-lg text-red-400/50 hover:text-red-400 hover:bg-red-500/10"><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
      )}

      {/* Templates tab */}
      {activeTab === 'templates' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => setShowAddTemplate(!showAddTemplate)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-500/20 text-indigo-400 text-sm hover:bg-indigo-500/30">
              <Plus size={16} /> Добавить шаблон
            </button>
          </div>
          {showAddTemplate && (
            <div className="glass-card rounded-2xl p-5 space-y-3">
              <h3 className="text-sm font-semibold text-white">Новый шаблон скрина</h3>
              <div>
                <label className="text-xs text-white/50 mb-1 block">Название</label>
                <input value={newTemplate.name} onChange={e => setNewTemplate({ ...newTemplate, name: e.target.value })}
                  className="w-full glass-input text-sm text-white px-3 py-2 rounded-xl outline-none" placeholder="Шаблон #1" />
              </div>
              <div>
                <label className="text-xs text-white/50 mb-1 block">URL-заглушка</label>
                <input value={newTemplate.placeholderUrl} onChange={e => setNewTemplate({ ...newTemplate, placeholderUrl: e.target.value })}
                  className="w-full glass-input text-sm text-white px-3 py-2 rounded-xl outline-none font-mono" placeholder="https://example.com" />
              </div>
              <div>
                <label className="text-xs text-white/50 mb-1 block">HTML содержимое</label>
                <textarea value={newTemplate.htmlContent} onChange={e => setNewTemplate({ ...newTemplate, htmlContent: e.target.value })}
                  className="w-full glass-input text-xs text-white p-3 rounded-xl outline-none h-48 resize-none font-mono"
                  placeholder={'<!DOCTYPE html>\n<html>\n<head><title>Template</title></head>\n<body>\n  <h1>Hello</h1>\n</body>\n</html>'} />
              </div>
              <div className="flex gap-2">
                <button onClick={handleAddTemplate} disabled={loading} className="flex items-center gap-2 px-6 py-2 rounded-xl glass-btn text-sm disabled:opacity-30">
                  {loading ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Сохранить
                </button>
                <button onClick={() => setShowAddTemplate(false)} className="px-4 py-2 rounded-xl bg-white/5 text-white/50 text-sm hover:bg-white/10">Отмена</button>
              </div>
            </div>
          )}

          {templates.length === 0 ? (
            <div className="glass-card rounded-2xl p-12 text-center">
              <Key size={48} className="mx-auto mb-4 text-white/10" />
              <div className="text-sm text-white/30">Нет шаблонов скринов</div>
              <div className="text-xs text-white/20 mt-1">Создайте шаблон для генерации скринов</div>
            </div>
          ) : templates.map(template => (
            <div key={template.id} className="glass-card rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-white font-medium">{template.name}</div>
                  <div className="text-[10px] text-white/30">
                    URL: {template.placeholder_url} • Создан: {new Date(template.created_at).toLocaleDateString('ru')}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => {
                    if (editingTemplate === template.id) { setEditingTemplate(null); }
                    else { setEditingTemplate(template.id); setEditHtml(template.html_content || ''); }
                  }} className="px-3 py-1.5 rounded-lg bg-white/5 text-white/50 text-xs hover:bg-white/10">
                    {editingTemplate === template.id ? 'Свернуть' : 'Редактировать'}
                  </button>
                  <button onClick={() => handleDeleteTemplate(template.id)} className="p-1.5 rounded-lg text-red-400/50 hover:text-red-400 hover:bg-red-500/10">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              {editingTemplate === template.id && (
                <div className="space-y-3 pt-2 border-t border-white/5">
                  <textarea value={editHtml} onChange={e => setEditHtml(e.target.value)}
                    className="w-full glass-input text-xs text-white p-3 rounded-xl outline-none h-48 resize-none font-mono" />
                  <div className="flex gap-2">
                    <button onClick={() => handleUpdateTemplate(template.id)} disabled={loading}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl glass-btn text-xs disabled:opacity-30">
                      {loading ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Сохранить
                    </button>
                    <button onClick={() => setEditingTemplate(null)} className="px-3 py-2 rounded-xl bg-white/5 text-white/50 text-xs">Отмена</button>
                  </div>
                </div>
              )}
              {editingTemplate !== template.id && template.html_content && (
                <div className="bg-white/3 rounded-xl p-3 max-h-24 overflow-hidden">
                  <pre className="text-[10px] text-white/30 whitespace-pre-wrap break-all">{template.html_content.substring(0, 300)}{template.html_content.length > 300 ? '...' : ''}</pre>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Nodes tab */}
      {activeTab === 'nodes' && (
        <div className="space-y-4">
          {/* Install command */}
          <div className="glass-card rounded-2xl p-5 space-y-3">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Cpu size={16} className="text-cyan-400" /> Установка воркер-ноды на новый VPS
            </h3>
            <p className="text-xs text-white/40">
              Скопируйте команду и выполните на новом VPS. Нода автоматически установит зависимости, 
              зарегистрируется здесь и запустится через PM2.
            </p>
            <div className="relative">
              <pre className="glass-input text-[11px] text-green-400 p-3 pr-12 rounded-xl overflow-x-auto font-mono whitespace-pre-wrap break-all">
                {getInstallCommand()}
              </pre>
              <button
                onClick={copyInstallCmd}
                className="absolute top-2 right-2 p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/60 transition-colors"
                title="Скопировать"
              >
                {installCopied ? <CheckCircle size={14} className="text-green-400" /> : <Copy size={14} />}
              </button>
            </div>
            <div className="text-[10px] text-white/20 space-y-0.5">
              <div>💡 Можно указать своё имя: <code className="text-white/40">--name "Amsterdam-1"</code></div>
              <div>💡 Другой порт: <code className="text-white/40">--port 3002</code></div>
            </div>
          </div>

          {/* Nodes list */}
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">
              Воркер-ноды ({workerNodes.filter(n => n.isOnline).length} онлайн / {workerNodes.length} всего)
            </h3>
            <button onClick={loadNodes} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 text-white/50 text-xs hover:bg-white/10">
              <RefreshCw size={12} /> Обновить
            </button>
          </div>

          {workerNodes.length === 0 ? (
            <div className="glass-card rounded-2xl p-12 text-center">
              <Cpu size={48} className="mx-auto mb-4 text-white/10" />
              <div className="text-sm text-white/30">Нет подключённых воркер-нод</div>
              <div className="text-xs text-white/20 mt-1">Выполните команду установки на другом VPS</div>
            </div>
          ) : (
            <div className="space-y-3">
              {workerNodes.map(node => (
                <div key={node.nodeId} className="glass-card rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${node.isOnline ? 'bg-green-400 animate-pulse' : 'bg-gray-500'}`} />
                      <div>
                        <div className="text-sm text-white font-medium">{node.name}</div>
                        <div className="text-[10px] text-white/30">
                          {node.ip}:{node.port} • v{node.version}
                          {node.lastSeen !== null && !node.isOnline && ` • последний раз ${node.lastSeen}с назад`}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${node.isOnline ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                        {node.isOnline ? '● Онлайн' : '● Оффлайн'}
                      </span>
                      <button onClick={() => removeNode(node.nodeId)}
                        className="p-1.5 rounded-lg text-red-400/40 hover:text-red-400 hover:bg-red-500/10">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-4 gap-2">
                    <div className="bg-white/3 rounded-lg p-2 text-center">
                      <div className="text-xs font-bold text-green-400">{node.tasksCompleted || 0}</div>
                      <div className="text-[9px] text-white/30">Выполнено</div>
                    </div>
                    <div className="bg-white/3 rounded-lg p-2 text-center">
                      <div className="text-xs font-bold text-blue-400">{node.tasksRunning || 0}</div>
                      <div className="text-[9px] text-white/30">В работе</div>
                    </div>
                    <div className="bg-white/3 rounded-lg p-2 text-center">
                      <div className="text-xs font-bold text-red-400">{node.errors || 0}</div>
                      <div className="text-[9px] text-white/30">Ошибки</div>
                    </div>
                    <div className="bg-white/3 rounded-lg p-2 text-center">
                      <div className="text-xs font-bold text-white">{String((node.load as Record<string, unknown>)?.activeSessions ?? 0)}</div>
                      <div className="text-[9px] text-white/30">Сессии</div>
                    </div>
                  </div>

                  {/* System info */}
                  {node.systemInfo && node.isOnline && (() => {
                    const si = node.systemInfo as Record<string, number | string>;
                    const caps = node.capabilities || [];
                    return (
                      <div className="flex flex-wrap gap-2 text-[9px]">
                        {si.cpus ? <span className="px-1.5 py-0.5 rounded bg-white/5 text-white/30">CPU: {String(si.cpus)}</span> : null}
                        {si.totalMemMB ? <span className="px-1.5 py-0.5 rounded bg-white/5 text-white/30">RAM: {String(si.freeMemMB)}/{String(si.totalMemMB)} MB</span> : null}
                        {si.usedMemPercent !== undefined ? <span className={`px-1.5 py-0.5 rounded ${Number(si.usedMemPercent) > 80 ? 'bg-red-500/10 text-red-400/60' : 'bg-white/5 text-white/30'}`}>Mem: {String(si.usedMemPercent)}%</span> : null}
                        {si.nodeVersion ? <span className="px-1.5 py-0.5 rounded bg-white/5 text-white/30">Node {String(si.nodeVersion)}</span> : null}
                        {caps.length > 0 ? <span className="px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400/60">{caps.join(', ')}</span> : null}
                      </div>
                    );
                  })()}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
