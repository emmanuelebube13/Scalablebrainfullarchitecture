// design.html: swatches read from the live tokens (tokens.css). Nothing here holds a colour
// value; each chip is painted with rgb(var(--token)) and its value is read back from the page,
// so the page shows exactly what every app renders, in whichever theme is active.
import { $, el, mountChrome } from './core.js';

mountChrome('design');

const GROUPS = {
  meaning: [
    ['good', 'Healthy, passing, profit'],
    ['bad', 'Fault, failing, loss, blocked'],
    ['warn', 'Needs attention soon, degraded, stale'],
    ['accent', 'Interactive, selected, links, informational'],
    ['neutral', 'Absent, unknown, market closed, disabled'],
  ],
  surfaces: [
    ['bg', 'Page background'],
    ['surface', 'Cards, sidebar, top bar, panels'],
    ['surface-raised', 'Hover, nested rows, popovers'],
    ['surface-sunken', 'Inputs, code blocks, wells'],
    ['border', 'Default 1 px lines'],
    ['border-strong', 'Dividers that matter'],
    ['text', 'Primary text'],
    ['text-dim', 'Secondary text'],
    ['text-faint', 'Meta, placeholders'],
  ],
  identity: [
    ['s1', 'System 1 · Brain'],
    ['s2', 'System 2 · Hand'],
    ['s3', 'System 3 · Guardian'],
  ],
};

function hex(channels) {
  const parts = channels.trim().split(/\s+/).map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return channels.trim() || '—';
  return '#' + parts.map((n) => n.toString(16).padStart(2, '0')).join('').toUpperCase();
}

function render() {
  // Tokens hold RGB channels on <html>; read them there (inside <body> the site aliases them).
  const cs = getComputedStyle(document.documentElement);
  for (const box of document.querySelectorAll('.ds-swatches')) {
    const rows = GROUPS[box.dataset.group] || [];
    box.replaceChildren(
      ...rows.map(([name, use]) =>
        el('div', { class: 'ds-swatch' },
          el('div', { class: 'ds-chip', style: { background: `rgb(${cs.getPropertyValue(`--${name}`).trim()})` } }),
          el('div', { class: 'ds-swatch-body' },
            el('span', { class: 'ds-swatch-name', text: `--${name}` }),
            el('span', { class: 'ds-swatch-value', text: hex(cs.getPropertyValue(`--${name}`)) }),
            el('span', { class: 'ds-swatch-use', text: use })))));
  }
}

render();
// Re-read when the theme flips (the header toggle sets data-theme on <html>).
new MutationObserver(render).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
void $;
