// js/pages/tasks.js — Fixed: global event bug

const TasksPage = {
  _unsub: null, _unsub2: null,
  _tasks: [], _clients: [], _firm: null,
  _filter: 'all', _search: '',

  mount(firm) {
    this._firm = firm; this._tasks = []; this._clients = [];
    this._render();
    this._unsub  = FS.subscribeTasks(firm.id,   d => { this._tasks   = d; this._renderList(); });
    this._unsub2 = FS.subscribeClients(firm.id, d => { this._clients = d; });
  },
  unmount() {
    if (this._unsub)  { this._unsub();  this._unsub  = null; }
    if (this._unsub2) { this._unsub2(); this._unsub2 = null; }
  },

  _filtered() {
    const q = this._search.toLowerCase();
    return this._tasks.filter(t => {
      const ms = !q || (t.title||'').toLowerCase().includes(q) || (t.clientName||'').toLowerCase().includes(q);
      const mf = this._filter==='all' || t.status===this._filter;
      return ms && mf;
    });
  },

  _render() {
    const cnt = Layout.getContentEl(); if (!cnt) return;
    const pending    = this._tasks.filter(t=>t.status==='pending').length;
    const inProgress = this._tasks.filter(t=>t.status==='in_progress').length;
    const done       = this._tasks.filter(t=>t.status==='done').length;
    const overdue    = this._tasks.filter(t=>{ if(t.status==='done') return false; const d=t.dueDate?.toDate?.(); return d&&d<new Date(); }).length;

    cnt.innerHTML = `
    <div class="section-header" style="margin-bottom:1.5rem">
      <h2 style="font-size:1.5rem;font-weight:600">Tasks</h2>
      <button class="btn btn-primary btn-sm" onclick="TasksPage.openAdd()">${Icons.plus} Add Task</button>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:1rem;margin-bottom:1.5rem">
      ${[['Pending',pending,'--amber'],['In Progress',inProgress,'--blue'],['Done',done,'--green'],['Overdue',overdue,'--red']].map(([l,v,c])=>`
        <div class="card" style="padding:1rem">
          <div style="font-size:1.5rem;font-weight:700;color:var(${c})">${v}</div>
          <div style="font-size:.8rem;color:var(--text-muted);margin-top:.2rem">${l}</div>
        </div>`).join('')}
    </div>
    <div style="display:flex;gap:.75rem;margin-bottom:1.25rem;flex-wrap:wrap;align-items:center">
      <div class="tabs" id="task-tabs">
        ${[['all','All'],['pending','Pending'],['in_progress','In Progress'],['done','Done']].map(([v,l])=>`
          <button class="tab" data-filter="${v}" onclick="TasksPage._setFilter('${v}',this)">${l}</button>`).join('')}
      </div>
      <div class="search-bar" style="max-width:260px">
        ${Icons.search}
        <input type="text" placeholder="Search tasks…" oninput="TasksPage._onSearch(this.value)" />
      </div>
    </div>
    <div class="card" style="padding:0;overflow:hidden">
      <div class="table-wrap">
        <table>
          <thead><tr><th>Task</th><th class="table-mobile-hide">Client</th><th class="table-mobile-hide">Priority</th><th class="table-mobile-hide">Due Date</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody id="tasks-tbody"><tr><td colspan="6" style="text-align:center;padding:3rem"><div class="spinner" style="margin:0 auto"></div></td></tr></tbody>
        </table>
      </div>
    </div>`;
    document.querySelectorAll('#task-tabs .tab').forEach(b=>b.classList.toggle('active',b.dataset.filter===this._filter));
  },

  _renderList() {
    const tbody = document.getElementById('tasks-tbody'); if (!tbody) return;
    const filtered = this._filtered();

    while (tbody.firstChild) tbody.removeChild(tbody.firstChild);

    if (!filtered.length) {
      const tr = document.createElement('tr');
      const td = document.createElement('td'); td.colSpan = 6;
      const empty = DOM.emptyState(Icons.tasks, this._search ? 'No matches' : 'No tasks yet');
      if (!this._search) {
        const btn = document.createElement('button');
        btn.className = 'btn btn-primary btn-sm'; btn.style.marginTop = '.75rem'; btn.textContent = 'Add Task';
        btn.addEventListener('click', () => TasksPage.openAdd());
        empty.appendChild(btn);
      }
      td.appendChild(empty); tr.appendChild(td); tbody.appendChild(tr);
      return;
    }

    const now = new Date();
    const frag = document.createDocumentFragment();
    filtered.forEach(t => {
      const due = t.dueDate?.toDate?.();
      const isOverdue = due && due < now && t.status !== 'done';

      const tr = document.createElement('tr');

      // Title + description
      const titleTd = document.createElement('td');
      const titleEl = document.createElement('div'); titleEl.style.fontWeight = '500'; titleEl.textContent = t.title || '—';
      titleTd.appendChild(titleEl);
      if (t.description) {
        const descEl = document.createElement('div');
        descEl.style.cssText = 'font-size:.72rem;color:var(--text-muted);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
        descEl.textContent = t.description;
        titleTd.appendChild(descEl);
      }

      const clientTd = document.createElement('td'); clientTd.className = 'table-mobile-hide'; clientTd.style.color = 'var(--text-secondary)'; clientTd.textContent = t.clientName || '—';
      const priorityTd = document.createElement('td'); priorityTd.className = 'table-mobile-hide'; priorityTd.appendChild(DOM.priorityBadge(t.priority));
      const dueTd = document.createElement('td'); dueTd.className = 'table-mobile-hide'; dueTd.style.color = isOverdue ? 'var(--red)' : 'var(--text-secondary)';
      dueTd.textContent = due ? Fmt.date(t.dueDate) + (isOverdue ? ' ⚠' : '') : '—';
      const statusTd = document.createElement('td'); statusTd.appendChild(DOM.statusBadge(t.status));

      // Actions — closures capture t.id safely
      const actionsTd = document.createElement('td');
      const actWrap = document.createElement('div'); actWrap.style.cssText = 'display:flex;gap:.25rem;align-items:center';
      if (t.status === 'pending') {
        const startBtn = document.createElement('button');
        startBtn.className = 'btn btn-ghost btn-sm'; startBtn.style.fontSize = '.75rem'; startBtn.textContent = 'Start';
        startBtn.addEventListener('click', () => TasksPage._advance(t.id, 'in_progress'));
        actWrap.appendChild(startBtn);
      }
      if (t.status === 'in_progress') {
        const doneBtn = document.createElement('button');
        doneBtn.className = 'btn btn-ghost btn-sm'; doneBtn.style.cssText = 'font-size:.75rem;color:var(--green)'; doneBtn.textContent = 'Done ✓';
        doneBtn.addEventListener('click', () => TasksPage._advance(t.id, 'done'));
        actWrap.appendChild(doneBtn);
      }
      actWrap.append(
        DOM.actionBtn(Icons.edit,  'Edit',   () => TasksPage.openEdit(t.id)),
        DOM.actionBtn(Icons.trash, 'Delete', () => TasksPage.openDelete(t.id, t.title || ''), 'btn-icon btn-ghost text-red')
      );
      actWrap.lastElementChild.style.color = 'var(--red)';
      actionsTd.appendChild(actWrap);

      tr.append(titleTd, clientTd, priorityTd, dueTd, statusTd, actionsTd);
      frag.appendChild(tr);
    });
    tbody.appendChild(frag);
  },

  // FIX: pass btn, no global event
  _setFilter(f, btn) {
    this._filter = f;
    document.querySelectorAll('#task-tabs .tab').forEach(b=>b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    this._renderList();
  },
  _onSearch(v) { this._search = v; this._renderList(); },

  async _advance(id, status) {
    const task = this._tasks.find(t => t.id === id);
    try {
      DataIntegrity.assertValidTransition('task', task?.status || 'pending', status);
    } catch (e) {
      Toast.error(e.message.replace('VALIDATION: ', ''));
      return;
    }
    await DataIntegrity.safeWrite({
      label: 'advanceTask',
      conflictRef:    db.collection('firms').doc(this._firm.id).collection('tasks').doc(id),
      localUpdatedAt: task?.updatedAt || null,
      write: async () => FS.updateTask(this._firm.id, id, {
        status,
        ...(status === 'done' ? {
          completedAt:     firebase.firestore.FieldValue.serverTimestamp(),
          completedBy:     auth.currentUser?.uid || '',
          completedByName: auth.currentUser?.displayName || '',
        } : {}),
      }),
      onSuccess: () => Toast.success(status === 'done' ? 'Task completed! ✓' : 'Task started'),
    });
  },

  openAdd()    { this._showModal(null); },
  openEdit(id) { this._showModal(this._tasks.find(t=>t.id===id)); },

  _showModal(task) {
    const isEdit = !!task;
    const cliOpts = this._clients.map(c=>
      `<option value="${c.id}" data-name="${esc(c.name)}" ${task?.clientId===c.id?'selected':''}>${esc(c.name)}</option>`).join('');
    const dueStr = task?.dueDate ? task.dueDate.toDate().toISOString().slice(0,10) : '';

    showModal(`
      <div class="modal-header">
        <h3 class="modal-title">${isEdit?'Edit Task':'Add Task'}</h3>
        <button class="modal-close" onclick="closeModal()">${Icons.x}</button>
      </div>
      <div class="input-group">
        <label class="input-label">Task Title *</label>
        <input class="input" id="tf-title" value="${esc(task?.title||'')}" placeholder="e.g. File GSTR-1 for March" />
      </div>
      <div class="input-group">
        <label class="input-label">Description</label>
        <textarea class="input" id="tf-desc" rows="2" placeholder="Instructions, notes…">${esc(task?.description||'')}</textarea>
      </div>
      <div class="grid-2">
        <div class="input-group">
          <label class="input-label">Client</label>
          <select class="input" id="tf-client"><option value="">— No client —</option>${cliOpts}</select>
        </div>
        <div class="input-group">
          <label class="input-label">Due Date</label>
          <input class="input" id="tf-due" type="date" value="${dueStr}" />
        </div>
      </div>
      <div class="grid-2">
        <div class="input-group">
          <label class="input-label">Priority</label>
          <select class="input" id="tf-priority">
            ${['high','medium','low'].map(p=>`<option value="${p}" ${(task?.priority||'medium')===p?'selected':''}>${p.charAt(0).toUpperCase()+p.slice(1)}</option>`).join('')}
          </select>
        </div>
        <div class="input-group">
          <label class="input-label">Status</label>
          <select class="input" id="tf-status">
            ${[['pending','Pending'],['in_progress','In Progress'],['done','Done']].map(([v,l])=>
              `<option value="${v}" ${(task?.status||'pending')===v?'selected':''}>${l}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" id="tf-save-btn" onclick="TasksPage._save('${isEdit?task.id:''}')">${isEdit?'Save Changes':'Add Task'}</button>
      </div>`);
  },

  async _save(editId) {
    const data = {
      title:       el('tf-title')?.value.trim()      || '',
      clientId:    el('tf-client')?.value            || '',
      clientName:  el('tf-client')?.selectedOptions?.[0]?.text || '',
      priority:    el('tf-priority')?.value          || 'medium',
      status:      el('tf-status')?.value            || 'pending',
      assignedTo:  el('tf-assigned')?.value          || '',
      assignedName:el('tf-assigned')?.selectedOptions?.[0]?.text || '',
      description: el('tf-desc')?.value.trim()       || '',
      dueDate:     el('tf-due')?.value
        ? firebase.firestore.Timestamp.fromDate(new Date(el('tf-due').value))
        : null,
    };

    const btn = el('tf-save-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }

    // Status transition guard for edits
    if (editId) {
      const existing = this._tasks.find(t => t.id === editId);
      if (existing && existing.status !== data.status) {
        try { DataIntegrity.assertValidTransition('task', existing.status, data.status); }
        catch (e) {
          Toast.error(e.message.replace('VALIDATION: ', ''));
          if (btn) { btn.disabled = false; btn.textContent = 'Save Changes'; }
          return;
        }
      }
    }

    const existing  = editId ? this._tasks.find(t => t.id === editId) : null;
    const conflictRef = editId
      ? db.collection('firms').doc(this._firm.id).collection('tasks').doc(editId)
      : null;

    await DataIntegrity.safeWrite({
      validate:       () => DataIntegrity.Validators.task(data),
      conflictRef,
      localUpdatedAt: existing?.updatedAt || null,
      label:          editId ? 'updateTask' : 'addTask',
      write: async () => {
        if (editId) await FS.updateTask(this._firm.id, editId, data);
        else        await FS.addTask(this._firm.id, { ...data, createdBy: auth.currentUser?.uid || '' });
      },
      onSuccess: () => { Toast.success(editId ? 'Task updated ✓' : 'Task added ✓'); closeModal(); },
      onError:   () => { if (btn) { btn.disabled = false; btn.textContent = editId ? 'Save Changes' : 'Add Task'; } },
    });
  },

  openDelete(id, title) {
    showModal(`
      <div class="modal-header"><h3 class="modal-title">Delete Task</h3><button class="modal-close" onclick="closeModal()">${Icons.x}</button></div>
      <p style="color:var(--text-secondary)">Delete "<strong style="color:var(--text-primary)">${esc(title)}</strong>"?</p>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button class="btn btn-danger" onclick="TasksPage._confirmDelete('${id}')">Delete</button>
      </div>`);
  },
    async _confirmDelete(id) {
    await DataIntegrity.safeWrite({
      label:     'deleteTask',
      write:     async () => FS.deleteTask(this._firm.id, id),
      onSuccess: () => { Toast.success('Task deleted'); closeModal(); },
    });
  },
};
