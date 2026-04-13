// js/pages/tds-tracker.js — Phase 2: TDS Tracker
// 24Q, 26Q, 27Q quarterly return status, challan tracking

const TDSTracker = {
  _firm: null,
  _clients: [],
  _tracking: {},
  _unsub: null,
  _unsubClients: null,
  _quarter: null,   // 'Q1-2025-26', 'Q2-2025-26' etc
  _filter: 'all',
  _search: '',

  _quarters() {
    const now = new Date();
    const fy  = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear()-1;
    const fyStr = `${fy}-${String(fy+1).slice(-2)}`;
    const prevFy = `${fy-1}-${String(fy).slice(-2)}`;
    return [
      `Q1-${fyStr}`, `Q2-${fyStr}`, `Q3-${fyStr}`, `Q4-${fyStr}`,
      `Q1-${prevFy}`, `Q2-${prevFy}`, `Q3-${prevFy}`, `Q4-${prevFy}`,
    ];
  },

  _quarterLabel(q) {
    const [qNum, ...fyParts] = q.split('-');
    const fy = fyParts.join('-');
    const labels = {Q1:'Apr-Jun',Q2:'Jul-Sep',Q3:'Oct-Dec',Q4:'Jan-Mar'};
    const dueDates = {Q1:'31 Jul',Q2:'31 Oct',Q3:'31 Jan',Q4:'31 May'};
    return `${qNum} (${labels[qNum]}) FY ${fy} — Due: ${dueDates[qNum]}`;
  },

  _currentQuarter() {
    const now = new Date();
    const fy  = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear()-1;
    const fyStr = `${fy}-${String(fy+1).slice(-2)}`;
    const m = now.getMonth();
    if (m>=3&&m<=5)  return `Q1-${fyStr}`;
    if (m>=6&&m<=8)  return `Q2-${fyStr}`;
    if (m>=9&&m<=11) return `Q3-${fyStr}`;
    return `Q4-${fyStr}`;
  },

  mount(firm) {
    this._firm = firm;
    this._quarter = this._currentQuarter();
    this._clients = []; this._tracking = {};
    this._render();
    this._subscribe();
  },

  unmount() {
    if (this._unsub)        { this._unsub();        this._unsub = null; }
    if (this._unsubClients) { this._unsubClients(); this._unsubClients = null; }
  },

  _subscribe() {
    this._unsubClients = FS.subscribeClients(this._firm.id, docs => {
      this._clients = docs.filter(c => c.hasTDS || c.type !== 'individual');
      this._subscribeTracking();
    });
  },

  _subscribeTracking() {
    if (this._unsub) { this._unsub(); this._unsub = null; }
    this._unsub = db.collection('firms').doc(this._firm.id)
      .collection('tdsTracking').doc(this._quarter)
      .onSnapshot(snap => {
        this._tracking = snap.exists ? snap.data() : {};
        this._renderGrid();
      }, err => { this._tracking = {}; this._renderGrid(); });
  },

  _render() {
    const cnt = Layout.getContentEl(); if (!cnt) return;
    cnt.innerHTML = `
    <div style="margin-bottom:1.5rem;display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:1rem">
      <div>
        <h2 style="font-size:1.5rem;font-weight:600">TDS Return Tracker</h2>
        <p style="color:var(--text-muted);font-size:.875rem;margin-top:.2rem">24Q · 26Q · 27Q quarterly TDS return status</p>
      </div>
      <button class="btn btn-secondary btn-sm" onclick="TDSTracker._exportExcel()">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:.3rem"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        Export
      </button>
    </div>

    <!-- Quarter selector -->
    <div style="display:flex;align-items:center;gap:1rem;margin-bottom:1.5rem;flex-wrap:wrap">
      <div style="display:flex;align-items:center;gap:.5rem">
        <label style="font-size:.8125rem;color:var(--text-muted);font-weight:500">Quarter:</label>
        <select class="input" style="width:280px;padding:.4rem .75rem;font-size:.875rem" onchange="TDSTracker._changeQ(this.value)">
          ${this._quarters().map(q=>`<option value="${q}" ${q===this._quarter?'selected':''}>${this._quarterLabel(q)}</option>`).join('')}
        </select>
      </div>
      <div style="display:flex;gap:.5rem;flex-wrap:wrap">
        <span class="badge badge-purple" style="font-size:.72rem">TDS Challan: 7th of every month</span>
        <span class="badge badge-blue"   style="font-size:.72rem">Form 16A: 15 days after quarter end</span>
      </div>
    </div>

    <!-- Summary cards -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:.875rem;margin-bottom:1.5rem" id="tds-summary"></div>

    <!-- Search + filter -->
    <div style="display:flex;gap:.75rem;margin-bottom:1.25rem;flex-wrap:wrap;align-items:center">
      <div class="search-bar" style="flex:1;min-width:200px;max-width:300px">
        ${Icons.search}
        <input type="text" placeholder="Search client…" oninput="TDSTracker._onSearch(this.value)" />
      </div>
      <div class="tabs">
        ${[['all','All'],['pending','Pending'],['filed','Filed']].map(([v,l])=>`
          <button class="tab${v===this._filter?' active':''}" onclick="TDSTracker._setFilter('${v}',this)">${l}</button>`).join('')}
      </div>
    </div>

    <div class="card" style="padding:0;overflow:hidden">
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th style="min-width:160px">Client</th>
              <th style="text-align:center;min-width:100px">
                24Q
                <div style="font-size:.65rem;color:var(--text-muted);font-weight:400">Salary TDS</div>
              </th>
              <th style="text-align:center;min-width:100px">
                26Q
                <div style="font-size:.65rem;color:var(--text-muted);font-weight:400">Non-Salary TDS</div>
              </th>
              <th style="text-align:center;min-width:100px">
                27Q
                <div style="font-size:.65rem;color:var(--text-muted);font-weight:400">NRI Payments</div>
              </th>
              <th style="text-align:center;min-width:120px">Challan Payment</th>
              <th style="text-align:center;min-width:110px">Form 16/16A</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody id="tds-tbody">
            <tr><td colspan="7" style="text-align:center;padding:3rem"><div class="spinner" style="margin:0 auto"></div></td></tr>
          </tbody>
        </table>
      </div>
    </div>`;
  },

  _changeQ(q) {
    this._quarter = q;
    this._subscribeTracking();
  },

  _renderGrid() {
    const sumEl = document.getElementById('tds-summary');
    if (sumEl) {
      const total  = this._clients.length;
      const filed  = this._clients.filter(c => {
        const t = this._tracking[c.id]||{};
        return (t.q26==='filed'||t.q26==='na') && (t.q24==='filed'||t.q24==='na');
      }).length;
      const challan = this._clients.filter(c => this._tracking[c.id]?.challan==='paid').length;
      sumEl.innerHTML = [
        {l:'TDS Clients',    v:total,             c:'--blue'},
        {l:'Returns Filed',  v:`${filed}/${total}`,c:'--green'},
        {l:'Challan Paid',   v:`${challan}/${total}`,c:'--purple'},
      ].map(s=>`<div class="card" style="padding:.875rem">
        <div style="font-size:1.375rem;font-weight:700;color:var(${s.c})">${s.v}</div>
        <div style="font-size:.75rem;color:var(--text-muted);margin-top:.2rem">${s.l}</div>
      </div>`).join('');
    }

    const tbody = document.getElementById('tds-tbody'); if (!tbody) return;
    const filtered = this._clients.filter(c => {
      const q = this._search.toLowerCase();
      if (q && !(c.name||'').toLowerCase().includes(q)) return false;
      if (this._filter==='filed') { const t=this._tracking[c.id]||{}; return t.q26==='filed'; }
      if (this._filter==='pending') { const t=this._tracking[c.id]||{}; return !t.q26||t.q26==='pending'; }
      return true;
    });

    if (!filtered.length) {
      tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state">${Icons.clients}<h4>No TDS clients found</h4>
        <p style="max-width:280px;text-align:center">Add clients with TDS liability from the Clients section</p></div></td></tr>`;
      return;
    }

    const statusBtn = (clientId, field, currentVal) => {
      const options = [['pending','Pending','--amber'],['filed','Filed ✓','--green'],['na','N/A','--text-muted']];
      const cur = currentVal||'pending';
      const [,lbl,clr] = options.find(o=>o[0]===cur)||options[0];
      return `<div style="display:flex;flex-direction:column;align-items:center;gap:.3rem">
        <span style="font-size:.72rem;font-weight:600;color:var(${clr})">${lbl}</span>
        <select class="input" style="font-size:.7rem;padding:.2rem .4rem;width:90px"
          onchange="TDSTracker._update('${clientId}','${field}',this.value)">
          ${options.map(([v,l])=>`<option value="${v}" ${cur===v?'selected':''}>${l}</option>`).join('')}
        </select>
      </div>`;
    };

    tbody.innerHTML = filtered.map(c => {
      const t = this._tracking[c.id]||{};
      return `<tr>
        <td>
          <div style="display:flex;align-items:center;gap:.625rem">
            <div class="avatar" style="background:rgba(201,168,76,.12);color:var(--gold);font-size:.7rem;width:30px;height:30px">${Fmt.initials(c.name)}</div>
            <div>
              <div style="font-weight:500;font-size:.875rem">${esc(c.name)}</div>
              <span class="badge badge-muted" style="font-size:.65rem;text-transform:capitalize">${c.type||'individual'}</span>
            </div>
          </div>
        </td>
        <td style="text-align:center;padding:.5rem">${statusBtn(c.id,'q24',t.q24)}</td>
        <td style="text-align:center;padding:.5rem">${statusBtn(c.id,'q26',t.q26)}</td>
        <td style="text-align:center;padding:.5rem">${statusBtn(c.id,'q27',t.q27)}</td>
        <td style="text-align:center;padding:.5rem">
          <div style="display:flex;flex-direction:column;align-items:center;gap:.3rem">
            <span style="font-size:.72rem;font-weight:600;color:var(${t.challan==='paid'?'--green':'--amber'})">${t.challan==='paid'?'Paid ✓':'Pending'}</span>
            <select class="input" style="font-size:.7rem;padding:.2rem .4rem;width:90px"
              onchange="TDSTracker._update('${c.id}','challan',this.value)">
              <option value="pending" ${(!t.challan||t.challan==='pending')?'selected':''}>Pending</option>
              <option value="paid" ${t.challan==='paid'?'selected':''}>Paid ✓</option>
            </select>
          </div>
        </td>
        <td style="text-align:center;padding:.5rem">
          <select class="input" style="font-size:.7rem;padding:.2rem .4rem;width:100px"
            onchange="TDSTracker._update('${c.id}','form16',this.value)">
            <option value="pending" ${(!t.form16||t.form16==='pending')?'selected':''}>Pending</option>
            <option value="issued"  ${t.form16==='issued'?'selected':''}>Issued ✓</option>
            <option value="na"      ${t.form16==='na'?'selected':''}>N/A</option>
          </select>
        </td>
        <td>
          <input type="text" class="input" style="font-size:.78rem;padding:.3rem .5rem;min-width:100px"
            placeholder="Note…" value="${esc(t.notes||'')}"
            onblur="TDSTracker._update('${c.id}','notes',this.value)"
            onkeydown="if(event.key==='Enter')this.blur()" />
        </td>
      </tr>`;
    }).join('');
  },

  async _update(clientId, field, value) {
    try {
      await db.collection('firms').doc(this._firm.id)
        .collection('tdsTracking').doc(this._quarter)
        .set({ [clientId]: { ...(this._tracking[clientId]||{}), [field]: value } }, { merge:true });
      if (!this._tracking[clientId]) this._tracking[clientId] = {};
      this._tracking[clientId][field] = value;
      this._renderGrid();
    } catch(e) { Toast.error('Update failed'); }
  },

  _setFilter(v,btn) {
    this._filter=v;
    document.querySelectorAll('.tabs .tab').forEach(b=>b.classList.remove('active'));
    if(btn) btn.classList.add('active');
    this._renderGrid();
  },
  _onSearch(v) { this._search=v; this._renderGrid(); },

  _exportExcel() {
    const rows = [['Client','PAN','Type','Quarter','24Q','26Q','27Q','Challan','Form 16/16A','Notes']];
    this._clients.forEach(c => {
      const t = this._tracking[c.id]||{};
      rows.push([c.name,c.pan||'',c.type||'',this._quarter,
        t.q24||'pending',t.q26||'pending',t.q27||'na',t.challan||'pending',t.form16||'pending',t.notes||'']);
    });
    const csv = rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href=url; a.download=`TDS_Tracker_${this._quarter}.csv`; a.click();
    URL.revokeObjectURL(url);
    Toast.success('TDS Tracker exported');
  },
};
