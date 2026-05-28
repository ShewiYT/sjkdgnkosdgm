import {
  LayoutDashboard, MessageSquare, Globe, ArrowRightLeft, MessageCircle,
  Users, Shield, ShieldCheck, Gamepad2, TrendingUp, UserCog, Settings,
  LogOut, ChevronLeft, ChevronRight, Import, Globe2
} from 'lucide-react';
import type { ActiveView } from '../types';

interface SidebarProps {
  activeView: ActiveView;
  setActiveView: (view: ActiveView) => void;
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  isAdmin: boolean;
  onLogout: () => void;
  username: string;
}

const menuItems: { view: ActiveView; icon: React.ReactNode; label: string; adminOnly?: boolean }[] = [
  { view: 'import', icon: <Import size={18} />, label: 'Импорт' },
  { view: 'dashboard', icon: <LayoutDashboard size={18} />, label: 'Дашборд' },
  { view: 'multichat', icon: <MessageSquare size={18} />, label: 'Мультичат' },
  { view: 'browser', icon: <Globe size={18} />, label: 'Браузер' },
  { view: 'offers', icon: <ArrowRightLeft size={18} />, label: 'Офферы' },
  { view: 'spammer', icon: <MessageCircle size={18} />, label: 'Спамер' },
  { view: 'friends', icon: <Users size={18} />, label: 'Друзья' },
  { view: 'sda', icon: <ShieldCheck size={18} />, label: 'SDA / Guard' },
  { view: 'guard', icon: <Shield size={18} />, label: 'Безопасность' },
  { view: 'ingame', icon: <Gamepad2 size={18} />, label: 'In-Game' },
  { view: 'levelup', icon: <TrendingUp size={18} />, label: 'Level Upper' },
  { view: 'domains', icon: <Globe2 size={18} />, label: 'Домены', adminOnly: true },
  { view: 'workers', icon: <UserCog size={18} />, label: 'Работники', adminOnly: true },
  { view: 'settings', icon: <Settings size={18} />, label: 'Настройки' },
];

export default function Sidebar({ activeView, setActiveView, collapsed, setCollapsed, isAdmin, onLogout, username }: SidebarProps) {
  const filteredItems = menuItems.filter(item => !item.adminOnly || isAdmin);

  return (
    <div className={`flex flex-col h-screen glass border-r border-white/5 transition-all duration-300 ${collapsed ? 'w-16' : 'w-56'}`}>
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-white/5">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500/80 to-purple-600/80 flex items-center justify-center text-xs font-bold text-white shrink-0">
          ST
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <div className="text-sm font-semibold text-white">SukaCombine</div>
            <div className="text-[10px] text-white/40">
              {isAdmin ? '👑 Админ' : '👷 Работник'}
            </div>
          </div>
        )}
      </div>

      {/* Menu */}
      <div className="flex-1 overflow-y-auto py-2 space-y-0.5 px-2">
        {filteredItems.map((item) => (
          <button
            key={item.view}
            onClick={() => setActiveView(item.view)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all ${
              activeView === item.view
                ? 'glass-accent text-white'
                : 'text-white/50 hover:text-white hover:bg-white/5'
            }`}
            title={collapsed ? item.label : undefined}
          >
            <span className="shrink-0">{item.icon}</span>
            {!collapsed && <span className="truncate">{item.label}</span>}
          </button>
        ))}
      </div>

      {/* User info & logout */}
      <div className="p-3 border-t border-white/5 space-y-2">
        {!collapsed && (
          <div className="text-xs text-white/40 px-2 truncate">
            Вы: {username}
          </div>
        )}
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-red-400/70 hover:text-red-400 hover:bg-red-500/10 transition-colors"
          title={collapsed ? 'Выход' : undefined}
        >
          <LogOut size={18} />
          {!collapsed && <span>Выход</span>}
        </button>
      </div>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="p-3 border-t border-white/5 flex items-center justify-center text-white/30 hover:text-white/60 transition-colors"
      >
        {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>
    </div>
  );
}
