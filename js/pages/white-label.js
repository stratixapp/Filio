// js/pages/white-label.js — Phase 8: White Label + Referral + Audit Log
// CA firm sets own logo, colors, firm info
// Referral program — refer a CA, get 1 month free
// Audit log viewer

const WhiteLabel = {
  _firm: null, _user: null,
  _tab: 'branding',   // branding | referral | audit

  mount(user, firm) {
    this._user = user; this._firm = firm;
    this._render();
  },
  unmount() {},

  _render() {
    const cnt = Layout.getContentEl(); if (!cnt) return;
    cnt.innerHTML = `
    <div style="margin-bottom:1.5rem">
      <h2 style="font-size:1.5rem;font-weight:600">White Label & Advanced</h2>
      <p style="color:var(--text-muted);font-size:.875rem;margin-top:.2rem">
        Brand your firm, refer CAs, view audit log
      </p>
    </div>

    <div class="tabs" style="margin-bottom:1.5rem">
      ${[['branding','🎨 Branding'],['referral','🤝 Referral Program'],['audit','🔍 Audit Log']].map(([v,l])=>`
        <button class="tab${v===this._tab?' active':''}" onclick="WhiteLabel._setTab('${v}',this)">${l}</button>`).join('')}
    </div>

    <div id="wl-content"></div>`;
    this._renderTab();
  },

  _setTab(tab, btn) {
    this._tab = tab;
    document.querySelectorAll('.tabs .tab').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    this._renderTab();
  },

  _renderTab() {
    const el = document.getElementById('wl-content');
    if (!el) return;
    if (this._tab === 'branding')  this._renderBranding(el);
    if (this._tab === 'referral')  this._renderReferral(el);
    if (this._tab === 'audit')     this._renderAudit(el);
  },

  // ── Branding ────────────────────────────────────────────────
  _renderBranding(el) {
    const f = this._firm||{};
    el.innerHTML = `
    <div class="grid-auto-2" style="gap:1.5rem">
      <!-- Firm identity -->
      <div>
        <div class="card" style="margin-bottom:1.25rem">
          <h4 style="font-size:1rem;font-weight:600;margin-bottom:1.25rem">Firm Identity</h4>
          <div class="input-group" style="margin-bottom:1rem">
            <label class="input-label">Firm Name (as it appears on reports & invoices)</label>
            <input class="input" id="wl-name" value="${esc(f.name||'')}" placeholder="Your CA Firm Name" />
          </div>
          <div class="input-group" style="margin-bottom:1rem">
            <label class="input-label">Tagline / Slogan (optional)</label>
            <input class="input" id="wl-tagline" value="${esc(f.tagline||'')}" placeholder="e.g. Trusted Advisors Since 2010" />
          </div>
          <div class="input-group" style="margin-bottom:1rem">
            <label class="input-label">Website</label>
            <input class="input" id="wl-website" type="url" value="${esc(f.website||'')}" placeholder="https://yourfirm.com" />
          </div>
          <div class="input-group" style="margin-bottom:1.25rem">
            <label class="input-label">Invoice Footer Note</label>
            <textarea class="input" id="wl-footer" rows="2" placeholder="e.g. Payment due within 30 days. Bank: HDFC, IFSC: HDFC0001234">${esc(f.invoiceFooter||'')}</textarea>
          </div>
          <button class="btn btn-primary btn-sm" onclick="WhiteLabel._saveBranding()">Save Identity</button>
        </div>

        <!-- Accent color -->
        <div class="card">
          <h4 style="font-size:1rem;font-weight:600;margin-bottom:.875rem">Accent Color</h4>
          <p style="font-size:.8rem;color:var(--text-muted);margin-bottom:1rem">
            Choose a color that matches your firm's brand. Applied to buttons, highlights, and report headers.
          </p>
          <div style="display:flex;gap:.625rem;flex-wrap:wrap;margin-bottom:1rem">
            ${['#C9A84C','#2980B9','#27AE60','#8E44AD','#E74C3C','#E67E22','#16A085','#2C3E50'].map(color => `
              <div onclick="WhiteLabel._setColor('${color}')"
                style="width:36px;height:36px;border-radius:50%;background:${color};cursor:pointer;transition:transform .15s;border:3px solid ${(f.accentColor||'#C9A84C')===color?'white':'transparent'}"
                title="${color}"
                onmouseenter="this.style.transform='scale(1.15)'" onmouseleave="this.style.transform=''">
              </div>`).join('')}
            <label style="display:flex;align-items:center;gap:.375rem;cursor:pointer">
              <input type="color" id="custom-color" value="${esc(f.accentColor||'#C9A84C')}" onchange="WhiteLabel._setColor(this.value)" style="width:36px;height:36px;border-radius:50%;cursor:pointer;border:none;padding:0" />
            </label>
          </div>
          <div style="display:flex;gap:.75rem;align-items:center">
            <div id="color-preview" style="width:100%;height:8px;border-radius:4px;background:${esc(f.accentColor||'#C9A84C')}"></div>
            <code id="color-hex" style="font-size:.8rem;color:var(--text-muted)">${esc(f.accentColor||'#C9A84C')}</code>
          </div>
        </div>
      </div>

      <!-- Logo + preview -->
      <div>
        <div class="card" style="margin-bottom:1.25rem">
          <h4 style="font-size:1rem;font-weight:600;margin-bottom:.875rem">Firm Logo</h4>
          <div style="width:100%;height:120px;border:2px dashed var(--border);border-radius:var(--r-md);display:flex;align-items:center;justify-content:center;margin-bottom:1rem;cursor:pointer;background:var(--bg-elevated)"
            onclick="document.getElementById('logo-input').click()">
            ${f.logoURL
              ? `<img src="${esc(f.logoURL)}" alt="Logo" style="max-height:100px;max-width:100%;object-fit:contain" />`
              : `<div style="text-align:center;color:var(--text-muted)"><div style="font-size:2rem;margin-bottom:.375rem">🖼️</div><div style="font-size:.8rem">Click to upload logo</div><div style="font-size:.72rem;margin-top:.2rem">PNG, JPG — max 2MB</div></div>`}
          </div>
          <input type="file" id="logo-input" accept="image/*" style="display:none" onchange="WhiteLabel._uploadLogo(this.files[0])" />
          <button class="btn btn-secondary btn-sm btn-full" onclick="document.getElementById('logo-input').click()">
            Upload Logo
          </button>
          <p style="font-size:.72rem;color:var(--text-muted);margin-top:.5rem;text-align:center">Appears on invoices and reports</p>
        </div>

        <!-- Branded preview card -->
        <div class="card" style="background:linear-gradient(135deg,#0A1628,#1A3258)">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:1rem;padding-bottom:.875rem;border-bottom:2px solid ${esc(f.accentColor||'#C9A84C')}">
            <div>
              <div style="font-weight:700;font-size:.9375rem;color:#F5F0E8">${esc(f.name||'Your Firm Name')}</div>
              ${f.tagline ? `<div style="font-size:.72rem;color:#6A8A9A">${esc(f.tagline)}</div>` : ''}
            </div>
            <div style="font-size:.65rem;color:${esc(f.accentColor||'#C9A84C')};font-weight:700;text-transform:uppercase;letter-spacing:.1em">Invoice Preview</div>
          </div>
          <div style="font-size:.75rem;color:#4A6A7A">This is how your invoices and reports will look with your branding applied.</div>
          <div style="margin-top:.75rem;padding:.625rem;background:rgba(255,255,255,.04);border-radius:var(--r-sm);font-size:.72rem;color:${esc(f.accentColor||'#C9A84C')}">
            ${esc(f.invoiceFooter||'Payment due within 30 days')}
          </div>
        </div>
      </div>
    </div>`;
  },

  _setColor(color) {
    const preview = document.getElementById('color-preview');
    const hex     = document.getElementById('color-hex');
    if (preview) preview.style.background = color;
    if (hex)     hex.textContent = color;
    this._pendingColor = color;
    // Update dot borders
    document.querySelectorAll('[onclick*="_setColor"]').forEach(el => {
      el.style.borderColor = el.getAttribute('onclick')?.includes(color) ? 'white' : 'transparent';
    });
  },

  async _saveBranding() {
    try {
      await DataIntegrity.withRetry(() => FS.updateFirm(this._firm.id, {
        name:          document.getElementById('wl-name')?.value.trim()    || this._firm.name,
        tagline:       document.getElementById('wl-tagline')?.value.trim() || '',
        website:       document.getElementById('wl-website')?.value.trim() || '',
        invoiceFooter: document.getElementById('wl-footer')?.value.trim()  || '',
        accentColor:   this._pendingColor || this._firm.accentColor || '#C9A84C',
      }), { label: 'saveWhiteLabel' });
      Toast.success('Branding saved ✓');
      await Security.auditLog(this._firm.id, 'branding_updated', {});
    } catch(e) { Toast.error('Save failed: '+e.message); }
  },

  async _uploadLogo(file) {
    if (!file) return;
    if (file.size > 2*1024*1024) { Toast.error('Logo must be under 2MB'); return; }
    if (!file.type.startsWith('image/')) { Toast.error('Please upload an image file'); return; }
    Toast.info('Uploading logo…');
    try {
      if (typeof firebase.storage === 'function') {
        const storage = firebase.storage();
        const ref     = storage.ref(`firms/${this._firm.id}/assets/logo`);
        await ref.put(file);
        const url = await ref.getDownloadURL();
        await DataIntegrity.withRetry(() => FS.updateFirm(this._firm.id, { logoURL: url }), { label: 'saveLogo' });
        Toast.success('Logo uploaded ✓');
        this._renderTab(); // Refresh preview
      } else {
        // Fallback: base64 preview only
        const reader = new FileReader();
        reader.onload = async (e) => {
          await FS.updateFirm(this._firm.id, { logoURL: e.target.result });
          Toast.success('Logo saved locally ✓');
          this._renderTab();
        };
        reader.readAsDataURL(file);
      }
    } catch(e) { Toast.error('Upload failed: '+e.message); }
  },

  // ── Referral Program ────────────────────────────────────────
  _renderReferral(el) {
    const referralCode = this._firm?.referralCode || this._firm?.id?.slice(0,8).toUpperCase();
    const referralLink = `${window.location.href.split('#')[0]}?ref=${referralCode}`;
    const referrals    = this._firm?.referralCount || 0;
    const freeMonths   = Math.floor(referrals);

    el.innerHTML = `
    <div style="max-width:620px">
      <!-- How it works -->
      <div class="card" style="margin-bottom:1.5rem;background:linear-gradient(135deg,rgba(201,168,76,.06),rgba(42,74,107,.3));border-color:rgba(201,168,76,.2)">
        <div style="text-align:center;padding:.5rem 0 1rem">
          <div style="font-size:2.5rem;margin-bottom:.5rem">🤝</div>
          <h3 style="font-family:var(--font-display);font-size:1.5rem;margin-bottom:.5rem">Refer a CA, Get 1 Month Free</h3>
          <p style="font-size:.875rem;color:var(--text-secondary);max-width:420px;margin:0 auto;line-height:1.7">
            For every CA firm that signs up using your referral link, you get <strong style="color:var(--gold)">1 month free</strong> on your subscription. No limit — refer 12 CAs, get a full year free.
          </p>
        </div>
      </div>

      <!-- Your referral link -->
      <div class="card" style="margin-bottom:1.5rem">
        <h4 style="font-size:1rem;font-weight:600;margin-bottom:1rem">Your Referral Link</h4>
        <div style="display:flex;gap:.75rem;align-items:center;flex-wrap:wrap">
          <div style="flex:1;background:var(--bg-elevated);border:1px solid var(--border);border-radius:var(--r-md);padding:.625rem .875rem;font-family:var(--font-mono);font-size:.8rem;color:var(--gold);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
            ${esc(referralLink)}
          </div>
          <button class="btn btn-primary btn-sm" onclick="copyText('${esc(referralLink)}','Referral link copied!')">
            ${Icons.copy} Copy
          </button>
        </div>

        <div style="display:flex;gap:.75rem;margin-top:.875rem;flex-wrap:wrap">
          <button class="btn btn-ghost btn-sm" style="color:#25D366" onclick="WhiteLabel._shareReferral('whatsapp','${esc(referralLink)}')">
            📱 Share on WhatsApp
          </button>
          <button class="btn btn-ghost btn-sm" onclick="WhiteLabel._shareReferral('email','${esc(referralLink)}')">
            📧 Share via Email
          </button>
        </div>
      </div>

      <!-- Stats -->
      <div class="grid-auto-3" style="margin-bottom:1.5rem">
        ${[
          ['Referrals Made', referrals, '--blue'],
          ['Free Months Earned', freeMonths, '--green'],
          ['Your Code', referralCode, '--gold'],
        ].map(([l,v,c]) => `
          <div class="card" style="text-align:center;padding:1rem">
            <div style="font-family:var(--font-display);font-size:1.375rem;font-weight:700;color:var(${c})">${v}</div>
            <div style="font-size:.72rem;color:var(--text-muted);margin-top:.2rem">${l}</div>
          </div>`).join('')}
      </div>

      <!-- Message templates -->
      <div class="card">
        <h4 style="font-size:.9rem;font-weight:600;margin-bottom:.875rem">Ready-to-send WhatsApp Message</h4>
        <div style="background:var(--bg-elevated);border-radius:var(--r-md);padding:1rem;font-size:.825rem;color:var(--text-secondary);line-height:1.8;white-space:pre-wrap">${`Hi [CA Name],

I've been using Filio for my CA firm — it's really simplified our GST tracking, client management, and invoicing all in one place.

Thought you might find it useful too. You can try it free for 14 days:
${referralLink}

Happy to share more details if you want to chat.

Regards,
${this._firm?.ownerName||this._firm?.name||'CA'}`}</div>
        <button class="btn btn-secondary btn-sm" style="margin-top:.75rem" onclick="copyText(document.querySelector('#wl-content .card:last-child [style*=pre-wrap]').textContent,'Message copied!')">
          ${Icons.copy} Copy Message
        </button>
      </div>
    </div>`;
  },

  _shareReferral(channel, link) {
    const msg = `I've been using Filio to manage my CA firm — really simplified GST tracking, invoicing, and client management. Try it free: ${link}`;
    if (channel === 'whatsapp') window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
    if (channel === 'email') window.location.href = `mailto:?subject=Try Filio — CA Practice Management&body=${encodeURIComponent(msg)}`;
  },

  // ── Audit Log ───────────────────────────────────────────────
  async _renderAudit(el) {
    el.innerHTML = `<div style="display:flex;justify-content:center;padding:2rem"><div class="spinner"></div></div>`;
    try {
      const snap = await db.collection('firms').doc(this._firm.id)
        .collection('auditLog')
        .orderBy('timestamp','desc')
        .limit(100)
        .get();
      const logs = snap.docs.map(d => ({ id:d.id, ...d.data() }));

      el.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;flex-wrap:wrap;gap:.75rem">
        <p style="font-size:.8125rem;color:var(--text-muted)">Last 100 actions — most recent first</p>
        <button class="btn btn-secondary btn-sm" onclick="WhiteLabel._exportAuditLog()">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:.3rem"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Export Audit Log
        </button>
      </div>

      ${logs.length === 0 ? `
      <div class="card"><div class="empty-state"><h4>No audit log entries yet</h4><p>Actions are logged automatically as you use Filio</p></div></div>` : `
      <div class="card" style="padding:0;overflow:hidden">
        <div class="table-wrap">
          <table>
            <thead><tr><th>Action</th><th>User</th><th>Details</th><th>Time</th></tr></thead>
            <tbody>
              ${logs.map(l => {
                const ACTION_ICONS = {
                  client_created:'👤', invoice_created:'🧾', staff_invited:'📨',
                  staff_removed:'❌', data_exported:'⬇️', branding_updated:'🎨',
                  clients_imported:'⬆️', doc_request_created:'📁',
                  report_purchased:'📊', task_completed:'✅',
                };
                const icon = ACTION_ICONS[l.action] || '🔷';
                const time = l.timestamp?.toDate ? l.timestamp.toDate().toLocaleString('en-IN',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}) : '—';
                let details = '';
                try { details = l.details ? JSON.parse(l.details) : {}; } catch { details = {}; }
                const detailStr = Object.entries(details).map(([k,v])=>`${k}: ${v}`).join(' · ');
                return `
                <tr>
                  <td>
                    <div style="display:flex;align-items:center;gap:.5rem">
                      <span style="font-size:.875rem">${icon}</span>
                      <span style="font-size:.8125rem;font-weight:500;text-transform:capitalize">${esc(l.action?.replace(/_/g,' ')||'—')}</span>
                    </div>
                  </td>
                  <td style="font-size:.8rem;color:var(--text-secondary)">${esc(l.email||'—')}</td>
                  <td style="font-size:.75rem;color:var(--text-muted)">${esc(detailStr||'—')}</td>
                  <td style="font-size:.78rem;color:var(--text-muted);white-space:nowrap">${time}</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>`}`;

      this._auditLogs = logs;
    } catch(e) {
      el.innerHTML = `<div class="card"><div class="empty-state"><h4>Could not load audit log</h4><p style="color:var(--red)">${esc(e.message)}</p></div></div>`;
    }
  },

  async _exportAuditLog() {
    const logs = this._auditLogs || [];
    const rows = [['Action','User Email','Details','Timestamp','User Agent']];
    logs.forEach(l => {
      const time = l.timestamp?.toDate ? l.timestamp.toDate().toISOString() : '';
      let details = ''; try { details = JSON.stringify(JSON.parse(l.details||'{}')); } catch { details = ''; }
      rows.push([l.action||'', l.email||'', details, time, (l.userAgent||'').slice(0,100)]);
    });
    const csv  = rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF'+csv],{type:'text/csv'});
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href=url; a.download=`Filio_AuditLog_${new Date().toISOString().slice(0,10)}.csv`; a.click();
    URL.revokeObjectURL(url);
    Toast.success('Audit log exported');
  },

  _auditLogs: [],
};
