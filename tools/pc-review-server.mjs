#!/usr/bin/env node
/* Safe Gemini proxy for pc-review.html. Keep GEMINI_API_KEY server-side. */
import http from 'node:http';

const port = Number(process.env.PORT || 8787);
const apiKey = process.env.GEMINI_API_KEY;
const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const maxBodyBytes = 12 * 1024 * 1024;

if (!apiKey) {
  console.error('GEMINI_API_KEY is required in the server environment.');
  process.exit(1);
}

const systemPrompt = `You review computers for the Scalable Brain project.
The target is a staged always-on Linux host for Systems 1, 2 and 3.
Stage 1 baseline: 12-core CPU, 64 GB RAM, 2 TB NVMe, no dedicated GPU, ATX expansion, 850W Gold PSU, strong air cooling, wired Ethernet, UPS, and encrypted off-machine backups.
Stage 2 reliability before meaningful live capital: ECC-capable 128 GB RAM, mirrored enterprise storage, restore tests, monitoring, backup internet, and a recovery host.
Stage 3 capacity: 16-core CPU, 256 GB RAM and 4-8 TB data storage only when measured workload pressure justifies it.
Stage 4 local ML: NVIDIA GPU with 16-24 GB or more VRAM and stronger cooling/PSU only when cloud cost or privacy justifies it.
The current user needs staged value, not maximum specifications. Used prices are estimates and must be verified. Never recommend a purchase based only on an image when key details are unreadable.
Return JSON only with keys: verdict, score, summary, findings, buying_advice, upgrades, questions.
verdict must be one of: GOOD BUY, BUY WITH CONDITIONS, NOT A GOOD FIT, INSUFFICIENT DETAILS.
findings is an array of objects with component, status, detail. Be concrete about missing model numbers, compatibility, warranty, thermals, PSU quality, storage health, and whether an upgrade is premature.`;

const server = http.createServer(async (request, response) => {
  setCors(response);
  if (request.method === 'OPTIONS') return response.end();
  if (request.method !== 'POST' || request.url !== '/api/pc-review') {
    response.writeHead(404, { 'Content-Type': 'application/json' });
    return response.end(JSON.stringify({ error: 'Not found' }));
  }

  try {
    const input = JSON.parse(await readBody(request));
    if (!input.specification && !input.image) throw new Error('Specification or image required');
    const parts = [{ text: `${systemPrompt}\n\nCandidate listing:\n${input.specification || '(image only)'}` }];
    if (input.image?.data && ['image/png', 'image/jpeg', 'image/webp'].includes(input.image.mimeType)) {
      parts.push({ inline_data: { mime_type: input.image.mimeType, data: input.image.data } });
    }
    const gemini = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ role: 'user', parts }], generationConfig: { responseMimeType: 'application/json' } }),
    });
    const payload = await gemini.json();
    if (!gemini.ok) throw new Error(payload.error?.message || `Gemini request failed (${gemini.status})`);
    const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Gemini returned no review');
    const review = JSON.parse(text);
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify(review));
  } catch (error) {
    response.writeHead(400, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ error: error.message || 'Review failed' }));
  }
});

server.listen(port, () => console.log(`PC review proxy listening on http://localhost:${port}`));

function setCors(response) {
  response.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.on('data', (chunk) => {
      body += chunk;
      if (Buffer.byteLength(body) > maxBodyBytes) reject(new Error('Request too large'));
    });
    request.on('end', () => resolve(body));
    request.on('error', reject);
  });
}
