// js/pages/clients.js — Fixed: global event bug, error display, invite link

const ClientsPage = {
  _unsub: null, _clients: [], _firm: null,
  _search: '', _typeFilter: 'all',

  mount(firm) {
    this._firm = firm; this._clients = [];
    this._render();
    this._unsub = FS.subscribeClients(firm.id, docs => { this._clients = docs; this._renderList(); });
  },
  unmount() { if (this._unsub) { this._unsub(); this._unsub = null; } },

  _filtered() {
    const q = this._search.toLowerCase();
    return this._clients.filter(c => {
      const m = !q || [c.name,c.pan,c.gstin,c.phone,c.email].some(v=>(v||'').toLowerCase().includes(q));
      return m && (this._typeFilter==='all' || c.type===this._typeFilter);
    });
  },

  _render() {
    const cnt = Layout.getContentEl(); if (!cnt) return;
    cnt.innerHTML = `
    <div class="section-header" style="margin-bottom:1.5rem">
      <h2 style="font-size:1.5rem;font-weight:600">Clients <span style="font-size:1rem;color:var(--text-muted);font-family:var(--font-body)" id="client-count"></span></h2>
      <button class="btn btn-primary btn-sm" onclick="ClientsPage.openAdd()">${Icons.plus} Add Client</button>
    </div>
    <div style="display:flex;gap:.75rem;margin-bottom:1.25rem;flex-wrap:wrap;align-items:center">
      <div class="search-bar" style="flex:1;min-width:200px;max-width:340px">
        ${Icons.search}
        <input type="text" placeholder="Search name, PAN, phone…" id="client-search" oninput="ClientsPage._onSearch(this.value)" />
      </div>
      <div class="tabs" id="type-tabs">
        ${['all','individual','company','huf','llp','partnership'].map(t=>`
          <button class="tab" data-type="${t}" onclick="ClientsPage._setType('${t}',this)">${t==='all'?'All':t.charAt(0).toUpperCase()+t.slice(1)}</button>`).join('')}
      </div>
    </div>
    <div class="card" style="padding:0;overflow:hidden">
      <div class="table-wrap">
        <table>
          <thead><tr><th>Client</th><th class="table-mobile-hide">Type</th><th class="table-mobile-hide">PAN</th><th class="table-mobile-hide">GSTIN</th><th class="table-mobile-hide">Phone</th><th>Actions</th></tr></thead>
          <tbody id="clients-tbody"><tr><td colspan="6" style="text-align:center;padding:3rem"><div class="spinner" style="margin:0 auto"></div></td></tr></tbody>
        </table>
      </div>
    </div>`;
    // Set active tab
    const tabs = document.querySelectorAll('#type-tabs .tab');
    tabs.forEach(b => b.classList.toggle('active', b.dataset.type === this._typeFilter));
  },

  _renderList() {
    const tbody  = document.getElementById('clients-tbody');
    const countEl = document.getElementById('client-count');
    if (!tbody) return;
    const filtered = this._filtered();
    if (countEl) countEl.textContent = `(${this._clients.length})`;

    while (tbody.firstChild) tbody.removeChild(tbody.firstChild);

    if (!filtered.length) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 6;
      const empty = DOM.emptyState(Icons.users,
        this._search || this._typeFilter !== 'all' ? 'No matches' : 'No clients yet');
      if (!this._search) {
        const addBtn = document.createElement('button');
        addBtn.className = 'btn btn-primary btn-sm';
        addBtn.style.marginTop = '.75rem';
        addBtn.textContent = 'Add Client';
        addBtn.addEventListener('click', () => ClientsPage.openAdd());
        empty.appendChild(addBtn);
      }
      td.appendChild(empty); tr.appendChild(td); tbody.appendChild(tr);
      return;
    }

    const frag = document.createDocumentFragment();
    filtered.forEach(c => {
      const tr = document.createElement('tr');

      // Name + email
      const nameTd = document.createElement('td');
      const nameWrap = document.createElement('div');
      nameWrap.style.cssText = 'display:flex;align-items:center;gap:.625rem';
      const av = document.createElement('div');
      av.className = 'avatar';
      av.style.cssText = 'background:rgba(201,168,76,.12);color:var(--gold);font-size:.7rem;width:30px;height:30px;flex-shrink:0';
      av.textContent = Fmt.initials(c.name);
      const nameInfo = document.createElement('div');
      const nameEl = document.createElement('div');
      nameEl.style.fontWeight = '500';
      nameEl.textContent = c.name || '—';
      nameInfo.appendChild(nameEl);
      if (c.email) {
        const emailEl = document.createElement('div');
        emailEl.style.cssText = 'font-size:.72rem;color:var(--text-muted)';
        emailEl.textContent = c.email;
        nameInfo.appendChild(emailEl);
      }
      nameWrap.append(av, nameInfo);
      nameTd.appendChild(nameWrap);

      // Type
      const typeTd = document.createElement('td');
      typeTd.className = 'table-mobile-hide';
      const typeBadge = document.createElement('span');
      typeBadge.className = 'badge badge-muted';
      typeBadge.style.textTransform = 'capitalize';
      typeBadge.textContent = c.type || 'individual';
      typeTd.appendChild(typeBadge);

      // PAN
      const panTd = document.createElement('td'); panTd.className = 'table-mobile-hide';
      const panCode = document.createElement('code'); panCode.style.cssText = 'font-size:.8rem;color:var(--text-secondary)'; panCode.textContent = c.pan || '—'; panTd.appendChild(panCode);

      // GSTIN
      const gstinTd = document.createElement('td'); gstinTd.className = 'table-mobile-hide';
      const gstinCode = document.createElement('code'); gstinCode.style.cssText = 'font-size:.75rem;color:var(--text-muted)'; gstinCode.textContent = c.gstin || '—'; gstinTd.appendChild(gstinCode);

      // Phone
      const phoneTd = document.createElement('td'); phoneTd.className = 'table-mobile-hide'; phoneTd.style.color = 'var(--text-secondary)'; phoneTd.textContent = c.phone || '—';

      // Actions — IDs captured in closure, never injected into HTML strings
      const actionsTd = document.createElement('td');
      const actWrap = document.createElement('div'); actWrap.style.cssText = 'display:flex;gap:.25rem';
      const inviteBtn = DOM.actionBtn(Icons.link,  'Copy invite link', () => ClientsPage._copyInvite(c.id));
      const editBtn   = DOM.actionBtn(Icons.edit,  'Edit',             () => ClientsPage.openEdit(c.id));
      const delBtn    = DOM.actionBtn(Icons.trash, 'Delete',           () => ClientsPage.openDelete(c.id, c.name || ''));
      delBtn.style.color = 'var(--red)';
      actWrap.append(inviteBtn, editBtn, delBtn);
      actionsTd.appendChild(actWrap);

      tr.append(nameTd, typeTd, panTd, gstinTd, phoneTd, actionsTd);
      frag.appendChild(tr);
    });
    tbody.appendChild(frag);
  },

  // FIX: pass button element directly, don't use global `event`
  _setType(t, btn) {
    this._typeFilter = t;
    document.querySelectorAll('#type-tabs .tab').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    this._renderList();
  },
  _onSearch(v) { this._search = v; this._renderList(); },

  async _copyInvite(clientId) {
    try {
      const token = await FS.createClientInvite(this._firm.id, clientId);
      const link = `${window.location.origin}${window.location.pathname}#/portal?token=${token}`;
      copyText(link, 'Client invite link copied!');
    } catch(e) { Toast.error('Failed to generate invite link'); }
  },

  openAdd()    { this._showModal(null); },
  openEdit(id) { this._showModal(this._clients.find(c=>c.id===id)); },

  _showModal(client) {
    const isEdit = !!client;
    const f = client || {};
    const tagsStr = Array.isArray(f.tags) ? f.tags.join(', ') : '';

    showModal(`
      <div class="modal-header">
        <h3 class="modal-title">${isEdit?'Edit Client':'Add Client'}</h3>
        <button class="modal-close" onclick="closeModal()">${Icons.x}</button>
      </div>
      <div class="grid-2">
        <div class="input-group">
          <label class="input-label">Full Name *</label>
          <input class="input" id="cf-name" value="${esc(f.name||'')}" placeholder="Client full name" />
          <span class="error-text" id="cf-name-err" style="display:none">Name is required</span>
        </div>
        <div class="input-group">
          <label class="input-label">Type</label>
          <select class="input" id="cf-type">
            ${['individual','company','huf','llp','partnership'].map(t=>
              `<option value="${t}" ${(f.type||'individual')===t?'selected':''}>${t.charAt(0).toUpperCase()+t.slice(1)}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="grid-2">
        <div class="input-group">
          <label class="input-label">PAN</label>
          <input class="input" id="cf-pan" value="${esc(f.pan||'')}" placeholder="ABCDE1234F" style="text-transform:uppercase" />
          <span class="error-text" id="cf-pan-err" style="display:none"></span>
        </div>
        <div class="input-group">
          <label class="input-label">GSTIN</label>
          <input class="input" id="cf-gstin" value="${esc(f.gstin||'')}" placeholder="29AABCT1332L1ZV" style="text-transform:uppercase" />
          <span class="error-text" id="cf-gstin-err" style="display:none"></span>
        </div>
      </div>
      <div class="grid-2">
        <div class="input-group">
          <label class="input-label">Mobile</label>
          <input class="input" id="cf-phone" value="${esc(f.phone||'')}" placeholder="9876543210" type="tel" />
          <span class="error-text" id="cf-phone-err" style="display:none"></span>
        </div>
        <div class="input-group">
          <label class="input-label">Email</label>
          <input class="input" id="cf-email" value="${esc(f.email||'')}" placeholder="client@email.com" type="email" />
          <span class="error-text" id="cf-email-err" style="display:none"></span>
        </div>
      </div>
      <div class="input-group">
        <label class="input-label">Address</label>
        <input class="input" id="cf-address" value="${esc(f.address||'')}" placeholder="Street, Locality" />
      </div>
      <div class="grid-2">
        <div class="input-group">
          <label class="input-label">City</label>
          <input class="input" id="cf-city" value="${esc(f.city||'')}" placeholder="Kochi" />
        </div>
        <div class="input-group">
          <label class="input-label">State</label>
          <select class="input" id="cf-state">${stateOptions(f.state||'Kerala')}</select>
        </div>
      </div>
      <div class="input-group">
        <label class="input-label">Tags <span style="color:var(--text-muted);font-size:.75rem">(comma-separated)</span></label>
        <input class="input" id="cf-tags" value="${esc(tagsStr)}" placeholder="gst, itr, audit" />
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" id="cf-save-btn" onclick="ClientsPage._save('${isEdit?client.id:''}')">${isEdit?'Save Changes':'Add Client'}</button>
      </div>`);
  },

  async _save(editId) {
    const name  = el('cf-name')?.value.trim();
    const pan   = el('cf-pan')?.value.trim().toUpperCase();
    const gstin = el('cf-gstin')?.value.trim().toUpperCase();
    const phone = el('cf-phone')?.value.trim();
    const email = el('cf-email')?.value.trim();

    const data = {
      name, pan, gstin, phone, email,
      type:    el('cf-type')?.value    || 'individual',
      address: el('cf-address')?.value.trim() || '',
      city:    el('cf-city')?.value.trim()    || '',
      state:   el('cf-state')?.value          || 'Kerala',
      tags:    (el('cf-tags')?.value||'').split(',').map(s=>s.trim()).filter(Boolean),
    };

    const btn = el('cf-save-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }

    // Duplicate PAN/GSTIN check on new clients
    if (!editId && (data.pan || data.gstin)) {
      try {
        await DataIntegrity.checkDuplicateClient(this._firm.id, data, null);
      } catch (e) {
        Toast.error(e.message.replace('DUPLICATE: ', ''));
        if (btn) { btn.disabled = false; btn.textContent = 'Add Client'; }
        return;
      }
    }

    // Conflict detection: grab the doc's updatedAt when user opened the form
    let localUpdatedAt = null;
    if (editId) {
      const existing = this._clients.find(c => c.id === editId);
      localUpdatedAt = existing?.updatedAt || null;
    }
    const conflictRef = editId
      ? db.collection('firms').doc(this._firm.id).collection('clients').doc(editId)
      : null;

    await DataIntegrity.safeWrite({
      validate:       () => DataIntegrity.Validators.client(data),
      conflictRef,
      localUpdatedAt,
      label:          editId ? 'updateClient' : 'addClient',
      write: async () => {
        if (editId) await FS.updateClient(this._firm.id, editId, data);
        else        await FS.addClient(this._firm.id, data);
      },
      onSuccess: () => { Toast.success(editId ? 'Client updated ✓' : 'Client added ✓'); closeModal(); },
      onError: (err) => {
        if (btn) { btn.disabled = false; btn.textContent = editId ? 'Save Changes' : 'Add Client'; }
        // Surface plan limit errors with an upgrade prompt
        if (err?.message?.includes('PLAN_LIMIT')) {
          const msg = err.message.replace('PLAN_LIMIT: ', '');
          showModal(`
            <div class="modal-header">
              <h3 class="modal-title">Plan Limit Reached</h3>
              <button class="modal-close" onclick="closeModal()">${Icons.x}</button>
            </div>
            <div style="padding:.5rem 0">
              <p style="color:var(--text-secondary);font-size:.875rem;line-height:1.7;margin-bottom:1.25rem">${esc(msg)}</p>
              <div class="modal-footer">
                <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
                <button class="btn btn-primary" onclick="closeModal();Router.navigate('/billing')">Upgrade Plan →</button>
              </div>
            </div>`);
        }
      },
    });
  },

  openDelete(id, name) {
    showModal(`
      <div class="modal-header"><h3 class="modal-title">Delete Client</h3><button class="modal-close" onclick="closeModal()">${Icons.x}</button></div>
      <p style="color:var(--text-secondary);line-height:1.7">Delete <strong style="color:var(--text-primary)">${esc(name)}</strong>? All associated data will be removed. This cannot be undone.</p>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button class="btn btn-danger" onclick="ClientsPage._confirmDelete('${id}')">Delete</button>
      </div>`);
  },
  async _confirmDelete(id) {
    await DataIntegrity.safeWrite({
      label: 'deleteClient',
      write: async () => FS.deleteClient(this._firm.id, id),
      onSuccess: () => { Toast.success('Client deleted'); AuditTrail.logClientDeleted(this._firm.id, id, '').catch(()=>{}); closeModal(); },
    });
  },
};
