// js/pages/reports-marketplace.js — Phase 5: Reports Marketplace (CA Side)
// CA views all purchased reports, earnings dashboard, manages report store

const ReportsMarketplace = {
  _firm: null, _user: null,
  _purchases: [], _clients: [],
  _unsub: null, _unsubClients: null,
  _tab: 'earnings',   // earnings | purchases | catalog

  mount(user, firm) {
    this._user = user; this._firm = firm;
    this._purchases = []; this._clients = [];
    this._render();
    this._unsub = FS.subscribeReportPurchases(firm.id, d => {
      this._purchases = d; this._renderTab();
    });
    this._unsubClients = FS.subscribeClients(firm.id, d => { this._clients = d; });
  },

  unmount() {
    if (this._unsub)        { this._unsub();        this._unsub = null; }
    if (this._unsubClients) { this._unsubClients(); this._unsubClients = null; }
  },

  _render() {
    const cnt = Layout.getContentEl(); if (!cnt) return;
    cnt.innerHTML = `
    <div style="margin-bottom:1.5rem;display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:1rem">
      <div>
        <h2 style="font-size:1.5rem;font-weight:600">Reports Marketplace</h2>
        <p style="color:var(--text-muted);font-size:.875rem;margin-top:.2rem">
          Clients buy AI-generated reports for ₹399 — you earn ₹250 per report
        </p>
      </div>
      <button class="btn btn-secondary btn-sm" onclick="ReportsMarketplace._copyStoreLink()">
        ${Icons.link} Copy Client Store Link
      </button>
    </div>

    <div class="tabs" style="margin-bottom:1.5rem">
      ${[['earnings','💰 Earnings'],['purchases','📋 Purchases'],['catalog','📊 Report Catalog']].map(([v,l])=>`
        <button class="tab${v===this._tab?' active':''}" onclick="ReportsMarketplace._setTab('${v}',this)">${l}</button>`).join('')}
    </div>

    <div id="rm-tab-content">
      <div style="display:flex;justify-content:center;padding:3rem"><div class="spinner spinner-lg"></div></div>
    </div>`;
  },

  _setTab(tab, btn) {
    this._tab = tab;
    document.querySelectorAll('.tabs .tab').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    this._renderTab();
  },

  _renderTab() {
    const el = document.getElementById('rm-tab-content');
    if (!el) return;
    if      (this._tab === 'earnings')  this._renderEarnings(el);
    else if (this._tab === 'purchases') this._renderPurchases(el);
    else if (this._tab === 'catalog')   this._renderCatalog(el);
  },

  _renderEarnings(el) {
    const now = new Date();
    const months = Array.from({length:3}, (_,i) => {
      const d = new Date(now.getFullYear(), now.getMonth()-i, 1);
      return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    });

    // Compute from purchases
    const thisMonth = months[0];
    const [y,m] = thisMonth.split('-').map(Number);
    const monthStart = new Date(y, m-1, 1);
    const completed = this._purchases.filter(p => p.status === 'completed');
    const thisMonthP = completed.filter(p => {
      const d = p.createdAt?.toDate?.(); return d && d >= monthStart;
    });
    const allTimeEarned  = completed.reduce((s,p) => s+(p.caEarning||250), 0);
    const thisMonthEarned= thisMonthP.reduce((s,p) => s+(p.caEarning||250), 0);
    const pending        = this._purchases.filter(p => p.status !== 'completed').length;

    // Top report types
    const typeCounts = {};
    completed.forEach(p => { typeCounts[p.reportId] = (typeCounts[p.reportId]||0)+1; });
    const topReports = Object.entries(typeCounts)
      .sort((a,b) => b[1]-a[1]).slice(0,5)
      .map(([id, count]) => {
        const r = FS.REPORT_CATALOG.find(x => x.id === id);
        return { name: r?.name || id, count };
      });

    el.innerHTML = `
    <!-- Earning summary cards -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:1rem;margin-bottom:2rem">
      ${[
        ['This Month',   `₹${thisMonthEarned.toLocaleString('en-IN')}`, '--gold',   `${thisMonthP.length} reports`],
        ['All-Time',     `₹${allTimeEarned.toLocaleString('en-IN')}`,   '--green',  `${completed.length} reports sold`],
        ['Pending',      pending,                                         '--amber',  'Awaiting generation'],
        ['Platform Rate', '₹149/report',                                 '--purple', 'Filio takes ₹149, you keep ₹250'],
      ].map(([l,v,c,sub])=>`
        <div class="card" style="border-top:3px solid var(${c})">
          <div style="font-size:1.5rem;font-weight:700;color:var(${c});font-family:var(--font-display);line-height:1">${v}</div>
          <div style="font-size:.875rem;font-weight:600;color:var(--text-primary);margin-top:.375rem">${l}</div>
          <div style="font-size:.75rem;color:var(--text-muted);margin-top:.2rem">${sub}</div>
        </div>`).join('')}
    </div>

    <!-- Month-by-month -->
    <div class="card" style="margin-bottom:1.5rem">
      <div class="section-header"><span class="section-title">Monthly Earnings</span></div>
      ${months.map(mo => {
        const [y,m] = mo.split('-').map(Number);
        const start = new Date(y,m-1,1);
        const end   = new Date(y,m,0,23,59,59);
        const moP   = completed.filter(p => { const d=p.createdAt?.toDate?.(); return d&&d>=start&&d<=end; });
        const earned= moP.reduce((s,p)=>s+(p.caEarning||250),0);
        const label = new Date(y,m-1,1).toLocaleDateString('en-IN',{month:'long',year:'numeric'});
        const maxEarned = 5000;
        const pct = Math.min(100, Math.round(earned/maxEarned*100));
        return `
        <div style="display:flex;align-items:center;gap:1rem;padding:.75rem 0;border-bottom:1px solid var(--border-light)">
          <div style="min-width:110px;font-size:.8125rem;color:var(--text-secondary)">${label}</div>
          <div style="flex:1;height:8px;background:var(--bg-elevated);border-radius:4px;overflow:hidden">
            <div style="height:100%;background:var(--gold);border-radius:4px;width:${pct}%;transition:width .5s ease"></div>
          </div>
          <div style="min-width:80px;text-align:right">
            <div style="font-weight:700;color:var(--gold);font-family:var(--font-display)">₹${earned.toLocaleString('en-IN')}</div>
            <div style="font-size:.7rem;color:var(--text-muted)">${moP.length} reports</div>
          </div>
        </div>`;
      }).join('')}
    </div>

    <!-- Top selling reports -->
    ${topReports.length ? `
    <div class="card">
      <div class="section-header"><span class="section-title">Top Selling Reports</span></div>
      ${topReports.map((r,i) => `
        <div style="display:flex;align-items:center;gap:1rem;padding:.625rem 0;border-bottom:1px solid var(--border-light)">
          <div style="width:24px;height:24px;border-radius:50%;background:rgba(201,168,76,.12);display:flex;align-items:center;justify-content:center;font-size:.75rem;font-weight:700;color:var(--gold);flex-shrink:0">${i+1}</div>
          <div style="flex:1;font-size:.875rem">${esc(r.name)}</div>
          <div style="font-weight:600;color:var(--gold)">${r.count}×</div>
          <div style="font-size:.8rem;color:var(--green)">₹${(r.count*250).toLocaleString('en-IN')}</div>
        </div>`).join('')}
    </div>` : `
    <div class="card" style="background:rgba(201,168,76,.04);border-color:rgba(201,168,76,.15)">
      <div style="display:flex;gap:1rem;align-items:flex-start">
        <div style="font-size:1.75rem">💡</div>
        <div>
          <div style="font-weight:600;color:var(--gold);margin-bottom:.375rem">How to start earning</div>
          <p style="font-size:.8125rem;color:var(--text-secondary);line-height:1.7">
            Share the client store link with your clients via WhatsApp. They purchase reports for ₹399, you automatically earn ₹250 per report. The more clients, the more passive income.
          </p>
          <button class="btn btn-primary btn-sm" style="margin-top:.875rem" onclick="ReportsMarketplace._copyStoreLink()">
            ${Icons.link} Copy Client Store Link
          </button>
        </div>
      </div>
    </div>`}`;
  },

  _renderPurchases(el) {
    if (!this._purchases.length) {
      el.innerHTML = `<div class="card"><div class="empty-state">
        <div style="font-size:3rem;margin-bottom:.5rem">📊</div>
        <h4>No reports purchased yet</h4>
        <p>Share your client store link to start earning</p>
        <button class="btn btn-primary btn-sm" style="margin-top:.75rem" onclick="ReportsMarketplace._copyStoreLink()">${Icons.link} Copy Store Link</button>
      </div></div>`;
      return;
    }

    const STATUS_COLOR = { completed:'--green', pending_generation:'--amber', failed:'--red', refunded:'--red' };
    const STATUS_LABEL = { completed:'Completed', pending_generation:'Generating…', failed:'Failed', refunded:'Refunded' };

    el.innerHTML = `
    <div class="card" style="padding:0;overflow:hidden">
      <div class="table-wrap">
        <table>
          <thead>
            <tr><th>Report</th><th>Client</th><th>Date</th><th>Price</th><th>Your Earning</th><th>Status</th><th>Action</th></tr>
          </thead>
          <tbody>
            ${this._purchases.map(p => `
            <tr>
              <td style="font-weight:500;font-size:.875rem">${esc(FS.REPORT_CATALOG.find(r=>r.id===p.reportId)?.name || p.reportId)}</td>
              <td style="color:var(--text-secondary)">${esc(p.clientName||'—')}</td>
              <td style="color:var(--text-muted);font-size:.85rem">${Fmt.date(p.createdAt)}</td>
              <td style="font-family:var(--font-mono)">₹${(p.price||399).toLocaleString('en-IN')}</td>
              <td style="font-weight:700;color:var(--green)">₹${(p.caEarning||250).toLocaleString('en-IN')}</td>
              <td><span class="badge badge-${(STATUS_COLOR[p.status]||'--blue').replace('--','')}" style="font-size:.72rem">${STATUS_LABEL[p.status]||p.status}</span></td>
              <td>
                ${p.status==='completed' && p.reportContent
                  ? `<button class="btn btn-ghost btn-sm" style="font-size:.75rem" data-action="view" data-id="${p.id}">View</button>`
                  : p.status==='pending_generation'
                  ? `<button class="btn btn-ghost btn-sm" style="font-size:.75rem;color:var(--gold)" data-action="generate" data-id="${p.id}">Generate</button>`
                  : '—'}
              </td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
  },

  _renderCatalog(el) {
    const categories = [
      { id:'tax',        label:'Tax Reports',        icon:'📋', color:'#2980B9' },
      { id:'gst',        label:'GST Reports',        icon:'🧾', color:'#E67E22' },
      { id:'business',   label:'Business Reports',   icon:'📈', color:'#27AE60' },
      { id:'compliance', label:'Compliance Reports', icon:'✅', color:'#8E44AD' },
    ];

    el.innerHTML = `
    <div style="margin-bottom:1.25rem;padding:1rem 1.25rem;background:rgba(201,168,76,.06);border:1px solid rgba(201,168,76,.15);border-radius:var(--r-md)">
      <div style="display:flex;gap:.875rem;align-items:flex-start">
        <div style="font-size:1.25rem;flex-shrink:0">💡</div>
        <div style="font-size:.8125rem;color:var(--text-secondary);line-height:1.7">
          <strong style="color:var(--gold)">How it works:</strong> Clients visit the store link and buy reports for ₹399. AI generates each report using data you've entered in Filio. The report downloads as a branded PDF instantly.
          You earn <strong style="color:var(--green)">₹250 per report</strong>. Filio takes ₹149 as platform fee.
        </div>
      </div>
    </div>

    ${categories.map(cat => {
      const reports = FS.REPORT_CATALOG.filter(r => r.category === cat.id);
      return `
      <div class="card" style="margin-bottom:1.25rem;border-left:3px solid ${cat.color}">
        <div style="display:flex;align-items:center;gap:.75rem;margin-bottom:1rem">
          <span style="font-size:1.375rem">${cat.icon}</span>
          <span style="font-weight:700;font-size:1rem">${cat.label}</span>
          <span class="badge badge-muted" style="margin-left:auto;font-size:.72rem">${reports.length} reports</span>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:.75rem">
          ${reports.map(r => `
          <div style="padding:.875rem;background:var(--bg-elevated);border-radius:var(--r-md);border:1px solid var(--border-light)">
            <div style="font-weight:600;font-size:.875rem;margin-bottom:.375rem">${esc(r.name)}</div>
            <div style="font-size:.78rem;color:var(--text-muted);line-height:1.6;margin-bottom:.75rem">${esc(r.desc)}</div>
            <div style="display:flex;align-items:center;justify-content:space-between">
              <div>
                <span style="font-family:var(--font-display);font-size:1.1rem;font-weight:700;color:var(--gold)">₹399</span>
                <span style="font-size:.7rem;color:var(--green);margin-left:.5rem">You earn ₹250</span>
              </div>
            </div>
          </div>`).join('')}
        </div>
      </div>`;
    }).join('')}`;
  },

  _copyStoreLink() {
    const base = window.location.href.split('#')[0];
    const link = `${base}#/reports-store?firm=${this._firm.id}`;
    copyText(link, 'Client store link copied! Share with your clients.');
  },

  async _generateReport(purchaseId) {
    const p = this._purchases.find(x => x.id === purchaseId);
    if (!p) return;
    Toast.info('Generating report via AI…');
    try {
      await ReportGenerator.generate(this._firm, p, purchaseId);
    } catch(e) {
      Toast.error('Generation failed: ' + e.message);
      ErrorMonitor.capture(e, { context: 'reports-marketplace.js' });
    }
  },

  _viewReport(purchaseId) {
    const p = this._purchases.find(x => x.id === purchaseId);
    if (!p?.reportContent) return;
    ReportPDF.open(p, this._firm);
  },
};
