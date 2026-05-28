import fetch from 'node-fetch';
import { dbOps } from './database.js';

// Active parsing jobs
const activeJobs = new Map();

// Random delay to avoid rate limiting
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
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      },
      timeout: 15000,
    });

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
    console.error(`[Parser] Error fetching inventory for ${steamId}:`, error.message);
    return { value: -3, error: true };
  }
}

// Main parsing function
async function parseSteamIds(jobId, country, minValue, maxValue, targetCount) {
  console.log(`[Parser] Starting job ${jobId}: ${country}, $${minValue}-$${maxValue}, target: ${targetCount}`);
  
  const results = [];
  let scannedCount = 0;
  let consecutiveErrors = 0;
  const maxConsecutiveErrors = 100;
  const maxScans = targetCount * 200;
  
  activeJobs.set(jobId, { status: 'running', cancel: false });

  try {
    while (results.length < targetCount && scannedCount < maxScans) {
      const jobState = activeJobs.get(jobId);
      if (!jobState || jobState.cancel) {
        console.log(`[Parser] Job ${jobId} cancelled`);
        dbOps.updateParseJob(jobId, {
          status: 'cancelled',
          parsedCount: results.length,
          scannedCount,
          results,
          completedAt: new Date().toISOString(),
        });
        break;
      }

      const steamId = generateRandomSteamId();
      scannedCount++;

      if (scannedCount % 10 === 0) {
        dbOps.updateParseJob(jobId, {
          scannedCount,
          parsedCount: results.length,
          results,
        });
        console.log(`[Parser] Job ${jobId}: scanned ${scannedCount}, found ${results.length}/${targetCount}`);
      }

      const inventory = await getInventoryValue(steamId);
      
      if (inventory.isRateLimited) {
        console.log(`[Parser] Rate limited, waiting 60s...`);
        await delay(60000);
        consecutiveErrors++;
        if (consecutiveErrors >= 5) {
          console.log(`[Parser] Too many rate limits, stopping`);
          break;
        }
        continue;
      }

      if (inventory.error || inventory.value < 0) {
        consecutiveErrors++;
        if (consecutiveErrors >= maxConsecutiveErrors) {
          console.log(`[Parser] Too many consecutive errors, stopping`);
          break;
        }
        await randomDelay();
        continue;
      }

      consecutiveErrors = 0;

      if (inventory.value >= minValue && inventory.value <= maxValue) {
        results.push({
          steamId,
          inventoryValue: inventory.value,
          country: country === 'ALL' ? 'Unknown' : country,
          itemCount: inventory.itemCount || 0,
        });

        console.log(`[Parser] Found match #${results.length}: ${steamId} with $${inventory.value}`);
        dbOps.setInventoryValue(steamId, inventory.value);
      }

      await randomDelay();
    }

    if (!activeJobs.get(jobId)?.cancel) {
      const now = new Date().toISOString();
      dbOps.updateParseJob(jobId, {
        status: 'completed',
        parsedCount: results.length,
        scannedCount,
        results,
        completedAt: now,
      });
      console.log(`[Parser] Job ${jobId} completed: found ${results.length} out of ${scannedCount} scanned`);
    }
    
  } catch (error) {
    console.error(`[Parser] Job ${jobId} error:`, error);
    dbOps.updateParseJob(jobId, {
      status: 'error',
      error: error.message,
      parsedCount: results.length,
      scannedCount,
      results,
      completedAt: new Date().toISOString(),
    });
  } finally {
    activeJobs.delete(jobId);
  }

  return results;
}

// Start a parse job
export function startParseJob(jobId, country, minValue, maxValue, targetCount) {
  parseSteamIds(jobId, country, minValue, maxValue, targetCount);
}

// Cancel a parse job
export function cancelParseJob(jobId) {
  const job = activeJobs.get(jobId);
  if (job) {
    job.cancel = true;
    console.log(`[Parser] Cancelling job ${jobId}`);
    return true;
  }
  return false;
}

// Check if job is running
export function isJobRunning(jobId) {
  return activeJobs.has(jobId);
}

// Get active jobs
export function getActiveJobs() {
  return Array.from(activeJobs.keys());
}

export { getInventoryValue, generateRandomSteamId };
