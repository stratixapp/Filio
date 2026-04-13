// js/pages/setup.js

const SetupPage = {
  _user: null,
  _step: 0,
  _loading: false,
  _form: {
    name: '', ownerName: '', phone: '', email: '',
    gstin: '', address: '', city: '', state: 'Kerala',
  },
  _errors: {},

  setUser(user) {
    this._user = user;
    this._form.ownerName = user ? (user.displayName || '') : '';
    this._form.email     = user ? (user.email || '') : '';
  },

  render() {
    document.getElementById('app').innerHTML = `
    <div style="min-height:100vh;background:var(--bg);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:2rem">
      <div style="position:fixed;inset:0;opacity:.03;background-image:linear-gradient(var(--gold) 1px,transparent 1px),linear-gradient(90deg,var(--gold) 1px,transparent 1px);background-size:40px 40px;pointer-events:none"></div>

      <div style="width:100%;max-width:540px;position:relative;z-index:1">
        <div style="text-align:center;margin-bottom:2.5rem">
          <div class="logo-icon" style="margin:0 auto 1rem;width:48px;height:48px">${Icons.logo}</div>
          <h2 style="margin-bottom:.5rem">Set up your firm</h2>
          <p style="color:var(--text-muted);font-size:.875rem">Fill in your firm details to get started</p>
        </div>

        <!-- Steps -->
        <div class="steps" id="setup-steps">
          <div class="step-item">
            <div class="step-dot ${this._step >= 0 ? (this._step > 0 ? 'done' : 'active') : 'pending'}">1</div>
            <span style="color:${this._step === 0 ? 'var(--text-primary)' : 'var(--text-muted)'}">Firm Details</span>
          </div>
          <div class="step-line"></div>
          <div class="step-item">
            <div class="step-dot ${this._step > 1 ? 'done' : this._step === 1 ? 'active' : 'pending'}">2</div>
            <span style="color:${this._step === 1 ? 'var(--text-primary)' : 'var(--text-muted)'}">Done</span>
          </div>
        </div>

        <div id="setup-card" class="card-elevated">
          ${this._step === 0 ? this._renderFormStep() : this._renderDoneStep()}
        </div>
      </div>
    </div>`;
  },

  _renderFormStep() {
    const f = this._form;
    const e = this._errors;
    const field = (label, name, type = 'text', placeholder = '', req = false) => `
      <div class="input-group">
        <label class="input-label">${label}${req ? ' *' : ''}</label>
        <input type="${type}" class="input ${e[name] ? 'input-error' : ''}"
          id="f-${name}" value="${f[name] || ''}" placeholder="${placeholder}"
          oninput="SetupPage._onInput('${name}',this.value)" />
        ${e[name] ? `<span class="error-text">${e[name]}</span>` : ''}
      </div>`;

    return `
      <h3 style="margin-bottom:1.5rem;font-size:1.35rem">Firm Information</h3>
      <div class="grid-2">
        ${field('Firm / Practice Name', 'name', 'text', 'e.g. Nair & Associates', true)}
        ${field('Owner Name', 'ownerName', 'text', 'CA Full Name', true)}
      </div>
      <div class="grid-2">
        ${field('Mobile Number', 'phone', 'tel', '9876543210', true)}
        ${field('Email Address', 'email', 'email', 'ca@yourfirm.com', true)}
      </div>
      ${field('GSTIN (optional)', 'gstin', 'text', '29AABCT1332L1ZV')}
      ${field('Address', 'address', 'text', 'Door No, Street, Locality')}
      <div class="grid-2">
        ${field('City', 'city', 'text', 'Kochi')}
        <div class="input-group">
          <label class="input-label">State</label>
          <select class="input" id="f-state" onchange="SetupPage._onInput('state',this.value)">
            ${stateOptions(f.state)}
          </select>
        </div>
      </div>
      <div style="margin-top:1.5rem">
        <button class="btn btn-primary btn-full btn-lg" id="setup-submit-btn" onclick="SetupPage.handleSubmit()" ${this._loading ? 'disabled' : ''}>
          ${this._loading ? '<div class="spinner"></div> Creating firm…' : 'Create My Firm →'}
        </button>
      </div>`;
  },

  _renderDoneStep() {
    return `
      <div style="text-align:center;padding:1.5rem 0">
        <div style="width:64px;height:64px;background:var(--green-bg);border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 1.25rem;color:var(--green)">
          ${Icons.check}
        </div>
        <h3 style="margin-bottom:.75rem">Firm created! 🎉</h3>
        <p style="color:var(--text-secondary);margin-bottom:2rem">
          Your 14-day free trial has started. Let's add your first client.
        </p>
        <button class="btn btn-primary btn-lg" onclick="Router.navigate('/dashboard')">Go to Dashboard →</button>
      </div>`;
  },

  _onInput(name, value) {
    this._form[name] = value;
    if (this._errors[name]) {
      this._errors[name] = '';
      // Re-render just that field's error indicator
      const inp = document.getElementById('f-' + name);
      if (inp) inp.classList.remove('input-error');
    }
  },

  _validate() {
    const f = this._form;
    const e = {};
    if (!f.name.trim())       e.name = 'Firm name is required';
    if (!f.ownerName.trim())  e.ownerName = 'Owner name is required';
    if (!Validate.phone(f.phone)) e.phone = 'Enter valid 10-digit mobile';
    if (!Validate.email(f.email)) e.email = 'Enter valid email address';
    if (f.gstin && !Validate.gstin(f.gstin)) e.gstin = 'Invalid GSTIN format';
    this._errors = e;
    return Object.keys(e).length === 0;
  },

  async handleSubmit() {
    if (this._loading) return;
    if (!this._validate()) { this.render(); return; }

    this._loading = true;
    const btn = document.getElementById('setup-submit-btn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<div class="spinner"></div> Creating firm…'; }

    try {
      await FS.createFirm(this._user.uid, this._form);
      this._step = 1;
      this.render();
      // App will pick up the firmId via auth state re-check
    } catch (err) {
      console.error('createFirm error:', err);
      Toast.error('Something went wrong. Please try again.');
      this._loading = false;
      if (btn) { btn.disabled = false; btn.innerHTML = 'Create My Firm →'; }
    }
  },
};


