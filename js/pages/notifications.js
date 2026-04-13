// js/pages/notifications.js — Phase 4: In-app Notification Center
// Real-time alerts: task completed, task overdue, document uploaded, etc.

const NotificationCenter = {
  _firm: null, _user: null,
  _notifs: [],
  _unsub: null,
  _badge: null,  // DOM element showing unread count

  mount(user, firm) {
    this._user = user; this._firm = firm;
    this._notifs = [];
    this._render();
    this._subscribe();
    this._delegateHandler = (e) => {
      const el = e.target.closest('[data-action="open"][data-id]');
      if (!el) return;
      NotificationCenter._open(el.dataset.id, el.dataset.taskid || '');
    };
    document.addEventListener('click', this._delegateHandler);
  },

  unmount() {
    if (this._unsub) { this._unsub(); this._unsub = null;     if (this._delegateHandler) { document.removeEventListener('click', this._delegateHandler); this._delegateHandler = null; }
  }
  },

  // Called from layout.js to show badge in sidebar
  startBadge(user, firm) {
    this._user = user; this._firm = firm;
    if (this._unsub) this._unsub();
    this._unsub = FS.subscribeNotifications(firm.id, user.uid, notifs => {
      this._notifs = notifs;
      this._updateBadge();
    });
  },

  _updateBadge() {
    const count = this._notifs.filter(n => !n.read).length;
    const badge = document.getElementById('notif-badge');
    if (!badge) return;
    if (count > 0) {
      badge.textContent = count > 9 ? '9+' : count;
      badge.style.display = '';
    } else {
      badge.style.display = 'none';
    }
  },

  _render() {
    const cnt = Layout.getContentEl(); if (!cnt) return;
    cnt.innerHTML = `
    <div style="margin-bottom:1.5rem;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:1rem">
      <div>
        <h2 style="font-size:1.5rem;font-weight:600">Notifications</h2>
        <p style="color:var(--text-muted);font-size:.875rem;margin-top:.2rem">Activity alerts for your firm</p>
      </div>
      <button class="btn btn-ghost btn-sm" onclick="NotificationCenter._markAllRead()" style="color:var(--gold);font-size:.8125rem">
        Mark all read
      </button>
    </div>
    <div id="notif-list">
      <div style="display:flex;justify-content:center;padding:3rem"><div class="spinner spinner-lg"></div></div>
    </div>`;

    this._subscribe();
  },

  _subscribe() {
    if (!this._firm || !this._user) return;
    if (this._unsub) this._unsub();
    this._unsub = FS.subscribeNotifications(this._firm.id, this._user.uid, notifs => {
      this._notifs = notifs;
      this._renderList();
      this._updateBadge();
    });
  },

  _renderList() {
    const el = document.getElementById('notif-list');
    if (!el) return;

    if (!this._notifs.length) {
      el.innerHTML = `<div class="card"><div class="empty-state">
        <div style="font-size:3rem;margin-bottom:.5rem">🔔</div>
        <h4>All caught up!</h4>
        <p>No new notifications</p>
      </div></div>`;
      return;
    }

    const ICONS = {
      task_completed: '✅',
      task_overdue:   '⚠️',
      doc_uploaded:   '📁',
      doc_reminder:   '📱',
      staff_joined:   '👋',
      invoice_paid:   '💰',
    };

    el.innerHTML = this._notifs.map(n => `
      <div data-action="open" data-id="${n.id}" data-taskid="${n.taskId||''}"
        style="display:flex;gap:.875rem;align-items:flex-start;padding:1rem;
          background:${n.read?'var(--bg-card)':'var(--bg-elevated)'};
          border:1px solid ${n.read?'var(--border-light)':'var(--border)'};
          border-left:4px solid ${n.read?'var(--border-light)':'var(--gold)'};
          border-radius:var(--r-md);margin-bottom:.625rem;cursor:pointer;transition:background .15s">
        <div style="font-size:1.375rem;flex-shrink:0;line-height:1">${ICONS[n.type]||'🔔'}</div>
        <div style="flex:1;min-width:0">
          <div style="font-weight:${n.read?'400':'600'};font-size:.9rem;margin-bottom:.2rem">${esc(n.title||'Notification')}</div>
          <div style="font-size:.8125rem;color:var(--text-muted);line-height:1.5">${esc(n.message||'')}</div>
          <div style="font-size:.72rem;color:var(--text-muted);margin-top:.35rem">${Fmt.date(n.createdAt)}</div>
        </div>
        ${!n.read ? '<div style="width:8px;height:8px;border-radius:50%;background:var(--gold);flex-shrink:0;margin-top:.35rem"></div>' : ''}
      </div>`).join('');
  },

  async _open(notifId, taskId) {
    await FS.markNotificationRead(this._firm.id, notifId);
    if (taskId) Router.navigate('/my-tasks');
  },

  async _markAllRead() {
    await FS.markAllNotificationsRead(this._firm.id, this._user.uid);
    Toast.success('All marked as read');
  },
};
