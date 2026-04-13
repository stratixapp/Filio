// js/pages/gst-tracker.js — Phase 2: GST Filing Tracker
// GSTR-1, GSTR-3B, GSTR-9 per client per month
// Color-coded: Red=overdue, Amber=due this week, Green=filed
// One-click status update, bulk view all clients one screen
// Excel export of tracker

const GSTTracker = {
  _firm: null,
  _clients: [],
  _tracking: {},       // { clientId: { gstr1:'filed', gstr3b:'pending', gstr9:'na', notes:'' } }
  _unsub: null,
  _unsubClients: null,
  _month: null,        // 'YYYY-MM' currently viewed
  _filter: 'all',      // all | pending | filed | na
  _search: '',

  mount(firm) {
    this._firm = firm;
    // Default to current month
    const now = new Date();
    this._month = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
    this._clients = [];
    this._tracking = {};
    this._render();
    this._subscribe();
    // Event delegation for status buttons — safe: reads data-* attributes, no eval
    this._statusHandler = (e) => {
      const btn = e.target.closest('.gst-status-btn');
      if (!btn) return;
      const { cid, field, status } = btn.dataset;
      if (cid && field && status) GSTTracker._setStatus(cid, field, status);
    };
    document.addEventListener('click', this._statusHandler);
  },

  unmount() {
    if (this._unsub)        { this._unsub();        this._unsub = null; }
    if (this._unsubClients) { this._unsubClients(); this._unsubClients = null; }
    if (this._statusHandler) {
      document.removeEventListener('click', this._statusHandler);
      this._statusHandler = null;
    }
  },

  _subscribe() {
    this._unsubClients = FS.subscribeClients(this._firm.id, docs => {
      this._clients = docs;
      this._subscribeTracking();
    });
  },

  _subscribeTracking() {
    if (this._unsub) { this._unsub(); this._unsub = null; }
    const docId = this._month; // e.g. '2025-03'
    this._unsub = db.collection('firms').doc(this._firm.id)
      .collection('gstTracking').doc(docId)
      .onSnapshot(snap => {
        this._tracking = snap.exists ? snap.data() : {};
        this._renderGrid();
      }, err => {
        console.warn('[Filio] gstTracking:', err.message);
        this._tracking = {};
        this._renderGrid();
      });
  },

  _filtered() {
    const q = this._search.toLowerCase();
    return this._clients.filter(c => {
      const matchSearch = !q || (c.name||'').toLowerCase().includes(q) ||
                          (c.pan||'').toLowerCase().includes(q) ||
                          (c.gstin||'').toLowerCase().includes(q);
      if (!matchSearch) return false;
      if (this._filter === 'all') return true;
      const t = this._tracking[c.id] || {};
      if (this._filter === 'pending') return t.gstr1==='pending'||t.gstr3b==='pending'||!t.gstr1;
      if (this._filter === 'filed')   return t.gstr1==='filed' && t.gstr3b==='filed';
      if (this._filter === 'na')      return t.gstr1==='na' || t.gstr3b==='na';
      return true;
    });
  },

  _monthLabel() {
    const [y,m] = this._month.split('-');
    return new Date(parseInt(y), parseInt(m)-1, 1).toLocaleDateString('en-IN', { month:'long', year:'numeric' });
  },

  _prevMonth() {
    const [y,m] = this._month.split('-');
    const d = new Date(parseInt(y), parseInt(m)-2, 1);
    this._month = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    this._subscribeTracking();
    document.getElementById('gst-month-label').textContent = this._monthLabel();
  },

  _nextMonth() {
    const [y,m] = this._month.split('-');
    const d = new Date(parseInt(y), parseInt(m), 1);
    this._month = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    this._subscribeTracking();
    document.getElementById('gst-month-label').textContent = this._monthLabel();
  },

  _render() {
    const cnt = Layout.getContentEl(); if (!cnt) return;
    cnt.innerHTML = `
    <div style="margin-bottom:1.5rem;display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:1rem">
      <div>
        <h2 style="font-size:1.5rem;font-weight:600">GST Filing Tracker</h2>
        <p style="color:var(--text-muted);font-size:.875rem;margin-top:.2rem">
          Track GSTR-1, GSTR-3B and GSTR-9 status for all clients
        </p>
      </div>
      <button class="btn btn-secondary btn-sm" onclick="GSTTracker._exportExcel()" style="display:flex;align-items:center;gap:.4rem">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        Export Excel
      </button>
    </div>

    <!-- Month navigator -->
    <div style="display:flex;align-items:center;gap:1rem;margin-bottom:1.25rem;flex-wrap:wrap">
      <div style="display:flex;align-items:center;gap:.5rem;background:var(--bg-elevated);border:1px solid var(--border-light);border-radius:var(--r-md);padding:.375rem">
        <button class="btn btn-icon btn-ghost btn-sm" onclick="GSTTracker._prevMonth()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <span id="gst-month-label" style="font-weight:600;font-size:.9rem;min-width:130px;text-align:center">${this._monthLabel()}</span>
        <button class="btn btn-icon btn-ghost btn-sm" onclick="GSTTracker._nextMonth()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>

      <!-- Due date badges for this month -->
      <div style="display:flex;gap:.5rem;flex-wrap:wrap" id="gst-due-badges"></div>
    </div>

    <!-- Summary cards -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:.875rem;margin-bottom:1.5rem" id="gst-summary"></div>

    <!-- Search + filter -->
    <div style="display:flex;gap:.75rem;margin-bottom:1.25rem;flex-wrap:wrap;align-items:center">
      <div class="search-bar" style="flex:1;min-width:200px;max-width:300px">
        ${Icons.search}
        <input type="text" placeholder="Search client…" oninput="GSTTracker._onSearch(this.value)" />
      </div>
      <div class="tabs">
        ${[['all','All'],['pending','Pending'],['filed','All Filed'],['na','N/A']].map(([v,l])=>`
          <button class="tab${v===this._filter?' active':''}" onclick="GSTTracker._setFilter('${v}',this)">${l}</button>`).join('')}
      </div>
    </div>

    <!-- Colour legend -->
    <div style="display:flex;gap:1rem;margin-bottom:1rem;flex-wrap:wrap">
      ${[['var(--green-bg)','var(--green)','Filed'],['var(--amber-bg)','var(--amber)','Pending'],['var(--red-bg)','var(--red)','Overdue'],['var(--bg-elevated)','var(--text-muted)','N/A']].map(([bg,c,l])=>`
        <div style="display:flex;align-items:center;gap:.4rem;font-size:.75rem;color:var(--text-secondary)">
          <div style="width:10px;height:10px;border-radius:2px;background:${bg};border:1px solid ${c}"></div>${l}
        </div>`).join('')}
    </div>

    <!-- Grid -->
    <div class="card" style="padding:0;overflow:hidden">
      <div class="table-wrap">
        <table id="gst-table">
          <thead>
            <tr>
              <th style="min-width:180px">Client</th>
              <th style="min-width:80px">GSTIN</th>
              <th style="text-align:center;min-width:110px">
                GSTR-1
                <div style="font-size:.65rem;color:var(--text-muted);font-weight:400">Due 11th</div>
              </th>
              <th style="text-align:center;min-width:110px">
                GSTR-3B
                <div style="font-size:.65rem;color:var(--text-muted);font-weight:400">Due 20th</div>
              </th>
              <th style="text-align:center;min-width:110px">
                GSTR-9
                <div style="font-size:.65rem;color:var(--text-muted);font-weight:400">Annual</div>
              </th>
              <th style="min-width:130px">Notes</th>
            </tr>
          </thead>
          <tbody id="gst-tbody">
            <tr><td colspan="6" style="text-align:center;padding:3rem">
              <div class="spinner" style="margin:0 auto"></div>
            </td></tr>
          </tbody>
        </table>
      </div>
    </div>`;

    this._renderDueBadges();
  },

  _renderDueBadges() {
    const el = document.getElementById('gst-due-badges'); if (!el) return;
    const [y,m] = this._month.split('-');
    const now = new Date();
    const isCurrentMonth = now.getFullYear()===parseInt(y) && now.getMonth()===parseInt(m)-1;
    if (!isCurrentMonth) { el.innerHTML = ''; return; }
    const today = now.getDate();
    const daysTo11 = 11 - today;
    const daysTo20 = 20 - today;
    el.innerHTML = [
      daysTo11 >= 0
        ? `<span class="badge badge-${daysTo11<=3?'red':daysTo11<=7?'amber':'muted'}">GSTR-1: ${daysTo11===0?'Today':daysTo11===1?'Tomorrow':daysTo11+'d left'}</span>` : '',
      daysTo20 >= 0
        ? `<span class="badge badge-${daysTo20<=3?'red':daysTo20<=7?'amber':'muted'}">GSTR-3B: ${daysTo20===0?'Today':daysTo20===1?'Tomorrow':daysTo20+'d left'}</span>` : '',
    ].join('');
  },

  _renderGrid() {
    // Summary
    const sumEl = document.getElementById('gst-summary');
    if (sumEl) {
      const total   = this._clients.length;
      const filed1  = this._clients.filter(c => this._tracking[c.id]?.gstr1==='filed').length;
      const filed3b = this._clients.filter(c => this._tracking[c.id]?.gstr3b==='filed').length;
      const pending = this._clients.filter(c => {
        const t = this._tracking[c.id]||{};
        return (t.gstr1==='pending'||!t.gstr1) || (t.gstr3b==='pending'||!t.gstr3b);
      }).filter(c => (this._tracking[c.id]?.gstr1||'') !== 'na').length;

      sumEl.innerHTML = [
        {l:'Total Clients',  v:total,           c:'--blue'},
        {l:'GSTR-1 Filed',   v:`${filed1}/${total}`,  c:'--green'},
        {l:'GSTR-3B Filed',  v:`${filed3b}/${total}`, c:'--green'},
        {l:'Pending Action', v:pending,         c: pending>0?'--red':'--green'},
      ].map(s=>`
        <div class="card" style="padding:.875rem">
          <div style="font-size:1.375rem;font-weight:700;color:var(${s.c})">${s.v}</div>
          <div style="font-size:.75rem;color:var(--text-muted);margin-top:.2rem">${s.l}</div>
        </div>`).join('');
    }

    const tbody = document.getElementById('gst-tbody'); if (!tbody) return;
    const filtered = this._filtered();

    if (!filtered.length) {
      tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state">
        ${Icons.clients}<h4>${this._search||this._filter!=='all'?'No matches':'No clients yet'}</h4>
        ${!this._search&&this._filter==='all'?`<p>Add clients first from the Clients page</p>`:''}</div></td></tr>`;
      return;
    }

    const now   = new Date();
    const [y,m] = this._month.split('-');
    const isCurrentMonth = now.getFullYear()===parseInt(y) && now.getMonth()===parseInt(m)-1;
    const today = now.getDate();

    tbody.innerHTML = filtered.map(c => {
      const t = this._tracking[c.id] || {};
      const isGSTClient = c.type !== 'individual' || c.gstin;

      const statusCell = (field, dueDay) => {
        if (!isGSTClient) {
          return `<td style="text-align:center"><span class="badge badge-muted" style="font-size:.7rem">N/A</span></td>`;
        }
        const val = t[field] || 'pending';
        const isOverdue = isCurrentMonth && today > dueDay && val !== 'filed';
        const bg = val==='filed' ? 'var(--green-bg)' : isOverdue ? 'var(--red-bg)' : 'var(--amber-bg)';
        const clr= val==='filed' ? 'var(--green)'    : isOverdue ? 'var(--red)'    : 'var(--amber)';
        const lbl= val==='filed' ? 'Filed' : val==='na' ? 'N/A' : isOverdue ? 'Overdue' : 'Pending';

        return `<td style="text-align:center;padding:.5rem .75rem">
          <div style="display:flex;flex-direction:column;align-items:center;gap:.35rem">
            <span style="display:inline-block;padding:.25rem .75rem;border-radius:20px;font-size:.72rem;font-weight:600;background:${bg};color:${clr}">${lbl}</span>
            <div style="display:flex;gap:.25rem">
              ${['filed','pending','na'].map(s=>`
                <button
                  data-cid="${c.id}" data-field="${field}" data-status="${s}"
                  class="gst-status-btn"
                  style="font-size:.65rem;padding:.15rem .4rem;border-radius:4px;border:1px solid;cursor:pointer;transition:all .1s;
                    background:${val===s?(s==='filed'?'var(--green)':s==='na'?'var(--bg-elevated)':'var(--amber)'):'transparent'};
                    color:${val===s?(s==='filed'?'white':s==='na'?'var(--text-muted)':'var(--navy)'):(s==='filed'?'var(--green)':s==='na'?'var(--text-muted)':'var(--amber)')};
                    border-color:${s==='filed'?'var(--green)':s==='na'?'var(--border)':'var(--amber)'};
                    font-weight:${val===s?'700':'400'}">
                  ${s==='filed'?'✓ Filed':s==='na'?'N/A':'Pending'}
                </button>`).join('')}
            </div>
          </div>
        </td>`;
      };

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
        <td><code style="font-size:.72rem;color:var(--text-muted)">${c.gstin ? c.gstin.slice(0,10)+'…' : '—'}</code></td>
        ${statusCell('gstr1', 11)}
        ${statusCell('gstr3b', 20)}
        <td style="text-align:center;padding:.5rem .75rem">
          ${isGSTClient ? `<div style="display:flex;flex-direction:column;align-items:center;gap:.35rem">
            <span style="display:inline-block;padding:.25rem .75rem;border-radius:20px;font-size:.72rem;font-weight:600;background:${t.gstr9==='filed'?'var(--green-bg)':'var(--bg-elevated)'};color:${t.gstr9==='filed'?'var(--green)':'var(--text-muted)'}">${t.gstr9==='filed'?'Filed':'Not Set'}</span>
            <div style="display:flex;gap:.25rem">
              ${['filed','pending'].map(s=>`
                <button
                  data-cid="${c.id}" data-field="gstr9" data-status="${s}"
                  class="gst-status-btn"
                  style="font-size:.65rem;padding:.15rem .4rem;border-radius:4px;border:1px solid;cursor:pointer;
                    background:${t.gstr9===s?(s==='filed'?'var(--green)':'var(--amber)'):'transparent'};
                    color:${t.gstr9===s?(s==='filed'?'white':'var(--navy)'):(s==='filed'?'var(--green)':'var(--amber)')};
                    border-color:${s==='filed'?'var(--green)':'var(--amber)'}">
                  ${s==='filed'?'✓ Filed':'Pending'}
                </button>`).join('')}
            </div>
          </div>` : `<span class="badge badge-muted" style="font-size:.7rem">N/A</span>`}
        </td>
        <td>
          <input type="text" class="input" style="font-size:.78rem;padding:.3rem .5rem;min-width:110px"
            placeholder="Add note…"
            value="${esc(t.notes||'')}"
            onblur="GSTTracker._setNote('${c.id}',this.value)"
            onkeydown="if(event.key==='Enter')this.blur()" />
        </td>
      </tr>`;
    }).join('');
  },

  async _setStatus(clientId, field, value) {
    const [y,m] = this._month.split('-');
    const docId = this._month;
    try {
      await db.collection('firms').doc(this._firm.id)
        .collection('gstTracking').doc(docId)
        .set({ [clientId]: { ...(this._tracking[clientId]||{}), [field]: value } }, { merge:true });
      // Optimistic update
      if (!this._tracking[clientId]) this._tracking[clientId] = {};
      this._tracking[clientId][field] = value;
      this._renderGrid();
    } catch(e) { Toast.error('Update failed'); }
  },

  async _setNote(clientId, note) {
    const docId = this._month;
    try {
      await db.collection('firms').doc(this._firm.id)
        .collection('gstTracking').doc(docId)
        .set({ [clientId]: { ...(this._tracking[clientId]||{}), notes: note } }, { merge:true });
      if (!this._tracking[clientId]) this._tracking[clientId] = {};
      this._tracking[clientId].notes = note;
    } catch(e) { /* silent */ }
  },

  _setFilter(v, btn) {
    this._filter = v;
    document.querySelectorAll('.tabs .tab').forEach(b=>b.classList.remove('active'));
    if(btn) btn.classList.add('active');
    this._renderGrid();
  },

  _onSearch(v) { this._search = v; this._renderGrid(); },

  _exportExcel() {
    const rows = [['Client','PAN','GSTIN','Type','GSTR-1','GSTR-3B','GSTR-9','Notes']];
    this._clients.forEach(c => {
      const t = this._tracking[c.id]||{};
      rows.push([c.name,c.pan||'',c.gstin||'',c.type||'individual',
        t.gstr1||'pending', t.gstr3b||'pending', t.gstr9||'not set', t.notes||'']);
    });
    const csv = rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF'+csv], {type:'text/csv;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `GST_Tracker_${this._month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    Toast.success('GST Tracker exported as CSV');
  },
};
