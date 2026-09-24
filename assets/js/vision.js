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
  ['future-device', 'Future device'],
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

    /* ---- future device upgrade ---- */
    const U = V.future_device_upgrade;
    main.append(section('future-device', U.title, 'A workstation worth upgrading into',
      voice(U, mode),
      renderConfigurator(U.components),
      U.funding_rule ? renderCallout(U.funding_rule, mode) : null,
      renderTable({
        columns: ['Upgrade stage', 'Buy it when', 'What changes'],
        rows: (U.upgrade_stages ?? []).map((stage) => [stage.stage, stage.trigger, stage.changes]),
      }),
      el('p', { class: 'vrule', html: inline(`**Buying rule.** ${U.buying_rule}`) })));

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

  
  
  
  function renderConfigurator(components) {
    if (!components) return el('div');
    
    // State
    const state = {};
    const cart = new Set(); // holds IDs of components currently added to cart
    
    components.forEach(c => {
      state[c.id] = c.options.find(o => o.is_default) || c.options[0];
      // Default: don't put in cart, or maybe put baseline items? The user said "tick what you want to add".
      // We will start empty so they can tick exactly what they want.
    });

    const container = el('div', { class: 'configurator-container' });
    const visualizer = el('div', { class: 'pc-visualizer' });
    const panel = el('div', { class: 'pc-panel' });
    
    const style = el('style', { text: `
      .configurator-container { 
        display: flex; gap: 2rem; margin: 3rem 0; flex-wrap: wrap; 
        font-family: var(--sans);
      }
      .pc-visualizer { 
        flex: 1.2; min-width: 100%; 
        background: var(--bg-sunken); 
        border-radius: var(--radius); 
        border: 1px solid var(--border-strong); 
        position: relative; 
        aspect-ratio: 4/4.5;
        padding: 20px;
        box-shadow: inset 0 0 40px rgba(0,0,0,0.1);
      }
      @media (min-width: 768px) {
        .pc-visualizer { min-width: 320px; }
      }
      
      .pc-case-bg {
        position: absolute; top: 5%; left: 5%; right: 5%; bottom: 5%;
        background: var(--bg-raised); border: 2px solid var(--border);
        border-radius: var(--radius-sm); box-shadow: var(--shadow);
      }
      .motherboard-bg {
        position: absolute; top: 5%; left: 5%; right: 25%; bottom: 25%;
        background: var(--panel); border: 1px solid var(--border-strong);
        border-radius: 4px; opacity: 0.8;
        background-image: 
          repeating-linear-gradient(0deg, transparent, transparent 19px, var(--border) 20px),
          repeating-linear-gradient(90deg, transparent, transparent 19px, var(--border) 20px);
      }
      
      .pc-part { 
        position: absolute; 
        background: var(--bg); border: 2px solid var(--border-strong); 
        border-radius: 4px; display: flex; flex-direction: column; align-items: center; justify-content: center;
        cursor: pointer; transition: all 0.2s cubic-bezier(0.1, 0.7, 0.1, 1);
        color: var(--text-dim); box-shadow: 0 4px 10px rgba(0,0,0,0.05); z-index: 10;
      }
      
      .pc-part::before {
        content: ''; position: absolute; top: 0; left: 0; width: 100%; height: 4px;
        background: var(--border-strong); transition: all 0.2s;
      }
      
      .pc-part:hover { 
        border-color: var(--accent); color: var(--text);
        transform: translateY(-2px); box-shadow: 0 8px 20px rgba(0,0,0,0.1);
      }
      .pc-part:hover::before { background: var(--accent); }
      
      .pc-part.active { 
        border-color: var(--accent); color: var(--text);
        background: var(--bg-raised); box-shadow: 0 0 0 2px var(--accent), 0 10px 25px rgba(0,0,0,0.15);
      }
      .pc-part.active::before { background: var(--accent); }
      
      .pc-part.in-cart {
        border-color: var(--s2);
        color: var(--text);
      }
      .pc-part.in-cart::before { background: var(--s2); }
      .pc-part.in-cart .cart-indicator { opacity: 1; transform: scale(1); }
      
      .cart-indicator {
        position: absolute; top: -8px; right: -8px; width: 20px; height: 20px;
        background: var(--s2); color: var(--on-accent); border-radius: 50%;
        display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold;
        opacity: 0; transform: scale(0); transition: all 0.2s;
        box-shadow: 0 2px 5px rgba(0,0,0,0.2);
      }
      
      .part-icon { font-size: 1.8rem; margin-bottom: 4px; filter: grayscale(0.5); transition: all 0.2s; }
      .pc-part:hover .part-icon, .pc-part.active .part-icon, .pc-part.in-cart .part-icon { filter: grayscale(0); transform: scale(1.1); }
      .part-label { font-size: 0.75rem; font-weight: bold; text-transform: uppercase; letter-spacing: 0.05em; text-align: center; }
      
      .pc-panel { flex: 1; min-width: 100%; display: flex; flex-direction: column; gap: 1rem; }
      @media (min-width: 768px) {
        .pc-panel { min-width: 320px; }
      }
      
      .part-details { 
        background: var(--bg-raised); padding: 1.5rem; 
        border-radius: var(--radius); border: 1px solid var(--border); box-shadow: var(--shadow);
      }
      .panel-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
      .part-details h3 { 
        margin: 0; display: flex; align-items: center; gap: 0.75rem;
        font-family: var(--font-display); font-size: 2rem; color: var(--text);
      }
      
      .cart-toggle {
        display: flex; align-items: center; gap: 0.5rem; cursor: pointer;
        font-weight: bold; font-size: 0.9rem; color: var(--text);
        background: var(--bg); padding: 0.5rem 1rem; border-radius: 20px;
        border: 1px solid var(--border); transition: all 0.2s;
      }
      .cart-toggle:hover { background: var(--panel); border-color: var(--text-dim); }
      .cart-toggle.added { background: rgba(82, 201, 126, 0.1); border-color: var(--s2); color: var(--s2); }
      .cart-toggle input { display: none; }
      .check-icon { font-size: 1.1rem; }
      
      .option-list { display: flex; flex-direction: column; gap: 0.75rem; margin-bottom: 0.5rem; }
      .option-item { 
        padding: 1.25rem; border-radius: var(--radius-sm); border: 1px solid var(--border); 
        cursor: pointer; transition: all 0.2s; background: var(--bg); position: relative; overflow: hidden;
      }
      .option-item::after {
        content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 4px;
        background: transparent; transition: all 0.2s;
      }
      .option-item:hover { border-color: var(--border-strong); background: var(--bg-raised); }
      .option-item.selected { border-color: var(--accent); background: var(--bg-raised); }
      .option-item.selected::after { background: var(--accent); }
      
      .option-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem; }
      .option-name { font-weight: 600; color: var(--text); font-size: 1.1rem; padding-right: 1rem; }
      .option-prices { display: flex; flex-direction: column; align-items: flex-end; gap: 0.25rem; font-family: var(--mono); font-size: 0.85rem; }
      .price-badge { padding: 2px 6px; border-radius: 4px; background: var(--bg-sunken); border: 1px solid var(--border); color: var(--text-dim); white-space: nowrap; }
      .price-badge.new { color: var(--s1); border-color: rgba(232, 168, 48, 0.3); background: rgba(232, 168, 48, 0.05); }
      .price-badge.used { color: var(--info); border-color: rgba(160, 120, 240, 0.3); background: rgba(160, 120, 240, 0.05); }
      
      .option-impact { font-size: 0.95rem; line-height: 1.5; color: var(--text-dim); margin-top: 0.5rem; }
      
      .cart-summary {
        background: var(--bg-raised); padding: 1.5rem; border-radius: var(--radius); 
        border: 1px solid var(--border); box-shadow: var(--shadow);
      }
      .cart-items { margin-bottom: 1rem; padding-bottom: 1rem; border-bottom: 1px solid var(--border); display: flex; flex-direction: column; gap: 0.5rem; }
      .cart-item { display: flex; justify-content: space-between; font-size: 0.9rem; color: var(--text-dim); }
      .cart-item strong { color: var(--text); }
      
      .total-price { display: flex; justify-content: space-between; align-items: center; }
      .total-price strong { font-size: 1.25rem; color: var(--text); font-family: var(--font-display); letter-spacing: 0.02em; }
      .price-nums { text-align: right; display: flex; flex-direction: column; gap: 0.4rem; }
      .total-badge { 
        display: inline-flex; justify-content: space-between; min-width: 120px; padding: 4px 8px; 
        border-radius: 4px; font-family: var(--mono); font-size: 1rem; background: var(--bg-sunken); border: 1px solid var(--border);
      }
      .total-badge.new { color: var(--s1); border-color: rgba(232, 168, 48, 0.3); }
      .total-badge.used { color: var(--info); border-color: rgba(160, 120, 240, 0.3); }
      .total-badge span:first-child { color: var(--text-faint); font-size: 0.8rem; text-transform: uppercase; align-self: center; }
      .empty-cart-msg { color: var(--text-dim); font-style: italic; font-size: 0.9rem; text-align: center; }
    ` });

    let activePartId = components[0].id;

    function render() {
      visualizer.innerHTML = '';
      panel.innerHTML = '';
      
      // Draw background case & motherboard
      visualizer.append(
        el('div', { class: 'pc-case-bg' }),
        el('div', { class: 'motherboard-bg' })
      );
      
      // Render visualizer parts
      components.forEach(c => {
        const inCart = cart.has(c.id);
        const isActive = activePartId === c.id;
        
        const part = el('div', { 
          class: `pc-part ${isActive ? 'active' : ''} ${inCart ? 'in-cart' : ''}`,
          'data-component': c.id,
          style: { left: `${c.x}%`, top: `${c.y}%`, width: `${c.w}%`, height: `${c.h}%` },
          title: c.name
        }, 
        el('div', { class: 'cart-indicator', text: '✓' }),
        el('div', { class: 'part-icon', text: c.icon }),
        el('div', { class: 'part-label', text: c.id })
        );
        
        part.addEventListener('click', () => {
          activePartId = c.id;
          render();
        });
        
        visualizer.append(part);
      });

      // Render panel
      const activeComponent = components.find(c => c.id === activePartId);
      if (activeComponent) {
        const details = el('div', { class: 'part-details' });
        
        const header = el('div', { class: 'panel-header' });
        header.append(el('h3', { text: `${activeComponent.icon} ${activeComponent.name}` }));
        
        const inCart = cart.has(activeComponent.id);
        const toggleBtn = el('label', { class: `cart-toggle ${inCart ? 'added' : ''}` },
          el('span', { class: 'check-icon', text: inCart ? '✓' : '+' }),
          el('span', { text: inCart ? 'Added to Cart' : 'Add to Cart' })
        );
        toggleBtn.addEventListener('click', (e) => {
          e.preventDefault();
          if (cart.has(activeComponent.id)) cart.delete(activeComponent.id);
          else cart.add(activeComponent.id);
          render();
        });
        header.append(toggleBtn);
        details.append(header);
        
        const optionList = el('div', { class: 'option-list' });
        activeComponent.options.forEach(opt => {
          const isSelected = state[activeComponent.id].id === opt.id;
          const optEl = el('div', { class: `option-item ${isSelected ? 'selected' : ''}` });
          
          const optHeader = el('div', { class: 'option-header' });
          optHeader.append(el('div', { class: 'option-name', text: opt.name }));
          
          const prices = el('div', { class: 'option-prices' });
          if (opt.price_new > 0 || opt.price_used > 0) {
            prices.append(
              el('span', { class: 'price-badge new', text: `New $${opt.price_new}` }),
              el('span', { class: 'price-badge used', text: `Used $${opt.price_used}` })
            );
          } else {
             prices.append(el('span', { class: 'price-badge', text: 'Free / Base' }));
          }
          optHeader.append(prices);
          
          optEl.append(optHeader);
          if (opt.stage) optEl.append(el('span', { class: 'pill', text: opt.stage }));
          optEl.append(el('div', { class: 'option-impact', html: inline(opt.impact) }));
          
          optEl.addEventListener('click', () => {
            state[activeComponent.id] = opt;
            // Optionally add to cart automatically when an option is clicked
            if (!cart.has(activeComponent.id)) {
              cart.add(activeComponent.id);
            }
            render();
          });
          
          optionList.append(optEl);
        });
        
        details.append(optionList);
        panel.append(details);
      }

      // Render total
      let totalNew = 0;
      let totalUsed = 0;
      const cartItemsEl = el('div', { class: 'cart-items' });
      
      if (cart.size > 0) {
        components.forEach(c => {
          if (cart.has(c.id)) {
            const opt = state[c.id];
            totalNew += opt.price_new;
            totalUsed += opt.price_used;
            
            cartItemsEl.append(el('div', { class: 'cart-item' },
              el('span', { text: c.name }),
              el('strong', { text: `+$${opt.price_new}` })
            ));
          }
        });
      } else {
        cartItemsEl.append(el('div', { class: 'empty-cart-msg', text: 'Select components to build your estimate.' }));
      }

      const summaryEl = el('div', { class: 'cart-summary' });
      summaryEl.append(cartItemsEl);
      
      const totalEl = el('div', { class: 'total-price' });
      totalEl.append(
        el('strong', { text: 'Cart Total' }),
        el('div', { class: 'price-nums' },
          el('div', { class: 'total-badge new' }, el('span', {text:'New'}), el('span', { text: `$${totalNew}` })),
          el('div', { class: 'total-badge used' }, el('span', {text:'Used'}), el('span', { text: `$${totalUsed}` }))
        )
      );
      summaryEl.append(totalEl);
      
      panel.append(summaryEl);
    }

    render();
    container.append(style, visualizer, panel);
    return container;
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
