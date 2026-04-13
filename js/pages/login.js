// js/pages/login.js — Complete redesign, no demo data

const LoginPage = {
  _loading: false,

  render() {
    const isFile = window.location.protocol === 'file:';

    document.getElementById('app').innerHTML = `
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&display=swap');

      .lp { min-height:100vh; display:flex; background:#04080F; overflow:hidden; position:relative; font-family:'DM Sans',sans-serif; }

      /* animated background */
      .lp-bg {
        position:fixed; inset:0; pointer-events:none; z-index:0;
      }
      .lp-bg-grid {
        position:absolute; inset:0;
        background-image:
          linear-gradient(rgba(201,168,76,.03) 1px, transparent 1px),
          linear-gradient(90deg, rgba(201,168,76,.03) 1px, transparent 1px);
        background-size:64px 64px;
      }
      .lp-bg-glow1 {
        position:absolute; top:-200px; left:-150px;
        width:700px; height:700px; border-radius:50%;
        background:radial-gradient(circle, rgba(201,168,76,.07) 0%, transparent 65%);
        animation:glow1 14s ease-in-out infinite;
      }
      .lp-bg-glow2 {
        position:absolute; bottom:-150px; right:-100px;
        width:500px; height:500px; border-radius:50%;
        background:radial-gradient(circle, rgba(14,165,233,.05) 0%, transparent 65%);
        animation:glow2 18s ease-in-out infinite;
      }
      @keyframes glow1 { 0%,100%{transform:translate(0,0)} 50%{transform:translate(40px,30px)} }
      @keyframes glow2 { 0%,100%{transform:translate(0,0)} 50%{transform:translate(-30px,20px)} }

      /* Left panel */
      .lp-left {
        width:52%; display:flex; flex-direction:column; justify-content:space-between;
        padding:3rem 4rem; border-right:1px solid rgba(201,168,76,.06);
        position:relative; z-index:1;
        animation:panelLeft .8s cubic-bezier(.16,1,.3,1) both;
      }
      @keyframes panelLeft { from{opacity:0;transform:translateX(-30px)} to{opacity:1;transform:translateX(0)} }

      .lp-wordmark {
        display:flex; align-items:center; gap:.75rem;
      }
      .lp-wordmark-icon {
        width:44px; height:44px; border-radius:12px;
        background:rgba(201,168,76,.1); border:1px solid rgba(201,168,76,.2);
        display:flex; align-items:center; justify-content:center;
      }
      .lp-wordmark-name {
        font-family:'Syne',sans-serif; font-size:1.5rem; font-weight:800;
        color:#C9A84C; letter-spacing:-.02em; line-height:1;
      }
      .lp-wordmark-sub {
        font-size:.6rem; color:#2A3A4A; letter-spacing:.15em; text-transform:uppercase; margin-top:2px;
      }

      .lp-hero {
        margin:3rem 0;
      }
      .lp-hero-eyebrow {
        display:inline-flex; align-items:center; gap:.5rem;
        background:rgba(56,161,105,.08); border:1px solid rgba(56,161,105,.2);
        border-radius:20px; padding:.3rem .875rem;
        font-size:.72rem; color:#38A169; font-weight:600; letter-spacing:.04em;
        margin-bottom:1.5rem;
      }
      .lp-hero-dot { width:6px; height:6px; border-radius:50%; background:#38A169; animation:hblink 2s ease-in-out infinite; }
      @keyframes hblink { 0%,100%{opacity:1} 50%{opacity:.3} }

      .lp-headline {
        font-family:'Syne',sans-serif; font-size:clamp(2rem,3.2vw,3.2rem);
        font-weight:800; line-height:1.07; letter-spacing:-.03em; color:#F5F0E8;
        margin-bottom:1.25rem;
      }
      .lp-headline-gold {
        background:linear-gradient(135deg, #C9A84C 0%, #E8C96A 40%, #C9A84C 70%, #F5E8B8 100%);
        background-size:200% auto;
        -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text;
        animation:goldshine 4s linear infinite;
      }
      @keyframes goldshine { to{background-position:200% center} }
      .lp-headline-dim { color:#1A2A3A; }

      .lp-desc {
        font-size:.9375rem; color:#3A4A5A; line-height:1.8; max-width:400px;
      }

      /* Stats row */
      .lp-stats {
        display:flex; gap:2.5rem; margin-top:2.5rem;
      }
      .lp-stat-val {
        font-family:'Syne',sans-serif; font-size:1.625rem; font-weight:700; line-height:1;
      }
      .lp-stat-lbl {
        font-size:.7rem; color:#2A3A4A; text-transform:uppercase; letter-spacing:.08em; margin-top:.25rem;
      }

      /* Feature list */
      .lp-features { display:flex; flex-direction:column; gap:0; margin-top:2.5rem; }
      .lp-feat {
        display:flex; align-items:center; gap:.875rem;
        padding:.625rem 0; border-bottom:1px solid rgba(255,255,255,.03);
        animation:featIn .5s cubic-bezier(.16,1,.3,1) both;
      }
      .lp-feat:last-child { border-bottom:none; }
      .lp-feat:nth-child(1){animation-delay:.3s} .lp-feat:nth-child(2){animation-delay:.38s}
      .lp-feat:nth-child(3){animation-delay:.46s} .lp-feat:nth-child(4){animation-delay:.54s}
      .lp-feat:nth-child(5){animation-delay:.62s}
      @keyframes featIn { from{opacity:0;transform:translateX(-10px)} to{opacity:1;transform:translateX(0)} }
      .lp-feat-icon {
        width:32px; height:32px; border-radius:9px;
        display:flex; align-items:center; justify-content:center;
        font-size:.85rem; flex-shrink:0;
      }
      .lp-feat-title { font-size:.8125rem; font-weight:600; color:#C8BFA8; }
      .lp-feat-desc  { font-size:.74rem; color:#2A3A4A; margin-top:.05rem; line-height:1.4; }

      /* Scrolling ticker */
      .lp-ticker { overflow:hidden; border-top:1px solid rgba(201,168,76,.05); padding:.625rem 0; margin-top:2rem; }
      .lp-ticker-inner { display:inline-flex; gap:2.5rem; animation:tickScroll 30s linear infinite; white-space:nowrap; }
      @keyframes tickScroll { from{transform:translateX(0)} to{transform:translateX(-50%)} }
      .lp-tick { font-size:.65rem; color:#1E2E3E; text-transform:uppercase; letter-spacing:.12em; display:flex; align-items:center; gap:.5rem; }
      .lp-tick-dot { width:3px; height:3px; border-radius:50%; background:rgba(201,168,76,.35); flex-shrink:0; }

      /* Right panel — login card */
      .lp-right {
        flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center;
        padding:2rem; position:relative; z-index:1;
        animation:panelRight .8s cubic-bezier(.16,1,.3,1) .1s both;
      }
      @keyframes panelRight { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }

      .lp-card {
        width:100%; max-width:420px;
        background:rgba(8,16,30,.85);
        border:1px solid rgba(201,168,76,.16);
        border-radius:28px;
        backdrop-filter:blur(28px);
        box-shadow:
          0 0 0 1px rgba(201,168,76,.04),
          0 40px 100px rgba(0,0,0,.7),
          inset 0 1px 0 rgba(201,168,76,.06);
        overflow:hidden; position:relative;
      }
      .lp-card-top-glow {
        position:absolute; top:-60px; left:50%; transform:translateX(-50%);
        width:260px; height:120px;
        background:radial-gradient(ellipse, rgba(201,168,76,.06) 0%, transparent 70%);
        pointer-events:none;
      }

      .lp-card-header {
        padding:2rem 2.25rem 1.5rem;
        border-bottom:1px solid rgba(201,168,76,.07);
      }
      .lp-card-title {
        font-family:'Syne',sans-serif; font-size:1.5rem; font-weight:700;
        letter-spacing:-.025em; color:#F5F0E8; margin-bottom:.375rem;
      }
      .lp-card-sub { font-size:.8125rem; color:#2A3A4A; line-height:1.5; }

      .lp-card-body { padding:1.75rem 2.25rem 2.25rem; }

      /* Error box */
      .lp-error {
        display:none;
        background:rgba(229,62,62,.07); border:1px solid rgba(229,62,62,.2);
        border-radius:10px; padding:.75rem 1rem; margin-bottom:1.25rem;
        color:#FC8181; font-size:.825rem; line-height:1.6;
      }



      /* Google button */
      .lp-google {
        width:100%; display:flex; align-items:center; justify-content:center; gap:.875rem;
        padding:1rem 1.5rem; border-radius:14px;
        background:#fff; color:#1a1a1a;
        border:none; cursor:pointer;
        font-family:'DM Sans',sans-serif; font-size:.9375rem; font-weight:600;
        transition:all .2s cubic-bezier(.16,1,.3,1);
        box-shadow:0 4px 20px rgba(0,0,0,.4), inset 0 1px 0 rgba(255,255,255,.9);
        position:relative; overflow:hidden;
      }
      .lp-google::after {
        content:''; position:absolute; inset:0;
        background:linear-gradient(rgba(255,255,255,0), rgba(255,255,255,.1));
        opacity:0; transition:opacity .2s;
      }
      .lp-google:hover:not(:disabled)::after { opacity:1; }
      .lp-google:hover:not(:disabled) { transform:translateY(-2px); box-shadow:0 8px 32px rgba(0,0,0,.5); }
      .lp-google:active:not(:disabled) { transform:translateY(0); }
      .lp-google:disabled { opacity:.4; cursor:not-allowed; }

      .lp-divider {
        display:flex; align-items:center; gap:.875rem; margin:1.5rem 0;
      }
      .lp-divider-line { flex:1; height:1px; background:linear-gradient(90deg, transparent, rgba(201,168,76,.1), transparent); }
      .lp-divider-txt  { font-size:.67rem; color:#1E2E3E; letter-spacing:.1em; text-transform:uppercase; }

      .lp-trust {
        display:flex; justify-content:center; gap:1.25rem; flex-wrap:wrap; margin-bottom:1.25rem;
      }
      .lp-trust-item {
        display:flex; align-items:center; gap:.35rem;
        font-size:.72rem; color:#1E2E3E;
      }

      .lp-legal {
        font-size:.71rem; color:#1A2A3A; text-align:center; line-height:1.7; margin-top:1rem;
      }
      .lp-legal a { color:#2A3A4A; text-decoration:underline; }
      .lp-legal a:hover { color:#C9A84C; }

      /* Testimonial at bottom of left panel */
      .lp-testimonial {
        background:rgba(201,168,76,.03); border:1px solid rgba(201,168,76,.07);
        border-radius:14px; padding:1.125rem; margin-top:2rem;
      }
      .lp-testi-avatar {
        width:36px; height:36px; border-radius:50%;
        background:linear-gradient(135deg,#C9A84C,#6B4E1A);
        display:flex; align-items:center; justify-content:center;
        font-size:.875rem; font-weight:700; color:#04080F; flex-shrink:0;
      }

      @media(max-width:900px) {
        .lp-left { display:none; }
        .lp-right { padding:1.5rem; }
      }
    </style>

    <div class="lp">
      <div class="lp-bg">
        <div class="lp-bg-grid"></div>
        <div class="lp-bg-glow1"></div>
        <div class="lp-bg-glow2"></div>
      </div>

      <!-- ── LEFT PANEL ── -->
      <div class="lp-left">
        <div>
          <!-- Wordmark -->
          <div class="lp-wordmark">
            <div class="lp-wordmark-icon">
              <svg width="22" height="22" viewBox="0 0 40 40" fill="none">
                <path d="M10 20 L20 10 L30 20 L20 30 Z" fill="#C9A84C" opacity=".9"/>
                <circle cx="20" cy="20" r="4.5" fill="#C9A84C"/>
              </svg>
            </div>
            <div>
              <div class="lp-wordmark-name">Filio</div>
              <div class="lp-wordmark-sub">CA Office OS</div>
            </div>
          </div>

          <!-- Hero -->
          <div class="lp-hero">
            <div class="lp-hero-eyebrow">
              <div class="lp-hero-dot"></div>
              Built for Indian CA firms
            </div>
            <h1 class="lp-headline">
              The <span class="lp-headline-gold">operating system</span><br/>
              every CA firm<br/>
              <span class="lp-headline-dim">deserves.</span>
            </h1>
            <p class="lp-desc">
              GST, ITR, TDS, ROC — compliance tracking, client management, billing, and staff tasks. One dashboard.
            </p>

            <!-- Stats -->
            <div class="lp-stats">
              <div>
                <div class="lp-stat-val" style="color:#C9A84C">1.4L+</div>
                <div class="lp-stat-lbl">CAs in India</div>
              </div>
              <div>
                <div class="lp-stat-val" style="color:#38A169">5h+</div>
                <div class="lp-stat-lbl">Saved weekly</div>
              </div>
              <div>
                <div class="lp-stat-val" style="color:#0EA5E9">₹799</div>
                <div class="lp-stat-lbl">Per month</div>
              </div>
              <div>
                <div class="lp-stat-val" style="color:#805AD5">14d</div>
                <div class="lp-stat-lbl">Free trial</div>
              </div>
            </div>

            <!-- Features -->
            <div class="lp-features">
              ${[
                ['rgba(201,168,76,.1)','📊','GST & ITR Tracker','Color-coded status for every client — Red, Yellow, Green'],
                ['rgba(56,161,105,.1)','📁','Document Collection','Client portal + auto WhatsApp reminders after 3 days'],
                ['rgba(14,165,233,.1)','🧾','Invoicing + PDF','CGST/SGST split, PDF download, Razorpay payment links'],
                ['rgba(128,90,213,.1)','✅','Staff Task Management','Assign tasks to article clerks — track, complete, notify'],
                ['rgba(221,107,32,.1)','📅','Compliance Calendar','GST, ITR, TDS, ROC, PF, ESI, PT — every due date loaded'],
              ].map(([bg,icon,title,desc]) => `
              <div class="lp-feat">
                <div class="lp-feat-icon" style="background:${bg}">${icon}</div>
                <div>
                  <div class="lp-feat-title">${title}</div>
                  <div class="lp-feat-desc">${desc}</div>
                </div>
              </div>`).join('')}
            </div>
          </div>
        </div>

        <div>
          <!-- Testimonial -->
          <div class="lp-testimonial">
            <div style="display:flex;gap:.75rem;align-items:flex-start">
              <div class="lp-testi-avatar">P</div>
              <div>
                <p style="color:#3A4A5A;font-size:.8rem;font-style:italic;line-height:1.7">
                  "Earlier I spent 3 hours every 20th chasing clients for GST documents. Filio automated all of it."
                </p>
                <div style="display:flex;align-items:center;gap:.5rem;margin-top:.5rem">
                  <span style="font-size:.75rem;color:#C9A84C;font-weight:600">CA Priya Nair</span>
                  <span style="color:#1A2A3A;font-size:.7rem">· Ernakulam</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Ticker -->
          <div class="lp-ticker">
            <div class="lp-ticker-inner">
              ${['GST TRACKER','ITR FILING','TDS RETURNS','ROC COMPLIANCE','DOCUMENT COLLECTION','STAFF TASKS','BILLING','WHATSAPP REMINDERS','CLIENT PORTAL','PF & ESI','PROFESSIONAL TAX','COMPLIANCE CALENDAR'].map(x=>`<span class="lp-tick"><span class="lp-tick-dot"></span>${x}</span>`).join('')}
              ${['GST TRACKER','ITR FILING','TDS RETURNS','ROC COMPLIANCE','DOCUMENT COLLECTION','STAFF TASKS','BILLING','WHATSAPP REMINDERS','CLIENT PORTAL','PF & ESI','PROFESSIONAL TAX','COMPLIANCE CALENDAR'].map(x=>`<span class="lp-tick"><span class="lp-tick-dot"></span>${x}</span>`).join('')}
            </div>
          </div>
        </div>
      </div>

      <!-- ── RIGHT PANEL ── -->
      <div class="lp-right">
        <!-- Mobile logo -->
        <div id="mob-logo" style="display:none;margin-bottom:2rem;text-align:center">
          <div style="display:inline-flex;align-items:center;gap:.625rem">
            <div style="width:38px;height:38px;background:rgba(201,168,76,.1);border:1px solid rgba(201,168,76,.2);border-radius:10px;display:flex;align-items:center;justify-content:center">
              <svg width="18" height="18" viewBox="0 0 40 40" fill="none"><path d="M10 20 L20 10 L30 20 L20 30 Z" fill="#C9A84C"/><circle cx="20" cy="20" r="4" fill="#C9A84C"/></svg>
            </div>
            <div>
              <div style="font-family:'Syne',sans-serif;font-size:1.25rem;font-weight:800;color:#C9A84C;letter-spacing:-.02em">Filio</div>
              <div style="font-size:.58rem;color:#2A3A4A;letter-spacing:.12em;text-transform:uppercase">CA Office OS</div>
            </div>
          </div>
        </div>
        <style>@media(max-width:900px){#mob-logo{display:block!important}}</style>

        <div class="lp-card">
          <div class="lp-card-top-glow"></div>

          <div class="lp-card-header">
            <div class="lp-card-title">Sign in to Filio</div>
            <div class="lp-card-sub">Access your CA firm dashboard</div>
          </div>

          <div class="lp-card-body">
            <!-- Error -->
            <div id="login-error" class="lp-error"></div>

            <!-- Google Sign-in Button -->
            <button id="google-btn" class="lp-google" onclick="LoginPage._handleClick()">
              <svg width="20" height="20" viewBox="0 0 24 24" style="flex-shrink:0">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              <span id="google-btn-label">Continue with Google</span>
            </button>

            <!-- New user note -->
            <div style="background:rgba(201,168,76,.04);border:1px solid rgba(201,168,76,.1);border-radius:12px;padding:1rem;text-align:center;margin:1.25rem 0">
              <p style="font-size:.8125rem;color:#3A4A5A;line-height:1.65">
                <strong style="color:#C9A84C">New to Filio?</strong><br/>
                Sign in with Google — we'll create your account and set up your firm in 2 minutes.
              </p>
            </div>

            <!-- Trust signals -->
            <div class="lp-trust">
              ${[['🔒','SSL Encrypted'],['🇮🇳','India Servers'],['⚡','14-Day Free Trial'],['🚫','No Credit Card']].map(([i,l])=>`
              <div class="lp-trust-item"><span>${i}</span><span>${l}</span></div>`).join('')}
            </div>

            <p class="lp-legal">
              By signing in, you agree to our
              <a href="#/terms">Terms of Service</a> and
              <a href="#/privacy">Privacy Policy</a>
            </p>
          </div>
        </div>
      </div>
    </div>`;

    this._loading = false;
  },

  _handleClick() {
    if (Auth.isFileProtocol()) return;
    this._signIn();
  },

  async _signIn() {
    if (this._loading) return;
    this._loading = true;

    const btn   = document.getElementById('google-btn');
    const label = document.getElementById('google-btn-label');
    const errEl = document.getElementById('login-error');

    if (btn)   btn.disabled = true;
    if (label) label.innerHTML = '<div style="width:16px;height:16px;border:2px solid rgba(0,0,0,.15);border-top-color:#333;border-radius:50%;animation:spin .7s linear infinite;flex-shrink:0"></div>&nbsp;Connecting…';
    if (errEl) errEl.style.display = 'none';

    const { user, error } = await Auth.signInWithGoogle();

    if (!error) return; // auth state change will route automatically

    this._loading = false;
    if (btn)   btn.disabled = false;
    if (label) label.textContent = 'Continue with Google';

    const MSGS = {
      'auth/popup-blocked':          'Popup blocked. Please allow popups for this site in your browser settings, then try again.',
      'auth/popup-closed-by-user':   'Sign-in window was closed. Please try again.',
      'auth/cancelled-popup-request':'Cancelled. Please try again.',
      'auth/network-request-failed': 'Network error. Please check your internet connection.',
      'auth/unauthorized-domain':    'This domain is not authorised. Add it in Firebase Console → Authentication → Authorized domains.',
      'auth/operation-not-allowed':  'Google sign-in is not enabled. Enable it in Firebase Console → Authentication → Sign-in method → Google.',
      'auth/invalid-api-key':        'Invalid API key. Please check your firebase-config.js.',
    };
    const msg = MSGS[error.code] || `Error: ${error.message || error.code || 'Unknown error'}`;
    if (errEl) { errEl.textContent = '⚠ ' + msg; errEl.style.display = ''; }
  },
};
