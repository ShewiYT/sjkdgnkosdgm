import { useState, useEffect, useRef } from 'react';
import { MessageSquare, Send, RefreshCw, Users } from 'lucide-react';
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

export default function MultiChat({ accounts, selectedAccount }: MultiChatProps) {
  const { messages, sendMessage, fetchNewMessages } = useAppStore();
  const [friends, setFriends] = useState<FriendData[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
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

  const conversations: Conversation[] = friends.map(f => {
    const friendMsgs = messages.filter(m =>
      m.accountId === activeAccount?.id && m.friendId === f.steamId
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
    ? messages.filter(m =>
        m.accountId === selectedConversation.accountId &&
        m.friendId === selectedConversation.friendId
      )
    : [];

  const handleSendMessage = async () => {
    if (!inputText.trim() || !selectedConversation || !activeAccount) return;
    const text = inputText;
    setInputText('');
    await sendMessage(activeAccount.id, selectedConversation.friendId, selectedConversation.friendName, text);
  };

  const formatTime = (ts: string) => {
    if (!ts) return '';
    return new Date(ts).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex h-[calc(100vh-52px)]">
      {/* Friends list */}
      <div className="w-72 border-r border-white/5 flex flex-col">
        <div className="p-3 border-b border-white/5 space-y-2">
          <div className="flex items-center gap-2">
            <MessageSquare size={16} className="text-indigo-400" />
            <span className="text-sm font-semibold text-white">Мультичат</span>
          </div>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Поиск друзей..."
            className="w-full glass-input text-xs text-white px-3 py-2 rounded-xl outline-none"
          />
        </div>

        <div className="text-[10px] text-white/30 px-3 py-1">{filteredConversations.length} друзей</div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center p-8">
              <RefreshCw size={16} className="animate-spin text-white/30" />
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="text-center p-8 text-xs text-white/30">
              <Users size={24} className="mx-auto mb-2 opacity-30" />
              Нет друзей
            </div>
          ) : (
            filteredConversations.map(conv => (
              <button
                key={conv.friendId}
                onClick={() => setSelectedConversation(conv)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors ${
                  selectedConversation?.friendId === conv.friendId ? 'bg-white/10' : 'hover:bg-white/5'
                }`}
              >
                {conv.friendAvatarUrl ? (
                  <img src={conv.friendAvatarUrl} alt="" className="w-8 h-8 rounded-full" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-sm">👤</div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-xs text-white truncate">{conv.friendName}</div>
                  <div className="text-[10px] text-white/30 truncate">{conv.lastMessage || 'Нет сообщений'}</div>
                </div>
                {conv.inventoryValue && conv.inventoryValue > 0 && (
                  <span className="text-[9px] text-green-400/60">${conv.inventoryValue.toFixed(0)}</span>
                )}
              </button>
            ))
          )}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col">
        {selectedConversation ? (
          <>
            <div className="px-4 py-3 border-b border-white/5 flex items-center gap-3">
              {selectedConversation.friendAvatarUrl ? (
                <img src={selectedConversation.friendAvatarUrl} alt="" className="w-10 h-10 rounded-full" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-lg">👤</div>
              )}
              <div>
                <div className="text-sm font-medium text-white">{selectedConversation.friendName}</div>
                <div className="text-[10px] text-white/30">
                  через {selectedConversation.accountLogin} • {selectedConversation.friendId}
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {conversationMessages.length === 0 ? (
                <div className="text-center text-xs text-white/30 mt-8">
                  Нет сообщений. Начните диалог!
                </div>
              ) : (
                conversationMessages.map(msg => (
                  <div key={msg.id} className={`flex ${msg.isOutgoing ? 'justify-end' : 'justify-start'} gap-2`}>
                    {!msg.isOutgoing && (
                      <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-xs shrink-0">👤</div>
                    )}
                    <div className={`max-w-[70%] rounded-2xl px-3 py-2 ${
                      msg.isOutgoing ? 'bg-indigo-500/20 text-white' : 'bg-white/5 text-white'
                    }`}>
                      <div className="text-sm">{msg.text}</div>
                      <div className="text-[9px] text-white/30 mt-1">{formatTime(msg.timestamp)}</div>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="px-4 py-3 border-t border-white/5 flex gap-2">
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
                className="glass-btn px-4 py-3 rounded-xl disabled:opacity-30"
              >
                <Send size={16} />
              </button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-white/20">
              <MessageSquare size={48} className="mx-auto mb-3 opacity-20" />
              <div className="text-sm">Выберите диалог</div>
              <div className="text-xs mt-1">
                {conversations.length > 0
                  ? 'Выберите друга слева для начала переписки'
                  : 'Подключите аккаунты для загрузки списка друзей'}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
