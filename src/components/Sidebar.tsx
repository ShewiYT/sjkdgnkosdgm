import { LayoutDashboard, MessageCircle, Globe, Package, Send, Users, Search, Shield, Bell, Server, UserCog, Settings, LogOut, ChevronLeft, ChevronRight, Upload } from 'lucide-react';
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
  { view: 'import', icon: <Upload className="w-4 h-4" />, label: 'Импорт' },
  { view: 'dashboard', icon: <LayoutDashboard className="w-4 h-4" />, label: 'Дашборд' },
  { view: 'multichat', icon: <MessageCircle className="w-4 h-4" />, label: 'Мультичат' },
  { view: 'browser', icon: <Globe className="w-4 h-4" />, label: 'Браузер' },
  { view: 'offers', icon: <Package className="w-4 h-4" />, label: 'Офферы' },
  { view: 'spammer', icon: <Send className="w-4 h-4" />, label: 'Спамер' },
  { view: 'friends', icon: <Users className="w-4 h-4" />, label: 'Друзья' },
  { view: 'parser', icon: <Search className="w-4 h-4" />, label: 'Парсер' },
  { view: 'sda', icon: <Shield className="w-4 h-4" />, label: 'SDA / Guard' },
  { view: 'guard', icon: <Shield className="w-4 h-4" />, label: 'Безопасность' },
  { view: 'notifications', icon: <Bell className="w-4 h-4" />, label: 'Уведомления' },
  { view: 'domains', icon: <Server className="w-4 h-4" />, label: 'Домены', adminOnly: true },
  { view: 'workers', icon: <UserCog className="w-4 h-4" />, label: 'Работники', adminOnly: true },
  { view: 'settings', icon: <Settings className="w-4 h-4" />, label: 'Настройки' },
];

export default function Sidebar({ activeView, setActiveView, collapsed, setCollapsed, isAdmin, onLogout, username }: SidebarProps) {
  const filteredItems = menuItems.filter(item => !item.adminOnly || isAdmin);

  return (
    <div className={`flex flex-col bg-dark-800 border-r border-white/5 transition-all duration-300 ${collapsed ? 'w-16' : 'w-56'}`}>
      {/* Logo */}
      <div className="flex items-center gap-3 p-4 border-b border-white/5">
        <div className="shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-xs font-bold">
          ST
        </div>
        {!collapsed && (
          <div>
            <div className="text-sm font-bold">SukaCombine</div>
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
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs transition-colors ${
              activeView === item.view
                ? 'bg-white/10 text-white'
                : 'text-white/40 hover:text-white/70 hover:bg-white/5'
            }`}
          >
            {item.icon}
            {!collapsed && <span>{item.label}</span>}
          </button>
        ))}
      </div>

      {/* User info & logout */}
      <div className="p-3 border-t border-white/5 space-y-2">
        {!collapsed && (
          <div className="text-[10px] text-white/30 truncate">
            Вы: {username}
          </div>
        )}
        <button onClick={onLogout} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-red-400/70 hover:text-red-400 hover:bg-red-500/10 transition-colors">
          <LogOut className="w-4 h-4" />
          {!collapsed && <span>Выйти</span>}
        </button>
      </div>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="p-2 border-t border-white/5 text-white/20 hover:text-white/50 transition-colors flex justify-center"
      >
        {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>
    </div>
  );
}
