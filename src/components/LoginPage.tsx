import { useState } from 'react';
import { Lock, User, Eye, EyeOff } from 'lucide-react';
import { useAppStore } from '../store';

export default function LoginPage() {
  const { login } = useAppStore();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const success = await login(username, password);
    setLoading(false);
    if (!success) setError('Неверный логин или пароль');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f] p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mx-auto mb-4 text-white font-bold text-xl">
            ST
          </div>
          <h1 className="text-2xl font-bold text-white">SukaCombine</h1>
          <p className="text-sm text-white/40 mt-1">Steam Panel v2.0</p>
        </div>

        <form onSubmit={handleLogin} className="glass-card rounded-2xl p-6 space-y-4">
          <div>
            <label className="text-xs text-white/50 mb-1 block">Логин</label>
            <div className="relative">
              <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                className="w-full glass-input text-sm text-white pl-10 pr-4 py-3 rounded-xl outline-none"
                placeholder="admin"
                autoFocus
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-white/50 mb-1 block">Пароль</label>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full glass-input text-sm text-white pl-10 pr-10 py-3 rounded-xl outline-none"
                placeholder="••••••••"
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60">
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {error && (
            <div className="text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{error}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {loading ? 'Вход...' : 'Войти'}
          </button>
        </form>

        <p className="text-center text-[10px] text-white/20 mt-6">© Suka Team 2024</p>
      </div>
    </div>
  );
}
