/**
 * ============================================================================
 * API CLOUD SUBSCRIPTION GATEWAY, GMAIL MEMORY, 24H TRIAL & 30-DAY EXPIRY
 * - ZERO axios, ZERO cheerio, ZERO local scraping!
 * - Pure Subscription, API Key Generation & Payment Server
 * - Uses the EXACT fetch() + 'x-api-key': 'demo-test-free' logic from your HTML
 *   to get 100% verbatim, unbroken data from:
 *   https://agamm-aga.onrender.com/api/v1/extract?url=...
 * ============================================================================
 */

const express = require('express');
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

// Exact Remote API Configuration from your HTML file
const REMOTE_API_EXTRACT_URL = 'https://agamm-aga.onrender.com/api/v1/extract';
const SYSTEM_API_KEY = 'demo-test-free';

// Optional Cashfree Auto-Verification Keys (if configured in environment)
const CASHFREE_APP_ID = process.env.CASHFREE_APP_ID || '';
const CASHFREE_SECRET_KEY = process.env.CASHFREE_SECRET_KEY || '';

// Durations: 24 Hours for Free Trial & 30 Days for Paid Subscription (₹50,000)
const TRIAL_DURATION_MS = 24 * 60 * 60 * 1000;
const PAID_SUBSCRIPTION_30_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const ENTERPRISE_PLAN_PRICE_INR = 50000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

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
                lifetimeFreeTrialEmails: {}, // Strictly 1 Free Trial per Email for Lifetime
                orders: [],
                payments: [],
                gmailAccounts: {}, // Remembers every Gmail -> Order, API Key, & 30-Day Expiry
                apiKeys: {
                    'demo-test-free': {
                        apiKey: 'demo-test-free',
                        clientEmail: 'demo@agaming.portal',
                        targetDomain: 'ANY_WEBSITE_UNLIMITED',
                        customFields: ['all'],
                        partnerCode: 'OFFICIAL_DEMO',
                        plan: 'Free Demo Console',
                        isTrial: false,
                        expiresAt: null,
                        status: 'ACTIVE',
                        quotaRemaining: null,
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
        if (!parsed.lifetimeFreeTrialEmails) parsed.lifetimeFreeTrialEmails = {};
        return parsed;
    } catch (error) {
        console.error('[DB LOAD ERROR]:', error);
        return {
            lifetimeFreeTrialEmails: {},
            orders: [],
            payments: [],
            gmailAccounts: {},
            apiKeys: {},
            partners: {}
        };
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
                        'premium': '0 20px 40px -15px rgba(15, 23, 42, 0.08), 0 0 1px 1px rgba(15, 23, 42, 0.05)',
                        'glow': '0 0 30px -5px rgba(37, 99, 235, 0.3)',
                    }
                }
            }
        }
    </script>
    <style>
        body {
            font-family: 'Plus Jakarta Sans', sans-serif;
            background: linear-gradient(135deg, #f8fafc 0%, #eff6ff 50%, #f0fdf4 100%);
            transition: background-color 0.3s ease, color 0.3s ease;
        }
        .dark body {
            background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #022c22 100%);
        }
        .glass-header {
            background: rgba(255, 255, 255, 0.92);
            backdrop-filter: blur(14px);
            -webkit-backdrop-filter: blur(14px);
        }
        .dark .glass-header {
            background: rgba(15, 23, 42, 0.90);
        }
        .text-gradient {
            background: linear-gradient(135deg, #2563eb 0%, #10b981 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        .dark .text-gradient {
            background: linear-gradient(135deg, #60a5fa 0%, #34d399 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        pre {
            white-space: pre-wrap !important;
            word-wrap: break-word !important;
            word-break: break-all !important;
            overflow-wrap: anywhere !important;
        }
    </style>
    `;
}

function renderSharedNavbar(badgeText = 'Customer Portal') {
    return `
    <nav class="sticky top-0 z-40 glass-header border-b border-slate-200/80 dark:border-slate-800/80 transition-colors">
        <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
            <div class="flex items-center gap-2 sm:gap-3">
                <div class="inline-flex items-center p-1 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700">
                    <a href="${MAIN_PORTAL_URL}" class="px-3.5 sm:px-5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 bg-blue-600 text-white shadow-sm">
                        <i class="fa-solid fa-house text-[11px]"></i>
                        <span>API Cloud Home</span>
                    </a>
                </div>
                <span class="hidden md:inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-semibold">
                    <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
                    ${badgeText}
                </span>
            </div>

            <div class="flex items-center gap-3">
                <a href="${MAIN_PORTAL_URL}" class="text-right focus:outline-none">
                    <span class="font-extrabold text-lg sm:text-xl tracking-tight text-slate-900 dark:text-white block leading-none">
                        API <span class="text-gradient">Cloud</span>
                    </span>
                </a>
                <button onclick="document.documentElement.classList.toggle('dark')" class="w-10 h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center transition-all shadow-sm" title="Switch Light/Dark Theme">
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
    <footer class="border-t border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 py-8 px-4 text-center text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-12">
        <div class="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
            <div class="font-extrabold text-slate-900 dark:text-white text-base">
                API <span class="text-gradient">Cloud</span>
            </div>
            <div class="flex items-center gap-4 text-xs font-semibold">
                <a href="${MAIN_PORTAL_URL}" class="hover:text-blue-600">Home</a>
                <a href="${MAIN_PORTAL_URL}" class="hover:text-emerald-600">Buyer Store</a>
                <a href="${MAIN_PORTAL_URL}" class="hover:text-blue-600">Partner Hub</a>
            </div>
            <div>
                Support Desk: <a href="mailto:agamerzofficals@gmail.com" class="text-blue-600 dark:text-blue-400 font-semibold hover:underline">agamerzofficals@gmail.com</a>
            </div>
        </div>
    </footer>
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
        extractionScope: 'ANY_WEBSITE_UNLIMITED',
        activatedAt: account.activatedAt,
        expiresAt: account.expiresAt,
        daysRemaining: daysLeft,
        requestsMade: keyObj ? keyObj.requestsMade : 0
    });
});

