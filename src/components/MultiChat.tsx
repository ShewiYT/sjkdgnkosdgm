import { useState, useEffect, useRef } from 'react';
import { MessageSquare, Send, Search, Languages, BookMarked, Plus } from 'lucide-react';
import { useAppStore } from '../store';
import type { SteamAccount } from '../types';

interface MultiChatProps {
  accounts: SteamAccount[];
}

interface Conversation {
  friendId: string;
  friendName: string;
  friendAvatar: string;
  accountId: string;
  accountLogin: string;
  lastMessage: string;
  lastTimestamp: string;
  unread: number;
}

export default function MultiChat(_props: MultiChatProps) {
  const { messages, sendMessage, startPolling, stopPolling } = useAppStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [inputText, setInputText] = useState('');
  const [translateOutgoing, setTranslateOutgoing] = useState(false);
  const [templates, setTemplates] = useState(['Привет!', 'Кинь оффер', 'Цена?', 'Добавь в друзья']);
  const [showTemplates, setShowTemplates] = useState(false);
  const [newTemplate, setNewTemplate] = useState('');
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
        accountId: msg.accountId,
        accountLogin: msg.accountLogin,
        lastMessage: msg.text,
        lastTimestamp: msg.timestamp,
        unread: msg.isOutgoing ? 0 : 1,
      });
    } else {
      const conv = convMap.get(key)!;
      if (msg.timestamp > conv.lastTimestamp) {
        conv.lastMessage = msg.text;
        conv.lastTimestamp = msg.timestamp;
      }
      if (!msg.isOutgoing) conv.unread++;
    }
  });

  convMap.forEach(c => conversations.push(c));
  conversations.sort((a, b) => b.lastTimestamp.localeCompare(a.lastTimestamp));

  const filteredConversations = searchQuery
    ? conversations.filter(c => 
        c.friendName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.accountLogin.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : conversations;

  // Messages for selected conversation
  const conversationMessages = selectedConversation
    ? messages.filter(m => 
        m.accountId === selectedConversation.accountId && 
        m.friendId === selectedConversation.friendId
      )
    : [];

  const handleSendMessage = async () => {
    if (!inputText.trim() || !selectedConversation) return;
    await sendMessage(
      selectedConversation.accountId,
      selectedConversation.friendId,
      selectedConversation.friendName,
      inputText
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
                <span className="text-xl">{conv.friendAvatar}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-white truncate">{conv.friendName}</span>
                    <span className="text-[10px] text-white/30">{formatTime(conv.lastTimestamp)}</span>
                  </div>
                  <div className="text-[10px] text-white/40 truncate">{conv.lastMessage}</div>
                  <div className="text-[10px] text-blue-400/60">через {conv.accountLogin}</div>
                </div>
                {conv.unread > 0 && (
                  <span className="w-5 h-5 rounded-full bg-blue-500 text-[10px] text-white flex items-center justify-center">
                    {conv.unread}
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
            <div className="glass border-b border-white/5 px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{selectedConversation.friendAvatar}</span>
                <div>
                  <div className="text-sm font-medium text-white">{selectedConversation.friendName}</div>
                  <div className="text-[10px] text-white/40">
                    через {selectedConversation.accountLogin} • {selectedConversation.friendId}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setTranslateOutgoing(!translateOutgoing)}
                  className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] ${
                    translateOutgoing ? 'glass-accent text-white' : 'glass-button text-white/50'
                  }`}
                >
                  <Languages size={12} />
                  RU→EN
                </button>
                <button
                  onClick={() => setShowTemplates(!showTemplates)}
                  className="p-1.5 rounded-lg glass-button text-white/50"
                >
                  <BookMarked size={14} />
                </button>
              </div>
            </div>

            {/* Templates panel */}
            {showTemplates && (
              <div className="glass border-b border-white/5 p-3">
                <div className="flex flex-wrap gap-1 mb-2">
                  {templates.map(t => (
                    <button
                      key={t}
                      onClick={() => setInputText(t)}
                      className="px-2 py-1 rounded-lg text-[10px] glass-button text-white/60 hover:text-white"
                    >
                      {t}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    value={newTemplate}
                    onChange={e => setNewTemplate(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addTemplate()}
                    placeholder="Новый шаблон..."
                    className="flex-1 glass-input text-xs text-white px-3 py-2 rounded-lg outline-none"
                  />
                  <button onClick={addTemplate} className="px-2 py-1 rounded-lg glass-accent text-white text-xs">
                    <Plus size={12} />
                  </button>
                </div>
              </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {conversationMessages.map(msg => (
                <div
                  key={msg.id}
                  className={`flex ${msg.isOutgoing ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[70%] px-4 py-2 rounded-2xl ${
                    msg.isOutgoing
                      ? 'glass-accent text-white rounded-br-md'
                      : 'glass-card text-white rounded-bl-md'
                  }`}>
                    <div className="text-sm">{msg.text}</div>
                    <div className="text-[10px] text-white/40 mt-1 text-right">
                      {formatTime(msg.timestamp)}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Translate indicator */}
            {translateOutgoing && (
              <div className="px-4 py-1 text-[10px] text-blue-400/60 flex items-center gap-1">
                <Languages size={10} />
                Ваши сообщения автоматически переводятся на английский перед отправкой
              </div>
            )}

            {/* Input */}
            <div className="glass border-t border-white/5 p-3">
              <div className="flex items-center gap-3">
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
                  className="p-3 rounded-xl glass-accent text-white disabled:opacity-40"
                >
                  <Send size={16} />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessageSquare size={48} className="mx-auto mb-4 text-white/10" />
              <div className="text-sm text-white/40">Выберите диалог</div>
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
