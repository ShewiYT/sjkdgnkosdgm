import { useState, useEffect, useRef } from 'react';
import { MessageSquare, Search, Send, DollarSign, RefreshCw } from 'lucide-react';
import { useAppStore } from '../store';
import { steamApi } from '../api';
import type { SteamAccount } from '../types';
import type { FriendData } from '../api';

interface MultiChatProps {
  accounts: SteamAccount[];
  selectedAccount: SteamAccount | null;
}

interface Conversation {
  friendId: string;
  friendName: string;
  friendAvatar: string;
  friendAvatarUrl?: string;
  accountId: string;
  accountLogin: string;
  lastMessage: string;
  timestamp: string;
  inventoryValue?: number;
}

const STEAM_API_KEY = '5E2360739CA18D2898E957F7936DA9AE';

export default function MultiChat({ accounts, selectedAccount }: MultiChatProps) {
  const { messages, sendMessage, fetchNewMessages, steamMarketApiKey } = useAppStore();
  const [friends, setFriends] = useState<FriendData[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [inventoryValues, setInventoryValues] = useState<Record<string, { value: number; loading: boolean }>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const onlineAccounts = accounts.filter(a => a.status === 'online' || a.status === 'in-game');
  const activeAccount = selectedAccount || onlineAccounts[0];

  useEffect(() => {
    if (!activeAccount || activeAccount.status === 'offline') return;
    setLoading(true);
    steamApi.getFriends(activeAccount.id).then(f => {
      setFriends(f);
      setLoading(false);
    });
    const interval = setInterval(() => {
      fetchNewMessages();
    }, 5000);
    return () => clearInterval(interval);
  }, [activeAccount?.id, fetchNewMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, selectedConversation]);

  const fetchInventoryValue = async (steamId: string) => {
    if (inventoryValues[steamId]?.loading) return;
    setInventoryValues(prev => ({ ...prev, [steamId]: { value: 0, loading: true } }));
    try {
      const apiKey = steamMarketApiKey || STEAM_API_KEY;
      const value = await steamApi.getInventoryValue(steamId, apiKey);
      setInventoryValues(prev => ({ ...prev, [steamId]: { value, loading: false } }));
    } catch {
      setInventoryValues(prev => ({ ...prev, [steamId]: { value: 0, loading: false } }));
    }
  };

  const conversations: Conversation[] = friends.map(f => {
    const friendMsgs = messages.filter(
      m => m.accountId === activeAccount?.id && m.friendId === f.steamId
    );
    const last = friendMsgs[friendMsgs.length - 1];
    return {
      friendId: f.steamId,
      friendName: f.name || f.steamId,
      friendAvatar: f.avatar || '👤',
      friendAvatarUrl: f.avatarUrl,
      accountId: activeAccount?.id || '',
      accountLogin: activeAccount?.login || '',
      lastMessage: last?.text || '',
      timestamp: last?.timestamp || '',
      inventoryValue: f.inventoryValue,
    };
  });

  const filteredConversations = conversations.filter(c =>
    c.friendName.toLowerCase().includes(search.toLowerCase())
  );

  const conversationMessages = selectedConversation
    ? messages.filter(
        m =>
          m.accountId === selectedConversation.accountId &&
          m.friendId === selectedConversation.friendId
      )
    : [];

  const handleSendMessage = async () => {
    if (!inputText.trim() || !selectedConversation || !activeAccount) return;
    const text = inputText;
    setInputText('');
    await sendMessage(
      activeAccount.id,
      selectedConversation.friendId,
      selectedConversation.friendName,
      text
    );
  };

  const formatTime = (ts: string) => {
    if (!ts) return '';
    return new Date(ts).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' });
  };

  const selectedInventory = selectedConversation
    ? inventoryValues[selectedConversation.friendId]
    : undefined;

  return (
    <div className="flex h-[calc(100vh-52px)]">
      {/* Friends list */}
      <div className="w-72 border-r border-white/5 flex flex-col">
        <div className="p-3 border-b border-white/5 space-y-2">
          <div className="flex items-center gap-2">
            <MessageSquare size={16} className="text-indigo-400" />
            <span className="text-sm font-semibold text-white">Мультичат</span>
          </div>
          <div className="relative">
            <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Поиск друзей..."
              className="w-full glass-input text-xs text-white pl-9 pr-3 py-2 rounded-xl outline-none"
            />
          </div>
        </div>

        <div className="text-[10px] text-white/30 px-3 py-1">{filteredConversations.length} друзей</div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="text-center p-8 text-xs text-white/30">Загрузка...</div>
          ) : filteredConversations.length === 0 ? (
            <div className="text-center p-8 text-xs text-white/30">
              <MessageSquare size={24} className="mx-auto mb-2 opacity-30" />
              Нет друзей
            </div>
          ) : (
            filteredConversations.map(conv => (
              <button
                key={conv.friendId}
                onClick={() => setSelectedConversation(conv)}
                className={`w-full flex items-center gap-2 px-3 py-2.5 hover:bg-white/5 transition-colors text-left ${
                  selectedConversation?.friendId === conv.friendId ? 'bg-white/5' : ''
                }`}
              >
                {conv.friendAvatarUrl && conv.friendAvatarUrl.includes('http') ? (
                  <img src={conv.friendAvatarUrl} alt="" className="w-8 h-8 rounded-full shrink-0" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-sm shrink-0">
                    👤
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-xs text-white truncate">{conv.friendName}</div>
                  <div className="text-[10px] text-white/30 truncate">
                    {conv.lastMessage || 'Нет сообщений'}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {selectedConversation ? (
          <>
            {/* Chat header with inventory */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5">
              {selectedConversation.friendAvatarUrl ? (
                <img
                  src={selectedConversation.friendAvatarUrl}
                  alt=""
                  className="w-8 h-8 rounded-full"
                />
              ) : (
                <span className="text-xl">👤</span>
              )}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-white">{selectedConversation.friendName}</div>
                <div className="text-[10px] text-white/30">
                  через {selectedConversation.accountLogin} • {selectedConversation.friendId}
                </div>
              </div>

              {/* Inventory value block */}
              <div className="flex items-center gap-2 ml-auto">
                {selectedInventory ? (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-green-500/10 border border-green-500/20">
                    <DollarSign size={12} className="text-green-400" />
                    {selectedInventory.loading ? (
                      <span className="text-xs text-white/40 animate-pulse">Загрузка...</span>
                    ) : (
                      <span className="text-xs text-green-400 font-semibold">
                        ${selectedInventory.value.toFixed(2)}
                      </span>
                    )}
                  </div>
                ) : null}
                <button
                  onClick={() => fetchInventoryValue(selectedConversation.friendId)}
                  disabled={selectedInventory?.loading}
                  title="Загрузить стоимость инвентаря CS2 из Steam Market"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs hover:bg-indigo-500/20 transition-colors disabled:opacity-50"
                >
                  <RefreshCw size={12} className={selectedInventory?.loading ? 'animate-spin' : ''} />
                  {selectedInventory ? 'Обновить' : 'Инвентарь $'}
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {conversationMessages.length === 0 ? (
                <div className="text-center text-white/20 text-sm mt-8">
                  Нет сообщений. Начните диалог!
                </div>
              ) : (
                conversationMessages.map(msg => (
                  <div
                    key={msg.id}
                    className={`flex items-end gap-2 ${msg.isOutgoing ? 'flex-row-reverse' : ''}`}
                  >
                    {!msg.isOutgoing && (
                      <span className="text-lg shrink-0">👤</span>
                    )}
                    <div
                      className={`max-w-xs rounded-2xl px-3 py-2 text-sm ${
                        msg.isOutgoing
                          ? 'bg-indigo-500/20 text-white'
                          : 'bg-white/5 text-white'
                      }`}
                    >
                      <div>{msg.text}</div>
                      <div className="text-[10px] text-white/30 mt-1">{formatTime(msg.timestamp)}</div>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="flex items-center gap-2 px-4 py-3 border-t border-white/5">
              <input
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
                placeholder="Введите сообщение..."
                className="flex-1 glass-input text-sm text-white px-4 py-3 rounded-xl outline-none"
              />
              <button
                onClick={handleSendMessage}
                disabled={!inputText.trim()}
                className="p-3 rounded-xl bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30 disabled:opacity-30 transition-colors"
              >
                <Send size={16} />
              </button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-white/20">
            <MessageSquare size={48} className="mb-4 opacity-20" />
            <div className="text-sm">Выберите диалог</div>
            <div className="text-xs mt-1 text-white/10">
              {conversations.length > 0
                ? 'Выберите друга слева для начала переписки'
                : 'Подключите аккаунты для загрузки списка друзей'}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
