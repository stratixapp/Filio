// js/pages/landing.js

const LandingPage = {
  render() {
    const features = [
      { icon: '📊', title: 'GST & ITR Tracker', desc: 'Color-coded compliance dashboard for every client. Never miss a filing deadline again.' },
      { icon: '📁', title: 'Client Portal', desc: 'Clients upload their own documents. Your team stops chasing WhatsApp messages.' },
      { icon: '📨', title: 'WhatsApp Reminders', desc: 'Automated reminders go out before every due date. One click, all clients.' },
      { icon: '💰', title: 'Billing & Invoicing', desc: 'Professional GST invoices with Razorpay payment links. Collections on autopilot.' },
      { icon: '✅', title: 'Task Management', desc: 'Assign tasks to staff, set priorities, track completion. Full accountability.' },
      { icon: '📅', title: 'Compliance Calendar', desc: 'All statutory deadlines pre-loaded. GSTR-1, GSTR-3B, ITR, TDS — all in one place.' },
    ];

    document.getElementById('app').innerHTML = `
    <!-- Nav -->
    <nav class="landing-nav">
      <a href="#/" class="logo-wrap">
        <div class="logo-icon">${Icons.logo}</div>
        <span class="logo-text">Filio</span>
      </a>
      <div style="display:flex;align-items:center;gap:1rem">
        <a href="#/login" class="btn btn-ghost btn-sm">Sign in</a>
        <a href="#/login" class="btn btn-primary btn-sm">Start Free Trial</a>
      </div>
    </nav>

    <!-- Hero -->
    <section class="landing-hero" style="padding-top:80px">
      <div style="max-width:720px;position:relative;z-index:1">
        <div class="hero-badge">✦ Built for Indian CA Firms</div>
        <h1 style="font-size:clamp(2.5rem,6vw,4rem);margin-bottom:1.25rem">
          Your entire CA firm.<br/>
          <span class="gradient-text">One dashboard.</span>
        </h1>
        <p style="color:var(--text-secondary);font-size:1.1rem;max-width:520px;margin:0 auto 1rem">
          GST tracking, ITR filing, client management, billing, and staff tasks — every workflow your firm needs, finally unified.
        </p>
        <p style="color:var(--text-muted);font-size:.875rem">Trusted by CA firms across Kerala</p>
        <div class="hero-cta-group">
          <a href="#/login" class="btn btn-primary btn-lg">Start 14-Day Free Trial</a>
          <a href="#login-demo" class="btn btn-secondary btn-lg" onclick="LandingPage.scrollDemo(event)">See how it works</a>
        </div>
        <p style="margin-top:1.25rem;color:var(--text-muted);font-size:.8rem">No credit card required · Cancel anytime</p>
      </div>

      <!-- Background decoration -->
      <div style="position:absolute;inset:0;opacity:.04;background-image:linear-gradient(var(--gold) 1px,transparent 1px),linear-gradient(90deg,var(--gold) 1px,transparent 1px);background-size:50px 50px;pointer-events:none"></div>
      <div style="position:absolute;width:600px;height:600px;border-radius:50%;background:radial-gradient(circle,rgba(201,168,76,.08),transparent 70%);pointer-events:none;top:50%;left:50%;transform:translate(-50%,-50%)"></div>
    </section>

    <!-- Features -->
    <section id="login-demo" style="padding:5rem 2rem;background:var(--bg-elevated)">
      <div style="text-align:center;margin-bottom:3rem">
        <h2 style="margin-bottom:.75rem">Everything your firm needs</h2>
        <p style="color:var(--text-secondary);max-width:480px;margin:0 auto">
          Stop juggling spreadsheets, WhatsApp groups, and tally files. Filio brings it all together.
        </p>
      </div>
      <div class="feature-grid">
        ${features.map(f => `
        <div class="feature-card">
          <div class="feature-icon" style="font-size:1.5rem">${f.icon}</div>
          <h4 style="font-family:var(--font-body);font-size:1rem;font-weight:600;margin-bottom:.5rem">${f.title}</h4>
          <p style="color:var(--text-secondary);font-size:.875rem">${f.desc}</p>
        </div>`).join('')}
      </div>
    </section>

    <!-- Testimonial + CTA -->
    <section style="padding:5rem 2rem;text-align:center">
      <div style="max-width:600px;margin:0 auto">
        <div class="card-elevated" style="margin-bottom:3rem;text-align:left">
          <p style="color:var(--text-secondary);font-size:1rem;font-style:italic;line-height:1.8">
            "Earlier I spent 3 hours every 20th chasing clients for GST documents. Now Filio does it automatically. I just file."
          </p>
          <p style="color:var(--gold);font-size:.875rem;margin-top:.875rem;font-weight:500">
            — CA Priya Nair, Ernakulam
          </p>
        </div>
        <h2 style="margin-bottom:1rem">Ready to run a smarter firm?</h2>
        <p style="color:var(--text-secondary);margin-bottom:2rem">Join CA firms across India already using Filio.</p>
        <a href="#/login" class="btn btn-primary btn-lg">Get Started Free</a>
      </div>
    </section>

    <!-- Footer -->
    <footer style="padding:2rem;text-align:center;border-top:1px solid var(--border-light);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:1rem">
      <span class="logo-text" style="font-size:1.1rem">Filio</span>
      <div style="display:flex;gap:1.5rem">
        <a href="#/terms" style="color:var(--text-muted);font-size:.8125rem">Terms</a>
        <a href="#/privacy" style="color:var(--text-muted);font-size:.8125rem">Privacy</a>
      </div>
      <p style="color:var(--text-muted);font-size:.75rem">© 2025 Filio. All rights reserved.</p>
    </footer>`;
  },

  scrollDemo(e) {
    e.preventDefault();
    document.getElementById('login-demo')?.scrollIntoView({ behavior: 'smooth' });
  },
};
