import {
  $, el, inline, voice, getMode, onModeChange, loadAll, loadJSON,
  mountChrome, fatal, statusBadge,
} from './core.js';

const main = $('#content');

try {
  mountChrome('overview');
  const { registry, systems } = await loadAll();
  const goals = await loadJSON('data/goals.json');
  const decisions = await loadJSON('data/decisions.json');

  const P = registry.project;
  $('#hero-eyebrow').textContent = `${P.subtitle} · state as of ${P.as_of}`;
  $('#hero-title').textContent = P.name;
  $('#hero-lede').innerHTML = inline(
    `${systems.length} independently deployable systems across ${systems.length} computers, connected by cloud object ` +
    `storage and message queues. This site is the architecture hub and the operations tracker — both rendered from ` +
    `structured files in a Git repository, so agents and humans edit the same source.`
  );
  $('#hero-thesis').innerHTML = inline(`**${P.thesis}**`);

  render(getMode());
  onModeChange(render);

  function render(mode) {
    main.innerHTML = '';

    /* ---- the systems ---- */
    main.append(section('The systems', 'Three subsystems, one pipeline',
      'Each has its own page with data ingestion, core logic, contracts and known gaps — in either voice.',
      el('div', { class: 'grid grid-3' },
        systems.map((s) =>
          el('a', { class: 'card system-card', href: `system.html?id=${s.id}`, style: { '--sys': s.accent } },
            el('span', { class: 'sys-ordinal', text: `System ${s.ordinal} · ${s.host}` }),
            el('h3', { text: s.name }),
            el('div', { class: 'sys-role', text: `${s.role} · ${s.duty_cycle}` }),
            el('p', { class: 'sys-summary', html: inline(truncate(voice(s.summary, mode), 240)) }),
            el('div', { class: 'sys-foot' },
              statusBadge(s.status.state, registry.status_vocabulary),
              el('span', { text: `as of ${s.status.as_of}` }))))
      ),
      el('p', { style: { marginTop: '20px' } },
        el('a', { href: 'architecture.html' }, 'See how they connect →'))
    ));

    /* ---- honest state ---- */
    const open = systems.flatMap((s) =>
      (s.sections.find((x) => x.id === 'open')?.issues ?? []).map((i) => ({ ...i, system: s })));
    const high = open.filter((i) => i.severity === 'high');
    const reached = goals.milestones.filter((m) => m.state === 'done').length;

    main.append(section('Where it actually stands', 'The unflattering summary',
      'This project treats an honest zero as more valuable than a flattering estimate, because every measurement taken after a lie is worthless.',
      el('div', { class: 'facts' },
        fact('Milestone rungs reached', `${reached} of ${goals.milestones.length}`),
        fact('Open high-severity gaps', String(high.length)),
        fact('Goals in flight', String(goals.goals.filter((g) => g.status === 'in_progress').length)),
        fact('Goals blocked', String(goals.goals.filter((g) => g.status === 'blocked').length))),
      el('div', { class: 'grid grid-2', style: { marginTop: '20px' } },
        high.slice(0, 6).map((i) =>
          el('div', { class: `issue sev-${i.severity}` },
            el('div', { class: 'issue-head' },
              el('span', { class: 'pill', text: i.system.name }),
              el('strong', { text: i.title })),
            el('p', { html: inline(i.text) }))))
    ));

    /* ---- principles ---- */
    main.append(section('The rules that do not bend', 'Inviolable principles',
      'These are not aspirations. Each one is enforced somewhere specific in the code, and each one has a cost the project has agreed to pay.',
      el('div', { class: 'grid grid-2' },
        P.principles.map((p) =>
          el('div', { class: 'card' },
            el('h3', { text: p.title }),
            el('p', { class: 'goal-why', html: inline(voice(p, mode)) }))))
    ));

    /* ---- open decisions ---- */
    const openDecisions = decisions.decisions.filter((d) => d.status === 'proposed');
    if (openDecisions.length) {
      main.append(section('Undecided', 'Open architectural decisions',
        'The most important thing to know about a system is usually the part still being argued about.',
        el('div', { class: 'grid' },
          openDecisions.map((d) =>
            el('div', { class: 'card goal-card', style: { '--tone': 'var(--warn)' } },
              el('div', { class: 'goal-head' },
                el('span', { class: 'goal-id', text: d.id }),
                el('h3', { text: d.title }),
                el('span', { class: 'badge tone-warn' }, 'Awaiting review')),
              el('p', { class: 'goal-why', html: inline(voice(d.problem, mode)) }),
              el('p', {}, el('a', { href: 'architecture.html#decisions' }, 'Read the decision in full →')))))
      ));
    }

    /* ---- next ---- */
    main.append(section('Where to go next', 'This site, in five places', null,
      el('div', { class: 'grid grid-4' },
        link('architecture.html', 'Unified map', 'Every component and every handoff, with traceable flows.'),
        link('system.html?id=system-1', 'Subsystem pages', 'Ingestion, logic, contracts and gaps for each system.'),
        link('goals.html', 'Goals & tasks', 'The milestone ladder, dependency matrix and weekly work.'),
        link('contribute.html', 'Editing the data', 'How agents and humans change this content through Git.'),
        link('runbook.html', 'Master Runbook', 'Operational procedures, maintenance scripts, and troubleshooting.'))
    ));
  }
} catch (err) {
  fatal(main, err);
  console.error(err);
}

function section(kicker, title, lede, ...children) {
  return el('section', { class: 'section' },
    el('div', { class: 'wrap' },
      el('div', { class: 'section-head' },
        el('span', { class: 'kicker', text: kicker }),
        el('h2', { text: title }),
        lede ? el('p', { text: lede }) : null),
      ...children));
}

function fact(label, value) {
  return el('div', { class: 'fact' }, el('dt', { text: label }), el('dd', { text: value }));
}

function link(href, title, text) {
  return el('a', { class: 'card', href },
    el('h3', { text: title }),
    el('p', { class: 'sys-summary', text }));
}

function truncate(s, n) {
  if (!s || s.length <= n) return s;
  const cut = s.slice(0, n);
  return cut.slice(0, cut.lastIndexOf(' ')) + '…';
}
