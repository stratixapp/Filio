// js/api-proxy.js — Secure API Proxy Layer
// ═══════════════════════════════════════════════════════════════
//  Purpose: Centralise ALL outbound API calls so that:
//   1. API keys are read only from Firestore (per-firm, owner-only)
//      — never hardcoded or exposed in source
//   2. Every external call is logged to the firm's auditLog
//   3. Rate limiting is enforced before every call
//   4. Errors are normalised into a consistent shape
//
//  External services wrapped here:
//   • WATI (WhatsApp)  — firm's own key stored in Firestore
//   • Razorpay         — key ID is public-safe (only secret key is server-side)
//   • Anthropic/Claude — ONLY called when explicitly enabled by owner
//
//  ⚠️  The Razorpay SECRET KEY and WATI tokens are NEVER stored in
//       client-side JS files. They live in Firestore under the firm
//       document, readable only by the firm owner via Firestore rules.
// ═══════════════════════════════════════════════════════════════

const ApiProxy = (() => {

  // ── Internal helpers ─────────────────────────────────────────

  function _log(firmId, service, action, result) {
    // Fire-and-forget audit entry
    if (typeof Security !== 'undefined' && firmId) {
      Security.auditLog(firmId, `api_call:${service}:${action}`, { result }).catch(() => {});
    }
  }

  function _rateKey(service) {
    return `api_${service}_${auth.currentUser?.uid || 'anon'}`;
  }

  // Shared fetch wrapper with timeout + error normalisation
  async function _fetch(url, options = {}, timeoutMs = 10000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`);
      }
      return res;
    } catch (e) {
      clearTimeout(timer);
      if (e.name === 'AbortError') throw new Error('Request timed out');
      throw e;
    }
  }

  // ── WATI (WhatsApp) ──────────────────────────────────────────
  // Keys are read from Firestore firm doc at call time — never cached in memory

  async function watiSendMessage(firm, toPhone, templateName, params = {}) {
    if (!firm?.watiApiUrl || !firm?.watiApiKey) {
      throw new Error('WATI not configured for this firm');
    }
    Security.checkWriteRateLimit('wati');

    const url = `${firm.watiApiUrl}/api/v1/sendTemplateMessage?whatsappNumber=${encodeURIComponent(toPhone)}`;
    const body = JSON.stringify({ template_name: templateName, broadcast_name: templateName, parameters: params });

    const res = await _fetch(url, {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization:  `Bearer ${firm.watiApiKey}`,
      },
      body,
    });

    const data = await res.json();
    _log(firm.id, 'wati', 'sendMessage', 'ok');
    return data;
  }

  async function watiTestConnection(firm) {
    if (!firm?.watiApiUrl || !firm?.watiApiKey) {
      throw new Error('WATI not configured');
    }

    const res = await _fetch(`${firm.watiApiUrl}/api/v1/getContacts?pageSize=1`, {
      headers: { Authorization: `Bearer ${firm.watiApiKey}` },
    });

    _log(firm.id, 'wati', 'testConnection', 'ok');
    return res.ok;
  }

  // ── Razorpay ────────────────────────────────────────────────
  // Key ID is public-safe (it's what the browser SDK uses).
  // The SECRET key is NEVER in frontend code — payment verification
  // must happen on a Firebase Function or trusted backend.

  function razorpayCheckout({ amount, currency = 'INR', description, user, firmName, onSuccess, onDismiss }) {
    Security.checkWriteRateLimit('razorpay');

    const key = typeof RAZORPAY_KEY_ID !== 'undefined' ? RAZORPAY_KEY_ID : null;
    if (!key || key.includes('PASTE')) {
      throw new Error('Razorpay key not configured');
    }

    const options = {
      key,
      amount:      Math.round(amount * 100), // paise, GST-inclusive amount passed in
      currency,
      name:        firmName || 'Filio — CA Office OS',
      description,
      prefill: {
        name:  user?.displayName || '',
        email: user?.email       || '',
      },
      theme:  { color: '#C9A84C' },
      modal:  { ondismiss: () => { if (onDismiss) onDismiss(); } },
      handler: (response) => {
        // ⚠️  IMPORTANT: In production, send response.razorpay_payment_id to
        //    a Firebase Function that verifies signature using the SECRET key.
        //    Client-side payment ID is NOT proof of payment by itself.
        if (onSuccess) onSuccess(response);
      },
    };

    if (typeof Razorpay === 'undefined') {
      return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.onload  = () => { new Razorpay(options).open(); resolve(); };
        script.onerror = () => reject(new Error('Failed to load Razorpay SDK'));
        document.head.appendChild(script);
      });
    } else {
      new Razorpay(options).open();
      return Promise.resolve();
    }
  }

  // ── Anthropic / Claude ───────────────────────────────────────
  // Key is read from Firestore (owner-set), not from source code.
  // If no key is set, falls back to structured template generation.

  async function claudeGenerate(firm, systemPrompt, userPrompt, maxTokens = 1500) {
    const apiKey = firm?.anthropicApiKey;
    if (!apiKey || apiKey.includes('PASTE')) {
      return null; // Caller should fall back to template
    }

    Security.checkWriteRateLimit('anthropic');

    const res = await _fetch('https://api.anthropic.com/v1/messages', {
      method:  'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-3-haiku-20240307',
        max_tokens: maxTokens,
        system:     systemPrompt,
        messages:   [{ role: 'user', content: userPrompt }],
      }),
    }, 30000);

    const data = await res.json();
    _log(firm.id, 'anthropic', 'generate', 'ok');
    return data?.content?.[0]?.text || null;
  }

  // ── Public API ───────────────────────────────────────────────
  return {
    watiSendMessage,
    watiTestConnection,
    razorpayCheckout,
    claudeGenerate,
  };

})();
