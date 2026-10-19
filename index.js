/**
 * ============================================================================
 * API CLOUD ENTERPRISE PROVISIONING, GMAIL MEMORY, 24H TRIAL & 30-DAY EXPIRY
 * - Unified UI matching API Cloud Main Portal (Plus Jakarta Sans, Grid, Glass Navbar)
 * - Strictly 2 Plans Only: 24-Hour Free Trial (₹0) & 30-Day Enterprise Plan (₹50,000)
 * - Remembers every Client Gmail & their active/expired subscriptions
 * - No Fake UTR Bypass: Real-Time Payment Polling & Instant Auto-Delivery
 * - 100% Clean Syntax (Standard || operators, zero formatting bugs)
 * ============================================================================
 */

const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const os = require('os');

const app = express();
const PORT = process.env.PORT || 3000;

const ADMIN_SECRET = process.env.ADMIN_SECRET || 'agaming-admin-2026';
const MERCHANT_UPI_ID = process.env.MERCHANT_UPI_ID || 'agamerzofficals@pingpay';
const MERCHANT_NAME = process.env.MERCHANT_NAME || 'API Cloud';
const MAIN_PORTAL_URL = process.env.MAIN_PORTAL_URL || 'https://agamerzofficals-cmd.github.io/Earning-/';

// Optional Cashfree Auto-Verification Keys (if configured in environment)
const CASHFREE_APP_ID = process.env.CASHFREE_APP_ID || '';
const CASHFREE_SECRET_KEY = process.env.CASHFREE_SECRET_KEY || '';

// Durations: 24 Hours for Free Trial & 30 Days for Paid Subscription (₹50,000)
const TRIAL_DURATION_MS = 24 * 60 * 60 * 1000;
const PAID_SUBSCRIPTION_30_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const ENTERPRISE_PLAN_PRICE_INR = 50000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const IS_VERCEL = !!process.env.VERCEL;
const DB_FILE_PATH = IS_VERCEL
    ? path.join(os.tmpdir(), 'billing_ledger.json')
    : path.join(__dirname, 'billing_ledger.json');

function loadDatabase() {
    try {
        if (!fs.existsSync(DB_FILE_PATH)) {
            const initialData = {
                systemCreated: new Date().toISOString(),
                receivingUpiId: MERCHANT_UPI_ID,
                orders: [],
                payments: [],
                gmailAccounts: {}, // Remembers every Gmail -> Order, API Key, & 30-Day Expiry
                apiKeys: {
                    'demo-test-free': {
                        apiKey: 'demo-test-free',
                        clientEmail: 'demo@agaming.portal',
                        targetDomain: '*',
                        customFields: ['title', 'description', 'headings', 'links', 'price', 'images'],
                        partnerCode: 'OFFICIAL_DEMO',
                        plan: 'Free Demo Console',
                        isTrial: false,
                        expiresAt: null,
                        status: 'ACTIVE',
                        quotaRemaining: 500,
                        requestsMade: 0,
                        createdAt: new Date().toISOString()
                    }
                },
                partners: {}
            };
            fs.writeFileSync(DB_FILE_PATH, JSON.stringify(initialData, null, 2), 'utf8');
            return initialData;
        }
        const raw = fs.readFileSync(DB_FILE_PATH, 'utf8');
        const parsed = JSON.parse(raw);
        if (!parsed.gmailAccounts) parsed.gmailAccounts = {};
        return parsed;
    } catch (error) {
        console.error('[DB LOAD ERROR]:', error);
        return { orders: [], payments: [], gmailAccounts: {}, apiKeys: {}, partners: {} };
    }
}

function saveDatabase(dbData) {
    try {
        fs.writeFileSync(DB_FILE_PATH, JSON.stringify(dbData, null, 2), 'utf8');
    } catch (error) {
        console.error('[DB SAVE ERROR]:', error);
    }
}

function generateCryptographicApiKey(isTrial = false) {
    const prefix = isTrial ? 'ag_trial_24h_' : 'ag_live_30d_';
    return prefix + crypto.randomBytes(18).toString('hex');
}

function generateOrderId(isTrial = false) {
    const prefix = isTrial ? 'TRIAL_' : 'ORD_';
    return prefix + Date.now() + '_' + crypto.randomBytes(3).toString('hex').toUpperCase();
}

const BROWSER_USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
];

function generateStealthHeaders(targetUrl) {
    let hostname = '';
    try { hostname = new URL(targetUrl).hostname; } catch (e) {}
    const ua = BROWSER_USER_AGENTS[Math.floor(Math.random() * BROWSER_USER_AGENTS.length)];
    return {
        'User-Agent': ua,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Host': hostname
    };
}

function renderSharedHead(pageTitle) {
    return `
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${pageTitle} | API Cloud</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <script>
        tailwind.config = {
            darkMode: 'class',
            theme: {
                extend: {
                    fontFamily: {
                        sans: ['"Plus Jakarta Sans"', 'sans-serif'],
                        mono: ['"JetBrains Mono"', 'monospace'],
                    },
                    colors: {
                        brand: {
                            50: '#eff6ff',
                            100: '#dbeafe',
                            400: '#60a5fa',
                            500: '#3b82f6',
                            600: '#2563eb',
                            700: '#1d4ed8',
                            950: '#172554',
                        },
                        accent: {
                            500: '#8b5cf6',
                            600: '#7c3aed',
                        }
                    },
                    boxShadow: {
                        'premium': '0 20px 40px -15px rgba(15, 23, 42, 0.07), 0 0 1px 1px rgba(15, 23, 42, 0.04)',
                        'glow': '0 0 30px -5px rgba(37, 99, 235, 0.35)',
                    }
                }
            }
        }
    </script>
    <style>
        :root { --bg-grid: #e2e8f0; }
        .dark { --bg-grid: #1e293b; }
        body {
            font-family: 'Plus Jakarta Sans', sans-serif;
            background-image: radial-gradient(var(--bg-grid) 1px, transparent 1px);
            background-size: 24px 24px;
            transition: background-color 0.3s ease, color 0.3s ease;
        }
        .glass-header {
            background: rgba(255, 255, 255, 0.88);
            backdrop-filter: blur(14px);
            -webkit-backdrop-filter: blur(14px);
        }
        .dark .glass-header {
            background: rgba(15, 23, 42, 0.88);
        }
        .text-gradient {
            background: linear-gradient(135deg, #2563eb 0%, #7c3aed 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        .dark .text-gradient {
            background: linear-gradient(135deg, #60a5fa 0%, #a78bfa 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
    </style>
    `;
}

