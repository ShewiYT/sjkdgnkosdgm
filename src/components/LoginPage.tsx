import { useState } from 'react';
import { Lock, User, Eye, EyeOff } from 'lucide-react';
import { useAppStore } from '../store';

export default function LoginPage() {
  const login = useAppStore(s => s.login);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!username || !password) return;
    setLoading(true);
    setError('');
    const ok = await login(username, password);
    if (!ok) setError('Неверный логин или пароль');
    setLoading(false);
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-dark-900">
      <div className="glass-card rounded-2xl p-8 w-full max-w-sm space-y-6 animate-fade-in">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-xl font-bold text-white">
            ST
          </div>
          <h1 className="text-xl font-bold text-white">SukaCombine</h1>
          <p className="text-white/40 text-sm">Steam Panel v3.1 • Real Steam Connection</p>
        </div>

        {error && (
          <div className="text-red-400 text-sm text-center bg-red-500/10 rounded-lg py-2">{error}</div>
        )}

        <div className="space-y-4">
          <div>
            <label className="text-white/50 text-xs mb-1 block">Логин</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                className="w-full glass-input text-sm text-white pl-10 pr-4 py-3 rounded-xl outline-none"
                placeholder="admin"
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
              />
            </div>
          </div>

          <div>
            <label className="text-white/50 text-xs mb-1 block">Пароль</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <input
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full glass-input text-sm text-white pl-10 pr-10 py-3 rounded-xl outline-none"
                placeholder="••••••••"
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
              />
              <button
                onClick={() => setShowPass(!showPass)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
              >
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full glass-btn py-3 rounded-xl font-medium text-sm disabled:opacity-50"
          >
            {loading ? 'Вход...' : 'Войти'}
          </button>
        </div>

        <div className="text-center">
          <div className="text-[10px] text-white/20 space-y-0.5">
            <div>🗄️ Серверная БД: SQLite</div>
            <div>🔌 Требуется server.js с steam-user</div>
          </div>
        </div>
      </div>
    </div>
  );
}
