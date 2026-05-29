/**
 * Worker Nodes Manager
 * 
 * Управляет удалёнными VPS-нодами которые выполняют задачи:
 * - Логин аккаунтов через прокси
 * - Buff163 ценообразование
 * - Парсинг инвентарей
 * 
 * Ноды сами регистрируются через POST /api/nodes/register
 * и отправляют heartbeat каждые 30 сек.
 */

const fs = require('fs');
const path = require('path');

const NODES_FILE = path.join(__dirname, '..', 'data', 'worker_nodes.json');

let nodes = [];

function ensureDataDir() {
  const dataDir = path.join(__dirname, '..', 'data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
}

function loadNodes() {
  try {
    ensureDataDir();
    if (fs.existsSync(NODES_FILE)) {
      nodes = JSON.parse(fs.readFileSync(NODES_FILE, 'utf8'));
      // Mark all as offline on load (they need to re-register)
      nodes.forEach(n => n.status = 'offline');
    }
  } catch { nodes = []; }
}

function saveNodes() {
  try {
    ensureDataDir();
    fs.writeFileSync(NODES_FILE, JSON.stringify(nodes, null, 2));
  } catch (e) {
    console.error('[Nodes] Failed to save:', e.message);
  }
}

function getNodes() {
  return nodes;
}

function getOnlineNodes() {
  const now = Date.now();
  return nodes.filter(n => n.status === 'online' && now - n.lastHeartbeat < 90000);
}

function setupWorkerNodeRoutes(app) {
  loadNodes();

  /**
   * POST /api/nodes/register
   * Worker node registers itself on startup
   */
  app.post('/api/nodes/register', (req, res) => {
    const { nodeId, name, ip, port, version, capabilities, systemInfo } = req.body;

    if (!nodeId) {
      return res.status(400).json({ success: false, error: 'nodeId required' });
    }

    const existing = nodes.find(n => n.nodeId === nodeId);
    const now = Date.now();

    if (existing) {
      // Re-register existing node
      existing.status = 'online';
      existing.lastHeartbeat = now;
      existing.ip = ip || existing.ip;
      existing.port = port || existing.port;
      existing.name = name || existing.name;
      existing.version = version || existing.version;
      existing.capabilities = capabilities || existing.capabilities;
      existing.systemInfo = systemInfo || existing.systemInfo;
      existing.registeredAt = existing.registeredAt || new Date().toISOString();
      console.log(`[Nodes] Re-registered: ${existing.name} (${existing.ip})`);
    } else {
      // New node
      const node = {
        nodeId,
        name: name || `Node-${nodes.length + 1}`,
        ip: ip || req.ip?.replace('::ffff:', '') || 'unknown',
        port: port || 3001,
        status: 'online',
        version: version || '1.0.0',
        capabilities: capabilities || ['steam-login', 'inventory', 'buff163'],
        systemInfo: systemInfo || {},
        lastHeartbeat: now,
        registeredAt: new Date().toISOString(),
        tasksCompleted: 0,
        tasksRunning: 0,
        errors: 0,
      };
      nodes.push(node);
      console.log(`[Nodes] ✅ New node registered: ${node.name} (${node.ip}:${node.port})`);
    }

    saveNodes();
    res.json({ success: true, masterTime: now });
  });

  /**
   * POST /api/nodes/heartbeat
   * Worker sends heartbeat every 30 sec
   */
  app.post('/api/nodes/heartbeat', (req, res) => {
    const { nodeId, tasksRunning, tasksCompleted, errors, systemInfo, load } = req.body;
    const node = nodes.find(n => n.nodeId === nodeId);

    if (!node) {
      return res.status(404).json({ success: false, error: 'Node not registered. Call /api/nodes/register first.' });
    }

    node.status = 'online';
    node.lastHeartbeat = Date.now();
    if (tasksRunning !== undefined) node.tasksRunning = tasksRunning;
    if (tasksCompleted !== undefined) node.tasksCompleted = tasksCompleted;
    if (errors !== undefined) node.errors = errors;
    if (systemInfo) node.systemInfo = systemInfo;
    if (load) node.load = load;

    // Don't save on every heartbeat to reduce I/O, save every 5th
    if (Math.random() < 0.2) saveNodes();

    // Return any pending tasks
    res.json({ success: true, pendingTasks: [] });
  });

  /**
   * GET /api/nodes
   * List all nodes (for admin panel)
   */
  app.get('/api/nodes', (req, res) => {
    const now = Date.now();
    const enriched = nodes.map(n => ({
      ...n,
      isOnline: n.status === 'online' && now - n.lastHeartbeat < 90000,
      lastSeen: n.lastHeartbeat ? Math.floor((now - n.lastHeartbeat) / 1000) : null,
    }));
    res.json({ nodes: enriched });
  });

  /**
   * DELETE /api/nodes/:nodeId
   * Remove a node
   */
  app.delete('/api/nodes/:nodeId', (req, res) => {
    const { nodeId } = req.params;
    const before = nodes.length;
    nodes = nodes.filter(n => n.nodeId !== nodeId);
    if (nodes.length < before) {
      saveNodes();
      res.json({ success: true });
    } else {
      res.status(404).json({ success: false, error: 'Node not found' });
    }
  });

  /**
   * POST /api/nodes/:nodeId/task
   * Send a task to a specific node
   */
  app.post('/api/nodes/:nodeId/task', async (req, res) => {
    const { nodeId } = req.params;
    const node = nodes.find(n => n.nodeId === nodeId);

    if (!node || node.status !== 'online') {
      return res.status(404).json({ success: false, error: 'Node offline or not found' });
    }

    try {
      const proxyRes = await fetch(`http://${node.ip}:${node.port}/api/task`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req.body),
        signal: AbortSignal.timeout(30000),
      });
      const data = await proxyRes.json();
      res.json(data);
    } catch (e) {
      res.status(502).json({ success: false, error: `Node unreachable: ${e.message}` });
    }
  });

  // Cleanup: mark offline nodes that haven't sent heartbeat
  setInterval(() => {
    const now = Date.now();
    let changed = false;
    nodes.forEach(n => {
      if (n.status === 'online' && now - n.lastHeartbeat > 90000) {
        n.status = 'offline';
        console.log(`[Nodes] ⚠️ ${n.name} went offline (no heartbeat)`);
        changed = true;
      }
    });
    if (changed) saveNodes();
  }, 30000);

  console.log('[Nodes] Worker node routes registered');
}

module.exports = { setupWorkerNodeRoutes, getNodes, getOnlineNodes };
