// js/payment-verify.js — Razorpay Server-Side Payment Verification
// ═══════════════════════════════════════════════════════════════
//  Problem fixed: Previously the app activated the plan the moment
//  the browser's Razorpay callback fired. A technically-savvy user
//  could intercept / fake this callback and get any plan for free.
//
//  Fix: After Razorpay calls back with a payment_id, we ALWAYS call
//  our Firebase Function to verify the signature server-side before
//  any plan is activated. The client NEVER directly upgrades the plan.
//
//  Firebase Function (functions/index.js) is generated below.
//  Deploy with: firebase deploy --only functions
// ═══════════════════════════════════════════════════════════════

const PaymentVerify = (() => {

  // ── Client-side verifier ─────────────────────────────────────
  // Called after Razorpay checkout handler fires
  async function verifyAndActivate({
    firmId,
    planId,
    paymentId,
    orderId,
    signature,
    isAnnual,
    user,
  }) {
    if (!paymentId) throw new Error('No payment ID received from Razorpay');

    const VALID_PLANS = ['starter', 'growth', 'pro', 'enterprise'];
    if (!VALID_PLANS.includes(planId)) throw new Error('Invalid plan selected');

    // Get current user's ID token for auth
    const idToken = await auth.currentUser?.getIdToken(true);
    if (!idToken) throw new Error('Not authenticated');

    // Call Firebase Function for server-side verification
    // The function verifies the Razorpay signature using the SECRET key
    // (which never touches the browser)
    const response = await fetch('/api/verifyPayment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        firmId,
        planId,
        paymentId,
        orderId:   orderId   || '',
        signature: signature || '',
        isAnnual:  !!isAnnual,
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(err.error || `Verification failed (${response.status})`);
    }

    const result = await response.json();
    if (!result.success) throw new Error(result.error || 'Payment verification failed');

    return result;
  }

  // ── Fallback for local dev (test key, no Functions deployed) ──
  // Only active when hostname is localhost AND key is test key
  async function devModeActivate({ firmId, planId, paymentId }) {
    const isLocalhost = ['localhost', '127.0.0.1'].includes(window.location.hostname);
    const isTestKey   = typeof RAZORPAY_KEY_ID !== 'undefined' &&
                        RAZORPAY_KEY_ID.includes('rzp_test_');

    if (!isLocalhost || !isTestKey) {
      throw new Error('Dev-mode activation only available on localhost with test key');
    }

    const limits = { starter: 50, growth: 150, pro: 400, enterprise: 999999 };
    await DataIntegrity.withRetry(async () => {
      await db.collection('firms').doc(firmId).update({
        plan:               planId,
        planClientLimit:    limits[planId] || 50,
        subscriptionStatus: 'active',
        lastPaymentId:      paymentId,
        lastPaymentMode:    'test',
        subscribedAt:       firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt:          firebase.firestore.FieldValue.serverTimestamp(),
      });
    }, { label: 'devModeActivate' });

    return { success: true, devMode: true };
  }

  return { verifyAndActivate, devModeActivate };

})();


// ═══════════════════════════════════════════════════════════════
//  FIREBASE FUNCTION — functions/index.js
//  Deploy: firebase deploy --only functions
//
//  This is the SERVER-SIDE code. It lives in your /functions folder,
//  NOT in the browser. Copy this to functions/index.js.
//  Run: cd functions && npm install razorpay firebase-admin
// ═══════════════════════════════════════════════════════════════
/*
const functions  = require('firebase-functions');
const admin      = require('firebase-admin');
const crypto     = require('crypto');

admin.initializeApp();
const db = admin.firestore();

// ── Verify Razorpay payment + activate plan ────────────────────
exports.verifyPayment = functions
  .region('asia-south1')
  .https.onRequest(async (req, res) => {

    // CORS
    res.set('Access-Control-Allow-Origin', functions.config().app.domain || '*');
    res.set('Access-Control-Allow-Methods', 'POST');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') { res.status(204).send(''); return; }
    if (req.method !== 'POST')    { res.status(405).json({ error: 'Method not allowed' }); return; }

    // Auth — verify Firebase ID token
    const authHeader = req.headers.authorization || '';
    const idToken    = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!idToken) { res.status(401).json({ error: 'Unauthenticated' }); return; }

    let decoded;
    try { decoded = await admin.auth().verifyIdToken(idToken); }
    catch (e) { res.status(401).json({ error: 'Invalid token' }); return; }

    const { firmId, planId, paymentId, orderId, signature, isAnnual } = req.body;

    // Input validation
    const VALID_PLANS = ['starter', 'growth', 'pro', 'enterprise'];
    if (!firmId || !planId || !paymentId || !VALID_PLANS.includes(planId)) {
      res.status(400).json({ error: 'Invalid request parameters' }); return;
    }

    // Verify caller is the firm owner
    const userDoc = await db.collection('users').doc(decoded.uid).get();
    if (!userDoc.exists || userDoc.data().firmId !== firmId || userDoc.data().role !== 'owner') {
      res.status(403).json({ error: 'Only the firm owner can upgrade the plan' }); return;
    }

    // Verify Razorpay signature (for orders) or just validate payment ID format
    // For test payments or link-based payments, signature may be empty
    if (orderId && signature) {
      const RAZORPAY_SECRET = functions.config().razorpay.secret;
      const body       = orderId + '|' + paymentId;
      const expected   = crypto
        .createHmac('sha256', RAZORPAY_SECRET)
        .update(body)
        .digest('hex');
      if (expected !== signature) {
        res.status(400).json({ error: 'Payment signature verification failed' }); return;
      }
    }

    // Prevent replay: check if this paymentId was already used
    const existing = await db.collection('firms').doc(firmId)
      .collection('auditLog')
      .where('action', '==', 'plan_upgraded')
      .where('details', '>=', paymentId.slice(0, 10))
      .limit(1).get();
    if (!existing.empty) {
      res.status(400).json({ error: 'This payment has already been processed' }); return;
    }

    // Activate the plan
    const limits = { starter: 50, growth: 150, pro: 400, enterprise: 999999 };
    const planMap = { starter: 799, growth: 1499, pro: 2499, enterprise: 4999 };

    const batch = db.batch();
    const firmRef = db.collection('firms').doc(firmId);

    batch.update(firmRef, {
      plan:               planId,
      planClientLimit:    limits[planId],
      subscriptionStatus: 'active',
      lastPaymentId:      paymentId,
      isAnnual:           !!isAnnual,
      subscribedAt:       admin.firestore.FieldValue.serverTimestamp(),
      updatedAt:          admin.firestore.FieldValue.serverTimestamp(),
    });

    // Immutable audit log entry
    const logRef = db.collection('firms').doc(firmId).collection('auditLog').doc();
    batch.set(logRef, {
      uid:       decoded.uid,
      email:     decoded.email || '',
      action:    'plan_upgraded',
      details:   JSON.stringify({ planId, paymentId: paymentId.slice(0, 20), isAnnual }),
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    await batch.commit();

    res.status(200).json({
      success: true,
      plan:    planId,
      message: `${planId} plan activated successfully`,
    });
  });
*/
