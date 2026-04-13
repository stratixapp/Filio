// js/dom-safe.js — Safe DOM rendering utilities
// ═══════════════════════════════════════════════════════════════
//  WHY: innerHTML with user-provided data is an XSS vector.
//  These helpers build DOM nodes safely without eval'ing HTML strings.
//
//  RULE: Never use innerHTML with data that came from Firestore/user input.
//        Static layout HTML (no user data) inside innerHTML is acceptable.
//        ANY user-provided field must go through these helpers or esc().
// ═══════════════════════════════════════════════════════════════

const DOM = (() => {

  // ── Core factory ────────────────────────────────────────────
  /**
   * Create a DOM element with optional class, text, and attributes.
   * @param {string} tag  - e.g. 'div', 'span', 'td'
   * @param {object} opts - { cls, text, attrs:{}, html (STATIC only) }
   * @returns HTMLElement
   */
  function el(tag, opts = {}) {
    const node = document.createElement(tag);
    if (opts.cls)   node.className = opts.cls;
    if (opts.text != null) node.textContent = String(opts.text);
    if (opts.style) node.style.cssText = opts.style;
    if (opts.attrs) {
      for (const [k, v] of Object.entries(opts.attrs)) {
        // Block javascript: in href/src/action
        if ((k === 'href' || k === 'src' || k === 'action') &&
            typeof v === 'string' && /^javascript:/i.test(v.trim())) continue;
        node.setAttribute(k, v);
      }
    }
    // opts.html is for STATIC layout strings only — never use with user data
    if (opts.html) node.innerHTML = opts.html;
    return node;
  }

  /**
   * Append multiple children to a parent element.
   */
  function append(parent, ...children) {
    children.forEach(c => { if (c) parent.appendChild(c); });
    return parent;
  }

  // ── Safe text setter ────────────────────────────────────────
  function setText(element, text) {
    if (!element) return;
    element.textContent = String(text ?? '');
  }

  // ── Safe link builder ───────────────────────────────────────
  function safeLink(text, href, cls = '') {
    const a = document.createElement('a');
    a.textContent = text;
    // Only allow safe protocols
    const safe = /^(https?:|mailto:|tel:)/.test(href || '') ? href : '#';
    a.href = safe;
    if (cls) a.className = cls;
    return a;
  }

  // ── Badge builder ────────────────────────────────────────────
  function badge(text, cls) {
    return el('span', { cls: `badge ${cls}`, text });
  }

  // ── Status & priority badges (safe) ─────────────────────────
  const STATUS_MAP = {
    paid:        ['badge-green',  'Paid'],
    sent:        ['badge-blue',   'Sent'],
    draft:       ['badge-muted',  'Draft'],
    overdue:     ['badge-red',    'Overdue'],
    cancelled:   ['badge-muted',  'Cancelled'],
    pending:     ['badge-amber',  'Pending'],
    in_progress: ['badge-blue',   'In Progress'],
    done:        ['badge-green',  'Done'],
    completed:   ['badge-green',  'Completed'],
    active:      ['badge-green',  'Active'],
    trial:       ['badge-amber',  'Trial'],
  };

  const PRIORITY_MAP = {
    high:   ['badge-red',   'High'],
    medium: ['badge-amber', 'Medium'],
    low:    ['badge-muted', 'Low'],
  };

  function statusBadge(s) {
    const [cls, label] = STATUS_MAP[s] || ['badge-muted', s || '—'];
    return badge(label, cls);
  }

  function priorityBadge(p) {
    const [cls, label] = PRIORITY_MAP[p] || ['badge-muted', p || '—'];
    return badge(label, cls);
  }

  // ── List renderer ────────────────────────────────────────────
  /**
   * Render a list of items into a container using a renderer function.
   * Clears existing content first.
   *
   * @param {HTMLElement} container
   * @param {Array}       items        - data array
   * @param {Function}    rendererFn   - (item) => HTMLElement
   * @param {HTMLElement} [emptyNode]  - shown when items is empty
   */
  function renderList(container, items, rendererFn, emptyNode) {
    if (!container) return;
    // Clear safely
    while (container.firstChild) container.removeChild(container.firstChild);

    if (!items || items.length === 0) {
      if (emptyNode) container.appendChild(emptyNode);
      return;
    }

    const frag = document.createDocumentFragment();
    items.forEach(item => {
      try {
        const node = rendererFn(item);
        if (node) frag.appendChild(node);
      } catch (e) {
        console.warn('[DOM] renderList rendererFn error:', e);
      }
    });
    container.appendChild(frag);
  }

  // ── Empty state builder ──────────────────────────────────────
  function emptyState(iconHTML, title, subtitle = '') {
    const wrap = el('div', { cls: 'empty-state' });
    const iconWrap = el('div');
    iconWrap.innerHTML = iconHTML; // iconHTML is from Icons.* — all static SVG, safe
    const h4 = el('h4', { text: title });
    append(wrap, iconWrap, h4);
    if (subtitle) append(wrap, el('p', { text: subtitle, cls: 'text-muted' }));
    return wrap;
  }

  // ── Table row builder ────────────────────────────────────────
  /**
   * Build a <tr> with <td> cells from a config array.
   * config: [ { text?, node?, cls? }, ... ]
   */
  function tableRow(cells, rowAttrs = {}) {
    const tr = el('tr', { attrs: rowAttrs });
    cells.forEach(cell => {
      const td = el('td', { cls: cell.cls || '' });
      if (cell.node) {
        td.appendChild(cell.node);
      } else if (cell.html) {
        // STATIC html only (icons, badges built from constants)
        td.innerHTML = cell.html;
      } else {
        td.textContent = String(cell.text ?? '');
      }
      tr.appendChild(td);
    });
    return tr;
  }

  // ── Action buttons ───────────────────────────────────────────
  function actionBtn(iconHTML, label, onClick, cls = 'btn-icon') {
    const btn = el('button', { cls, attrs: { 'aria-label': label, title: label } });
    btn.innerHTML = iconHTML; // Icons.* are static SVGs — safe
    btn.addEventListener('click', e => { e.stopPropagation(); onClick(); });
    return btn;
  }

  // ── Card builder ─────────────────────────────────────────────
  function card(children = [], extraCls = '') {
    const c = el('div', { cls: `card ${extraCls}` });
    children.forEach(child => { if (child) c.appendChild(child); });
    return c;
  }

  // ── Stat card (for dashboard) ────────────────────────────────
  function statCard({ label, value, sublabel, icon, color }) {
    const wrap = el('div', { cls: 'stat-card' });
    const header = el('div', { cls: 'stat-header' });
    const labelEl = el('div', { cls: 'stat-label', text: label });
    if (icon) {
      const iconEl = el('div', { cls: 'stat-icon' });
      iconEl.innerHTML = icon; // static SVG
      append(header, labelEl, iconEl);
    } else {
      append(header, labelEl);
    }
    const valueEl = el('div', { cls: 'stat-value', text: value });
    if (color) valueEl.style.color = color;
    append(wrap, header, valueEl);
    if (sublabel) append(wrap, el('div', { cls: 'stat-sub', text: sublabel }));
    return wrap;
  }

  // ── Modal builder (safe) ─────────────────────────────────────
  /**
   * Build a modal that does NOT use innerHTML for user data.
   * @param {string}      title      - modal title (escaped automatically)
   * @param {HTMLElement} bodyNode   - pre-built DOM content
   * @param {Array}       footerBtns - [{label, cls, onClick}]
   */
  function buildModal(title, bodyNode, footerBtns = []) {
    const existing = document.getElementById('modal-overlay');
    if (existing) existing.remove();

    const overlay = el('div', { cls: 'modal-overlay', attrs: { id: 'modal-overlay' } });
    const modal   = el('div', { cls: 'modal' });

    // Header
    const header  = el('div', { cls: 'modal-header' });
    const titleEl = el('h3', { cls: 'modal-title', text: title });
    const closeBtn = el('button', { cls: 'modal-close', attrs: { 'aria-label': 'Close' } });
    closeBtn.innerHTML = Icons.x; // static SVG
    closeBtn.addEventListener('click', () => overlay.remove());
    append(header, titleEl, closeBtn);

    // Footer
    const footer = el('div', { cls: 'modal-footer' });
    footerBtns.forEach(({ label, cls, onClick }) => {
      const btn = el('button', { cls: `btn ${cls}`, text: label });
      btn.addEventListener('click', () => onClick(overlay));
      footer.appendChild(btn);
    });

    append(modal, header, bodyNode);
    if (footerBtns.length) modal.appendChild(footer);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    setTimeout(() => {
      const inp = modal.querySelector('input:not([type=hidden]),select,textarea');
      if (inp) inp.focus();
    }, 80);

    return overlay;
  }

  // ── Avatar (safe) ───────────────────────────────────────────
  function avatar(user, size = 32) {
    const wrap = el('div', { cls: 'avatar', style: `width:${size}px;height:${size}px;font-size:${size*0.35}px` });
    if (user?.photoURL) {
      const img = el('img', { attrs: { src: user.photoURL, referrerpolicy: 'no-referrer', alt: '' } });
      wrap.appendChild(img);
    } else {
      wrap.textContent = Fmt.initials(user?.displayName);
    }
    return wrap;
  }

  // ── Loading spinner ──────────────────────────────────────────
  function spinner(text = 'Loading…') {
    const wrap = el('div', { cls: 'loading-state', style: 'display:flex;align-items:center;gap:.75rem;padding:2rem;color:var(--text-muted);font-size:.875rem' });
    const spin = el('div', { cls: 'spinner' });
    const msg  = el('span', { text });
    append(wrap, spin, msg);
    return wrap;
  }

  // ── Public API ───────────────────────────────────────────────
  return {
    el,
    append,
    setText,
    safeLink,
    badge,
    statusBadge,
    priorityBadge,
    renderList,
    emptyState,
    tableRow,
    actionBtn,
    card,
    statCard,
    buildModal,
    avatar,
    spinner,
  };

})();
