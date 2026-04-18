# Let Go — ASCII Wind Boids

A two-page web experience. People write what they want to let go of on the landing page. Their words drift to `/wind`, where the text disintegrates into particles and joins an ambient ASCII boid flock rendered as a lofi dithered wind field.

## Stack

- **Next.js 14** (App Router) + TypeScript
- **Tailwind CSS** for the minimal UI chrome
- **Canvas 2D** for the ASCII rendering (no WebGL needed, keeps it lofi)
- **Vercel KV** (or in-memory fallback for local dev) to pass submissions between `/` and `/wind`
- Mobile-first, works great on a phone held in portrait

## Pages

### `/` — Landing page (mobile-first journal)

Full-bleed, centered, minimal. Dark background, monospace type.

- Single prompt: **"what do you want to let go of?"**
- One multiline text field (auto-growing textarea, no border, blinking cursor, feels like a terminal)
- Submit on `Enter` (Shift+Enter for newline)
- On submit: field fades out, replaced with a single word — **"thanks."** — then after ~3s fades back to empty field
- No headers, no nav, no footer. Just the prompt and the field.
- Submissions POST to `/api/release` which pushes the text into a shared queue/store

### `/wind` — The flock

Full-viewport canvas rendering ASCII characters as a boid simulation.

- Boids flock with classic Reynolds rules (separation, alignment, cohesion) plus a low-frequency Perlin wind field pushing them around
- Each boid is rendered as a single ASCII glyph from a dithered ramp (`. , ' \` - ~ * + x o O @`) — glyph chosen by velocity magnitude so faster boids read denser
- Background is near-black, glyphs are off-white with slight opacity variance for depth
- Apply an ordered-dither / Bayer-matrix pass over the frame to get the lofi feel (dithered grain, not smooth anti-aliasing)
- Poll `/api/release` every few seconds for new submissions
- When a new submission arrives: the text appears legibly somewhere on screen (typed out char by char, or faded in), holds for ~2s, then each character **becomes a boid** — it detaches, gets a small random velocity pointed downwind, and joins the flock
- Boids have a long but finite lifespan so the screen doesn't saturate — they fade out at the downwind edge

## Visual direction

- Think: old terminal, ASCII art zines, `cmatrix` but gentler, wind moving through tall grass
- No color except maybe a single accent (phosphor green or warm amber — pick one, subtle)
- Glyph grid roughly 80–120 cols wide depending on viewport, cell size derived from viewport
- Frame rate: target 30fps — lofi, not buttery. Slight frame stutter is fine, even nice.

## Tech notes

- Use `requestAnimationFrame` but throttle to ~30fps for the lofi feel
- Boid count: ~150–300, tune for mobile perf
- Perlin wind: use a simple 2D noise lib (`simplex-noise` npm package), sample at low frequency, scroll the z-axis over time
- Submitted text → particles: split the string into characters, each char spawns a boid at its rendered grid position with the char itself as its glyph (overriding the velocity-based glyph for its first few seconds of life, then it conforms to the flock's glyph rules)
- Store submissions in Vercel KV with a short TTL (1 hour) — this is ephemeral by design. For local dev, use a simple in-memory Map in a module-scoped variable.

## API

- `POST /api/release` — body: `{ text: string }` → pushes to queue, returns `{ ok: true }`. Rate-limit to 1 submission per IP per 10s. Max length 280 chars.
- `GET /api/release` — returns `{ items: Array<{ text: string, id: string, ts: number }> }` of submissions from the last ~30s that haven't been consumed by this client (client tracks last-seen id in memory)

## Privacy & content

- No user accounts, no tracking, no storage beyond 1hr TTL
- Server-side: basic profanity/length filter, reject anything over 280 chars, strip HTML
- No text is persisted permanently — the whole point is letting go

## File structure

```
app/
  layout.tsx
  page.tsx              # landing / journal entry
  wind/
    page.tsx            # client component hosting the canvas
  api/
    release/
      route.ts
lib/
  boids.ts              # Boid class, flock update logic
  wind.ts               # Perlin wind field
  dither.ts             # Bayer 4x4 ordered dither helper
  glyphs.ts             # density ramp + glyph selection
  store.ts              # KV or in-memory queue
components/
  JournalField.tsx      # textarea + submit logic
  WindCanvas.tsx        # the canvas + RAF loop
```

## Build order

1. Scaffold Next.js + Tailwind, set up the two routes and the API stub with in-memory store
2. Build `/` — just the textarea, the submit, the "thanks." state. Make it feel right on mobile before anything else.
3. Build `/wind` static: canvas fills viewport, draws a grid of glyphs, no animation yet
4. Add boid simulation (no wind, no dither) — just flocking dots rendered as `.`
5. Add Perlin wind field pushing the flock
6. Add velocity-based glyph ramp
7. Add Bayer ordered dither pass
8. Wire up polling `/api/release` and the text-to-particles transition
9. Tune: boid count, wind strength, glyph ramp, fade timings, frame rate cap
10. Mobile pass: test on a real phone, fix touch/viewport issues, check perf

## Feel check

When it's done, `/` should feel like writing in a private notebook at 2am. `/wind` should feel like watching smoke drift — you can almost read things in it, but they keep dissolving. The handoff between the two should feel like the act of letting go: you wrote it, you sent it, now it's in the wind.
