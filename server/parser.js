/**
 * Steam Inventory Parser - Server-side with multithreading
 * Runs in background, doesn't stop when browser tab closes
 * Uses SQLite database for persistence
 */

const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const Database = require('better-sqlite3');
const fetch = require('node-fetch');
const path = require('path');

// CIS countries to exclude
const EXCLUDED_COUNTRIES = new Set([
  'RU', 'UA', 'BY', 'KZ', 'UZ', 'TJ', 'TM', 'KG', 'AZ', 'AM', 'MD', 'GE'
]);

// Initialize database
const db = new Database(path.join(__dirname, '..', 'data', 'sukacombine.db'));
db.pragma('journal_mode = WAL');

// Rate limiting
let lastRequestTime = 0;
const REQUEST_DELAY = 1500; // 1.5 seconds between requests

async function rateLimitWait() {
  const now = Date.now();
  const timeSinceLast = now - lastRequestTime;
  if (timeSinceLast < REQUEST_DELAY) {
    await new Promise(r => setTimeout(r, REQUEST_DELAY - timeSinceLast));
  }
  lastRequestTime = Date.now();
}

// Price cache
const priceCache = new Map();

// Get market price for item
async function getMarketPrice(marketHashName, appid = 730) {
  if (priceCache.has(marketHashName)) {
    return priceCache.get(marketHashName);
  }

  await rateLimitWait();

  try {
    const url = `https://steamcommunity.com/market/priceoverview/?appid=${appid}&currency=1&market_hash_name=${encodeURIComponent(marketHashName)}`;
    const response = await fetch(url, {
      timeout: 8000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      }
    });

    if (response.status === 200) {
      const data = await response.json();
      if (data.success) {
        const priceStr = (data.lowest_price || '$0.00').replace('$', '').replace(',', '').trim();
        const price = parseFloat(priceStr) || 0.01;
        priceCache.set(marketHashName, price);
        return price;
      }
    } else if (response.status === 429) {
      // Rate limited, wait and return minimal price
      await new Promise(r => setTimeout(r, 5000));
      return 0.01;
    }
  } catch (e) {
    // Ignore errors
  }

  priceCache.set(marketHashName, 0.01);
  return 0.01;
}

// Get inventory value for a Steam ID
async function getInventoryValue(steamId) {
  await rateLimitWait();

  try {
    const url = `https://steamcommunity.com/inventory/${steamId}/730/2?l=english&count=500`;
    const response = await fetch(url, {
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
        'Referer': `https://steamcommunity.com/profiles/${steamId}/inventory/`,
        'X-Requested-With': 'XMLHttpRequest'
      }
    });

    if (response.status === 429) {
      await new Promise(r => setTimeout(r, 10000));
      return { value: null, count: 0 };
    }

    if (response.status !== 200) {
      return { value: null, count: 0 };
    }

    const data = await response.json();
    if (!data.success) {
      return { value: null, count: 0 };
    }

    const assets = data.assets || [];
    if (assets.length === 0) {
      return { value: 0, count: 0 };
    }

    // Build descriptions dictionary
    const descriptions = {};
    for (const desc of (data.descriptions || [])) {
      const key = `${desc.classid}_${desc.instanceid || '0'}`;
      descriptions[key] = desc;
    }

    let totalValue = 0;
    let pricedItems = 0;
    const maxItems = Math.min(assets.length, 20);

    for (let i = 0; i < maxItems; i++) {
      const asset = assets[i];
      const key = `${asset.classid}_${asset.instanceid || '0'}`;
      const desc = descriptions[key];

      if (!desc) continue;
      if (!desc.marketable || !desc.market_hash_name) continue;

      const price = await getMarketPrice(desc.market_hash_name);
      if (price > 0) {
        totalValue += price;
        pricedItems++;
      }
    }

    if (pricedItems > 0) {
      const avgPrice = totalValue / pricedItems;
      const estimatedTotal = avgPrice * assets.length;
      return { value: estimatedTotal, count: pricedItems };
    }

    return { value: 0, count: 0 };
  } catch (e) {
    return { value: null, count: 0 };
  }
}

