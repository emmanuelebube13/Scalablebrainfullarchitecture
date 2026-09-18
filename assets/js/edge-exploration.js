/* ============================================================
   edge-exploration.js — the new-edge exploration roadmap page.

   Renders data/edge-exploration.json, which describes four
   research paths for finding genuinely new trading edges, ordered
   by cost of evidence. Each path is gated by the one before it.
   ============================================================ */

import {
  $, el, inline, voice, getMode, onModeChange, loadJSON,
  mountChrome, fatal, renderCallout,
} from './core.js';

const main = $('#content');

/* The in-page nav and the section order are the same list, built from
   the paths array plus the recommendation. */
let SECTIONS = [];

try {
  mountChrome('edge');
  const D = await loadJSON('data/edge-exploration.json');

  $('#edge-asof').textContent = `${D.eyebrow} · as of ${D.as_of}`;
  $('#edge-title').textContent = D.title;

  /* Build section list from data */
  SECTIONS = [
    ...D.paths.map((p) => [p.id, `Path ${p.number}: ${p.title}`]),
    [D.recommendation.id, D.recommendation.title],
  ];
  buildNav();

  render(getMode());
  onModeChange(render);
  jumpToHash();

  function render(mode) {
    $('#edge-lede').innerHTML = inline(voice(D.lede, mode) ?? '');
    main.innerHTML = '';

    /* ---- research path cards ---- */
    for (const p of D.paths) {
      main.append(pathSection(p, mode));
    }

    /* ---- recommendation ---- */
    const R = D.recommendation;
    main.append(section(R.id, 'Recommendation', 'The sequencing logic',
      voice(R.body, mode)));
  }

  /* ---- pieces ---- */

  function pathSection(p, mode) {
    return el('section', { class: 'section', id: p.id },
      el('div', { class: 'wrap' },
        el('div', { class: 'section-head' },
          el('span', { class: 'kicker', text: `Path ${p.number} · ${p.eyebrow}` }),
          el('h2', {}, pathBadge(p.number), ` ${p.title}`)),
        el('p', { html: inline(voice(p.body, mode) ?? '') }),
        el('div', { class: 'grid grid-2' },
          metaCard('Evidence', p.evidence),
          metaCard('Blocked by', p.blocked_by)),
        el('div', { class: 'edge-priority' },
          el('span', { class: 'badge tone-info' }, `Priority ${p.priority}`),
          p.priority_note ? el('span', { class: 'edge-priority-note', text: p.priority_note }) : null),
        p.callout ? renderCallout(p.callout, mode) : null));
  }

  function pathBadge(n) {
    return el('span', { class: 'edge-badge' }, String(n));
  }

  function metaCard(label, text) {
    return el('div', { class: 'card edge-meta' },
      el('h4', { text: label }),
      el('p', { html: inline(text) }));
  }

  function section(id, kicker, title, lede, ...children) {
    return el('section', { class: 'section', id },
      el('div', { class: 'wrap' },
        el('div', { class: 'section-head' },
          el('span', { class: 'kicker', text: kicker }),
          el('h2', { text: title }),
          lede ? el('p', { html: inline(lede) }) : null),
        ...children));
  }

  /* ---- in-page nav ---- */

  function buildNav() {
    const nav = $('#edge-nav');
    nav.append(...SECTIONS.map(([id, label]) =>
      el('a', { href: `#${id}`, 'data-target': id }, label)));
    const onScroll = () => {
      let active = null;
      for (const [id] of SECTIONS) {
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
