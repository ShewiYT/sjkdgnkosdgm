/**
 * Chat Templates Routes
 * 
 * Add these routes to your server.js:
 * 
 * const templateRoutes = require('./server/routes-templates');
 * templateRoutes.setup(app, db);
 */

function setup(app, db) {
  // Ensure templates table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS chat_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      text TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  /**
   * Get all chat templates
   * GET /api/chat-templates
   */
  app.get('/api/chat-templates', (req, res) => {
    try {
      const rows = db.prepare('SELECT text FROM chat_templates ORDER BY sort_order, id').all();
      const templates = rows.map(r => r.text);
      res.json({ templates });
    } catch (err) {
      console.error('[API] Get templates error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * Save all chat templates (replace all)
   * POST /api/chat-templates
   * Body: { templates: string[] }
   */
  app.post('/api/chat-templates', (req, res) => {
    try {
      const { templates } = req.body;
      
      if (!Array.isArray(templates)) {
        return res.status(400).json({ error: 'templates must be an array' });
      }
      
      // Delete all existing
      db.prepare('DELETE FROM chat_templates').run();
      
      // Insert new
      const insert = db.prepare('INSERT INTO chat_templates (text, sort_order) VALUES (?, ?)');
      for (let i = 0; i < templates.length; i++) {
        if (typeof templates[i] === 'string' && templates[i].trim()) {
          insert.run(templates[i].trim(), i);
        }
      }
      
      res.json({ success: true, count: templates.length });
    } catch (err) {
      console.error('[API] Save templates error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  console.log('[Routes] Chat templates routes registered');
}

module.exports = { setup };
