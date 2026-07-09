const CACHE_NAME = 'trippilot-v96';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
];

// Same-origin paths that are safe to serve cache-first (immutable hashed build
// output + the precached shell + static icons). EVERYTHING else — above all the
// cross-origin live-share API (sync worker statement/responses polling) — must
// reach the network so `cache: 'no-store'` is honoured and the live table never
// freezes on a stale cached body.
const STATIC_PATHS = new Set(['/', '/index.html', '/manifest.json']);
function isStaticAsset(url) {
  return (
    url.pathname.startsWith('/assets/') ||
    url.pathname.startsWith('/icons/') ||
    STATIC_PATHS.has(url.pathname)
  );
}

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
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // CRITICAL (live table fix): only ever intercept SAME-ORIGIN GETs. The shared
  // bill split polls a cross-origin worker for the statement and every guest's
  // claims; the old "cacheFirst for every GET" cached the first (empty) response
  // and served it forever, so the owner stayed stuck on "waiting for someone to
  // enter" and no device ever saw another's picks. Cross-origin → never touch it
  // (the request's own `cache: 'no-store'` then guarantees a fresh network read).
  if (url.origin !== self.location.origin) return;

  if (isNavigationRequest(request)) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Hashed build assets + the precached shell are immutable → cache-first for
  // instant loads and offline. Any other same-origin GET is dynamic and is left
  // to the network rather than being cached behind the app's back.
  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request));
  }
});

// ---------------------------------------------------------------------------
// DEC-120 + DEC-124 (R-11 v2): active-outing notification actions.
//
// The app embeds everything (labels, amounts, follow-up subcategories,
// body templates, session limits, device id) in the notification data.
// Action clicks are handled HERE, always: direct IndexedDB write replicating
// the app's record shape (executable spec: quickAddSessionExpense tests),
// then the notification re-renders from fresh DB state and every open window
// receives an OUTING_DATA_CHANGED broadcast. v1 delegated writes to window
// clients, but Android freezes background tabs and the message only landed
// on refocus — the notification looked dead (stuck at €0).
// ---------------------------------------------------------------------------

const DB_NAME = 'TripPilotDB';
const OUTING_TAG = 'trippilot-active-outing';
const FOLLOWUP_TAG = 'trippilot-outing-followup';
// M8 (E5): answerable daily check-in notification.
const CHECKIN_TAG = 'trippilot-daily-checkin';
// Persistent "live bill split is happening" notification — body click deep-links
// into the table (reuses the navigate bridge via focusOrOpen).
const SPLIT_TAG = 'trippilot-active-split';
const APP_SETTINGS_STORE = 'appSettings';
const APP_SETTINGS_ID = 'app-settings';
const CHECKIN_INTENTS = ['calm', 'outing', 'night'];

// BUG-006: open WITHOUT a version so the SW only ever attaches to the schema
// the app (Dexie) already created — it never triggers an upgrade and never
// downgrades. Three guards keep it from corrupting the DB or deadlocking:
//  1. onupgradeneeded with oldVersion === 0 means the DB does not exist yet:
//     the SW must NOT create an empty DB (that skips Dexie's on('populate') →
//     BUG-003), so we abort the creation transaction and let the open fail.
//  2. onblocked means a versionchange (the app upgrading the schema) is queued:
//     we back off instead of holding the upgrade hostage.
//  3. onversionchange on the live connection: the moment the app needs to
//     upgrade, we close so db.open() in the window never times out.
function openDb() {
  return new Promise((resolve, reject) => {
    let request;
    try {
      request = indexedDB.open(DB_NAME);
    } catch (err) {
      reject(err);
      return;
    }
    request.onupgradeneeded = (event) => {
      if (event.oldVersion === 0) {
        try {
          event.target.transaction.abort();
        } catch {
          // Abort unsupported — onerror/onsuccess still resolves the open.
        }
      }
    };
    request.onblocked = () => reject(new Error('idb-blocked'));
    request.onsuccess = () => {
      const dbConn = request.result;
      dbConn.onversionchange = () => dbConn.close();
      resolve(dbConn);
    };
    request.onerror = () => reject(request.error || new Error('idb-open-failed'));
  });
}

/** BUG-006: never open a transaction on a store the app has not created yet. */
function hasStores(dbConn, names) {
  return names.every((name) => dbConn.objectStoreNames.contains(name));
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

/** Tells every open window that notification actions changed the DB. */
async function broadcastOutingChange() {
  const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  clientList.forEach((client) => {
    try {
      client.postMessage({ type: 'OUTING_DATA_CHANGED' });
    } catch {
      // Frozen/dying client — it re-syncs on visibilitychange anyway.
    }
  });
}

/** MIRRORS domain buildOutingNotificationBody — keep both in sync (DEC-124). */
function buildOutingBodySw(totalCents, data) {
  const strings = data.strings || {};
  const fmt = (cents) => formatMoneySw(cents, data.currency, data.locale);
  const target = typeof data.targetCents === 'number' ? data.targetCents : null;
  const avgDrink = typeof data.avgDrinkPriceCents === 'number' ? data.avgDrinkPriceCents : null;

  if (target === null || target <= 0) {
    return (strings.bodyNoTarget || 'Total: {{total}}').replace('{{total}}', fmt(totalCents));
  }
  if (totalCents <= target) {
    const leftCents = target - totalCents;
    let body = (strings.bodyUnderTarget || '{{total}} / {{left}}')
      .replace('{{total}}', fmt(totalCents))
      .replace('{{left}}', fmt(leftCents));
    if (avgDrink !== null && avgDrink > 0) {
      const drinks = Math.floor(leftCents / avgDrink);
      if (drinks > 0 && strings.drinksToTarget) {
        body += '\n' + strings.drinksToTarget.replace('{{count}}', String(drinks));
      }
    }
    return body;
  }
  return (strings.bodyOverTarget || '{{total}} (+{{over}})')
    .replace('{{total}}', fmt(totalCents))
    .replace('{{over}}', fmt(totalCents - target));
}

/** Re-renders the persistent notification from fresh DB state. */
async function refreshOutingNotification(dbConn, session, data) {
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
    body: buildOutingBodySw(total, data),
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    silent: true,
    renotify: false,
    requireInteraction: true,
    actions,
    data,
  });
}

