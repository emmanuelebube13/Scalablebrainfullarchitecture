/* ============================================================
   backtest-review.js — the strategy backtest review page.

   Renders data/backtest-review.json. Content only lives in the
   JSON: each section has a kicker, a title, a {technical, plain}
   body, optional paragraphs, tables (renderTable specs) and
   callouts. A new review is a new data file, not new code.
   ============================================================ */

import {
  $, el, inline, voice, getMode, onModeChange, loadJSON,
  mountChrome, fatal, renderCallout, renderTable,
} from './core.js';

const main = $('#content');

try {
  mountChrome('backtest-review');
  const D = await loadJSON('data/backtest-review.json');

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
