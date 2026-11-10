/* ============================================================
   backtest-review.js — the strategy backtest review page.

   Renders data/backtest-review.json. Content only lives in the
   JSON: each section has a kicker, a title, a {technical, plain}
   body, optional paragraphs, tables (renderTable specs) and
   callouts, figures (images with alt text and a caption) and
   download links. A new review is a new data file plus a copy of
   the HTML shell whose <body data-src> names that file.
   ============================================================ */

import {
  $, el, inline, voice, getMode, onModeChange, loadJSON,
  mountChrome, fatal, renderCallout, renderTable,
} from './core.js';

const main = $('#content');

try {
  mountChrome(document.body.dataset.nav || 'backtest-review');
  const D = await loadJSON(document.body.dataset.src || 'data/backtest-review.json');

  $('#br-asof').textContent = `${D.eyebrow} · as of ${D.as_of}`;
  $('#br-title').textContent = D.title;
  buildNav(D.sections.map((s) => [s.id, s.nav || s.title]));

  render(getMode());
  onModeChange(render);
  jumpToHash();

  function render(mode) {
    $('#br-lede').innerHTML = inline(voice(D.lede, mode) ?? '');
    main.innerHTML = '';
    for (const s of D.sections) main.append(section(s, mode));
  }

  function section(s, mode) {
    return el('section', { class: 'section', id: s.id },
      el('div', { class: 'wrap' },
        el('div', { class: 'section-head' },
          el('span', { class: 'kicker', text: s.kicker }),
          el('h2', { text: s.title }),
          s.body ? el('p', { html: inline(voice(s.body, mode) ?? '') }) : null),
        ...(s.paragraphs || []).map((p) => el('p', { html: inline(voice(p, mode) ?? '') })),
        ...(s.callouts || []).map((c) => renderCallout(c, mode)),
        s.links ? el('ul', {}, s.links.map((l) =>
          el('li', {}, el('a', { href: l.href, download: '' }, l.label), l.note ? ` — ${l.note}` : ''))) : null,
        ...(s.figures || []).map((f) => el('figure', { style: 'margin:24px 0' },
          el('a', { href: f.src, target: '_blank', rel: 'noopener' },
            el('img', { src: f.src, alt: f.alt, loading: 'lazy',
              style: 'width:100%;border:1px solid var(--border);border-radius:var(--radius);background:#fcfcfb' })),
          el('figcaption', { class: 'table-note', style: 'margin-top:8px', html: inline(f.caption || '') }))),
        ...(s.tables || []).flatMap((t) => renderTable(t))));
  }

  function buildNav(items) {
    const nav = $('#br-nav');
    nav.append(...items.map(([id, label]) =>
      el('a', { href: `#${id}`, 'data-target': id }, label)));
    const onScroll = () => {
      let active = null;
      for (const [id] of items) {
        const node = document.getElementById(id);
        if (node && node.getBoundingClientRect().top <= 140) active = id;
      }
      nav.querySelectorAll('a').forEach((a) =>
        a.classList.toggle('active', a.dataset.target === active));
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  function jumpToHash() {
    const id = location.hash.slice(1);
    if (!id) return;
    const jump = () => document.getElementById(id)?.scrollIntoView();
    requestAnimationFrame(jump);
    document.fonts?.ready.then(jump);
  }
} catch (err) {
  fatal(main, err);
  console.error(err);
}
