// js/pages/itr-tracker.js — Phase 2: ITR Filing Tracker
// AY-wise status per client, all forms, refund tracking
// Bulk grid view, document checklist per client

const ITRTracker = {
  _firm: null,
  _clients: [],
  _tracking: {},       // { 'clientId_AY': { form, status, refundStatus, filedDate, notes, ... } }
  _unsub: null,
  _unsubClients: null,
  _ay: null,           // current Assessment Year e.g. '2024-25'
  _filter: 'all',
  _search: '',

  _allAYs() {
    const cur = new Date().getFullYear();
    // Last 5 AYs
    return Array.from({length:5}, (_,i) => {
      const y = cur - i;
      return `${y-1}-${String(y).slice(-2)}`;
    });
  },

  mount(firm) {
    this._firm = firm;
    // Default AY: if after April → current year AY, else previous
    const now = new Date();
    const yr  = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear()-1;
    this._ay  = `${yr}-${String(yr+1).slice(-2)}`;
    this._clients  = [];
    this._tracking = {};
    this._render();
    this._subscribe();
  },

  unmount() {
    if (this._unsub)        { this._unsub();        this._unsub = null; }
    if (this._unsubClients) { this._unsubClients(); this._unsubClients = null; }
  },

  _subscribe() {
    this._unsubClients = FS.subscribeClients(this._firm.id, docs => {
      this._clients = docs;
      this._subscribeTracking();
    });
  },

  _subscribeTracking() {
    if (this._unsub) { this._unsub(); this._unsub = null; }
    // One doc per AY holds all clients' status as a map
    this._unsub = db.collection('firms').doc(this._firm.id)
      .collection('itrTracking').doc(this._ay)
      .onSnapshot(snap => {
        this._tracking = snap.exists ? snap.data() : {};
        this._renderGrid();
      }, err => {
        console.warn('[Filio] itrTracking:', err.message);
        this._tracking = {};
        this._renderGrid();
      });
  },

  _filtered() {
    const q = this._search.toLowerCase();
    return this._clients.filter(c => {
      const matchSearch = !q || (c.name||'').toLowerCase().includes(q) ||
                          (c.pan||'').toLowerCase().includes(q);
      if (!matchSearch) return false;
      if (this._filter==='all') return true;
      const t = this._tracking[c.id]||{};
      if (this._filter==='filed')   return t.status==='filed';
      if (this._filter==='pending') return !t.status || t.status==='pending' || t.status==='in_progress';
      if (this._filter==='na')      return t.status==='na';
      return true;
    });
  },

  _render() {
    const cnt = Layout.getContentEl(); if (!cnt) return;
    cnt.innerHTML = `
    <div style="margin-bottom:1.5rem;display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:1rem">
      <div>
        <h2 style="font-size:1.5rem;font-weight:600">ITR Filing Tracker</h2>
        <p style="color:var(--text-muted);font-size:.875rem;margin-top:.2rem">
          Assessment year-wise filing status for all clients
        </p>
      </div>
      <button class="btn btn-secondary btn-sm" onclick="ITRTracker._exportExcel()">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:.3rem"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        Export Excel
      </button>
    </div>

    <!-- AY Selector -->
    <div style="display:flex;align-items:center;gap:1rem;margin-bottom:1.5rem;flex-wrap:wrap">
      <div style="display:flex;align-items:center;gap:.5rem">
        <label style="font-size:.8125rem;color:var(--text-muted);font-weight:500">Assessment Year:</label>
        <select class="input" style="width:130px;padding:.4rem .75rem;font-size:.875rem" onchange="ITRTracker._changeAY(this.value)">
          ${this._allAYs().map(ay=>`<option value="${ay}" ${ay===this._ay?'selected':''}>${ay}</option>`).join('')}
        </select>
      </div>
      <!-- ITR deadlines reminder -->
      <div style="display:flex;gap:.5rem;flex-wrap:wrap">
        <span class="badge badge-blue" style="font-size:.72rem">Non-audit: 31 Jul</span>
        <span class="badge badge-amber" style="font-size:.72rem">Audit cases: 31 Oct</span>
        <span class="badge badge-muted" style="font-size:.72rem">Belated ITR: 31 Dec</span>
      </div>
    </div>

    <!-- Summary cards -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:.875rem;margin-bottom:1.5rem" id="itr-summary"></div>

    <!-- Search + filter -->
    <div style="display:flex;gap:.75rem;margin-bottom:1.25rem;flex-wrap:wrap;align-items:center">
      <div class="search-bar" style="flex:1;min-width:200px;max-width:300px">
        ${Icons.search}
        <input type="text" placeholder="Search client or PAN…" oninput="ITRTracker._onSearch(this.value)" />
      </div>
      <div class="tabs">
        ${[['all','All'],['pending','Pending'],['filed','Filed'],['na','N/A']].map(([v,l])=>`
          <button class="tab${v===this._filter?' active':''}" onclick="ITRTracker._setFilter('${v}',this)">${l}</button>`).join('')}
      </div>
    </div>

    <div class="card" style="padding:0;overflow:hidden">
      <div class="table-wrap">
        <table id="itr-table">
          <thead>
            <tr>
              <th style="min-width:180px">Client</th>
              <th>PAN</th>
              <th style="text-align:center">ITR Form</th>
              <th style="text-align:center">Status</th>
              <th style="text-align:center">Refund Status</th>
              <th>Filed Date</th>
              <th>Pending From Client</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody id="itr-tbody">
            <tr><td colspan="8" style="text-align:center;padding:3rem">
              <div class="spinner" style="margin:0 auto"></div>
            </td></tr>
          </tbody>
        </table>
      </div>
    </div>`;
  },

  _changeAY(ay) {
    this._ay = ay;
    this._subscribeTracking();
  },

  _renderGrid() {
    // Summary
    const sumEl = document.getElementById('itr-summary');
    if (sumEl) {
      const total    = this._clients.length;
      const filed    = this._clients.filter(c => this._tracking[c.id]?.status==='filed').length;
      const pending  = this._clients.filter(c => { const s=this._tracking[c.id]?.status; return !s||s==='pending'||s==='in_progress'; }).length;
      const refunds  = this._clients.filter(c => this._tracking[c.id]?.refundStatus==='received').length;
      sumEl.innerHTML = [
        {l:'Total Clients', v:total,          c:'--blue'},
        {l:'ITR Filed',     v:`${filed}/${total}`, c:'--green'},
        {l:'Pending',       v:pending,        c:pending>0?'--amber':'--green'},
        {l:'Refunds',       v:refunds,        c:'--purple'},
      ].map(s=>`
        <div class="card" style="padding:.875rem">
          <div style="font-size:1.375rem;font-weight:700;color:var(${s.c})">${s.v}</div>
          <div style="font-size:.75rem;color:var(--text-muted);margin-top:.2rem">${s.l}</div>
        </div>`).join('');
    }

    const tbody = document.getElementById('itr-tbody'); if (!tbody) return;
    const filtered = this._filtered();

    if (!filtered.length) {
      tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state">${Icons.clients}<h4>${this._search||this._filter!=='all'?'No matches':'No clients yet'}</h4></div></td></tr>`;
      return;
    }

    const ITR_FORMS   = ['ITR-1','ITR-2','ITR-3','ITR-4','ITR-5','ITR-6','ITR-7'];
    const STATUSES    = ['pending','in_progress','filed','na'];
    const STATUS_LABEL = {pending:'Pending',in_progress:'In Progress',filed:'Filed ✓',na:'N/A'};
    const STATUS_COLOR = {pending:'--amber',in_progress:'--blue',filed:'--green',na:'--text-muted'};
    const REFUND_STATUSES = ['not_applicable','awaited','processing','received','adjusted'];
    const REFUND_LABEL = {not_applicable:'—',awaited:'Awaited',processing:'Processing',received:'Received ✓',adjusted:'Adjusted'};
    const PENDING_DOCS = ['Form 16','26AS','Bank Statement','Investment Proof','P&L Statement','Capital Gains Statement','TDS Certificates'];

    tbody.innerHTML = filtered.map(c => {
      const t = this._tracking[c.id] || {};
      const status = t.status || 'pending';
      const clr = STATUS_COLOR[status] || '--text-muted';
      const pendingDocs = t.pendingDocs || [];

      return `<tr>
        <td>
          <div style="display:flex;align-items:center;gap:.625rem">
            <div class="avatar" style="background:rgba(201,168,76,.12);color:var(--gold);font-size:.7rem;width:30px;height:30px;flex-shrink:0">${Fmt.initials(c.name)}</div>
            <div>
              <div style="font-weight:500;font-size:.875rem">${esc(c.name)}</div>
              <span class="badge badge-muted" style="font-size:.65rem;text-transform:capitalize">${c.type||'individual'}</span>
            </div>
          </div>
        </td>
        <td><code style="font-size:.8rem">${esc(c.pan||'—')}</code></td>
        <td style="text-align:center">
          <select class="input" style="font-size:.78rem;padding:.25rem .5rem;width:90px;text-align:center"
            onchange="ITRTracker._update('${c.id}','form',this.value)">
            <option value="">— Form —</option>
            ${ITR_FORMS.map(f=>`<option value="${f}" ${t.form===f?'selected':''}>${f}</option>`).join('')}
          </select>
        </td>
        <td style="text-align:center">
          <select class="input" style="font-size:.78rem;padding:.25rem .5rem;width:120px;
            color:var(${clr});font-weight:600;background:var(${clr==='--green'?'--green-bg':clr==='--blue'?'--blue-bg':clr==='--amber'?'--amber-bg':'--bg-elevated'})"
            onchange="ITRTracker._update('${c.id}','status',this.value)">
            ${STATUSES.map(s=>`<option value="${s}" ${status===s?'selected':''}>${STATUS_LABEL[s]}</option>`).join('')}
          </select>
        </td>
        <td style="text-align:center">
          <select class="input" style="font-size:.78rem;padding:.25rem .5rem;width:120px"
            onchange="ITRTracker._update('${c.id}','refundStatus',this.value)">
            ${REFUND_STATUSES.map(s=>`<option value="${s}" ${(t.refundStatus||'not_applicable')===s?'selected':''}>${REFUND_LABEL[s]}</option>`).join('')}
          </select>
        </td>
        <td>
          <input type="date" class="input" style="font-size:.78rem;padding:.25rem .5rem;width:130px"
            value="${t.filedDate||''}"
            onchange="ITRTracker._update('${c.id}','filedDate',this.value)" />
        </td>
        <td>
          <button class="btn btn-ghost btn-sm" style="font-size:.72rem;color:${pendingDocs.length?'var(--amber)':'var(--text-muted)'}"
            data-action="docmodal" data-id="${c.id}" data-name="${esc(c.name)}">
            ${pendingDocs.length ? `⚠ ${pendingDocs.length} pending` : '+ Set docs'}
          </button>
        </td>
        <td>
          <input type="text" class="input" style="font-size:.78rem;padding:.3rem .5rem;min-width:100px"
            placeholder="Add note…"
            value="${esc(t.notes||'')}"
            onblur="ITRTracker._update('${c.id}','notes',this.value)"
            onkeydown="if(event.key==='Enter')this.blur()" />
        </td>
      </tr>`;
    }).join('');
  },

  async _update(clientId, field, value) {
    try {
      await db.collection('firms').doc(this._firm.id)
        .collection('itrTracking').doc(this._ay)
        .set({ [clientId]: { ...(this._tracking[clientId]||{}), [field]: value } }, { merge:true });
      if (!this._tracking[clientId]) this._tracking[clientId] = {};
      this._tracking[clientId][field] = value;
      this._renderGrid();
    } catch(e) { Toast.error('Update failed'); }
  },

  _openDocModal(clientId, clientName) {
    const DOCS = ['Form 16','26AS','Bank Statement (Apr-Mar)','Investment Proof 80C','Investment Proof 80D',
      'Home Loan Certificate','HRA Receipts','Capital Gains Statement','P&L Statement','TDS Certificates',
      'Rent Receipts','Donation Receipts 80G','Foreign Income Details'];
    const t = this._tracking[clientId] || {};
    const pendingDocs = t.pendingDocs || [];

    showModal(`
      <div class="modal-header">
        <h3 class="modal-title">Pending Documents — ${esc(clientName)}</h3>
        <button class="modal-close" onclick="closeModal()">${Icons.x}</button>
      </div>
      <p style="color:var(--text-muted);font-size:.8125rem;margin-bottom:1.25rem">
        Check the documents still needed from this client. These will be visible on their portal.
      </p>
      <div style="display:flex;flex-direction:column;gap:.5rem;max-height:320px;overflow-y:auto;padding-right:.25rem">
        ${DOCS.map(doc=>`
          <label style="display:flex;align-items:center;gap:.75rem;padding:.625rem .875rem;background:var(--bg-elevated);border-radius:var(--r-sm);cursor:pointer;border:1px solid ${pendingDocs.includes(doc)?'var(--amber)':'var(--border-light)'}">
            <input type="checkbox" ${pendingDocs.includes(doc)?'checked':''} onchange="ITRTracker._toggleDoc('${clientId}','${doc.replace(/'/g,"\\'")}',this.checked)"
              style="width:16px;height:16px;accent-color:var(--gold)" />
            <span style="font-size:.875rem;color:${pendingDocs.includes(doc)?'var(--amber)':'var(--text-secondary)'}">${esc(doc)}</span>
            ${pendingDocs.includes(doc)?`<span class="badge badge-amber" style="margin-left:auto;font-size:.65rem">Pending</span>`:''}
          </label>`).join('')}
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal()">Close</button>
      </div>`);
  },

  async _toggleDoc(clientId, doc, checked) {
    const t = this._tracking[clientId] || {};
    let docs = [...(t.pendingDocs||[])];
    if (checked) { if (!docs.includes(doc)) docs.push(doc); }
    else         { docs = docs.filter(d=>d!==doc); }
    await this._update(clientId, 'pendingDocs', docs);
  },

  _setFilter(v, btn) {
    this._filter = v;
    document.querySelectorAll('.tabs .tab').forEach(b=>b.classList.remove('active'));
    if(btn) btn.classList.add('active');
    this._renderGrid();
  },

  _onSearch(v) { this._search = v; this._renderGrid(); },

  _exportExcel() {
    const rows = [['Client','PAN','Type','AY','ITR Form','Status','Refund Status','Filed Date','Notes']];
    this._clients.forEach(c => {
      const t = this._tracking[c.id]||{};
      rows.push([c.name, c.pan||'', c.type||'', this._ay,
        t.form||'', t.status||'pending', t.refundStatus||'', t.filedDate||'', t.notes||'']);
    });
    const csv = rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF'+csv], {type:'text/csv;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href=url; a.download=`ITR_Tracker_AY${this._ay}.csv`; a.click();
    URL.revokeObjectURL(url);
    Toast.success('ITR Tracker exported as CSV');
  },
};
