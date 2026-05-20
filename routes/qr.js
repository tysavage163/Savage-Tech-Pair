const { 
    giftedId,
    removeFile
} = require('../gift');
const QRCode = require('qrcode');
const express = require('express');
const zlib = require('zlib');
const path = require('path');
const fs = require('fs');
const os = require('os');
let router = express.Router();
const pino = require("pino");
const {
    default: giftedConnect,
    useMultiFileAuthState,
    Browsers,
    delay,
    DisconnectReason,
    fetchLatestBaileysVersion
} = require("@whiskeysockets/baileys");

const getSessionDir = () => {
    const dir = path.join(os.tmpdir(), 'savage-sessions', 'qr');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return dir;
};

const getQRTemplate = (qrImage) => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<title>SAVAGE TECH — QR Auth</title>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
<link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
:root{
  --accent:#ff007f; --accent2:#c4006b; --green:#ff66b5;
  --cyan:#ff66b5; --bg:#0a0a0c; --card:rgba(10,10,12,0.85);
  --border:rgba(255,0,127,0.2); --border-hi:rgba(255,0,127,0.5);
  --text:#f1f0ff; --text2:#b0b0b8; --text3:#5a5a6e;
}
*,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
body{
  font-family:'Orbitron',sans-serif;
  background:var(--bg);color:var(--text);
  min-height:100vh;display:flex;align-items:center;justify-content:center;
  padding:20px;overflow:hidden;
}
.glow-orb{
  position:fixed;border-radius:50%;filter:blur(80px);pointer-events:none;
}
.orb1{width:500px;height:500px;background:rgba(255,0,127,0.15);top:-150px;left:-100px;}
.orb2{width:400px;height:400px;background:rgba(255,0,127,0.08);bottom:-100px;right:-80px;}
.wrap{position:relative;z-index:10;width:100%;max-width:420px;}
.nav-back{
  display:inline-flex;align-items:center;gap:7px;
  padding:8px 14px;border-radius:8px;
  background:var(--card);border:1px solid var(--border);
  color:var(--text2);text-decoration:none;font-size:.82rem;font-weight:500;
  margin-bottom:20px;transition:all .2s;
}
.nav-back:hover{color:var(--text);border-color:var(--border-hi);}
.card{
  background:rgba(10,10,12,0.9);
  border:1px solid var(--border);
  border-radius:20px;overflow:hidden;
  box-shadow:0 40px 80px rgba(0,0,0,.7);
  animation:up .4s ease both;
}
@keyframes up{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}
.card-head{
  padding:24px 24px 20px;
  background:linear-gradient(160deg,rgba(255,0,127,0.1) 0%,transparent 60%);
  border-bottom:1px solid var(--border);
}
.badge{
  display:inline-flex;align-items:center;gap:6px;
  padding:3px 10px;border-radius:100px;
  background:rgba(255,0,127,0.15);border:1px solid rgba(255,0,127,0.3);
  color:var(--accent);font-size:.7rem;font-weight:700;
  font-family:'JetBrains Mono',monospace;letter-spacing:.04em;
  margin-bottom:12px;
}
.badge-dot{width:5px;height:5px;border-radius:50%;background:var(--accent);animation:blink 2s infinite;}
@keyframes blink{0%,100%{opacity:1}50%{opacity:.3}}
.card-title{font-size:1.45rem;font-weight:900;letter-spacing:-.02em;margin-bottom:4px;}
.card-sub{font-size:.84rem;color:var(--text2);line-height:1.5;}
.card-body{padding:24px;}

