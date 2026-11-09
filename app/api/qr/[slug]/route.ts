import QRCode from "qrcode";
import { findLink, shortUrl, siteUrl } from "@/lib/qr/links";

export const dynamic = "force-dynamic";

// GET /api/qr/<slug>?format=svg|png  -> downloadable, print-ready QR file.
export async function GET(
  req: Request,
  { params }: { params: { slug: string } },
) {
  const link = findLink(params.slug);
  if (!link) return new Response("unknown slug", { status: 404 });

  const format =
    new URL(req.url).searchParams.get("format") === "png" ? "png" : "svg";
  const base = siteUrl(
    req.headers.get("x-forwarded-host") ?? req.headers.get("host"),
    req.headers.get("x-forwarded-proto"),
  );
  const data = shortUrl(link.slug, base);
  const opts = { errorCorrectionLevel: "Q" as const, margin: 4 };
  const filename = `qr-${link.slug}.${format}`;
  const headers = {
    "Content-Disposition": `attachment; filename="${filename}"`,
    "Cache-Control": "no-store",
  };

  if (format === "png") {
    const buf = await QRCode.toBuffer(data, { ...opts, type: "png", width: 2048 });
    return new Response(new Uint8Array(buf), {
      headers: { ...headers, "Content-Type": "image/png" },
    });
  }

  const svg = await QRCode.toString(data, { ...opts, type: "svg" });
  return new Response(svg, {
    headers: { ...headers, "Content-Type": "image/svg+xml" },
  });
}
