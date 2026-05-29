import { useState, useEffect, useRef } from 'react';
import { MessageSquare, Search, Send, Package } from 'lucide-react';
import { useAppStore } from '../store';
import { steamApi } from '../api';
import type { SteamAccount, ChatMessage } from '../types';
import type { FriendData } from '../api';

const STEAM_API_KEY = '5E2360739CA18D2898E957F7936DA9AE';

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

export default function MultiChat({ accounts, selectedAccount }: MultiChatProps) {
  const { messages, sendMessage, fetchNewMessages, steamMarketApiKey } = useAppStore();
  const [friends, setFriends] = useState<FriendData[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [inventoryValues, setInventoryValues] = useState<
    Record<string, { value: number; loading: boolean }>
  >({});
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

  const conversationMessages: ChatMessage[] = selectedConversation
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
    <div className="flex h-full overflow-hidden">
      {/* Friends list */}
      <div className="w-64 flex flex-col border-r border-white/5 shrink-0">
        <div className="p-3 border-b border-white/5 space-y-2">
          <div className="flex items-center gap-2">
            <MessageSquare size={16} className="text-white/40" />
            <span className="text-sm font-semibold text-white">Мультичат</span>
          </div>
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Поиск друзей..."
              className="w-full glass-input text-xs text-white pl-9 pr-3 py-2 rounded-xl outline-none"
            />
          </div>
        </div>

        <div className="text-[10px] text-white/20 px-3 py-1">
          {filteredConversations.length} друзей
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-center text-xs text-white/30">Загрузка...</div>
          ) : filteredConversations.length === 0 ? (
            <div className="p-8 text-center">
              <MessageSquare size={32} className="mx-auto mb-2 text-white/10" />
              <div className="text-xs text-white/30">Нет друзей</div>
            </div>
          ) : (
            filteredConversations.map(conv => (
              <button
                key={`${conv.accountId}-${conv.friendId}`}
                onClick={() => setSelectedConversation(conv)}
                className={`w-full flex items-center gap-2 px-3 py-2.5 text-left transition-colors ${
                  selectedConversation?.friendId === conv.friendId
                    ? 'bg-white/10'
                    : 'hover:bg-white/5'
                }`}
              >
                {conv.friendAvatarUrl ? (
                  <img src={conv.friendAvatarUrl} alt="" className="w-8 h-8 rounded-full shrink-0" />
                ) : (
                  <span className="w-8 h-8 flex items-center justify-center text-base shrink-0">
                    👤
                  </span>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-white truncate">{conv.friendName}</div>
                  {conv.lastMessage && (
                    <div className="text-[10px] text-white/30 truncate">{conv.lastMessage}</div>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedConversation ? (
          <>
            {/* Chat header */}
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
                <div className="text-sm text-white font-medium">{selectedConversation.friendName}</div>
                <div className="text-[10px] text-white/30">
                  через {selectedConversation.accountLogin} • {selectedConversation.friendId}
                </div>
              </div>

              {/* Inventory value block */}
              <div className="flex items-center gap-2">
                {selectedInventory ? (
                  <div className="flex items-center gap-1.5 text-xs">
                    <Package size={12} className="text-blue-400" />
                    {selectedInventory.loading ? (
                      <span className="text-white/30">Загрузка...</span>
                    ) : (
                      <span className="text-green-400 font-medium">
                        ${selectedInventory.value.toFixed(2)}
                      </span>
                    )}
                  </div>
                ) : null}
                <button
                  onClick={() => fetchInventoryValue(selectedConversation.friendId)}
                  className="text-[10px] px-2 py-1 rounded-lg bg-white/5 text-white/40 hover:bg-white/10"
                >
                  💰 Инвентарь
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {conversationMessages.length === 0 ? (
                <div className="text-center text-xs text-white/20 pt-8">
                  Нет сообщений. Начните диалог!
                </div>
              ) : (
                conversationMessages.map(msg => (
                  <div
                    key={msg.id}
                    className={`flex items-end gap-2 ${msg.isOutgoing ? 'flex-row-reverse' : ''}`}
                  >
                    {!msg.isOutgoing && (
                      <span className="text-base shrink-0">👤</span>
                    )}
                    <div
                      className={`max-w-xs rounded-2xl px-3 py-2 text-sm ${
                        msg.isOutgoing
                          ? 'bg-indigo-500/30 text-white'
                          : 'bg-white/5 text-white/80'
                      }`}
                    >
                      <div>{msg.text}</div>
                      <div className="text-[10px] text-white/30 mt-0.5 text-right">
                        {formatTime(msg.timestamp)}
                      </div>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="flex items-center gap-2 p-3 border-t border-white/5">
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
                className="p-3 rounded-xl bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30 transition-colors disabled:opacity-30"
              >
                <Send size={16} />
              </button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <MessageSquare size={48} className="text-white/10 mb-4" />
            <div className="text-white/30 text-sm">Выберите диалог</div>
            <div className="text-white/20 text-xs mt-1">
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
