#!/bin/bash
###############################################################################
#  SukaCombine Worker Node — Auto-Install Script
#
#  Использование:
#    curl -sL http://YOUR_MASTER_IP:3000/install-worker.sh | bash -s -- \
#        --master http://YOUR_MASTER_IP:3000 \
#        --name "VPS-Amsterdam-1" \
#        --port 3001
#
#  Или скачать и запустить:
#    wget http://YOUR_MASTER_IP:3000/install-worker.sh
#    chmod +x install-worker.sh
#    ./install-worker.sh --master http://YOUR_MASTER_IP:3000 --name "VPS-2"
#
#  После установки нода автоматически:
#  - Регистрируется на мастер-сервере (появится в Админ-панели)
#  - Запускается через PM2 (автостарт при перезагрузке)
#  - Отправляет heartbeat каждые 30 сек
#  - Выполняет задачи: логин аккаунтов, оценка инвентаря, Buff163 цены
###############################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}"
echo "╔══════════════════════════════════════════════╗"
echo "║   SukaCombine Worker Node — Auto Installer   ║"
echo "╚══════════════════════════════════════════════╝"
echo -e "${NC}"

# ─── Parse arguments ────────────────────────────────────────────────
MASTER_URL=""
NODE_NAME=""
NODE_PORT="3001"

while [[ $# -gt 0 ]]; do
  case $1 in
    --master|-m)  MASTER_URL="$2"; shift 2 ;;
    --name|-n)    NODE_NAME="$2"; shift 2 ;;
    --port|-p)    NODE_PORT="$2"; shift 2 ;;
    *)            shift ;;
  esac
done

if [ -z "$MASTER_URL" ]; then
  echo -e "${RED}❌ Ошибка: не указан адрес мастер-сервера${NC}"
  echo ""
  echo "Использование:"
  echo "  $0 --master http://IP:3000 --name \"VPS-2\" --port 3001"
  echo ""
  echo "Параметры:"
  echo "  --master, -m   URL мастер-сервера (обязательно)"
  echo "  --name,   -n   Имя ноды (по умолчанию: hostname)"
  echo "  --port,   -p   Порт ноды (по умолчанию: 3001)"
  exit 1
fi

# Remove trailing slash
MASTER_URL="${MASTER_URL%/}"

# Default name = hostname
if [ -z "$NODE_NAME" ]; then
  NODE_NAME="$(hostname)-worker"
fi

# Generate unique node ID
NODE_ID="node_$(cat /proc/sys/kernel/random/uuid 2>/dev/null || date +%s%N | md5sum | cut -c1-16)"

echo -e "${GREEN}✓${NC} Мастер-сервер: ${CYAN}${MASTER_URL}${NC}"
echo -e "${GREEN}✓${NC} Имя ноды:      ${CYAN}${NODE_NAME}${NC}"
echo -e "${GREEN}✓${NC} Порт ноды:     ${CYAN}${NODE_PORT}${NC}"
echo -e "${GREEN}✓${NC} Node ID:       ${CYAN}${NODE_ID}${NC}"
echo ""

# ─── 1. System update ──────────────────────────────────────────────
echo -e "${YELLOW}[1/6] Обновление системы...${NC}"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq > /dev/null 2>&1
apt-get install -y -qq curl wget git build-essential > /dev/null 2>&1
echo -e "${GREEN}  ✓ Система обновлена${NC}"

# ─── 2. Install Node.js 22 ─────────────────────────────────────────
echo -e "${YELLOW}[2/6] Установка Node.js 22...${NC}"
if command -v node &> /dev/null; then
  NODE_VER=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
  if [ "$NODE_VER" -ge 20 ]; then
    echo -e "${GREEN}  ✓ Node.js $(node -v) уже установлен${NC}"
  else
    echo "  Обновление Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash - > /dev/null 2>&1
    apt-get install -y -qq nodejs > /dev/null 2>&1
    echo -e "${GREEN}  ✓ Node.js $(node -v) установлен${NC}"
  fi
else
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - > /dev/null 2>&1
  apt-get install -y -qq nodejs > /dev/null 2>&1
  echo -e "${GREEN}  ✓ Node.js $(node -v) установлен${NC}"
