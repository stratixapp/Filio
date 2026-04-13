// Compliance hub page - overview of all 4 trackers for the current month/period
// Acts as a landing page for the Compliance section

const ComplianceHub = {
  _firm: null,
  mount(firm) {
    this._firm = firm;
    const cnt = Layout.getContentEl(); if (!cnt) return;
    cnt.innerHTML = `
    <div style="margin-bottom:2rem">
      <h2 style="font-size:1.5rem;font-weight:600">Compliance Hub</h2>
      <p style="color:var(--text-muted);font-size:.875rem;margin-top:.25rem">
        All compliance trackers — GST, ITR, TDS, ROC — in one place
      </p>
    </div>

    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:1.25rem">
      ${[
        { path:'/gst-tracker', icon:'📊', title:'GST Tracker', color:'#E67E22', desc:'GSTR-1, GSTR-3B, GSTR-9 — monthly filing status for all clients', badge:'Monthly' },
        { path:'/itr-tracker', icon:'📋', title:'ITR Tracker',  color:'#2980B9', desc:'AY-wise ITR filing, refund status, pending documents per client', badge:'Annual' },
        { path:'/tds-tracker', icon:'💼', title:'TDS Tracker',  color:'#8E44AD', desc:'24Q, 26Q, 27Q quarterly returns, challan payment, Form 16 status', badge:'Quarterly' },
        { path:'/roc-tracker', icon:'🏢', title:'ROC Tracker',  color:'#27AE60', desc:'MGT-7, AOC-4, DIR-3 KYC, ADT-1 for company and LLP clients', badge:'Annual' },
      ].map(t=>`
        <a href="#${t.path}" style="text-decoration:none">
          <div class="card" style="border-left:3px solid ${t.color};cursor:pointer;transition:all .2s" 
            onmouseenter="this.style.transform='translateY(-2px)';this.style.boxShadow='var(--shadow-md)'"
            onmouseleave="this.style.transform='';this.style.boxShadow=''">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:.75rem">
              <div style="font-size:1.75rem">${t.icon}</div>
              <span style="font-size:.7rem;font-weight:600;padding:.2rem .6rem;border-radius:20px;background:${t.color}22;color:${t.color}">${t.badge}</span>
            </div>
            <div style="font-weight:700;font-size:1rem;margin-bottom:.375rem;color:var(--text-primary)">${t.title}</div>
            <div style="font-size:.8125rem;color:var(--text-muted);line-height:1.6">${t.desc}</div>
            <div style="margin-top:1rem;font-size:.8rem;color:${t.color};font-weight:600;display:flex;align-items:center;gap:.25rem">
              Open tracker
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
            </div>
          </div>
        </a>`).join('')}
    </div>

    <!-- Quick compliance tip -->
    <div class="card" style="margin-top:1.5rem;background:rgba(201,168,76,.04);border-color:rgba(201,168,76,.15)">
      <div style="display:flex;gap:1rem;align-items:flex-start">
        <div style="font-size:1.5rem;flex-shrink:0">💡</div>
        <div>
          <div style="font-weight:600;margin-bottom:.375rem;color:var(--gold)">Phase 2 Tip</div>
          <p style="font-size:.875rem;color:var(--text-secondary);line-height:1.7">
            Each tracker stores data per client per period. On the 15th of every month, open the GST Tracker to see exactly which clients have GSTR-3B pending — instead of calling all 100+ clients. One screen, color-coded, zero guessing.
          </p>
        </div>
      </div>
    </div>`;
  },
  unmount() {},
};