// Get user info batch
async function getUsersInfoBatch(apiKey, steamIds) {
  const results = {};

  for (let i = 0; i < steamIds.length; i += 100) {
    const batch = steamIds.slice(i, i + 100);
    const idsString = batch.join(',');

    await rateLimitWait();

    try {
      const url = `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${apiKey}&steamids=${idsString}`;
      const response = await fetch(url, { timeout: 10000 });

      if (response.status === 200) {
        const data = await response.json();
        if (data.response && data.response.players) {
          for (const player of data.response.players) {
            results[player.steamid] = {
              country: player.loccountrycode || '',
              visibility: player.communityvisibilitystate || 0,
              name: player.personaname || 'Unknown',
              profileUrl: player.profileurl || '',
            };
          }
        }
      }
    } catch (e) {
      // Ignore errors
    }
  }

  return results;
}

// Get friends list
async function getFriendsList(apiKey, steamId) {
  await rateLimitWait();

  try {
    const url = `https://api.steampowered.com/ISteamUser/GetFriendList/v1/?key=${apiKey}&steamid=${steamId}`;
    const response = await fetch(url, { timeout: 10000 });

    if (response.status === 200) {
      const data = await response.json();
      if (data.friendslist) {
        return data.friendslist.friends.map(f => f.steamid);
      }
    }
  } catch (e) {
    // Ignore errors
  }

  return [];
}

// Parser Job class
class ParserJob {
  constructor(jobId, config) {
    this.jobId = jobId;
    this.config = config;
    this.status = 'running';
    this.stats = {
      checked: 0,
      skippedCis: 0,
      skippedPrivate: 0,
      emptyInventory: 0,
      inventoryChecked: 0,
      foundValuable: 0,
      errors: 0,
      currentLevel: 0,
      queueSize: 0,
    };
    this.results = [];
    this.logs = [];
    this.visitedIds = new Set();
    this.paused = false;
  }

