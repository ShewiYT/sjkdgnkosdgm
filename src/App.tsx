import { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import AccountBar from './components/AccountBar';
import Dashboard from './components/Dashboard';
import MultiChat from './components/MultiChat';
import BrowserView from './components/BrowserView';
import Offers from './components/Offers';
import Spammer from './components/Spammer';
import FriendsManager from './components/FriendsManager';
import AccountManager from './components/AccountManager';
import SDAGuard from './components/SDAGuard';
import SecurityView from './components/SecurityView';
import Workers from './components/Workers';
import SettingsView from './components/SettingsView';
import ImportAccounts from './components/ImportAccounts';
import LoginPage from './components/LoginPage';
import DomainsView from './components/DomainsView';
import NotificationsView from './components/NotificationsView';
import SteamParser from './components/SteamParser';
import { useAppStore } from './store';
import type { ActiveView, SteamAccount } from './types';

export default function App() {
  const {
    currentUser,
    logout,
    getVisibleAccounts,
    tradeOffers,
    connectAll,
    disconnectAll,
    refreshStatuses,
    loadAccountsFromServer,
  } = useAppStore();

  const [activeView, setActiveView] = useState<ActiveView>('import');
  const [selectedAccount, setSelectedAccount] = useState<SteamAccount | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const accounts = getVisibleAccounts();

  useEffect(() => {
    if (!currentUser) return;
    loadAccountsFromServer();
    refreshStatuses();
    const interval = setInterval(refreshStatuses, 10000);
    return () => clearInterval(interval);
  }, [currentUser, refreshStatuses, loadAccountsFromServer]);

  if (!currentUser) {
    return <LoginPage />;
  }

  const isAdmin = currentUser.role === 'admin';
  const onlineCount = accounts.filter(
    a => a.status === 'online' || a.status === 'in-game'
  ).length;

  const handleConnectAll = () => {
    if (onlineCount === accounts.length && accounts.length > 0) {
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
        return <Dashboard accounts={accounts} />;
      case 'multichat':
        return <MultiChat accounts={accounts} selectedAccount={selectedAccount} />;
      case 'browser':
        return <BrowserView accounts={accounts} selectedAccount={selectedAccount} />;
      case 'offers':
        return <Offers accounts={accounts} offers={tradeOffers} />;
      case 'spammer':
        return <Spammer accounts={accounts} />;
      case 'friends':
        return <FriendsManager accounts={accounts} selectedAccount={selectedAccount} />;
      case 'parser':
        return <SteamParser />;
      case 'account-manager':
        return <AccountManager accounts={accounts} selectedAccount={selectedAccount} />;
      case 'sda':
        return <SDAGuard accounts={accounts} />;
      case 'guard':
        return <SecurityView accounts={accounts} />;
      case 'notifications':
        return <NotificationsView />;
      case 'domains':
        return isAdmin ? <DomainsView /> : <div className="p-6 text-white/40">Нет доступа</div>;
      case 'workers':
        return isAdmin ? (
          <Workers accounts={accounts} />
        ) : (
          <div className="p-6 text-white/40">Нет доступа</div>
        );
      case 'settings':
        return <SettingsView accounts={accounts} />;
      default:
        return <Dashboard accounts={accounts} />;
    }
  };

  return (
    <div className="flex h-screen bg-dark-900 overflow-hidden">
      <Sidebar
        activeView={activeView}
        setActiveView={setActiveView}
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
        isAdmin={isAdmin}
        onLogout={logout}
        username={currentUser.username}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        <AccountBar
          accounts={accounts}
          selectedAccount={selectedAccount}
          onSelectAccount={setSelectedAccount}
          onConnectAll={handleConnectAll}
          onlineCount={onlineCount}
        />

        <div className="flex-1 overflow-hidden">
          {renderView()}
        </div>
      </div>
    </div>
  );
}
