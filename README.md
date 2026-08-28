# Number Sense

**There’s always another way.**

Number Sense is a lightweight daily game about seeing numbers differently. Each day offers three curated multiplication problems. A player can answer directly or turn either operand into another valid expression, follow that thought through a few calculations, and see a contrasting authored perspective.

On a browser’s first visit, a short interactive `24 × 19` lesson teaches the core idea inside the real math surface: **Same value. Different shape.** Completion or **Skip for now** is stored separately from daily progress, and `?` can replay the lesson at any time.

The surfing reward has been removed from Number Sense. After an alternate thought finishes, the reducer advances directly to the next problem or the daily results. The independent replacement is staged in [`surf-standalone/`](surf-standalone/README.md) and is not imported or built by this app.

## Run Number Sense

Requirements: Node.js 22 (`.node-version` pins the locally verified `22.21.0`) and npm.

```bash
npm ci
npm run dev
```

The math experience works with keyboard, mouse, touch, reduced motion, and narrow viewports.

## Quality commands

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

`npm run preview` serves the production build locally after `npm run build`.

## The daily loop

1. Solve a multiplication directly, or select an operand.
2. Type one binary expression using `+`, `-`, or `*`/`x`.
3. Work through the generated expression; any awkward partial product can be turned over again.
4. See an explicitly curated teaching view that avoids repeating yours when possible.
5. Continue automatically to the next warm, exploratory, or puzzle-like problem.
6. Share a spoiler-free result after all three.

Progress, discoveries, hints, and the daily result are saved in versioned local storage. Legacy same-day snapshots captured in the removed surf phases migrate forward to the next problem instead of discarding completed work.

Player input and game teaching intentionally use different standards. Any decomposition accepted by the safe equivalence parser remains valid player mathematics; the presence can select only authored `TeachingView` metadata with a documented Number Sense rationale.

## Project map

```text
src/
  app/                 composition and app lifecycle
  components/          shell, intro, help, and results UI
  data/                curated problems and daily selection
  features/math/       central mathematical interaction
  features/spirit/     alternate-view reveal
  features/tutorial/   first-run lesson and deterministic frames
  game/                reducer, persistence, and share format
  math/                parser and guided-plan domain logic
  styles/              global tokens and baseline styles
surf-standalone/       independent Vector Surf application
docs/                  design, architecture, system, and study documents
```

## Read next

- [Learning guide](docs/LEARNING_GUIDE.md) — recommended source reading order and change recipes
- [Architecture](docs/ARCHITECTURE.md) — boundaries and state transitions
- [Math system](docs/MATH_SYSTEM.md) — safe grammar, equivalence, and generated work
- [Design system](docs/DESIGN_SYSTEM.md) — tokens, typography, motion, and accessibility
- [Development log](docs/DEVELOPMENT_LOG.md) — implementation milestones, defects, and evidence
- [Deployment architecture](docs/DEPLOYMENT.md) — Vercel, Render, routing, Node, and production checks
- [Live deployment runbook](LIVEDEPLOY.MD) — the shortest path from Git to a public URL

## Deploy it

The repository is configured for Vercel and a Render Static Site. Both install with `npm ci`, build with `npm run build`, and publish `dist`; neither runs a backend. Start with [LIVEDEPLOY.md](LIVEDEPLOY.MD), then use [the detailed deployment notes](docs/DEPLOYMENT.md) for custom domains, previews, rollback, and troubleshooting.

## Product boundaries

There is no backend, authentication, cloud sync, user-generated public content, learner model, AI tutor, general algebra engine, or embedded movement game. These are deliberate boundaries, not unfinished setup.