  log(message) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp.split('T')[1].split('.')[0]}] ${message}`;
    this.logs.push(logEntry);
    
    // Keep only last 500 logs
    if (this.logs.length > 500) {
      this.logs = this.logs.slice(-500);
    }

    // Save to database
    try {
      db.prepare(`
        INSERT INTO parser_logs (job_id, message, level, created_at)
        VALUES (?, ?, ?, ?)
      `).run(this.jobId, message, 'info', timestamp);
    } catch (e) {
      // Ignore DB errors
    }
  }

  saveResult(result) {
    this.results.push(result);
    
    try {
      db.prepare(`
        INSERT INTO parser_results (job_id, steam_id, inventory_value, items_count, country, profile_name, profile_url, found_at, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        this.jobId,
        result.steamId,
        result.inventoryValue,
        result.itemsCount,
        result.country,
        result.profileName,
        result.profileUrl,
        result.foundAt,
        new Date().toISOString()
      );
    } catch (e) {
      // Ignore DB errors
    }
  }

  markVisited(steamId) {
    this.visitedIds.add(steamId);
    
    try {
      db.prepare(`
        INSERT OR IGNORE INTO parser_visited (job_id, steam_id, created_at)
        VALUES (?, ?, ?)
      `).run(this.jobId, steamId, new Date().toISOString());
    } catch (e) {
      // Ignore DB errors
    }
  }

  updateStats() {
    try {
      db.prepare(`
        UPDATE parser_jobs SET stats = ?, updated_at = ? WHERE id = ?
      `).run(JSON.stringify(this.stats), new Date().toISOString(), this.jobId);
    } catch (e) {
      // Ignore DB errors
    }
  }

  shouldSkipUser(userInfo) {
    const country = userInfo.country || '';
    
    if (EXCLUDED_COUNTRIES.has(country)) {
      this.stats.skippedCis++;
      return true;
    }

    if (userInfo.visibility !== 3) {
      this.stats.skippedPrivate++;
      return true;
    }

    return false;
  }

  async run() {
    const { apiKey, startIds, minPrice, maxPrice, maxDepth, maxFriendsPerLevel } = this.config;

    this.log(`Запуск парсера: ${startIds.length} начальных ID, диапазон $${minPrice}-$${maxPrice}`);

    let currentLevel = startIds.filter(id => !this.visitedIds.has(id));

    for (let depth = 1; depth <= maxDepth; depth++) {
      if (this.status !== 'running') break;
      if (currentLevel.length === 0) break;

      this.stats.currentLevel = depth;
      this.log(`\n=== УРОВЕНЬ ${depth}: ${currentLevel.length} пользователей ===`);

      // Get user info for current level
      const usersInfo = await getUsersInfoBatch(apiKey, currentLevel);
      const nextLevel = [];

      for (let idx = 0; idx < currentLevel.length; idx++) {
        // Check if paused or stopped
        while (this.paused && this.status === 'running') {
          await new Promise(r => setTimeout(r, 1000));
        }
        if (this.status !== 'running') break;

        const steamId = currentLevel[idx];
        
        if (this.visitedIds.has(steamId)) continue;
        this.markVisited(steamId);
        this.stats.checked++;

        const userInfo = usersInfo[steamId] || {};

        // Progress log every 10 users
        if (idx % 10 === 0) {
          this.log(`Прогресс: ${idx}/${currentLevel.length} (Найдено: ${this.results.length})`);
          this.stats.queueSize = currentLevel.length - idx;
          this.updateStats();
        }

        // Skip if CIS or private
        if (this.shouldSkipUser(userInfo)) {
          continue;
        }

        // Check inventory
        const { value: inventoryValue, count: itemsCount } = await getInventoryValue(steamId);
        this.stats.inventoryChecked++;

        if (inventoryValue !== null && itemsCount > 0) {
          if (inventoryValue >= minPrice && inventoryValue <= maxPrice) {
            this.log(`★★★ НАЙДЕН #${this.results.length + 1}: ${steamId} - $${inventoryValue.toFixed(2)} ★★★`);
            this.stats.foundValuable++;

            const result = {
              steamId,
              inventoryValue,
              itemsCount,
              country: userInfo.country || '',
              profileName: userInfo.name || '',
              profileUrl: userInfo.profileUrl || '',
              foundAt: new Date().toISOString(),
            };
            this.saveResult(result);
          }
        } else if (inventoryValue === 0) {
          this.stats.emptyInventory++;
        }

        // Get friends for next level
        if (depth < maxDepth) {
          const friends = await getFriendsList(apiKey, steamId);
          if (friends.length > 0) {
            const newFriends = friends
              .filter(f => !this.visitedIds.has(f))
              .slice(0, maxFriendsPerLevel);
            nextLevel.push(...newFriends);
          }
        }
      }

      currentLevel = [...new Set(nextLevel)];
      this.log(`→ Следующий уровень: ${currentLevel.length} новых пользователей`);
    }

    this.status = 'completed';
    this.log(`\n=== ЗАВЕРШЕНО ===`);
    this.log(`Проверено: ${this.stats.checked}`);
    this.log(`Найдено: ${this.results.length}`);
    this.log(`Пропущено СНГ: ${this.stats.skippedCis}`);
    this.log(`Пропущено приватных: ${this.stats.skippedPrivate}`);

    // Update job in database
    try {
      db.prepare(`
        UPDATE parser_jobs SET status = ?, stats = ?, completed_at = ?, updated_at = ? WHERE id = ?
      `).run('completed', JSON.stringify(this.stats), new Date().toISOString(), new Date().toISOString(), this.jobId);
    } catch (e) {
      // Ignore DB errors
    }
  }

  pause() {
    this.paused = true;
    this.log('Парсер приостановлен');
  }

  resume() {
    this.paused = false;
    this.log('Парсер возобновлён');
  }

  stop() {
    this.status = 'stopped';
    this.log('Парсер остановлен');
    
    try {
      db.prepare(`
        UPDATE parser_jobs SET status = ?, updated_at = ? WHERE id = ?
      `).run('stopped', new Date().toISOString(), this.jobId);
    } catch (e) {
      // Ignore DB errors
    }
  }
}

