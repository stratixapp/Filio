// js/pages/import-export.js — Phase 8: Client Excel Import + Full Data Export
// Bulk import clients from CSV/Excel, export entire firm data

const ImportExport = {
  _firm: null, _user: null,
  _clients: [],
  _preview: [],
  _importing: false,
  _unsubClients: null,
  _tab: 'import',

  mount(user, firm) {
    this._user = user; this._firm = firm;
    this._clients = []; this._preview = [];
    this._render();
    this._unsubClients = FS.subscribeClients(firm.id, d => { this._clients = d; });
  },

  unmount() {
    if (this._unsubClients) { this._unsubClients(); this._unsubClients = null; }
  },

  _render() {
    const cnt = Layout.getContentEl(); if (!cnt) return;
    cnt.innerHTML = `
    <div style="margin-bottom:1.5rem">
      <h2 style="font-size:1.5rem;font-weight:600">Import & Export</h2>
      <p style="color:var(--text-muted);font-size:.875rem;margin-top:.2rem">
        Bulk import clients from Excel · Export all firm data anytime
      </p>
    </div>

    <div class="tabs" style="margin-bottom:1.5rem">
      ${[['import','⬆️ Import Clients'],['export','⬇️ Export Data']].map(([v,l])=>`
        <button class="tab${v===this._tab?' active':''}" onclick="ImportExport._setTab('${v}',this)">${l}</button>`).join('')}
    </div>

    <div id="ie-content"></div>`;

    this._renderTab();
  },

  _setTab(tab, btn) {
    this._tab = tab;
    document.querySelectorAll('.tabs .tab').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    this._renderTab();
  },

  _renderTab() {
    const el = document.getElementById('ie-content');
    if (!el) return;
    this._tab === 'import' ? this._renderImport(el) : this._renderExport(el);
  },

  _renderImport(el) {
    el.innerHTML = `
    <!-- Download template -->
    <div class="card" style="margin-bottom:1.5rem;border-left:3px solid var(--gold)">
      <div style="display:flex;gap:1rem;align-items:flex-start">
        <div style="font-size:1.5rem;flex-shrink:0">📋</div>
        <div style="flex:1">
          <div style="font-weight:600;margin-bottom:.375rem">Step 1 — Download the import template</div>
          <p style="font-size:.8125rem;color:var(--text-secondary);line-height:1.7;margin-bottom:.875rem">
            Use this exact format. Columns: Name, Type, PAN, GSTIN, Phone, Email, Address, City, State, Tags
          </p>
          <button class="btn btn-secondary btn-sm" onclick="ImportExport._downloadTemplate()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:.3rem"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Download CSV Template
          </button>
        </div>
      </div>
    </div>

    <!-- Upload area -->
    <div class="card" style="margin-bottom:1.5rem">
      <div style="font-weight:600;margin-bottom:1rem">Step 2 — Upload your filled CSV file</div>
      <div id="drop-zone"
        style="border:2px dashed var(--border);border-radius:var(--r-lg);padding:3rem;text-align:center;cursor:pointer;transition:all .2s"
        onclick="document.getElementById('csv-file-input').click()"
        ondragover="event.preventDefault();this.style.borderColor='var(--gold)';this.style.background='rgba(201,168,76,.05)'"
        ondragleave="this.style.borderColor='var(--border)';this.style.background=''"
        ondrop="event.preventDefault();this.style.borderColor='var(--border)';this.style.background='';ImportExport._handleFile(event.dataTransfer.files[0])">
        <div style="font-size:2.5rem;margin-bottom:.75rem">📂</div>
        <div style="font-weight:600;margin-bottom:.375rem">Click to select or drag & drop</div>
        <div style="font-size:.8125rem;color:var(--text-muted)">CSV files only · Max 500 clients per import</div>
        <input type="file" id="csv-file-input" accept=".csv,.txt" style="display:none" onchange="ImportExport._handleFile(this.files[0])" />
      </div>
    </div>

    <!-- Preview -->
    <div id="import-preview" style="display:none">
      <div class="card" style="margin-bottom:1rem">
        <div class="section-header">
          <span class="section-title" id="preview-title">Preview</span>
          <div style="display:flex;gap:.75rem">
            <button class="btn btn-secondary btn-sm" onclick="ImportExport._resetImport()">Cancel</button>
            <button class="btn btn-primary btn-sm" id="confirm-import-btn" onclick="ImportExport._confirmImport()">
              Import Clients
            </button>
          </div>
        </div>
        <div class="table-wrap">
          <table id="preview-table">
            <thead>
              <tr><th>#</th><th>Name</th><th>Type</th><th>PAN</th><th>GSTIN</th><th>Phone</th><th>Email</th><th>Status</th></tr>
            </thead>
            <tbody id="preview-tbody"></tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Import log -->
    <div id="import-log" style="display:none" class="card">
      <div class="section-header"><span class="section-title">Import Results</span></div>
      <div id="import-log-content"></div>
    </div>`;
  },

  _downloadTemplate() {
    const csv = [
      ['Name','Type','PAN','GSTIN','Phone','Email','Address','City','State','Tags'],
      ['Rajesh Traders','company','ABCDE1234F','29ABCDE1234F1Z1','9876543210','rajesh@email.com','123 MG Road','Kochi','Kerala','gst,audit'],
      ['Priya Nair','individual','PQRST5678G','','9123456789','priya@email.com','45 Beach Road','Thrissur','Kerala','itr'],
      ['ABC Pvt Ltd','company','XYZAB9012H','29XYZAB9012H1Z2','8765432109','abc@company.com','Business Park','Bangalore','Karnataka','gst,roc,audit'],
    ].map(r => r.map(v => `"${v}"`).join(',')).join('\n');

    const blob = new Blob([csv], {type:'text/csv'});
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'Filio_Client_Import_Template.csv'; a.click();
    URL.revokeObjectURL(url);
    Toast.success('Template downloaded!');
  },

  _handleFile(file) {
    if (!file) return;
    if (!file.name.match(/\.(csv|txt)$/i)) { Toast.error('Please upload a CSV file'); return; }
    if (file.size > 5 * 1024 * 1024) { Toast.error('File too large — max 5MB'); return; }

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      this._parseCSV(text);
    };
    reader.onerror = () => Toast.error('Failed to read file');
    reader.readAsText(file);
  },

  _parseCSV(text) {
    const lines = text.trim().split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) { Toast.error('CSV must have a header row and at least one data row'); return; }

    // Parse header
    const headers = lines[0].split(',').map(h => h.replace(/"/g,'').trim().toLowerCase());
    const nameIdx  = headers.findIndex(h => h.includes('name'));
    const typeIdx  = headers.findIndex(h => h.includes('type'));
    const panIdx   = headers.findIndex(h => h.includes('pan'));
    const gstinIdx = headers.findIndex(h => h.includes('gstin'));
    const phoneIdx = headers.findIndex(h => h.includes('phone'));
    const emailIdx = headers.findIndex(h => h.includes('email'));
    const addrIdx  = headers.findIndex(h => h.includes('address') || h.includes('addr'));
    const cityIdx  = headers.findIndex(h => h.includes('city'));
    const stateIdx = headers.findIndex(h => h.includes('state'));
    const tagsIdx  = headers.findIndex(h => h.includes('tag'));

    if (nameIdx === -1) { Toast.error('CSV must have a "Name" column'); return; }

    const parseRow = (line) => {
      const parts = [];
      let inQuote = false, cur = '';
      for (const ch of line + ',') {
        if (ch === '"') { inQuote = !inQuote; }
        else if (ch === ',' && !inQuote) { parts.push(cur.trim()); cur = ''; }
        else cur += ch;
      }
      return parts;
    };

    const VALID_TYPES = ['individual','company','huf','llp','partnership'];
    const rows = lines.slice(1, 501); // Max 500

    this._preview = rows.map((line, i) => {
      const cols = parseRow(line);
      const get  = (idx) => (idx >= 0 && cols[idx]) ? cols[idx].replace(/"/g,'').trim() : '';
      const name = get(nameIdx);
      const type = VALID_TYPES.includes(get(typeIdx).toLowerCase()) ? get(typeIdx).toLowerCase() : 'individual';
      const pan  = get(panIdx).toUpperCase();
      const gstin= get(gstinIdx).toUpperCase();
      const phone= get(phoneIdx);
      const email= get(emailIdx).toLowerCase();

      const errors = [];
      if (!name) errors.push('Name missing');
      if (pan && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(pan)) errors.push('Invalid PAN');
      if (gstin && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(gstin)) errors.push('Invalid GSTIN');
      if (phone && !/^[6-9]\d{9}$/.test(phone)) errors.push('Invalid phone');
      if (email && !/\S+@\S+\.\S+/.test(email)) errors.push('Invalid email');

      return {
        name, type, pan, gstin, phone, email,
        address: get(addrIdx), city: get(cityIdx),
        state:   get(stateIdx) || 'Kerala',
        tags:    get(tagsIdx) ? get(tagsIdx).split(/[,;]/).map(t=>t.trim()).filter(Boolean) : [],
        valid:   errors.length === 0,
        errors,
        _row: i + 2,
      };
    }).filter(r => r.name);

    if (!this._preview.length) { Toast.error('No valid rows found in CSV'); return; }

    this._showPreview();
  },

  _showPreview() {
    const previewEl = document.getElementById('import-preview');
    const tbody     = document.getElementById('preview-tbody');
    const titleEl   = document.getElementById('preview-title');
    if (!previewEl || !tbody) return;

    previewEl.style.display = '';
    const valid   = this._preview.filter(r => r.valid).length;
    const invalid = this._preview.filter(r => !r.valid).length;

    if (titleEl) titleEl.textContent = `Preview — ${this._preview.length} rows (${valid} valid, ${invalid} errors)`;

    const btn = document.getElementById('confirm-import-btn');
    if (btn) btn.textContent = `Import ${valid} Clients`;
    if (btn && valid === 0) btn.disabled = true;

    tbody.innerHTML = this._preview.map(r => `
      <tr style="opacity:${r.valid?1:.5}">
        <td style="color:var(--text-muted);font-size:.78rem">${r._row}</td>
        <td style="font-weight:500">${esc(r.name)}</td>
        <td><span class="badge badge-muted" style="font-size:.68rem;text-transform:capitalize">${r.type}</span></td>
        <td><code style="font-size:.75rem">${r.pan||'—'}</code></td>
        <td><code style="font-size:.72rem;color:var(--text-muted)">${r.gstin||'—'}</code></td>
        <td style="font-size:.8rem">${r.phone||'—'}</td>
        <td style="font-size:.78rem;color:var(--text-muted)">${r.email||'—'}</td>
        <td>
          ${r.valid
            ? '<span class="badge badge-green" style="font-size:.68rem">✓ Ready</span>'
            : `<span class="badge badge-red" style="font-size:.68rem" title="${esc(r.errors.join(', '))}">⚠ ${r.errors[0]}</span>`}
        </td>
      </tr>`).join('');
  },

  async _confirmImport() {
    if (this._importing) return;
    const valid = this._preview.filter(r => r.valid);
    if (!valid.length) { Toast.error('No valid rows to import'); return; }

    this._importing = true;
    const btn = document.getElementById('confirm-import-btn');
    if (btn) { btn.disabled=true; btn.innerHTML='<div class="spinner" style="width:14px;height:14px;display:inline-block"></div> Importing…'; }

    let succeeded = 0, failed = 0;
    const errors = [];

    for (const r of valid) {
      try {
        await DataIntegrity.withRetry(() => FS.addClient(this._firm.id, {
          name: r.name, type: r.type, pan: r.pan, gstin: r.gstin,
          phone: r.phone, email: r.email, address: r.address,
          city: r.city, state: r.state, tags: r.tags,
          importedAt: new Date(),
        }), { label: 'bulkImportClient' });
        succeeded++;
      } catch(e) {
        failed++;
        errors.push(`Row ${r._row} (${r.name}): ${e.message}`);
      }
      // Small delay to avoid Firestore rate limits
      if (succeeded % 10 === 0) await new Promise(r => setTimeout(r, 500));
    }

    this._importing = false;
    this._preview   = [];
    const previewEl = document.getElementById('import-preview');
    if (previewEl) previewEl.style.display = 'none';

    const logEl  = document.getElementById('import-log');
    const logCnt = document.getElementById('import-log-content');
    if (logEl && logCnt) {
      logEl.style.display = '';
      logCnt.innerHTML = `
      <div style="display:flex;gap:1.5rem;margin-bottom:1rem">
        <div style="text-align:center;padding:.75rem 1.25rem;background:var(--green-bg);border-radius:var(--r-md);border:1px solid rgba(56,161,105,.2)">
          <div style="font-size:1.5rem;font-weight:700;color:var(--green)">${succeeded}</div>
          <div style="font-size:.72rem;color:var(--text-muted)">Imported</div>
        </div>
        ${failed ? `<div style="text-align:center;padding:.75rem 1.25rem;background:var(--red-bg);border-radius:var(--r-md);border:1px solid rgba(229,62,62,.2)">
          <div style="font-size:1.5rem;font-weight:700;color:var(--red)">${failed}</div>
          <div style="font-size:.72rem;color:var(--text-muted)">Failed</div>
        </div>` : ''}
      </div>
      ${errors.length ? `<div style="font-size:.78rem;color:var(--red);line-height:1.8">${errors.map(e=>`<div>⚠ ${esc(e)}</div>`).join('')}</div>` : ''}
      <button class="btn btn-primary btn-sm" style="margin-top:1rem" onclick="ImportExport._resetImport()">Import More</button>`;
    }

    await Security.auditLog(this._firm.id, 'clients_imported', { count: succeeded });
    Toast.success(`${succeeded} clients imported successfully!`);
  },

  _resetImport() {
    this._preview = [];
    const pEl = document.getElementById('import-preview');
    const lEl = document.getElementById('import-log');
    if (pEl) pEl.style.display = 'none';
    if (lEl) lEl.style.display = 'none';
    const inp = document.getElementById('csv-file-input');
    if (inp) inp.value = '';
  },

  // ── Export Tab ─────────────────────────────────────────────
  _renderExport(el) {
    el.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:1.25rem">
      ${[
        { icon:'👥', title:'All Clients',      desc:'Name, PAN, GSTIN, phone, email, address, type, tags',    btn:'Export Clients CSV',    fn:'_exportClients' },
        { icon:'🧾', title:'All Invoices',     desc:'Invoice number, client, amount, GST, status, date',       btn:'Export Invoices CSV',   fn:'_exportInvoices' },
        { icon:'✅', title:'All Tasks',        desc:'Title, client, assignee, priority, status, dates',        btn:'Export Tasks CSV',      fn:'_exportTasks' },
        { icon:'📅', title:'GST Tracker',     desc:'Client-wise GSTR-1, GSTR-3B, GSTR-9 status — current month', btn:'Export GST Data',   fn:'_exportGST' },
        { icon:'💬', title:'Communication Log',desc:'All calls, messages, meetings logged against clients',     btn:'Export Comm Log CSV',  fn:'_exportComms' },
        { icon:'📊', title:'Full Firm Report', desc:'Everything in one Excel-friendly CSV — use for audit/backup', btn:'Export Everything', fn:'_exportAll', highlight:true },
      ].map(e => `
        <div class="card" style="${e.highlight?'border:2px solid var(--gold);background:rgba(201,168,76,.04)':''}">
          <div style="font-size:1.75rem;margin-bottom:.625rem">${e.icon}</div>
          <div style="font-weight:700;font-size:.9375rem;margin-bottom:.375rem">${e.title}</div>
          <div style="font-size:.78rem;color:var(--text-muted);line-height:1.6;margin-bottom:1rem;min-height:36px">${e.desc}</div>
          <button class="btn ${e.highlight?'btn-primary':'btn-secondary'} btn-sm btn-full" onclick="ImportExport.${e.fn}()">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:.35rem"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            ${e.btn}
          </button>
        </div>`).join('')}
    </div>

    <div class="card" style="margin-top:1.5rem;background:rgba(14,165,233,.04);border-color:rgba(14,165,233,.15)">
      <div style="display:flex;gap:.875rem;align-items:flex-start">
        <div style="font-size:1.25rem;flex-shrink:0">🔒</div>
        <div>
          <div style="font-weight:600;color:var(--blue);margin-bottom:.375rem">Your Data Belongs to You</div>
          <p style="font-size:.8125rem;color:var(--text-secondary);line-height:1.7">
            All exports are generated locally from your Firebase data and downloaded directly to your device. Filio never sends your data to any third-party server. You can export and migrate your data at any time — even if you cancel your subscription.
          </p>
        </div>
      </div>
    </div>`;
  },

  _csv(rows) {
    return rows.map(r => r.map(v => `"${String(v||'').replace(/"/g,'""')}"`).join(',')).join('\n');
  },

  _download(csv, filename) {
    const blob = new Blob(['\uFEFF'+csv], {type:'text/csv;charset=utf-8'});
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href=url; a.download=filename; a.click();
    URL.revokeObjectURL(url);
    Toast.success(`${filename} downloaded`);
  },

  async _exportClients() {
    const rows = [['Name','Type','PAN','GSTIN','Phone','Email','Address','City','State','Tags','Added']];
    this._clients.forEach(c => rows.push([
      c.name,c.type,c.pan,c.gstin,c.phone,c.email,c.address,c.city,c.state,
      (c.tags||[]).join(';'), Fmt.date(c.createdAt)
    ]));
    this._download(this._csv(rows), `Filio_Clients_${new Date().toISOString().slice(0,10)}.csv`);
    await Security.auditLog(this._firm.id, 'data_exported', {type:'clients'});
  },

  async _exportInvoices() {
    const snap = await db.collection('firms').doc(this._firm.id).collection('invoices').get();
    const invs = snap.docs.map(d=>d.data());
    const rows = [['Invoice No','Client','Date','Subtotal','GST Rate','GST Amt','Total','Status','Paid Date']];
    invs.forEach(i => rows.push([
      i.invoiceNo, i.clientName, Fmt.date(i.createdAt),
      ((i.subtotal||0)/100).toFixed(2), i.gstRate||0,
      ((i.tax||0)/100).toFixed(2), ((i.total||0)/100).toFixed(2),
      i.status, Fmt.date(i.paidDate)
    ]));
    this._download(this._csv(rows), `Filio_Invoices_${new Date().toISOString().slice(0,10)}.csv`);
    await Security.auditLog(this._firm.id, 'data_exported', {type:'invoices'});
  },

  async _exportTasks() {
    const snap = await db.collection('firms').doc(this._firm.id).collection('tasks').get();
    const tasks = snap.docs.map(d=>d.data());
    const rows = [['Title','Client','Assigned To','Priority','Status','Due Date','Completed At','Completion Note']];
    tasks.forEach(t => rows.push([
      t.title, t.clientName||'', t.assignedToName||t.assignedTo||'',
      t.priority, t.status, Fmt.date(t.dueDate),
      Fmt.date(t.completedAt), t.completionNote||''
    ]));
    this._download(this._csv(rows), `Filio_Tasks_${new Date().toISOString().slice(0,10)}.csv`);
  },

  async _exportGST() {
    const now = new Date();
    const docId = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
    const snap = await db.collection('firms').doc(this._firm.id)
      .collection('gstTracking').doc(docId).get();
    const tracking = snap.exists ? snap.data() : {};
    const rows = [['Client','GSTIN','GSTR-1','GSTR-3B','GSTR-9','Notes']];
    this._clients.forEach(c => {
      const t = tracking[c.id]||{};
      rows.push([c.name, c.gstin||'', t.gstr1||'pending', t.gstr3b||'pending', t.gstr9||'pending', t.notes||'']);
    });
    this._download(this._csv(rows), `Filio_GST_Tracker_${docId}.csv`);
  },

  async _exportComms() {
    const snap = await db.collection('firms').doc(this._firm.id)
      .collection('communications').orderBy('createdAt','desc').get();
    const comms = snap.docs.map(d=>d.data());
    const rows  = [['Client','Type','Direction','Summary','Outcome','Duration (min)','By','Date']];
    comms.forEach(c => rows.push([
      c.clientName, c.type, c.direction, c.summary, c.outcome||'', c.duration||'',
      c.byName, Fmt.date(c.createdAt)
    ]));
    this._download(this._csv(rows), `Filio_CommLog_${new Date().toISOString().slice(0,10)}.csv`);
  },

  async _exportAll() {
    Toast.info('Preparing full export…');
    try {
      // Clients
      await this._exportClients();
      await new Promise(r => setTimeout(r, 500));
      // Invoices
      await this._exportInvoices();
      await new Promise(r => setTimeout(r, 500));
      // Tasks
      await this._exportTasks();
      Toast.success('All data exported! Check your Downloads folder.');
      await Security.auditLog(this._firm.id, 'data_exported', {type:'full'});
    } catch(e) { Toast.error('Export failed: '+e.message); }
  },
};
