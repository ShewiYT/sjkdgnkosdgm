import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { 
  Search, Send, MessageSquare, Users, Volume2, VolumeX, 
  Plus, X, BookOpen, Languages, ChevronLeft, ArrowRight
} from 'lucide-react';
import { useAppStore } from '../store';

const defaultTemplates = [
  { id: '1', text: 'Привет! Чем могу помочь?' },
  { id: '2', text: 'Спасибо за сообщение!' },
  { id: '3', text: 'Подождите, проверяю...' },
  { id: '4', text: 'Готово!' },
  { id: '5', text: 'К сожалению, не могу помочь с этим.' },
];

interface Conversation {
  id: string;
  accountId: string;
  accountLogin: string;
  accountAvatar: string;
  friendId: string;
  friendName: string;
  lastMessage: string;
  lastTime: string;
}

export default function MultiChat() {
  const { accounts, messages, sendMessage, startPolling, stopPolling } = useAppStore();
  const [inputText, setInputText] = useState('');
  const [searchText, setSearchText] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showTemplates, setShowTemplates] = useState(false);
  const [templates, setTemplates] = useState(defaultTemplates);
  const [newTemplate, setNewTemplate] = useState('');
  const [translateOutgoing, setTranslateOutgoing] = useState(false);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  
  // Hover translation
  const [hoveredMsgId, setHoveredMsgId] = useState<string | null>(null);
  const [translationCache, setTranslationCache] = useState<Record<string, string>>({});
  const [translating, setTranslating] = useState<string | null>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    startPolling();
    return () => stopPolling();
  }, [startPolling, stopPolling]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, selectedConversation]);

  // Translate on hover
  const handleMouseEnter = useCallback(async (msgId: string, text: string) => {
    setHoveredMsgId(msgId);
    
    // Already cached
    if (translationCache[msgId]) return;
    
    // Already translating this one
    if (translating === msgId) return;
    
    // Skip very short messages
    if (text.length < 3) return;
    
    setTranslating(msgId);
    
    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, to: 'ru' }),
      });
      const data = await res.json();
      if (data.translated) {
        setTranslationCache(prev => ({ ...prev, [msgId]: data.translated }));
      }
    } catch {
      setTranslationCache(prev => ({ ...prev, [msgId]: '⚠ Ошибка перевода' }));
    } finally {
      setTranslating(null);
    }
  }, [translationCache, translating]);

  const handleMouseLeave = useCallback(() => {
    setHoveredMsgId(null);
  }, []);

  // Group messages into conversations
  const conversations = useMemo(() => {
    const convMap = new Map<string, Conversation>();
    
    for (const msg of messages) {
      const convId = `${msg.accountId}_${msg.friendId}`;
      const acc = accounts.find(a => a.id === msg.accountId);
      
      const existing = convMap.get(convId);
      if (!existing || new Date(msg.timestamp) > new Date(existing.lastTime)) {
        convMap.set(convId, {
          id: convId,
          accountId: msg.accountId,
          accountLogin: msg.accountLogin,
          accountAvatar: acc?.avatar || '👤',
          friendId: msg.friendId,
          friendName: msg.friendName,
          lastMessage: msg.text.slice(0, 50) + (msg.text.length > 50 ? '...' : ''),
          lastTime: msg.timestamp,
        });
      }
    }
    
    return Array.from(convMap.values()).sort(
      (a, b) => new Date(b.lastTime).getTime() - new Date(a.lastTime).getTime()
    );
  }, [messages, accounts]);

  const filteredConversations = conversations.filter(c =>
    !searchText ||
    c.friendName.toLowerCase().includes(searchText.toLowerCase()) ||
    c.accountLogin.toLowerCase().includes(searchText.toLowerCase())
  );

  const conversationMessages = useMemo(() => {
    if (!selectedConversation) return [];
    return messages.filter(
      m => m.accountId === selectedConversation.accountId && m.friendId === selectedConversation.friendId
    );
  }, [messages, selectedConversation]);

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const time = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
    if (isToday) return time;
    return `${d.getDate()}.${(d.getMonth()+1).toString().padStart(2, '0')} ${time}`;
  };

  const handleSendMessage = async () => {
    if (!inputText.trim() || !selectedConversation) return;
    
    let textToSend = inputText;
    
    if (translateOutgoing) {
      try {
        const res = await fetch('/api/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: inputText, to: 'en' }),
        });
        const data = await res.json();
        if (data.translated) {
          textToSend = data.translated;
        }
      } catch {
        // Send original on error
      }
    }
    
    await sendMessage(
      selectedConversation.accountId,
      selectedConversation.friendId,
      selectedConversation.friendName,
      textToSend
    );
    setInputText('');
  };

  const handleTemplateClick = (text: string) => {
    setInputText(text);
    setShowTemplates(false);
  };

  const addTemplate = () => {
    if (!newTemplate.trim()) return;
    setTemplates(prev => [...prev, { id: Date.now().toString(), text: newTemplate }]);
    setNewTemplate('');
  };

  const removeTemplate = (id: string) => {
    setTemplates(prev => prev.filter(t => t.id !== id));
  };

  return (
    <div className="flex h-[calc(100vh-52px)] animate-fade-in">
      {/* Conversations list */}
      <div className="w-80 glass-dark border-r border-white/5 flex flex-col shrink-0">
        <div className="p-4 border-b border-white/5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-xl glass-accent flex items-center justify-center">
              <MessageSquare size={18} />
            </div>
            <div>
              <div className="text-sm font-medium text-white">Мультичат</div>
              <div className="text-[10px] text-white/40">{conversations.length} диалогов</div>
            </div>
          </div>
          
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
            <input
              type="text"
              placeholder="Поиск диалога..."
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              className="w-full glass-input text-xs text-white pl-9 pr-3 py-2 rounded-xl outline-none"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filteredConversations.length === 0 ? (
            <div className="p-6 text-center">
              <MessageSquare size={32} className="mx-auto mb-2 text-white/10" />
              <div className="text-xs text-white/30">Нет диалогов</div>
            </div>
          ) : (
            filteredConversations.map(conv => {
              const isSelected = selectedConversation?.id === conv.id;
              return (
                <button
                  key={conv.id}
                  onClick={() => setSelectedConversation(conv)}
                  className={`w-full p-3 flex gap-3 text-left transition-all border-b border-white/5 ${
                    isSelected ? 'bg-white/10' : 'hover:bg-white/5'
                  }`}
                >
                  <div className="relative">
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500/30 to-purple-500/30 flex items-center justify-center text-lg">
                      👤
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-md glass flex items-center justify-center text-[10px]">
                      {conv.accountAvatar}
                    </div>
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-sm text-white font-medium truncate">{conv.friendName}</span>
                      <span className="text-[10px] text-white/30 shrink-0 ml-2">{formatTime(conv.lastTime)}</span>
                    </div>
                    <div className="text-[10px] text-blue-400 mb-0.5">через {conv.accountLogin}</div>
                    <div className="text-xs text-white/40 truncate">{conv.lastMessage}</div>
                  </div>
                </button>
              );
            })
          )}
        </div>

        <div className="border-t border-white/5 p-3">
          <div className="text-[10px] text-white/30 mb-2">АККАУНТЫ</div>
          <div className="flex flex-wrap gap-1">
            {accounts.map(acc => (
              <div key={acc.id} className="flex items-center gap-1 px-2 py-1 rounded-lg glass-light text-[10px]" title={acc.login}>
                <div className={`w-1.5 h-1.5 rounded-full ${
                  acc.status === 'online' ? 'bg-green-400' :
                  acc.status === 'in-game' ? 'bg-purple-400' :
                  'bg-white/20'
                }`} />
                <span className="text-white/60">{acc.avatar}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col">
        {selectedConversation ? (
          <>
            {/* Chat header */}
            <div className="glass px-5 py-3 flex items-center gap-3 border-b border-white/5">
              <button 
                onClick={() => setSelectedConversation(null)}
                className="lg:hidden p-2 -ml-2 rounded-lg glass-button text-white/50"
              >
                <ChevronLeft size={18} />
              </button>
              
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/30 to-purple-500/30 flex items-center justify-center text-xl">
                👤
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium text-white">{selectedConversation.friendName}</div>
                <div className="text-[10px] text-white/40 flex items-center gap-1">
                  через <span className="text-blue-400">{selectedConversation.accountLogin}</span>
                  <span className="mx-1">•</span>
                  <span>{selectedConversation.friendId}</span>
                </div>
              </div>

              <div className="flex items-center gap-1">
                {/* Translate outgoing to English */}
                <button
                  onClick={() => setTranslateOutgoing(!translateOutgoing)}
                  className={`p-2 rounded-xl glass-button text-xs flex items-center gap-1 ${
                    translateOutgoing ? 'text-blue-400 ring-1 ring-blue-500/30' : 'text-white/40'
                  }`}
                  title="Переводить мои сообщения на английский"
                >
                  <ArrowRight size={14} />
                  <span className="hidden sm:inline">→EN</span>
                </button>

                <div className="w-px h-5 bg-white/10 mx-1" />

                <button
                  onClick={() => setSoundEnabled(!soundEnabled)}
                  className={`p-2 rounded-xl glass-button ${soundEnabled ? 'text-blue-400' : 'text-white/40'}`}
                >
                  {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
                </button>

                <button 
                  onClick={() => setShowTemplates(!showTemplates)}
                  className={`p-2 rounded-xl glass-button ${showTemplates ? 'text-purple-400' : 'text-white/40'}`}
                >
                  <BookOpen size={16} />
                </button>
              </div>
            </div>

            {/* Hover-to-translate hint */}
            <div className="px-4 py-1.5 glass text-[10px] text-white/30 flex items-center gap-1 border-b border-white/5">
              <Languages size={10} />
              Наведите на сообщение собеседника — появится перевод на русский
            </div>

            {/* Templates panel */}
            {showTemplates && (
              <div className="glass border-b border-white/5 p-4 animate-fade-in">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-medium text-white/70">📝 Шаблоны</h3>
                  <button onClick={() => setShowTemplates(false)} className="text-white/40 hover:text-white">
                    <X size={14} />
                  </button>
                </div>
                <div className="flex flex-wrap gap-2 mb-3">
                  {templates.map(t => (
                    <div key={t.id} className="group flex items-center gap-1">
                      <button
                        onClick={() => handleTemplateClick(t.text)}
                        className="px-3 py-1.5 rounded-lg glass-button text-xs text-white/70 hover:text-white"
                      >
                        {t.text}
                      </button>
                      <button
                        onClick={() => removeTemplate(t.id)}
                        className="opacity-0 group-hover:opacity-100 text-red-400 transition-opacity"
                      >
                        <X size={12} />
                      </button>
                    </div>
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
                  <button
                    onClick={addTemplate}
                    disabled={!newTemplate.trim()}
                    className="px-3 py-2 rounded-lg glass-accent text-white text-xs disabled:opacity-40"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {conversationMessages.map(msg => {
                const isHovered = hoveredMsgId === msg.id;
                const cached = translationCache[msg.id];
                const isTranslating = translating === msg.id;
                
                return (
                  <div
                    key={msg.id}
                    className={`flex ${msg.isOutgoing ? 'justify-end' : 'justify-start'} animate-fade-in`}
                  >
                    <div
                      className="max-w-[75%] relative"
                      onMouseEnter={() => {
                        if (!msg.isOutgoing) handleMouseEnter(msg.id, msg.text);
                      }}
                      onMouseLeave={handleMouseLeave}
                    >
                      <div className={`rounded-2xl px-4 py-2.5 transition-all ${
                        msg.isOutgoing 
                          ? 'bg-blue-500/20 rounded-br-sm' 
                          : 'glass-card rounded-bl-sm'
                      } ${!msg.isOutgoing && isHovered ? 'ring-1 ring-green-500/30' : ''}`}>
                        
                        {/* Original text */}
                        <div className="text-sm text-white break-words">{msg.text}</div>
                        
                        {/* Translation tooltip on hover (incoming only) */}
                        {!msg.isOutgoing && isHovered && (
                          <div className="mt-2 pt-2 border-t border-white/10 animate-fade-in">
                            {isTranslating ? (
                              <div className="text-xs text-white/40 flex items-center gap-1">
                                <Languages size={10} className="animate-spin" />
                                Переводим...
                              </div>
                            ) : cached ? (
                              <>
                                <div className="text-[10px] text-green-400/70 mb-0.5 flex items-center gap-1">
                                  <Languages size={10} /> Перевод на русский:
                                </div>
                                <div className="text-sm text-green-300/90">{cached}</div>
                              </>
                            ) : null}
                          </div>
                        )}
                      </div>
                      
                      <div className={`text-[10px] text-white/30 mt-1 ${msg.isOutgoing ? 'text-right' : ''}`}>
                        {formatTime(msg.timestamp)}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={chatEndRef} />
            </div>

            {/* Translate outgoing indicator */}
            {translateOutgoing && (
              <div className="px-4 py-1.5 glass border-t border-white/5 text-[10px] text-blue-400 flex items-center gap-1">
                <Languages size={10} />
                Ваши сообщения автоматически переводятся на английский перед отправкой
              </div>
            )}

            {/* Input */}
            <div className="p-4 glass border-t border-white/5">
              <div className="flex gap-3">
                <button
                  onClick={() => setShowTemplates(!showTemplates)}
                  className="px-3 py-3 rounded-xl glass-button text-white/50 hover:text-white shrink-0"
                >
                  <BookOpen size={18} />
                </button>
                <input
                  type="text"
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
                  placeholder={translateOutgoing ? "Пишите на русском → отправится на English" : "Введите сообщение..."}
                  className="flex-1 glass-input text-sm text-white px-4 py-3 rounded-xl outline-none"
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!inputText.trim()}
                  className="px-5 py-3 rounded-xl glass-accent text-white disabled:opacity-40 transition-all hover:scale-105 shrink-0"
                >
                  <Send size={18} />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center glass-card rounded-3xl p-10">
              <Users size={48} className="mx-auto mb-4 text-white/10" />
              <div className="text-lg text-white/50 mb-2">Выберите диалог</div>
              <div className="text-xs text-white/30">
                {conversations.length > 0 
                  ? 'Выберите диалог слева'
                  : 'Диалоги появятся когда придут сообщения'
                }
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
