// js/pages/email-center.js — Phase 6: Email Integration
// Send invoices, reminders, and communications via email (mailto + EmailJS)
// Works without backend — opens default email client or uses EmailJS if configured

const EmailCenter = {
  _firm: null, _user: null,
  _clients: [],
  _unsubClients: null,

  mount(user, firm) {
    this._user = user; this._firm = firm;
    this._clients = [];
    this._render();
    this._unsubClients = FS.subscribeClients(firm.id, d => {
      this._clients = d; this._renderClientList();
    });
  },

  unmount() {
    if (this._unsubClients) { this._unsubClients(); this._unsubClients = null; }
  },

  _render() {
    const cnt = Layout.getContentEl(); if (!cnt) return;
    cnt.innerHTML = `
    <div style="margin-bottom:1.5rem">
      <h2 style="font-size:1.5rem;font-weight:600">Email Center</h2>
      <p style="color:var(--text-muted);font-size:.875rem;margin-top:.2rem">
        Send emails to clients — invoices, reminders, notices, and custom messages
      </p>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1.5fr;gap:1.5rem">
      <!-- Left: Compose -->
      <div>
        <div class="card" style="margin-bottom:1rem">
          <h4 style="font-size:1rem;font-weight:600;margin-bottom:1.25rem">Compose Email</h4>

          <div class="input-group" style="margin-bottom:1rem">
            <label class="input-label">To (Client) *</label>
            <select class="input" id="em-client" onchange="EmailCenter._onClientChange(this)">
              <option value="">— Select client —</option>
            </select>
          </div>

          <div class="input-group" style="margin-bottom:1rem">
            <label class="input-label">To (Email)</label>
            <input class="input" id="em-to" type="email" placeholder="client@email.com" />
          </div>

          <div class="input-group" style="margin-bottom:1rem">
            <label class="input-label">Template</label>
            <select class="input" id="em-template" onchange="EmailCenter._applyTemplate(this.value)">
              <option value="">— Choose template or write custom —</option>
              <option value="gst_reminder">GST Filing Reminder</option>
              <option value="itr_reminder">ITR Filing Reminder</option>
              <option value="doc_request">Document Request</option>
              <option value="invoice_follow">Invoice Follow-up</option>
              <option value="notice_received">Notice Received Alert</option>
              <option value="custom">Custom Email</option>
            </select>
          </div>

          <div class="input-group" style="margin-bottom:1rem">
            <label class="input-label">Subject *</label>
            <input class="input" id="em-subject" placeholder="Email subject line" />
          </div>

          <div class="input-group" style="margin-bottom:1.25rem">
            <label class="input-label">Message *</label>
            <textarea class="input" id="em-body" rows="8" placeholder="Email body…" style="font-size:.875rem;resize:vertical"></textarea>
          </div>

          <div style="display:flex;gap:.75rem">
            <button class="btn btn-primary btn-full" onclick="EmailCenter._send()">
              📧 Send via Email Client
            </button>
          </div>

          <div style="margin-top:.75rem;padding:.75rem;background:var(--bg-elevated);border-radius:var(--r-sm)">
            <p style="font-size:.75rem;color:var(--text-muted);line-height:1.6">
              Opens your default email client (Outlook, Gmail, etc.) with the message pre-filled. Click Send in your email client to deliver.
            </p>
          </div>
        </div>

        <!-- EmailJS config (optional) -->
        <div class="card" style="background:rgba(201,168,76,.04);border-color:rgba(201,168,76,.15)">
          <h4 style="font-size:.9rem;font-weight:600;margin-bottom:.5rem;color:var(--gold)">Optional: EmailJS Integration</h4>
          <p style="font-size:.78rem;color:var(--text-muted);line-height:1.7;margin-bottom:.875rem">
            For sending emails directly from the browser without opening your email client, configure EmailJS (free for 200 emails/month).
          </p>
          <div class="input-group" style="margin-bottom:.75rem">
            <label class="input-label">EmailJS Service ID</label>
            <input class="input" id="ejs-service" placeholder="service_xxxxxxx" style="font-size:.85rem" value="${esc(this._firm?.emailjsService||'')}" />
          </div>
          <div class="input-group" style="margin-bottom:.75rem">
            <label class="input-label">EmailJS Template ID</label>
            <input class="input" id="ejs-template" placeholder="template_xxxxxxx" style="font-size:.85rem" value="${esc(this._firm?.emailjsTemplate||'')}" />
          </div>
          <div class="input-group" style="margin-bottom:.875rem">
            <label class="input-label">EmailJS Public Key</label>
            <input class="input" id="ejs-key" placeholder="xxxxxxxxxxxx" style="font-size:.85rem" value="${esc(this._firm?.emailjsKey||'')}" />
          </div>
          <button class="btn btn-secondary btn-sm" onclick="EmailCenter._saveEmailJS()">Save EmailJS Config</button>
        </div>
      </div>

      <!-- Right: Client list + recent emails -->
      <div>
        <div class="card" style="margin-bottom:1rem">
          <div class="section-header"><span class="section-title">Clients with Email</span></div>
          <div id="em-client-list" style="max-height:280px;overflow-y:auto">
            <div style="display:flex;justify-content:center;padding:2rem"><div class="spinner"></div></div>
          </div>
        </div>

        <!-- Email tips -->
        <div class="card">
          <h4 style="font-size:.9rem;font-weight:600;margin-bottom:.875rem">Email Templates Guide</h4>
          ${[
            ['GST Reminder', 'Due dates approaching, ask client to upload invoices'],
            ['ITR Reminder', 'Annual ITR filing reminder with document checklist'],
            ['Document Request', 'Ask client to submit specific documents'],
            ['Invoice Follow-up', 'Gentle payment reminder for overdue invoices'],
            ['Notice Alert', 'Inform client about a tax notice received'],
          ].map(([t,d])=>`
          <div style="padding:.625rem 0;border-bottom:1px solid var(--border-light)">
            <div style="font-weight:500;font-size:.8125rem;margin-bottom:.15rem">${esc(t)}</div>
            <div style="font-size:.75rem;color:var(--text-muted)">${esc(d)}</div>
          </div>`).join('')}
        </div>
      </div>
    </div>`;
  },

  _renderClientList() {
    const sel = document.getElementById('em-client');
    if (sel) {
      sel.innerHTML = `<option value="">— Select client —</option>` +
        this._clients.map(c=>`<option value="${c.id}" data-email="${esc(c.email||'')}" data-name="${esc(c.name)}">${esc(c.name)}</option>`).join('');
    }

    const listEl = document.getElementById('em-client-list');
    if (!listEl) return;
    const withEmail = this._clients.filter(c => c.email);
    const noEmail   = this._clients.filter(c => !c.email);

    listEl.innerHTML = withEmail.map(c=>`
      <div style="display:flex;align-items:center;gap:.625rem;padding:.5rem;border-radius:var(--r-sm);cursor:pointer;transition:background .1s"
        data-action="quickselect" data-id="${c.id}" data-email="${esc(c.email)}" data-name="${esc(c.name)}"
        onmouseenter="this.style.background='var(--bg-hover)'" onmouseleave="this.style.background=''">
        <div class="avatar" style="width:28px;height:28px;font-size:.65rem;flex-shrink:0">${Fmt.initials(c.name)}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:.8125rem;font-weight:500">${esc(c.name)}</div>
          <div style="font-size:.72rem;color:var(--text-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(c.email)}</div>
        </div>
      </div>`).join('') +
    (noEmail.length ? `<div style="margin-top:.75rem;padding:.5rem;font-size:.75rem;color:var(--text-muted);border-top:1px solid var(--border-light)">${noEmail.length} clients without email address</div>` : '');
  },

  _quickSelect(clientId, email, name) {
    const sel = document.getElementById('em-client');
    if (sel) sel.value = clientId;
    const toEl = document.getElementById('em-to');
    if (toEl) toEl.value = email;
    // Auto-apply greeting
    const body = document.getElementById('em-body');
    if (body && !body.value.trim()) {
      body.value = `Dear ${name},\n\n\n\nRegards,\n${this._firm?.ownerName||this._firm?.name||''}`;
    }
  },

  _onClientChange(sel) {
    const opt  = sel.options[sel.selectedIndex];
    const email = opt?.dataset?.email || '';
    const name  = opt?.dataset?.name  || '';
    const toEl  = document.getElementById('em-to');
    if (toEl) toEl.value = email;
  },

  _applyTemplate(tpl) {
    const firm = this._firm;
    const clientSel  = document.getElementById('em-client');
    const clientName = clientSel?.options[clientSel?.selectedIndex]?.dataset?.name || 'Sir/Madam';
    const templates = {
      gst_reminder: {
        subject: `GST Filing Reminder — ${new Date().toLocaleDateString('en-IN',{month:'long',year:'numeric'})}`,
        body: `Dear ${clientName},\n\nThis is a friendly reminder that your GST returns for ${new Date().toLocaleDateString('en-IN',{month:'long',year:'numeric'})} are due soon:\n\n• GSTR-1: Due by 11th\n• GSTR-3B: Due by 20th\n\nPlease ensure your sales and purchase invoices are ready.\n\nFor any queries, contact us.\n\nRegards,\n${firm?.ownerName||firm?.name||''}`,
      },
      itr_reminder: {
        subject: `Income Tax Return Filing — Action Required`,
        body: `Dear ${clientName},\n\nITR filing season is here. Please arrange the following documents:\n\n1. Form 16 (from employer)\n2. 26AS Statement\n3. Bank statements (April–March)\n4. Investment proofs (80C, 80D)\n5. Any other income details\n\nDeadline for non-audit cases: 31st July\n\nPlease share the documents at the earliest.\n\nRegards,\n${firm?.ownerName||firm?.name||''}`,
      },
      doc_request: {
        subject: `Documents Required — Pending from Your End`,
        body: `Dear ${clientName},\n\nWe are yet to receive certain documents from your end. Kindly submit the following at the earliest to avoid delays:\n\n[List documents here]\n\nYou can upload documents directly on our portal or WhatsApp them to us.\n\nRegards,\n${firm?.ownerName||firm?.name||''}`,
      },
      invoice_follow: {
        subject: `Payment Reminder — Invoice Pending`,
        body: `Dear ${clientName},\n\nThis is a gentle reminder that payment against our invoice is still pending.\n\nRequest you to kindly process the payment at the earliest.\n\nFor any queries regarding the invoice, please reach out to us.\n\nRegards,\n${firm?.ownerName||firm?.name||''}`,
      },
      notice_received: {
        subject: `Tax Notice Received — Requires Your Attention`,
        body: `Dear ${clientName},\n\nPlease be informed that a tax notice has been received from the Income Tax / GST Department.\n\nNotice Details:\n• Type: [Notice Type]\n• Period: [Assessment Year]\n• Response Deadline: [Date]\n\nWe are reviewing the notice and will revert with the required response. Please contact us immediately to discuss this.\n\nRegards,\n${firm?.ownerName||firm?.name||''}`,
      },
    };
    const t = templates[tpl];
    if (!t) return;
    const subEl  = document.getElementById('em-subject');
    const bodyEl = document.getElementById('em-body');
    if (subEl)  subEl.value  = t.subject;
    if (bodyEl) bodyEl.value = t.body;
  },

  _send() {
    const to      = document.getElementById('em-to')?.value.trim();
    const subject = document.getElementById('em-subject')?.value.trim();
    const body    = document.getElementById('em-body')?.value.trim();

    if (!to)      { Toast.error('Enter recipient email'); return; }
    if (!subject) { Toast.error('Subject is required');   return; }
    if (!body)    { Toast.error('Message body is required'); return; }
    if (!Validate.email(to)) { Toast.error('Invalid email address'); return; }

    const mailto = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailto;
    Toast.success('Opening your email client…');

    // Log this as a communication
    const clientSel  = document.getElementById('em-client');
    const clientId   = clientSel?.value;
    const clientName = clientSel?.options[clientSel?.selectedIndex]?.dataset?.name || '';
    if (clientId && this._firm) {
      FS.addCommunication(this._firm.id, {
        clientId, clientName,
        type: 'email', direction: 'outbound',
        summary: `Email sent: ${subject}`,
        byUid:   this._user.uid,
        byName:  this._user.displayName||'',
        firmId:  this._firm.id,
      }).catch(() => {});
    }
  },

  async _saveEmailJS() {
    const service  = document.getElementById('ejs-service')?.value.trim();
    const template = document.getElementById('ejs-template')?.value.trim();
    const key      = document.getElementById('ejs-key')?.value.trim();
    try {
      await DataIntegrity.withRetry(() => FS.updateFirm(this._firm.id, { emailjsService:service, emailjsTemplate:template, emailjsKey:key }), { label: 'saveEmailJS' });
      Toast.success('EmailJS config saved');
    } catch(e) { Toast.error('Save failed'); }
  },
};
