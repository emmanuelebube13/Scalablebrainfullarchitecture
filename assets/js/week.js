/* ============================================================
   week.js — the weekly plan: a goal, a plan and tasks per day.

   The plan lives in data/week-plans/<week>.json like every other
   piece of content. Ticking a task writes that file back through
   the GitHub contents API, so a tick is a commit: it shows on
   every device and to every agent reading the repo. The token for
   that write is a fine-grained one the owner pastes in once; it
   stays in this browser's localStorage and goes nowhere but
   api.github.com.
   ============================================================ */

import { mountChrome, fatal, loadJSON, $, el, inline } from './core.js';

const REPO = 'emmanuelebube13/Scalablebrainfullarchitecture';
const BRANCH = 'main';
const TOKEN_KEY = 'sb.ghToken';

const SYSTEM_TAGS = {
  // System identity colours from the design tokens (DESIGN-SYSTEM.md §3.3), so they follow the theme.
  'system-1': { label: 'S1 Brain',    color: 'var(--s1)' },
  'system-2': { label: 'S2 Hand',     color: 'var(--s2)' },
  'system-3': { label: 'S3 Guardian', color: 'var(--s3)' },
  ops:        { label: 'Ops',         color: 'var(--text-dim)' },
};
const STATUS_LABEL = { blocked: 'Blocked', moved: 'Moved' };

const root = $('#content');
let plan = null;
let planFile = null;
let busy = false;

/* ---------- token ---------- */

function getToken() {
  try { return localStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; }
}
function setToken(t) {
  try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch { /* storage blocked */ }
}

/* ---------- GitHub contents API ---------- */

function decodeBase64Utf8(b64) {
  const bin = atob(b64.replace(/\n/g, ''));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}
