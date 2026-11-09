import { headers } from "next/headers";
import type { Metadata } from "next";
import QRCode from "qrcode";
import { QR_LINKS, shortUrl, siteUrl } from "@/lib/qr/links";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "qr",
  robots: { index: false, follow: false },
};

export default async function QrPage() {
  const h = headers();
  const base = siteUrl(
    h.get("x-forwarded-host") ?? h.get("host"),
    h.get("x-forwarded-proto"),
  );

  const codes = await Promise.all(
    QR_LINKS.map(async (link) => {
      const url = shortUrl(link.slug, base);
      const svg = await QRCode.toString(url, {
        type: "svg",
        errorCorrectionLevel: "Q",
        margin: 4,
      });
      return { ...link, url, svg };
    }),
  );

  return (
    <main className="min-h-screen bg-ink text-bone font-mono px-6 py-10 text-sm">
      <div className="mx-auto max-w-3xl flex flex-col gap-12">
        <p className="text-bone/50 leading-relaxed">
          each code points at a fixed short link. change where it goes in
          lib/qr/links.ts and redeploy. the printed code keeps working.
        </p>
        {codes.map((c) => (
          <section key={c.slug} className="flex flex-col sm:flex-row gap-6">
            <div
              className="w-full max-w-[280px] bg-white [&>svg]:block [&>svg]:w-full [&>svg]:h-auto"
              dangerouslySetInnerHTML={{ __html: c.svg }}
            />
            <div className="flex flex-col gap-2 break-all">
              <span className="text-bone">{c.slug}</span>
              {c.note && <span className="text-bone/50">{c.note}</span>}
              <span className="text-bone/50">
                encodes <span className="text-bone">{c.url}</span>
              </span>
              <span className="text-bone/50">
                goes to <span className="text-bone">{c.to}</span>
              </span>
              <span className="flex gap-4 pt-2">
                <a
                  className="text-royal hover:opacity-80"
                  href={`/api/qr/${encodeURIComponent(c.slug)}?format=svg`}
                >
                  svg
                </a>
                <a
                  className="text-royal hover:opacity-80"
                  href={`/api/qr/${encodeURIComponent(c.slug)}?format=png`}
                >
                  png
                </a>
                <a
                  className="text-royal hover:opacity-80"
                  href={c.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  test
                </a>
              </span>
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
