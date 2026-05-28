import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import SteamUser from 'steam-user';
import SteamTotp from 'steam-totp';
import SteamCommunity from 'steamcommunity';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: '10mb' }));

const PORT = process.env.PORT || 3000;
const distPath = path.join(__dirname, 'dist');
const indexPath = path.join(distPath, 'index.html');

// Store active Steam clients
const steamClients = new Map();
const steamCommunities = new Map();

// Message queue for multichat
let messageQueue = [];

// ============= TRANSLATION API (Free Google Translate) =============

async function translateText(text, targetLang = 'ru') {
  if (!text || text.length < 2) return text;
  
  try {
    // Use Google Translate unofficial API (free)
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    if (!response.ok) {
      console.error('Translation API error:', response.status);
      return text;
    }
    
    const data = await response.json();
    
    // Parse response: [[["translated text","original text",...],...],...]
    if (data && data[0] && Array.isArray(data[0])) {
      const translated = data[0].map(item => item[0]).join('');
      return translated || text;
    }
    
    return text;
  } catch (err) {
    console.error('Translation error:', err.message);
    return text;
  }
}

app.post('/api/translate', async (req, res) => {
  const { text, to = 'ru' } = req.body;
  
  if (!text || text.length < 2) {
    return res.json({ translated: text });
  }

  const translated = await translateText(text, to);
  res.json({ translated });
});

// ============= STEAM API =============

// Login to Steam account
app.post('/api/steam/login', async (req, res) => {
  const { accountId, login, password, sharedSecret, identitySecret } = req.body;
  
  if (!login || !password) {
    return res.status(400).json({ error: 'Login and password required' });
  }

  // Check if already connected
  if (steamClients.has(accountId)) {
    const existingClient = steamClients.get(accountId);
    if (existingClient.steamID) {
      return res.json({ 
        success: true, 
        status: 'online',
        steamId: existingClient.steamID.getSteamID64(),
        message: 'Already connected'
      });
    }
  }

  try {
    const client = new SteamUser();
    const community = new SteamCommunity();
    
    steamClients.set(accountId, client);
    steamCommunities.set(accountId, community);

    const loginOptions = {
      accountName: login,
      password: password,
    };

    // Add 2FA code if shared secret provided
    if (sharedSecret) {
      loginOptions.twoFactorCode = SteamTotp.generateAuthCode(sharedSecret);
    }

    let responded = false;

    // Setup event handlers
    client.on('loggedOn', () => {
      console.log(`[${login}] Logged in successfully`);
      client.setPersona(SteamUser.EPersonaState.Online);
      
      if (!responded) {
        responded = true;
        res.json({
          success: true,
          status: 'online',
          steamId: client.steamID.getSteamID64(),
        });
      }
    });

    client.on('error', (err) => {
      console.error(`[${login}] Login error:`, err.message);
      steamClients.delete(accountId);
      steamCommunities.delete(accountId);
      
      let errorMessage = 'Login failed';
      if (err.eresult === 5) errorMessage = 'Неверный пароль';
      else if (err.eresult === 63) errorMessage = 'Нужен Steam Guard код';
      else if (err.eresult === 65) errorMessage = 'Неверный Steam Guard код';
      else if (err.eresult === 84) errorMessage = 'Слишком много попыток';
      else if (err.eresult === 88) errorMessage = 'Аккаунт заблокирован';
      else errorMessage = err.message;
      
      if (!responded) {
        responded = true;
        res.status(401).json({ error: errorMessage, eresult: err.eresult });
      }
    });

    client.on('webSession', (sessionID, cookies) => {
      community.setCookies(cookies);
      console.log(`[${login}] Web session established`);
    });

    // Handle incoming messages
    client.on('friendMessage', (steamID, message) => {
      const msg = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        accountId,
        accountLogin: login,
        friendId: steamID.getSteamID64(),
        friendName: client.users[steamID]?.player_name || steamID.getSteamID64(),
        friendAvatar: '👤',
        text: message,
        timestamp: new Date().toISOString(),
        isOutgoing: false,
      };
      messageQueue.push(msg);
      console.log(`[${login}] Message from ${msg.friendName}: ${message}`);
    });

    client.on('disconnected', (eresult, msg) => {
      console.log(`[${login}] Disconnected: ${msg}`);
      steamClients.delete(accountId);
      steamCommunities.delete(accountId);
    });

    // Start login
    client.logOn(loginOptions);

    // Timeout for login
    setTimeout(() => {
      if (!responded) {
        responded = true;
        res.status(408).json({ error: 'Таймаут подключения' });
      }
    }, 30000);

  } catch (err) {
    console.error(`[${login}] Error:`, err);
    res.status(500).json({ error: err.message });
  }
});

// Logout from Steam
app.post('/api/steam/logout', (req, res) => {
  const { accountId } = req.body;
  
  const client = steamClients.get(accountId);
  if (client) {
    client.logOff();
    steamClients.delete(accountId);
    steamCommunities.delete(accountId);
  }
  
  res.json({ success: true });
});

