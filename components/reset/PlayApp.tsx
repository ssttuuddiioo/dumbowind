"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DotText, DotTicker } from "./Dots";
import { CAMPAIGN, LED, TOPICS, topicById } from "@/lib/reset/config";
import { connect, makeId, type DoneReason, type Link, type ResetEvent } from "@/lib/reset/link";
import { buildStory } from "@/lib/reset/share";

type Phase = "connecting" | "busy" | "intro" | "topic" | "press" | "result" | "ended";

const INTRO_MS = 3200;
const JOIN_RETRY_MS = 1000;
const JOIN_GIVE_UP_MS = 12_000;

type Props = {
  // Set when the phone came from a kiosk QR; absent for the online version.
  session: string | null;
  // Kiosk without a physical button: the phone shows RESET too.
  phoneButton: boolean;
};

export function PlayApp({ session, phoneButton }: Props) {
  const kiosk = Boolean(session);
  const [phase, setPhase] = useState<Phase>(kiosk ? "connecting" : "intro");
  const [topic, setTopic] = useState<string | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [step, setStep] = useState(0); // result reveal: 0 roll from n-1, 1 n, 2 headline, 3 campaign
  const [pressing, setPressing] = useState(false);
  const [ended, setEnded] = useState<DoneReason | "unreachable" | null>(null);
  const [story, setStory] = useState<{ file: File; url: string } | null>(null);

  const pid = useRef("");
  const link = useRef<Link | null>(null);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  const showResult = useCallback((next: number) => {
    setTotal(next);
    setStep(0);
    setPhase("result");
  }, []);

  const onEvent = useCallback(
    (e: ResetEvent) => {
      if (e.type === "joined" && e.ack) {
        if (phaseRef.current !== "connecting") return;
        setPhase(e.pid === pid.current ? "intro" : "busy");
      } else if (e.type === "done") {
        if (phaseRef.current === "busy" || phaseRef.current === "result") return;
        if (e.reason === "counted" && typeof e.total === "number") showResult(e.total);
        else {
          setEnded(e.reason);
          setPhase("ended");
        }
      }
    },
    [showResult],
  );

  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  // Pair with the screen: keep announcing until it acks.
  useEffect(() => {
    if (!session) return;
    pid.current = makeId();
    const l = connect(session, pid.current, { onEvent: (e) => onEventRef.current(e) });
    link.current = l;
    const started = Date.now();
    const retry = window.setInterval(() => {
      if (phaseRef.current !== "connecting") return window.clearInterval(retry);
      if (Date.now() - started > JOIN_GIVE_UP_MS) {
        window.clearInterval(retry);
        setEnded("unreachable");
        setPhase("ended");
        return;
      }
      l.send({ type: "joined", pid: pid.current });
    }, JOIN_RETRY_MS);
    l.send({ type: "joined", pid: pid.current });
    return () => {
      window.clearInterval(retry);
      l.close();
      link.current = null;
    };
  }, [session]);

  useEffect(() => {
    if (phase !== "intro") return;
    const t = window.setTimeout(() => setPhase("topic"), INTRO_MS);
    return () => window.clearTimeout(t);
  }, [phase]);

  // Result sequence: roll up by one, headline, then the campaign.
  useEffect(() => {
    if (phase !== "result") return;
    const ts = [
      window.setTimeout(() => setStep(1), 500),
      window.setTimeout(() => setStep(2), 1700),
      window.setTimeout(() => setStep(3), 3200),
    ];
    return () => ts.forEach((t) => window.clearTimeout(t));
  }, [phase]);

  // Build the story image ahead of the tap so share() keeps the user gesture.
  useEffect(() => {
    const t = topicById(topic);
    if (phase !== "result" || total === null || !t) return;
    let url = "";
    let live = true;
    buildStory(total, t.label).then((blob) => {
      if (!live) return;
      url = URL.createObjectURL(blob);
      setStory({ file: new File([blob], "reset-america.png", { type: "image/png" }), url });
    });
    return () => {
      live = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [phase, total, topic]);

  const pickTopic = (id: string) => {
    setTopic(id);
    link.current?.send({ type: "topic", pid: pid.current, topic: id });
    setPhase("press");
  };

  const press = async () => {
    if (pressing) return;
    setPressing(true);
    if (kiosk) {
      link.current?.send({ type: "pressed", pid: pid.current });
      return; // the screen counts it and answers with `done`
    }
    try {
      const res = await fetch("/api/reset/press", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session: makeId(), topic }),
      });
      if (!res.ok) throw new Error(`press ${res.status}`);
      showResult((await res.json()).total);
    } catch (err) {
      console.error(err);
      setPressing(false);
    }
  };

  const share = async () => {
    if (!story) return;
    const data = { files: [story.file], title: CAMPAIGN.name };
    if (navigator.canShare?.(data)) {
      try {
        await navigator.share(data);
      } catch {
        // dismissed
      }
      return;
    }
    const a = document.createElement("a");
    a.href = story.url;
    a.download = story.file.name;
    a.click();
  };

  const t = topicById(topic);

  return (
    <main className="min-h-[100dvh] bg-ink text-bone flex flex-col px-6 py-10 select-none">
      {phase === "connecting" && (
        <Center>
          <p className="text-bone/50 fade-in">connecting to the screen</p>
        </Center>
      )}

      {phase === "busy" && (
        <Center>
          <p className="text-lg">Someone else is resetting right now.</p>
          <p className="text-bone/50 mt-3">Scan the next code when it appears.</p>
        </Center>
      )}

      {phase === "intro" && (
        <button className="flex-1 flex flex-col justify-center text-left fade-in" onClick={() => setPhase("topic")}>
          <DotText text="RESET AMERICA" className="w-full" reveal />
          <p className="text-xl leading-snug mt-10">
            One button. One count.
            <br />
            Add yours to everyone who wants a reset.
          </p>
          <p className="text-bone/40 text-sm mt-6">tap to start</p>
        </button>
      )}

      {phase === "topic" && (
        <div className="flex-1 flex flex-col justify-center fade-in">
          <p className="text-xl mb-8">What do you want to reset?</p>
          <div className="flex flex-col gap-3">
            {TOPICS.map((tp) => (
              <button
                key={tp.id}
                onClick={() => pickTopic(tp.id)}
                className="w-full text-left text-xl px-5 py-6 border border-bone/25 active:bg-bone active:text-ink transition-colors"
              >
                {tp.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {phase === "press" && (
        <Center>
          {t && <p className="text-bone/50 mb-6">{t.label.toLowerCase()}</p>}
          {kiosk && !phoneButton ? (
            <>
              <DotText text="HIT THE" className="w-[70%]" reveal />
              <DotText text="BUTTON" className="w-[60%] mt-4" reveal />
              <p className="text-bone/50 mt-10">the big one on the kiosk</p>
            </>
          ) : (
            <>
              <p className="text-xl mb-10">Hit the button.</p>
              <button
                onClick={press}
                disabled={pressing}
                aria-label="Reset"
                className="w-[64vw] max-w-[300px] aspect-square rounded-full flex items-center justify-center transition-transform active:scale-95 disabled:opacity-60"
                style={{ background: LED, boxShadow: `0 0 48px ${LED}88, inset 0 -10px 0 #0003` }}
              >
                <DotText text="RESET" color="#f5f3ee" className="w-[62%]" />
              </button>
            </>
          )}
        </Center>
      )}

      {phase === "result" && total !== null && (
        <div className="flex-1 flex flex-col justify-center">
          <DotTicker value={step >= 1 ? total : Math.max(0, total - 1)} className="w-full" />
          <div className="h-16 mt-6">{step >= 2 && <DotText text="PEOPLE RESET AMERICA" className="w-full" reveal />}</div>
          <div className={`transition-opacity duration-700 ${step >= 3 ? "opacity-100" : "opacity-0"}`}>
            {t && (
              <>
                <p className="text-bone/50 text-sm">you reset: {t.label.toLowerCase()}</p>
                <p className="text-lg leading-snug mt-3">{t.ask}</p>
              </>
            )}
            <a href={CAMPAIGN.url} target="_blank" rel="noopener noreferrer" className="block mt-4 underline underline-offset-4" style={{ color: LED }}>
              {CAMPAIGN.urlLabel}
            </a>
            <div className="flex items-end gap-4 mt-8">
              {story && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={story.url} alt="Your Reset America story" className="w-24 border border-bone/20" />
              )}
              <button
                onClick={share}
                disabled={!story}
                className="flex-1 py-5 text-xl text-ink disabled:opacity-50"
                style={{ background: "#f5f3ee" }}
              >
                Share
              </button>
            </div>
          </div>
        </div>
      )}

      {phase === "ended" && (
        <Center>
          <p className="text-lg">
            {ended === "unreachable" ? "Couldn't reach the screen." : "This session ended."}
          </p>
          <p className="text-bone/50 mt-3">
            {kiosk ? "Scan the new code on the screen." : ""}
          </p>
        </Center>
      )}
    </main>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="flex-1 flex flex-col items-center justify-center text-center fade-in">{children}</div>;
}
