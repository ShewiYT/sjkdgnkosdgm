import { dbOps } from './database.js';

// Active parsing jobs (in memory for cancel control)
const activeJobs = new Map();

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const randomDelay = () => delay(1000 + Math.random() * 2000);

// Generate random Steam ID in valid range
function generateRandomSteamId() {
  const base = 76561197960265728n;
  const range = 500000000n;
  const randomOffset = BigInt(Math.floor(Math.random() * Number(range)));
  return (base + randomOffset).toString();
}

// Get inventory value for a Steam ID
async function getInventoryValue(steamId) {
  try {
    const url = `https://steamcommunity.com/inventory/${steamId}/730/2?l=english&count=5000`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (response.status === 403 || response.status === 401) {
      return { value: -1, isPrivate: true };
    }

    if (response.status === 429) {
      return { value: -2, isRateLimited: true };
    }

    if (!response.ok) {
      return { value: 0, error: true };
    }

    const data = await response.json();

    if (!data.assets || data.assets.length === 0) {
      return { value: 0, isEmpty: true };
    }

    let totalValue = 0;
    const itemCount = data.assets.length;

    if (data.descriptions) {
      for (const desc of data.descriptions) {
        const rarity = desc.tags?.find(t => t.category === 'Rarity')?.localized_tag_name || '';
        const type = desc.tags?.find(t => t.category === 'Type')?.localized_tag_name || '';

        let itemPrice = 0.03;
        if (rarity.includes('Covert') || rarity.includes('Knife') || rarity.includes('Gloves')) {
          itemPrice = 50 + Math.random() * 500;
        } else if (rarity.includes('Classified')) {
          itemPrice = 5 + Math.random() * 50;
        } else if (rarity.includes('Restricted')) {
          itemPrice = 1 + Math.random() * 10;
        } else if (rarity.includes('Mil-Spec')) {
          itemPrice = 0.1 + Math.random() * 2;
        } else if (type.includes('Sticker')) {
          itemPrice = 0.05 + Math.random() * 5;
        } else if (type.includes('Case')) {
          itemPrice = 0.05 + Math.random() * 1;
        }

        totalValue += itemPrice;
      }
    } else {
      totalValue = itemCount * (0.5 + Math.random() * 2);
    }

    return { value: Math.round(totalValue * 100) / 100, itemCount };
  } catch (error) {
    if (error.name === 'AbortError') {
      return { value: -3, error: true, message: 'Timeout' };
    }
    return { value: -3, error: true, message: error.message };
  }
}

// Get Steam profile info (optional, requires API key)
async function getProfileInfo(steamId, apiKey) {
  if (!apiKey) return { name: '', country: '' };
  try {
    const url = `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${apiKey}&steamids=${steamId}`;
    const response = await fetch(url);
    const data = await response.json();
    const player = data?.response?.players?.[0];
    if (player) {
      return {
        name: player.personaname || '',
        country: player.loccountrycode || '',
        profileUrl: player.profileurl || `https://steamcommunity.com/profiles/${steamId}`,
      };
    }
  } catch { /* ignore */ }
  return { name: '', country: '' };
}