// Get account status
app.get('/api/steam/status/:accountId', (req, res) => {
  const { accountId } = req.params;
  const client = steamClients.get(accountId);
  
  if (!client || !client.steamID) {
    return res.json({ status: 'offline' });
  }
  
  res.json({
    status: 'online',
    steamId: client.steamID.getSteamID64(),
    personaState: client.myPersonaState,
    wallet: client.wallet,
  });
});

// Get all connected accounts status
app.get('/api/steam/status-all', (req, res) => {
  const statuses = {};
  
  for (const [accountId, client] of steamClients.entries()) {
    if (client.steamID) {
      statuses[accountId] = {
        status: 'online',
        steamId: client.steamID.getSteamID64(),
        personaState: client.myPersonaState,
        friendsCount: Object.keys(client.users || {}).length,
      };
    } else {
      statuses[accountId] = { status: 'connecting' };
    }
  }
  
  res.json(statuses);
});

// Get friends list
app.get('/api/steam/friends/:accountId', (req, res) => {
  const { accountId } = req.params;
  const client = steamClients.get(accountId);
  
  if (!client || !client.steamID) {
    return res.json({ friends: [] });
  }
  
  const friends = [];
  for (const [steamId, data] of Object.entries(client.users || {})) {
    friends.push({
      steamId,
      name: data.player_name,
      avatar: data.avatar_url_medium,
      personaState: data.persona_state,
      gameId: data.gameid,
      gameName: data.game_name,
    });
  }
  
  res.json({ friends });
});

// Add friend
app.post('/api/steam/add-friend', async (req, res) => {
  const { accountId, steamId } = req.body;
  
  const client = steamClients.get(accountId);
  if (!client || !client.steamID) {
    return res.status(400).json({ error: 'Account not connected' });
  }

  try {
    // Handle vanity URL
    let targetSteamId = steamId;
    if (steamId.startsWith('vanity:')) {
      const vanityName = steamId.replace('vanity:', '');
      const community = steamCommunities.get(accountId);
      if (community) {
        targetSteamId = await new Promise((resolve, reject) => {
          community.getSteamUser(vanityName, (err, user) => {
            if (err) reject(err);
            else resolve(user.steamID.getSteamID64());
          });
        });
      }
    }

    await new Promise((resolve, reject) => {
      client.addFriend(targetSteamId, (err, personaName) => {
        if (err) reject(err);
        else resolve(personaName);
      });
    });

    res.json({ success: true });
  } catch (err) {
    console.error('Add friend error:', err);
    res.json({ success: false, error: err.message });
  }
});

// Send message
app.post('/api/steam/message', (req, res) => {
  const { accountId, friendSteamId, message } = req.body;
  
  const client = steamClients.get(accountId);
  if (!client || !client.steamID) {
    return res.status(400).json({ error: 'Not connected' });
  }
  
  try {
    client.chat.sendFriendMessage(friendSteamId, message);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get new messages (polling endpoint)
app.get('/api/steam/messages', (req, res) => {
  const messages = [...messageQueue];
  messageQueue = [];
  res.json({ messages });
});

// Generate Steam Guard code
app.post('/api/steam/guard-code', (req, res) => {
  const { sharedSecret } = req.body;
  
  if (!sharedSecret) {
    return res.status(400).json({ error: 'Shared secret required' });
  }
  
  try {
    const code = SteamTotp.generateAuthCode(sharedSecret);
    const timeLeft = 30 - (Math.floor(Date.now() / 1000) % 30);
    res.json({ code, timeLeft });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============= STATIC FILES =============

if (fs.existsSync(indexPath)) {
  app.use(express.static(distPath));
  app.get('{*path}', (req, res) => {
    res.sendFile(indexPath);
  });
} else {
  app.get('/', (req, res) => {
    res.send(`
      <html>
        <head><title>SukaCombine - Build Required</title></head>
        <body style="background:#1c1c1e;color:#fff;font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
          <div style="text-align:center;">
            <h1>🎮 SukaCombine</h1>
            <p>Выполните: <code style="background:#333;padding:5px 10px;border-radius:4px;">npm run build</code></p>
          </div>
        </body>
      </html>
    `);
  });
}

// ============= START SERVER =============

app.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   🎮 SukaCombine - Suka Team Panel                           ║
║                                                               ║
║   ✅ Сервер запущен!                                          ║
║   🌐 http://localhost:${String(PORT).padEnd(5)}                              ║
║                                                               ║
║   🔐 Логин: admin / admin123                                  ║
║                                                               ║
║   📡 API:                                                      ║
║   POST /api/steam/login       - Авторизация Steam             ║
║   POST /api/steam/add-friend  - Добавить друга                ║
║   POST /api/translate         - Перевод (ru/en)               ║
║                                                               ║
║   ⏱️  Задержка добавления друзей: 5-40 сек (рандом)           ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
  `);
});
