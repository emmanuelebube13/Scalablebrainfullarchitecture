#!/usr/bin/env node
/**
 * validate.mjs — zero-dependency checker for the content layer.
 *
 *   node tools/validate.mjs
 *
 * Two passes:
 *   1. Structural — required keys, types and enums, from schema/*.schema.json.
 *      A deliberately small JSON Schema subset: type, required, properties,
 *      items, enum, pattern. Enough to catch the mistakes agents actually make.
 *   2. Referential — every edge endpoint resolves to a node, every flow edge
 *      exists, every task points at a real goal and a real system, every system
 *      file registered in registry.json is present and self-consistent.
 *
 * Exits non-zero on any error, so CI and pre-commit hooks can gate on it.
 */

import { readFile, readdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];
const warnings = [];

const err = (where, msg) => errors.push(`${where}: ${msg}`);
const warn = (where, msg) => warnings.push(`${where}: ${msg}`);

async function readJSON(rel) {
  try {
    return JSON.parse(await readFile(join(ROOT, rel), 'utf8'));
  } catch (e) {
    err(rel, e instanceof SyntaxError ? `invalid JSON — ${e.message}` : `cannot read — ${e.message}`);
    return null;
  }
}

/* ------------------------------------------------------------------ *
 * Minimal JSON Schema validation
 * ------------------------------------------------------------------ */

function typeOf(v) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  return typeof v;
}

function validate(value, schema, path, file) {
  if (!schema) return;

  if (schema.type) {
    const types = [].concat(schema.type);
    const actual = typeOf(value);
    const ok = types.some((t) => (t === 'integer' ? Number.isInteger(value) : t === actual));
    if (!ok) {
      err(file, `${path} — expected ${types.join(' or ')}, got ${actual}`);
      return;
    }
  }

  if (schema.enum && !schema.enum.includes(value)) {
    err(file, `${path} — "${value}" is not one of: ${schema.enum.join(', ')}`);
  }

  if (schema.pattern && typeof value === 'string' && !new RegExp(schema.pattern).test(value)) {
    err(file, `${path} — "${value}" does not match ${schema.pattern}`);
  }

  if (typeOf(value) === 'object') {
    for (const key of schema.required ?? []) {
      if (!(key in value)) err(file, `${path} — missing required key "${key}"`);
    }
    for (const [key, sub] of Object.entries(schema.properties ?? {})) {
      if (key in value) validate(value[key], sub, `${path}.${key}`, file);
    }
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(value)) {
        if (!(key in (schema.properties ?? {}))) warn(file, `${path} — unexpected key "${key}"`);
      }
    }
  }

  if (typeOf(value) === 'array' && schema.items) {
    value.forEach((item, i) => validate(item, schema.items, `${path}[${i}]`, file));
  }
}

/* ------------------------------------------------------------------ *
 * Run
 * ------------------------------------------------------------------ */

const schemas = {};
for (const f of await readdir(join(ROOT, 'schema'))) {
  if (f.endsWith('.schema.json')) schemas[f.replace('.schema.json', '')] = await readJSON(`schema/${f}`);
}

const registry = await readJSON('data/registry.json');
const architecture = await readJSON('data/architecture.json');
const goals = await readJSON('data/goals.json');
const decisions = await readJSON('data/decisions.json');

if (registry) validate(registry, schemas.registry, 'registry', 'data/registry.json');
if (architecture) validate(architecture, schemas.architecture, 'architecture', 'data/architecture.json');
if (goals) validate(goals, schemas.goals, 'goals', 'data/goals.json');
if (decisions) validate(decisions, schemas.decisions, 'decisions', 'data/decisions.json');

/* ---- systems ---- */
const systems = [];
for (const entry of registry?.systems ?? []) {
  const sys = await readJSON(entry.file);
  if (!sys) continue;
  validate(sys, schemas.system, 'system', entry.file);
  if (sys.id !== entry.id) err(entry.file, `id "${sys.id}" does not match registry entry "${entry.id}"`);
  if (sys.ordinal !== entry.ordinal) err(entry.file, `ordinal ${sys.ordinal} does not match registry entry ${entry.ordinal}`);
  const vocab = registry.status_vocabulary ?? {};
  if (sys.status && !(sys.status.state in vocab)) {
    err(entry.file, `status.state "${sys.status.state}" is not in registry.status_vocabulary`);
  }
  const ids = new Set();
  for (const s of sys.sections ?? []) {
    if (ids.has(s.id)) err(entry.file, `duplicate section id "${s.id}"`);
    ids.add(s.id);
  }
  systems.push(sys);
}