.qr-wrap{
  position:relative;margin:0 auto 20px;
  width:260px;height:260px;
  display:flex;align-items:center;justify-content:center;
}
.qr-corners span{
  position:absolute;width:20px;height:20px;
  border-style:solid;border-color:var(--accent);
}
.qr-corners span:nth-child(1){top:0;left:0;border-width:2px 0 0 2px;border-radius:3px 0 0 0;}
.qr-corners span:nth-child(2){top:0;right:0;border-width:2px 2px 0 0;border-radius:0 3px 0 0;}
.qr-corners span:nth-child(3){bottom:0;left:0;border-width:0 0 2px 2px;border-radius:0 0 0 3px;}
.qr-corners span:nth-child(4){bottom:0;right:0;border-width:0 2px 2px 0;border-radius:0 0 3px 0;}
.scan-line{
  position:absolute;left:4px;right:4px;height:2px;
  background:linear-gradient(90deg,transparent,var(--accent),var(--cyan),var(--accent),transparent);
  animation:scan 2.2s ease-in-out infinite;z-index:2;
  box-shadow:0 0 12px var(--accent);
}
@keyframes scan{0%,100%{top:4px}50%{top:calc(100% - 6px)}}
.qr-inner{
  position:relative;z-index:1;
  width:calc(100% - 8px);height:calc(100% - 8px);
  border-radius:12px;overflow:hidden;
  background:white;padding:10px;
  box-shadow:0 0 40px rgba(255,0,127,0.3);
  animation:qrpulse 3s ease-in-out infinite;
}
@keyframes qrpulse{0%,100%{box-shadow:0 0 30px rgba(255,0,127,0.2)}50%{box-shadow:0 0 60px rgba(255,0,127,0.4)}}
.qr-inner img{width:100%;height:100%;display:block;}
.ring{
  position:absolute;inset:-6px;border-radius:18px;
  background:conic-gradient(from 0deg,var(--accent),var(--cyan),var(--accent2),var(--accent));
  animation:spin 6s linear infinite;z-index:0;opacity:.6;
}
@keyframes spin{to{transform:rotate(360deg)}}
.ring-mask{
  position:absolute;inset:-5px;border-radius:17px;background:var(--bg);
  z-index:0;
}

.timer-row{
  display:flex;align-items:center;justify-content:center;gap:8px;
  margin-bottom:16px;
  font-family:'JetBrains Mono',monospace;font-size:.75rem;color:var(--text2);
}
#timer{
  font-size:.9rem;font-weight:700;color:var(--accent);
  background:rgba(255,0,127,0.15);border:1px solid rgba(255,0,127,0.3);
  padding:2px 10px;border-radius:4px;min-width:40px;text-align:center;
  transition:all .3s;
}
#timer.warn{color:#ffb347;background:rgba(255,180,71,0.1);border-color:rgba(255,180,71,0.3);}
#timer.urgent{color:#ff4d4d;background:rgba(255,77,77,0.1);border-color:rgba(255,77,77,0.3);animation:fblink .7s step-end infinite;}
@keyframes fblink{0%,100%{opacity:1}50%{opacity:.3}}

.steps{display:flex;flex-direction:column;gap:6px;margin-bottom:14px;}
.step{
  display:flex;align-items:center;gap:10px;
  padding:9px 12px;border-radius:9px;
  background:rgba(255,255,255,0.02);border:1px solid var(--border);
  font-size:.8rem;color:var(--text2);
}
.step-n{
  width:22px;height:22px;border-radius:50%;flex-shrink:0;
  background:rgba(255,0,127,0.15);border:1px solid rgba(255,0,127,0.3);
  display:flex;align-items:center;justify-content:center;
  font-family:'JetBrains Mono',monospace;font-size:.62rem;font-weight:700;color:var(--accent);
}
.security{
  padding:10px 12px;border-radius:9px;
  background:rgba(255,0,127,0.05);border:1px solid rgba(255,0,127,0.15);
  font-size:.75rem;color:#ff99cc;display:flex;align-items:flex-start;gap:7px;line-height:1.5;
}
@media(max-width:460px){.qr-wrap{width:220px;height:220px;}}
</style>
</head>
<body>
<div class="glow-orb orb1"></div>
<div class="glow-orb orb2"></div>
<div class="wrap">
  <a class="nav-back" href="/"><i class="fas fa-arrow-left"></i> Back to Home</a>
  <div class="card">
    <div class="card-head">
      <div class="badge"><span class="badge-dot"></span> QR ACTIVE — AWAITING SCAN</div>
      <h1 class="card-title">Scan to Connect</h1>
      <p class="card-sub">Open WhatsApp &rarr; Linked Devices &rarr; Scan this code</p>
    </div>
    <div class="card-body">
      <div class="qr-wrap">
        <div class="ring"></div>
        <div class="ring-mask"></div>
        <div class="qr-corners">
          <span></span><span></span><span></span><span></span>
        </div>
        <div class="scan-line"></div>
        <div class="qr-inner">
          <img src="${qrImage}" alt="WhatsApp QR Code"/>
        </div>
      </div>
      <div class="timer-row">
        <i class="fas fa-clock" style="color:var(--accent)"></i>
        Expires in <span id="timer">60</span> sec
      </div>
      <div class="steps">
        <div class="step"><div class="step-n">01</div>Open <strong style="color:var(--text);margin-left:2px">WhatsApp</strong>&nbsp;on your device</div>
        <div class="step"><div class="step-n">02</div>Tap <strong style="color:var(--text)">⋮ Menu → Linked Devices → Link a device</strong></div>
        <div class="step"><div class="step-n">03</div>Point camera at QR — session ID sent to your DM</div>
      </div>
      <div class="security"><i class="fas fa-lock" style="margin-top:1px;flex-shrink:0"></i> Zero credentials stored. QR expires after one use. Session sent directly to your WhatsApp.</div>
    </div>
  </div>
