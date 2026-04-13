// js/firestore.js — All Firestore data operations
// BUG FIX: Moved clients/invoices/tasks to firm subcollections
// This eliminates the need for composite Firestore indexes entirely.
// Old path: /clients (top-level, filtered by firmId) ← needs index = BREAKS
// New path: /firms/{firmId}/clients ← no index needed = WORKS immediately

const FS = (() => {
  const ts = () => firebase.firestore.FieldValue.serverTimestamp();

  // ── FIRMS ──────────────────────────────────────────────────
  async function createFirm(uid, data) {
    const firmRef = db.collection('firms').doc();
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + 14);
    await firmRef.set({
      name:               data.name        || '',
      ownerName:          data.ownerName   || '',
      phone:              data.phone       || '',
      email:              data.email       || '',
      gstin:              (data.gstin||'').toUpperCase(),
      address:            data.address     || '',
      city:               data.city        || '',
      state:              data.state       || 'Kerala',
      logoURL:            '',
      plan:               'starter',
      planClientLimit:    50,
      subscriptionStatus: 'trial',
      trialEndsAt:        firebase.firestore.Timestamp.fromDate(trialEnd),
      invoiceCounter:     0,
      activeClientCount:  0,
      createdBy:          uid,
      createdAt:          ts(),
      updatedAt:          ts(),
    });
    await db.collection('users').doc(uid).update({
      firmId: firmRef.id,
      role: 'owner',
      updatedAt: ts(),
    });
    return firmRef.id;
  }

  async function getFirm(firmId) {
    const s = await db.collection('firms').doc(firmId).get();
    return s.exists ? { id: s.id, ...s.data() } : null;
  }

  async function updateFirm(firmId, data) {
    await db.collection('firms').doc(firmId).update({ ...data, updatedAt: ts() });
  }

  // ── CLIENTS (subcollection — no index needed) ──────────────
  function subscribeClients(firmId, cb) {
    return db.collection('firms').doc(firmId).collection('clients')
      .orderBy('createdAt', 'desc')
      .onSnapshot(
        s => cb(s.docs.map(d => ({ id: d.id, ...d.data() }))),
        err => { console.warn('[Filio] subscribeClients:', err.message); cb([]); }
      );
  }

  async function addClient(firmId, data) {
    const firmRef = db.collection('firms').doc(firmId);
    const clientRef = firmRef.collection('clients').doc();
    // Use transaction to atomically add client + increment counter
    await db.runTransaction(async tx => {
      const firmSnap = await tx.get(firmRef);
      const currentCount = firmSnap.data()?.activeClientCount || 0;
      const limit = firmSnap.data()?.planClientLimit || 50;
      const plan  = firmSnap.data()?.plan || 'starter';
      // Client-side limit guard (Firestore rules also enforce this server-side)
      if (plan !== 'enterprise' && currentCount >= limit) {
        throw new Error(`PLAN_LIMIT: You have reached the ${limit}-client limit for your ${plan} plan. Please upgrade to add more clients.`);
      }
      tx.set(clientRef, { ...data, firmId, createdAt: ts(), updatedAt: ts() });
      tx.update(firmRef, {
        activeClientCount: firebase.firestore.FieldValue.increment(1),
        updatedAt: ts(),
      });
    });
    return clientRef.id;
  }

  async function updateClient(firmId, clientId, data) {
    await db.collection('firms').doc(firmId).collection('clients').doc(clientId)
      .update({ ...data, updatedAt: ts() });
  }

  async function deleteClient(firmId, clientId) {
    const firmRef = db.collection('firms').doc(firmId);
    await db.runTransaction(async tx => {
      tx.delete(firmRef.collection('clients').doc(clientId));
      tx.update(firmRef, {
        activeClientCount: firebase.firestore.FieldValue.increment(-1),
        updatedAt: ts(),
      });
    });
  }

  // ── INVOICES (subcollection — no index needed) ─────────────
  function subscribeInvoices(firmId, cb) {
    return db.collection('firms').doc(firmId).collection('invoices')
      .orderBy('createdAt', 'desc')
      .onSnapshot(
        s => cb(s.docs.map(d => ({ id: d.id, ...d.data() }))),
        err => { console.warn('[Filio] subscribeInvoices:', err.message); cb([]); }
      );
  }

  async function addInvoice(firmId, data) {
    // Auto-generate invoice number
    const firmRef = db.collection('firms').doc(firmId);
    const invRef  = firmRef.collection('invoices').doc();
    await db.runTransaction(async tx => {
      const firmSnap = await tx.get(firmRef);
      const count = (firmSnap.data().invoiceCounter || 0) + 1;
      const year  = new Date().getFullYear();
      const invNo = `INV-${year}-${String(count).padStart(4,'0')}`;
      tx.update(firmRef, { invoiceCounter: count });
      tx.set(invRef, { ...data, firmId, invoiceNo: invNo, createdAt: ts(), updatedAt: ts() });
    });
    return invRef.id;
  }

  async function updateInvoice(firmId, invoiceId, data) {
    await db.collection('firms').doc(firmId).collection('invoices').doc(invoiceId)
      .update({ ...data, updatedAt: ts() });
  }

  async function deleteInvoice(firmId, invoiceId) {
    await db.collection('firms').doc(firmId).collection('invoices').doc(invoiceId).delete();
  }

  // ── TASKS (subcollection — no index needed) ────────────────
  function subscribeTasks(firmId, cb) {
    return db.collection('firms').doc(firmId).collection('tasks')
      .orderBy('createdAt', 'desc')
      .onSnapshot(
        s => cb(s.docs.map(d => ({ id: d.id, ...d.data() }))),
        err => { console.warn('[Filio] subscribeTasks:', err.message); cb([]); }
      );
  }

  async function addTask(firmId, data) {
    const ref = db.collection('firms').doc(firmId).collection('tasks').doc();
    await ref.set({ ...data, firmId, createdAt: ts(), updatedAt: ts() });
    return ref.id;
  }

  async function updateTask(firmId, taskId, data) {
    await db.collection('firms').doc(firmId).collection('tasks').doc(taskId)
      .update({ ...data, updatedAt: ts() });
  }

  async function deleteTask(firmId, taskId) {
    await db.collection('firms').doc(firmId).collection('tasks').doc(taskId).delete();
  }

  // ── STAFF (query on users — this is safe, no compound index) ─
  function subscribeStaff(firmId, cb, onErr) {
    return db.collection('users').where('firmId', '==', firmId)
      .onSnapshot(
        s => cb(s.docs.map(d => ({ id: d.id, ...d.data() }))),
        err => {
          console.warn('[Filio] subscribeStaff:', err.message);
          if (onErr) onErr(err); else cb([]);
        }
      );
  }

  async function createInvite(firmId, invitedByUid, data) {
    const token = Security.generateSecureToken(8);
    await db.collection('invites').doc(token).set({
      firmId,
      invitedBy: invitedByUid,
      name:  data.name  || '',
      email: data.email || '',
      role:  data.role  || 'clerk',
      used:  false,
      createdAt: ts(),
    });
    return token;
  }

  async function createClientInvite(firmId, clientId) {
    const token = Security.generateSecureToken(12);
    await db.collection('firms').doc(firmId).collection('clients').doc(clientId)
      .update({ inviteToken: token, inviteCreatedAt: ts() });
    return token;
  }

  return {
    createFirm, getFirm, updateFirm,
    subscribeClients, addClient, updateClient, deleteClient,
    subscribeInvoices, addInvoice, updateInvoice, deleteInvoice,
    subscribeTasks, addTask, updateTask, deleteTask,
    subscribeStaff, createInvite, createClientInvite,
  };
})();

