/**
 * Proxy helper for Steam login
 * 
 * Добавьте в server.js:
 * 
 * const { setupProxyRoutes, parseProxyUrl } = require('./server/proxyHelper');
 * setupProxyRoutes(app);
 * 
 * В обработчике /api/steam/login добавьте поддержку proxyUrl:
 * 
 * app.post('/api/steam/login', async (req, res) => {
 *   const { accountId, login, password, sharedSecret, identitySecret, proxyUrl } = req.body;
 *   
 *   const loginOptions = {};
 *   if (proxyUrl) {
 *     const proxy = parseProxyUrl(proxyUrl);
 *     if (proxy) {
 *       // Для steam-user используется httpProxy
 *       loginOptions.httpProxy = proxy.formatted;
 *       console.log(`[Steam] Using proxy ${proxy.host}:${proxy.port} for ${login}`);
 *     }
 *   }
 *   
 *   // Создание SteamUser с прокси:
 *   // const client = new SteamUser({ httpProxy: proxyUrl });
 *   // или
 *   // const client = new SteamUser({ socksProxy: proxyUrl }); // для SOCKS
 * });
 */

/**
 * Parse proxy URL into components
 * Supports formats:
 * - http://user:pass@ip:port
 * - https://user:pass@ip:port
 * - socks5://user:pass@ip:port
 * - user:pass@ip:port
 * - ip:port
 */
function parseProxyUrl(proxyUrl) {
  if (!proxyUrl || !proxyUrl.trim()) return null;
  
  let url = proxyUrl.trim();
  
  // Add protocol if missing
  if (!url.match(/^(https?|socks[45]?):\/\//i)) {
    // Check if it looks like user:pass@host:port
    if (url.includes('@')) {
      url = `http://${url}`;
    } else {
      url = `http://${url}`;
    }
  }
  
  try {
    const parsed = new URL(url);
    
    return {
      protocol: parsed.protocol.replace(':', ''),
      host: parsed.hostname,
      port: parseInt(parsed.port) || (parsed.protocol === 'https:' ? 443 : 8080),
      username: parsed.username || null,
      password: parsed.password || null,
      hasAuth: !!parsed.username,
      formatted: url,
      isSocks: parsed.protocol.startsWith('socks'),
    };
  } catch (e) {
    console.error('[Proxy] Failed to parse proxy URL:', e.message);
    return null;
  }
}

/**
 * Setup proxy-related routes
 */
function setupProxyRoutes(app) {
  /**
   * POST /api/steam/test-proxy
   * Test if a proxy is working by making a request through it
   */
  app.post('/api/steam/test-proxy', async (req, res) => {
    const { proxyUrl } = req.body;
    
    if (!proxyUrl) {
      return res.json({ success: false, error: 'Прокси не указан' });
    }
    
    const proxy = parseProxyUrl(proxyUrl);
    if (!proxy) {
      return res.json({ success: false, error: 'Неверный формат прокси' });
    }
    
    console.log(`[Proxy] Testing proxy ${proxy.host}:${proxy.port}...`);
    
    try {
      // Try to use the proxy to fetch an IP check service
      // This requires a proxy agent - try different approaches
      
      let HttpsProxyAgent;
      try {
        HttpsProxyAgent = require('https-proxy-agent').HttpsProxyAgent;
      } catch {
        try {
          const mod = require('https-proxy-agent');
          HttpsProxyAgent = mod.HttpsProxyAgent || mod;
        } catch {
          // No proxy agent available - just check if the proxy format is valid
          console.log('[Proxy] https-proxy-agent not installed, validating format only');
          return res.json({ 
            success: true, 
            ip: `${proxy.host}:${proxy.port}`,
            note: 'Формат валидный (установите https-proxy-agent для полной проверки)',
          });
        }
      }
      
      const agent = new HttpsProxyAgent(proxy.formatted);
      const https = require('https');
      
      const testReq = https.get('https://api.ipify.org?format=json', { agent, timeout: 10000 }, (testRes) => {
        let data = '';
        testRes.on('data', chunk => data += chunk);
        testRes.on('end', () => {
          try {
            const json = JSON.parse(data);
            console.log(`[Proxy] Test successful, IP: ${json.ip}`);
            res.json({ success: true, ip: json.ip });
          } catch {
            console.log('[Proxy] Test successful (non-JSON response)');
            res.json({ success: true, ip: data.trim().substring(0, 50) });
          }
        });
      });
      
      testReq.on('error', (err) => {
        console.error(`[Proxy] Test failed:`, err.message);
        res.json({ success: false, error: err.message });
      });
      
      testReq.on('timeout', () => {
        testReq.destroy();
        res.json({ success: false, error: 'Таймаут подключения' });
      });
      
    } catch (e) {
      console.error(`[Proxy] Test error:`, e.message);
      res.json({ success: false, error: e.message });
    }
  });

  console.log('[Proxy] Routes registered');
}

module.exports = { parseProxyUrl, setupProxyRoutes };
