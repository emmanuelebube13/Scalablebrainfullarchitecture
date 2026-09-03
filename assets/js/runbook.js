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

      const anchor = `<a class="heading-anchor" href="#${slug}" aria-label="Copy a link to this section" title="Copy link to this section">¶</a>`;
      return `<h${depth} id="${slug}">${text}${anchor}</h${depth}>\n`;
    };

    marked.use({ renderer });

    const html = marked.parse(text);

    /* ---------- Build table of contents ---------- */
    /* The ToC is the left column and stays put while the body scrolls. */
    const tocEl = el('aside', { class: 'runbook-toc-col', id: 'runbook-toc', 'aria-label': 'Runbook contents' });
    const h2s = tocHeadings.filter((h) => h.depth === 2);
    if (h2s.length > 0) {
      tocEl.append(el('h3', { text: 'Contents' }));
      const ol = el('ol');
      h2s.forEach((h) => {
        ol.append(el('li', {}, el('a', { href: `#${h.slug}` }, h.text)));
      });
      tocEl.append(ol);
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
          el('div', { class: 'runbook-layout' },
            tocEl,
            el('div', { class: 'runbook-body-col' }, bodyEl))
        )
      )
    );

    /* ---------- Heading anchors copy their own link ----------
       Clicking the pilcrow puts the absolute URL of that section on the
       clipboard as well as moving to it, so a procedure can be pasted into a
       ticket by the person reading it. */
    bodyEl.addEventListener('click', (ev) => {
      const anchor = ev.target.closest('a.heading-anchor');
      if (!anchor) return;
      ev.preventDefault();
      const slug = anchor.getAttribute('href').slice(1);
      const url = `${location.origin}${location.pathname}#${slug}`;
      history.replaceState(null, '', `#${slug}`);
      document.getElementById(slug)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      navigator.clipboard?.writeText(url).then(() => flash(anchor, '✓'), () => flash(anchor, '✗'));
    });

    function flash(anchor, glyph) {
      const original = anchor.textContent;
      anchor.textContent = glyph;
      anchor.classList.add('copied');
      setTimeout(() => { anchor.textContent = original; anchor.classList.remove('copied'); }, 1100);
    }

    /* An anchor in the incoming URL only resolves once the body is in the DOM. */
    if (location.hash.length > 1) {
      document.getElementById(location.hash.slice(1))?.scrollIntoView({ block: 'start' });
    }
  } catch (err) {
    fatal(main, err);
    console.error(err);
  }
}

init();
