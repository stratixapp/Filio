// js/pages/reports-store.js — Phase 5: Client-Facing Report Store
// Public page — clients visit via link, browse reports, pay ₹399, download PDF
// Uses Claude API for AI generation + Razorpay for payment

const ReportsStore = {
  _firmId: null,
  _firm: null,
  _clientId: null,
  _clientName: null,
  _selectedReport: null,
  _paying: false,

  mount(user, firm) {
    // Parse URL params
    const hash   = window.location.hash;
    const params = new URLSearchParams(hash.includes('?') ? hash.split('?')[1] : '');
    this._firmId   = params.get('firm') || (firm?.id) || null;
    this._clientId = params.get('client') || null;
    this._render();
    this._loadFirm();
  },

  unmount() {},

  async _loadFirm() {
    if (!this._firmId) { this._showError('Invalid store link'); return; }
    try {
      const snap = await db.collection('firms').doc(this._firmId).get();
      if (!snap.exists) { this._showError('Store not found'); return; }
      this._firm = { id: snap.id, ...snap.data() };
      this._renderStore();
    } catch(e) { this._showError('Failed to load store'); }
  },

  _render() {
    const cnt = Layout.getContentEl(); if (!cnt) return;
    cnt.innerHTML = `
    <div style="min-height:100vh;background:var(--bg)">
      <div id="store-content" style="max-width:900px;margin:0 auto;padding:2rem 1rem">
        <div style="display:flex;justify-content:center;padding:4rem"><div class="spinner spinner-lg"></div></div>
      </div>
    </div>`;
  },

  _showError(msg) {
    const el = document.getElementById('store-content');
    if (el) el.innerHTML = `<div class="card" style="text-align:center;padding:3rem;margin-top:2rem">
      <div style="font-size:2rem;margin-bottom:.75rem">⚠️</div>
      <p style="color:var(--text-secondary)">${esc(msg)}</p>
    </div>`;
  },

  _renderStore() {
    const el = document.getElementById('store-content');
    if (!el) return;
    const categories = [
      { id:'tax',        label:'Tax Reports',        icon:'📋', color:'#2980B9' },
      { id:'gst',        label:'GST Reports',        icon:'🧾', color:'#E67E22' },
      { id:'business',   label:'Business Reports',   icon:'📈', color:'#27AE60' },
      { id:'compliance', label:'Compliance Reports', icon:'✅', color:'#8E44AD' },
    ];

    el.innerHTML = `
    <!-- Store header -->
    <div style="text-align:center;padding:2rem 0 2.5rem">
      <div style="display:inline-flex;align-items:center;gap:.625rem;margin-bottom:1.25rem">
        <div style="width:36px;height:36px;background:rgba(201,168,76,.1);border:1px solid rgba(201,168,76,.2);border-radius:10px;display:flex;align-items:center;justify-content:center">
          <svg width="16" height="16" viewBox="0 0 40 40" fill="none"><path d="M10 20 L20 10 L30 20 L20 30 Z" fill="#C9A84C"/><circle cx="20" cy="20" r="4" fill="#C9A84C"/></svg>
        </div>
        <div style="text-align:left">
          <div style="font-size:1.1rem;font-weight:700;color:var(--gold)">${esc(this._firm?.name||'CA Firm')}</div>
          <div style="font-size:.65rem;color:var(--text-muted);letter-spacing:.1em;text-transform:uppercase">Reports Marketplace</div>
        </div>
      </div>
      <h2 style="font-size:1.75rem;font-weight:700;margin-bottom:.5rem">Financial Reports Store</h2>
      <p style="color:var(--text-muted);font-size:.9rem;max-width:500px;margin:0 auto">
        AI-generated financial reports tailored to your data. Purchase, generate, and download instantly.
      </p>
      <div style="display:inline-flex;align-items:center;gap:.5rem;margin-top:1rem;padding:.4rem 1rem;background:rgba(56,161,105,.08);border:1px solid rgba(56,161,105,.2);border-radius:20px">
        <span style="color:var(--green);font-size:.8rem;font-weight:600">✓ Instant PDF download after payment</span>
      </div>
    </div>

    <!-- Client name input -->
    <div class="card" style="margin-bottom:2rem;display:flex;gap:1rem;align-items:flex-end;flex-wrap:wrap">
      <div class="input-group" style="flex:1;min-width:200px;margin:0">
        <label class="input-label">Your Name (appears on report)</label>
        <input class="input" id="store-client-name" placeholder="Your full name or business name"
          value="${esc(this._clientName||'')}" oninput="ReportsStore._clientName=this.value" />
      </div>
      <p style="font-size:.78rem;color:var(--text-muted);max-width:260px">
        Enter your name before purchasing. It will be printed on your report.
      </p>
    </div>

    <!-- Report categories -->
    ${categories.map(cat => {
      const reports = FS.REPORT_CATALOG.filter(r => r.category === cat.id);
      return `
      <div style="margin-bottom:2rem">
        <div style="display:flex;align-items:center;gap:.625rem;margin-bottom:1rem;padding-bottom:.75rem;border-bottom:1px solid var(--border-light)">
          <span style="font-size:1.25rem">${cat.icon}</span>
          <h3 style="font-size:1.1rem;font-weight:700">${cat.label}</h3>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:.875rem">
          ${reports.map(r => `
          <div class="card" style="padding:1rem;cursor:pointer;transition:all .15s;border:1px solid var(--border-light)"
            onmouseenter="this.style.borderColor='${cat.color}';this.style.transform='translateY(-2px)'"
            onmouseleave="this.style.borderColor='';this.style.transform=''">
            <div style="font-size:1rem;font-weight:700;margin-bottom:.375rem;color:var(--text-primary)">${esc(r.name)}</div>
            <div style="font-size:.78rem;color:var(--text-muted);line-height:1.6;margin-bottom:.875rem;min-height:48px">${esc(r.desc)}</div>
            <div style="display:flex;align-items:center;justify-content:space-between">
              <div>
                <span style="font-family:var(--font-display);font-size:1.25rem;font-weight:700;color:var(--gold)">₹${r.price}</span>
                <span style="font-size:.7rem;color:var(--text-muted);margin-left:.375rem">+ GST</span>
              </div>
              <button class="btn btn-primary btn-sm" data-action="buy" data-id="${r.id}"
                style="font-size:.78rem">
                Buy Now
              </button>
            </div>
          </div>`).join('')}
        </div>
      </div>`;
    }).join('')}

    <!-- Footer -->
    <div style="text-align:center;margin-top:2rem;padding:1.5rem;color:var(--text-muted);font-size:.75rem">
      <p>Powered by <strong style="color:var(--gold)">Filio</strong> · Reports generated using AI · Secured payments via Razorpay</p>
      <p style="margin-top:.375rem">For support, contact your CA firm directly.</p>
    </div>`;
  },

  async _buyReport(reportId) {
    const clientName = document.getElementById('store-client-name')?.value.trim() ||
                       this._clientName || '';
    if (!clientName) {
      Toast.error('Please enter your name before purchasing');
      document.getElementById('store-client-name')?.focus();
      return;
    }

    const report = FS.REPORT_CATALOG.find(r => r.id === reportId);
    if (!report) return;

    this._selectedReport = report;
    this._clientName = clientName;

    // Show purchase confirmation modal
    showModal(`
      <div class="modal-header">
        <h3 class="modal-title">Confirm Purchase</h3>
        <button class="modal-close" onclick="closeModal()">${Icons.x}</button>
      </div>
      <div style="background:var(--bg-elevated);border-radius:var(--r-md);padding:1.25rem;margin-bottom:1.25rem">
        <div style="font-weight:700;font-size:1rem;margin-bottom:.375rem">${esc(report.name)}</div>
        <div style="font-size:.8125rem;color:var(--text-muted);line-height:1.6">${esc(report.desc)}</div>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;padding:.875rem 1rem;background:var(--bg-card);border-radius:var(--r-md);margin-bottom:1.25rem">
        <div>
          <div style="font-size:.8rem;color:var(--text-muted)">Report for</div>
          <div style="font-weight:600">${esc(clientName)}</div>
        </div>
        <div style="text-align:right">
          <div style="font-family:var(--font-display);font-size:1.75rem;font-weight:700;color:var(--gold)">₹${report.price}</div>
          <div style="font-size:.7rem;color:var(--text-muted)">One-time payment</div>
        </div>
      </div>
      <div style="background:rgba(56,161,105,.08);border:1px solid rgba(56,161,105,.2);border-radius:var(--r-sm);padding:.75rem;margin-bottom:1.25rem;font-size:.8rem;color:var(--green)">
        ✓ Instant PDF download after successful payment
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" id="pay-btn" onclick="ReportsStore._initiatePayment('${reportId}')">
          Pay ₹${report.price} via Razorpay
        </button>
      </div>`);
  },

  async _initiatePayment(reportId) {
    const report = FS.REPORT_CATALOG.find(r => r.id === reportId);
    if (!report || this._paying) return;
    this._paying = true;

    const btn = document.getElementById('pay-btn');
    if (btn) { btn.disabled=true; btn.textContent='Loading payment…'; }

    // Load Razorpay
    const loaded = await new Promise(resolve => {
      if (window.Razorpay) return resolve(true);
      const s = document.createElement('script');
      s.src = 'https://checkout.razorpay.com/v1/checkout.js';
      s.onload = () => resolve(true);
      s.onerror = () => resolve(false);
      document.body.appendChild(s);
    });

    if (!loaded) {
      Toast.error('Payment gateway failed to load. Check internet connection.');
      this._paying = false;
      if (btn) { btn.disabled=false; btn.textContent=`Pay ₹${report.price} via Razorpay`; }
      return;
    }

    const rzpKey = typeof RAZORPAY_KEY_ID !== 'undefined' && !RAZORPAY_KEY_ID.includes('PASTE')
      ? RAZORPAY_KEY_ID : null;

    if (!rzpKey) {
      // Demo mode — simulate payment for testing
      closeModal();
      Toast.info('Demo mode: Generating report without payment…');
      await this._processAfterPayment(reportId, 'demo_' + Date.now());
      return;
    }

    const options = {
      key:         rzpKey,
      amount:      report.price * 100, // paise
      currency:    'INR',
      name:        this._firm?.name || 'CA Firm',
      description: report.name,
      image:       '',
      prefill:     { name: this._clientName || '' },
      notes:       { reportId, firmId: this._firmId, clientName: this._clientName },
      theme:       { color: '#C9A84C' },
      handler: async (response) => {
        closeModal();
        Toast.info('Payment successful! Generating your report…');
        await this._processAfterPayment(reportId, response.razorpay_payment_id);
      },
      modal: {
        ondismiss: () => {
          this._paying = false;
          if (btn) { btn.disabled=false; btn.textContent=`Pay ₹${report.price} via Razorpay`; }
        }
      }
    };

    try {
      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', resp => {
        Toast.error('Payment failed: ' + resp.error.description);
        this._paying = false;
      });
      rzp.open();
    } catch(e) {
      Toast.error('Could not open payment: ' + e.message);
      this._paying = false;
    }
  },

  async _processAfterPayment(reportId, paymentId) {
    const report = FS.REPORT_CATALOG.find(r => r.id === reportId);
    if (!report) return;

    try {
      // Save purchase record
      const purchaseId = await FS.saveReportPurchase(this._firmId, {
        reportId,
        reportName:   report.name,
        category:     report.category,
        clientName:   this._clientName || 'Client',
        clientId:     this._clientId || null,
        price:        report.price,
        caEarning:    report.caEarning,
        platformFee:  report.price - report.caEarning,
        paymentId,
        firmId:       this._firmId,
        status:       'pending_generation',
      });

      // Notify CA
      const firm = this._firm;
      if (firm?.createdBy) {
        await FS.createNotification(this._firmId, firm.createdBy, {
          type:    'report_purchased',
          title:   `Report purchased: ${report.name}`,
          message: `${this._clientName} purchased "${report.name}" — you earned ₹${report.caEarning}`,
          purchaseId,
          fromName: this._clientName,
        });
      }

      // Generate report
      await ReportGenerator.generate(firm, {
        reportId, reportName: report.name,
        clientName: this._clientName,
        category: report.category,
        price: report.price,
      }, purchaseId);

      this._paying = false;

    } catch(e) {
      console.error('[Filio] Report payment processing:', e);
      Toast.error('Report saved — CA will deliver it shortly.');
      this._paying = false;
    }
  },
};
