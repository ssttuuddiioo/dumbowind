# Reset America demo

Lives alongside the wind piece in this repo. Two routes:

- `/screen` is the kiosk view (Chrome kiosk mode on the Mac mini). Spacebar is the button.
- `/play?s=SESSION` is the phone view, opened from the QR. `/play` with no session is the online version with its own RESET button.
- `/screen?b=1` puts a RESET button on the paired phone too, for kiosks with no physical button.

## Flow

The screen makes a session ID and puts it in the QR. The phone joins that channel and the screen switches to the big number. The phone picks a topic. Then the spacebar (or the phone's RESET) sends `pressed`. The screen calls `/api/reset/press`, rolls the number up, broadcasts `done` with the new total, shows the headline for 10s, and starts a new session.

Channel events: `joined` (phone announces, screen acks with the accepted phone id), `topic`, `pressed`, `done` (`counted` / `timeout` / `dropped`).

Guardrails:
- One phone per session. A second phone is told the kiosk is busy.
- One press per session, enforced by the screen and by a unique `session_id` in the database.
- 60s with no action ends the session.
- The screen resets if the phone leaves the channel's presence for 4s.

## Running locally (no Supabase)

```
npm install
npm run dev
```

With no Supabase env vars, a polling relay in the Next.js server stands in for Realtime, and the count is kept in memory, starting at 187,531. To use your phone, open the screen at your laptop's LAN address (e.g. `http://192.168.1.20:3000/screen`) so the QR points somewhere the phone can reach.

The local relay only works in a single server process. It will not work on Vercel.

## Supabase

1. Run `supabase/migrations/20261022000000_reset_america.sql` on the project. It creates `reset_counter`, `reset_presses`, and `increment_reset()`. Change the seed number in the file before launch.
2. Set the env vars (locally in `.env.local`, and in Vercel):

```
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon or publishable key>   # Realtime channels
SUPABASE_SERVICE_ROLE_KEY=<service role key>              # server only, for the count
```

The browser only uses the anon key, for Realtime broadcast and presence. The tables have RLS on with no policies, and only the service role can call `increment_reset()`, so the count can't be changed from the browser.

City comes from Vercel's `x-vercel-ip-city` header, so it is empty locally. Kiosk presses log the kiosk's city.

## Swap before going public

- Topic labels and the "what Issue One is asking" text in `lib/reset/config.ts` are placeholders.
- The LED color is `LED` in the same file.
