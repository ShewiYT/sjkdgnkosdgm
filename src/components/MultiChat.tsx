import { useState, useEffect, useRef, useCallback } from 'react';
import { MessageSquare, Send, Search, Languages, BookMarked, Plus, Package } from 'lucide-react';
import { useAppStore } from '../store';
import type { SteamAccount } from '../types';

interface MultiChatProps {
  accounts: SteamAccount[];
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
}

async function translateText(text: string, sourceLang: string, targetLang: string): Promise<string> {
  if (!text.trim()) return text;
  try {
    const googleRes = await fetch(
      `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`
    );
    if (googleRes.ok) {
      const data = await googleRes.json();
      if (data?.[0]?.[0]?.[0]) {
        return data[0].map((part: any) => part[0]).join('');
      }
    }
  } catch { /* ignore */ }
  return text;
}

export default function MultiChat(_props: MultiChatProps) {
  const { messages, sendMessage } = useAppStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [inputText, setInputText] = useState('');
  const [translateOutgoing, setTranslateOutgoing] = useState(false);
  const [translateIncoming, setTranslateIncoming] = useState(false);
  const [targetLang, setTargetLang] = useState<'en' | 'ru'>('en');
  const [templates, setTemplates] = useState(['Привет!', 'Кинь оффер', 'Цена?', 'Добавь в друзья']);
  const [showTemplates, setShowTemplates] = useState(false);
  const [newTemplate, setNewTemplate] = useState('');
  const [translatedMessages, setTranslatedMessages] = useState<Record<string, string>>({});
  const [translating, setTranslating] = useState(false);
  const [inventoryCache, setInventoryCache] = useState<Record<string, number>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Polling is handled at app level

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, selectedConversation]);

  // Build conversations from messages
  const conversations: Conversation[] = [];
  const convMap = new Map<string, Conversation>();

  messages.forEach(msg => {
    const key = `${msg.accountId}_${msg.friendId}`;
    if (!convMap.has(key)) {
      convMap.set(key, {
        friendId: msg.friendId,
        friendName: msg.friendName,
        friendAvatar: msg.friendAvatar,
        friendAvatarUrl: msg.friendAvatarUrl,
        accountId: msg.accountId,
        accountLogin: msg.accountLogin,
        lastMessage: msg.text,
        lastTimestamp: msg.timestamp,
        unread: msg.isOutgoing ? 0 : 1,
        inventoryValue: inventoryCache[msg.friendId],
      });
    } else {
      const conv = convMap.get(key)!;
      if (msg.timestamp > conv.lastTimestamp) {
        conv.lastMessage = msg.text;
        conv.lastTimestamp = msg.timestamp;
      }
      if (msg.friendAvatarUrl) conv.friendAvatarUrl = msg.friendAvatarUrl;
      if (!msg.isOutgoing) conv.unread++;
      if (inventoryCache[msg.friendId]) conv.inventoryValue = inventoryCache[msg.friendId];
    }
  });

  convMap.forEach(c => conversations.push(c));
  
  // СОРТИРОВКА: сначала непрочитанные (unread > 0), потом по времени
  conversations.sort((a, b) => {
    // Непрочитанные всегда наверху
    if (a.unread > 0 && b.unread === 0) return -1;
    if (a.unread === 0 && b.unread > 0) return 1;
    // Внутри группы - по времени (новые выше)
    return b.lastTimestamp.localeCompare(a.lastTimestamp);
  });

  // Load inventory values
  useEffect(() => {
    const friendIds = [...new Set(conversations.map(c => c.friendId))];
    friendIds.forEach(friendId => {
      if (inventoryCache[friendId] === undefined) {
        fetch(`/api/inventory/${friendId}`)
          .then(r => r.json())
          .then(data => {
            if (data.totalValue !== undefined) {
              setInventoryCache(prev => ({ ...prev, [friendId]: data.totalValue }));
            }
          })
          .catch(() => {});
      }
    });
  }, [conversations.length]);

  const filteredConversations = searchQuery
    ? conversations.filter(c =>
        c.friendName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.accountLogin.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : conversations;

  const conversationMessages = selectedConversation
    ? messages.filter(
        m => m.accountId === selectedConversation.accountId && m.friendId === selectedConversation.friendId
      )
    : [];

  // Translate incoming messages
  const translateIncomingMessages = useCallback(async () => {
    if (!translateIncoming || !selectedConversation) return;
    setTranslating(true);
    const incoming = conversationMessages.filter(m => !m.isOutgoing && !translatedMessages[m.id]);
    for (const msg of incoming) {
      const translated = await translateText(msg.text, 'auto', 'ru');
      if (translated !== msg.text) {
        setTranslatedMessages(prev => ({ ...prev, [msg.id]: translated }));
      }
    }
    setTranslating(false);
  }, [translateIncoming, selectedConversation, conversationMessages, translatedMessages]);

  useEffect(() => {
    if (translateIncoming) translateIncomingMessages();
  }, [translateIncoming, conversationMessages.length]);

  const handleSendMessage = async () => {
    if (!inputText.trim() || !selectedConversation) return;
    let textToSend = inputText.trim();
    if (translateOutgoing) {
      textToSend = await translateText(textToSend, 'ru', targetLang);
    }
    await sendMessage(
      selectedConversation.accountId,
      selectedConversation.friendId,
      selectedConversation.friendName,
      textToSend
    );
    setInputText('');
  };

  const addTemplate = () => {
    if (newTemplate.trim() && !templates.includes(newTemplate.trim())) {
      setTemplates([...templates, newTemplate.trim()]);
      setNewTemplate('');
    }
  };

  const formatTime = (ts: string) => {
    const d = new Date(ts);
    return d.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' });
  };

  const renderAvatar = (url?: string, fallback?: string, className = 'w-8 h-8') => {
    if (url) {
      return <img src={url} alt="" className={`${className} rounded-full`} />;
    }
    return <span className={`${className} flex items-center justify-center bg-white/10 rounded-full text-sm`}>{fallback || '👤'}</span>;
  };

  return (
    <div className="flex h-full">
      {/* Conversations list */}
      <div className="w-80 border-r border-white/5 flex flex-col">
        <div className="p-4 border-b border-white/5">
          <div className="flex items-center gap-2 mb-3">
            <MessageSquare className="w-5 h-5 text-indigo-400" />
            <span className="font-semibold">Мультичат</span>
          </div>
          <div className="text-xs text-white/30 mb-3">{conversations.length} диалогов</div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Поиск..."
              className="w-full glass-input text-xs text-white pl-9 pr-3 py-2 rounded-xl outline-none"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filteredConversations.length === 0 ? (
            <div className="p-4 text-center text-xs text-white/30">
              {conversations.length === 0 ? 'Нет диалогов' : 'Ничего не найдено'}
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
                <div className="flex items-center gap-3">
                  <div className="relative">
                    {renderAvatar(conv.friendAvatarUrl, conv.friendAvatar, 'w-10 h-10')}
                    {conv.unread > 0 && (
                      <span className="absolute -top-1 -right-1 w-5 h-5 bg-indigo-500 rounded-full text-[10px] flex items-center justify-center font-bold">
                        {conv.unread > 9 ? '9+' : conv.unread}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className={`text-sm truncate ${conv.unread > 0 ? 'font-semibold text-white' : 'text-white/80'}`}>
                        {conv.friendName}
                      </span>
                      <span className="text-[10px] text-white/30">{formatTime(conv.lastTimestamp)}</span>
                    </div>
                    <div className="text-[10px] text-white/30 truncate">через {conv.accountLogin}</div>
                    <div className={`text-xs truncate mt-0.5 ${conv.unread > 0 ? 'text-white/70' : 'text-white/40'}`}>
                      {conv.lastMessage}
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
            <div className="p-4 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative">
                  {renderAvatar(selectedConversation.friendAvatarUrl, selectedConversation.friendAvatar || '👤', 'w-10 h-10')}
                </div>
                <div>
                  <div className="font-semibold">{selectedConversation.friendName}</div>
                  <div className="text-[10px] text-white/30 flex items-center gap-2">
                    <span>через {selectedConversation.accountLogin} • {selectedConversation.friendId}</span>
                    {(selectedConversation.inventoryValue ?? inventoryCache[selectedConversation.friendId]) > 0 && (
                      <span className="flex items-center gap-1 text-green-400">
                        <Package className="w-3 h-3" />
                        ${(selectedConversation.inventoryValue ?? inventoryCache[selectedConversation.friendId] ?? 0).toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Translate controls */}
                <div className="flex items-center gap-1 text-xs">
                  <button
                    onClick={() => setTranslateIncoming(!translateIncoming)}
                    className={`px-2 py-1 rounded-lg flex items-center gap-1 transition-colors ${
                      translateIncoming ? 'bg-blue-500/20 text-blue-400' : 'bg-white/5 text-white/40'
                    }`}
                  >
                    <Languages className="w-3 h-3" />
                    Входящие→RU
                  </button>
                  <button
                    onClick={() => setTranslateOutgoing(!translateOutgoing)}
                    className={`px-2 py-1 rounded-lg flex items-center gap-1 transition-colors ${
                      translateOutgoing ? 'bg-green-500/20 text-green-400' : 'bg-white/5 text-white/40'
                    }`}
                  >
                    RU→{targetLang.toUpperCase()}
                  </button>
                  {translateOutgoing && (
                    <select
                      value={targetLang}
                      onChange={e => setTargetLang(e.target.value as 'en' | 'ru')}
                      className="bg-white/5 text-white/60 text-xs px-2 py-1 rounded-lg outline-none"
                    >
                      <option value="en" className="bg-dark-800">EN</option>
                      <option value="ru" className="bg-dark-800">RU</option>
                    </select>
                  )}
                </div>

                <button
                  onClick={() => setShowTemplates(!showTemplates)}
                  className={`p-2 rounded-lg transition-colors ${showTemplates ? 'bg-indigo-500/20 text-indigo-400' : 'bg-white/5 text-white/40'}`}
                >
                  <BookMarked className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Templates panel */}
            {showTemplates && (
              <div className="p-3 border-b border-white/5 bg-white/5">
                <div className="flex flex-wrap gap-1 mb-2">
                  {templates.map((t, i) => (
                    <button
                      key={i}
                      onClick={() => setInputText(t)}
                      className="px-2 py-1 rounded-lg bg-white/10 text-white/60 text-xs hover:bg-white/20"
                    >
                      {t}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newTemplate}
                    onChange={e => setNewTemplate(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addTemplate()}
                    placeholder="Новый шаблон..."
                    className="flex-1 glass-input text-xs text-white px-3 py-2 rounded-lg outline-none"
                  />
                  <button onClick={addTemplate} className="p-2 rounded-lg bg-white/10 text-white/60 hover:bg-white/20">
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {conversationMessages.map(msg => (
                <div
                  key={msg.id}
                  className={`flex items-end gap-2 ${msg.isOutgoing ? 'flex-row-reverse' : ''}`}
                >
                  {!msg.isOutgoing && (
                    <div className="shrink-0">
                      {renderAvatar(selectedConversation.friendAvatarUrl, selectedConversation.friendAvatar || '👤', 'w-6 h-6')}
                    </div>
                  )}
                  <div
                    className={`max-w-[70%] px-3 py-2 rounded-2xl ${
                      msg.isOutgoing
                        ? 'bg-indigo-500/20 text-white rounded-br-sm'
                        : 'bg-white/10 text-white/90 rounded-bl-sm'
                    }`}
                  >
                    <div className="text-sm">{msg.text}</div>
                    {!msg.isOutgoing && translateIncoming && translatedMessages[msg.id] && (
                      <div className="text-xs text-blue-400/70 mt-1 pt-1 border-t border-white/10">
                        🇷🇺 {translatedMessages[msg.id]}
                      </div>
                    )}
                    <div className="text-[10px] text-white/30 mt-1">
                      {formatTime(msg.timestamp)}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Status indicators */}
            {(translateOutgoing || translating) && (
              <div className="px-4 py-1 flex items-center gap-3 text-[10px]">
                {translateOutgoing && (
                  <span className="text-green-400/60 flex items-center gap-1">
                    <Languages className="w-3 h-3" />
                    Авто-перевод RU → {targetLang.toUpperCase()}
                  </span>
                )}
                {translating && (
                  <span className="text-blue-400/60 flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                    Переводим...
                  </span>
                )}
              </div>
            )}

            {/* Input */}
            <div className="p-4 border-t border-white/5 flex gap-3">
              <input
                type="text"
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
                placeholder={translateOutgoing ? `Пишите на русском → ${targetLang === 'en' ? 'English' : 'Русский'}` : 'Введите сообщение...'}
                className="flex-1 glass-input text-sm text-white px-4 py-3 rounded-xl outline-none"
              />
              <button
                onClick={handleSendMessage}
                disabled={!inputText.trim()}
                className="px-4 py-3 rounded-xl bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30 transition-colors disabled:opacity-30"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-center">
            <div>
              <MessageSquare className="w-12 h-12 text-white/10 mx-auto mb-4" />
              <div className="text-white/40">Выберите диалог</div>
              <div className="text-xs text-white/20 mt-1">
                {conversations.length > 0
                  ? 'Выберите диалог слева'
                  : 'Диалоги появятся когда придут сообщения'}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
