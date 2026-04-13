// js/audit-trail.js — Client-side audit trail with server enforcement guide
// ═══════════════════════════════════════════════════════════════
//  Problem: Audit logs were written client-side only.
//  A user could modify their own audit entries or skip logging.
//
//  Fix (two-layer):
//  Layer 1 (this file): Enhanced client-side audit — richer context,
//           structured format, called from every critical operation.
//  Layer 2 (Firebase Function): Firestore trigger that automatically
//           creates an audit entry whenever key collections change —
//           regardless of whether the client logged it.
//           This makes audit trail TAMPER-PROOF.
//
//  The Firebase Function code is included below (deploy separately).
// ═══════════════════════════════════════════════════════════════

const AuditTrail = (() => {

  // ── Action categories ────────────────────────────────────────
  const ACTIONS = {
    // Clients
    CLIENT_CREATED:    'client.created',
    CLIENT_UPDATED:    'client.updated',
    CLIENT_DELETED:    'client.deleted',
    // Invoices
    INVOICE_CREATED:   'invoice.created',
    INVOICE_UPDATED:   'invoice.updated',
    INVOICE_DELETED:   'invoice.deleted',
    INVOICE_PAID:      'invoice.paid',
    INVOICE_SENT:      'invoice.sent',
    // Tasks
    TASK_CREATED:      'task.created',
    TASK_UPDATED:      'task.updated',
    TASK_COMPLETED:    'task.completed',
    TASK_DELETED:      'task.deleted',
    // Compliance
    GST_STATUS_CHANGED: 'compliance.gst.updated',
    ITR_STATUS_CHANGED: 'compliance.itr.updated',
    TDS_STATUS_CHANGED: 'compliance.tds.updated',
    // Staff
    STAFF_INVITED:     'staff.invited',
    STAFF_REMOVED:     'staff.removed',
    STAFF_ROLE_CHANGED:'staff.role_changed',
    // Auth
    USER_LOGIN:        'auth.login',
    USER_LOGOUT:       'auth.logout',
    // Plan
    PLAN_UPGRADED:     'billing.plan_upgraded',
    // Data
    BACKUP_CREATED:    'data.backup_created',
    BULK_IMPORT:       'data.bulk_import',
    // Docs
    DOC_REQUEST_CREATED: 'docs.request_created',
    DOC_UPLOADED:        'docs.uploaded',
  };

  // ── Log a structured audit entry ─────────────────────────────
  async function log(firmId, action, details = {}) {
    if (!firmId || !auth.currentUser) return;

    const entry = {
      // Who
      uid:         auth.currentUser.uid,
      email:       auth.currentUser.email || '',
      displayName: auth.currentUser.displayName || '',
      // What
      action,
      // Details — sanitise to avoid storing sensitive data
      entityId:    details.entityId    || '',
      entityType:  details.entityType  || '',
      entityLabel: details.entityLabel || '',
      changes:     details.changes
        ? JSON.stringify(details.changes).slice(0, 500)
        : '',
      note:        (details.note || '').slice(0, 200),
      // Context
      userAgent:   navigator.userAgent.slice(0, 150),
      timestamp:   firebase.firestore.FieldValue.serverTimestamp(),
      // Source — lets server trigger know it was client-initiated
      source:      'client',
    };

    try {
      await DataIntegrity.withRetry(
        () => db.collection('firms').doc(firmId)
          .collection('auditLog').add(entry),
        { label: 'auditLog', maxAttempts: 2 }
      );
    } catch (e) {
      // Audit log failure must never crash the app
      console.warn('[AuditTrail] Log failed:', e.message);
    }
  }

  // ── Convenience methods ──────────────────────────────────────
  const logClientCreated    = (f, id, name)      => log(f, ACTIONS.CLIENT_CREATED,   { entityId: id, entityType: 'client',  entityLabel: name });
  const logClientUpdated    = (f, id, name, chg) => log(f, ACTIONS.CLIENT_UPDATED,   { entityId: id, entityType: 'client',  entityLabel: name, changes: chg });
  const logClientDeleted    = (f, id, name)      => log(f, ACTIONS.CLIENT_DELETED,   { entityId: id, entityType: 'client',  entityLabel: name });
  const logInvoiceCreated   = (f, id, no)        => log(f, ACTIONS.INVOICE_CREATED,  { entityId: id, entityType: 'invoice', entityLabel: no });
  const logInvoicePaid      = (f, id, no)        => log(f, ACTIONS.INVOICE_PAID,     { entityId: id, entityType: 'invoice', entityLabel: no });
  const logTaskCompleted    = (f, id, title)     => log(f, ACTIONS.TASK_COMPLETED,   { entityId: id, entityType: 'task',    entityLabel: title });
  const logPlanUpgraded     = (f, plan, payId)   => log(f, ACTIONS.PLAN_UPGRADED,    { note: `plan=${plan} payId=${payId?.slice(0,15)}` });
  const logBackupCreated    = (f, counts)        => log(f, ACTIONS.BACKUP_CREATED,   { note: JSON.stringify(counts) });
  const logLogin            = (f)                => log(f, ACTIONS.USER_LOGIN);
  const logLogout           = (f)                => log(f, ACTIONS.USER_LOGOUT);
  const logStaffInvited     = (f, email, role)   => log(f, ACTIONS.STAFF_INVITED,    { note: `email=${email} role=${role}` });
  const logStaffRemoved     = (f, uid, name)     => log(f, ACTIONS.STAFF_REMOVED,    { entityId: uid, entityLabel: name });
  const logBulkImport       = (f, count)         => log(f, ACTIONS.BULK_IMPORT,      { note: `${count} records` });
  const logGSTUpdated       = (f, cId, cName, period, field, val) =>
    log(f, ACTIONS.GST_STATUS_CHANGED, {
      entityId: cId, entityLabel: cName, note: `period=${period} field=${field} value=${val}`,
    });

  // ── Query audit log (for owner view) ─────────────────────────
  function subscribeAuditLog(firmId, limit = 100, cb) {
    return db.collection('firms').doc(firmId)
      .collection('auditLog')
      .orderBy('timestamp', 'desc')
      .limit(limit)
      .onSnapshot(
        s => cb(s.docs.map(d => ({ id: d.id, ...d.data() }))),
        err => { console.warn('[AuditTrail] subscribe error:', err.message); cb([]); }
      );
  }

  // ── Filter audit log by entity ───────────────────────────────
  async function getEntityHistory(firmId, entityId) {
    const snap = await db.collection('firms').doc(firmId)
      .collection('auditLog')
      .where('entityId', '==', entityId)
      .orderBy('timestamp', 'desc')
      .limit(50)
      .get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }

  return {
    ACTIONS,
    log,
    logClientCreated, logClientUpdated, logClientDeleted,
    logInvoiceCreated, logInvoicePaid,
    logTaskCompleted,
    logPlanUpgraded,
    logBackupCreated,
    logLogin, logLogout,
    logStaffInvited, logStaffRemoved,
    logBulkImport,
    logGSTUpdated,
    subscribeAuditLog,
    getEntityHistory,
  };

})();


