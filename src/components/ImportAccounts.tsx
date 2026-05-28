import { useState, useRef } from 'react';
import { Upload, FileText, Shield, Trash2, CheckCircle, AlertTriangle, Plus, Wifi, Loader2 } from 'lucide-react';
import { useAppStore } from '../store';
import type { MaFile } from '../types';

export default function ImportAccounts() {
  const { accounts, addAccounts, clearAccounts, connectAccount, connectAll, disconnectAll } = useAppStore();
  const [credentialsText, setCredentialsText] = useState('');
  const [maFiles, setMaFiles] = useState<{ name: string; data: MaFile }[]>([]);
  const [importResult, setImportResult] = useState<{ success: number; errors: string[] } | null>(null);
  const [connecting, setConnecting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleMaFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newMaFiles: { name: string; data: MaFile }[] = [];
    const errors: string[] = [];

    for (const file of Array.from(files)) {
      try {
        const text = await file.text();
        const data = JSON.parse(text) as MaFile;
        
        if (data.shared_secret && data.identity_secret) {
          const accountName = data.account_name || data.Session?.SteamLogin?.split('%7C')[0] || file.name.replace('.maFile', '');
          newMaFiles.push({ name: accountName.toLowerCase(), data });
        } else {
          errors.push(`${file.name}: неверный формат maFile`);
        }
      } catch {
        errors.push(`${file.name}: ошибка парсинга JSON`);
      }
    }

    setMaFiles(prev => [...prev, ...newMaFiles]);
    if (errors.length > 0) {
      setImportResult(prev => ({
        success: prev?.success || 0,
        errors: [...(prev?.errors || []), ...errors]
      }));
    }
  };

  const handleImport = () => {
    const lines = credentialsText.split('\n').filter(l => l.trim());
    const accountsToAdd: { login: string; password: string; maFile?: MaFile }[] = [];
    const errors: string[] = [];

    for (const line of lines) {
      const parts = line.split(':');
      if (parts.length >= 2) {
        const login = parts[0].trim().toLowerCase();
        const password = parts.slice(1).join(':').trim();
        const maFile = maFiles.find(m => m.name === login)?.data;
        accountsToAdd.push({ login, password, maFile });
      } else {
        errors.push(`Неверный формат: "${line}"`);
      }
    }

    if (accountsToAdd.length > 0) {
      addAccounts(accountsToAdd);
    }

    setImportResult({ success: accountsToAdd.length, errors });
    setCredentialsText('');
    setMaFiles([]);
  };

  const handleConnectAll = async () => {
    setConnecting(true);
    await connectAll();
    setConnecting(false);
  };

  const handleDisconnectAll = async () => {
    setConnecting(true);
    await disconnectAll();
    setConnecting(false);
  };

  const removeMaFile = (name: string) => {
    setMaFiles(prev => prev.filter(m => m.name !== name));
  };

  const onlineCount = accounts.filter(a => a.status === 'online' || a.status === 'in-game').length;

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl glass-accent flex items-center justify-center">
              <Upload size={20} />
            </div>
            Импорт аккаунтов
          </h1>
          <p className="text-sm text-white/50 mt-1">Добавьте аккаунты Steam для работы</p>
        </div>

        {accounts.length > 0 && (
          <div className="flex gap-2">
            <button
              onClick={onlineCount === accounts.length ? handleDisconnectAll : handleConnectAll}
              disabled={connecting}
              className="flex items-center gap-2 px-4 py-2 rounded-xl glass-accent text-white text-sm font-medium disabled:opacity-50"
            >
              {connecting ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Wifi size={16} />
              )}
              {onlineCount === accounts.length ? 'Отключить все' : 'Подключить все'}
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Credentials input */}
        <div className="glass-card rounded-2xl p-5 space-y-4">
          <h3 className="text-sm font-medium text-white flex items-center gap-2">
            <FileText size={16} className="text-blue-400" /> Логины и пароли
          </h3>
          <p className="text-xs text-white/40">
            Введите данные в формате <code className="bg-white/10 px-1.5 py-0.5 rounded">login:password</code> (по одному на строку)
          </p>
          <textarea
            value={credentialsText}
            onChange={e => setCredentialsText(e.target.value)}
            placeholder="user1:password123&#10;user2:mypass456&#10;user3:secretpass789"
            rows={10}
            className="w-full glass-input text-sm text-white px-4 py-3 rounded-xl outline-none resize-none font-mono placeholder:text-white/20"
          />
          <div className="text-xs text-white/40">
            {credentialsText.split('\n').filter(l => l.includes(':')).length} аккаунтов для импорта
          </div>
        </div>

        {/* MaFile upload */}
        <div className="glass-card rounded-2xl p-5 space-y-4">
          <h3 className="text-sm font-medium text-white flex items-center gap-2">
            <Shield size={16} className="text-green-400" /> Steam Guard (.maFile)
          </h3>
          <p className="text-xs text-white/40">
            Загрузите файлы .maFile для Steam Guard. Имя файла должно соответствовать логину.
          </p>
          
          <input
            ref={fileInputRef}
            type="file"
            accept=".maFile,.mafile,.json"
            multiple
            onChange={handleMaFileUpload}
            className="hidden"
          />
          
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full glass-button rounded-xl p-6 text-center group"
          >
            <Upload size={28} className="mx-auto mb-2 text-white/40 group-hover:text-white/70 transition-colors" />
            <div className="text-xs text-white/50 group-hover:text-white/70 transition-colors">
              Нажмите для выбора файлов
            </div>
            <div className="text-[10px] text-white/30 mt-1">
              .maFile, .json
            </div>
          </button>

          {maFiles.length > 0 && (
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {maFiles.map(mf => (
                <div key={mf.name} className="flex items-center gap-2 p-2.5 rounded-xl glass-light">
                  <Shield size={14} className="text-green-400 shrink-0" />
                  <span className="text-xs text-white flex-1 truncate">{mf.name}</span>
                  <button
                    onClick={() => removeMaFile(mf.name)}
                    className="p-1 text-white/40 hover:text-red-400 transition-colors"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
          
          <div className="text-xs text-white/40">
            {maFiles.length} файлов загружено
          </div>
        </div>
      </div>

      {/* Import result */}
      {importResult && (
        <div className={`glass-card rounded-xl p-4 animate-fade-in ${
          importResult.errors.length > 0 ? 'border-yellow-500/30' : 'border-green-500/30'
        }`}>
          <div className="flex items-center gap-2 mb-2">
            {importResult.errors.length > 0 ? (
              <AlertTriangle size={16} className="text-yellow-400" />
            ) : (
              <CheckCircle size={16} className="text-green-400" />
            )}
            <span className="text-sm text-white font-medium">
              Импортировано: {importResult.success} аккаунтов
            </span>
          </div>
          {importResult.errors.length > 0 && (
            <div className="text-xs text-yellow-400/80 space-y-0.5">
              {importResult.errors.map((e, i) => (
                <div key={i}>• {e}</div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={handleImport}
          disabled={!credentialsText.trim()}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl glass-accent text-white text-sm font-medium disabled:opacity-40"
        >
          <Plus size={16} /> Импортировать
        </button>
        
        {accounts.length > 0 && (
          <button
            onClick={() => {
              if (confirm('Удалить все аккаунты?')) {
                clearAccounts();
                setImportResult(null);
              }
            }}
            className="flex items-center gap-2 px-4 py-2.5 glass-button rounded-xl text-red-400 text-sm"
          >
            <Trash2 size={16} /> Очистить ({accounts.length})
          </button>
        )}
      </div>

      {/* Current accounts */}
      {accounts.length > 0 && (
        <div className="glass-card rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-white/5 flex items-center justify-between">
            <h3 className="text-sm font-medium text-white">
              📋 Аккаунты ({accounts.length})
            </h3>
            <div className="flex items-center gap-2 text-xs text-white/50">
              <div className="status-dot status-online" />
              <span>{onlineCount} онлайн</span>
            </div>
          </div>
          <div className="divide-y divide-white/5 max-h-80 overflow-y-auto">
            {accounts.map(acc => (
              <div key={acc.id} className="px-5 py-3 flex items-center gap-3 hover:bg-white/5 transition-colors">
                <span className="text-xl">{acc.avatar}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-white">{acc.login}</div>
                  <div className="text-[10px] text-white/40 flex items-center gap-2">
                    {acc.maFile ? (
                      <span className="text-green-400">✓ Guard</span>
                    ) : (
                      <span className="text-yellow-400">⚠ Без Guard</span>
                    )}
                    <span>•</span>
                    <span>{acc.server}</span>
                    {acc.errorMessage && (
                      <>
                        <span>•</span>
                        <span className="text-red-400">{acc.errorMessage}</span>
                      </>
                    )}
                  </div>
                </div>
                <div className={`status-dot status-${acc.status === 'in-game' ? 'ingame' : acc.status}`} />
                <button
                  onClick={() => acc.status === 'offline' || acc.status === 'error' 
                    ? connectAccount(acc.id) 
                    : useAppStore.getState().disconnectAccount(acc.id)
                  }
                  className={`text-[10px] px-2 py-1 rounded-lg glass-button ${
                    acc.status === 'connecting' ? 'opacity-50' : ''
                  }`}
                  disabled={acc.status === 'connecting'}
                >
                  {acc.status === 'connecting' ? 'Подключение...' :
                   acc.status === 'online' || acc.status === 'in-game' ? 'Отключить' : 
                   'Подключить'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
