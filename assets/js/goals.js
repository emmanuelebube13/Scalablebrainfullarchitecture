import {
  $, el, inline, voice, getMode, onModeChange, loadAll, loadJSON,
  mountChrome, fatal,
} from './core.js';
import {
  periodRange, overlaps, monthsSpanned, monthWeeks,
  monthLabel, weekLabel, WEEKDAY_SHORT,
} from './period.js';

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
    goalSystem: '', goalStatus: '', goalKind: '',
    calMonth: null,   // '2026-09' or null
    calWeek: null,    // '2026-W36' or null
  };

  /* stable reference to the goal-grid container — initialized in initGoalsPanel() */
  let goalsGridContainer = null;

  /* pre-index tasks by goal id for fast lookup */
  const tasksByGoal = new Map();
  for (const t of G.tasks) {
    if (!tasksByGoal.has(t.goal)) tasksByGoal.set(t.goal, []);
    tasksByGoal.get(t.goal).push(t);
  }

  /* every month that appears in any task or goal period — for calendar */
  function allMonths() {
    const months = new Set();
    for (const t of G.tasks) {
      for (const m of monthsSpanned(t.period)) months.add(m);
    }
    for (const g of G.goals) {
      for (const m of monthsSpanned(g.period)) months.add(m);
    }
    return [...months].sort();
  }

  /* initial render */
  buildLadderStrip();
  buildTabBar();
  renderAll(getMode());
  onModeChange(renderAll);

  /* ── Tab switching ─────────────────────────────────────────── */

  function buildTabBar() {
    document.querySelectorAll('.gtab').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.gtab').forEach((b) => {
          b.classList.remove('active');
          b.setAttribute('aria-selected', 'false');
        });
        document.querySelectorAll('.goals-panel').forEach((p) => p.classList.remove('active'));
        btn.classList.add('active');
        btn.setAttribute('aria-selected', 'true');
        const panel = document.getElementById(btn.dataset.panel);
        if (panel) panel.classList.add('active');
        buildFiltersForTab(btn.dataset.panel);
      });
    });
    buildFiltersForTab('panel-goals');
  }

  /* ── Render dispatcher ─────────────────────────────────────── */

  function renderAll(mode) {
    renderMilestones(mode);
    renderGoals(mode);
    renderMatrix(mode);
  }

  /* ── Ladder strip (hero pills) ─────────────────────────────── */

  function buildLadderStrip() {
    const strip = $('#ladder-strip');
    strip.innerHTML = '';
    G.milestones.forEach((m) => {
      const tone = MILESTONE_TONE[m.state] ?? 'muted';
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
    document.querySelectorAll('.gtab').forEach((b) => {
      const on = b.dataset.panel === 'panel-ladder';
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', String(on));
    });
    document.querySelectorAll('.goals-panel').forEach((p) =>
      p.classList.toggle('active', p.id === 'panel-ladder'));
    buildFiltersForTab('panel-ladder');
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

  /* ── Calendar widget ───────────────────────────────────────── */

  /**
   * Build a one-month mini-calendar. Clicking a month header toggles the whole
   * month; clicking a week row toggles that ISO week. The active selection is
   * shown with a highlight and written into `state.calMonth / state.calWeek`.
   *
   * `onSelect(month, week)` is called with the new values whenever the user clicks.
   * Both may be null (cleared), month alone (whole month), or both (specific week).
   */
  function buildCalendar(months, activeMonth, activeWeek, onSelect) {
    if (!months.length) return el('div', {});

    /* determine displayed month — default to the current_period or first available */
    let displayMonth = activeMonth;
    if (!displayMonth) {
      displayMonth = months.includes(G.current_period)
        ? G.current_period
        : months[0];
    }

    /* navigation */
    const idx = months.indexOf(displayMonth);

    const cal = el('div', { class: 'gcal' });

    /* month nav row */
    const prevBtn = el('button', {
      class: 'gcal-nav',
      type: 'button',
      disabled: idx <= 0 ? '' : null,
      'aria-label': 'Previous month',
      onclick: () => {
        const newMonth = months[idx - 1];
        if (newMonth) {
          const container = cal.closest('.gcal-wrap') ?? cal.parentElement;
          container.replaceChildren(buildCalendar(months, newMonth, null, onSelect));
        }
      },
    }, '‹');

    const monthBtn = el('button', {
      class: activeMonth === displayMonth && !activeWeek ? 'gcal-month-label active' : 'gcal-month-label',
      type: 'button',
      title: 'Click to filter by this whole month',
      onclick: () => {
        if (activeMonth === displayMonth && !activeWeek) {
          onSelect(null, null);
        } else {
          onSelect(displayMonth, null);
        }
      },
    }, monthLabel(displayMonth));

    const nextBtn = el('button', {
      class: 'gcal-nav',
      type: 'button',
      disabled: idx >= months.length - 1 ? '' : null,
      'aria-label': 'Next month',
      onclick: () => {
        const newMonth = months[idx + 1];
        if (newMonth) {
          const container = cal.closest('.gcal-wrap') ?? cal.parentElement;
          container.replaceChildren(buildCalendar(months, newMonth, null, onSelect));
        }
      },
    }, '›');

    const nav = el('div', { class: 'gcal-nav-row' }, prevBtn, monthBtn, nextBtn);
    cal.append(nav);

    /* day-of-week headers */
    const header = el('div', { class: 'gcal-grid gcal-header' });
    /* first cell = week label space */
    header.append(el('div', { class: 'gcal-wk-label', text: 'Wk' }));
    WEEKDAY_SHORT.forEach((d) => header.append(el('div', { class: 'gcal-dow', text: d })));
    cal.append(header);

    /* count tasks/goals per week for dot density */
    const weeksInMonth = monthWeeks(displayMonth);
    const weekCounts = new Map();
    for (const row of weeksInMonth) {
      const wrange = [row.start, row.end];
      let count = 0;
      for (const t of G.tasks) {
        const tr = periodRange(t.period);
        if (tr && overlaps(tr, wrange)) count++;
      }
      for (const g of G.goals) {
        const gr = periodRange(g.period);
        if (gr && overlaps(gr, wrange)) count++;
      }
      weekCounts.set(row.week, count);
    }

    /* week rows */
    weeksInMonth.forEach((row) => {
      const isActiveWeek = activeWeek === row.week;
      const isActiveMonth = activeMonth === displayMonth && !activeWeek;
      const count = weekCounts.get(row.week) ?? 0;

      const weekRow = el('div', {
        class: `gcal-grid gcal-week${isActiveWeek ? ' active-week' : ''}${isActiveMonth ? ' active-month' : ''}`,
        'data-week': row.week,
        role: 'button',
        tabindex: '0',
        title: `Filter by ${row.week} — ${count} item${count !== 1 ? 's' : ''}`,
        onclick: () => {
          if (isActiveWeek) {
            onSelect(null, null);
          } else {
            onSelect(displayMonth, row.week);
          }
        },
        onkeydown: (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            weekRow.click();
          }
        },
      });

      /* week number cell */
      const wkLabel = el('div', { class: 'gcal-wk-label' });
      wkLabel.append(el('span', { class: 'gcal-wk-num', text: weekLabel(row.week) }));
      if (count > 0) {
        const dots = Math.min(count, 5);
        const dotRow = el('span', { class: 'gcal-dots' });
        for (let i = 0; i < dots; i++) dotRow.append(el('i'));
        wkLabel.append(dotRow);
      }
      weekRow.append(wkLabel);

      /* day cells */
      row.days.forEach((d) => {
        const today = new Date();
        const isToday = d.ms === Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
        weekRow.append(el('div', {
          class: `gcal-day${d.inMonth ? '' : ' out-month'}${isToday ? ' today' : ''}`,
          text: String(d.day),
        }));
      });

      cal.append(weekRow);
    });

    return cal;
  }

  function mountCalendar(container, onSelect) {
    const months = allMonths();
    const wrap = el('div', { class: 'gcal-wrap' });

    function pick(month, week) {
      state.calMonth = month;
      state.calWeek = week;
      onSelect();
      wrap.replaceChildren(buildCalendar(months, state.calMonth, state.calWeek, pick));
    }

    wrap.append(buildCalendar(months, state.calMonth, state.calWeek, pick));
    container.append(wrap);
  }

  /* ── Goals (with nested tasks) ─────────────────────────────── */

  /**
   * Returns true if a goal should be shown given the current calendar selection.
   * A goal is included if:
   *  - No calendar filter is active, OR
   *  - The goal itself spans the selected period, OR
   *  - Any of the goal's tasks span the selected period.
   */
  function goalMatchesPeriod(g) {
    const activeRange = state.calWeek
      ? periodRange(state.calWeek)
      : state.calMonth
        ? periodRange(state.calMonth)
        : null;

    if (!activeRange) return true;

    const goalRange = periodRange(g.period);
    if (goalRange && overlaps(goalRange, activeRange)) return true;

    const tasks = tasksByGoal.get(g.id) ?? [];
    return tasks.some((t) => {
      const tr = periodRange(t.period);
      return tr && overlaps(tr, activeRange);
    });
  }

  /* Lazily mount the calendar once; only the grid re-renders on filter changes */
  function initGoalsPanel() {
    const box = $('#goals');
    box.innerHTML = '';

    const calPanel = el('div', { class: 'goals-cal-panel' });
    mountCalendar(calPanel, () => renderGoalsGrid(getMode()));
    box.append(calPanel);

    goalsGridContainer = el('div', { class: 'goals-grid-container' });
    box.append(goalsGridContainer);
  }

  function renderGoals(mode) {
    if (!goalsGridContainer) initGoalsPanel();
    renderGoalsGrid(mode);
  }

  function renderGoalsGrid(mode) {
    goalsGridContainer.innerHTML = '';

    const list = G.goals.filter((g) =>
      (!state.goalSystem || g.dependencies.some((d) => d.system === state.goalSystem && d.role !== 'none')) &&
      (!state.goalStatus || g.status === state.goalStatus) &&
      (!state.goalKind || g.kind === state.goalKind) &&
      goalMatchesPeriod(g));

    if (!list.length) {
      goalsGridContainer.append(el('p', { class: 'side-empty', text: 'No goals match these filters.' }));
      return;
    }

    const grid = el('div', { class: 'goals-grid' });

    list.forEach((g) => {
      const vocab = G.status_vocabulary[g.status] ?? { label: g.status, tone: 'muted' };
      const pct = g.metric
        ? Math.max(0, Math.min(100, (g.metric.current / (g.metric.target || 1)) * 100))
        : null;

      /* all tasks for this goal, filtered to the active period */
      const allGoalTasks = tasksByGoal.get(g.id) ?? [];
      const periodTasks = allGoalTasks.filter((t) => {
        if (!state.calWeek && !state.calMonth) return true;
        const activeRange = state.calWeek
          ? periodRange(state.calWeek)
          : periodRange(state.calMonth);
        const tr = periodRange(t.period);
        return tr && overlaps(tr, activeRange);
      });
      const taskCount = periodTasks.length;

      const card = el('div', {
        class: 'gcard',
        style: { '--tone': `var(--${vocab.tone})` },
        role: 'button',
        tabindex: '0',
        title: 'Click to view tasks',
        onclick: () => openTaskModal(g, periodTasks, mode),
        onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openTaskModal(g, periodTasks, mode); } },
      },
        /* header */
        el('div', { class: 'gcard-head' },
          el('span', { class: 'goal-id', text: g.id }),
          el('h3', { text: g.title }),
          el('span', { class: `badge tone-${vocab.tone}` }, vocab.label),
          taskCount
            ? el('span', { class: 'gcard-task-count' }, `${taskCount} task${taskCount !== 1 ? 's' : ''}`)
            : el('span', { class: 'gcard-task-count gcard-task-count--none' }, 'No tasks')
        ),
        /* thin progress bar */
        pct !== null
          ? el('div', { class: 'gcard-meter' },
              el('i', { style: { width: `${pct}%` } }))
          : null,
        /* body */
        el('div', { class: 'gcard-body' },
          el('div', { class: 'gcard-pills' },
            el('span', { class: 'pill', text: { macro: 'Macro', personal: 'Personal' }[g.kind] ?? 'Subsystem' }),
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

    goalsGridContainer.append(grid);
  }

  /* ── Task modal ────────────────────────────────────────────── */

  function openTaskModal(g, tasks, mode) {
    /* remove any existing modal */
    document.getElementById('gtask-modal')?.remove();

    const vocab = G.status_vocabulary[g.status] ?? { label: g.status, tone: 'muted' };
    const prank = { high: 0, medium: 1, low: 2 };
    const srank = { blocked: 0, in_progress: 1, not_started: 2, deferred: 3, done: 4 };
    const sorted = [...tasks].sort((a, b) =>
      (prank[a.priority] ?? 9) - (prank[b.priority] ?? 9) ||
      (srank[a.status]   ?? 9) - (srank[b.status]   ?? 9));

    /* ── task rows ── */
    const taskRows = sorted.length
      ? sorted.map((t) => {
          const s = systems.find((x) => x.id === t.system);
          const v = G.status_vocabulary[t.status] ?? { label: t.status, tone: 'muted' };
          const p = (G.priority_vocabulary ?? {})[t.priority];
          const u = (G.urgency_vocabulary ?? {})[t.urgency];
          return el('div', {
            class: 'gmodal-task',
            'data-priority': t.priority ?? '',
            'data-status': t.status,
          },
            el('div', { class: 'gmodal-task-head' },
              el('code', { class: 'gtask-id', text: t.id }),
              p ? el('span', { class: `badge tone-${p.tone}`, title: p.note, text: p.label }) : null,
              u ? el('span', { class: `pill tone-${u.tone}`, title: u.note, text: u.label }) : null,
              s ? el('span', { class: 'gtask-sys', style: { color: s.accent }, text: `S${s.ordinal}` }) : null,
              el('span', { class: `badge tone-${v.tone}`, text: v.label }),
              el('span', { class: 'pill gmodal-period', text: t.period })
            ),
            el('div', { class: 'gmodal-task-body' },
              el('strong', { text: t.title }),
              t.detail   ? el('p', { class: 'gmodal-task-detail', html: inline(t.detail) }) : null,
              t.evidence ? el('p', { class: 'gmodal-task-detail', html: inline(`**Evidence:** \`${t.evidence}\``) }) : null
            )
          );
        })
      : [el('p', { class: 'gmodal-empty', text: 'No tasks in the selected period.' })];

    /* ── sheet ── */
    const sheet = el('div', { class: 'gmodal-sheet', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'gmodal-title' },
      /* sticky header */
      el('div', { class: 'gmodal-header' },
        el('div', { class: 'gmodal-title-row' },
          el('span', { class: 'goal-id', text: g.id }),
          el('h2', { id: 'gmodal-title', text: g.title }),
          el('span', { class: `badge tone-${vocab.tone}` }, vocab.label)
        ),
        el('div', { class: 'gmodal-header-pills' },
          el('span', { class: 'pill', text: { macro: 'Macro', personal: 'Personal' }[g.kind] ?? 'Subsystem' }),
          el('span', { class: 'pill', text: `${g.horizon} · ${g.period}` }),
          el('span', { class: 'pill', text: `${sorted.length} task${sorted.length !== 1 ? 's' : ''}` })
        ),
        el('div', { class: 'gmodal-header-actions' },
          el('button', {
            class: 'gmodal-dl',
            type: 'button',
            title: 'Download as Markdown',
            onclick: () => downloadGoalMd(g, sorted),
          }, '↓ Download .md'),
          el('button', {
            class: 'gmodal-close',
            type: 'button',
            'aria-label': 'Close',
            onclick: closeModal,
          }, '✕')
        )
      ),
      /* scrollable body */
      el('div', { class: 'gmodal-body' },
        /* goal summary */
        el('section', { class: 'gmodal-goal-summary' },
          el('p', { class: 'gmodal-why', html: inline(voice({ technical: g.why, plain: g.plain }, mode)) }),
          el('div', { class: 'gcard-dod' },
            el('strong', { text: 'Done when' }),
            el('span', { html: inline(g.definition_of_done) })
          ),
          g.metric
            ? el('div', { class: 'gcard-metric-label' },
                `${g.metric.name}: ${g.metric.current} / ${g.metric.target} ${g.metric.unit}`,
                g.metric.note ? el('span', { style: { color: 'var(--warn)', marginLeft: '8px' }, text: g.metric.note }) : null
              )
            : null,
          g.blocked_by
            ? el('div', { class: 'gcard-blocked', html: inline(`⛔ Blocked by: ${g.blocked_by}`) })
            : null
        ),
        /* tasks heading */
        el('h3', { class: 'gmodal-tasks-heading', text: 'Tasks' }),
        /* task list */
        el('div', { class: 'gmodal-task-list' }, ...taskRows)
      )
    );

    const overlay = el('div', {
      id: 'gtask-modal',
      class: 'gmodal-overlay',
      onclick: (e) => { if (e.target === overlay) closeModal(); },
    }, sheet);

    document.body.append(overlay);

    /* trap focus in modal — close on Escape */
    const onKey = (e) => { if (e.key === 'Escape') closeModal(); };
    document.addEventListener('keydown', onKey, { once: true });

    /* prevent body scroll */
    document.body.style.overflow = 'hidden';

    /* animate in */
    requestAnimationFrame(() => overlay.classList.add('gmodal-visible'));

    function closeModal() {
      document.removeEventListener('keydown', onKey);
      overlay.classList.remove('gmodal-visible');
      overlay.addEventListener('transitionend', () => {
        overlay.remove();
        document.body.style.overflow = '';
      }, { once: true });
    }
  }

  /* ── Download goal + tasks as Markdown ─────────────────────── */

  function downloadGoalMd(g, tasks) {
    const vocab = G.status_vocabulary[g.status] ?? { label: g.status, tone: 'muted' };
    const lines = [
      `# ${g.id} — ${g.title}`,
      '',
      `**Status:** ${vocab.label}  `,
      `**Kind:** ${{ macro: 'Macro', personal: 'Personal', system: 'Subsystem' }[g.kind] ?? g.kind}  `,
      `**Period:** ${g.period}  `,
      `**Horizon:** ${g.horizon}`,
      '',
      '## Why',
      '',
      g.why ?? g.plain ?? '',
      '',
      '## Done when',
      '',
      g.definition_of_done ?? '',
      '',
    ];

    if (g.metric) {
      lines.push('## Metric', '', `${g.metric.name}: ${g.metric.current} / ${g.metric.target} ${g.metric.unit}`, '');
      if (g.metric.note) lines.push(`> ${g.metric.note}`, '');
    }

    if (g.blocked_by) lines.push('## Blocked by', '', g.blocked_by, '');

    lines.push('## Tasks', '');

    if (!tasks.length) {
      lines.push('_No tasks in the selected period._', '');
    } else {
      for (const t of tasks) {
        const v = G.status_vocabulary[t.status] ?? { label: t.status };
        const p = (G.priority_vocabulary ?? {})[t.priority];
        const u = (G.urgency_vocabulary ?? {})[t.urgency];
        const s = systems.find((x) => x.id === t.system);
        lines.push(
          `### ${t.id} — ${t.title}`,
          '',
          `| Field | Value |`,
          `|---|---|`,
          `| Status | ${v.label} |`,
          `| Priority | ${p?.label ?? t.priority ?? '—'} |`,
          `| Urgency | ${u?.label ?? t.urgency ?? '—'} |`,
          `| System | ${s ? `S${s.ordinal} ${s.name}` : t.system} |`,
          `| Period | ${t.period} |`,
          '',
        );
        if (t.detail) lines.push(t.detail, '');
        if (t.evidence) lines.push(`**Evidence:** \`${t.evidence}\``, '');
        lines.push('---', '');
      }
    }

    const blob = new Blob([lines.join('\n')], { type: 'text/markdown' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${g.id.toLowerCase()}-tasks.md`;
    a.click();
    URL.revokeObjectURL(a.href);
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
        }),
        sel('Kind',
          [['macro', 'Macro'], ['system', 'Subsystem'], ['personal', 'Personal']],
          'Any kind', (v) => { state.goalKind = v; renderGoals(getMode()); }),
        el('button', {
          class: 'pill', type: 'button', text: 'Reset',
          onclick: () => {
            Object.assign(state, { goalSystem: '', goalStatus: '', goalKind: '', calMonth: null, calWeek: null });
            row.querySelectorAll('select').forEach((s) => { s.value = ''; });
            renderGoals(getMode());
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
