import { NextResponse } from "next/server";
import { QR_FALLBACK, findLink } from "@/lib/qr/links";

export const dynamic = "force-dynamic";

// Temporary redirect (307) + no-store so phones never cache the destination.
// A permanent 301/308 would get remembered and break future URL changes.
export function GET(req: Request, { params }: { params: { slug: string } }) {
  const link = findLink(params.slug);
  const dest = new URL(link?.to ?? QR_FALLBACK, req.url);
  const res = NextResponse.redirect(dest, 307);
  res.headers.set("Cache-Control", "no-store, max-age=0");
  return res;
}