// ── PHASE 3: DOCUMENT REQUESTS ────────────────────────────────
// Stored as: /firms/{firmId}/docRequests/{reqId}
const _fs3 = (() => {
  const ts = () => firebase.firestore.FieldValue.serverTimestamp();

  async function createDocRequest(firmId, data) {
    const ref = db.collection('firms').doc(firmId).collection('docRequests').doc();
    await ref.set({
      ...data,
      firmId,
      status: 'pending',   // pending | partial | complete
      createdAt: ts(),
      updatedAt: ts(),
    });
    return ref.id;
  }

  async function updateDocRequest(firmId, reqId, data) {
    await db.collection('firms').doc(firmId).collection('docRequests').doc(reqId)
      .update({ ...data, updatedAt: ts() });
  }

  async function deleteDocRequest(firmId, reqId) {
    await db.collection('firms').doc(firmId).collection('docRequests').doc(reqId).delete();
  }

  function subscribeDocRequests(firmId, cb) {
    return db.collection('firms').doc(firmId).collection('docRequests')
      .orderBy('createdAt', 'desc')
      .onSnapshot(
        s => cb(s.docs.map(d => ({ id: d.id, ...d.data() }))),
        err => { console.warn('[Filio] docRequests:', err.message); cb([]); }
      );
  }

  function subscribeClientDocRequests(firmId, clientId, cb) {
    return db.collection('firms').doc(firmId).collection('docRequests')
      .where('clientId', '==', clientId)
      .orderBy('createdAt', 'desc')
      .onSnapshot(
        s => cb(s.docs.map(d => ({ id: d.id, ...d.data() }))),
        err => { console.warn('[Filio] clientDocReqs:', err.message); cb([]); }
      );
  }

  // Mark a single item in a request as uploaded/pending
  async function updateDocItem(firmId, reqId, itemId, updates) {
    const ref = db.collection('firms').doc(firmId).collection('docRequests').doc(reqId);
    const snap = await ref.get();
    if (!snap.exists) return;
    const data = snap.data();
    const items = (data.items || []).map(item =>
      item.id === itemId ? { ...item, ...updates } : item
    );
    // Recompute overall status
    const total    = items.length;
    const uploaded = items.filter(i => i.status === 'uploaded').length;
    const status   = uploaded === total ? 'complete' : uploaded > 0 ? 'partial' : 'pending';
    await ref.update({ items, status, updatedAt: ts() });
  }

  // WATI WhatsApp reminder log
  async function logReminder(firmId, clientId, reqId, type) {
    await db.collection('firms').doc(firmId).collection('reminders').add({
      clientId, reqId, type,
      sentAt: ts(),
    });
  }

  // Client portal: subscribe to their own requests across all firms they belong to
  function subscribeMyDocRequests(firmId, clientId, cb) {
    return db.collection('firms').doc(firmId).collection('docRequests')
      .where('clientId', '==', clientId)
      .onSnapshot(
        s => cb(s.docs.map(d => ({ id: d.id, ...d.data() }))),
        err => { cb([]); }
      );
  }

  return {
    createDocRequest, updateDocRequest, deleteDocRequest,
    subscribeDocRequests, subscribeClientDocRequests,
    updateDocItem, logReminder, subscribeMyDocRequests,
  };
})();

