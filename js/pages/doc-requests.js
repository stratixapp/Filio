// js/pages/doc-requests.js — Phase 3: Document Collection
// CA creates document checklists per client per service
// Client uploads against each item via their portal
// Auto WhatsApp reminder if pending 3+ days
// CA sees upload status in real-time

const DocRequests = {
  _firm: null,
  _user: null,
  _clients: [],
  _requests: [],
  _unsub: null,
  _unsubClients: null,
  _filter: 'all',   // all | pending | partial | complete
  _search: '',

  // Common document templates
  _TEMPLATES: {
    'GST Monthly Filing': [
      'Sales invoices (this month)',
      'Purchase invoices (this month)',
      'Credit/debit notes',
      'E-way bills (if applicable)',
      'Bank statement for the month',
    ],
    'ITR Filing — Salaried': [
      'Form 16 (from employer)',
      '26AS download from income tax portal',
      'Bank statements (Apr–Mar)',
      'Investment proofs 80C (LIC, PPF, ELSS etc)',
      'Home loan interest certificate',
      'HRA rent receipts',
      'Donation receipts (80G)',
    ],
    'ITR Filing — Business': [
      'P&L Statement',
      'Balance Sheet',
      'Bank statements (Apr–Mar) — all accounts',
      '26AS from income tax portal',
      'GST returns summary',
      'Fixed asset register',
      'Loan statements',
    ],
    'Tax Audit': [
      'Audited financial statements',
      'Trial balance',
      'Fixed asset register with depreciation',
      'Stock statement (opening & closing)',
      'Bank reconciliation statements',
      'Debtors & creditors list',
      'All GST returns for the year',
    ],
    'ROC / Annual Filing': [
      'Board resolution for AGM',
      'Financial statements signed by directors',
      'Director KYC documents',
      'Shareholder register',
      'Minutes of last AGM',
    ],
    'TDS Return Filing': [
      'Salary details of all employees',
      'TDS challans paid (all months)',
      'Deductee details (PAN, name, amount)',
      'Form 15G/15H received (if any)',
    ],
    'Custom Checklist': [],
  },

  mount(user, firm) {
    this._user = user;
    this._firm = firm;
    this._requests = [];
    this._clients = [];
    this._render();
    this._unsubClients = FS.subscribeClients(firm.id, d => { this._clients = d; });
    this._unsub = FS.subscribeDocRequests(firm.id, d => {
      this._requests = d;
      this._renderList();
    });
    // Event delegation — reads data-* attrs, never evals injected IDs
    this._delegateHandler = (e) => {
      const btn = e.target.closest('[data-action][data-id]');
      if (!btn) return;
      const { action, id, name, phone } = btn.dataset;
      if (action === 'remind')   DocRequests._sendReminder(id, name || '', phone || '');
      if (action === 'view')     DocRequests.openView(id);
      if (action === 'edit')     DocRequests.openEdit(id);
      if (action === 'delete')   DocRequests._delete(id);
      if (action === 'copylink') DocRequests._copyLink(id);
      if (action === 'walink')   DocRequests._whatsappLink(id, name || '', phone || '');
    };
    document.addEventListener('click', this._delegateHandler);
  },

  unmount() {
    if (this._unsub)        { this._unsub();        this._unsub = null; }
    if (this._unsubClients) { this._unsubClients(); this._unsubClients = null; }
    if (this._delegateHandler) { document.removeEventListener('click', this._delegateHandler); this._delegateHandler = null; }
  },

  _filtered() {
    const q = this._search.toLowerCase();
    return this._requests.filter(r => {
      const matchSearch = !q ||
        (r.clientName||'').toLowerCase().includes(q) ||
        (r.title||'').toLowerCase().includes(q);
      const matchFilter = this._filter === 'all' || r.status === this._filter;
      return matchSearch && matchFilter;
    });
  },

  _render() {
    const cnt = Layout.getContentEl(); if (!cnt) return;
    cnt.innerHTML = `
    <div style="margin-bottom:1.5rem;display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:1rem">
      <div>
        <h2 style="font-size:1.5rem;font-weight:600">Document Collection</h2>
        <p style="color:var(--text-muted);font-size:.875rem;margin-top:.2rem">
          Create document checklists for clients — they upload, you review
        </p>
      </div>
      <button class="btn btn-primary btn-sm" onclick="DocRequests.openCreate()">
        ${Icons.plus} New Request
      </button>
    </div>

    <!-- Summary cards -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:.875rem;margin-bottom:1.5rem" id="docreq-summary"></div>

    <!-- Search + filter -->
    <div style="display:flex;gap:.75rem;margin-bottom:1.25rem;flex-wrap:wrap;align-items:center">
      <div class="search-bar" style="flex:1;min-width:200px;max-width:300px">
        ${Icons.search}
        <input type="text" placeholder="Search client or request…" oninput="DocRequests._onSearch(this.value)" />
      </div>
      <div class="tabs">
        ${[['all','All'],['pending','Pending'],['partial','Partial'],['complete','Complete']].map(([v,l])=>`
          <button class="tab${v===this._filter?' active':''}" onclick="DocRequests._setFilter('${v}',this)">${l}</button>`).join('')}
      </div>
    </div>

    <!-- Requests list -->
    <div id="docreq-list">
      <div style="display:flex;justify-content:center;padding:3rem">
        <div class="spinner spinner-lg"></div>
      </div>
    </div>`;
  },

  _renderList() {
    // Summary
    const sumEl = document.getElementById('docreq-summary');
    if (sumEl) {
      const total    = this._requests.length;
      const pending  = this._requests.filter(r => r.status==='pending').length;
      const partial  = this._requests.filter(r => r.status==='partial').length;
      const complete = this._requests.filter(r => r.status==='complete').length;
      sumEl.innerHTML = [
        {l:'Total Requests', v:total,    c:'--blue'},
        {l:'Pending',        v:pending,  c: pending>0?'--red':'--text-muted'},
        {l:'Partial Upload', v:partial,  c: partial>0?'--amber':'--text-muted'},
        {l:'Complete',       v:complete, c:'--green'},
      ].map(s=>`
        <div class="card" style="padding:.875rem">
          <div style="font-size:1.375rem;font-weight:700;color:var(${s.c})">${s.v}</div>
          <div style="font-size:.75rem;color:var(--text-muted);margin-top:.2rem">${s.l}</div>
        </div>`).join('');
    }

    const listEl = document.getElementById('docreq-list');
    if (!listEl) return;
    const filtered = this._filtered();

    if (!filtered.length) {
      listEl.innerHTML = `
        <div class="card">
          <div class="empty-state">
            <div style="font-size:3rem;margin-bottom:.5rem">📁</div>
            <h4>${this._search||this._filter!=='all'?'No matches':'No document requests yet'}</h4>
            <p>${this._filter==='all'&&!this._search?'Create a checklist and send it to your client':'Try a different filter'}</p>
            ${!this._search&&this._filter==='all'?`<button class="btn btn-primary btn-sm" style="margin-top:.75rem" onclick="DocRequests.openCreate()">${Icons.plus} New Request</button>`:''}
          </div>
        </div>`;
      return;
    }

    listEl.innerHTML = filtered.map(r => {
      const items    = r.items || [];
      const uploaded = items.filter(i => i.status === 'uploaded').length;
      const total    = items.length;
      const pct      = total > 0 ? Math.round(uploaded/total*100) : 0;
      const statusClr = r.status==='complete'?'var(--green)':r.status==='partial'?'var(--amber)':'var(--red)';
      const statusLbl = r.status==='complete'?'Complete':r.status==='partial'?'Partial':'Pending';

      // Days since created
      const createdAt = r.createdAt?.toDate ? r.createdAt.toDate() : new Date();
      const daysSince = Math.floor((Date.now() - createdAt.getTime()) / 86400000);
      const needsReminder = r.status !== 'complete' && daysSince >= 3;

      return `
      <div class="card" style="margin-bottom:1rem;border-left:3px solid ${statusClr}">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:.75rem;margin-bottom:.875rem">
          <div style="flex:1;min-width:0">
            <div style="display:flex;align-items:center;gap:.625rem;flex-wrap:wrap">
              <div class="avatar" style="background:rgba(201,168,76,.1);color:var(--gold);font-size:.7rem;width:28px;height:28px;flex-shrink:0">${Fmt.initials(r.clientName)}</div>
              <div>
                <span style="font-weight:600;font-size:.9375rem">${esc(r.clientName||'Unknown Client')}</span>
                <span style="color:var(--text-muted);font-size:.8rem;margin-left:.5rem">· ${esc(r.title)}</span>
              </div>
            </div>
            <div style="margin-top:.375rem;display:flex;gap:.5rem;flex-wrap:wrap;align-items:center">
              <span style="font-size:.72rem;padding:.2rem .6rem;border-radius:20px;font-weight:600;background:${statusClr}22;color:${statusClr}">${statusLbl}</span>
              <span style="font-size:.72rem;color:var(--text-muted)">${Fmt.date(r.createdAt)}</span>
              ${needsReminder ? `<span class="badge badge-amber" style="font-size:.7rem">⚠ ${daysSince}d waiting</span>` : ''}
              ${r.financialYear ? `<span class="badge badge-muted" style="font-size:.7rem">FY ${esc(r.financialYear)}</span>` : ''}
            </div>
          </div>
          <div style="display:flex;gap:.5rem;flex-shrink:0;align-items:center">
            ${needsReminder ? `
              <button class="btn btn-sm" style="background:rgba(37,211,102,.1);color:#25D366;border:1px solid rgba(37,211,102,.3);font-size:.75rem"
                data-action="remind" data-id="${r.id}" data-name="${esc(r.clientName||'')}" data-phone="${esc(r.clientPhone||'')}">
                📱 Remind
              </button>` : ''}
            <button class="btn btn-ghost btn-sm" data-action="view" data-id="${r.id}" style="font-size:.78rem">View</button>
            <button class="btn btn-icon btn-ghost" data-action="edit" data-id="${r.id}" title="Edit">${Icons.edit}</button>
            <button class="btn btn-icon btn-ghost" style="color:var(--red)" data-action="delete" data-id="${r.id}" title="Delete">${Icons.trash}</button>
          </div>
        </div>

        <!-- Progress bar -->
        <div style="display:flex;align-items:center;gap:.875rem">
          <div style="flex:1;height:6px;background:var(--bg-elevated);border-radius:3px;overflow:hidden">
            <div style="height:100%;background:${statusClr};border-radius:3px;width:${pct}%;transition:width .4s ease"></div>
          </div>
          <span style="font-size:.78rem;color:var(--text-secondary);white-space:nowrap;font-weight:500">${uploaded}/${total} uploaded</span>
        </div>

        <!-- Item mini-list -->
        <div style="margin-top:.875rem;display:flex;flex-wrap:wrap;gap:.375rem">
          ${items.slice(0,6).map(item => `
            <span style="font-size:.72rem;padding:.2rem .6rem;border-radius:20px;
              background:${item.status==='uploaded'?'var(--green-bg)':'var(--bg-elevated)'};
              color:${item.status==='uploaded'?'var(--green)':'var(--text-muted)'};
              border:1px solid ${item.status==='uploaded'?'rgba(56,161,105,.3)':'var(--border-light)'};
              display:flex;align-items:center;gap:.3rem">
              ${item.status==='uploaded'?'✓':''} ${esc(item.label)}
            </span>`).join('')}
          ${items.length > 6 ? `<span style="font-size:.72rem;color:var(--text-muted);padding:.2rem .4rem">+${items.length-6} more</span>` : ''}
        </div>

        <!-- Client invite link -->
        <div style="margin-top:.875rem;padding:.625rem .875rem;background:var(--bg-elevated);border-radius:var(--r-sm);display:flex;align-items:center;justify-content:space-between;gap:.75rem;flex-wrap:wrap">
          <span style="font-size:.75rem;color:var(--text-muted)">Client upload link:</span>
          <div style="display:flex;gap:.5rem">
            <button class="btn btn-ghost btn-sm" style="font-size:.72rem;color:var(--gold)" data-action="copylink" data-id="${r.id}">
              ${Icons.copy} Copy Link
            </button>
            <button class="btn btn-ghost btn-sm" style="font-size:.72rem;color:#25D366" data-action="walink" data-id="${r.id}" data-name="${esc(r.clientName||'')}" data-phone="${esc(r.clientPhone||'')}">
              📱 Send WhatsApp
            </button>
          </div>
        </div>
      </div>`;
    }).join('');
  },

  openCreate() {
    showModal(`
      <div class="modal-header">
        <h3 class="modal-title">New Document Request</h3>
        <button class="modal-close" onclick="closeModal()">${Icons.x}</button>
      </div>

      <div class="input-group" style="margin-bottom:1rem">
        <label class="input-label">Client *</label>
        <select class="input" id="dr-client">
          <option value="">— Select client —</option>
          ${this._clients.map(c=>`<option value="${c.id}" data-name="${esc(c.name)}" data-phone="${esc(c.phone||'')}">${esc(c.name)}</option>`).join('')}
        </select>
      </div>

      <div class="grid-2">
        <div class="input-group">
          <label class="input-label">Request Title *</label>
          <select class="input" id="dr-template" onchange="DocRequests._applyTemplate(this.value)">
            ${Object.keys(this._TEMPLATES).map(t=>`<option value="${t}">${t}</option>`).join('')}
          </select>
        </div>
        <div class="input-group">
          <label class="input-label">Financial Year</label>
          <select class="input" id="dr-fy">
            ${['2024-25','2023-24','2022-23','2025-26'].map(y=>`<option value="${y}">${y}</option>`).join('')}
          </select>
        </div>
      </div>

      <div class="input-group" style="margin-bottom:.75rem">
        <label class="input-label">Document Checklist</label>
        <div id="dr-items" style="display:flex;flex-direction:column;gap:.375rem;max-height:240px;overflow-y:auto;padding:.25rem 0"></div>
        <button class="btn btn-ghost btn-sm" style="margin-top:.5rem;font-size:.78rem;color:var(--gold)" onclick="DocRequests._addItem()">
          ${Icons.plus} Add item
        </button>
      </div>

      <div class="input-group" style="margin-bottom:1rem">
        <label class="input-label">Notes for client</label>
        <textarea class="input" id="dr-notes" rows="2" placeholder="e.g. Please upload scanned copies in PDF or JPG format"></textarea>
      </div>

      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" id="dr-save-btn" onclick="DocRequests._save()">
          ${Icons.plus} Create Request
        </button>
      </div>`);

    this._applyTemplate('GST Monthly Filing');
  },

  _applyTemplate(name) {
    const items = this._TEMPLATES[name] || [];
    const container = document.getElementById('dr-items');
    if (!container) return;
    container.innerHTML = items.map((label, i) => this._itemRow(i, label)).join('');
  },

  _itemRow(i, label='') {
    return `<div style="display:flex;gap:.5rem;align-items:center" id="dr-item-row-${i}">
      <input type="text" class="input" style="font-size:.85rem;padding:.375rem .625rem;flex:1"
        placeholder="Document name…" value="${esc(label)}" id="dr-item-${i}" />
      <button class="btn btn-icon btn-ghost" style="color:var(--red);flex-shrink:0"
        onclick="document.getElementById('dr-item-row-${i}').remove()">
        ${Icons.x}
      </button>
    </div>`;
  },

  _addItem() {
    const container = document.getElementById('dr-items');
    if (!container) return;
    const i = Date.now();
    container.insertAdjacentHTML('beforeend', this._itemRow(i));
    container.querySelector(`#dr-item-${i}`)?.focus();
  },

  async _save() {
    const clientSel = document.getElementById('dr-client');
    const clientId  = clientSel?.value;
    const clientName = clientId ? (clientSel.options[clientSel.selectedIndex]?.dataset?.name||'') : '';
    const clientPhone = clientId ? (clientSel.options[clientSel.selectedIndex]?.dataset?.phone||'') : '';
    const template  = document.getElementById('dr-template')?.value || 'Custom';
    const fy        = document.getElementById('dr-fy')?.value || '';
    const notes     = document.getElementById('dr-notes')?.value.trim() || '';

    if (!clientId) { Toast.error('Select a client'); return; }

    // Collect items
    const itemEls = document.querySelectorAll('#dr-items input[type=text]');
    const items = Array.from(itemEls)
      .map(el => el.value.trim())
      .filter(Boolean)
      .map((label, idx) => ({
        id:     `item_${idx}_${Date.now()}`,
        label,
        status: 'pending',
        uploadedAt: null,
        fileURL: null,
        fileName: null,
      }));

    if (!items.length) { Toast.error('Add at least one document item'); return; }

    const btn = document.getElementById('dr-save-btn');
    if (btn) { btn.disabled=true; btn.innerHTML='<div class="spinner"></div> Creating…'; }

    try {
      await FS.createDocRequest(this._firm.id, {
        clientId, clientName, clientPhone,
        title:         template,
        financialYear: fy,
        notes,
        items,
        reminderCount: 0,
        lastReminderAt: null,
      });
      Toast.success('Document request created');
      closeModal();
    } catch(e) {
      Toast.error('Failed to create request');
      if (btn) { btn.disabled=false; btn.innerHTML=`${Icons.plus} Create Request`; }
    }
  },

  openView(reqId) {
    const r = this._requests.find(x => x.id === reqId);
    if (!r) return;
    const items = r.items || [];
    const uploaded = items.filter(i => i.status==='uploaded').length;

    showModal(`
      <div class="modal-header">
        <h3 class="modal-title">${esc(r.title)}</h3>
        <button class="modal-close" onclick="closeModal()">${Icons.x}</button>
      </div>

      <div style="display:flex;gap:.5rem;flex-wrap:wrap;margin-bottom:1.25rem">
        <span class="badge badge-${r.status==='complete'?'green':r.status==='partial'?'amber':'red'}">${r.status}</span>
        <span class="badge badge-muted">${esc(r.clientName)}</span>
        ${r.financialYear ? `<span class="badge badge-muted">FY ${esc(r.financialYear)}</span>` : ''}
        <span class="badge badge-muted">${uploaded}/${items.length} uploaded</span>
      </div>

      ${r.notes ? `<div style="background:var(--bg-elevated);border-radius:var(--r-sm);padding:.75rem;margin-bottom:1.25rem;font-size:.85rem;color:var(--text-secondary)">${esc(r.notes)}</div>` : ''}

      <div style="display:flex;flex-direction:column;gap:.5rem;max-height:360px;overflow-y:auto">
        ${items.map(item => `
          <div style="display:flex;align-items:center;gap:.875rem;padding:.75rem;border-radius:var(--r-md);
            background:${item.status==='uploaded'?'var(--green-bg)':'var(--bg-elevated)'};
            border:1px solid ${item.status==='uploaded'?'rgba(56,161,105,.25)':'var(--border-light)'}">
            <div style="width:20px;height:20px;border-radius:50%;border:2px solid ${item.status==='uploaded'?'var(--green)':'var(--border)'};
              display:flex;align-items:center;justify-content:center;flex-shrink:0;
              background:${item.status==='uploaded'?'var(--green)':'transparent'}">
              ${item.status==='uploaded'?`<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>`:''}
            </div>
            <div style="flex:1;min-width:0">
              <div style="font-size:.875rem;font-weight:500">${esc(item.label)}</div>
              ${item.status==='uploaded' && item.fileName ? `<div style="font-size:.72rem;color:var(--green);margin-top:.1rem">📎 ${esc(item.fileName)}</div>` : ''}
              ${item.status==='uploaded' && item.uploadedAt ? `<div style="font-size:.7rem;color:var(--text-muted)">${Fmt.date(item.uploadedAt)}</div>` : ''}
            </div>
            <div style="display:flex;gap:.375rem;flex-shrink:0">
              ${item.status==='uploaded' ?
                `<button class="btn btn-ghost btn-sm" style="font-size:.7rem;color:var(--amber)"
                  data-action="itempending" data-reqid="${reqId}" data-itemid="${item.id}">Mark Pending</button>` :
                `<button class="btn btn-ghost btn-sm" style="font-size:.7rem;color:var(--green)"
                  data-action="itemuploaded" data-reqid="${reqId}" data-itemid="${item.id}">Mark Uploaded</button>`}
            </div>
          </div>`).join('')}
      </div>

      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal()">Close</button>
        <button class="btn btn-ghost" style="color:#25D366"
          onclick="DocRequests._whatsappLink('${reqId}','${esc(r.clientName||'')}','${esc(r.clientPhone||'')}');closeModal()">
          📱 Send to Client
        </button>
      </div>`);
  },

  openEdit(reqId) {
    const r = this._requests.find(x => x.id === reqId);
    if (!r) return;
    const items = r.items || [];

    showModal(`
      <div class="modal-header">
        <h3 class="modal-title">Edit Request</h3>
        <button class="modal-close" onclick="closeModal()">${Icons.x}</button>
      </div>
      <div class="input-group" style="margin-bottom:1rem">
        <label class="input-label">Title</label>
        <input class="input" id="dr-edit-title" value="${esc(r.title||'')}" />
      </div>
      <div class="input-group" style="margin-bottom:.75rem">
        <label class="input-label">Document Items</label>
        <div id="dr-edit-items" style="display:flex;flex-direction:column;gap:.375rem;max-height:240px;overflow-y:auto">
          ${items.map((item,i)=>this._itemRow(i, item.label)).join('')}
        </div>
        <button class="btn btn-ghost btn-sm" style="margin-top:.5rem;font-size:.78rem;color:var(--gold)" onclick="DocRequests._addEditItem()">${Icons.plus} Add item</button>
      </div>
      <div class="input-group" style="margin-bottom:1rem">
        <label class="input-label">Notes for client</label>
        <textarea class="input" id="dr-edit-notes" rows="2">${esc(r.notes||'')}</textarea>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="DocRequests._saveEdit('${reqId}')">Save Changes</button>
      </div>`);
  },

  _addEditItem() {
    const container = document.getElementById('dr-edit-items');
    if (!container) return;
    const i = Date.now();
    const html = `<div style="display:flex;gap:.5rem;align-items:center" id="dr-item-row-${i}">
      <input type="text" class="input" style="font-size:.85rem;padding:.375rem .625rem;flex:1" placeholder="Document name…" id="dr-item-${i}" />
      <button class="btn btn-icon btn-ghost" style="color:var(--red)" onclick="document.getElementById('dr-item-row-${i}').remove()">${Icons.x}</button>
    </div>`;
    container.insertAdjacentHTML('beforeend', html);
  },

  async _saveEdit(reqId) {
    const r = this._requests.find(x => x.id === reqId);
    if (!r) return;
    const title = document.getElementById('dr-edit-title')?.value.trim() || r.title;
    const notes = document.getElementById('dr-edit-notes')?.value.trim() || '';
    const itemEls = document.querySelectorAll('#dr-edit-items input[type=text]');
    const newLabels = Array.from(itemEls).map(el => el.value.trim()).filter(Boolean);

    // Merge: keep existing items by label, add new ones
    const existingMap = {};
    (r.items||[]).forEach(item => { existingMap[item.label] = item; });
    const items = newLabels.map((label, idx) => existingMap[label] || {
      id: `item_${idx}_${Date.now()}`, label, status: 'pending',
      uploadedAt: null, fileURL: null, fileName: null,
    });
    const uploaded = items.filter(i=>i.status==='uploaded').length;
    const status   = uploaded===items.length && items.length>0 ? 'complete' : uploaded>0 ? 'partial' : 'pending';

    try {
      await DataIntegrity.withRetry(() => FS.updateDocRequest(this._firm.id, reqId, { title, notes, items, status }), { label: 'updateDocRequest' });
      Toast.success('Request updated');
      closeModal();
    } catch(e) { Toast.error('Update failed'); }
  },

  async _markItemUploaded(reqId, itemId) {
    try {
      await DataIntegrity.withRetry(() => FS.updateDocItem(this._firm.id, reqId, itemId, {
        status: 'uploaded',
        uploadedAt: new Date(),
        uploadedBy: 'ca',
      }), { label: 'updateDocItem' });
      Toast.success('Marked as uploaded');
      // Re-open view modal with updated data
      setTimeout(() => this.openView(reqId), 300);
    } catch(e) { Toast.error('Update failed'); }
  },

  async _markItemPending(reqId, itemId) {
    try {
      await DataIntegrity.withRetry(() => FS.updateDocItem(this._firm.id, reqId, itemId, {
        status: 'pending',
        uploadedAt: null,
        fileURL: null,
        fileName: null,
      }), { label: 'updateDocItem' });
      Toast.success('Marked as pending');
      setTimeout(() => this.openView(reqId), 300);
    } catch(e) { Toast.error('Update failed'); }
  },

  async _delete(reqId) {
    if (!confirm('Delete this document request?')) return;
    try {
      await DataIntegrity.withRetry(() => FS.deleteDocRequest(this._firm.id, reqId), { label: 'deleteDocRequest' });
      Toast.success('Request deleted');
    } catch(e) { Toast.error('Delete failed'); }
  },

  _copyLink(reqId) {
    const r = this._requests.find(x => x.id === reqId);
    if (!r) return;
    // Generate client portal URL
    const base = window.location.href.split('#')[0];
    const link = `${base}#/client-portal?firm=${this._firm.id}&req=${reqId}`;
    copyText(link, 'Client upload link copied!');
  },

  _whatsappLink(reqId, clientName, clientPhone) {
    const r = this._requests.find(x => x.id === reqId);
    const base = window.location.href.split('#')[0];
    const link = `${base}#/client-portal?firm=${this._firm.id}&req=${reqId}`;
    const items = (r?.items||[]).filter(i=>i.status!=='uploaded').map(i=>`• ${i.label}`).join('\n');
    const msg = `Dear ${clientName||'Sir/Madam'},\n\nWe need the following documents for your ${r?.title||'filing'}${r?.financialYear?' (FY '+r.financialYear+')':''}:\n\n${items}\n\nPlease upload them here:\n${link}\n\nThank you,\n${this._firm?.name||'Your CA Firm'}`;
    const waUrl = `https://wa.me/${(clientPhone||'').replace(/\D/g,'')}?text=${encodeURIComponent(msg)}`;
    window.open(waUrl, '_blank');
    Toast.success('WhatsApp opened');
  },

  _sendReminder(reqId, clientName, clientPhone) {
    const req = this._requests.find(r => r.id === reqId);
    if (!req) return;

    // 1. WhatsApp (existing behaviour)
    this._whatsappLink(reqId, clientName, clientPhone);

    // 2. Email reminder if client email is available
    const client = this._clients.find(c => c.id === req.clientId);
    if (client?.email) {
      const uploadLink = `${window.location.origin}${window.location.pathname}#/client-portal?token=${req.clientToken || reqId}`;
      const daysSince  = req.createdAt?.toDate
        ? Math.floor((Date.now() - req.createdAt.toDate().getTime()) / 86400000)
        : 0;
      const isUrgent = daysSince >= 7;

      EmailService.sendDocReminder({
        firm:         this._firm,
        clientEmail:  client.email,
        clientName:   clientName || client.name,
        requestTitle: req.title || 'Document Request',
        uploadLink,
        isUrgent,
      }).then(() => {
        Toast.success('Reminder sent via WhatsApp' + (client.email ? ' & Email' : ''));
      }).catch(e => {
        // WhatsApp already sent — email failure is non-critical
        console.warn('[DocRequests] Email reminder failed:', e.message);
      });
    } else {
      Toast.success('WhatsApp reminder sent');
    }

    // Log the reminder
    FS.logReminder(this._firm.id, req.clientId, reqId, 'manual').catch(() => {});
  },

  _setFilter(v, btn) {
    this._filter = v;
    document.querySelectorAll('.tabs .tab').forEach(b=>b.classList.remove('active'));
    if(btn) btn.classList.add('active');
    this._renderList();
  },
  _onSearch(v) { this._search = v; this._renderList(); },
};
