// js/pages/analytics.js — Phase 7: Business Intelligence & Analytics
// Firm revenue dashboard, client profitability, staff productivity,
// seasonal workload forecast, report sales analytics, YoY comparison

const AnalyticsPage = {
  _firm: null, _user: null,
  _invoices: [], _clients: [], _tasks: [],
  _purchases: [], _comms: [],
  _unsubs: [],
  _tab: 'revenue',  // revenue | clients | staff | workload | reports | yoy
  _loading: true,

  mount(user, firm) {
    this._user = user; this._firm = firm;
    this._invoices = []; this._clients = [];
    this._tasks = []; this._purchases = []; this._comms = [];
    this._loading = true;
    this._render();
    this._unsubs = [
      FS.subscribeInvoices(firm.id, d  => { this._invoices  = d;  this._loading = false; this._renderTab(); }),
      FS.subscribeClients(firm.id, d   => { this._clients   = d;  this._renderTab(); }),
      FS.subscribeTasks(firm.id, d     => { this._tasks     = d;  this._renderTab(); }),
      FS.subscribeReportPurchases(firm.id, d => { this._purchases = d; this._renderTab(); }),
    ];
  },

  unmount() { this._unsubs.forEach(u => u()); this._unsubs = []; },

  // ── Helpers ────────────────────────────────────────────────
  _fmt(paise) { return '₹' + ((paise||0)/100).toLocaleString('en-IN', {minimumFractionDigits:0}); },
  _fmtL(paise) {
    const n = (paise||0)/100;
    if (n >= 10000000) return '₹' + (n/10000000).toFixed(1) + 'Cr';
    if (n >= 100000)   return '₹' + (n/100000).toFixed(1)   + 'L';
    if (n >= 1000)     return '₹' + (n/1000).toFixed(1)     + 'K';
    return '₹' + Math.round(n).toLocaleString('en-IN');
  },

  _monthKey(date) {
    const d = date?.toDate ? date.toDate() : (date instanceof Date ? date : new Date(date));
    if (isNaN(d)) return null;
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  },

  _last12Months() {
    const months = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`);
    }
    return months;
  },

  _monthLabel(key) {
    const [y,m] = key.split('-');
    return new Date(+y, +m-1, 1).toLocaleDateString('en-IN', {month:'short', year:'2-digit'});
  },

  // ── Render shell ───────────────────────────────────────────
  _render() {
    const cnt = Layout.getContentEl(); if (!cnt) return;
    cnt.innerHTML = `
    <div style="margin-bottom:1.5rem;display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:1rem">
      <div>
        <h2 style="font-size:1.5rem;font-weight:600">Analytics & Business Intelligence</h2>
        <p style="color:var(--text-muted);font-size:.875rem;margin-top:.2rem">
          Understand your firm's performance — revenue, clients, staff, and growth
        </p>
      </div>
      <button class="btn btn-secondary btn-sm" onclick="AnalyticsPage._exportAll()">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:.35rem"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        Export Report
      </button>
    </div>

    <!-- Tab nav -->
    <div class="tabs" style="margin-bottom:1.5rem;flex-wrap:wrap">
      ${[
        ['revenue',  '💰 Revenue'],
        ['clients',  '👥 Clients'],
        ['staff',    '✅ Staff'],
        ['workload', '📅 Workload'],
        ['reports',  '📊 Reports'],
        ['yoy',      '📈 Year on Year'],
      ].map(([v,l]) => `<button class="tab${v===this._tab?' active':''}" onclick="AnalyticsPage._setTab('${v}',this)">${l}</button>`).join('')}
    </div>

    <div id="analytics-content">
      <div style="display:flex;justify-content:center;padding:4rem"><div class="spinner spinner-lg"></div></div>
    </div>`;
  },

  _setTab(tab, btn) {
    this._tab = tab;
    document.querySelectorAll('.tabs .tab').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    this._renderTab();
  },

  _renderTab() {
    const el = document.getElementById('analytics-content');
    if (!el) return;
    if (this._loading) {
      el.innerHTML = `<div style="display:flex;justify-content:center;padding:4rem"><div class="spinner spinner-lg"></div></div>`;
      return;
    }
    switch (this._tab) {
      case 'revenue':  this._renderRevenue(el);  break;
      case 'clients':  this._renderClients(el);  break;
      case 'staff':    this._renderStaff(el);    break;
      case 'workload': this._renderWorkload(el); break;
      case 'reports':  this._renderReports(el);  break;
      case 'yoy':      this._renderYoY(el);      break;
    }
  },

  // ── TAB 1: Revenue Dashboard ──────────────────────────────
  _renderRevenue(el) {
    const months = this._last12Months();
    const now    = new Date();
    const paid   = this._invoices.filter(i => i.status === 'paid');
    const outstanding = this._invoices.filter(i => i.status === 'sent' || i.status === 'overdue');
    const draft  = this._invoices.filter(i => i.status === 'draft');

    const totalCollected  = paid.reduce((s,i) => s+(i.total||0), 0);
    const totalOutstanding= outstanding.reduce((s,i) => s+(i.total||0), 0);
    const totalDraft      = draft.reduce((s,i) => s+(i.total||0), 0);
    const collectionRate  = this._invoices.length
      ? Math.round(paid.length / this._invoices.filter(i=>i.status!=='draft').length * 100) || 0 : 0;

    // Monthly revenue bars
    const monthlyData = months.map(mo => {
      const moInv = paid.filter(i => this._monthKey(i.createdAt) === mo);
      return { mo, total: moInv.reduce((s,i) => s+(i.total||0), 0), count: moInv.length };
    });
    const maxVal = Math.max(...monthlyData.map(d => d.total), 1);

    // This month vs last month
    const thisMo = months[11];
    const lastMo = months[10];
    const thisMoRev = monthlyData[11].total;
    const lastMoRev = monthlyData[10].total;
    const growth    = lastMoRev > 0 ? Math.round((thisMoRev - lastMoRev) / lastMoRev * 100) : 0;

    el.innerHTML = `
    <!-- KPI cards -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:1rem;margin-bottom:2rem">
      ${[
        ['Total Collected',   this._fmtL(totalCollected),   '--green',  `${paid.length} invoices`],
        ['Outstanding',       this._fmtL(totalOutstanding),  '--amber',  `${outstanding.length} pending`],
        ['Draft / Unbilled',  this._fmtL(totalDraft),        '--purple', `${draft.length} drafts`],
        ['Collection Rate',   collectionRate + '%',           collectionRate>=80?'--green':collectionRate>=60?'--amber':'--red', 'paid ÷ sent'],
        ['MoM Growth',        (growth>=0?'+':'')+growth+'%', growth>=0?'--green':'--red', `vs last month`],
      ].map(([l,v,c,sub]) => `
        <div class="card" style="border-top:3px solid var(${c})">
          <div style="font-family:var(--font-display);font-size:1.625rem;font-weight:700;color:var(${c});line-height:1">${v}</div>
          <div style="font-weight:600;font-size:.875rem;margin-top:.375rem">${l}</div>
          <div style="font-size:.72rem;color:var(--text-muted);margin-top:.15rem">${sub}</div>
        </div>`).join('')}
    </div>

    <!-- Monthly revenue bar chart -->
    <div class="card" style="margin-bottom:1.5rem">
      <div class="section-header"><span class="section-title">Monthly Revenue — Last 12 Months</span></div>
      <div style="display:flex;align-items:flex-end;gap:6px;height:180px;padding:.5rem 0">
        ${monthlyData.map((d,i) => {
          const pct = Math.round(d.total / maxVal * 100);
          const isCurrentMonth = d.mo === thisMo;
          return `
          <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;height:100%">
            <div style="font-size:.65rem;color:var(--gold);font-weight:600;opacity:${d.total>0?1:0}">${this._fmtL(d.total)}</div>
            <div style="flex:1;width:100%;display:flex;align-items:flex-end">
              <div title="${this._monthLabel(d.mo)}: ${this._fmt(d.total)}"
                style="width:100%;background:${isCurrentMonth?'var(--gold)':'var(--steel)'};border-radius:4px 4px 0 0;
                  height:${Math.max(pct,2)}%;transition:height .4s ease;cursor:default;
                  opacity:${isCurrentMonth?1:.7}">
              </div>
            </div>
            <div style="font-size:.6rem;color:var(--text-muted);white-space:nowrap">${this._monthLabel(d.mo)}</div>
          </div>`;
        }).join('')}
      </div>
    </div>

    <!-- Invoice status breakdown -->
    <div class="grid-auto-2" style="gap:1.5rem">
      <div class="card">
        <div class="section-header"><span class="section-title">Invoice Status Breakdown</span></div>
        ${['paid','sent','overdue','draft','cancelled'].map(s => {
          const inv = this._invoices.filter(i => i.status === s);
          const amt = inv.reduce((sum,i) => sum+(i.total||0), 0);
          const pct = this._invoices.length ? Math.round(inv.length/this._invoices.length*100) : 0;
          const clr = {paid:'--green',sent:'--blue',overdue:'--red',draft:'--amber',cancelled:'--text-muted'}[s]||'--text-muted';
          return `
          <div style="display:flex;align-items:center;gap:.75rem;padding:.625rem 0;border-bottom:1px solid var(--border-light)">
            <span class="badge badge-${clr.replace('--','')}" style="min-width:70px;text-align:center;font-size:.72rem;text-transform:capitalize">${s}</span>
            <div style="flex:1">
              <div style="height:5px;background:var(--bg-elevated);border-radius:3px;overflow:hidden">
                <div style="height:100%;background:var(${clr});width:${pct}%"></div>
              </div>
            </div>
            <span style="font-size:.78rem;color:var(--text-secondary);min-width:30px;text-align:right">${inv.length}</span>
            <span style="font-size:.78rem;font-family:var(--font-mono);color:var(--text-primary);min-width:70px;text-align:right">${this._fmtL(amt)}</span>
          </div>`;
        }).join('')}
      </div>

      <div class="card">
        <div class="section-header"><span class="section-title">This Month vs Last Month</span></div>
        ${[
          ['Revenue', thisMoRev, lastMoRev, true],
          ['Invoices Created', monthlyData[11].count*100, monthlyData[10].count*100, false],
        ].map(([label, cur, prev, isMoney]) => {
          const diff = prev > 0 ? Math.round((cur-prev)/prev*100) : (cur>0?100:0);
          return `
          <div style="padding:.875rem 0;border-bottom:1px solid var(--border-light)">
            <div style="font-size:.8rem;color:var(--text-muted);margin-bottom:.375rem">${label}</div>
            <div style="display:flex;align-items:baseline;gap:.75rem">
              <span style="font-family:var(--font-display);font-size:1.25rem;font-weight:700;color:var(--text-primary)">${isMoney?this._fmtL(cur):Math.round(cur/100)}</span>
              <span style="font-size:.75rem;color:var(--text-muted)">vs ${isMoney?this._fmtL(prev):Math.round(prev/100)} last month</span>
              <span style="font-size:.78rem;font-weight:700;color:${diff>=0?'var(--green)':'var(--red)'}">
                ${diff>=0?'↑':'↓'}${Math.abs(diff)}%
              </span>
            </div>
          </div>`;
        }).join('')}
        <div style="margin-top:1rem;padding:.875rem;background:${collectionRate>=80?'var(--green-bg)':'var(--amber-bg)'};border-radius:var(--r-md)">
          <div style="font-size:.78rem;color:var(--text-muted);margin-bottom:.2rem">Collection Rate</div>
          <div style="font-size:1.5rem;font-weight:700;color:${collectionRate>=80?'var(--green)':'var(--amber)'}">${collectionRate}%</div>
          <div style="font-size:.72rem;color:var(--text-muted)">${collectionRate>=80?'Excellent recovery':'Room to improve'}</div>
        </div>
      </div>
    </div>`;
  },

  // ── TAB 2: Client Profitability ────────────────────────────
  _renderClients(el) {
    // Revenue per client
    const clientRevMap = {};
    this._invoices.filter(i => i.status === 'paid').forEach(i => {
      clientRevMap[i.clientId] = (clientRevMap[i.clientId]||0) + (i.total||0);
    });

    const clientData = this._clients.map(c => ({
      ...c,
      revenue:    clientRevMap[c.id] || 0,
      invoices:   this._invoices.filter(i => i.clientId === c.id).length,
      tasks:      this._tasks.filter(t => t.clientId === c.id).length,
      commsCount: 0, // Would need comms data
    })).sort((a,b) => b.revenue - a.revenue);

    const totalClients = this._clients.length;
    const activeClients = clientData.filter(c => c.revenue > 0).length;
    const topClient = clientData[0];

    el.innerHTML = `
    <!-- Summary -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:1rem;margin-bottom:1.5rem">
      ${[
        ['Total Clients',  totalClients, '--blue'],
        ['Revenue Generating', activeClients, '--green'],
        ['Zero Revenue', totalClients-activeClients, '--amber'],
        ['Avg Revenue/Client', this._fmtL(totalClients ? this._invoices.filter(i=>i.status==='paid').reduce((s,i)=>s+(i.total||0),0)/totalClients : 0), '--purple'],
      ].map(([l,v,c]) => `
        <div class="card" style="padding:.875rem;text-align:center">
          <div style="font-size:1.25rem;font-weight:700;color:var(${c})">${v}</div>
          <div style="font-size:.72rem;color:var(--text-muted);margin-top:.15rem">${l}</div>
        </div>`).join('')}
    </div>

    <!-- Client profitability table -->
    <div class="card" style="padding:0;overflow:hidden">
      <div style="padding:1rem 1.25rem;border-bottom:1px solid var(--border-light);display:flex;justify-content:space-between;align-items:center">
        <span style="font-weight:600">Client Revenue Ranking</span>
        <span style="font-size:.78rem;color:var(--text-muted)">Sorted by total revenue collected</span>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Client</th>
              <th>Type</th>
              <th style="text-align:right">Revenue Collected</th>
              <th style="text-align:center">Invoices</th>
              <th style="text-align:center">Tasks</th>
              <th>Revenue Share</th>
            </tr>
          </thead>
          <tbody>
            ${clientData.slice(0,20).map((c,i) => {
              const totalRev = this._invoices.filter(inv=>inv.status==='paid').reduce((s,inv)=>s+(inv.total||0),0);
              const share = totalRev > 0 ? Math.round(c.revenue/totalRev*100) : 0;
              return `
              <tr>
                <td style="font-weight:700;color:var(--text-muted);font-size:.8rem">${i+1}</td>
                <td>
                  <div style="display:flex;align-items:center;gap:.5rem">
                    <div class="avatar" style="width:26px;height:26px;font-size:.62rem;flex-shrink:0">${Fmt.initials(c.name)}</div>
                    <span style="font-weight:500;font-size:.875rem">${esc(c.name)}</span>
                  </div>
                </td>
                <td><span class="badge badge-muted" style="font-size:.68rem;text-transform:capitalize">${c.type||'individual'}</span></td>
                <td style="text-align:right;font-family:var(--font-mono);font-weight:600;color:${c.revenue>0?'var(--green)':'var(--text-muted)'}">${this._fmtL(c.revenue)}</td>
                <td style="text-align:center;color:var(--text-secondary)">${c.invoices}</td>
                <td style="text-align:center;color:var(--text-secondary)">${c.tasks}</td>
                <td style="min-width:120px">
                  <div style="display:flex;align-items:center;gap:.5rem">
                    <div style="flex:1;height:6px;background:var(--bg-elevated);border-radius:3px;overflow:hidden">
                      <div style="height:100%;background:var(--gold);width:${share}%"></div>
                    </div>
                    <span style="font-size:.72rem;color:var(--text-muted);min-width:30px">${share}%</span>
                  </div>
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
  },

  // ── TAB 3: Staff Productivity ──────────────────────────────
  _renderStaff(el) {
    // Group tasks by assignee
    const staffMap = {};
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    this._tasks.forEach(t => {
      const uid = t.assignedTo || 'unassigned';
      if (!staffMap[uid]) staffMap[uid] = { uid, name: t.assignedToName||uid, tasks:[], done:[], overdue:[], thisMonth:[] };
      staffMap[uid].tasks.push(t);
      if (t.status === 'done') staffMap[uid].done.push(t);
      const due = t.dueDate?.toDate?.();
      if (due && due < now && t.status !== 'done') staffMap[uid].overdue.push(t);
      const created = t.createdAt?.toDate?.();
      if (created && created >= monthStart) staffMap[uid].thisMonth.push(t);
    });

    const staffList = Object.values(staffMap).sort((a,b) => b.done.length - a.done.length);

    el.innerHTML = `
    <!-- Overall stats -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:1rem;margin-bottom:1.5rem">
      ${[
        ['Total Tasks',   this._tasks.length,                                                  '--blue'],
        ['Completed',     this._tasks.filter(t=>t.status==='done').length,                     '--green'],
        ['Active',        this._tasks.filter(t=>t.status!=='done').length,                     '--amber'],
        ['Overdue',       this._tasks.filter(t=>{if(t.status==='done')return false;const d=t.dueDate?.toDate?.();return d&&d<now;}).length, '--red'],
      ].map(([l,v,c]) => `
        <div class="card" style="padding:.875rem;text-align:center">
          <div style="font-size:1.375rem;font-weight:700;color:var(${c})">${v}</div>
          <div style="font-size:.72rem;color:var(--text-muted);margin-top:.15rem">${l}</div>
        </div>`).join('')}
    </div>

    <!-- Staff performance table -->
    <div class="card" style="padding:0;overflow:hidden;margin-bottom:1.5rem">
      <div style="padding:1rem 1.25rem;border-bottom:1px solid var(--border-light)">
        <span style="font-weight:600">Staff Task Performance</span>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Staff Member</th>
              <th style="text-align:center">Total Assigned</th>
              <th style="text-align:center">Completed</th>
              <th style="text-align:center">Overdue</th>
              <th style="text-align:center">This Month</th>
              <th style="text-align:center">Completion %</th>
              <th style="text-align:center">Rating</th>
            </tr>
          </thead>
          <tbody>
            ${staffList.map(s => {
              const rate = s.tasks.length ? Math.round(s.done.length/s.tasks.length*100) : 0;
              const rating = rate>=90?['Excellent','--green']:rate>=70?['Good','--blue']:rate>=50?['Average','--amber']:['Needs Work','--red'];
              return `
              <tr>
                <td>
                  <div style="display:flex;align-items:center;gap:.5rem">
                    <div class="avatar" style="width:26px;height:26px;font-size:.62rem;flex-shrink:0">${Fmt.initials(s.name)}</div>
                    <span style="font-weight:500;font-size:.875rem">${esc(s.name==='unassigned'?'Unassigned':s.name)}</span>
                  </div>
                </td>
                <td style="text-align:center;font-weight:600">${s.tasks.length}</td>
                <td style="text-align:center;color:var(--green);font-weight:600">${s.done.length}</td>
                <td style="text-align:center;color:${s.overdue.length?'var(--red)':'var(--text-muted)'};font-weight:${s.overdue.length?'700':'400'}">${s.overdue.length}</td>
                <td style="text-align:center;color:var(--blue)">${s.thisMonth.length}</td>
                <td style="text-align:center">
                  <div style="display:flex;align-items:center;gap:.5rem;justify-content:center">
                    <div style="width:50px;height:5px;background:var(--bg-elevated);border-radius:3px;overflow:hidden">
                      <div style="height:100%;background:var(${rating[1]});width:${rate}%"></div>
                    </div>
                    <span style="font-size:.78rem;font-weight:600;color:var(${rating[1]})">${rate}%</span>
                  </div>
                </td>
                <td style="text-align:center">
                  <span class="badge badge-${rating[1].replace('--','')}" style="font-size:.7rem">${rating[0]}</span>
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Task priority breakdown -->
    <div class="card">
      <div class="section-header"><span class="section-title">Tasks by Priority</span></div>
      <div style="display:flex;gap:1rem;flex-wrap:wrap">
        ${['urgent','high','medium','low'].map(p => {
          const count = this._tasks.filter(t=>t.priority===p).length;
          const done  = this._tasks.filter(t=>t.priority===p&&t.status==='done').length;
          const clr   = {urgent:'--red',high:'--amber',medium:'--blue',low:'--green'}[p];
          return `
          <div style="flex:1;min-width:120px;padding:1rem;background:var(--bg-elevated);border-radius:var(--r-md);border-top:3px solid var(${clr})">
            <div style="font-size:1.25rem;font-weight:700;color:var(${clr})">${count}</div>
            <div style="font-size:.78rem;font-weight:600;margin-top:.2rem;text-transform:capitalize">${p}</div>
            <div style="font-size:.7rem;color:var(--text-muted)">${done} done</div>
          </div>`;
        }).join('')}
      </div>
    </div>`;
  },

  // ── TAB 4: Seasonal Workload Forecast ─────────────────────
  _renderWorkload(el) {
    // Compute filing deadlines per month for the next 6 months
    const COMPLIANCE_DEADLINES = [
      {type:'GST',  day:11, label:'GSTR-1',        monthly:true},
      {type:'GST',  day:20, label:'GSTR-3B',       monthly:true},
      {type:'TDS',  day:7,  label:'TDS Deposit',   monthly:true},
      {type:'PF',   day:15, label:'PF/ESI',        monthly:true},
      {type:'ITR',  month:7, day:31, label:'ITR Filing'},
      {type:'ITR',  month:10,day:31, label:'ITR Audit'},
      {type:'TDS',  month:7, day:31, label:'TDS Q1 Return'},
      {type:'TDS',  month:10,day:31, label:'TDS Q2 Return'},
      {type:'TDS',  month:1, day:31, label:'TDS Q3 Return'},
      {type:'TDS',  month:5, day:31, label:'TDS Q4 Return'},
      {type:'ROC',  month:11,day:29, label:'MGT-7 ROC'},
      {type:'ROC',  month:10,day:29, label:'AOC-4 ROC'},
    ];

    const now = new Date();
    const months = [];
    for (let i = 0; i < 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      months.push({ key:`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`, date:d, month:d.getMonth()+1 });
    }

    // Monthly stats
    const monthStats = months.map(mo => {
      const deadlines = COMPLIANCE_DEADLINES.filter(dl =>
        dl.monthly || dl.month === mo.month
      );
      const clientCount = this._clients.length;
      const gstClients  = this._clients.filter(c => c.gstin || c.type !== 'individual').length;
      const companyClients = this._clients.filter(c => c.type === 'company' || c.type === 'llp').length;
      return {
        ...mo,
        deadlines: deadlines.length,
        filings: deadlines.filter(d=>d.type==='GST').length * gstClients +
                 deadlines.filter(d=>d.type==='ROC').length * companyClients +
                 deadlines.filter(d=>!['GST','ROC'].includes(d.type)).length * clientCount,
        label: mo.date.toLocaleDateString('en-IN', {month:'long', year:'numeric'}),
      };
    });
    const maxFilings = Math.max(...monthStats.map(m=>m.filings), 1);

    el.innerHTML = `
    <!-- 6-month forecast bars -->
    <div class="card" style="margin-bottom:1.5rem">
      <div class="section-header"><span class="section-title">Workload Forecast — Next 6 Months</span></div>
      <p style="font-size:.8rem;color:var(--text-muted);margin-bottom:1.25rem">Estimated filing count based on your current ${this._clients.length} clients</p>
      <div style="display:flex;gap:1rem;align-items:flex-end;height:180px">
        ${monthStats.map((mo,i) => {
          const pct = Math.round(mo.filings/maxFilings*100);
          const isCurrent = i===0;
          return `
          <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:.5rem;height:100%">
            <div style="font-size:.72rem;font-weight:700;color:${isCurrent?'var(--gold)':'var(--text-secondary)'};">${mo.filings}</div>
            <div style="flex:1;width:100%;display:flex;align-items:flex-end">
              <div style="width:100%;background:${isCurrent?'var(--gold)':'var(--steel)'};border-radius:6px 6px 0 0;
                height:${Math.max(pct,5)}%;opacity:${isCurrent?1:.7};transition:height .4s"></div>
            </div>
            <div style="text-align:center">
              <div style="font-size:.65rem;color:var(--text-muted);font-weight:${isCurrent?'700':'400'}">${mo.date.toLocaleDateString('en-IN',{month:'short'})}</div>
              <div style="font-size:.6rem;color:var(--text-muted)">${mo.deadlines} deadlines</div>
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>

    <!-- Deadline breakdown per month -->
    <div class="card">
      <div class="section-header"><span class="section-title">Deadline Breakdown</span></div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Month</th><th>GST Deadlines</th><th>TDS Deadlines</th><th>ROC Deadlines</th><th>Other</th><th>Total Filings Est.</th><th>Intensity</th></tr></thead>
          <tbody>
            ${monthStats.map(mo => {
              const gst   = COMPLIANCE_DEADLINES.filter(d=>d.type==='GST'&&(d.monthly||d.month===mo.month)).length;
              const tds   = COMPLIANCE_DEADLINES.filter(d=>d.type==='TDS'&&(d.monthly||d.month===mo.month)).length;
              const roc   = COMPLIANCE_DEADLINES.filter(d=>d.type==='ROC'&&(d.month===mo.month)).length;
              const other = COMPLIANCE_DEADLINES.filter(d=>!['GST','TDS','ROC'].includes(d.type)&&(d.monthly||d.month===mo.month)).length;
              const intensity = mo.filings > maxFilings*.75 ? ['High','--red'] : mo.filings > maxFilings*.4 ? ['Medium','--amber'] : ['Low','--green'];
              return `
              <tr>
                <td style="font-weight:${mo.date.getMonth()===now.getMonth()?'700':'400'};color:${mo.date.getMonth()===now.getMonth()?'var(--gold)':'inherit'}">${mo.label}</td>
                <td style="text-align:center;color:var(--amber)">${gst}</td>
                <td style="text-align:center;color:var(--purple)">${tds}</td>
                <td style="text-align:center;color:var(--green)">${roc}</td>
                <td style="text-align:center;color:var(--text-muted)">${other}</td>
                <td style="text-align:center;font-weight:600">${mo.filings}</td>
                <td style="text-align:center"><span class="badge badge-${intensity[1].replace('--','')}" style="font-size:.7rem">${intensity[0]}</span></td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
  },

  // ── TAB 5: Reports Analytics ───────────────────────────────
  _renderReports(el) {
    const completed = this._purchases.filter(p => p.status === 'completed');
    const totalEarned = completed.reduce((s,p) => s+(p.caEarning||250), 0);
    const months = this._last12Months();

    // By type
    const byType = {};
    completed.forEach(p => { byType[p.reportId] = (byType[p.reportId]||0)+1; });
    const topTypes = Object.entries(byType).sort((a,b)=>b[1]-a[1]).slice(0,8);

    // Monthly trend
    const monthlyEarnings = months.map(mo => ({
      mo,
      earned: completed.filter(p=>this._monthKey(p.createdAt)===mo).reduce((s,p)=>s+(p.caEarning||250),0),
      count:  completed.filter(p=>this._monthKey(p.createdAt)===mo).length,
    }));
    const maxEarned = Math.max(...monthlyEarnings.map(m=>m.earned), 1);

    el.innerHTML = `
    <!-- Report KPIs -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:1rem;margin-bottom:1.5rem">
      ${[
        ['Total Earned',    this._fmtL(totalEarned),       '--gold'],
        ['Reports Sold',    completed.length,               '--green'],
        ['Pending',         this._purchases.filter(p=>p.status!=='completed').length, '--amber'],
        ['Avg Per Report',  completed.length ? this._fmtL(Math.round(totalEarned/completed.length)*100) : '₹0', '--blue'],
      ].map(([l,v,c]) => `
        <div class="card" style="padding:.875rem;text-align:center;border-top:3px solid var(${c})">
          <div style="font-family:var(--font-display);font-size:1.5rem;font-weight:700;color:var(${c})">${v}</div>
          <div style="font-size:.75rem;font-weight:600;margin-top:.375rem">${l}</div>
        </div>`).join('')}
    </div>

    ${completed.length === 0 ? `
    <div class="card" style="background:rgba(201,168,76,.04);border-color:rgba(201,168,76,.15)">
      <div style="display:flex;gap:1rem;align-items:flex-start">
        <div style="font-size:1.75rem;flex-shrink:0">💡</div>
        <div>
          <div style="font-weight:600;color:var(--gold);margin-bottom:.375rem">No reports sold yet</div>
          <p style="font-size:.8125rem;color:var(--text-secondary);line-height:1.7">
            Share your client store link from the Reports Store page. Once clients start purchasing, their earnings will appear here.
          </p>
        </div>
      </div>
    </div>` : `
    <div class="grid-auto-2" style="gap:1.5rem">
      <!-- Monthly earnings chart -->
      <div class="card">
        <div class="section-header"><span class="section-title">Monthly Earnings Trend</span></div>
        <div style="display:flex;align-items:flex-end;gap:4px;height:140px;padding:.25rem 0">
          ${monthlyEarnings.slice(-6).map(d => {
            const pct = Math.round(d.earned/maxEarned*100);
            return `
            <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;height:100%">
              <div style="font-size:.6rem;color:var(--gold);opacity:${d.earned>0?1:0}">${this._fmtL(d.earned)}</div>
              <div style="flex:1;width:100%;display:flex;align-items:flex-end">
                <div style="width:100%;background:var(--gold);border-radius:3px 3px 0 0;height:${Math.max(pct,3)}%;opacity:.8"></div>
              </div>
              <div style="font-size:.58rem;color:var(--text-muted)">${this._monthLabel(d.mo)}</div>
            </div>`;
          }).join('')}
        </div>
      </div>

      <!-- Top report types -->
      <div class="card">
        <div class="section-header"><span class="section-title">Top Selling Reports</span></div>
        ${topTypes.map(([id, count], i) => {
          const report = FS.REPORT_CATALOG?.find(r=>r.id===id);
          const name   = report?.name || id;
          const earned = count * 250;
          return `
          <div style="display:flex;align-items:center;gap:.75rem;padding:.5rem 0;border-bottom:1px solid var(--border-light)">
            <div style="width:20px;text-align:center;font-size:.75rem;font-weight:700;color:var(--gold)">${i+1}</div>
            <div style="flex:1;min-width:0;font-size:.8rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(name)}</div>
            <div style="font-size:.78rem;color:var(--text-secondary)">${count}×</div>
            <div style="font-size:.78rem;font-weight:600;color:var(--green)">₹${earned.toLocaleString('en-IN')}</div>
          </div>`;
        }).join('')}
      </div>
    </div>`}`;
  },

  // ── TAB 6: Year on Year ────────────────────────────────────
  _renderYoY(el) {
    const now    = new Date();
    const thisYr = now.getFullYear();
    const lastYr = thisYr - 1;

    const revenue = (year) => {
      return this._invoices
        .filter(i => i.status==='paid' && i.createdAt?.toDate?.()?.getFullYear?.() === year)
        .reduce((s,i) => s+(i.total||0), 0);
    };

    const clientsAdded = (year) => {
      return this._clients.filter(c => c.createdAt?.toDate?.()?.getFullYear?.() === year).length;
    };

    const tasksDone = (year) => {
      return this._tasks.filter(t => t.status==='done' && t.completedAt?.toDate?.()?.getFullYear?.() === year).length;
    };

    const reportsSold = (year) => {
      return this._purchases.filter(p => p.status==='completed' && p.createdAt?.toDate?.()?.getFullYear?.() === year).length;
    };

    const metrics = [
      { label:'Revenue Collected', thisYr: revenue(thisYr), lastYr: revenue(lastYr), format: v => this._fmtL(v), color:'--green' },
      { label:'Clients Added',     thisYr: clientsAdded(thisYr), lastYr: clientsAdded(lastYr), format: v => v, color:'--blue' },
      { label:'Tasks Completed',   thisYr: tasksDone(thisYr), lastYr: tasksDone(lastYr), format: v => v, color:'--purple' },
      { label:'Reports Sold',      thisYr: reportsSold(thisYr), lastYr: reportsSold(lastYr), format: v => v, color:'--gold' },
      { label:'Total Clients',     thisYr: this._clients.length, lastYr: null, format: v => v, color:'--blue', noCompare: true },
    ];

    el.innerHTML = `
    <div class="card" style="margin-bottom:1.5rem">
      <div class="section-header">
        <span class="section-title">Year on Year Comparison</span>
        <div style="display:flex;gap:1rem;font-size:.75rem">
          <span style="color:var(--gold);font-weight:600">${thisYr} (current)</span>
          <span style="color:var(--text-muted)">${lastYr} (last year)</span>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:.875rem">
        ${metrics.map(m => {
          const growth = m.noCompare || !m.lastYr ? null :
            m.lastYr > 0 ? Math.round((m.thisYr-m.lastYr)/m.lastYr*100) : (m.thisYr>0?100:0);
          return `
          <div style="padding:1rem;background:var(--bg-elevated);border-radius:var(--r-md);border-left:3px solid var(${m.color})">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:.75rem">
              <div style="font-size:.8125rem;font-weight:600;color:var(--text-secondary)">${m.label}</div>
              <div style="display:flex;gap:2rem;align-items:baseline">
                ${m.lastYr !== null && !m.noCompare ? `
                <div style="text-align:center">
                  <div style="font-size:.65rem;color:var(--text-muted);margin-bottom:.15rem">${lastYr}</div>
                  <div style="font-size:1rem;font-weight:600;color:var(--text-secondary)">${m.format(m.lastYr)}</div>
                </div>` : ''}
                <div style="text-align:center">
                  <div style="font-size:.65rem;color:var(--text-muted);margin-bottom:.15rem">${thisYr}</div>
                  <div style="font-family:var(--font-display);font-size:1.375rem;font-weight:700;color:var(${m.color})">${m.format(m.thisYr)}</div>
                </div>
                ${growth !== null ? `
                <div style="padding:.3rem .75rem;border-radius:20px;background:${growth>=0?'var(--green-bg)':'var(--red-bg)'};color:${growth>=0?'var(--green)':'var(--red)'};font-size:.8rem;font-weight:700">
                  ${growth>=0?'↑':'↓'}${Math.abs(growth)}%
                </div>` : ''}
              </div>
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>

    <div class="card" style="background:rgba(201,168,76,.04);border-color:rgba(201,168,76,.15)">
      <div style="display:flex;gap:.875rem;align-items:flex-start">
        <div style="font-size:1.375rem;flex-shrink:0">📈</div>
        <div>
          <div style="font-weight:600;color:var(--gold);margin-bottom:.375rem">Growth Insight</div>
          <p style="font-size:.8125rem;color:var(--text-secondary);line-height:1.7">
            Data updates in real-time as you add invoices, clients, and tasks. The YoY comparison uses the calendar year (January–December). For financial year analysis, use the compliance trackers.
          </p>
        </div>
      </div>
    </div>`;
  },

  // ── Export all analytics as CSV ────────────────────────────
  _exportAll() {
    const months = this._last12Months();
    const rows   = [['Month','Revenue Collected','Invoices Paid','New Clients','Tasks Done','Reports Sold']];

    months.forEach(mo => {
      const [y,m] = mo.split('-').map(Number);
      const start = new Date(y,m-1,1), end = new Date(y,m,0,23,59,59);
      const inRange = (ts) => { const d=ts?.toDate?.(); return d&&d>=start&&d<=end; };
      rows.push([
        this._monthLabel(mo),
        ((this._invoices.filter(i=>i.status==='paid'&&inRange(i.createdAt)).reduce((s,i)=>s+(i.total||0),0))/100).toFixed(0),
        this._invoices.filter(i=>i.status==='paid'&&inRange(i.createdAt)).length,
        this._clients.filter(c=>inRange(c.createdAt)).length,
        this._tasks.filter(t=>t.status==='done'&&inRange(t.completedAt)).length,
        this._purchases.filter(p=>p.status==='completed'&&inRange(p.createdAt)).length,
      ]);
    });

    const csv  = rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF'+csv], {type:'text/csv;charset=utf-8'});
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `Filio_Analytics_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    Toast.success('Analytics exported as CSV');
  },
};
