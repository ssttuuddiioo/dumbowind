"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DotText, DotTicker } from "./Dots";
import { QrCode } from "./QrCode";
import { TIMING, topicById } from "@/lib/reset/config";
import { connect, makeId, type DoneReason, type Link, type ResetEvent } from "@/lib/reset/link";

type Phase = "idle" | "paired" | "counting" | "headline";

const PRESS_KEY = "Space"; // what the USB button encoder sends

async function fetchTotal(): Promise<number | null> {
  try {
    const res = await fetch("/api/reset/count", { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()).total;
  } catch {
    return null;
  }
}

export function ScreenApp({ phoneButton }: { phoneButton: boolean }) {
  const [session, setSession] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [topic, setTopic] = useState<string | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [origin, setOrigin] = useState("");

  // Mirrors for the event handlers, which outlive any one render.
  const st = useRef({
    phase: "idle" as Phase,
    phone: null as string | null,
    topic: null as string | null,
    lastAction: 0,
    phoneSeen: false,
    phoneMissingSince: 0,
  });
  const link = useRef<Link | null>(null);
  const timers = useRef<number[]>([]);

  const go = (p: Phase) => {
    st.current.phase = p;
    setPhase(p);
  };

  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };

  const newRound = useCallback(() => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
    st.current = {
      phase: "idle",
      phone: null,
      topic: null,
      lastAction: 0,
      phoneSeen: false,
      phoneMissingSince: 0,
    };
    setPhase("idle");
    setTopic(null);
    setSession(makeId());
    fetchTotal().then((n) => n !== null && setTotal(n));
  }, []);

  const endRound = useCallback(
    (reason: DoneReason) => {
      link.current?.send({ type: "done", reason });
      // Give the message a moment to leave before the channel closes.
      st.current.phase = "idle";
      window.setTimeout(newRound, 400);
    },
    [newRound],
  );

  const doPress = useCallback(async () => {
    const s = st.current;
    if (s.phase !== "paired" || !s.topic) return;
    go("counting");
    try {
      const res = await fetch("/api/reset/press", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session, topic: s.topic }),
      });
      if (!res.ok) throw new Error(`press ${res.status}`);
      const { total: next } = (await res.json()) as { total: number };
      setTotal(next);
      link.current?.send({ type: "done", reason: "counted", total: next, topic: s.topic });
      later(() => go("headline"), TIMING.headlineDelayMs);
      later(newRound, TIMING.headlineDelayMs + TIMING.headlineHoldMs);
    } catch (err) {
      console.error(err);
      s.lastAction = Date.now();
      go("paired"); // let them try the button again
    }
  }, [session, newRound]);

  const onEvent = useCallback(
    (e: ResetEvent) => {
      const s = st.current;
      switch (e.type) {
        case "joined": {
          if (e.ack) return;
          if (s.phase === "idle" && !s.phone) {
            s.phone = e.pid;
            s.lastAction = Date.now();
            go("paired");
          }
          // Ack every join so retries settle; a second phone sees someone
          // else's pid and knows the kiosk is taken.
          if (s.phone) link.current?.send({ type: "joined", pid: s.phone, ack: true });
          return;
        }
        case "topic": {
          if (e.pid !== s.phone || s.phase !== "paired" || !topicById(e.topic)) return;
          s.topic = e.topic;
          s.lastAction = Date.now();
          setTopic(e.topic);
          return;
        }
        case "pressed": {
          if (e.pid && e.pid !== s.phone) return;
          doPress();
          return;
        }
      }
    },
    [doPress],
  );

  const onPresence = useCallback((pids: string[]) => {
    const s = st.current;
    if (!s.phone) return;
    if (pids.includes(s.phone)) {
      s.phoneSeen = true;
      s.phoneMissingSince = 0;
    } else if (s.phoneSeen && !s.phoneMissingSince) {
      s.phoneMissingSince = Date.now();
    }
  }, []);

  // Handlers change identity when the session does; keep the link pointing
  // at the latest ones without reconnecting.
  const handlers = useRef({ onEvent, onPresence });
  handlers.current = { onEvent, onPresence };

  useEffect(() => {
    setOrigin(window.location.origin);
    newRound();
  }, [newRound]);

  useEffect(() => {
    if (!session) return;
    const pid = `screen${session}`.slice(0, 32);
    const l = connect(session, pid, {
      onEvent: (e) => handlers.current.onEvent(e),
      onPresence: (p) => handlers.current.onPresence(p),
    });
    link.current = l;
    return () => {
      l.close();
      if (link.current === l) link.current = null;
    };
  }, [session]);

  // Guardrails: idle timeout and phone drop-off, only while waiting on the phone.
  useEffect(() => {
    const id = window.setInterval(() => {
      const s = st.current;
      if (s.phase !== "paired") return;
      const now = Date.now();
      if (now - s.lastAction > TIMING.sessionIdleMs) endRound("timeout");
      else if (s.phoneMissingSince && now - s.phoneMissingSince > TIMING.dropGraceMs) endRound("dropped");
    }, 1000);
    return () => window.clearInterval(id);
  }, [endRound]);

  // Keep the idle number fresh as presses land elsewhere.
  useEffect(() => {
    if (phase !== "idle") return;
    const id = window.setInterval(() => {
      fetchTotal().then((n) => n !== null && setTotal(n));
    }, 5000);
    return () => window.clearInterval(id);
  }, [phase]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== PRESS_KEY) return;
      e.preventDefault();
      if (!e.repeat) doPress();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [doPress]);

  const playUrl = session && origin ? `${origin}/play?s=${session}${phoneButton ? "&b=1" : ""}` : "";
  const t = topicById(topic);
  const live = phase !== "idle";

  return (
    <main className="fixed inset-0 overflow-hidden bg-ink cursor-none select-none">
      {/* Idle: scan prompt + QR */}
      <div
        className={`absolute inset-0 flex flex-col items-center justify-center gap-[5vh] transition-opacity duration-700 ${
          live ? "opacity-0 pointer-events-none" : "opacity-100"
        }`}
      >
        <DotText text="SCAN TO RESET AMERICA" className="w-[72vw] max-h-[14vh]" />
        <div className="flex items-center gap-[4vw]">
          <QrCode value={playUrl || "about:blank"} className="w-[min(36vh,30vw)] aspect-square" />
        </div>
        {total !== null && <DotTicker value={total} className="w-[24vw] opacity-70" />}
      </div>

      {/* Live: the big number, then the headline */}
      <div
        className={`absolute inset-0 flex flex-col items-center justify-center transition-opacity duration-700 ${
          live ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        {total !== null && (
          <div
            className="transition-[width] duration-700 ease-out"
            style={{ width: phase === "headline" ? "78vw" : "90vw" }}
          >
            <DotTicker value={total} className="w-full" />
          </div>
        )}
        <div
          className="w-[78vw] transition-[margin] duration-700 ease-out"
          style={{ marginTop: phase === "headline" ? "6vh" : 0 }}
        >
          {phase === "headline" && <DotText text="PEOPLE RESET AMERICA" className="w-full" reveal />}
        </div>
        <p
          className={`absolute bottom-[8vh] text-bone/40 text-[2vw] transition-opacity duration-500 ${
            phase === "paired" ? "opacity-100" : "opacity-0"
          }`}
        >
          {t ? t.label.toLowerCase() : " "}
        </p>
      </div>
    </main>
  );
}
