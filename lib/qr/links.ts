// Dynamic QR codes.
//
// Each printed QR code encodes a short, permanent address on this site:
//   https://<site>/q/<slug>
// That address redirects to whatever `to` is set below. To point a printed
// code somewhere new, change its `to` and redeploy. Never rename a slug that
// has already been printed: the slug is what's baked into the code.
//
// Generate / download the codes at /qr.

export type QrLink = {
  slug: string;
  to: string;
  note?: string;
};

export const QR_LINKS: QrLink[] = [
  { slug: "wind", to: "/", note: "dumbo open studios 2026 — the wind" },
];

// The domain baked into the QR codes. Leave empty to use the Vercel
// production domain (or, locally, whatever host you're viewing /qr on).
// Set it explicitly once you know the final domain, e.g. "https://wind.example.com".
export const QR_SITE_URL: string = "";

// Where unknown slugs go.
export const QR_FALLBACK = "/";

export function findLink(slug: string): QrLink | undefined {
  return QR_LINKS.find((l) => l.slug === slug);
}

export function siteUrl(host?: string | null, proto?: string | null): string {
  if (QR_SITE_URL) return QR_SITE_URL.replace(/\/+$/, "");
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel) return `https://${vercel}`;
  if (host) return `${proto ?? "http"}://${host}`;
  return "http://localhost:3000";
}

export function shortUrl(slug: string, base: string): string {
  return `${base}/q/${encodeURIComponent(slug)}`;
}
