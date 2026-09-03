import {
  $, el, inline, voice, getMode, onModeChange, loadAll, loadJSON,
  mountChrome, fatal, statusBadge, renderTable,
} from './core.js';

try {
  mountChrome('systems');
  const { registry, systems, bySystemId } = await loadAll();
  const goals = await loadJSON('data/goals.json');

  const params = new URLSearchParams(location.search);
  const sys = bySystemId[params.get('id')] ?? systems[0];
  document.title = `System ${sys.ordinal} — ${sys.name} · Scalable Brain`;
  document.documentElement.style.setProperty('--sys', sys.accent);

  const hasSection = (id) => sys.sections.some((s) => s.id === id);
  let activeSection = hasSection(location.hash.slice(1)) ? location.hash.slice(1) : sys.sections[0].id;

  renderHero();
  renderTabs();
  render(getMode());
  onModeChange(render);

  function renderHero() {
    const hero = $('#sys-hero');
    hero.innerHTML = '';
    hero.append(el('div', { class: 'wrap' },
      el('div', { class: 'eyebrow' },
        systems.map((s, i) => [
          i ? ' · ' : '',
          s.id === sys.id
            ? el('strong', { style: { color: s.accent }, text: `System ${s.ordinal} — ${s.name}` })
            : el('a', { href: `system.html?id=${s.id}` }, `System ${s.ordinal} — ${s.name}`),
        ])),
      el('h1', { text: `System ${sys.ordinal} — ${sys.name}` }),
      el('div', { style: { display: 'flex', gap: '10px', flexWrap: 'wrap', margin: '0 0 18px' } },
        statusBadge(sys.status.state, registry.status_vocabulary),
        el('span', { class: 'pill', text: sys.host }),
        el('span', { class: 'pill', text: sys.role }),
        el('span', { class: 'pill', text: sys.duty_cycle })),
      el('p', { class: 'lede', id: 'sys-summary' }),
      el('div', { class: 'callout t-info', style: { maxWidth: '78ch' } },
        el('h4', { text: `Status as of ${sys.status.as_of}` }),
        el('p', { html: inline(sys.status.note) })),
      el('dl', { class: 'facts', style: { marginTop: '22px' } },
        sys.facts.map((f) =>
          el('div', { class: 'fact' },
            el('dt', { text: f.label }),
            el('dd', { html: inline(f.value) }))))));
  }

  function renderTabs() {
    const tabs = $('#sys-tabs');
    tabs.innerHTML = '';
    sys.sections.forEach((s) => {
      tabs.append(el('button', {
        type: 'button', role: 'tab', 'data-section': s.id,
        onclick: () => { activeSection = s.id; history.replaceState(null, '', `#${s.id}`); render(getMode()); },
      }, s.title));
    });
    const openIssues = sys.sections.find((s) => s.id === 'open');
    if (openIssues) {
      const btn = tabs.querySelector('[data-section="open"]');
      if (btn) btn.append(el('span', { class: 'pill', style: { marginLeft: '8px' }, text: String(openIssues.issues.length) }));
    }
  }

  function render(mode) {
    $('#sys-summary').innerHTML = inline(voice(sys.summary, mode));
    $$tabs(activeSection);

    const section = sys.sections.find((s) => s.id === activeSection) ?? sys.sections[0];
    const body = $('#sys-body');
    body.innerHTML = '';
    body.style.setProperty('--sys', sys.accent);

    /* If the section is undocumented (no content of any kind), render a placeholder */
    const hasContent = section.body || section.stages || section.tables?.length ||
      section.callouts?.length || section.issues;

    if (!hasContent) {
      body.append(el('div', { class: 'section-undocumented' },
        `${section.title} — not yet documented. This section exists in the data schema but has no content recorded. ` +
        'See CONVENTIONS.md for how to fill it.'));
      return;
    }

    if (section.body) {
      const paras = section.body[mode === 'plain' ? 'plain' : 'technical'] ?? section.body.technical ?? [];
      body.append(el('div', { class: `prose ${mode}` }, paras.map((p) => el('p', { html: inline(p) }))));
    }

    (section.callouts ?? []).forEach((c) =>
      body.append(el('div', { class: `callout t-${c.tone}` },
        el('h4', { text: c.title }),
        el('p', { html: inline(voice(c, mode)) }))));

    if (section.stages) {
      body.append(el('ol', { class: 'stages' },
        section.stages.map((st) =>
          el('li', { class: 'stage' },
            el('div', { class: 'stage-code', text: st.code }),
            el('div', {},
              el('div', { class: 'stage-name', text: st.name }),
              el('div', { class: 'stage-meta', html: inline(`${st.module} → ${st.output}`) }),
              el('div', { class: 'stage-body', html: inline(voice(st, mode)) }))))));
    }

    (section.tables ?? []).forEach((t) => body.append(...renderTable(t)));

    if (section.issues) {
      const order = { high: 0, med: 1, low: 2 };
      const sorted = [...section.issues].sort((a, b) => order[a.severity] - order[b.severity]);
      body.append(el('ul', { class: 'issues' },
        sorted.map((i) =>
          el('li', { class: `issue sev-${i.severity}` },
            el('div', { class: 'issue-head' },
              el('span', { class: 'goal-id', text: i.id }),
              el('strong', { text: i.title }),
              el('span', { class: `badge tone-${i.severity === 'high' ? 'bad' : i.severity === 'med' ? 'warn' : 'muted'}` }, i.severity)),
            el('p', { html: inline(i.text) })))));

      const mine = goals.tasks.filter((t) => t.system === sys.id && t.status !== 'done');
      if (mine.length) {
        body.append(
          el('h3', { style: { marginTop: '34px' } }, 'Open tasks for this system'),
          ...renderTable({
            columns: ['Task', 'Title', 'Goal', 'Period', 'Status'],
            rows: mine.map((t) => [`\`${t.id}\``, t.title, `\`${t.goal}\``, t.period,
              goals.status_vocabulary[t.status]?.label ?? t.status]),
            note: 'Full tracker with filters on the [goals page](goals.html).',
          }));
      }
    }
  }

  function $$tabs(active) {
    document.querySelectorAll('#sys-tabs button').forEach((b) =>
      b.setAttribute('aria-selected', String(b.dataset.section === active)));
  }
} catch (err) {
  fatal($('#main'), err);
  console.error(err);
}