fi

# ─── 3. Install PM2 ────────────────────────────────────────────────
echo -e "${YELLOW}[3/6] Установка PM2...${NC}"
if command -v pm2 &> /dev/null; then
  echo -e "${GREEN}  ✓ PM2 уже установлен${NC}"
else
  npm install -g pm2 > /dev/null 2>&1
  echo -e "${GREEN}  ✓ PM2 установлен${NC}"
fi

# ─── 4. Create worker directory and files ───────────────────────────
echo -e "${YELLOW}[4/6] Создание воркер-приложения...${NC}"

WORK_DIR="/opt/sukacombine-worker"
mkdir -p "$WORK_DIR"
cd "$WORK_DIR"

# package.json
cat > package.json << 'PKGJSON'
{
  "name": "sukacombine-worker",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "start": "node worker.js"
  },
  "dependencies": {
    "express": "^4.21.0",
    "steam-user": "^5.2.0",
    "steam-totp": "^2.1.2",
    "https-proxy-agent": "^7.0.0"
  }
}
PKGJSON

# Main worker script
cat > worker.js << WORKEREOF
const express = require('express');
const SteamUser = require('steam-user');
const SteamTotp = require('steam-totp');
const os = require('os');

const MASTER_URL = '${MASTER_URL}';
const NODE_ID = '${NODE_ID}';
const NODE_NAME = '${NODE_NAME}';
const NODE_PORT = ${NODE_PORT};
const HEARTBEAT_INTERVAL = 30000;

const app = express();
app.use(express.json({ limit: '10mb' }));

// Active Steam sessions on this node
const sessions = new Map();
let tasksCompleted = 0;
let tasksRunning = 0;
let errorCount = 0;

// ── System info ─────────────────────────────────────────────────────
function getSystemInfo() {
  const mem = os.totalmem();
  const free = os.freemem();
  return {
    platform: os.platform(),
    arch: os.arch(),
    hostname: os.hostname(),
    cpus: os.cpus().length,
    totalMemMB: Math.round(mem / 1024 / 1024),
    freeMemMB: Math.round(free / 1024 / 1024),
    usedMemPercent: Math.round((1 - free / mem) * 100),
    uptime: Math.round(os.uptime()),
    loadAvg: os.loadavg().map(l => Math.round(l * 100) / 100),
    nodeVersion: process.version,
  };
}

// ── Get my external IP ──────────────────────────────────────────────
async function getExternalIp() {
  try {
    const res = await fetch('https://api.ipify.org?format=json', { signal: AbortSignal.timeout(5000) });
    const data = await res.json();
    return data.ip;
  } catch {
    try {
      const res = await fetch('https://ifconfig.me/ip', { signal: AbortSignal.timeout(5000) });
      return (await res.text()).trim();
    } catch {
      return null;
    }
  }
}

// ── Register with master ────────────────────────────────────────────
async function registerWithMaster() {
  const ip = await getExternalIp();
  try {
    const res = await fetch(MASTER_URL + '/api/nodes/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nodeId: NODE_ID,
        name: NODE_NAME,
        ip: ip || 'unknown',
        port: NODE_PORT,
        version: '1.0.0',
        capabilities: ['steam-login', 'inventory', 'buff163'],
        systemInfo: getSystemInfo(),
      }),
      signal: AbortSignal.timeout(10000),
    });
    const data = await res.json();
    if (data.success) {
      console.log('[Worker] ✅ Registered with master:', MASTER_URL);
    } else {
      console.error('[Worker] ❌ Registration failed:', data.error);
    }
  } catch (e) {
    console.error('[Worker] ❌ Cannot reach master:', e.message);
  }
}

// ── Heartbeat ───────────────────────────────────────────────────────
async function sendHeartbeat() {
  try {
    await fetch(MASTER_URL + '/api/nodes/heartbeat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nodeId: NODE_ID,
        tasksRunning,
        tasksCompleted,
        errors: errorCount,
        systemInfo: getSystemInfo(),
        load: {
          activeSessions: sessions.size,
        },
      }),
      signal: AbortSignal.timeout(10000),
    });
  } catch (e) {
    console.error('[Worker] Heartbeat failed:', e.message);
  }
}

