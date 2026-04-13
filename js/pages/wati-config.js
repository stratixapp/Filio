// js/pages/wati-config.js — Phase 3: WhatsApp / WATI Configuration
// CA configures their WATI API key for automated reminders
// Shows reminder logs and lets CA set reminder templates

const WATIConfig = {
  _firm: null,
  _user: null,

  mount(user, firm) {
    this._user = user;
    this._firm = firm;
    this._render();
  },
  unmount() {},

  _render() {
    const cnt = Layout.getContentEl(); if (!cnt) return;
    const f = this._firm || {};
    const watiKey  = f.watiApiKey  || '';
    const watiUrl  = f.watiApiUrl  || '';
    const watiNum  = f.watiNumber  || '';
    const isConfigured = watiKey && watiUrl;

    cnt.innerHTML = `
    <div style="max-width:720px">
      <div style="margin-bottom:1.5rem">
        <h2 style="font-size:1.5rem;font-weight:600">WhatsApp Automation</h2>
        <p style="color:var(--text-muted);font-size:.875rem;margin-top:.2rem">
          Connect WATI to send automatic document reminders to clients
        </p>
      </div>

      <!-- Status banner -->
      <div style="background:${isConfigured?'var(--green-bg)':'rgba(201,168,76,.08)'};border:1px solid ${isConfigured?'rgba(56,161,105,.25)':'rgba(201,168,76,.2)'};border-radius:var(--r-md);padding:1rem 1.25rem;margin-bottom:1.75rem;display:flex;align-items:center;gap:.875rem">
        <div style="font-size:1.25rem">${isConfigured ? '✅' : '⚙️'}</div>
        <div>
          <div style="font-weight:600;color:${isConfigured?'var(--green)':'var(--gold)'}">${isConfigured ? 'WATI Connected' : 'Setup Required'}</div>
          <div style="font-size:.8125rem;color:var(--text-secondary);margin-top:.15rem">
            ${isConfigured ? 'WhatsApp reminders are active. Clients will be reminded automatically after 3 days.' : 'Add your WATI credentials below to enable automatic WhatsApp reminders.'}
          </div>
        </div>
      </div>

      <!-- WATI Setup Card -->
      <div class="card" style="margin-bottom:1.5rem">
        <h4 style="font-size:1.1rem;margin-bottom:1.25rem;color:var(--text-primary)">WATI API Configuration</h4>

        <div class="grid-2">
          <div class="input-group">
            <label class="input-label">WATI API URL</label>
            <input class="input" id="wati-url" type="url" value="${esc(watiUrl)}"
              placeholder="https://live-mt-server.wati.io/XXXXX" />
            <span style="font-size:.72rem;color:var(--text-muted);margin-top:.25rem;display:block">From WATI Dashboard → API → API Endpoint</span>
          </div>
          <div class="input-group">
            <label class="input-label">WATI API Access Token</label>
            <input class="input" id="wati-key" type="password" value="${esc(watiKey)}"
              placeholder="eyJhbGciOi…" />
            <span style="font-size:.72rem;color:var(--text-muted);margin-top:.25rem;display:block">From WATI Dashboard → API → Access Token</span>
          </div>
        </div>

        <div class="input-group" style="margin-top:1rem">
          <label class="input-label">Your WhatsApp Business Number (with country code)</label>
          <input class="input" id="wati-num" type="tel" value="${esc(watiNum)}"
            placeholder="919876543210" style="max-width:280px" />
          <span style="font-size:.72rem;color:var(--text-muted);margin-top:.25rem;display:block">Include country code — e.g. 91 for India before the 10-digit number</span>
        </div>

        <div style="margin-top:1.25rem;display:flex;gap:.75rem;flex-wrap:wrap">
          <button class="btn btn-primary btn-sm" onclick="WATIConfig._save()">Save WATI Config</button>
          ${isConfigured ? `<button class="btn btn-secondary btn-sm" onclick="WATIConfig._test()">Test Connection</button>` : ''}
        </div>
      </div>

      <!-- How to get WATI -->
      <div class="card" style="margin-bottom:1.5rem;background:rgba(14,165,233,.04);border-color:rgba(14,165,233,.15)">
        <div style="display:flex;gap:.875rem;align-items:flex-start">
          <div style="font-size:1.5rem;flex-shrink:0">📱</div>
          <div>
            <div style="font-weight:600;margin-bottom:.5rem;color:var(--blue)">How to get WATI</div>
            <div style="font-size:.8125rem;color:var(--text-secondary);line-height:1.9">
              <div>1. Go to <strong style="color:var(--text-primary)">wati.io</strong> and create an account</div>
              <div>2. Connect your WhatsApp Business number</div>
              <div>3. Go to Dashboard → API</div>
              <div>4. Copy the API Endpoint URL and Access Token</div>
              <div>5. Paste them above and save</div>
            </div>
            <div style="margin-top:.75rem;padding:.625rem .875rem;background:rgba(14,165,233,.08);border-radius:var(--r-sm);font-size:.78rem;color:var(--blue)">
              💡 WATI starts at ~₹2,500/month. You can also use Interakt or AiSensy as alternatives — same API format.
            </div>
          </div>
        </div>
      </div>

      <!-- Reminder Templates -->
      <div class="card" style="margin-bottom:1.5rem">
        <h4 style="font-size:1.1rem;margin-bottom:1.25rem">Reminder Message Templates</h4>
        <p style="font-size:.8125rem;color:var(--text-muted);margin-bottom:1.25rem">
          These messages are sent to clients when they haven't uploaded documents for 3+ days.
          Use <code style="background:var(--bg-elevated);padding:.1em .3em;border-radius:3px;color:var(--gold)">{{client_name}}</code>,
          <code style="background:var(--bg-elevated);padding:.1em .3em;border-radius:3px;color:var(--gold)">{{firm_name}}</code>,
          <code style="background:var(--bg-elevated);padding:.1em .3em;border-radius:3px;color:var(--gold)">{{request_title}}</code>,
          <code style="background:var(--bg-elevated);padding:.1em .3em;border-radius:3px;color:var(--gold)">{{upload_link}}</code>
        </p>

        <div class="input-group" style="margin-bottom:1rem">
          <label class="input-label">First Reminder (Day 3)</label>
          <textarea class="input" id="tpl-1" rows="3" style="font-size:.85rem">${esc(f.watiTemplate1 || 'Dear {{client_name}},\n\nA gentle reminder — we are waiting for your documents for {{request_title}}.\n\nPlease upload here: {{upload_link}}\n\nThank you,\n{{firm_name}}')}</textarea>
        </div>

        <div class="input-group" style="margin-bottom:1.25rem">
          <label class="input-label">Second Reminder (Day 7)</label>
          <textarea class="input" id="tpl-2" rows="3" style="font-size:.85rem">${esc(f.watiTemplate2 || 'Dear {{client_name}},\n\nThis is an urgent reminder for your {{request_title}} documents. The deadline is approaching.\n\nPlease upload immediately: {{upload_link}}\n\nThank you,\n{{firm_name}}')}</textarea>
        </div>

        <button class="btn btn-secondary btn-sm" onclick="WATIConfig._saveTemplates()">Save Templates</button>
      </div>

      <!-- Reminder log -->
      <div class="card">
        <h4 style="font-size:1.1rem;margin-bottom:1rem">How Automatic Reminders Work</h4>
        <div style="display:flex;flex-direction:column;gap:.5rem">
          ${[
            ['Day 0', 'CA creates document request → WhatsApp link sent to client immediately', 'var(--gold)'],
            ['Day 3', 'Client hasn\'t uploaded → First automatic WhatsApp reminder sent', 'var(--amber)'],
            ['Day 7', 'Still not uploaded → Second urgent reminder sent', 'var(--red)'],
            ['Any time', 'Client clicks link → uploads document → CA gets notified instantly', 'var(--green)'],
          ].map(([day, desc, clr]) => `
            <div style="display:flex;gap:.875rem;align-items:flex-start;padding:.625rem 0;border-bottom:1px solid var(--border-light)">
              <div style="min-width:60px;font-size:.75rem;font-weight:700;color:${clr}">${day}</div>
              <div style="font-size:.8125rem;color:var(--text-secondary)">${desc}</div>
            </div>`).join('')}
        </div>
        <p style="margin-top:1rem;font-size:.78rem;color:var(--text-muted)">
          Note: Automatic scheduling requires Firebase Cloud Functions (configure in Phase 3 advanced setup).
          For now, use the "Remind" button in Document Collection to send reminders manually.
        </p>
      </div>
    </div>`;
  },

  async _save() {
    const url = document.getElementById('wati-url')?.value.trim();
    const key = document.getElementById('wati-key')?.value.trim();
    const num = document.getElementById('wati-num')?.value.trim().replace(/\D/g,'');

    if (!url || !key) { Toast.error('Both API URL and Access Token are required'); return; }
    if (url && !url.startsWith('https://')) { Toast.error('API URL must start with https://'); return; }

    try {
      await DataIntegrity.withRetry(() => FS.updateFirm(this._firm.id, {
        watiApiUrl: url, watiApiKey: key, watiNumber: num,
      }), { label: 'saveWati' });
      Toast.success('WATI configuration saved ✓');
      // Update local firm reference
      this._firm.watiApiUrl = url;
      this._firm.watiApiKey = key;
      this._firm.watiNumber = num;
      this._render(); // Re-render to show "Connected" status
    } catch(e) { Toast.error('Save failed'); }
  },

  async _saveTemplates() {
    const t1 = document.getElementById('tpl-1')?.value.trim();
    const t2 = document.getElementById('tpl-2')?.value.trim();
    try {
      await DataIntegrity.withRetry(() => FS.updateFirm(this._firm.id, { watiTemplate1: t1, watiTemplate2: t2 }), { label: 'saveWatiTemplates' });
      Toast.success('Templates saved ✓');
    } catch(e) { Toast.error('Save failed'); }
  },

  async _test() {
    Toast.info('Testing WATI connection…');
    const f = this._firm;
    if (!f.watiApiUrl || !f.watiApiKey) { Toast.error('Configure WATI first'); return; }
    try {
      // Route through ApiProxy — never expose key in inline fetch calls
      await ApiProxy.watiTestConnection(f);
      Toast.success('WATI connection successful! ✓');
    } catch(e) {
      Toast.error('Connection failed — check your API URL and token: ' + e.message);
      ErrorMonitor.capture(e, { context: 'wati-config.js' });
    }
  },
};
