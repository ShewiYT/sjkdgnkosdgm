#!/bin/bash
echo ""
echo "  SukaCombine Worker Node Installer"
echo "  ================================="
echo ""

MASTER_URL=""
NODE_NAME=""
NODE_PORT="3001"

while [ $# -gt 0 ]; do
  case "$1" in
    --master|-m) MASTER_URL="$2"; shift; shift;;
    --name|-n) NODE_NAME="$2"; shift; shift;;
    --port|-p) NODE_PORT="$2"; shift; shift;;
    *) shift;;
  esac
done

if [ -z "$MASTER_URL" ]; then
  echo "ERROR: --master not set"
  echo "Usage: $0 --master http://IP:3000 --name Worker-1"
  exit 1
fi

MASTER_URL="${MASTER_URL%/}"
test -z "$NODE_NAME" && NODE_NAME="$(hostname)-worker"
NODE_ID="node_${RANDOM}${RANDOM}_$(date +%s)"

echo "  Master: $MASTER_URL"
echo "  Name:   $NODE_NAME"
echo "  Port:   $NODE_PORT"
echo "  ID:     $NODE_ID"
echo ""

# Step 1: Node.js
echo "[1/4] Checking Node.js..."
if command -v node >/dev/null 2>&1; then
  echo "  Node.js $(node -v) found"
else
  echo "  Installing Node.js 22..."
  export DEBIAN_FRONTEND=noninteractive
  curl -fsSL https://deb.nodesource.com/setup_22.x -o /tmp/ns.sh
  bash /tmp/ns.sh > /tmp/ns.log 2>&1
  apt-get update > /dev/null 2>&1
  apt-get install -y nodejs > /tmp/node_install.log 2>&1
  if command -v node >/dev/null 2>&1; then
    echo "  Node.js $(node -v) installed"
  else
    echo "  ERROR: Node.js install failed. Check /tmp/node_install.log"
    exit 1
  fi
fi

# Step 2: PM2
echo "[2/4] Checking PM2..."
if command -v pm2 >/dev/null 2>&1; then
  echo "  PM2 found"
else
  echo "  Installing PM2..."
  npm install -g pm2 > /tmp/pm2.log 2>&1
  if command -v pm2 >/dev/null 2>&1; then
    echo "  PM2 installed"
  else
    echo "  ERROR: PM2 install failed. Check /tmp/pm2.log"
    exit 1
  fi
fi

# Step 3: Create app
echo "[3/4] Creating worker app..."
WDIR="/opt/sukacombine-worker"
mkdir -p "$WDIR"

# package.json
cat > "$WDIR/package.json" << 'EOF'
{
  "name": "sukacombine-worker",
  "version": "1.0.0",
  "private": true,
  "dependencies": {
    "express": "^4.21.0",
    "steam-user": "^5.2.0",
    "steam-totp": "^2.1.2",
    "https-proxy-agent": "^7.0.0"
  }
}
EOF

# config.json
cat > "$WDIR/config.json" << EOF
{
  "masterUrl": "$MASTER_URL",
  "nodeId": "$NODE_ID",
  "nodeName": "$NODE_NAME",
  "nodePort": $NODE_PORT
}
EOF

