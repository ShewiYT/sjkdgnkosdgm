import { useState } from 'react';
import { Lock, User, AlertCircle, Loader2 } from 'lucide-react';

interface LoginPageProps {
  onLogin: (username: string, password: string) => Promise<boolean>;
}

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const success = await onLogin(username, password);
    
    if (!success) {
      setError('Неверный логин или пароль');
    }
    
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-blue-500/80 to-purple-600/80 flex items-center justify-center text-3xl font-bold text-white mx-auto mb-4 shadow-2xl">
            ST
          </div>
          <h1 className="text-2xl font-semibold text-white">SukaCombine</h1>
          <p className="text-sm text-white/40 mt-1">Suka Team Panel</p>
        </div>

        <form onSubmit={handleSubmit} className="glass-card rounded-3xl p-6 space-y-5">
          <div>
            <label className="text-xs text-white/50 block mb-2">Логин</label>
            <div className="relative">
              <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Введите логин"
                className="w-full glass-input text-white pl-11 pr-4 py-3 rounded-xl outline-none"
                required
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-white/50 block mb-2">Пароль</label>
            <div className="relative">
              <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Введите пароль"
                className="w-full glass-input text-white pl-11 pr-4 py-3 rounded-xl outline-none"
                required
              />
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-400 text-xs p-3 rounded-xl glass border border-red-500/30">
              <AlertCircle size={14} />
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl glass-accent text-white font-medium flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {loading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Вход...
              </>
            ) : (
              'Войти'
            )}
          </button>
        </form>

        <p className="text-center text-xs text-white/30 mt-6">
          Доступ только для членов команды
        </p>
      </div>
    </div>
  );
}
