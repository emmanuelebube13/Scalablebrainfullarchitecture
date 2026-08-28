/* ============================================================
   core.js — shared plumbing for every page.
   Loads the JSON content layer, renders inline markup, and owns
   the two global toggles: theme (dark/light) and mode
   (technical / plain English).
   ============================================================ */

export const MODE_KEY = 'sb.mode';
export const THEME_KEY = 'sb.theme';

/* ---------- tiny DOM helpers ---------- */

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k === 'text') node.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
    else node.setAttribute(k, v);
  }
  // flat(Infinity): callers nest arrays (e.g. a .map() that returns [separator, node]).
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child.nodeType ? child : document.createTextNode(String(child)));
  }
  return node;
}

export const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/**
 * Minimal inline markup so the JSON content layer stays readable in a text
 * editor. Deliberately not a full Markdown parser — supported: `code`,
 * **bold**, *italic*, [label](href). Everything is escaped first, so content
 * authored by an agent cannot inject markup.
 */
export function inline(text) {
  if (text === null || text === undefined) return '';
  let s = escapeHtml(text);
  s = s.replace(/`([^`]+)`/g, (_, c) => `<code>${c}</code>`);
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[\s(])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  s = s.replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" rel="noopener">$1</a>');
  return s;
}

export const para = (text) => el('p', { html: inline(text) });

/* ---------- data loading ---------- */

const cache = new Map();

export async function loadJSON(path) {
  if (cache.has(path)) return cache.get(path);
  const p = fetch(path, { cache: 'no-cache' }).then((r) => {
    if (!r.ok) throw new Error(`${r.status} ${r.statusText} for ${path}`);
    return r.json();
  });
  cache.set(path, p);
  return p;
}

/** Loads the registry plus every system file it points at. */
export async function loadAll() {
  const registry = await loadJSON('data/registry.json');
  const systems = await Promise.all(registry.systems.map((s) => loadJSON(s.file)));
  systems.sort((a, b) => a.ordinal - b.ordinal);
  return { registry, systems, bySystemId: Object.fromEntries(systems.map((s) => [s.id, s])) };
}

export function fatal(container, err) {
  const isFile = location.protocol === 'file:';
  container.innerHTML = '';
  container.append(
    el('div', { class: 'error-box' },
      el('h3', { text: 'Could not load the content layer' }),
      el('p', { html: `<code>${escapeHtml(err.message)}</code>` }),
      isFile
        ? el('p', {
            html: inline(
              'This page reads its content from JSON files with `fetch()`, which browsers block on the `file://` protocol. ' +
              'Serve the folder over HTTP instead — from this directory run `python3 -m http.server 8080` and open `http://localhost:8080`.'
            ),
          })
        : el('p', { html: inline('Check that the `data/` directory is present and that every JSON file parses.') })
    )
  );
}

/* ---------- global toggles ---------- */

export function getMode() {
  // ?mode=plain makes a voice shareable in a link; otherwise the stored choice wins.
  const q = new URLSearchParams(location.search).get('mode');
  if (q === 'plain' || q === 'technical') return q;
  return localStorage.getItem(MODE_KEY) === 'plain' ? 'plain' : 'technical';
}

export function setMode(mode) {
  localStorage.setItem(MODE_KEY, mode);
  // An explicit click outranks a ?mode= that arrived in the link — drop it, or
  // getMode() would keep returning the URL's choice and the toggle would look dead.
  const url = new URL(location.href);
  if (url.searchParams.has('mode')) {
    url.searchParams.delete('mode');
    history.replaceState(null, '', url.search ? `${url.pathname}${url.search}` : url.pathname);
  }
  applyMode(mode);
  window.dispatchEvent(new CustomEvent('sb:mode', { detail: { mode } }));
}

function applyMode(mode) {
  document.body.classList.toggle('mode-technical', mode === 'technical');
  document.body.classList.toggle('mode-plain', mode === 'plain');
  $$('.mode-switch button').forEach((b) =>
    b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));
}

