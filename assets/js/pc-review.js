import { $, el, escapeHtml, mountChrome } from './core.js';

const form = $('#review-form');
const specification = $('#specification');
const imageInput = $('#image');
const imageName = $('#image-name');
const status = $('#review-status');
const output = $('#review-output');
const REVIEW_ENDPOINT = new URLSearchParams(location.search).get('endpoint')
  || localStorage.getItem('sb.pcReviewEndpoint')
  || window.SB_PC_REVIEW_ENDPOINT
  || '/api/pc-review';

mountChrome('pc-review');

imageInput.addEventListener('change', () => {
  imageName.textContent = imageInput.files[0]?.name || 'No image selected.';
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const file = imageInput.files[0];
  if (!specification.value.trim() && !file) {
    setStatus('Add a specification, an image, or both.', 'warn');
    return;
  }

  setStatus('Reviewing against the staged host plan...', 'info');
  output.innerHTML = '';
  try {
    const image = file ? {
      mimeType: file.type,
      data: await toBase64(file),
    } : null;
    const response = await fetch(REVIEW_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ specification: specification.value.trim(), image }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || `Review failed (${response.status})`);
    output.innerHTML = renderReview(body);
    setStatus('Review complete. Confirm prices, seller claims and compatibility before buying.', 'good');
  } catch (error) {
    setStatus(error.message || 'Could not reach the review service.', 'bad');
  }
});

function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = () => reject(new Error('Could not read the image.'));
    reader.readAsDataURL(file);
  });
}

function renderReview(review) {
  const verdict = escapeHtml(review.verdict || 'Review');
  const score = review.score == null ? '' : `<span class="badge tone-info">${escapeHtml(review.score)}/10</span>`;
  const rows = (review.findings || []).map((finding) => `
    <tr><td>${escapeHtml(finding.component || '')}</td><td>${escapeHtml(finding.status || '')}</td><td>${escapeHtml(finding.detail || '')}</td></tr>`).join('');
  return `<h2>${verdict} ${score}</h2>
    <p>${escapeHtml(review.summary || '')}</p>
    ${rows ? `<table><thead><tr><th>Component</th><th>Status</th><th>Finding</th></tr></thead><tbody>${rows}</tbody></table>` : ''}
    ${review.buying_advice ? `<h3>Buying advice</h3><p>${escapeHtml(review.buying_advice)}</p>` : ''}
    ${review.upgrades ? `<h3>Upgrade path</h3><p>${escapeHtml(review.upgrades)}</p>` : ''}
    ${review.questions ? `<h3>Verify before buying</h3><p>${escapeHtml(review.questions)}</p>` : ''}`;
}

function setStatus(message, tone) {
  status.className = `callout t-${tone}`;
  status.textContent = message;
}