// ═══════════════════════════════════════════════════════════════
//  FIREBASE FUNCTION — Server-enforced audit trail
//  File: functions/index.js (add to existing exports)
//
//  This Firestore trigger fires on EVERY write to key collections.
//  It creates a server-side audit entry that the client cannot skip
//  or tamper with. Server entries have source:'server'.
//
//  Deploy: firebase deploy --only functions
// ═══════════════════════════════════════════════════════════════
/*

// ── Automatic audit trigger for clients ──────────────────────
exports.auditClients = functions
  .region('asia-south1')
  .firestore
  .document('firms/{firmId}/clients/{clientId}')
  .onWrite(async (change, context) => {
    const { firmId, clientId } = context.params;
    const before = change.before.exists ? change.before.data() : null;
    const after  = change.after.exists  ? change.after.data()  : null;

    let action, note = '';
    if (!before && after)  { action = 'client.created'; note = `name=${after.name}`; }
    else if (before && !after) { action = 'client.deleted'; note = `name=${before.name}`; }
    else {
      action = 'client.updated';
      // Detect what changed
      const changed = Object.keys(after).filter(k =>
        JSON.stringify(before[k]) !== JSON.stringify(after[k]) &&
        !['updatedAt'].includes(k)
      );
      note = `changed: ${changed.join(', ')}`;
    }

    await admin.firestore()
      .collection('firms').doc(firmId)
      .collection('auditLog').add({
        uid:        after?.updatedBy || before?.createdBy || 'unknown',
        action,
        entityId:   clientId,
        entityType: 'client',
        entityLabel: (after || before)?.name || '',
        note:        note.slice(0, 200),
        source:      'server',  // ← tamper-proof: server wrote this
        timestamp:   admin.firestore.FieldValue.serverTimestamp(),
      });
  });

// ── Automatic audit trigger for invoices ─────────────────────
exports.auditInvoices = functions
  .region('asia-south1')
  .firestore
  .document('firms/{firmId}/invoices/{invoiceId}')
  .onWrite(async (change, context) => {
    const { firmId, invoiceId } = context.params;
    const before = change.before.exists ? change.before.data() : null;
    const after  = change.after.exists  ? change.after.data()  : null;

    let action = 'invoice.updated', note = '';
    if (!before && after)     { action = 'invoice.created'; note = `no=${after.invoiceNo} amt=${after.total}`; }
    else if (before && !after){ action = 'invoice.deleted'; note = `no=${before.invoiceNo}`; }
    else if (before?.status !== after?.status) {
      action = after?.status === 'paid' ? 'invoice.paid' : 'invoice.updated';
      note = `status: ${before.status} -> ${after.status}`;
    }

    await admin.firestore()
      .collection('firms').doc(firmId)
      .collection('auditLog').add({
        uid:         after?.createdBy || 'unknown',
        action,
        entityId:    invoiceId,
        entityType:  'invoice',
        entityLabel: (after || before)?.invoiceNo || '',
        note:        note.slice(0, 200),
        source:      'server',
        timestamp:   admin.firestore.FieldValue.serverTimestamp(),
      });
  });

// ── Automatic audit trigger for tasks ────────────────────────
exports.auditTasks = functions
  .region('asia-south1')
  .firestore
  .document('firms/{firmId}/tasks/{taskId}')
  .onWrite(async (change, context) => {
    const { firmId, taskId } = context.params;
    const before = change.before.exists ? change.before.data() : null;
    const after  = change.after.exists  ? change.after.data()  : null;

    let action = 'task.updated', note = '';
    if (!before && after)     { action = 'task.created'; note = `title=${after.title}`; }
    else if (before && !after){ action = 'task.deleted'; note = `title=${before.title}`; }
    else if (before?.status !== after?.status) {
      action = after?.status === 'done' ? 'task.completed' : 'task.updated';
      note = `status: ${before.status} -> ${after.status}`;
    }

    await admin.firestore()
      .collection('firms').doc(firmId)
      .collection('auditLog').add({
        uid:         after?.assignedTo || after?.createdBy || 'unknown',
        action,
        entityId:    taskId,
        entityType:  'task',
        entityLabel: (after || before)?.title || '',
        note:        note.slice(0, 200),
        source:      'server',
        timestamp:   admin.firestore.FieldValue.serverTimestamp(),
      });
  });

*/
