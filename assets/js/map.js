/* ============================================================
   map.js — the unified architecture map.

   Renders data/architecture.json as an interactive SVG. There is no
   layout engine and no charting library: every node declares a column
   and a row, and this file turns that into coordinates. Adding a node
   (or a whole System 4) therefore needs no pixel arithmetic.
   ============================================================ */

import { $, el, inline, voice, getMode, onModeChange } from './core.js';

const SVGNS = 'http://www.w3.org/2000/svg';
const svgEl = (tag, attrs = {}) => {
  const n = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined) continue;
    n.setAttribute(k, v);
  }
  return n;
};

const HEADER_H = 54;

export function renderMap(arch, container, sideContainer) {
  const L = arch.layout;
  const colIndex = Object.fromEntries(arch.columns.map((c, i) => [c.id, i]));
  const colById = Object.fromEntries(arch.columns.map((c) => [c.id, c]));
  const nodeById = Object.fromEntries(arch.nodes.map((n) => [n.id, n]));

  /* ---- geometry ---- */
  const maxRow = Math.max(...arch.nodes.map((n) => n.row));
  const contentW = arch.columns.length * L.column_width;
  const contentH = HEADER_H + (maxRow + 1) * L.row_height;
  const W = contentW + L.padding * 2;
  const H = contentH + L.padding * 2;

  const pos = (n) => ({
    cx: L.padding + colIndex[n.column] * L.column_width + L.column_width / 2,
    cy: L.padding + HEADER_H + n.row * L.row_height + L.node_height / 2,
  });

  /* ---- svg scaffold ---- */
  const svg = svgEl('svg', { id: 'map-svg', role: 'img', 'aria-label': 'Unified system architecture map' });
  svg.append(defs());
  const viewport = svgEl('g', { id: 'map-viewport-g' });
  const gBands = svgEl('g', { class: 'bands' });
  const gEdges = svgEl('g', { class: 'edges' });
  const gNodes = svgEl('g', { class: 'nodes' });
  viewport.append(gBands, gEdges, gNodes);
  svg.append(viewport);

  /* ---- column bands + headings ---- */
  arch.columns.forEach((col, i) => {
    const x = L.padding + i * L.column_width;
    if (col.system) {
      gBands.append(svgEl('rect', {
        class: 'col-band', x: x + 6, y: L.padding - 6,
        width: L.column_width - 12, height: contentH + 12, rx: 12,
      }));
    }
    const label = svgEl('text', { class: 'col-label', x: x + L.column_width / 2, y: L.padding + 14, 'text-anchor': 'middle' });
    label.textContent = col.title;
    if (col.system) label.setAttribute('fill', `var(--${col.system.replace('system-', 's')})`);
    gBands.append(label);
    if (col.subtitle) {
      const sub = svgEl('text', { class: 'col-sub', x: x + L.column_width / 2, y: L.padding + 29, 'text-anchor': 'middle' });
      sub.textContent = col.subtitle;
      gBands.append(sub);
    }
  });

  /* ---- edges ---- */
  // Long edges inside one column are routed through that column's right gutter.
  // Each gets its own lane so several of them do not trace the same curve.
  const laneCounter = {};
  arch.edges.forEach((e) => {
    const a = nodeById[e.from], b = nodeById[e.to];
    if (!a || !b || a.column !== b.column) return;
    if (Math.abs(b.row - a.row) <= 1.4) return;
    laneCounter[a.column] = laneCounter[a.column] ?? 0;
    e._lane = laneCounter[a.column]++;
  });

  const edgeEls = new Map();
  arch.edges.forEach((e) => {
    const a = nodeById[e.from], b = nodeById[e.to];
    if (!a || !b) {
      console.warn(`edge ${e.id} references a missing node`, e);
      return;
    }
    const g = svgEl('g', { class: `edge k-${e.kind} st-${e.status}`, 'data-edge': e.id });
    const path = svgEl('path', { d: edgePath(pos(a), pos(b), colIndex[a.column], colIndex[b.column], L, e._lane ?? 0), 'marker-end': `url(#arw-${markerKey(e)})` });
    g.append(path);
    const lab = svgEl('text', { class: 'edge-label', 'text-anchor': 'middle' });
    lab.textContent = e.label || '';
    g.append(lab);
    gEdges.append(g);
    // Label placement needs a laid-out path, so measure after insertion.
    const len = path.getTotalLength();
    const pt = path.getPointAtLength(len * 0.5);
    lab.setAttribute('x', pt.x);
    lab.setAttribute('y', pt.y - 5);
    edgeEls.set(e.id, { g, spec: e });
  });

  /* ---- nodes ---- */
  const nodeEls = new Map();
  arch.nodes.forEach((n) => {
    const { cx, cy } = pos(n);
    const w = L.node_width, h = L.node_height;
    const col = colById[n.column];
    const accent = col.system ? `var(--${col.system.replace('system-', 's')})` : 'var(--muted)';

    const g = svgEl('g', { class: `node st-${n.status} k-${n.kind}`, 'data-node': n.id, tabindex: '0', role: 'button' });
    g.append(svgEl('rect', { class: 'node-box', x: cx - w / 2, y: cy - h / 2, width: w, height: h }));
    g.append(svgEl('rect', { class: 'node-accent', x: cx - w / 2, y: cy - h / 2 + 8, width: 3, height: h - 16, fill: accent }));

    const lines = wrap(n.label, 26);
    const t = svgEl('text', { class: 'node-label', x: cx - w / 2 + 14, y: cy + (lines.length > 1 ? -3 : 4) });
    lines.forEach((line, i) => {
      const ts = svgEl('tspan', { x: cx - w / 2 + 14, dy: i === 0 ? 0 : 13 });
      ts.textContent = line;
      t.append(ts);
    });
    g.append(t);

    if (n.status !== 'live') {
      const k = svgEl('text', { class: 'node-kind', x: cx + w / 2 - 12, y: cy - h / 2 + 14, 'text-anchor': 'end' });
      k.textContent = n.status;
      k.setAttribute('fill', n.status === 'blocked' ? 'var(--bad)' : n.status === 'degraded' ? 'var(--warn)' : 'var(--text-faint)');
      g.append(k);
    }

    const title = svgEl('title');
    title.textContent = `${n.label} — click for detail`;
    g.append(title);

    gNodes.append(g);
    nodeEls.set(n.id, g);

    const select = () => selectNode(n.id);
    g.addEventListener('click', select);
    g.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); select(); } });
    g.addEventListener('mouseenter', () => { if (!activeFlow) highlightNode(n.id); });
    g.addEventListener('mouseleave', () => { if (!activeFlow && !selectedId) clearHighlight(); else if (!activeFlow && selectedId) highlightNode(selectedId); });
  });

  container.append(svg);

  /* ---- highlighting ---- */
  let selectedId = null;
  let activeFlow = null;

  const allEdges = () => Array.from(edgeEls.values()).map((x) => x.g);
  const allNodes = () => Array.from(nodeEls.values());

  function clearHighlight() {
    allEdges().forEach((g) => g.classList.remove('dim', 'hot'));
    allNodes().forEach((g) => g.classList.remove('dim'));
  }

  function highlightNode(id) {
    const incident = arch.edges.filter((e) => e.from === id || e.to === id);
    const keep = new Set([id, ...incident.flatMap((e) => [e.from, e.to])]);
    const keepEdges = new Set(incident.map((e) => e.id));
    edgeEls.forEach(({ g }, eid) => {
      g.classList.toggle('hot', keepEdges.has(eid));
      g.classList.toggle('dim', !keepEdges.has(eid));
    });
    nodeEls.forEach((g, nid) => g.classList.toggle('dim', !keep.has(nid)));
  }

  function highlightFlow(flow) {
    const keepEdges = new Set(flow.edges);
    const keep = new Set();
    flow.edges.forEach((eid) => {
      const rec = edgeEls.get(eid);
      if (!rec) { console.warn(`flow ${flow.id} references unknown edge ${eid}`); return; }
      keep.add(rec.spec.from); keep.add(rec.spec.to);
    });
    edgeEls.forEach(({ g }, eid) => {
      g.classList.toggle('hot', keepEdges.has(eid));
      g.classList.toggle('dim', !keepEdges.has(eid));
    });
    nodeEls.forEach((g, nid) => g.classList.toggle('dim', !keep.has(nid)));
  }

  function selectNode(id) {
    selectedId = id;
    allNodes().forEach((g) => g.classList.remove('selected'));
    nodeEls.get(id)?.classList.add('selected');
    if (!activeFlow) highlightNode(id);
    renderSide(id);
  }

  /* ---- side panel ---- */
  function renderSide(id) {
    const n = nodeById[id];
    const mode = getMode();
    sideContainer.innerHTML = '';
    if (!n) {
      sideContainer.append(el('p', { class: 'side-empty', html: inline('Select any box in the map to see what it does, in whichever voice you have selected in the header.') }));
      return;
    }
    const inbound = arch.edges.filter((e) => e.to === id);
    const outbound = arch.edges.filter((e) => e.from === id);
    const col = colById[n.column];

    sideContainer.append(
      el('h3', { text: n.label }),
      el('div', { class: 'side-meta', text: `${col.title} · ${n.kind} · ${n.status}` }),
      el('p', { html: inline(voice(n.detail, mode)) }),
      inbound.length ? el('h4', { text: 'Receives' }) : null,
      inbound.length ? el('ul', {}, inbound.map((e) =>
        el('li', { html: inline(`${e.label || 'data'} — from **${nodeById[e.from]?.label ?? e.from}**${e.status !== 'live' ? ` *(${e.status})*` : ''}`) }))) : null,
      outbound.length ? el('h4', { text: 'Sends' }) : null,
      outbound.length ? el('ul', {}, outbound.map((e) =>
        el('li', { html: inline(`${e.label || 'data'} — to **${nodeById[e.to]?.label ?? e.to}**${e.status !== 'live' ? ` *(${e.status})*` : ''}`) }))) : null,
      col.system ? el('p', {}, el('a', { href: `system.html?id=${col.system}` }, `Open the ${col.title} page →`)) : null
    );
  }

  renderSide(null);
  onModeChange(() => { renderSide(selectedId); if (activeFlow) renderFlowNote(activeFlow); });

  /* ---- pan & zoom ---- */
  const viewportEl = container;
  let k = 1, tx = 0, ty = 0;
  const apply = () => viewport.setAttribute('transform', `translate(${tx} ${ty}) scale(${k})`);

  function fit() {
    const rect = viewportEl.getBoundingClientRect();
    k = Math.min(rect.width / W, rect.height / H, 1);
    tx = (rect.width - W * k) / 2;
    ty = (rect.height - H * k) / 2;
    apply();
  }

  viewportEl.addEventListener('wheel', (ev) => {
    ev.preventDefault();
    const rect = viewportEl.getBoundingClientRect();
    const mx = ev.clientX - rect.left, my = ev.clientY - rect.top;
    const next = Math.min(2.5, Math.max(0.25, k * (ev.deltaY < 0 ? 1.12 : 1 / 1.12)));
    tx = mx - (mx - tx) * (next / k);
    ty = my - (my - ty) * (next / k);
    k = next;
    apply();
  }, { passive: false });

  let dragging = false, lastX = 0, lastY = 0;
  viewportEl.addEventListener('pointerdown', (ev) => {
    if (ev.target.closest('.node')) return;
    dragging = true; lastX = ev.clientX; lastY = ev.clientY;
    viewportEl.classList.add('dragging');
    viewportEl.setPointerCapture(ev.pointerId);
  });
  viewportEl.addEventListener('pointermove', (ev) => {
    if (!dragging) return;
    tx += ev.clientX - lastX; ty += ev.clientY - lastY;
    lastX = ev.clientX; lastY = ev.clientY;
    apply();
  });
  const endDrag = () => { dragging = false; viewportEl.classList.remove('dragging'); };
  viewportEl.addEventListener('pointerup', endDrag);
  viewportEl.addEventListener('pointercancel', endDrag);

  requestAnimationFrame(fit);
  window.addEventListener('resize', () => requestAnimationFrame(fit));

  /* ---- public controls ---- */
  function renderFlowNote(flow) {
    const box = $('#flow-note');
    if (!box) return;
    box.innerHTML = '';
    if (!flow) { box.hidden = true; return; }
    box.hidden = false;
    box.append(
      el('h4', { text: flow.name }),
      el('p', { html: inline(voice(flow, getMode())) }),
      el('p', { class: 'meter-label', text: `${flow.edges.length} hops traced` })
    );
  }

  return {
    fit,
    selectNode,
    zoom(dir) {
      const rect = viewportEl.getBoundingClientRect();
      const mx = rect.width / 2, my = rect.height / 2;
      const next = Math.min(2.5, Math.max(0.25, k * (dir > 0 ? 1.2 : 1 / 1.2)));
      tx = mx - (mx - tx) * (next / k);
      ty = my - (my - ty) * (next / k);
      k = next; apply();
    },
    setFlow(flowId) {
      activeFlow = arch.flows.find((f) => f.id === flowId) || null;
      if (activeFlow) highlightFlow(activeFlow);
      else if (selectedId) highlightNode(selectedId);
      else clearHighlight();
      renderFlowNote(activeFlow);
    },
    reset() {
      activeFlow = null; selectedId = null;
      allNodes().forEach((g) => g.classList.remove('selected'));
      clearHighlight(); renderSide(null); renderFlowNote(null); fit();
    },
  };
}