export function getTheme() {
  const stored = localStorage.getItem(THEME_KEY);
  if (stored) return stored;
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const btn = $('#theme-toggle');
  if (btn) {
    btn.textContent = theme === 'light' ? '☾' : '☀';
    btn.setAttribute('aria-label', `Switch to ${theme === 'light' ? 'dark' : 'light'} theme`);
  }
}

/* ---------- chrome ---------- */

const NAV = [
  ['index.html', 'Overview'],
  ['architecture.html', 'Unified map'],
  ['system.html?id=system-1', 'Systems'],
  ['goals.html', 'Goals & tasks'],
  ['contribute.html', 'Editing the data'],
  ['operations.html', 'Operations'],
];

export function mountChrome(activeKey) {
  const header = $('#site-header');
  if (header) {
    header.className = 'site-header';
    header.append(
      el('div', { class: 'header-inner' },
        el('a', { class: 'brand', href: 'index.html' },
          el('span', { class: 'brand-mark', text: 'SB' }),
          el('span', { text: 'Scalable Brain' })),
        el('nav', { class: 'nav', 'aria-label': 'Primary' },
          NAV.map(([href, label]) =>
            el('a', {
              href,
              class: label.toLowerCase().startsWith(activeKey) ? 'active' : '',
            }, label)),
          el('div', { class: 'mode-switch', role: 'group', 'aria-label': 'Explanation depth' },
            el('button', { type: 'button', 'data-mode': 'technical', onclick: () => setMode('technical') }, 'Technical'),
            el('button', { type: 'button', 'data-mode': 'plain', onclick: () => setMode('plain') }, 'Plain English')),
          el('button', {
            id: 'theme-toggle', class: 'icon-btn', type: 'button',
            onclick: () => {
              const next = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
              localStorage.setItem(THEME_KEY, next);
              applyTheme(next);
            },
          }))
      )
    );
  }

  const footer = $('#site-footer');
  if (footer) {
    footer.className = 'site-footer';
    footer.append(
      el('div', { class: 'wrap footer-inner' },
        el('div', {},
          el('div', { html: inline('**Scalable Brain** — architecture hub and operations tracker.') }),
          el('div', { html: inline('Every page on this site renders from the JSON files in `data/`. Edit those, not the HTML.') })),
        el('div', {},
          el('div', {}, el('a', { href: 'https://github.com/emmanuelebube13/Scalablebrainfullarchitecture', rel: 'noopener' }, 'Site repository')),
          el('div', {}, el('a', { href: 'contribute.html' }, 'How agents edit this content')))
      )
    );
  }

  applyTheme(getTheme());
  applyMode(getMode());
}

/** Re-renders `fn` whenever the technical/plain toggle flips. */
export function onModeChange(fn) {
  window.addEventListener('sb:mode', () => fn(getMode()));
}

/** Picks the right voice out of a {technical, plain} pair. */
export function voice(obj, mode = getMode()) {
  if (!obj) return null;
  if (typeof obj === 'string') return obj;
  return mode === 'plain' ? (obj.plain ?? obj.technical) : (obj.technical ?? obj.plain);
}

/* ---------- shared renderers ---------- */

export function renderTable(spec) {
  const wrap = el('div', { class: 'table-wrap' },
    el('table', { class: spec.class || '' },
      el('thead', {}, el('tr', {}, spec.columns.map((c) => el('th', { html: inline(c) })))),
      el('tbody', {}, spec.rows.map((row) =>
        el('tr', {}, row.map((cell) => el('td', { html: inline(cell) })))))
    )
  );
  const out = [];
  if (spec.title) out.push(el('h4', { text: spec.title }));
  out.push(wrap);
  if (spec.note) out.push(el('p', { class: 'table-note', html: inline(spec.note) }));
  return out;
}

export function renderCallout(c, mode = getMode()) {
  return el('div', { class: `callout t-${c.tone || 'info'}` },
    el('h4', { text: c.title }),
    el('p', { html: inline(voice(c.text ? { technical: c.text, plain: c.plain || c.text } : c, mode)) })
  );
}

export function statusBadge(state, vocab) {
  const entry = (vocab && vocab[state]) || { label: state, tone: 'muted' };
  return el('span', { class: `badge tone-${entry.tone}` }, entry.label);
}
