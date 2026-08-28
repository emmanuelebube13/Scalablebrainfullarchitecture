import {
  $, el, inline, voice, getMode, onModeChange, loadAll, loadJSON,
  mountChrome, fatal,
} from './core.js';

/* ── Constants ───────────────────────────────────────────────── */

const MILESTONE_TONE = {
  done: 'good', in_progress: 'info', contested: 'warn', not_started: 'muted', blocked: 'bad',
};
const MILESTONE_LABEL = {
  done: 'Reached', in_progress: 'In progress', contested: 'Contested',
  not_started: 'Not started', blocked: 'Blocked',
};

/* ── Bootstrap ───────────────────────────────────────────────── */

try {
  mountChrome('goals');

  const { systems } = await loadAll();
  const G = await loadJSON('data/goals.json');

  $('#goals-asof').textContent = `${G.as_of} · ${G.current_period}`;

  /* reactive filter state */
  const state = {
    goalSystem: '', goalStatus: '',
    taskSystem: '', taskStatus: '', taskPeriod: '', taskPriority: '', taskUrgency: '',
  };

  /* initial render */
  buildLadderStrip();
  buildTabBar();
  renderAll(getMode());
  onModeChange(renderAll);

  /* ── Tab switching ─────────────────────────────────────────── */

  function buildTabBar() {
    document.querySelectorAll('.gtab').forEach((btn) => {
      btn.addEventListener('click', () => {
        // deactivate all
        document.querySelectorAll('.gtab').forEach((b) => {
          b.classList.remove('active');
          b.setAttribute('aria-selected', 'false');
        });
        document.querySelectorAll('.goals-panel').forEach((p) => p.classList.remove('active'));
        // activate chosen
        btn.classList.add('active');
        btn.setAttribute('aria-selected', 'true');
        const panel = document.getElementById(btn.dataset.panel);
        if (panel) panel.classList.add('active');
        // swap filter row
        buildFiltersForTab(btn.dataset.panel);
      });
    });
    // initial filter row for first tab
    buildFiltersForTab('panel-goals');
  }

  /* ── Render dispatcher ─────────────────────────────────────── */

  function renderAll(mode) {
    renderMilestones(mode);
    renderGoals(mode);
    renderMatrix(mode);
    renderTasks();
  }

  /* ── Ladder strip (hero pills) ─────────────────────────────── */

  function buildLadderStrip() {
    const strip = $('#ladder-strip');
    strip.innerHTML = '';
    G.milestones.forEach((m) => {
      const tone = MILESTONE_TONE[m.state] ?? 'muted';
      const label = MILESTONE_LABEL[m.state] ?? m.state;
      const pill = el('button', {
        class: `lstrip-rung tone-${tone}`,
        type: 'button',
        title: m.name,
        onclick: () => jumpToLadder(m.id),
      },
        el('span', { class: 'lstrip-dot' }),
        `${m.id} – ${m.name}`
      );
      strip.append(pill);
    });
  }

  function jumpToLadder(id) {
    // switch to ladder tab
    document.querySelectorAll('.gtab').forEach((b) => {
      const on = b.dataset.panel === 'panel-ladder';
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', String(on));
    });
    document.querySelectorAll('.goals-panel').forEach((p) =>
      p.classList.toggle('active', p.id === 'panel-ladder'));
    buildFiltersForTab('panel-ladder');
    // scroll to the milestone
    requestAnimationFrame(() => {
      const target = document.getElementById(`milestone-${id}`);
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  /* ── Milestones ────────────────────────────────────────────── */

  function renderMilestones(mode) {
    const box = $('#milestones');
    box.innerHTML = '';
    const list = el('div', { class: 'gladder' });
    G.milestones.forEach((m) => {
      const tone = MILESTONE_TONE[m.state] ?? 'muted';
      const label = MILESTONE_LABEL[m.state] ?? m.state;
      const item = el('div', {
        class: 'gladder-item',
        id: `milestone-${m.id}`,
        style: { '--tone': `var(--${tone})` },
      },
        el('div', { class: 'gladder-head' },
          el('span', { class: 'gladder-id', text: m.id }),
          el('h3', {},
            m.name,
            m.date ? el('span', { class: 'goal-id', style: { marginLeft: '8px' }, text: m.date }) : null
          ),
          el('span', { class: `badge tone-${tone} gladder-state` }, label)
        ),
        el('p', { class: 'gladder-summary', html: inline(voice({ technical: m.summary, plain: m.plain ?? m.summary }, mode)) }),
        m.falsifier
          ? el('div', { class: 'gladder-falsifier', html: inline(`**Falsifier.** ${m.falsifier}`) })
          : null
      );
      list.append(item);
    });
    box.append(list);
  }

  /* ── Goals ─────────────────────────────────────────────────── */

  function renderGoals(mode) {
    const box = $('#goals');
    box.innerHTML = '';

    const list = G.goals.filter((g) =>
      (!state.goalSystem || g.dependencies.some((d) => d.system === state.goalSystem && d.role !== 'none')) &&
      (!state.goalStatus || g.status === state.goalStatus));

    if (!list.length) {
      box.append(el('p', { class: 'side-empty', text: 'No goals match these filters.' }));
      return;
    }

    const grid = el('div', { class: 'goals-grid' });

    list.forEach((g) => {
      const vocab = G.status_vocabulary[g.status] ?? { label: g.status, tone: 'muted' };
      const pct = g.metric
        ? Math.max(0, Math.min(100, (g.metric.current / (g.metric.target || 1)) * 100))
        : null;

      const card = el('div', {
        class: 'gcard',
        style: { '--tone': `var(--${vocab.tone})` },
      },
        /* header */
        el('div', { class: 'gcard-head' },
          el('span', { class: 'goal-id', text: g.id }),
          el('h3', { text: g.title }),
          el('span', { class: `badge tone-${vocab.tone}` }, vocab.label)
        ),
        /* thin progress bar */
        pct !== null
          ? el('div', { class: 'gcard-meter' },
              el('i', { style: { width: `${pct}%` } }))
          : null,
        /* body */
        el('div', { class: 'gcard-body' },
          el('div', { class: 'gcard-pills' },
            el('span', { class: 'pill', text: g.kind === 'macro' ? 'Macro' : 'Subsystem' }),
            el('span', { class: 'pill', text: `${g.horizon} · ${g.period}` }),
            ...g.dependencies
              .filter((d) => d.role !== 'none')
              .map((d) => {
                const s = systems.find((x) => x.id === d.system);
                const role = G.dependency_roles[d.role];
                return el('span', {
                  class: 'pill',
                  style: { color: s?.accent },
                  text: `${role.symbol} S${s?.ordinal ?? '?'}`,
                  title: `${s?.name ?? d.system} — ${role.label}`,
                });
              })
          ),
          el('p', { class: 'gcard-why', html: inline(voice({ technical: g.why, plain: g.plain }, mode)) }),
          el('div', { class: 'gcard-dod' },
            el('strong', { text: 'Done when' }),
            el('span', { html: inline(g.definition_of_done) })
          )
        ),
        /* metric label */
        g.metric
          ? el('div', { class: 'gcard-metric-label' },
              `${g.metric.name}: ${g.metric.current} / ${g.metric.target} ${g.metric.unit}`,
              g.metric.note ? el('span', { style: { color: 'var(--warn)', marginLeft: '8px' }, text: g.metric.note }) : null
            )
          : null,
        /* blocked */
        g.blocked_by
          ? el('div', { class: 'gcard-blocked', html: inline(`⛔ Blocked by: ${g.blocked_by}`) })
          : null
      );

      grid.append(card);
    });

    box.append(grid);
  }

  /* ── Dependency matrix ─────────────────────────────────────── */

  function renderMatrix(mode) {
    const box = $('#matrix');
    box.innerHTML = '';

    const table = el('table', { class: 'gmatrix' },
      el('thead', {}, el('tr', {},
        el('th', { text: 'Goal' }),
        systems.map((s) =>
          el('th', { style: { color: s.accent }, text: `S${s.ordinal} · ${s.name}` }))
      )),
      el('tbody', {}, G.goals.map((g) =>
        el('tr', {},
          el('td', {},
            el('span', { class: 'goal-id', text: `${g.id} ` }),
            g.title
          ),
          systems.map((s) => {
            const dep = g.dependencies.find((d) => d.system === s.id) ?? { role: 'none', need: '' };
            const role = G.dependency_roles[dep.role];
            return el('td', { class: 'role', 'data-role': dep.role, title: role.note },
              role.symbol || '–',
              dep.need ? el('span', { class: 'need', text: dep.need }) : null
            );
          })
        )
      ))
    );

    box.append(el('div', { class: 'gmatrix-wrap' }, table));
    box.append(el('div', { class: 'gmatrix-legend' },
      Object.entries(G.dependency_roles).map(([id, r]) =>
        el('span', {},
          el('span', { 'data-role': id, text: r.symbol || '–' }),
          `  ${r.label} — ${r.note}`
        )
      )
    ));
  }

  /* ── Tasks ─────────────────────────────────────────────────── */

  function renderTasks() {
    const box = $('#tasks');
    box.innerHTML = '';

    const list = G.tasks.filter((t) =>
      (!state.taskSystem   || t.system   === state.taskSystem)   &&
      (!state.taskStatus   || t.status   === state.taskStatus)   &&
      (!state.taskPeriod   || t.period   === state.taskPeriod)   &&
      (!state.taskPriority || t.priority === state.taskPriority) &&
      (!state.taskUrgency  || t.urgency  === state.taskUrgency));

    if (!list.length) {
      box.append(el('p', { class: 'side-empty', text: 'No tasks match these filters.' }));
      return;
    }

    const prank = { high: 0, medium: 1, low: 2 };
    const srank = { blocked: 0, in_progress: 1, not_started: 2, deferred: 3, done: 4 };
    list.sort((a, b) =>
      (prank[a.priority] ?? 9) - (prank[b.priority] ?? 9) ||
      (srank[a.status]   ?? 9) - (srank[b.status]   ?? 9) ||
      a.id.localeCompare(b.id));

    const table = el('table', { class: 'gtask-table' },
      el('thead', {}, el('tr', {},
        ['ID', 'Sys', 'Pri', 'Urg', 'Task', 'Goal', 'Period', 'Status']
          .map((c) => el('th', { text: c }))
      )),
      el('tbody', {}, list.map((t) => {
        const s = systems.find((x) => x.id === t.system);
        const v = G.status_vocabulary[t.status] ?? { label: t.status, tone: 'muted' };
        const p = (G.priority_vocabulary ?? {})[t.priority];
        const u = (G.urgency_vocabulary ?? {})[t.urgency];
        return el('tr', { 'data-priority': t.priority ?? '', 'data-status': t.status },
          el('td', {}, el('code', { text: t.id })),
          el('td', { style: { color: s?.accent }, text: `S${s?.ordinal ?? '?'}` }),
          el('td', {}, p ? el('span', { class: `badge tone-${p.tone}`, title: p.note, text: p.label }) : '–'),
          el('td', {}, u ? el('span', { class: `pill tone-${u.tone}`,  title: u.note, text: u.label }) : '–'),
          el('td', {},
            el('strong', { text: t.title }),
            t.detail   ? el('span', { class: 'gtask-detail', html: inline(t.detail) }) : null,
            t.evidence ? el('span', { class: 'gtask-detail', html: inline(`*evidence:* \`${t.evidence}\``) }) : null
          ),
          el('td', {}, el('code', { text: t.goal })),
          el('td', { text: t.period }),
          el('td', {}, el('span', { class: `badge tone-${v.tone}`, text: v.label }))
        );
      }))
    );

    box.append(el('div', { class: 'gtask-table-wrap' }, table));
    box.append(el('p', {
      class: 'gtask-note',
      html: inline(`Showing **${list.length}** of ${G.tasks.length} tasks.`),
    }));
  }

  /* ── Contextual filter rows ────────────────────────────────── */

  function buildFiltersForTab(panelId) {
    const row = $('#tab-filters');
    row.innerHTML = '';

    if (panelId === 'panel-goals') {
      row.append(
        sel('System', systems.map((s) => [s.id, `S${s.ordinal} – ${s.name}`]), 'All systems', (v) => {
          state.goalSystem = v; renderGoals(getMode());
        }),
        sel('Status', Object.entries(G.status_vocabulary).map(([k, v]) => [k, v.label]), 'Any status', (v) => {
          state.goalStatus = v; renderGoals(getMode());
        })
      );
    }

    if (panelId === 'panel-tasks') {
      const periods = [...new Set(G.tasks.map((t) => t.period))].sort();
      row.append(
        sel('System',   systems.map((s) => [s.id, `S${s.ordinal} – ${s.name}`]), 'All systems', (v) => { state.taskSystem = v;   renderTasks(); }),
        sel('Priority', Object.entries(G.priority_vocabulary ?? {}).map(([k, v]) => [k, v.label]), 'Any priority', (v) => { state.taskPriority = v; renderTasks(); }),
        sel('Urgency',  Object.entries(G.urgency_vocabulary  ?? {}).map(([k, v]) => [k, v.label]), 'Any urgency',  (v) => { state.taskUrgency  = v; renderTasks(); }),
        sel('Status',   Object.entries(G.status_vocabulary).map(([k, v]) => [k, v.label]), 'Any status',   (v) => { state.taskStatus  = v; renderTasks(); }),
        sel('Period',   periods.map((p) => [p, p]), 'Any period', (v) => { state.taskPeriod  = v; renderTasks(); }),
        el('button', {
          class: 'pill', type: 'button', text: 'Reset',
          onclick: () => {
            Object.assign(state, { taskSystem: '', taskStatus: '', taskPeriod: '', taskPriority: '', taskUrgency: '' });
            row.querySelectorAll('select').forEach((s) => { s.value = ''; });
            renderTasks();
          },
        })
      );
    }
  }

  function sel(label, options, allLabel, onchange) {
    const s = el('select', {
      title: label,
      onchange: (e) => onchange(e.target.value),
    },
      el('option', { value: '' }, allLabel),
      options.map(([value, lbl]) => el('option', { value }, lbl))
    );
    return s;
  }

} catch (err) {
  fatal($('#main'), err);
  console.error(err);
}
