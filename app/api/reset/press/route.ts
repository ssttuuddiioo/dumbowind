import { NextResponse } from "next/server";
import { press } from "@/lib/reset/counter";
import { topicById } from "@/lib/reset/config";

export const dynamic = "force-dynamic";

const RATE_MS = 1_500; // venue wifi puts many phones behind one IP
const rate = new Map<string, number>();

function ipOf(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return fwd ? fwd.split(",")[0].trim() : "local";
}

function cityOf(req: Request): string | null {
  const raw = req.headers.get("x-vercel-ip-city");
  if (!raw) return null;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export async function POST(req: Request) {
  let body: { session?: unknown; topic?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad body" }, { status: 400 });
  }

  const session = typeof body.session === "string" ? body.session : "";
  const topic = topicById(typeof body.topic === "string" ? body.topic : null);
  if (!/^[a-z0-9]{6,32}$/.test(session) || !topic) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  const ip = ipOf(req);
  const now = Date.now();
  if (now - (rate.get(ip) ?? 0) < RATE_MS) {
    return NextResponse.json({ error: "slow down" }, { status: 429 });
  }
  rate.set(ip, now);

  try {
    return NextResponse.json(await press(session, topic.id, cityOf(req)));
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "count unavailable" }, { status: 502 });
  }
}
