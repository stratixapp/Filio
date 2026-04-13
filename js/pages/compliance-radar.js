// js/pages/compliance-radar.js — Compliance Radar
// Central compliance monitoring: deadlines, risk detection, auto-tasks,
// reminders, compliance scores, and per-client timeline.
// ═══════════════════════════════════════════════════════════════

const ComplianceRadar = (() => {

  let _firm = null, _user = null, _userDoc = null;
  let _unsubDeadlines = null, _unsubClients = null, _unsubStaff = null;
  let _deadlines = [], _clients = [], _staff = [];
  let _filters = { type: 'all', staff: 'all', risk: 'all', from: '', to: '' };

  // ── Deadline engine: due dates per compliance type ──────────
  const COMPLIANCE_RULES = {
    GST: [
      { label: 'GSTR-1',  dayOfMonth: 11, monthlyFreq: true },
      { label: 'GSTR-3B', dayOfMonth: 20, monthlyFreq: true },
    ],
    TDS: [
      { label: 'TDS Deposit',  dayOfMonth: 7,  monthlyFreq: true },
      { label: 'TDS Return Q1', month: 6,  day: 31 },
      { label: 'TDS Return Q2', month: 9,  day: 31 },
      { label: 'TDS Return Q3', month: 12, day: 31 },
      { label: 'TDS Return Q4', month: 3,  day: 31 },
    ],
    ITR: [
      { label: 'ITR Filing',    month: 7,  day: 31 },
      { label: 'ITR Audit',     month: 9,  day: 30 },
      { label: 'Advance Tax Q1',month: 6,  day: 15 },
      { label: 'Advance Tax Q2',month: 9,  day: 15 },
      { label: 'Advance Tax Q3',month: 12, day: 15 },
      { label: 'Advance Tax Q4',month: 3,  day: 15 },
    ],
    ROC: [
      { label: 'MGT-7 Annual Return',month: 9,  day: 29 },
      { label: 'AOC-4 Financials',   month: 10, day: 29 },
      { label: 'DIR-3 KYC',          month: 9,  day: 30 },
    ],
  };

  // Which compliance types apply per client type
  const CLIENT_COMPLIANCE_MAP = {
    individual:  ['ITR'],
    company:     ['GST', 'TDS', 'ITR', 'ROC'],
    huf:         ['ITR', 'TDS'],
    llp:         ['GST', 'TDS', 'ITR', 'ROC'],
    partnership: ['GST', 'TDS', 'ITR'],
  };

  // ── Generate deadlines for a newly added client ─────────────
  async function generateDeadlinesForClient(firmId, client) {
    const types = CLIENT_COMPLIANCE_MAP[client.type || 'individual'] || ['ITR'];
    const now   = new Date();
    const year  = now.getFullYear();
    const batch = db.batch();
    const col   = db.collection('firms').doc(firmId).collection('compliance_deadlines');

    types.forEach(type => {
      const rules = COMPLIANCE_RULES[type] || [];
      rules.forEach(rule => {
        let dueDate;
        if (rule.monthlyFreq) {
          // Next occurrence of this day-of-month
          const d = new Date(year, now.getMonth(), rule.dayOfMonth);
          if (d <= now) d.setMonth(d.getMonth() + 1);
          dueDate = d;
        } else {
          // Fixed month/day — use current FY
          const fy = rule.month >= 4 ? year : year + 1;
          dueDate = new Date(fy, rule.month - 1, rule.day);
          if (dueDate <= now) dueDate.setFullYear(dueDate.getFullYear() + 1);
        }

        const ref = col.doc();
        batch.set(ref, {
          firmId,
          clientId:        client.id,
          clientName:      client.name,
          clientType:      client.type || 'individual',
          complianceType:  type,
          label:           rule.label,
          dueDate:         firebase.firestore.Timestamp.fromDate(dueDate),
          status:          'pending',   // pending | in_progress | completed | overdue
          assignedStaff:   '',
          assignedStaffId: '',
          progress:        0,
          riskLevel:       'green',     // green | yellow | red
          docsRequired:    false,
          reminderSent:    false,
          autoTaskCreated: false,
          createdAt:       firebase.firestore.FieldValue.serverTimestamp(),
          updatedAt:       firebase.firestore.FieldValue.serverTimestamp(),
        });
      });
    });

    await batch.commit();
  }

  // ── Risk detection: compute risk for a deadline ─────────────
  function computeRisk(deadline) {
    const now  = new Date();
    const due  = deadline.dueDate?.toDate ? deadline.dueDate.toDate() : new Date(deadline.dueDate);
    const diff = Math.ceil((due - now) / (1000 * 60 * 60 * 24));

    if (deadline.status === 'completed') return 'green';
    if (diff < 0)  return 'red';    // overdue
    if (diff <= 7) return 'yellow'; // within 7 days
    return 'green';
  }

  // ── Run risk scan + auto-task creation ──────────────────────
  async function runRiskScan(firmId) {
    const snap = await db.collection('firms').doc(firmId)
      .collection('compliance_deadlines')
      .where('status', '!=', 'completed')
      .get();

    const batch = db.batch();
    const tasks = [];

    snap.docs.forEach(doc => {
      const d    = { id: doc.id, ...doc.data() };
      const risk = computeRisk(d);

      if (risk !== d.riskLevel) {
        batch.update(doc.ref, { riskLevel: risk, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
      }

      // Auto-create task if red/yellow and not already created
      if ((risk === 'red' || risk === 'yellow') && !d.autoTaskCreated) {
        const priority = risk === 'red' ? 'high' : 'medium';
        const due = d.dueDate?.toDate ? d.dueDate.toDate() : new Date(d.dueDate);

        tasks.push({
          deadlineId:    d.id,
          clientId:      d.clientId,
          clientName:    d.clientName,
          title:         `Prepare ${d.label} — ${d.clientName}`,
          type:          d.complianceType,
          label:         d.label,
          assignedTo:    d.assignedStaffId || '',
          assignedName:  d.assignedStaff   || '',
          dueDate:       d.dueDate,
          priority,
          status:        'pending',
          firmId,
          source:        'compliance_radar',
        });

        batch.update(doc.ref, { autoTaskCreated: true, riskLevel: risk });
      }
    });

    await batch.commit();

    // Create tasks
    for (const t of tasks) {
      try {
        await FS.addTask(firmId, t);
      } catch (e) {
        console.warn('[Radar] Auto-task create failed:', e.message);
      }
    }

    return { scanned: snap.docs.length, tasksCreated: tasks.length };
  }

  // ── Send reminder via Email + WhatsApp ──────────────────────
  async function sendReminder(firmId, deadline, client) {
    const msg = `Reminder: Please upload the required documents for ${deadline.label} filing (due ${_fmtDate(deadline.dueDate?.toDate?.() || new Date(deadline.dueDate))}). Contact your CA firm for details.`;

    // Log in communication_logs
    try {
      await FS.addCommunication(firmId, {
        clientId:    deadline.clientId,
        clientName:  deadline.clientName,
        channel:     'auto_reminder',
        type:        'compliance_reminder',
        subject:     `${deadline.label} — Documents Required`,
        summary:     msg,
        sentBy:      _user?.displayName || 'System',
        sentByUid:   _user?.uid || '',
        relatedType: 'compliance',
        relatedId:   deadline.id,
      });
    } catch (e) {
      console.warn('[Radar] Log reminder failed:', e.message);
    }

    // Mark reminder sent
    await db.collection('firms').doc(firmId)
      .collection('compliance_deadlines').doc(deadline.id)
      .update({ reminderSent: true, reminderSentAt: firebase.firestore.FieldValue.serverTimestamp() });

    Toast.success(`Reminder logged for ${deadline.clientName}`);
  }

  // ── Compliance score per client ──────────────────────────────
  function computeClientScore(clientId) {
    const clientDeadlines = _deadlines.filter(d => d.clientId === clientId);
    if (!clientDeadlines.length) return null;
    const completed = clientDeadlines.filter(d => d.status === 'completed').length;
    return Math.round((completed / clientDeadlines.length) * 100);
  }

  // ── Firestore subscriptions ──────────────────────────────────
  function _subscribe() {
    if (_unsubDeadlines) _unsubDeadlines();
    if (_unsubClients)   _unsubClients();
    if (_unsubStaff)     _unsubStaff();

    _unsubDeadlines = db.collection('firms').doc(_firm.id)
      .collection('compliance_deadlines')
      .orderBy('dueDate', 'asc')
      .onSnapshot(snap => {
        _deadlines = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        _render();
      }, err => console.warn('[Radar] deadlines:', err.message));

    _unsubClients = db.collection('firms').doc(_firm.id)
      .collection('clients')
      .orderBy('name')
      .onSnapshot(snap => {
        _clients = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      }, err => console.warn('[Radar] clients:', err.message));

    _unsubStaff = FS.subscribeStaffProfiles(_firm.id, s => {
      _staff = s;
      _rebuildStaffFilter();
    });
  }

  // ── Filtered deadlines ───────────────────────────────────────
  function _filtered() {
    return _deadlines.filter(d => {
      if (_filters.type  !== 'all' && d.complianceType !== _filters.type)  return false;
      if (_filters.risk  !== 'all' && computeRisk(d)   !== _filters.risk)  return false;
      if (_filters.staff !== 'all' && d.assignedStaffId !== _filters.staff) return false;
      if (_filters.from) {
        const due = d.dueDate?.toDate ? d.dueDate.toDate() : new Date(d.dueDate);
        if (due < new Date(_filters.from)) return false;
      }
      if (_filters.to) {
        const due = d.dueDate?.toDate ? d.dueDate.toDate() : new Date(d.dueDate);
        if (due > new Date(_filters.to)) return false;
      }
      return true;
    });
  }

  // ── Helpers ──────────────────────────────────────────────────
  function _fmtDate(d) {
    if (!d) return '—';
    const dt = d?.toDate ? d.toDate() : (d instanceof Date ? d : new Date(d));
    return dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function _daysLeft(d) {
    const due  = d?.toDate ? d.toDate() : new Date(d);
    const diff = Math.ceil((due - new Date()) / (1000 * 60 * 60 * 24));
    if (diff < 0)  return `<span style="color:var(--danger);font-weight:700">${Math.abs(diff)}d overdue</span>`;
    if (diff === 0) return `<span style="color:var(--danger);font-weight:700">Due today</span>`;
    if (diff <= 7) return `<span style="color:#F6AD55;font-weight:700">${diff}d left</span>`;
    return `<span style="color:var(--success)">${diff}d left</span>`;
  }

  function _riskBadge(risk) {
    const map = {
      green:  { bg: 'rgba(72,187,120,.15)', color: '#48BB78', label: 'On Track'  },
      yellow: { bg: 'rgba(246,173,85,.15)',  color: '#F6AD55', label: 'Due Soon'  },
      red:    { bg: 'rgba(252,129,74,.15)',  color: '#FC814A', label: 'At Risk'   },
    };
    const r = map[risk] || map.green;
    return `<span style="background:${r.bg};color:${r.color};padding:.2rem .65rem;border-radius:20px;font-size:.72rem;font-weight:700;white-space:nowrap">${r.label}</span>`;
  }

  function _typeBadge(type) {
    const map = {
      GST: '#E67E22', TDS: '#8E44AD', ITR: '#2980B9', ROC: '#27AE60',
    };
    const c = map[type] || '#C9A84C';
    return `<span style="background:${c}22;color:${c};padding:.2rem .55rem;border-radius:6px;font-size:.72rem;font-weight:700">${type}</span>`;
  }

  function _statusBadge(status) {
    const map = {
      pending:     { bg: 'rgba(74,90,106,.15)',  color: 'var(--text-muted)',    label: 'Pending'     },
      in_progress: { bg: 'rgba(41,128,185,.15)', color: '#2980B9',              label: 'In Progress' },
      completed:   { bg: 'rgba(39,174,96,.15)',  color: '#27AE60',              label: 'Completed'   },
      overdue:     { bg: 'rgba(252,81,74,.15)',  color: '#FC814A',              label: 'Overdue'     },
    };
    const s = map[status] || map.pending;
    return `<span style="background:${s.bg};color:${s.color};padding:.2rem .55rem;border-radius:6px;font-size:.72rem;font-weight:600">${s.label}</span>`;
  }

  function _scoreColor(score) {
    if (score >= 80) return '#48BB78';
    if (score >= 50) return '#F6AD55';
    return '#FC814A';
  }

  // ── Rebuild staff filter dropdown ────────────────────────────
  function _rebuildStaffFilter() {
    const sel = document.getElementById('radar-staff-filter');
    if (!sel) return;
    const cur = _filters.staff;
    sel.innerHTML = `<option value="all">All Staff</option>` +
      _staff.map(s => `<option value="${s.uid}" ${s.uid === cur ? 'selected' : ''}>${esc(s.name || s.email || 'Staff')}</option>`).join('');
  }

  // ── Stats bar ────────────────────────────────────────────────
  function _statsHTML() {
    const all      = _deadlines;
    const overdue  = all.filter(d => computeRisk(d) === 'red'    && d.status !== 'completed').length;
    const dueSoon  = all.filter(d => computeRisk(d) === 'yellow' && d.status !== 'completed').length;
    const onTrack  = all.filter(d => computeRisk(d) === 'green'  && d.status !== 'completed').length;
    const done     = all.filter(d => d.status === 'completed').length;

    return `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:1rem;margin-bottom:1.5rem">
      ${[
        { label: 'Overdue',    val: overdue,  color: '#FC814A', icon: '🔴' },
        { label: 'Due Soon',   val: dueSoon,  color: '#F6AD55', icon: '🟡' },
        { label: 'On Track',   val: onTrack,  color: '#48BB78', icon: '🟢' },
        { label: 'Completed',  val: done,     color: '#C9A84C', icon: '✅' },
      ].map(s => `
        <div class="card" style="text-align:center;padding:1rem;border-top:3px solid ${s.color}">
          <div style="font-size:1.4rem">${s.icon}</div>
          <div style="font-size:1.75rem;font-weight:800;color:${s.color};line-height:1.1;margin:.25rem 0">${s.val}</div>
          <div style="font-size:.75rem;color:var(--text-muted)">${s.label}</div>
        </div>`).join('')}
    </div>`;
  }

  // ── Filters bar ──────────────────────────────────────────────
  function _filtersHTML() {
    return `
    <div class="card" style="margin-bottom:1.25rem;padding:1rem">
      <div style="display:flex;flex-wrap:wrap;gap:.75rem;align-items:flex-end">

        <div style="display:flex;flex-direction:column;gap:.3rem;min-width:130px">
          <label style="font-size:.7rem;color:var(--text-muted);font-weight:600;text-transform:uppercase;letter-spacing:.05em">Type</label>
          <select id="radar-type-filter" onchange="ComplianceRadar._onFilter('type',this.value)"
            style="background:var(--bg-secondary);border:1px solid var(--border);color:var(--text-primary);padding:.45rem .65rem;border-radius:8px;font-size:.8125rem">
            <option value="all">All Types</option>
            ${['GST','TDS','ITR','ROC'].map(t=>`<option value="${t}" ${_filters.type===t?'selected':''}>${t}</option>`).join('')}
          </select>
        </div>

        <div style="display:flex;flex-direction:column;gap:.3rem;min-width:130px">
          <label style="font-size:.7rem;color:var(--text-muted);font-weight:600;text-transform:uppercase;letter-spacing:.05em">Risk</label>
          <select id="radar-risk-filter" onchange="ComplianceRadar._onFilter('risk',this.value)"
            style="background:var(--bg-secondary);border:1px solid var(--border);color:var(--text-primary);padding:.45rem .65rem;border-radius:8px;font-size:.8125rem">
            <option value="all">All Risk Levels</option>
            <option value="red"    ${_filters.risk==='red'   ?'selected':''}>🔴 At Risk</option>
            <option value="yellow" ${_filters.risk==='yellow'?'selected':''}>🟡 Due Soon</option>
            <option value="green"  ${_filters.risk==='green' ?'selected':''}>🟢 On Track</option>
          </select>
        </div>

        <div style="display:flex;flex-direction:column;gap:.3rem;min-width:150px">
          <label style="font-size:.7rem;color:var(--text-muted);font-weight:600;text-transform:uppercase;letter-spacing:.05em">Staff</label>
          <select id="radar-staff-filter" onchange="ComplianceRadar._onFilter('staff',this.value)"
            style="background:var(--bg-secondary);border:1px solid var(--border);color:var(--text-primary);padding:.45rem .65rem;border-radius:8px;font-size:.8125rem">
            <option value="all">All Staff</option>
            ${_staff.map(s=>`<option value="${s.uid}" ${_filters.staff===s.uid?'selected':''}>${esc(s.name||s.email||'Staff')}</option>`).join('')}
          </select>
        </div>

        <div style="display:flex;flex-direction:column;gap:.3rem">
          <label style="font-size:.7rem;color:var(--text-muted);font-weight:600;text-transform:uppercase;letter-spacing:.05em">From</label>
          <input type="date" value="${_filters.from}" onchange="ComplianceRadar._onFilter('from',this.value)"
            style="background:var(--bg-secondary);border:1px solid var(--border);color:var(--text-primary);padding:.45rem .65rem;border-radius:8px;font-size:.8125rem" />
        </div>

        <div style="display:flex;flex-direction:column;gap:.3rem">
          <label style="font-size:.7rem;color:var(--text-muted);font-weight:600;text-transform:uppercase;letter-spacing:.05em">To</label>
          <input type="date" value="${_filters.to}" onchange="ComplianceRadar._onFilter('to',this.value)"
            style="background:var(--bg-secondary);border:1px solid var(--border);color:var(--text-primary);padding:.45rem .65rem;border-radius:8px;font-size:.8125rem" />
        </div>

        <button onclick="ComplianceRadar._clearFilters()"
          style="background:var(--bg-secondary);border:1px solid var(--border);color:var(--text-muted);padding:.45rem 1rem;border-radius:8px;font-size:.8125rem;cursor:pointer;align-self:flex-end">
          Clear
        </button>

        <div style="margin-left:auto;display:flex;gap:.5rem;align-self:flex-end">
          <button onclick="ComplianceRadar._runScan()"
            style="background:rgba(201,168,76,.12);border:1px solid rgba(201,168,76,.3);color:var(--gold);padding:.45rem 1rem;border-radius:8px;font-size:.8125rem;font-weight:600;cursor:pointer">
            ⚡ Run Risk Scan
          </button>
          <button onclick="ComplianceRadar._showScoreBoard()"
            style="background:rgba(72,187,120,.1);border:1px solid rgba(72,187,120,.25);color:#48BB78;padding:.45rem 1rem;border-radius:8px;font-size:.8125rem;font-weight:600;cursor:pointer">
            📊 Scores
          </button>
          <button onclick="ComplianceRadar._showGenerateModal()"
            style="background:var(--gold);color:#0A1628;padding:.45rem 1rem;border-radius:8px;font-size:.8125rem;font-weight:700;cursor:pointer;border:none">
            + Generate Deadlines
          </button>
        </div>
      </div>
    </div>`;
  }

  // ── Main table ───────────────────────────────────────────────
  function _tableHTML(rows) {
    if (!rows.length) return `
      <div class="card" style="text-align:center;padding:3rem;color:var(--text-muted)">
        <div style="font-size:2.5rem;margin-bottom:.75rem">📡</div>
        <div style="font-weight:600;margin-bottom:.375rem">No deadlines found</div>
        <div style="font-size:.875rem">Use "Generate Deadlines" to create obligations for your clients.</div>
      </div>`;

    return `
    <div class="card" style="padding:0;overflow:hidden">
      <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;font-size:.8125rem">
          <thead>
            <tr style="border-bottom:1px solid var(--border);background:var(--bg-secondary)">
              <th style="padding:.75rem 1rem;text-align:left;color:var(--text-muted);font-weight:600;font-size:.72rem;text-transform:uppercase;letter-spacing:.05em;white-space:nowrap">Client</th>
              <th style="padding:.75rem .75rem;text-align:left;color:var(--text-muted);font-weight:600;font-size:.72rem;text-transform:uppercase;letter-spacing:.05em;white-space:nowrap">Compliance</th>
              <th style="padding:.75rem .75rem;text-align:left;color:var(--text-muted);font-weight:600;font-size:.72rem;text-transform:uppercase;letter-spacing:.05em;white-space:nowrap">Due Date</th>
              <th style="padding:.75rem .75rem;text-align:left;color:var(--text-muted);font-weight:600;font-size:.72rem;text-transform:uppercase;letter-spacing:.05em">Status</th>
              <th style="padding:.75rem .75rem;text-align:left;color:var(--text-muted);font-weight:600;font-size:.72rem;text-transform:uppercase;letter-spacing:.05em">Assigned</th>
              <th style="padding:.75rem .75rem;text-align:left;color:var(--text-muted);font-weight:600;font-size:.72rem;text-transform:uppercase;letter-spacing:.05em">Risk</th>
              <th style="padding:.75rem .75rem;text-align:left;color:var(--text-muted);font-weight:600;font-size:.72rem;text-transform:uppercase;letter-spacing:.05em">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((d, i) => {
              const risk = computeRisk(d);
              const rowBg = risk === 'red' ? 'rgba(252,129,74,.04)' : risk === 'yellow' ? 'rgba(246,173,85,.04)' : '';
              return `
              <tr style="border-bottom:1px solid var(--border);background:${rowBg};transition:background .15s"
                onmouseenter="this.style.background='var(--bg-secondary)'"
                onmouseleave="this.style.background='${rowBg}'">
                <td style="padding:.75rem 1rem">
                  <div style="font-weight:600;color:var(--text-primary)">${esc(d.clientName || '—')}</div>
                  <div style="font-size:.72rem;color:var(--text-muted);text-transform:capitalize">${esc(d.clientType || '')}</div>
                </td>
                <td style="padding:.75rem .75rem">
                  <div style="display:flex;flex-direction:column;gap:.3rem">
                    ${_typeBadge(d.complianceType)}
                    <span style="font-size:.72rem;color:var(--text-muted)">${esc(d.label || '')}</span>
                  </div>
                </td>
                <td style="padding:.75rem .75rem;white-space:nowrap">
                  <div style="color:var(--text-primary)">${_fmtDate(d.dueDate)}</div>
                  <div style="margin-top:.2rem">${_daysLeft(d.dueDate)}</div>
                </td>
                <td style="padding:.75rem .75rem">
                  <select onchange="ComplianceRadar._updateStatus('${d.id}',this.value)"
                    style="background:transparent;border:none;font-size:.8rem;color:var(--text-primary);cursor:pointer;padding:.1rem .2rem">
                    ${['pending','in_progress','completed','overdue'].map(s =>
                      `<option value="${s}" ${d.status===s?'selected':''}>${s.replace('_',' ')}</option>`
                    ).join('')}
                  </select>
                </td>
                <td style="padding:.75rem .75rem">
                  <select onchange="ComplianceRadar._assignStaff('${d.id}',this.value)"
                    style="background:transparent;border:none;font-size:.8rem;color:var(--text-primary);cursor:pointer;padding:.1rem .2rem;max-width:130px">
                    <option value="">Unassigned</option>
                    ${_staff.map(s=>`<option value="${s.uid}" ${d.assignedStaffId===s.uid?'selected':''}>${esc(s.name||s.email||'Staff')}</option>`).join('')}
                  </select>
                </td>
                <td style="padding:.75rem .75rem">${_riskBadge(risk)}</td>
                <td style="padding:.75rem .75rem">
                  <div style="display:flex;gap:.4rem;flex-wrap:wrap">
                    <button onclick="ComplianceRadar._sendReminderById('${d.id}')" title="Send Reminder"
                      style="background:rgba(201,168,76,.1);border:1px solid rgba(201,168,76,.2);color:var(--gold);padding:.3rem .6rem;border-radius:6px;font-size:.72rem;cursor:pointer">
                      🔔
                    </button>
                    <button onclick="ComplianceRadar._showTimeline('${d.clientId}')" title="Client Timeline"
                      style="background:rgba(41,128,185,.1);border:1px solid rgba(41,128,185,.2);color:#2980B9;padding:.3rem .6rem;border-radius:6px;font-size:.72rem;cursor:pointer">
                      📅
                    </button>
                  </div>
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
  }

  // ── Main render ──────────────────────────────────────────────
  function _render() {
    const cnt = document.getElementById('radar-body');
    if (!cnt) return;
    const rows = _filtered();
    cnt.innerHTML = _statsHTML() + _filtersHTML() + _tableHTML(rows);
  }

  // ── Compliance Scoreboard modal ──────────────────────────────
  function _showScoreBoard() {
    const scores = _clients.map(c => ({
      ...c,
      score: computeClientScore(c.id),
      total: _deadlines.filter(d => d.clientId === c.id).length,
      done:  _deadlines.filter(d => d.clientId === c.id && d.status === 'completed').length,
    })).filter(c => c.total > 0).sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

    const html = `
    <div id="radar-modal" onclick="if(event.target===this)this.remove()"
      style="position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1rem">
      <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:16px;width:100%;max-width:560px;max-height:80vh;overflow-y:auto">
        <div style="padding:1.25rem 1.5rem;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">
          <div>
            <div style="font-weight:700;font-size:1.1rem">Compliance Scoreboard</div>
            <div style="font-size:.8rem;color:var(--text-muted);margin-top:.2rem">Score = completed filings ÷ total obligations</div>
          </div>
          <button onclick="document.getElementById('radar-modal').remove()"
            style="background:none;border:none;color:var(--text-muted);font-size:1.25rem;cursor:pointer">✕</button>
        </div>
        <div style="padding:1rem 1.5rem">
          ${scores.length === 0
            ? `<div style="text-align:center;padding:2rem;color:var(--text-muted)">No compliance data yet</div>`
            : scores.map(c => {
                const sc = c.score ?? 0;
                const col = _scoreColor(sc);
                return `
                <div style="display:flex;align-items:center;gap:1rem;padding:.75rem 0;border-bottom:1px solid var(--border)">
                  <div style="flex:1">
                    <div style="font-weight:600;font-size:.9rem">${esc(c.name)}</div>
                    <div style="font-size:.75rem;color:var(--text-muted);margin-top:.15rem">${c.done} of ${c.total} filings completed</div>
                    <div style="height:5px;background:var(--bg-secondary);border-radius:99px;margin-top:.5rem;overflow:hidden">
                      <div style="height:100%;width:${sc}%;background:${col};border-radius:99px;transition:width .6s ease"></div>
                    </div>
                  </div>
                  <div style="font-size:1.3rem;font-weight:800;color:${col};min-width:52px;text-align:right">${sc}%</div>
                </div>`;
              }).join('')}
        </div>
      </div>
    </div>`;

    document.body.insertAdjacentHTML('beforeend', html);
  }

  // ── Client Timeline modal ────────────────────────────────────
  function _showTimeline(clientId) {
    const client   = _clients.find(c => c.id === clientId);
    const clientDl = _deadlines.filter(d => d.clientId === clientId)
      .sort((a, b) => {
        const da = a.dueDate?.toDate ? a.dueDate.toDate() : new Date(a.dueDate);
        const db2 = b.dueDate?.toDate ? b.dueDate.toDate() : new Date(b.dueDate);
        return da - db2;
      });

    const now     = new Date();
    const past    = clientDl.filter(d => { const dt = d.dueDate?.toDate?d.dueDate.toDate():new Date(d.dueDate); return dt < now || d.status === 'completed'; });
    const current = clientDl.filter(d => { const dt = d.dueDate?.toDate?d.dueDate.toDate():new Date(d.dueDate); return dt >= now && d.status !== 'completed'; });
    const score   = computeClientScore(clientId);

    const _timelineItem = (d) => {
      const risk = computeRisk(d);
      const dot  = d.status === 'completed' ? '#48BB78' : risk === 'red' ? '#FC814A' : risk === 'yellow' ? '#F6AD55' : 'var(--text-muted)';
      return `
      <div style="display:flex;gap:.75rem;padding:.5rem 0">
        <div style="display:flex;flex-direction:column;align-items:center;flex-shrink:0">
          <div style="width:10px;height:10px;border-radius:50%;background:${dot};margin-top:.3rem;flex-shrink:0"></div>
          <div style="width:1px;flex:1;background:var(--border);min-height:20px"></div>
        </div>
        <div style="padding-bottom:.5rem">
          <div style="display:flex;gap:.5rem;align-items:center;flex-wrap:wrap">
            ${_typeBadge(d.complianceType)}
            <span style="font-size:.8rem;font-weight:600;color:var(--text-primary)">${esc(d.label)}</span>
            ${_statusBadge(d.status)}
          </div>
          <div style="font-size:.75rem;color:var(--text-muted);margin-top:.25rem">${_fmtDate(d.dueDate)}</div>
          ${d.assignedStaff ? `<div style="font-size:.72rem;color:var(--text-muted)">👤 ${esc(d.assignedStaff)}</div>` : ''}
        </div>
      </div>`;
    };

    const html = `
    <div id="radar-modal" onclick="if(event.target===this)this.remove()"
      style="position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1rem">
      <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:16px;width:100%;max-width:600px;max-height:85vh;overflow-y:auto">
        <div style="padding:1.25rem 1.5rem;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:flex-start">
          <div>
            <div style="font-weight:700;font-size:1.1rem">${esc(client?.name || 'Client')} — Timeline</div>
            <div style="display:flex;align-items:center;gap:.75rem;margin-top:.375rem">
              <span style="font-size:.8rem;color:var(--text-muted)">${clientDl.length} total obligations</span>
              ${score !== null ? `
                <span style="font-weight:700;color:${_scoreColor(score)};font-size:.9rem">
                  ${score}% Compliant
                </span>` : ''}
            </div>
          </div>
          <button onclick="document.getElementById('radar-modal').remove()"
            style="background:none;border:none;color:var(--text-muted);font-size:1.25rem;cursor:pointer">✕</button>
        </div>
        <div style="padding:1.25rem 1.5rem">

          ${past.length ? `
          <div style="font-size:.72rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.08em;margin-bottom:.75rem">Past & Completed</div>
          <div style="opacity:.7">${past.map(_timelineItem).join('')}</div>` : ''}

          ${current.length ? `
          <div style="font-size:.72rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.08em;margin:1.25rem 0 .75rem">Upcoming</div>
          ${current.map(_timelineItem).join('')}` : `
          <div style="text-align:center;padding:2rem;color:var(--text-muted)">
            <div style="font-size:1.5rem;margin-bottom:.5rem">✅</div>
            No upcoming obligations
          </div>`}

        </div>
      </div>
    </div>`;

    const existing = document.getElementById('radar-modal');
    if (existing) existing.remove();
    document.body.insertAdjacentHTML('beforeend', html);
  }

  // ── Generate Deadlines modal ─────────────────────────────────
  function _showGenerateModal() {
    const html = `
    <div id="radar-modal" onclick="if(event.target===this)this.remove()"
      style="position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1rem">
      <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:16px;width:100%;max-width:500px">
        <div style="padding:1.25rem 1.5rem;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">
          <div style="font-weight:700;font-size:1.1rem">Generate Compliance Deadlines</div>
          <button onclick="document.getElementById('radar-modal').remove()"
            style="background:none;border:none;color:var(--text-muted);font-size:1.25rem;cursor:pointer">✕</button>
        </div>
        <div style="padding:1.5rem">
          <p style="font-size:.875rem;color:var(--text-secondary);margin-bottom:1.25rem;line-height:1.7">
            This will automatically generate all compliance deadlines for the selected clients based on their type (Individual, Company, LLP etc.).
          </p>
          <div style="margin-bottom:1.25rem">
            <label style="font-size:.8rem;color:var(--text-muted);font-weight:600;display:block;margin-bottom:.5rem">Select Clients</label>
            <select id="gen-client-sel" multiple
              style="background:var(--bg-secondary);border:1px solid var(--border);color:var(--text-primary);padding:.5rem;border-radius:8px;width:100%;height:160px;font-size:.8125rem">
              <option value="all" selected>★ All Clients (${_clients.length})</option>
              ${_clients.map(c=>`<option value="${c.id}">${esc(c.name)} (${c.type||'individual'})</option>`).join('')}
            </select>
            <div style="font-size:.72rem;color:var(--text-muted);margin-top:.35rem">Hold Ctrl/Cmd to select multiple. Choose "All Clients" to generate for everyone.</div>
          </div>
          <div style="background:rgba(201,168,76,.06);border:1px solid rgba(201,168,76,.15);border-radius:10px;padding:.875rem;margin-bottom:1.25rem;font-size:.8rem;color:var(--text-secondary);line-height:1.8">
            <strong style="color:var(--gold)">Auto-mapped rules:</strong><br>
            Individual → ITR + Advance Tax<br>
            Company / LLP → GST + TDS + ITR + ROC<br>
            HUF → ITR + TDS<br>
            Partnership → GST + TDS + ITR
          </div>
          <div style="display:flex;gap:.75rem;justify-content:flex-end">
            <button onclick="document.getElementById('radar-modal').remove()"
              style="background:var(--bg-secondary);border:1px solid var(--border);color:var(--text-muted);padding:.6rem 1.25rem;border-radius:8px;cursor:pointer;font-size:.875rem">
              Cancel
            </button>
            <button onclick="ComplianceRadar._generateFromModal()"
              style="background:var(--gold);color:#0A1628;border:none;padding:.6rem 1.5rem;border-radius:8px;font-weight:700;cursor:pointer;font-size:.875rem">
              Generate Deadlines
            </button>
          </div>
        </div>
      </div>
    </div>`;
    const existing = document.getElementById('radar-modal');
    if (existing) existing.remove();
    document.body.insertAdjacentHTML('beforeend', html);
  }

  // ── Action handlers ──────────────────────────────────────────
  async function _generateFromModal() {
    const sel    = document.getElementById('gen-client-sel');
    const values = Array.from(sel.selectedOptions).map(o => o.value);
    const targets = values.includes('all') ? _clients : _clients.filter(c => values.includes(c.id));

    const modal = document.getElementById('radar-modal');
    if (modal) modal.remove();

    if (!targets.length) { Toast.error('No clients selected'); return; }
    Toast.info(`Generating deadlines for ${targets.length} client(s)…`);

    let count = 0;
    for (const c of targets) {
      try {
        await generateDeadlinesForClient(_firm.id, c);
        count++;
      } catch (e) {
        console.warn('[Radar] Generate failed for', c.name, e.message);
      }
    }
    Toast.success(`✅ Deadlines generated for ${count} client(s)`);
  }

  async function _runScan() {
    const btn = document.querySelector('[onclick*="_runScan"]');
    if (btn) { btn.textContent = '⏳ Scanning…'; btn.disabled = true; }
    try {
      const result = await runRiskScan(_firm.id);
      Toast.success(`Scan complete — ${result.scanned} checked, ${result.tasksCreated} tasks created`);
    } catch (e) {
      Toast.error('Scan failed: ' + e.message);
    }
    if (btn) { btn.textContent = '⚡ Run Risk Scan'; btn.disabled = false; }
  }

  async function _updateStatus(id, status) {
    try {
      await db.collection('firms').doc(_firm.id)
        .collection('compliance_deadlines').doc(id)
        .update({ status, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
    } catch (e) {
      Toast.error('Update failed: ' + e.message);
    }
  }

  async function _assignStaff(id, staffUid) {
    const s = _staff.find(s => s.uid === staffUid);
    try {
      await db.collection('firms').doc(_firm.id)
        .collection('compliance_deadlines').doc(id)
        .update({
          assignedStaffId: staffUid,
          assignedStaff:   s?.name || s?.email || '',
          updatedAt:       firebase.firestore.FieldValue.serverTimestamp(),
        });
    } catch (e) {
      Toast.error('Assign failed: ' + e.message);
    }
  }

  async function _sendReminderById(id) {
    const deadline = _deadlines.find(d => d.id === id);
    if (!deadline) return;
    const client = _clients.find(c => c.id === deadline.clientId);
    await sendReminder(_firm.id, deadline, client);
  }

  function _onFilter(key, val) {
    _filters[key] = val;
    _render();
  }

  function _clearFilters() {
    _filters = { type: 'all', staff: 'all', risk: 'all', from: '', to: '' };
    _render();
  }

  // ── Mount / Unmount ──────────────────────────────────────────
  function mount(firm, user, userDoc) {
    _firm    = firm;
    _user    = user;
    _userDoc = userDoc;

    const cnt = Layout.getContentEl();
    if (!cnt) return;

    cnt.innerHTML = `
    <div style="margin-bottom:1.5rem;display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:1rem">
      <div>
        <h2 style="font-size:1.5rem;font-weight:700;display:flex;align-items:center;gap:.5rem">
          📡 Compliance Radar
        </h2>
        <p style="color:var(--text-muted);font-size:.875rem;margin-top:.25rem">
          Central compliance monitoring — deadlines, risk alerts, scores, and timelines for all clients
        </p>
      </div>
    </div>
    <div id="radar-body">
      <div style="text-align:center;padding:3rem;color:var(--text-muted)">
        <div class="spinner" style="margin:0 auto 1rem"></div>
        Loading compliance data…
      </div>
    </div>`;

    _subscribe();
  }

  function unmount() {
    if (_unsubDeadlines) { _unsubDeadlines(); _unsubDeadlines = null; }
    if (_unsubClients)   { _unsubClients();   _unsubClients   = null; }
    if (_unsubStaff)     { _unsubStaff();     _unsubStaff     = null; }
    _deadlines = []; _clients = []; _staff = [];
  }

  // Public API — expose what app.js and other modules need
  return {
    mount, unmount,
    generateDeadlinesForClient,
    runRiskScan,
    computeClientScore,
    _onFilter, _clearFilters,
    _runScan, _showScoreBoard, _showTimeline,
    _generateFromModal, _showGenerateModal,
    _updateStatus, _assignStaff,
    _sendReminderById,
  };

})();
