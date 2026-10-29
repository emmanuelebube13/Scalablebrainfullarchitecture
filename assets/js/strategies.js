import {
  $, $$, el, inline, loadJSON, mountChrome,
} from './core.js';

mountChrome('strategies');

const container = $('#strategies-container');
const searchInput = $('#strat-search');
const filteredCount = $('#filtered-count');
const btnToggleAll = $('#btn-toggle-all');
const familyFiltersBox = $('#family-filters');
const granFiltersBox = $('#granularity-filters');

let STRATEGIES = [];
let activeFamily = 'all';
let activeGran = 'all';
let qualifiedOnly = false;
let allExpanded = false;

try {
  const data = await loadJSON('data/strategies.json');
  STRATEGIES = data.strategies || [];

  // Update tallies
  $('#tally-total').textContent = STRATEGIES.length;
  $('#tally-qualified').textContent = STRATEGIES.filter((s) => s.qualified).length;

  // Build Family Filter Chips
  const families = ['all', ...data.families];
  familyFiltersBox.innerHTML = '';
  families.forEach((fam) => {
    const btn = el('button', {
      class: `chip-btn ${fam === 'all' ? 'active' : ''}`,
      text: fam === 'all' ? 'All Families' : fam.replace(/-/g, ' ').toUpperCase(),
      onclick: () => {
        $$('#family-filters .chip-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        activeFamily = fam;
        render();
      },
    });
    familyFiltersBox.append(btn);
  });

  // Granularity chips
  $$('#granularity-filters [data-gran]').forEach((btn) => {
    btn.addEventListener('click', () => {
      $$('#granularity-filters [data-gran]').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      activeGran = btn.dataset.gran;
      render();
    });
  });

  // Qualified only toggle
  const qualBtn = $('#filter-qualified-only');
  qualBtn.addEventListener('click', () => {
    qualifiedOnly = !qualifiedOnly;
    qualBtn.classList.toggle('active', qualifiedOnly);
    render();
  });

  // Search input
  searchInput.addEventListener('input', () => {
    render();
  });

  // Toggle all cards
  btnToggleAll.addEventListener('click', () => {
    allExpanded = !allExpanded;
    btnToggleAll.textContent = allExpanded ? 'Collapse All Details' : 'Expand All Details';
    $$('.strat-details-pane').forEach((pane) => {
      pane.style.display = allExpanded ? 'block' : 'none';
    });
  });

  render();
} catch (err) {
  container.innerHTML = `<div class="error-box"><h3>Failed to load strategies</h3><p>${err.message}</p></div>`;
}

function render() {
  const q = searchInput.value.toLowerCase().trim();

  const filtered = STRATEGIES.filter((s) => {
    // 1. Family filter
    if (activeFamily !== 'all' && s.family !== activeFamily) return false;

    // 2. Granularity filter
    if (activeGran !== 'all' && !(s.granularities || []).includes(activeGran)) return false;

    // 3. Qualified only
    if (qualifiedOnly && !s.qualified) return false;

    // 4. Text search
    if (q) {
      const matchText = [
        s.id,
        s.name,
        s.family,
        s.description,
        ...(s.granularities || []),
        ...(s.indicators || []),
        ...(s.entries || []),
        ...(s.exits || []),
      ].join(' ').toLowerCase();
      if (!matchText.includes(q)) return false;
    }

    return true;
  });

  filteredCount.textContent = `Showing ${filtered.length} of ${STRATEGIES.length} strategies`;
  container.innerHTML = '';

  if (filtered.length === 0) {
    container.innerHTML = '<div style="grid-column:1/-1; padding:40px; text-align:center; color:var(--text-faint); font-family:var(--mono);">No strategies match your filter criteria.</div>';
    return;
  }

  filtered.forEach((s) => {
    container.append(renderStrategyCard(s));
  });
}

function renderStrategyCard(s) {
  const card = el('div', { class: `strat-card ${s.qualified ? 'is-qualified' : ''}` });

  // Header row
  const header = el('div', { style: 'display:flex; justify-content:space-between; align-items:flex-start; gap:8px;' },
    el('div', {},
      el('div', { style: 'display:flex; align-items:center; gap:6px; flex-wrap:wrap;' },
        el('span', {
          style: 'font-family:var(--mono); font-size:0.75rem; color:var(--text-faint); font-weight:600;',
          text: `#${s.id}`,
        }),
        el('h3', { style: 'margin:0; font-size:1.05rem; font-family:var(--sans); font-weight:700;', text: s.name }),
        s.family && el('span', {
          style: 'font-family:var(--mono); font-size:0.65rem; text-transform:uppercase; background:var(--bg-sunken); border:1px solid var(--border); padding:1px 6px; border-radius:3px; color:var(--text-dim);',
          text: s.family,
        }),
      ),
      el('div', { style: 'display:flex; gap:4px; margin-top:4px;' },
        (s.granularities || []).map((g) => el('span', {
          style: 'font-family:var(--mono); font-size:0.68rem; font-weight:600; color:var(--brass);',
          text: `@${g}`,
        })),
      )
    ),
    el('div', {},
      s.qualified
        ? el('span', { class: 'badge-qualified', text: 'QUALIFIED' })
        : el('span', { class: 'badge-disqualified', text: 'DISQUALIFIED' })
    )
  );

  // Body
  const body = el('p', { class: 'strat-body', html: inline(s.description || 'No description provided.') });

  // Indicators tags
  const tags = el('div', { class: 'strat-tags' },
    (s.indicators || []).map((ind) => el('span', { class: 'tag-indicator', text: ind })),
    s.moves_to_breakeven ? el('span', { class: 'tag-indicator', style: 'color:var(--good);', text: 'BE Trail' }) : null,
  );

  // Details pane (collapsible)
  const detailsPane = el('div', {
    class: 'strat-details-pane',
    style: `display:${allExpanded ? 'block' : 'none'};`,
  });

  // Entry & Exit info
  detailsPane.append(
    el('div', { style: 'display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:10px; font-size:0.8rem;' },
      el('div', {},
        el('span', { style: 'color:var(--text-faint); font-family:var(--mono); display:block; font-size:0.68rem; text-transform:uppercase;', text: 'Entry Mechanics' }),
        el('span', { style: 'font-weight:600;', text: (s.entries || []).join(', ') || 'Market Order' })
      ),
      el('div', {},
        el('span', { style: 'color:var(--text-faint); font-family:var(--mono); display:block; font-size:0.68rem; text-transform:uppercase;', text: 'Exit Mechanics' }),
        el('span', { style: 'font-weight:600;', text: (s.exits || []).join(', ') || 'Fixed Target / SL' })
      )
    )
  );

  // Gates Passed Table
  const gates = s.gates_passed || {};
  const gateKeys = Object.keys(gates);
  if (gateKeys.length > 0) {
    const table = el('table', { class: 'details-table' },
      el('thead', {},
        el('tr', {},
          el('th', { text: 'Cell / Regime' }),
          el('th', { text: 'Win Rate' }),
          el('th', { text: 'Profit Factor' }),
          el('th', { text: 'Max DD' }),
          el('th', { text: 'Trades' }),
        )
      ),
      el('tbody', {},
        gateKeys.map((k) => {
          const row = gates[k];
          const regimeName = k.split('@').slice(-1)[0];
          return el('tr', {},
            el('td', { style: 'font-weight:600; color:var(--text);', text: regimeName }),
            el('td', { text: row.win_rate != null ? `${(row.win_rate * 100).toFixed(1)}%` : '—' }),
            el('td', { text: row.profit_factor != null ? row.profit_factor.toFixed(2) : '—', style: row.profit_factor >= 1.0 ? 'color:var(--good);' : 'color:var(--bad);' }),
            el('td', { text: row.max_drawdown != null ? `${(row.max_drawdown * 100).toFixed(1)}%` : '—' }),
            el('td', { text: row.trade_count != null ? row.trade_count : '—' }),
          );
        })
      )
    );
    detailsPane.append(table);
  } else if (s.why_it_failed) {
    detailsPane.append(
      el('div', {
        style: 'background:var(--bg-sunken); padding:8px 12px; border-radius:4px; font-size:0.8rem; color:var(--text-dim); margin-top:6px; border-left:3px solid var(--warn);',
        html: `<strong>Disqualification note:</strong> ${inline(s.why_it_failed)}`
      })
    );
  }

  // Toggle button at footer
  const toggleBtn = el('button', {
    class: 'chip-btn',
    style: 'align-self:flex-start; margin-top:12px; font-size:0.7rem;',
    text: allExpanded ? 'Hide Mechanics ▴' : 'View Mechanics & OOS ▾',
    onclick: () => {
      const isVisible = detailsPane.style.display !== 'none';
      detailsPane.style.display = isVisible ? 'none' : 'block';
      toggleBtn.textContent = isVisible ? 'View Mechanics & OOS ▾' : 'Hide Mechanics ▴';
    },
  });

  card.append(header, body, tags, detailsPane, toggleBtn);
  return card;
}