/* ---------- path geometry ---------- */

function edgePath(a, b, ca, cb, L, lane = 0) {
  const halfW = L.node_width / 2, halfH = L.node_height / 2;
  const gutter = (L.column_width - L.node_width) / 2;

  if (ca === cb) {
    const long = Math.abs(b.cy - a.cy) > L.row_height * 1.4;
    if (!long) {
      // Adjacent rows: a plain vertical drop reads better than any curve.
      const down = b.cy > a.cy;
      return `M ${a.cx} ${a.cy + (down ? halfH : -halfH)} L ${b.cx} ${b.cy + (down ? -halfH : halfH)}`;
    }
    // Long hop: bow out through this column's right gutter, on its own lane so
    // several long hops in one column stay distinguishable.
    const offset = Math.min(gutter - 4, 10 + (lane % 3) * 8);
    const bx = a.cx + halfW + offset;
    return `M ${a.cx + halfW} ${a.cy} C ${bx + 18} ${a.cy} ${bx + 18} ${b.cy} ${b.cx + halfW} ${b.cy}`;
  }

  if (cb > ca) {
    // Forward: straight-ish horizontal bezier.
    const x1 = a.cx + halfW, x2 = b.cx - halfW;
    const dx = (x2 - x1) * 0.45;
    return `M ${x1} ${a.cy} C ${x1 + dx} ${a.cy} ${x2 - dx} ${b.cy} ${x2} ${b.cy}`;
  }

  // Backward: leave the left side, arc beneath the lanes, re-enter from the right.
  const x1 = a.cx - halfW, x2 = b.cx + halfW;
  const drop = Math.max(a.cy, b.cy) + L.row_height * 0.9;
  return `M ${x1} ${a.cy} C ${x1 - 60} ${a.cy} ${x1 - 40} ${drop} ${(x1 + x2) / 2} ${drop} C ${x2 + 40} ${drop} ${x2 + 60} ${b.cy} ${x2} ${b.cy}`;
}

function markerKey(e) {
  return e.status === 'blocked' ? 'blocked' : e.kind;
}

function defs() {
  const d = svgEl('defs');
  const colours = {
    data: 'var(--edge)',
    artifact: 'var(--info)',
    message: 'var(--warn)',
    order: 'var(--good)',
    control: 'var(--muted)',
    blocked: 'var(--bad)',
  };
  for (const [key, fill] of Object.entries(colours)) {
    const m = svgEl('marker', {
      id: `arw-${key}`, viewBox: '0 0 10 10', refX: '9', refY: '5',
      markerWidth: '6', markerHeight: '6', orient: 'auto-start-reverse',
    });
    m.append(svgEl('path', { d: 'M 0 1 L 9 5 L 0 9 z', fill }));
    d.append(m);
  }
  return d;
}

function wrap(text, maxChars) {
  if (text.length <= maxChars) return [text];
  const words = text.split(' ');
  const lines = [''];
  for (const w of words) {
    const candidate = lines[lines.length - 1] ? `${lines[lines.length - 1]} ${w}` : w;
    if (candidate.length > maxChars && lines[lines.length - 1]) lines.push(w);
    else lines[lines.length - 1] = candidate;
  }
  return lines.slice(0, 2);
}
