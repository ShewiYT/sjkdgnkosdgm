# Прокси для обхода RateLimitExceeded

## Как работает

1. При подключении аккаунта — сначала логин через IP сервера (VDS)
2. Если Steam отвечает `RateLimitExceeded` — автоматический повтор через прокси
3. Прокси настраивается в **Настройки → Прокси для обхода RateLimit**

## Подключение к server.js

### 1. Установите зависимости

```bash
npm install https-proxy-agent socks-proxy-agent
```

### 2. Добавьте в server.js

```javascript
const { parseProxyUrl, setupProxyRoutes } = require('./server/proxyHelper');

// После создания Express app
setupProxyRoutes(app);
```

### 3. Модифицируйте обработчик /api/steam/login

В вашем обработчике логина добавьте поддержку `proxyUrl`:

```javascript
app.post('/api/steam/login', async (req, res) => {
  const { accountId, login, password, sharedSecret, identitySecret, proxyUrl } = req.body;
  
  // Опции для SteamUser
  const clientOptions = {};
  
  if (proxyUrl) {
    const proxy = parseProxyUrl(proxyUrl);
    if (proxy) {
      if (proxy.isSocks) {
        // SOCKS прокси
        clientOptions.socksProxy = proxy.formatted;
      } else {
        // HTTP/HTTPS прокси
        clientOptions.httpProxy = proxy.formatted;
      }
      console.log(`[Steam] Using proxy ${proxy.host}:${proxy.port} for ${login}`);
    }
  }
  
  // Создание клиента с прокси
  const client = new SteamUser(clientOptions);
  
  // ... остальной код логина ...
});
```

### Полный пример обработчика с прокси

```javascript
const SteamUser = require('steam-user');
const SteamTotp = require('steam-totp');
const { parseProxyUrl } = require('./server/proxyHelper');

// Хранилище активных сессий
const sessions = new Map();

app.post('/api/steam/login', async (req, res) => {
  const { accountId, login, password, sharedSecret, identitySecret, proxyUrl } = req.body;
  
  // Закрыть старую сессию если есть
  if (sessions.has(accountId)) {
    try { sessions.get(accountId).logOff(); } catch {}
    sessions.delete(accountId);
  }
  
  // Настройки клиента
  const clientOptions = {
    autoRelogin: false,
  };
  
  // Добавить прокси если указан
  if (proxyUrl) {
    const proxy = parseProxyUrl(proxyUrl);
    if (proxy) {
      if (proxy.isSocks) {
        clientOptions.socksProxy = proxy.formatted;
      } else {
        clientOptions.httpProxy = proxy.formatted;
      }
      console.log(`[Steam] 🛡️ Using proxy for ${login}: ${proxy.host}:${proxy.port}`);
    }
  }
  
  const client = new SteamUser(clientOptions);
  
  const loginDetails = {
    accountName: login,
    password: password,
  };
  
  // Steam Guard
  if (sharedSecret) {
    loginDetails.twoFactorCode = SteamTotp.generateAuthCode(sharedSecret);
  }
  
  // Таймаут
  const timeout = setTimeout(() => {
    client.removeAllListeners();
    try { client.logOff(); } catch {}
    res.json({ error: 'Таймаут подключения (30 сек)' });
  }, 30000);
  
  client.on('loggedOn', () => {
    clearTimeout(timeout);
    sessions.set(accountId, client);
    
    // Получить данные профиля
    client.setPersona(SteamUser.EPersonaState.Online);
    
    res.json({
      success: true,
      status: 'online',
      steamId: client.steamID?.getSteamID64(),
    });
  });
  
  client.on('error', (err) => {
    clearTimeout(timeout);
    console.error(`[Steam] ❌ ${login} login error: ${err.message}`);
    try { client.logOff(); } catch {}
    sessions.delete(accountId);
    res.json({ error: err.message });
  });
  
  client.logOn(loginDetails);
});
```

## Формат прокси

- `http://user:pass@ip:port` — HTTP прокси с авторизацией
- `https://user:pass@ip:port` — HTTPS прокси
- `socks5://user:pass@ip:port` — SOCKS5 прокси
- `http://ip:port` — без авторизации

## Примечания

- `steam-user` нативно поддерживает `httpProxy` и `socksProxy` опции
- Для SOCKS нужно установить `socks-proxy-agent`: `npm install socks-proxy-agent`
- Прокси используется ТОЛЬКО при RateLimitExceeded, обычные логины идут через VDS IP
- Задержка 3 секунды перед повторной попыткой через прокси
