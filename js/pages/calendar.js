// js/pages/calendar.js — Complete statutory compliance calendar
// Deadlines: GST, ITR, TDS, ROC, Advance Tax, PF, ESI, Professional Tax

const CalendarPage = {
  _today:   new Date(),
  _current: new Date(),
  _tasks:   [],
  _firm:    null,
  _unsub:   null,

  // All Indian statutory compliance deadlines
  _deadlines: [
    // ── GST (monthly) ──────────────────────────────────────
    ...Array.from({length:12},(_,m)=>({ month:m, day:11, label:'GSTR-1',  color:'blue',   cat:'GST',    recurring:true })),
    ...Array.from({length:12},(_,m)=>({ month:m, day:20, label:'GSTR-3B', color:'blue',   cat:'GST',    recurring:true })),
    ...Array.from({length:12},(_,m)=>({ month:m, day:13, label:'GSTR-6',  color:'blue',   cat:'GST',    recurring:true })),
    // GSTR-9 annual (Nov 30)
    { month:10, day:30, label:'GSTR-9 Annual', color:'blue', cat:'GST' },

    // ── TDS (quarterly) ────────────────────────────────────
    { month:6,  day:31, label:'TDS Q1 Return',  color:'purple', cat:'TDS' },
    { month:9,  day:31, label:'TDS Q2 Return',  color:'purple', cat:'TDS' },
    { month:0,  day:31, label:'TDS Q3 Return',  color:'purple', cat:'TDS' },
    { month:3,  day:31, label:'TDS Q4 Return',  color:'purple', cat:'TDS' },
    // TDS monthly challan (7th of each month)
    ...Array.from({length:12},(_,m)=>({ month:m, day:7, label:'TDS Challan', color:'purple', cat:'TDS', recurring:true })),

    // ── ITR filing ─────────────────────────────────────────
    { month:6,  day:31, label:'ITR Filing',        color:'red', cat:'ITR' },
    { month:9,  day:31, label:'ITR (Audit cases)', color:'red', cat:'ITR' },

    // ── Advance Tax ────────────────────────────────────────
    { month:5,  day:15, label:'Adv Tax Q1 (15%)', color:'amber', cat:'ADV TAX' },
    { month:8,  day:15, label:'Adv Tax Q2 (45%)', color:'amber', cat:'ADV TAX' },
    { month:11, day:15, label:'Adv Tax Q3 (75%)', color:'amber', cat:'ADV TAX' },
    { month:2,  day:15, label:'Adv Tax Q4 (100%)',color:'amber', cat:'ADV TAX' },

    // ── ROC / MCA ──────────────────────────────────────────
    { month:8,  day:30, label:'MGT-7 (ROC)',  color:'green', cat:'ROC' },
    { month:9,  day:29, label:'AOC-4 (ROC)',  color:'green', cat:'ROC' },
    { month:3,  day:30, label:'DIR-3 KYC',    color:'green', cat:'ROC' },
    { month:8,  day:30, label:'ADT-1',        color:'green', cat:'ROC' },

    // ── PF (Provident Fund) — monthly, 15th ───────────────
    ...Array.from({length:12},(_,m)=>({ month:m, day:15, label:'PF Payment', color:'green', cat:'PF', recurring:true })),
    // PF Return — monthly, 25th
    ...Array.from({length:12},(_,m)=>({ month:m, day:25, label:'PF Return',  color:'green', cat:'PF', recurring:true })),

    // ── ESI (Employee State Insurance) — monthly, 15th ────
    ...Array.from({length:12},(_,m)=>({ month:m, day:15, label:'ESI Payment', color:'amber', cat:'ESI', recurring:true })),
    // ESI Return — half yearly
    { month:3,  day:11, label:'ESI Return (Apr–Sep)', color:'amber', cat:'ESI' },
    { month:9,  day:11, label:'ESI Return (Oct–Mar)', color:'amber', cat:'ESI' },

    // ── Professional Tax (Kerala) — monthly, 20th ─────────
    ...Array.from({length:12},(_,m)=>({ month:m, day:20, label:'Prof Tax',    color:'purple', cat:'PT', recurring:true })),
  ],

  mount(firm) {
    this._firm = firm;
    this._current = new Date(this._today.getFullYear(), this._today.getMonth(), 1);
    this._tasks = [];
    this._render();
    if (firm) {
      this._unsub = FS.subscribeTasks(firm.id, docs => { this._tasks = docs; this._renderCalendar(); });
    }
  },

  unmount() { if (this._unsub) { this._unsub(); this._unsub = null; } },

  _render() {
    const content = Layout.getContentEl(); if (!content) return;
    content.innerHTML = `
    <div class="section-header" style="margin-bottom:1.5rem">
      <h2 style="font-size:1.5rem;font-weight:600">Compliance Calendar</h2>
      <div style="display:flex;gap:.5rem;align-items:center;flex-wrap:wrap">
        <button class="btn btn-secondary btn-sm" onclick="CalendarPage._prev()">‹ Prev</button>
        <span id="cal-label" style="font-family:var(--font-display);font-size:1.1rem;font-weight:600;min-width:160px;text-align:center"></span>
        <button class="btn btn-secondary btn-sm" onclick="CalendarPage._next()">Next ›</button>
        <button class="btn btn-ghost btn-sm" onclick="CalendarPage._today2()">Today</button>
      </div>
    </div>

    <!-- Category legend -->
    <div style="display:flex;gap:.75rem;margin-bottom:1.25rem;flex-wrap:wrap">
      ${[['blue','GST'],['purple','TDS / PT'],['red','ITR'],['amber','Adv Tax / ESI'],['green','ROC / PF'],['--text-muted','Your Tasks']].map(([c,l])=>`
      <div style="display:flex;align-items:center;gap:.375rem">
        <div style="width:10px;height:10px;border-radius:2px;background:var(${c.startsWith('--')?c:'--'+c})"></div>
        <span style="font-size:.75rem;color:var(--text-muted)">${l}</span>
      </div>`).join('')}
    </div>

    <div class="card" style="padding:1rem;margin-bottom:1.5rem">
      <div class="cal-grid">
        ${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=>`<div class="cal-day-header">${d}</div>`).join('')}
      </div>
      <div class="cal-grid" id="cal-days" style="margin-top:.5rem"></div>
    </div>

    <div class="card">
      <div class="section-header"><span class="section-title">Upcoming Deadlines — Next 30 Days</span></div>
      <div id="cal-upcoming"></div>
    </div>`;

    this._renderCalendar();
  },

  _renderCalendar() {
    const year  = this._current.getFullYear();
    const month = this._current.getMonth();

    const label = document.getElementById('cal-label');
    if (label) label.textContent = new Date(year, month, 1).toLocaleDateString('en-IN', { month:'long', year:'numeric' });

    const grid = document.getElementById('cal-days'); if (!grid) return;

    const firstDay  = new Date(year, month, 1).getDay();
    const daysInMon = new Date(year, month + 1, 0).getDate();

    // Build events map
    const events = {};
    const addEvent = (day, label, color) => {
      if (!events[day]) events[day] = [];
      events[day].push({ label, color });
    };

    // Statutory deadlines for this month
    this._deadlines.forEach(d => {
      if ((d.recurring || d.month === month) && d.day <= daysInMon) {
        addEvent(d.day, d.label, d.color);
      }
    });

    // Tasks due this month
    this._tasks.forEach(t => {
      const due = t.dueDate?.toDate?.();
      if (due && due.getFullYear()===year && due.getMonth()===month) {
        addEvent(due.getDate(), t.title||'Task', 'text-muted');
      }
    });

    let html = '';

    // Prev month fillers
    const daysInPrev = new Date(year, month, 0).getDate();
    for (let i = 0; i < firstDay; i++) {
      html += `<div class="cal-day other-month"><div class="cal-day-num">${daysInPrev - firstDay + 1 + i}</div></div>`;
    }

    // Current month
    for (let d = 1; d <= daysInMon; d++) {
      const isToday = d===this._today.getDate() && month===this._today.getMonth() && year===this._today.getFullYear();
      const dayEvents = events[d] || [];
      const evHtml = dayEvents.slice(0,3).map(e =>
        `<div class="cal-event cal-event-${e.color}" title="${esc(e.label)}">${esc(e.label)}</div>`
      ).join('') + (dayEvents.length > 3 ? `<div style="font-size:.6rem;color:var(--text-muted)">+${dayEvents.length-3}</div>` : '');
      html += `<div class="cal-day ${isToday?'today':''}">
        <div class="cal-day-num" style="${isToday?'color:var(--gold);font-weight:700':''}">${d}</div>
        ${evHtml}
      </div>`;
    }

    // Next month fillers
    const total = firstDay + daysInMon;
    const rows  = Math.ceil(total / 7);
    for (let d = 1; d <= rows*7 - total; d++) {
      html += `<div class="cal-day other-month"><div class="cal-day-num">${d}</div></div>`;
    }

    grid.innerHTML = html;
    this._renderUpcoming(year, month);
  },

  _renderUpcoming(year, month) {
    const el = document.getElementById('cal-upcoming'); if (!el) return;
    const now   = new Date();
    const limit = new Date(now); limit.setDate(limit.getDate() + 30);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const items = [];

    // Add statutory deadlines for current + next month
    for (let mo = month; mo <= month + 1; mo++) {
      const yr = year + Math.floor(mo / 12);
      const mn = mo % 12;
      const dim = new Date(yr, mn + 1, 0).getDate();
      this._deadlines.forEach(d => {
        if ((d.recurring || d.month === mn) && d.day <= dim) {
          const date = new Date(yr, mn, d.day);
          if (date >= today && date <= limit) {
            items.push({ date, label: d.label, color: d.color, cat: d.cat||'Compliance' });
          }
        }
      });
    }

    // Add task deadlines
    this._tasks.filter(t => t.status !== 'done').forEach(t => {
      const due = t.dueDate?.toDate?.();
      if (due && due >= today && due <= limit) {
        items.push({ date: due, label: t.title||'Task', color: 'text-muted', cat: 'Your Task' });
      }
    });

    // Dedupe by date+label and sort
    const seen = new Set();
    const unique = items.filter(i => {
      const k = i.date.toDateString() + i.label;
      if (seen.has(k)) return false;
      seen.add(k); return true;
    }).sort((a,b) => a.date - b.date);

    if (!unique.length) {
      el.innerHTML = `<p style="color:var(--text-muted);font-size:.875rem">No deadlines in the next 30 days.</p>`;
      return;
    }

    el.innerHTML = unique.map(item => {
      const diff = Math.ceil((item.date - today) / 86400000);
      const urgency = diff === 0 ? 'Today' : diff === 1 ? 'Tomorrow' : `${diff}d left`;
      const urgColor = diff <= 2 ? 'var(--red)' : diff <= 7 ? 'var(--amber)' : 'var(--text-muted)';
      return `
      <div style="display:flex;align-items:center;gap:.875rem;padding:.625rem 0;border-bottom:1px solid var(--border-light)">
        <div style="width:42px;height:42px;border-radius:var(--r-md);background:var(--${item.color.startsWith('-')?'bg-hover':''+item.color+'-bg'});display:flex;flex-direction:column;align-items:center;justify-content:center;flex-shrink:0;border:1px solid rgba(255,255,255,.05)">
          <div style="font-size:.9rem;font-weight:700;color:var(--${item.color.startsWith('-')?'text-muted':item.color});line-height:1">${item.date.getDate()}</div>
          <div style="font-size:.6rem;color:var(--text-muted);text-transform:uppercase">${item.date.toLocaleDateString('en-IN',{month:'short'})}</div>
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-size:.875rem;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(item.label)}</div>
          <div style="font-size:.75rem;color:var(--text-muted);margin-top:.1rem">${esc(item.cat)}</div>
        </div>
        <span style="font-size:.75rem;font-weight:600;color:${urgColor};white-space:nowrap">${urgency}</span>
      </div>`;
    }).join('');
  },

  _prev()    { this._current.setMonth(this._current.getMonth() - 1); this._renderCalendar(); },
  _next()    { this._current.setMonth(this._current.getMonth() + 1); this._renderCalendar(); },
  _today2()  { this._current = new Date(this._today.getFullYear(), this._today.getMonth(), 1); this._renderCalendar(); },
};
