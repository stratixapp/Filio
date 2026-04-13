// js/pages/staff.js — Phase 4: Full Staff Management
// Staff invite, role management, performance analytics per member

const StaffPage = {
  _firm: null, _user: null, _userDoc: null,
  _staff: [], _invites: [],
  _unsub: null, _unsubInvites: null,
  _tab: 'members',  // members | performance | invites

  mount(user, firm, userDoc) {
    this._user = user; this._firm = firm; this._userDoc = userDoc;
    this._staff = []; this._invites = [];
    this._render();
    this._unsub = FS.subscribeStaffProfiles(firm.id, docs => {
      this._staff = docs;
      this._renderTab();
    });
    // Also subscribe to pending invites
    this._unsubInvites = db.collection('invites')
      .where('firmId', '==', firm.id)
      .where('used', '==', false)
      .onSnapshot(s => {
        this._invites = s.docs.map(d => ({ id: d.id, ...d.data() }));
        this._renderTab();
      }, err => { this._invites = []; });
    this._delegateHandler = (e) => {
      const btn = e.target.closest('[data-action][data-id]');
      if (!btn) return;
      const { action, id, name, email } = btn.dataset;
      if (action === 'copytoken')   copyText(id, 'Token copied!');
      if (action === 'shareinvite') StaffPage._shareInvite(id, name||'', email||'');
      if (action === 'cancelinvite') StaffPage._cancelInvite(id);
    };
    document.addEventListener('click', this._delegateHandler);
  },

  unmount() {
    if (this._unsub)        { this._unsub();        this._unsub = null;     if (this._delegateHandler) { document.removeEventListener('click', this._delegateHandler); this._delegateHandler = null; }
  }
    if (this._unsubInvites) { this._unsubInvites(); this._unsubInvites = null; }
  },

  _isOwner() { return this._userDoc?.role === 'owner'; },

  _render() {
    const cnt = Layout.getContentEl(); if (!cnt) return;
    cnt.innerHTML = `
    <div style="margin-bottom:1.5rem;display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:1rem">
      <div>
        <h2 style="font-size:1.5rem;font-weight:600">Staff & Team</h2>
        <p style="color:var(--text-muted);font-size:.875rem;margin-top:.2rem">
          Manage article clerks, partners, and their tasks
        </p>
      </div>
      ${this._isOwner() ? `<button class="btn btn-primary btn-sm" onclick="StaffPage.openInvite()">${Icons.plus} Invite Staff</button>` : ''}
    </div>

    <!-- Tabs -->
    <div class="tabs" style="margin-bottom:1.5rem">
      ${[['members','👥 Members'],['performance','📊 Performance'],['invites','📨 Pending Invites']].map(([v,l])=>`
        <button class="tab${v===this._tab?' active':''}" onclick="StaffPage._setTab('${v}',this)">${l}</button>`).join('')}
    </div>

    <div id="staff-tab-content">
      <div style="display:flex;justify-content:center;padding:3rem"><div class="spinner spinner-lg"></div></div>
    </div>`;
  },

  _setTab(tab, btn) {
    this._tab = tab;
    document.querySelectorAll('.tabs .tab').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    this._renderTab();
  },

  _renderTab() {
    const el = document.getElementById('staff-tab-content');
    if (!el) return;
    if (this._tab === 'members')     this._renderMembers(el);
    else if (this._tab === 'performance') this._renderPerformance(el);
    else if (this._tab === 'invites')    this._renderInvites(el);
  },

  _renderMembers(el) {
    const activeStaff = this._staff.filter(s => s.isActive !== false);

    if (!activeStaff.length) {
      el.innerHTML = `<div class="card"><div class="empty-state">
        <div style="font-size:3rem;margin-bottom:.5rem">👥</div>
        <h4>No staff members yet</h4>
        <p>Invite article clerks and partners to collaborate</p>
        ${this._isOwner() ? `<button class="btn btn-primary btn-sm" style="margin-top:.75rem" onclick="StaffPage.openInvite()">${Icons.plus} Invite Staff</button>` : ''}
      </div></div>`;
      return;
    }

    const ROLE_BADGE = { owner:'badge-gold', partner:'badge-blue', clerk:'badge-purple' };
    const ROLE_LABEL = { owner:'CA Owner', partner:'CA Partner', clerk:'Article Clerk' };

    el.innerHTML = `
    <!-- Summary row -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:.875rem;margin-bottom:1.5rem">
      ${[
        ['Total Staff',   activeStaff.length,                                                    '--blue'],
        ['Partners',      activeStaff.filter(s=>s.role==='partner').length,                      '--green'],
        ['Article Clerks',activeStaff.filter(s=>s.role==='clerk').length,                        '--purple'],
        ['Pending Invites',this._invites.length,                                                 '--amber'],
      ].map(([l,v,c])=>`
        <div class="card" style="padding:.875rem">
          <div style="font-size:1.375rem;font-weight:700;color:var(${c})">${v}</div>
          <div style="font-size:.75rem;color:var(--text-muted);margin-top:.2rem">${l}</div>
        </div>`).join('')}
    </div>

    <!-- Staff cards -->
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:1rem">
      ${activeStaff.map(s => {
        const isCurrentUser = s.uid === this._user.uid;
        const initial = (s.name||s.email||'?').charAt(0).toUpperCase();
        const pending = s._tasksPending || 0;
        return `
        <div class="card" style="border-top:3px solid ${s.role==='owner'?'var(--gold)':s.role==='partner'?'var(--blue)':'var(--purple)'}">
          <div style="display:flex;align-items:flex-start;gap:.875rem;margin-bottom:1rem">
            ${s.photoURL
              ? `<img src="${esc(s.photoURL)}" referrerpolicy="no-referrer" alt="" style="width:44px;height:44px;border-radius:50%;object-fit:cover;flex-shrink:0;border:2px solid var(--border)" />`
              : `<div class="avatar" style="width:44px;height:44px;font-size:1.1rem;flex-shrink:0;background:${s.role==='owner'?'rgba(201,168,76,.15)':s.role==='partner'?'var(--blue-bg)':'var(--purple-bg)'};color:${s.role==='owner'?'var(--gold)':s.role==='partner'?'var(--blue)':'var(--purple)'}">${initial}</div>`}
            <div style="flex:1;min-width:0">
              <div style="font-weight:600;font-size:.9375rem;margin-bottom:.2rem">
                ${esc(s.name || 'Unknown')}
                ${isCurrentUser ? '<span style="font-size:.7rem;color:var(--text-muted);font-weight:400;margin-left:.4rem">(you)</span>' : ''}
              </div>
              <div style="font-size:.78rem;color:var(--text-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(s.email||'')}</div>
              <div style="margin-top:.375rem"><span class="badge ${ROLE_BADGE[s.role]||'badge-muted'}" style="font-size:.72rem">${ROLE_LABEL[s.role]||s.role}</span></div>
            </div>
          </div>

          <!-- Task stats -->
          <div class="grid-auto-3" style="margin-bottom:1rem">
            ${[['Open Tasks',s._tasksPending||0,'--amber'],['Done This Month',s._tasksDone||0,'--green'],['Overdue',s._tasksOverdue||0,'--red']].map(([l,v,c])=>`
              <div style="text-align:center;background:var(--bg-elevated);border-radius:var(--r-sm);padding:.5rem">
                <div style="font-size:1.1rem;font-weight:700;color:var(${c})">${v}</div>
                <div style="font-size:.65rem;color:var(--text-muted)">${l}</div>
              </div>`).join('')}
          </div>

          ${s.joinedAt ? `<div style="font-size:.72rem;color:var(--text-muted);margin-bottom:.75rem">Joined ${Fmt.date(s.joinedAt)}</div>` : ''}

          ${this._isOwner() && !isCurrentUser ? `
          <div style="display:flex;gap:.5rem;flex-wrap:wrap">
            <button class="btn btn-secondary btn-sm" style="flex:1;font-size:.78rem"
              onclick="StaffPage._viewTasks('${s.uid}','${esc(s.name||s.email||'')}')">View Tasks</button>
            <button class="btn btn-ghost btn-sm" style="font-size:.78rem;color:var(--red)"
              onclick="StaffPage._confirmRemove('${s.uid}','${esc(s.name||'')}')">Remove</button>
          </div>` : `
          <button class="btn btn-secondary btn-sm btn-full" style="font-size:.78rem"
            onclick="Router.navigate('/my-tasks')">My Task Dashboard</button>`}
        </div>`;
      }).join('')}
    </div>`;

    // Load task stats for each staff member asynchronously
    this._loadStaffTaskStats(activeStaff);
  },

  async _loadStaffTaskStats(staffList) {
    if (!this._firm) return;
    try {
      const tasksSnap = await db.collection('firms').doc(this._firm.id)
        .collection('tasks').get();
      const tasks = tasksSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      staffList.forEach(s => {
        const myTasks = tasks.filter(t => t.assignedTo === s.uid);
        s._tasksPending = myTasks.filter(t => t.status === 'pending' || t.status === 'in_progress').length;
        s._tasksOverdue = myTasks.filter(t => {
          if (t.status === 'done') return false;
          const due = t.dueDate?.toDate?.();
          return due && due < now;
        }).length;
        s._tasksDone = myTasks.filter(t => {
          if (t.status !== 'done') return false;
          const comp = t.completedAt?.toDate?.();
          return comp && comp >= monthStart;
        }).length;
      });

      // Re-render members tab with stats
      const el = document.getElementById('staff-tab-content');
      if (el && this._tab === 'members') this._renderMembers(el);
    } catch(e) { /* stats are non-critical */ }
  },

  async _renderPerformance(el) {
    const now = new Date();
    const months = [];
    for (let i = 0; i < 3; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`);
    }
    const selMonth = months[0];

    el.innerHTML = `
    <div style="display:flex;align-items:center;gap:1rem;margin-bottom:1.5rem;flex-wrap:wrap">
      <label style="font-size:.8125rem;color:var(--text-muted);font-weight:500">Month:</label>
      <select class="input" style="width:160px;padding:.4rem .75rem" onchange="StaffPage._loadPerf(this.value)">
        ${months.map(m => {
          const [y,mo] = m.split('-');
          const lbl = new Date(+y, +mo-1, 1).toLocaleDateString('en-IN',{month:'long',year:'numeric'});
          return `<option value="${m}">${lbl}</option>`;
        }).join('')}
      </select>
    </div>
    <div id="perf-grid" style="display:flex;flex-direction:column;gap:1rem">
      <div style="display:flex;justify-content:center;padding:2rem"><div class="spinner"></div></div>
    </div>`;

    this._loadPerf(selMonth);
  },

  async _loadPerf(month) {
    const grid = document.getElementById('perf-grid');
    if (!grid) return;
    const activeStaff = this._staff.filter(s => s.isActive !== false);
    if (!activeStaff.length) {
      grid.innerHTML = `<div class="card"><div class="empty-state"><h4>No staff to show</h4></div></div>`;
      return;
    }

    grid.innerHTML = `<div style="display:flex;justify-content:center;padding:2rem"><div class="spinner"></div></div>`;

    const perfData = await Promise.all(
      activeStaff.map(s => FS.getStaffPerformance(this._firm.id, s.uid, month))
    );

    grid.innerHTML = `
    <!-- Performance table -->
    <div class="card" style="padding:0;overflow:hidden">
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Staff Member</th>
              <th style="text-align:center">Assigned</th>
              <th style="text-align:center">Completed</th>
              <th style="text-align:center">Overdue</th>
              <th style="text-align:center">Completion Rate</th>
              <th style="text-align:center">Avg. Days to Close</th>
              <th style="text-align:center">Performance</th>
            </tr>
          </thead>
          <tbody>
            ${activeStaff.map((s, i) => {
              const p = perfData[i];
              const rate = p.completionRate;
              const perf = rate >= 90 ? ['Excellent','--green'] : rate >= 70 ? ['Good','--blue'] : rate >= 50 ? ['Average','--amber'] : ['Needs Improvement','--red'];
              return `
              <tr>
                <td>
                  <div style="display:flex;align-items:center;gap:.625rem">
                    <div class="avatar" style="width:28px;height:28px;font-size:.65rem;flex-shrink:0">${Fmt.initials(s.name)}</div>
                    <div>
                      <div style="font-weight:500;font-size:.875rem">${esc(s.name||'Unknown')}</div>
                      <span class="badge badge-muted" style="font-size:.65rem;text-transform:capitalize">${s.role}</span>
                    </div>
                  </div>
                </td>
                <td style="text-align:center;font-weight:600">${p.assigned}</td>
                <td style="text-align:center;color:var(--green);font-weight:600">${p.completed}</td>
                <td style="text-align:center;color:${p.overdue>0?'var(--red)':'var(--text-muted)'};font-weight:${p.overdue>0?'700':'400'}">${p.overdue}</td>
                <td style="text-align:center">
                  <div style="display:flex;align-items:center;gap:.625rem;justify-content:center">
                    <div style="width:60px;height:6px;background:var(--bg-elevated);border-radius:3px;overflow:hidden">
                      <div style="height:100%;background:${rate>=70?'var(--green)':rate>=50?'var(--amber)':'var(--red)'};width:${rate}%"></div>
                    </div>
                    <span style="font-size:.8rem;font-weight:600;color:${rate>=70?'var(--green)':rate>=50?'var(--amber)':'var(--red)'}">${rate}%</span>
                  </div>
                </td>
                <td style="text-align:center;color:var(--text-secondary)">${p.avgDays > 0 ? p.avgDays + 'd' : '—'}</td>
                <td style="text-align:center"><span class="badge badge-${perf[1].replace('--','')}" style="font-size:.72rem">${perf[0]}</span></td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Performance tip -->
    <div class="card" style="background:rgba(201,168,76,.04);border-color:rgba(201,168,76,.12)">
      <div style="display:flex;gap:.875rem;align-items:flex-start">
        <div style="font-size:1.25rem">💡</div>
        <div style="font-size:.8125rem;color:var(--text-secondary);line-height:1.7">
          Performance is calculated from tasks assigned <strong>this month</strong>. Completion rate = tasks done ÷ tasks assigned. Average days = time from creation to completion.
        </div>
      </div>
    </div>`;
  },

  _renderInvites(el) {
    if (!this._invites.length) {
      el.innerHTML = `<div class="card"><div class="empty-state">
        <div style="font-size:2.5rem;margin-bottom:.5rem">📨</div>
        <h4>No pending invites</h4>
        <p>All invites have been accepted</p>
        ${this._isOwner() ? `<button class="btn btn-primary btn-sm" style="margin-top:.75rem" onclick="StaffPage.openInvite()">${Icons.plus} New Invite</button>` : ''}
      </div></div>`;
      return;
    }

    el.innerHTML = `
    <div class="card" style="padding:0;overflow:hidden">
      <div class="table-wrap">
        <table>
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Token</th><th>Created</th><th>Actions</th></tr></thead>
          <tbody>
            ${this._invites.map(inv => `
            <tr>
              <td style="font-weight:500">${esc(inv.name||'—')}</td>
              <td style="color:var(--text-secondary)">${esc(inv.email||'—')}</td>
              <td><span class="badge badge-${inv.role==='partner'?'blue':'purple'}" style="font-size:.72rem;text-transform:capitalize">${inv.role}</span></td>
              <td>
                <code style="font-size:.8rem;color:var(--gold);cursor:pointer" 
                  data-action="copytoken" data-id="${inv.id}" title="Click to copy">${inv.id}</code>
              </td>
              <td style="color:var(--text-muted);font-size:.85rem">${Fmt.date(inv.createdAt)}</td>
              <td>
                <div style="display:flex;gap:.375rem">
                  <button class="btn btn-ghost btn-sm" style="font-size:.75rem;color:var(--gold)"
                    data-action="shareinvite" data-id="${inv.id}" data-name="${esc(inv.name||'')}" data-email="${esc(inv.email||'')}">
                    📱 Share
                  </button>
                  <button class="btn btn-icon btn-ghost" style="color:var(--red)"
                    data-action="cancelinvite" data-id="${inv.id}" title="Cancel invite">${Icons.trash}</button>
                </div>
              </td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <div class="card" style="margin-top:1rem;background:rgba(14,165,233,.04);border-color:rgba(14,165,233,.15)">
      <p style="font-size:.8125rem;color:var(--text-secondary);line-height:1.7">
        <strong style="color:var(--blue)">How staff joins:</strong> Share the token above with your staff member.
        They open Filio, sign in with Google, and enter the token on the setup page to join your firm automatically.
      </p>
    </div>`;
  },

  openInvite() {
    showModal(`
      <div class="modal-header">
        <h3 class="modal-title">Invite Staff Member</h3>
        <button class="modal-close" onclick="closeModal()">${Icons.x}</button>
      </div>
      <div style="display:flex;flex-direction:column;gap:1rem">
        <div class="input-group">
          <label class="input-label">Full Name</label>
          <input class="input" id="inv-name" placeholder="CA Rajan Kumar" />
        </div>
        <div class="input-group">
          <label class="input-label">Email Address</label>
          <input class="input" id="inv-email" type="email" placeholder="rajan@firm.com" />
        </div>
        <div class="input-group">
          <label class="input-label">Role</label>
          <select class="input" id="inv-role">
            <option value="clerk">Article Clerk — task access only</option>
            <option value="partner">CA Partner — full client access</option>
          </select>
        </div>
      </div>
      <div style="background:rgba(201,168,76,.06);border:1px solid rgba(201,168,76,.15);border-radius:var(--r-md);padding:.875rem;margin-top:1rem">
        <p style="font-size:.8rem;color:var(--text-secondary);line-height:1.7">
          A unique join token will be generated. Share it with your staff — they sign in with Google and use the token to join this firm.
        </p>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" id="inv-btn" onclick="StaffPage._createInvite()">Generate Token</button>
      </div>`);
  },

  async _createInvite() {
    const name  = document.getElementById('inv-name')?.value.trim();
    const email = document.getElementById('inv-email')?.value.trim();
    const role  = document.getElementById('inv-role')?.value || 'clerk';

    if (!name)  { Toast.error('Name is required'); return; }
    if (!email || !Validate.email(email)) { Toast.error('Valid email required'); return; }

    const btn = document.getElementById('inv-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Generating…'; }

    try {
      const token = await FS.createInvite(this._firm.id, this._user.uid, { name, email, role });
      await Security.auditLog(this._firm.id, 'staff_invited', { email, role });
      closeModal();

      // Show token result
      showModal(`
        <div class="modal-header">
          <h3 class="modal-title">Invite Created ✓</h3>
          <button class="modal-close" onclick="closeModal()">${Icons.x}</button>
        </div>
        <p style="color:var(--text-secondary);font-size:.875rem;margin-bottom:1.25rem">
          Share this token with <strong>${esc(name)}</strong>. They use it to join your firm after signing in with Google.
        </p>
        <div style="background:var(--bg-elevated);border:2px solid var(--gold);border-radius:var(--r-md);padding:1.25rem;text-align:center;margin-bottom:1.25rem">
          <div style="font-family:var(--font-mono);font-size:1.75rem;font-weight:700;color:var(--gold);letter-spacing:.15em">${token}</div>
          <p style="font-size:.75rem;color:var(--text-muted);margin-top:.5rem">Click to copy</p>
        </div>
        <div style="display:flex;gap:.75rem">
          <button class="btn btn-secondary btn-full" onclick="copyText('${token}','Token copied!')">
            ${Icons.copy} Copy Token
          </button>
          <button class="btn btn-ghost btn-full" style="color:#25D366"
            onclick="StaffPage._shareInvite('${token}','${esc(name)}','${esc(email)}');closeModal()">
            📱 Share via WhatsApp
          </button>
        </div>
        <div class="modal-footer" style="margin-top:1rem">
          <button class="btn btn-primary btn-full" onclick="closeModal()">Done</button>
        </div>`);
    } catch(e) {
      Toast.error('Failed to generate invite');
      if (btn) { btn.disabled = false; btn.textContent = 'Generate Token'; }
    }
  },

  _shareInvite(token, name, email) {
    const firmName = this._firm?.name || 'our CA firm';
    const msg = `Hi ${name},\n\nYou've been invited to join ${firmName} on Filio (CA practice management software).\n\nYour join token: *${token}*\n\nSteps:\n1. Open http://localhost:5500 (or the Filio app link)\n2. Sign in with Google using ${email}\n3. Enter token: ${token}\n\nWelcome to the team!`;
    const wa = `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(wa, '_blank');
  },

  async _cancelInvite(token) {
    if (!confirm('Cancel this invite? The token will no longer work.')) return;
    try {
      await db.collection('invites').doc(token).delete();
      Toast.success('Invite cancelled');
    } catch(e) { Toast.error('Failed to cancel'); }
  },

  _viewTasks(uid, name) {
    Router.navigate('/tasks');
    setTimeout(() => {
      if (typeof TasksPage !== 'undefined' && TasksPage._setStaffFilter) {
        TasksPage._setStaffFilter(uid, name);
      }
    }, 400);
  },

  _confirmRemove(uid, name) {
    showModal(`
      <div class="modal-header">
        <h3 class="modal-title">Remove Staff Member</h3>
        <button class="modal-close" onclick="closeModal()">${Icons.x}</button>
      </div>
      <div style="text-align:center;padding:1rem 0">
        <div style="font-size:2.5rem;margin-bottom:.75rem">⚠️</div>
        <p style="color:var(--text-secondary);line-height:1.7">
          Remove <strong>${esc(name)}</strong> from this firm?<br/>
          Their tasks will remain but they will lose access.
        </p>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button class="btn btn-danger" onclick="StaffPage._removeStaff('${uid}','${esc(name)}')">Yes, Remove</button>
      </div>`);
  },

  async _removeStaff(uid, name) {
    try {
      await FS.removeStaff(this._firm.id, uid);
      await Security.auditLog(this._firm.id, 'staff_removed', { uid, name });
      Toast.success(`${name} removed from firm`);
      closeModal();
    } catch(e) { Toast.error('Failed to remove: ' + e.message); }
  },
};