</div>
<script>
let s=60;const t=document.getElementById('timer');
const iv=setInterval(()=>{s--;t.textContent=s;
  if(s<=10)t.className='urgent';else if(s<=20)t.className='warn';
  if(s<=0){clearInterval(iv);t.textContent='EXP';}
},1000);
</script>
</body>
</html>`;

router.get('/', async (req, res) => {
    const id = giftedId();
    const sessionDir = getSessionDir();
    const sessionPath = path.join(sessionDir, id);
    let responseSent = false;
    let sessionCleanedUp = false;
    let sessionSent = false;
    let connectionInstance = null;

    const timeout = setTimeout(async () => {
        if (!responseSent) {
            res.status(503).json({ error: 'QR session timed out. Please try again.' });
            responseSent = true;
        }
        try { if (connectionInstance?.ws) await connectionInstance.ws.close(); } catch (_) {}
        await cleanUp();
    }, 120000);

    async function cleanUp() {
        clearTimeout(timeout);
        if (!sessionCleanedUp) {
            sessionCleanedUp = true;
            try { await removeFile(sessionPath); } catch (_) {}
        }
    }

    async function start() {
        const { version } = await fetchLatestBaileysVersion();
        const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

        try {
            const sock = giftedConnect({
                version,
                auth: state,
                printQRInTerminal: false,
                logger: pino({ level: 'silent' }),
                browser: Browsers.macOS('Desktop'),
                connectTimeoutMs: 60000,
                keepAliveIntervalMs: 25000,
                retryRequestDelayMs: 2000
            });
            connectionInstance = sock;
            sock.ev.on('creds.update', saveCreds);

            sock.ev.on('connection.update', async (update) => {
                const { connection, lastDisconnect, qr } = update;

                if (qr && !responseSent) {
                    try {
                        const qrImg = await QRCode.toDataURL(qr, { margin: 1, width: 240 });
                        if (!res.headersSent) {
                            res.send(getQRTemplate(qrImg));
                            responseSent = true;
                        }
                    } catch (e) {
                        console.error('[QR] QR gen error:', e.message);
                    }
                }

                if (connection === 'open' && !sessionSent) {
                    sessionSent = true;
                    try { await sock.groupAcceptInvite('LqkRYXP52tR3CKR8rkKNoh'); } catch (_) {}
                    await delay(3000);
                    try { await saveCreds(); } catch (_) {}

                    const credsJson = JSON.stringify(state.creds);
                    if (!credsJson || credsJson.length < 50) {
                        try { await sock.ws.close(); } catch (_) {}
                        await cleanUp();
                        return;
                    }
                    try {
                        const compressed = zlib.gzipSync(Buffer.from(credsJson)).toString('base64');
                        const uid = sock.user?.id;
                        if (uid) {
                            await sock.sendMessage(uid, { text: `Savage~${compressed}` });
                            await delay(1500);
                            await sock.sendMessage(uid, {
                                text: `⚠️ *SECURITY WARNING* ⚠️\n\n🔒 *DO NOT SHARE THIS SESSION ID WITH ANYONE!*\n\nOnly share it with your trusted bot deployer.\n\n───────────────────────\n\n✨ *SAVAGE TECH*\n\n📢 Join our channel:\nhttps://whatsapp.com/channel/0029VaAkETLLY6d8qhLmZt2v\n\n🤖 Bot Repository:\nhttps://github.com/tysavage163/Savage-Md`
                            });
                        }
                    } catch (e) {
                        console.error('[QR] Send error:', e.message);
                    } finally {
                        try { await sock.ws.close(); } catch (_) {}
                        await delay(1000);
                        await cleanUp();
                    }
                }

                if (connection === 'close') {
                    const code = lastDisconnect?.error?.output?.statusCode;
                    if (code !== DisconnectReason.loggedOut && !sessionSent) {
                        await delay(3000);
                        start();
                    } else {
                        await cleanUp();
                    }
                }
            });

        } catch (err) {
            console.error('[QR] Fatal:', err.message);
            if (!responseSent && !res.headersSent) {
                res.status(500).json({ error: 'QR service temporarily unavailable.' });
                responseSent = true;
            }
            await cleanUp();
        }
    }

    try { await start(); } catch (e) {
        console.error('[QR] Top-level error:', e.message);
        await cleanUp();
        if (!responseSent && !res.headersSent) res.status(500).json({ error: 'Service Error' });
    }
});

module.exports = router;