// Create Order or Activate 24H Free Trial
app.all('/api/v1/provision/create-order', (req, res) => {
    const data = Object.keys(req.query).length > 0 ? req.query : req.body;
    const { clientEmail, apiPlan, partnerCode, customFields } = data;

    if (!clientEmail) {
        return res.status(400).json({
            success: false,
            message: 'Missing required parameter: clientEmail is mandatory.'
        });
    }

    const db = loadDatabase();
    const cleanEmail = clientEmail.trim().toLowerCase();
    const normalizedPartner = (partnerCode || 'DIRECT_ORGANIC').trim().toUpperCase();
    const rawFields = customFields || 'all';
    const parsedFields = rawFields
        .split(',')
        .map(f => f.trim().toLowerCase())
        .filter(Boolean);

    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.get('host');

    const existingGmailAccount = db.gmailAccounts[cleanEmail];
    if (existingGmailAccount && existingGmailAccount.isPaid && existingGmailAccount.expiresAt) {
        const isStillActive = Date.now() < new Date(existingGmailAccount.expiresAt).getTime();
        if (isStillActive && existingGmailAccount.lastOrderId) {
            const activeKey = existingGmailAccount.currentApiKey;
            if (db.apiKeys[activeKey]) {
                db.apiKeys[activeKey].targetDomain = 'ANY_WEBSITE_UNLIMITED';
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

    if (isTrialRequest) {
        const lifetimeTrialRecord = db.lifetimeFreeTrialEmails[cleanEmail];
        const existingTrial = db.orders.find(
            o => o.clientEmail === cleanEmail && o.apiPlan === 'free_trial_24h'
        );

        if (lifetimeTrialRecord || (existingTrial && existingTrial.issuedApiKey)) {
            const recordedKey = (lifetimeTrialRecord && lifetimeTrialRecord.issuedApiKey) || (existingTrial && existingTrial.issuedApiKey);
            const trialKeyObj = db.apiKeys[recordedKey];
            const isExpired = !trialKeyObj || (trialKeyObj.expiresAt && Date.now() > new Date(trialKeyObj.expiresAt).getTime());

            if (isExpired) {
                const paidOrderId = generateOrderId(false);
                const upgradeOrder = {
                    orderId: paidOrderId,
                    clientEmail: cleanEmail,
                    targetDomain: 'ANY_WEBSITE_UNLIMITED',
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
                return res.status(403).json({
                    success: false,
                    lifetimeTrialAlreadyUsed: true,
                    trialExpired: true,
                    message: `Lifetime Free Trial limit reached for ${cleanEmail}! Only 1 Free API Key is allowed per email in a lifetime. Please upgrade to the 30-Day Enterprise Plan (₹50,000).`,
                    checkoutUrl: upgradeCheckoutUrl
                });
            }

            const existingOrderId = (lifetimeTrialRecord && lifetimeTrialRecord.orderId) || (existingTrial && existingTrial.orderId);
            const existingTrialUrl = `${protocol}://${host}/checkout/${existingOrderId}`;
            if (req.method === 'GET') return res.redirect(existingTrialUrl);
            return res.status(200).json({
                success: true,
                lifetimeTrialAlreadyClaimed: true,
                message: 'You have already claimed your 1 lifetime Free Trial API key on this email. Returning your existing trial key.',
                isTrial: true,
                orderId: existingOrderId,
                issuedApiKey: recordedKey,
                expiresAt: trialKeyObj.expiresAt,
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
            targetDomain: 'ANY_WEBSITE_UNLIMITED',
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

        db.lifetimeFreeTrialEmails[cleanEmail] = {
            email: cleanEmail,
            orderId: trialOrderId,
            issuedApiKey: trialApiKey,
            claimedAt: nowIso,
            expiresAt: expiresAtIso,
            lifetimeFreeQuotaUsed: true
        };

        db.apiKeys[trialApiKey] = {
            apiKey: trialApiKey,
            orderId: trialOrderId,
            clientEmail: cleanEmail,
            targetDomain: 'ANY_WEBSITE_UNLIMITED',
            customFields: parsedFields,
            partnerCode: normalizedPartner,
            plan: '24-Hour Full-Power Free Trial (Unlimited Links & Data)',
            isTrial: true,
            expiresAt: expiresAtIso,
            status: 'ACTIVE',
            quotaRemaining: null,
            requestsMade: 0,
            createdAt: nowIso
        };

        db.gmailAccounts[cleanEmail] = {
            gmail: cleanEmail,
            isPaid: false,
            lifetimeFreeTrialUsed: true,
            plan: '24-Hour Full-Power Free Trial',
            currentApiKey: trialApiKey,
            lastOrderId: trialOrderId,
            targetDomain: 'ANY_WEBSITE_UNLIMITED',
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

    const orderId = generateOrderId(false);

    const newOrder = {
        orderId,
        clientEmail: cleanEmail,
        targetDomain: 'ANY_WEBSITE_UNLIMITED',
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
            targetDomain: 'ANY_WEBSITE_UNLIMITED',
            customFields: parsedFields,
            partnerCode: normalizedPartner,
            activatedAt: null,
            expiresAt: null
        };
    } else {
        db.gmailAccounts[cleanEmail].lastOrderId = orderId;
        db.gmailAccounts[cleanEmail].targetDomain = 'ANY_WEBSITE_UNLIMITED';
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
            const cfRes = await fetch(`https://api.cashfree.com/pg/orders/${orderId}`, {
                headers: {
                    'x-client-id': CASHFREE_APP_ID,
                    'x-client-secret': CASHFREE_SECRET_KEY,
                    'x-api-version': '2023-08-01'
                }
            });
            const cfData = await cfRes.json();
            if (cfData && cfData.order_status === 'PAID') {
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

// ============================================================================
// USER-FRIENDLY CHECKOUT PAGE
// ============================================================================
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
    const switchToTrialUrl = `/api/v1/provision/create-order?clientEmail=${encodeURIComponent(order.clientEmail)}&customFields=${encodeURIComponent(order.customFields.join(','))}&partnerCode=${encodeURIComponent(order.partnerCode)}&apiPlan=free_trial_24h`;

    res.send(`
    <!DOCTYPE html>
    <html lang="en" class="scroll-smooth">
    <head>
        ${renderSharedHead('Complete Your API Subscription')}
    </head>
    <body class="text-slate-800 dark:text-slate-100 min-h-screen flex flex-col">
        
        ${renderSharedNavbar('Secure UPI Checkout')}

        <main class="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8">
            
            <div class="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-premium overflow-hidden">
                
                <div class="bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-600 px-6 py-8 sm:px-10 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 text-white text-xs font-bold uppercase tracking-wider">
                            <i class="fa-solid fa-wand-magic-sparkles"></i> Universal Web Data API • 30 Days
                        </div>
                        <h1 class="text-2xl sm:text-3xl font-extrabold mt-2">Activate Your 30-Day Unlimited API</h1>
                        <p class="text-blue-50 text-xs sm:text-sm mt-1">
                            Scan the QR code with any UPI app. Once confirmed, your API key will appear right here automatically.
                        </p>
                    </div>
                    <div class="bg-white/15 backdrop-blur-md border border-white/25 rounded-2xl px-5 py-3.5 text-right shrink-0">
                        <span class="text-[11px] uppercase tracking-wider text-blue-100 block font-semibold">30 Days Unlimited Plan</span>
                        <span class="text-2xl sm:text-3xl font-extrabold text-white">₹${order.amountInINR.toLocaleString('en-IN')}</span>
                    </div>
                </div>

                <div class="p-6 sm:p-10 space-y-6">
                    
                    <div class="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div class="text-xs sm:text-sm text-amber-900 dark:text-amber-200">
                            <strong class="text-amber-700 dark:text-amber-400 block font-extrabold text-sm mb-0.5"><i class="fa-solid fa-gift mr-1"></i> Want to try it FREE for 24 Hours first?</strong>
                            Start your 24-Hour Free Trial on <strong>${order.clientEmail}</strong> and test unlimited websites right now!
                        </div>
                        <a href="${switchToTrialUrl}" class="px-5 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs sm:text-sm shrink-0 transition shadow-sm">
                            Activate 24H Free Trial &rarr;
                        </a>
                    </div>

                    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                        
                        <div class="lg:col-span-5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-6 border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between space-y-5">
                            <div class="space-y-4">
                                <div class="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 flex items-center gap-2">
                                    <i class="fa-solid fa-circle-check"></i> Your Subscription Summary
                                </div>
                                <div class="space-y-3 text-sm">
                                    <div class="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800">
                                        <span class="text-slate-400 block text-xs">Registered Email Account</span>
                                        <span class="text-slate-900 dark:text-white font-bold break-all">${order.clientEmail}</span>
                                    </div>
                                    <div class="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800">
                                        <span class="text-slate-400 block text-xs">Website Access Scope</span>
                                        <span class="text-emerald-600 dark:text-emerald-400 font-bold"><i class="fa-solid fa-infinity mr-1"></i> Any Website Link (On-Demand Prompt)</span>
                                    </div>
                                    <div class="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800">
                                        <span class="text-slate-400 block text-xs">Data Extraction Limit</span>
                                        <span class="text-blue-600 dark:text-blue-400 font-bold">Unlimited Links & Unlimited Data for 30 Days</span>
                                    </div>
                                </div>
                            </div>

                            <div class="text-xs text-slate-500 dark:text-slate-400 border-t border-slate-200 dark:border-slate-700 pt-3 leading-relaxed">
                                <i class="fa-solid fa-lock text-emerald-500 mr-1"></i> When you open your API in your system, it will ask you for a website link and immediately return the extracted data.
                            </div>
                        </div>

                        <div class="lg:col-span-7 bg-white dark:bg-slate-900 rounded-2xl border-2 border-emerald-500/40 p-6 flex flex-col justify-between text-center space-y-5 shadow-sm">
                            <div class="inline-flex items-center justify-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-xs font-bold mx-auto">
                                <i class="fa-solid fa-qrcode"></i> Scan with Google Pay, PhonePe, Paytm or Any UPI App
                            </div>

                            <div class="bg-white p-4 rounded-2xl inline-block mx-auto border border-slate-200 shadow-md">
                                <img src="${qrCodeImageUrl}" alt="UPI QR Code" class="w-44 h-44 mx-auto">
                            </div>

                            <div class="text-xs text-slate-600 dark:text-slate-300">
                                Official Merchant UPI ID: <strong class="text-emerald-600 dark:text-emerald-400 font-mono select-all">${MERCHANT_UPI_ID}</strong>
                            </div>

                            <div class="flex flex-col sm:flex-row gap-3">
                                <a href="${upiUri}" onclick="startPaymentVerify()" class="flex-1 py-3.5 px-5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm shadow-md transition flex items-center justify-center gap-2">
                                    <i class="fa-solid fa-mobile-screen-button"></i>
                                    <span>Pay ₹${order.amountInINR.toLocaleString('en-IN')} on Mobile</span>
                                </a>
                                <button type="button" onclick="startPaymentVerify()" class="flex-1 py-3.5 px-5 rounded-xl bg-blue-50 dark:bg-slate-800 hover:bg-blue-100 dark:hover:bg-slate-700 text-blue-700 dark:text-blue-300 font-bold text-xs border border-blue-200 dark:border-slate-700 transition flex items-center justify-center gap-2">
                                    <i class="fa-solid fa-circle-check"></i>
                                    <span>I Have Paid — Unlock My API</span>
                                </button>
                            </div>

                            <div class="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 text-center space-y-1">
                                <div class="flex items-center justify-center gap-2 text-xs font-bold text-blue-600 dark:text-blue-400">
                                    <i class="fa-solid fa-circle-notch fa-spin text-emerald-500"></i>
                                    <span id="polling-text">Waiting for payment confirmation for ${order.clientEmail}...</span>
                                </div>
                                <p class="text-[11px] text-slate-500 dark:text-slate-400">
                                    This page refreshes automatically the moment your payment is verified.
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
                        document.getElementById('polling-text').textContent = "Payment Confirmed! Opening your API Dashboard...";
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
        targetDomain: 'ANY_WEBSITE_UNLIMITED',
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
        targetDomain: 'ANY_WEBSITE_UNLIMITED',
        customFields: order.customFields,
        partnerCode: order.partnerCode,
        plan: '30-Day Enterprise Dedicated API (Unlimited Links & Data)',
        isTrial: false,
        expiresAt: expiresIn30DaysIso,
        status: 'ACTIVE',
        quotaRemaining: null,
        requestsMade: 0,
        createdAt: paidTimestamp
    };

    db.gmailAccounts[order.clientEmail] = {
        gmail: order.clientEmail,
        isPaid: true,
        plan: '30-Day Enterprise Dedicated API',
        currentApiKey: liveApiKey,
        lastOrderId: order.orderId,
        targetDomain: 'ANY_WEBSITE_UNLIMITED',
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

// ============================================================================
// USER-FRIENDLY API KEY DELIVERY PAGE
// ============================================================================
function renderKeyIssuedPage(order, req) {
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.get('host');
    const interactiveApiUrl = `${protocol}://${host}/api/v1/custom-extract?api_key=${order.issuedApiKey}`;
    const directJsonExample = `${protocol}://${host}/api/v1/custom-extract?api_key=${order.issuedApiKey}&url=https://example.com`;
    const isTrial = order.isTrial || order.apiPlan === 'free_trial_24h';

    const upgradeToPaidUrl = `/api/v1/provision/create-order?clientEmail=${encodeURIComponent(order.clientEmail)}&customFields=all&partnerCode=${encodeURIComponent(order.partnerCode)}&apiPlan=enterprise_50k`;

    return `
    <!DOCTYPE html>
    <html lang="en" class="scroll-smooth">
    <head>
        ${renderSharedHead(isTrial ? 'Your 24-Hour Free Trial API is Ready' : 'Your 30-Day Unlimited API is Ready')}
    </head>
    <body class="text-slate-800 dark:text-slate-100 min-h-screen flex flex-col">
        
        ${renderSharedNavbar(isTrial ? '24H Free Trial Active' : '30-Day Plan Active')}

        <main class="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
            <div class="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-premium overflow-hidden">
                
                <div class="bg-gradient-to-r ${isTrial ? 'from-amber-500 via-orange-500 to-emerald-600' : 'from-emerald-600 via-teal-600 to-blue-600'} px-6 py-8 sm:px-10 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <span class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 text-white text-xs font-bold uppercase tracking-wider">
                            <i class="fa-solid fa-circle-check"></i>
                            ${isTrial ? '24-Hour Free Trial Activated' : '30-Day Enterprise Plan Activated'}
                        </span>
                        <h1 class="text-2xl sm:text-3xl font-extrabold mt-2">
                            Your Universal Data Extractor API is Ready!
                        </h1>
                        <p class="text-white/90 text-xs sm:text-sm mt-1">
                            Linked to <strong>${order.clientEmail}</strong> • Enter any website link on-demand & extract unlimited data!
                        </p>
                    </div>
                    <div class="bg-white/15 backdrop-blur-md border border-white/25 rounded-2xl px-4 py-3 text-right text-xs shrink-0">
                        ${isTrial
                            ? `<div class="text-white font-extrabold text-sm">Valid: 24 Hours</div><div class="text-white/80">Unlimited Links & Data</div>`
                            : `<div class="text-white font-extrabold text-sm">Valid: 30 Days</div><div class="text-white/80">Unlimited Links & Data</div>`
                        }
                    </div>
                </div>

                <div class="p-6 sm:p-10 space-y-6">
                    
                    <div class="p-5 sm:p-6 rounded-2xl bg-gradient-to-br from-emerald-50 to-blue-50 dark:from-slate-800 dark:to-slate-800/70 border-2 border-emerald-500/40 space-y-4">
                        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div>
                                <span class="text-xs font-extrabold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 block">
                                    <i class="fa-solid fa-wand-magic-sparkles mr-1"></i> Your Interactive API Link (Prompts for Website URL on Open)
                                </span>
                                <p class="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                                    Open this API link in your browser or system—it will ask you to enter any website link and give you instant data!
                                </p>
                            </div>
                            <button type="button" onclick="copyValue('${interactiveApiUrl}', 'Interactive API Link copied!')" class="px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 shrink-0 flex items-center gap-1.5 shadow-sm">
                                <i class="fa-regular fa-copy"></i> Copy My API Link
                            </button>
                        </div>

                        <div class="p-3.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono text-xs sm:text-sm text-blue-600 dark:text-blue-400 font-bold break-all select-all">
                            ${interactiveApiUrl}
                        </div>

                        <div class="flex flex-col sm:flex-row gap-3 pt-1">
                            <a href="${interactiveApiUrl}" class="flex-1 py-4 px-6 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-center text-white font-extrabold text-sm sm:text-base shadow-lg shadow-emerald-600/20 transition flex items-center justify-center gap-2">
                                <i class="fa-solid fa-up-right-from-square"></i>
                                <span>Open My API & Enter Website Link Now &rarr;</span>
                            </a>
                            ${isTrial ? `
                            <a href="${upgradeToPaidUrl}" class="flex-1 py-4 px-6 rounded-xl bg-amber-500 hover:bg-amber-400 text-center text-slate-950 font-extrabold text-sm shadow-md transition flex items-center justify-center gap-2">
                                <i class="fa-solid fa-crown"></i>
                                <span>Upgrade to 30-Day Plan (₹50,000) &rarr;</span>
                            </a>
                            ` : ''}
                        </div>
                    </div>

                    <div class="space-y-2">
                        <div class="flex items-center justify-between">
                            <label class="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                Your Personal API Key:
                            </label>
                            <button type="button" onclick="copyValue('${order.issuedApiKey}', 'API Key copied!')" class="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1">
                                <i class="fa-regular fa-copy"></i> Copy Key
                            </button>
                        </div>
                        <div class="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono text-sm sm:text-base font-bold text-emerald-600 dark:text-emerald-400 break-all select-all">
                            ${order.issuedApiKey}
                        </div>
                    </div>

                    <div class="space-y-2">
                        <div class="flex items-center justify-between">
                            <label class="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                Direct JSON API Call (For Code / System Integration — Pass any ?url=):
                            </label>
                            <button type="button" onclick="copyValue('${directJsonExample}', 'Direct JSON URL copied!')" class="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1">
                                <i class="fa-regular fa-copy"></i> Copy Example
                            </button>
                        </div>
                        <div class="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono text-xs text-slate-600 dark:text-slate-300 break-all select-all">
                            ${directJsonExample}
                        </div>
                    </div>

                    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                        <div class="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800">
                            <span class="text-slate-400 block mb-1">Registered Email</span>
                            <span class="text-slate-900 dark:text-white font-bold text-sm break-all">${order.clientEmail}</span>
                        </div>
                        <div class="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800">
                            <span class="text-slate-400 block mb-1">Allowed Websites & Quota</span>
                            <span class="text-emerald-600 dark:text-emerald-400 font-bold text-sm">Unlimited Websites & Data</span>
                        </div>
                        <div class="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800">
                            <span class="text-slate-400 block mb-1">Subscription Valid Until</span>
                            <span class="text-blue-600 dark:text-blue-400 font-bold text-sm">${new Date(order.expiresAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST</span>
                        </div>
                    </div>

                </div>
            </div>
        </main>

        ${renderSharedFooter()}
    </body>
    </html>
    `;
}

// ============================================================================
// USER-FRIENDLY INTERACTIVE WEB APP (API CLOUD UI + EXACT FETCH CODE FROM HTML)
// ============================================================================
function renderInteractiveExtractorPortal(keyRecord, req) {
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.get('host');
    const apiEndpointBase = protocol + '://' + host + '/api/v1/custom-extract';
    const isTrial = !!keyRecord.isTrial;

    return `
    <!DOCTYPE html>
    <html lang="en" class="scroll-smooth">
    <head>
        ${renderSharedHead('Universal Website Data Extractor')}
    </head>
    <body class="text-slate-800 dark:text-slate-100 min-h-screen flex flex-col">
        ${renderSharedNavbar(isTrial ? 'Free Trial Workspace' : 'Enterprise Workspace')}
        <main class="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-8">
            <div class="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200/90 dark:border-slate-800 shadow-premium">
                <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200/80 dark:border-slate-800">
                    <div>
                        <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-bold">
                            <span class="w-2 h-2 rounded-full bg-emerald-500"></span> API Active • Unlimited Data
                        </div>
                        <h1 class="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mt-2">Enter Any Website Link to Extract Data</h1>
                        <p class="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">Account: <strong>${keyRecord.clientEmail}</strong></p>
                    </div>
                </div>

                <form id="live-extract-form" class="mt-6 space-y-4">
                    <div class="grid grid-cols-1 md:grid-cols-12 gap-4">
                        <div class="md:col-span-8 space-y-1.5">
                            <label for="website_url_input" class="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">Website Link *</label>
                            <div class="relative">
                                <i class="fa-solid fa-globe absolute left-4 top-4 text-blue-500 text-base"></i>
                                <input type="text" id="website_url_input" required placeholder="https://example.com" class="w-full pl-11 pr-4 py-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border-2 border-slate-200 dark:border-slate-800 focus:outline-none text-sm font-medium text-slate-900 dark:text-white">
                            </div>
                        </div>
                        <div class="md:col-span-4 space-y-1.5">
                            <label for="fields_input" class="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">Data Fields</label>
                            <input type="text" id="fields_input" value="all" class="w-full px-4 py-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border-2 border-slate-200 dark:border-slate-800 text-sm font-mono text-slate-800 dark:text-slate-200">
                        </div>
                    </div>
                    <button type="submit" id="extract-submit-btn" class="w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-blue-600 to-emerald-600 text-white font-extrabold text-sm shadow-lg transition flex items-center justify-center gap-2.5">
                        <i class="fa-solid fa-bolt"></i> <span>Extract Website Data Now</span>
                    </button>
                </form>
            </div>

            <div id="results-container" class="hidden space-y-6">
                <div class="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-premium overflow-hidden">
                    <div class="px-6 py-4 bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                        <h2 class="font-extrabold text-sm text-slate-900 dark:text-white">Extracted Data from https://agamm-aga.onrender.com</h2>
                        <button type="button" onclick="copyExtractedJson()" class="px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 text-xs font-bold">Copy JSON</button>
                    </div>
                    <div class="p-6">
                        <pre id="json-output-box" class="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 text-xs font-mono text-slate-800 dark:text-slate-200 overflow-x-auto max-h-[520px]"></pre>
                    </div>
                </div>
            </div>
        </main>
        ${renderSharedFooter()}
        <script>
            const API_KEY = "${keyRecord.apiKey}";
            const BASE_ENDPOINT = "${apiEndpointBase}";
            let lastExtractedData = null;

            document.getElementById('live-extract-form').addEventListener('submit', async (e) => {
                e.preventDefault();
                const targetUrl = document.getElementById('website_url_input').value.trim();
                const customFields = document.getElementById('fields_input').value.trim();
                const btn = document.getElementById('extract-submit-btn');
                if (!targetUrl) return;

                btn.disabled = true;
                btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> <span>Extracting via Remote API...</span>';

                try {
                    const reqUrl = BASE_ENDPOINT + '?api_key=' + encodeURIComponent(API_KEY) + '&url=' + encodeURIComponent(targetUrl) + '&fields=' + encodeURIComponent(customFields) + '&format=json';
                    const res = await fetch(reqUrl);
                    const data = await res.json();
                    lastExtractedData = data;

                    document.getElementById('results-container').classList.remove('hidden');
                    document.getElementById('json-output-box').textContent = JSON.stringify(data, null, 2);
                    document.getElementById('results-container').scrollIntoView({ behavior: 'smooth' });
                } catch (err) {
                    showToast('Failed to extract data.');
                } finally {
                    btn.disabled = false;
                    btn.innerHTML = '<i class="fa-solid fa-bolt"></i> <span>Extract Website Data Now</span>';
                }
            });

            function copyExtractedJson() {
                if (!lastExtractedData) return;
                copyValue(JSON.stringify(lastExtractedData, null, 2), 'JSON copied!');
            }
        </script>
    </body>
    </html>
    `;
}

    const nowMs = Date.now();
    const expiryMs = keyRecord.expiresAt ? new Date(keyRecord.expiresAt).getTime() : 0;
    const timeRemainingText = expiryMs > nowMs
        ? (isTrial
            ? ((expiryMs - nowMs) / (1000 * 60 * 60)).toFixed(1) + ' Hours Remaining'
            : ((expiryMs - nowMs) / (1000 * 60 * 60 * 24)).toFixed(1) + ' Days Remaining')
        : 'Unlimited Active';

    const upgradeUrl = `/api/v1/provision/create-order?clientEmail=${encodeURIComponent(keyRecord.clientEmail)}&customFields=all&apiPlan=enterprise_50k`;

    return `
    <!DOCTYPE html>
    <html lang="en" class="scroll-smooth">
    <head>
        ${renderSharedHead('Universal Website Data Extractor')}
    </head>
    <body class="text-slate-800 dark:text-slate-100 min-h-screen flex flex-col">
        
        ${renderSharedNavbar(isTrial ? '24H Free Trial Workspace' : '30-Day Enterprise Workspace')}

        <main class="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-8">
            
            <!-- Top Subscription & Configuration Card (API Cloud Friendly UI) -->
            <div class="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200/90 dark:border-slate-800 shadow-premium">
                <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200/80 dark:border-slate-800">
                    <div>
                        <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-bold">
                            <span class="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                            Node Online • Unlimited Websites & Data
                        </div>
                        <h1 class="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mt-2">
                            Enter Any Website Link to Extract Data
                        </h1>
                        <p class="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                            Account: <strong class="text-slate-800 dark:text-slate-200">${keyRecord.clientEmail}</strong> • Enter a target URL and click Run Extraction to receive the raw, unbroken response.
                        </p>
                    </div>

                    <div class="flex flex-wrap items-center gap-3 shrink-0">
                        <div class="px-4 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-right">
                            <span class="text-[10px] uppercase tracking-wider text-slate-400 block font-bold">${isTrial ? '24H Free Trial' : '30-Day Subscription'}</span>
                            <span class="text-xs sm:text-sm font-extrabold text-emerald-600 dark:text-emerald-400">${timeRemainingText}</span>
                        </div>
                        ${isTrial ? `
                        <a href="${upgradeUrl}" class="px-4 py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs transition shadow-sm">
                            Upgrade to 30 Days (₹50k) &rarr;
                        </a>
                        ` : ''}
                    </div>
                </div>

                <!-- Target URL + Response Format (JSON / Markdown) from your HTML -->
                <div class="mt-6 space-y-5">
                    <div class="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                        <div class="md:col-span-8 space-y-2">
                            <div class="flex items-center justify-between">
                                <label for="req-url" class="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                                    Target Website URL <span class="text-rose-500">*</span>
                                </label>
                                <span class="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-mono font-bold">GET</span>
                            </div>
                            <div class="relative">
                                <i class="fa-solid fa-globe absolute left-4 top-4 text-blue-500 text-base"></i>
                                <input type="url" id="req-url" placeholder="https://example.com" class="w-full pl-11 pr-4 py-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border-2 border-slate-200 dark:border-slate-800 focus:border-blue-500 focus:outline-none text-sm font-mono text-slate-900 dark:text-white transition-colors">
                            </div>
                        </div>

                        <div class="md:col-span-4 space-y-2">
                            <label class="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                                Response Format
                            </label>
                            <div class="grid grid-cols-2 gap-2 bg-slate-100 dark:bg-slate-950 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800">
                                <button type="button" onclick="setFormat('json')" id="btn-json" class="py-2.5 text-xs font-extrabold rounded-xl bg-blue-600 text-white shadow transition-all">JSON</button>
                                <button type="button" onclick="setFormat('markdown')" id="btn-md" class="py-2.5 text-xs font-extrabold rounded-xl text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all">Markdown</button>
                            </div>
                        </div>
                    </div>

                    <div class="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
                        <button type="button" onclick="executeRequest()" id="btn-execute" class="w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-700 hover:to-emerald-700 active:scale-[0.98] text-white font-extrabold text-sm sm:text-base shadow-lg shadow-blue-600/20 transition-all flex items-center justify-center gap-2.5">
                            <i class="fa-solid fa-play"></i>
                            <span>Run Extraction</span>
                        </button>

                        <div class="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
                            <i class="fa-solid fa-bolt text-amber-500"></i>
                            <span>Direct 1-Second Verbatim Stream from Extraction Node</span>
                        </div>
                    </div>
                </div>

                <!-- Dynamic API Endpoint Bar for System / Code Integration -->
                <div class="mt-6 pt-5 border-t border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl">
                    <div class="space-y-0.5 overflow-hidden">
                        <span class="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">Your Direct API Call for System / Code:</span>
                        <code id="dynamic-api-url" class="text-xs font-mono text-blue-600 dark:text-blue-400 font-bold break-all block">${apiEndpointBase}?api_key=${keyRecord.apiKey}&url=https://example.com</code>
                    </div>
                    <button type="button" onclick="copyValue(document.getElementById('dynamic-api-url').textContent, 'Direct API URL copied!')" class="px-4 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 shrink-0 flex items-center gap-1.5 shadow-sm">
                        <i class="fa-regular fa-copy"></i> Copy API Call
                    </button>
                </div>
            </div>

            <!-- Live Response Output Card (Clean API Cloud UI + Exact Console Logic from your HTML) -->
            <section id="console-section" class="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-premium overflow-hidden">
                
                <!-- Header with Status, Time, Copy & Download -->
                <div class="px-6 py-4 bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                    <div class="flex items-center gap-2.5">
                        <i class="fa-solid fa-code text-blue-600 dark:text-blue-400"></i>
                        <h2 class="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">Extracted Website Data</h2>
                    </div>

                    <div class="flex flex-wrap items-center gap-2 sm:gap-3">
                        <div class="flex items-center gap-1.5 bg-white dark:bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
                            <span class="text-[10px] text-slate-400 uppercase font-bold">Status:</span>
                            <span id="res-status" class="text-xs font-mono font-bold text-slate-500 dark:text-slate-400">WAITING</span>
                        </div>
                        <div class="flex items-center gap-1.5 bg-white dark:bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
                            <span class="text-[10px] text-slate-400 uppercase font-bold">Time:</span>
                            <span id="res-time" class="text-xs font-mono font-bold text-slate-600 dark:text-slate-300">0 ms</span>
                        </div>
                        <button type="button" onclick="copyOutput()" class="px-3.5 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 flex items-center gap-1.5 shadow-sm" title="Copy Output">
                            <i class="fa-regular fa-copy"></i> Copy Data
                        </button>
                        <button type="button" onclick="downloadOutput()" class="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm">
                            <i class="fa-solid fa-download"></i> Download
                        </button>
                    </div>
                </div>

                <!-- Output Body with Loading Overlay -->
                <div class="p-6 relative min-h-[380px]">
                    <div id="loading-overlay" class="absolute inset-0 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm hidden flex-col items-center justify-center z-20">
                        <div class="text-blue-600 text-4xl mb-3 animate-spin">
                            <i class="fa-solid fa-circle-notch"></i>
                        </div>
                        <p class="text-slate-700 dark:text-slate-200 font-semibold text-sm animate-pulse text-center px-4">Establishing connection to target server...</p>
                        <p class="text-slate-400 font-mono text-xs mt-2 truncate w-3/4 text-center" id="loading-url"></p>
                    </div>

                    <pre id="console-output" class="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 text-[13px] sm:text-[14px] leading-relaxed text-slate-700 dark:text-slate-200 font-mono w-full max-h-[600px] overflow-y-auto m-0"><code>// Welcome to API Cloud Extractor Workspace
// 1. Enter any website URL above.
// 2. Click "Run Extraction".
// 3. The complete, unbroken response will appear here in ~1 second.</code></pre>
                </div>
            </section>

        </main>

        ${renderSharedFooter()}

        <script>
            // ====================================================================
            // EXACT DATA RECEIVING CODE FROM YOUR HTML FILE
            // ====================================================================
            let currentFormat = 'json';
            const SYSTEM_API_KEY = 'demo-test-free';
            const USER_API_KEY = "${keyRecord.apiKey}";
            const BASE_ENDPOINT = "${apiEndpointBase}";

            const reqUrlInput = document.getElementById('req-url');
            const dynamicUrlCode = document.getElementById('dynamic-api-url');

            reqUrlInput.addEventListener('input', () => {
                const val = reqUrlInput.value.trim() || 'https://example.com';
                dynamicUrlCode.textContent = BASE_ENDPOINT + '?api_key=' + USER_API_KEY + '&url=' + encodeURIComponent(val);
            });

            function setFormat(format) {
                currentFormat = format;
                const btnJson = document.getElementById('btn-json');
                const btnMd = document.getElementById('btn-md');

                if (format === 'json') {
                    btnJson.className = 'py-2.5 text-xs font-extrabold rounded-xl bg-blue-600 text-white shadow transition-all';
                    btnMd.className = 'py-2.5 text-xs font-extrabold rounded-xl text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all';
                } else {
                    btnMd.className = 'py-2.5 text-xs font-extrabold rounded-xl bg-blue-600 text-white shadow transition-all';
                    btnJson.className = 'py-2.5 text-xs font-extrabold rounded-xl text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all';
                }
            }

            async function executeRequest() {
                const urlInput = document.getElementById('req-url').value.trim();
                
                const btn = document.getElementById('btn-execute');
                const output = document.getElementById('console-output');
                const statusSpan = document.getElementById('res-status');
                const timeSpan = document.getElementById('res-time');
                const overlay = document.getElementById('loading-overlay');
                const overlayUrl = document.getElementById('loading-url');

                if (!urlInput) {
                    showToast('Target URL is required!');
                    document.getElementById('req-url').focus();
                    return;
                }

                if (window.innerWidth < 1024) {
                    document.getElementById('console-section').scrollIntoView({ behavior: 'smooth' });
                }

                btn.disabled = true;
                btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing...';
                
                overlayUrl.textContent = urlInput;
                overlay.classList.remove('hidden');
                overlay.classList.add('flex');
                
                output.textContent = '';
                statusSpan.textContent = 'FETCHING...';
                statusSpan.className = 'text-xs font-mono font-bold text-amber-500';
                timeSpan.textContent = '-- ms';

                const startTime = performance.now();

                try {
                    // Exact request construction from your HTML file pointing to https://agamm-aga.onrender.com/api/v1/extract
                    const apiUrl = 'https://agamm-aga.onrender.com/api/v1/extract?url=' + encodeURIComponent(urlInput);
                    
                    const headers = {};
                    headers['x-api-key'] = SYSTEM_API_KEY;
                    headers['Accept'] = currentFormat === 'json' ? 'application/json' : 'text/markdown';

                    const response = await fetch(apiUrl, { 
                        method: 'GET', 
                        headers: headers 
                    });

                    const endTime = performance.now();
                    timeSpan.textContent = Math.round(endTime - startTime) + ' ms';

                    statusSpan.textContent = response.status + ' ' + response.statusText;
                    if (response.ok) {
                        statusSpan.className = 'text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400';
                    } else {
                        statusSpan.className = 'text-xs font-mono font-bold text-rose-500';
                    }

                    // Verbatim text capture without truncation
                    const rawText = await response.text();
                    
                    if (!rawText) {
                        output.textContent = "// No content returned from server.";
                        return;
                    }

                    if (currentFormat === 'json' && response.ok) {
                        try {
                            const jsonObj = JSON.parse(rawText);
                            output.textContent = JSON.stringify(jsonObj, null, 2);
                        } catch (parseError) {
                            output.textContent = rawText;
                        }
                    } else {
                        output.textContent = rawText;
                    }

                } catch (error) {
                    const endTime = performance.now();
                    timeSpan.textContent = Math.round(endTime - startTime) + ' ms';
                    
                    statusSpan.textContent = 'NETWORK ERROR';
                    statusSpan.className = 'text-xs font-mono font-bold text-rose-500';
                    output.textContent = '// FATAL CLIENT ERROR\\n\\nFailed to reach the server.\\nTechnical Details:\\n' + error.message;
                } finally {
                    overlay.classList.add('hidden');
                    overlay.classList.remove('flex');
                    
                    btn.disabled = false;
                    btn.innerHTML = '<i class="fa-solid fa-play"></i> <span>Run Extraction</span>';
                }
            }

            function copyOutput() {
                const outputText = document.getElementById('console-output').textContent;
                if (!outputText || outputText.startsWith('// Welcome')) {
                    showToast('Nothing to copy yet.');
                    return;
                }
                copyValue(outputText, 'Output copied to clipboard!');
            }

            function downloadOutput() {
                const outputText = document.getElementById('console-output').textContent;
                if (!outputText || outputText.startsWith('// Welcome')) {
                    showToast('Nothing to download yet.');
                    return;
                }
                const ext = currentFormat === 'json' ? '.json' : '.md';
                const mime = currentFormat === 'json' ? 'application/json' : 'text/markdown';
                const blob = new Blob([outputText], { type: mime });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'extracted-data-' + Date.now() + ext;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }

            document.getElementById('req-url').addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    executeRequest();
                }
            });
        </script>
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
            const renewUrl = `${protocol}://${host}/api/v1/provision/create-order?clientEmail=${encodeURIComponent(keyRecord.clientEmail)}&customFields=all&partnerCode=${encodeURIComponent(keyRecord.partnerCode || 'DIRECT')}&apiPlan=enterprise_50k`;

            return res.status(402).json({
                success: false,
                error_code: keyRecord.isTrial ? 'FREE_TRIAL_24H_LIFETIME_USED_AND_EXPIRED' : 'SUBSCRIPTION_30_DAYS_EXPIRED',
                client_gmail: keyRecord.clientEmail,
                error: keyRecord.isTrial
                    ? `Your 1 Lifetime 24-Hour Free Trial for ${keyRecord.clientEmail} has expired! No additional free API keys can be generated on this email. Please upgrade to the 30-Day Enterprise Plan (₹50,000).`
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

    keyRecord.requestsMade = (keyRecord.requestsMade || 0) + 1;
    saveDatabase(db);

    req.clientAccount = keyRecord;
    next();
}

// ============================================================================
// SERVER-SIDE GATEWAY ENDPOINT (USES EXACT FETCH LOGIC FROM YOUR HTML FILE):
// - If opened in browser without ?url=, shows the friendly API Cloud Workspace.
// - If called with ?url=..., uses native fetch() to hit:
//   https://agamm-aga.onrender.com/api/v1/extract?url=...
//   with header 'x-api-key': 'demo-test-free' and returns the raw text verbatim!
// ============================================================================
app.get(['/api/v1/custom-extract', '/api/v1/extract'], authenticateApiKey, async (req, res) => {
    const passedUrl = (req.query.url || '').trim();

    if (!passedUrl || passedUrl === '*' || passedUrl === 'ANY_WEBSITE_UNLIMITED') {
        const wantsHtml = req.headers.accept && req.headers.accept.includes('text/html') && req.query.format !== 'json';
        if (wantsHtml) {
            return res.status(200).send(renderInteractiveExtractorPortal(req.clientAccount, req));
        }
        return res.status(200).json({
            success: true,
            prompt_required: true,
            message: 'Your API is active! Please provide the website link you want to extract using ?url=https://example.com',
            owner_gmail: req.clientAccount.clientEmail,
            plan: req.clientAccount.plan,
            expires_at: req.clientAccount.expiresAt,
            example_call: `${req.protocol}://${req.get('host')}/api/v1/custom-extract?api_key=${req.clientAccount.apiKey}&url=https://example.com`
        });
    }

    try {
        const format = (req.query.format || 'json').toLowerCase();
        const apiUrl = `${REMOTE_API_EXTRACT_URL}?url=${encodeURIComponent(passedUrl)}`;

        const response = await fetch(apiUrl, {
            method: 'GET',
            headers: {
                'x-api-key': SYSTEM_API_KEY,
                'Accept': format === 'markdown' ? 'text/markdown' : 'application/json'
            }
        });

        const rawText = await response.text();

        if (format === 'markdown') {
            res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
            return res.status(response.status).send(rawText);
        }

        try {
            const jsonObj = JSON.parse(rawText);
            return res.status(response.status).json(jsonObj);
        } catch (parseErr) {
            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            return res.status(response.status).send(rawText);
        }
    } catch (error) {
        return res.status(502).json({
            success: false,
            error_code: 'REMOTE_API_ERROR',
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
            <td class="p-3.5 text-xs text-blue-600 dark:text-blue-400 font-bold">Unlimited Websites</td>
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
            <td class="p-3.5 font-mono text-xs text-blue-600 dark:text-blue-400">${acc.currentApiKey || 'PENDING_PAYMENT'}</td>
            <td class="p-3.5 font-mono text-xs text-amber-600 dark:text-amber-400">${acc.expiresAt || 'Not Activated'}</td>
            <td class="p-3.5 font-mono text-xs text-purple-600 dark:text-purple-400 font-bold">${acc.partnerCode}</td>
        </tr>
    `).join('') || '<tr><td colspan="5" class="p-6 text-center text-slate-500 text-xs">No Gmail accounts recorded yet.</td></tr>';

    return res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        ${renderSharedHead('Admin Live Dispatch & Gmail Memory')}
    </head>
    <body class="text-slate-800 dark:text-slate-200 min-h-screen flex flex-col">
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
                            <tr><th class="p-3.5">Order ID</th><th class="p-3.5">Client Gmail</th><th class="p-3.5">Amount</th><th class="p-3.5">Access Scope</th><th class="p-3.5">Partner</th><th class="p-3.5">Instant Action</th></tr>
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
    if (req.query.api_key) {
        const qs = new URLSearchParams(req.query).toString();
        return res.redirect(`/api/v1/custom-extract?${qs}`);
    }

    res.status(200).json({
        service: 'API Cloud Subscription Gateway, API Key Generator & Payment Server',
        status: 'ONLINE',
        receiving_upi: MERCHANT_UPI_ID,
        plans: {
            free_trial_24h: '₹0 (24-Hour Full-Power Free Trial • Unlimited Websites & Data)',
            enterprise_50k: '₹50,000 / 30 Days (Unlimited Enterprise API • Unlimited Websites & Data)'
        },
        endpoints: {
            create_order_or_trial: 'GET or POST /api/v1/provision/create-order',
            check_gmail_subscription: 'GET /api/v1/provision/my-account?email=client@gmail.com',
            interactive_or_json_extract: 'GET /api/v1/custom-extract?api_key={KEY} (Prompts for website link on open, or pass &url={URL})',
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