import { useState } from 'react';
import { Globe2, Plus, Trash2, Shield, CheckCircle, AlertCircle, Copy, Server, ExternalLink, Terminal } from 'lucide-react';
import { useAppStore } from '../store';

export default function DomainsView() {
  const { domains, addDomain, removeDomain, updateDomain } = useAppStore();
  const [showAddModal, setShowAddModal] = useState(false);
  const [newDomain, setNewDomain] = useState('');
  const [newTarget, setNewTarget] = useState<'panel' | 'api'>('panel');
  const [copied, setCopied] = useState<string | null>(null);
  const [showScript, setShowScript] = useState<string | null>(null);

  const handleAdd = () => {
    if (!newDomain.trim()) return;
    const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z]{2,})+$/;
    if (!domainRegex.test(newDomain.trim())) {
      alert('Неверный формат домена. Пример: panel.example.com');
      return;
    }
    addDomain(newDomain.trim().toLowerCase(), newTarget);
    setNewDomain('');
    setShowAddModal(false);
  };

  const handleDelete = (id: string) => {
    if (confirm('Удалить домен?')) {
      removeDomain(id);
    }
  };

  const copyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const markActive = (id: string) => {
    updateDomain(id, { status: 'active', ssl: true, sslExpiry: new Date(Date.now() + 90 * 86400000).toISOString(), errorMessage: undefined });
  };

  const generateNginxConfig = (domain: string, target: 'panel' | 'api') => {
    const port = target === 'panel' ? '3000' : '3001';
    return `server {
    listen 80;
    server_name ${domain};
    return 301 https://\\$server_name\\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name ${domain};

    ssl_certificate /etc/letsencrypt/live/${domain}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${domain}/privkey.pem;

    location / {
        proxy_pass http://localhost:${port};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \\$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \\$host;
        proxy_set_header X-Real-IP \\$remote_addr;
        proxy_set_header X-Forwarded-For \\$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \\$scheme;
        proxy_cache_bypass \\$http_upgrade;
    }
}`;
  };

  const generateSetupScript = (domain: string, target: 'panel' | 'api') => {
    const port = target === 'panel' ? '3000' : '3001';
    return `#!/bin/bash
# Автонастройка домена ${domain}
# Запусти на VPS: bash setup-${domain}.sh

set -e

DOMAIN="${domain}"
PORT="${port}"

echo "🔧 Настройка домена $DOMAIN -> localhost:$PORT"

# 1. Устанавливаем nginx и certbot если нет
apt install -y nginx certbot python3-certbot-nginx 2>/dev/null || true

# 2. Создаем конфигурацию nginx (сначала без SSL для certbot)
cat > /etc/nginx/sites-available/$DOMAIN << 'NGINX'
server {
    listen 80;
    server_name ${domain};

    location / {
        proxy_pass http://localhost:${port};
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
NGINX

# 3. Включаем сайт
ln -sf /etc/nginx/sites-available/$DOMAIN /etc/nginx/sites-enabled/$DOMAIN

# 4. Проверяем и перезапускаем nginx
nginx -t && systemctl reload nginx

# 5. Выпускаем SSL сертификат
certbot --nginx -d $DOMAIN --non-interactive --agree-tos --email admin@$DOMAIN --redirect

# 6. Перезапускаем nginx
systemctl reload nginx

echo ""
echo "✅ Готово!"
echo "🌐 https://$DOMAIN -> localhost:$PORT"
echo "🔒 SSL сертификат установлен (автообновление через certbot)"`;
  };

  const panelDomains = domains.filter(d => d.target === 'panel');
  const apiDomains = domains.filter(d => d.target === 'api');

  return (
    <div className="p-6 space-y-6 animate-fade-in overflow-y-auto max-h-[calc(100vh-52px)]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl glass-accent flex items-center justify-center">
              <Globe2 size={20} />
            </div>
            Домены
          </h1>
          <p className="text-sm text-white/50 mt-1">Управление доменами, nginx и SSL сертификатами</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl glass-accent text-white text-sm"
        >
          <Plus size={16} />
          Добавить домен
        </button>
      </div>

      {/* How it works */}
      <div className="glass-card rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          💡 Как это работает
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-white/60">
          <div className="glass-light rounded-xl p-4">
            <div className="text-blue-400 font-semibold mb-2">1. Добавь домен</div>
            <div>Укажи домен и назначение (панель :3000 или API :3001). DNS A-запись должна указывать на IP сервера.</div>
          </div>
          <div className="glass-light rounded-xl p-4">
            <div className="text-purple-400 font-semibold mb-2">2. Скопируй скрипт</div>
            <div>Нажми «Скрипт настройки» — скопируй и запусти на VPS. Он сам настроит nginx, выпустит SSL.</div>
          </div>
          <div className="glass-light rounded-xl p-4">
            <div className="text-green-400 font-semibold mb-2">3. Отметь как активный</div>
            <div>После запуска скрипта нажми «✅ Активировать» — домен станет зеленым.</div>
          </div>
        </div>
      </div>

      {/* DNS reminder */}
      <div className="glass-card rounded-2xl p-4 border border-yellow-500/20">
        <div className="flex items-start gap-3">
          <AlertCircle size={18} className="text-yellow-400 shrink-0 mt-0.5" />
          <div>
            <div className="text-sm font-medium text-yellow-400 mb-1">Перед добавлением домена</div>
            <div className="text-xs text-white/50 space-y-1">
              <div>• Зайди к регистратору домена и создай <b>A-запись</b> → IP твоего VPS</div>
              <div>• Подожди 5-10 минут пока DNS обновится</div>
              <div>• Порты <b>80</b> и <b>443</b> должны быть открыты на сервере</div>
            </div>
          </div>
        </div>
      </div>

      {/* Panel domains */}
      <div className="glass-card rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Globe2 size={16} className="text-blue-400" />
            Домены панели ({panelDomains.length})
          </h3>
          <span className="text-[10px] text-white/30">reverse-proxy → localhost:3000</span>
        </div>

        {panelDomains.length === 0 ? (
          <div className="text-center py-6 text-white/30 text-sm">Нет доменов для панели</div>
        ) : (
          <div className="space-y-3">
            {panelDomains.map(d => (
              <DomainCard
                key={d.id}
                domain={d}
                onDelete={() => handleDelete(d.id)}
                onCopy={(text) => copyText(text, d.id)}
                onActivate={() => markActive(d.id)}
                onShowScript={() => setShowScript(showScript === d.id ? null : d.id)}
                showingScript={showScript === d.id}
                setupScript={generateSetupScript(d.domain, d.target)}
                nginxConfig={generateNginxConfig(d.domain, d.target)}
                isCopied={copied === d.id}
              />
            ))}
          </div>
        )}
      </div>

      {/* API domains */}
      <div className="glass-card rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Server size={16} className="text-purple-400" />
            Домены API ({apiDomains.length})
          </h3>
          <span className="text-[10px] text-white/30">reverse-proxy → localhost:3001</span>
        </div>

        {apiDomains.length === 0 ? (
          <div className="text-center py-6 text-white/30 text-sm">Нет доменов для API</div>
        ) : (
          <div className="space-y-3">
            {apiDomains.map(d => (
              <DomainCard
                key={d.id}
                domain={d}
                onDelete={() => handleDelete(d.id)}
                onCopy={(text) => copyText(text, d.id)}
                onActivate={() => markActive(d.id)}
                onShowScript={() => setShowScript(showScript === d.id ? null : d.id)}
                showingScript={showScript === d.id}
                setupScript={generateSetupScript(d.domain, d.target)}
                nginxConfig={generateNginxConfig(d.domain, d.target)}
                isCopied={copied === d.id}
              />
            ))}
          </div>
        )}
      </div>

      {/* Add domain modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setShowAddModal(false)}>
          <div className="glass-card rounded-3xl p-6 w-full max-w-md animate-fade-in" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Plus size={20} />
              Добавить домен
            </h3>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-white/50 block mb-2">Домен</label>
                <input
                  type="text"
                  value={newDomain}
                  onChange={e => setNewDomain(e.target.value)}
                  placeholder="panel.example.com"
                  className="w-full glass-input text-sm text-white px-4 py-3 rounded-xl outline-none"
                  onKeyDown={e => e.key === 'Enter' && handleAdd()}
                  autoFocus
                />
              </div>

              <div>
                <label className="text-xs text-white/50 block mb-2">Назначение</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setNewTarget('panel')}
                    className={`p-4 rounded-xl text-center transition-colors ${
                      newTarget === 'panel' ? 'glass-accent text-white' : 'glass-light text-white/50 hover:text-white'
                    }`}
                  >
                    <Globe2 size={24} className="mx-auto mb-2" />
                    <div className="text-xs font-medium">Панель</div>
                    <div className="text-[10px] mt-1 opacity-60">→ localhost:3000</div>
                  </button>
                  <button
                    onClick={() => setNewTarget('api')}
                    className={`p-4 rounded-xl text-center transition-colors ${
                      newTarget === 'api' ? 'glass-accent text-white' : 'glass-light text-white/50 hover:text-white'
                    }`}
                  >
                    <Server size={24} className="mx-auto mb-2" />
                    <div className="text-xs font-medium">API</div>
                    <div className="text-[10px] mt-1 opacity-60">→ localhost:3001</div>
                  </button>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowAddModal(false)} className="flex-1 py-2.5 rounded-xl glass-button text-white/60 text-sm">
                Отмена
              </button>
              <button onClick={handleAdd} disabled={!newDomain.trim()} className="flex-1 py-2.5 rounded-xl glass-accent text-white text-sm disabled:opacity-40">
                Добавить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Domain Card ──────────────────────────────────────────
function DomainCard({ domain, onDelete, onCopy, onActivate, onShowScript, showingScript, setupScript, nginxConfig, isCopied }: {
  domain: any;
  onDelete: () => void;
  onCopy: (text: string) => void;
  onActivate: () => void;
  onShowScript: () => void;
  showingScript: boolean;
  setupScript: string;
  nginxConfig: string;
  isCopied: boolean;
}) {
  const [copiedScript, setCopiedScript] = useState(false);
  const [copiedNginx, setCopiedNginx] = useState(false);

  const copyScript = (text: string, type: 'script' | 'nginx') => {
    navigator.clipboard.writeText(text);
    if (type === 'script') { setCopiedScript(true); setTimeout(() => setCopiedScript(false), 2000); }
    else { setCopiedNginx(true); setTimeout(() => setCopiedNginx(false), 2000); }
  };

  return (
    <div className="glass-light rounded-xl p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-2.5 h-2.5 rounded-full ${
            domain.status === 'active' ? 'bg-green-400' : 'bg-yellow-400 animate-pulse'
          }`} />
          <div>
            <div className="text-sm font-medium text-white flex items-center gap-2">
              {domain.domain}
              <button onClick={() => onCopy(domain.domain)} className="text-white/30 hover:text-white/60" title="Копировать">
                {isCopied ? <CheckCircle size={12} className="text-green-400" /> : <Copy size={12} />}
              </button>
              {domain.status === 'active' && (
                <a href={`https://${domain.domain}`} target="_blank" rel="noopener noreferrer" className="text-white/30 hover:text-blue-400">
                  <ExternalLink size={12} />
                </a>
              )}
            </div>
            <div className="text-[10px] text-white/40 flex items-center gap-2 mt-0.5">
              <span>{domain.target === 'panel' ? '🖥️ Панель → :3000' : '⚡ API → :3001'}</span>
              <span>•</span>
              {domain.status === 'active' && domain.ssl ? (
                <span className="text-green-400 flex items-center gap-1">
                  <Shield size={10} /> SSL активен
                  {domain.sslExpiry && ` (до ${new Date(domain.sslExpiry).toLocaleDateString('ru')})`}
                </span>
              ) : (
                <span className="text-yellow-400">⏳ Ожидает настройки</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {domain.status !== 'active' && (
            <button onClick={onActivate} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] bg-green-500/10 text-green-400 hover:bg-green-500/20" title="Отметить как настроенный">
              <CheckCircle size={12} /> Активировать
            </button>
          )}
          <button onClick={onShowScript} className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] ${showingScript ? 'glass-accent text-white' : 'glass-button text-blue-400'}`}>
            <Terminal size={12} /> Скрипт
          </button>
          <button onClick={onDelete} className="p-1.5 rounded-lg glass-button text-red-400/50 hover:text-red-400" title="Удалить">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Setup script panel */}
      {showingScript && (
        <div className="space-y-4 animate-fade-in">
          {/* Setup script */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-white font-medium">🚀 Скрипт автонастройки</span>
              <button onClick={() => copyScript(setupScript, 'script')} className="flex items-center gap-1 text-[10px] text-blue-400 hover:text-blue-300">
                {copiedScript ? <><CheckCircle size={10} /> Скопировано!</> : <><Copy size={10} /> Копировать</>}
              </button>
            </div>
            <div className="text-[10px] text-white/40 mb-2">Скопируй и выполни на VPS одной командой:</div>
            <pre className="text-[9px] text-green-400/90 bg-black/50 rounded-xl p-3 overflow-x-auto font-mono max-h-48 overflow-y-auto select-all whitespace-pre-wrap">
              {setupScript}
            </pre>
          </div>

          {/* Nginx config */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-white font-medium">📄 Конфигурация Nginx</span>
              <button onClick={() => copyScript(nginxConfig, 'nginx')} className="flex items-center gap-1 text-[10px] text-blue-400 hover:text-blue-300">
                {copiedNginx ? <><CheckCircle size={10} /> Скопировано!</> : <><Copy size={10} /> Копировать</>}
              </button>
            </div>
            <pre className="text-[9px] text-cyan-400/80 bg-black/50 rounded-xl p-3 overflow-x-auto font-mono max-h-40 overflow-y-auto select-all whitespace-pre-wrap">
              {nginxConfig}
            </pre>
          </div>

          {/* Quick guide */}
          <div className="glass-light rounded-lg p-3 text-[10px] text-white/50 space-y-1">
            <div className="text-white/70 font-medium mb-1">Или настрой вручную:</div>
            <div>1. <code className="text-green-400">apt install nginx certbot python3-certbot-nginx</code></div>
            <div>2. Скопируй Nginx конфиг в <code className="text-green-400">/etc/nginx/sites-available/{domain.domain}</code></div>
            <div>3. <code className="text-green-400">ln -s /etc/nginx/sites-available/{domain.domain} /etc/nginx/sites-enabled/</code></div>
            <div>4. <code className="text-green-400">certbot --nginx -d {domain.domain}</code></div>
            <div>5. <code className="text-green-400">systemctl reload nginx</code></div>
            <div>6. Нажми «✅ Активировать» в панели</div>
          </div>
        </div>
      )}
    </div>
  );
}
