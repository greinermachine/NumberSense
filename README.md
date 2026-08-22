# Number Sense

**There’s always another way.**

Number Sense is a lightweight daily game about seeing numbers differently. Each day offers three curated multiplication problems. A player can answer directly or turn either operand into another valid expression, follow that thought through a few calculations, see a contrasting perspective, and ride the resulting line through a short abstract 3D surf stage.

The product is intentionally a game first: no accounts, streak pressure, grades, strategy rankings, classroom dashboard, or backend.

## Run it

Requirements: Node.js 22.13 or newer and npm.

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. The math experience works with keyboard, mouse, touch, and narrow viewports. Interactive surfing is desktop/laptop-first; coarse-pointer and reduced-motion contexts receive a calm automatic glide.

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
3. Complete the generated distributive or regrouping steps.
4. See a curated alternate view that avoids repeating yours when possible.
5. Explicitly launch a 10–20 second surf line.
6. Repeat for one warm, one exploratory, and one puzzle-like problem.
7. Share a spoiler-free result.

Progress, discoveries, hints, and the daily result are saved in versioned local storage. Refreshing during an active surf returns to its launch screen because browser pointer lock cannot safely survive a reload.

## Project map

```text
src/
  app/                 composition and app lifecycle
  components/          shell, intro, and results UI
  data/                curated problems and daily selection
  features/math/       central mathematical interaction
  features/spirit/     alternate-view reveal
  features/surf/       courses, physics, rendering, and fallback
  game/                reducer, persistence, and share format
  math/                parser and guided-plan domain logic
  styles/              global tokens and baseline styles
docs/                  design, architecture, system, and study documents
```

The Three.js surf renderer is loaded with `React.lazy`; math is available without downloading or initializing WebGL first. Physics uses refs inside the render loop rather than React state. Production keeps the first-person view free of numeric HUD; a throttled physics/vector overlay is available only with the development query described in the surf-system notes.

## Read next

- [Learning guide](docs/LEARNING_GUIDE.md) — recommended source reading order and change recipes
- [Architecture](docs/ARCHITECTURE.md) — boundaries and state transitions
- [Math system](docs/MATH_SYSTEM.md) — safe grammar, equivalence, and generated work
- [Surf system](docs/SURF_SYSTEM.md) — vectors, ramp normals, fixed steps, and tuning
- [Design system](docs/DESIGN_SYSTEM.md) — tokens, typography, motion, and accessibility
- [Development log](docs/DEVELOPMENT_LOG.md) — implementation milestones, defects, and evidence
- [Build notes](docs/BUILD_NOTES.md) — the master brief converted into an acceptance matrix

## V1 boundaries

There is no backend, authentication, cloud sync, user-generated public content, learner model, AI tutor, virtual mobile joystick, general algebra engine, or exact Source-engine surf emulation. These are deliberate product boundaries, not unfinished setup; extension points are described in [Future ideas](docs/FUTURE_IDEAS.md).
