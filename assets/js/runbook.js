import { mountChrome, fatal, $, el } from './core.js';

const main = $('#content');

async function init() {
  try {
    mountChrome('runbook');
    const response = await fetch('data/MASTER-RUNBOOK.md');
    if (!response.ok) throw new Error(`HTTP ${response.status} loading runbook`);
    const text = await response.text();

    /* ---------- Configure marked with heading IDs and anchor links ---------- */
    const renderer = new marked.Renderer();

    // Track headings for the ToC
    const tocHeadings = [];
    const slugCounts = {};

    renderer.heading = function ({ text, depth }) {
      // Build a URL-safe slug from the heading text (strip any inline HTML tags)
      const plainText = text.replace(/<[^>]*>/g, '');
      let slug = plainText
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim();

      // Deduplicate slugs
      if (slugCounts[slug] === undefined) {
        slugCounts[slug] = 0;
      } else {
        slugCounts[slug]++;
        slug = `${slug}-${slugCounts[slug]}`;
      }

      // Record top-level headings (H2 and H3) for the ToC
      if (depth <= 3) {
        tocHeadings.push({ text: plainText, depth, slug });
      }

      const anchor = `<a class="heading-anchor" href="#${slug}" aria-label="Link to this section">¶</a>`;
      return `<h${depth} id="${slug}">${text}${anchor}</h${depth}>\n`;
    };

    marked.use({ renderer });

    const html = marked.parse(text);

    /* ---------- Build table of contents ---------- */
    const tocEl = el('div', { id: 'runbook-toc' });
    if (tocHeadings.length > 0) {
      const h2s = tocHeadings.filter((h) => h.depth === 2);
      if (h2s.length > 0) {
        tocEl.append(el('h3', { text: 'Contents' }));
        const ol = el('ol');
        h2s.forEach((h) => {
          ol.append(el('li', {}, el('a', { href: `#${h.slug}` }, h.text)));
        });
        tocEl.append(ol);
      }
    }

    /* ---------- Render ---------- */
    const bodyEl = el('div', { id: 'runbook-body' });
    bodyEl.innerHTML = html;

    main.innerHTML = '';
    main.append(
      el('section', { class: 'section' },
        el('div', { class: 'wrap' },
          el('div', { class: 'section-head' },
            el('span', { class: 'kicker' }, 'Operational reference'),
            el('h2', {}, 'Master Runbook'),
            el('p', {}, 'Operational procedures, maintenance scripts, and troubleshooting. Generated from ',
              el('code', {}, 'data/MASTER-RUNBOOK.md'), ' — ',
              el('strong', {}, 'do not edit that file directly'), '.')),
          tocEl,
          bodyEl
        )
      )
    );
  } catch (err) {
    fatal(main, err);
    console.error(err);
  }
}

init();
