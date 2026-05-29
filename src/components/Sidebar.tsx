import {
  LayoutDashboard,
  MessageSquare,
  Globe,
  ArrowRightLeft,
  Megaphone,
  Users,
  Shield,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Bell,
  Globe2,
  UserCog,
  Search,
  Key,
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
  { view: 'import', icon: <Key size={16} />, label: 'Импорт' },
  { view: 'dashboard', icon: <LayoutDashboard size={16} />, label: 'Дашборд' },
  { view: 'multichat', icon: <MessageSquare size={16} />, label: 'Мультичат' },
  { view: 'browser', icon: <Globe size={16} />, label: 'Браузер' },
  { view: 'offers', icon: <ArrowRightLeft size={16} />, label: 'Офферы' },
  { view: 'spammer', icon: <Megaphone size={16} />, label: 'Спамер' },
  { view: 'friends', icon: <Users size={16} />, label: 'Друзья' },
  { view: 'parser', icon: <Search size={16} />, label: 'Парсер' },
  { view: 'account-manager', icon: <UserCog size={16} />, label: 'Менеджер акков' },
  { view: 'sda', icon: <ShieldCheck size={16} />, label: 'SDA / Guard' },
  { view: 'guard', icon: <Shield size={16} />, label: 'Безопасность' },
  { view: 'notifications', icon: <Bell size={16} />, label: 'Уведомления' },
  { view: 'domains', icon: <Globe2 size={16} />, label: 'Домены', adminOnly: true },
  { view: 'workers', icon: <Users size={16} />, label: 'Работники', adminOnly: true },
  { view: 'settings', icon: <Settings size={16} />, label: 'Настройки' },
];

export default function Sidebar({
  activeView,
  setActiveView,
  collapsed,
  setCollapsed,
  isAdmin,
  onLogout,
  username,
}: SidebarProps) {
  const filteredItems = menuItems.filter(item => !item.adminOnly || isAdmin);

  return (
    <div
      className={`flex flex-col h-screen bg-dark-800 border-r border-white/5 transition-all duration-200 ${
        collapsed ? 'w-14' : 'w-52'
      }`}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-3 py-4 border-b border-white/5">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-xs font-bold text-white shrink-0">
          ST
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <div className="text-sm font-bold text-white">SukaCombine</div>
            <div className="text-[10px] text-white/30 flex items-center gap-1">
              {isAdmin ? '👑 Админ' : '👷 Работник'}
            </div>
          </div>
        )}
      </div>

      {/* Menu */}
      <div className="flex-1 overflow-y-auto py-2 space-y-0.5 px-1">
        {filteredItems.map(item => (
          <button
            key={item.view}
            onClick={() => setActiveView(item.view)}
            className={`w-full flex items-center gap-3 px-2 py-2 rounded-xl text-xs transition-colors ${
              activeView === item.view
                ? 'bg-indigo-500/20 text-indigo-400'
                : 'text-white/40 hover:text-white/70 hover:bg-white/5'
            }`}
            title={collapsed ? item.label : undefined}
          >
            <span className="shrink-0">{item.icon}</span>
            {!collapsed && <span className="truncate">{item.label}</span>}
          </button>
        ))}
      </div>

      {/* User info & logout */}
      <div className="p-2 border-t border-white/5 space-y-1">
        {!collapsed && (
          <div className="text-[10px] text-white/20 px-2 truncate">Вы: {username}</div>
        )}
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-2 py-2 rounded-xl text-xs text-red-400/50 hover:text-red-400 hover:bg-red-500/10 transition-colors"
          title={collapsed ? 'Выйти' : undefined}
        >
          <LogOut size={16} className="shrink-0" />
          {!collapsed && <span>Выйти</span>}
        </button>
      </div>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center justify-center py-2 border-t border-white/5 text-white/20 hover:text-white/50 transition-colors"
      >
        {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>
    </div>
  );
}
