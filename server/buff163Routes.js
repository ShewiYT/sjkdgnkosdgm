/**
 * Express routes for Buff163 price API
 * Add these routes to your server.js
 */

const buff163 = require('./buff163');

/**
 * Setup Buff163 routes
 * @param {Express.Application} app - Express app
 */
function setupBuff163Routes(app) {
  
  /**
   * GET /api/buff163/price/:itemName
   * Get price for a single item
   */
  app.get('/api/buff163/price/:itemName', async (req, res) => {
    try {
      const itemName = decodeURIComponent(req.params.itemName);
      const result = await buff163.getItemPrice(itemName);
      res.json({
        success: true,
        ...result,
      });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  /**
   * POST /api/buff163/prices
   * Get prices for multiple items
   * Body: { items: ["item1", "item2", ...] }
   */
  app.post('/api/buff163/prices', async (req, res) => {
    try {
      const { items } = req.body;
      if (!items || !Array.isArray(items)) {
        return res.status(400).json({ success: false, error: 'items array required' });
      }
      
      const prices = await buff163.getItemPrices(items);
      res.json({
        success: true,
        prices,
      });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  /**
   * POST /api/buff-prices
   * Alias for /api/buff163/prices (for frontend compatibility)
   */
  app.post('/api/buff-prices', async (req, res) => {
    try {
      const { items } = req.body;
      if (!items || !Array.isArray(items)) {
        return res.status(400).json({ success: false, error: 'items array required' });
      }
      
      const prices = await buff163.getItemPrices(items);
      res.json({
        success: true,
        prices,
      });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  /**
   * GET /api/buff163/inventory/:steamId
   * Get full inventory evaluation with Buff163 prices
   */
  app.get('/api/buff163/inventory/:steamId', async (req, res) => {
    try {
      const { steamId } = req.params;
      const result = await buff163.evaluateInventory(steamId);
      res.json(result);
    } catch (e) {
      res.status(500).json({ 
        success: false, 
        error: e.message,
        totalValue: 0,
        itemCount: 0,
        pricedItems: 0,
        unpricedItems: 0,
        items: [],
      });
    }
  });

  /**
   * GET /api/inventory/:steamId
   * Override default inventory endpoint to use Buff163
   */
  app.get('/api/inventory/:steamId', async (req, res) => {
    try {
      const { steamId } = req.params;
      const raw = req.query.raw === 'true';
      
      // If raw=true, just return Steam inventory items
      if (raw) {
        const inventory = await buff163.getSteamInventory(steamId);
        return res.json({
          items: inventory.items,
          rawItems: inventory.items,
          total: inventory.total,
          error: inventory.error,
        });
      }
      
      // Otherwise, return full evaluation
      const result = await buff163.evaluateInventory(steamId);
      res.json(result);
    } catch (e) {
      res.status(500).json({ 
        success: false, 
        error: e.message,
        totalValue: 0,
        itemCount: 0,
        pricedItems: 0,
        unpricedItems: 0,
        items: [],
      });
    }
  });

  /**
   * GET /api/buff163/cache/stats
   * Get cache statistics
   */
  app.get('/api/buff163/cache/stats', (req, res) => {
    const stats = buff163.getCacheStats();
    res.json(stats);
  });

  /**
   * POST /api/buff163/cache/cleanup
   * Clean up expired cache entries
   */
  app.post('/api/buff163/cache/cleanup', (req, res) => {
    buff163.cleanupCache();
    const stats = buff163.getCacheStats();
    res.json({ success: true, ...stats });
  });

  /**
   * POST /api/buff-proxy
   * Proxy endpoint for direct Buff163 API calls (for frontend fallback)
   */
  app.post('/api/buff-proxy', async (req, res) => {
    try {
      const { goodsId, tagId } = req.body;
      
      if (!goodsId) {
        return res.status(400).json({ success: false, error: 'goodsId required' });
      }

      let sellUrl = `https://buff.163.com/api/market/goods/sell_order?game=csgo&goods_id=${goodsId}&page_num=1`;
      if (tagId) {
        sellUrl += `&tag_ids=${tagId}`;
      }

      const response = await fetch(sellUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        return res.json({ success: false, error: `Buff163 API error: ${response.status}` });
      }

      const data = await response.json();
      const items = data?.data?.items || [];
      
      const CNY_TO_USD = 0.14;
      const prices = items
        .filter(item => item.price)
        .map(item => parseFloat(item.price) * CNY_TO_USD);
      
      const lowestSell = prices.length > 0 ? Math.round(Math.min(...prices) * 100) / 100 : null;

      res.json({
        success: true,
        lowestSell,
        itemCount: items.length,
      });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  console.log('[Buff163] Routes registered');
  
  // Preload marketplace IDs on startup
  buff163.loadMarketplaceIds().catch(e => {
    console.error('[Buff163] Failed to preload marketplace IDs:', e.message);
  });
}

module.exports = { setupBuff163Routes };
