/* ============================================================
   vision.js — the vision & planning page.

   Renders data/vision.json, which is the hub's copy of
   docs/goals/VISION.md and docs/goals/IDENTITY_AND_HABITS.md in
   the source repository. Register is deliberately forward-looking:
   nothing on this page is a current-state number. Those live on
   goals.html and in REPO_STATE.md, and they move faster than this
   file is revised — see §"How the documents fit".
   ============================================================ */

import {
  $, el, inline, voice, getMode, onModeChange, loadJSON,
  mountChrome, fatal, renderTable, renderCallout,
} from './core.js';

const main = $('#content');

/* The in-page nav and the section order are the same list, so a section
   can never exist without a way to reach it. */
const SECTIONS = [
  ['name',        'The name'],
  ['mandate',     'The mandate'],
  ['distinction', 'Gates vs caps'],
  ['ladder',      'Risk ladder'],
  ['target',      'The target'],
  ['phases',      'The plan'],
  ['anti-goals',  'Anti-goals'],
  ['indicators',  'Knowing it works'],
  ['identity',    'Identity & habits'],
  ['planning',    'Document chain'],
];

const PHASE_TONE = {
  done: 'good', in_progress: 'info', not_started: 'muted', blocked: 'bad',
};
const PHASE_LABEL = {
  done: 'Reached', in_progress: 'In flight', not_started: 'Not started', blocked: 'Blocked',
};