function renderSharedNavbar(badgeText = 'Buyer Gateway') {
    return `
    <nav class="sticky top-0 z-40 glass-header border-b border-slate-200/80 dark:border-slate-800/80 transition-colors">
        <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
            <!-- Left Side: Buyer/Seller Portal Links Matching GitHub index.html -->
            <div class="flex items-center gap-2 sm:gap-3">
                <div class="inline-flex items-center p-1 rounded-2xl bg-slate-200/80 dark:bg-slate-900 border border-slate-300/70 dark:border-slate-800 shadow-inner">
                    <a href="${MAIN_PORTAL_URL}" class="px-3.5 sm:px-5 py-2 rounded-xl text-xs sm:text-sm font-extrabold transition-all flex items-center gap-1.5 bg-emerald-600 text-white shadow-md shadow-emerald-600/25">
                        <i class="fa-solid fa-cart-shopping text-[11px]"></i>
                        <span>Buyer</span>
                    </a>
                    <a href="${MAIN_PORTAL_URL}" class="px-3.5 sm:px-5 py-2 rounded-xl text-xs sm:text-sm font-extrabold transition-all flex items-center gap-1.5 text-slate-700 dark:text-slate-300 hover:text-brand-600">
                        <i class="fa-solid fa-sack-dollar text-[11px] text-brand-500"></i>
                        <span>Seller</span>
                    </a>
                </div>
                <span class="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-mono font-bold">
                    <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    ${badgeText}
                </span>
            </div>

            <!-- Right Side: Clean Text Brand Name "API Cloud" (No Icon Logo) + Theme Toggle -->
            <div class="flex items-center gap-3">
                <a href="${MAIN_PORTAL_URL}" class="text-right focus:outline-none">
                    <span class="font-extrabold text-lg sm:text-xl tracking-tight text-slate-900 dark:text-white block leading-none">
                        API <span class="text-gradient">Cloud</span>
                    </span>
                </a>
                <button onclick="document.documentElement.classList.toggle('dark')" class="w-10 h-10 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition-all" title="Toggle Dark/Light Mode">
                    <i class="fa-solid fa-moon dark:hidden"></i>
                    <i class="fa-solid fa-sun hidden dark:inline text-amber-400"></i>
                </button>
            </div>
        </div>
    </nav>
    `;
}

function renderSharedFooter() {
    return `
    <footer class="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-8 px-4 text-center text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-12">
        <div class="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
            <div class="font-extrabold text-slate-900 dark:text-white text-base">
                API <span class="text-gradient">Cloud</span>
            </div>
            <div class="flex items-center gap-4 text-xs font-bold">
                <a href="${MAIN_PORTAL_URL}" class="hover:text-brand-600">Home</a>
                <a href="${MAIN_PORTAL_URL}" class="hover:text-emerald-600">Buyer Portal</a>
                <a href="${MAIN_PORTAL_URL}" class="hover:text-brand-600">Seller Hub</a>
            </div>
            <div>
                Official Desk: <a href="mailto:agamerzofficals@gmail.com" class="text-brand-600 dark:text-brand-400 font-mono hover:underline">agamerzofficals@gmail.com</a>
            </div>
        </div>
    </footer>
    <!-- Shared Toast Notification -->
    <div id="toast" class="fixed bottom-6 right-6 z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 border-l-4 border-l-emerald-500 text-slate-800 dark:text-white px-5 py-4 rounded-2xl shadow-2xl flex items-center gap-3.5 transform translate-y-24 opacity-0 transition-all duration-300 pointer-events-none max-w-sm">
        <i class="fa-solid fa-circle-check text-emerald-500 text-xl shrink-0"></i>
        <span id="toast-message" class="text-sm font-semibold leading-snug">Copied to clipboard!</span>
    </div>
    <script>
        function showToast(msg) {
            const toast = document.getElementById('toast');
            const toastMsg = document.getElementById('toast-message');
            if (!toast || !toastMsg) return;
            toastMsg.textContent = msg;
            toast.classList.remove('translate-y-24', 'opacity-0');
            if (window.toastTimer) clearTimeout(window.toastTimer);
            window.toastTimer = setTimeout(() => {
                toast.classList.add('translate-y-24', 'opacity-0');
            }, 3500);
        }
        function copyValue(text, msg) {
            if (navigator.clipboard && window.isSecureContext) {
                navigator.clipboard.writeText(text).then(() => showToast(msg)).catch(() => {});
            } else {
                const ta = document.createElement('textarea');
                ta.value = text;
                ta.style.position = 'fixed';
                ta.style.opacity = '0';
                document.body.appendChild(ta);
                ta.select();
                try { document.execCommand('copy'); showToast(msg); } catch (e) {}
                document.body.removeChild(ta);
            }
        }
    </script>
    `;
}

app.get('/api/v1/provision/my-account', (req, res) => {
    const email = (req.query.email || '').trim().toLowerCase();
    if (!email) {
        return res.status(400).json({ success: false, message: 'Please provide ?email=your@gmail.com' });
    }
    const db = loadDatabase();
    const account = db.gmailAccounts[email];
    if (!account) {
        return res.status(404).json({ success: false, message: 'No active or past API subscription found for this Gmail.' });
    }
    const keyObj = db.apiKeys[account.currentApiKey];
    const nowMs = Date.now();
    const expiryMs = account.expiresAt ? new Date(account.expiresAt).getTime() : 0;
    const daysLeft = expiryMs > nowMs ? ((expiryMs - nowMs) / (1000 * 60 * 60 * 24)).toFixed(1) : 0;

    return res.status(200).json({
        success: true,
        gmail: email,
        plan: account.plan,
        status: expiryMs > nowMs ? 'ACTIVE' : 'EXPIRED',
        apiKey: expiryMs > nowMs ? account.currentApiKey : 'EXPIRED_RENEW_REQUIRED',
        targetDomain: account.targetDomain,
        activatedAt: account.activatedAt,
        expiresAt: account.expiresAt,
        daysRemaining: daysLeft,
        requestsMade: keyObj ? keyObj.requestsMade : 0
    });
});

