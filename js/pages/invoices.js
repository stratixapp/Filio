// js/pages/invoices.js — Full invoice management + PDF print + WhatsApp share

const InvoicesPage = {
  _unsub: null, _unsub2: null,
  _invoices: [], _clients: [], _firm: null, _filter: 'all',
  _lines: [], _currentTotalPaise: 0,

  mount(firm) {
    this._firm = firm; this._invoices = []; this._clients = [];
    this._render();
    this._unsub  = FS.subscribeInvoices(firm.id, d => { this._invoices = d; this._renderList(); this._renderSummary(); });
    this._unsub2 = FS.subscribeClients(firm.id,  d => { this._clients = d; });
  },
  unmount() {
    if (this._unsub)  { this._unsub();  this._unsub  = null; }
    if (this._unsub2) { this._unsub2(); this._unsub2 = null; }
  },

  _filtered() {
    return this._filter === 'all' ? this._invoices : this._invoices.filter(i => i.status === this._filter);
  },

  _render() {
    const cnt = Layout.getContentEl(); if (!cnt) return;
    cnt.innerHTML = `
    <div class="section-header" style="margin-bottom:1.5rem">
      <h2 style="font-size:1.5rem;font-weight:600">Invoices</h2>
      <button class="btn btn-primary btn-sm" onclick="InvoicesPage.openCreate()">${Icons.plus} New Invoice</button>
    </div>
    <div id="inv-summary" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:1rem;margin-bottom:1.5rem"></div>
    <div class="tabs" id="inv-tabs" style="margin-bottom:1.25rem;display:inline-flex">
      ${['all','draft','sent','paid','overdue'].map(f=>`
        <button class="tab" data-filter="${f}" onclick="InvoicesPage._setFilter('${f}',this)">${f.charAt(0).toUpperCase()+f.slice(1)}</button>`).join('')}
    </div>
    <div class="card" style="padding:0;overflow:hidden">
      <div class="table-wrap">
        <table>
          <thead><tr><th>Invoice #</th><th>Client</th><th class="table-mobile-hide">Date</th><th>Amount</th><th class="table-mobile-hide">Status</th><th>Actions</th></tr></thead>
          <tbody id="inv-tbody"><tr><td colspan="6" style="text-align:center;padding:3rem"><div class="spinner" style="margin:0 auto"></div></td></tr></tbody>
        </table>
      </div>
    </div>`;
    document.querySelectorAll('#inv-tabs .tab').forEach(b => b.classList.toggle('active', b.dataset.filter === this._filter));
  },

  _renderSummary() {
    const d = document.getElementById('inv-summary'); if (!d) return;
    const sum = arr => arr.reduce((s, i) => s + (i.total || 0), 0);
    const paid = this._invoices.filter(i => i.status === 'paid');
    const sent = this._invoices.filter(i => i.status === 'sent' || i.status === 'overdue');
    d.innerHTML = [
      { label:'Total Invoices', val: this._invoices.length,    color:'--blue'   },
      { label:'Outstanding',    val: Fmt.moneyNum(sum(sent)),  color:'--amber'  },
      { label:'Collected',      val: Fmt.moneyNum(sum(paid)),  color:'--green'  },
      { label:'Drafts',         val: this._invoices.filter(i=>i.status==='draft').length, color:'--purple' },
    ].map(s=>`<div class="card" style="padding:1rem">
      <div style="font-size:1.375rem;font-weight:700;color:var(${s.color})">${s.val}</div>
      <div style="font-size:.8rem;color:var(--text-muted);margin-top:.2rem">${s.label}</div>
    </div>`).join('');
  },

  _renderList() {
    const tbody = document.getElementById('inv-tbody'); if (!tbody) return;
    const filtered = this._filtered();
    while (tbody.firstChild) tbody.removeChild(tbody.firstChild);

    if (!filtered.length) {
      const tr = document.createElement('tr');
      const td = document.createElement('td'); td.colSpan = 6;
      const label = this._filter !== 'all' ? `No ${this._filter} invoices` : 'No invoices yet';
      const empty = DOM.emptyState(Icons.invoices, label);
      if (this._filter === 'all') {
        const btn = document.createElement('button');
        btn.className = 'btn btn-primary btn-sm'; btn.style.marginTop = '.75rem'; btn.textContent = 'New Invoice';
        btn.addEventListener('click', () => InvoicesPage.openCreate());
        empty.appendChild(btn);
      }
      td.appendChild(empty); tr.appendChild(td); tbody.appendChild(tr);
      return;
    }

    const printSVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>`;
    const waSVG    = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/></svg>`;

    const frag = document.createDocumentFragment();
    filtered.forEach(inv => {
      const tr = document.createElement('tr');
      const invNoTd = document.createElement('td');
      const invNoSpan = document.createElement('span');
      invNoSpan.style.cssText = 'font-family:var(--font-mono);font-size:.8rem;color:var(--gold)';
      invNoSpan.textContent = inv.invoiceNo || '—';
      invNoTd.appendChild(invNoSpan);
      const clientTd = document.createElement('td'); clientTd.style.fontWeight = '500'; clientTd.textContent = inv.clientName || '—';
      const dateTd = document.createElement('td'); dateTd.className = 'table-mobile-hide'; dateTd.style.color = 'var(--text-secondary)'; dateTd.textContent = Fmt.date(inv.date || inv.createdAt);
      const amtTd = document.createElement('td'); amtTd.style.fontWeight = '600'; amtTd.textContent = Fmt.money(inv.total);
      const statusTd = document.createElement('td'); statusTd.className = 'table-mobile-hide'; statusTd.appendChild(DOM.statusBadge(inv.status));
      const actionsTd = document.createElement('td');
      const actWrap = document.createElement('div'); actWrap.style.cssText = 'display:flex;gap:.25rem;align-items:center';
      if (inv.status === 'draft') {
        const sendBtn = document.createElement('button'); sendBtn.className = 'btn btn-ghost btn-sm'; sendBtn.style.fontSize = '.75rem'; sendBtn.textContent = 'Send';
        sendBtn.addEventListener('click', () => InvoicesPage._markSent(inv.id)); actWrap.appendChild(sendBtn);
      }
      if (inv.status === 'sent') {
        const paidBtn = document.createElement('button'); paidBtn.className = 'btn btn-ghost btn-sm'; paidBtn.style.cssText = 'font-size:.75rem;color:var(--green)'; paidBtn.textContent = 'Paid ✓';
        paidBtn.addEventListener('click', () => InvoicesPage._markPaid(inv.id)); actWrap.appendChild(paidBtn);
      }
      const printBtn = DOM.actionBtn(printSVG, 'Print / PDF', () => InvoicesPage.printInvoice(inv.id)); printBtn.style.color = 'var(--text-secondary)';
      const waBtn    = DOM.actionBtn(waSVG,    'WhatsApp',    () => InvoicesPage.whatsappShare(inv.id)); waBtn.style.color = '#25D366';
      const editBtn  = DOM.actionBtn(Icons.edit,  'Edit',   () => InvoicesPage.openEdit(inv.id));
      const delBtn   = DOM.actionBtn(Icons.trash, 'Delete', () => InvoicesPage.openDelete(inv.id, inv.invoiceNo || '')); delBtn.style.color = 'var(--red)';
      actWrap.append(printBtn, waBtn, editBtn, delBtn);
      actionsTd.appendChild(actWrap);
      tr.append(invNoTd, clientTd, dateTd, amtTd, statusTd, actionsTd);
      frag.appendChild(tr);
    });
    tbody.appendChild(frag);
  },

  _setFilter(f, btn) {
    this._filter = f;
    document.querySelectorAll('#inv-tabs .tab').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    this._renderList();
  },

  _nextNo() {
    const nums = this._invoices.map(i => parseInt((i.invoiceNo||'').replace(/\D/g,''))).filter(n => !isNaN(n));
    const max  = nums.length ? Math.max(...nums) : 0;
    const yr   = new Date().getFullYear().toString().slice(-2);
    return `INV-${yr}-${String(max+1).padStart(4,'0')}`;
  },

  openCreate() { this._showModal(null); },
  openEdit(id) { this._showModal(this._invoices.find(i => i.id === id)); },

  _showModal(inv) {
    const isEdit = !!inv;
    this._lines = inv?.lines ? inv.lines.map(l=>({...l})) : [{ desc:'', qty:1, rate:0 }];
    const clientOpts = this._clients.map(c =>
      `<option value="${c.id}" data-name="${esc(c.name)}" data-gstin="${esc(c.gstin||'')}" ${inv?.clientId===c.id?'selected':''}>${esc(c.name)}</option>`).join('');

    // Determine if inter-state (client state vs firm state)
    const firmState = this._firm?.state || 'Kerala';

    showModal(`
      <div class="modal-header">
        <h3 class="modal-title">${isEdit?'Edit Invoice':'New Invoice'}</h3>
        <button class="modal-close" onclick="closeModal()">${Icons.x}</button>
      </div>
      <div class="grid-2">
        <div class="input-group">
          <label class="input-label">Invoice No *</label>
          <input class="input" id="if-no" value="${esc(inv?.invoiceNo||this._nextNo())}" />
        </div>
        <div class="input-group">
          <label class="input-label">Date *</label>
          <input class="input" id="if-date" type="date" value="${inv?.dateStr||new Date().toISOString().slice(0,10)}" />
        </div>
      </div>
      <div class="input-group">
        <label class="input-label">Client *</label>
        <select class="input" id="if-client" onchange="InvoicesPage._onClientChange()">
          <option value="">— Select client —</option>${clientOpts}
        </select>
      </div>
      <div class="input-group">
        <label class="input-label">HSN / SAC Code <span style="color:var(--text-muted);font-size:.75rem">(optional)</span></label>
        <input class="input" id="if-hsn" value="${esc(inv?.hsn||'998231')}" placeholder="e.g. 998231 for CA services" />
      </div>

      <!-- Line items -->
      <div style="margin:.875rem 0">
        <label class="input-label" style="display:block;margin-bottom:.5rem">Line Items</label>
        <div id="if-lines">${this._lines.map((l,i)=>this._lineRow(i,l)).join('')}</div>
        <button class="btn btn-ghost btn-sm" style="margin-top:.375rem" onclick="InvoicesPage._addLine()">${Icons.plus} Add line</button>
      </div>

      <!-- Totals with CGST/SGST/IGST -->
      <div style="background:var(--bg-hover);border-radius:var(--r-md);padding:.875rem;margin-bottom:.875rem">
        <div style="display:flex;justify-content:space-between;margin-bottom:.375rem">
          <span style="font-size:.875rem;color:var(--text-muted)">Subtotal</span>
          <span id="if-subtotal" style="font-size:.875rem">₹0.00</span>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.375rem">
          <span style="font-size:.875rem;color:var(--text-muted)">GST Rate</span>
          <select class="input" id="if-gst" style="width:90px;padding:.375rem .5rem" onchange="InvoicesPage._calcTotal()">
            ${[0,5,12,18,28].map(r=>`<option value="${r}" ${(inv?.gstRate||18)===r?'selected':''}>${r===0?'None':r+'%'}</option>`).join('')}
          </select>
        </div>
        <!-- CGST/SGST or IGST breakdown -->
        <div id="if-gst-breakdown" style="font-size:.8rem;color:var(--text-muted);margin-bottom:.375rem"></div>
        <div class="gold-divider"></div>
        <div style="display:flex;justify-content:space-between;margin-top:.5rem">
          <span style="font-weight:600">Total</span>
          <span id="if-total" style="font-weight:700;font-size:1.1rem;color:var(--gold)">₹0.00</span>
        </div>
      </div>

      <div class="input-group">
        <label class="input-label">Notes / Payment Terms</label>
        <textarea class="input" id="if-notes" rows="2" placeholder="e.g. Payment due within 30 days. Bank: HDFC IFSC: HDFC0001234">${esc(inv?.notes||this._firm?.invoiceTerms||'')}</textarea>
      </div>
      <div class="input-group">
        <label class="input-label">Status</label>
        <select class="input" id="if-status">
          ${['draft','sent','paid','overdue','cancelled'].map(s=>
            `<option value="${s}" ${(inv?.status||'draft')===s?'selected':''}>${s.charAt(0).toUpperCase()+s.slice(1)}</option>`).join('')}
        </select>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" id="if-save-btn" onclick="InvoicesPage._save('${isEdit?inv.id:''}')">${isEdit?'Save Changes':'Create Invoice'}</button>
      </div>`);

    this._calcTotal();
  },

  _onClientChange() {
    this._calcTotal(); // CGST/SGST vs IGST depends on client state
  },

  _lineRow(i, l) {
    return `<div style="display:grid;grid-template-columns:1fr 64px 96px 28px;gap:.3rem;margin-bottom:.3rem;align-items:center" id="line-${i}">
      <input class="input" style="padding:.45rem .6rem;font-size:.875rem" placeholder="Description" value="${esc(l.desc||'')}" oninput="InvoicesPage._updLine(${i},'desc',this.value)" />
      <input class="input" style="padding:.45rem .5rem;text-align:right;font-size:.875rem" type="number" min="1" value="${l.qty||1}" oninput="InvoicesPage._updLine(${i},'qty',this.value)" />
      <input class="input" style="padding:.45rem .5rem;text-align:right;font-size:.875rem" type="number" min="0" step="0.01" value="${l.rate||0}" placeholder="₹ Rate" oninput="InvoicesPage._updLine(${i},'rate',this.value)" />
      <button class="btn btn-icon btn-ghost" style="color:var(--red);padding:.3rem" onclick="InvoicesPage._removeLine(${i})">${Icons.x}</button>
    </div>`;
  },

  _addLine() {
    this._lines.push({ desc:'', qty:1, rate:0 });
    const c = document.getElementById('if-lines');
    if (c) c.insertAdjacentHTML('beforeend', this._lineRow(this._lines.length-1, this._lines[this._lines.length-1]));
    this._calcTotal();
  },
  _removeLine(i) {
    this._lines.splice(i, 1);
    const c = document.getElementById('if-lines');
    if (c) c.innerHTML = this._lines.map((l,idx) => this._lineRow(idx, l)).join('');
    this._calcTotal();
  },
  _updLine(i, f, v) {
    if (!this._lines[i]) return;
    this._lines[i][f] = (f==='qty'||f==='rate') ? (parseFloat(v)||0) : v;
    this._calcTotal();
  },

  _isInterState() {
    const cli     = document.getElementById('if-client');
    const cliId   = cli?.value;
    const client  = this._clients.find(c => c.id === cliId);
    const cliState = client?.state || '';
    const firmState = this._firm?.state || 'Kerala';
    return cliState && cliState !== firmState;
  },

  _calcTotal() {
    const sub      = this._lines.reduce((s,l) => s + (parseFloat(l.qty)||0)*(parseFloat(l.rate)||0), 0);
    const gstRate  = parseFloat(document.getElementById('if-gst')?.value || 0);
    const taxAmt   = sub * gstRate / 100;
    const total    = sub + taxAmt;
    const fmt      = v => '₹'+v.toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});
    const interState = this._isInterState();

    const subEl = document.getElementById('if-subtotal');
    const totEl = document.getElementById('if-total');
    const brkEl = document.getElementById('if-gst-breakdown');

    if (subEl) subEl.textContent = fmt(sub);
    if (totEl) totEl.textContent = fmt(total);

    if (brkEl && gstRate > 0) {
      if (interState) {
        brkEl.innerHTML = `<div style="display:flex;justify-content:space-between"><span>IGST @${gstRate}%</span><span>${fmt(taxAmt)}</span></div>`;
      } else {
        const half = taxAmt / 2;
        brkEl.innerHTML = `
          <div style="display:flex;justify-content:space-between;margin-bottom:.2rem"><span>CGST @${gstRate/2}%</span><span>${fmt(half)}</span></div>
          <div style="display:flex;justify-content:space-between"><span>SGST @${gstRate/2}%</span><span>${fmt(half)}</span></div>`;
      }
    } else if (brkEl) { brkEl.innerHTML = ''; }

    this._currentTotalPaise = Math.round(total * 100);
    this._interState = interState;
    this._lastSub = sub;
    this._lastGst = gstRate;
  },

  async _save(editId) {
    const no    = document.getElementById('if-no')?.value.trim();
    const cli   = document.getElementById('if-client');
    const cliId = cli?.value;
    const cliNm = cliId ? (cli.options[cli.selectedIndex]?.dataset?.name||'') : '';
    if (!no)    { Toast.error('Invoice number required'); return; }
    if (!cliId) { Toast.error('Select a client');         return; }

    const dateVal  = document.getElementById('if-date')?.value;
    const gstRate  = parseFloat(document.getElementById('if-gst')?.value||0);
    const sub      = this._lines.reduce((s,l)=>s+(parseFloat(l.qty)||0)*(parseFloat(l.rate)||0),0);
    const taxAmt   = sub * gstRate / 100;
    const interState = this._interState || false;

    const data = {
      invoiceNo: no, clientId: cliId, clientName: cliNm,
      hsn:       document.getElementById('if-hsn')?.value.trim()||'',
      dateStr:   dateVal,
      date:      dateVal ? firebase.firestore.Timestamp.fromDate(new Date(dateVal)) : null,
      lines:     this._lines,
      subtotal:  Math.round(sub*100),
      gstRate,
      tax:       Math.round(taxAmt*100),
      total:     this._currentTotalPaise || Math.round((sub+taxAmt)*100),
      interState,
      cgst:      interState ? 0 : Math.round(taxAmt/2*100),
      sgst:      interState ? 0 : Math.round(taxAmt/2*100),
      igst:      interState ? Math.round(taxAmt*100) : 0,
      notes:     document.getElementById('if-notes')?.value.trim()||'',
      status:    document.getElementById('if-status')?.value||'draft',
    };

    const btn = document.getElementById('if-save-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }

    if (editId) {
      const existing = this._invoices.find(i => i.id === editId);
      if (existing && existing.status !== data.status) {
        try { DataIntegrity.assertValidTransition('invoice', existing.status, data.status); }
        catch(e) {
          Toast.error(e.message.replace('VALIDATION: ',''));
          if (btn) { btn.disabled = false; btn.textContent = 'Save Changes'; }
          return;
        }
      }
    }

    const _existing   = editId ? this._invoices.find(i => i.id === editId) : null;
    const conflictRef = editId
      ? db.collection('firms').doc(this._firm.id).collection('invoices').doc(editId)
      : null;

    await DataIntegrity.safeWrite({
      validate:       () => DataIntegrity.Validators.invoice(data),
      conflictRef,
      localUpdatedAt: _existing?.updatedAt || null,
      label:          editId ? 'updateInvoice' : 'addInvoice',
      write: async () => {
        if (editId) await FS.updateInvoice(this._firm.id, editId, data);
        else        await FS.addInvoice(this._firm.id, data);
      },
      onSuccess: () => {
        Toast.success(editId ? 'Invoice updated' : 'Invoice created');
        AuditTrail.logInvoiceCreated(this._firm.id, editId || 'new', data.invoiceNo || '').catch(()=>{});
        closeModal();
      },
      onError:   () => { if (btn) { btn.disabled = false; btn.textContent = editId ? 'Save Changes' : 'Create Invoice'; } },
    });
  },
  async _markSent(id) {
    const inv = this._invoices.find(i => i.id === id);
    try { DataIntegrity.assertValidTransition('invoice', inv?.status || 'draft', 'sent'); }
    catch(e) { Toast.error(e.message.replace('VALIDATION: ','')); return; }
    await DataIntegrity.safeWrite({
      label: 'markSent',
      write: async () => FS.updateInvoice(this._firm.id, id, { status: 'sent' }),
      onSuccess: () => Toast.success('Marked as sent'),
    });
  },
  async _markPaid(id) {
    const inv = this._invoices.find(i => i.id === id);
    try { DataIntegrity.assertValidTransition('invoice', inv?.status || 'sent', 'paid'); }
    catch(e) { Toast.error(e.message.replace('VALIDATION: ','')); return; }
    await DataIntegrity.safeWrite({
      label: 'markPaid',
      write: async () => FS.updateInvoice(this._firm.id, id, {
        status: 'paid',
        paidAt: firebase.firestore.FieldValue.serverTimestamp(),
      }),
      onSuccess: () => { Toast.success('Marked as paid!'); const inv = this._invoices.find(i=>i.id===id); AuditTrail.logInvoicePaid(this._firm.id, id, inv?.invoiceNo||'').catch(()=>{}); },
    });
  },

  // ── PRINT / PDF ─────────────────────────────────────────────
  printInvoice(id) {
    const inv  = this._invoices.find(i => i.id === id);
    const firm = this._firm;
    if (!inv || !firm) return;

    const sub      = (inv.subtotal||0) / 100;
    const tax      = (inv.tax||0)      / 100;
    const total    = (inv.total||0)    / 100;
    const fmt      = v => '₹'+Number(v).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});
    const interState = inv.interState || false;

    const lineRows = (inv.lines||[]).map((l,i) => {
      const amt = (parseFloat(l.qty)||0) * (parseFloat(l.rate)||0);
      return `<tr>
        <td style="padding:.5rem .75rem;border-bottom:1px solid #e8e0d0">${i+1}</td>
        <td style="padding:.5rem .75rem;border-bottom:1px solid #e8e0d0">${esc(l.desc||'')}</td>
        <td style="padding:.5rem .75rem;border-bottom:1px solid #e8e0d0;text-align:center">${esc(String(inv.hsn||''))}</td>
        <td style="padding:.5rem .75rem;border-bottom:1px solid #e8e0d0;text-align:right">${l.qty||1}</td>
        <td style="padding:.5rem .75rem;border-bottom:1px solid #e8e0d0;text-align:right">${fmt(l.rate||0)}</td>
        <td style="padding:.5rem .75rem;border-bottom:1px solid #e8e0d0;text-align:right;font-weight:600">${fmt(amt)}</td>
      </tr>`;
    }).join('');

    const gstRows = inv.gstRate > 0 ? (interState ? `
      <tr><td colspan="5" style="padding:.4rem .75rem;text-align:right;color:#666">IGST @${inv.gstRate}%</td><td style="padding:.4rem .75rem;text-align:right">${fmt(tax)}</td></tr>
    ` : `
      <tr><td colspan="5" style="padding:.4rem .75rem;text-align:right;color:#666">CGST @${inv.gstRate/2}%</td><td style="padding:.4rem .75rem;text-align:right">${fmt(tax/2)}</td></tr>
      <tr><td colspan="5" style="padding:.4rem .75rem;text-align:right;color:#666">SGST @${inv.gstRate/2}%</td><td style="padding:.4rem .75rem;text-align:right">${fmt(tax/2)}</td></tr>
    `) : '';

    const html = `<!DOCTYPE html><html><head>
      <meta charset="UTF-8"/>
      <title>Invoice ${esc(inv.invoiceNo||'')}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=Cormorant+Garamond:wght@600;700&display=swap');
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:'DM Sans',sans-serif;font-size:13px;color:#1a1a1a;background:white;padding:2.5rem}
        .inv-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:2.5rem;padding-bottom:1.5rem;border-bottom:2px solid #C9A84C}
        .firm-name{font-family:'Cormorant Garamond',serif;font-size:1.75rem;font-weight:700;color:#0A1628;margin-bottom:.25rem}
        .inv-title{font-family:'Cormorant Garamond',serif;font-size:2rem;font-weight:700;color:#C9A84C;text-align:right}
        .inv-meta{text-align:right;margin-top:.5rem;color:#555;line-height:1.8;font-size:.8125rem}
        .section{display:flex;gap:3rem;margin-bottom:2rem}
        .section-block{flex:1}
        .section-label{font-size:.7rem;text-transform:uppercase;letter-spacing:.08em;color:#999;font-weight:600;margin-bottom:.5rem}
        .section-val{font-size:.875rem;line-height:1.7;color:#333}
        table{width:100%;border-collapse:collapse;margin-bottom:1rem}
        thead th{background:#0A1628;color:white;padding:.625rem .75rem;font-size:.75rem;text-transform:uppercase;letter-spacing:.05em;font-weight:600;text-align:left}
        thead th:nth-child(n+4){text-align:right}
        .total-row td{padding:.5rem .75rem;font-weight:700;font-size:1rem;border-top:2px solid #C9A84C;color:#0A1628}
        .notes{background:#FDF8F0;border:1px solid #e8e0d0;border-radius:8px;padding:1rem;margin-top:1.5rem;font-size:.8125rem;color:#555;line-height:1.7}
        .badge{display:inline-block;padding:.2rem .625rem;border-radius:20px;font-size:.72rem;font-weight:600;text-transform:uppercase;letter-spacing:.05em}
        .badge-paid{background:#d4edda;color:#155724}
        .badge-sent{background:#cce5ff;color:#004085}
        .badge-draft{background:#f8f9fa;color:#666}
        .badge-overdue{background:#f8d7da;color:#721c24}
        @media print{body{padding:1.5rem}@page{margin:.75cm}}
      </style>
    </head><body>
      <div class="inv-header">
        <div>
          ${firm.logoURL ? `<img src="${esc(firm.logoURL)}" style="height:48px;object-fit:contain;margin-bottom:.5rem;display:block" onerror="this.style.display='none'" />` : ''}
          <div class="firm-name">${esc(firm.name||'')}</div>
          <div style="font-size:.8125rem;color:#555;line-height:1.8;margin-top:.25rem">
            ${firm.ownerName ? esc(firm.ownerName)+'<br/>' : ''}
            ${firm.address ? esc(firm.address)+'<br/>' : ''}
            ${firm.city ? esc(firm.city)+', ' : ''}${firm.state ? esc(firm.state)+'<br/>' : ''}
            ${firm.phone ? '📞 '+esc(firm.phone)+'<br/>' : ''}
            ${firm.email ? '✉ '+esc(firm.email)+'<br/>' : ''}
            ${firm.gstin ? '<strong>GSTIN:</strong> '+esc(firm.gstin) : ''}
          </div>
        </div>
        <div>
          <div class="inv-title">TAX INVOICE</div>
          <div class="inv-meta">
            <strong>${esc(inv.invoiceNo||'')}</strong><br/>
            Date: ${Fmt.date(inv.date||inv.createdAt)}<br/>
            <span class="badge badge-${inv.status||'draft'}">${inv.status||'draft'}</span>
          </div>
        </div>
      </div>

      <div class="section">
        <div class="section-block">
          <div class="section-label">Bill To</div>
          <div class="section-val">
            <strong>${esc(inv.clientName||'')}</strong><br/>
            ${(() => { const c = this._clients.find(x=>x.id===inv.clientId); return c ? [c.address,c.city,c.state].filter(Boolean).map(esc).join(', ')+'<br/>'+(c.gstin?'GSTIN: '+esc(c.gstin):'') : ''; })()}
          </div>
        </div>
        ${firm.gstin ? `<div class="section-block"><div class="section-label">Supply Type</div><div class="section-val">${interState?'Inter-State Supply (IGST)':'Intra-State Supply (CGST + SGST)'}</div></div>` : ''}
      </div>

      <table>
        <thead><tr><th>#</th><th>Description</th><th>HSN/SAC</th><th style="text-align:right">Qty</th><th style="text-align:right">Rate</th><th style="text-align:right">Amount</th></tr></thead>
        <tbody>${lineRows}</tbody>
        <tfoot>
          <tr><td colspan="5" style="padding:.4rem .75rem;text-align:right;color:#666">Subtotal</td><td style="padding:.4rem .75rem;text-align:right">${fmt(sub)}</td></tr>
          ${gstRows}
          <tr class="total-row"><td colspan="5" style="text-align:right">TOTAL</td><td style="text-align:right;color:#C9A84C">${fmt(total)}</td></tr>
        </tfoot>
      </table>

      ${inv.notes ? `<div class="notes"><strong>Notes / Terms:</strong><br/>${esc(inv.notes)}</div>` : ''}
      <div style="margin-top:2rem;text-align:center;font-size:.72rem;color:#bbb;border-top:1px solid #e8e0d0;padding-top:1rem">
        This is a computer-generated invoice. Thank you for your business.
      </div>

      <script>window.onload=()=>window.print();<\/script>
    </body></html>`;

    const w = window.open('', '_blank', 'width=900,height=700');
    if (w) { w.document.write(html); w.document.close(); }
    else   Toast.error('Popup blocked. Allow popups to print invoices.');
  },

  // ── WHATSAPP SHARE ───────────────────────────────────────────
  whatsappShare(id) {
    const inv  = this._invoices.find(i => i.id === id);
    const firm = this._firm;
    if (!inv) return;

    const total    = Fmt.money(inv.total);
    const date     = Fmt.date(inv.date || inv.createdAt);
    const status   = inv.status || 'draft';
    const firmName = firm?.name || 'CA Firm';
    const phone    = this._clients.find(c => c.id === inv.clientId)?.phone || '';

    const msg = encodeURIComponent(
`*Invoice from ${firmName}*

Invoice No: ${inv.invoiceNo || '—'}
Date: ${date}
Amount: *${total}*
Status: ${status.toUpperCase()}

${inv.notes ? 'Terms: ' + inv.notes + '\n' : ''}
Please contact us for any queries.
Thank you for your business! 🙏`);

    const url = phone
      ? `https://wa.me/91${phone.replace(/\D/g,'')}?text=${msg}`
      : `https://wa.me/?text=${msg}`;

    window.open(url, '_blank');
  },

  openDelete(id, no) {
    showModal(`
      <div class="modal-header"><h3 class="modal-title">Delete Invoice</h3><button class="modal-close" onclick="closeModal()">${Icons.x}</button></div>
      <p style="color:var(--text-secondary)">Delete invoice <strong style="color:var(--text-primary)">${esc(no)}</strong>? This cannot be undone.</p>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button class="btn btn-danger" onclick="InvoicesPage._confirmDelete('${id}')">Delete</button>
      </div>`);
  },
  async _confirmDelete(id) {
    await DataIntegrity.safeWrite({
      label:     'deleteInvoice',
      write:     async () => FS.deleteInvoice(this._firm.id, id),
      onSuccess: () => { Toast.success('Invoice deleted'); closeModal(); },
    });
  },
};
