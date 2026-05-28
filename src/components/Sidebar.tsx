import { 
  LayoutDashboard, MessageSquare, Globe, ArrowRightLeft, 
  Megaphone, UserPlus, Shield, Gamepad2, TrendingUp, 
  Users, Settings, Smartphone, ChevronLeft, ChevronRight, Upload, LogOut
} from 'lucide-react';
import type { ActiveView } from '../types';

interface SidebarProps {
  activeView: ActiveView;
  setActiveView: (view: ActiveView) => void;
  collapsed: boolean;
  setCollapsed: (c: boolean) => void;
  isAdmin: boolean;
  onLogout: () => void;
  username: string;
}

const menuItems: { view: ActiveView; icon: React.ReactNode; label: string; adminOnly?: boolean }[] = [
  { view: 'import', icon: <Upload size={20} />, label: 'Импорт' },
  { view: 'dashboard', icon: <LayoutDashboard size={20} />, label: 'Дашборд' },
  { view: 'multichat', icon: <MessageSquare size={20} />, label: 'Мультичат' },
  { view: 'browser', icon: <Globe size={20} />, label: 'Браузер' },
  { view: 'offers', icon: <ArrowRightLeft size={20} />, label: 'Офферы' },
  { view: 'spammer', icon: <Megaphone size={20} />, label: 'Спамер' },
  { view: 'friends', icon: <UserPlus size={20} />, label: 'Друзья' },
  { view: 'sda', icon: <Smartphone size={20} />, label: 'SDA / Guard' },
  { view: 'guard', icon: <Shield size={20} />, label: 'Безопасность' },
  { view: 'ingame', icon: <Gamepad2 size={20} />, label: 'In-Game' },
  { view: 'levelup', icon: <TrendingUp size={20} />, label: 'Level Upper' },
  { view: 'workers', icon: <Users size={20} />, label: 'Работники', adminOnly: true },
  { view: 'settings', icon: <Settings size={20} />, label: 'Настройки' },
];

export default function Sidebar({ activeView, setActiveView, collapsed, setCollapsed, isAdmin, onLogout, username }: SidebarProps) {
  const filteredItems = menuItems.filter(item => !item.adminOnly || isAdmin);

  return (
    <div className={`${collapsed ? 'w-16' : 'w-56'} transition-all duration-300 glass-dark flex flex-col h-screen sticky top-0`}>
      {/* Logo */}
      <div className="p-3 flex items-center gap-3 border-b border-white/5">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500/80 to-purple-600/80 flex items-center justify-center text-lg font-bold text-white shrink-0 shadow-lg">
          ST
        </div>
        {!collapsed && (
          <div className="animate-slide-in overflow-hidden">
            <div className="text-sm font-semibold text-white whitespace-nowrap">SukaCombine</div>
            <div className="text-[10px] text-white/40 whitespace-nowrap">
              {isAdmin ? '👑 Админ' : '👷 Работник'}
            </div>
          </div>
        )}
      </div>

      {/* Menu */}
      <nav className="flex-1 py-2 overflow-y-auto">
        {filteredItems.map((item) => (
          <button
            key={item.view}
            onClick={() => setActiveView(item.view)}
            className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-all duration-200 relative ${
              activeView === item.view
                ? 'text-white bg-white/10'
                : 'text-white/50 hover:text-white/80 hover:bg-white/5'
            }`}
            title={collapsed ? item.label : undefined}
          >
            {activeView === item.view && (
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-blue-500 rounded-r-full" />
            )}
            <span className="shrink-0">{item.icon}</span>
            {!collapsed && <span className="whitespace-nowrap">{item.label}</span>}
          </button>
        ))}
      </nav>

      {/* User info & logout */}
      <div className="border-t border-white/5">
        {!collapsed && (
          <div className="px-4 py-2 text-xs text-white/40">
            Вы: <span className="text-white/70">{username}</span>
          </div>
        )}
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-400/70 hover:text-red-400 hover:bg-red-500/10 transition-colors"
          title={collapsed ? 'Выйти' : undefined}
        >
          <LogOut size={18} />
          {!collapsed && <span>Выйти</span>}
        </button>
      </div>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="p-3 border-t border-white/5 text-white/40 hover:text-white/80 transition-colors flex items-center justify-center"
      >
        {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
      </button>
    </div>
  );
}