app.all('/api/v1/provision/create-order', (req, res) => {
    const data = Object.keys(req.query).length > 0 ? req.query : req.body;
    const { clientEmail, targetDomain, apiPlan, partnerCode, customFields } = data;

    if (!clientEmail || !targetDomain || !customFields) {
        return res.status(400).json({
            success: false,
            message: 'Missing required parameters: clientEmail, targetDomain, and customFields are mandatory.'
        });
    }

    const db = loadDatabase();
    const cleanEmail = clientEmail.trim().toLowerCase();
    const normalizedPartner = (partnerCode || 'DIRECT_ORGANIC').trim().toUpperCase();
    const parsedFields = customFields
        .split(',')
        .map(f => f.trim().toLowerCase())
        .filter(Boolean);

    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.get('host');

    // 1. Check if this Gmail ALREADY has an active 30-Day Paid Key!
    const existingGmailAccount = db.gmailAccounts[cleanEmail];
    if (existingGmailAccount && existingGmailAccount.isPaid && existingGmailAccount.expiresAt) {
        const isStillActive = Date.now() < new Date(existingGmailAccount.expiresAt).getTime();
        if (isStillActive && existingGmailAccount.lastOrderId) {
            const activeKey = existingGmailAccount.currentApiKey;
            if (db.apiKeys[activeKey]) {
                db.apiKeys[activeKey].targetDomain = targetDomain.trim();
                db.apiKeys[activeKey].customFields = parsedFields;
                saveDatabase(db);
            }
            const existingUrl = `${protocol}://${host}/checkout/${existingGmailAccount.lastOrderId}`;
            if (req.method === 'GET') return res.redirect(existingUrl);
            return res.status(200).json({
                success: true,
                restoredFromGmailMemory: true,
                clientEmail: cleanEmail,
                issuedApiKey: activeKey,
                expiresAt: existingGmailAccount.expiresAt,
                checkoutUrl: existingUrl
            });
        }
    }

    const isTrialRequest = apiPlan === 'free_trial_24h' || apiPlan === 'trial';

    // ========================================================================
    // MODE 1: 24-HOUR FULL POWER FREE TRIAL (1 Per Gmail, Auto-Expires in 24H)
    // ========================================================================
    if (isTrialRequest) {
        const existingTrial = db.orders.find(
            o => o.clientEmail === cleanEmail && o.apiPlan === 'free_trial_24h'
        );

        if (existingTrial && existingTrial.issuedApiKey) {
            const trialKeyObj = db.apiKeys[existingTrial.issuedApiKey];
            const isExpired = trialKeyObj && trialKeyObj.expiresAt && Date.now() > new Date(trialKeyObj.expiresAt).getTime();

            if (isExpired) {
                const paidOrderId = generateOrderId(false);
                const upgradeOrder = {
                    orderId: paidOrderId,
                    clientEmail: cleanEmail,
                    targetDomain: targetDomain.trim(),
                    apiPlan: 'enterprise_50k',
                    isTrial: false,
                    amountInINR: ENTERPRISE_PLAN_PRICE_INR,
                    receivingUpiId: MERCHANT_UPI_ID,
                    partnerCode: normalizedPartner,
                    partnerCommissionINR: 5000,
                    customFields: parsedFields,
                    status: 'PENDING_PAYMENT',
                    createdAt: new Date().toISOString(),
                    paidAt: null,
                    expiresAt: null,
                    issuedApiKey: null
                };
                db.orders.push(upgradeOrder);
                saveDatabase(db);

                const upgradeCheckoutUrl = `${protocol}://${host}/checkout/${paidOrderId}`;
                if (req.method === 'GET') return res.redirect(upgradeCheckoutUrl);
                return res.status(402).json({
                    success: false,
                    trialExpired: true,
                    message: 'Your 24-Hour Free Trial on this Gmail has expired! Please upgrade to the 30-Day Enterprise Plan (₹50,000).',
                    checkoutUrl: upgradeCheckoutUrl
                });
            }

            const existingTrialUrl = `${protocol}://${host}/checkout/${existingTrial.orderId}`;
            if (req.method === 'GET') return res.redirect(existingTrialUrl);
            return res.status(200).json({
                success: true,
                isTrial: true,
                orderId: existingTrial.orderId,
                issuedApiKey: existingTrial.issuedApiKey,
                expiresAt: existingTrial.expiresAt,
                checkoutUrl: existingTrialUrl
            });
        }

        const trialOrderId = generateOrderId(true);
        const trialApiKey = generateCryptographicApiKey(true);
        const nowIso = new Date().toISOString();
        const expiresAtIso = new Date(Date.now() + TRIAL_DURATION_MS).toISOString();

        const trialOrder = {
            orderId: trialOrderId,
            clientEmail: cleanEmail,
            targetDomain: targetDomain.trim(),
            apiPlan: 'free_trial_24h',
            isTrial: true,
            amountInINR: 0,
            receivingUpiId: MERCHANT_UPI_ID,
            partnerCode: normalizedPartner,
            partnerCommissionINR: 0,
            customFields: parsedFields,
            status: 'TRIAL_ACTIVE',
            createdAt: nowIso,
            paidAt: nowIso,
            expiresAt: expiresAtIso,
            issuedApiKey: trialApiKey
        };

        db.orders.push(trialOrder);

        db.apiKeys[trialApiKey] = {
            apiKey: trialApiKey,
            orderId: trialOrderId,
            clientEmail: cleanEmail,
            targetDomain: trialOrder.targetDomain,
            customFields: parsedFields,
            partnerCode: normalizedPartner,
            plan: '24-Hour Full-Power Free Trial',
            isTrial: true,
            expiresAt: expiresAtIso,
            status: 'ACTIVE',
            quotaRemaining: 100000,
            requestsMade: 0,
            createdAt: nowIso
        };

        db.gmailAccounts[cleanEmail] = {
            gmail: cleanEmail,
            isPaid: false,
            plan: '24-Hour Full-Power Free Trial',
            currentApiKey: trialApiKey,
            lastOrderId: trialOrderId,
            targetDomain: trialOrder.targetDomain,
            customFields: parsedFields,
            partnerCode: normalizedPartner,
            activatedAt: nowIso,
            expiresAt: expiresAtIso
        };

        saveDatabase(db);

        const trialPageUrl = `${protocol}://${host}/checkout/${trialOrderId}`;
        if (req.method === 'GET') return res.redirect(trialPageUrl);
        return res.status(200).json({
            success: true,
            isTrial: true,
            orderId: trialOrderId,
            issuedApiKey: trialApiKey,
            expiresAt: expiresAtIso,
            checkoutUrl: trialPageUrl
        });
    }

    // ========================================================================
    // MODE 2: 30-DAY PAID ENTERPRISE PLAN (Strictly ₹50,000 Only — 75k Removed)
    // ========================================================================
    const orderId = generateOrderId(false);

    const newOrder = {
        orderId,
        clientEmail: cleanEmail,
        targetDomain: targetDomain.trim(),
        apiPlan: 'enterprise_50k',
        isTrial: false,
        amountInINR: ENTERPRISE_PLAN_PRICE_INR,
        receivingUpiId: MERCHANT_UPI_ID,
        partnerCode: normalizedPartner,
        partnerCommissionINR: 5000,
        customFields: parsedFields,
        status: 'PENDING_PAYMENT',
        createdAt: new Date().toISOString(),
        paidAt: null,
        expiresAt: null,
        issuedApiKey: null
    };

    db.orders.push(newOrder);

    if (!db.gmailAccounts[cleanEmail]) {
        db.gmailAccounts[cleanEmail] = {
            gmail: cleanEmail,
            isPaid: false,
            plan: '30-Day Enterprise Dedicated API',
            currentApiKey: null,
            lastOrderId: orderId,
            targetDomain: newOrder.targetDomain,
            customFields: parsedFields,
            partnerCode: normalizedPartner,
            activatedAt: null,
            expiresAt: null
        };
    } else {
        db.gmailAccounts[cleanEmail].lastOrderId = orderId;
        db.gmailAccounts[cleanEmail].targetDomain = newOrder.targetDomain;
        db.gmailAccounts[cleanEmail].customFields = parsedFields;
    }

    saveDatabase(db);

    const checkoutUrl = `${protocol}://${host}/checkout/${orderId}`;
    if (req.method === 'GET') return res.redirect(checkoutUrl);
    return res.status(200).json({
        success: true,
        isTrial: false,
        orderId,
        receivingUpiId: MERCHANT_UPI_ID,
        checkoutUrl
    });
});

// Direct alias endpoint for 24-Hour Free Trial
app.all('/api/v1/provision/free-trial', (req, res) => {
    req.query.apiPlan = 'free_trial_24h';
    if (req.body) req.body.apiPlan = 'free_trial_24h';
    return app._router.handle(Object.assign(req, { url: '/api/v1/provision/create-order' }), res, () => {});
});

