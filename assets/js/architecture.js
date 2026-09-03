import {
  $, $$, el, inline, voice, getMode, onModeChange, loadJSON, loadAll,
  mountChrome, fatal, renderTable,
} from './core.js';
import { renderMap } from './map.js';

try {
  mountChrome('unified');
  const arch = await loadJSON('data/architecture.json');
  const decisions = await loadJSON('data/decisions.json');
  const { systems } = await loadAll();

  $('#map-asof').textContent = `state as of ${arch.as_of}`;

  const controls = renderMap(arch, $('#map-viewport'), $('#map-side'));

  /* ---- toolbar ---- */
  const select = $('#flow-select');
  arch.flows.forEach((f) => select.append(el('option', { value: f.id }, f.name)));
  select.addEventListener('change', () => { controls.setFlow(select.value); syncUrl(); });
  $('#btn-zoom-in').addEventListener('click', () => controls.zoom(1));
  $('#btn-zoom-out').addEventListener('click', () => controls.zoom(-1));
  $('#btn-fit').addEventListener('click', () => controls.fit());
  $('#btn-reset').addEventListener('click', () => {
    select.value = '';
    // Reset column filter buttons
    $$('.map-column-filter button').forEach((b) => b.classList.remove('active'));
    controls.reset();
    syncUrl();
  });

  /* ---- column filter bar ---- */
  const filterBar = $('#map-column-filter');
  if (filterBar && arch.columns.length > 0) {
    filterBar.hidden = false;
    // "All" button
    const allBtn = el('button', {
      type: 'button', class: 'active',
      onclick: () => {
        $$('.map-column-filter button').forEach((b) => b.classList.remove('active'));
        allBtn.classList.add('active');
        controls.filterColumns(null);
      },
    }, 'All');
    filterBar.append(allBtn);

    for (const col of arch.columns) {
      const colBtn = el('button', {
        type: 'button',
        style: col.system ? { color: `var(--${col.system.replace('system-', 's')})` } : null,
        onclick: () => {
          // Toggle this column; clear all-button
          if (colBtn.classList.contains('active')) {
            colBtn.classList.remove('active');
          } else {
            colBtn.classList.add('active');
          }
          allBtn.classList.remove('active');
          const selected = Array.from(filterBar.querySelectorAll('button.active'))
            .map((b) => b.dataset.colId)
            .filter(Boolean);
          if (!selected.length) {
            // Nothing selected — show all
            allBtn.classList.add('active');
            controls.filterColumns(null);
          } else {
            controls.filterColumns(selected);
          }
        },
      }, col.title);
      colBtn.dataset.colId = col.id;
      filterBar.append(colBtn);
    }
  }

  // A traced flow or an opened component is a shareable link: ?flow=signal, ?node=s3-gate
  const params = new URLSearchParams(location.search);
  const wantedFlow = params.get('flow');
  const wantedNode = params.get('node');
  if (wantedFlow && arch.flows.some((f) => f.id === wantedFlow)) {
    select.value = wantedFlow;
    controls.setFlow(wantedFlow);
  }
  if (wantedNode && arch.nodes.some((n) => n.id === wantedNode)) controls.selectNode(wantedNode);

  function syncUrl() {
    const q = new URLSearchParams();
    if (select.value) q.set('flow', select.value);
    history.replaceState(null, '', q.toString() ? `?${q}` : location.pathname);
  }

  /* ---- legend ---- */
  const legend = $('#map-legend');
  legend.append(
    el('div', { class: 'legend' },
      arch.legend.kinds.map((k) =>
        el('span', {}, el('i', { style: { borderTopColor: kindColour(k.id) } }), k.label))),
    el('div', { class: 'legend', style: { marginTop: '8px' } },
      arch.legend.statuses.map((s) =>
        el('span', {}, el('span', { class: `badge no-dot tone-${statusTone(s.id)}` }, s.label))))
  );

  /* ---- decisions + contracts ---- */
  renderDecisions(getMode());
  renderContracts(getMode());
  onModeChange((m) => { renderDecisions(m); renderContracts(m); });

  function renderDecisions(mode) {
    const box = $('#decisions');
    box.id = 'decisions';
    box.innerHTML = '';
    decisions.decisions.forEach((d) => {
      const proposed = d.status === 'proposed';
      const card = el('div', { class: 'card goal-card', style: { '--tone': proposed ? 'var(--warn)' : 'var(--good)', marginBottom: '18px' } },
        el('div', { class: 'goal-head' },
          el('span', { class: 'goal-id', text: `${d.id} · ${d.date}` }),
          el('h3', { text: d.title }),
          el('span', { class: `badge tone-${proposed ? 'warn' : 'good'}` }, proposed ? 'Proposed' : 'Accepted')),
        el('h4', { text: 'The problem' }),
        el('p', { class: 'goal-why', html: inline(voice(d.problem, mode)) }),
        d.argument ? el('h4', { text: 'The argument' }) : null,
        d.argument ? el('p', { class: 'goal-why', html: inline(voice(d.argument, mode)) }) : null,
        el('h4', { text: 'The decision' }),
        el('p', { class: 'goal-why', html: inline(voice(d.decision, mode)) }),
        d.load_bearing_requirement ? el('div', { class: 'callout t-warn' },
          el('h4', { text: 'The load-bearing requirement' }),
          el('p', { html: inline(voice(d.load_bearing_requirement, mode)) })) : null,
        el('div', { class: 'grid grid-2', style: { marginTop: '14px' } },
          el('div', {}, el('h4', { text: 'What it buys' }),
            el('ul', {}, d.consequences.good.map((t) => el('li', { html: inline(t) })))),
          el('div', {}, el('h4', { text: 'What it costs' }),
            el('ul', {}, d.consequences.bad.map((t) => el('li', { html: inline(t) }))))),
        d.transition?.length ? el('h4', { text: 'Transition', style: { marginTop: '14px' } }) : null,
        d.transition?.length ? el('ol', { class: 'steps', style: { marginTop: '10px' } },
          d.transition.map((s) => el('li', {}, el('h3', { text: s.step }), el('p', { html: inline(s.text) })))) : null,
        d.open_questions?.length ? el('div', { class: 'dod' },
          el('strong', { text: `${d.open_questions.length} open questions for the reviewers` }),
          el('ol', {}, d.open_questions.map((q) => el('li', { html: inline(q) })))) : null,
        d.reviews?.length ? renderReviews(d, mode) : null,
        d.requires_approval_from?.length ? el('p', { class: 'meter-label', style: { marginTop: '12px' },
          html: inline(`Requires **APPROVE** from: ${d.requires_approval_from.map(idToName).join(', ')} · source \`${d.source}\``) }) : null
      );
      box.append(card);
    });
  }

  function renderContracts(mode) {
    const box = $('#contracts');
    box.innerHTML = '';
    const rows = arch.edges
      .filter((e) => ['artifact', 'message', 'order'].includes(e.kind))
      .map((e) => {
        const from = arch.nodes.find((n) => n.id === e.from);
        const to = arch.nodes.find((n) => n.id === e.to);
        return [`${from?.label ?? e.from}`, `${to?.label ?? e.to}`, e.label || '—', e.kind,
          `\`${e.status}\``];
      });
    box.append(...renderTable({
      columns: ['From', 'To', 'Payload', 'Kind', 'Status'],
      rows,
      note: mode === 'plain'
        ? 'Every row is one handoff between two components. A status other than `live` means that handoff has not been proven to work.'
        : 'Generated from the `edges` array in `data/architecture.json`. Adding an edge adds a row here automatically.',
    }));
  }

  function renderReviews(d, mode) {
    const TONE = { approve: 'good', approve_with_conditions: 'warn', reject: 'bad', pending: 'muted' };
    const LABEL = { approve: 'APPROVE', approve_with_conditions: 'APPROVE with conditions', reject: 'REJECT', pending: 'Awaiting reply' };
    return el('div', { style: { marginTop: '16px' } },
      el('h4', { text: 'Reviews' }),
      el('div', { class: 'issues' },
        d.reviews.map((r) => {
          const tone = TONE[r.verdict] ?? 'muted';
          return el('div', { class: 'issue', style: { '--sev': `var(--${tone})` } },
            el('div', { class: 'issue-head' },
              el('strong', { text: idToName(r.system) }),
              el('span', { class: `badge tone-${tone}` }, LABEL[r.verdict] ?? r.verdict),
              r.date ? el('span', { class: 'goal-id', text: r.date }) : null),
            r.reasons
              ? el('p', { html: inline(r.reasons) })
              : el('p', { class: 'side-empty', html: inline(mode === 'plain'
                  ? 'This system has not answered yet. Nothing can be built until it does.'
                  : 'No reply recorded. Implementation is gated on this.') }),
            r.answers?.length
              ? el('ol', {}, r.answers.map((a, i) =>
                  el('li', {}, el('em', { text: `Q${i + 1}. ` }), el('span', { html: inline(a) }))))
              : null);
        })));
  }

  function idToName(id) {
    const s = systems.find((x) => x.id === id);
    return s ? `System ${s.ordinal} — ${s.name}` : id;
  }
} catch (err) {
  fatal($('#main'), err);
  console.error(err);
}

function kindColour(kind) {
  return {
    data: 'var(--edge)',
    artifact: 'var(--info)',
    message: 'var(--warn)',
    order: 'var(--good)',
    control: 'var(--muted)',
  }[kind] ?? 'var(--edge)';
}

function statusTone(status) {
  return { live: 'good', degraded: 'warn', blocked: 'bad', planned: 'muted' }[status] ?? 'muted';
}
