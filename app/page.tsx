"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { JournalField } from "@/components/JournalField";
import { WindScene } from "@/components/WindScene";
import { layoutTyping } from "@/lib/boids/textLayout";

const RELEASE_MS = 3500;

export default function Home() {
  const [text, setText] = useState("");
  const [phase, setPhase] = useState<"field" | "released">("field");
  const [releaseTick, setReleaseTick] = useState(0);
  const [viewport, setViewport] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const update = () =>
      setViewport({ w: window.innerWidth, h: window.innerHeight });
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const submit = useCallback(() => {
    if (!text.trim()) return;
    setReleaseTick((n) => n + 1);
    setPhase("released");
    window.setTimeout(() => {
      setText("");
      setPhase("field");
    }, RELEASE_MS);
  }, [text]);

  const cursor = useMemo(() => {
    if (!viewport.w || !viewport.h) return null;
    return layoutTyping(text, viewport.w, viewport.h).cursor;
  }, [text, viewport]);

  const cursorTop =
    cursor && viewport.h ? viewport.h - cursor.y : 0;
  const cursorLeft = cursor ? cursor.x : 0;
  const showCursor = phase === "field" && cursor !== null;

  return (
    <main className="fixed inset-0 overflow-hidden bg-ink">
      <div className="absolute inset-0 z-0">
        <WindScene typingText={text} releaseTick={releaseTick} />
      </div>
      <span
        aria-hidden
        className={`blink-cursor text-royal fixed font-mono transition-opacity duration-700 ease-out pointer-events-none select-none z-10 ${
          showCursor ? "opacity-100" : "opacity-0"
        }`}
        style={{
          top: cursorTop,
          left: cursorLeft,
          transform: "translate(-50%, -50%)",
          fontSize: 36,
          lineHeight: 1,
        }}
      >
        █
      </span>
      <div className="absolute left-0 right-0 bottom-[280px] flex justify-center px-6 z-10">
        <JournalField
          text={text}
          phase={phase}
          onTextChange={setText}
          onSubmit={submit}
        />
      </div>
      <div className="fixed top-6 left-6 text-bone/40 text-xs sm:text-sm select-none pointer-events-none z-20">
        dumbo open studios 2026
      </div>
      <div className="fixed top-6 right-6 text-bone/40 text-xs sm:text-sm select-none pointer-events-none z-20">
        wind
      </div>
      <div className="fixed bottom-6 left-6 text-xs sm:text-sm z-20">
        <a
          href="https://yopablo.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-royal hover:opacity-80 transition-opacity"
        >
          by yopablo
        </a>
      </div>
      <div className="fixed bottom-6 right-6 text-xs sm:text-sm z-20">
        <a
          href="https://www.srcnyc.fun/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-royal hover:opacity-80 transition-opacity"
        >
          @ src
        </a>
      </div>
    </main>
  );
}