// Merge into FS namespace
Object.assign(FS, _fs3);

// ══════════════════════════════════════════════════════════════
// PHASE 4: STAFF MANAGEMENT & ENHANCED TASKS
// ══════════════════════════════════════════════════════════════
const _fs4 = (() => {
  const ts = () => firebase.firestore.FieldValue.serverTimestamp();

  // ── Staff profiles (stored under firm for easy querying) ──
  async function upsertStaffProfile(firmId, uid, data) {
    await db.collection('firms').doc(firmId)
      .collection('staffProfiles').doc(uid)
      .set({ uid, firmId, ...data, updatedAt: ts() }, { merge: true });
  }

  function subscribeStaffProfiles(firmId, cb) {
    return db.collection('firms').doc(firmId)
      .collection('staffProfiles')
      .onSnapshot(
        s => cb(s.docs.map(d => ({ id: d.id, ...d.data() }))),
        err => { console.warn('[Filio] staffProfiles:', err.message); cb([]); }
      );
  }

  async function removeStaff(firmId, uid) {
    // Mark as inactive — never hard delete
    await db.collection('firms').doc(firmId)
      .collection('staffProfiles').doc(uid)
      .update({ isActive: false, removedAt: ts() });
    // Also clear firmId from user doc
    try {
      await db.collection('users').doc(uid)
        .update({ firmId: null, role: 'pending_setup', updatedAt: ts() });
    } catch(e) { /* may fail if user doc restricted */ }
  }

  // ── Task comments (subcollection under each task) ─────────
  async function addTaskComment(firmId, taskId, uid, userName, text) {
    const ref = db.collection('firms').doc(firmId)
      .collection('tasks').doc(taskId)
      .collection('comments').doc();
    await ref.set({
      uid, userName,
      text: text.trim().slice(0, 2000),
      createdAt: ts(),
    });
    // Also update task's updatedAt so listeners fire
    await db.collection('firms').doc(firmId)
      .collection('tasks').doc(taskId)
      .update({ lastCommentAt: ts(), lastCommentBy: userName });
    return ref.id;
  }

  function subscribeTaskComments(firmId, taskId, cb) {
    return db.collection('firms').doc(firmId)
      .collection('tasks').doc(taskId)
      .collection('comments')
      .orderBy('createdAt', 'asc')
      .onSnapshot(
        s => cb(s.docs.map(d => ({ id: d.id, ...d.data() }))),
        err => { cb([]); }
      );
  }

  // ── In-app notifications ──────────────────────────────────
  async function createNotification(firmId, toUid, data) {
    await db.collection('firms').doc(firmId)
      .collection('notifications').add({
        toUid, ...data,
        read: false,
        createdAt: ts(),
      });
  }

  function subscribeNotifications(firmId, uid, cb) {
    return db.collection('firms').doc(firmId)
      .collection('notifications')
      .where('toUid', '==', uid)
      .where('read',  '==', false)
      .orderBy('createdAt', 'desc')
      .limit(20)
      .onSnapshot(
        s => cb(s.docs.map(d => ({ id: d.id, ...d.data() }))),
        err => { cb([]); }
      );
  }

  async function markNotificationRead(firmId, notifId) {
    await db.collection('firms').doc(firmId)
      .collection('notifications').doc(notifId)
      .update({ read: true });
  }

  async function markAllNotificationsRead(firmId, uid) {
    const snap = await db.collection('firms').doc(firmId)
      .collection('notifications')
      .where('toUid', '==', uid)
      .where('read',  '==', false)
      .get();
    const batch = db.batch();
    snap.docs.forEach(d => batch.update(d.ref, { read: true }));
    await batch.commit();
  }

  // ── Performance stats (computed from tasks) ───────────────
  async function getStaffPerformance(firmId, uid, month) {
    // month = 'YYYY-MM'
    const [y, m] = month.split('-').map(Number);
    const startDate = new Date(y, m - 1, 1);
    const endDate   = new Date(y, m, 0, 23, 59, 59);

    const snap = await db.collection('firms').doc(firmId)
      .collection('tasks')
      .where('assignedTo', '==', uid)
      .get();

    const tasks = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const inMonth = tasks.filter(t => {
      const created = t.createdAt?.toDate?.();
      return created && created >= startDate && created <= endDate;
    });

    const done    = inMonth.filter(t => t.status === 'done');
    const overdue = tasks.filter(t => {
      if (t.status === 'done') return false;
      const due = t.dueDate?.toDate?.();
      return due && due < new Date();
    });

    const avgCompletion = done.length > 0
      ? done.reduce((sum, t) => {
          const created = t.createdAt?.toDate?.();
          const completed = t.completedAt?.toDate?.();
          return sum + (completed && created ? (completed - created) / 86400000 : 0);
        }, 0) / done.length
      : 0;

    return {
      assigned:       inMonth.length,
      completed:      done.length,
      overdue:        overdue.length,
      completionRate: inMonth.length > 0 ? Math.round(done.length / inMonth.length * 100) : 0,
      avgDays:        Math.round(avgCompletion * 10) / 10,
    };
  }

  return {
    upsertStaffProfile, subscribeStaffProfiles, removeStaff,
    addTaskComment, subscribeTaskComments,
    createNotification, subscribeNotifications, markNotificationRead, markAllNotificationsRead,
    getStaffPerformance,
  };
})();