const systemIds = new Set(systems.map((s) => s.id));

/* ---- architecture referential integrity ---- */
if (architecture) {
  const columnIds = new Set(architecture.columns.map((c) => c.id));
  const nodeIds = new Set();
  const edgeIds = new Set();

  for (const c of architecture.columns) {
    if (c.system && !systemIds.has(c.system)) err('data/architecture.json', `column "${c.id}" references unknown system "${c.system}"`);
  }
  for (const n of architecture.nodes) {
    if (nodeIds.has(n.id)) err('data/architecture.json', `duplicate node id "${n.id}"`);
    nodeIds.add(n.id);
    if (!columnIds.has(n.column)) err('data/architecture.json', `node "${n.id}" references unknown column "${n.column}"`);
  }
  for (const e of architecture.edges) {
    if (edgeIds.has(e.id)) err('data/architecture.json', `duplicate edge id "${e.id}"`);
    edgeIds.add(e.id);
    if (!nodeIds.has(e.from)) err('data/architecture.json', `edge "${e.id}" has unknown from "${e.from}"`);
    if (!nodeIds.has(e.to)) err('data/architecture.json', `edge "${e.id}" has unknown to "${e.to}"`);
    if (e.from === e.to) err('data/architecture.json', `edge "${e.id}" is a self-loop`);
  }
  for (const f of architecture.flows) {
    if (!f.edges?.length) err('data/architecture.json', `flow "${f.id}" has no edges`);
    for (const id of f.edges ?? []) {
      if (!edgeIds.has(id)) err('data/architecture.json', `flow "${f.id}" references unknown edge "${id}"`);
    }
  }
  const referenced = new Set(architecture.edges.flatMap((e) => [e.from, e.to]));
  for (const id of nodeIds) {
    if (!referenced.has(id)) warn('data/architecture.json', `node "${id}" has no edges — it will render unconnected`);
  }
}

/* ---- goals referential integrity ---- */
if (goals) {
  const goalIds = new Set(goals.goals.map((g) => g.id));
  const roles = new Set(Object.keys(goals.dependency_roles ?? {}));
  const statuses = new Set(Object.keys(goals.status_vocabulary ?? {}));

  for (const g of goals.goals) {
    if (!statuses.has(g.status)) err('data/goals.json', `goal "${g.id}" has status "${g.status}" not in status_vocabulary`);
    for (const d of g.dependencies ?? []) {
      if (!systemIds.has(d.system)) err('data/goals.json', `goal "${g.id}" depends on unknown system "${d.system}"`);
      if (!roles.has(d.role)) err('data/goals.json', `goal "${g.id}" uses unknown dependency role "${d.role}"`);
    }
    for (const id of systemIds) {
      if (!(g.dependencies ?? []).some((d) => d.system === id)) {
        warn('data/goals.json', `goal "${g.id}" has no entry for "${id}" — it will show as "—" in the matrix`);
      }
    }
  }
  const seen = new Set();
  for (const t of goals.tasks) {
    if (seen.has(t.id)) err('data/goals.json', `duplicate task id "${t.id}"`);
    seen.add(t.id);
    if (!systemIds.has(t.system)) err('data/goals.json', `task "${t.id}" references unknown system "${t.system}"`);
    if (!goalIds.has(t.goal)) err('data/goals.json', `task "${t.id}" references unknown goal "${t.goal}"`);
    if (!statuses.has(t.status)) err('data/goals.json', `task "${t.id}" has status "${t.status}" not in status_vocabulary`);
  }
}

/* ---- decisions referential integrity ---- */
if (decisions) {
  for (const d of decisions.decisions) {
    for (const id of [...(d.systems ?? []), ...(d.requires_approval_from ?? [])]) {
      if (!systemIds.has(id)) err('data/decisions.json', `decision "${d.id}" references unknown system "${id}"`);
    }
  }
}

/* ---- report ---- */
for (const w of warnings) console.warn(`  warn  ${w}`);
for (const e of errors) console.error(`  ERROR ${e}`);

console.log(
  `\n${systems.length} systems · ${architecture?.nodes.length ?? 0} nodes · ${architecture?.edges.length ?? 0} edges · ` +
  `${architecture?.flows.length ?? 0} flows · ${goals?.goals.length ?? 0} goals · ${goals?.tasks.length ?? 0} tasks · ` +
  `${decisions?.decisions.length ?? 0} decisions`
);
console.log(errors.length ? `\nFAILED — ${errors.length} error(s), ${warnings.length} warning(s)` : `\nOK — ${warnings.length} warning(s)`);

process.exit(errors.length ? 1 : 0);
