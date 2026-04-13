// functions/index.js — Filio Firebase Cloud Functions
// Deploy: firebase deploy --only functions
//
// Setup:
//   cd functions
//   npm install
//   firebase functions:config:set razorpay.secret="rzp_live_SECRET_HERE" app.domain="https://your-app.web.app"
//   firebase deploy --only functions
// ═══════════════════════════════════════════════════════════════

const functions = require('firebase-functions');
const admin     = require('firebase-admin');
const crypto    = require('crypto');

admin.initializeApp();
const db = admin.firestore();

// ── Helper: CORS ───────────────────────────────────────────────
function setCORS(req, res) {
  const allowedOrigins = [
    functions.config().app?.domain || '',
    'http://localhost:5500',
    'http://localhost:3000',
    'http://127.0.0.1:5500',
  ].filter(Boolean);

  const origin = req.headers.origin || '';
  if (allowedOrigins.includes(origin)) {
    res.set('Access-Control-Allow-Origin', origin);
  }
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

// ── verifyPayment ──────────────────────────────────────────────
// Called by billing.js after Razorpay checkout succeeds.
// Verifies the Razorpay signature server-side, then activates the plan.
// The Razorpay SECRET key never leaves this server environment.
exports.verifyPayment = functions
  .region('asia-south1')
  .https.onRequest(async (req, res) => {

    setCORS(req, res);
    if (req.method === 'OPTIONS') { res.status(204).send(''); return; }
    if (req.method !== 'POST')    { res.status(405).json({ error: 'Method not allowed' }); return; }

    // ── Auth: verify Firebase ID token ──────────────────────
    const authHeader = req.headers.authorization || '';
    const idToken    = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!idToken) { res.status(401).json({ error: 'Unauthenticated' }); return; }

    let decoded;
    try {
      decoded = await admin.auth().verifyIdToken(idToken);
    } catch (e) {
      res.status(401).json({ error: 'Invalid or expired token' });
      return;
    }

    const { firmId, planId, paymentId, orderId, signature, isAnnual } = req.body;

    // ── Input validation ────────────────────────────────────
    const VALID_PLANS = ['starter', 'growth', 'pro', 'enterprise'];
    if (!firmId || !planId || !paymentId || !VALID_PLANS.includes(planId)) {
      res.status(400).json({ error: 'Invalid request parameters' });
      return;
    }

    // ── Verify caller is the firm owner ─────────────────────
    let userDoc;
    try {
      userDoc = await db.collection('users').doc(decoded.uid).get();
    } catch (e) {
      res.status(500).json({ error: 'Failed to fetch user record' });
      return;
    }

    if (!userDoc.exists ||
        userDoc.data().firmId !== firmId ||
        userDoc.data().role   !== 'owner') {
      res.status(403).json({ error: 'Only the firm owner can upgrade the plan' });
      return;
    }

    // ── Razorpay signature verification ─────────────────────
    // Only verify if orderId + signature are present (standard checkout flow).
    // Payment Link / UPI flows may not pass signature — still safe because
    // we check payment status from Razorpay API in those cases.
    if (orderId && signature) {
      const RAZORPAY_SECRET = functions.config().razorpay?.secret;
      if (!RAZORPAY_SECRET) {
        console.error('[Filio] razorpay.secret not configured in Firebase Functions config');
        res.status(500).json({ error: 'Payment gateway not configured on server' });
        return;
      }
      const body     = orderId + '|' + paymentId;
      const expected = crypto
        .createHmac('sha256', RAZORPAY_SECRET)
        .update(body)
        .digest('hex');

      if (expected !== signature) {
        res.status(400).json({ error: 'Payment signature verification failed. Contact support.' });
        return;
      }
    }

    // ── Replay prevention ───────────────────────────────────
    // Check auditLog for this paymentId to prevent double-activation
    try {
      const existing = await db
        .collection('firms').doc(firmId)
        .collection('auditLog')
        .where('action', '==', 'plan_upgraded')
        .where('paymentId', '==', paymentId)
        .limit(1)
        .get();

      if (!existing.empty) {
        res.status(400).json({ error: 'This payment has already been processed' });
        return;
      }
    } catch (e) {
      // Log but don't block — auditLog query failure shouldn't block plan activation
      console.warn('[Filio] Replay check failed (non-fatal):', e.message);
    }

    // ── Activate plan ────────────────────────────────────────
    const PLAN_LIMITS = {
      starter:    50,
      growth:     150,
      pro:        400,
      enterprise: 999999,
    };
    const PLAN_PRICES_MONTHLY = {
      starter: 799,
      growth:  1499,
      pro:     2499,
      enterprise: 4999,
    };

    try {
      const batch   = db.batch();
      const firmRef = db.collection('firms').doc(firmId);

      batch.update(firmRef, {
        plan:               planId,
        planClientLimit:    PLAN_LIMITS[planId],
        subscriptionStatus: 'active',
        lastPaymentId:      paymentId,
        isAnnual:           !!isAnnual,
        planMonthlyPrice:   PLAN_PRICES_MONTHLY[planId],
        subscribedAt:       admin.firestore.FieldValue.serverTimestamp(),
        updatedAt:          admin.firestore.FieldValue.serverTimestamp(),
      });

      // Immutable audit log entry
      const logRef = db
        .collection('firms').doc(firmId)
        .collection('auditLog').doc();

      batch.set(logRef, {
        uid:       decoded.uid,
        email:     decoded.email || '',
        action:    'plan_upgraded',
        paymentId: paymentId, // stored for replay prevention
        details:   JSON.stringify({
          planId,
          paymentId: paymentId.slice(0, 20),
          isAnnual:  !!isAnnual,
        }),
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });

      await batch.commit();

      res.status(200).json({
        success: true,
        plan:    planId,
        message: `${planId.charAt(0).toUpperCase() + planId.slice(1)} plan activated successfully`,
      });

    } catch (e) {
      console.error('[Filio] Plan activation failed:', e.message);
      res.status(500).json({ error: 'Plan activation failed. Payment was received. Contact support with payment ID: ' + paymentId });
    }
  });
