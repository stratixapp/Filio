// js/pages/my-tasks.js — Phase 4: Junior/Clerk Personal Task Dashboard
// Dedicated view for article clerks — only their own tasks
// Sorted by due date, priority color, completion flow with notes

const MyTasksPage = {
  _firm: null, _user: null, _userDoc: null,
  _tasks: [], _clients: [],
  _unsub: null, _unsubClients: null,
  _filter: 'active',  // active | done | all

  mount(user, firm, userDoc) {
    this._user = user; this._firm = firm; this._userDoc = userDoc;
    this._tasks = []; this._clients = [];
    this._render();
    this._unsub = FS.subscribeTasks(firm.id, tasks => {
      // Clerks see only their own tasks; owners/partners see all
      this._tasks = userDoc?.role === 'clerk'
        ? tasks.filter(t => t.assignedTo === user.uid)
        : tasks;
      this._renderList();
    });
    this._unsubClients = FS.subscribeClients(firm.id, d => { this._clients = d; });
    this._delegateHandler = (e) => {
      const btn = e.target.closest('[data-action][data-id]');
      if (!btn) return;
      const { action, id, title } = btn.dataset;
      if (action === 'comments') MyTasksPage.openComments(id, title||'');
      if (action === 'complete') MyTasksPage.openComplete(id);
    };
    document.addEventListener('click', this._delegateHandler);
  },

  unmount() {
    if (this._unsub)        { this._unsub();        this._unsub = null;     if (this._delegateHandler) { document.removeEventListener('click', this._delegateHandler); this._delegateHandler = null; }
  }
    if (this._unsubClients) { this._unsubClients(); this._unsubClients = null; }
  },

  _filtered() {
    if (this._filter === 'active') return this._tasks.filter(t => t.status !== 'done');
    if (this._filter === 'done')   return this._tasks.filter(t => t.status === 'done');
    return this._tasks;
  },

  _clientName(id) { return this._clients.find(c => c.id === id)?.name || ''; },

  _render() {
    const cnt = Layout.getContentEl(); if (!cnt) return;
    const isClerk = this._userDoc?.role === 'clerk';
    const firstName = this._user?.displayName?.split(' ')[0] || 'there';

    cnt.innerHTML = `
    <div style="margin-bottom:1.5rem">
      <h2 style="font-size:1.5rem;font-weight:600">
        ${isClerk ? `My Tasks, ${esc(firstName)} 👋` : 'All Tasks'}
      </h2>
      <p style="color:var(--text-muted);font-size:.875rem;margin-top:.2rem">
        ${isClerk ? 'Your personal task list — sorted by priority and due date' : 'All firm tasks across all staff members'}
      </p>
    </div>

    <!-- Stats row -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:.875rem;margin-bottom:1.5rem" id="mytask-stats"></div>

    <!-- Filter tabs -->
    <div class="tabs" style="margin-bottom:1.25rem">
      ${[['active','⏳ Active'],['done','✅ Done'],['all','📋 All']].map(([v,l])=>`
        <button class="tab${v===this._filter?' active':''}" onclick="MyTasksPage._setFilter('${v}',this)">${l}</button>`).join('')}
    </div>

    <div id="mytask-list">
      <div style="display:flex;justify-content:center;padding:3rem"><div class="spinner spinner-lg"></div></div>
    </div>`;
  },

  _renderList() {
    this._renderStats();
    const el = document.getElementById('mytask-list');
    if (!el) return;

    const tasks = this._filtered();
    const now = new Date();

    if (!tasks.length) {
      el.innerHTML = `<div class="card"><div class="empty-state">
        <div style="font-size:3rem;margin-bottom:.5rem">${this._filter==='done'?'🎉':'✅'}</div>
        <h4>${this._filter==='done'?'No completed tasks yet':this._filter==='active'?'All clear — no active tasks!':'No tasks yet'}</h4>
        <p>${this._filter==='active'?'Great work! Check back later.':'Tasks assigned to you will appear here.'}</p>
      </div></div>`;
      return;
    }

    // Sort: overdue first, then by due date, then by priority weight
    const priorityWeight = { urgent:0, high:1, medium:2, low:3 };
    const sorted = [...tasks].sort((a, b) => {
      const aOverdue = a.status !== 'done' && a.dueDate?.toDate?.() < now;
      const bOverdue = b.status !== 'done' && b.dueDate?.toDate?.() < now;
      if (aOverdue && !bOverdue) return -1;
      if (!aOverdue && bOverdue) return 1;
      const aDue = a.dueDate?.toDate?.()?.getTime() || Infinity;
      const bDue = b.dueDate?.toDate?.()?.getTime() || Infinity;
      if (aDue !== bDue) return aDue - bDue;
      return (priorityWeight[a.priority]||2) - (priorityWeight[b.priority]||2);
    });

    el.innerHTML = sorted.map(t => {
      const due      = t.dueDate?.toDate?.();
      const isOverdue= due && due < now && t.status !== 'done';
      const isDone   = t.status === 'done';
      const daysLeft = due ? Math.ceil((due - now) / 86400000) : null;
      const PCLR     = { urgent:'var(--red)', high:'var(--amber)', medium:'var(--blue)', low:'var(--green)' };
      const pClr     = PCLR[t.priority] || 'var(--border)';

      const dueLabel = !due ? '' :
        isDone ? `Done ${t.completedAt ? Fmt.date(t.completedAt) : ''}` :
        isOverdue ? `⚠ Overdue by ${Math.abs(daysLeft)}d` :
        daysLeft === 0 ? '🔴 Due today' :
        daysLeft === 1 ? '🟠 Due tomorrow' :
        `Due in ${daysLeft}d`;

      return `
      <div class="card" style="margin-bottom:.875rem;border-left:4px solid ${isDone?'var(--green)':isOverdue?'var(--red)':pClr};opacity:${isDone?.7:1};transition:opacity .2s">
        <div style="display:flex;gap:1rem;align-items:flex-start">
          <!-- Checkbox -->
          <div style="flex-shrink:0;margin-top:.15rem">
            <div data-action="${isDone?'':'complete'}" data-id="${t.id}"
              style="width:22px;height:22px;border-radius:50%;border:2px solid ${isDone?'var(--green)':pClr};
                display:flex;align-items:center;justify-content:center;cursor:${isDone?'default':'pointer'};
                background:${isDone?'var(--green)':'transparent'};transition:all .15s;flex-shrink:0"
              title="${isDone?'Done':'Mark complete'}">
              ${isDone?`<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>`:''}
            </div>
          </div>

          <!-- Content -->
          <div style="flex:1;min-width:0">
            <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:.5rem;flex-wrap:wrap">
              <div style="font-weight:${isDone?'400':'600'};font-size:.9375rem;text-decoration:${isDone?'line-through':'none'};color:${isDone?'var(--text-muted)':'var(--text-primary)'}">${esc(t.title||'Untitled')}</div>
              <div style="display:flex;gap:.375rem;flex-shrink:0">
                ${priorityBadge(t.priority)}
                ${statusBadge(t.status)}
              </div>
            </div>

            ${t.description ? `<p style="font-size:.8125rem;color:var(--text-muted);margin-top:.25rem;line-height:1.6">${esc(t.description)}</p>` : ''}

            <div style="display:flex;gap:.75rem;margin-top:.5rem;flex-wrap:wrap;align-items:center">
              ${this._clientName(t.clientId) ? `<span style="font-size:.75rem;color:var(--text-secondary)">📁 ${esc(this._clientName(t.clientId))}</span>` : ''}
              ${dueLabel ? `<span style="font-size:.75rem;font-weight:600;color:${isOverdue?'var(--red)':isDone?'var(--green)':daysLeft<=1?'var(--amber)':'var(--text-muted)'}">${dueLabel}</span>` : ''}
              ${t.lastCommentBy ? `<span style="font-size:.72rem;color:var(--text-muted)">💬 ${esc(t.lastCommentBy)}</span>` : ''}
            </div>

            ${t.completionNote ? `
            <div style="margin-top:.625rem;padding:.5rem .75rem;background:var(--green-bg);border-radius:var(--r-sm);font-size:.8rem;color:var(--green);border:1px solid rgba(56,161,105,.2)">
              ✓ ${esc(t.completionNote)}
            </div>` : ''}
          </div>

          <!-- Actions -->
          <div style="flex-shrink:0;display:flex;gap:.25rem">
            <button class="btn btn-icon btn-ghost" data-action="comments" data-id="${t.id}" data-title="${esc(t.title||'')}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            </button>
            ${!isDone ? `<button class="btn btn-ghost btn-sm" style="font-size:.75rem;color:var(--green);white-space:nowrap" data-action="complete" data-id="${t.id}">✓ Done</button>` : ''}
          </div>
        </div>
      </div>`;
    }).join('');
  },

  _renderStats() {
    const el = document.getElementById('mytask-stats');
    if (!el) return;
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const all     = this._tasks;
    const active  = all.filter(t => t.status !== 'done');
    const overdue = active.filter(t => { const d = t.dueDate?.toDate?.(); return d && d < now; });
    const dueToday= active.filter(t => { const d = t.dueDate?.toDate?.(); return d && d.toDateString() === now.toDateString(); });
    const doneMonth = all.filter(t => { if(t.status!=='done') return false; const d=t.completedAt?.toDate?.(); return d && d >= monthStart; });

    el.innerHTML = [
      ['Active Tasks', active.length, '--blue'],
      ['Overdue',      overdue.length, overdue.length>0?'--red':'--text-muted'],
      ['Due Today',    dueToday.length,dueToday.length>0?'--amber':'--text-muted'],
      ['Done This Month', doneMonth.length, '--green'],
    ].map(([l,v,c])=>`
      <div class="card" style="padding:.875rem">
        <div style="font-size:1.375rem;font-weight:700;color:var(${c})">${v}</div>
        <div style="font-size:.75rem;color:var(--text-muted);margin-top:.2rem">${l}</div>
      </div>`).join('');
  },

  openComplete(taskId) {
    const t = this._tasks.find(x => x.id === taskId);
    if (!t) return;
    showModal(`
      <div class="modal-header">
        <h3 class="modal-title">Mark Task Complete</h3>
        <button class="modal-close" onclick="closeModal()">${Icons.x}</button>
      </div>
      <div style="background:var(--bg-elevated);border-radius:var(--r-md);padding:1rem;margin-bottom:1.25rem">
        <div style="font-weight:600;margin-bottom:.25rem">${esc(t.title)}</div>
        ${t.description ? `<div style="font-size:.8rem;color:var(--text-muted)">${esc(t.description)}</div>` : ''}
      </div>
      <div class="input-group" style="margin-bottom:1.25rem">
        <label class="input-label">Completion note (optional)</label>
        <textarea class="input" id="complete-note" rows="3"
          placeholder="What did you do? Any observations? e.g. Filed GSTR-3B, client had ₹2.3L ITC…"></textarea>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" style="background:var(--green);border-color:var(--green)" onclick="MyTasksPage._markDone('${taskId}')">
          ✓ Mark Complete
        </button>
      </div>`);
  },

  async _markDone(taskId) {
    const note = document.getElementById('complete-note')?.value.trim() || '';
    const btn  = document.querySelector('.modal .btn-primary');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }
    try {
      await DataIntegrity.withRetry(() => FS.updateTask(this._firm.id, taskId, {
        status:          'done',
        completedAt:     new Date(),
        completedBy:     this._user.uid,
        completedByName: this._user.displayName || '',
        completionNote:  note,
      }), { label: 'completeTask' });

      // Notify the task creator / firm owner
      const task = this._tasks.find(t => t.id === taskId);
      if (task?.createdBy && task.createdBy !== this._user.uid) {
        await FS.createNotification(this._firm.id, task.createdBy, {
          type:    'task_completed',
          title:   `Task completed: ${task.title}`,
          message: `${this._user.displayName} completed "${task.title}"${note ? ': ' + note.slice(0,100) : ''}`,
          taskId,
          fromUid: this._user.uid,
          fromName:this._user.displayName,
        });
      }

      Toast.success('Task marked complete ✓');
      closeModal();
    } catch(e) { Toast.error('Update failed'); if(btn){btn.disabled=false;btn.textContent='✓ Mark Complete';} }
  },

  openComments(taskId, taskTitle) {
    const modal = showModal(`
      <div class="modal-header">
        <h3 class="modal-title" style="font-size:1.1rem">💬 Task Comments</h3>
        <button class="modal-close" onclick="closeModal()">${Icons.x}</button>
      </div>
      <div style="font-size:.8125rem;color:var(--text-muted);margin-bottom:1rem">${esc(taskTitle)}</div>
      <div id="comments-list" style="max-height:280px;overflow-y:auto;display:flex;flex-direction:column;gap:.625rem;margin-bottom:1rem">
        <div style="text-align:center;padding:1rem"><div class="spinner"></div></div>
      </div>
      <div style="display:flex;gap:.625rem">
        <input class="input" id="comment-input" placeholder="Type a comment…" style="flex:1;font-size:.875rem"
          onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();MyTasksPage._sendComment('${taskId}')}" />
        <button class="btn btn-primary btn-sm" onclick="MyTasksPage._sendComment('${taskId}')">Send</button>
      </div>`);

    // Subscribe to comments
    const unsubComments = FS.subscribeTaskComments(this._firm.id, taskId, comments => {
      const list = document.getElementById('comments-list');
      if (!list) { unsubComments(); return; }
      if (!comments.length) {
        list.innerHTML = `<div style="text-align:center;color:var(--text-muted);font-size:.8125rem;padding:1rem">No comments yet. Start the conversation.</div>`;
        return;
      }
      list.innerHTML = comments.map(c => {
        const isMe = c.uid === this._user.uid;
        return `
        <div style="display:flex;flex-direction:column;align-items:${isMe?'flex-end':'flex-start'}">
          <div style="max-width:85%;background:${isMe?'rgba(201,168,76,.1)':'var(--bg-elevated)'};
            border:1px solid ${isMe?'rgba(201,168,76,.2)':'var(--border-light)'};
            border-radius:${isMe?'12px 12px 2px 12px':'12px 12px 12px 2px'};
            padding:.625rem .875rem">
            <div style="font-size:.7rem;color:var(--text-muted);margin-bottom:.2rem;font-weight:500">${isMe?'You':esc(c.userName||'Unknown')}</div>
            <div style="font-size:.875rem;line-height:1.5;word-break:break-word">${esc(c.text)}</div>
          </div>
          <div style="font-size:.65rem;color:var(--text-muted);margin-top:.2rem">${Fmt.date(c.createdAt)}</div>
        </div>`;
      }).join('');
      list.scrollTop = list.scrollHeight;
    });

    // Unsub when modal closes
    if (modal) {
      modal.addEventListener('click', e => {
        if (e.target === modal) unsubComments();
      });
    }
  },

  async _sendComment(taskId) {
    const input = document.getElementById('comment-input');
    const text  = input?.value.trim();
    if (!text) return;
    input.value = '';
    try {
      await DataIntegrity.withRetry(
        () => FS.addTaskComment(this._firm.id, taskId, this._user.uid, this._user.displayName || 'User', text),
        { label: 'addComment' }
      );
    } catch(e) { Toast.error('Comment failed'); ErrorMonitor.capture(e, { context: 'my-tasks addComment' }); }
  },

  _setStaffFilter(uid, name) {
    // Called from StaffPage to pre-filter tasks by a staff member
    // Only relevant for non-clerk views
  },

  _setFilter(v, btn) {
    this._filter = v;
    document.querySelectorAll('.tabs .tab').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    this._renderList();
  },
};
