import {
  LayoutDashboard, MessageSquare, Globe, ArrowRightLeft,
  Megaphone, Users, Shield, Bell, Globe2, Settings,
  ChevronLeft, ChevronRight, LogOut, UserCog, KeyRound, Search
} from 'lucide-react';
import type { ActiveView } from '../types';

interface SidebarProps {
  activeView: ActiveView;
  setActiveView: (view: ActiveView) => void;
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
  isAdmin: boolean;
  onLogout: () => void;
  username: string;
}

const menuItems: { view: ActiveView; icon: React.ReactNode; label: string; adminOnly?: boolean }[] = [
  { view: 'import', icon: <LayoutDashboard size={18} />, label: 'Импорт' },
  { view: 'dashboard', icon: <LayoutDashboard size={18} />, label: 'Дашборд' },
  { view: 'multichat', icon: <MessageSquare size={18} />, label: 'Мультичат' },
  { view: 'browser', icon: <Globe size={18} />, label: 'Браузер' },
  { view: 'offers', icon: <ArrowRightLeft size={18} />, label: 'Офферы' },
  { view: 'spammer', icon: <Megaphone size={18} />, label: 'Спамер' },
  { view: 'friends', icon: <Users size={18} />, label: 'Друзья' },
  { view: 'parser', icon: <Search size={18} />, label: 'Парсер' },
  { view: 'account-manager', icon: <UserCog size={18} />, label: 'Менеджер акков' },
  { view: 'sda', icon: <KeyRound size={18} />, label: 'SDA / Guard' },
  { view: 'guard', icon: <Shield size={18} />, label: 'Безопасность' },
  { view: 'notifications', icon: <Bell size={18} />, label: 'Уведомления' },
  { view: 'domains', icon: <Globe2 size={18} />, label: 'Домены', adminOnly: true },
  { view: 'workers', icon: <Users size={18} />, label: 'Работники', adminOnly: true },
  { view: 'settings', icon: <Settings size={18} />, label: 'Настройки' },
];

export default function Sidebar({ activeView, setActiveView, collapsed, setCollapsed, isAdmin, onLogout, username }: SidebarProps) {
  const filteredItems = menuItems.filter(item => !item.adminOnly || isAdmin);

  return (
    <div className={`flex flex-col h-screen bg-dark-800 border-r border-white/5 transition-all duration-300 ${collapsed ? 'w-16' : 'w-56'}`}>
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-white/5">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-xs font-bold shrink-0">
          ST
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <div className="text-sm font-bold truncate">SukaCombine</div>
            <div className="text-[10px] text-white/30">
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
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs transition-colors ${
              activeView === item.view
                ? 'bg-indigo-500/20 text-indigo-400'
                : 'text-white/40 hover:text-white/70 hover:bg-white/5'
            }`}
          >
            {item.icon}
            {!collapsed && <span className="truncate">{item.label}</span>}
          </button>
        ))}
      </div>

      {/* User info & logout */}
      <div className="border-t border-white/5 p-3 space-y-2">
        {!collapsed && (
          <div className="text-[10px] text-white/30 truncate px-1">
            Вы: {username}
          </div>
        )}
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-red-400/60 hover:text-red-400 hover:bg-red-500/10 transition-colors"
        >
          <LogOut size={16} />
          {!collapsed && 'Выйти'}
        </button>
      </div>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="border-t border-white/5 p-3 text-white/20 hover:text-white/40 flex justify-center"
      >
        {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>
    </div>
  );
}