// ── Health check ────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    nodeId: NODE_ID,
    name: NODE_NAME,
    sessions: sessions.size,
    tasksCompleted,
    tasksRunning,
    errors: errorCount,
    uptime: process.uptime(),
    systemInfo: getSystemInfo(),
  });
});

// ── Steam Login Task ────────────────────────────────────────────────
app.post('/api/task', async (req, res) => {
  const { type, payload } = req.body;

  switch (type) {
    case 'steam-login':
      return handleSteamLogin(payload, res);
    case 'steam-logout':
      return handleSteamLogout(payload, res);
    case 'steam-status':
      return handleSteamStatus(payload, res);
    case 'ping':
      return res.json({ success: true, pong: Date.now() });
    default:
      return res.status(400).json({ success: false, error: 'Unknown task type: ' + type });
  }
});

async function handleSteamLogin(payload, res) {
  const { accountId, login, password, sharedSecret, identitySecret, proxyUrl } = payload;
  tasksRunning++;

  // Close existing session
  if (sessions.has(accountId)) {
    try { sessions.get(accountId).logOff(); } catch {}
    sessions.delete(accountId);
  }

  const clientOptions = { autoRelogin: false };

  if (proxyUrl) {
    try {
      const url = new URL(proxyUrl.startsWith('http') || proxyUrl.startsWith('socks') ? proxyUrl : 'http://' + proxyUrl);
      if (url.protocol.startsWith('socks')) {
        clientOptions.socksProxy = proxyUrl;
      } else {
        clientOptions.httpProxy = proxyUrl;
      }
      console.log('[Worker] Using proxy:', url.hostname + ':' + url.port);
    } catch (e) {
      console.error('[Worker] Bad proxy URL:', e.message);
    }
  }

  const client = new SteamUser(clientOptions);

  const loginDetails = { accountName: login, password };
  if (sharedSecret) {
    try {
      loginDetails.twoFactorCode = SteamTotp.generateAuthCode(sharedSecret);
    } catch {}
  }

  const timeout = setTimeout(() => {
    tasksRunning = Math.max(0, tasksRunning - 1);
    errorCount++;
    client.removeAllListeners();
    try { client.logOff(); } catch {}
    if (!res.headersSent) {
      res.json({ success: false, error: 'Таймаут подключения (45 сек)' });
    }
  }, 45000);

  client.on('loggedOn', () => {
    clearTimeout(timeout);
    tasksRunning = Math.max(0, tasksRunning - 1);
    tasksCompleted++;
    sessions.set(accountId, client);
    client.setPersona(SteamUser.EPersonaState.Online);

    if (!res.headersSent) {
      res.json({
        success: true,
        status: 'online',
        steamId: client.steamID?.getSteamID64(),
      });
    }

    // Get extra info
    client.on('accountInfo', (name) => {
      // Could send update to master
    });
  });

  client.on('error', (err) => {
    clearTimeout(timeout);
    tasksRunning = Math.max(0, tasksRunning - 1);
    errorCount++;
    console.error('[Worker] ❌ ' + login + ' error: ' + err.message);
    try { client.logOff(); } catch {}
    sessions.delete(accountId);
    if (!res.headersSent) {
      res.json({ success: false, error: err.message });
    }
  });

  client.logOn(loginDetails);
}

function handleSteamLogout(payload, res) {
  const { accountId } = payload;
  if (sessions.has(accountId)) {
    try { sessions.get(accountId).logOff(); } catch {}
    sessions.delete(accountId);
  }
  res.json({ success: true });
}

function handleSteamStatus(payload, res) {
  const { accountId } = payload;
  const client = sessions.get(accountId);
  if (!client) {
    return res.json({ status: 'offline' });
  }
  res.json({
    status: 'online',
    steamId: client.steamID?.getSteamID64(),
  });
}

