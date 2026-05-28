import { useState, useRef } from 'react';
import { Upload, FileText, Trash2, Plus, CheckCircle, Eye, EyeOff } from 'lucide-react';
import { useAppStore } from '../store';
import type { MaFile } from '../types';

export default function ImportAccounts() {
  const { addAccounts, removeAccount, clearAccounts, connectAccount, disconnectAccount } = useAppStore();
  const [textInput, setTextInput] = useState('');
  const [importedCount, setImportedCount] = useState(0);
  const [showPasswords, setShowPasswords] = useState(false);
  const [maFiles, setMaFiles] = useState<Record<string, MaFile>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const maFileInputRef = useRef<HTMLInputElement>(null);

  // Parse login:password format
  const handleTextImport = () => {
    const lines = textInput.split('\n').map(l => l.trim()).filter(Boolean);
    const accountsData: { login: string; password: string; maFile?: MaFile }[] = [];

    for (const line of lines) {
      const parts = line.split(':');
      if (parts.length >= 2) {
        const login = parts[0].trim();
        const password = parts.slice(1).join(':').trim();
        if (login && password) {
          accountsData.push({ 
            login, 
            password,
            maFile: maFiles[login],
          });
        }
      }
    }

    if (accountsData.length > 0) {
      addAccounts(accountsData);
      setImportedCount(accountsData.length);
      setTextInput('');
      setTimeout(() => setImportedCount(0), 3000);
    }
  };

  // Handle .maFile upload
  const handleMaFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newMaFiles: Record<string, MaFile> = { ...maFiles };

    for (const file of Array.from(files)) {
      try {
        const text = await file.text();
        const maFile = JSON.parse(text) as MaFile;
        if (maFile.account_name && maFile.shared_secret) {
          newMaFiles[maFile.account_name] = maFile;
        }
      } catch {
        console.error('Invalid maFile:', file.name);
      }
    }

    setMaFiles(newMaFiles);
  };

  // Handle file upload (login:password format)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setTextInput(text);
  };

  const visibleAccounts = useAppStore(s => s.getVisibleAccounts());

  return (
    <div className="p-6 space-y-6 animate-fade-in overflow-y-auto max-h-[calc(100vh-52px)]">
      <div>
        <h1 className="text-2xl font-semibold text-white flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl glass-accent flex items-center justify-center">
            <Upload size={20} />
          </div>
          Импорт аккаунтов
        </h1>
        <p className="text-sm text-white/50 mt-1">Добавление Steam аккаунтов в систему</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Text import */}
        <div className="glass-card rounded-2xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <FileText size={16} /> Логины и пароли
          </h3>
          <p className="text-xs text-white/40">
            Введите данные в формате login:password (по одному на строку)
          </p>
          <textarea
            value={textInput}
            onChange={e => setTextInput(e.target.value)}
            placeholder={"login1:password1\nlogin2:password2\nlogin3:password3"}
            rows={10}
            className="w-full glass-input text-sm text-white px-4 py-3 rounded-xl outline-none resize-none font-mono placeholder:text-white/20"
          />
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <button
                onClick={handleTextImport}
                disabled={!textInput.trim()}
                className="flex items-center gap-2 px-4 py-2 rounded-xl glass-accent text-white text-xs disabled:opacity-40"
              >
                <Plus size={14} />
                Импортировать
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2 rounded-xl glass-button text-white/70 text-xs"
              >
                <Upload size={14} />
                Из файла
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>
            <span className="text-xs text-white/30">
              {textInput.split('\n').filter(l => l.includes(':')).length} аккаунтов
            </span>
          </div>
        </div>

        {/* maFile import */}
        <div className="glass-card rounded-2xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            🔐 maFile (Steam Guard)
          </h3>
          <p className="text-xs text-white/40">
            Загрузите .maFile файлы для Steam Guard. Они автоматически привяжутся к аккаунтам по имени.
          </p>
          <div
            onClick={() => maFileInputRef.current?.click()}
            className="border-2 border-dashed border-white/10 rounded-xl p-8 text-center hover:border-blue-500/30 transition-colors cursor-pointer"
          >
            <Upload size={32} className="mx-auto mb-3 text-white/20" />
            <div className="text-xs text-white/50">Перетащите .maFile сюда или нажмите</div>
            <div className="text-[10px] text-white/30 mt-1">Формат: .maFile, .json</div>
          </div>
          <input
            ref={maFileInputRef}
            type="file"
            accept=".maFile,.json"
            multiple
            onChange={handleMaFileUpload}
            className="hidden"
          />
          {Object.keys(maFiles).length > 0 && (
            <div className="space-y-1">
              <div className="text-xs text-white/50">Загружено maFile:</div>
              {Object.keys(maFiles).map(name => (
                <div key={name} className="flex items-center gap-2 text-xs glass-light rounded-lg px-3 py-2">
                  <CheckCircle size={12} className="text-green-400" />
                  <span className="text-white">{name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Success message */}
      {importedCount > 0 && (
        <div className="glass-card rounded-2xl p-4 border border-green-500/30 animate-fade-in">
          <div className="flex items-center gap-3 text-green-400">
            <CheckCircle size={20} />
            <span className="text-sm">Импортировано {importedCount} аккаунтов</span>
          </div>
        </div>
      )}

      {/* Imported accounts list */}
      {visibleAccounts.length > 0 && (
        <div className="glass-card rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">
              Импортированные аккаунты ({visibleAccounts.length})
            </h3>
            <div className="flex gap-2">
              <button
                onClick={() => setShowPasswords(!showPasswords)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg glass-button text-xs text-white/50"
              >
                {showPasswords ? <EyeOff size={12} /> : <Eye size={12} />}
                {showPasswords ? 'Скрыть' : 'Показать'}
              </button>
              <button
                onClick={() => { if (confirm('Удалить все аккаунты?')) clearAccounts(); }}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg glass-button text-xs text-red-400/70 hover:text-red-400"
              >
                <Trash2 size={12} />
                Очистить
              </button>
            </div>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {visibleAccounts.map(acc => (
              <div key={acc.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-white/5 hover:bg-white/5 transition-colors">
                <span className="text-lg">{acc.avatar}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-white">{acc.login}</div>
                  <div className="text-[10px] text-white/30 font-mono">
                    {showPasswords ? acc.password : '••••••••'}
                  </div>
                </div>
                <div className={`status-dot ${
                  acc.status === 'online' ? 'status-online' :
                  acc.status === 'in-game' ? 'status-ingame' :
                  acc.status === 'connecting' ? 'status-connecting' :
                  acc.status === 'error' ? 'status-error' :
                  'status-offline'
                }`} />
                <div className="flex gap-1">
                  {acc.status === 'offline' || acc.status === 'error' ? (
                    <button
                      onClick={() => connectAccount(acc.id)}
                      className="px-2 py-1 rounded text-[10px] bg-green-500/20 text-green-400 hover:bg-green-500/30"
                    >
                      Connect
                    </button>
                  ) : acc.status === 'online' || acc.status === 'in-game' ? (
                    <button
                      onClick={() => disconnectAccount(acc.id)}
                      className="px-2 py-1 rounded text-[10px] bg-red-500/20 text-red-400 hover:bg-red-500/30"
                    >
                      Disconnect
                    </button>
                  ) : null}
                  <button
                    onClick={() => removeAccount(acc.id)}
                    className="p-1 rounded text-white/20 hover:text-red-400"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
                {acc.guardEnabled && (
                  <span className="text-[10px] text-green-400">🔐</span>
                )}
                {acc.errorMessage && (
                  <span className="text-[10px] text-red-400 max-w-32 truncate" title={acc.errorMessage}>
                    {acc.errorMessage}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
