import { useState, useEffect, useRef, useCallback } from 'react';
import { MessageCircle, Send, Search, DollarSign, Users as UsersIcon, Languages, FileText, Plus, X, Trash2 } from 'lucide-react';
import type { SteamAccount } from '../types';
import type { FriendData } from '../api';
import { steamApi } from '../api';

// Translation helper
async function translateText(text: string, to: string): Promise<string | null> {
  try {
    const res = await fetch('/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, to }),
    });
    const data = await res.json();
    return data.success ? data.translated : null;
  } catch {
    return null;
  }
}

import { useAppStore } from '../store';

// Steam icon SVG component
function SteamIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M11.979 0C5.678 0 .511 4.86.022 10.94l6.432 2.658a3.387 3.387 0 0 1 1.912-.59c.064 0 .128.002.191.006l2.861-4.142V8.77a4.543 4.543 0 0 1 4.54-4.542 4.545 4.545 0 0 1 4.543 4.542 4.545 4.545 0 0 1-4.543 4.541h-.104l-4.074 2.91c0 .05.003.1.003.152 0 1.874-1.52 3.395-3.395 3.395a3.403 3.403 0 0 1-3.37-2.942L.094 14.967C1.186 20.134 5.99 24 11.979 24 18.627 24 24 18.627 24 11.979S18.627 0 11.979 0zM7.54 18.21l-1.473-.61a2.55 2.55 0 0 0 1.413 1.379c1.322.548 2.839-.07 3.385-1.39a2.548 2.548 0 0 0 .015-1.949 2.546 2.546 0 0 0-1.383-1.38c-.53-.22-1.097-.252-1.62-.12l1.523.63a1.88 1.88 0 0 1-1.427 3.476l-.433-.036zM19.38 8.77a3.028 3.028 0 0 0-3.025-3.025 3.028 3.028 0 0 0-3.025 3.025 3.028 3.028 0 0 0 3.025 3.024 3.028 3.028 0 0 0 3.025-3.024zm-5.293.005a2.274 2.274 0 0 1 2.27-2.27 2.274 2.274 0 0 1 2.27 2.27 2.274 2.274 0 0 1-2.27 2.27 2.274 2.274 0 0 1-2.27-2.27z"/>
    </svg>
  );
}

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
  personaState?: number;
}

