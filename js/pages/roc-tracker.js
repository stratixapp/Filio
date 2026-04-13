// js/pages/roc-tracker.js — Phase 2: ROC / MCA Compliance Tracker
// MGT-7, AOC-4, DIR-3 KYC, ADT-1 for company clients
// Due dates auto-calculated from incorporation date

const ROCTracker = {
  _firm: null,
  _clients: [],       // Only company/LLP clients
  _tracking: {},
  _unsub: null,
  _unsubClients: null,
  _year: null,        // Financial year e.g. '2024-25'
  _filter: 'all',
  _search: '',

  _fyYears() {
    const now = new Date();
    const fy  = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear()-1;
    return Array.from({length:4}, (_,i) => {
      const y = fy - i;
      return `${y}-${String(y+1).slice(-2)}`;
    });
  },

  mount(firm) {
    this._firm = firm;
    const now = new Date();
    const fy  = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear()-1;
    this._year = `${fy}-${String(fy+1).slice(-2)}`;
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
      // ROC only for company/LLP types
      this._clients = docs.filter(c => ['company','llp','partnership'].includes(c.type));
      this._subscribeTracking();
    });
  },

  _subscribeTracking() {
    if (this._unsub) { this._unsub(); this._unsub = null; }
    this._unsub = db.collection('firms').doc(this._firm.id)
      .collection('rocTracking').doc(this._year)
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
        <h2 style="font-size:1.5rem;font-weight:600">ROC / MCA Compliance</h2>
        <p style="color:var(--text-muted);font-size:.875rem;margin-top:.2rem">
          MGT-7 · AOC-4 · DIR-3 KYC · ADT-1 — company & LLP clients only
        </p>
      </div>
      <button class="btn btn-secondary btn-sm" onclick="ROCTracker._exportExcel()">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:.3rem"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        Export
      </button>
    </div>

    <!-- Year selector -->
    <div style="display:flex;align-items:center;gap:1rem;margin-bottom:1.5rem;flex-wrap:wrap">
      <div style="display:flex;align-items:center;gap:.5rem">
        <label style="font-size:.8125rem;color:var(--text-muted);font-weight:500">Financial Year:</label>
        <select class="input" style="width:130px;padding:.4rem .75rem;font-size:.875rem" onchange="ROCTracker._changeYear(this.value)">
          ${this._fyYears().map(y=>`<option value="${y}" ${y===this._year?'selected':''}>${y}</option>`).join('')}
        </select>
      </div>
      <div style="display:flex;gap:.5rem;flex-wrap:wrap">
        <span class="badge badge-green" style="font-size:.72rem">MGT-7: 60 days from AGM</span>
        <span class="badge badge-green" style="font-size:.72rem">AOC-4: 30 days from AGM</span>
        <span class="badge badge-amber" style="font-size:.72rem">DIR-3 KYC: 30 Sep every year</span>
        <span class="badge badge-blue"  style="font-size:.72rem">ADT-1: 15 days from AGM</span>
      </div>
    </div>

    <!-- Summary cards -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:.875rem;margin-bottom:1.5rem" id="roc-summary"></div>

    <!-- Search + filter -->
    <div style="display:flex;gap:.75rem;margin-bottom:1.25rem;flex-wrap:wrap;align-items:center">
      <div class="search-bar" style="flex:1;min-width:200px;max-width:300px">
        ${Icons.search}
        <input type="text" placeholder="Search company…" oninput="ROCTracker._onSearch(this.value)" />
      </div>
      <div class="tabs">
        ${[['all','All'],['pending','Pending'],['filed','Filed']].map(([v,l])=>`
          <button class="tab${v===this._filter?' active':''}" onclick="ROCTracker._setFilter('${v}',this)">${l}</button>`).join('')}
      </div>
    </div>

    <div class="card" style="padding:0;overflow:hidden">
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th style="min-width:180px">Company / LLP</th>
              <th style="text-align:center">
                MGT-7
                <div style="font-size:.65rem;color:var(--text-muted);font-weight:400">Annual Return</div>
              </th>
              <th style="text-align:center">
                AOC-4
                <div style="font-size:.65rem;color:var(--text-muted);font-weight:400">Fin. Statements</div>
              </th>
              <th style="text-align:center">
                DIR-3 KYC
                <div style="font-size:.65rem;color:var(--text-muted);font-weight:400">Director KYC</div>
              </th>
              <th style="text-align:center">
                ADT-1
                <div style="font-size:.65rem;color:var(--text-muted);font-weight:400">Auditor Appt.</div>
              </th>
              <th>AGM Date</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody id="roc-tbody">
            <tr><td colspan="7" style="text-align:center;padding:3rem"><div class="spinner" style="margin:0 auto"></div></td></tr>
          </tbody>
        </table>
      </div>
    </div>

    ${this._clients.length === 0 ? '' : ''}`;
  },

  _changeYear(y) { this._year = y; this._subscribeTracking(); },

  _renderGrid() {
    const sumEl = document.getElementById('roc-summary');
    if (sumEl) {
      const total  = this._clients.length;
      const mgt7   = this._clients.filter(c => this._tracking[c.id]?.mgt7==='filed').length;
      const aoc4   = this._clients.filter(c => this._tracking[c.id]?.aoc4==='filed').length;
      const kyc    = this._clients.filter(c => this._tracking[c.id]?.dir3kyc==='filed').length;
      sumEl.innerHTML = [
        {l:'Company Clients', v:total,         c:'--blue'},
        {l:'MGT-7 Filed',    v:`${mgt7}/${total}`, c:'--green'},
        {l:'AOC-4 Filed',    v:`${aoc4}/${total}`, c:'--green'},
        {l:'DIR-3 KYC Done', v:`${kyc}/${total}`,  c:'--purple'},
      ].map(s=>`<div class="card" style="padding:.875rem">
        <div style="font-size:1.375rem;font-weight:700;color:var(${s.c})">${s.v}</div>
        <div style="font-size:.75rem;color:var(--text-muted);margin-top:.2rem">${s.l}</div>
      </div>`).join('');
    }

    const tbody = document.getElementById('roc-tbody'); if (!tbody) return;

    if (!this._clients.length) {
      tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state">${Icons.building}
        <h4>No company or LLP clients found</h4>
        <p>Add clients with type set to "Company" or "LLP" to track ROC compliance</p>
        <a href="#/clients" class="btn btn-primary btn-sm" style="margin-top:.75rem">Go to Clients</a>
      </div></td></tr>`;
      return;
    }

    const filtered = this._clients.filter(c => {
      const q = this._search.toLowerCase();
      if (q && !(c.name||'').toLowerCase().includes(q)) return false;
      if (this._filter==='filed') { const t=this._tracking[c.id]||{}; return t.mgt7==='filed'&&t.aoc4==='filed'; }
      if (this._filter==='pending') { const t=this._tracking[c.id]||{}; return !t.mgt7||t.mgt7==='pending'||!t.aoc4||t.aoc4==='pending'; }
      return true;
    });

    if (!filtered.length) {
      tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state">${Icons.clients}<h4>No matches</h4></div></td></tr>`;
      return;
    }

    const statusDropdown = (clientId, field, val, opts) => {
      const cur = val||'pending';
      const colorMap = {filed:'--green',pending:'--amber',na:'--text-muted',overdue:'--red'};
      const labelMap = {filed:'Filed ✓',pending:'Pending',na:'N/A',overdue:'Overdue'};
      return `<div style="display:flex;flex-direction:column;align-items:center;gap:.3rem">
        <span style="font-size:.72rem;font-weight:600;color:var(${colorMap[cur]||'--text-muted'})">${labelMap[cur]||cur}</span>
        <select class="input" style="font-size:.7rem;padding:.2rem .4rem;width:90px"
          onchange="ROCTracker._update('${clientId}','${field}',this.value)">
          ${opts.map(([v,l])=>`<option value="${v}" ${cur===v?'selected':''}>${l}</option>`).join('')}
        </select>
      </div>`;
    };

    const baseOpts = [['pending','Pending'],['filed','Filed ✓'],['na','N/A']];

    tbody.innerHTML = filtered.map(c => {
      const t = this._tracking[c.id] || {};
      return `<tr>
        <td>
          <div style="display:flex;align-items:center;gap:.625rem">
            <div class="avatar" style="background:rgba(39,174,96,.12);color:var(--green);font-size:.7rem;width:30px;height:30px;flex-shrink:0">${Fmt.initials(c.name)}</div>
            <div>
              <div style="font-weight:500;font-size:.875rem">${esc(c.name)}</div>
              <span class="badge badge-${c.type==='company'?'blue':'green'}" style="font-size:.65rem;text-transform:capitalize">${c.type}</span>
            </div>
          </div>
        </td>
        <td style="text-align:center;padding:.5rem">${statusDropdown(c.id,'mgt7',t.mgt7,baseOpts)}</td>
        <td style="text-align:center;padding:.5rem">${statusDropdown(c.id,'aoc4',t.aoc4,baseOpts)}</td>
        <td style="text-align:center;padding:.5rem">${statusDropdown(c.id,'dir3kyc',t.dir3kyc,baseOpts)}</td>
        <td style="text-align:center;padding:.5rem">${statusDropdown(c.id,'adt1',t.adt1,baseOpts)}</td>
        <td>
          <input type="date" class="input" style="font-size:.78rem;padding:.25rem .5rem;width:130px"
            value="${t.agmDate||''}"
            title="AGM Date (due dates auto-calculate from this)"
            onchange="ROCTracker._update('${c.id}','agmDate',this.value)" />
        </td>
        <td>
          <input type="text" class="input" style="font-size:.78rem;padding:.3rem .5rem;min-width:100px"
            placeholder="Note…" value="${esc(t.notes||'')}"
            onblur="ROCTracker._update('${c.id}','notes',this.value)"
            onkeydown="if(event.key==='Enter')this.blur()" />
        </td>
      </tr>`;
    }).join('');
  },

  async _update(clientId, field, value) {
    try {
      await db.collection('firms').doc(this._firm.id)
        .collection('rocTracking').doc(this._year)
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
    const rows = [['Company','Type','FY','MGT-7','AOC-4','DIR-3 KYC','ADT-1','AGM Date','Notes']];
    this._clients.forEach(c => {
      const t = this._tracking[c.id]||{};
      rows.push([c.name,c.type||'',this._year,t.mgt7||'pending',t.aoc4||'pending',t.dir3kyc||'pending',t.adt1||'pending',t.agmDate||'',t.notes||'']);
    });
    const csv = rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const a=document.createElement('a'); a.href=url; a.download=`ROC_Tracker_${this._year}.csv`; a.click();
    URL.revokeObjectURL(url);
    Toast.success('ROC Tracker exported');
  },
};
