import { mountChrome, fatal, $ } from './core.js';

const main = $('#content');

async function init() {
  try {
    mountChrome('runbook');
    const response = await fetch('data/MASTER-RUNBOOK.md');
    if (!response.ok) throw new Error(`HTTP ${response.status} loading runbook`);
    const text = await response.text();
    
    // Use marked to parse the markdown
    main.innerHTML = marked.parse(text);
  } catch (err) {
    fatal(main, err);
    console.error(err);
  }
}

init();
