// js/security.js — Filio Security Layer
// ═══════════════════════════════════════════════════════════════
//  Covers:
//  1. Content Security Policy (CSP) enforcement
//  2. Rate limiting for auth and writes
//  3. Input sanitization & validation hardening
//  4. XSS prevention helpers
//  5. Session integrity checks
//  6. Audit logging
//  7. Data access control (client-side enforcement, backed by Firestore rules)
// ═══════════════════════════════════════════════════════════════

const Security = (() => {

  // ── 1. Content Security Policy ────────────────────────────
  // CSP is set via firebase.json headers (server-side) + index.html meta tags.
  // DO NOT inject CSP via JS — browsers block X-Frame-Options via meta
  // and some CSP directives cause SyntaxErrors when set via script.
  function applyCSP() {
    // No-op: CSP handled in firebase.json hosting headers and index.html
    // This is the correct and secure approach per browser security specs.
  }

  // ── 2. Rate Limiting ──────────────────────────────────────
  const _rateLimits = {};

  function rateLimit(key, maxAttempts, windowMs) {
    const now = Date.now();
    if (!_rateLimits[key]) _rateLimits[key] = { count: 0, resetAt: now + windowMs };
    const limit = _rateLimits[key];
    if (now > limit.resetAt) { limit.count = 0; limit.resetAt = now + windowMs; }
    limit.count++;
    if (limit.count > maxAttempts) {
      const waitSec = Math.ceil((limit.resetAt - now) / 1000);
      throw new Error(`Too many attempts. Please wait ${waitSec} seconds.`);
    }
    return true;
  }

  // Auth rate limit: 5 attempts per 5 minutes
  function checkAuthRateLimit() {
    return rateLimit('auth_signin', 5, 5 * 60 * 1000);
  }

  // Write rate limit: 100 Firestore writes per minute
  function checkWriteRateLimit(operationKey) {
    return rateLimit(`write_${operationKey}`, 100, 60 * 1000);
  }

  // Form submit rate limit: 10 per minute
  function checkFormRateLimit(formKey) {
    return rateLimit(`form_${formKey}`, 10, 60 * 1000);
  }

  // ── 3. Input Sanitization ─────────────────────────────────
  const MAX_LENGTHS = {
    name:        300,
    pan:         10,
    gstin:       15,
    phone:       15,
    email:       254,
    address:     500,
    city:        100,
    notes:       2000,
    title:       200,
    description: 2000,
    invoiceNo:   50,
    label:       200,
    tags:        500,
  };

  // Strip all HTML tags from a string
  function stripHTML(str) {
    if (typeof str !== 'string') return '';
    return str.replace(/<[^>]*>/g, '').trim();
  }

  // Sanitize a string field: strip HTML, trim whitespace, enforce max length
  function sanitizeStr(value, fieldName, required = false) {
    if (value == null || value === '') {
      if (required) throw new Error(`${fieldName} is required`);
      return '';
    }
    const cleaned  = stripHTML(String(value)).trim();
    const maxLen   = MAX_LENGTHS[fieldName] || 1000;
    if (cleaned.length > maxLen) {
      throw new Error(`${fieldName} is too long (max ${maxLen} characters)`);
    }
    return cleaned;
  }

  // Sanitize entire data object before writing to Firestore
  function sanitizePayload(data, schema) {
    const cleaned = {};
    for (const [field, config] of Object.entries(schema)) {
      const { type, required, maxLen } = config;
      const val = data[field];
      if (type === 'string') {
        cleaned[field] = sanitizeStr(val, field, required);
        if (maxLen && cleaned[field].length > maxLen) {
          cleaned[field] = cleaned[field].slice(0, maxLen);
        }
      } else if (type === 'number') {
        const num = parseFloat(val);
        if (isNaN(num)) {
          if (required) throw new Error(`${field} must be a number`);
          cleaned[field] = 0;
        } else {
          cleaned[field] = num;
        }
      } else if (type === 'boolean') {
        cleaned[field] = Boolean(val);
      } else if (type === 'array') {
        cleaned[field] = Array.isArray(val) ? val.map(v => stripHTML(String(v)).trim()) : [];
      } else {
        cleaned[field] = val;
      }
    }
    return cleaned;
  }

  // ── 4. XSS Prevention ─────────────────────────────────────
  // Already have esc() in utils.js — this adds DOM-based XSS protection

  // Safe text content setter (never use innerHTML with user data)
  function safeText(element, text) {
    if (!element) return;
    element.textContent = String(text || '');
  }

  // Validate URLs before using in href/src
  function safeURL(url) {
    if (!url || typeof url !== 'string') return '#';
    try {
      const parsed = new URL(url);
      if (!['https:', 'http:', 'blob:', 'data:'].includes(parsed.protocol)) return '#';
      // Block javascript: protocol
      if (parsed.protocol === 'javascript:') return '#';
      return url;
    } catch {
      return '#';
    }
  }

  // Validate file URLs from Firebase Storage (must be firebasestorage.googleapis.com)
  function validateStorageURL(url) {
    if (!url) return false;
    try {
      const parsed = new URL(url);
      return parsed.hostname.endsWith('firebasestorage.googleapis.com') ||
             parsed.hostname.endsWith('storage.googleapis.com');
    } catch { return false; }
  }

  // ── 5. Session Integrity ──────────────────────────────────
  let _sessionStart = Date.now();
  const SESSION_TIMEOUT_MS = 8 * 60 * 60 * 1000; // 8 hours

  function checkSessionTimeout() {
    if (Date.now() - _sessionStart > SESSION_TIMEOUT_MS) {
      console.warn('[Filio] Session expired — signing out');
      auth.signOut();
      return false;
    }
    return true;
  }

  function resetSession() {
    _sessionStart = Date.now();
  }

  // Activity-based session reset
  ['click','keydown','touchstart'].forEach(event => {
    document.addEventListener(event, () => { resetSession(); }, { passive: true });
  });

  // ── 6. Audit Logging ─────────────────────────────────────
  // Log all sensitive actions to Firestore for audit trail
  async function auditLog(firmId, action, details = {}) {
    if (!firmId || !auth.currentUser) return;
    try {
      await db.collection('firms').doc(firmId).collection('auditLog').add({
        uid:       auth.currentUser.uid,
        email:     auth.currentUser.email,
        action,
        details:   JSON.stringify(details).slice(0, 500), // Cap size
        userAgent: navigator.userAgent.slice(0, 200),
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      });
    } catch (e) {
      // Audit log failure should never break the app
      console.warn('[Filio] Audit log failed:', e.message);
    }
  }

  // ── 7. Data Access Control (client-side) ─────────────────
  // These checks mirror Firestore rules — defense in depth
  function assertFirmMember(userDoc, firmId) {
    if (!userDoc || userDoc.firmId !== firmId) {
      throw new Error('Access denied: Not a member of this firm');
    }
  }

  function assertOwnerOrPartner(userDoc, firmId) {
    assertFirmMember(userDoc, firmId);
    if (!['owner', 'partner'].includes(userDoc.role)) {
      throw new Error('Access denied: Owner or Partner role required');
    }
  }

  function assertOwner(userDoc, firmId) {
    assertFirmMember(userDoc, firmId);
    if (userDoc.role !== 'owner') {
      throw new Error('Access denied: Owner role required');
    }
  }

  // ── 8. Secure Token Generation ────────────────────────────
  // Use crypto.getRandomValues instead of Math.random()
  function generateSecureToken(length = 16) {
    const chars  = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No ambiguous chars
    const bytes  = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    return Array.from(bytes).map(b => chars[b % chars.length]).join('');
  }

  // ── 9. Sensitive Data Masking ─────────────────────────────
  // Mask PAN, phone, GSTIN in console output and UI where needed
  function maskPAN(pan) {
    if (!pan || pan.length < 6) return pan;
    return pan.slice(0, 3) + '•'.repeat(pan.length - 5) + pan.slice(-2);
  }

  function maskPhone(phone) {
    if (!phone || phone.length < 6) return phone;
    return phone.slice(0, 2) + '•'.repeat(phone.length - 4) + phone.slice(-2);
  }

  function maskGSTIN(gstin) {
    if (!gstin || gstin.length < 8) return gstin;
    return gstin.slice(0, 5) + '•'.repeat(gstin.length - 7) + gstin.slice(-2);
  }

  // ── 10. Anti-Clickjacking ─────────────────────────────────
  function preventClickjacking() {
    if (window.self !== window.top) {
      // We're in an iframe — block rendering
      document.body.style.display = 'none';
      console.error('[Filio] Clickjacking attempt detected — blocked');
    }
  }

  // ── 11. Secure localStorage wrapper ──────────────────────
  // Only store non-sensitive preferences — never store tokens, PAN, or financial data
  const SecureStorage = {
    ALLOWED_KEYS: ['filio_theme', 'filio_sidebar_collapsed', 'filio_last_page'],

    set(key, value) {
      if (!this.ALLOWED_KEYS.includes(key)) {
        console.warn(`[Filio Security] Blocked write to localStorage key: ${key}`);
        return;
      }
      try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
    },

    get(key) {
      if (!this.ALLOWED_KEYS.includes(key)) return null;
      try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
    },

    clear() {
      this.ALLOWED_KEYS.forEach(k => { try { localStorage.removeItem(k); } catch {} });
    },
  };

  // ── 12. Console hardening (production) ───────────────────
  function hardenConsole() {
    // In production, suppress console.log to avoid data leakage in DevTools
    // Keep errors for legitimate debugging
    if (window.location.hostname !== 'localhost' &&
        !window.location.hostname.includes('127.0.0.1')) {
      const noop = () => {};
      console.log  = noop;
      console.debug = noop;
      console.info  = noop;
      // Keep console.warn and console.error for legitimate error monitoring
    }
  }

  // ── Init ──────────────────────────────────────────────────
  function init() {
    preventClickjacking();
    applyCSP();
    hardenConsole();
    // Check session every 30 minutes
    setInterval(checkSessionTimeout, 30 * 60 * 1000);
  }

  return {
    init,
    // Rate limiting
    checkAuthRateLimit,
    checkWriteRateLimit,
    checkFormRateLimit,
    // Sanitization
    sanitizeStr,
    sanitizePayload,
    stripHTML,
    // XSS prevention
    safeText,
    safeURL,
    validateStorageURL,
    // Session
    checkSessionTimeout,
    resetSession,
    // Audit
    auditLog,
    // Access control
    assertFirmMember,
    assertOwnerOrPartner,
    assertOwner,
    // Tokens
    generateSecureToken,
    // Masking
    maskPAN,
    maskPhone,
    maskGSTIN,
    // Storage
    SecureStorage,
  };
})();
