/**
 * Loot.Farm Pricing Module
 * 
 * Downloads and caches price JSON files from loot.farm
 * Uses cached data to evaluate Steam inventories
 * 
 * Price sources:
 * - CS2:  https://loot.farm/fullprice.json
 * - Dota: https://loot.farm/fullpriceDOTA.json
 * - TF2:  https://loot.farm/fullpriceTF2.json
 * - RUST: https://loot.farm/fullpriceRUST.json
 */

const fs = require('fs');
const path = require('path');

// Cache directory
const CACHE_DIR = path.join(__dirname, '..', 'data', 'lootfarm-cache');

// Price sources
const PRICE_SOURCES = {
  cs2: { url: 'https://loot.farm/fullprice.json', appId: 730 },
  dota: { url: 'https://loot.farm/fullpriceDOTA.json', appId: 570 },
  tf2: { url: 'https://loot.farm/fullpriceTF2.json', appId: 440 },
  rust: { url: 'https://loot.farm/fullpriceRUST.json', appId: 252490 },
};

// In-memory price cache
const priceCache = {
  cs2: new Map(),
  dota: new Map(),
  tf2: new Map(),
  rust: new Map(),
};

// Cache metadata
const cacheMetadata = {
  cs2: { lastUpdate: 0, itemCount: 0 },
  dota: { lastUpdate: 0, itemCount: 0 },
  tf2: { lastUpdate: 0, itemCount: 0 },
  rust: { lastUpdate: 0, itemCount: 0 },
};

// Cache TTL: 1 hour
const CACHE_TTL = 60 * 60 * 1000;

/**
 * Ensure cache directory exists
 */
function ensureCacheDir() {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
}

/**
 * Get cache file path for a game
 */
function getCacheFilePath(game) {
  return path.join(CACHE_DIR, `${game}-prices.json`);
}

/**
 * Load prices from disk cache
 */
function loadFromDisk(game) {
  try {
    const filePath = getCacheFilePath(game);
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const cache = priceCache[game];
      cache.clear();
      
      // Loot.farm format: array of items with name and price
      // Price is in cents, we convert to dollars
      if (Array.isArray(data)) {
        for (const item of data) {
          if (item.name && typeof item.price === 'number') {
            cache.set(item.name, item.price / 100); // cents to dollars
          }
        }
      } else if (typeof data === 'object') {
        // Alternative format: object with item names as keys
        for (const [name, priceData] of Object.entries(data)) {
          const price = typeof priceData === 'number' ? priceData : priceData?.price;
          if (typeof price === 'number') {
            cache.set(name, price / 100);
          }
        }
      }
      
      const stats = fs.statSync(filePath);
      cacheMetadata[game] = {
        lastUpdate: stats.mtimeMs,
        itemCount: cache.size,
      };
      
      console.log(`[LootFarm] Loaded ${cache.size} ${game.toUpperCase()} prices from disk cache`);
      return true;
    }
  } catch (err) {
    console.error(`[LootFarm] Error loading ${game} cache from disk:`, err.message);
  }
  return false;
}

/**
 * Save prices to disk cache
 */
function saveToDisk(game, data) {
  try {
    ensureCacheDir();
    const filePath = getCacheFilePath(game);
    fs.writeFileSync(filePath, JSON.stringify(data));
    console.log(`[LootFarm] Saved ${game.toUpperCase()} prices to disk cache`);
  } catch (err) {
    console.error(`[LootFarm] Error saving ${game} cache to disk:`, err.message);
  }
}

/**
 * Download prices from loot.farm
 */
async function downloadPrices(game) {
  const source = PRICE_SOURCES[game];
  if (!source) {
    throw new Error(`Unknown game: ${game}`);
  }

  console.log(`[LootFarm] Downloading ${game.toUpperCase()} prices from ${source.url}...`);
  
  const response = await fetch(source.url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'application/json',
    },
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const data = await response.json();
  
  // Save raw data to disk
  saveToDisk(game, data);
  
  // Parse into memory cache
  const cache = priceCache[game];
  cache.clear();
  
  if (Array.isArray(data)) {
    for (const item of data) {
      if (item.name && typeof item.price === 'number') {
        cache.set(item.name, item.price / 100);
      }
    }
  } else if (typeof data === 'object') {
    for (const [name, priceData] of Object.entries(data)) {
      const price = typeof priceData === 'number' ? priceData : priceData?.price;
      if (typeof price === 'number') {
        cache.set(name, price / 100);
      }
    }
  }

  cacheMetadata[game] = {
    lastUpdate: Date.now(),
    itemCount: cache.size,
  };

  console.log(`[LootFarm] Downloaded ${cache.size} ${game.toUpperCase()} prices`);
  return cache.size;
}

/**
 * Ensure prices are loaded (from disk or download)
 */
