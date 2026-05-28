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

// Better translation using LibreTranslate or Google fallback
async function translateText(text: string, sourceLang: string, targetLang: string): Promise<string> {
  if (!text.trim()) return text;
  
  try {
    // Try LibreTranslate (free, self-hosted option)
    const libreRes = await fetch('https://libretranslate.com/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        q: text,
        source: sourceLang,
        target: targetLang,
        format: 'text'
      }),
    });
    if (libreRes.ok) {
      const data = await libreRes.json();
      if (data.translatedText) return data.translatedText;
    }
  } catch { /* try next */ }

  try {
    // Fallback: Google Translate unofficial endpoint
    const googleRes = await fetch(
      `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`
    );
    if (googleRes.ok) {
      const data = await googleRes.json();
      if (data?.[0]?.[0]?.[0]) {
        // Combine all translated parts
        const translated = data[0].map((part: any) => part[0]).join('');
        return translated;
      }
    }
  } catch { /* ignore */ }

  try {
    // Last fallback: server-side translation
    const serverRes = await fetch('/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, sourceLang, targetLang }),
    });
    if (serverRes.ok) {
      const data = await serverRes.json();
      if (data.translatedText) return data.translatedText;
    }
  } catch { /* ignore */ }

  return text;
}

export default function MultiChat(_props: MultiChatProps) {
  const { messages, sendMessage, startPolling, stopPolling } = useAppStore();
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

  useEffect(() => {
    startPolling();
    return () => stopPolling();
  }, [startPolling, stopPolling]);

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
  conversations.sort((a, b) => b.lastTimestamp.localeCompare(a.lastTimestamp));

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
        c.accountLogin.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.friendId.includes(searchQuery)
      )
    : conversations;

  // Messages for selected conversation
  const conversationMessages = selectedConversation
    ? messages.filter(m =>
        m.accountId === selectedConversation.accountId &&
        m.friendId === selectedConversation.friendId
      )
    : [];

  // Translate incoming messages when toggle is on
  const translateIncomingMessages = useCallback(async () => {
    if (!translateIncoming || !selectedConversation) return;
    setTranslating(true);
    const incomingMsgs = conversationMessages.filter(m => !m.isOutgoing && !translatedMessages[m.id]);
    for (const msg of incomingMsgs) {
      try {
        const translated = await translateText(msg.text, 'en', 'ru');
        if (translated !== msg.text) {
          setTranslatedMessages(prev => ({ ...prev, [msg.id]: translated }));
        }
      } catch { /* ignore */ }
    }
    setTranslating(false);
  }, [translateIncoming, selectedConversation, conversationMessages, translatedMessages]);

  useEffect(() => {
    if (translateIncoming) {
      translateIncomingMessages();
    }
  }, [translateIncoming, conversationMessages.length]);

  const handleSendMessage = async () => {
    if (!inputText.trim() || !selectedConversation) return;

    let textToSend = inputText.trim();

    // Translate outgoing message if enabled
    if (translateOutgoing) {
      try {
        const sourceLang = targetLang === 'en' ? 'ru' : 'en';
        const translated = await translateText(textToSend, sourceLang, targetLang);
        textToSend = translated;
      } catch { /* ignore */ }
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
    if (newTemplate.trim()) {
      setTemplates(prev => [...prev, newTemplate.trim()]);
      setNewTemplate('');
    }
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' });
  };

  // Render avatar
  const renderAvatar = (avatarUrl?: string, fallback: string = '👤', className: string = 'w-8 h-8') => {
    if (avatarUrl) {
      return (
        <img 
          src={avatarUrl} 
          alt="" 
          className={`${className} rounded-full object-cover`}
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
      );
    }
    return <span className="text-xl">{fallback}</span>;
  };

  return (
    <div className="flex h-[calc(100vh-52px)] animate-fade-in">
      {/* Conversations list */}
      <div className="w-80 glass border-r border-white/5 flex flex-col">
        <div className="p-3 border-b border-white/5 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <MessageSquare size={16} />
              Мультичат
            </h3>
            <span className="text-[10px] text-white/30">{conversations.length} диалогов</span>
          </div>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
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
            <div className="text-center py-12 text-white/30 text-xs">
              {conversations.length === 0 ? 'Нет диалогов' : 'Ничего не найдено'}
            </div>
          ) : (
            filteredConversations.map(conv => (
              <button
                key={`${conv.accountId}_${conv.friendId}`}
                onClick={() => setSelectedConversation(conv)}
                className={`w-full flex items-center gap-3 px-4 py-3 transition-colors border-b border-white/5 text-left ${
                  selectedConversation?.friendId === conv.friendId && selectedConversation?.accountId === conv.accountId
                    ? 'bg-white/10'
                    : 'hover:bg-white/5'
                }`}
              >
                <div className="shrink-0">
                  {renderAvatar(conv.friendAvatarUrl, conv.friendAvatar || '👤')}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-white truncate font-medium">{conv.friendName}</span>
                    <span className="text-[10px] text-white/20 shrink-0 ml-2">{formatTime(conv.lastTimestamp)}</span>
                  </div>
                  <div className="text-[10px] text-white/30 truncate">{conv.lastMessage}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-indigo-400/50">через {conv.accountLogin}</span>
                    {(conv.inventoryValue ?? inventoryCache[conv.friendId]) > 0 && (
                      <span className="flex items-center gap-0.5 text-[10px] text-emerald-400/70">
                        <Package size={8} />
                        ${(conv.inventoryValue ?? inventoryCache[conv.friendId] ?? 0).toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>
                {conv.unread > 0 && (
                  <span className="shrink-0 w-5 h-5 rounded-full bg-indigo-500 text-white text-[10px] flex items-center justify-center">
                    {conv.unread > 9 ? '9+' : conv.unread}
                  </span>
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
            {/* Chat header */}
            <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="shrink-0">
                  {renderAvatar(selectedConversation.friendAvatarUrl, selectedConversation.friendAvatar || '👤', 'w-10 h-10')}
                </div>
                <div>
                  <div className="text-sm text-white font-medium">{selectedConversation.friendName}</div>
                  <div className="text-[10px] text-white/30">
                    через {selectedConversation.accountLogin} • {selectedConversation.friendId}
                    {(selectedConversation.inventoryValue ?? inventoryCache[selectedConversation.friendId]) > 0 && (
                      <span className="ml-2 text-emerald-400/70">
                        📦 ${(selectedConversation.inventoryValue ?? inventoryCache[selectedConversation.friendId] ?? 0).toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Translate controls */}
                <div className="flex items-center gap-1 bg-white/5 rounded-lg p-1">
                  <button
                    onClick={() => setTranslateIncoming(!translateIncoming)}
                    className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] transition-colors ${
                      translateIncoming ? 'bg-blue-500/30 text-blue-300' : 'text-white/30 hover:text-white/50'
                    }`}
                    title="Переводить входящие на русский"
                  >
                    EN→RU
                  </button>
                  <button
                    onClick={() => {
                      setTranslateOutgoing(!translateOutgoing);
                      if (!translateOutgoing) setTargetLang('en');
                    }}
                    className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] transition-colors ${
                      translateOutgoing ? 'bg-purple-500/30 text-purple-300' : 'text-white/30 hover:text-white/50'
                    }`}
                    title="Переводить исходящие"
                  >
                    RU→{targetLang.toUpperCase()}
                  </button>
                </div>

                <button
                  onClick={() => setShowTemplates(!showTemplates)}
                  className={`p-1.5 rounded-lg transition-colors ${showTemplates ? 'bg-white/10 text-white' : 'text-white/30 hover:text-white/50'}`}
                >
                  <BookMarked size={14} />
                </button>
              </div>
            </div>

            {/* Templates panel */}
            {showTemplates && (
              <div className="px-4 py-2 border-b border-white/5 space-y-2">
                <div className="flex flex-wrap gap-1">
                  {templates.map((t, i) => (
                    <button
                      key={i}
                      onClick={() => setInputText(t)}
                      className="px-2 py-1 rounded-lg bg-white/5 text-[10px] text-white/70 hover:bg-white/10 transition-colors"
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
                  <button onClick={addTemplate} className="p-2 rounded-lg bg-white/5 text-white/50 hover:text-white">
                    <Plus size={14} />
                  </button>
                </div>
              </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
              {conversationMessages.map(msg => (
                <div key={msg.id} className={`flex ${msg.isOutgoing ? 'justify-end' : 'justify-start'}`}>
                  {!msg.isOutgoing && (
                    <div className="shrink-0 mr-2 mt-1">
                      {renderAvatar(selectedConversation.friendAvatarUrl, selectedConversation.friendAvatar || '👤', 'w-6 h-6')}
                    </div>
                  )}
                  <div className={`max-w-[70%] px-3 py-2 rounded-2xl ${
                    msg.isOutgoing
                      ? 'bg-indigo-500/20 text-white rounded-br-sm'
                      : 'bg-white/5 text-white rounded-bl-sm'
                  }`}>
                    <div className="text-sm break-words">{msg.text}</div>
                    {/* Show translation for incoming messages */}
                    {!msg.isOutgoing && translateIncoming && translatedMessages[msg.id] && (
                      <div className="text-xs text-blue-300/60 mt-1 italic border-t border-white/10 pt-1">
                        🇷🇺 {translatedMessages[msg.id]}
                      </div>
                    )}
                    <div className="text-[10px] text-white/20 mt-1 text-right">
                      {formatTime(msg.timestamp)}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Status indicators */}
            {(translateOutgoing || translating) && (
              <div className="px-4 py-1 flex items-center gap-4 text-[10px]">
                {translateOutgoing && (
                  <span className="text-purple-400/70 flex items-center gap-1">
                    <Languages size={10} />
                    Авто-перевод RU → {targetLang.toUpperCase()}
                  </span>
                )}
                {translating && (
                  <span className="text-blue-400/70 flex items-center gap-1">
                    <Languages size={10} />
                    Переводим...
                  </span>
                )}
              </div>
            )}

            {/* Input */}
            <div className="px-4 py-3 border-t border-white/5 flex items-center gap-2">
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
                className="p-3 rounded-xl bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30 transition-colors"
              >
                <Send size={18} />
              </button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-white/20">
            <MessageSquare size={48} className="mb-4" />
            <div className="text-lg font-medium">Выберите диалог</div>
            <div className="text-sm mt-1">
              {conversations.length > 0
                ? 'Выберите диалог слева'
                : 'Диалоги появятся когда придут сообщения'}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
