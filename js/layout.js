// js/layout.js — App shell v2 (polished sidebar + top bar)
// Fixed: sidebar scroll, padding-right, section labels,
//        duplicate /staff removed, smooth mobile overlay

const Layout = (() => {
  let _user = null, _firm = null, _userDoc = null;
  let _rendered = false;

  // ── Navigation structure with section grouping ─────────────
  const NAV_SECTIONS = [
    {
      label: null,  // no label for core section
      items: [
        { path:'/dashboard', icon:'dashboard', label:'Dashboard' },
        { path:'/clients',   icon:'clients',   label:'Clients' },
        { path:'/invoices',  icon:'invoices',  label:'Invoices' },
        { path:'/tasks',     icon:'tasks',     label:'Tasks' },
        { path:'/calendar',  icon:'calendar',  label:'Calendar' },
      ]
    },
    {
      label: 'Compliance',
      items: [
        { path:'/compliance',  icon:'check',  label:'Compliance Hub' },
        { path:'/gst-tracker', icon:'gst',    label:'GST Tracker' },
        { path:'/itr-tracker', icon:'itr',    label:'ITR Tracker' },
        { path:'/tds-tracker', icon:'tds',    label:'TDS Tracker' },
        { path:'/roc-tracker', icon:'roc',    label:'ROC Tracker' },
      ]
    },
    {
      label: 'Clients',
      items: [
        { path:'/doc-requests', icon:'upload',   label:'Documents' },
        { path:'/comm-log',     icon:'comment',  label:'Comm. Log' },
        { path:'/notices',      icon:'alert',    label:'Notices' },
        { path:'/email',        icon:'email',    label:'Email' },
      ]
    },
    {
      label: 'Revenue',
      items: [
        { path:'/reports',      icon:'rupee',    label:'Reports Store' },
        { path:'/analytics',    icon:'trending', label:'Analytics' },
      ]
    },
    {
      label: 'Team',
      items: [
        { path:'/staff',        icon:'staff',    label:'Staff & Team' },
        { path:'/my-tasks',     icon:'tasks',    label:'My Tasks' },
        { path:'/notifications',icon:'bell',     label:'Notifications',
          badge: true },
      ]
    },
    {
      label: 'Tools',
      items: [
        { path:'/import-export', icon:'upload',  label:'Import / Export' },
        { path:'/white-label',   icon:'star',    label:'White Label' },
        { path:'/whatsapp',      icon:'whatsapp',label:'WhatsApp' },
      ]
    },
  ];

  const NAV_BOTTOM = [
    { path:'/billing',  icon:'billing',  label:'Plan & Billing' },
    { path:'/settings', icon:'settings', label:'Settings' },
  ];

  function setContext(user, firm, userDoc) {
    _user = user; _firm = firm; _userDoc = userDoc;
    if (_rendered) _updateDynamic();
  }

  function isRendered() { return _rendered && !!document.getElementById('page-content'); }

  function render() {
    _rendered = true;
    const firmName = _firm ? esc(_firm.name) : '';
    const trialLeft = _firm?.trialEndsAt
      ? Math.max(0, Math.ceil((_firm.trialEndsAt.toDate() - new Date()) / 86400000))
      : null;
    const isTrial = _firm?.subscriptionStatus === 'trial';
    const showTrial = isTrial && trialLeft !== null && trialLeft <= 14;

    const renderNavItem = (n) => `
      <a href="#${n.path}" class="nav-link" data-path="${n.path}">
        ${Icons[n.icon] || ''}
        <span>${n.label}</span>
        ${n.badge ? `<span id="notif-badge" style="display:none;background:var(--red);color:white;border-radius:10px;padding:0 6px;font-size:.62rem;font-weight:700;margin-left:auto;min-width:18px;text-align:center;line-height:18px">0</span>` : ''}
      </a>`;

    const renderSection = (section) => `
      ${section.label ? `<div class="nav-section-label">${section.label}</div>` : ''}
      ${section.items.map(renderNavItem).join('')}`;

    document.getElementById('app').innerHTML = `
    <div class="sidebar-overlay" id="sidebar-overlay" onclick="Layout.closeMobile()"></div>

    <aside class="sidebar" id="sidebar">
      <!-- Header -->
      <div class="sidebar-header">
        <a href="#/dashboard" class="logo-wrap">
          <div class="logo-icon">${Icons.logo}</div>
          <span class="logo-text">Filio</span>
        </a>
        <button class="btn btn-icon btn-ghost" id="sidebar-close-btn"
          onclick="Layout.closeMobile()" style="display:none;color:var(--text-muted)">
          ${Icons.x}
        </button>
      </div>

      <!-- Firm name chip -->
      <div style="padding:.5rem .875rem .625rem;border-bottom:1px solid var(--border-light)">
        <div style="display:flex;align-items:center;gap:.5rem;padding:.375rem .5rem;background:rgba(255,255,255,.03);border-radius:var(--r-sm)">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--text-muted);flex-shrink:0"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
          <span id="sidebar-firm-name" style="font-size:.72rem;color:var(--text-muted);font-weight:600;text-transform:uppercase;letter-spacing:.05em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1">${firmName}</span>
        </div>
      </div>

      <!-- Scrollable nav -->
      <nav class="sidebar-nav" id="sidebar-nav">
        ${NAV_SECTIONS.map(renderSection).join('')}
      </nav>

      <!-- Trial banner -->
      <div id="sidebar-trial" class="sidebar-trial" style="${showTrial ? '' : 'display:none'}">
        <div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.25rem">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          <span id="trial-days-text" style="font-size:.75rem;color:var(--gold);font-weight:600">${trialLeft} days left in trial</span>
        </div>
        <a href="#/billing" style="font-size:.7rem;color:var(--text-muted);display:block">Upgrade plan →</a>
      </div>

      <!-- Bottom nav -->
      <div class="sidebar-bottom">
        ${NAV_BOTTOM.map(renderNavItem).join('')}
        <!-- User card -->
        <div class="sidebar-user" style="margin-top:.375rem">
          ${Fmt.avatar(_user, 30)}
          <div class="sidebar-user-info">
            <div class="sidebar-user-name">${esc(_user?.displayName || 'User')}</div>
            <div class="sidebar-user-role">${esc(_userDoc?.role || 'owner')}</div>
          </div>
          <button class="btn btn-icon btn-ghost" onclick="Layout.logout()"
            title="Sign out" style="flex-shrink:0;color:var(--text-muted)">
            ${Icons.logout}
          </button>
        </div>
      </div>
    </aside>

    <!-- Main area -->
    <div class="main-area" id="main-area">
      <header class="top-bar">
        <button class="btn btn-icon btn-ghost" onclick="Layout.openMobile()"
          style="color:var(--text-muted)" id="mobile-menu-btn">
          ${Icons.menu}
        </button>
        <!-- Page title injection point -->
        <div id="top-bar-title" style="flex:1;margin-left:.5rem"></div>
        <div style="display:flex;align-items:center;gap:.75rem">
          <span class="top-bar-date hide-mobile">${Fmt.today()}</span>
        </div>
      </header>
      <main class="page-content" id="page-content"></main>
    </div>`;

    highlightNav();
  }

  function _updateDynamic() {
    const fn = document.getElementById('sidebar-firm-name');
    if (fn && _firm) fn.textContent = _firm.name;
    const trialDiv = document.getElementById('sidebar-trial');
    if (trialDiv && _firm) {
      const tl = _firm.trialEndsAt
        ? Math.max(0, Math.ceil((_firm.trialEndsAt.toDate() - new Date()) / 86400000)) : null;
      if (_firm.subscriptionStatus === 'trial' && tl !== null && tl <= 14) {
        trialDiv.style.display = '';
        const txt = document.getElementById('trial-days-text');
        if (txt) txt.textContent = `${tl} days left in trial`;
      }
    }
  }

  function highlightNav() {
    const cur = Router.current();
    document.querySelectorAll('.nav-link[data-path]').forEach(a => {
      a.classList.toggle('active', cur.startsWith(a.dataset.path));
    });
  }

  function openMobile() {
    const sb = document.getElementById('sidebar');
    const ov = document.getElementById('sidebar-overlay');
    const cl = document.getElementById('sidebar-close-btn');
    const mb = document.getElementById('mobile-menu-btn');
    sb?.classList.add('open');
    if (ov) { ov.style.display = 'block'; requestAnimationFrame(() => ov.classList.add('visible')); }
    if (cl) cl.style.display = '';
    if (mb) mb.style.display = 'none';
    document.body.style.overflow = 'hidden';
  }

  function closeMobile() {
    const sb = document.getElementById('sidebar');
    const ov = document.getElementById('sidebar-overlay');
    const cl = document.getElementById('sidebar-close-btn');
    const mb = document.getElementById('mobile-menu-btn');
    sb?.classList.remove('open');
    if (ov) {
      ov.classList.remove('visible');
      setTimeout(() => { ov.style.display = 'none'; }, 280);
    }
    if (cl) cl.style.display = 'none';
    if (mb) mb.style.display = '';
    document.body.style.overflow = '';
  }

  async function logout() {
    await Auth.signOut();
    _rendered = false;
    Toast.success('Signed out successfully');
    Router.navigate('/');
  }

  function getContentEl() { return document.getElementById('page-content'); }
  function reset() { _rendered = false; }

  return { setContext, render, isRendered, reset, highlightNav, openMobile, closeMobile, logout, getContentEl };
})();
