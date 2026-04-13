// js/data-integrity.js — Production Data Integrity Layer
// ═══════════════════════════════════════════════════════════════
//  Fixes:
//  Problem 1: Data consistency — validates all writes before they hit Firestore
//  Problem 2: Retry logic — wraps every write with exponential backoff
//  Problem 3: Multi-user conflict handling — optimistic locking via updatedAt
//  Also: network status awareness, partial-save recovery, write queue
// ═══════════════════════════════════════════════════════════════

const DataIntegrity = (() => {

  // ── 1. Network awareness ─────────────────────────────────────
  let _isOnline = navigator.onLine;
  let _pendingCount = 0;
  const _offlineQueue = [];

  window.addEventListener('online',  () => {
    _isOnline = true;
    _showNetworkBanner(false);
    _flushOfflineQueue();
  });
  window.addEventListener('offline', () => {
    _isOnline = false;
    _showNetworkBanner(true);
  });

  function _showNetworkBanner(offline) {
    const existing = document.getElementById('filio-network-banner');
    if (existing) existing.remove();
    if (!offline) return;
    const banner = document.createElement('div');
    banner.id = 'filio-network-banner';
    banner.style.cssText = [
      'position:fixed', 'top:0', 'left:0', 'right:0', 'z-index:9999',
      'background:#744210', 'color:#FEFCBF', 'font-size:.8125rem',
      'font-weight:600', 'text-align:center', 'padding:.5rem 1rem',
      'display:flex', 'align-items:center', 'justify-content:center', 'gap:.5rem',
    ].join(';');
    banner.textContent = '⚠️  You are offline. Changes will sync when connection is restored.';
    document.body.prepend(banner);
  }

  // ── 2. Retry with exponential backoff ────────────────────────
  async function withRetry(fn, opts = {}) {
    const {
      maxAttempts = 3,
      baseDelayMs = 800,
      label       = 'operation',
    } = opts;

    let lastError;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const result = await fn();
        return result;
      } catch (err) {
        lastError = err;

        // Don't retry permission errors — they won't fix themselves
        const code = err.code || '';
        if (code === 'permission-denied' || code === 'unauthenticated') throw err;

        // Don't retry validation errors
        if (err.message && err.message.startsWith('VALIDATION:')) throw err;

        if (attempt < maxAttempts) {
          const delay = baseDelayMs * Math.pow(2, attempt - 1) + Math.random() * 200;
          console.warn(`[Filio] ${label} attempt ${attempt} failed, retrying in ${Math.round(delay)}ms:`, err.message);
          await new Promise(r => setTimeout(r, delay));
        }
      }
    }
    console.error(`[Filio] ${label} failed after ${maxAttempts} attempts:`, lastError);
    throw lastError;
  }

  // ── 3. Optimistic conflict detection ────────────────────────
  // Pass the doc's current updatedAt when you start editing.
  // Before saving, check Firestore hasn't changed since you loaded it.
  async function checkNoConflict(docRef, localUpdatedAt) {
    if (!localUpdatedAt) return; // No baseline — skip check
    const snap = await docRef.get();
    if (!snap.exists) return;
    const remoteTs = snap.data().updatedAt;
    if (!remoteTs) return;
    const remoteMs = remoteTs.toMillis ? remoteTs.toMillis() : 0;
    const localMs  = localUpdatedAt.toMillis
      ? localUpdatedAt.toMillis()
      : (localUpdatedAt instanceof Date ? localUpdatedAt.getTime() : 0);
    if (remoteMs > localMs + 1000) {
      throw new Error(
        'CONFLICT: This record was updated by another user while you were editing. ' +
        'Please close and reopen this form to see the latest version.'
      );
    }
  }

  // ── 4. Write validators ──────────────────────────────────────
  const Validators = {
    client(data) {
      const errors = [];
      if (!data.name || typeof data.name !== 'string' || data.name.trim().length < 2)
        errors.push('Client name is required (min 2 chars)');
      if (data.name && data.name.length > 300)
        errors.push('Client name too long (max 300 chars)');
      if (data.pan && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(data.pan.toUpperCase()))
        errors.push('Invalid PAN format (e.g. ABCDE1234F)');
      if (data.gstin && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(data.gstin.toUpperCase()))
        errors.push('Invalid GSTIN format');
      if (data.phone && !/^[6-9]\d{9}$/.test(data.phone))
        errors.push('Invalid mobile number (must be 10 digits starting with 6-9)');
      if (data.email && !/\S+@\S+\.\S+/.test(data.email))
        errors.push('Invalid email address');
      if (errors.length) throw new Error('VALIDATION: ' + errors.join(' | '));
    },

    invoice(data) {
      const errors = [];
      if (!data.clientId)    errors.push('Client is required');
      if (!data.clientName)  errors.push('Client name is required');
      if (typeof data.total !== 'number' || isNaN(data.total) || data.total < 0)
        errors.push('Invoice total must be a valid non-negative number');
      if (data.total > 100000000000) // 1000 Cr sanity check
        errors.push('Invoice total exceeds maximum allowed value');
      if (!data.status || !['draft','sent','paid','overdue','cancelled'].includes(data.status))
        errors.push('Invalid invoice status');
      if (errors.length) throw new Error('VALIDATION: ' + errors.join(' | '));
    },

    task(data) {
      const errors = [];
      if (!data.title || data.title.trim().length < 2)
        errors.push('Task title is required (min 2 chars)');
      if (data.title && data.title.length > 200)
        errors.push('Task title too long (max 200 chars)');
      if (data.priority && !['high','medium','low'].includes(data.priority))
        errors.push('Invalid priority value');
      if (data.status && !['pending','in_progress','done'].includes(data.status))
        errors.push('Invalid task status');
      if (errors.length) throw new Error('VALIDATION: ' + errors.join(' | '));
    },

    docRequest(data) {
      const errors = [];
      if (!data.clientId)   errors.push('Client is required');
      if (!data.title)      errors.push('Request title is required');
      if (!Array.isArray(data.items) || data.items.length === 0)
        errors.push('At least one document item is required');
      if (data.items && data.items.length > 50)
        errors.push('Maximum 50 document items per request');
      if (errors.length) throw new Error('VALIDATION: ' + errors.join(' | '));
    },

    firm(data) {
      const errors = [];
      if (!data.name || data.name.trim().length < 2)
        errors.push('Firm name is required (min 2 chars)');
      if (data.gstin && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(data.gstin.toUpperCase()))
        errors.push('Invalid GSTIN format');
      if (errors.length) throw new Error('VALIDATION: ' + errors.join(' | '));
    },
  };

  // ── 5. Duplicate detection ───────────────────────────────────
  // Check for duplicate clients before inserting
  async function checkDuplicateClient(firmId, data, excludeId = null) {
    const snap = await db.collection('firms').doc(firmId).collection('clients')
      .orderBy('createdAt', 'desc').limit(500).get();

    const existing = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(c => c.id !== excludeId);

    // PAN duplicate check
    if (data.pan) {
      const panMatch = existing.find(c =>
        c.pan && c.pan.toUpperCase() === data.pan.toUpperCase()
      );
      if (panMatch) {
        throw new Error(
          `DUPLICATE: A client with PAN ${data.pan.toUpperCase()} already exists: "${panMatch.name}". ` +
          'Please check before adding.'
        );
      }
    }

    // GSTIN duplicate check
    if (data.gstin) {
      const gstinMatch = existing.find(c =>
        c.gstin && c.gstin.toUpperCase() === data.gstin.toUpperCase()
      );
      if (gstinMatch) {
        throw new Error(
          `DUPLICATE: A client with GSTIN ${data.gstin.toUpperCase()} already exists: "${gstinMatch.name}". ` +
          'Please check before adding.'
        );
      }
    }
  }

  // ── 6. Offline write queue ───────────────────────────────────
  // Queues writes that fail due to being offline, retries on reconnect
  async function _flushOfflineQueue() {
    if (_offlineQueue.length === 0) return;
    // flushing queued writes — intentional debug line removed in prod by security.js hardenConsole()
    const items = [..._offlineQueue];
    _offlineQueue.length = 0;
    for (const item of items) {
      try {
        await withRetry(item.fn, { label: item.label });
        if (item.onSuccess) item.onSuccess();
      } catch (e) {
        console.error('[Filio] Queued write failed:', item.label, e.message);
        if (item.onError) item.onError(e);
      }
    }
    Toast.success(`✓ ${items.length} pending change${items.length > 1 ? 's' : ''} synced`);
  }

  function queueWrite(fn, label, onSuccess, onError) {
    _offlineQueue.push({ fn, label, onSuccess, onError });
  }

  // ── 7. Safe write wrapper — validates + retries + conflict-checks ──
  // This is the ONE function all write operations should go through
  async function safeWrite({
    validate,          // () => void — throw on invalid
    conflictRef,       // Firestore DocumentReference (optional)
    localUpdatedAt,    // Timestamp of doc when user loaded it (optional)
    write,             // async () => void — the actual Firestore write
    label = 'write',
    onSuccess,
    onError,
  }) {
    // 1. Validate
    if (validate) {
      try { validate(); }
      catch (e) {
        const msg = e.message.replace('VALIDATION: ', '');
        Toast.error(msg);
        if (onError) onError(e);
        return false;
      }
    }

    // 2. Conflict check (if editing existing doc)
    if (conflictRef && localUpdatedAt) {
      try {
        await checkNoConflict(conflictRef, localUpdatedAt);
      } catch (e) {
        Toast.error(e.message);
        if (onError) onError(e);
        return false;
      }
    }

    // 3. Offline — queue it
    if (!_isOnline) {
      queueWrite(write, label, onSuccess, onError);
      Toast.info('You\'re offline. Change queued and will sync when you reconnect.');
      return true;
    }

    // 4. Write with retry
    try {
      await withRetry(write, { label, maxAttempts: 3 });
      if (onSuccess) onSuccess();
      return true;
    } catch (e) {
      const msg = e.code === 'permission-denied'
        ? 'Permission denied. You may not have access to perform this action.'
        : e.code === 'unavailable'
        ? 'Firestore is temporarily unavailable. Please try again.'
        : `Save failed: ${e.message}`;
      Toast.error(msg);
      if (onError) onError(e);
      return false;
    }
  }

  // ── 8. Status transition guard ───────────────────────────────
  const VALID_TRANSITIONS = {
    task: {
      pending:     ['in_progress'],
      in_progress: ['done', 'pending'],
      done:        ['pending'],
    },
    invoice: {
      draft:    ['sent', 'cancelled'],
      sent:     ['paid', 'overdue', 'cancelled'],
      overdue:  ['paid', 'cancelled'],
      paid:     [],       // terminal
      cancelled: [],      // terminal
    },
  };

  function assertValidTransition(entity, fromStatus, toStatus) {
    const allowed = VALID_TRANSITIONS[entity]?.[fromStatus];
    if (!allowed) return; // unknown entity or status — allow
    if (!allowed.includes(toStatus)) {
      throw new Error(
        `VALIDATION: Cannot change ${entity} status from "${fromStatus}" to "${toStatus}".`
      );
    }
  }

  return {
    withRetry,
    safeWrite,
    checkDuplicateClient,
    checkNoConflict,
    assertValidTransition,
    Validators,
    get isOnline() { return _isOnline; },
  };

})();