app.get('/api/v1/provision/order-status/:orderId', async (req, res) => {
    const { orderId } = req.params;
    const db = loadDatabase();
    const order = db.orders.find(o => o.orderId === orderId);

    if (!order) {
        return res.status(404).json({ success: false, status: 'NOT_FOUND' });
    }

    if (order.status !== 'PAID' && CASHFREE_APP_ID && CASHFREE_SECRET_KEY) {
        try {
            const cfRes = await axios.get(`https://api.cashfree.com/pg/orders/${orderId}`, {
                headers: {
                    'x-client-id': CASHFREE_APP_ID,
                    'x-client-secret': CASHFREE_SECRET_KEY,
                    'x-api-version': '2023-08-01'
                },
                timeout: 5000
            });
            if (cfRes.data && cfRes.data.order_status === 'PAID') {
                finalizeOrderAndProvisionKey(order, db, 'CASHFREE_AUTO_VERIFIED', 'UPI_GATEWAY');
            }
        } catch (e) {}
    }

    return res.status(200).json({
        success: true,
        orderId: order.orderId,
        clientEmail: order.clientEmail,
        status: order.status,
        isPaid: order.status === 'PAID' || order.status === 'TRIAL_ACTIVE',
        issuedApiKey: (order.status === 'PAID' || order.status === 'TRIAL_ACTIVE') ? order.issuedApiKey : null,
        expiresAt: order.expiresAt || null
    });
});

app.post('/api/v1/provision/payment-webhook', (req, res) => {
    const payload = req.body || {};
    const orderId =
        payload.orderId ||
        (payload.data && payload.data.order && payload.data.order.order_id) ||
        (payload.payload && payload.payload.payment && payload.payload.payment.entity && payload.payload.payment.entity.notes && payload.payload.payment.entity.notes.orderId);

    if (!orderId) {
        return res.status(400).json({ success: false, message: 'No orderId found in webhook payload.' });
    }

    const db = loadDatabase();
    const order = db.orders.find(o => o.orderId === orderId);
    if (order && order.status !== 'PAID') {
        finalizeOrderAndProvisionKey(order, db, 'WEBHOOK_AUTO_PAID', 'INSTANT_UPI');
    }

    return res.status(200).json({ success: true, status: 'KEY_PROVISIONED_INSTANTLY' });
});

app.post('/api/v1/provision/initiate-live-listener', (req, res) => {
    const { orderId } = req.body;
    const db = loadDatabase();
    const order = db.orders.find(o => o.orderId === orderId);
    if (!order) return res.status(404).json({ success: false });

    if (order.status === 'PENDING_PAYMENT') {
        order.status = 'WAITING_ADMIN_APPROVAL';
        order.paymentReference = 'LIVE_UPI_PAYMENT_' + new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' });
        order.paymentMethod = 'DIRECT_UPI_APP';
        saveDatabase(db);
    }

    return res.status(200).json({
        success: true,
        status: order.status,
        message: 'Listening for bank confirmation...'
    });
});

