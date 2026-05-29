// ============================================================
// ДОБАВЬТЕ ЭТОТ КОД В ВАШ server.js (перед app.listen)
// Это прокси-эндпоинты для цепочного парсера Steam ID
// Они нужны потому что браузер не может напрямую обращаться
// к Steam API из-за CORS
// ============================================================

import fetch from 'node-fetch';

// ============= STEAM PROXY API (для цепочного парсера) =============

// Ping — проверка доступности прокси
app.get('/api/steam-proxy/ping', (req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

// Прокси: Получить список друзей
app.get('/api/steam-proxy/friends', async (req, res) => {
  const { key, steamid } = req.query;
  if (!key || !steamid) {
    return res.status(400).json({ error: 'key and steamid required' });
  }
  try {
    const url = `https://api.steampowered.com/ISteamUser/GetFriendList/v0001/?key=${key}&steamid=${steamid}&relationship=friend`;
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      timeout: 10000,
    });
    
    if (!response.ok) {
      console.log(`[Proxy] Friends API returned ${response.status} for ${steamid}`);
      return res.status(response.status).json({ error: `Steam API returned ${response.status}` });
    }
    
    const data = await response.json();
    res.json(data);
  } catch (e) {
    console.error(`[Proxy] Friends error for ${steamid}:`, e.message);
    res.status(500).json({ error: e.message });
  }
});

// Прокси: Получить информацию об игроках
app.get('/api/steam-proxy/summaries', async (req, res) => {
  const { key, steamids } = req.query;
  if (!key || !steamids) {
    return res.status(400).json({ error: 'key and steamids required' });
  }
  try {
    const url = `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=${key}&steamids=${steamids}`;
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      timeout: 10000,
    });
    
    if (!response.ok) {
      return res.status(response.status).json({ error: `Steam API returned ${response.status}` });
    }
    
    const data = await response.json();
    res.json(data);
  } catch (e) {
    console.error(`[Proxy] Summaries error:`, e.message);
    res.status(500).json({ error: e.message });
  }
});

// Прокси: Получить инвентарь
app.get('/api/steam-proxy/inventory', async (req, res) => {
  const { steamid, appid } = req.query;
  if (!steamid) {
    return res.status(400).json({ error: 'steamid required' });
  }
  
  const gameAppId = appid || '730';
  
  try {
    const url = `https://steamcommunity.com/inventory/${steamid}/${gameAppId}/2?l=english&count=5000`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
      },
      timeout: 15000,
    });
    
    if (response.status === 403 || response.status === 401) {
      return res.status(403).json({ error: 'private' });
    }
    if (response.status === 429) {
      return res.status(429).json({ error: 'rate_limit' });
    }
    if (!response.ok) {
      return res.status(response.status).json({ error: `Steam returned ${response.status}` });
    }
    
    const data = await response.json();
    res.json(data);
  } catch (e) {
    console.error(`[Proxy] Inventory error for ${steamid}:`, e.message);
    res.status(500).json({ error: e.message });
  }
});

// ============= КОНЕЦ ПРОКСИ КОДА =============