export default function MultiChat({ accounts, selectedAccount }: MultiChatProps) {
  const { messages, sendMessage, fetchNewMessages, unreadConversations, markConversationRead } = useAppStore();
  const [friendsByAccount, setFriendsByAccount] = useState<Record<string, FriendData[]>>({});
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [translatingId, setTranslatingId] = useState<string | null>(null);
  const [autoTranslate, setAutoTranslate] = useState(false);
  const [translateLang, setTranslateLang] = useState<'ru' | 'en'>('ru');
  const [showTemplates, setShowTemplates] = useState(false);

  // FIX #1: Templates loaded from server, not localStorage
  const [messageTemplates, setMessageTemplates] = useState<string[]>([]);
  const [templatesLoaded, setTemplatesLoaded] = useState(false);
  const [newTemplateDraft, setNewTemplateDraft] = useState('');
  const [showAddTemplate, setShowAddTemplate] = useState(false);

  // Load templates from server on mount
  useEffect(() => {
    steamApi.getTemplates().then(templates => {
      if (templates.length > 0) {
        setMessageTemplates(templates);
      } else {
        // Default templates if none on server
        setMessageTemplates([
          'Привет! Как дела?',
          'Готов к обмену?',
          'Скинь трейд ссылку',
          'Сколько хочешь за это?',
          'Давай обмениваемся',
          'Спасибо за трейд!',
          'Hi! Ready to trade?',
          'Send me your trade link',
        ]);
      }
      setTemplatesLoaded(true);
    });
  }, []);

  // FIX #1: Save templates to server when they change (after initial load)
  useEffect(() => {
    if (!templatesLoaded) return;
    steamApi.saveTemplates(messageTemplates);
  }, [messageTemplates, templatesLoaded]);

  const addTemplate = () => {
    if (!newTemplateDraft.trim()) return;
    setMessageTemplates(prev => [...prev, newTemplateDraft.trim()]);
    setNewTemplateDraft('');
    setShowAddTemplate(false);
  };

  const removeTemplate = (index: number) => {
    setMessageTemplates(prev => prev.filter((_, i) => i !== index));
  };

  const useTemplate = (text: string) => {
    setInputText(text);
    setShowTemplates(false);
  };

  const [inventoryValues, setInventoryValues] = useState<Record<string, {
    value: number;
    loading: boolean;
    error?: string;
    itemCount?: number;
    pricedItems?: number;
    unpricedItems?: number;
    pricingComplete?: boolean;
    source?: string;
    items?: { name: string; price: number | null }[];
  }>>({});
  const [showInventoryDetails, setShowInventoryDetails] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const onlineAccounts = accounts.filter(a => a.status === 'online' || a.status === 'in-game');

  const targetAccounts = selectedAccount
    ? [selectedAccount].filter(a => a.status === 'online' || a.status === 'in-game')
    : onlineAccounts;

  const loadAllFriends = useCallback(async () => {
    if (targetAccounts.length === 0) return;
    setLoading(true);
    const results: Record<string, FriendData[]> = {};
    await Promise.all(
      targetAccounts.map(async (acc) => {
        try {
          const friends = await steamApi.getFriends(acc.id);
          results[acc.id] = friends;
        } catch {
          results[acc.id] = [];
        }
      })
    );
    setFriendsByAccount(prev => ({ ...prev, ...results }));
    setLoading(false);
  }, [targetAccounts.map(a => a.id).join(',')]);

  useEffect(() => {
    loadAllFriends();
    const interval = setInterval(() => { fetchNewMessages(); }, 5000);
    return () => clearInterval(interval);
  }, [loadAllFriends, fetchNewMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, selectedConversation]);

  const fetchInventoryValue = async (steamId: string) => {
    if (inventoryValues[steamId]?.loading) return;
    setInventoryValues(prev => ({ ...prev, [steamId]: { value: 0, loading: true } }));
    try {
      const result = await steamApi.getInventoryValue(steamId);
      const items = (result.items || []).map((item: unknown) => {
        const i = item as Record<string, unknown>;
        return { name: (i.name || '') as string, price: (i.price as number | null) ?? null };
      });
      setInventoryValues(prev => ({
        ...prev,
        [steamId]: {
          value: result.totalValue,
          loading: false,
          error: result.error,
          itemCount: result.itemCount,
          pricedItems: result.pricedItems,
          unpricedItems: result.unpricedItems,
          pricingComplete: result.pricingComplete,
          source: result.source,
          items,
        },
      }));
    } catch {
      setInventoryValues(prev => ({ ...prev, [steamId]: { value: 0, loading: false, error: 'Ошибка загрузки' } }));
    }
  };

  const showingAll = !selectedAccount;

  // Build conversations list from friends
  const conversations: Conversation[] = [];
  for (const acc of targetAccounts) {
    const friends = friendsByAccount[acc.id] || [];
    for (const friend of friends) {
      const lastMsg = messages
        .filter(m => m.accountId === acc.id && m.friendId === friend.steamId)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];

      conversations.push({
        friendId: friend.steamId,
        friendName: friend.name || friend.steamId,
        friendAvatar: friend.avatar || '👤',
        friendAvatarUrl: friend.avatarUrl,
        accountId: acc.id,
        accountLogin: acc.login,
        lastMessage: lastMsg?.text || '',
        timestamp: lastMsg?.timestamp || '',
        inventoryValue: friend.inventoryValue,
        personaState: friend.personaState,
      });
    }
  }

  // Sort: conversations with messages first, then alphabetically
  conversations.sort((a, b) => {
    if (a.timestamp && !b.timestamp) return -1;
    if (!a.timestamp && b.timestamp) return 1;
    if (a.timestamp && b.timestamp) return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    return a.friendName.localeCompare(b.friendName);
  });

  const filteredConversations = conversations.filter(conv => {
    const q = search.toLowerCase();
    if (!q) return true;
    return conv.friendName.toLowerCase().includes(q) ||
      conv.friendId.includes(q) ||
      conv.accountLogin.toLowerCase().includes(q);
  });

  const conversationMessages = selectedConversation
    ? messages.filter(
        m => m.accountId === selectedConversation.accountId &&
             m.friendId === selectedConversation.friendId
      )
    : [];

  const handleSendMessage = async () => {
    if (!inputText.trim() || !selectedConversation) return;
    let textToSend = inputText.trim();

    if (autoTranslate) {
      const translated = await translateText(textToSend, translateLang);
      if (translated) textToSend = translated;
    }

    setInputText('');
    await sendMessage(
      selectedConversation.accountId,
      selectedConversation.friendId,
      selectedConversation.friendName,
      textToSend
    );
  };

  const selectedInventory = selectedConversation ? inventoryValues[selectedConversation.friendId] : null;

  const handleSelectConversation = (conv: Conversation) => {
    setSelectedConversation(conv);
    setShowInventoryDetails(false);

    // FIX #3: Mark conversation as read when selected
    markConversationRead(conv.accountId, conv.friendId);

    // Auto-fetch inventory
    if (!inventoryValues[conv.friendId]) {
      fetchInventoryValue(conv.friendId);
    }
  };

  const isFriendOnline = (personaState?: number) => {
    return personaState !== undefined && personaState > 0;
  };

  const formatTime = (ts: string) => {
    if (!ts) return '';
    return new Date(ts).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex h-[calc(100vh-52px)] animate-fade-in">
      {/* Sidebar - friends list */}
      <div className="w-80 border-r border-white/5 flex flex-col shrink-0 bg-dark-900/30">
        <div className="p-3 space-y-2 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-white">
              <MessageCircle size={16} className="text-indigo-400" />
              <span className="text-sm font-semibold">Мультичат</span>
            </div>
            <span className="text-[10px] text-white/30">
              {showingAll ? `${targetAccounts.length} акк.` : targetAccounts[0]?.login}
            </span>
          </div>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Поиск друзей / аккаунтов..."
              className="w-full glass-input text-xs text-white pl-9 pr-3 py-2 rounded-xl outline-none" />
          </div>
        </div>

        <div className="px-3 pb-1 flex items-center gap-2 text-[10px] text-white/30 shrink-0">
          <span>{filteredConversations.length} друзей</span>
          {showingAll && <span className="text-indigo-400/50">все аккаунты</span>}
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8 text-white/30 text-xs gap-2">
              <div className="animate-spin w-4 h-4 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full" />
              Загрузка друзей{showingAll ? ` (${targetAccounts.length} акк.)` : ''}...
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-white/20">
              <UsersIcon size={32} className="mb-2 opacity-30" />
              <span className="text-xs">
                {targetAccounts.length === 0 ? 'Нет онлайн аккаунтов' : 'Нет друзей'}
              </span>
            </div>
          ) : (
            filteredConversations.map(conv => {
              const isSelected =
                selectedConversation?.friendId === conv.friendId &&
                selectedConversation?.accountId === conv.accountId;
              const online = isFriendOnline(conv.personaState);

              // FIX #3: Check if conversation has unread messages
              const unreadKey = `${conv.accountId}:${conv.friendId}`;
              const hasUnread = !!unreadConversations[unreadKey];

              return (
                <button
                  key={`${conv.accountId}-${conv.friendId}`}
                  onClick={() => handleSelectConversation(conv)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                    isSelected ? 'bg-indigo-500/10' : 'hover:bg-white/5'
                  }`}
                >
                  {/* Avatar with online status and unread indicator */}
                  <div className="relative shrink-0">
                    {conv.friendAvatarUrl ? (
                      <img src={conv.friendAvatarUrl} alt="" className="w-9 h-9 rounded-full" />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-sm">
                        {conv.friendAvatar}
                      </div>
                    )}
                    <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-dark-900 ${
                      online ? 'bg-green-400' : 'bg-gray-500'
                    }`} />
                    {/* FIX #3: Yellow unread indicator */}
                    {hasUnread && (
                      <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-yellow-400 border-2 border-dark-900 animate-pulse" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className={`text-xs truncate ${hasUnread ? 'text-white font-semibold' : 'text-white/80'}`}>
                        {conv.friendName}
                      </span>
                      {conv.timestamp && (
                        <span className="text-[9px] text-white/20 shrink-0 ml-1">
                          {formatTime(conv.timestamp)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <span className={`text-[10px] truncate ${hasUnread ? 'text-white/60 font-medium' : 'text-white/30'}`}>
                        {conv.lastMessage || (showingAll ? conv.accountLogin : 'Нет сообщений')}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {selectedConversation ? (
          <>
            {/* Chat header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5 shrink-0">
              {/* Header avatar with status */}
              <div className="relative shrink-0">
                {selectedConversation.friendAvatarUrl ? (
                  <img src={selectedConversation.friendAvatarUrl} alt="" className="w-10 h-10 rounded-full" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-lg">👤</div>
                )}
                <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-dark-900 ${
                  isFriendOnline(selectedConversation.personaState) ? 'bg-green-400' : 'bg-gray-500'
                }`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-white">{selectedConversation.friendName}</span>
                  {/* FIX #4: Steam profile button */}
                  <button
                    onClick={() => window.open(`https://steamcommunity.com/profiles/${selectedConversation.friendId}`, '_blank')}
                    className="p-1 rounded-md text-white/30 hover:text-blue-400 hover:bg-blue-500/10 transition-colors"
                    title="Открыть профиль Steam"
                  >
                    <SteamIcon size={14} />
                  </button>
                </div>
                <div className="text-[10px] text-white/30 flex items-center gap-2">
                  <span>через {selectedConversation.accountLogin} • {selectedConversation.friendId}</span>
                  {isFriendOnline(selectedConversation.personaState)
                    ? <span className="text-green-400">● В сети</span>
                    : <span className="text-gray-500">● Не в сети</span>
                  }
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {selectedInventory ? (
                  selectedInventory.loading ? (
                    <div className="flex items-center gap-1.5 text-[10px] text-white/40">
                      <div className="animate-spin w-3 h-3 border border-indigo-500/30 border-t-indigo-500 rounded-full" />
                      Оценка инвентаря...
                    </div>
                  ) : selectedInventory.error ? (
                    <div className="text-[10px] text-red-400/60">
                      ❌ {selectedInventory.error}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setShowInventoryDetails(!showInventoryDetails)}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg bg-green-500/10 text-green-400 text-xs hover:bg-green-500/20 transition-colors"
                      >
                        <DollarSign size={12} />
                        {selectedInventory.value.toFixed(2)}
                      </button>
                      <span className="text-[10px] text-white/30">
                        {selectedInventory.itemCount} шт
                      </span>
                      {selectedInventory.pricedItems !== undefined && selectedInventory.unpricedItems !== undefined && (
                        <span className="text-[10px] text-white/20">
                          ({selectedInventory.pricedItems}✓ {selectedInventory.unpricedItems}✗)
                        </span>
                      )}
                      {selectedInventory.source && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/5 text-white/30">
                          {selectedInventory.source || 'Loot.Farm'}
                        </span>
                      )}
                      {!selectedInventory.pricingComplete && (
                        <div className="animate-spin w-3 h-3 border border-yellow-500/30 border-t-yellow-500 rounded-full" />
                      )}
                    </div>
                  )
                ) : null}
                <button
                  onClick={() => fetchInventoryValue(selectedConversation.friendId)}
                  className="p-1.5 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/5"
                  title="Обновить инвентарь"
                >
                  <DollarSign size={14} />
                </button>
              </div>
            </div>

            {/* Inventory details panel */}
            {showInventoryDetails && selectedInventory && !selectedInventory.loading && !selectedInventory.error && selectedInventory.items && selectedInventory.items.length > 0 && (
              <div className="border-b border-white/5 bg-dark-900/50 max-h-48 overflow-y-auto">
                <div className="px-4 py-2 flex items-center justify-between sticky top-0 bg-dark-900/80 backdrop-blur-sm">
                  <span className="text-[10px] text-white/40">
                    📦 Инвентарь ({selectedInventory.items.length} предметов)
                  </span>
                  <button onClick={() => setShowInventoryDetails(false)} className="text-white/30 hover:text-white/60">
                    <X size={12} />
                  </button>
                </div>
                <div className="divide-y divide-white/5">
                  {selectedInventory.items
                    .filter(item => item.name)
                    .map((item, i) => (
                    <div key={i} className="px-4 py-1.5 flex items-center justify-between">
                      <span className="text-[11px] text-white/60 truncate flex-1">{item.name}</span>
                      {item.price !== null && item.price > 0 ? (
                        <span className="text-[11px] text-green-400/80 shrink-0 ml-2">${item.price.toFixed(2)}</span>
                      ) : (
                        <span className="text-[11px] text-white/20 shrink-0 ml-2">—</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {conversationMessages.length === 0 ? (
                <div className="text-center text-white/20 text-xs py-8">Нет сообщений. Начните диалог!</div>
              ) : (
                conversationMessages.map(msg => {
                  const tr = translations[msg.id];
                  const isTranslating = translatingId === msg.id;

                  const handleTranslate = async () => {
                    setTranslatingId(msg.id);
                    const targetLang = /[а-яА-ЯёЁ]/.test(msg.text) ? 'en' : 'ru';
                    const result = await translateText(msg.text, targetLang);
                    if (result) {
                      setTranslations(prev => ({ ...prev, [msg.id]: result }));
                    }
                    setTranslatingId(null);
                  };

                  return (
                    <div key={msg.id} className={`flex gap-2 ${msg.isOutgoing ? 'justify-end' : 'justify-start'}`}>
                      {!msg.isOutgoing && <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-xs shrink-0">👤</div>}
                      <div className={`max-w-[70%] ${msg.isOutgoing ? 'bg-indigo-500/20 rounded-2xl rounded-br-sm' : 'bg-white/5 rounded-2xl rounded-bl-sm'} px-3 py-2`}>
                        <div className="text-sm text-white break-words">{msg.text}</div>
                        {tr && (
                          <div className="text-xs text-indigo-300/60 mt-1 border-t border-white/5 pt-1">
                            🌐 {tr}
                          </div>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[9px] text-white/20">{formatTime(msg.timestamp)}</span>
                          {!msg.isOutgoing && (
                            <button
                              onClick={handleTranslate}
                              disabled={isTranslating}
                              className="text-[9px] text-white/20 hover:text-indigo-400 disabled:opacity-50"
                            >
                              {isTranslating ? '...' : '🌐'}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Templates popup */}
            {showTemplates && (
              <div className="border-t border-white/5 bg-dark-900/80 p-3 max-h-48 overflow-y-auto">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <FileText size={12} className="text-white/40" />
                    <span className="text-xs text-white/60">Шаблоны сообщений</span>
                  </div>
                  <button onClick={() => setShowAddTemplate(!showAddTemplate)} className="text-white/30 hover:text-white/60">
                    <Plus size={14} />
                  </button>
                </div>
                {showAddTemplate && (
                  <div className="flex gap-2 mb-2">
                    <input
                      value={newTemplateDraft}
                      onChange={e => setNewTemplateDraft(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && addTemplate()}
                      placeholder="Новый шаблон..."
                      className="flex-1 glass-input text-xs text-white px-3 py-1.5 rounded-lg outline-none"
                      autoFocus
                    />
                    <button onClick={addTemplate} className="px-2 py-1 rounded-lg bg-green-500/20 text-green-400 text-xs">+</button>
                  </div>
                )}
                <div className="space-y-1">
                  {messageTemplates.length === 0 ? (
                    <div className="text-[10px] text-white/20 py-2 text-center">
                      Нет шаблонов. Нажмите + чтобы добавить.
                    </div>
                  ) : (
                    messageTemplates.map((tpl, i) => (
                      <div key={i} className="flex items-center gap-1 group">
                        <button
                          onClick={() => useTemplate(tpl)}
                          className="flex-1 text-left text-xs text-white/60 hover:text-white px-2 py-1 rounded-lg hover:bg-white/5 truncate"
                        >
                          {tpl}
                        </button>
                        <button
                          onClick={() => removeTemplate(i)}
                          className="opacity-0 group-hover:opacity-100 p-1 text-red-400/50 hover:text-red-400"
                        >
                          <Trash2 size={10} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Input */}
            <div className="flex items-center gap-2 px-4 py-3 border-t border-white/5 shrink-0">
              <div className="flex items-center gap-1">
                {autoTranslate && (
                  <button
                    onClick={() => setTranslateLang(translateLang === 'en' ? 'ru' : 'en')}
                    className="px-2 py-1 rounded-lg bg-indigo-500/20 text-indigo-400 text-[10px]"
                  >
                    {translateLang === 'en' ? 'EN' : 'RU'}
                  </button>
                )}
                <button
                  onClick={() => setAutoTranslate(!autoTranslate)}
                  className={`p-2 rounded-lg transition-colors ${autoTranslate ? 'bg-indigo-500/20 text-indigo-400' : 'text-white/30 hover:text-white/60'}`}
                >
                  <Languages size={16} />
                </button>
                <button
                  onClick={() => setShowTemplates(!showTemplates)}
                  className={`p-2 rounded-lg transition-colors ${showTemplates ? 'bg-indigo-500/20 text-indigo-400' : 'text-white/30 hover:text-white/60'}`}
                >
                  <FileText size={16} />
                </button>
              </div>
              <input
                type="text"
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
                placeholder={autoTranslate ? `Введите текст (авто-перевод → ${translateLang === 'en' ? 'EN' : 'RU'})...` : 'Введите сообщение...'}
                className="flex-1 glass-input text-sm text-white px-4 py-3 rounded-xl outline-none" />
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
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessageCircle size={48} className="mx-auto mb-4 text-white/10" />
              <div className="text-lg text-white/30">Выберите диалог</div>
              <div className="text-sm text-white/20 mt-1">
                {conversations.length > 0
                  ? 'Выберите друга слева для начала переписки'
                  : targetAccounts.length === 0
                  ? 'Подключите аккаунты для загрузки списка друзей'
                  : 'Загружаем список друзей...'}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