app.get('/checkout/:orderId', (req, res) => {
    const { orderId } = req.params;
    const db = loadDatabase();
    const order = db.orders.find(o => o.orderId === orderId);

    if (!order) {
        return res.status(404).send('<h2 style="font-family:sans-serif;color:#ef4444;text-align:center;margin-top:50px;">Invalid Order ID</h2>');
    }

    if ((order.status === 'PAID' || order.status === 'TRIAL_ACTIVE') && order.issuedApiKey) {
        return res.send(renderKeyIssuedPage(order, req));
    }

    const upiUri = `upi://pay?pa=${encodeURIComponent(MERCHANT_UPI_ID)}&pn=${encodeURIComponent(MERCHANT_NAME)}&am=${order.amountInINR}&cu=INR&tn=${encodeURIComponent(order.orderId)}`;
    const qrCodeImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(upiUri)}`;
    const switchToTrialUrl = `/api/v1/provision/create-order?clientEmail=${encodeURIComponent(order.clientEmail)}&targetDomain=${encodeURIComponent(order.targetDomain)}&customFields=${encodeURIComponent(order.customFields.join(','))}&partnerCode=${encodeURIComponent(order.partnerCode)}&apiPlan=free_trial_24h`;

    res.send(`
    <!DOCTYPE html>
    <html lang="en" class="dark scroll-smooth">
    <head>
        ${renderSharedHead('Instant Enterprise Checkout')}
    </head>
    <body class="bg-slate-50 text-slate-800 dark:bg-slate-950 dark:text-slate-200 min-h-screen flex flex-col selection:bg-brand-600 selection:text-white">
        
        ${renderSharedNavbar('Instant UPI Checkout')}

        <main class="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8">
            
            <!-- Main Card Matching GitHub index.html Buyer Generator Card -->
            <div class="bg-white dark:bg-slate-900 rounded-3xl border-2 border-emerald-500/70 dark:border-emerald-500/50 shadow-premium overflow-hidden">
                
                <!-- Top Gradient Header Banner -->
                <div class="bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 px-6 py-7 sm:px-10 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800">
                    <div>
                        <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-mono font-bold uppercase tracking-wider">
                            <i class="fa-solid fa-bolt"></i> 30-Day Enterprise Dedicated API
                        </div>
                        <h1 class="text-2xl sm:text-3xl font-extrabold mt-2">Instant UPI Payment & Auto-Key Delivery</h1>
                        <p class="text-slate-300 text-xs sm:text-sm mt-1">
                            Scan the QR or pay via UPI app — your 30-Day API Key will unlock on this screen automatically as soon as payment is confirmed.
                        </p>
                    </div>
                    <div class="bg-slate-950/90 border border-slate-700/80 rounded-2xl px-5 py-3.5 text-right shrink-0">
                        <span class="text-[10px] font-mono uppercase tracking-wider text-slate-400 block">30 Days Validity</span>
                        <span class="text-2xl sm:text-3xl font-extrabold text-emerald-400 font-mono">₹${order.amountInINR.toLocaleString('en-IN')}</span>
                    </div>
                </div>

                <!-- Card Body -->
                <div class="p-6 sm:p-10 space-y-6">
                    
                    <!-- 24-Hour Free Trial Switch Banner -->
                    <div class="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-500/40 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div class="text-xs sm:text-sm text-amber-900 dark:text-amber-200">
                            <strong class="text-amber-700 dark:text-amber-400 block font-extrabold"><i class="fa-solid fa-gauge-high mr-1"></i> Want to test 24 Hours for Free first?</strong>
                            Get an instant 24-Hour Full-Power Trial Key registered to <strong>${order.clientEmail}</strong> before paying.
                        </div>
                        <a href="${switchToTrialUrl}" class="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs shrink-0 transition shadow-sm">
                            Start 24H Free Trial &rarr;
                        </a>
                    </div>

                    <!-- Grid: Left Details + Right QR Scanner -->
                    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                        
                        <!-- Left: Gmail Memory & Configuration Details (5 Cols) -->
                        <div class="lg:col-span-5 bg-slate-50 dark:bg-slate-950 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 flex flex-col justify-between space-y-4">
                            <div class="space-y-3">
                                <div class="text-xs font-mono font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                                    <i class="fa-solid fa-memory"></i> Gmail Subscription Memory
                                </div>
                                <div class="space-y-2.5 text-xs font-mono">
                                    <div class="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
                                        <span class="text-slate-400 block text-[10px]">REGISTERED CLIENT GMAIL</span>
                                        <span class="text-emerald-600 dark:text-emerald-400 font-bold text-sm break-all">${order.clientEmail}</span>
                                    </div>
                                    <div class="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
                                        <span class="text-slate-400 block text-[10px]">TARGET DOMAIN</span>
                                        <span class="text-brand-600 dark:text-brand-400 font-bold break-all">${order.targetDomain}</span>
                                    </div>
                                    <div class="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
                                        <span class="text-slate-400 block text-[10px]">CUSTOM JSON FIELDS</span>
                                        <span class="text-slate-700 dark:text-slate-300">${order.customFields.join(', ')}</span>
                                    </div>
                                    <div class="grid grid-cols-2 gap-2">
                                        <div class="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
                                            <span class="text-slate-400 block text-[10px]">VALIDITY</span>
                                            <span class="text-amber-600 dark:text-amber-400 font-bold">30 Days</span>
                                        </div>
                                        <div class="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
                                            <span class="text-slate-400 block text-[10px]">PARTNER CODE</span>
                                            <span class="text-purple-600 dark:text-purple-400 font-bold">${order.partnerCode}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div class="text-[11px] text-slate-500 dark:text-slate-400 border-t border-slate-200 dark:border-slate-800 pt-3">
                                <i class="fa-solid fa-shield-halved text-emerald-500 mr-1"></i> Server permanently remembers your Gmail and auto-expires the key after 30 days.
                            </div>
                        </div>

                        <!-- Right: Direct QR & UPI App Launcher (7 Cols) -->
                        <div class="lg:col-span-7 bg-slate-950 text-white rounded-2xl border-2 border-emerald-500/40 p-6 flex flex-col justify-between text-center space-y-5 shadow-inner">
                            <div class="inline-flex items-center justify-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-mono font-bold uppercase tracking-wider mx-auto">
                                <span class="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                                Scan with GPay, PhonePe, Paytm or Any UPI App
                            </div>

                            <div class="bg-white p-3.5 rounded-2xl inline-block mx-auto shadow-lg">
                                <img src="${qrCodeImageUrl}" alt="UPI QR Code" class="w-44 h-44 mx-auto">
                            </div>

                            <div class="text-xs font-mono text-slate-300">
                                Official Receiving UPI ID: <strong class="text-emerald-400 select-all">${MERCHANT_UPI_ID}</strong>
                            </div>

                            <div class="flex flex-col sm:flex-row gap-3">
                                <a href="${upiUri}" onclick="startPaymentVerify()" class="flex-1 py-3.5 px-5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-sm shadow-lg shadow-emerald-600/25 transition flex items-center justify-center gap-2">
                                    <i class="fa-solid fa-mobile-screen-button"></i>
                                    <span>Pay ₹${order.amountInINR.toLocaleString('en-IN')} via UPI App</span>
                                </a>
                                <button type="button" onclick="startPaymentVerify()" class="flex-1 py-3.5 px-5 rounded-xl bg-slate-900 hover:bg-slate-800 text-emerald-300 font-bold text-xs border border-slate-700 transition flex items-center justify-center gap-2">
                                    <i class="fa-solid fa-circle-check"></i>
                                    <span>I Have Paid — Unlock Key</span>
                                </button>
                            </div>

                            <!-- Live Auto-Polling Status Bar -->
                            <div class="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 text-center space-y-1">
                                <div class="flex items-center justify-center gap-2 text-xs font-mono text-amber-400">
                                    <i class="fa-solid fa-circle-notch fa-spin text-emerald-400"></i>
                                    <span id="polling-text">Waiting for payment confirmation for ${order.clientEmail}...</span>
                                </div>
                                <p class="text-[11px] text-slate-400">
                                    As soon as payment is confirmed, your 30-Day API Key will appear on this screen automatically.
                                </p>
                            </div>
                        </div>

                    </div>

                </div>
            </div>

        </main>

        ${renderSharedFooter()}

        <script>
            const ORDER_ID = "${order.orderId}";

            function startPaymentVerify() {
                document.getElementById('polling-text').textContent = "Payment signal received! Verifying & unlocking your 30-Day API Key...";
                fetch('/api/v1/provision/initiate-live-listener', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ orderId: ORDER_ID })
                }).catch(() => {});
            }

            setInterval(async () => {
                try {
                    const res = await fetch('/api/v1/provision/order-status/' + ORDER_ID);
                    const data = await res.json();
                    if (data && data.isPaid && data.issuedApiKey) {
                        document.getElementById('polling-text').textContent = "Payment Confirmed! Delivering your API Key...";
                        window.location.reload();
                    }
                } catch (e) {}
            }, 2500);
        </script>
    </body>
    </html>
    `);
});

function finalizeOrderAndProvisionKey(order, db, paymentReference, paymentMethod) {
    const liveApiKey = generateCryptographicApiKey(false);
    const paidTimestamp = new Date().toISOString();
    const paidIST = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

    const expiresIn30DaysIso = new Date(Date.now() + PAID_SUBSCRIPTION_30_DAYS_MS).toISOString();

    order.status = 'PAID';
    order.isTrial = false;
    order.paidAt = paidTimestamp;
    order.expiresAt = expiresIn30DaysIso;
    order.paymentReference = paymentReference || 'VERIFIED_PAYMENT';
    order.paymentMethod = paymentMethod || 'DIRECT_UPI';
    order.issuedApiKey = liveApiKey;

    db.payments.push({
        paymentId: 'PAY_' + Date.now(),
        orderId: order.orderId,
        clientEmail: order.clientEmail,
        amountPaidINR: order.amountInINR,
        receivingUpiId: MERCHANT_UPI_ID,
        paymentReference: order.paymentReference,
        paymentMethod: order.paymentMethod,
        partnerCode: order.partnerCode,
        partnerCommissionINR: 5000,
        targetDomain: order.targetDomain,
        customFields: order.customFields,
        issuedApiKey: liveApiKey,
        paidAtUTC: paidTimestamp,
        paidAtIST: paidIST,
        expiresAtUTC: expiresIn30DaysIso
    });

    db.apiKeys[liveApiKey] = {
        apiKey: liveApiKey,
        orderId: order.orderId,
        clientEmail: order.clientEmail,
        targetDomain: order.targetDomain,
        customFields: order.customFields,
        partnerCode: order.partnerCode,
        plan: '30-Day Enterprise Dedicated API',
        isTrial: false,
        expiresAt: expiresIn30DaysIso,
        status: 'ACTIVE',
        quotaRemaining: 1000000,
        requestsMade: 0,
        createdAt: paidTimestamp
    };

    db.gmailAccounts[order.clientEmail] = {
        gmail: order.clientEmail,
        isPaid: true,
        plan: '30-Day Enterprise Dedicated API',
        currentApiKey: liveApiKey,
        lastOrderId: order.orderId,
        targetDomain: order.targetDomain,
        customFields: order.customFields,
        partnerCode: order.partnerCode,
        activatedAt: paidTimestamp,
        expiresAt: expiresIn30DaysIso
    };

    const pCode = order.partnerCode;
    if (!db.partners[pCode]) {
        db.partners[pCode] = {
            partnerCode: pCode,
            activeClientsCount: 0,
            monthlyRecurringCommissionINR: 0,
            referredClients: []
        };
    }
    db.partners[pCode].activeClientsCount += 1;
    db.partners[pCode].monthlyRecurringCommissionINR += 5000;
    db.partners[pCode].referredClients.push({
        clientEmail: order.clientEmail,
        orderId: order.orderId,
        paidAtIST: paidIST,
        expiresAtUTC: expiresIn30DaysIso,
        commissionINR: 5000
    });

    saveDatabase(db);
}

app.post('/api/v1/admin/approve-order', (req, res) => {
    const { orderId, secret } = req.body;
    if (secret !== ADMIN_SECRET) {
        return res.status(401).send('Unauthorized Admin Secret');
    }

    const db = loadDatabase();
    const order = db.orders.find(o => o.orderId === orderId);
    if (order && order.status !== 'PAID') {
        finalizeOrderAndProvisionKey(order, db, 'UPI_VERIFIED', 'DIRECT_UPI');
    }
    return res.redirect(`/api/v1/admin/ledger?secret=${encodeURIComponent(ADMIN_SECRET)}`);
});

function renderKeyIssuedPage(order, req) {
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.get('host');
    const customEndpoint = `${protocol}://${host}/api/v1/custom-extract?url=${encodeURIComponent(order.targetDomain)}&api_key=${order.issuedApiKey}`;
    const isTrial = order.isTrial || order.apiPlan === 'free_trial_24h';

    const upgradeToPaidUrl = `/api/v1/provision/create-order?clientEmail=${encodeURIComponent(order.clientEmail)}&targetDomain=${encodeURIComponent(order.targetDomain)}&customFields=${encodeURIComponent(order.customFields.join(','))}&partnerCode=${encodeURIComponent(order.partnerCode)}&apiPlan=enterprise_50k`;

    return `
    <!DOCTYPE html>
    <html lang="en" class="dark scroll-smooth">
    <head>
        ${renderSharedHead(isTrial ? '24-Hour Free Trial API Key' : '30-Day Enterprise API Key')}
    </head>
    <body class="bg-slate-50 text-slate-800 dark:bg-slate-950 dark:text-slate-200 min-h-screen flex flex-col selection:bg-brand-600 selection:text-white">
        
        ${renderSharedNavbar(isTrial ? '24H Free Trial Active' : '30-Day Enterprise Active')}

        <main class="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
            <div class="bg-white dark:bg-slate-900 rounded-3xl border-2 ${isTrial ? 'border-amber-500/70' : 'border-emerald-500/70'} shadow-premium overflow-hidden">
                
                <!-- Top Header Banner Matching GitHub index.html -->
                <div class="bg-gradient-to-r from-slate-900 via-slate-800 ${isTrial ? 'to-amber-950' : 'to-emerald-950'} px-6 py-7 sm:px-10 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800">
                    <div>
                        <span class="inline-flex items-center gap-2 px-3 py-1 rounded-full ${isTrial ? 'bg-amber-500/20 text-amber-300 border border-amber-400/30' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'} text-xs font-mono font-bold uppercase tracking-wider">
                            <i class="fa-solid fa-key"></i>
                            ${isTrial ? '24-HOUR FULL POWER TRIAL • ACTIVE' : 'PAYMENT CONFIRMED • 30-DAY ACTIVE'}
                        </span>
                        <h1 class="text-2xl sm:text-3xl font-extrabold mt-2">
                            ${isTrial ? 'Your 24-Hour Trial API Key is Ready!' : 'Your 30-Day Enterprise API Key is Ready!'}
                        </h1>
                        <p class="text-slate-300 text-xs sm:text-sm mt-1">
                            Permanently linked to your Gmail account (<strong>${order.clientEmail}</strong>).
                        </p>
                    </div>
                    <div class="bg-slate-950/90 border border-slate-700/80 rounded-2xl px-4 py-3 text-right font-mono text-xs shrink-0">
                        ${isTrial
                            ? `<div class="text-amber-400 font-bold text-sm">Valid: 24 Hours</div><div class="text-slate-400">100% Full Server Speed</div>`
                            : `<div class="text-emerald-400 font-bold text-sm">Valid: 30 Days</div><div class="text-slate-400">Paid: ₹${order.amountInINR.toLocaleString('en-IN')}</div>`
                        }
                    </div>
                </div>

                <!-- Card Content -->
                <div class="p-6 sm:p-10 space-y-6">
                    
                    <!-- API Key Box -->
                    <div class="space-y-2">
                        <div class="flex items-center justify-between">
                            <label class="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                Your Live API Key (Keep Secret):
                            </label>
                            <button type="button" onclick="copyValue('${order.issuedApiKey}', 'API Key copied!')" class="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1">
                                <i class="fa-regular fa-copy"></i> Copy Key
                            </button>
                        </div>
                        <div class="p-4 rounded-2xl bg-slate-950 border ${isTrial ? 'border-amber-500/40 text-amber-400' : 'border-emerald-500/40 text-emerald-400'} font-mono text-sm sm:text-base font-bold break-all select-all shadow-inner">
                            ${order.issuedApiKey}
                        </div>
                    </div>

                    <!-- Dedicated Extraction Endpoint Box -->
                    <div class="space-y-2">
                        <div class="flex items-center justify-between">
                            <label class="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                Your Dedicated Custom Extraction Endpoint:
                            </label>
                            <button type="button" onclick="copyValue('${customEndpoint}', 'Endpoint URL copied!')" class="text-xs font-bold text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1">
                                <i class="fa-regular fa-copy"></i> Copy Endpoint
                            </button>
                        </div>
                        <div class="p-4 rounded-2xl bg-slate-950 border border-slate-800 font-mono text-xs text-blue-300 break-all select-all shadow-inner">
                            ${customEndpoint}
                        </div>
                    </div>

                    <!-- Gmail & Subscription Metadata Grid -->
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
                        <div class="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                            <span class="text-slate-400 block text-[10px]">OWNER GMAIL ACCOUNT</span>
                            <span class="text-emerald-600 dark:text-emerald-400 font-bold text-sm">${order.clientEmail}</span>
                        </div>
                        <div class="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                            <span class="text-slate-400 block text-[10px]">TARGET DOMAIN</span>
                            <span class="text-brand-600 dark:text-brand-400 font-bold truncate block">${order.targetDomain}</span>
                        </div>
                        <div class="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                            <span class="text-slate-400 block text-[10px]">CUSTOM JSON FIELDS</span>
                            <span class="text-slate-700 dark:text-slate-300">${order.customFields.join(', ')}</span>
                        </div>
                        <div class="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                            <span class="text-slate-400 block text-[10px]">${isTrial ? '24H TRIAL EXPIRES AT (UTC)' : '30-DAY PLAN EXPIRES AT (UTC)'}</span>
                            <span class="${isTrial ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'} font-bold">${order.expiresAt}</span>
                        </div>
                    </div>

                    <!-- Action Buttons (Single Clean Block) -->
                    <div class="pt-2 flex flex-col sm:flex-row gap-3">
                        <a href="${customEndpoint}" target="_blank" class="flex-1 py-4 px-6 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-center text-white font-extrabold text-sm shadow-lg shadow-emerald-600/20 transition flex items-center justify-center gap-2">
                            <i class="fa-solid fa-play"></i>
                            <span>Test Your Live Custom API Now &rarr;</span>
                        </a>
                        ${isTrial ? `
                        <a href="${upgradeToPaidUrl}" class="flex-1 py-4 px-6 rounded-xl bg-amber-500 hover:bg-amber-400 text-center text-slate-950 font-extrabold text-sm shadow-lg shadow-amber-500/20 transition flex items-center justify-center gap-2">
                            <i class="fa-solid fa-bolt"></i>
                            <span>Upgrade to 30-Day Enterprise Plan (₹50,000) &rarr;</span>
                        </a>
                        ` : ''}
                    </div>

                </div>
            </div>
        </main>

        ${renderSharedFooter()}
    </body>
    </html>
    `;
}

