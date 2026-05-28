import {
  LayoutDashboard, MessageSquare, Globe, ArrowRightLeft,
  Megaphone, Users, Shield, ChevronLeft, ChevronRight,
  LogOut, Settings, Upload, Globe2, Bell, Lock, Search
} from 'lucide-react';
import type { ActiveView } from '../types';

interface SidebarProps {
  activeView: ActiveView;
  setActiveView: (v: ActiveView) => void;
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
  isAdmin: boolean;
  onLogout: () => void;
  username: string;
}

const menuItems: { view: ActiveView; icon: React.ReactNode; label: string; adminOnly?: boolean }[] = [
  { view: 'import', icon: <Upload size={18} />, label: 'Импорт' },
  { view: 'dashboard', icon: <LayoutDashboard size={18} />, label: 'Дашборд' },
  { view: 'multichat', icon: <MessageSquare size={18} />, label: 'Мультичат' },
  { view: 'browser', icon: <Globe size={18} />, label: 'Браузер' },
  { view: 'offers', icon: <ArrowRightLeft size={18} />, label: 'Офферы' },
  { view: 'spammer', icon: <Megaphone size={18} />, label: 'Спамер' },
  { view: 'friends', icon: <Users size={18} />, label: 'Друзья' },
  { view: 'parser', icon: <Search size={18} />, label: 'Парсер' },
  { view: 'sda', icon: <Lock size={18} />, label: 'SDA / Guard' },
  { view: 'guard', icon: <Shield size={18} />, label: 'Безопасность' },
  { view: 'notifications', icon: <Bell size={18} />, label: 'Уведомления' },
  { view: 'domains', icon: <Globe2 size={18} />, label: 'Домены', adminOnly: true },
  { view: 'workers', icon: <Users size={18} />, label: 'Работники', adminOnly: true },
  { view: 'settings', icon: <Settings size={18} />, label: 'Настройки' },
];

export default function Sidebar({ activeView, setActiveView, collapsed, setCollapsed, isAdmin, onLogout, username }: SidebarProps) {
  const filteredItems = menuItems.filter(item => !item.adminOnly || isAdmin);

  return (
    <div className={`h-screen flex flex-col glass border-r border-white/5 transition-all duration-300 ${collapsed ? 'w-16' : 'w-56'}`}>
      {/* Logo */}
      <div className="p-4 flex items-center gap-3 border-b border-white/5">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-xs shrink-0">
          ST
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <div className="text-sm font-bold text-white">SukaCombine</div>
            <div className="text-[10px] text-white/40">
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
            className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
              activeView === item.view
                ? 'text-white bg-white/10'
                : 'text-white/50 hover:text-white/80 hover:bg-white/5'
            }`}
          >
            <span className="shrink-0">{item.icon}</span>
            {!collapsed && <span className="truncate">{item.label}</span>}
          </button>
        ))}
      </nav>

      {/* User info & logout */}
      <div className="p-3 border-t border-white/5">
        {!collapsed && (
          <div className="text-[10px] text-white/30 mb-2 truncate">
            Вы: {username}
          </div>
        )}
        <button onClick={onLogout} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">
          <LogOut size={14} />
          {!collapsed && 'Выйти'}
        </button>
      </div>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="p-2 text-white/30 hover:text-white/60 border-t border-white/5"
      >
        {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>
    </div>
  );
}
