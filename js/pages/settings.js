// js/pages/settings.js

const SettingsPage = {
  _firm: null, _user: null, _staff: [], _unsub: null, _saving: false,

  mount(user, firm) {
    this._user = user; this._firm = firm; this._staff = [];
    this._render();
    if (firm) {
      // FIX: added error handler — if Firestore index missing, spinner still clears
      this._unsub = FS.subscribeStaff(firm.id,
        docs => { this._staff = docs; this._renderStaff(); },
        err  => { console.warn('[Filio] subscribeStaff:', err.message); this._renderStaff(); }
      );
    }
  },
  unmount() { if (this._unsub) { this._unsub(); this._unsub = null; } },

  _render() {
    const cnt = Layout.getContentEl(); if (!cnt) return;
    const f = this._firm || {};
    cnt.innerHTML = `
    <div style="max-width:720px">
      <h2 style="font-size:1.5rem;font-weight:600;margin-bottom:2rem">Settings</h2>

      <!-- Firm Profile -->
      <div class="card" style="margin-bottom:1.5rem">
        <h4 style="font-family:var(--font-display);font-size:1.25rem;margin-bottom:1.25rem">Firm Profile</h4>
        <div class="grid-2">
          <div class="input-group">
            <label class="input-label">Firm Name *</label>
            <input class="input" id="s-name" value="${esc(f.name||'')}" placeholder="Nair & Associates" />
          </div>
          <div class="input-group">
            <label class="input-label">Owner / Proprietor Name</label>
            <input class="input" id="s-owner" value="${esc(f.ownerName||'')}" placeholder="CA Full Name" />
          </div>
        </div>
        <div class="grid-2">
          <div class="input-group">
            <label class="input-label">Mobile</label>
            <input class="input" id="s-phone" value="${esc(f.phone||'')}" placeholder="9876543210" type="tel" />
          </div>
          <div class="input-group">
            <label class="input-label">Email</label>
            <input class="input" id="s-email" value="${esc(f.email||'')}" placeholder="ca@yourfirm.com" type="email" />
          </div>
        </div>
        <div class="input-group">
          <label class="input-label">GSTIN</label>
          <input class="input" id="s-gstin" value="${esc(f.gstin||'')}" placeholder="29AABCT1332L1ZV" style="text-transform:uppercase" />
          <span class="error-text" id="s-gstin-err" style="display:none"></span>
        </div>
        <div class="input-group">
          <label class="input-label">Office Address (for invoices & letterhead)</label>
          <textarea class="input" id="s-address" rows="2" placeholder="Door No, Street, Locality, City">${esc(f.address||'')}</textarea>
        </div>
        <div class="grid-2">
          <div class="input-group">
            <label class="input-label">City</label>
            <input class="input" id="s-city" value="${esc(f.city||'')}" placeholder="Kochi" />
          </div>
          <div class="input-group">
            <label class="input-label">State</label>
            <select class="input" id="s-state">${stateOptions(f.state||'Kerala')}</select>
          </div>
        </div>
        <div class="input-group">
          <label class="input-label">Firm Logo URL <span style="color:var(--text-muted);font-size:.75rem">(paste a hosted image URL)</span></label>
          <input class="input" id="s-logo" value="${esc(f.logoURL||'')}" placeholder="https://yoursite.com/logo.png" type="url" />
        </div>
        <div class="input-group">
          <label class="input-label">Invoice Terms / Footer Note</label>
          <textarea class="input" id="s-terms" rows="2" placeholder="e.g. Payment due within 30 days. Bank: HDFC AC 1234567890">${esc(f.invoiceTerms||'')}</textarea>
        </div>
        <div style="display:flex;justify-content:flex-end;margin-top:.5rem">
          <button class="btn btn-primary" id="s-save-btn" onclick="SettingsPage.saveFirm()">Save Changes</button>
        </div>
      </div>

      <!-- My Account -->
      <div class="card" style="margin-bottom:1.5rem">
        <h4 style="font-family:var(--font-display);font-size:1.25rem;margin-bottom:1.25rem">My Account</h4>
        <div style="display:flex;align-items:center;gap:1rem;padding:1rem;background:var(--bg-hover);border-radius:var(--r-md)">
          ${Fmt.avatar(this._user, 40)}
          <div>
            <div style="font-weight:500">${esc(this._user?.displayName||'—')}</div>
            <div style="font-size:.8125rem;color:var(--text-muted)">${esc(this._user?.email||'—')}</div>
          </div>
          <div style="margin-left:auto"><span class="plan-chip">${Icons.crown} Owner</span></div>
        </div>
      </div>

      <!-- Staff -->
      <div class="card" style="margin-bottom:1.5rem">
        <div class="section-header">
          <h4 style="font-family:var(--font-display);font-size:1.25rem;margin:0">Staff Members</h4>
          <button class="btn btn-secondary btn-sm" onclick="SettingsPage.openInvite()">${Icons.plus} Invite Staff</button>
        </div>
        <p style="font-size:.8125rem;color:var(--text-muted);margin-bottom:1rem">Add article clerks and juniors. They get a token to join your firm.</p>
        <div id="staff-list"><div class="spinner" style="margin:.5rem auto"></div></div>
      </div>

      <!-- Plan -->
      <div class="card" style="margin-bottom:1.5rem">
        <h4 style="font-family:var(--font-display);font-size:1.25rem;margin-bottom:1rem">Plan & Billing</h4>
        <div style="display:flex;align-items:center;justify-content:space-between;padding:1rem;background:rgba(201,168,76,.06);border:1px solid rgba(201,168,76,.15);border-radius:var(--r-md)">
          <div>
            <div style="font-weight:600;text-transform:capitalize">${esc(f.plan||'Starter')} Plan</div>
            <div style="font-size:.8125rem;color:var(--text-muted);margin-top:.2rem">
              ${f.subscriptionStatus==='trial'?`Free trial — expires ${Fmt.date(f.trialEndsAt)}`:'Active subscription'}
            </div>
          </div>
          <a href="#/billing" class="btn btn-secondary btn-sm">Manage Plan</a>
        </div>
      </div>

      <!-- Danger zone -->
      <div class="card" style="border-color:rgba(229,62,62,.2)">
        <h4 style="font-family:var(--font-display);font-size:1.25rem;color:var(--red);margin-bottom:.75rem">Danger Zone</h4>
        <p style="font-size:.875rem;color:var(--text-muted);margin-bottom:1rem">Sign out from this device.</p>
        <button class="btn btn-danger btn-sm" onclick="Layout.logout()">${Icons.logout} Sign Out</button>
      </div>

      <!-- Data Backup -->
      <div id="settings-backup-widget" style="margin-top:1.5rem"></div>
    </div>`;

    // Render staff immediately (will show "no staff" if empty)
    this._renderStaff();

    // Render backup widget after DOM is ready
    if (this._firm) {
      setTimeout(() => {
        const backupEl = document.getElementById('settings-backup-widget');
        if (backupEl) BackupService.renderBackupWidget(this._firm.id, this._firm.name, backupEl);
      }, 0);
    }
  },

  _renderStaff() {
    const d = document.getElementById('staff-list'); if (!d) return;
    const members = this._staff.filter(u => u.role !== 'owner');
    if (!members.length) {
      d.innerHTML = `<p style="font-size:.875rem;color:var(--text-muted)">No staff added yet. Click "Invite Staff" to add article clerks and juniors.</p>`;
      return;
    }
    d.innerHTML = members.map(u => `
      <div style="display:flex;align-items:center;gap:.75rem;padding:.625rem 0;border-bottom:1px solid var(--border-light)">
        ${Fmt.avatar(u)}
        <div style="flex:1">
          <div style="font-size:.875rem;font-weight:500">${esc(u.name||u.displayName||'—')}</div>
          <div style="font-size:.75rem;color:var(--text-muted)">${esc(u.email||'')}</div>
        </div>
        <span class="badge badge-muted" style="text-transform:capitalize">${esc(u.role||'clerk')}</span>
      </div>`).join('');
  },

  openInvite() {
    showModal(`
      <div class="modal-header">
        <h3 class="modal-title">Invite Staff Member</h3>
        <button class="modal-close" onclick="closeModal()">${Icons.x}</button>
      </div>
      <p style="color:var(--text-secondary);font-size:.875rem;margin-bottom:1.25rem">
        Generate a token and share it with your staff. They sign in with Google and use the token to join your firm.
      </p>
      <div class="input-group">
        <label class="input-label">Name *</label>
        <input class="input" id="inv-name" placeholder="Article Clerk / Junior name" />
      </div>
      <div class="input-group">
        <label class="input-label">Email</label>
        <input class="input" id="inv-email" placeholder="staff@email.com" type="email" />
      </div>
      <div class="input-group">
        <label class="input-label">Role</label>
        <select class="input" id="inv-role">
          <option value="clerk">Article Clerk</option>
          <option value="junior">Junior / Staff</option>
          <option value="partner">CA Partner</option>
        </select>
      </div>
      <div id="inv-result" style="display:none;background:var(--green-bg);border:1px solid rgba(56,161,105,.3);border-radius:var(--r-md);padding:1rem;margin-top:1rem">
        <p style="font-size:.8125rem;color:var(--green);font-weight:600;margin-bottom:.5rem">✓ Invite token created! Share this with your staff:</p>
        <div style="display:flex;gap:.5rem;align-items:center">
          <code id="inv-token" style="flex:1;background:var(--bg);padding:.5rem .75rem;border-radius:var(--r-sm);font-family:var(--font-mono);letter-spacing:.1em;font-size:1rem"></code>
          <button class="btn btn-secondary btn-sm" onclick="copyText(document.getElementById('inv-token').textContent,'Token copied!')">${Icons.copy} Copy</button>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal()">Close</button>
        <button class="btn btn-primary" id="inv-btn" onclick="SettingsPage._createInvite()">Generate Token</button>
      </div>`);
  },

  async _createInvite() {
    const name = el('inv-name')?.value.trim();
    if (!name) { Toast.error('Name is required'); return; }
    const btn = el('inv-btn');
    if (btn) { btn.disabled=true; btn.innerHTML='<div class="spinner"></div> Creating…'; }
    try {
      const token = await FS.createInvite(this._firm.id, this._user.uid, {
        name, email: el('inv-email')?.value.trim()||'', role: el('inv-role')?.value||'clerk'
      });
      const res = document.getElementById('inv-result');
      const tok = document.getElementById('inv-token');
      if (res) res.style.display = '';
      if (tok) tok.textContent = token;
      if (btn) { btn.disabled=false; btn.innerHTML='Generate Another'; }
    } catch(e) {
      Toast.error('Failed to create invite');
      if (btn) { btn.disabled=false; btn.innerHTML='Generate Token'; }
    }
  },

  async saveFirm() {
    if (this._saving) return;
    this._saving = true;

    const data = {
      name:         el('s-name')?.value.trim()    || '',
      ownerName:    el('s-owner')?.value.trim()   || '',
      phone:        el('s-phone')?.value.trim()   || '',
      email:        el('s-email')?.value.trim()   || '',
      gstin:        (el('s-gstin')?.value.trim()  || '').toUpperCase(),
      address:      el('s-address')?.value.trim() || '',
      city:         el('s-city')?.value.trim()    || '',
      state:        el('s-state')?.value          || 'Kerala',
      logoURL:      el('s-logo')?.value.trim()    || '',
      invoiceTerms: el('s-terms')?.value.trim()   || '',
    };

    const btn = el('s-save-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }

    const conflictRef = db.collection('firms').doc(this._firm.id);

    const ok = await DataIntegrity.safeWrite({
      validate: () => DataIntegrity.Validators.firm(data),
      conflictRef,
      localUpdatedAt: this._firm?.updatedAt || null,
      label: 'saveFirm',
      write: async () => FS.updateFirm(this._firm.id, data),
      onSuccess: () => {
        Toast.success('Firm profile saved ✓');
        const ge = el('s-gstin-err'); if (ge) ge.style.display = 'none';
        AuditTrail.log(this._firm.id, 'firm.updated', { note: 'profile saved' }).catch(() => {});
      },
      onError: () => {},
    });

    this._saving = false;
    if (btn) { btn.disabled = false; btn.textContent = 'Save Changes'; }
  },
};
