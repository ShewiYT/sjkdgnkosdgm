import { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import AccountBar from './components/AccountBar';
import Dashboard from './components/Dashboard';
import MultiChat from './components/MultiChat';
import BrowserView from './components/BrowserView';
import Offers from './components/Offers';
import Spammer from './components/Spammer';
import FriendsManager from './components/FriendsManager';
import SDAGuard from './components/SDAGuard';
import SecurityView from './components/SecurityView';
import InGame from './components/InGame';
import LevelUpper from './components/LevelUpper';
import Workers from './components/Workers';
import SettingsView from './components/SettingsView';
import ImportAccounts from './components/ImportAccounts';
import LoginPage from './components/LoginPage';
import DomainsView from './components/DomainsView';
import { useAppStore } from './store';
import type { ActiveView, SteamAccount } from './types';

export default function App() {
  const {
    currentUser, login, logout, getVisibleAccounts, tradeOffers,
    connectAll, disconnectAll, refreshStatuses
  } = useAppStore();

  const [activeView, setActiveView] = useState<ActiveView>('import');
  const [selectedAccount, setSelectedAccount] = useState<SteamAccount | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Get accounts visible to current user
  const accounts = getVisibleAccounts();

  // Refresh statuses on mount
  useEffect(() => {
    if (!currentUser) return;
    refreshStatuses();
    const interval = setInterval(refreshStatuses, 10000);
    return () => clearInterval(interval);
  }, [currentUser, refreshStatuses]);

  // Show login if not authenticated
  if (!currentUser) {
    return <LoginPage onLogin={login} />;
  }

  const isAdmin = currentUser.role === 'admin';
  const onlineCount = accounts.filter(a => a.status === 'online' || a.status === 'in-game').length;

  const handleConnectAll = () => {
    if (onlineCount === accounts.length) {
      disconnectAll();
    } else {
      connectAll();
    }
  };

  const renderView = () => {
    switch (activeView) {
      case 'import':
        return <ImportAccounts />;
      case 'dashboard':
        return <Dashboard accounts={accounts} offers={tradeOffers} />;
      case 'multichat':
        return <MultiChat accounts={accounts} />;
      case 'browser':
        return <BrowserView accounts={accounts} />;
      case 'offers':
        return <Offers accounts={accounts} offers={tradeOffers} />;
      case 'spammer':
        return <Spammer />;
      case 'friends':
        return <FriendsManager />;
      case 'sda':
        return <SDAGuard accounts={accounts} />;
      case 'guard':
        return <SecurityView accounts={accounts} />;
      case 'ingame':
        return <InGame accounts={accounts} />;
      case 'levelup':
        return <LevelUpper accounts={accounts} />;
      case 'domains':
        return isAdmin ? <DomainsView /> : <div className="p-6 text-white/50">Нет доступа</div>;
      case 'workers':
        return isAdmin ? <Workers accounts={accounts} /> : <div className="p-6 text-white/50">Нет доступа</div>;
      case 'settings':
        return <SettingsView />;
      default:
        return <Dashboard accounts={accounts} offers={tradeOffers} />;
    }
  };

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        activeView={activeView}
        setActiveView={setActiveView}
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
        isAdmin={isAdmin}
        onLogout={logout}
        username={currentUser.username}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <AccountBar
          accounts={accounts}
          selectedAccount={selectedAccount}
          onSelectAccount={setSelectedAccount}
          onConnectAll={handleConnectAll}
        />
        <div className="flex-1 overflow-hidden">
          {renderView()}
        </div>
      </div>
    </div>
  );
}
