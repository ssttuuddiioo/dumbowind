"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

// Dark modules on off-white so every phone camera reads it.
export function QrCode({ value, className }: { value: string; className?: string }) {
  const [svg, setSvg] = useState("");

  useEffect(() => {
    let live = true;
    QRCode.toString(value, {
      type: "svg",
      margin: 2,
      errorCorrectionLevel: "M",
      color: { dark: "#0a0a0a", light: "#f5f3ee" },
    }).then((s) => live && setSvg(s));
    return () => {
      live = false;
    };
  }, [value]);

  return (
    <div
      data-url={value}
      className={`transition-opacity duration-500 [&>svg]:block [&>svg]:w-full [&>svg]:h-full ${svg ? "opacity-100" : "opacity-0"} ${className ?? ""}`}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
