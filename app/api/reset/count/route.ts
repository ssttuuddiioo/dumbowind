import { NextResponse } from "next/server";
import { getTotal } from "@/lib/reset/counter";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ total: await getTotal() });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "count unavailable" }, { status: 502 });
  }
}