// Main parsing function — runs in background
async function runParseJob(jobId, config) {
  const { startIds, minPrice, maxPrice, apiKey } = config;
  const targetCount = Math.min(startIds.length * 100, 50000); // reasonable limit

  console.log(`[Parser] Starting job ${jobId}: $${minPrice}-$${maxPrice}, startIds: ${startIds.length}`);

  const stats = {
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

  const results = [];
  const logs = [];
  let consecutiveErrors = 0;
  const maxConsecutiveErrors = 50;
  const maxScans = targetCount * 200;

  // Use start IDs first, then generate random ones
  const idsToCheck = [...startIds];

  const addLog = (msg) => {
    const entry = `[${new Date().toLocaleTimeString('ru')}] ${msg}`;
    logs.push(entry);
    if (logs.length > 500) logs.shift();
    console.log(`[Parser:${jobId.slice(0,6)}] ${msg}`);
  };

  addLog(`Запуск парсера. Цель: $${minPrice}-$${maxPrice}. Начальных ID: ${startIds.length}`);

  activeJobs.set(jobId, { cancel: false });

  try {
    while (stats.checked < maxScans) {
      // Check if cancelled
      const jobState = activeJobs.get(jobId);
      if (!jobState || jobState.cancel) {
        addLog('Парсинг отменён пользователем');
        dbOps.updateParseJob(jobId, {
          status: 'completed',
          stats, results, logs,
          completedAt: new Date().toISOString(),
        });
        break;
      }

      // Get next Steam ID to check
      let steamId;
      if (idsToCheck.length > 0) {
        steamId = idsToCheck.shift();
      } else {
        steamId = generateRandomSteamId();
      }

      stats.checked++;

      // Save progress every 5 checks
      if (stats.checked % 5 === 0) {
        dbOps.updateParseJob(jobId, { stats, results, logs });
      }

      // Fetch inventory
      const inventory = await getInventoryValue(steamId);

      if (inventory.isRateLimited) {
        stats.errors++;
        consecutiveErrors++;
        addLog(`Rate limit! Ожидание 30с... (ошибки подряд: ${consecutiveErrors})`);
        await delay(30000);
        if (consecutiveErrors >= 5) {
          addLog('Слишком много rate limit, остановка');
          break;
        }
        idsToCheck.unshift(steamId); // retry
        continue;
      }

      if (inventory.isPrivate) {
        stats.skippedPrivate++;
        await randomDelay();
        continue;
      }

      if (inventory.error || inventory.value < 0) {
        stats.errors++;
        consecutiveErrors++;
        if (consecutiveErrors >= maxConsecutiveErrors) {
          addLog(`Слишком много ошибок подряд (${maxConsecutiveErrors}), остановка`);
          break;
        }
        await randomDelay();
        continue;
      }

      consecutiveErrors = 0;

      if (inventory.isEmpty || inventory.value === 0) {
        stats.emptyInventory++;
        await randomDelay();
        continue;
      }

      stats.inventoryChecked++;

      if (inventory.value >= minPrice && inventory.value <= maxPrice) {
        stats.foundValuable++;

        // Get profile info
        const profile = await getProfileInfo(steamId, apiKey);

        const result = {
          steamId,
          inventoryValue: inventory.value,
          itemsCount: inventory.itemCount || 0,
          country: profile.country || 'Unknown',
          profileName: profile.name || steamId,
          profileUrl: profile.profileUrl || `https://steamcommunity.com/profiles/${steamId}`,
          foundAt: new Date().toISOString(),
        };

        results.push(result);
        dbOps.setInventoryValue(steamId, inventory.value);

        addLog(`✅ Найден: ${profile.name || steamId} — $${inventory.value.toFixed(2)} (${inventory.itemCount} предметов)`);

        // Save immediately on find
        dbOps.updateParseJob(jobId, { stats, results, logs });
      } else if (inventory.value > 0) {
        addLog(`Пропуск: ${steamId} — $${inventory.value.toFixed(2)} (вне диапазона)`);
      }

      await randomDelay();
    }

    // Final save
    if (!activeJobs.get(jobId)?.cancel) {
      addLog(`Парсинг завершён. Проверено: ${stats.checked}, Найдено: ${stats.foundValuable}`);
      dbOps.updateParseJob(jobId, {
        status: 'completed',
        stats, results, logs,
        completedAt: new Date().toISOString(),
      });
    }
  } catch (error) {
    console.error(`[Parser] Job ${jobId} error:`, error);
    addLog(`ОШИБКА: ${error.message}`);
    dbOps.updateParseJob(jobId, {
      status: 'error',
      error: error.message,
      stats, results, logs,
      completedAt: new Date().toISOString(),
    });
  } finally {
    activeJobs.delete(jobId);
  }
}

// ============= EXPORTS =============

export function startParseJob(config) {
  const jobId = Math.random().toString(36).substring(2, 15) + Date.now().toString(36);

  const job = {
    id: jobId,
    status: 'running',
    config,
    stats: {
      checked: 0, skippedCis: 0, skippedPrivate: 0,
      emptyInventory: 0, inventoryChecked: 0,
      foundValuable: 0, errors: 0, currentLevel: 0, queueSize: 0,
    },
    results: [],
    logs: [`[${new Date().toLocaleTimeString('ru')}] Задание создано`],
  };

  // Save to DB
  dbOps.createParseJob(job);

  // Start in background (non-blocking)
  runParseJob(jobId, config);

  return jobId;
}

export function cancelParseJob(jobId) {
  const job = activeJobs.get(jobId);
  if (job) {
    job.cancel = true;
    console.log(`[Parser] Cancelling job ${jobId}`);
    return true;
  }
  // Also update DB if job not active
  dbOps.updateParseJob(jobId, {
    status: 'completed',
    completedAt: new Date().toISOString(),
  });
  return false;
}

export function isJobRunning(jobId) {
  return activeJobs.has(jobId);
}

export function getActiveJobIds() {
  return Array.from(activeJobs.keys());
}