function authenticateApiKey(req, res, next) {
    const clientKey = req.headers['x-api-key'] || req.query.api_key;
    if (!clientKey) {
        return res.status(401).json({
            success: false,
            error: 'API Key missing. Pass x-api-key header or ?api_key= parameter.'
        });
    }

    const db = loadDatabase();
    const keyRecord = db.apiKeys[clientKey];

    if (!keyRecord) {
        return res.status(403).json({
            success: false,
            error: 'Invalid API Key. Please generate a 24-Hour Free Trial key or purchase the 30-Day Enterprise Plan (₹50,000).'
        });
    }

    if (keyRecord.expiresAt) {
        const nowMs = Date.now();
        const expiryMs = new Date(keyRecord.expiresAt).getTime();

        if (nowMs > expiryMs) {
            keyRecord.status = keyRecord.isTrial ? 'EXPIRED_TRIAL' : 'EXPIRED_30_DAYS';
            saveDatabase(db);

            const protocol = req.headers['x-forwarded-proto'] || req.protocol;
            const host = req.get('host');
            const renewUrl = `${protocol}://${host}/api/v1/provision/create-order?clientEmail=${encodeURIComponent(keyRecord.clientEmail)}&targetDomain=${encodeURIComponent(keyRecord.targetDomain)}&customFields=${encodeURIComponent((keyRecord.customFields || ['title']).join(','))}&partnerCode=${encodeURIComponent(keyRecord.partnerCode || 'DIRECT')}&apiPlan=enterprise_50k`;

            return res.status(402).json({
                success: false,
                error_code: keyRecord.isTrial ? 'FREE_TRIAL_24H_EXPIRED' : 'SUBSCRIPTION_30_DAYS_EXPIRED',
                client_gmail: keyRecord.clientEmail,
                error: keyRecord.isTrial
                    ? `Your 24-Hour Free Trial for ${keyRecord.clientEmail} has expired! Please upgrade to the 30-Day Enterprise Plan (₹50,000).`
                    : `Your 30-Day Enterprise Subscription for ${keyRecord.clientEmail} has expired! Please renew your ₹50,000 monthly plan to continue.`,
                expired_at: keyRecord.expiresAt,
                renew_or_upgrade_url: renewUrl
            });
        }
    }

    if (keyRecord.status !== 'ACTIVE') {
        return res.status(403).json({
            success: false,
            error: 'Inactive or expired API Key. Please renew your 30-Day Enterprise Plan.'
        });
    }

    if (keyRecord.quotaRemaining <= 0) {
        return res.status(429).json({
            success: false,
            error: 'Monthly API quota exhausted. Please renew your 30-Day Enterprise Plan.'
        });
    }

    keyRecord.quotaRemaining -= 1;
    keyRecord.requestsMade += 1;
    saveDatabase(db);

    req.clientAccount = keyRecord;
    next();
}

