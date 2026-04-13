// js/pages/notices.js — Phase 6: Notice Management
// IT notices, GST notices, TDS notices — upload, track, respond, resolve
// Full timeline per notice, deadline tracking, status workflow

const NoticesPage = {
  _firm: null, _user: null,
  _notices: [], _clients: [],
  _unsub: null, _unsubClients: null,
  _filter: 'all',   // all | received | in_progress | responded | resolved
  _search: '',

  NOTICE_TYPES: [
    { id:'it',    label:'Income Tax',     icon:'🏛️', color:'var(--blue)'   },
    { id:'gst',   label:'GST',            icon:'🧾', color:'var(--amber)'  },
    { id:'tds',   label:'TDS',            icon:'💼', color:'var(--purple)' },
    { id:'roc',   label:'ROC / MCA',      icon:'🏢', color:'var(--green)'  },
    { id:'other', label:'Other',          icon:'📄', color:'var(--text-muted)' },
  ],

  STATUS_FLOW: ['received','in_progress','responded','resolved'],
  STATUS_LABEL: { received:'Received', in_progress:'In Progress', responded:'Responded', resolved:'Resolved ✓' },
  STATUS_COLOR: { received:'--red', in_progress:'--amber', responded:'--blue', resolved:'--green' },

  mount(user, firm) {
    this._user = user; this._firm = firm;
    this._notices = []; this._clients = [];
    this._render();
    this._unsub = FS.subscribeNotices(firm.id, d => { this._notices = d; this._renderList(); });
    this._unsubClients = FS.subscribeClients(firm.id, d => { this._clients = d; });
    this._delegateHandler = (e) => {
      const btn = e.target.closest('[data-action][data-id]');
      if (!btn) return;
      const { action, id, status } = btn.dataset;
      if (action === 'edit')      NoticesPage.openEdit(id);
      if (action === 'timeline')  NoticesPage.openTimeline(id);
      if (action === 'setstatus') NoticesPage._setStatus(id, status);
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
    return this._notices.filter(n => {
      const matchFilter = this._filter === 'all' || n.status === this._filter;
      const matchSearch = !q ||
        (n.clientName||'').toLowerCase().includes(q) ||
        (n.description||'').toLowerCase().includes(q) ||
        (n.noticeNo||'').toLowerCase().includes(q);
      return matchFilter && matchSearch;
    });
  },

  _render() {
    const cnt = Layout.getContentEl(); if (!cnt) return;
    cnt.innerHTML = `
    <div style="margin-bottom:1.5rem;display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:1rem">
      <div>
        <h2 style="font-size:1.5rem;font-weight:600">Notice Management</h2>
        <p style="color:var(--text-muted);font-size:.875rem;margin-top:.2rem">
          Track IT, GST, TDS and ROC notices — from receipt to resolution
        </p>
      </div>
      <button class="btn btn-primary btn-sm" onclick="NoticesPage.openAdd()">
        ${Icons.plus} Add Notice
      </button>
    </div>

    <!-- Stats -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:.875rem;margin-bottom:1.5rem" id="notice-stats"></div>

    <!-- Filters -->
    <div style="display:flex;gap:.75rem;margin-bottom:1.25rem;flex-wrap:wrap;align-items:center">
      <div class="search-bar" style="flex:1;min-width:200px;max-width:300px">
        ${Icons.search}
        <input type="text" placeholder="Search client, notice number…" oninput="NoticesPage._onSearch(this.value)" />
      </div>
      <div class="tabs">
        ${['all','received','in_progress','responded','resolved'].map(v=>`
          <button class="tab${v===this._filter?' active':''}" onclick="NoticesPage._setFilter('${v}',this)">
            ${v==='all'?'All':this.STATUS_LABEL[v]}
          </button>`).join('')}
      </div>
    </div>

    <div id="notice-list">
      <div style="display:flex;justify-content:center;padding:3rem"><div class="spinner spinner-lg"></div></div>
    </div>`;
  },

  _renderList() {
    // Stats
    const statsEl = document.getElementById('notice-stats');
    if (statsEl) {
      const total   = this._notices.length;
      const open    = this._notices.filter(n => n.status !== 'resolved').length;
      const overdue = this._notices.filter(n => {
        if (n.status === 'resolved') return false;
        const dl = n.responseDeadline ? new Date(n.responseDeadline) : null;
        return dl && dl < new Date();
      }).length;
      const resolved = this._notices.filter(n => n.status === 'resolved').length;
      statsEl.innerHTML = [
        ['Total',    total,    '--blue'],
        ['Open',     open,     open>0?'--amber':'--text-muted'],
        ['Overdue',  overdue,  overdue>0?'--red':'--text-muted'],
        ['Resolved', resolved, '--green'],
      ].map(([l,v,c])=>`
        <div class="card" style="padding:.875rem;text-align:center">
          <div style="font-size:1.375rem;font-weight:700;color:var(${c})">${v}</div>
          <div style="font-size:.75rem;color:var(--text-muted);margin-top:.15rem">${l}</div>
        </div>`).join('');
    }

    const el = document.getElementById('notice-list');
    if (!el) return;
    const filtered = this._filtered();

    if (!filtered.length) {
      el.innerHTML = `<div class="card"><div class="empty-state">
        <div style="font-size:3rem;margin-bottom:.5rem">📋</div>
        <h4>${this._search||this._filter!=='all'?'No matches':'No notices yet'}</h4>
        <p>Add IT, GST, or ROC notices to track responses</p>
        <button class="btn btn-primary btn-sm" style="margin-top:.75rem" onclick="NoticesPage.openAdd()">${Icons.plus} Add Notice</button>
      </div></div>`;
      return;
    }

    el.innerHTML = filtered.map(n => {
      const ntype    = this.NOTICE_TYPES.find(t => t.id === n.type) || this.NOTICE_TYPES[4];
      const statClr  = this.STATUS_COLOR[n.status] || '--text-muted';
      const statLbl  = this.STATUS_LABEL[n.status] || n.status;
      const deadline = n.responseDeadline ? new Date(n.responseDeadline) : null;
      const daysLeft = deadline ? Math.ceil((deadline - new Date()) / 86400000) : null;
      const isOverdue= deadline && deadline < new Date() && n.status !== 'resolved';

      return `
      <div class="card" style="margin-bottom:1rem;border-left:4px solid ${ntype.color}">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:.875rem;margin-bottom:.875rem">
          <div style="display:flex;gap:.875rem;align-items:flex-start;flex:1">
            <div style="width:40px;height:40px;border-radius:10px;background:${ntype.color}22;display:flex;align-items:center;justify-content:center;font-size:1.125rem;flex-shrink:0">${ntype.icon}</div>
            <div style="flex:1;min-width:0">
              <div style="display:flex;align-items:center;gap:.5rem;flex-wrap:wrap;margin-bottom:.25rem">
                <span style="font-weight:700;font-size:.9375rem">${esc(n.clientName||'Unknown Client')}</span>
                <span class="badge" style="background:${ntype.color}22;color:${ntype.color};font-size:.68rem">${ntype.label}</span>
                <span class="badge badge-${(statClr).replace('--','')}" style="font-size:.7rem">${statLbl}</span>
              </div>
              ${n.noticeNo ? `<div style="font-size:.78rem;color:var(--text-muted);margin-bottom:.25rem">Notice No: <code style="color:var(--gold)">${esc(n.noticeNo)}</code></div>` : ''}
              ${n.description ? `<p style="font-size:.8125rem;color:var(--text-secondary);line-height:1.6">${esc(n.description)}</p>` : ''}
            </div>
          </div>
          <div style="display:flex;gap:.375rem;flex-shrink:0">
            <button class="btn btn-ghost btn-sm" style="font-size:.75rem" data-action="timeline" data-id="${n.id}">Timeline</button>
            <button class="btn btn-icon btn-ghost" data-action="edit" data-id="${n.id}">${Icons.edit}</button>
          </div>
        </div>

        <!-- Dates + deadline -->
        <div style="display:flex;gap:1.5rem;flex-wrap:wrap;font-size:.78rem;color:var(--text-muted);margin-bottom:.875rem">
          ${n.noticeDate ? `<span>📅 Received: ${esc(n.noticeDate)}</span>` : ''}
          ${deadline ? `<span style="color:${isOverdue?'var(--red)':daysLeft<=7?'var(--amber)':'var(--text-muted)'};font-weight:${isOverdue||daysLeft<=7?'600':'400'}">
            ⏰ Response due: ${deadline.toLocaleDateString('en-IN')} ${isOverdue?'(OVERDUE)':`(${daysLeft}d left)`}
          </span>` : ''}
        </div>

        <!-- Status stepper -->
        <div style="display:flex;align-items:center;gap:.375rem;flex-wrap:wrap">
          ${this.STATUS_FLOW.map((s, i) => {
            const isActive = n.status === s;
            const isPast   = this.STATUS_FLOW.indexOf(n.status) > i;
            return `
            <button data-action="setstatus" data-id="${n.id}" data-status="${s}"
              style="padding:.3rem .75rem;border-radius:20px;font-size:.72rem;font-weight:600;cursor:pointer;border:1px solid;transition:all .15s;
                background:${isActive?`var(${this.STATUS_COLOR[s]})`:(isPast?`var(${this.STATUS_COLOR[s]})33`:'transparent')};
                color:${isActive?'white':(isPast?`var(${this.STATUS_COLOR[s]})`:'var(--text-muted)')};
                border-color:${isActive?`var(${this.STATUS_COLOR[s]})`:(isPast?`var(${this.STATUS_COLOR[s]})`:'var(--border-light)')}"
            >${this.STATUS_LABEL[s]}</button>
            ${i < this.STATUS_FLOW.length-1 ? '<span style="color:var(--border);font-size:.7rem">→</span>' : ''}`;
          }).join('')}
        </div>
      </div>`;
    }).join('');
  },

  openAdd() {
    showModal(`
      <div class="modal-header">
        <h3 class="modal-title">Add Notice</h3>
        <button class="modal-close" onclick="closeModal()">${Icons.x}</button>
      </div>
      <div class="grid-auto-2" style="margin-bottom:1rem">
        <div class="input-group">
          <label class="input-label">Client *</label>
          <select class="input" id="nt-client">
            <option value="">— Select client —</option>
            ${this._clients.map(c=>`<option value="${c.id}" data-name="${esc(c.name)}">${esc(c.name)}</option>`).join('')}
          </select>
        </div>
        <div class="input-group">
          <label class="input-label">Notice Type *</label>
          <select class="input" id="nt-type">
            ${this.NOTICE_TYPES.map(t=>`<option value="${t.id}">${t.icon} ${t.label}</option>`).join('')}
          </select>
        </div>
        <div class="input-group">
          <label class="input-label">Notice Number</label>
          <input class="input" id="nt-no" placeholder="e.g. ITO/2024-25/001234" />
        </div>
        <div class="input-group">
          <label class="input-label">Notice Date</label>
          <input class="input" id="nt-date" type="date" />
        </div>
        <div class="input-group">
          <label class="input-label">Response Deadline</label>
          <input class="input" id="nt-deadline" type="date" />
        </div>
        <div class="input-group">
          <label class="input-label">Assessment Year</label>
          <input class="input" id="nt-ay" placeholder="e.g. 2023-24" />
        </div>
      </div>
      <div class="input-group" style="margin-bottom:1.25rem">
        <label class="input-label">Description / What the notice is about *</label>
        <textarea class="input" id="nt-desc" rows="3" placeholder="e.g. Income tax scrutiny notice u/s 143(2) for AY 2023-24. Mismatch of ₹3.2L in turnover."></textarea>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" id="nt-save" onclick="NoticesPage._save()">Add Notice</button>
      </div>`);
  },

  async _save(editId) {
    const clientSel  = document.getElementById('nt-client');
    const clientId   = clientSel?.value;
    const clientName = clientId ? (clientSel.options[clientSel.selectedIndex]?.dataset?.name||'') : '';
    const type       = document.getElementById('nt-type')?.value || 'it';
    const noticeNo   = document.getElementById('nt-no')?.value.trim();
    const noticeDate = document.getElementById('nt-date')?.value;
    const deadline   = document.getElementById('nt-deadline')?.value;
    const ay         = document.getElementById('nt-ay')?.value.trim();
    const desc       = document.getElementById('nt-desc')?.value.trim();

    if (!clientId) { Toast.error('Select a client'); return; }
    if (!desc)     { Toast.error('Description is required'); return; }

    const btn = document.getElementById('nt-save');
    if (btn) { btn.disabled=true; btn.textContent='Saving…'; }

    try {
      const data = {
        clientId, clientName,
        type, noticeNo: noticeNo||'',
        noticeDate: noticeDate||'',
        responseDeadline: deadline||'',
        assessmentYear: ay||'',
        description: Security.sanitizeStr(desc, 'notes'),
        addedBy:  this._user.uid,
        addedByName: this._user.displayName||'',
        firmId: this._firm.id,
      };
      if (editId) {
        await DataIntegrity.withRetry(() => FS.updateNotice(this._firm.id, editId, data), { label: 'updateNotice' });
        Toast.success('Notice updated');
      } else {
        await DataIntegrity.withRetry(() => FS.addNotice(this._firm.id, data), { label: 'addNotice' });
        Toast.success('Notice added ✓');
      }
      closeModal();
    } catch(e) { Toast.error('Save failed: '+e.message); if(btn){btn.disabled=false;btn.textContent='Add Notice';} }
  },

  openEdit(noticeId) {
    const n = this._notices.find(x => x.id === noticeId);
    if (!n) return;
    this.openAdd();
    setTimeout(() => {
      if (document.getElementById('nt-client')) document.getElementById('nt-client').value = n.clientId||'';
      if (document.getElementById('nt-type'))   document.getElementById('nt-type').value   = n.type||'it';
      if (document.getElementById('nt-no'))     document.getElementById('nt-no').value     = n.noticeNo||'';
      if (document.getElementById('nt-date'))   document.getElementById('nt-date').value   = n.noticeDate||'';
      if (document.getElementById('nt-deadline')) document.getElementById('nt-deadline').value = n.responseDeadline||'';
      if (document.getElementById('nt-ay'))     document.getElementById('nt-ay').value     = n.assessmentYear||'';
      if (document.getElementById('nt-desc'))   document.getElementById('nt-desc').value   = n.description||'';
      const btn = document.getElementById('nt-save');
      if (btn) { btn.textContent='Save Changes'; btn.onclick=()=>NoticesPage._save(noticeId); }
    }, 80);
  },

  async _setStatus(noticeId, status) {
    const note = status === 'resolved'
      ? (prompt('Resolution note (optional):') || '')
      : '';
    try {
      await DataIntegrity.withRetry(() => FS.updateNotice(this._firm.id, noticeId, { status }), { label: 'setNoticeStatus' });
      if (note || status === 'resolved') {
        await FS.addNoticeTimeline(this._firm.id, noticeId, status, note, this._user.displayName||'');
      }
      Toast.success(`Status → ${this.STATUS_LABEL[status]}`);
    } catch(e) { Toast.error('Update failed'); }
  },

  openTimeline(noticeId) {
    const n = this._notices.find(x => x.id === noticeId);
    if (!n) return;
    const timeline = n.timeline || [];

    showModal(`
      <div class="modal-header">
        <h3 class="modal-title">Notice Timeline</h3>
        <button class="modal-close" onclick="closeModal()">${Icons.x}</button>
      </div>
      <div style="font-size:.8125rem;color:var(--text-muted);margin-bottom:1.25rem">
        ${esc(n.clientName)} · ${(this.NOTICE_TYPES.find(t=>t.id===n.type)||this.NOTICE_TYPES[4]).label}
        ${n.noticeNo ? ` · <code style="color:var(--gold)">${esc(n.noticeNo)}</code>` : ''}
      </div>

      <div style="position:relative;padding-left:1.5rem;margin-bottom:1.5rem">
        <div style="position:absolute;left:.6rem;top:0;bottom:0;width:2px;background:var(--border-light)"></div>
        ${timeline.map(t => `
        <div style="position:relative;margin-bottom:1rem">
          <div style="position:absolute;left:-1.5rem;top:.35rem;width:10px;height:10px;border-radius:50%;background:${t.action==='resolved'?'var(--green)':'var(--gold)'};border:2px solid var(--bg-card)"></div>
          <div style="background:var(--bg-elevated);border-radius:var(--r-md);padding:.75rem">
            <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:.25rem;margin-bottom:.25rem">
              <span style="font-weight:600;font-size:.8125rem;color:var(--text-primary);text-transform:capitalize">${esc(this.STATUS_LABEL[t.action]||t.action)}</span>
              <span style="font-size:.72rem;color:var(--text-muted)">${t.at ? new Date(t.at).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}) : ''}</span>
            </div>
            ${t.note ? `<p style="font-size:.8rem;color:var(--text-secondary);line-height:1.6">${esc(t.note)}</p>` : ''}
            ${t.by ? `<div style="font-size:.72rem;color:var(--text-muted);margin-top:.25rem">By: ${esc(t.by)}</div>` : ''}
          </div>
        </div>`).join('')}
        ${!timeline.length ? '<p style="color:var(--text-muted);font-size:.8rem">No timeline entries yet</p>' : ''}
      </div>

      <!-- Add timeline note -->
      <div style="background:var(--bg-elevated);border-radius:var(--r-md);padding:1rem">
        <div style="font-size:.8125rem;font-weight:600;margin-bottom:.75rem">Add Timeline Entry</div>
        <div style="display:flex;gap:.75rem;flex-wrap:wrap">
          <input class="input" id="tl-note" placeholder="Enter update note…" style="flex:1;font-size:.85rem" />
          <select class="input" id="tl-action" style="width:150px">
            ${this.STATUS_FLOW.map(s=>`<option value="${s}">${this.STATUS_LABEL[s]}</option>`).join('')}
          </select>
          <button class="btn btn-primary btn-sm" onclick="NoticesPage._addTimeline('${noticeId}')">Add</button>
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn btn-primary btn-full" onclick="closeModal()">Close</button>
      </div>`);
  },

  async _addTimeline(noticeId) {
    const note   = document.getElementById('tl-note')?.value.trim();
    const action = document.getElementById('tl-action')?.value || 'in_progress';
    try {
      await DataIntegrity.withRetry(() => FS.addNoticeTimeline(this._firm.id, noticeId, action, note, this._user.displayName||''), { label: 'noticeTimeline' });
      await DataIntegrity.withRetry(() => FS.updateNotice(this._firm.id, noticeId, { status: action }), { label: 'noticeStatus' });
      if (document.getElementById('tl-note')) document.getElementById('tl-note').value = '';
      Toast.success('Timeline updated');
      closeModal();
    } catch(e) { Toast.error('Failed to add'); }
  },

  _setFilter(v, btn) {
    this._filter = v;
    document.querySelectorAll('.tabs .tab').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    this._renderList();
  },
  _onSearch(v) { this._search = v; this._renderList(); },
};
