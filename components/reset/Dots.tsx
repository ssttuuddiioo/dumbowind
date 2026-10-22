"use client";

import { useEffect, useId, useRef, useState } from "react";
import { LED } from "@/lib/reset/config";
import { ROWS, formatCount, layoutLine, litDots } from "@/lib/reset/font";

const R = 0.38; // dot radius in dot-pitch units
const STEP_MS = 55; // one dot row per step while rolling
const PLACE_DELAY_MS = 70; // units digit rolls first, then tens, ...

function GlowFilter({ id }: { id: string }) {
  return (
    <filter id={id} x="-20%" y="-40%" width="140%" height="180%">
      <feGaussianBlur in="SourceGraphic" stdDeviation="0.45" result="wide" />
      <feGaussianBlur in="SourceGraphic" stdDeviation="0.12" result="tight" />
      <feMerge>
        <feMergeNode in="wide" />
        <feMergeNode in="tight" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  );
}

// The dim, unlit LEDs behind everything.
function Panel({ width, color }: { width: number; color: string }) {
  const dots = [];
  for (let y = 0; y < ROWS; y++)
    for (let x = 0; x < width; x++)
      dots.push(<circle key={`${x}.${y}`} cx={x + 0.5} cy={y + 0.5} r={R} />);
  return (
    <g fill={color} opacity={0.11}>
      {dots}
    </g>
  );
}

function Glyph({ ch, x = 0, y = 0 }: { ch: string; x?: number; y?: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      {litDots(ch).map(([dx, dy]) => (
        <circle key={`${dx}.${dy}`} cx={dx + 0.5} cy={dy + 0.5} r={R} />
      ))}
    </g>
  );
}

type TextProps = {
  text: string;
  color?: string;
  className?: string;
  // Glyphs flick on left to right after mount (and whenever `shown` turns true).
  reveal?: boolean;
  shown?: boolean;
  revealMs?: number;
};

export function DotText({
  text,
  color = LED,
  className,
  reveal = false,
  shown = true,
  revealMs = 45,
}: TextProps) {
  const fid = useId().replace(/:/g, "");
  const [armed, setArmed] = useState(!reveal);
  useEffect(() => {
    if (!reveal) return;
    const t = window.setTimeout(() => setArmed(true), 30);
    return () => window.clearTimeout(t);
  }, [reveal]);
  const on = shown && armed;
  const { glyphs, width } = layoutLine(text);
  return (
    <svg
      viewBox={`0 0 ${width} ${ROWS}`}
      className={className}
      role="img"
      aria-label={text}
      style={{ display: "block", overflow: "visible" }}
    >
      <defs>
        <GlowFilter id={fid} />
      </defs>
      <Panel width={width} color={color} />
      <g fill={color} filter={`url(#${fid})`}>
        {glyphs.map((g, i) => (
          <g
            key={i}
            style={{
              opacity: on ? 1 : 0,
              transition: on ? `opacity 0s linear ${i * revealMs}ms` : "none",
            }}
          >
            <Glyph ch={g.ch} x={g.x} />
          </g>
        ))}
      </g>
    </svg>
  );
}

// One digit window with a 0-9,0-9 strip behind it. Rolling up always moves
// the strip upward, one dot row per step, so motion stays on the LED grid.
function RollDigit({
  digit,
  x,
  place,
}: {
  digit: number;
  x: number;
  place: number;
}) {
  const [pos, setPos] = useState(digit);
  const [anim, setAnim] = useState<{ ms: number; steps: number; delay: number } | null>(null);
  const shown = useRef(digit);

  useEffect(() => {
    const from = shown.current;
    if (digit === from) return;
    shown.current = digit;
    const target = digit > from ? digit : digit + 10;
    const rows = (target - from) * (ROWS + 1);
    const delay = place * PLACE_DELAY_MS;
    setAnim({ ms: rows * STEP_MS, steps: rows, delay });
    setPos(target);
    const t = window.setTimeout(() => {
      setAnim(null);
      setPos(digit);
    }, delay + rows * STEP_MS + 30);
    return () => window.clearTimeout(t);
  }, [digit, place]);

  const strip = [];
  for (let i = 0; i < 20; i++) strip.push(<Glyph key={i} ch={String(i % 10)} y={i * (ROWS + 1)} />);

  return (
    <svg x={x} y={0} width={5} height={ROWS} viewBox={`0 0 5 ${ROWS}`} overflow="hidden">
      <g
        style={{
          transform: `translateY(${-pos * (ROWS + 1)}px)`,
          transition: anim
            ? `transform ${anim.ms}ms steps(${anim.steps}, end) ${anim.delay}ms`
            : "none",
        }}
      >
        {strip}
      </g>
    </svg>
  );
}

export function DotTicker({
  value,
  color = LED,
  className,
}: {
  value: number;
  color?: string;
  className?: string;
}) {
  const fid = useId().replace(/:/g, "");
  const str = formatCount(value);
  const { glyphs, width } = layoutLine(str);
  const digitCount = str.replace(/\D/g, "").length;
  let seen = 0;

  return (
    <svg
      viewBox={`0 0 ${width} ${ROWS}`}
      className={className}
      role="img"
      aria-label={str}
      style={{ display: "block", overflow: "visible" }}
    >
      <defs>
        <GlowFilter id={fid} />
      </defs>
      <Panel width={width} color={color} />
      <g fill={color} filter={`url(#${fid})`}>
        {glyphs.map((g, i) => {
          if (!/\d/.test(g.ch)) return <Glyph key={`s${i}`} ch={g.ch} x={g.x} />;
          const place = digitCount - 1 - seen++;
          return <RollDigit key={`d${place}`} digit={Number(g.ch)} x={g.x} place={place} />;
        })}
      </g>
    </svg>
  );
}
