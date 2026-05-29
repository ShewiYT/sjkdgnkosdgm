import { useState, useEffect, useRef, useMemo } from 'react';
import { MessageSquare, Send, Search, Languages, RefreshCw } from 'lucide-react';
import { useAppStore } from '../store';
import { steamApi, type FriendData } from '../api';
import type { SteamAccount } from '../types';

interface MultiChatProps {
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
  lastTimestamp: string;
  unread: number;
  inventoryValue?: number;
  personaState?: number;
}

// Translation function using Google Translate
async function translateText(text: string, from: string, to: string): Promise<string> {
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${from}&tl=${to}&dt=t&q=${encodeURIComponent(text)}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data && data[0]) {
      return data[0].map((item: any) => item[0]).join('');
    }
    return text;
  } catch {
    return text;
  }
}

export default function MultiChat({ selectedAccount }: MultiChatProps) {
  const { messages, sendMessage, fetchNewMessages, getVisibleAccounts } = useAppStore();
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [inputText, setInputText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [allFriends, setAllFriends] = useState<Map<string, FriendData[]>>(new Map());
  const [loadingFriends, setLoadingFriends] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Translation state
  const [translateIncoming, setTranslateIncoming] = useState(false);
  const [translateOutgoing, setTranslateOutgoing] = useState(false);
  const [targetLang, setTargetLang] = useState<'en' | 'ru'>('en');
  const [translatedMessages, setTranslatedMessages] = useState<Record<string, string>>({});
  const [translating, setTranslating] = useState(false);

  const accounts = getVisibleAccounts();
  const onlineAccounts = accounts.filter(a => a.status === 'online' || a.status === 'in-game');

  // Load friends for all online accounts
  const loadAllFriends = async () => {
    setLoadingFriends(true);
    const friendsMap = new Map<string, FriendData[]>();
    
    for (const acc of onlineAccounts) {
      try {
        const friends = await steamApi.getFriends(acc.id);
        friendsMap.set(acc.id, friends);
      } catch {
        friendsMap.set(acc.id, []);
      }
    }
    
    setAllFriends(friendsMap);
    setLoadingFriends(false);
  };

  // Load friends on mount and when accounts change
  useEffect(() => {
    if (onlineAccounts.length > 0) {
      loadAllFriends();
    }
  }, [onlineAccounts.length]);

  // Poll for new messages every 3 seconds
  useEffect(() => {
    fetchNewMessages();
    const interval = setInterval(fetchNewMessages, 3000);
    return () => clearInterval(interval);
  }, [fetchNewMessages]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, selectedConversation]);

  // Translate incoming messages
  useEffect(() => {
    if (!translateIncoming || !selectedConversation) return;
    
    const incomingMsgs = messages.filter(
      m => m.accountId === selectedConversation.accountId && 
           m.friendId === selectedConversation.friendId && 
           !m.isOutgoing &&
           !translatedMessages[m.id]
    );

    if (incomingMsgs.length === 0) return;

    const translateAll = async () => {
      for (const msg of incomingMsgs) {
        const translated = await translateText(msg.text, 'auto', 'ru');
        setTranslatedMessages(prev => ({ ...prev, [msg.id]: translated }));
      }
    };
    translateAll();
  }, [messages, translateIncoming, selectedConversation]);

  // Build conversations from friends + messages
  const conversations = useMemo(() => {
    const convMap = new Map<string, Conversation>();
    
    const relevantAccounts = selectedAccount 
      ? [selectedAccount].filter(a => a.status === 'online' || a.status === 'in-game')
      : onlineAccounts;

    for (const acc of relevantAccounts) {
      const friends = allFriends.get(acc.id) || [];
      for (const friend of friends) {
        const key = `${acc.id}_${friend.steamId}`;
        convMap.set(key, {
          friendId: friend.steamId,
          friendName: friend.name || friend.steamId,
          friendAvatar: '👤',
          friendAvatarUrl: friend.avatarUrl,
          accountId: acc.id,
          accountLogin: acc.login,
          lastMessage: '',
          lastTimestamp: '',
          unread: 0,
          inventoryValue: friend.inventoryValue,
          personaState: friend.personaState,
        });
      }
    }

    const relevantMessages = selectedAccount 
      ? messages.filter(m => m.accountId === selectedAccount.id)
      : messages;

    for (const msg of relevantMessages) {
      const key = `${msg.accountId}_${msg.friendId}`;
      const existing = convMap.get(key);
      
      if (existing) {
        if (!existing.lastTimestamp || new Date(msg.timestamp) > new Date(existing.lastTimestamp)) {
          existing.lastMessage = msg.text;
          existing.lastTimestamp = msg.timestamp;
        }
        if (!msg.isOutgoing) {
          existing.unread = (existing.unread || 0) + 1;
        }
        existing.friendAvatarUrl = msg.friendAvatarUrl || existing.friendAvatarUrl;
      } else {
        convMap.set(key, {
          friendId: msg.friendId,
          friendName: msg.friendName,
          friendAvatar: '👤',
          friendAvatarUrl: msg.friendAvatarUrl,
          accountId: msg.accountId,
          accountLogin: msg.accountLogin,
          lastMessage: msg.text,
          lastTimestamp: msg.timestamp,
          unread: msg.isOutgoing ? 0 : 1,
        });
      }
    }

    return Array.from(convMap.values()).sort((a, b) => {
      if (a.lastTimestamp && !b.lastTimestamp) return -1;
      if (!a.lastTimestamp && b.lastTimestamp) return 1;
      if (a.lastTimestamp && b.lastTimestamp) {
        return new Date(b.lastTimestamp).getTime() - new Date(a.lastTimestamp).getTime();
      }
      const aOnline = (a.personaState || 0) > 0;
      const bOnline = (b.personaState || 0) > 0;
      if (aOnline && !bOnline) return -1;
      if (!aOnline && bOnline) return 1;
      return a.friendName.localeCompare(b.friendName);
    });
  }, [messages, selectedAccount, onlineAccounts, allFriends]);

  const filteredConversations = conversations.filter(c =>
    !searchQuery || 
    c.friendName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.accountLogin.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.friendId.includes(searchQuery)
  );

  const conversationMessages = useMemo(() => {
    if (!selectedConversation) return [];
    return messages.filter(
      m => m.accountId === selectedConversation.accountId && m.friendId === selectedConversation.friendId
    ).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }, [messages, selectedConversation]);

  const handleSendMessage = async () => {
    if (!inputText.trim() || !selectedConversation) return;
    let textToSend = inputText.trim();
    
    if (translateOutgoing && textToSend) {
      setTranslating(true);
      textToSend = await translateText(textToSend, 'ru', targetLang);
      setTranslating(false);
    }
    
    setInputText('');
    await sendMessage(
      selectedConversation.accountId,
      selectedConversation.friendId,
      selectedConversation.friendName,
      textToSend
    );
  };

  const formatTime = (ts: string) => {
    if (!ts) return '';
    try {
      const d = new Date(ts);
      const now = new Date();
      const isToday = d.toDateString() === now.toDateString();
      if (isToday) return d.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' });
      return d.toLocaleDateString('ru', { day: '2-digit', month: '2-digit' }) + ' ' + d.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  // Fixed avatar render - check if URL is valid image URL
  const renderAvatar = (avatarUrl?: string, emoji?: string, size = 'w-10 h-10') => {
    // Check if avatarUrl is a valid URL and looks like an image
    if (avatarUrl && (avatarUrl.startsWith('http://') || avatarUrl.startsWith('https://')) && 
        (avatarUrl.includes('steamcdn') || avatarUrl.includes('akamai') || avatarUrl.includes('.jpg') || 
         avatarUrl.includes('.png') || avatarUrl.includes('.gif') || avatarUrl.includes('avatar'))) {
      return (
        <img 
          src={avatarUrl} 
          alt="" 
          className={`${size} rounded-full object-cover bg-white/10`}
          onError={(e) => {
            // If image fails to load, replace with emoji
            const target = e.target as HTMLImageElement;
            target.style.display = 'none';
            target.parentElement?.classList.add('avatar-fallback');
          }}
        />
      );
    }
    return (
      <span className={`${size} rounded-full bg-white/10 flex items-center justify-center text-sm shrink-0`}>
        {emoji || '👤'}
      </span>
    );
  };

  return (
    <div className="flex h-[calc(100vh-52px)]">
      {/* Conversations list */}
      <div className="w-80 border-r border-white/5 flex flex-col bg-dark-800/30">
        <div className="p-3 border-b border-white/5 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare size={16} className="text-indigo-400" />
              <span className="text-sm font-semibold">Мультичат</span>
            </div>
            <button 
              onClick={loadAllFriends}
              disabled={loadingFriends}
              className="p-1 rounded hover:bg-white/10 text-white/40 hover:text-white/70"
              title="Обновить список друзей"
            >
              <RefreshCw size={14} className={loadingFriends ? 'animate-spin' : ''} />
            </button>
          </div>
          <div className="text-[10px] text-white/30">{conversations.length} диалогов</div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-white/30" />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Поиск..."
              className="w-full glass-input text-xs text-white pl-9 pr-3 py-2 rounded-xl outline-none"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loadingFriends ? (
            <div className="p-4 text-center text-xs text-white/30">
              <div className="w-5 h-5 border-2 border-white/10 border-t-indigo-400 rounded-full animate-spin mx-auto mb-2" />
              Загрузка друзей...
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="p-4 text-center text-xs text-white/30">
              {conversations.length === 0 ? 'Нет друзей онлайн' : 'Ничего не найдено'}
            </div>
          ) : (
            filteredConversations.map(conv => (
              <div
                key={`${conv.accountId}_${conv.friendId}`}
                onClick={() => setSelectedConversation(conv)}
                className={`p-3 border-b border-white/5 cursor-pointer hover:bg-white/5 transition-colors ${
                  selectedConversation?.friendId === conv.friendId && selectedConversation?.accountId === conv.accountId
                    ? 'bg-white/10'
                    : ''
                }`}
              >
                <div className="flex items-start gap-2">
                  <div className="relative shrink-0">
                    {renderAvatar(conv.friendAvatarUrl, conv.friendAvatar, 'w-10 h-10')}
                    <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-dark-800 ${
                      (conv.personaState || 0) > 0 ? 'bg-green-400' : 'bg-gray-500'
                    }`} />
                    {conv.unread > 0 && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 bg-indigo-500 rounded-full flex items-center justify-center text-[9px] font-bold">
                        {conv.unread > 9 ? '9+' : conv.unread}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                      <span className={`text-xs truncate ${conv.unread > 0 ? 'font-semibold text-white' : 'text-white/80'}`}>
                        {conv.friendName}
                      </span>
                      {conv.lastTimestamp && (
                        <span className="text-[9px] text-white/30 shrink-0 ml-1">{formatTime(conv.lastTimestamp)}</span>
                      )}
                    </div>
                    <div className="text-[10px] text-white/30">через {conv.accountLogin}</div>
                    <div className={`text-[11px] truncate mt-0.5 ${conv.unread > 0 ? 'text-white/70' : 'text-white/40'}`}>
                      {conv.lastMessage || (conv.personaState ? 'Нет сообщений' : 'Оффлайн')}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col">
        {selectedConversation ? (
          <>
            {/* Chat header */}
            <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="shrink-0">
                  {renderAvatar(selectedConversation.friendAvatarUrl, selectedConversation.friendAvatar, 'w-10 h-10')}
                </div>
                <div>
                  <div className="text-sm font-medium text-white">{selectedConversation.friendName}</div>
                  <div className="text-[10px] text-white/30">
                    через {selectedConversation.accountLogin} • {selectedConversation.friendId}
                    {selectedConversation.inventoryValue && selectedConversation.inventoryValue > 0 && (
                      <span className="ml-2 text-green-400">${selectedConversation.inventoryValue.toFixed(2)}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Translation controls */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setTranslateIncoming(!translateIncoming)}
                  className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] transition-colors ${
                    translateIncoming ? 'bg-blue-500/20 text-blue-400' : 'bg-white/5 text-white/40'
                  }`}
                  title="Переводить входящие на русский"
                >
                  <Languages size={12} />
                  EN→RU
                </button>
                <button
                  onClick={() => setTranslateOutgoing(!translateOutgoing)}
                  className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] transition-colors ${
                    translateOutgoing ? 'bg-green-500/20 text-green-400' : 'bg-white/5 text-white/40'
                  }`}
                  title="Переводить исходящие"
                >
                  <Languages size={12} />
                  RU→{targetLang.toUpperCase()}
                </button>
                {translateOutgoing && (
                  <select
                    value={targetLang}
                    onChange={e => setTargetLang(e.target.value as 'en' | 'ru')}
                    className="bg-white/5 text-white/60 text-[10px] px-2 py-1 rounded-lg outline-none"
                  >
                    <option value="en" className="bg-gray-900">English</option>
                    <option value="ru" className="bg-gray-900">Русский</option>
                  </select>
                )}
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {conversationMessages.length === 0 ? (
                <div className="text-center text-xs text-white/20 py-8">
                  Нет сообщений. Начните диалог!
                </div>
              ) : (
                conversationMessages.map(msg => (
                  <div
                    key={msg.id}
                    className={`flex gap-2 ${msg.isOutgoing ? 'justify-end' : 'justify-start'}`}
                  >
                    {!msg.isOutgoing && (
                      <div className="shrink-0 mt-auto">
                        {renderAvatar(selectedConversation.friendAvatarUrl, '👤', 'w-6 h-6')}
                      </div>
                    )}
                    <div className={`max-w-[60%] px-3 py-2 rounded-2xl text-sm ${
                      msg.isOutgoing
                        ? 'bg-indigo-500/20 text-white rounded-br-md'
                        : 'bg-white/5 text-white/80 rounded-bl-md'
                    }`}>
                      <div>{msg.text}</div>
                      {!msg.isOutgoing && translateIncoming && translatedMessages[msg.id] && (
                        <div className="text-[11px] text-blue-400/80 mt-1 pt-1 border-t border-white/10">
                          🇷🇺 {translatedMessages[msg.id]}
                        </div>
                      )}
                      <div className="text-[9px] text-white/30 mt-1 text-right">
                        {formatTime(msg.timestamp)}
                      </div>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Translation status */}
            {(translateOutgoing || translating) && (
              <div className="px-4 py-1 border-t border-white/5 flex items-center gap-3 text-[10px]">
                {translateOutgoing && (
                  <span className="text-green-400/60">
                    ✓ Авто-перевод RU → {targetLang.toUpperCase()}
                  </span>
                )}
                {translating && (
                  <span className="text-yellow-400/60 flex items-center gap-1">
                    <div className="w-2 h-2 border border-yellow-400/40 border-t-yellow-400 rounded-full animate-spin" />
                    Переводим...
                  </span>
                )}
              </div>
            )}

            {/* Input */}
            <div className="p-3 border-t border-white/5 flex gap-2">
              <input
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
                placeholder={translateOutgoing ? `Пишите на русском → ${targetLang === 'en' ? 'English' : 'Русский'}` : 'Введите сообщение...'}
                className="flex-1 glass-input text-sm text-white px-4 py-3 rounded-xl outline-none"
              />
              <button
                onClick={handleSendMessage}
                disabled={!inputText.trim() || translating}
                className="glass-btn p-3 rounded-xl disabled:opacity-30"
              >
                <Send size={16} />
              </button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessageSquare size={48} className="mx-auto mb-4 text-white/10" />
              <div className="text-lg text-white/30">Выберите диалог</div>
              <div className="text-sm text-white/20 mt-1">
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
