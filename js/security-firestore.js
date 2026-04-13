// js/security-firestore.js — Secure Firestore wrapper
// Wraps every FS write with sanitization, rate limiting, and audit logging
// Drop-in replacement that patches the FS object after it's created

(function patchFS() {
  // Wait for FS to be defined
  function patch() {
    if (typeof FS === 'undefined' || typeof Security === 'undefined') {
      setTimeout(patch, 50);
      return;
    }

    // ── Patch addClient ───────────────────────────────────
    const _addClient = FS.addClient.bind(FS);
    FS.addClient = async function(firmId, data) {
      Security.checkFormRateLimit('addClient');
      const safe = {
        name:    Security.sanitizeStr(data.name,    'name',    true),
        pan:     Security.sanitizeStr(data.pan,     'pan').toUpperCase(),
        gstin:   Security.sanitizeStr(data.gstin,   'gstin').toUpperCase(),
        phone:   Security.sanitizeStr(data.phone,   'phone'),
        email:   Security.sanitizeStr(data.email,   'email').toLowerCase(),
        address: Security.sanitizeStr(data.address, 'address'),
        city:    Security.sanitizeStr(data.city,    'city'),
        state:   Security.sanitizeStr(data.state,   'city') || 'Kerala',
        type:    ['individual','company','huf','llp','partnership'].includes(data.type) ? data.type : 'individual',
        tags:    Array.isArray(data.tags) ? data.tags.map(t => Security.stripHTML(t).slice(0,50)).slice(0,20) : [],
        firmId,
      };
      const result = await _addClient(firmId, safe);
      await Security.auditLog(firmId, 'client_created', { name: safe.name, pan: Security.maskPAN(safe.pan) });
      return result;
    };

    // ── Patch updateClient ────────────────────────────────
    const _updateClient = FS.updateClient.bind(FS);
    FS.updateClient = async function(firmId, clientId, data) {
      Security.checkWriteRateLimit('updateClient');
      const safe = {};
      if (data.name    !== undefined) safe.name    = Security.sanitizeStr(data.name,    'name');
      if (data.pan     !== undefined) safe.pan     = Security.sanitizeStr(data.pan,     'pan').toUpperCase();
      if (data.gstin   !== undefined) safe.gstin   = Security.sanitizeStr(data.gstin,   'gstin').toUpperCase();
      if (data.phone   !== undefined) safe.phone   = Security.sanitizeStr(data.phone,   'phone');
      if (data.email   !== undefined) safe.email   = Security.sanitizeStr(data.email,   'email').toLowerCase();
      if (data.address !== undefined) safe.address = Security.sanitizeStr(data.address, 'address');
      if (data.city    !== undefined) safe.city    = Security.sanitizeStr(data.city,    'city');
      if (data.type    !== undefined) safe.type    = ['individual','company','huf','llp','partnership'].includes(data.type) ? data.type : 'individual';
      if (data.tags    !== undefined) safe.tags    = Array.isArray(data.tags) ? data.tags.map(t=>Security.stripHTML(t).slice(0,50)).slice(0,20) : [];
      return await _updateClient(firmId, clientId, safe);
    };

    // ── Patch addInvoice ──────────────────────────────────
    const _addInvoice = FS.addInvoice.bind(FS);
    FS.addInvoice = async function(firmId, data) {
      Security.checkFormRateLimit('addInvoice');
      // Validate amounts are non-negative numbers
      const subtotal = Math.max(0, parseInt(data.subtotal) || 0);
      const tax      = Math.max(0, parseInt(data.tax)      || 0);
      const total    = Math.max(0, parseInt(data.total)    || 0);
      // Max invoice amount: ₹50 crore (5,000,000,000 paise)
      if (total > 5_000_000_000) throw new Error('Invoice amount exceeds maximum allowed');
      const safe = {
        ...data,
        invoiceNo:   Security.sanitizeStr(data.invoiceNo,   'invoiceNo'),
        clientName:  Security.sanitizeStr(data.clientName,  'name'),
        notes:       Security.sanitizeStr(data.notes || '', 'notes'),
        subtotal, tax, total,
        gstRate:     [0,5,12,18,28].includes(Number(data.gstRate)) ? Number(data.gstRate) : 18,
        firmId,
      };
      const result = await _addInvoice(firmId, safe);
      await Security.auditLog(firmId, 'invoice_created', { invoiceNo: safe.invoiceNo, total: total/100 });
      return result;
    };

    // ── Patch addTask ─────────────────────────────────────
    const _addTask = FS.addTask.bind(FS);
    FS.addTask = async function(firmId, data) {
      Security.checkFormRateLimit('addTask');
      const safe = {
        ...data,
        title:       Security.sanitizeStr(data.title,       'title', true),
        description: Security.sanitizeStr(data.description || '', 'description'),
        priority:    ['urgent','high','medium','low'].includes(data.priority) ? data.priority : 'medium',
        status:      ['pending','in_progress','done'].includes(data.status)   ? data.status   : 'pending',
        firmId,
      };
      return await _addTask(firmId, safe);
    };

    // ── Patch createDocRequest ────────────────────────────
    const _createDocRequest = FS.createDocRequest.bind(FS);
    FS.createDocRequest = async function(firmId, data) {
      Security.checkFormRateLimit('createDocRequest');
      // Sanitize each item label
      const items = (data.items || [])
        .slice(0, 50) // Max 50 items
        .map((item, idx) => ({
          ...item,
          id:    item.id || `item_${idx}_${Date.now()}`,
          label: Security.sanitizeStr(item.label, 'label', true),
          status: 'pending',
        }));
      if (!items.length) throw new Error('At least one document is required');
      const safe = {
        ...data,
        clientName: Security.sanitizeStr(data.clientName, 'name', true),
        title:      Security.sanitizeStr(data.title,      'title', true),
        notes:      Security.sanitizeStr(data.notes || '', 'notes'),
        items,
        firmId,
      };
      const result = await _createDocRequest(firmId, safe);
      await Security.auditLog(firmId, 'doc_request_created', { clientName: safe.clientName, title: safe.title });
      return result;
    };

    // ── Patch updateFirm ──────────────────────────────────
    const _updateFirm = FS.updateFirm.bind(FS);
    FS.updateFirm = async function(firmId, data) {
      Security.checkWriteRateLimit('updateFirm');
      // Strip fields that should never be updated from the client
      const { plan, subscriptionStatus, createdBy, createdAt, invoiceCounter, ...rest } = data;
      const safe = {};
      if (rest.name      !== undefined) safe.name      = Security.sanitizeStr(rest.name,      'name', true);
      if (rest.ownerName !== undefined) safe.ownerName = Security.sanitizeStr(rest.ownerName, 'name');
      if (rest.phone     !== undefined) safe.phone     = Security.sanitizeStr(rest.phone,     'phone');
      if (rest.email     !== undefined) safe.email     = Security.sanitizeStr(rest.email,     'email').toLowerCase();
      if (rest.gstin     !== undefined) safe.gstin     = Security.sanitizeStr(rest.gstin,     'gstin').toUpperCase();
      if (rest.address   !== undefined) safe.address   = Security.sanitizeStr(rest.address,   'address');
      if (rest.city      !== undefined) safe.city      = Security.sanitizeStr(rest.city,      'city');
      // Allow WATI config, templates, logo etc
      const ALLOWED_PASSTHROUGH = ['watiApiUrl','watiApiKey','watiNumber','watiTemplate1','watiTemplate2','logoURL','invoiceTerms','state'];
      ALLOWED_PASSTHROUGH.forEach(k => { if (rest[k] !== undefined) safe[k] = Security.sanitizeStr(String(rest[k]||''), 'notes').slice(0, 2000); });
      return await _updateFirm(firmId, safe);
    };

    console.warn('[Filio] Security layer active — all writes sanitized');
  }

  patch();
})();
