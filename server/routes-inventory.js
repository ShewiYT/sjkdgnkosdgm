/**
 * Inventory Evaluation Routes
 * 
 * Add these routes to your server.js:
 * 
 * const inventoryRoutes = require('./server/routes-inventory');
 * inventoryRoutes.setup(app);
 */

const lootfarm = require('./lootfarm-pricing');

function setup(app) {
  /**
   * Evaluate inventory using cached Loot.Farm prices
   * GET /api/inventory/evaluate/:steamId?game=cs2|dota|tf2|rust
   */
  app.get('/api/inventory/evaluate/:steamId', async (req, res) => {
    try {
      const { steamId } = req.params;
      const game = req.query.game || 'cs2';
      
      // Validate game
      if (!['cs2', 'dota', 'tf2', 'rust'].includes(game)) {
        return res.status(400).json({ error: 'Invalid game. Use: cs2, dota, tf2, rust' });
      }
      
      // Validate steamId
      if (!/^\d{17}$/.test(steamId)) {
        return res.status(400).json({ error: 'Invalid Steam ID format' });
      }
      
      const result = await lootfarm.evaluateInventory(steamId, game);
      res.json(result);
      
    } catch (err) {
      console.error('[API] Inventory evaluation error:', err);
      res.status(500).json({ error: err.message || 'Server error' });
    }
  });

  /**
   * Get price cache status
   * GET /api/inventory/cache-status
   */
  app.get('/api/inventory/cache-status', (req, res) => {
    const status = lootfarm.getCacheStatus();
    const formatted = {};
    
    for (const [game, data] of Object.entries(status)) {
      formatted[game] = {
        itemCount: data.itemCount,
        lastUpdate: data.lastUpdate ? new Date(data.lastUpdate).toISOString() : null,
        ageMinutes: data.lastUpdate ? Math.round((Date.now() - data.lastUpdate) / 60000) : null,
      };
    }
    
    res.json({ status: formatted });
  });

  /**
   * Force refresh prices
   * POST /api/inventory/refresh-prices?game=cs2|dota|tf2|rust|all
   */
  app.post('/api/inventory/refresh-prices', async (req, res) => {
    try {
      const game = req.query.game || 'all';
      
      if (game !== 'all' && !['cs2', 'dota', 'tf2', 'rust'].includes(game)) {
        return res.status(400).json({ error: 'Invalid game' });
      }
      
      const result = await lootfarm.refreshPrices(game);
      res.json({ success: true, result });
      
    } catch (err) {
      console.error('[API] Price refresh error:', err);
      res.status(500).json({ error: err.message || 'Server error' });
    }
  });

  console.log('[Routes] Inventory evaluation routes registered');
}

module.exports = { setup };
