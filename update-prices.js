#!/usr/bin/env node
// ============================================================
// CS2 Price Updater — run this to generate data/cs2_prices.json
// ============================================================
// Run from ANY computer (home PC, not blocked by Cloudflare):
//   node update-prices.js
//
// Then upload data/cs2_prices.json to your server.
// Or run it on the server via cron if the server IP is not blocked.
// ============================================================

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DATA_DIR = join(__dirname, 'data');
const OUT_FILE = join(DATA_DIR, 'cs2_prices.json');

if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json',
};

console.log('🔄 CS2 Price Updater');
console.log('');

// Try multiple sources
const sources = [
  {
    name: 'CSGOTrader (prices_v6)',
    url: 'https://prices.csgotrader.app/latest/prices_v6.json',
    parse(data) {
      const prices = {};
      for (const [name, s] of Object.entries(data)) {
        let price = 0;
        try {
          if (s?.steam?.last_24h) price = parseFloat(s.steam.last_24h);
          else if (s?.steam?.last_7d) price = parseFloat(s.steam.last_7d);
          else if (s?.steam?.last_30d) price = parseFloat(s.steam.last_30d);
          else if (s?.buff163?.starting_at?.price) price = parseFloat(s.buff163.starting_at.price);
        } catch {}
        if (price > 0 && !isNaN(price)) prices[name] = parseFloat(price.toFixed(2));
      }
      return prices;
    },
  },
  {
    name: 'CSGOBackpack',
    url: 'http://csgobackpack.net/api/GetItemsList/v2/?no_details=true&currency=USD',
    parse(data) {
      const prices = {};
      const items = data.items_list || data;
      for (const [name, info] of Object.entries(items)) {
        let price = 0;
        try {
          const p = info.price || info;
          if (p?.['24_hours']?.average) price = parseFloat(p['24_hours'].average);
          else if (p?.['7_days']?.average) price = parseFloat(p['7_days'].average);
          else if (p?.['30_days']?.average) price = parseFloat(p['30_days'].average);
        } catch {}
        if (price > 0 && !isNaN(price)) prices[name] = parseFloat(price.toFixed(2));
      }
      return prices;
    },
  },
];

for (const source of sources) {
  try {
    console.log(`📡 Trying: ${source.name}...`);
    console.log(`   URL: ${source.url}`);

    const res = await fetch(source.url, { headers: HEADERS });

    console.log(`   Status: ${res.status} ${res.statusText}`);
    console.log(`   Content-Type: ${res.headers.get('content-type')}`);

    if (!res.ok) {
      console.log(`   ❌ Failed\n`);
      continue;
    }

    const text = await res.text();
    console.log(`   Size: ${(text.length / 1024).toFixed(0)} KB`);

    if (text.length < 1000) {
      console.log(`   ❌ Response too small, probably not JSON`);
      console.log(`   Body: ${text.substring(0, 200)}`);
      continue;
    }

    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      console.log(`   ❌ JSON parse error: ${e.message}`);
      continue;
    }

    const prices = source.parse(data);
    const count = Object.keys(prices).length;

    if (count === 0) {
      console.log(`   ❌ Parsed 0 prices`);
      const sample = Object.entries(data).slice(0, 2);
      for (const [k, v] of sample) {
        console.log(`   Sample: "${k}" => ${JSON.stringify(v).substring(0, 100)}`);
      }
      continue;
    }

    // Success! Save to file
    writeFileSync(OUT_FILE, JSON.stringify(prices, null, 0));
    const fileSizeKB = (JSON.stringify(prices).length / 1024).toFixed(0);

    console.log('');
    console.log(`✅ Success! Saved ${count} item prices to:`);
    console.log(`   ${OUT_FILE} (${fileSizeKB} KB)`);
    console.log('');

    // Show some sample prices
    const samples = [
      'AK-47 | Redline (Field-Tested)',
      'AWP | Asiimov (Field-Tested)',
      'Clutch Case',
      'Revolution Case',
      'Desert Eagle | Blaze (Factory New)',
    ];
    console.log('📊 Sample prices:');
    for (const name of samples) {
      const p = prices[name];
      console.log(`   ${name}: ${p ? '$' + p.toFixed(2) : 'not found'}`);
    }
    console.log('');
    console.log('📤 Upload data/cs2_prices.json to your server if running remotely.');
    console.log('   Or set up a cron job: 0 */6 * * * cd /path/to/steam && node update-prices.js');
    process.exit(0);

  } catch (err) {
    console.log(`   ❌ Error: ${err.message}\n`);
  }
}

console.log('');
console.log('❌ All sources failed. Try again later or check your internet connection.');
process.exit(1);
