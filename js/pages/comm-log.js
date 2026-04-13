// js/pages/comm-log.js — Phase 6: Communication Log
// Log every call, WhatsApp message, email, meeting against a client
// Junior can see full history before calling — no repeated conversations
// Bulk WhatsApp broadcast to all clients in one click

const CommLog = {
  _firm: null, _user: null,
  _comms: [], _clients: [],
  _unsub: null, _unsubClients: null,
  _clientFilter: 'all',
  _typeFilter: 'all',
  _search: '',

  COMM_TYPES: [
    { id:'call',      icon:'📞', label:'Phone Call',      color:'var(--blue)'   },
    { id:'whatsapp',  icon:'💬', label:'WhatsApp',        color:'#25D366'       },
    { id:'email',     icon:'📧', label:'Email',           color:'var(--purple)' },
    { id:'meeting',   icon:'🤝', label:'Meeting',         color:'var(--gold)'   },
    { id:'notice',    icon:'⚠️', label:'Notice Received', color:'var(--red)'    },
    { id:'other',     icon:'📝', label:'Other',           color:'var(--text-muted)' },
  ],

  mount(user, firm) {
    this._user = user; this._firm = firm;
    this._comms = []; this._clients = [];
    this._render();
    this._unsub = FS.subscribeCommunications(firm.id, null, d => {
      this._comms = d; this._renderList();
    });
    this._unsubClients = FS.subscribeClients(firm.id, d => {
      this._clients = d; this._renderFilters();
    });
    this._delegateHandler = (e) => {
      const btn = e.target.closest('[data-action][data-id]');
      if (!btn) return;
      const { action, id } = btn.dataset;
      if (action === 'edit')   CommLog._edit(id);
      if (action === 'delete') CommLog._delete(id);
    };
    document.addEventListener('click', this._delegateHandler);
  },

  unmount() {
    if (this._unsub)        { this._unsub();        this._unsub = null;     if (this._delegateHandler) { document.removeEventListener('click', this._delegateHandler); this._delegateHandler = null; }
  }
    if (this._unsubClients) { this._unsubClients(); this._unsubClients = null; }
  },

  _filtered() {
    const q = this._search.toLowerCase();
    return this._comms.filter(c => {
      const matchClient = this._clientFilter === 'all' || c.clientId === this._clientFilter;
      const matchType   = this._typeFilter   === 'all' || c.type     === this._typeFilter;
      const matchSearch = !q ||
        (c.summary||'').toLowerCase().includes(q) ||
        (c.clientName||'').toLowerCase().includes(q) ||
        (c.byName||'').toLowerCase().includes(q);
      return matchClient && matchType && matchSearch;
    });
  },

  _render() {
    const cnt = Layout.getContentEl(); if (!cnt) return;
    cnt.innerHTML = `
    <div style="margin-bottom:1.5rem;display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:1rem">
      <div>
        <h2 style="font-size:1.5rem;font-weight:600">Communication Log</h2>
        <p style="color:var(--text-muted);font-size:.875rem;margin-top:.2rem">
          Every call, message, email, and meeting — logged against the client
        </p>
      </div>
      <div style="display:flex;gap:.75rem;flex-wrap:wrap">
        <button class="btn btn-secondary btn-sm" onclick="CommLog.openBroadcast()" style="color:#25D366;border-color:rgba(37,211,102,.3)">
          📱 Bulk WhatsApp Broadcast
        </button>
        <button class="btn btn-primary btn-sm" onclick="CommLog.openAdd()">
          ${Icons.plus} Log Communication
        </button>
      </div>
    </div>

    <!-- Filters -->
    <div style="display:flex;gap:.75rem;margin-bottom:1.25rem;flex-wrap:wrap;align-items:center">
      <div class="search-bar" style="flex:1;min-width:200px;max-width:300px">
        ${Icons.search}
        <input type="text" placeholder="Search summary, client…" oninput="CommLog._onSearch(this.value)" />
      </div>
      <select class="input" id="comm-client-filter" style="width:180px;padding:.4rem .75rem"
        onchange="CommLog._clientFilter=this.value;CommLog._renderList()">
        <option value="all">All Clients</option>
      </select>
      <div class="tabs">
        ${['all',...this.COMM_TYPES.map(t=>t.id)].map((v,i) => {
          const t = this.COMM_TYPES.find(x=>x.id===v);
          return `<button class="tab${v==='all'?' active':''}" onclick="CommLog._setType('${v}',this)">${t?t.icon+' '+t.label:'All'}</button>`;
        }).join('')}
      </div>
    </div>

    <!-- Summary stats -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:.75rem;margin-bottom:1.5rem" id="comm-stats"></div>

    <!-- Log list -->
    <div id="comm-list">
      <div style="display:flex;justify-content:center;padding:3rem"><div class="spinner spinner-lg"></div></div>
    </div>`;
  },

  _renderFilters() {
    const sel = document.getElementById('comm-client-filter');
    if (!sel) return;
    const cur = sel.value;
    sel.innerHTML = `<option value="all">All Clients</option>` +
      this._clients.map(c => `<option value="${c.id}" ${c.id===cur?'selected':''}>${esc(c.name)}</option>`).join('');
  },

  _renderList() {
    // Stats
    const statsEl = document.getElementById('comm-stats');
    if (statsEl) {
      const counts = {};
      this.COMM_TYPES.forEach(t => { counts[t.id] = this._comms.filter(c=>c.type===t.id).length; });
      statsEl.innerHTML = [
        ['Total Logged', this._comms.length, '--blue'],
        ...this.COMM_TYPES.slice(0,4).map(t => [t.label, counts[t.id]||0, '--text-muted']),
      ].map(([l,v,c])=>`
        <div class="card" style="padding:.75rem;text-align:center">
          <div style="font-size:1.25rem;font-weight:700;color:var(${c})">${v}</div>
          <div style="font-size:.7rem;color:var(--text-muted);margin-top:.15rem">${l}</div>
        </div>`).join('');
    }

    const el = document.getElementById('comm-list');
    if (!el) return;
    const filtered = this._filtered();

    if (!filtered.length) {
      el.innerHTML = `<div class="card"><div class="empty-state">
        <div style="font-size:3rem;margin-bottom:.5rem">💬</div>
        <h4>${this._search||this._clientFilter!=='all'||this._typeFilter!=='all'?'No matches':'No communications logged yet'}</h4>
        <p>Log every client interaction — calls, WhatsApp, meetings, emails</p>
        <button class="btn btn-primary btn-sm" style="margin-top:.75rem" onclick="CommLog.openAdd()">${Icons.plus} Log Communication</button>
      </div></div>`;
      return;
    }

    el.innerHTML = filtered.map(c => {
      const type = this.COMM_TYPES.find(t => t.id === c.type) || this.COMM_TYPES[5];
      const date = c.createdAt?.toDate ? c.createdAt.toDate() : new Date();
      const isToday = date.toDateString() === new Date().toDateString();
      return `
      <div class="card" style="margin-bottom:.75rem;padding:1rem;border-left:3px solid ${type.color}">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:.75rem;flex-wrap:wrap">
          <div style="display:flex;gap:.875rem;align-items:flex-start;flex:1;min-width:0">
            <!-- Type icon -->
            <div style="width:38px;height:38px;border-radius:10px;background:${type.color}22;display:flex;align-items:center;justify-content:center;font-size:1.1rem;flex-shrink:0">${type.icon}</div>
            <div style="flex:1;min-width:0">
              <div style="display:flex;align-items:center;gap:.5rem;flex-wrap:wrap;margin-bottom:.25rem">
                <span style="font-weight:600;font-size:.875rem">${esc(c.clientName||'Unknown Client')}</span>
                <span class="badge badge-muted" style="font-size:.68rem">${type.label}</span>
                ${c.direction ? `<span class="badge badge-${c.direction==='inbound'?'blue':'green'}" style="font-size:.68rem">${c.direction}</span>` : ''}
              </div>
              <p style="font-size:.8125rem;color:var(--text-secondary);line-height:1.6;margin-bottom:.375rem">${esc(c.summary||'—')}</p>
              <div style="display:flex;gap:.75rem;flex-wrap:wrap;font-size:.72rem;color:var(--text-muted)">
                <span>👤 ${esc(c.byName||'Staff')}</span>
                <span>🕐 ${isToday ? 'Today, ' + date.toLocaleTimeString('en-IN', {hour:'2-digit',minute:'2-digit'}) : Fmt.date(c.createdAt)}</span>
                ${c.duration ? `<span>⏱ ${c.duration} min</span>` : ''}
                ${c.followUpDate ? `<span style="color:var(--amber)">📅 Follow up: ${Fmt.date({toDate:()=>new Date(c.followUpDate)})}</span>` : ''}
              </div>
              ${c.outcome ? `<div style="margin-top:.5rem;padding:.375rem .625rem;background:var(--bg-elevated);border-radius:var(--r-sm);font-size:.78rem;color:var(--text-secondary)"><strong>Outcome:</strong> ${esc(c.outcome)}</div>` : ''}
            </div>
          </div>
          <div style="display:flex;gap:.25rem;flex-shrink:0">
            <button class="btn btn-icon btn-ghost" data-action="edit" data-id="${c.id}" class="btn btn-icon btn-ghost" title="Edit">${Icons.edit}</button>
            <button class="btn btn-icon btn-ghost" style="color:var(--red)" data-action="delete" data-id="${c.id}" class="btn btn-icon btn-ghost" style="color:var(--red)" title="Delete">${Icons.trash}</button>
          </div>
        </div>
      </div>`;
    }).join('');
  },

  openAdd(prefillClientId) {
    showModal(`
      <div class="modal-header">
        <h3 class="modal-title">Log Communication</h3>
        <button class="modal-close" onclick="closeModal()">${Icons.x}</button>
      </div>
      <div class="grid-auto-2" style="margin-bottom:1rem">
        <div class="input-group">
          <label class="input-label">Client *</label>
          <select class="input" id="cl-client">
            <option value="">— Select client —</option>
            ${this._clients.map(c=>`<option value="${c.id}" data-name="${esc(c.name)}" ${c.id===prefillClientId?'selected':''}>${esc(c.name)}</option>`).join('')}
          </select>
        </div>
        <div class="input-group">
          <label class="input-label">Type *</label>
          <select class="input" id="cl-type">
            ${this.COMM_TYPES.map(t=>`<option value="${t.id}">${t.icon} ${t.label}</option>`).join('')}
          </select>
        </div>
        <div class="input-group">
          <label class="input-label">Direction</label>
          <select class="input" id="cl-dir">
            <option value="outbound">Outbound (we called/messaged)</option>
            <option value="inbound">Inbound (they contacted us)</option>
          </select>
        </div>
        <div class="input-group">
          <label class="input-label">Duration (minutes)</label>
          <input class="input" id="cl-duration" type="number" min="0" placeholder="e.g. 15" />
        </div>
      </div>
      <div class="input-group" style="margin-bottom:1rem">
        <label class="input-label">Summary / What was discussed *</label>
        <textarea class="input" id="cl-summary" rows="3" placeholder="e.g. Called re: GSTR-3B filing. Client confirmed all invoices uploaded. Will file by 18th."></textarea>
      </div>
      <div class="input-group" style="margin-bottom:1rem">
        <label class="input-label">Outcome / Next Action</label>
        <input class="input" id="cl-outcome" placeholder="e.g. Follow up with Form 16 next week" />
      </div>
      <div class="input-group" style="margin-bottom:1.25rem">
        <label class="input-label">Follow-up Date</label>
        <input class="input" id="cl-followup" type="date" />
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" id="cl-save" onclick="CommLog._save()">Log It</button>
      </div>`);
  },

  async _save(editId) {
    const clientSel  = document.getElementById('cl-client');
    const clientId   = clientSel?.value;
    const clientName = clientId ? (clientSel.options[clientSel.selectedIndex]?.dataset?.name||'') : '';
    const summary    = document.getElementById('cl-summary')?.value.trim();
    const type       = document.getElementById('cl-type')?.value || 'call';
    const dir        = document.getElementById('cl-dir')?.value || 'outbound';
    const duration   = document.getElementById('cl-duration')?.value;
    const outcome    = document.getElementById('cl-outcome')?.value.trim();
    const followUp   = document.getElementById('cl-followup')?.value;

    if (!clientId)  { Toast.error('Select a client'); return; }
    if (!summary)   { Toast.error('Summary is required'); return; }

    const btn = document.getElementById('cl-save');
    if (btn) { btn.disabled=true; btn.textContent='Saving…'; }

    try {
      const data = {
        clientId, clientName,
        type, direction: dir,
        summary: Security.sanitizeStr(summary, 'notes'),
        outcome: Security.sanitizeStr(outcome||'', 'notes'),
        duration: duration ? parseInt(duration) : null,
        followUpDate: followUp || null,
        byUid:  this._user.uid,
        byName: this._user.displayName||'',
        firmId: this._firm.id,
      };
      if (editId) {
        await DataIntegrity.withRetry(() => FS.updateCommunication(this._firm.id, editId, data), { label: 'updateComm' });
        Toast.success('Updated');
      } else {
        await DataIntegrity.withRetry(() => FS.addCommunication(this._firm.id, data), { label: 'addComm' });
        Toast.success('Communication logged ✓');
      }
      closeModal();
    } catch(e) { Toast.error('Save failed'); if(btn){btn.disabled=false;btn.textContent='Log It';} }
  },

  _edit(commId) {
    const c = this._comms.find(x => x.id === commId);
    if (!c) return;
    this.openAdd(c.clientId);
    setTimeout(() => {
      document.getElementById('cl-client')?.querySelector(`option[value="${c.clientId}"]`)?.setAttribute('selected','');
      if (document.getElementById('cl-client')) document.getElementById('cl-client').value = c.clientId;
      if (document.getElementById('cl-type'))   document.getElementById('cl-type').value   = c.type;
      if (document.getElementById('cl-dir'))    document.getElementById('cl-dir').value    = c.direction||'outbound';
      if (document.getElementById('cl-summary')) document.getElementById('cl-summary').value = c.summary||'';
      if (document.getElementById('cl-outcome')) document.getElementById('cl-outcome').value = c.outcome||'';
      if (document.getElementById('cl-duration')) document.getElementById('cl-duration').value = c.duration||'';
      if (document.getElementById('cl-followup')) document.getElementById('cl-followup').value = c.followUpDate||'';
      const btn = document.getElementById('cl-save');
      if (btn) { btn.textContent = 'Save Changes'; btn.onclick = () => CommLog._save(commId); }
    }, 100);
  },

  async _delete(commId) {
    if (!confirm('Delete this communication log?')) return;
    try { await DataIntegrity.withRetry(() => FS.deleteCommunication(this._firm.id, commId), { label: 'deleteComm' }); Toast.success('Deleted'); }
    catch(e) { Toast.error('Delete failed'); }
  },

  // ── Bulk WhatsApp Broadcast ───────────────────────────────
  openBroadcast() {
    const now = new Date();
    const gstr3bDay = 20;
    const daysLeft  = gstr3bDay - now.getDate();

    const templates = [
      {
        label: 'GSTR-3B Deadline Reminder',
        msg: `Dear {name},\n\nThis is a reminder that GSTR-3B for ${now.toLocaleDateString('en-IN',{month:'long',year:'numeric'})} is due on the ${gstr3bDay}th.\n\nPlease ensure all your sales and purchase data is ready.\n\nFor any queries, contact us.\n\nRegards,\n${this._firm?.name||'Your CA Firm'}`,
      },
      {
        label: 'GSTR-1 Deadline Reminder',
        msg: `Dear {name},\n\nGentle reminder: GSTR-1 is due on the 11th of this month.\n\nPlease upload your sales invoices at the earliest.\n\nRegards,\n${this._firm?.name||'Your CA Firm'}`,
      },
      {
        label: 'ITR Filing Season Alert',
        msg: `Dear {name},\n\nIncome Tax Return filing season is here. Please share the following documents at the earliest:\n• Form 16 (from employer)\n• Bank statements\n• Investment proofs\n\nDeadline: 31st July.\n\nRegards,\n${this._firm?.name||'Your CA Firm'}`,
      },
      {
        label: 'Document Collection Reminder',
        msg: `Dear {name},\n\nWe are yet to receive your documents. Please upload them at the earliest to avoid delays in filing.\n\nRegards,\n${this._firm?.name||'Your CA Firm'}`,
      },
      {
        label: 'Custom Message',
        msg: '',
      },
    ];

    showModal(`
      <div class="modal-header">
        <h3 class="modal-title">📱 Bulk WhatsApp Broadcast</h3>
        <button class="modal-close" onclick="closeModal()">${Icons.x}</button>
      </div>

      <div style="background:rgba(37,211,102,.06);border:1px solid rgba(37,211,102,.2);border-radius:var(--r-md);padding:.875rem;margin-bottom:1.25rem">
        <p style="font-size:.8125rem;color:#25D366;font-weight:600">📱 Opens WhatsApp Web for each selected client</p>
        <p style="font-size:.78rem;color:var(--text-muted);margin-top:.2rem">Messages open one by one in WhatsApp Web. You send each manually — no API needed.</p>
      </div>

      <!-- Template selector -->
      <div class="input-group" style="margin-bottom:1rem">
        <label class="input-label">Message Template</label>
        <select class="input" id="bc-template" onchange="CommLog._applyTemplate(this.value)">
          ${templates.map((t,i)=>`<option value="${i}">${t.label}</option>`).join('')}
        </select>
      </div>

      <div class="input-group" style="margin-bottom:1.25rem">
        <label class="input-label">Message <span style="color:var(--text-muted);font-size:.75rem">({name} will be replaced with client name)</span></label>
        <textarea class="input" id="bc-msg" rows="6" style="font-size:.85rem">${esc(templates[0].msg)}</textarea>
      </div>

      <!-- Client selection -->
      <div class="input-group" style="margin-bottom:1.25rem">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.5rem">
          <label class="input-label" style="margin:0">Select Clients</label>
          <div style="display:flex;gap:.5rem">
            <button class="btn btn-ghost btn-sm" style="font-size:.75rem" onclick="CommLog._selectAllClients(true)">Select All</button>
            <button class="btn btn-ghost btn-sm" style="font-size:.75rem" onclick="CommLog._selectAllClients(false)">Clear</button>
          </div>
        </div>
        <div style="max-height:180px;overflow-y:auto;border:1px solid var(--border-light);border-radius:var(--r-sm);padding:.5rem">
          ${this._clients.map(c=>`
          <label style="display:flex;align-items:center;gap:.625rem;padding:.4rem .5rem;cursor:pointer;border-radius:4px"
            onmouseenter="this.style.background='var(--bg-hover)'" onmouseleave="this.style.background=''">
            <input type="checkbox" class="bc-client-check" data-id="${c.id}" data-name="${esc(c.name)}" data-phone="${esc(c.phone||'')}"
              style="width:15px;height:15px;accent-color:var(--gold)" ${c.phone?'':'disabled'} />
            <span style="font-size:.875rem;flex:1">${esc(c.name)}</span>
            ${c.phone ? `<span style="font-size:.72rem;color:var(--text-muted)">${esc(c.phone)}</span>` :
              '<span style="font-size:.7rem;color:var(--red)">No phone</span>'}
          </label>`).join('')}
        </div>
        <div style="font-size:.75rem;color:var(--text-muted);margin-top:.375rem" id="bc-count">0 clients selected</div>
      </div>

      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" style="background:#25D366;border-color:#25D366" onclick="CommLog._sendBroadcast()">
          📱 Send via WhatsApp
        </button>
      </div>`, null);

    // Update count on checkbox change
    setTimeout(() => {
      document.querySelectorAll('.bc-client-check').forEach(cb => {
        cb.addEventListener('change', CommLog._updateBcCount);
      });
    }, 100);

    CommLog._templates = templates;
  },

  _templates: [],

  _applyTemplate(idx) {
    const t = this._templates[parseInt(idx)];
    const msgEl = document.getElementById('bc-msg');
    if (msgEl && t) msgEl.value = t.msg;
  },

  _selectAllClients(checked) {
    document.querySelectorAll('.bc-client-check:not(:disabled)').forEach(cb => { cb.checked = checked; });
    this._updateBcCount();
  },

  _updateBcCount() {
    const count = document.querySelectorAll('.bc-client-check:checked').length;
    const el = document.getElementById('bc-count');
    if (el) el.textContent = `${count} client${count!==1?'s':''} selected`;
  },

  async _sendBroadcast() {
    const msg = document.getElementById('bc-msg')?.value.trim();
    if (!msg) { Toast.error('Write a message first'); return; }

    const selected = Array.from(document.querySelectorAll('.bc-client-check:checked'))
      .map(cb => ({ id: cb.dataset.id, name: cb.dataset.name, phone: cb.dataset.phone }))
      .filter(c => c.phone);

    if (!selected.length) { Toast.error('Select at least one client with a phone number'); return; }

    closeModal();

    // Log the broadcast
    await FS.logBroadcast(this._firm.id, {
      message:   msg,
      sentTo:    selected.map(c => ({ id:c.id, name:c.name })),
      count:     selected.length,
      byUid:     this._user.uid,
      byName:    this._user.displayName||'',
      channel:   'whatsapp',
    });

    // Open WhatsApp for each client with a 1.5s delay between each
    Toast.success(`Opening WhatsApp for ${selected.length} clients…`);
    selected.forEach((c, i) => {
      setTimeout(() => {
        const personalMsg = msg.replace(/\{name\}/g, c.name);
        const phone = c.phone.replace(/\D/g,'');
        const waPhone = phone.startsWith('91') ? phone : '91' + phone;
        window.open(`https://wa.me/${waPhone}?text=${encodeURIComponent(personalMsg)}`, '_blank');
      }, i * 1500);
    });
  },

  _setType(v, btn) {
    this._typeFilter = v;
    document.querySelectorAll('.tabs .tab').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    this._renderList();
  },
  _onSearch(v) { this._search = v; this._renderList(); },
};