# worker.js
cat > "$WDIR/worker.js" << 'WORKERJS'
var express=require("express"),SteamUser=require("steam-user"),SteamTotp=require("steam-totp"),os=require("os"),fs=require("fs"),path=require("path");
var C=JSON.parse(fs.readFileSync(path.join(__dirname,"config.json"),"utf8"));
var app=express();app.use(express.json({limit:"10mb"}));
var sessions=new Map(),done=0,running=0,errs=0;
function si(){var m=os.totalmem(),f=os.freemem();return{hostname:os.hostname(),cpus:os.cpus().length,totalMemMB:Math.round(m/1048576),freeMemMB:Math.round(f/1048576),usedMemPercent:Math.round((1-f/m)*100),uptime:Math.round(os.uptime()),nodeVersion:process.version,platform:os.platform()}}
async function getIp(){try{var r=await fetch("https://api.ipify.org?format=json",{signal:AbortSignal.timeout(5e3)});return(await r.json()).ip}catch(e){try{var r2=await fetch("https://ifconfig.me/ip",{signal:AbortSignal.timeout(5e3)});return(await r2.text()).trim()}catch(e2){return null}}}
async function reg(){var ip=await getIp();console.log("[W] IP:",ip);try{var r=await fetch(C.masterUrl+"/api/nodes/register",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({nodeId:C.nodeId,name:C.nodeName,ip:ip||"unknown",port:C.nodePort,version:"1.0.0",capabilities:["steam-login","inventory","buff163"],systemInfo:si()}),signal:AbortSignal.timeout(1e4)});var d=await r.json();console.log(d.success?"[W] Registered OK":"[W] Reg fail: "+d.error)}catch(e){console.error("[W] Master unreachable:",e.message)}}
async function hb(){try{await fetch(C.masterUrl+"/api/nodes/heartbeat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({nodeId:C.nodeId,tasksRunning:running,tasksCompleted:done,errors:errs,systemInfo:si(),load:{activeSessions:sessions.size}}),signal:AbortSignal.timeout(1e4)})}catch(e){}}
app.get("/api/health",function(q,s){s.json({status:"ok",nodeId:C.nodeId,name:C.nodeName,sessions:sessions.size,done:done,running:running,errors:errs})});
app.post("/api/task",function(q,s){var t=q.body.type,p=q.body.payload;if(t==="steam-login")return login(p,s);if(t==="steam-logout"){if(sessions.has(p.accountId)){try{sessions.get(p.accountId).logOff()}catch(e){}sessions.delete(p.accountId)}return s.json({success:true})}if(t==="steam-status"){var c=sessions.get(p.accountId);return s.json(c?{status:"online",steamId:c.steamID?c.steamID.getSteamID64():null}:{status:"offline"})}if(t==="ping")return s.json({success:true,pong:Date.now()});s.status(400).json({error:"unknown:"+t})});
function login(p,res){running++;if(sessions.has(p.accountId)){try{sessions.get(p.accountId).logOff()}catch(e){}sessions.delete(p.accountId)}var o={autoRelogin:false};if(p.proxyUrl){try{var u=new URL(p.proxyUrl.match(/^(http|socks)/i)?p.proxyUrl:"http://"+p.proxyUrl);if(u.protocol.startsWith("socks"))o.socksProxy=p.proxyUrl;else o.httpProxy=p.proxyUrl;console.log("[W] proxy:",u.hostname+":"+u.port)}catch(e){}}var cl=new SteamUser(o),dt={accountName:p.login,password:p.password};if(p.sharedSecret){try{dt.twoFactorCode=SteamTotp.generateAuthCode(p.sharedSecret)}catch(e){}}var to=setTimeout(function(){running=Math.max(0,running-1);errs++;cl.removeAllListeners();try{cl.logOff()}catch(e){}if(!res.headersSent)res.json({success:false,error:"Timeout"})},45e3);cl.on("loggedOn",function(){clearTimeout(to);running=Math.max(0,running-1);done++;sessions.set(p.accountId,cl);cl.setPersona(SteamUser.EPersonaState.Online);if(!res.headersSent)res.json({success:true,status:"online",steamId:cl.steamID?cl.steamID.getSteamID64():null})});cl.on("error",function(e){clearTimeout(to);running=Math.max(0,running-1);errs++;console.error("[W] ERR "+p.login+":",e.message);try{cl.logOff()}catch(x){}sessions.delete(p.accountId);if(!res.headersSent)res.json({success:false,error:e.message})});cl.logOn(dt)}
process.on("SIGINT",function(){sessions.forEach(function(c){try{c.logOff()}catch(e){}});process.exit(0)});
process.on("SIGTERM",function(){sessions.forEach(function(c){try{c.logOff()}catch(e){}});process.exit(0)});
app.listen(C.nodePort,"0.0.0.0",async function(){console.log("\n  SukaCombine Worker v1.0");console.log("  "+C.nodeName+" | port "+C.nodePort+" | master "+C.masterUrl+"\n");await reg();setInterval(hb,3e4)});
WORKERJS

echo "  Files created in $WDIR"

# Step 4: npm install + PM2
echo "[4/4] npm install + PM2 start..."
echo "  (steam-user is large, ~2-3 minutes)"
cd "$WDIR"

# Clear npm cache if needed
npm cache clean --force > /dev/null 2>&1

# Install with verbose output to see progress
echo "  Installing dependencies (this may take a while)..."
npm install --production --no-audit --no-fund 2>&1 | while read line; do
  echo "    $line"
done

# Check if installation succeeded
if [ ! -d "$WDIR/node_modules/steam-user" ]; then
  echo "  ERROR: npm install failed!"
  echo "  Trying alternative method..."
  
  # Alternative: install with legacy peer deps
  npm install --production --legacy-peer-deps --no-audit 2>&1
  
  if [ ! -d "$WDIR/node_modules/steam-user" ]; then
    echo "  ERROR: npm install still failed. Check manually:"
    echo "    cd $WDIR && npm install"
    exit 1
  fi
fi

echo "  npm install completed successfully"

# Stop existing process if running
pm2 delete sukacombine-worker > /dev/null 2>&1 || true

# Start the worker
pm2 start worker.js --name sukacombine-worker --cwd "$WDIR" --max-memory-restart 500M
pm2 save > /dev/null 2>&1 || true

# Wait a moment for the worker to start
sleep 2

echo ""
echo "  ====================================="
echo "  Worker Node installed and running!"
echo "  ====================================="
echo ""
echo "  ID:     $NODE_ID"
echo "  Name:   $NODE_NAME"
echo "  Port:   $NODE_PORT"
echo "  Master: $MASTER_URL"
echo "  Dir:    $WDIR"
echo ""
echo "  Commands:"
echo "    pm2 logs sukacombine-worker"
echo "    pm2 restart sukacombine-worker"
echo "    pm2 monit"
echo "    pm2 stop sukacombine-worker"
echo ""
pm2 list
echo ""
echo "  Check logs: pm2 logs sukacombine-worker --lines 20"
echo "  Node will appear in admin panel automatically."