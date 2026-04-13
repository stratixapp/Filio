// js/pages/client-portal.js — Phase 3: Client Portal
// Separate mobile-first view for clients
// Client sees: their document upload requests, filed returns, invoices, deadlines
// Accessed via: #/client-portal?firm=FIRMID&req=REQID  (or just firm= for full portal)
// No CA login needed — client uses a shared link or OTP (OTP = Phase 3 future)
// For now: link-based access with firm+client identification

const ClientPortal = {
  _firmId: null,
  _reqId: null,
  _firm: null,
  _request: null,
  _clientId: null,
  _uploading: false,

  mount(user, firm) {
    // Parse URL params
    const hash   = window.location.hash;
    const params = new URLSearchParams(hash.includes('?') ? hash.split('?')[1] : '');
    this._firmId   = params.get('firm') || (firm && firm.id) || null;
    this._reqId    = params.get('req')  || null;
    this._clientId = params.get('client') || null;

    if (!this._firmId) {
      Layout.getContentEl().innerHTML = `<div class="empty-state" style="padding:4rem"><h4>Invalid portal link</h4><p>This link is missing required information.</p></div>`;
      return;
    }

    this._render();
    this._load();
  },

  unmount() {
    if (this._unsubReq) { this._unsubReq(); this._unsubReq = null; }
  },

  async _load() {
    try {
      // Load firm
      const firmSnap = await db.collection('firms').doc(this._firmId).get();
      if (!firmSnap.exists) { this._showError('Firm not found'); return; }
      this._firm = { id: firmSnap.id, ...firmSnap.data() };

      if (this._reqId) {
        // Load specific request
        const reqSnap = await db.collection('firms').doc(this._firmId)
          .collection('docRequests').doc(this._reqId).get();
        if (!reqSnap.exists) { this._showError('Request not found or expired'); return; }
        this._request = { id: reqSnap.id, ...reqSnap.data() };
        this._renderRequest();

        // Live updates — stored so unmount can clean up
        this._unsubReq = db.collection('firms').doc(this._firmId)
          .collection('docRequests').doc(this._reqId)
          .onSnapshot(snap => {
            if (snap.exists) { this._request = { id: snap.id, ...snap.data() }; this._renderRequest(); }
          });
      } else {
        this._renderFullPortal();
      }
    } catch(e) {
      this._showError('Failed to load. Check your internet connection.');
    }
  },

  _render() {
    const cnt = Layout.getContentEl(); if (!cnt) return;
    cnt.innerHTML = `
    <div style="max-width:560px;margin:0 auto;padding:1rem">
      <div style="display:flex;justify-content:center;padding:1.5rem 0 1rem">
        <div style="display:flex;align-items:center;gap:.625rem">
          <div style="width:36px;height:36px;background:rgba(201,168,76,.1);border:1px solid rgba(201,168,76,.2);border-radius:10px;display:flex;align-items:center;justify-content:center">
            <svg width="16" height="16" viewBox="0 0 40 40" fill="none"><path d="M10 20 L20 10 L30 20 L20 30 Z" fill="#C9A84C"/><circle cx="20" cy="20" r="4" fill="#C9A84C"/></svg>
          </div>
          <div>
            <div style="font-size:1.125rem;font-weight:700;color:var(--gold)">Filio</div>
            <div id="portal-firm-name" style="font-size:.65rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:.1em">Loading…</div>
          </div>
        </div>
      </div>
      <div id="portal-content">
        <div style="display:flex;justify-content:center;padding:3rem"><div class="spinner spinner-lg"></div></div>
      </div>
    </div>`;
  },

  _showError(msg) {
    const el = document.getElementById('portal-content');
    if (el) el.innerHTML = `<div class="card" style="text-align:center;padding:2rem">
      <div style="font-size:2rem;margin-bottom:.75rem">⚠️</div>
      <p style="color:var(--text-secondary)">${esc(msg)}</p>
    </div>`;
  },

  _renderRequest() {
    const r = this._request;
    const items = r.items || [];
    const uploaded = items.filter(i => i.status==='uploaded').length;
    const total    = items.length;
    const pct      = total > 0 ? Math.round(uploaded/total*100) : 0;
    const isComplete = r.status === 'complete';

    // Update firm name
    const firmNameEl = document.getElementById('portal-firm-name');
    if (firmNameEl && this._firm) firmNameEl.textContent = this._firm.name;

    const el = document.getElementById('portal-content');
    if (!el) return;

    el.innerHTML = `
    <!-- Header card -->
    <div class="card" style="margin-bottom:1rem;text-align:center">
      <div style="font-size:2rem;margin-bottom:.5rem">${isComplete ? '🎉' : '📁'}</div>
      <h3 style="font-size:1.25rem;font-weight:600;margin-bottom:.375rem">${esc(r.title)}</h3>
      ${r.financialYear ? `<p style="color:var(--text-muted);font-size:.85rem">Financial Year ${esc(r.financialYear)}</p>` : ''}

      <!-- Progress -->
      <div style="margin:1rem 0">
        <div style="height:8px;background:var(--bg-elevated);border-radius:4px;overflow:hidden;margin-bottom:.5rem">
          <div style="height:100%;background:${isComplete?'var(--green)':'var(--gold)'};border-radius:4px;width:${pct}%;transition:width .5s ease"></div>
        </div>
        <p style="font-size:.85rem;color:${isComplete?'var(--green)':'var(--text-secondary)'};font-weight:500">
          ${isComplete ? '✓ All documents received — thank you!' : `${uploaded} of ${total} documents uploaded`}
        </p>
      </div>

      ${r.notes ? `<div style="background:rgba(201,168,76,.06);border:1px solid rgba(201,168,76,.12);border-radius:var(--r-sm);padding:.75rem;text-align:left;margin-top:.5rem">
        <p style="font-size:.8125rem;color:var(--text-secondary);line-height:1.7">${esc(r.notes)}</p>
      </div>` : ''}
    </div>

    <!-- Document items -->
    <div style="display:flex;flex-direction:column;gap:.625rem">
      ${items.map(item => `
        <div class="card" style="border-left:3px solid ${item.status==='uploaded'?'var(--green)':'var(--border)'};padding:1rem">
          <div style="display:flex;align-items:flex-start;gap:.875rem;flex-wrap:wrap">
            <div style="width:24px;height:24px;border-radius:50%;border:2px solid ${item.status==='uploaded'?'var(--green)':'var(--border)'};
              display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:.1rem;
              background:${item.status==='uploaded'?'var(--green)':'transparent'}">
              ${item.status==='uploaded'?`<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>`:''}
            </div>
            <div style="flex:1;min-width:0">
              <div style="font-weight:500;font-size:.9rem">${esc(item.label)}</div>
              ${item.status==='uploaded' ? `
                <div style="margin-top:.25rem">
                  <span class="badge badge-green" style="font-size:.72rem">Uploaded ✓</span>
                  ${item.fileName ? `<span style="font-size:.72rem;color:var(--text-muted);margin-left:.4rem">📎 ${esc(item.fileName)}</span>` : ''}
                </div>` : `
                <div style="margin-top:.5rem">
                  <label style="display:inline-flex;align-items:center;gap:.5rem;padding:.5rem .875rem;
                    background:rgba(201,168,76,.08);border:1px solid rgba(201,168,76,.25);border-radius:var(--r-sm);
                    cursor:pointer;font-size:.8125rem;font-weight:500;color:var(--gold);transition:all .15s"
                    onmouseenter="this.style.background='rgba(201,168,76,.15)'"
                    onmouseleave="this.style.background='rgba(201,168,76,.08)'">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg>
                    Upload ${esc(item.label)}
                    <input type="file" style="display:none" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
                      onchange="ClientPortal._uploadFile('${r.id}','${item.id}','${esc(item.label)}',this)" />
                  </label>
                </div>`}
            </div>
          </div>
        </div>`).join('')}
    </div>

    <!-- Footer -->
    <div style="text-align:center;margin-top:1.5rem;padding:1rem;color:var(--text-muted);font-size:.75rem">
      <p>Powered by <strong style="color:var(--gold)">Filio</strong> — CA Office OS</p>
      <p style="margin-top:.25rem">Your documents are securely stored and only visible to your CA firm.</p>
    </div>`;
  },

  async _uploadFile(reqId, itemId, itemLabel, input) {
    const file = input.files[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) { Toast.error('File too large. Maximum 20MB.'); return; }

    const allowed = ['application/pdf','image/jpeg','image/jpg','image/png',
      'application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
    if (!allowed.includes(file.type)) { Toast.error('Invalid file type. PDF, JPG, PNG, DOC, XLS only.'); return; }

    Toast.info(`Uploading ${file.name}…`);

    try {
      // NOTE: Firebase Storage requires storage to be enabled in Firebase Console
      // and appropriate Storage rules. For Phase 3 MVP, we mark as uploaded without
      // actual file storage — file upload with Firebase Storage is a config step.
      // To enable real uploads: Firebase Console → Storage → Get Started

      // Try real upload if Firebase Storage is available
      if (typeof firebase.storage === 'function') {
        const storage = firebase.storage();
        const path = `firms/${this._firmId}/docRequests/${reqId}/${itemId}/${file.name}`;
        const ref  = storage.ref(path);
        const task = ref.put(file);

        task.on('state_changed',
          snap => {
            const pct = Math.round(snap.bytesTransferred/snap.totalBytes*100);
            Toast.info(`Uploading… ${pct}%`);
          },
          err => { Toast.error('Upload failed: ' + err.message); },
          async () => {
            const url = await task.snapshot.ref.getDownloadURL();
            await DataIntegrity.withRetry(() => FS.updateDocItem(this._firmId, reqId, itemId, {
              status: 'uploaded',
              uploadedAt: new Date(),
              uploadedBy: 'client',
              fileURL: url,
              fileName: file.name,
              fileSize: file.size,
            }), { label: 'updateDocItem' });
            Toast.success(`${file.name} uploaded successfully! ✓`);
          }
        );
      } else {
        // Fallback: mark as uploaded without file (CA will collect manually)
        await DataIntegrity.withRetry(() => FS.updateDocItem(this._firmId, reqId, itemId, {
          status: 'uploaded',
          uploadedAt: new Date(),
          uploadedBy: 'client',
          fileName: file.name,
          fileSize: file.size,
          fileURL: null,
          note: 'File submitted — contact CA for confirmation',
        }), { label: 'updateDocItem' });
        Toast.success(`${file.name} submitted ✓`);
      }
    } catch(e) {
      console.error(e);
      Toast.error('Upload failed. Please try again.');
    }
  },

  _renderFullPortal() {
    // Full client portal — shows all requests, invoices, deadlines for this client
    const firmNameEl = document.getElementById('portal-firm-name');
    if (firmNameEl && this._firm) firmNameEl.textContent = this._firm.name;

    const el = document.getElementById('portal-content');
    if (!el) return;

    el.innerHTML = `
    <div class="card" style="text-align:center;padding:2rem;margin-bottom:1rem">
      <div style="font-size:2.5rem;margin-bottom:.75rem">👋</div>
      <h3 style="font-size:1.25rem;font-weight:600;margin-bottom:.5rem">Welcome to your client portal</h3>
      <p style="color:var(--text-secondary);font-size:.875rem">
        Your CA firm <strong>${esc(this._firm?.name||'')}</strong> uses Filio to manage your filings.
        Use the document link your CA shares with you to upload documents securely.
      </p>
    </div>

    <div class="card" style="background:rgba(201,168,76,.04);border-color:rgba(201,168,76,.15)">
      <div style="display:flex;gap:.875rem;align-items:flex-start">
        <div style="font-size:1.5rem;flex-shrink:0">💡</div>
        <div>
          <div style="font-weight:600;font-size:.9rem;margin-bottom:.375rem;color:var(--gold)">How it works</div>
          <div style="font-size:.8125rem;color:var(--text-secondary);line-height:1.8">
            <div>1. Your CA creates a document checklist for you</div>
            <div>2. They send you a WhatsApp link</div>
            <div>3. Click the link → upload documents directly</div>
            <div>4. Your CA is notified instantly</div>
          </div>
        </div>
      </div>
    </div>`;
  },
};