/** Mirrors createExpenseTransaction + createSessionItem record shapes. */
async function swDirectQuickAdd(amountCents, data) {
  const dbConn = await openDb();
  try {
    // BUG-006: bail out cleanly if the schema the app owns is not in place.
    if (!hasStores(dbConn, ['sessions', 'transactions', 'sessionItems'])) return;
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
    const strings = data.strings || {};
    await refreshOutingNotification(dbConn, session, data);

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
    if (!hasStores(dbConn, ['transactions'])) return;
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
  // BUG-006: a single top-level guard so a rejected DB open (mid-upgrade →
  // 'idb-blocked') or a missing store can never surface as an unhandled
  // rejection inside event.waitUntil. The window re-syncs on focus regardless.
  try {
    const data = event.notification.data || {};
    const action = event.action;

    if (data.kind === 'outing' && action && action.indexOf('quick_add_') === 0) {
      const amountCents = (data.amounts || {})[action];
      if (typeof amountCents !== 'number') return;
      try {
        await swDirectQuickAdd(amountCents, data);
      } finally {
        await broadcastOutingChange();
      }
      return;
    }

    if (data.kind === 'followup' && action && action.indexOf('sub_') === 0) {
      event.notification.close();
      const subcategoryId = action.slice(4);
      try {
        await swDirectSetSubcategory(data.txId, subcategoryId);
      } finally {
        await broadcastOutingChange();
      }
      return;
    }

    // Body click or explicit "open" → bring the outing screen up.
    if (data.kind === 'followup') event.notification.close();
    await focusOrOpen('/outings/active');
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[SW] outing action failed:', err);
  }
}

// ---------------------------------------------------------------------------
// M8 (E5): daily check-in notification — answerable where Notification Actions
// exist; degrades to "open the app on the dashboard" otherwise (ÂNCORA 19).
// The action click writes the intent straight to appSettings (mirrors
// createDailyCheckIn) and broadcasts so any open window refreshes.
// ---------------------------------------------------------------------------

/** Tells every open window the DB changed (mirrors APP_DATA_CHANGED_EVENT). */
async function broadcastAppDataChange() {
  const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  clientList.forEach((client) => {
    try {
      client.postMessage({ type: 'APP_DATA_CHANGED' });
    } catch {
      // Frozen/dying client — it re-syncs on visibilitychange anyway.
    }
  });
}

/** Mirrors createDailyCheckIn — sets the day's intent on the settings row. */
async function swDirectSetCheckIn(intent, date) {
  const dbConn = await openDb();
  try {
    if (!hasStores(dbConn, [APP_SETTINGS_STORE])) return;
    const settings = await idbGet(dbConn, APP_SETTINGS_STORE, APP_SETTINGS_ID);
    // BUG-003: the SW must NEVER create the settings row (that would persist
    // activeTrip:null and orphan trips). Only update an existing one.
    if (!settings) return;
    settings.dailyCheckIn = { date, intent };
    await idbPut(dbConn, APP_SETTINGS_STORE, settings);
  } finally {
    dbConn.close();
  }
}

async function handleCheckInAction(event) {
  try {
    const data = event.notification.data || {};
    const action = event.action;

    if (action && CHECKIN_INTENTS.indexOf(action) !== -1) {
      event.notification.close();
      try {
        await swDirectSetCheckIn(action, data.date);
      } finally {
        await broadcastAppDataChange();
      }
      return;
    }

    // Body click or "open" → bring the dashboard (check-in card) up.
    event.notification.close();
    await focusOrOpen('/dashboard');
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[SW] check-in action failed:', err);
  }
}

// The live-split notification is informational: a tap just brings the table up.
async function handleSplitAction(event) {
  try {
    const data = event.notification.data || {};
    await focusOrOpen(typeof data.url === 'string' ? data.url : '/split/scan');
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[SW] split action failed:', err);
  }
}

// ---------------------------------------------------------------------------
// Web Push VAPID handler. The worker sends a push with a JSON body carrying
// { title, body, url, tag }. The SW shows a native notification and taps
// deep-link into the relevant screen.
// ---------------------------------------------------------------------------

self.addEventListener('push', (event) => {
  var title = 'TripPilot';
  var body = 'You have pending actions';
  var url = '/dashboard';
  var tag = 'trippilot-push';

  if (event.data) {
    try {
      var payload = event.data.json();
      title = payload.title || title;
      body = payload.body || body;
      url = payload.url || url;
      tag = payload.tag || tag;
    } catch {
      // Malformed JSON — use defaults.
    }
  }

  var options = {
    body: body,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: tag,
    data: { url: url },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  if (
    event.notification.tag === OUTING_TAG ||
    event.notification.tag === FOLLOWUP_TAG
  ) {
    event.waitUntil(handleOutingAction(event));
  } else if (event.notification.tag === CHECKIN_TAG) {
    event.waitUntil(handleCheckInAction(event));
  } else if (event.notification.tag === SPLIT_TAG) {
    event.waitUntil(handleSplitAction(event));
  } else {
    const data = event.notification.data || {};
    event.notification.close();
    event.waitUntil(focusOrOpen(data.url || '/dashboard'));
  }
});
