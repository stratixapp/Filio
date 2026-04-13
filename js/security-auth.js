// js/security-auth.js — Secure Auth wrapper
// Patches Auth.signInWithGoogle with rate limiting + brute force protection

(function patchAuth() {
  function patch() {
    if (typeof Auth === 'undefined' || typeof Security === 'undefined') {
      setTimeout(patch, 50); return;
    }

    const _signIn = Auth.signInWithGoogle.bind(Auth);
    Auth.signInWithGoogle = async function() {
      try {
        Security.checkAuthRateLimit(); // Throws if too many attempts
      } catch(e) {
        return { user: null, error: { code: 'filio/rate-limited', message: e.message } };
      }
      const result = await _signIn();
      if (result.user) {
        Security.resetSession();
        // Log successful sign-in
        try {
          await db.collection('users').doc(result.user.uid).update({
            lastSignIn:  firebase.firestore.FieldValue.serverTimestamp(),
            lastAgent:   navigator.userAgent.slice(0,200),
          });
        } catch(e) { /* non-critical */ }
      }
      return result;
    };

    // Patch signOut to clear session and secure storage
    const _signOut = Auth.signOut.bind(Auth);
    Auth.signOut = async function() {
      Security.SecureStorage.clear();
      return await _signOut();
    };
  }
  patch();
})();