// ── Staff token join (Phase 4) ────────────────────────────────
const StaffJoin = {
  _user: null,

  setUser(user) { this._user = user; },

  render() {
    document.getElementById('app').innerHTML = `
    <div style="min-height:100vh;background:var(--bg);display:flex;align-items:center;justify-content:center;padding:2rem">
      <div style="width:100%;max-width:420px">
        <div style="text-align:center;margin-bottom:2rem">
          <div class="logo-icon" style="width:48px;height:48px;margin:0 auto 1rem">${Icons.logo}</div>
          <h2>Join a firm</h2>
          <p style="color:var(--text-muted);font-size:.875rem;margin-top:.4rem">Enter the token your CA shared with you</p>
        </div>
        <div class="card-elevated" style="padding:2rem">
          <div class="input-group" style="margin-bottom:1.25rem">
            <label class="input-label">Join Token *</label>
            <input class="input" id="join-token" placeholder="e.g. ABC12345"
              style="text-align:center;font-family:var(--font-mono);font-size:1.25rem;letter-spacing:.15em;text-transform:uppercase"
              oninput="this.value=this.value.toUpperCase()"
              onkeydown="if(event.key==='Enter')StaffJoin.handleJoin()" />
          </div>
          <div id="join-error" style="display:none;background:var(--red-bg);border:1px solid rgba(229,62,62,.2);border-radius:var(--r-sm);padding:.75rem;margin-bottom:1rem;font-size:.8125rem;color:var(--red)"></div>
          <button class="btn btn-primary btn-full btn-lg" id="join-btn" onclick="StaffJoin.handleJoin()">
            Join Firm →
          </button>
          <div style="text-align:center;margin-top:1rem">
            <button onclick="StaffJoin.render()" style="background:none;border:none;color:var(--text-muted);font-size:.8rem;cursor:pointer;font-family:var(--font-body)">
              Don't have a token? Contact your CA
            </button>
          </div>
        </div>
      </div>
    </div>`;
  },

  async handleJoin() {
    const token = document.getElementById('join-token')?.value.trim().toUpperCase();
    const errEl = document.getElementById('join-error');
    const btn   = document.getElementById('join-btn');

    if (!token || token.length < 6) {
      if (errEl) { errEl.textContent = 'Enter the token shared by your CA'; errEl.style.display=''; }
      return;
    }
    if (btn) { btn.disabled=true; btn.textContent='Verifying…'; }
    if (errEl) errEl.style.display = 'none';

    try {
      // Look up invite token
      const invSnap = await db.collection('invites').doc(token).get();
      if (!invSnap.exists || invSnap.data().used) {
        throw new Error('Invalid or already used token. Ask your CA for a new one.');
      }
      const inv = invSnap.data();

      // Join the firm
      const batch = db.batch();
      // Mark invite as used
      batch.update(invSnap.ref, { used: true, usedBy: this._user.uid, usedAt: firebase.firestore.FieldValue.serverTimestamp() });
      // Update user doc
      batch.update(db.collection('users').doc(this._user.uid), {
        firmId: inv.firmId,
        role:   inv.role || 'clerk',
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
      // Create staff profile
      batch.set(
        db.collection('firms').doc(inv.firmId).collection('staffProfiles').doc(this._user.uid),
        {
          uid:      this._user.uid,
          name:     this._user.displayName || inv.name || '',
          email:    this._user.email || inv.email || '',
          photoURL: this._user.photoURL || '',
          role:     inv.role || 'clerk',
          firmId:   inv.firmId,
          isActive: true,
          joinedAt: firebase.firestore.FieldValue.serverTimestamp(),
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        }
      );
      await batch.commit();

      // Notify firm owner
      await FS.createNotification(inv.firmId, inv.invitedBy, {
        type:    'staff_joined',
        title:   `${this._user.displayName || inv.name} joined your firm`,
        message: `${this._user.displayName || 'A new staff member'} accepted the invite and joined as ${inv.role}.`,
        fromUid: this._user.uid,
        fromName:this._user.displayName,
      });

      Toast.success('Welcome to the team! 🎉');
      Router.navigate('/dashboard');
    } catch(e) {
      const msg = e.message || 'Invalid token. Please try again.';
      if (errEl) { errEl.textContent = msg; errEl.style.display=''; }
      if (btn)   { btn.disabled=false; btn.textContent='Join Firm →'; }
    }
  },
};
