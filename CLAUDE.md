# CLAUDE.md

Read `PROJECT.md` for the full spec. Short version:

Two-page Next.js 14 app. `/` is a minimal mobile-first journal field ("what do you want to let go of?"). Submissions flow to `/wind`, which renders an ASCII boid flock with a Perlin wind field and ordered-dither pass. Submitted text appears in the flock, then disintegrates into boids.

## Ground rules

- Mobile-first. Build and test at 375px wide before desktop.
- Canvas 2D, not WebGL. The lofi feel matters more than perf headroom.
- Target 30fps, not 60. Slight stutter is part of the aesthetic.
- Monospace everywhere. One font, one weight.
- Near-black background, off-white glyphs, one subtle accent color max.
- No client-side state libraries. React state + `useRef` for the animation loop is enough.
- Ephemeral by design — no database, no accounts, no persistence beyond 1hr TTL.

## Build in the order listed in PROJECT.md

Don't skip to the dither pass before the boids are flocking correctly. Get each stage feeling right before moving on. After each stage, pause and let me look at it.

## Things to avoid

- No headers, nav, or footer on either page
- No gradients, no drop shadows, no rounded corners on the landing page
- No emoji, no icons
- No loading spinners — if something's slow, make it feel intentional (fade in, not spinner)
- Don't smooth-antialias the canvas text — pixel-snap it for that crunchy look
