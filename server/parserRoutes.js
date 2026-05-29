/**
 * Parser API Routes
 * Add these routes to your Express server
 */

const express = require('express');
const router = express.Router();
const parser = require('./parser');

// Start parser
router.post('/start', async (req, res) => {
  try {
    const config = req.body;
    
    if (!config.apiKey) {
      return res.json({ success: false, error: 'API key required' });
    }
    
    if (!config.startIds || config.startIds.length === 0) {
      return res.json({ success: false, error: 'Start IDs required' });
    }

    const result = parser.startParser({
      apiKey: config.apiKey,
      startIds: config.startIds,
      minPrice: config.minPrice || 500,
      maxPrice: config.maxPrice || 1000,
      maxDepth: config.maxDepth || 3,
      maxFriendsPerLevel: config.maxFriendsPerLevel || 20,
      threads: config.threads || 3,
    });

    res.json(result);
  } catch (e) {
    res.json({ success: false, error: e.message });
  }
});

// Stop parser
router.post('/stop/:jobId', (req, res) => {
  const result = parser.stopParser(req.params.jobId);
  res.json(result);
});

// Pause parser
router.post('/pause/:jobId', (req, res) => {
  const result = parser.pauseParser(req.params.jobId);
  res.json(result);
});

// Resume parser
router.post('/resume/:jobId', (req, res) => {
  const result = parser.resumeParser(req.params.jobId);
  res.json(result);
});

// Get parser status
router.get('/status/:jobId', (req, res) => {
  const result = parser.getParserStatus(req.params.jobId);
  res.json(result);
});

// Get all active jobs
router.get('/jobs', (req, res) => {
  const result = parser.getActiveJobs();
  res.json(result);
});

// Get parser results
router.get('/results/:jobId', (req, res) => {
  const result = parser.getParserResults(req.params.jobId);
  res.json(result);
});

// Export results
router.get('/export/:jobId', (req, res) => {
  const { jobId } = req.params;
  const format = req.query.format || 'txt';
  const result = parser.getParserResults(jobId);

  if (!result.results || result.results.length === 0) {
    return res.status(404).send('No results found');
  }

  switch (format) {
    case 'txt':
      res.setHeader('Content-Type', 'text/plain');
      res.setHeader('Content-Disposition', `attachment; filename=steam_ids_${jobId}.txt`);
      res.send(result.results.map(r => r.steamId).join('\n'));
      break;
      
    case 'json':
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename=steam_ids_${jobId}.json`);
      res.json(result.results);
      break;
      
    case 'csv':
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=steam_ids_${jobId}.csv`);
      const header = 'steamId,inventoryValue,itemsCount,country,profileName,foundAt\n';
      const rows = result.results.map(r => 
        `${r.steamId},${r.inventoryValue},${r.itemsCount},${r.country},"${r.profileName}",${r.foundAt}`
      ).join('\n');
      res.send(header + rows);
      break;
      
    default:
      res.status(400).send('Invalid format');
  }
});

// Clear results
router.delete('/clear/:jobId', (req, res) => {
  const result = parser.clearResults(req.params.jobId);
  res.json(result);
});

module.exports = router;

/**
 * Usage in your main server.js:
 * 
 * const parserRoutes = require('./server/parserRoutes');
 * app.use('/api/parser', parserRoutes);
 */
