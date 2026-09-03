/* ============================================================
   search.js — client-side full-text search across all content.

   Index built at page load over:
     - Architecture nodes and edges
     - System facts and sections (titles + body text)
     - Goals (title, why, definition_of_done)
     - Tasks (title, detail)
     - Milestones (name, summary)
     - Decisions (title, problem, decision)
     - Runbook headings

   Keyboard: press / from any page to focus the search box.
   Results are grouped by type and each links to the specific item.
   ============================================================ */

import { loadAll, loadJSON } from './core.js';

/* ---- Result types ---- */
const TYPES = {
  node:      { label: 'Map node',    colour: 'var(--accent)' },
  edge:      { label: 'Connection',  colour: 'var(--edge)' },
  system:    { label: 'System',      colour: 'var(--s1)' },
  section:   { label: 'Section',     colour: 'var(--info)' },
  goal:      { label: 'Goal',        colour: 'var(--good)' },
  task:      { label: 'Task',        colour: 'var(--warn)' },
  milestone: { label: 'Milestone',   colour: 'var(--muted)' },
  decision:  { label: 'Decision',    colour: 'var(--bad)' },
  runbook:   { label: 'Runbook',     colour: 'var(--info)' },
};

let INDEX = null;   // Array of { type, title, detail, url, systemId }

/* ---- Build index ---- */

