import { useState, useEffect } from 'react';
import { 
  Settings, 
  Server, 
  Key, 
  Globe, 
  Save, 
  Plus, 
  Trash2, 
  Check, 
  AlertCircle,
  Download,
  Loader2,
  Lock,
  User
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
  placeholder_url: string;
  created_at: string;
}

export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState<'settings' | 'vps' | 'domains' | 'templates'>('settings');
  
  // Settings state
  const [adminUsername, setAdminUsername] = useState('admin');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
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
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  // Load data
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [vpsRes, templatesRes, settingsRes] = await Promise.all([
        fetch('/api/vps').then(r => r.json()),
        fetch('/api/screen-templates').then(r => r.json()),
        fetch('/api/admin/settings').then(r => r.json()),
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
    setError('');
    setSuccess('');
    
    if (newPassword !== confirmPassword) {
      setError('Пароли не совпадают');
      return;
    }
    
    if (newPassword.length < 6) {
      setError('Пароль должен быть минимум 6 символов');
      return;
    }
    
    setLoading(true);
    
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          currentPassword, 
          newUsername: adminUsername,
          newPassword 
        }),
      });
      
      const data = await res.json();
      
      if (data.success) {
        setSuccess('Данные авторизации обновлены!');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        
        // Update localStorage
        localStorage.setItem('currentUsername', adminUsername);
      } else {
        setError(data.error || 'Ошибка при смене пароля');
      }
    } catch (e) {
      setError('Ошибка сети');
    }
    
    setLoading(false);
  };

  const handleSaveDomains = async () => {
    setLoading(true);
    
    try {
      await fetch('/api/admin/settings/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          settings: { adminDomain, workerDomain } 
        }),
      });
      
      setSuccess('Домены сохранены!');
    } catch (e) {
      setError('Ошибка сохранения');
    }
    
    setLoading(false);
  };

  const handleAddVps = async () => {
    if (!newVps.name || !newVps.ip || !newVps.sshUser) {
      setError('Заполните все обязательные поля');
      return;
    }
    
    setLoading(true);
    
    try {
      const res = await fetch('/api/vps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newVps),
      });
      
      const data = await res.json();
      
      if (data.success) {
        setVpsServers([...vpsServers, data.server]);
        setNewVps({ name: '', ip: '', sshUser: 'root', sshPassword: '', sshPort: 22 });
        setShowAddVps(false);
        setSuccess('VPS добавлен!');
      }
    } catch (e) {
      setError('Ошибка добавления');
    }
    
    setLoading(false);
  };

  const handleDeleteVps = async (id: string) => {
    try {
      await fetch(`/api/vps/${id}`, { method: 'DELETE' });
      setVpsServers(vpsServers.filter(v => v.id !== id));
    } catch (e) {
      setError('Ошибка удаления');
    }
  };

  const handleInstallWorker = async (id: string) => {
    try {
      const res = await fetch(`/api/vps/${id}/install`, { method: 'POST' });
      const data = await res.json();
      
      if (data.success) {
        setSuccess('Установка воркера запущена!');
        loadData();
      }
    } catch (e) {
      setError('Ошибка установки');
    }
  };

  const handleAddTemplate = async () => {
    if (!newTemplate.name || !newTemplate.htmlContent) {
      setError('Заполните название и HTML');
      return;
    }
    
    setLoading(true);
    
    try {
      const res = await fetch('/api/screen-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTemplate),
      });
      
      const data = await res.json();
      
      if (data.success) {
        setTemplates([...templates, data.template]);
        setNewTemplate({ name: '', htmlContent: '', placeholderUrl: 'https://example.com' });
        setShowAddTemplate(false);
        setSuccess('Шаблон добавлен!');
      }
    } catch (e) {
      setError('Ошибка добавления');
    }
    
    setLoading(false);
  };

  const handleDeleteTemplate = async (id: string) => {
    try {
      await fetch(`/api/screen-templates/${id}`, { method: 'DELETE' });
      setTemplates(templates.filter(t => t.id !== id));
    } catch (e) {
      setError('Ошибка удаления');
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white flex items-center gap-3">
          <Settings size={24} />
          Админ-панель
        </h1>
        <p className="text-white/50 text-sm mt-1">Настройки системы</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {[
          { id: 'settings', label: 'Авторизация', icon: <Lock size={16} /> },
          { id: 'domains', label: 'Домены', icon: <Globe size={16} /> },
          { id: 'vps', label: 'VPS Серверы', icon: <Server size={16} /> },
          { id: 'templates', label: 'Шаблоны скринов', icon: <Key size={16} /> },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm transition-all ${
              activeTab === tab.id 
                ? 'glass-accent text-white' 
                : 'glass-button text-white/60'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Messages */}
      {success && (
        <div className="flex items-center gap-2 text-green-400 text-sm p-3 rounded-xl glass border border-green-500/30">
          <Check size={16} />
          {success}
        </div>
      )}
      
      {error && (
        <div className="flex items-center gap-2 text-red-400 text-sm p-3 rounded-xl glass border border-red-500/30">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {/* Settings Tab */}
      {activeTab === 'settings' && (
        <div className="glass-card rounded-2xl p-5 space-y-4">
          <h2 className="text-white font-medium flex items-center gap-2">
            <User size={18} />
            Смена логина и пароля
          </h2>
          
          <div className="space-y-3">
            <div>
              <label className="text-xs text-white/50 block mb-1">Новый логин</label>
              <input
                type="text"
                value={adminUsername}
                onChange={e => setAdminUsername(e.target.value)}
                className="w-full glass-input text-sm text-white px-4 py-2 rounded-xl outline-none"
              />
            </div>
            
            <div>
              <label className="text-xs text-white/50 block mb-1">Текущий пароль</label>
              <input
                type="password"
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                placeholder="Введите текущий пароль"
                className="w-full glass-input text-sm text-white px-4 py-2 rounded-xl outline-none"
              />
            </div>
            
            <div>
              <label className="text-xs text-white/50 block mb-1">Новый пароль</label>
              <input
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="Минимум 6 символов"
                className="w-full glass-input text-sm text-white px-4 py-2 rounded-xl outline-none"
              />
            </div>
            
            <div>
              <label className="text-xs text-white/50 block mb-1">Подтвердите пароль</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Повторите новый пароль"
                className="w-full glass-input text-sm text-white px-4 py-2 rounded-xl outline-none"
              />
            </div>
          </div>
          
          <button
            onClick={handleChangePassword}
            disabled={loading || !currentPassword || !newPassword}
            className="w-full py-2.5 glass-accent rounded-xl text-white font-medium flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
            Сохранить
          </button>
        </div>
      )}

      {/* Domains Tab */}
      {activeTab === 'domains' && (
        <div className="glass-card rounded-2xl p-5 space-y-4">
          <h2 className="text-white font-medium flex items-center gap-2">
            <Globe size={18} />
            Привязка доменов
          </h2>
          
          <div className="space-y-3">
            <div>
              <label className="text-xs text-white/50 block mb-1">Домен для админки</label>
              <input
                type="text"
                value={adminDomain}
                onChange={e => setAdminDomain(e.target.value)}
                placeholder="admin.example.com"
                className="w-full glass-input text-sm text-white px-4 py-2 rounded-xl outline-none"
              />
            </div>
            
            <div>
              <label className="text-xs text-white/50 block mb-1">Домен для воркеров</label>
              <input
                type="text"
                value={workerDomain}
                onChange={e => setWorkerDomain(e.target.value)}
                placeholder="worker.example.com"
                className="w-full glass-input text-sm text-white px-4 py-2 rounded-xl outline-none"
              />
            </div>
          </div>
          
          <p className="text-xs text-white/30">
            После сохранения настройте DNS записи и nginx/reverse proxy на вашем сервере
          </p>
          
          <button
            onClick={handleSaveDomains}
            disabled={loading}
            className="w-full py-2.5 glass-accent rounded-xl text-white font-medium flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
            Сохранить домены
          </button>
        </div>
      )}

      {/* VPS Tab */}
      {activeTab === 'vps' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-white font-medium flex items-center gap-2">
              <Server size={18} />
              VPS Серверы для распределения нагрузки
            </h2>
            <button
              onClick={() => setShowAddVps(true)}
              className="flex items-center gap-2 px-4 py-2 glass-accent rounded-xl text-white text-sm"
            >
              <Plus size={16} />
              Добавить VPS
            </button>
          </div>
          
          <p className="text-xs text-white/40">
            Добавьте VPS серверы для распределения тяжёлых задач (парсинг и т.д.)
          </p>

          {/* Add VPS Modal */}
          {showAddVps && (
            <div className="glass-card rounded-2xl p-5 space-y-4">
              <h3 className="text-white font-medium">Добавить VPS</h3>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-white/50 block mb-1">Название</label>
                  <input
                    type="text"
                    value={newVps.name}
                    onChange={e => setNewVps({ ...newVps, name: e.target.value })}
                    placeholder="VPS-1"
                    className="w-full glass-input text-sm text-white px-3 py-2 rounded-xl outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-white/50 block mb-1">IP адрес</label>
                  <input
                    type="text"
                    value={newVps.ip}
                    onChange={e => setNewVps({ ...newVps, ip: e.target.value })}
                    placeholder="192.168.1.1"
                    className="w-full glass-input text-sm text-white px-3 py-2 rounded-xl outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-white/50 block mb-1">SSH пользователь</label>
                  <input
                    type="text"
                    value={newVps.sshUser}
                    onChange={e => setNewVps({ ...newVps, sshUser: e.target.value })}
                    placeholder="root"
                    className="w-full glass-input text-sm text-white px-3 py-2 rounded-xl outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-white/50 block mb-1">SSH порт</label>
                  <input
                    type="number"
                    value={newVps.sshPort}
                    onChange={e => setNewVps({ ...newVps, sshPort: parseInt(e.target.value) || 22 })}
                    className="w-full glass-input text-sm text-white px-3 py-2 rounded-xl outline-none"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-white/50 block mb-1">SSH пароль</label>
                  <input
                    type="password"
                    value={newVps.sshPassword}
                    onChange={e => setNewVps({ ...newVps, sshPassword: e.target.value })}
                    placeholder="••••••••"
                    className="w-full glass-input text-sm text-white px-3 py-2 rounded-xl outline-none"
                  />
                </div>
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={handleAddVps}
                  disabled={loading}
                  className="flex-1 py-2 glass-accent rounded-xl text-white text-sm"
                >
                  Добавить
                </button>
                <button
                  onClick={() => setShowAddVps(false)}
                  className="px-6 py-2 glass-button rounded-xl text-white/60 text-sm"
                >
                  Отмена
                </button>
              </div>
            </div>
          )}

          {/* VPS List */}
          {vpsServers.length === 0 ? (
            <div className="glass-card rounded-2xl p-12 text-center">
              <Server size={48} className="mx-auto mb-4 text-white/20" />
              <p className="text-white/50">Нет VPS серверов</p>
              <p className="text-white/30 text-sm mt-1">Добавьте VPS для распределения нагрузки</p>
            </div>
          ) : (
            <div className="space-y-3">
              {vpsServers.map(vps => (
                <div key={vps.id} className="glass-card rounded-2xl p-4 flex items-center gap-4">
                  <div className={`w-3 h-3 rounded-full ${
                    vps.status === 'online' ? 'bg-green-400' :
                    vps.status === 'installing' ? 'bg-yellow-400 animate-pulse' :
                    vps.status === 'error' ? 'bg-red-400' :
                    'bg-gray-400'
                  }`} />
                  
                  <div className="flex-1">
                    <div className="text-white font-medium">{vps.name}</div>
                    <div className="text-xs text-white/40">
                      {vps.ip} • {vps.ssh_user}@:{vps.ssh_port}
                      {vps.tasks_count > 0 && ` • ${vps.tasks_count} задач`}
                    </div>
                  </div>
                  
                  <span className={`px-2 py-0.5 rounded text-xs ${
                    vps.status === 'online' ? 'bg-green-500/20 text-green-400' :
                    vps.status === 'installing' ? 'bg-yellow-500/20 text-yellow-400' :
                    vps.status === 'error' ? 'bg-red-500/20 text-red-400' :
                    'bg-gray-500/20 text-gray-400'
                  }`}>
                    {vps.status === 'online' ? 'Онлайн' :
                     vps.status === 'installing' ? 'Установка...' :
                     vps.status === 'error' ? 'Ошибка' :
                     'Ожидание'}
                  </span>
                  
                  {vps.status === 'pending' && (
                    <button
                      onClick={() => handleInstallWorker(vps.id)}
                      className="px-3 py-1.5 glass-accent rounded-lg text-white text-xs flex items-center gap-1"
                    >
                      <Download size={12} />
                      Установить
                    </button>
                  )}
                  
                  <button
                    onClick={() => handleDeleteVps(vps.id)}
                    className="p-2 text-white/30 hover:text-red-400"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Templates Tab */}
      {activeTab === 'templates' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-white font-medium">Шаблоны для скриншотов</h2>
            <button
              onClick={() => setShowAddTemplate(true)}
              className="flex items-center gap-2 px-4 py-2 glass-accent rounded-xl text-white text-sm"
            >
              <Plus size={16} />
              Добавить шаблон
            </button>
          </div>
          
          <p className="text-xs text-white/40">
            Загрузите HTML шаблоны для генерации скриншотов. Воркеры смогут заменять ссылки и получать готовые изображения.
          </p>

          {/* Add Template */}
          {showAddTemplate && (
            <div className="glass-card rounded-2xl p-5 space-y-4">
              <h3 className="text-white font-medium">Добавить шаблон</h3>
              
              <div>
                <label className="text-xs text-white/50 block mb-1">Название</label>
                <input
                  type="text"
                  value={newTemplate.name}
                  onChange={e => setNewTemplate({ ...newTemplate, name: e.target.value })}
                  placeholder="Discord Invite"
                  className="w-full glass-input text-sm text-white px-3 py-2 rounded-xl outline-none"
                />
              </div>
              
              <div>
                <label className="text-xs text-white/50 block mb-1">URL-плейсхолдер (будет заменён)</label>
                <input
                  type="text"
                  value={newTemplate.placeholderUrl}
                  onChange={e => setNewTemplate({ ...newTemplate, placeholderUrl: e.target.value })}
                  placeholder="https://example.com"
                  className="w-full glass-input text-sm text-white px-3 py-2 rounded-xl outline-none font-mono"
                />
              </div>
              
              <div>
                <label className="text-xs text-white/50 block mb-1">HTML код</label>
                <textarea
                  value={newTemplate.htmlContent}
                  onChange={e => setNewTemplate({ ...newTemplate, htmlContent: e.target.value })}
                  placeholder="<!DOCTYPE html>..."
                  className="w-full h-48 glass-input text-sm text-white px-3 py-2 rounded-xl outline-none font-mono resize-none"
                />
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={handleAddTemplate}
                  disabled={loading}
                  className="flex-1 py-2 glass-accent rounded-xl text-white text-sm"
                >
                  Добавить
                </button>
                <button
                  onClick={() => setShowAddTemplate(false)}
                  className="px-6 py-2 glass-button rounded-xl text-white/60 text-sm"
                >
                  Отмена
                </button>
              </div>
            </div>
          )}

          {/* Templates List */}
          {templates.length === 0 ? (
            <div className="glass-card rounded-2xl p-12 text-center">
              <Key size={48} className="mx-auto mb-4 text-white/20" />
              <p className="text-white/50">Нет шаблонов</p>
            </div>
          ) : (
            <div className="space-y-2">
              {templates.map(template => (
                <div key={template.id} className="glass-card rounded-xl p-4 flex items-center gap-4">
                  <div className="flex-1">
                    <div className="text-white font-medium">{template.name}</div>
                    <div className="text-xs text-white/40 font-mono">{template.placeholder_url}</div>
                  </div>
                  <button
                    onClick={() => handleDeleteTemplate(template.id)}
                    className="p-2 text-white/30 hover:text-red-400"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