Object.assign(FS, _fs4);

// ══════════════════════════════════════════════════════════════
// PHASE 5: REPORTS MARKETPLACE
// ══════════════════════════════════════════════════════════════
const _fs5 = (() => {
  const ts = () => firebase.firestore.FieldValue.serverTimestamp();

  // All 16 report types from PDF
  const REPORT_CATALOG = [
    // Tax Reports
    { id:'itr_summary',     category:'tax',        name:'ITR Filing Summary',           price:399, caEarning:250, desc:'Income breakup, deductions, tax paid, refund status for the year' },
    { id:'tax_saving',      category:'tax',        name:'Tax Saving Opportunity',        price:399, caEarning:250, desc:'How much more you can save under 80C, 80D, NPS, HRA, and more' },
    { id:'form26as_recon',  category:'tax',        name:'26AS Reconciliation',           price:399, caEarning:250, desc:'Mismatch between 26AS and Form 16 — every discrepancy flagged' },
    { id:'advance_tax',     category:'tax',        name:'Advance Tax Calculator',        price:399, caEarning:250, desc:'Quarterly advance tax liability with exact payment schedule' },
    { id:'capital_gains',   category:'tax',        name:'Capital Gains Computation',     price:399, caEarning:250, desc:'Equity, mutual funds, property — STCG and LTCG breakdown' },
    // GST Reports
    { id:'gstr2a_mismatch', category:'gst',        name:'GSTR-2A vs Purchase Register',  price:399, caEarning:250, desc:'ITC being lost due to supplier non-filing — every rupee identified' },
    { id:'gst_health',      category:'gst',        name:'GST Health Check',              price:399, caEarning:250, desc:'Late fees, interest, penalties accumulated — and how to avoid future ones' },
    { id:'gst_cashflow',    category:'gst',        name:'Monthly GST Cash Flow',         price:399, caEarning:250, desc:'Tax outflow vs ITC utilised — net GST cost per month' },
    { id:'gst_annual',      category:'gst',        name:'Annual GST Summary',            price:399, caEarning:250, desc:'Full year GST turnover, ITC, liability — audit-ready format' },
    // Business Reports
    { id:'profitability',   category:'business',   name:'Profitability Snapshot',        price:399, caEarning:250, desc:'Revenue, expenses, gross and net profit from books' },
    { id:'debtor_aging',    category:'business',   name:'Debtor Aging Report',           price:399, caEarning:250, desc:'Who owes how much and since how many days' },
    { id:'cashflow',        category:'business',   name:'Cash Flow Statement',           price:399, caEarning:250, desc:'Operating, investing, financing cash flows' },
    { id:'net_worth',       category:'business',   name:'Net Worth Statement',           price:399, caEarning:250, desc:'Total assets minus total liabilities — personal or business' },
    // Compliance Reports
    { id:'compliance_cal',  category:'compliance', name:'12-Month Compliance Calendar',  price:399, caEarning:250, desc:'Every due date relevant to this client for the next year' },
    { id:'penalty_risk',    category:'compliance', name:'Penalty Risk Report',           price:399, caEarning:250, desc:'Active non-compliances and what they are costing per month' },
    { id:'company_status',  category:'compliance', name:'Director & Company Status',     price:399, caEarning:250, desc:'DIR-3 KYC, ROC compliance, MCA status snapshot' },
  ];

  // Save a purchased report record
  async function saveReportPurchase(firmId, data) {
    const ref = db.collection('firms').doc(firmId).collection('reportPurchases').doc();
    await ref.set({
      ...data,
      platformFee: data.price - data.caEarning,
      status: 'pending_generation',
      createdAt: ts(),
      updatedAt: ts(),
    });
    return ref.id;
  }

  function subscribeReportPurchases(firmId, cb) {
    return db.collection('firms').doc(firmId).collection('reportPurchases')
      .orderBy('createdAt', 'desc')
      .onSnapshot(
        s => cb(s.docs.map(d => ({ id: d.id, ...d.data() }))),
        err => { console.warn('[Filio] reportPurchases:', err.message); cb([]); }
      );
  }

  async function updateReportPurchase(firmId, reportId, data) {
    await db.collection('firms').doc(firmId).collection('reportPurchases').doc(reportId)
      .update({ ...data, updatedAt: ts() });
  }

  // CA earnings summary
  async function getReportEarnings(firmId, month) {
    const [y,m] = month.split('-').map(Number);
    const start = new Date(y, m-1, 1);
    const end   = new Date(y, m, 0, 23, 59, 59);
    const snap  = await db.collection('firms').doc(firmId)
      .collection('reportPurchases')
      .where('status', '==', 'completed')
      .get();
    const all = snap.docs.map(d => d.data());
    const inMonth = all.filter(r => {
      const d = r.createdAt?.toDate?.();
      return d && d >= start && d <= end;
    });
    return {
      totalReports:  inMonth.length,
      totalEarned:   inMonth.reduce((s,r) => s + (r.caEarning||250), 0),
      totalRevenue:  inMonth.reduce((s,r) => s + (r.price||399), 0),
      byType:        inMonth.reduce((acc, r) => { acc[r.reportId] = (acc[r.reportId]||0)+1; return acc; }, {}),
    };
  }

  return {
    REPORT_CATALOG,
    saveReportPurchase,
    subscribeReportPurchases,
    updateReportPurchase,
    getReportEarnings,
  };
})();

