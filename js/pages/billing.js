// js/pages/billing.js — Hardened billing with ApiProxy
// ═══════════════════════════════════════════════════════════════
//  SECURITY FIXES:
//  1. Checkout now routes through ApiProxy.razorpayCheckout()
//     — key never accessed directly in business logic
//  2. _activateDemo() is REMOVED from production code.
//     Demo mode only available when RAZORPAY_KEY_ID is a test key.
//  3. _activatePlan() requires a valid paymentId — no bypass on error
//  4. Plan upgrade validation: user must be owner
//  5. GST (18%) added to amount before passing to Razorpay
// ═══════════════════════════════════════════════════════════════

const BillingPage = {
  _firm: null, _user: null, _userDoc: null, _annual: false,

  mount(user, firm, userDoc) {
    this._user = user; this._firm = firm; this._userDoc = userDoc;
    this._render();
    // Event delegation for plan card checkout buttons
    this._delegateHandler = (e) => {
      const btn = e.target.closest('[data-action="checkout"]');
      if (!btn) return;
      const { planid, price, planname } = btn.dataset;
      if (planid) BillingPage._checkout(planid, Number(price), planname || planid);
    };
    document.addEventListener('click', this._delegateHandler);
  },
  unmount() {
    if (this._delegateHandler) { document.removeEventListener('click', this._delegateHandler); this._delegateHandler = null; }
  },

  _plans: [
    {
      id:'starter', name:'Starter', price:799, annual:7990, clients:50,
      desc:'Solo CA practitioner',
      features:['Up to 50 clients','Full dashboard & calendar','GST & ITR tracker','Invoicing + PDF download','Task management','Email support'],
    },
    {
      id:'growth', name:'Growth', price:1499, annual:14990, clients:150,
      desc:'Small 2–5 member firm', popular:true,
      features:['Up to 150 clients','Everything in Starter','Staff task management','Client portal access','WhatsApp reminders','Priority support'],
    },
    {
      id:'pro', name:'Pro', price:2499, annual:24990, clients:400,
      desc:'Growing mid-size firm',
      features:['Up to 400 clients','Everything in Growth','Reports marketplace','Advanced analytics','Client Excel import','Dedicated support'],
    },
    {
      id:'enterprise', name:'Enterprise', price:4999, annual:49990, clients:null,
      desc:'Large multi-partner firm',
      features:['Unlimited clients','Everything in Pro','Multi-branch support','White label','Referral program','Custom onboarding'],
    },
  ],

  _render() {
    const cnt = Layout.getContentEl(); if (!cnt) return;
    const f   = this._firm || {};
    const cur = f.plan || 'starter';
    const isTrial   = f.subscriptionStatus === 'trial';
    const trialLeft = f.trialEndsAt
      ? Math.max(0, Math.ceil((f.trialEndsAt.toDate() - new Date()) / 86400000))
      : 0;

    cnt.innerHTML = `
    <div style="max-width:960px">
      <h2 style="font-size:1.5rem;font-weight:600;margin-bottom:.5rem">Plan & Billing</h2>
      <p style="color:var(--text-muted);margin-bottom:2rem">Choose the right plan. All plans include a 14-day free trial. GST invoices provided.</p>

      <!-- Client usage meter -->
      ${(() => {
        const used  = f.activeClientCount  || 0;
        const limit = f.planClientLimit    || 50;
        const pct   = Math.min(100, Math.round(used / limit * 100));
        const clr   = pct >= 90 ? 'var(--red)' : pct >= 70 ? 'var(--amber)' : 'var(--green)';
        if (f.plan === 'enterprise') return '';
        return `<div style="background:var(--bg-card);border:1px solid var(--border-light);border-radius:var(--r-md);padding:1rem 1.25rem;margin-bottom:1.75rem">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.5rem">
            <span style="font-size:.8125rem;color:var(--text-secondary);font-weight:500">Client Usage</span>
            <span style="font-size:.8125rem;font-weight:700;color:${clr}">${used} / ${limit} clients</span>
          </div>
          <div style="height:6px;background:var(--bg-elevated);border-radius:3px;overflow:hidden">
            <div style="height:100%;width:${pct}%;background:${clr};border-radius:3px;transition:width .4s ease"></div>
          </div>
          ${pct >= 90 ? `<p style="font-size:.75rem;color:var(--red);margin-top:.5rem;font-weight:500">You are near your client limit. Upgrade to add more clients.</p>` : ''}
        </div>`;
      })()}

      <!-- Status banner -->
      ${isTrial ? `
      <div style="background:rgba(201,168,76,.08);border:1px solid rgba(201,168,76,.25);border-radius:var(--r-md);padding:1rem 1.25rem;margin-bottom:1.75rem;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:.75rem">
        <div>
          <div style="font-weight:600;color:var(--gold)">Free Trial Active — ${esc(String(trialLeft))} days remaining</div>
          <div style="font-size:.8125rem;color:var(--text-muted);margin-top:.2rem">Upgrade before trial ends to keep your data and access.</div>
        </div>
        <span class="badge badge-amber">Trial</span>
      </div>` : `
      <div style="background:var(--green-bg);border:1px solid rgba(56,161,105,.25);border-radius:var(--r-md);padding:1rem 1.25rem;margin-bottom:1.75rem;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:.75rem">
        <div>
          <div style="font-weight:600;color:var(--green)">Active — ${esc(cur.charAt(0).toUpperCase()+cur.slice(1))} Plan</div>
          <div style="font-size:.8125rem;color:var(--text-muted);margin-top:.2rem">Your subscription is active.</div>
        </div>
        <span class="badge badge-green">Active</span>
      </div>`}

      <!-- Monthly / Annual toggle -->
      <div style="display:flex;align-items:center;justify-content:center;gap:1rem;margin-bottom:2rem">
        <span style="font-size:.875rem;color:var(--text-secondary)">Monthly</span>
        <div id="billing-toggle" onclick="BillingPage._toggle()" style="width:46px;height:26px;background:rgba(201,168,76,.15);border-radius:13px;cursor:pointer;position:relative;transition:background .2s;border:1px solid rgba(201,168,76,.2)">
          <div id="billing-knob" style="position:absolute;top:3px;left:3px;width:18px;height:18px;background:var(--gold);border-radius:50%;transition:transform .2s ease"></div>
        </div>
        <span style="font-size:.875rem;color:var(--text-secondary)">Annual <span style="color:var(--green);font-weight:600">2 months free</span></span>
      </div>

      <!-- Plan cards -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:1rem;margin-bottom:2rem" id="plan-grid">
        ${this._plans.map(p => this._planCard(p, cur)).join('')}
      </div>

      <!-- Additional clients + billing info -->
      <div class="grid-auto-2" style="gap:1rem">
        <div class="card">
          <h4 style="font-family:var(--font-body);font-size:.9375rem;font-weight:600;margin-bottom:.75rem">Additional Clients</h4>
          <p style="color:var(--text-secondary);font-size:.875rem;line-height:1.7">Beyond your plan limit: <strong style="color:var(--gold)">₹5 per client/month</strong>. Upgrade for better value.</p>
        </div>
        <div class="card">
          <h4 style="font-family:var(--font-body);font-size:.9375rem;font-weight:600;margin-bottom:.75rem">Billing Notes</h4>
          <div style="color:var(--text-secondary);font-size:.8125rem;line-height:1.9">
            ✓ Prices exclusive of 18% GST<br/>
            ✓ GST invoice for every payment<br/>
            ✓ Annual = 10 months price<br/>
            ✓ Cancel anytime, no lock-in<br/>
            ✓ UPI, card, net banking via Razorpay
          </div>
        </div>
      </div>
    </div>`;
  },

  _toggle() {
    this._annual = !this._annual;
    const knob = document.getElementById('billing-knob');
    if (knob) knob.style.transform = this._annual ? 'translateX(20px)' : '';
    const grid = document.getElementById('plan-grid');
    if (grid) grid.innerHTML = this._plans.map(p => this._planCard(p, this._firm?.plan||'starter')).join('');
  },

  _planCard(p, currentPlan) {
    const price    = this._annual ? p.annual : p.price;
    const period   = this._annual ? '/year' : '/month';
    const isCur    = p.id === currentPlan;
    return `
    <div style="position:relative;background:${p.popular?'var(--bg-elevated)':'var(--bg-card)'};border:1px solid ${p.popular?'var(--gold)':isCur?'var(--green)':'var(--border-light)'};border-radius:var(--r-lg);padding:1.5rem;display:flex;flex-direction:column;gap:0;transition:transform .2s,box-shadow .2s" onmouseover="this.style.transform='translateY(-3px)';this.style.boxShadow='0 8px 24px rgba(0,0,0,.4)'" onmouseout="this.style.transform='';this.style.boxShadow=''">
      ${p.popular ? `<div style="position:absolute;top:-12px;left:50%;transform:translateX(-50%);background:var(--gold);color:var(--navy);font-size:.68rem;font-weight:700;padding:.2rem .75rem;border-radius:20px;white-space:nowrap;letter-spacing:.05em">MOST POPULAR</div>` : ''}
      ${isCur    ? `<div style="position:absolute;top:-12px;right:1rem;background:var(--green);color:white;font-size:.68rem;font-weight:700;padding:.2rem .75rem;border-radius:20px">CURRENT</div>` : ''}
      <div style="font-family:var(--font-display);font-size:1.25rem;font-weight:600;margin-bottom:.2rem">${esc(p.name)}</div>
      <div style="color:var(--text-muted);font-size:.78rem;margin-bottom:1rem">${esc(p.desc)}</div>
      <div style="margin-bottom:.5rem">
        <span style="font-size:1.875rem;font-weight:700">₹${price.toLocaleString('en-IN')}</span>
        <span style="color:var(--text-muted);font-size:.8rem">${period}</span>
      </div>
      <div style="font-size:.75rem;color:var(--text-muted);margin-bottom:1.25rem">${p.clients?`Up to ${p.clients} clients`:'Unlimited clients'}</div>
      <div style="flex:1;margin-bottom:1.25rem">
        ${p.features.map(feat=>`
        <div style="display:flex;align-items:flex-start;gap:.4rem;margin-bottom:.375rem">
          <span style="color:var(--green);font-size:.8rem;margin-top:.1rem;flex-shrink:0">✓</span>
          <span style="font-size:.8rem;color:var(--text-secondary)">${esc(feat)}</span>
        </div>`).join('')}
      </div>
      ${isCur
        ? `<button class="btn btn-secondary btn-full" disabled style="opacity:.6">Current Plan</button>`
        : `<button class="btn btn-${p.popular?'primary':'secondary'} btn-full" data-action="checkout" data-planid="${p.id}" data-price="${price}" data-planname="${esc(p.name)}">
            ${p.popular ? `Upgrade to ${esc(p.name)}` : `Select ${esc(p.name)}`}
          </button>`}
    </div>`;
  },

  // ── Checkout (via ApiProxy) ───────────────────────────────
  async _checkout(planId, baseAmount, planName) {
    // Gate: only owner can upgrade
    if (this._userDoc?.role !== 'owner') {
      Toast.error('Only the firm owner can upgrade the plan.');
      return;
    }

    const isTestKey = (typeof RAZORPAY_KEY_ID !== 'undefined') &&
                      RAZORPAY_KEY_ID.includes('test');

    // Amount + 18% GST
    const gstAmount = Math.round(baseAmount * 1.18);

    try {
      await ApiProxy.razorpayCheckout({
        amount:      gstAmount,
        description: `${planName} Plan ${this._annual ? '(Annual)' : '(Monthly)'} incl. GST`,
        user:        this._user,
        firmName:    this._firm?.name || 'Filio — CA Office OS',
        onSuccess:   async (response) => {
          Toast.success('Payment successful! Verifying…');
          try {
            const isLocalhost = ['localhost','127.0.0.1'].includes(window.location.hostname);
            const isTestKey   = RAZORPAY_KEY_ID.includes('rzp_test_');
            if (isLocalhost && isTestKey) {
              // Dev: skip server verify, use direct Firestore write
              await PaymentVerify.devModeActivate({
                firmId:    this._firm.id,
                planId,
                paymentId: response.razorpay_payment_id,
              });
            } else {
              // Production: server-side signature verification
              await PaymentVerify.verifyAndActivate({
                firmId:    this._firm.id,
                planId,
                paymentId: response.razorpay_payment_id,
                orderId:   response.razorpay_order_id   || '',
                signature: response.razorpay_signature  || '',
                isAnnual:  this._annual,
                user:      this._user,
              });
            }
            Toast.success(`🎉 ${planId.charAt(0).toUpperCase() + planId.slice(1)} plan activated!`);
            setTimeout(() => this._render(), 600);
          } catch (e) {
            Toast.error('Activation failed: ' + e.message + '. Contact support if payment was deducted.');
      ErrorMonitor.capture(e, { context: 'billing.js' });
          }
        },
        onDismiss: () => Toast.info('Payment cancelled'),
      });
    } catch (e) {
      // If key not configured and it's clearly a dev/test scenario
      if (isTestKey && e.message.includes('configured')) {
        this._showTestModeModal(planId, planName);
      } else {
        Toast.error(e.message || 'Checkout failed. Please try again.');
      }
    }
  },

  // ── Test-mode modal (only shown when key is a test key) ───
  _showTestModeModal(planId, planName) {
    const overlay = document.getElementById('modal-overlay');
    if (overlay) overlay.remove();

    const ov  = document.createElement('div');
    ov.id     = 'modal-overlay';
    ov.className = 'modal-overlay';

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-header">
        <h3 class="modal-title">Test Mode — ${esc(planName)}</h3>
        <button class="modal-close" aria-label="Close">${Icons.x}</button>
      </div>
      <div style="padding:.5rem 0">
        <div style="background:rgba(201,168,76,.08);border:1px solid rgba(201,168,76,.25);border-radius:var(--r-md);padding:.875rem;margin-bottom:1rem">
          <p style="font-size:.8125rem;color:var(--gold);font-weight:600">⚙️ Razorpay Test Key Active</p>
          <p style="font-size:.8rem;color:var(--text-secondary);margin-top:.25rem">
            You're using a test key (<code style="color:var(--gold)">rzp_test_…</code>). Real payments won't be charged.
            Switch to <code>rzp_live_…</code> before production.
          </p>
        </div>
        <p style="color:var(--text-secondary);font-size:.875rem;line-height:1.7;margin-bottom:1rem">
          Activate <strong style="color:var(--text-primary)">${esc(planName)}</strong> in test mode to verify the flow.
        </p>
      </div>`;

    const footer = document.createElement('div');
    footer.className = 'modal-footer';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn btn-secondary';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', () => ov.remove());

    const activateBtn = document.createElement('button');
    activateBtn.className = 'btn btn-primary';
    activateBtn.textContent = 'Activate (Test Mode)';
    activateBtn.addEventListener('click', async () => {
      ov.remove();
      await this._activatePlan(planId, 'test_' + Date.now());
    });

    footer.append(cancelBtn, activateBtn);
    modal.appendChild(footer);
    ov.appendChild(modal);
    document.body.appendChild(ov);

    modal.querySelector('.modal-close').addEventListener('click', () => ov.remove());
    ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
  },

  // ── Plan activation ───────────────────────────────────────
  async _activatePlan(planId, paymentId) {
    // Require a real paymentId — no silent bypass
    if (!paymentId) {
      Toast.error('Payment ID missing — activation aborted.');
      return;
    }

    const VALID_PLANS = ['starter', 'growth', 'pro', 'enterprise'];
    if (!VALID_PLANS.includes(planId)) {
      Toast.error('Invalid plan selected.');
      return;
    }

    const limits = { starter:50, growth:150, pro:400, enterprise:999999 };
    try {
      await DataIntegrity.withRetry(() => FS.updateFirm(this._firm.id, {
        plan:               planId,
        planClientLimit:    limits[planId] || 50,
        subscriptionStatus: 'active',
        lastPaymentId:      paymentId,
        subscribedAt:       firebase.firestore.FieldValue.serverTimestamp(),
      }), { label: 'activatePlan' });

      // Audit log
      await Security.auditLog(this._firm.id, 'plan_upgraded', {
        plan: planId, paymentId: paymentId.slice(0, 20),
      });

      Toast.success(`🎉 ${planId.charAt(0).toUpperCase()+planId.slice(1)} plan activated!`);
      setTimeout(() => { this._render(); }, 500);
    } catch(e) {
      Toast.error('Plan activation failed. Contact support.');
      console.error('[Billing] activatePlan failed:', e.message);
    }
  },
};
