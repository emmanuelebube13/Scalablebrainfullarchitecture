# Scalable Brain — Architecture & Operations Hub

Interactive architecture documentation and operational goal tracker for the Scalable Brain
multi-system algorithmic trading platform. Static HTML/CSS/JS, deployed by GitHub Pages,
no build step and no dependencies.

**Live site:** https://emmanuelebube13.github.io/Scalablebrainfullarchitecture/

---

## What it is

Two things, sharing one Git-backed content layer:

1. **An architecture hub.** Per-subsystem documentation and an interactive map of how the
   subsystems feed each other, with every explanation available in a **Technical** and a
   **Plain English** voice, switched from the header.
2. **An operations tracker.** A milestone ladder, macro and subsystem goals, a cross-system
   dependency matrix, and a per-week task list.

The design constraint that shapes everything else: **no content is written in HTML.** Every
page fetches JSON from `data/` and renders it. Humans, scripts and automated agents all edit
the same structured files through Git or the GitHub API.

---

## Repository layout

```
data/                         The content layer — the only thing you normally edit
├── registry.json             Project identity, principles, list of systems
├── architecture.json         Nodes, edges and traceable flows for the unified map
├── decisions.json            Architecture decision records, including open ones
├── goals.json                Milestones, goals, dependency matrix, task tracker
└── systems/system-N.json     One file per subsystem, all sharing one schema

schema/                       JSON Schema for each content file
templates/system.template.json  Copy this to add System 4
tools/validate.mjs            Zero-dependency validator (structure + cross-references)

index.html                    Overview
architecture.html             Unified interactive map + decision records
system.html?id=system-N       Subsystem page — one page serves every system
goals.html                    Goals, milestones, dependency matrix, tasks
contribute.html               How to edit the data layer

assets/css/main.css           The whole stylesheet
assets/js/                    ES modules, one per page plus core.js and map.js
```

## Running it locally

The pages read their content with `fetch()`, which browsers block on `file://`. Serve over HTTP:

```bash
python3 -m http.server 8080
# open http://localhost:8080
```

## Validating a change

```bash
node tools/validate.mjs
```

Checks every content file against its schema, then checks referential integrity: every edge
endpoint resolves to a node, every flow edge exists, every task points at a real goal and a real
system, every registered system file is present and self-consistent. Exits non-zero on failure,
and runs in CI on every push.

## Adding System 4

No HTML, CSS or JavaScript changes are needed.

```bash
cp templates/system.template.json data/systems/system-4.json
# fill it in, then register it in data/registry.json:
#   { "id": "system-4", "ordinal": 4, "file": "data/systems/system-4.json" }
# add a column and nodes in data/architecture.json
# add { "system": "system-4", "role": …, "need": … } to any goal it touches
node tools/validate.mjs
```

Nodes declare a `column` and a `row`; coordinates are computed, so there is no pixel arithmetic
and no layout to rebalance.

## For automated agents

The content is public and CORS-enabled, so it is a legitimate integration point, not only a website:

```bash
curl -s https://raw.githubusercontent.com/emmanuelebube13/Scalablebrainfullarchitecture/main/data/goals.json \
  | jq '.tasks[] | select(.system=="system-2" and .status!="done")'
```

Writes go through the GitHub contents API. Always send the `sha` you read — it is optimistic
concurrency control, and it turns a collision between two agents into an error rather than a
silent overwrite. Full instructions, including the schema reference, are on the
[Editing the data](https://emmanuelebube13.github.io/Scalablebrainfullarchitecture/contribute.html) page.

## Deployment

GitHub Pages, from the default branch, root directory. `.nojekyll` is present so that paths are
served verbatim. There is no build step: a push is a deploy.

## Conventions

- Explanations are objects with `technical` and `plain` keys. `plain` is optional and falls back,
  but it is where most of the value is.
- Strings support `` `code` ``, `**bold**`, `*italic*` and `[label](url)`. Everything is
  HTML-escaped first, so agent-authored content cannot inject markup.
- Node and edge `status` is one of `live` / `degraded` / `blocked` / `planned`. Anything other than
  `live` renders dashed — the map cannot draw a broken link as a working one.
- Dates are ISO `YYYY-MM-DD`. State claims carry an `as_of`.