async function buildIndex() {
  if (INDEX) return INDEX;

  INDEX = [];

  const [{ registry, systems }, arch, goals, decisions] =
    await Promise.all([
      loadAll(),
      loadJSON('data/architecture.json').catch(() => null),
      loadJSON('data/goals.json').catch(() => null),
      loadJSON('data/decisions.json').catch(() => null),
    ]);

  /* Architecture nodes */
  if (arch) {
    const colById = Object.fromEntries(arch.columns.map((c) => [c.id, c]));
    for (const n of arch.nodes) {
      const col = colById[n.column];
      const detail = [
        n.detail?.technical,
        n.detail?.plain,
        n.kind,
        col?.title,
      ].filter(Boolean).join(' ');
      INDEX.push({
        type: 'node',
        title: n.label,
        detail,
        url: `architecture.html?node=${encodeURIComponent(n.id)}`,
        searchText: `${n.label} ${detail}`.toLowerCase(),
      });
    }

    /* Architecture edges */
    const nodeById = Object.fromEntries(arch.nodes.map((n) => [n.id, n]));
    for (const e of arch.edges) {
      if (!e.label) continue;
      const from = nodeById[e.from];
      const to = nodeById[e.to];
      const detail = [from?.label, to?.label, e.kind].filter(Boolean).join(' → ');
      INDEX.push({
        type: 'edge',
        title: e.label,
        detail,
        url: `architecture.html`,
        searchText: `${e.label} ${detail}`.toLowerCase(),
      });
    }
  }

  /* Systems + sections */
  for (const sys of systems) {
    INDEX.push({
      type: 'system',
      title: `System ${sys.ordinal} — ${sys.name}`,
      detail: [sys.summary?.technical, sys.role, sys.host].filter(Boolean).join(' · '),
      url: `system.html?id=${sys.id}`,
      searchText: `system ${sys.ordinal} ${sys.name} ${sys.role ?? ''} ${sys.summary?.technical ?? ''} ${sys.summary?.plain ?? ''}`.toLowerCase(),
    });

    for (const sec of sys.sections ?? []) {
      const bodyText = [
        ...(sec.body?.technical ?? []),
        ...(sec.body?.plain ?? []),
        ...(sec.stages ?? []).map((s) => `${s.code} ${s.name} ${s.technical ?? ''} ${s.plain ?? ''}`),
        ...(sec.tables ?? []).flatMap((t) => t.rows.flat()),
        ...(sec.callouts ?? []).map((c) => `${c.title} ${c.technical ?? ''} ${c.plain ?? ''}`),
        ...(sec.issues ?? []).map((i) => `${i.id} ${i.title} ${i.text}`),
      ].join(' ');

      INDEX.push({
        type: 'section',
        title: `${sec.title} — ${sys.name}`,
        detail: sec.body?.technical?.[0]?.slice(0, 140) ?? '',
        url: `system.html?id=${sys.id}#${sec.id}`,
        searchText: `${sec.title} ${sys.name} ${bodyText}`.toLowerCase(),
      });
    }
  }

  /* Goals */
  if (goals) {
    for (const g of goals.goals ?? []) {
      INDEX.push({
        type: 'goal',
        title: `${g.id} — ${g.title}`,
        detail: g.why?.slice?.(0, 120) ?? g.why ?? '',
        url: `goals.html`,
        searchText: `${g.id} ${g.title} ${g.why ?? ''} ${g.plain ?? ''} ${g.definition_of_done ?? ''}`.toLowerCase(),
      });
    }

    /* Tasks */
    for (const t of goals.tasks ?? []) {
      INDEX.push({
        type: 'task',
        title: `${t.id} — ${t.title}`,
        detail: [t.detail, t.goal, t.period].filter(Boolean).join(' · '),
        url: `goals.html`,
        searchText: `${t.id} ${t.title} ${t.detail ?? ''} ${t.goal ?? ''}`.toLowerCase(),
      });
    }

    /* Milestones */
    for (const m of goals.milestones ?? []) {
      INDEX.push({
        type: 'milestone',
        title: `${m.id} — ${m.name}`,
        detail: m.summary?.slice?.(0, 120) ?? m.summary ?? '',
        url: `goals.html`,
        searchText: `${m.id} ${m.name} ${m.summary ?? ''} ${m.plain ?? ''}`.toLowerCase(),
      });
    }
  }

  /* Decisions */
  if (decisions) {
    for (const d of decisions.decisions ?? []) {
      const detail = [d.problem?.technical, d.decision?.technical].filter(Boolean).join(' ');
      INDEX.push({
        type: 'decision',
        title: `${d.id} — ${d.title}`,
        detail: detail.slice(0, 140),
        url: `architecture.html#decisions`,
        searchText: `${d.id} ${d.title} ${detail}`.toLowerCase(),
      });
    }
  }

  /* Runbook headings */
  try {
    const text = await fetch('data/MASTER-RUNBOOK.md', { cache: 'no-cache' }).then((r) => r.ok ? r.text() : null);
    if (text) {
      const lines = text.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const m = lines[i].match(/^(#{1,4})\s+(.+)/);
        if (!m) continue;
        const level = m[1].length;
        const heading = m[2].trim();
        const slug = slugify(heading);
        // Gather a snippet from the following non-heading lines
        const snippet = lines.slice(i + 1, i + 4)
          .filter((l) => l.trim() && !l.startsWith('#'))
          .join(' ').slice(0, 140);
        INDEX.push({
          type: 'runbook',
          title: heading,
          detail: snippet,
          url: `runbook.html#${slug}`,
          searchText: `${heading} ${snippet}`.toLowerCase(),
        });
      }
    }
  } catch (_) { /* runbook not critical */ }

  return INDEX;
}

/* ---- Query ---- */

export function query(text) {
  if (!INDEX || !text.trim()) return [];
  const terms = text.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const results = [];
  for (const item of INDEX) {
    const score = terms.reduce((acc, t) => acc + (item.searchText.includes(t) ? 1 : 0), 0);
    if (score === terms.length) results.push({ ...item, score });
  }
  // Sort by score desc, then by type order
  const typeOrder = Object.keys(TYPES);
  results.sort((a, b) =>
    b.score - a.score ||
    typeOrder.indexOf(a.type) - typeOrder.indexOf(b.type)
  );
  return results.slice(0, 60);
}

/* ---- Overlay UI ---- */

let overlayEl = null;
let inputEl = null;
let resultsEl = null;
let buildPromise = null;

function createOverlay() {
  if (overlayEl) return;

  overlayEl = document.createElement('div');
  overlayEl.id = 'search-overlay';
  overlayEl.setAttribute('role', 'dialog');
  overlayEl.setAttribute('aria-label', 'Search');
  overlayEl.setAttribute('aria-modal', 'true');
  overlayEl.hidden = true;
  overlayEl.innerHTML = `
    <div id="search-dialog">
      <div id="search-input-wrap">
        <span id="search-icon-inner" aria-hidden="true">🔍</span>
        <input id="search-input" type="search" placeholder="Search architecture, systems, goals, runbook…" autocomplete="off" spellcheck="false">
        <kbd id="search-esc">Esc</kbd>
      </div>
      <div id="search-results" role="listbox" aria-label="Search results"></div>
      <div id="search-footer">
        <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
        <span><kbd>↵</kbd> open</span>
        <span><kbd>Esc</kbd> close</span>
      </div>
    </div>
  `;

  document.body.appendChild(overlayEl);
  inputEl = overlayEl.querySelector('#search-input');
  resultsEl = overlayEl.querySelector('#search-results');

  /* Close on backdrop click */
  overlayEl.addEventListener('click', (ev) => {
    if (ev.target === overlayEl) closeOverlay();
  });

  overlayEl.querySelector('#search-esc').addEventListener('click', closeOverlay);

  inputEl.addEventListener('input', () => renderResults(query(inputEl.value)));

  inputEl.addEventListener('keydown', (ev) => {
    const items = Array.from(resultsEl.querySelectorAll('[role="option"]'));
    const idx = items.findIndex((el) => el.getAttribute('aria-selected') === 'true');
    if (ev.key === 'ArrowDown') {
      ev.preventDefault();
      const next = idx < items.length - 1 ? idx + 1 : 0;
      selectItem(items, next);
    } else if (ev.key === 'ArrowUp') {
      ev.preventDefault();
      const prev = idx > 0 ? idx - 1 : items.length - 1;
      selectItem(items, prev);
    } else if (ev.key === 'Enter') {
      const sel = items[idx];
      if (sel) { ev.preventDefault(); window.location.href = sel.dataset.url; closeOverlay(); }
    } else if (ev.key === 'Escape') {
      closeOverlay();
    }
  });
}

function selectItem(items, idx) {
  items.forEach((el, i) => el.setAttribute('aria-selected', String(i === idx)));
  items[idx]?.scrollIntoView({ block: 'nearest' });
}

function renderResults(results) {
  resultsEl.innerHTML = '';
  if (!inputEl.value.trim()) {
    resultsEl.innerHTML = '<div class="search-empty">Type to search across all content</div>';
    return;
  }
  if (!results.length) {
    resultsEl.innerHTML = '<div class="search-empty">No results</div>';
    return;
  }

  /* Group by type */
  const grouped = new Map();
  for (const r of results) {
    if (!grouped.has(r.type)) grouped.set(r.type, []);
    grouped.get(r.type).push(r);
  }

  for (const [type, items] of grouped) {
    const typeInfo = TYPES[type] ?? { label: type, colour: 'var(--accent)' };
    const groupEl = document.createElement('div');
    groupEl.className = 'search-group';
    groupEl.innerHTML = `<div class="search-group-label" style="color:${typeInfo.colour}">${typeInfo.label}</div>`;

    for (const item of items.slice(0, 12)) {
      const opt = document.createElement('a');
      opt.className = 'search-item';
      opt.role = 'option';
      opt.setAttribute('role', 'option');
      opt.setAttribute('aria-selected', 'false');
      opt.href = item.url;
      opt.dataset.url = item.url;
      opt.innerHTML = `
        <span class="search-item-title">${escHtml(item.title)}</span>
        ${item.detail ? `<span class="search-item-detail">${escHtml(item.detail.slice(0, 100))}</span>` : ''}
      `;
      opt.addEventListener('click', (ev) => { ev.preventDefault(); window.location.href = item.url; closeOverlay(); });
      opt.addEventListener('mouseenter', () => {
        Array.from(resultsEl.querySelectorAll('[role="option"]')).forEach((el) =>
          el.setAttribute('aria-selected', String(el === opt)));
      });
      groupEl.append(opt);
    }

    resultsEl.append(groupEl);
  }
}

function openOverlay() {
  createOverlay();
  overlayEl.hidden = false;
  document.body.classList.add('search-open');
  inputEl.focus();
  inputEl.select();

  /* Start building index in background when first opened */
  if (!buildPromise) buildPromise = buildIndex();

  renderResults(query(inputEl.value));
}

function closeOverlay() {
  if (!overlayEl) return;
  overlayEl.hidden = true;
  document.body.classList.remove('search-open');
}

function escHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function slugify(text) {
  return text.toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

/* ---- Bootstrap: listen for open event ---- */

export function initSearch() {
  /* Start building index immediately in the background */
  buildPromise = buildIndex();

  window.addEventListener('sb:search-open', openOverlay);

  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') closeOverlay();
  });
}