// ── Graceful shutdown ───────────────────────────────────────────────
process.on('SIGINT', () => {
  console.log('[Worker] Shutting down...');
  sessions.forEach((client) => {
    try { client.logOff(); } catch {}
  });
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('[Worker] Shutting down...');
  sessions.forEach((client) => {
    try { client.logOff(); } catch {}
  });
  process.exit(0);
});

// ── Start ───────────────────────────────────────────────────────────
app.listen(NODE_PORT, '0.0.0.0', async () => {
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║     SukaCombine Worker Node v1.0.0           ║');
  console.log('╠══════════════════════════════════════════════╣');
  console.log('║  Node ID:  ' + NODE_ID.substring(0, 30).padEnd(33) + '║');
  console.log('║  Name:     ' + NODE_NAME.substring(0, 30).padEnd(33) + '║');
  console.log('║  Port:     ' + String(NODE_PORT).padEnd(33) + '║');
  console.log('║  Master:   ' + MASTER_URL.substring(0, 30).padEnd(33) + '║');
  console.log('╚══════════════════════════════════════════════╝');

  // Register immediately
  await registerWithMaster();

  // Heartbeat loop
  setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);
});
WORKEREOF

echo -e "${GREEN}  ✓ Файлы созданы в ${WORK_DIR}${NC}"

# ─── 5. Install dependencies ───────────────────────────────────────
echo -e "${YELLOW}[5/6] Установка зависимостей (steam-user, express, etc)...${NC}"
cd "$WORK_DIR"
npm install --production > /dev/null 2>&1
echo -e "${GREEN}  ✓ Зависимости установлены${NC}"

# ─── 6. Setup PM2 and start ────────────────────────────────────────
echo -e "${YELLOW}[6/6] Запуск через PM2...${NC}"

# Stop if already running
pm2 delete sukacombine-worker 2>/dev/null || true

# Start
pm2 start worker.js \
  --name sukacombine-worker \
  --cwd "$WORK_DIR" \
  --max-memory-restart 500M \
  --restart-delay 5000 \
  --max-restarts 50 \
  > /dev/null 2>&1

# Save PM2 config and setup startup
pm2 save > /dev/null 2>&1
pm2 startup systemd -u root --hp /root > /dev/null 2>&1 || pm2 startup > /dev/null 2>&1 || true

echo -e "${GREEN}  ✓ Запущен через PM2${NC}"

# ─── Done ───────────────────────────────────────────────────────────
echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════════════╗"
echo -e "║  ${GREEN}✅ Worker Node установлен и запущен!${CYAN}                 ║"
echo -e "╠══════════════════════════════════════════════════════╣"
echo -e "║  ${NC}Node ID:    ${YELLOW}${NODE_ID}${CYAN}  ║"
echo -e "║  ${NC}Имя:        ${YELLOW}${NODE_NAME}${CYAN}$(printf '%*s' $((30 - ${#NODE_NAME})) '')   ║"
echo -e "║  ${NC}Порт:       ${YELLOW}${NODE_PORT}${CYAN}$(printf '%*s' $((30 - ${#NODE_PORT})) '')   ║"
echo -e "║  ${NC}Мастер:     ${YELLOW}${MASTER_URL}${CYAN}$(printf '%*s' $((30 - ${#MASTER_URL})) '')   ║"
echo -e "║  ${NC}Директория: ${YELLOW}${WORK_DIR}${CYAN}                        ║"
echo -e "╠══════════════════════════════════════════════════════╣"
echo -e "║  ${NC}Команды управления:${CYAN}                                ║"
echo -e "║  ${NC}  pm2 logs sukacombine-worker   ${CYAN}— логи${CYAN}           ║"
echo -e "║  ${NC}  pm2 restart sukacombine-worker ${CYAN}— перезапуск${CYAN}    ║"
echo -e "║  ${NC}  pm2 stop sukacombine-worker    ${CYAN}— остановка${CYAN}     ║"
echo -e "║  ${NC}  pm2 monit                      ${CYAN}— мониторинг${CYAN}   ║"
echo -e "╚══════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}Нода автоматически появится в Админ-панели мастер-сервера.${NC}"
echo -e "${GREEN}PM2 настроен на автозапуск при перезагрузке VPS.${NC}"
echo ""
