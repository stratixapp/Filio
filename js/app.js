// js/app.js — Main application controller

const App = (() => {
  let _user = null, _userDoc = null, _firm = null;
  let _unsubUser = null, _unsubFirm = null;
  let _currentPage = null;

  function showLoader(msg = 'Loading Filio…') {
    document.getElementById('app').innerHTML = `
    <div class="fullscreen-loader">
      <div class="logo-icon" style="width:48px;height:48px;margin-bottom:.5rem">${Icons.logo}</div>
      <div class="spinner"></div>
      <p style="color:var(--text-muted);font-size:.875rem;margin-top:.75rem">${msg}</p>
    </div>`;
  }

  function unmount() {
    if (_currentPage && _currentPage.unmount) _currentPage.unmount();
    _currentPage = null;
  }

  function route() {
    const path = Router.current();

    // ── NOT LOGGED IN ──────────────────────────────────────
    if (!_user) {
      unmount();
      if (path === '/terms')   { renderStatic('terms');   return; }
      if (path === '/privacy') { renderStatic('privacy'); return; }
      if (path === '/landing') { LandingPage.render();    return; }
      // Client portal is PUBLIC — clients don't need a Filio account
      if (path.startsWith('/client-portal')) {
        document.getElementById('app').innerHTML = '<div class="page-content" id="page-content"></div>';
        ClientPortal.mount(null, null);
        return;
      }
      LoginPage.render();
      return;
    }

    // ── LOGGED IN — NEEDS FIRM SETUP ───────────────────────
    if (_user && _userDoc && !_userDoc.firmId) {
      unmount();
      // Check URL for join token — staff joining via token
      const hashParams = new URLSearchParams(window.location.hash.includes('?') ? window.location.hash.split('?')[1] : '');
      const joinToken  = hashParams.get('token');
      if (joinToken || path === '/join') {
        if (typeof StaffJoin !== 'undefined') {
          StaffJoin.setUser(_user);
          StaffJoin.render();
        }
      } else {
        SetupPage.setUser(_user);
        SetupPage.render();
      }
      if (path !== '/setup' && path !== '/join') Router.navigate('/setup', true);
      return;
    }

    // ── LOGGED IN — STILL LOADING DATA ────────────────────
    if (_user && (!_userDoc || !_firm)) {
      showLoader('Loading your firm…');
      return;
    }

    // ── FULLY AUTHENTICATED ────────────────────────────────
    if (path === '/terms')   { renderStatic('terms');   return; }
    if (path === '/privacy') { renderStatic('privacy'); return; }
    if (path === '/landing') { LandingPage.render();    return; }

    // Login/root/setup → dashboard
    if (path === '/' || path === '/login' || path === '/setup') {
      Router.navigate('/dashboard', true);
      return;
    }

    // Render sidebar shell once only
    if (!Layout.isRendered()) {
      Layout.setContext(_user, _firm, _userDoc);
      Layout.render();
      // Start notification badge listener
      if (typeof NotificationCenter !== 'undefined') NotificationCenter.startBadge(_user, _firm);
    }

    unmount();

    const content = Layout.getContentEl();
    if (!content) { Layout.render(); return; }

    if      (path.startsWith('/dashboard')) { DashboardPage.mount(_user, _firm); _currentPage = DashboardPage; }
    else if (path.startsWith('/clients'))   { ClientsPage.mount(_firm);          _currentPage = ClientsPage;   }
    else if (path.startsWith('/invoices'))  { InvoicesPage.mount(_firm);         _currentPage = InvoicesPage;  }
    else if (path.startsWith('/tasks'))     { TasksPage.mount(_firm);            _currentPage = TasksPage;     }
    else if (path.startsWith('/calendar'))  { CalendarPage.mount(_firm);         _currentPage = CalendarPage;  }
    else if (path.startsWith('/settings'))  { SettingsPage.mount(_user, _firm);  _currentPage = SettingsPage;  }
    else if (path.startsWith('/billing'))   { BillingPage.mount(_user, _firm, _userDoc);   _currentPage = BillingPage;   }
    else if (path.startsWith('/import-export')) { ImportExport.mount(_user, _firm);          _currentPage = ImportExport;       }
    else if (path.startsWith('/white-label'))   { WhiteLabel.mount(_user, _firm);            _currentPage = WhiteLabel;         }
    else if (path.startsWith('/analytics'))     { AnalyticsPage.mount(_user, _firm);          _currentPage = AnalyticsPage;      }
    else if (path.startsWith('/comm-log'))      { CommLog.mount(_user, _firm);               _currentPage = CommLog;            }
    else if (path.startsWith('/notices'))       { NoticesPage.mount(_user, _firm);           _currentPage = NoticesPage;        }
    else if (path.startsWith('/email'))         { EmailCenter.mount(_user, _firm);           _currentPage = EmailCenter;        }
    else if (path.startsWith('/reports-store'))  { ReportsStore.mount(_user, _firm);              _currentPage = ReportsStore;       }
    else if (path.startsWith('/reports'))        { ReportsMarketplace.mount(_user, _firm);        _currentPage = ReportsMarketplace; }
    else if (path.startsWith('/staff'))         { StaffPage.mount(_user, _firm, _userDoc);          _currentPage = StaffPage;          }
    else if (path.startsWith('/my-tasks'))      { MyTasksPage.mount(_user, _firm, _userDoc);        _currentPage = MyTasksPage;        }
    else if (path.startsWith('/notifications')) { NotificationCenter.mount(_user, _firm);            _currentPage = NotificationCenter; }
    else if (path.startsWith('/compliance-radar')) { ComplianceRadar.mount(_firm, _user, _userDoc); _currentPage = ComplianceRadar; }
    else if (path.startsWith('/compliance')) { ComplianceHub.mount(_firm);   _currentPage = ComplianceHub; }
    else if (path.startsWith('/doc-requests'))  { DocRequests.mount(_user, _firm);   _currentPage = DocRequests;   }
    else if (path.startsWith('/client-portal'))  { ClientPortal.mount(_user, _firm);  _currentPage = ClientPortal;  }
    else if (path.startsWith('/whatsapp'))        { WATIConfig.mount(_user, _firm);    _currentPage = WATIConfig;    }
    else if (path.startsWith('/gst-tracker')) { GSTTracker.mount(_firm);  _currentPage = GSTTracker;  }
    else if (path.startsWith('/itr-tracker')) { ITRTracker.mount(_firm);  _currentPage = ITRTracker;  }
    else if (path.startsWith('/tds-tracker')) { TDSTracker.mount(_firm);  _currentPage = TDSTracker;  }
    else if (path.startsWith('/roc-tracker')) { ROCTracker.mount(_firm);  _currentPage = ROCTracker;  }
    // /staff is handled above by StaffPage
    else {
      content.innerHTML = `
        <div style="text-align:center;padding:4rem">
          <h2 style="margin-bottom:.5rem">Page Not Found</h2>
          <p style="color:var(--text-muted);margin-bottom:1.5rem">That page doesn't exist.</p>
          <a href="#/dashboard" class="btn btn-primary">Go to Dashboard</a>
        </div>`;
    }

    Layout.highlightNav();
    _setPageTitle(path);
  }

  const PAGE_TITLES = {
    '/dashboard':   'Dashboard',
    '/clients':     'Clients',
    '/invoices':    'Invoices',
    '/tasks':       'Tasks',
    '/calendar':    'Calendar',
    '/compliance-radar': 'Compliance Radar',
  '/compliance':  'Compliance Hub',
    '/gst-tracker': 'GST Tracker',
    '/itr-tracker': 'ITR Tracker',
    '/tds-tracker': 'TDS Tracker',
    '/roc-tracker': 'ROC Tracker',
    '/doc-requests':'Documents',
    '/comm-log':    'Communication Log',
    '/notices':     'Notices',
    '/email':       'Email Center',
    '/reports':     'Reports Marketplace',
    '/reports-store':'Reports Store',
    '/analytics':   'Analytics',
    '/staff':       'Staff & Team',
    '/my-tasks':    'My Tasks',
    '/notifications':'Notifications',
    '/import-export':'Import & Export',
    '/white-label': 'White Label',
    '/whatsapp':    'WhatsApp Setup',
    '/billing':     'Plan & Billing',
    '/settings':    'Settings',
  };

  function _setPageTitle(path) {
    const title = Object.entries(PAGE_TITLES).find(([k]) => path.startsWith(k))?.[1] || 'Filio';
    // Update browser tab title
    document.title = title + ' — Filio';
    // Update top bar title
    const el = document.getElementById('top-bar-title');
    if (el) el.innerHTML = `<span style="font-size:.875rem;font-weight:600;color:var(--text-primary)">${title}</span>`;
  }

  function startListeners(firebaseUser) {
    if (_unsubUser) { _unsubUser(); _unsubUser = null; }
    if (_unsubFirm) { _unsubFirm(); _unsubFirm = null; }

    _unsubUser = db.collection('users').doc(firebaseUser.uid)
      .onSnapshot(snap => {
        if (!snap.exists) return;
        _userDoc = { id: snap.id, ...snap.data() };

        if (_userDoc.firmId) {
          if (_unsubFirm) _unsubFirm();
          _unsubFirm = db.collection('firms').doc(_userDoc.firmId)
            .onSnapshot(async fs => {
              if (fs.exists) {
                const isFirstLoad = !_firm;
                _firm = { id: fs.id, ...fs.data() };
                Layout.setContext(_user, _firm, _userDoc);
                // On first firm load: log login + check backup reminder
                if (isFirstLoad) {
                  AuditTrail.logLogin(_firm.id).catch(() => {});
                  BackupService.checkBackupOnLogin(_firm.id).catch(() => {});
                  ErrorMonitor.init(_firm.id, _user.uid, _user.displayName || _user.email || '');
                }
              }
              route();
            }, err => { console.error('[Filio] firm:', err.message); route(); });
        } else {
          _firm = null;
          route();
        }
      }, err => { console.error('[Filio] user:', err.message); route(); });
  }

  async function init() {
    // If Firebase config not filled, show setup screen immediately (not infinite loader)
    if (typeof _configReady !== 'undefined' && !_configReady) {
      return; // firebase-config.js already rendered the setup UI
    }

    showLoader('Starting Filio…');

    [
      '/', '/login', '/landing', '/setup',
      '/dashboard', '/clients', '/invoices', '/tasks',
      '/calendar', '/settings', '/billing', '/staff', '/compliance-radar', '/compliance', '/gst-tracker', '/doc-requests', '/client-portal', '/whatsapp', '/staff', '/my-tasks', '/notifications', '/reports', '/reports-store', '/comm-log', '/notices', '/email', '/analytics', '/import-export', '/white-label', '/itr-tracker', '/tds-tracker', '/roc-tracker',
      '/terms', '/privacy', '*'
    ].forEach(p => Router.register(p, route));

    auth.onAuthStateChanged(async firebaseUser => {
      unmount();

      if (!firebaseUser) {
        _user = null; _userDoc = null; _firm = null;
        if (_unsubUser) { _unsubUser(); _unsubUser = null; }
        if (_unsubFirm) { _unsubFirm(); _unsubFirm = null; }
        if (Layout.reset) Layout.reset();
        route();
        return;
      }

      _user = firebaseUser;

      try { await Auth.ensureUserProfile(firebaseUser); }
      catch (e) { console.error('[Filio] ensureUserProfile:', e.message); }

      startListeners(firebaseUser);
    });

    Router.init();
  }

  return { init };
})();