function encodeUtf8Base64(text) {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

async function gh(method, path, body) {
  const r = await fetch(`https://api.github.com/repos/${REPO}/contents/${path}${method === 'GET' ? `?ref=${BRANCH}` : ''}`, {
    method,
    cache: 'no-store',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${getToken()}`,
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) {
    const e = new Error(`GitHub ${r.status}`);
    e.status = r.status;
    throw e;
  }
  return r.json();
}

async function readRemote() {
  const f = await gh('GET', planFile);
  return { sha: f.sha, data: JSON.parse(decodeBase64Utf8(f.content)) };
}

/* Read-modify-write against the latest commit. The sha makes a collision with
   another writer (an agent, another device) an error rather than an overwrite;
   on that error the change is re-applied to the fresh copy once. */
async function saveTask(taskId, done) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const { sha, data } = await readRemote();
    const task = data.days.flatMap((d) => d.tasks).find((t) => t.id === taskId);
    if (!task) throw new Error(`task ${taskId} is not in the file any more`);
    if (done) {
      task.status = 'done';
      task.done_at = new Date().toISOString().slice(0, 10);
    } else {
      task.status = 'todo';
      delete task.done_at;
    }
    try {
      await gh('PUT', planFile, {
        message: `week ${data.week}: ${done ? 'done' : 'reopen'} ${taskId}`,
        content: encodeUtf8Base64(JSON.stringify(data, null, 2) + '\n'),
        sha,
        branch: BRANCH,
      });
      return data;
    } catch (e) {
      if (e.status !== 409 && e.status !== 422) throw e;
    }
  }
  throw new Error('the file kept changing underneath — reload and try again');
}

/* ---------- toast ---------- */

let toastTimer = null;
function toast(msg, tone = 'info') {
  const t = $('#week-toast');
  t.textContent = msg;
  t.className = `week-toast show tone-${tone}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.className = 'week-toast'; }, 4200);
}

/* ---------- dates ---------- */

const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const fmtDay = (iso, opts) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', { timeZone: 'UTC', ...opts });

/* ---------- render ---------- */

function progress(tasks) {
  const done = tasks.filter((t) => t.status === 'done').length;
  return { done, total: tasks.length, pct: tasks.length ? Math.round((100 * done) / tasks.length) : 0 };
}

function bar(p) {
  return el('div', { class: 'wk-bar', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(p.total), 'aria-valuenow': String(p.done) },
    el('span', { style: { width: `${p.pct}%` } }));
}

function taskRow(t) {
  const sys = SYSTEM_TAGS[t.system];
  const done = t.status === 'done';
  const box = el('input', {
    type: 'checkbox',
    id: `cb-${t.id}`,
    checked: done ? 'checked' : null,
    onchange: (e) => onTick(t, e.target),
  });
  return el('li', { class: `wk-task is-${t.status}` },
    box,
    el('label', { for: `cb-${t.id}` },
      el('span', { class: 'wk-task-title', html: inline(t.title) }),
      el('span', { class: 'wk-task-meta' },
        el('code', { text: t.id }),
        sys ? el('span', { class: 'wk-sys', style: { '--sys': sys.color }, text: sys.label }) : null,
        STATUS_LABEL[t.status] ? el('span', { class: `pill tone-${t.status === 'blocked' ? 'bad' : 'warn'}`, text: STATUS_LABEL[t.status] }) : null,
        done && t.done_at ? el('span', { class: 'wk-done-at', text: `done ${fmtDay(t.done_at, { day: 'numeric', month: 'short' })}` }) : null),
      t.note ? el('span', { class: 'wk-task-note', html: inline(t.note) }) : null));
}

function dayCard(d) {
  const today = todayISO();
  const p = progress(d.tasks);
  const isToday = d.date === today;
  const isPast = d.date < today;
  const open = p.total - p.done;
  return el('section', { class: `wk-day${isToday ? ' is-today' : ''}${isPast ? ' is-past' : ''}`, id: `day-${d.date}` },
    el('header', { class: 'wk-day-head' },
      el('div', {},
        el('span', { class: 'kicker', text: `${fmtDay(d.date, { weekday: 'long' })} · ${fmtDay(d.date, { day: 'numeric', month: 'short' })}${isToday ? ' · today' : ''}` }),
        el('h2', { text: d.theme })),
      el('div', { class: 'wk-day-count' },
        el('strong', { text: `${p.done}/${p.total}` }),
        isPast && open ? el('span', { class: 'pill tone-warn', text: `${open} open` }) : null)),
    bar(p),
    el('dl', { class: 'wk-gp' },
      el('div', {}, el('dt', { text: 'Goal' }), el('dd', { html: inline(d.goal) })),
      el('div', {}, el('dt', { text: 'Plan' }), el('dd', { html: inline(d.plan) }))),
    el('h3', { class: 'wk-tasks-h', text: 'Tasks' }),
    el('ul', { class: 'wk-tasks' }, d.tasks.map(taskRow)),
    d.review ? el('p', { class: 'wk-review', html: inline(`**Review:** ${d.review}`) }) : null);
}

function connectPanel() {
  const connected = !!getToken();
  const input = el('input', { type: 'password', placeholder: 'github_pat_…', autocomplete: 'off', 'aria-label': 'GitHub token' });
  return el('details', { class: 'wk-connect', open: connected ? null : 'open' },
    el('summary', {},
      el('span', { class: `badge tone-${connected ? 'good' : 'muted'}`, text: connected ? 'Ticks save to GitHub' : 'Not connected — ticks cannot save' })),
    connected
      ? el('div', { class: 'wk-connect-body' },
          el('p', { html: inline('Each tick is a commit to `' + planFile + '`. The token lives only in this browser.') }),
          el('button', { class: 'wk-btn ghost', type: 'button', onclick: () => { setToken(''); render(); toast('Disconnected from GitHub'); } }, 'Disconnect this browser'))
      : el('div', { class: 'wk-connect-body' },
          el('p', { html: inline('Ticking a task commits it to the repo, so it shows on every device. Once per browser: create a **fine-grained token** at [github.com/settings/personal-access-tokens/new](https://github.com/settings/personal-access-tokens/new) — *Only select repositories* → `Scalablebrainfullarchitecture`, *Repository permissions* → **Contents: Read and write**. Paste it here. It is stored in this browser only and sent only to api.github.com.') }),
          el('form', {
            class: 'wk-connect-form',
            onsubmit: async (e) => {
              e.preventDefault();
              const t = input.value.trim();
              if (!t) return;
              setToken(t);
              try {
                const fresh = await readRemote();
                plan = fresh.data;
                render();
                toast('Connected — ticks now save to GitHub', 'good');
              } catch (err) {
                setToken('');
                toast(`That token did not work (${err.message}). Check it has Contents read/write on this repo.`, 'bad');
              }
            },
          }, input, el('button', { class: 'wk-btn', type: 'submit' }, 'Connect'))));
}

async function onTick(t, box) {
  const want = box.checked;
  if (!getToken()) {
    box.checked = !want;
    const panel = $('.wk-connect');
    if (panel) { panel.open = true; panel.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
    toast('Connect GitHub first so the tick is saved', 'warn');
    return;
  }
  if (busy) { box.checked = !want; toast('Still saving the last tick…', 'warn'); return; }
  busy = true;
  box.disabled = true;
  toast(want ? `Saving ${t.id} as done…` : `Reopening ${t.id}…`);
  try {
    plan = await saveTask(t.id, want);
    render();
    toast(want ? `${t.id} marked done` : `${t.id} reopened`, 'good');
  } catch (e) {
    box.checked = !want;
    box.disabled = false;
    toast(`Not saved: ${e.message}`, 'bad');
  } finally {
    busy = false;
  }
}

function render() {
  const allTasks = plan.days.flatMap((d) => d.tasks);
  const p = progress(allTasks);
  const today = todayISO();
  root.replaceChildren(
    el('div', { class: 'wk-hero' },
      el('span', { class: 'kicker', text: `${plan.week}${plan.task_folder ? ` · ${plan.task_folder}` : ''} · ${fmtDay(plan.start, { weekday: 'short', day: 'numeric', month: 'short' })} – ${fmtDay(plan.end, { weekday: 'short', day: 'numeric', month: 'short' })} ${plan.end.slice(0, 4)}` }),
      el('h1', { text: 'This week' }),
      el('p', { class: 'wk-goal', html: inline(plan.goal) }),
      el('div', { class: 'wk-total' },
        el('strong', { text: `${p.done} of ${p.total} tasks done` }),
        el('span', { text: `${p.pct}%` })),
      bar(p),
      el('nav', { class: 'wk-jump', 'aria-label': 'Days' },
        plan.days.map((d) => {
          const dp = progress(d.tasks);
          return el('a', { href: `#day-${d.date}`, class: d.date === today ? 'is-today' : '' },
            el('span', { text: fmtDay(d.date, { weekday: 'short' }) }),
            el('small', { text: `${dp.done}/${dp.total}` }));
        })),
      connectPanel()),

    plan.fixed_dates?.length || plan.context?.length
      ? el('div', { class: 'wk-side grid grid-2' },
          plan.fixed_dates?.length
            ? el('div', { class: 'card' },
                el('h3', { text: 'Fixed dates' }),
                el('ul', { class: 'wk-list' }, plan.fixed_dates.map((f) =>
                  el('li', {}, el('code', { text: fmtDay(f.date, { weekday: 'short', day: 'numeric' }) }), ' ', el('span', { html: inline(f.text) })))))
            : null,
          plan.context?.length
            ? el('div', { class: 'card' },
                el('h3', { text: 'Where we stand' }),
                el('ul', { class: 'wk-list' }, plan.context.map((c) => el('li', { html: inline(c) }))))
            : null)
      : null,

    el('div', { class: 'wk-days' }, plan.days.map(dayCard)),

    plan.decisions?.length
      ? el('section', { class: 'wk-block' },
          el('h2', { text: 'Owner decisions this week' }),
          el('div', { class: 'grid grid-2' }, plan.decisions.map((d) =>
            el('div', { class: 'card wk-decision' },
              el('div', { class: 'wk-decision-head' },
                el('code', { text: d.id }),
                el('span', { class: `badge tone-${d.status === 'decided' ? 'good' : 'warn'}`, text: d.status === 'decided' ? 'Decided' : 'Open' })),
              el('p', { html: inline(d.question) }),
              d.options ? el('p', { class: 'wk-dim', html: inline(d.options) }) : null,
              d.recommendation ? el('p', { class: 'wk-dim', html: inline(`**Recommendation:** ${d.recommendation}`) }) : null,
              d.answer ? el('p', { html: inline(`**Answer:** ${d.answer}`) }) : null))))
      : null,

    plan.path_to_december?.length
      ? el('section', { class: 'wk-block' },
          el('h2', { text: 'Path to December' }),
          el('ol', { class: 'wk-path' }, plan.path_to_december.map((w) =>
            el('li', { class: w.week === plan.week ? 'is-current' : '' },
              el('code', { text: w.week }), el('span', { html: inline(w.target) })))))
      : null,

    el('p', { class: 'wk-dim wk-source', html: inline(`Source: \`${planFile}\`. Edit the file to change the plan; tick here to mark work done.`) }));

  /* Jump to today on first paint, unless the URL already names a day. */
  if (!render.scrolled && !location.hash) {
    render.scrolled = true;
    document.getElementById(`day-${today}`)?.scrollIntoView({ block: 'start' });
  }
}

async function init() {
  mountChrome('week');
  try {
    const index = await loadJSON('data/week-plans/index.json');
    const weeks = index.weeks ?? [];
    if (!weeks.length) throw new Error('data/week-plans/index.json lists no weeks');
    const wanted = new URLSearchParams(location.search).get('w');
    const today = todayISO();
    const entry = weeks.find((w) => w.week === wanted)
      ?? weeks.find((w) => w.start <= today && today <= w.end)
      ?? [...weeks].sort((a, b) => b.start.localeCompare(a.start))[0];
    planFile = entry.file;

    /* With a token, read straight from the repo: Pages redeploys lag a commit
       by a minute or so, and a tick must not appear to un-tick on reload. */
    plan = null;
    if (getToken()) {
      try { plan = (await readRemote()).data; } catch { /* fall back to the published copy */ }
    }
    plan ??= await loadJSON(planFile);
    render();
  } catch (e) {
    fatal(root, e);
  }
}

init();
