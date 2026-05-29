/**
 * Buff163 Price Fetcher for CS2 items
 * Based on: https://github.com/wasdejected/Getting-Buff163-Prices-With-API-Free
 * 
 * - Fetches marketplace IDs from GitHub (ModestSerhat/cs2-marketplace-ids)
 * - Queries Buff163 API for real-time prices
 * - Caches prices in JSON file to avoid repeated requests
 * - Converts CNY to USD
 */

const fs = require('fs');
const path = require('path');

const MARKETPLACE_IDS_URL = 'https://raw.githubusercontent.com/ModestSerhat/cs2-marketplace-ids/refs/heads/main/cs2_marketplaceids.json';
const CNY_TO_USD = 0.14;
const CACHE_FILE = path.join(__dirname, '..', 'data', 'buff163_prices_cache.json');
const IDS_CACHE_FILE = path.join(__dirname, '..', 'data', 'buff163_ids_cache.json');

// Cache TTL
const PRICE_CACHE_TTL = 60 * 60 * 1000; // 1 hour for prices
const IDS_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours for IDs

// Special finishes and phase tags for Doppler variants
const SPECIAL_TAGS = {
  'ruby': 3435175,
  'sapphire': 3549384,
  'emerald': 447129,
  'black pearl': 6009966,
  'phase1': 446972,
  'phase 1': 446972,
  'phase2': 446974,
  'phase 2': 446974,
  'phase3': 446975,
  'phase 3': 446975,
  'phase4': 446973,
  'phase 4': 446973,
};

// In-memory caches
let marketplaceIds = null;
let marketplaceIdsLoadedAt = 0;
let priceCache = {};
let priceCacheLoaded = false;

/**
 * Ensure data directory exists
 */