document.addEventListener('DOMContentLoaded', () => App.init());

function renderStatic(page) {
  document.getElementById('app').innerHTML = page === 'terms' ? _termsHTML() : _privacyHTML();
}

function _termsHTML() {
  return `<div style="max-width:720px;margin:0 auto;padding:3rem 2rem">
    <a href="#/dashboard" style="color:var(--text-muted);font-size:.875rem">← Back</a>
    <h1 style="margin:2rem 0 1rem">Terms of Service</h1>
    <p style="color:var(--text-secondary);margin-bottom:1.5rem">Last updated: April 2026</p>
    <div style="color:var(--text-secondary);line-height:1.9">
      <h3 style="color:var(--text-primary);margin:1.5rem 0 .5rem">1. Acceptance</h3>
      <p>By using Filio, you agree to these terms. Filio is a CA practice management platform for Indian Chartered Accountants.</p>
      <h3 style="color:var(--text-primary);margin:1.5rem 0 .5rem">2. Service</h3>
      <p>Filio provides client management, GST/ITR compliance tracking, task management, invoicing, and deadline management for CA firms.</p>
      <h3 style="color:var(--text-primary);margin:1.5rem 0 .5rem">3. Subscription</h3>
      <p>14-day free trial included. After trial, paid subscription required (₹799–₹4,999/month + GST). Annual plans get 2 months free.</p>
      <h3 style="color:var(--text-primary);margin:1.5rem 0 .5rem">4. Data</h3>
      <p>Your data and client data is never sold. Stored securely on Google Firebase (Mumbai region).</p>
      <h3 style="color:var(--text-primary);margin:1.5rem 0 .5rem">5. Contact</h3>
      <p>support@filio.in</p>
    </div>
  </div>`;
}

function _privacyHTML() {
  return `<div style="max-width:720px;margin:0 auto;padding:3rem 2rem">
    <a href="#/dashboard" style="color:var(--text-muted);font-size:.875rem">← Back</a>
    <h1 style="margin:2rem 0 1rem">Privacy Policy</h1>
    <p style="color:var(--text-secondary);margin-bottom:1.5rem">Last updated: April 2026</p>
    <div style="color:var(--text-secondary);line-height:1.9">
      <h3 style="color:var(--text-primary);margin:1.5rem 0 .5rem">Data We Collect</h3>
      <p>Firm details, client profiles, compliance data, task records. Anonymised usage analytics.</p>
      <h3 style="color:var(--text-primary);margin:1.5rem 0 .5rem">How We Use It</h3>
      <p>To provide the Filio service only. We never sell your data or client data.</p>
      <h3 style="color:var(--text-primary);margin:1.5rem 0 .5rem">Storage</h3>
      <p>Google Firebase — Mumbai (asia-south1). Encrypted at rest and in transit.</p>
      <h3 style="color:var(--text-primary);margin:1.5rem 0 .5rem">Contact</h3>
      <p>privacy@filio.in</p>
    </div>
  </div>`;
}