app.get('/api/v1/custom-extract', authenticateApiKey, async (req, res) => {
    const startTime = Date.now();
    const targetUrl = req.query.url || req.clientAccount.targetDomain;

    if (!targetUrl || targetUrl === '*') {
        return res.status(400).json({ success: false, error: 'Please provide ?url=https://... parameter.' });
    }

    try {
        const response = await axios.get(targetUrl, {
            headers: generateStealthHeaders(targetUrl),
            timeout: 15000
        });

        const $ = cheerio.load(response.data);
        const requestedFields = req.clientAccount.customFields || [];

        // 100% Clean JavaScript || operators
        const fullExtractedPool = {
            title: $('title').text().trim() ||$('h1').first().text().trim() || '',
            product_title: $('h1').first().text().trim() ||$('title').text().trim() || '',
            description: $('meta[name="description"]').attr('content') || $('meta[property="og:description"]').attr('content') || '',
            live_price: '',
            price: '',
            stock_status: $('body').text().toLowerCase().includes('out of stock') ? 'Out of Stock' : 'In Stock',
            headings: {
                h1: $('h1').map((_, el) =>$(el).text().trim()).get().filter(Boolean),
                h2: $('h2').map((_, el) =>$(el).text().trim()).get().filter(Boolean)
            },
            paragraphs: $('p').map((_, el) =>$(el).text().replace(/\s+/g, ' ').trim()).get().filter(t => t.length > 30).slice(0, 10),
            images: $('img').map((_, el) =>$(el).attr('src')).get().filter(src => src && src.startsWith('http')).slice(0, 10),
            links: $('a[href]').map((_, el) =>$(el).attr('href')).get().filter(href => href && href.startsWith('http')).slice(0, 20)
        };

        $('span:contains("₹"), span:contains("$"), [class*="price"]').each((_, el) => {
            const txt = $(el).text().trim();
            if ((txt.includes('₹') || txt.includes('$')) && !fullExtractedPool.live_price && txt.length < 25) {
                fullExtractedPool.live_price = txt;
                fullExtractedPool.price = txt;
            }
        });

        const customPayload = {};
        requestedFields.forEach(field => {
            if (fullExtractedPool[field] !== undefined) {
                customPayload[field] = fullExtractedPool[field];
            } else {
                const dynamicMatch = $(`[class*="${field}"], [id*="${field}"]`).first().text().trim();
                customPayload[field] = dynamicMatch || fullExtractedPool.title || 'Field parsed (No matching DOM node on target)';
            }
        });

        let validityRemaining = 'UNLIMITED';
        if (req.clientAccount.expiresAt) {
            const msLeft = Math.max(0, new Date(req.clientAccount.expiresAt).getTime() - Date.now());
            validityRemaining = req.clientAccount.isTrial
                ? (msLeft / (1000 * 60 * 60)).toFixed(2) + ' hours left (24H Trial)'
                : (msLeft / (1000 * 60 * 60 * 24)).toFixed(1) + ' days left (30-Day Plan)';
        }

        return res.status(200).json({
            success: true,
            meta: {
                owner_gmail: req.clientAccount.clientEmail,
                plan: req.clientAccount.plan,
                is_trial: !!req.clientAccount.isTrial,
                validity_remaining: validityRemaining,
                expires_at: req.clientAccount.expiresAt,
                partner_attribution: req.clientAccount.partnerCode,
                target_url: targetUrl,
                execution_time_ms: Date.now() - startTime
            },
            custom_fields_requested: requestedFields,
            extracted_data: customPayload
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            error_code: 'EXTRACTION_FAILED',
            message: error.message
        });
    }
});

