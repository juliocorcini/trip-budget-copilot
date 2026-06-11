const CACHE_NAME = 'trippilot-v6';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
];

// GAP-036: precache the hashed build assets referenced by index.html so the
// app shell works offline right after install (no build plugin required).
async function precacheBuildAssets(cache) {
  try {
    const response = await fetch('/index.html', { cache: 'no-cache' });
    if (!response.ok) return;
    const html = await response.text();
    const assetUrls = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((m) => m[1]);
    if (assetUrls.length > 0) {
      await cache.addAll(assetUrls);
    }
  } catch {
    // Offline during install — runtime caching will fill the gap later.
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await cache.addAll(STATIC_ASSETS);
      await precacheBuildAssets(cache);
    })
  );
  // DEC-082: no automatic skipWaiting — the page shows an update toast and
  // the user decides when to activate the new version (SKIP_WAITING message).
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

function isNavigationRequest(request) {
  return request.mode === 'navigate' || new URL(request.url).pathname === '/index.html';
}

// DEC-082 (GAP-R2-001): navigation/index.html is network-first so a new deploy
// reaches the user on the next load; hashed assets stay cache-first (immutable).
async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match(request) || await cache.match('/index.html');
    return cached || Response.error();
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  if (isNavigationRequest(event.request)) {
    event.respondWith(networkFirst(event.request));
    return;
  }
  event.respondWith(cacheFirst(event.request));
});

// ---------------------------------------------------------------------------
// DEC-120 (R-11): active-outing notification actions.
//
// The app embeds everything (labels, amounts, follow-up subcategories,
// device id) in the notification data. On action click we delegate to an
// open window when possible (full domain flow); with no window open we
// fall back to a direct IndexedDB write replicating the app's record shape.
// ---------------------------------------------------------------------------

