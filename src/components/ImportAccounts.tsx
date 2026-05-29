import { useState, useRef } from 'react';
import { Upload, AlertCircle, CheckCircle, SkipForward } from 'lucide-react';
import { useAppStore } from '../store';
import type { MaFile } from '../types';

export default function ImportAccounts() {
  const { addAccounts } = useAppStore();
  const [textInput, setTextInput] = useState('');
  const [maFiles, setMaFiles] = useState<Record<string, MaFile>>({});
  const [importResult, setImportResult] = useState<{ success: number; skipped: number; errors: string[] } | null>(null);
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
    let added = 0;
    let skipped = 0;
    if (accountsData.length > 0) {
      const result = addAccounts(accountsData);
      if (result && typeof result === 'object') { added = result.added; skipped = result.skipped; }
      else { added = accountsData.length; }
    }
    setImportResult({ success: added, skipped, errors });
    setTextInput('');
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => { const text = ev.target?.result as string; setTextInput(prev => (prev ? prev + '\n' + text : text)); };
    reader.readAsText(file);
  };

  const handleMaFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = ev => {
        try {
          const maFile = JSON.parse(ev.target?.result as string) as MaFile;
          const accountName = maFile.account_name?.toLowerCase() || file.name.replace('.maFile', '').toLowerCase();
          setMaFiles(prev => ({ ...prev, [accountName]: maFile }));
        } catch { /* invalid */ }
      };
      reader.readAsText(file);
    });
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in overflow-y-auto max-h-[calc(100vh-52px)]">
      <div>
        <h1 className="text-2xl font-semibold text-white flex items-center gap-2"><Upload size={24} /> Импорт аккаунтов</h1>
        <p className="text-sm text-white/40 mt-1">Добавьте Steam аккаунты в формате login:password</p>
      </div>
      <div className="max-w-2xl space-y-4">
        <div className="glass-card rounded-2xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-white">Аккаунты</h3>
          <textarea value={textInput} onChange={e => setTextInput(e.target.value)}
            className="w-full glass-input text-xs text-white p-3 rounded-xl outline-none h-48 resize-none font-mono"
            placeholder={"login1:password1\nlogin2:password2\n..."} />
          <div className="flex gap-2">
            <button onClick={handleImportText} className="glass-btn px-6 py-2 rounded-xl text-sm">Импортировать</button>
            <input type="file" ref={fileInputRef} onChange={handleFileImport} accept=".txt" className="hidden" />
            <button onClick={() => fileInputRef.current?.click()} className="glass-btn px-4 py-2 rounded-xl text-xs">📂 Из файла</button>
          </div>
        </div>
        <div className="glass-card rounded-2xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-white">🔐 maFiles (опционально)</h3>
          <p className="text-xs text-white/40">Загрузите .maFile для автоматической авторизации Guard</p>
          <input type="file" ref={maFileInputRef} onChange={handleMaFileImport} accept=".maFile,.json" multiple className="hidden" />
          <button onClick={() => maFileInputRef.current?.click()} className="glass-btn px-4 py-2 rounded-xl text-xs">📂 Загрузить maFiles</button>
          {Object.keys(maFiles).length > 0 && (
            <div className="text-xs text-green-400/60">✅ Загружено: {Object.keys(maFiles).length} файлов</div>
          )}
        </div>
        {importResult && (
          <div className="glass-card rounded-2xl p-4 space-y-2">
            {importResult.success > 0 && (
              <div className="flex items-center gap-2 text-green-400 text-sm"><CheckCircle size={14} /> Добавлено: {importResult.success} аккаунтов</div>
            )}
            {importResult.skipped > 0 && (
              <div className="flex items-center gap-2 text-yellow-400 text-sm"><SkipForward size={14} /> Пропущено дубликатов: {importResult.skipped} аккаунтов</div>
            )}
            {importResult.success === 0 && importResult.skipped === 0 && (
              <div className="flex items-center gap-2 text-white/50 text-sm"><AlertCircle size={14} /> Нечего добавлять</div>
            )}
            {importResult.errors.map((err, i) => (
              <div key={i} className="text-xs text-red-400/60">{err}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