async function ensurePrices(game) {
  const metadata = cacheMetadata[game];
  const cache = priceCache[game];
  
  // If cache is fresh and has items, use it
  if (cache.size > 0 && Date.now() - metadata.lastUpdate < CACHE_TTL) {
    return;
  }
  
  // Try loading from disk first
  if (loadFromDisk(game)) {
    // Check if disk cache is still fresh
    if (Date.now() - cacheMetadata[game].lastUpdate < CACHE_TTL) {
      return;
    }
  }
  
  // Download fresh prices
  try {
    await downloadPrices(game);
  } catch (err) {
    console.error(`[LootFarm] Failed to download ${game} prices:`, err.message);
    // If we have any cache (even stale), use it
    if (cache.size === 0) {
      loadFromDisk(game); // Try disk one more time
    }
  }
}

/**
 * Get price for an item
 */
function getPrice(game, itemName) {
  const cache = priceCache[game];
  return cache.get(itemName) || null;
}

/**
 * Get Steam inventory and evaluate with cached prices
 */
async function evaluateInventory(steamId, game = 'cs2') {
  // Ensure prices are loaded
  await ensurePrices(game);
  
  const source = PRICE_SOURCES[game];
  if (!source) {
    return { error: `Unknown game: ${game}`, totalValue: 0, itemCount: 0, pricedItems: 0, unpricedItems: 0, items: [] };
  }

  const cache = priceCache[game];
  if (cache.size === 0) {
    return { error: 'Цены не загружены', totalValue: 0, itemCount: 0, pricedItems: 0, unpricedItems: 0, items: [] };
  }

  // Fetch inventory from Steam
  const inventoryUrl = `https://steamcommunity.com/inventory/${steamId}/${source.appId}/2?l=english&count=5000`;
  
  try {
    const response = await fetch(inventoryUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      if (response.status === 403) {
        return { error: 'Инвентарь приватный', totalValue: 0, itemCount: 0, pricedItems: 0, unpricedItems: 0, items: [] };
      }
      return { error: `Steam HTTP ${response.status}`, totalValue: 0, itemCount: 0, pricedItems: 0, unpricedItems: 0, items: [] };
    }

    const data = await response.json();
    
    if (!data.success) {
      return { error: 'Steam вернул ошибку', totalValue: 0, itemCount: 0, pricedItems: 0, unpricedItems: 0, items: [] };
    }

    const assets = data.assets || [];
    const descriptions = data.descriptions || [];

    // Create description map
    const descMap = new Map();
    for (const desc of descriptions) {
      const key = `${desc.classid}_${desc.instanceid}`;
      descMap.set(key, desc);
    }

    // Count items and calculate value
    const itemCounts = new Map(); // name -> count
    
    for (const asset of assets) {
      const key = `${asset.classid}_${asset.instanceid}`;
      const desc = descMap.get(key);
      if (desc && desc.market_hash_name) {
        const name = desc.market_hash_name;
        const count = parseInt(asset.amount) || 1;
        itemCounts.set(name, (itemCounts.get(name) || 0) + count);
      }
    }

    let totalValue = 0;
    let pricedItems = 0;
    let unpricedItems = 0;
    const items = [];

    for (const [name, count] of itemCounts) {
      const price = getPrice(game, name);
      if (price !== null && price > 0) {
        totalValue += price * count;
        pricedItems += count;
        items.push({ name, price: price * count, count });
      } else {
        unpricedItems += count;
        items.push({ name, price: null, count });
      }
    }

    // Sort by price descending
    items.sort((a, b) => (b.price || 0) - (a.price || 0));

    return {
      totalValue: Math.round(totalValue * 100) / 100,
      itemCount: pricedItems + unpricedItems,
      pricedItems,
      unpricedItems,
      items: items.slice(0, 100), // Top 100 items
      source: 'Loot.Farm',
      cacheAge: Date.now() - cacheMetadata[game].lastUpdate,
    };

  } catch (err) {
    console.error(`[LootFarm] Error fetching inventory for ${steamId}:`, err.message);
    return { error: err.message || 'Ошибка загрузки', totalValue: 0, itemCount: 0, pricedItems: 0, unpricedItems: 0, items: [] };
  }
}

/**
 * Get cache status
 */
function getCacheStatus() {
  return {
    cs2: { ...cacheMetadata.cs2, itemCount: priceCache.cs2.size },
    dota: { ...cacheMetadata.dota, itemCount: priceCache.dota.size },
    tf2: { ...cacheMetadata.tf2, itemCount: priceCache.tf2.size },
    rust: { ...cacheMetadata.rust, itemCount: priceCache.rust.size },
  };
}

/**
 * Force refresh prices for a game
 */
async function refreshPrices(game) {
  if (game === 'all') {
    const results = {};
    for (const g of Object.keys(PRICE_SOURCES)) {
      try {
        results[g] = await downloadPrices(g);
      } catch (err) {
        results[g] = { error: err.message };
      }
    }
    return results;
  }
  return await downloadPrices(game);
}

/**
 * Initialize - load all caches from disk
 */
function initialize() {
  ensureCacheDir();
  for (const game of Object.keys(PRICE_SOURCES)) {
    loadFromDisk(game);
  }
  console.log('[LootFarm] Pricing module initialized');
}

// Auto-initialize
initialize();

module.exports = {
  evaluateInventory,
  ensurePrices,
  getPrice,
  getCacheStatus,
  refreshPrices,
  PRICE_SOURCES,
};