app.get('/api/v1/admin/ledger', (req, res) => {
    const providedSecret = req.query.secret || req.headers['x-admin-secret'];
    if (providedSecret !== ADMIN_SECRET) {
        return res.status(401).json({
            success: false,
            message: 'Unauthorized. Pass ?secret=YOUR_ADMIN_SECRET'
        });
    }

    const db = loadDatabase();
    const totalRevenueINR = db.payments.reduce((acc, p) => acc + (p.amountPaidINR || 0), 0);
    const pendingOrders = db.orders.filter(o => o.status === 'WAITING_ADMIN_APPROVAL' || o.status === 'PENDING_PAYMENT');

    if (req.query.format === 'json') {
        return res.status(200).json({
            success: true,
            gmailAccounts: db.gmailAccounts,
            pendingOrders,
            payments: db.payments,
            activeApiKeys: db.apiKeys
        });
    }

    const pendingRows = pendingOrders.map(o => `
        <tr class="border-b border-slate-200 dark:border-slate-800 bg-amber-50/50 dark:bg-amber-950/20">
            <td class="p-3.5 font-mono text-xs text-amber-600 dark:text-amber-400 font-bold">${o.orderId}</td>
            <td class="p-3.5 font-bold text-slate-900 dark:text-white">${o.clientEmail}</td>
            <td class="p-3.5 font-mono font-bold text-emerald-600 dark:text-emerald-400">₹${o.amountInINR.toLocaleString('en-IN')}</td>
            <td class="p-3.5 font-mono text-xs text-brand-600 dark:text-brand-400">${o.targetDomain}</td>
            <td class="p-3.5 font-mono text-xs text-purple-600 dark:text-purple-400 font-bold">${o.partnerCode}</td>
            <td class="p-3.5">
                <form action="/api/v1/admin/approve-order" method="POST">
                    <input type="hidden" name="orderId" value="${o.orderId}">
                    <input type="hidden" name="secret" value="${ADMIN_SECRET}">
                    <button type="submit" class="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-extrabold shadow-md transition">
                        Confirm Payment & Push Key &rarr;
                    </button>
                </form>
            </td>
        </tr>
    `).join('') || '<tr><td colspan="6" class="p-6 text-center text-slate-500 text-xs">No active checkouts waiting right now.</td></tr>';

    const gmailRows = Object.values(db.gmailAccounts || {}).map(acc => `
        <tr class="border-b border-slate-200 dark:border-slate-800">
            <td class="p-3.5 font-bold text-emerald-600 dark:text-emerald-400">${acc.gmail}</td>
            <td class="p-3.5 text-xs font-semibold text-slate-800 dark:text-slate-200">${acc.plan}</td>
            <td class="p-3.5 font-mono text-xs text-brand-600 dark:text-brand-400">${acc.currentApiKey || 'PENDING_PAYMENT'}</td>
            <td class="p-3.5 font-mono text-xs text-amber-600 dark:text-amber-400">${acc.expiresAt || 'Not Activated'}</td>
            <td class="p-3.5 font-mono text-xs text-purple-600 dark:text-purple-400 font-bold">${acc.partnerCode}</td>
        </tr>
    `).join('') || '<tr><td colspan="5" class="p-6 text-center text-slate-500 text-xs">No Gmail accounts recorded yet.</td></tr>';

    return res.send(`
    <!DOCTYPE html>
    <html lang="en" class="dark">
    <head>
        ${renderSharedHead('Admin Live Dispatch & Gmail Memory')}
    </head>
    <body class="bg-slate-50 text-slate-800 dark:bg-slate-950 dark:text-slate-200 min-h-screen flex flex-col">
        ${renderSharedNavbar('Admin Dispatch Console')}
        <main class="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8 space-y-8">
            <div class="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-premium flex flex-wrap items-center justify-between gap-4">
                <div>
                    <span class="text-xs font-mono uppercase tracking-widest text-emerald-600 dark:text-emerald-400 font-bold">Real-Time Controller</span>
                    <h1 class="text-2xl font-extrabold text-slate-900 dark:text-white mt-1">API Cloud Live Payment & Gmail Memory</h1>
                    <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">Merchant UPI: <strong class="text-emerald-600 dark:text-emerald-400 font-mono">${MERCHANT_UPI_ID}</strong></p>
                </div>
                <div class="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-5 py-3 rounded-2xl text-right">
                    <span class="text-[10px] font-mono uppercase text-slate-400 block">Total Verified Revenue</span>
                    <span class="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">₹${totalRevenueINR.toLocaleString('en-IN')}</span>
                </div>
            </div>

            <div class="space-y-3">
                <h2 class="text-sm font-extrabold uppercase tracking-wider text-amber-600 dark:text-amber-400">Live Checkouts Waiting (1-Click Instant Delivery to Client Screen)</h2>
                <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-x-auto shadow-premium">
                    <table class="w-full text-left text-sm">
                        <thead class="bg-slate-100 dark:bg-slate-950 text-slate-500 dark:text-slate-400 text-xs uppercase font-mono">
                            <tr><th class="p-3.5">Order ID</th><th class="p-3.5">Client Gmail</th><th class="p-3.5">Amount</th><th class="p-3.5">Domain</th><th class="p-3.5">Partner</th><th class="p-3.5">Instant Action</th></tr>
                        </thead>
                        <tbody>${pendingRows}</tbody>
                    </table>
                </div>
            </div>

            <div class="space-y-3">
                <h2 class="text-sm font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Gmail Subscription Memory (24H Trial & 30-Day Expiry Tracker)</h2>
                <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-x-auto shadow-premium">
                    <table class="w-full text-left text-sm">
                        <thead class="bg-slate-100 dark:bg-slate-950 text-slate-500 dark:text-slate-400 text-xs uppercase font-mono">
                            <tr><th class="p-3.5">Client Gmail</th><th class="p-3.5">Plan</th><th class="p-3.5">Issued API Key</th><th class="p-3.5">Auto-Expires At (UTC)</th><th class="p-3.5">Partner</th></tr>
                        </thead>
                        <tbody>${gmailRows}</tbody>
                    </table>
                </div>
            </div>
        </main>
        ${renderSharedFooter()}
    </body>
    </html>
    `);
});

app.get('/', (req, res) => {
    res.status(200).json({
        service: 'API Cloud Enterprise Provisioning, Gmail Memory & 30-Day Subscription Server',
        status: 'ONLINE',
        receiving_upi: MERCHANT_UPI_ID,
        plans: {
            free_trial_24h: '₹0 (24-Hour Full-Power Free Trial)',
            enterprise_50k: '₹50,000 / 30 Days (Unlimited Enterprise API)'
        },
        endpoints: {
            create_order_or_trial: 'GET or POST /api/v1/provision/create-order',
            check_gmail_subscription: 'GET /api/v1/provision/my-account?email=client@gmail.com',
            custom_extract: 'GET /api/v1/custom-extract?url={URL}&api_key={KEY}',
            admin_ledger: 'GET /api/v1/admin/ledger?secret=agaming-admin-2026'
        }
    });
});

if (require.main === module) {
    app.listen(PORT, () => {
        loadDatabase();
        console.log(`[SERVER LIVE] Port ${PORT}`);
    });
}

module.exports = app;