// Active jobs storage
const activeJobs = new Map();

// API functions
function startParser(config) {
  const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Create job in database
  db.prepare(`
    INSERT INTO parser_jobs (id, status, config, stats, started_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(jobId, 'running', JSON.stringify(config), '{}', new Date().toISOString(), new Date().toISOString(), new Date().toISOString());

  const job = new ParserJob(jobId, config);
  activeJobs.set(jobId, job);

  // Start in background
  job.run().catch(e => {
    job.status = 'error';
    job.log(`Ошибка: ${e.message}`);
  });

  return { success: true, jobId };
}

function stopParser(jobId) {
  const job = activeJobs.get(jobId);
  if (job) {
    job.stop();
    activeJobs.delete(jobId);
    return { success: true };
  }
  return { success: false, error: 'Job not found' };
}

function pauseParser(jobId) {
  const job = activeJobs.get(jobId);
  if (job) {
    job.pause();
    return { success: true };
  }
  return { success: false, error: 'Job not found' };
}

function resumeParser(jobId) {
  const job = activeJobs.get(jobId);
  if (job) {
    job.resume();
    return { success: true };
  }
  return { success: false, error: 'Job not found' };
}

function getParserStatus(jobId) {
  const job = activeJobs.get(jobId);
  
  if (job) {
    return {
      job: {
        id: job.jobId,
        status: job.paused ? 'paused' : job.status,
        config: job.config,
        stats: job.stats,
        results: job.results,
        logs: job.logs.slice(-100),
      }
    };
  }

  // Try to get from database
  const dbJob = db.prepare('SELECT * FROM parser_jobs WHERE id = ?').get(jobId);
  if (dbJob) {
    const results = db.prepare('SELECT * FROM parser_results WHERE job_id = ? ORDER BY id DESC LIMIT 1000').all(jobId);
    const logs = db.prepare('SELECT message FROM parser_logs WHERE job_id = ? ORDER BY id DESC LIMIT 100').all(jobId);

    return {
      job: {
        id: dbJob.id,
        status: dbJob.status,
        config: JSON.parse(dbJob.config),
        stats: JSON.parse(dbJob.stats || '{}'),
        results: results.map(r => ({
          steamId: r.steam_id,
          inventoryValue: r.inventory_value,
          itemsCount: r.items_count,
          country: r.country,
          profileName: r.profile_name,
          profileUrl: r.profile_url,
          foundAt: r.found_at,
        })),
        logs: logs.map(l => l.message).reverse(),
        startedAt: dbJob.started_at,
        completedAt: dbJob.completed_at,
        error: dbJob.error,
      }
    };
  }

  return { job: null };
}

function getActiveJobs() {
  const jobs = [];
  
  for (const [id, job] of activeJobs) {
    jobs.push({
      id: job.jobId,
      status: job.paused ? 'paused' : job.status,
      config: job.config,
      stats: job.stats,
      resultsCount: job.results.length,
    });
  }

  return { jobs };
}

function getParserResults(jobId) {
  const results = db.prepare(`
    SELECT * FROM parser_results WHERE job_id = ? ORDER BY id DESC
  `).all(jobId);

  return {
    results: results.map(r => ({
      steamId: r.steam_id,
      inventoryValue: r.inventory_value,
      itemsCount: r.items_count,
      country: r.country,
      profileName: r.profile_name,
      profileUrl: r.profile_url,
      foundAt: r.found_at,
    })),
    total: results.length,
  };
}

function clearResults(jobId) {
  db.prepare('DELETE FROM parser_results WHERE job_id = ?').run(jobId);
  db.prepare('DELETE FROM parser_logs WHERE job_id = ?').run(jobId);
  db.prepare('DELETE FROM parser_visited WHERE job_id = ?').run(jobId);
  db.prepare('DELETE FROM parser_jobs WHERE id = ?').run(jobId);
  
  activeJobs.delete(jobId);
  
  return { success: true };
}

module.exports = {
  startParser,
  stopParser,
  pauseParser,
  resumeParser,
  getParserStatus,
  getActiveJobs,
  getParserResults,
  clearResults,
};
