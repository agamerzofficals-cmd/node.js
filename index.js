/**
 * ============================================================================
 * AGAMING ENTERPRISE CUSTOM API PROVISIONING, 24H FREE TRIAL & SCRAPER SERVER
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
const MERCHANT_NAME = process.env.MERCHANT_NAME || 'AGaming Enterprise Cloud';

const REQUIRE_ADMIN_APPROVAL_FOR_UPI = process.env.REQUIRE_ADMIN_APPROVAL === 'true' ? true : false;

// 24 Hours in milliseconds for the Full-Power Free Trial
const TRIAL_DURATION_MS = 24 * 60 * 60 * 1000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Vercel serverless environment has a read-only root directory, so it automatically falls back to /tmp on Vercel
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
        return JSON.parse(raw);
    } catch (error) {
        console.error('[DB LOAD ERROR]:', error);
        return { orders: [], payments: [], apiKeys: {}, partners: {} };
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
    const prefix = isTrial ? 'ag_trial_24h_' : 'ag_live_';
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

// Supports both Paid Orders (₹50,000 / ₹75,000) AND 24-Hour Full-Power Free Trial (apiPlan = 'free_trial_24h')
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

    const isTrialRequest = apiPlan === 'free_trial_24h' || apiPlan === 'trial';

    // ========================================================================
    // MODE 1: 24-HOUR FULL POWER FREE TRIAL (Auto-Expires in 24 Hours)
    // ========================================================================
    if (isTrialRequest) {
        // Prevent abuse: Check if this email already took a 24-hour free trial
        const existingTrial = db.orders.find(
            o => o.clientEmail === cleanEmail && o.apiPlan === 'free_trial_24h'
        );

        const protocol = req.headers['x-forwarded-proto'] || req.protocol;
        const host = req.get('host');

        if (existingTrial && existingTrial.issuedApiKey) {
            const trialKeyObj = db.apiKeys[existingTrial.issuedApiKey];
            const isExpired = trialKeyObj && trialKeyObj.expiresAt && Date.now() > new Date(trialKeyObj.expiresAt).getTime();

            if (isExpired) {
                // If their 1-day trial is already over, force redirect to ₹50,000 Enterprise Checkout!
                const paidOrderId = generateOrderId(false);
                const upgradeOrder = {
                    orderId: paidOrderId,
                    clientEmail: cleanEmail,
                    targetDomain: targetDomain.trim(),
                    apiPlan: 'enterprise_50k',
                    amountInINR: 50000,
                    receivingUpiId: MERCHANT_UPI_ID,
                    partnerCode: normalizedPartner,
                    partnerCommissionINR: 5000,
                    customFields: parsedFields,
                    status: 'PENDING_PAYMENT',
                    createdAt: new Date().toISOString(),
                    paidAt: null,
                    issuedApiKey: null
                };
                db.orders.push(upgradeOrder);
                saveDatabase(db);

                const upgradeCheckoutUrl = `${protocol}://${host}/checkout/${paidOrderId}`;
                if (req.method === 'GET') return res.redirect(upgradeCheckoutUrl);
                return res.status(402).json({
                    success: false,
                    trialExpired: true,
                    message: 'Your 24-Hour Free Trial has expired! Please upgrade to the ₹50,000 Enterprise Plan.',
                    checkoutUrl: upgradeCheckoutUrl
                });
            }

            // Otherwise show their active 24h trial key page
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

        // Provision a brand-new 24-Hour Full-Speed Trial Key immediately
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

        // Full server power & concurrency for 24 hours
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
            quotaRemaining: 100000, // Full high-speed capacity for 1 day
            requestsMade: 0,
            createdAt: nowIso
        };

        saveDatabase(db);

        const trialPageUrl = `${protocol}://${host}/checkout/${trialOrderId}`;
        if (req.method === 'GET') {
            return res.redirect(trialPageUrl);
        }
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
    // MODE 2: PAID ENTERPRISE PLAN (₹50,000 / ₹75,000)
    // ========================================================================
    const orderId = generateOrderId(false);
    const amountInINR = apiPlan === 'scale_custom' ? 75000 : 50000;

    const newOrder = {
        orderId,
        clientEmail: cleanEmail,
        targetDomain: targetDomain.trim(),
        apiPlan: apiPlan || 'enterprise_50k',
        isTrial: false,
        amountInINR,
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
    saveDatabase(db);

    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.get('host');
    const checkoutUrl = `${protocol}://${host}/checkout/${orderId}`;

    if (req.method === 'GET') {
        return res.redirect(checkoutUrl);
    }
    return res.status(200).json({
        success: true,
        isTrial: false,
        orderId,
        receivingUpiId: MERCHANT_UPI_ID,
        checkoutUrl
    });
});

// Direct endpoint so clients can also generate a 24h trial via /api/v1/provision/free-trial
app.all('/api/v1/provision/free-trial', (req, res) => {
    req.query.apiPlan = 'free_trial_24h';
    if (req.body) req.body.apiPlan = 'free_trial_24h';
    return app._router.handle(Object.assign(req, { url: '/api/v1/provision/create-order' }), res, () => {});
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

    const upiUri = `upi://pay?pa=${encodeURIComponent(MERCHANT_UPI_ID)}&pn=${encodeURIComponent(MERCHANT_NAME)}&am=${order.amountInINR}&cu=INR&tn=${encodeURIComponent('API_' + order.orderId)}`;
    const qrCodeImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(upiUri)}`;

    // Link to let client switch to 24h free trial if they want to test first
    const switchToTrialUrl = `/api/v1/provision/create-order?clientEmail=${encodeURIComponent(order.clientEmail)}&targetDomain=${encodeURIComponent(order.targetDomain)}&customFields=${encodeURIComponent(order.customFields.join(','))}&partnerCode=${encodeURIComponent(order.partnerCode)}&apiPlan=free_trial_24h`;

    res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Enterprise API Payment Gateway | ${MERCHANT_NAME}</title>
        <script src="https://cdn.tailwindcss.com"></script>
    </head>
    <body class="bg-slate-950 text-slate-100 min-h-screen flex items-center justify-center p-4 font-sans">
        <div class="max-w-xl w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
            <div class="flex items-center justify-between border-b border-slate-800 pb-4">
                <div>
                    <span class="text-xs font-mono uppercase tracking-wider text-emerald-400">Order #${order.orderId}</span>
                    <h1 class="text-xl font-extrabold text-white mt-0.5">Pay & Provision Enterprise API</h1>
                </div>
                <div class="text-right">
                    <span class="text-xs text-slate-400 block">Total Payable</span>
                    <span class="text-2xl font-extrabold text-emerald-400 font-mono">₹${order.amountInINR.toLocaleString('en-IN')}</span>
                </div>
            </div>

            <!-- 24-Hour Free Trial Option Banner -->
            <div class="bg-amber-950/40 border border-amber-500/40 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div class="text-xs text-amber-200">
                    <strong class="text-amber-400 block text-sm">Want to test full server power first?</strong>
                    Get a 100% full-speed Custom API Key free for 24 hours. After 1 day, upgrade to ₹50,000/mo.
                </div>
                <a href="${switchToTrialUrl}" class="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs shrink-0 transition">
                    Get 24H Free Trial Key &rarr;
                </a>
            </div>

            <div class="bg-slate-950 rounded-2xl p-4 border border-slate-800 space-y-2 text-xs font-mono">
                <div class="flex justify-between"><span class="text-slate-400">Client Email:</span><span class="text-white">${order.clientEmail}</span></div>
                <div class="flex justify-between"><span class="text-slate-400">Target Domain:</span><span class="text-blue-400 truncate max-w-[260px]">${order.targetDomain}</span></div>
                <div class="flex justify-between"><span class="text-slate-400">Custom JSON Fields:</span><span class="text-purple-300">${order.customFields.join(', ')}</span></div>
                <div class="flex justify-between"><span class="text-slate-400">Partner Code:</span><span class="text-emerald-400 font-bold">${order.partnerCode}</span></div>
            </div>

            <div class="bg-slate-950/90 border-2 border-emerald-500/30 rounded-2xl p-5 text-center space-y-3">
                <div class="text-xs font-bold uppercase tracking-wider text-emerald-400">
                    Scan with GPay, PhonePe, Paytm or Any Banking App
                </div>
                <div class="bg-white p-3 rounded-2xl inline-block shadow-lg">
                    <img src="${qrCodeImageUrl}" alt="UPI QR Code" class="w-44 h-44 mx-auto">
                </div>
                <div class="text-xs font-mono text-slate-300">
                    Official Merchant UPI ID: <strong class="text-emerald-400 select-all">${MERCHANT_UPI_ID}</strong>
                </div>
                <a href="${upiUri}" class="inline-block px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 font-mono text-xs font-bold border border-slate-700">
                    Pay via UPI App Directly (Mobile) &rarr;
                </a>
            </div>

            <form action="/api/v1/provision/confirm-payment" method="POST" class="space-y-4">
                <input type="hidden" name="orderId" value="${order.orderId}">
                <div>
                    <label class="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                        Enter 12-Digit UPI UTR / Transaction Reference Number *
                    </label>
                    <input type="text" name="paymentReference" required minlength="8" placeholder="Ex: 412899012388 (12-Digit UTR Number)" 
                        class="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-700 text-sm font-mono text-white focus:border-emerald-500 focus:outline-none">
                </div>
                <div>
                    <label class="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                        Payment Mode Used
                    </label>
                    <select name="paymentMethod" class="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-700 text-sm font-bold text-white">
                        <option value="DIRECT_UPI_QR">UPI QR / UPI ID (${MERCHANT_UPI_ID})</option>
                        <option value="IMPS_NEFT_BANK">Corporate IMPS / NEFT Bank Transfer</option>
                        <option value="RAZORPAY_STRIPE">International Wire / Gateway</option>
                    </select>
                </div>
                <button type="submit" class="w-full py-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm shadow-lg shadow-emerald-600/25 transition-all">
                    Submit UTR & Generate Permanent Enterprise API Key &rarr;
                </button>
            </form>
        </div>
    </body>
    </html>
    `);
});

function finalizeOrderAndProvisionKey(order, db, paymentReference, paymentMethod) {
    const liveApiKey = generateCryptographicApiKey(false);
    const paidTimestamp = new Date().toISOString();
    const paidIST = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

    order.status = 'PAID';
    order.isTrial = false;
    order.paidAt = paidTimestamp;
    order.paymentReference = paymentReference;
    order.paymentMethod = paymentMethod;
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
        paidAtIST: paidIST
    });

    db.apiKeys[liveApiKey] = {
        apiKey: liveApiKey,
        orderId: order.orderId,
        clientEmail: order.clientEmail,
        targetDomain: order.targetDomain,
        customFields: order.customFields,
        partnerCode: order.partnerCode,
        plan: order.apiPlan,
        isTrial: false,
        expiresAt: null,
        status: 'ACTIVE',
        quotaRemaining: 1000000,
        requestsMade: 0,
        createdAt: paidTimestamp
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
        commissionINR: 5000
    });

    saveDatabase(db);
}

app.post('/api/v1/provision/confirm-payment', (req, res) => {
    const { orderId, paymentReference, paymentMethod } = req.body;
    const db = loadDatabase();
    const order = db.orders.find(o => o.orderId === orderId);

    if (!order) {
        return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    const cleanRef = (paymentReference || 'UTR_' + Date.now()).trim();
    const cleanMethod = paymentMethod || 'DIRECT_UPI_QR';

    if (REQUIRE_ADMIN_APPROVAL_FOR_UPI && order.status !== 'PAID') {
        order.status = 'WAITING_ADMIN_APPROVAL';
        order.paymentReference = cleanRef;
        order.paymentMethod = cleanMethod;
        saveDatabase(db);

        return res.send(`
        <!DOCTYPE html>
        <html>
        <head><meta charset="UTF-8"><title>Payment Under Verification</title><script src="https://cdn.tailwindcss.com"></script></head>
        <body class="bg-slate-950 text-white min-h-screen flex items-center justify-center p-4 font-sans">
            <div class="max-w-lg w-full bg-slate-900 border border-amber-500/50 rounded-3xl p-8 text-center space-y-4">
                <div class="text-amber-400 text-xs font-mono font-bold uppercase">UTR Recorded: ${cleanRef}</div>
                <h1 class="text-2xl font-extrabold">Payment Submitted for Verification</h1>
                <p class="text-sm text-slate-400">Our finance desk is verifying your UTR (${cleanRef}) received on <strong>${MERCHANT_UPI_ID}</strong>. Refresh this page in a few minutes once approved to view your live API key.</p>
                <a href="/checkout/${order.orderId}" class="inline-block px-6 py-3 rounded-xl bg-amber-500 text-slate-950 font-bold text-sm">Refresh Status</a>
            </div>
        </body>
        </html>
        `);
    }

    if (order.status !== 'PAID') {
        finalizeOrderAndProvisionKey(order, db, cleanRef, cleanMethod);
    }

    return res.send(renderKeyIssuedPage(order, req));
});

app.post('/api/v1/admin/approve-order', (req, res) => {
    const { orderId, secret } = req.body;
    if (secret !== ADMIN_SECRET) {
        return res.status(401).send('Unauthorized Admin Secret');
    }

    const db = loadDatabase();
    const order = db.orders.find(o => o.orderId === orderId);
    if (order && order.status !== 'PAID') {
        finalizeOrderAndProvisionKey(order, db, order.paymentReference || 'ADMIN_APPROVED', order.paymentMethod || 'DIRECT_UPI');
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
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${isTrial ? '24-Hour Free Trial API Key' : 'Live Enterprise API Key'} | AGaming Cloud</title>
        <script src="https://cdn.tailwindcss.com"></script>
    </head>
    <body class="bg-slate-950 text-slate-100 min-h-screen flex items-center justify-center p-4 font-sans">
        <div class="max-w-2xl w-full bg-slate-900 border-2 ${isTrial ? 'border-amber-500/60' : 'border-emerald-500/60'} rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
            <div class="flex items-center justify-between border-b border-slate-800 pb-4">
                <div>
                    <span class="px-2.5 py-1 rounded-full ${isTrial ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-500/20 text-emerald-300'} text-xs font-mono font-bold">
                        ${isTrial ? '24-HOUR FULL POWER FREE TRIAL &bull; ACTIVE' : 'PAYMENT VERIFIED &bull; ENTERPRISE ACTIVE'}
                    </span>
                    <h1 class="text-2xl font-extrabold text-white mt-2">
                        ${isTrial ? 'Your 24-Hour Full-Speed Trial Key is Live!' : 'Your Custom Enterprise API is Live!'}
                    </h1>
                </div>
                <div class="text-right font-mono text-xs text-slate-400">
                    ${isTrial
                        ? `<div class="text-amber-400 font-bold">Valid For: 24 Hours</div><div>Then ₹50,000/mo</div>`
                        : `<div>Paid: ₹${order.amountInINR.toLocaleString('en-IN')}</div><div>UTR:${order.paymentReference}</div>`
                    }
                </div>
            </div>

            ${isTrial ? `
            <div class="bg-amber-950/40 border border-amber-500/40 rounded-2xl p-4 text-xs text-amber-200 space-y-1">
                <strong class="text-amber-400 block">⚡ Maximum Server Power Unlocked for 24 Hours:</strong>
                <span>This trial key gives you 100% unthrottled speed and stealth extraction. It will automatically expire at <code class="text-white font-mono">${order.expiresAt}</code>. After expiry, upgrade to the ₹50,000/month Enterprise Plan to continue uninterrupted.</span>
            </div>
            ` : ''}

            <div class="space-y-2">
                <label class="text-xs font-mono uppercase text-slate-400">Your API Key (Keep Secret):</label>
                <div class="p-4 rounded-2xl bg-slate-950 border ${isTrial ? 'border-amber-500/40 text-amber-400' : 'border-emerald-500/40 text-emerald-400'} font-mono text-base font-bold break-all select-all">
                    ${order.issuedApiKey}
                </div>
            </div>

            <div class="space-y-2">
                <label class="text-xs font-mono uppercase text-slate-400">Your Dedicated Custom Extraction Endpoint:</label>
                <div class="p-4 rounded-2xl bg-slate-950 border border-slate-800 font-mono text-xs text-blue-300 break-all select-all">
                    ${customEndpoint}
                </div>
            </div>

            <div class="bg-slate-950 rounded-2xl p-4 border border-slate-800 text-xs font-mono space-y-1.5 text-slate-300">
                <div><strong class="text-slate-400">Configured Target Domain:</strong> ${order.targetDomain}</div>
                <div><strong class="text-slate-400">Configured Custom JSON Fields:</strong> ${order.customFields.join(', ')}</div>
                <div><strong class="text-slate-400">Partner Attribution:</strong> ${order.partnerCode}</div>
                ${isTrial ? `<div><strong class="text-amber-400">Auto-Expires At (UTC):</strong> ${order.expiresAt}</div>` : `<div><strong class="text-slate-400">Activated At (UTC):</strong> ${order.paidAt}</div>`}
            </div>

            <div class="flex flex-col sm:flex-row gap-3">
                <a href="${customEndpoint}" target="_blank" class="flex-1 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-center text-white font-bold text-sm transition">
                    Test Your Live Custom API Now &rarr;
                </a>
                ${isTrial ? `
                <a href="${upgradeToPaidUrl}" class="flex-1 py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-center text-slate-950 font-extrabold text-sm transition">
                    Upgrade to ₹50,000 Enterprise Plan &rarr;
                </a>
                ` : ''}
            </div>
        </div>
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
            error: 'Invalid API Key. Please generate a 24-Hour Free Trial key or purchase the ₹50,000 Enterprise Plan.'
        });
    }

    // Check if this is a 24-Hour Free Trial Key that has passed its 24-hour window
    if (keyRecord.isTrial && keyRecord.expiresAt) {
        const nowMs = Date.now();
        const expiryMs = new Date(keyRecord.expiresAt).getTime();

        if (nowMs > expiryMs) {
            keyRecord.status = 'EXPIRED_TRIAL';
            saveDatabase(db);

            const protocol = req.headers['x-forwarded-proto'] || req.protocol;
            const host = req.get('host');
            const upgradeUrl = `${protocol}://${host}/api/v1/provision/create-order?clientEmail=${encodeURIComponent(keyRecord.clientEmail)}&targetDomain=${encodeURIComponent(keyRecord.targetDomain)}&customFields=${encodeURIComponent((keyRecord.customFields || ['title']).join(','))}&partnerCode=${encodeURIComponent(keyRecord.partnerCode || 'DIRECT')}&apiPlan=enterprise_50k`;

            return res.status(402).json({
                success: false,
                error_code: 'FREE_TRIAL_EXPIRED',
                error: 'Your 24-Hour Free Trial API Key has expired! To continue extracting data at full speed, please upgrade to the ₹50,000/month Enterprise Plan.',
                expired_at: keyRecord.expiresAt,
                upgrade_to_50k_plan_url: upgradeUrl
            });
        }
    }

    if (keyRecord.status !== 'ACTIVE') {
        return res.status(403).json({
            success: false,
            error: 'Inactive or expired API Key. Please upgrade to the ₹50,000 Enterprise Plan.'
        });
    }

    if (keyRecord.quotaRemaining <= 0) {
        return res.status(429).json({
            success: false,
            error: 'API quota exhausted. Please upgrade or renew your ₹50,000 Enterprise Plan.'
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

        const fullExtractedPool = {
            title: $('title').text().trim() \vert{}\vert{}$('h1').first().text().trim() || '',
            product_title: $('h1').first().text().trim() \vert{}\vert{}$('title').text().trim() || '',
            description: $('meta[name="description"]').attr('content') \vert{}\vert{} $('meta[property="og:description"]').attr('content') || '',
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

        // Calculate remaining trial hours if on a 24h trial
        let trialRemainingHours = null;
        if (req.clientAccount.isTrial && req.clientAccount.expiresAt) {
            const msLeft = Math.max(0, new Date(req.clientAccount.expiresAt).getTime() - Date.now());
            trialRemainingHours = (msLeft / (1000 * 60 * 60)).toFixed(2) + ' hours remaining';
        }

        return res.status(200).json({
            success: true,
            meta: {
                client: req.clientAccount.clientEmail,
                plan: req.clientAccount.plan,
                is_trial: !!req.clientAccount.isTrial,
                trial_time_left: trialRemainingHours,
                expires_at: req.clientAccount.expiresAt || 'NEVER (Enterprise Active)',
                partner_attribution: req.clientAccount.partnerCode,
                target_url: targetUrl,
                execution_time_ms: Date.now() - startTime,
                quota_remaining: req.clientAccount.quotaRemaining
            },
            custom_fields_requested: requestedFields,
            extracted_data: customPayload,
            raw_summary: {
                page_title: fullExtractedPool.title,
                detected_price: fullExtractedPool.live_price || 'N/A',
                total_links_found: fullExtractedPool.links.length
            }
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
            message: 'Unauthorized. Pass ?secret=YOUR_ADMIN_SECRET to view the payment ledger.'
        });
    }

    const db = loadDatabase();
    const totalRevenueINR = db.payments.reduce((acc, p) => acc + (p.amountPaidINR || 0), 0);
    const totalPartnerPayoutsINR = db.payments.reduce((acc, p) => acc + (p.partnerCommissionINR || 0), 0);
    const pendingOrders = db.orders.filter(o => o.status === 'WAITING_ADMIN_APPROVAL');

    if (req.query.format !== 'json') {
        const pendingRows = pendingOrders.map(o => `
            <tr class="border-b border-slate-800 bg-amber-950/20">
                <td class="p-3 font-mono text-xs text-amber-400">${o.orderId}</td>
                <td class="p-3 font-bold text-white">${o.clientEmail}</td>
                <td class="p-3 font-mono text-emerald-300">₹${o.amountInINR.toLocaleString('en-IN')}</td>
                <td class="p-3 font-mono text-xs text-amber-300 font-bold">${o.paymentReference}</td>
                <td class="p-3 font-mono text-xs text-purple-300">${o.partnerCode}</td>
                <td class="p-3">
                    <form action="/api/v1/admin/approve-order" method="POST">
                        <input type="hidden" name="orderId" value="${o.orderId}">
                        <input type="hidden" name="secret" value="${ADMIN_SECRET}">
                        <button type="submit" class="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold">
                            Approve & Issue API Key
                        </button>
                    </form>
                </td>
            </tr>
        `).join('') || '<tr><td colspan="6" class="p-4 text-center text-slate-500 text-xs">No orders waiting for manual UTR verification.</td></tr>';

        const paymentRows = db.payments.map(p => `
            <tr class="border-b border-slate-800">
                <td class="p-3 font-mono text-xs text-emerald-400">${p.paidAtIST}</td>
                <td class="p-3 font-bold text-white">${p.clientEmail}</td>
                <td class="p-3 font-mono text-emerald-300">₹${p.amountPaidINR.toLocaleString('en-IN')}</td>
                <td class="p-3 font-mono text-xs text-slate-300">${p.paymentReference} (${p.paymentMethod})</td>
                <td class="p-3 font-mono text-xs text-purple-300 font-bold">${p.partnerCode} (₹${p.partnerCommissionINR})</td>
                <td class="p-3 font-mono text-xs text-blue-400">${p.issuedApiKey}</td>
            </tr>
        `).join('') || '<tr><td colspan="6" class="p-6 text-center text-slate-500">No confirmed payments recorded yet.</td></tr>';

        return res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Admin Payment & API Ledger | AGaming</title>
            <script src="https://cdn.tailwindcss.com"></script>
        </head>
        <body class="bg-slate-950 text-slate-100 p-6 font-sans">
            <div class="max-w-7xl mx-auto space-y-8">
                <div class="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
                    <div>
                        <h1 class="text-2xl font-extrabold text-white">AGaming Financial & API Provisioning Ledger</h1>
                        <p class="text-xs text-slate-400">Receiving UPI ID: <strong class="text-emerald-400 font-mono">${MERCHANT_UPI_ID}</strong></p>
                    </div>
                    <div class="flex gap-4">
                        <div class="bg-slate-900 border border-slate-800 px-4 py-2.5 rounded-xl">
                            <span class="text-xs text-slate-400 block">Total Gross Revenue</span>
                            <span class="text-lg font-extrabold text-emerald-400 font-mono">₹${totalRevenueINR.toLocaleString('en-IN')}</span>
                        </div>
                        <div class="bg-slate-900 border border-slate-800 px-4 py-2.5 rounded-xl">
                            <span class="text-xs text-slate-400 block">Partner Commissions (10%)</span>
                            <span class="text-lg font-extrabold text-purple-400 font-mono">₹${totalPartnerPayoutsINR.toLocaleString('en-IN')}</span>
                        </div>
                    </div>
                </div>

                <div class="space-y-2">
                    <h2 class="text-sm font-bold uppercase tracking-wider text-amber-400">Pending UTR Verifications</h2>
                    <div class="bg-slate-900 border border-slate-800 rounded-2xl overflow-x-auto">
                        <table class="w-full text-left text-sm">
                            <thead class="bg-slate-950 text-slate-400 text-xs uppercase font-mono">
                                <tr>
                                    <th class="p-3">Order ID</th>
                                    <th class="p-3">Client Email</th>
                                    <th class="p-3">Amount</th>
                                    <th class="p-3">Submitted UTR</th>
                                    <th class="p-3">Partner Code</th>
                                    <th class="p-3">Action</th>
                                </tr>
                            </thead>
                            <tbody>${pendingRows}</tbody>
                        </table>
                    </div>
                </div>

                <div class="space-y-2">
                    <h2 class="text-sm font-bold uppercase tracking-wider text-emerald-400">Confirmed Payments & Provisioned Keys</h2>
                    <div class="bg-slate-900 border border-slate-800 rounded-2xl overflow-x-auto">
                        <table class="w-full text-left text-sm">
                            <thead class="bg-slate-950 text-slate-400 text-xs uppercase font-mono">
                                <tr>
                                    <th class="p-3">Paid Date & Time (IST)</th>
                                    <th class="p-3">Client Email</th>
                                    <th class="p-3">Amount Paid</th>
                                    <th class="p-3">UTR / Payment Ref</th>
                                    <th class="p-3">Partner Code (Commission)</th>
                                    <th class="p-3">Issued Live API Key</th>
                                </tr>
                            </thead>
                            <tbody>${paymentRows}</tbody>
                        </table>
                    </div>
                </div>
            </div>
        </body>
        </html>
        `);
    }

    return res.status(200).json({
        success: true,
        receivingUpiId: MERCHANT_UPI_ID,
        summary: {
            totalPaymentsCount: db.payments.length,
            totalGrossRevenueINR: totalRevenueINR,
            totalPartnerCommissionsINR: totalPartnerPayoutsINR
        },
        payments: db.payments,
        partners: db.partners,
        activeApiKeys: db.apiKeys
    });
});

app.get('/', (req, res) => {
    res.status(200).json({
        service: 'AGaming Custom API Provisioning, 24H Free Trial & Payment Ledger Server',
        status: 'ONLINE',
        receiving_upi: MERCHANT_UPI_ID,
        endpoints: {
            create_order_or_trial: 'GET or POST /api/v1/provision/create-order (pass apiPlan=free_trial_24h for 1-day trial)',
            direct_free_trial: 'GET or POST /api/v1/provision/free-trial',
            custom_extract: 'GET /api/v1/custom-extract?url={URL}&api_key={KEY}',
            admin_ledger: 'GET /api/v1/admin/ledger?secret=agaming-admin-2026'
        }
    });
});

if (require.main === module) {
    app.listen(PORT, () => {
        loadDatabase();
        console.log(`========================================================`);
        console.log(`[SERVER LIVE] Running on port ${PORT}`);
        console.log(`[MERCHANT UPI] ${MERCHANT_UPI_ID}`);
        console.log(`[ADMIN LEDGER] /api/v1/admin/ledger?secret=${ADMIN_SECRET}`);
        console.log(`========================================================`);
    });
}

// Export app for Vercel serverless deployment
module.exports = app;