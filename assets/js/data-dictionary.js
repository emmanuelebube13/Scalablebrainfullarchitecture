import {
  $, $$, el, inline, loadJSON, mountChrome,
} from './core.js';

mountChrome('dictionary');

const storeTabs = $$('#store-tabs .store-tab-btn');
const tableNavList = $('#table-nav-list');
const tablesContainer = $('#tables-container');
const columnSearch = $('#column-search');
const summaryCount = $('#table-summary-count');

let DICT_DATA = null;
let activeStoreKey = 'system3_ams';
let activeTable = null;

try {
  DICT_DATA = await loadJSON('data/data-dictionary.json');

  storeTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      storeTabs.forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      activeStoreKey = tab.dataset.store;
      activeTable = null;
      render();
    });
  });

  columnSearch.addEventListener('input', () => {
    render();
  });

  render();
} catch (err) {
  tablesContainer.innerHTML = `<div class="error-box"><h3>Failed to load Data Dictionary</h3><p>${err.message}</p></div>`;
}

function render() {
  if (!DICT_DATA) return;
  const store = DICT_DATA.stores[activeStoreKey];
  if (!store) return;

  const q = columnSearch.value.toLowerCase().trim();
  const tables = store.tables || store.payloads || [];

  // Filter tables by search query
  const filtered = tables.filter((t) => {
    if (!q) return true;
    if (t.name.toLowerCase().includes(q)) return true;
    if (t.description && t.description.toLowerCase().includes(q)) return true;
    if (t.columns) {
      return t.columns.some((c) => c.name.toLowerCase().includes(q) || (c.description && c.description.toLowerCase().includes(q)));
    }
    if (t.keys) {
      return t.keys.some((k) => k.toLowerCase().includes(q));
    }
    return false;
  });

  summaryCount.textContent = `${filtered.length} table(s) found in ${store.title}`;

  // Render Table Nav List
  tableNavList.innerHTML = '';
  filtered.forEach((t) => {
    const item = el('div', {
      class: `table-nav-item ${activeTable === t.name ? 'active' : ''}`,
      onclick: () => {
        activeTable = t.name;
        $$('.table-nav-item').forEach((i) => i.classList.remove('active'));
        item.classList.add('active');
        const targetCard = $(`#table-${t.name}`);
        if (targetCard) targetCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
      },
    },
      el('span', { text: t.name }),
      t.rows != null ? el('span', { style: 'font-size:0.68rem; opacity:0.6;', text: `${t.rows}` }) : null,
    );
    tableNavList.append(item);
  });

  // Render Table Cards
  tablesContainer.innerHTML = '';
  if (filtered.length === 0) {
    tablesContainer.innerHTML = '<div style="padding:40px; text-align:center; color:var(--text-faint); font-family:var(--mono);">No tables or columns match your search query.</div>';
    return;
  }

  filtered.forEach((t) => {
    const card = el('div', { class: 'dict-table-card', id: `table-${t.name}` });

    const header = el('div', { class: 'dict-table-header' },
      el('div', {},
        el('h2', { style: 'margin:0; font-family:var(--mono); font-size:1.3rem; font-weight:700;', text: t.name }),
        el('div', { style: 'font-size:0.85rem; color:var(--text-dim); margin-top:4px;', text: t.description || t.category || store.description }),
      ),
      el('div', { style: 'display:flex; gap:8px; font-family:var(--mono); font-size:0.75rem;' },
        t.rows != null ? el('span', { class: 'type-tag', text: `${t.rows} rows in prod` }) : null,
        t.cadence ? el('span', { class: 'type-tag', text: t.cadence }) : null,
      )
    );

    card.append(header);

    if (t.columns) {
      const table = el('table', { class: 'schema-table' },
        el('thead', {},
          el('tr', {},
            el('th', { text: 'Column' }),
            el('th', { text: 'Type' }),
            el('th', { text: 'Nullable' }),
            el('th', { text: 'Key / Default' }),
            el('th', { text: 'Description' }),
          )
        ),
        el('tbody', {},
          t.columns.map((c) => {
            const isMatch = q && (c.name.toLowerCase().includes(q) || (c.description && c.description.toLowerCase().includes(q)));
            return el('tr', { style: isMatch ? 'background:rgba(232, 168, 48, 0.08);' : '' },
              el('td', { style: 'font-family:var(--mono); font-weight:700; color:var(--text);' },
                c.name,
                c.pk ? el('span', { class: 'pk-badge', text: 'PK' }) : null,
              ),
              el('td', {}, el('span', { class: 'type-tag', text: c.type })),
              el('td', { style: 'font-family:var(--mono); font-size:0.75rem; color:var(--text-dim);', text: c.nullable ? 'NULL' : 'NOT NULL' }),
              el('td', { style: 'font-family:var(--mono); font-size:0.75rem; color:var(--text-dim);', text: c.default || (c.pk ? 'PRIMARY' : '—') }),
              el('td', { style: 'color:var(--text-dim); font-size:0.82rem;', text: c.description || (c.name === 'signal_id' ? 'Originating S1 signal UUID' : c.name === 'broker_trade_id' ? 'OANDA broker trade ID' : '—') }),
            );
          })
        )
      );
      card.append(table);
    } else if (t.keys) {
      // Artifact Keys
      const keysBox = el('div', { style: 'margin-top:14px; background:var(--bg-sunken); padding:14px; border-radius:var(--radius-sm); border:1px solid var(--border);' },
        el('div', { style: 'font-family:var(--mono); font-size:0.74rem; font-weight:700; text-transform:uppercase; color:var(--text-faint); margin-bottom:8px;', text: 'Top-Level JSON Payload Keys' }),
        el('div', { style: 'display:flex; flex-wrap:wrap; gap:6px;' },
          t.keys.map((k) => el('span', { class: 'type-tag', text: k }))
        )
      );
      card.append(keysBox);
    }

    tablesContainer.append(card);
  });
}