Object.assign(FS, _fs5);

// ══════════════════════════════════════════════════════════════
// PHASE 6: COMMUNICATION LOG + NOTICE MANAGEMENT
// ══════════════════════════════════════════════════════════════
const _fs6 = (() => {
  const ts = () => firebase.firestore.FieldValue.serverTimestamp();

  // ── Communication Log ─────────────────────────────────────
  // /firms/{firmId}/communications/{commId}
  async function addCommunication(firmId, data) {
    const ref = db.collection('firms').doc(firmId).collection('communications').doc();
    await ref.set({
      ...data,
      createdAt: ts(),
      updatedAt: ts(),
    });
    return ref.id;
  }

  function subscribeCommunications(firmId, clientId, cb) {
    let q = db.collection('firms').doc(firmId).collection('communications')
      .orderBy('createdAt', 'desc').limit(100);
    if (clientId) {
      q = db.collection('firms').doc(firmId).collection('communications')
        .where('clientId', '==', clientId)
        .orderBy('createdAt', 'desc');
    }
    return q.onSnapshot(
      s => cb(s.docs.map(d => ({ id: d.id, ...d.data() }))),
      err => { console.warn('[Filio] comms:', err.message); cb([]); }
    );
  }

  async function updateCommunication(firmId, commId, data) {
    await db.collection('firms').doc(firmId)
      .collection('communications').doc(commId)
      .update({ ...data, updatedAt: ts() });
  }

  async function deleteCommunication(firmId, commId) {
    await db.collection('firms').doc(firmId)
      .collection('communications').doc(commId).delete();
  }

  // ── Notice Management ─────────────────────────────────────
  // /firms/{firmId}/notices/{noticeId}
  async function addNotice(firmId, data) {
    const ref = db.collection('firms').doc(firmId).collection('notices').doc();
    await ref.set({
      ...data,
      status: 'received',   // received | in_progress | responded | resolved
      timeline: [{ action: 'received', note: data.notes||'', by: data.addedBy||'', at: new Date().toISOString() }],
      createdAt: ts(),
      updatedAt: ts(),
    });
    return ref.id;
  }

  function subscribeNotices(firmId, cb) {
    return db.collection('firms').doc(firmId).collection('notices')
      .orderBy('createdAt', 'desc')
      .onSnapshot(
        s => cb(s.docs.map(d => ({ id: d.id, ...d.data() }))),
        err => { console.warn('[Filio] notices:', err.message); cb([]); }
      );
  }

  async function updateNotice(firmId, noticeId, data) {
    await db.collection('firms').doc(firmId)
      .collection('notices').doc(noticeId)
      .update({ ...data, updatedAt: ts() });
  }

  async function addNoticeTimeline(firmId, noticeId, action, note, byName) {
    const ref  = db.collection('firms').doc(firmId).collection('notices').doc(noticeId);
    const snap = await ref.get();
    if (!snap.exists) return;
    const existing = snap.data().timeline || [];
    await ref.update({
      timeline: [...existing, { action, note, by: byName||'', at: new Date().toISOString() }],
      updatedAt: ts(),
    });
  }

  // ── Broadcast log (WhatsApp/Email broadcasts) ─────────────
  async function logBroadcast(firmId, data) {
    await db.collection('firms').doc(firmId).collection('broadcasts').add({
      ...data,
      sentAt: ts(),
    });
  }

  function subscribeBroadcasts(firmId, cb) {
    return db.collection('firms').doc(firmId).collection('broadcasts')
      .orderBy('sentAt', 'desc').limit(50)
      .onSnapshot(
        s => cb(s.docs.map(d => ({ id: d.id, ...d.data() }))),
        err => { cb([]); }
      );
  }

  return {
    addCommunication, subscribeCommunications, updateCommunication, deleteCommunication,
    addNotice, subscribeNotices, updateNotice, addNoticeTimeline,
    logBroadcast, subscribeBroadcasts,
  };
})();

Object.assign(FS, _fs6);