function ensureDataDir() {
  const dataDir = path.join(__dirname, '..', 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

/**
 * Load price cache from JSON file
 */
function loadPriceCache() {
  if (priceCacheLoaded) return;
  try {
    ensureDataDir();
    if (fs.existsSync(CACHE_FILE)) {
      const data = fs.readFileSync(CACHE_FILE, 'utf8');
      priceCache = JSON.parse(data);
      console.log(`[Buff163] Loaded ${Object.keys(priceCache).length} cached prices`);
    }
  } catch (e) {
    console.error('[Buff163] Failed to load price cache:', e.message);
    priceCache = {};
  }
  priceCacheLoaded = true;
}

/**
 * Save price cache to JSON file
 */
function savePriceCache() {
  try {
    ensureDataDir();
    fs.writeFileSync(CACHE_FILE, JSON.stringify(priceCache, null, 2));
  } catch (e) {
    console.error('[Buff163] Failed to save price cache:', e.message);
  }
}

/**
 * Get cached price if still valid
 */
function getCachedPrice(itemName) {
  loadPriceCache();
  const cached = priceCache[itemName.toLowerCase()];
  if (cached && Date.now() - cached.timestamp < PRICE_CACHE_TTL) {
    return cached;
  }
  return null;
}

/**
 * Set price in cache
 */
function setCachedPrice(itemName, price, goodsId) {
  loadPriceCache();
  priceCache[itemName.toLowerCase()] = {
    price,
    goodsId,
    timestamp: Date.now(),
    itemName: itemName,
  };
  // Save cache after each update (could be optimized with debounce)
  savePriceCache();
}

/**
 * Load marketplace IDs from GitHub (with caching)
 */
async function loadMarketplaceIds() {
  // Check in-memory cache
  if (marketplaceIds && Date.now() - marketplaceIdsLoadedAt < IDS_CACHE_TTL) {
    return marketplaceIds;
  }

  // Check file cache
  try {
    ensureDataDir();
    if (fs.existsSync(IDS_CACHE_FILE)) {
      const stat = fs.statSync(IDS_CACHE_FILE);
      if (Date.now() - stat.mtimeMs < IDS_CACHE_TTL) {
        const data = fs.readFileSync(IDS_CACHE_FILE, 'utf8');
        marketplaceIds = JSON.parse(data);
        marketplaceIdsLoadedAt = Date.now();
        console.log(`[Buff163] Loaded ${Object.keys(marketplaceIds).length} marketplace IDs from cache`);
        return marketplaceIds;
      }
    }
  } catch (e) {
    console.error('[Buff163] Failed to load IDs cache:', e.message);
  }

  // Fetch from GitHub
  console.log('[Buff163] Fetching marketplace IDs from GitHub...');
  try {
    const res = await fetch(MARKETPLACE_IDS_URL, {
      headers: { 'User-Agent': 'SukaCombine-Buff163-Fetcher/1.0' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    marketplaceIds = data.items || data;
    marketplaceIdsLoadedAt = Date.now();

    // Save to file cache
    try {
      fs.writeFileSync(IDS_CACHE_FILE, JSON.stringify(marketplaceIds, null, 2));
      console.log(`[Buff163] Saved ${Object.keys(marketplaceIds).length} marketplace IDs to cache`);
    } catch (e) {
      console.error('[Buff163] Failed to save IDs cache:', e.message);
    }

    return marketplaceIds;
  } catch (e) {
    console.error('[Buff163] Failed to fetch marketplace IDs:', e.message);
    // Return cached data if available (even if expired)
    if (marketplaceIds) return marketplaceIds;
    throw e;
  }
}

/**
 * Normalize item name for matching
 */
function normalizeName(name) {
  return name
    .replace('★', '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Extract special tag ID from item name (Doppler phases, Ruby, etc.)
 */
function extractTagId(itemName) {
  const lower = itemName.toLowerCase();
  
  // Check for phases
  const phaseMatch = lower.match(/phase\s*(\d+)/);
  if (phaseMatch) {
    return SPECIAL_TAGS[`phase${phaseMatch[1]}`] || SPECIAL_TAGS[`phase ${phaseMatch[1]}`] || null;
  }
  
  // Check for special finishes
  for (const key of ['ruby', 'sapphire', 'emerald', 'black pearl']) {
    if (lower.includes(key)) return SPECIAL_TAGS[key];
  }
  
  return null;
}

/**
 * Find goods_id for an item name
 */
function findGoodsId(itemName, idsMap) {
  const norm = normalizeName(itemName);
  
  // Exact match first
  for (const [k, v] of Object.entries(idsMap)) {
    if (normalizeName(k) === norm && v.buff163_goods_id) {
      return { goodsId: v.buff163_goods_id, matchedKey: k };
    }
  }
  
  // Try without special tags (for Doppler etc)
  let baseName = itemName;
  for (const tag of Object.keys(SPECIAL_TAGS)) {
    const re = new RegExp(`[-–]?\\s*${tag}\\s*$`, 'i');
    baseName = baseName.replace(re, '').trim();
  }
  // Also remove " - " at the end
  baseName = baseName.replace(/\s*[-–]\s*$/, '').trim();
  
  if (baseName !== itemName) {
    const baseNorm = normalizeName(baseName);
    for (const [k, v] of Object.entries(idsMap)) {
      if (normalizeName(k) === baseNorm && v.buff163_goods_id) {
        return { goodsId: v.buff163_goods_id, matchedKey: k };
      }
    }
  }
  
  // Partial match - try to find by base weapon name
  const normParts = norm.split('|').map(p => p.trim());
  if (normParts.length >= 2) {
    for (const [k, v] of Object.entries(idsMap)) {
      const kNorm = normalizeName(k);
      if (kNorm.includes(normParts[0]) && kNorm.includes(normParts[1]) && v.buff163_goods_id) {
        return { goodsId: v.buff163_goods_id, matchedKey: k };
      }
    }
  }
  
  return { goodsId: null, matchedKey: null };
}

/**
 * Fetch price from Buff163 API
 */
async function fetchBuff163Price(goodsId, tagId = null) {
  let sellUrl = `https://buff.163.com/api/market/goods/sell_order?game=csgo&goods_id=${goodsId}&page_num=1`;
  if (tagId) {
    sellUrl += `&tag_ids=${tagId}`;
  }

  try {
    const res = await fetch(sellUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://buff.163.com/market/csgo',
      },
      timeout: 15000,
    });

    if (!res.ok) {
      console.error(`[Buff163] API error for goods_id ${goodsId}: HTTP ${res.status}`);
      return null;
    }

    const data = await res.json();
    const items = data?.data?.items || [];
    
    if (items.length === 0) {
      return null;
    }

    // Get lowest sell price and convert to USD
    const prices = items
      .filter(item => item.price)
      .map(item => parseFloat(item.price) * CNY_TO_USD);
    
    if (prices.length === 0) return null;
    
    const lowestPrice = Math.min(...prices);
    return Math.round(lowestPrice * 100) / 100;
  } catch (e) {
    console.error(`[Buff163] Failed to fetch price for goods_id ${goodsId}:`, e.message);
    return null;
  }
}

/**
 * Get price for a single item (with caching)
 */
async function getItemPrice(itemName) {
  // Check cache first
  const cached = getCachedPrice(itemName);
  if (cached !== null) {
    console.log(`[Buff163] Cache hit for "${itemName}": $${cached.price}`);
    return {
      itemName,
      price: cached.price,
      goodsId: cached.goodsId,
      cached: true,
    };
  }

  // Load marketplace IDs
  let idsMap;
  try {
    idsMap = await loadMarketplaceIds();
  } catch (e) {
    return {
      itemName,
      price: null,
      goodsId: null,
      error: 'Failed to load marketplace IDs',
    };
  }

  // Find goods_id
  const { goodsId, matchedKey } = findGoodsId(itemName, idsMap);
  
  if (!goodsId) {
    console.log(`[Buff163] No goods_id found for "${itemName}"`);
    // Cache as null to avoid repeated lookups
    setCachedPrice(itemName, null, null);
    return {
      itemName,
      price: null,
      goodsId: null,
      error: 'Item not found on Buff163',
    };
  }

  console.log(`[Buff163] Found goods_id ${goodsId} for "${itemName}" (matched: "${matchedKey}")`);

  // Extract tag for special variants
  const tagId = extractTagId(itemName);
  if (tagId) {
    console.log(`[Buff163] Applied tag_id ${tagId} for "${itemName}"`);
  }

  // Fetch price from Buff163
  const price = await fetchBuff163Price(goodsId, tagId);
  
  // Cache the result
  setCachedPrice(itemName, price, goodsId);
  
  if (price !== null) {
    console.log(`[Buff163] Price for "${itemName}": $${price}`);
  } else {
    console.log(`[Buff163] No price found for "${itemName}"`);
  }

  return {
    itemName,
    price,
    goodsId,
    matchedKey,
    tagId,
    cached: false,
  };
}

/**
 * Get prices for multiple items (with rate limiting)
 */
async function getItemPrices(itemNames, delayMs = 500) {
  const results = {};
  let cached = 0;
  let fetched = 0;
  let notFound = 0;

  for (const name of itemNames) {
    const result = await getItemPrice(name);
    results[name] = result.price;
    
    if (result.cached) {
      cached++;
    } else if (result.price !== null) {
      fetched++;
      // Rate limit only for actual API calls
      await new Promise(r => setTimeout(r, delayMs));
    } else {
      notFound++;
    }
  }

  console.log(`[Buff163] Batch complete: ${cached} cached, ${fetched} fetched, ${notFound} not found`);
  
  return results;
}

/**
 * Calculate total inventory value
 */
async function getInventoryValue(items) {
  // Count items by name
  const itemCounts = {};
  for (const item of items) {
    const name = item.market_hash_name || item.name || '';
    if (name) {
      itemCounts[name] = (itemCounts[name] || 0) + 1;
    }
  }

  const uniqueNames = Object.keys(itemCounts);
  console.log(`[Buff163] Evaluating ${items.length} items (${uniqueNames.length} unique)`);

  // Get prices
  const prices = await getItemPrices(uniqueNames);

  // Calculate totals
  let totalValue = 0;
  let pricedItems = 0;
  let unpricedItems = 0;
  const itemDetails = [];

  for (const name of uniqueNames) {
    const count = itemCounts[name];
    const price = prices[name];
    
    if (price !== null && price > 0) {
      totalValue += price * count;
      pricedItems += count;
    } else {
      unpricedItems += count;
    }

    itemDetails.push({
      name,
      count,
      price,
      total: price ? price * count : null,
    });
  }

  // Sort by price descending
  itemDetails.sort((a, b) => (b.price || 0) - (a.price || 0));

  return {
    totalValue: Math.round(totalValue * 100) / 100,
    itemCount: items.length,
    pricedItems,
    unpricedItems,
    items: itemDetails,
    source: 'buff163',
  };
}

/**
 * Get Steam inventory for a user
 */
async function getSteamInventory(steamId) {
  const url = `https://steamcommunity.com/inventory/${steamId}/730/2?l=english&count=5000`;
  
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      },
      timeout: 30000,
    });

    if (res.status === 403) {
      return { error: 'Inventory is private', items: [] };
    }
    
    if (!res.ok) {
      return { error: `Steam API error: HTTP ${res.status}`, items: [] };
    }

    const data = await res.json();
    
    if (!data.descriptions) {
      return { error: 'Empty inventory or invalid response', items: [] };
    }

    // Map asset IDs to descriptions
    const descMap = {};
    for (const desc of data.descriptions) {
      const key = `${desc.classid}_${desc.instanceid}`;
      descMap[key] = desc;
    }

    const items = [];
    for (const asset of (data.assets || [])) {
      const key = `${asset.classid}_${asset.instanceid}`;
      const desc = descMap[key];
      if (desc && desc.marketable) {
        items.push({
          name: desc.market_hash_name || desc.name,
          market_hash_name: desc.market_hash_name,
          icon_url: desc.icon_url,
          tradable: desc.tradable === 1,
        });
      }
    }

    return { items, total: data.total_inventory_count || items.length };
  } catch (e) {
    console.error(`[Buff163] Failed to fetch Steam inventory for ${steamId}:`, e.message);
    return { error: e.message, items: [] };
  }
}

/**
 * Full inventory evaluation: fetch Steam inventory + get Buff163 prices
 */
async function evaluateInventory(steamId) {
  console.log(`[Buff163] Starting inventory evaluation for ${steamId}`);
  
  // Get Steam inventory
  const inventory = await getSteamInventory(steamId);
  
  if (inventory.error) {
    return {
      totalValue: 0,
      itemCount: 0,
      pricedItems: 0,
      unpricedItems: 0,
      items: [],
      error: inventory.error,
      source: 'buff163',
    };
  }

  if (inventory.items.length === 0) {
    return {
      totalValue: 0,
      itemCount: 0,
      pricedItems: 0,
      unpricedItems: 0,
      items: [],
      source: 'buff163',
    };
  }

  // Get Buff163 prices
  const result = await getInventoryValue(inventory.items);
  
  console.log(`[Buff163] Evaluation complete for ${steamId}: $${result.totalValue} (${result.pricedItems}/${result.itemCount} priced)`);
  
  return result;
}

/**
 * Clear expired cache entries
 */
function cleanupCache() {
  loadPriceCache();
  const now = Date.now();
  let removed = 0;
  
  for (const key of Object.keys(priceCache)) {
    if (now - priceCache[key].timestamp > PRICE_CACHE_TTL * 24) { // Keep for 24 hours
      delete priceCache[key];
      removed++;
    }
  }
  
  if (removed > 0) {
    savePriceCache();
    console.log(`[Buff163] Cleaned up ${removed} expired cache entries`);
  }
}

/**
 * Get cache statistics
 */
function getCacheStats() {
  loadPriceCache();
  const now = Date.now();
  let valid = 0;
  let expired = 0;
  let withPrice = 0;
  
  for (const entry of Object.values(priceCache)) {
    if (now - entry.timestamp < PRICE_CACHE_TTL) {
      valid++;
    } else {
      expired++;
    }
    if (entry.price !== null) {
      withPrice++;
    }
  }
  
  return {
    total: Object.keys(priceCache).length,
    valid,
    expired,
    withPrice,
    cacheFile: CACHE_FILE,
  };
}

module.exports = {
  getItemPrice,
  getItemPrices,
  getInventoryValue,
  getSteamInventory,
  evaluateInventory,
  loadMarketplaceIds,
  cleanupCache,
  getCacheStats,
  CACHE_FILE,
};
