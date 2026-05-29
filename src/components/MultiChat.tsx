import { useState, useEffect, useRef, useCallback } from 'react';
import { MessageCircle, Send, Search, DollarSign, Users as UsersIcon, Languages, FileText, Plus, X, Trash2 } from 'lucide-react';
import type { SteamAccount, ChatMessage } from '../types';
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
  personaState?: number; // 0=offline, 1=online, 2=busy, 3=away, 4=snooze, 5=looking to trade, 6=looking to play
}

export default function MultiChat({ accounts, selectedAccount }: MultiChatProps) {
  const { messages, sendMessage, fetchNewMessages } = useAppStore();
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
  const [messageTemplates, setMessageTemplates] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('sukacombine-msg-templates');
      if (saved) return JSON.parse(saved);
    } catch { /* ignore */ }
    return [
      'Привет! Как дела?',
      'Готов к обмену?',
      'Скинь трейд ссылку',
      'Сколько хочешь за это?',
      'Давай обменяемся',
      'Спасибо за трейд!',
      'Hi! Ready to trade?',
      'Send me your trade link',
    ];
  });
  const [newTemplateDraft, setNewTemplateDraft] = useState('');
  const [showAddTemplate, setShowAddTemplate] = useState(false);

  // Persist templates
  useEffect(() => {
    localStorage.setItem('sukacombine-msg-templates', JSON.stringify(messageTemplates));
  }, [messageTemplates]);

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
        return { name: (i.name || '') as string, price: (i.price as number) ?? null };
      });
      setInventoryValues(prev => ({
        ...prev,
        [steamId]: {
          value: result.totalValue, loading: false, error: result.error,
          itemCount: result.itemCount, pricedItems: result.pricedItems,
          unpricedItems: result.unpricedItems, pricingComplete: result.pricingComplete,
          source: result.source, items,
        },
      }));
      if (!result.pricingComplete && !result.error) {
        setTimeout(() => {
          steamApi.getInventoryValue(steamId).then(updated => {
            const updItems = (updated.items || []).map((item: unknown) => {
              const i = item as Record<string, unknown>;
              return { name: (i.name || '') as string, price: (i.price as number) ?? null };
            });
            setInventoryValues(prev => ({
              ...prev,
              [steamId]: {
                value: updated.totalValue, loading: false, error: updated.error,
                itemCount: updated.itemCount, pricedItems: updated.pricedItems,
                unpricedItems: updated.unpricedItems, pricingComplete: updated.pricingComplete,
                source: updated.source, items: updItems,
              },
            }));
            if (!updated.pricingComplete && !updated.error) {
              setTimeout(() => fetchInventoryValue(steamId), 20000);
            }
          });
        }, 15000);
      }
    } catch {
      setInventoryValues(prev => ({ ...prev, [steamId]: { value: 0, loading: false, error: 'Ошибка запроса' } }));
    }
  };

  // Build conversations from ALL target accounts' friends
  const conversations: Conversation[] = [];
  const seenFriends = new Set<string>();

  for (const acc of targetAccounts) {
    const accFriends = friendsByAccount[acc.id] || [];
    for (const f of accFriends) {
      const key = `${acc.id}_${f.steamId}`;
      if (seenFriends.has(key)) continue;
      seenFriends.add(key);

      const friendMsgs = messages.filter(m => m.accountId === acc.id && m.friendId === f.steamId);
      const last = friendMsgs[friendMsgs.length - 1];

      conversations.push({
        friendId: f.steamId,
        friendName: f.name || f.steamId,
        friendAvatar: f.avatar || '👤',
        friendAvatarUrl: f.avatarUrl,
        accountId: acc.id,
        accountLogin: acc.login,
        lastMessage: last?.text || '',
        timestamp: last?.timestamp || '',
        inventoryValue: f.inventoryValue,
        personaState: f.personaState,
      });
    }
  }

  conversations.sort((a, b) => {
    if (a.timestamp && !b.timestamp) return -1;
    if (!a.timestamp && b.timestamp) return 1;
    if (a.timestamp && b.timestamp) return b.timestamp.localeCompare(a.timestamp);
    return a.friendName.localeCompare(b.friendName);
  });

  const filteredConversations = conversations.filter(c =>
    c.friendName.toLowerCase().includes(search.toLowerCase()) ||
    c.accountLogin.toLowerCase().includes(search.toLowerCase())
  );

  const conversationMessages: ChatMessage[] = selectedConversation
    ? messages.filter(m => m.accountId === selectedConversation.accountId && m.friendId === selectedConversation.friendId)
    : [];

  const handleSendMessage = async () => {
    if (!inputText.trim() || !selectedConversation) return;
    let text = inputText;
    setInputText('');
    if (autoTranslate) {
      const translated = await translateText(text, translateLang);
      if (translated) text = translated;
    }
    await sendMessage(selectedConversation.accountId, selectedConversation.friendId, selectedConversation.friendName, text);
  };

  const formatTime = (ts: string) => {
    if (!ts) return '';
    return new Date(ts).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' });
  };

  const selectedInventory = selectedConversation ? inventoryValues[selectedConversation.friendId] : undefined;
  const showingAll = !selectedAccount;

  // Helper: is friend online (personaState > 0 means online in Steam)
  const isFriendOnline = (personaState?: number) => {
    return personaState !== undefined && personaState > 0;
  };

  return (
    <div className="flex h-[calc(100vh-52px)]">
      {/* Friends list */}
      <div className="w-80 border-r border-white/5 flex flex-col bg-dark-900/30">
        <div className="p-3 space-y-2 border-b border-white/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-white text-sm font-semibold">
              <MessageCircle size={16} className="text-indigo-400" />
              Мультичат
            </div>
            <div className="text-[10px] text-white/30">
              {showingAll ? `${targetAccounts.length} акк.` : targetAccounts[0]?.login}
            </div>
          </div>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Поиск друзей / аккаунтов..."
              className="w-full glass-input text-xs text-white pl-9 pr-3 py-2 rounded-xl outline-none" />
          </div>
        </div>

        <div className="px-3 py-1.5 text-[10px] text-white/20">
          {filteredConversations.length} друзей
          {showingAll && <span className="ml-1 text-indigo-400/40">все аккаунты</span>}
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-center text-xs text-white/30">
              <div className="animate-spin w-5 h-5 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full mx-auto mb-2" />
              Загрузка друзей{showingAll ? ` (${targetAccounts.length} акк.)` : ''}...
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="p-8 text-center">
              <UsersIcon size={32} className="mx-auto mb-2 text-white/10" />
              <div className="text-xs text-white/30">
                {targetAccounts.length === 0 ? 'Нет онлайн аккаунтов' : 'Нет друзей'}
              </div>
            </div>
          ) : (
            filteredConversations.map(conv => {
              const isSelected =
                selectedConversation?.friendId === conv.friendId &&
                selectedConversation?.accountId === conv.accountId;
              const online = isFriendOnline(conv.personaState);

              return (
                <button
                  key={`${conv.accountId}_${conv.friendId}`}
                  onClick={() => setSelectedConversation(conv)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 transition-colors ${
                    isSelected ? 'bg-white/10' : 'hover:bg-white/5'
                  }`}
                >
                  {/* Avatar with online status indicator */}
                  <div className="relative shrink-0">
                    {conv.friendAvatarUrl ? (
                      <img src={conv.friendAvatarUrl} alt="" className="w-9 h-9 rounded-full" />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-sm">
                        👤
                      </div>
                    )}
                    {/* Online/Offline indicator */}
                    <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-dark-900 ${
                      online ? 'bg-green-400' : 'bg-gray-500'
                    }`} />
                  </div>

                  <div className="flex-1 min-w-0 text-left">
                    <div className="flex items-center gap-1">
                      <span className="text-sm text-white truncate">{conv.friendName}</span>
                    </div>
                    <div className="text-[10px] text-white/30 truncate">
                      {conv.lastMessage || `через ${conv.accountLogin}`}
                    </div>
                  </div>
                  {conv.timestamp && (
                    <div className="text-[9px] text-white/20 shrink-0">
                      {formatTime(conv.timestamp)}
                    </div>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col bg-dark-800/30">
        {selectedConversation ? (
          <>
            {/* Chat header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5">
              {/* Header avatar with status */}
              <div className="relative shrink-0">
                {selectedConversation.friendAvatarUrl ? (
                  <img src={selectedConversation.friendAvatarUrl} alt="" className="w-10 h-10 rounded-full" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-lg">👤</div>
                )}
                <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-dark-800 ${
                  isFriendOnline(selectedConversation.personaState) ? 'bg-green-400' : 'bg-gray-500'
                }`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-white">{selectedConversation.friendName}</div>
                <div className="text-[10px] text-white/30">
                  через {selectedConversation.accountLogin} • {selectedConversation.friendId}
                  {isFriendOnline(selectedConversation.personaState)
                    ? <span className="ml-1 text-green-400">● В сети</span>
                    : <span className="ml-1 text-gray-500">● Не в сети</span>
                  }
                </div>
              </div>
              <div className="flex items-center gap-2">
                {selectedInventory ? (
                  selectedInventory.loading ? (
                    <div className="flex items-center gap-1 text-xs text-white/30">
                      <div className="animate-spin w-3 h-3 border border-white/20 border-t-white/60 rounded-full" />
                      Оценка через Buff163...
                    </div>
                  ) : selectedInventory.error ? (
                    <div className="text-[10px] text-red-400/60">
                      ❌ {selectedInventory.error}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setShowInventoryDetails(!showInventoryDetails)}
                        className="flex items-center gap-1 text-xs text-green-400 hover:text-green-300 transition-colors cursor-pointer"
                        title="Нажмите для деталей"
                      >
                        <DollarSign size={12} />
                        ${selectedInventory.value.toFixed(2)}
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
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-orange-500/15 text-orange-400/70">
                          {selectedInventory.source === 'buff163' ? 'Buff163' : 'Steam'}
                        </span>
                      )}
                      {!selectedInventory.pricingComplete && (
                        <span className="flex items-center gap-1 text-[10px] text-yellow-400/60">
                          <div className="animate-spin w-2.5 h-2.5 border border-yellow-400/30 border-t-yellow-400 rounded-full" />
                        </span>
                      )}
                    </div>
                  )
                ) : null}
                <button onClick={() => fetchInventoryValue(selectedConversation.friendId)}
                  className="p-1.5 rounded-lg bg-white/5 text-white/40 hover:text-white/60 text-xs"
                  title="Оценить инвентарь (Buff163)">
                  💰
                </button>
              </div>
            </div>

            {/* Inventory details panel */}
            {showInventoryDetails && selectedInventory && !selectedInventory.loading && !selectedInventory.error && selectedInventory.items && selectedInventory.items.length > 0 && (
              <div className="border-b border-white/5 bg-dark-900/60 backdrop-blur-xl max-h-52 overflow-y-auto">
                <div className="flex items-center justify-between px-4 py-2 border-b border-white/5 sticky top-0 bg-dark-900/90 backdrop-blur-xl z-10">
                  <span className="text-[10px] font-semibold text-white/50">
                    📦 Инвентарь — Buff163 цены ({selectedInventory.items.length} уник. предметов)
                  </span>
                  <button onClick={() => setShowInventoryDetails(false)} className="p-0.5 text-white/30 hover:text-white/60">
                    <X size={12} />
                  </button>
                </div>
                <div className="divide-y divide-white/3">
                  {selectedInventory.items
                    .filter(item => item.name)
                    .map((item, i) => (
                    <div key={i} className="flex items-center justify-between px-4 py-1.5">
                      <span className="text-[11px] text-white/60 truncate flex-1 min-w-0 mr-3">{item.name}</span>
                      {item.price !== null && item.price > 0 ? (
                        <span className="text-[11px] text-green-400 font-mono shrink-0">${item.price.toFixed(2)}</span>
                      ) : (
                        <span className="text-[10px] text-white/20 shrink-0">—</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {conversationMessages.length === 0 ? (
                <div className="text-center text-xs text-white/20 py-8">Нет сообщений. Начните диалог!</div>
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
                      {!msg.isOutgoing && <span className="text-lg mt-1">👤</span>}
                      <div className={`max-w-[70%] rounded-2xl px-3 py-2 ${msg.isOutgoing ? 'bg-indigo-500/20 text-white' : 'bg-white/5 text-white'}`}>
                        <div className="text-sm break-words">{msg.text}</div>
                        {tr && (
                          <div className="text-xs text-indigo-300/60 mt-1 pt-1 border-t border-white/5">
                            🌐 {tr}
                          </div>
                        )}
                        <div className="flex items-center gap-1 mt-1">
                          <span className="text-[9px] text-white/20">{formatTime(msg.timestamp)}</span>
                          {!msg.isOutgoing && (
                            <button onClick={handleTranslate} disabled={isTranslating}
                              className="text-[9px] text-white/20 hover:text-white/40 ml-1">
                              {isTranslating ? '⏳' : '🌐'}
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
              <div className="border-t border-white/5 bg-dark-900/80 backdrop-blur-xl">
                <div className="flex items-center justify-between px-4 py-2 border-b border-white/5">
                  <span className="text-xs font-semibold text-white/60 flex items-center gap-1.5">
                    <FileText size={12} className="text-indigo-400" />
                    Шаблоны сообщений
                  </span>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setShowAddTemplate(!showAddTemplate)}
                      className="p-1 rounded-md text-white/30 hover:text-white/60 hover:bg-white/5">
                      <Plus size={14} />
                    </button>
                    <button onClick={() => setShowTemplates(false)}
                      className="p-1 rounded-md text-white/30 hover:text-white/60 hover:bg-white/5">
                      <X size={14} />
                    </button>
                  </div>
                </div>
                {showAddTemplate && (
                  <div className="flex items-center gap-2 px-4 py-2 border-b border-white/5">
                    <input
                      value={newTemplateDraft}
                      onChange={e => setNewTemplateDraft(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && addTemplate()}
                      placeholder="Новый шаблон..."
                      className="flex-1 glass-input text-xs text-white px-3 py-1.5 rounded-lg outline-none"
                      autoFocus
                    />
                    <button onClick={addTemplate} disabled={!newTemplateDraft.trim()}
                      className="px-3 py-1.5 rounded-lg bg-green-500/20 text-green-400 text-xs hover:bg-green-500/30 disabled:opacity-30">
                      Добавить
                    </button>
                  </div>
                )}
                <div className="max-h-48 overflow-y-auto p-2 space-y-1">
                  {messageTemplates.length === 0 ? (
                    <div className="text-center text-xs text-white/20 py-4">
                      Нет шаблонов. Нажмите + чтобы добавить.
                    </div>
                  ) : (
                    messageTemplates.map((tpl, i) => (
                      <div key={i} className="group flex items-center gap-1">
                        <button
                          onClick={() => useTemplate(tpl)}
                          className="flex-1 text-left px-3 py-2 rounded-lg text-xs text-white/70 hover:bg-white/10 hover:text-white transition-colors truncate"
                        >
                          {tpl}
                        </button>
                        <button
                          onClick={() => removeTemplate(i)}
                          className="p-1 rounded-md text-white/0 group-hover:text-red-400/60 hover:!text-red-400 hover:bg-red-500/10 transition-all shrink-0"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Input */}
            <div className="flex items-center gap-2 px-4 py-3 border-t border-white/5">
              <div className="flex items-center gap-1">
                <button onClick={() => setAutoTranslate(!autoTranslate)}
                  className={`p-2 rounded-lg text-xs ${autoTranslate ? 'bg-indigo-500/20 text-indigo-400' : 'bg-white/5 text-white/30'}`}>
                  <Languages size={16} />
                </button>
                {autoTranslate && (
                  <select value={translateLang} onChange={e => setTranslateLang(e.target.value as 'ru' | 'en')}
                    className="glass-input text-xs text-white px-2 py-1.5 rounded-lg outline-none bg-transparent">
                    <option value="ru" className="bg-gray-900">→ RU</option>
                    <option value="en" className="bg-gray-900">→ EN</option>
                  </select>
                )}
                <button onClick={() => setShowTemplates(!showTemplates)}
                  className={`p-2 rounded-lg text-xs ${showTemplates ? 'bg-purple-500/20 text-purple-400' : 'bg-white/5 text-white/30 hover:text-white/50'}`}
                  title="Шаблоны сообщений"
                >
                  <FileText size={16} />
                </button>
              </div>
              <input value={inputText} onChange={e => setInputText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
                placeholder={autoTranslate ? `Введите текст (авто-перевод → ${translateLang === 'en' ? 'EN' : 'RU'})...` : 'Введите сообщение...'}
                className="flex-1 glass-input text-sm text-white px-4 py-3 rounded-xl outline-none" />
              <button onClick={handleSendMessage} disabled={!inputText.trim()}
                className="p-3 rounded-xl bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30 disabled:opacity-30">
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
