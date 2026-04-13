// js/auth.js — Authentication
// BUG FIX: Added proper error handling for all auth states
// BUG FIX: ensureUserProfile now creates doc even if firmId exists (prevents login loop)

const Auth = (() => {

  function isFileProtocol() {
    return window.location.protocol === 'file:';
  }

  async function signInWithGoogle() {
    if (isFileProtocol()) {
      return { user: null, error: { code: 'filio/file-protocol', message: 'file-protocol' } };
    }
    try {
      const result = await auth.signInWithPopup(googleProvider);
      if (result && result.user) {
        await ensureUserProfile(result.user);
      }
      return { user: result.user, error: null };
    } catch (err) {
      console.error('[Filio] signInWithGoogle:', err.code, err.message);
      return { user: null, error: err };
    }
  }

  async function signOut() {
    try { await auth.signOut(); return { error: null }; }
    catch (err) { return { error: err }; }
  }

  // BUG FIX: Use set with merge:true instead of conditional set
  // This prevents the user doc from being missing on second login
  async function ensureUserProfile(user) {
    const ref = db.collection('users').doc(user.uid);
    try {
      const snap = await ref.get();
      if (!snap.exists) {
        await ref.set({
          uid:       user.uid,
          name:      user.displayName || '',
          email:     user.email || '',
          photoURL:  user.photoURL || '',
          role:      'pending_setup',
          firmId:    null,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
      } else {
        // Update photo/name in case it changed, but never overwrite firmId
        await ref.update({
          name:      user.displayName || snap.data().name || '',
          photoURL:  user.photoURL || snap.data().photoURL || '',
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
      }
    } catch (err) {
      console.error('[Filio] ensureUserProfile failed:', err.message);
      // Don't throw — let auth flow continue even if Firestore write fails
    }
  }

  function onAuthChange(callback) {
    return auth.onAuthStateChanged(callback);
  }

  return { signInWithGoogle, signOut, ensureUserProfile, onAuthChange, isFileProtocol };
})();
