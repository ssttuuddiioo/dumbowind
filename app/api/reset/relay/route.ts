import { NextResponse } from "next/server";
import { poll, post } from "@/lib/reset/relay";

export const dynamic = "force-dynamic";

const ID = /^[a-z0-9]{6,32}$/;

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const s = q.get("s") ?? "";
  const pid = q.get("pid") ?? "";
  if (!ID.test(s) || !ID.test(pid)) return NextResponse.json({ error: "invalid" }, { status: 400 });
  return NextResponse.json(poll(s, pid, Number(q.get("after") ?? 0) || 0));
}

export async function POST(req: Request) {
  let body: { s?: unknown; pid?: unknown; event?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad body" }, { status: 400 });
  }
  const { s, pid, event } = body;
  if (typeof s !== "string" || typeof pid !== "string" || !ID.test(s) || !ID.test(pid) || !event) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  post(s, pid, event);
  return NextResponse.json({ ok: true });
}
