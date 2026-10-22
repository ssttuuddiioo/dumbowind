// One realtime channel per session, shared by the screen and one phone.
// Supabase Realtime when keys are set; otherwise polls the local relay.

import { createClient, type RealtimeChannel, type SupabaseClient } from "@supabase/supabase-js";

export type DoneReason = "counted" | "timeout" | "dropped";

export type ResetEvent =
  // phone -> screen asks to join; screen -> phone answers with ack + accepted pid
  | { type: "joined"; pid: string; ack?: boolean }
  | { type: "topic"; pid: string; topic: string }
  | { type: "pressed"; pid?: string }
  | { type: "done"; reason: DoneReason; total?: number; topic?: string };

export const EVENTS = ["joined", "topic", "pressed", "done"] as const;

export type Link = {
  send: (e: ResetEvent) => void;
  close: () => void;
};

type Handlers = {
  onEvent: (e: ResetEvent) => void;
  onPresence?: (pids: string[]) => void;
};

export function makeId(len = 10): string {
  const a = "abcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => a[b % a.length]).join("");
}

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SB_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let client: SupabaseClient | null = null;
function supabase(): SupabaseClient | null {
  if (!SB_URL || !SB_ANON) return null;
  client ??= createClient(SB_URL, SB_ANON, { auth: { persistSession: false } });
  return client;
}

export function connect(session: string, pid: string, h: Handlers): Link {
  const sb = supabase();
  return sb ? connectSupabase(sb, session, pid, h) : connectLocal(session, pid, h);
}

function connectSupabase(sb: SupabaseClient, session: string, pid: string, h: Handlers): Link {
  let ready = false;
  const queue: ResetEvent[] = [];
  const ch: RealtimeChannel = sb.channel(`reset:${session}`, {
    config: { broadcast: { self: false }, presence: { key: pid } },
  });

  for (const name of EVENTS) {
    ch.on("broadcast", { event: name }, ({ payload }) => h.onEvent(payload as ResetEvent));
  }
  ch.on("presence", { event: "sync" }, () => h.onPresence?.(Object.keys(ch.presenceState())));

  const push = (e: ResetEvent) => ch.send({ type: "broadcast", event: e.type, payload: e });

  ch.subscribe((status) => {
    if (status !== "SUBSCRIBED") return;
    ready = true;
    ch.track({ at: Date.now() });
    queue.splice(0).forEach(push);
  });

  return {
    send: (e) => (ready ? push(e) : queue.push(e)),
    close: () => {
      sb.removeChannel(ch);
    },
  };
}

function connectLocal(session: string, pid: string, h: Handlers): Link {
  let after = 0;
  let alive = true;
  let timer = 0;
  const q = (extra = "") => `/api/reset/relay?s=${session}&pid=${pid}${extra}`;

  const tick = async () => {
    try {
      const res = await fetch(q(`&after=${after}`), { cache: "no-store" });
      if (res.ok) {
        const data: { seq: number; msgs: Array<{ seq: number; event: ResetEvent }>; present: string[] } =
          await res.json();
        if (!alive) return;
        after = data.seq;
        data.msgs.forEach((m) => h.onEvent(m.event));
        h.onPresence?.(data.present);
      }
    } catch {
      // network blip — try again next tick
    }
    if (alive) timer = window.setTimeout(tick, 350);
  };
  tick();

  return {
    send: (e) => {
      fetch("/api/reset/relay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ s: session, pid, event: e }),
      }).catch(() => {});
    },
    close: () => {
      alive = false;
      window.clearTimeout(timer);
    },
  };
}
