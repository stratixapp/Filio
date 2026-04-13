// js/error-monitor.js — Production Error Monitoring
// ═══════════════════════════════════════════════════════════════
//  Lightweight error monitor — no external dependency needed.
//  Catches all uncaught JS errors + unhandled promise rejections,
//  logs them to Firestore /errors collection for the owner to view,
//  and optionally forwards to Sentry if configured.
//
//  To add Sentry (optional, free tier covers this app easily):
//  1. Sign up at sentry.io → create a project → copy DSN
//  2. Add to firebase-config.js:
//     const SENTRY_DSN = "https://xxx@xxx.sentry.io/xxx";
//  3. Add to index.html BEFORE other scripts:
//     <script src="https://browser.sentry-cdn.com/7.x.x/bundle.min.js"></script>
//  4. This file will auto-detect and init Sentry.
// ═══════════════════════════════════════════════════════════════

const ErrorMonitor = (() => {

  let _firmId   = null;
  let _userId   = null;
  let _userName = null;
  let _enabled  = false;
  let _errorCount = 0;
  const MAX_ERRORS_PER_SESSION = 50; // prevent runaway logging

  // ── Init — call after auth is ready ─────────────────────────
  function init(firmId, userId, userName) {
    _firmId   = firmId;
    _userId   = userId;
    _userName = userName;
    _enabled  = true;

    // Init Sentry if DSN is configured and SDK is loaded
    if (typeof Sentry !== 'undefined' &&
        typeof SENTRY_DSN !== 'undefined' &&
        SENTRY_DSN && !SENTRY_DSN.includes('PASTE')) {
      Sentry.init({
        dsn:         SENTRY_DSN,
        environment: window.location.hostname === 'localhost' ? 'development' : 'production',
        release:     'filio@3.0',
      });
      Sentry.setUser({ id: userId, username: userName });
      if (firmId) Sentry.setTag('firmId', firmId);
    }
  }

  // ── Log an error ─────────────────────────────────────────────
  async function logError(err, context = {}) {
    if (!_enabled) return;
    if (_errorCount >= MAX_ERRORS_PER_SESSION) return;
    _errorCount++;

    const entry = {
      message:    (err?.message || String(err)).slice(0, 500),
      stack:      (err?.stack   || '').slice(0, 1000),
      context:    JSON.stringify(context).slice(0, 300),
      url:        window.location.href.slice(0, 200),
      userAgent:  navigator.userAgent.slice(0, 150),
      firmId:     _firmId  || '',
      userId:     _userId  || '',
      userName:   _userName || '',
      timestamp:  firebase.firestore.FieldValue.serverTimestamp(),
      severity:   context.severity || 'error',
      resolved:   false,
    };

    // Forward to Sentry
    if (typeof Sentry !== 'undefined') {
      Sentry.captureException(err instanceof Error ? err : new Error(entry.message));
    }

    // Log to Firestore (non-blocking)
    try {
      await db.collection('errors').add(entry);
    } catch (e) {
      // If Firestore logging fails, just console — never throw
      console.warn('[ErrorMonitor] Could not log to Firestore:', e.message);
    }
  }

  // ── Global error handlers ─────────────────────────────────────
  window.addEventListener('error', (event) => {
    // Skip Firebase / third-party noise
    const src = event.filename || '';
    if (src.includes('gstatic.com') || src.includes('firebasejs')) return;

    logError(event.error || new Error(event.message), {
      type:     'uncaught',
      filename: src.split('/').pop(),
      line:     event.lineno,
      col:      event.colno,
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    // Skip Firebase offline / network errors — these are expected
    const msg = String(reason?.message || reason || '');
    if (msg.includes('offline') || msg.includes('Failed to fetch') ||
        msg.includes('NetworkError') || msg.includes('quota')) return;

    logError(reason instanceof Error ? reason : new Error(msg), {
      type: 'unhandledRejection',
    });
  });

  // ── Manual error reporting ────────────────────────────────────
  function capture(err, context = {}) {
    logError(err instanceof Error ? err : new Error(String(err)), context);
  }

  // ── Error dashboard (owner only) ─────────────────────────────
  function subscribeErrors(cb, limit = 50) {
    return db.collection('errors')
      .where('firmId', '==', _firmId || '')
      .where('resolved', '==', false)
      .orderBy('timestamp', 'desc')
      .limit(limit)
      .onSnapshot(
        s => cb(s.docs.map(d => ({ id: d.id, ...d.data() }))),
        () => cb([])
      );
  }

  async function markResolved(errorId) {
    await db.collection('errors').doc(errorId).update({ resolved: true });
  }

  return { init, capture, subscribeErrors, markResolved };

})();