const DB_NAME = 'TripPilotDB';
const OUTING_TAG = 'trippilot-active-outing';
const FOLLOWUP_TAG = 'trippilot-outing-followup';

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function idbGetAllByIndex(dbConn, storeName, indexName, value) {
  return new Promise((resolve, reject) => {
    const tx = dbConn.transaction(storeName, 'readonly');
    const request = tx.objectStore(storeName).index(indexName).getAll(value);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function idbGet(dbConn, storeName, key) {
  return new Promise((resolve, reject) => {
    const tx = dbConn.transaction(storeName, 'readonly');
    const request = tx.objectStore(storeName).get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function idbPut(dbConn, storeName, record) {
  return new Promise((resolve, reject) => {
    const tx = dbConn.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function formatMoneySw(cents, currency, locale) {
  try {
    return new Intl.NumberFormat(locale || undefined, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(cents / 100);
  } catch {
    return (cents / 100).toFixed(2) + ' ' + currency;
  }
}

function personalSessionTotal(transactions) {
  return transactions
    .filter((t) => t.deletedAt === null && t.type === 'expense')
    .reduce((acc, t) => acc + (t.personalCostCents !== null && t.personalCostCents !== undefined ? t.personalCostCents : t.amountCents), 0);
}

async function findWindowClient() {
  const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  return clientList[0] || null;
}

async function focusOrOpen(url) {
  const client = await findWindowClient();
  if (client) {
    try {
      await client.focus();
      client.postMessage({ type: 'OUTING_NOTIFICATION_NAVIGATE', url });
      return;
    } catch {
      // fall through to openWindow
    }
  }
  await self.clients.openWindow(url);
}

/** Mirrors createExpenseTransaction + createSessionItem record shapes. */
async function swDirectQuickAdd(amountCents, data) {
  const dbConn = await openDb();
  try {
    const session = await idbGet(dbConn, 'sessions', data.sessionId);
    if (!session || session.status !== 'active' || session.deletedAt !== null) return;

    const now = new Date().toISOString();
    const meta = () => ({
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      revision: 1,
      sourceDeviceId: data.deviceId || 'sw',
    });
    const txRecord = {
      id: crypto.randomUUID(),
      ...meta(),
      tripId: session.tripId,
      phaseId: session.phaseId,
      budgetPoolId: session.budgetPoolId,
      walletId: null,
      sessionId: session.id,
      type: 'expense',
      amountCents,
      personalCostCents: amountCents,
      currency: data.currency,
      baseCurrencyAmountCents: amountCents,
      exchangeRate: null,
      category: data.profileCategory || 'other',
      subcategoryId: null,
      description: session.name,
      date: now,
      isShared: false,
      paidByParticipantId: null,
      activityProfileId: session.activityProfileId,
      isSpecialOccasion: false,
      excludeFromLearning: false,
      sourceWalletId: null,
      targetWalletId: null,
      settlementId: null,
      adjustmentReason: null,
      notes: null,
    };
    const existingItems = await idbGetAllByIndex(dbConn, 'sessionItems', 'sessionId', session.id);
    const itemRecord = {
      id: crypto.randomUUID(),
      ...meta(),
      sessionId: session.id,
      transactionId: txRecord.id,
      order: existingItems.length + 1,
    };
    await idbPut(dbConn, 'transactions', txRecord);
    await idbPut(dbConn, 'sessionItems', itemRecord);

    // Re-show the persistent notification with the new total (silent update).
    const sessionTxs = await idbGetAllByIndex(dbConn, 'transactions', 'sessionId', session.id);
    const total = personalSessionTotal(sessionTxs);
    const strings = data.strings || {};
    const actions = Object.keys(data.amounts || {}).map((actionId) => ({
      action: actionId,
      title: '+' + formatMoneySw(data.amounts[actionId], data.currency, data.locale),
    }));
    actions.push({ action: 'open', title: strings.openAction || 'Open' });
    await self.registration.showNotification(strings.title || 'TripPilot', {
      tag: OUTING_TAG,
      body: (strings.bodyTemplate || '{{total}}').replace('{{total}}', formatMoneySw(total, data.currency, data.locale)),
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      silent: true,
      renotify: false,
      requireInteraction: true,
      actions,
      data,
    });

    // Follow-up: "what was that expense?" with the precomputed subcategories.
    const followups = (data.followups || {})[String(amountCents)] || [];
    if (followups.length > 0) {
      await self.registration.showNotification(strings.followupTitle || 'TripPilot', {
        tag: FOLLOWUP_TAG,
        body: (strings.followupBodyTemplate || '{{amount}}').replace(
          '{{amount}}',
          formatMoneySw(amountCents, data.currency, data.locale),
        ),
        icon: '/icons/icon-192.png',
        actions: [
          ...followups.map((f) => ({ action: 'sub_' + f.subcategoryId, title: f.label })),
          { action: 'open', title: strings.openAction || 'Open' },
        ],
        data: { kind: 'followup', txId: txRecord.id },
      });
    }
  } finally {
    dbConn.close();
  }
}

async function swDirectSetSubcategory(txId, subcategoryId) {
  const dbConn = await openDb();
  try {
    const tx = await idbGet(dbConn, 'transactions', txId);
    if (!tx || tx.deletedAt !== null) return;
    tx.subcategoryId = subcategoryId;
    tx.updatedAt = new Date().toISOString();
    tx.revision = (tx.revision || 1) + 1;
    await idbPut(dbConn, 'transactions', tx);
  } finally {
    dbConn.close();
  }
}

async function handleOutingAction(event) {
  const data = event.notification.data || {};
  const action = event.action;

  if (data.kind === 'outing' && action && action.indexOf('quick_add_') === 0) {
    const amountCents = (data.amounts || {})[action];
    if (typeof amountCents !== 'number') return;
    const client = await findWindowClient();
    if (client) {
      client.postMessage({ type: 'OUTING_NOTIFICATION_QUICK_ADD', amountCents });
      return;
    }
    await swDirectQuickAdd(amountCents, data);
    return;
  }

  if (data.kind === 'followup' && action && action.indexOf('sub_') === 0) {
    event.notification.close();
    const subcategoryId = action.slice(4);
    const client = await findWindowClient();
    if (client) {
      client.postMessage({
        type: 'OUTING_NOTIFICATION_SET_SUBCATEGORY',
        txId: data.txId,
        subcategoryId,
      });
      return;
    }
    await swDirectSetSubcategory(data.txId, subcategoryId);
    return;
  }

  // Body click or explicit "open" → bring the outing screen up.
  if (data.kind === 'followup') event.notification.close();
  await focusOrOpen('/outing');
}

self.addEventListener('notificationclick', (event) => {
  if (
    event.notification.tag === OUTING_TAG ||
    event.notification.tag === FOLLOWUP_TAG
  ) {
    event.waitUntil(handleOutingAction(event));
  }
});
