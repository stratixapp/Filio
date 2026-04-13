// ─────────────────────────────────────────────────────────────
//  FILIO — Firebase Configuration
//  Step 1: Open this file in Notepad
//  Step 2: Replace the 6 values below with your Firebase config
//  Step 3: Save the file, then refresh the browser
//
//  Where to get your config:
//  → console.firebase.google.com
//  → Select your project
//  → Project Settings (gear icon top left)
//  → Scroll to "Your apps" → click your web app → Config
// ─────────────────────────────────────────────────────────────

const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyBJe91pzbVaqAx5T8PdH92NGsTWV7ae1Vo",
  authDomain:        "filio-a0ea5.firebaseapp.com",
  projectId:         "filio-a0ea5",
  storageBucket:     "filio-a0ea5.firebasestorage.app",
  messagingSenderId: "175351098833",
  appId:             "1:175351098833:web:854bbb96f762a983dd44f0",
};

// Razorpay Key (for billing payments)
// ⚠️  Replace with your rzp_live_... key from razorpay.com/app/keys before deploying
const RAZORPAY_KEY_ID = "rzp_live_PASTE_YOUR_LIVE_KEY_HERE";

// ── DO NOT EDIT BELOW THIS LINE ───────────────────────────────
const _configReady = Object.values(FIREBASE_CONFIG).every(
  v => v && !v.startsWith('PASTE_YOUR')
);

firebase.initializeApp(FIREBASE_CONFIG);

const auth = firebase.auth();
const db   = firebase.firestore();

if (_configReady) {
  // enablePersistence() is deprecated in Firestore 10.x
  // Offline persistence is now enabled by default in the compat SDK.
  // No action needed — Firestore handles offline caching automatically.
}

const googleProvider = new firebase.auth.GoogleAuthProvider();
googleProvider.addScope('email');
googleProvider.addScope('profile');
googleProvider.setCustomParameters({ prompt: 'select_account' });

if (!_configReady) {
  // Render immediately — don't wait for DOMContentLoaded on mobile
  function _renderSetupUI() {
    document.getElementById('app').innerHTML = `
    <div style="min-height:100vh;background:#04080F;display:flex;align-items:center;justify-content:center;padding:1.5rem;font-family:'DM Sans',sans-serif">
      <div style="max-width:500px;width:100%;background:#0A1628;border:1px solid rgba(201,168,76,.3);border-radius:20px;padding:2rem">
        <div style="display:flex;align-items:center;gap:.75rem;margin-bottom:1.5rem">
          <svg width="32" height="32" viewBox="0 0 40 40" fill="none"><rect width="40" height="40" rx="9" fill="#C9A84C" fill-opacity=".12"/><path d="M10 20 L20 10 L30 20 L20 30 Z" fill="#C9A84C"/><circle cx="20" cy="20" r="4" fill="#C9A84C"/></svg>
          <div><div style="font-size:1.25rem;font-weight:700;color:#C9A84C">Filio</div><div style="font-size:.7rem;color:#4A5A6A;letter-spacing:.1em;text-transform:uppercase">Setup Required</div></div>
        </div>
        <div style="background:rgba(229,62,62,.08);border:1px solid rgba(229,62,62,.2);border-radius:10px;padding:.875rem;margin-bottom:1.5rem">
          <p style="color:#FC8181;font-size:.875rem;font-weight:600">Firebase keys not configured</p>
          <p style="color:#6A7A8A;font-size:.8rem;margin-top:.3rem">Open <code style="background:#04080F;padding:.1em .3em;border-radius:3px;color:#C9A84C">js/firebase-config.js</code> in Notepad and fill in your credentials.</p>
        </div>
        <div style="font-size:.8125rem;color:#4A5A6A;line-height:2;margin-bottom:1.25rem">
          <div style="color:#C9A84C;font-weight:600;margin-bottom:.5rem">Steps:</div>
          <div>1. Go to <strong style="color:#C8BFA8">console.firebase.google.com</strong></div>
          <div>2. Open your project → <strong style="color:#C8BFA8">Project Settings</strong> (gear icon)</div>
          <div>3. Scroll to Your apps → web app → copy the Config</div>
          <div>4. Paste the 6 values into firebase-config.js and save</div>
          <div>5. Refresh this page (F5)</div>
        </div>
        <div style="background:#0F1F3D;border-radius:10px;padding:1rem;margin-bottom:1rem">
          <div style="color:#C9A84C;font-weight:600;font-size:.8125rem;margin-bottom:.625rem">Also enable in Firebase Console:</div>
          <div style="font-size:.8rem;color:#4A5A6A;line-height:2">
            <div>• <strong style="color:#C8BFA8">Authentication</strong> → Sign-in method → Google → Enable</div>
            <div>• <strong style="color:#C8BFA8">Firestore</strong> → Create database → Production mode → asia-south1</div>
            <div>• <strong style="color:#C8BFA8">Authentication</strong> → Authorized domains → Add localhost</div>
          </div>
        </div>
        <div style="background:#0F1F3D;border-radius:10px;padding:1rem">
          <div style="color:#38A169;font-weight:600;font-size:.8125rem;margin-bottom:.5rem">Run local server (required for Google sign-in):</div>
          <div style="background:#04080F;border:1px solid rgba(201,168,76,.2);border-radius:8px;padding:.625rem .875rem;font-family:'DM Mono',monospace;font-size:.825rem;color:#C9A84C;cursor:pointer" onclick="navigator.clipboard.writeText('python -m http.server 5500').catch(()=>{});this.textContent='Copied!';setTimeout(()=>this.textContent='python -m http.server 5500',2000)">python -m http.server 5500</div>
          <div style="font-size:.775rem;color:#2A3A4A;margin-top:.5rem">Then open <strong style="color:#38A169">http://localhost:5500</strong></div>
        </div>
      </div>
    </div>`;
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _renderSetupUI);
  } else {
    _renderSetupUI();
  }
}

// ═══════════════════════════════════════════════════════════════
// PHASE 5: CLAUDE API KEY
// ⚠️  DO NOT add any API key here. The Anthropic key is stored
//    securely in Firestore under your firm document (anthropicApiKey).
//    Set it in Settings → AI Integration inside the app.
//    It is NEVER exposed in source code or the browser.
// ═══════════════════════════════════════════════════════════════
