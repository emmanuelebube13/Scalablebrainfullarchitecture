import {
  $, el, inline, voice, getMode, onModeChange, loadAll, loadJSON,
  mountChrome, fatal, renderTable,
} from './core.js';

const MILESTONE_TONE = {
  done: 'good', in_progress: 'info', contested: 'warn', not_started: 'muted', blocked: 'bad',
};
const MILESTONE_LABEL = {
  done: 'Reached', in_progress: 'In progress', contested: 'Contested', not_started: 'Not started', blocked: 'Blocked',
};

try {
  mountChrome('goals');
  const { systems } = await loadAll();
  const G = await loadJSON('data/goals.json');

  $('#goals-asof').textContent = `State as of ${G.as_of} · current period ${G.current_period}`;

  const state = { goalSystem: '', goalStatus: '', taskSystem: '', taskStatus: '', taskPeriod: '' };

  buildFilters();
  renderAll(getMode());
  onModeChange(renderAll);

  function renderAll(mode) {
    renderMilestones(mode);
    renderGoals(mode);
    renderMatrix(mode);
    renderTasks();
  }

  /* ---------- milestones ---------- */
  function renderMilestones(mode) {
    const box = $('#milestones');
    box.innerHTML = '';
    box.append(el('ol', { class: 'ladder' },
      G.milestones.map((m) => {
        const tone = MILESTONE_TONE[m.state] ?? 'muted';
        return el('li', { style: { '--tone': `var(--${tone})` } },
          el('div', { class: 'rung' }, m.id, el('small', { text: MILESTONE_LABEL[m.state] ?? m.state })),
          el('div', {},
            el('h3', {}, m.name,
              m.date ? el('span', { class: 'goal-id', style: { marginLeft: '10px' }, text: m.date }) : null),
            el('p', { html: inline(mode === 'plain' ? (m.plain ?? m.summary) : m.summary) }),
            m.falsifier ? el('div', { class: 'falsifier', html: inline(`**Falsifier.** ${m.falsifier}`) }) : null));
      })));
  }

  /* ---------- goals ---------- */
  function renderGoals(mode) {
    const box = $('#goals');
    box.innerHTML = '';
    const list = G.goals.filter((g) =>
      (!state.goalSystem || g.dependencies.some((d) => d.system === state.goalSystem && d.role !== 'none')) &&
      (!state.goalStatus || g.status === state.goalStatus));

    if (!list.length) { box.append(el('p', { class: 'side-empty', text: 'No goals match these filters.' })); return; }

    list.forEach((g) => {
      const vocab = G.status_vocabulary[g.status] ?? { label: g.status, tone: 'muted' };
      const pct = g.metric ? Math.max(0, Math.min(100, (g.metric.current / (g.metric.target || 1)) * 100)) : 0;
      box.append(el('div', { class: 'card goal-card', style: { '--tone': `var(--${vocab.tone})` } },
        el('div', { class: 'goal-head' },
          el('span', { class: 'goal-id', text: g.id }),
          el('h3', { text: g.title }),
          el('span', { class: `badge tone-${vocab.tone}` }, vocab.label)),
        el('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' } },
          el('span', { class: 'pill', text: g.kind === 'macro' ? 'Macro goal' : 'Subsystem goal' }),
          el('span', { class: 'pill', text: `${g.horizon} · ${g.period}` }),
          ...g.dependencies.filter((d) => d.role !== 'none').map((d) => {
            const s = systems.find((x) => x.id === d.system);
            return el('span', { class: 'pill', style: { color: s?.accent }, text: `${G.dependency_roles[d.role].symbol} ${s?.name ?? d.system}` });
          })),
        el('p', { class: 'goal-why', html: inline(voice({ technical: g.why, plain: g.plain }, mode)) }),
        g.metric ? el('div', {},
          el('div', { class: 'meter', style: { '--tone': `var(--${vocab.tone})` } }, el('i', { style: { width: `${pct}%` } })),
          el('div', { class: 'meter-label', text: `${g.metric.name}: ${g.metric.current} / ${g.metric.target} ${g.metric.unit}` }),
          g.metric.note ? el('div', { class: 'meter-label', style: { color: 'var(--warn)' }, text: g.metric.note }) : null) : null,
        el('div', { class: 'dod' }, el('strong', { text: 'Definition of done' }), el('span', { html: inline(g.definition_of_done) })),
        g.blocked_by ? el('p', { class: 'meter-label', style: { color: 'var(--bad)', marginTop: '10px' },
          html: inline(`Blocked by: ${g.blocked_by}`) }) : null));
    });
  }

  /* ---------- dependency matrix ---------- */
  function renderMatrix(mode) {
    const box = $('#matrix');
    box.innerHTML = '';
    const table = el('table', { class: 'matrix' },
      el('thead', {}, el('tr', {},
        el('th', { text: 'Goal' }),
        systems.map((s) => el('th', { style: { color: s.accent }, text: `S${s.ordinal} — ${s.name}` })))),
      el('tbody', {}, G.goals.map((g) =>
        el('tr', {},
          el('td', {}, el('span', { class: 'goal-id', text: `${g.id} ` }), g.title),
          systems.map((s) => {
            const dep = g.dependencies.find((d) => d.system === s.id) ?? { role: 'none', need: '' };
            const role = G.dependency_roles[dep.role];
            return el('td', { class: 'role', 'data-role': dep.role, title: role.note },
              role.symbol || '—',
              dep.need ? el('span', { class: 'need', text: dep.need }) : null);
          })))));
    box.append(el('div', { class: 'table-wrap' }, table));
    box.append(el('div', { class: 'legend', style: { marginTop: '12px' } },
      Object.entries(G.dependency_roles).map(([id, r]) =>
        el('span', {}, el('span', { class: 'mono', 'data-role': id, text: r.symbol || '—' }), `${r.label} — ${r.note}`))));
  }

  /* ---------- tasks ---------- */
  function renderTasks() {
    const box = $('#tasks');
    box.innerHTML = '';
    const list = G.tasks.filter((t) =>
      (!state.taskSystem || t.system === state.taskSystem) &&
      (!state.taskStatus || t.status === state.taskStatus) &&
      (!state.taskPeriod || t.period === state.taskPeriod));

    if (!list.length) { box.append(el('p', { class: 'side-empty', text: 'No tasks match these filters.' })); return; }

    const rank = { blocked: 0, in_progress: 1, not_started: 2, deferred: 3, done: 4 };
    list.sort((a, b) => rank[a.status] - rank[b.status] || a.id.localeCompare(b.id));

    box.append(...renderTable({
      columns: ['ID', 'System', 'Task', 'Goal', 'Period', 'Status'],
      rows: list.map((t) => {
        const s = systems.find((x) => x.id === t.system);
        const v = G.status_vocabulary[t.status] ?? { label: t.status };
        return [
          `\`${t.id}\``,
          `S${s?.ordinal ?? '?'}`,
          `**${t.title}** — ${t.detail}${t.evidence ? ` *(evidence: \`${t.evidence}\`)*` : ''}`,
          `\`${t.goal}\``,
          t.period,
          v.label,
        ];
      }),
      note: 'Tasks live in `data/goals.json`. An agent adds one by appending an object to the `tasks` array and committing — no HTML changes.',
    }));
  }

  /* ---------- filters ---------- */
  function buildFilters() {
    const periods = [...new Set(G.tasks.map((t) => t.period))].sort();

    $('#goal-filters').append(
      el('label', { text: 'System' }),
      sel(systems.map((s) => [s.id, `System ${s.ordinal} — ${s.name}`]), 'All systems',
        (v) => { state.goalSystem = v; renderGoals(getMode()); }),
      el('label', { text: 'Status' }),
      sel(Object.entries(G.status_vocabulary).map(([k, v]) => [k, v.label]), 'Any status',
        (v) => { state.goalStatus = v; renderGoals(getMode()); }));

    $('#task-filters').append(
      el('label', { text: 'System' }),
      sel(systems.map((s) => [s.id, `System ${s.ordinal} — ${s.name}`]), 'All systems',
        (v) => { state.taskSystem = v; renderTasks(); }),
      el('label', { text: 'Status' }),
      sel(Object.entries(G.status_vocabulary).map(([k, v]) => [k, v.label]), 'Any status',
        (v) => { state.taskStatus = v; renderTasks(); }),
      el('label', { text: 'Period' }),
      sel(periods.map((p) => [p, p]), 'Any period',
        (v) => { state.taskPeriod = v; renderTasks(); }));
  }

  function sel(options, allLabel, onchange) {
    const s = el('select', { onchange: (e) => onchange(e.target.value) },
      el('option', { value: '' }, allLabel),
      options.map(([value, label]) => el('option', { value }, label)));
    return s;
  }
} catch (err) {
  fatal($('#main'), err);
  console.error(err);
}
