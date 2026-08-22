import { $, el, mountChrome, renderTable } from './core.js';

mountChrome('editing');

const box = $('#schema-tables');

const SCHEMAS = [
  {
    title: 'data/systems/system-N.json — a subsystem',
    columns: ['Key', 'Type', 'Purpose'],
    rows: [
      ['`id`', 'string', 'Stable slug, e.g. `system-4`. Referenced by goals, columns and URLs'],
      ['`ordinal`', 'number', 'Display order and the number shown in "System N"'],
      ['`name`, `role`, `host`, `duty_cycle`', 'string', 'Identity line rendered in the page header'],
      ['`accent`', 'hex colour', 'Drives the accent for this system across every page'],
      ['`status`', '`{state, as_of, note}`', '`state` must exist in `registry.status_vocabulary`'],
      ['`summary`', '`{technical, plain}`', 'The two-voice one-paragraph description'],
      ['`facts[]`', '`{label, value}`', 'The fact strip under the header'],
      ['`sections[]`', 'array', 'Rendered as tabs, in order. See the next table'],
    ],
    note: 'Only `id`, `ordinal`, `name`, `status`, `summary` and `sections` are required. Everything else degrades gracefully if omitted.',
  },
  {
    title: 'A section — every key is optional except id and title',
    columns: ['Key', 'Shape', 'Renders as'],
    rows: [
      ['`id`', 'string', 'Tab anchor. Use `open` for the known-gaps tab to get the task table appended'],
      ['`title`', 'string', 'Tab label and heading'],
      ['`body`', '`{technical: [], plain: []}`', 'Paragraphs, one array per voice'],
      ['`stages[]`', '`{code, name, module, output, technical, plain}`', 'The numbered pipeline list'],
      ['`tables[]`', '`{title, columns, rows, note}`', 'A scrollable table'],
      ['`callouts[]`', '`{tone, title, technical, plain}`', 'A highlighted box. `tone` ∈ good / info / warn / bad'],
      ['`issues[]`', '`{id, severity, title, text}`', 'The known-gaps list. `severity` ∈ high / med / low'],
    ],
  },
  {
    title: 'data/architecture.json — the unified map',
    columns: ['Key', 'Shape', 'Notes'],
    rows: [
      ['`columns[]`', '`{id, title, system, subtitle}`', 'Left-to-right lanes. `system` tints the lane and links it'],
      ['`nodes[]`', '`{id, column, row, label, kind, status, detail}`', '`row` may be fractional. `detail` is two-voice'],
      ['`edges[]`', '`{id, from, to, label, kind, status}`', '`kind` ∈ data / artifact / message / order / control'],
      ['`flows[]`', '`{id, name, edges[], technical, plain}`', 'A traceable path. `edges` are edge ids, in order'],
      ['`legend`', '`{kinds[], statuses[]}`', 'Labels for the legend under the map'],
    ],
    note: '`status` ∈ `live` / `degraded` / `blocked` / `planned` on both nodes and edges. Anything other than `live` is drawn dashed — the map is incapable of showing a broken link as working.',
  },
  {
    title: 'data/goals.json — goals, milestones and tasks',
    columns: ['Key', 'Shape', 'Notes'],
    rows: [
      ['`milestones[]`', '`{id, name, state, date, summary, plain, falsifier}`', 'The ladder. `falsifier` is what would prove the rung is *not* reached'],
      ['`goals[]`', '`{id, title, kind, horizon, period, status, metric, why, plain, definition_of_done, dependencies[], blocked_by}`', '`kind` ∈ macro / system'],
      ['`goals[].metric`', '`{name, current, target, unit, note}`', 'Drives the progress meter'],
      ['`goals[].dependencies[]`', '`{system, role, need}`', '`role` ∈ owner / required / consumer / none. Generates the dependency matrix'],
      ['`tasks[]`', '`{id, system, goal, period, status, title, detail, evidence}`', 'The tracker. `goal` and `system` must resolve'],
    ],
    note: 'A task whose `goal` or `system` does not resolve is a validation error, not a rendering quirk — `node tools/validate.mjs` catches it.',
  },
  {
    title: 'data/decisions.json — architecture decision records',
    columns: ['Key', 'Shape', 'Notes'],
    rows: [
      ['`id`, `title`, `date`, `source`', 'string', '`source` points at the authoritative document in the source repo'],
      ['`status`', 'string', '`proposed` decisions are surfaced on the overview page as open questions'],
      ['`requires_approval_from[]`', 'system ids', 'Rendered as an explicit list of who still has to reply'],
      ['`problem`, `argument`, `decision`, `load_bearing_requirement`', '`{technical, plain}`', 'The body of the record'],
      ['`consequences`', '`{good: [], bad: []}`', 'Both sides. A record with no costs listed is not finished'],
      ['`transition[]`', '`{step, text}`', 'Numbered rollout steps'],
      ['`open_questions[]`', 'string[]', 'Questions the reviewers are better placed to answer'],
    ],
  },
];

SCHEMAS.forEach((s) => box.append(...renderTable(s)));

box.append(
  el('div', { class: 'callout t-good' },
    el('h4', { text: 'Validation is the contract' }),
    el('p', {
      html: 'The JSON Schemas in <code>schema/</code> are the machine-readable version of these tables, and ' +
        '<code>node tools/validate.mjs</code> enforces them plus the cross-file references. ' +
        'A GitHub Actions workflow runs it on every push, so a malformed agent commit fails visibly ' +
        'rather than producing a blank page.',
    }))
);
