import { useState, useRef } from 'react';
import { Upload, FileText, Plus, Trash2, CheckCircle, AlertTriangle } from 'lucide-react';
import { useAppStore } from '../store';
import type { MaFile } from '../types';

export default function ImportAccounts() {
  const { addAccounts, accounts, clearAccounts } = useAppStore();
  const [textInput, setTextInput] = useState('');
  const [maFiles, setMaFiles] = useState<Record<string, MaFile>>({});
  const [importResult, setImportResult] = useState<{ success: number; errors: string[] } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const maFileInputRef = useRef<HTMLInputElement>(null);

  const handleImportText = () => {
    if (!textInput.trim()) return;

    const lines = textInput.trim().split('\n').filter(l => l.trim());
    const accountsData: { login: string; password: string; maFile?: MaFile }[] = [];
    const errors: string[] = [];

    lines.forEach((line, i) => {
      const parts = line.trim().split(':');
      if (parts.length >= 2) {
        const login = parts[0].trim();
        const password = parts[1].trim();
        const maFile = maFiles[login.toLowerCase()];
        accountsData.push({ login, password, maFile });
      } else {
        errors.push(`Строка ${i + 1}: неверный формат`);
      }
    });

    if (accountsData.length > 0) {
      addAccounts(accountsData);
    }

    setImportResult({ success: accountsData.length, errors });
    setTextInput('');
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setTextInput(prev => prev ? prev + '\n' + text : text);
    };
    reader.readAsText(file);
  };

  const handleMaFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const maFile = JSON.parse(ev.target?.result as string) as MaFile;
          const accountName = maFile.account_name?.toLowerCase() || file.name.replace('.maFile', '').toLowerCase();
          setMaFiles(prev => ({ ...prev, [accountName]: maFile }));
        } catch {
          // invalid maFile
        }
      };
      reader.readAsText(file);
    });
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in overflow-y-auto max-h-[calc(100vh-52px)]">
      <div>
        <h1 className="text-2xl font-semibold text-white flex items-center gap-2">
          <Upload size={24} />
          Импорт аккаунтов
        </h1>
        <p className="text-sm text-white/40 mt-1">Добавьте Steam аккаунты в формате login:password</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Import form */}
        <div className="space-y-4">
          <div className="glass-card rounded-2xl p-4 space-y-4">
            <h3 className="text-sm font-semibold text-white">Аккаунты (login:password)</h3>
            <textarea
              value={textInput}
              onChange={e => setTextInput(e.target.value)}
              placeholder={"login1:password1\nlogin2:password2\nlogin3:password3"}
              className="w-full glass-input text-sm text-white px-4 py-3 rounded-xl outline-none resize-none h-48 font-mono"
            />

            <div className="flex gap-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 text-white/60 text-xs hover:bg-white/10 transition-colors"
              >
                <FileText size={14} />
                Загрузить .txt
              </button>
              <input ref={fileInputRef} type="file" accept=".txt" onChange={handleFileImport} className="hidden" />

              <button
                onClick={() => maFileInputRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 text-white/60 text-xs hover:bg-white/10 transition-colors"
              >
                <FileText size={14} />
                Загрузить .maFile
              </button>
              <input ref={maFileInputRef} type="file" accept=".maFile,.json" multiple onChange={handleMaFileImport} className="hidden" />
            </div>

            {Object.keys(maFiles).length > 0 && (
              <div className="text-xs text-green-400/70">
                ✓ Загружено {Object.keys(maFiles).length} maFile(s)
              </div>
            )}

            <button
              onClick={handleImportText}
              disabled={!textInput.trim()}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-30"
            >
              <Plus size={16} />
              Импортировать
            </button>
          </div>

          {importResult && (
            <div className="glass-card rounded-2xl p-4">
              <div className="flex items-center gap-2 text-sm text-green-400 mb-2">
                <CheckCircle size={16} />
                Добавлено {importResult.success} аккаунтов
              </div>
              {importResult.errors.length > 0 && (
                <div className="space-y-1">
                  {importResult.errors.map((err, i) => (
                    <div key={i} className="flex items-center gap-1 text-xs text-red-400/70">
                      <AlertTriangle size={10} />
                      {err}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Current accounts */}
        <div className="glass-card rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-white">Загруженные аккаунты ({accounts.length})</h3>
            {accounts.length > 0 && (
              <button
                onClick={clearAccounts}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <Trash2 size={12} />
                Очистить
              </button>
            )}
          </div>
          <div className="space-y-1 max-h-96 overflow-y-auto">
            {accounts.length === 0 ? (
              <div className="text-xs text-white/30 text-center py-8">Нет загруженных аккаунтов</div>
            ) : (
              accounts.map(acc => (
                <div key={acc.id} className="flex items-center gap-2 py-2 px-2 rounded-lg hover:bg-white/5 transition-colors">
                  <span className={`w-2 h-2 rounded-full ${
                    acc.status === 'online' ? 'bg-green-400' :
                    acc.status === 'error' ? 'bg-red-400' :
                    'bg-gray-500'
                  }`} />
                  {acc.avatarUrl ? (
                    <img src={acc.avatarUrl} alt="" className="w-5 h-5 rounded-full" />
                  ) : (
                    <span className="text-sm">{acc.avatar}</span>
                  )}
                  <span className="text-xs text-white flex-1 truncate">{acc.login}</span>
                  <span className="text-[10px] text-white/30">{acc.guardEnabled ? '🛡️' : ''}</span>
                  {acc.status !== 'offline' && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                      acc.status === 'online' ? 'text-green-400 bg-green-500/10' :
                      acc.status === 'error' ? 'text-red-400 bg-red-500/10' :
                      'text-yellow-400 bg-yellow-500/10'
                    }`}>{acc.status}</span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
