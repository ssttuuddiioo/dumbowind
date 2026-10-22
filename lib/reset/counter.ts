// Server-side reset count. Uses Supabase (service role, via PostgREST) when
// configured, otherwise an in-memory counter for local demos.

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SEED = Number(process.env.RESET_SEED ?? 187531);

export const usingSupabase = Boolean(SB_URL && SB_KEY);

const g = globalThis as unknown as { __resetCount?: { total: number; sessions: Set<string> } };
const local = (g.__resetCount ??= { total: SEED, sessions: new Set() });

async function sb<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${SB_URL}/rest/v1/${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      apikey: SB_KEY!,
      Authorization: `Bearer ${SB_KEY}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  if (!res.ok) throw new Error(`supabase ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

export async function getTotal(): Promise<number> {
  if (!usingSupabase) return local.total;
  const rows = await sb<Array<{ total: number }>>("reset_counter?id=eq.1&select=total");
  return Number(rows[0]?.total ?? 0);
}

export type PressResult = { total: number; counted: boolean };

// Adds one press for this session. A session can only ever count once.
export async function press(session: string, topic: string, city: string | null): Promise<PressResult> {
  if (!usingSupabase) {
    if (local.sessions.has(session)) return { total: local.total, counted: false };
    local.sessions.add(session);
    local.total += 1;
    return { total: local.total, counted: true };
  }
  const r = await sb<PressResult>("rpc/increment_reset", {
    method: "POST",
    body: JSON.stringify({ p_session: session, p_topic: topic, p_city: city }),
  });
  return { total: Number(r.total), counted: Boolean(r.counted) };
}
