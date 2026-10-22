// In-memory stand-in for Supabase Realtime, used when no Supabase keys are
// set. Works under `next dev` (one process). It will NOT work across
// serverless instances on Vercel — set the Supabase env vars there.

export type RelayMsg = { seq: number; from: string; event: unknown };

type Room = { seq: number; msgs: RelayMsg[]; seen: Map<string, number>; touched: number };

const ROOM_TTL_MS = 10 * 60 * 1000;
const PRESENCE_MS = 2_500;
const MAX_MSGS = 50;

const g = globalThis as unknown as { __resetRooms?: Map<string, Room> };
const rooms: Map<string, Room> = (g.__resetRooms ??= new Map());

function room(id: string): Room {
  const now = Date.now();
  rooms.forEach((r, k) => {
    if (now - r.touched > ROOM_TTL_MS) rooms.delete(k);
  });
  let r = rooms.get(id);
  if (!r) {
    r = { seq: 0, msgs: [], seen: new Map(), touched: now };
    rooms.set(id, r);
  }
  r.touched = now;
  return r;
}

export function post(id: string, from: string, event: unknown): void {
  const r = room(id);
  r.msgs.push({ seq: ++r.seq, from, event });
  if (r.msgs.length > MAX_MSGS) r.msgs.splice(0, r.msgs.length - MAX_MSGS);
  r.seen.set(from, Date.now());
}

export function poll(id: string, pid: string, after: number) {
  const r = room(id);
  const now = Date.now();
  r.seen.set(pid, now);
  const present: string[] = [];
  r.seen.forEach((ts, p) => {
    if (now - ts < PRESENCE_MS) present.push(p);
  });
  return {
    seq: r.seq,
    msgs: r.msgs.filter((m) => m.seq > after && m.from !== pid),
    present,
  };
}