try {
  mountChrome('vision');
  const V = await loadJSON('data/vision.json');

  $('#vision-asof').textContent = `Vision & planning · as of ${V.as_of}`;
  $('#vision-oneline').innerHTML = inline(V.headline.one_line);
  buildNav();

  render(getMode());
  onModeChange(render);
  jumpToHash();

  function render(mode) {
    $('#vision-lede').innerHTML = inline(voice(V.headline, mode) ?? '');
    main.innerHTML = '';

    /* ---- headline: what this is and is not ---- */
    if (V.headline.not?.length || V.register) {
      main.append(el('div', { class: 'section vsection-tight' },
        el('div', { class: 'wrap' },
          el('div', { class: 'vnot' },
            V.headline.not.map((n) => el('p', { html: inline(n) }))),
          V.register ? el('p', { class: 'vregister', html: inline(`**Register.** ${V.register}`) }) : null)));
    }

    /* ---- owner decisions ---- */
    const D = V.owner_decisions;
    main.append(section('decisions', `Owner decisions · ${D.date}`, 'What was settled', D.note,
      el('div', { class: 'grid grid-2' },
        D.items.map((d) =>
          el('div', { class: 'card vdecision' },
            el('h3', { text: d.title }),
            el('p', { class: 'goal-why', html: inline(d.text) }))))));

    /* ---- the name ---- */
    main.append(section('name', 'The name', '`Scalable` and `Brain` are both claims',
      voice(V.name.lede, mode),
      el('div', { class: 'grid grid-3' },
        V.name.parts.map((p) =>
          el('div', { class: 'card vname-card' },
            el('span', { class: 'kicker', text: p.word }),
            el('h3', { text: p.claim }),
            el('p', { class: 'goal-why', html: inline(voice(p, mode) ?? '') })))),
      V.name.test ? el('p', { class: 'vrule', html: inline(V.name.test) }) : null));

    /* ---- the mandate ---- */
    const M = V.mandate;
    main.append(section('mandate', 'The mandate', 'Strategic capital growth',
      voice(M.ordering, mode),
      el('blockquote', { class: 'thesis', html: inline(`**${M.statement}**`) }),
      M.correction ? renderCallout(M.correction, mode) : null,
      el('div', { class: 'vrestated' },
        el('span', { class: 'kicker', text: 'Restated so it holds at every size' }),
        el('h3', { html: inline(M.restated) }),
        el('p', { html: inline(voice(M.restated_note, mode) ?? '') })),
      M.bindings ? renderTable(M.bindings) : null,
      M.kelly ? renderCallout(M.kelly, mode) : null));

    /* ---- evidence gates vs risk caps ---- */
    const X = V.distinction;
    main.append(section('distinction', 'The distinction that resolves the conflict', X.title,
      voice(X.lede, mode),
      renderTable({ columns: X.columns, rows: X.rows, class: 'vtable-split' }),
      el('p', { class: 'vrule', html: inline(X.rule) }),
      X.why ? renderCallout(X.why, mode) : null));

    /* ---- the risk ladder ---- */
    const L = V.risk_ladder;
    main.append(section('ladder', L.title, 'Uncapped in demo, signed into every live tier',
      voice(L.lede, mode),
      renderTable({ columns: L.columns, rows: L.rows, class: 'vtable-ladder' }),
      el('div', { class: 'grid grid-2' },
        (L.rules ?? []).map((r) =>
          el('div', { class: 'card' },
            el('h3', { text: r.title }),
            el('p', { class: 'goal-why', html: inline(r.text) }))))));

    /* ---- the target ---- */
    const T = V.target;
    main.append(section('target', T.title, 'Cumulative profit, at a rate proven first',
      voice(T.lede, mode),
      el('blockquote', { class: 'thesis', html: inline(`**${T.statement}**`) }),
      T.quantities ? renderTable(T.quantities) : null,
      T.arithmetic ? renderTable(T.arithmetic) : null,
      el('div', { class: 'grid grid-3' },
        (T.conclusions ?? []).map((c, i) =>
          el('div', { class: 'card vconclusion' },
            el('span', { class: 'vconclusion-n', text: String(i + 1) }),
            el('h3', { text: c.title }),
            el('p', { class: 'goal-why', html: inline(c.text) })))),
      T.requirement ? renderCallout(T.requirement, mode) : null));

    /* ---- the phases ---- */
    main.append(section('phases', 'The plan', 'Five phases, sequenced so the target cannot be gamed',
      'The evidence chain closes before live capital. The rate is proven at $100, the capital is committed by a named decision, and only then does the profit accumulate.',
      el('div', { class: 'vphases' },
        V.phases.map((p) => phaseCard(p, mode))),
      el('div', { class: 'vfalsifiers' },
        el('h3', { text: V.falsifiers.title }),
        el('p', { class: 'goal-why', html: inline(voice(V.falsifiers.lede, mode) ?? '') }),
        V.falsifiers.items.map((f) =>
          el('div', { class: 'vfalsifier' },
            el('strong', { html: inline(f.observation) }),
            el('span', { class: 'vfalsifier-arrow', text: '⇒' }),
            el('span', { html: inline(f.conclusion) }))))));

    /* ---- anti-goals ---- */
    const A = V.anti_goals;
    main.append(section('anti-goals', A.title, 'The refusals',
      voice(A.lede, mode),
      el('div', { class: 'vanti' },
        A.groups.map((g) =>
          el('div', { class: 'vanti-group', style: { '--tone': `var(--${g.tone ?? 'info'})` } },
            el('div', { class: 'vanti-head' },
              el('span', { class: `badge tone-${g.tone ?? 'info'}` }, g.label),
              g.note ? el('span', { class: 'vanti-note', text: g.note }) : null),
            el('ul', { class: 'vlist' },
              g.items.map((i) => el('li', { html: inline(i) }))))))));

    /* ---- indicators ---- */
    const I = V.indicators;
    main.append(section('indicators', I.title, 'Three questions, kept separate on purpose',
      voice(I.lede, mode),
      el('div', { class: 'vindicators' },
        I.groups.map((g) =>
          el('div', { class: 'vindicator-group', style: { '--tone': `var(--${g.tone ?? 'info'})` } },
            el('h3', { text: g.question }),
            g.note ? el('p', { class: 'vindicator-note', html: inline(g.note) }) : null,
            renderTable({ columns: g.columns, rows: g.rows })))),
      I.false_progress
        ? el('div', { class: `callout t-${I.false_progress.tone ?? 'bad'}` },
            el('h4', { text: I.false_progress.title }),
            el('ul', { class: 'vlist' },
              I.false_progress.items.map((t) => el('li', { html: inline(t) }))))
        : null));

    /* ---- identity and habits ---- */
    const Y = V.identity;
    main.append(section('identity', Y.title, 'Vision → beliefs → habits',
      voice(Y.lede, mode),
      el('div', { class: 'vchain' },
        Y.chain.map((c, i) => [
          i ? el('span', { class: 'vchain-arrow', text: '→' }) : null,
          el('span', { class: 'vchain-step', text: c }),
        ])),
      Y.chain_note ? el('p', { class: 'table-note', html: inline(Y.chain_note) }) : null,

      /* owner */
      el('div', { class: 'vperson' },
        el('span', { class: 'kicker', text: `Part 1 — ${Y.owner.label}` }),
        el('blockquote', { class: 'thesis', html: inline(Y.owner.statement) }),
        Y.owner.statement_note ? el('p', { class: 'goal-why', html: inline(Y.owner.statement_note) }) : null,
        Y.owner.commitments
          ? el('ul', { class: 'vlist' }, Y.owner.commitments.map((c) => el('li', { html: inline(c) })))
          : null,
        Y.owner.goals ? renderTable(Y.owner.goals) : null,
        Y.owner.beliefs ? renderTable({ ...Y.owner.beliefs, class: 'vtable-pair' }) : null,
        Y.owner.habits ? renderTable(Y.owner.habits) : null,
        Y.owner.skills ? skillList(Y.owner.skills) : null),

      /* agent */
      el('div', { class: 'vperson' },
        el('span', { class: 'kicker', text: `Part 2 — ${Y.agent.label}` }),
        Y.agent.preamble ? el('p', { class: 'goal-why', html: inline(Y.agent.preamble) }) : null,
        Y.agent.failure_mode ? renderCallout(Y.agent.failure_mode, mode) : null,
        Y.agent.correction ? el('p', { class: 'vrule', html: inline(Y.agent.correction) }) : null,
        el('blockquote', { class: 'thesis', html: inline(Y.agent.statement) }),
        Y.agent.do_dont ? renderTable({ ...Y.agent.do_dont, class: 'vtable-dodont' }) : null,
        Y.agent.habits
          ? el('ul', { class: 'vlist' }, Y.agent.habits.map((h) => el('li', { html: inline(h) })))
          : null),

      Y.binding ? renderCallout(Y.binding, mode) : null));

    /* ---- the document chain ---- */
    const P = V.planning;
    main.append(section('planning', P.title, 'Five clocks, five documents',
      voice(P.lede, mode),
      el('div', { class: 'vdocchain' },
        P.chain.map((d) =>
          el('div', { class: 'vdoc', style: { '--depth': String(d.depth) } },
            el('code', { class: 'vdoc-file', text: d.file }),
            el('span', { class: 'vdoc-covers', html: inline(d.covers) }),
            el('span', { class: 'pill vdoc-cadence', text: d.cadence })))),
      el('h3', { class: 'vtests-heading', text: P.tests.title }),
      el('div', { class: 'grid grid-3' },
        P.tests.items.map((t) =>
          el('div', { class: 'card vtest' },
            el('span', { class: 'vtest-n', text: t.n }),
            el('h3', { html: inline(t.question) }),
            el('p', { class: 'goal-why', html: inline(t.text) })))),
      P.revision_rule ? renderCallout(P.revision_rule, mode) : null));

    /* ---- sources ---- */
    main.append(section('sources', 'Where this comes from', 'The authoritative files',
      'This page is a rendering. The files below are the source of truth in the ' +
      '`scalable-brain` repository; when they and this page disagree, they win.',
      el('div', { class: 'vsources' },
        V.sources.map((s) =>
          el('div', { class: 'vsource' },
            el('div', { class: 'vsource-head' },
              el('code', { text: s.file }),
              el('span', { class: 'goal-id', text: `written ${s.written}` })),
            el('p', { html: inline(s.covers) }),
            s.revision_rule
              ? el('p', { class: 'table-note', html: inline(`**Revision rule.** ${s.revision_rule}`) })
              : null)))));

  }

  /* ---- pieces ---- */

  function phaseCard(p, mode) {
    const tone = PHASE_TONE[p.state] ?? 'muted';
    return el('div', { class: 'vphase', style: { '--tone': `var(--${tone})` } },
      el('div', { class: 'vphase-head' },
        el('span', { class: 'vphase-id', text: p.id }),
        el('h3', { text: p.name }),
        el('span', { class: 'pill', text: p.when }),
        el('span', { class: `badge tone-${tone}` }, PHASE_LABEL[p.state] ?? p.state)),
      p.tagline ? el('p', { class: 'vphase-tagline', html: inline(`*${p.tagline}*`) }) : null,
      /* A phase whose source document is only a bullet list gets no prose body —
         an empty <p> would open a gap the tagline already fills. */
      voice(p, mode) ? el('p', { class: 'goal-why', html: inline(voice(p, mode)) }) : null,
      p.conditions?.length
        ? el('ul', { class: 'vlist' }, p.conditions.map((c) => el('li', { html: inline(c) })))
        : null,
      el('div', { class: 'vphase-exit' },
        el('strong', { text: 'Exit condition' }),
        el('span', { html: inline(p.exit) })));
  }

  function skillList(spec) {
    return el('div', { class: 'vskills' },
      el('h3', { text: spec.title }),
      spec.note ? el('p', { class: 'table-note', html: inline(spec.note) }) : null,
      el('ol', { class: 'vlist vlist-ordered' },
        spec.items.map((s) => el('li', { html: inline(s) }))));
  }

  /* ---- in-page nav ---- */

  function buildNav() {
    const nav = $('#vision-nav');
    /* Spread, not the bare array: Element.append() has no flattening branch —
       it stringifies an array argument, which renders the hrefs as text. Only
       el() from core.js flattens; the DOM method does not. */
    nav.append(...SECTIONS.map(([id, label]) =>
      el('a', { href: `#${id}`, 'data-target': id }, label)));
    /* Highlight whichever section is nearest the top of the viewport. Cheap
       enough to run on scroll because there are ten anchors, not ten thousand. */
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

  /* A deep link arrives before the sections exist, so the browser's own jump is
     a no-op and has to be re-run once the content is in the DOM. Twice, in
     fact: the two web fonts land after first paint and change every section's
     height, so a single-frame jump settles at the wrong offset. Called once at
     startup only — re-running it on a mode toggle would yank the reader back. */
  function jumpToHash() {
    const id = location.hash.slice(1);
    if (!id) return;
    const jump = () => document.getElementById(id)?.scrollIntoView();
    requestAnimationFrame(jump);
    document.fonts?.ready.then(jump);
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
} catch (err) {
  fatal(main, err);
  console.error(err);
}
