import { useState, useEffect, useRef, useCallback } from 'react';
import { MessageCircle, Send, Search, DollarSign, Users as UsersIcon, Languages } from 'lucide-react';
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
}

export default function MultiChat({ accounts, selectedAccount }: MultiChatProps) {
  const { messages, sendMessage, fetchNewMessages } = useAppStore();
  // Store friends per account: { accountId -> FriendData[] }
  const [friendsByAccount, setFriendsByAccount] = useState<Record<string, FriendData[]>>({});
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [translatingId, setTranslatingId] = useState<string | null>(null);
  const [autoTranslate, setAutoTranslate] = useState(false);
  const [translateLang, setTranslateLang] = useState<'ru' | 'en'>('ru');
  const [inventoryValues, setInventoryValues] = useState<Record<string, {
    value: number;
    loading: boolean;
    error?: string;
    itemCount?: number;
    pricedItems?: number;
    unpricedItems?: number;
    pricingComplete?: boolean;
  }>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const onlineAccounts = accounts.filter(a => a.status === 'online' || a.status === 'in-game');

  // Which accounts to load friends for
  const targetAccounts = selectedAccount
    ? [selectedAccount].filter(a => a.status === 'online' || a.status === 'in-game')
    : onlineAccounts;

  // Load friends for all target accounts
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
        },
      }));

      // If pricing is not complete, auto-refresh in 15 seconds
      if (!result.pricingComplete && !result.error) {
        setTimeout(() => {
          // Re-fetch to get updated prices from background fetcher
          steamApi.getInventoryValue(steamId).then(updated => {
            setInventoryValues(prev => ({
              ...prev,
              [steamId]: {
                value: updated.totalValue,
                loading: false,
                error: updated.error,
                itemCount: updated.itemCount,
                pricedItems: updated.pricedItems,
                unpricedItems: updated.unpricedItems,
                pricingComplete: updated.pricingComplete,
              },
            }));
            // Keep refreshing if still not complete
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
  const seenFriends = new Set<string>(); // deduplicate by friendId+accountId

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
      });
    }
  }

  // Sort: conversations with messages first, then alphabetically
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

    // Auto-translate before sending if enabled
    if (autoTranslate) {
      const translated = await translateText(text, translateLang);
      if (translated) {
        text = translated;
      }
    }

    await sendMessage(
      selectedConversation.accountId,
      selectedConversation.friendId,
      selectedConversation.friendName,
      text
    );
  };

  const formatTime = (ts: string) => {
    if (!ts) return '';
    return new Date(ts).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' });
  };

  const selectedInventory = selectedConversation ? inventoryValues[selectedConversation.friendId] : undefined;
  const showingAll = !selectedAccount;

  return (
    <div className="flex h-[calc(100vh-52px)]">
      {/* Friends list */}
      <div className="w-80 border-r border-white/5 flex flex-col shrink-0">
        <div className="p-3 border-b border-white/5 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-white">
              <MessageCircle size={16} />
              <span className="text-sm font-semibold">Мультичат</span>
            </div>
            <span className="text-[10px] text-white/30">
              {showingAll ? `${targetAccounts.length} акк.` : targetAccounts[0]?.login}
            </span>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Поиск друзей / аккаунтов..."
              className="w-full glass-input text-xs text-white pl-9 pr-3 py-2 rounded-xl outline-none"
            />
          </div>
        </div>

        <div className="px-3 py-1.5 text-[10px] text-white/30 flex justify-between">
          <span>{filteredConversations.length} друзей</span>
          {showingAll && <span className="text-indigo-400/60">все аккаунты</span>}
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-xs text-white/30 text-center">
              <div className="animate-spin w-5 h-5 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full mx-auto mb-2" />
              Загрузка друзей{showingAll ? ` (${targetAccounts.length} акк.)` : ''}...
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="p-8 text-center text-white/20">
              <UsersIcon className="w-8 h-8 mx-auto mb-2 opacity-20" />
              <div className="text-xs">
                {targetAccounts.length === 0 ? 'Нет онлайн аккаунтов' : 'Нет друзей'}
              </div>
            </div>
          ) : (
            filteredConversations.map(conv => {
              const isSelected =
                selectedConversation?.friendId === conv.friendId &&
                selectedConversation?.accountId === conv.accountId;

              return (
                <button
                  key={`${conv.accountId}_${conv.friendId}`}
                  onClick={() => setSelectedConversation(conv)}
                  className={`w-full px-3 py-2.5 flex items-center gap-2.5 text-left transition-colors ${
                    isSelected ? 'bg-white/8' : 'hover:bg-white/3'
                  }`}
                >
                  {conv.friendAvatarUrl ? (
                    <img src={conv.friendAvatarUrl} alt="" className="w-8 h-8 rounded-full shrink-0" />
                  ) : (
                    <span className="text-lg shrink-0">👤</span>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-xs text-white truncate">{conv.friendName}</div>
                    <div className="text-[10px] text-white/30 truncate">
                      {conv.lastMessage || 'Нет сообщений'}
                    </div>
                    {/* Show which account this friend belongs to */}
                    {showingAll && (
                      <div className="text-[9px] text-indigo-400/50 truncate">
                        через {conv.accountLogin}
                      </div>
                    )}
                  </div>
                  {conv.timestamp && (
                    <span className="text-[9px] text-white/20 shrink-0">
                      {formatTime(conv.timestamp)}
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col">
        {selectedConversation ? (
          <>
            <div className="px-4 py-3 border-b border-white/5 flex items-center gap-3">
              {selectedConversation.friendAvatarUrl ? (
                <img src={selectedConversation.friendAvatarUrl} alt="" className="w-8 h-8 rounded-full" />
              ) : (
                <span className="text-xl">👤</span>
              )}
              <div className="min-w-0 flex-1">
                <div className="text-sm text-white font-medium">{selectedConversation.friendName}</div>
                <div className="text-[10px] text-white/30 truncate">
                  через {selectedConversation.accountLogin} • {selectedConversation.friendId}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {selectedInventory ? (
                  selectedInventory.loading ? (
                    <span className="text-xs text-white/40 flex items-center gap-1">
                      <div className="animate-spin w-3 h-3 border border-indigo-500/30 border-t-indigo-500 rounded-full" />
                      Загрузка...
                    </span>
                  ) : selectedInventory.error ? (
                    <span className="text-xs text-red-400/80" title={selectedInventory.error}>
                      ❌ {selectedInventory.error}
                    </span>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-green-400 flex items-center gap-1 font-medium">
                        <DollarSign size={12} />
                        ${selectedInventory.value.toFixed(2)}
                      </span>
                      <span className="text-[10px] text-white/20">
                        {selectedInventory.itemCount} шт
                      </span>
                      {!selectedInventory.pricingComplete && (
                        <span className="text-[10px] text-yellow-400/70 flex items-center gap-1">
                          <div className="animate-spin w-2.5 h-2.5 border border-yellow-500/30 border-t-yellow-500 rounded-full" />
                          {selectedInventory.pricedItems}/{(selectedInventory.pricedItems || 0) + (selectedInventory.unpricedItems || 0)}
                        </span>
                      )}
                    </div>
                  )
                ) : null}
                <button
                  onClick={() => fetchInventoryValue(selectedConversation.friendId)}
                  className="text-[10px] text-white/30 hover:text-white/50 px-2 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                >
                  💰 {selectedInventory && !selectedInventory.loading ? 'Обновить' : 'Инвентарь'}
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
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
                      {!msg.isOutgoing && <span className="text-sm shrink-0">👤</span>}
                      <div className={`max-w-[70%] px-3 py-2 rounded-2xl text-sm ${
                        msg.isOutgoing ? 'bg-indigo-500/20 text-indigo-200' : 'bg-white/5 text-white/80'
                      }`}>
                        <div>{msg.text}</div>
                        {tr && (
                          <div className="mt-1 pt-1 border-t border-white/10 text-xs text-blue-300/70 italic">
                            🌐 {tr}
                          </div>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[9px] text-white/20">{formatTime(msg.timestamp)}</span>
                          <button
                            onClick={handleTranslate}
                            disabled={isTranslating}
                            className="text-[9px] text-white/20 hover:text-blue-400/60 transition-colors disabled:opacity-50"
                            title={/[а-яА-ЯёЁ]/.test(msg.text) ? 'Перевести на English' : 'Перевести на Русский'}
                          >
                            {isTranslating ? '...' : '🌐'}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-3 border-t border-white/5 space-y-2">
              {/* Translate toggle */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setAutoTranslate(!autoTranslate)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] transition-colors ${
                    autoTranslate ? 'bg-blue-500/20 text-blue-400' : 'bg-white/5 text-white/30 hover:text-white/50'
                  }`}
                >
                  <Languages size={11} />
                  Авто-перевод
                </button>
                {autoTranslate && (
                  <select
                    value={translateLang}
                    onChange={e => setTranslateLang(e.target.value as 'ru' | 'en')}
                    className="bg-white/5 text-white/60 text-[10px] px-2 py-1 rounded-lg border border-white/10 outline-none"
                  >
                    <option value="en" className="bg-gray-900">Отправлять на English</option>
                    <option value="ru" className="bg-gray-900">Отправлять на Русский</option>
                  </select>
                )}
              </div>
              <div className="flex gap-2">
                <input
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
                  placeholder={autoTranslate ? `Введите текст (авто-перевод → ${translateLang === 'en' ? 'EN' : 'RU'})...` : 'Введите сообщение...'}
                  className="flex-1 glass-input text-sm text-white px-4 py-3 rounded-xl outline-none"
                />
                <button onClick={handleSendMessage} className="glass-btn px-4 py-3 rounded-xl">
                  <Send size={16} />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-center">
            <div>
              <MessageCircle size={48} className="mx-auto mb-3 text-white/10" />
              <div className="text-white/30">Выберите диалог</div>
              <div className="text-xs text-white/15 mt-1">
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
